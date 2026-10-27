// orchestrators/marketplace/add.ts
//
// MA-1..6, MA-8..11 (MA-7 does not apply per D-21 -- isomorphic-git
// eliminates the "git not found on PATH" failure mode entirely).
//
// Flow (D-04 outer guard wraps the ENTIRE flow including network IO):
//
//   parsePluginSource(rawSource) -> path | github | url | unknown
//   if unknown: throw new Error(parsed.reason)  // MA-10
//
//   withStateGuard(locations, async (state) => {
//     if standalone and exactly one record has the typed source:  // LAYER-01
//       declare it in the target layer; no clone, no state write
//
//     if (github) or (url):  // MURL-01: url mirrors the github clone path
//       gitOps.clone(stagingDir)                            // network -- gated by NFR-5
//       write <staging>/.git/pi-claude-marketplace.json     // Q-01 ownership marker
//       read + MARKETPLACE_VALIDATOR.Check(<staging>/.claude-plugin/marketplace.json)
//       MA-8  duplicate-name check on state.marketplaces[<derivedName>]
//       MA-6/MA-12/MA-13  recognize-remove-rename on sources/<derivedName>/:
//             a tree carrying the marker whose `origin` names the source is
//             removed; every other outcome throws
//       fs.rename(stagingDir, finalDir)                     // atomic, same-FS by D-09
//       setOwn(state.marketplaces, derivedName, { ... })
//
//     if (path):
//       resolve manifest path on disk per MA-3
//       read + MARKETPLACE_VALIDATOR.Check(manifest.json)
//       MA-8 duplicate-name check on state.marketplaces[<derivedName>]
//       setOwn(state.marketplaces, derivedName, { ... })     // NFR-5: NO gitOps calls
//   })
//
//   // The success notification is a single
//   //   notify(opts.ctx, opts.run, { marketplaces: [{ status: "added", ... }] })
//   // call. Both github and path source kinds collapse to the same
//   // payload (the `<autoupdate>` marker lives on the list-surface header
//   // per D-17.1-01 / D-18-04). The `/reload to pick up changes` trailer
//   // is computed by `notify()` (mp.status `"added"` is state-changing);
//   // callers MUST NOT append it. See the construction recipe block-comment
//   // above the notify() call site for the full mirror template.
//
// Staging via D-09, GitOps injection via D-12, follow-upstream-blindly via
// D-14.
//
// WR-05: a standalone add matches the typed source against the scope's
// records before any clone, so a same-source duplicate costs no clone. A
// different source whose manifest declares a recorded name still clones
// first: the marketplace name comes from the manifest's `name` field, which
// exists only inside the cloned tree, and reading it without a clone would
// need a manifest probe outside the GitOps surface (D-12/D-13).

import { randomUUID } from "node:crypto";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { networkCloneUrl, originMatchesSource } from "../../domain/clone-key.ts";
import { loadMarketplaceManifestDocument } from "../../domain/manifest.ts";
import { isReservedRecordKey } from "../../domain/name.ts";
import { parsePluginSource, samePlannedSource } from "../../domain/source.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { writeMarketplaceConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  FetchedUrlCause,
  InvalidMarketplaceManifestError,
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  StateLockHeldError,
  UnreadableSourceCloneError,
  UnremovableLeftoverCloneError,
  UnsupportedSourceError,
  appendLeakToError,
  errorMessage,
  hasFetchedUrlCause,
  rethrowInvalidGitHubBaseUrl,
} from "../../shared/errors.ts";
import {
  cleanupStaging,
  createRemovalOps,
  pathExists,
  type RemovalOps,
} from "../../shared/fs-utils.ts";
import {
  classifyGitSourceAccessFailure,
  hostHttpFailureFrame,
} from "../../shared/git-failure-classifiers.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { composeLeftoverRemovalAdvisories } from "../../shared/notification-summary.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage, type Reason } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Single,
} from "../../shared/notify-context.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import {
  DEFAULT_CREDENTIAL_OPS,
  buildAuthForHost,
  buildGitHubAuth,
  hostFromCloneUrl,
  type AuthAttemptResult,
} from "../auth-host.ts";
import { seedSameRepoPluginMirrors } from "../plugin/clone-cache.ts";

import { ADD_CONTEXT } from "./add.messaging.ts";
import {
  DEFAULT_GIT_OPS,
  marketplaceFailureRows,
  recordedManifestPath,
  type GitAuthBundle,
  type GitOps,
} from "./shared.ts";

import type { DeviceFlowHttp } from "../../domain/github-auth.ts";
import type { GitHubSource, PathSource, UrlSource } from "../../domain/source.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
  ScopeDependencyInstallRow,
} from "../types.ts";

/**
 * RECON-03: controls how `addMarketplace` surfaces
 * notifications. Mirrors the `InstallPluginNotifications` precedent.
 *
 * - `"standalone"` (default when option is omitted): the orchestrator fires
 *   one `notify(ctx, run, ...)` per outcome arm with the per-variant
 *   `MarketplaceNotificationMessage` / `MarketplaceNotAddedMessage` payload.
 *   Byte-identical to today; every existing caller (edge handler, bootstrap
 *   composer, catalog UAT) observes zero output drift.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `AddMarketplaceOutcome` instead. Consumed by `applyReconcile`
 *   which aggregates per-entry outcomes into ONE notify() per load (IL-2).
 *   The orchestrated caller is contractually required to render the outcome
 *   itself.
 */
export type AddMarketplaceNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `addMarketplace` in
 * orchestrated mode. Standalone mode returns `void` for back-compat.
 *
 * `success` (status: "added") carries the `name` of the newly recorded
 * marketplace so the apply cascade can render the row.
 *
 * `failed` collapses every classified precondition failure
 * (`classifyAddError` recognized: duplicate name / stale clone / permission
 * denied / unreadable / unparseable or invalid manifest (MPA-02) /
 * unsupported source / source missing / network unreachable / network error)
 * plus the catastrophic
 * fallback ("unparseable" -- chosen because every recognised add precondition
 * yields a typed error, so a non-enumerated throw is by construction an
 * unparseable / corrupted source-tree shape). Consumers narrow on
 * `instanceof MarketplaceDuplicateNameError` etc. via `outcome.error` to
 * recover the specific failure class.
 *
 * `cause` carries the formatted user-visible text for orchestrated callers
 * that surface it directly.
 *
 * `reason` is typed as `Reason` (not `ContentReason`) so the `applyReconcile`
 * caller can dispatch on the broader closed set, including the
 * structural `"marketplace not added"` sentinel surfaced by the `remove` sibling. This
 * adopts a broader-than-the-plan type to keep the orchestrated outcome
 * dispatchable end-to-end without a separate marker field.
 */
export type AddMarketplaceOutcome =
  | { readonly status: "added"; readonly name: string }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

/** Inputs to `addMarketplace`: the notification context, scope, source, and injected ports. */
export interface AddMarketplaceOptions {
  readonly ctx: NotificationContext;
  /**
   * D-05 / D-07: the command's run, or the composer's run when bootstrap,
   * import, or reconcile drives the add. Every emission renders from its
   * soft-dependency snapshot.
   */
  readonly run: NotificationRun;
  /** SC-5: the edge layer defaults this to "user"; orchestrator receives a fully resolved Scope. */
  readonly scope: Scope;
  /** Used to compute project-scope locations (`<cwd>/.pi`). Ignored when scope === "user". */
  readonly cwd: string;
  /** The user-supplied source string (`owner/repo`, `https://...`, `~/path`, `./path`, etc.). */
  readonly rawSource: string;
  /** Lifecycle-owned completion cache shared with the registered read path. */
  readonly completionCache: CompletionCache;
  /** D-12 injection seam. Defaults to DEFAULT_GIT_OPS (which wraps platform/git.ts). */
  readonly gitOps?: GitOps;
  /**
   * AUTH-01 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject createCredentialOpsFake() from test/platform/credential-ops-fake.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam; production callers omit and get the default github.com
   * fetch. When provided, threads into the onAuthRequired closure so tests
   * can drive Device Flow end-to-end without network.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * Composition seam for `bootstrapClaudePlugin` (ATTR-07). When `true`, the
   * enumerated precondition errors are re-thrown (typed) instead of being
   * routed through `notify` as a `(failed) {<reason>}` row. Bootstrap catches
   * the error to skip its autoupdate step, then renders it with
   * `notifyAddFailure`. The public `marketplace add` command path omits this
   * flag and gets the ATTR-07 structured failed row. Omitted (undefined) =>
   * route through notify.
   */
  readonly rethrowPreconditionErrors?: boolean;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- byte-identical to today.
   * Orchestrated mode suppresses notify() and returns a typed outcome.
   */
  readonly notifications?: AddMarketplaceNotifications;
  /**
   * WB-01: when true, target the local config (`claude-plugins.local.json`)
   * instead of the base config (`claude-plugins.json`). The base config is
   * NEVER touched on the --local path; loadConfig's `absent` arm
   * yields an empty starting shape that saveConfig writes back to the local
   * path.
   */
  readonly local?: boolean;
  /**
   * D-PL2-09: `apply`'s missing-dependency step over one scope. After a
   * standalone add that recorded the marketplace, the add's scope installs
   * the missing dependencies the added marketplace offers, as Claude Code
   * resolves missing dependencies after a marketplace add. Only the
   * `marketplace add` command and `bootstrap` pass it; `apply`, `import` and
   * the install-time add omit it, because they run their own steps.
   */
  readonly installMissingDependencies?: ScopeDependencyInstallFn;
  /**
   * D-PL6-19: the recorded marketplace this add replaces in place. The new
   * source is recorded under the same name, the record's plugins are kept, and
   * a github or url clone it replaced is removed once the state is saved.
   * Import sets it for a settings entry whose name the scope records with
   * another source. A source whose manifest names another marketplace fails
   * as `invalid manifest` and changes nothing.
   */
  readonly replaceRecorded?: string;
}

/**
 * Resolve the typed add-precondition error from a thrown value, unwrapping ONE
 * level of `Error.cause`. The github guard's MA-9 catch wraps a precondition
 * error via `appendLeakToError` when `cleanupStaging` itself leaks -- that
 * produces a generic `Error` whose `.cause` is the original typed error. Both
 * the unwrapped (no-leak) and wrapped (leak) shapes must classify identically,
 * so ATTR-07 routing survives a cleanup leak. Single level only --
 * a deeper chain is not an add-precondition shape this orchestrator produces.
 *
 * GHB-01: a clone failure whose cause is a `FetchedUrlCause` is the failure
 * itself, so it is not unwrapped; its code stays readable to the classifier.
 */
function unwrapAddError(err: unknown): unknown {
  if (
    err instanceof MarketplaceDuplicateNameError ||
    err instanceof StaleSourceCloneError ||
    err instanceof UnreadableSourceCloneError ||
    err instanceof InvalidMarketplaceManifestError ||
    err instanceof UnsupportedSourceError ||
    err instanceof ManifestReadDeniedError
  ) {
    return err;
  }

  if (err instanceof Error && err.cause !== undefined && !(err.cause instanceof FetchedUrlCause)) {
    return err.cause;
  }

  return err;
}

/**
 * MA-14: join the leftover-removal leak and the cleanup leak into ONE value for
 * the MA-9 catch's `appendLeakToError` call (IN-04: both of its arms). A second
 * independent `appendLeakToError` call would build a two-level `Error.cause`
 * chain that `unwrapAddError` cannot see through, silently breaking the
 * `{stale clone}` classification -- so a double fault reads as one leak line
 * instead.
 */
function joinLeaks(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) {
    return b;
  }

  if (b === undefined) {
    return a;
  }

  return `${a}; ${b}`;
}

/**
 * ATTR-07: map an `addMarketplace` precondition error to its
 * closed-set `ContentReason`. Fully `instanceof`-driven (D-48-C A3) so the
 * catch-all returns `undefined` -- a non-enumerated error (an unforeseen
 * catastrophic failure) re-throws at the entrypoint rather than being silently
 * mislabeled. No substring matching. `handleAddFailure` reports a
 * `StateLockHeldError` before it calls this classifier (FLR-02).
 */
export function classifyAddError(rawErr: unknown): ContentReason | undefined {
  const err = unwrapAddError(rawErr);
  if (err instanceof MarketplaceDuplicateNameError) {
    return "duplicate name";
  }

  if (err instanceof StaleSourceCloneError) {
    return "stale clone";
  }

  if (err instanceof UnreadableSourceCloneError) {
    return err.failure === "permission-denied" ? "permission denied" : "unreadable";
  }

  // MPA-02 / D-11: a manifest fault reads the token `list` and `info` use, so
  // malformed JSON is `unparseable` and a schema-invalid manifest is
  // `invalid manifest`.
  if (err instanceof InvalidMarketplaceManifestError) {
    return narrowProbeError(err);
  }

  if (err instanceof UnsupportedSourceError) {
    return "unsupported source";
  }

  if (err instanceof ManifestReadDeniedError) {
    return "permission denied";
  }

  return err instanceof Error ? errorAddReason(err) : undefined;
}

/** The `classifyAddError` reason of an errno-bearing or git clone error. */
function errorAddReason(err: Error): ContentReason | undefined {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return "source missing";
  }

  // GAUTH-02 / D-76-09: delegate git clone errors to the source-access
  // classifier. It includes the shared auth/network ladder and adds
  // repository-missing and host HTTP statuses for this source-access
  // boundary. The opt-in layer keeps other callers' fallthrough semantics
  // unchanged. The clone catch only cleans staging and rethrows, so this
  // boundary must classify the error before Pi renders a raw exception.
  return classifyGitSourceAccessFailure(err);
}

/**
 * MPA-02: a manifest read refused with EACCES or EPERM, classified as
 * `permission denied` as `list` and `info` read it. Raised only where the add
 * reads the source's manifest, so a refused state or config write keeps its
 * own error.
 */
class ManifestReadDeniedError extends Error {
  constructor(manifestPath: string, cause: Error) {
    super(`cannot read the marketplace manifest ${manifestPath}`, { cause });
    this.name = "ManifestReadDeniedError";
  }
}

/**
 * Reads the manifest, typing a read `narrowProbeError` calls `permission
 * denied` (EACCES or EPERM) as `ManifestReadDeniedError`.
 */
async function readManifestDocument(
  manifestPath: string,
): ReturnType<typeof loadMarketplaceManifestDocument> {
  try {
    return await loadMarketplaceManifestDocument(manifestPath);
  } catch (err) {
    if (err instanceof Error && narrowProbeError(err) === "permission denied") {
      throw new ManifestReadDeniedError(manifestPath, err);
    }

    throw err;
  }
}

/**
 * Reads the manifest at `manifestPath` and returns the marketplace name it
 * declares. A `__proto__` name fails as `invalid manifest` (D-08-07), and a
 * name the scope already holds fails as a duplicate (MA-8), both before any
 * state mutation.
 */
async function newMarketplaceName(
  manifestPath: string,
  marketplaces: ExtensionState["marketplaces"],
  scope: Scope,
): Promise<{ name: string; comparisonJson: string }> {
  const {
    manifest: { name },
    comparisonJson,
  } = await readManifestDocument(manifestPath);
  if (isReservedRecordKey(name)) {
    throw new InvalidMarketplaceManifestError(
      `marketplace.json schema invalid: name "${name}" is reserved`,
    );
  }

  if (ownValue(marketplaces, name) !== undefined) {
    throw new MarketplaceDuplicateNameError(name, scope);
  }

  return { name, comparisonJson };
}

/**
 * ATTR-07 (A2): the marketplace subject name for a failed-add row.
 * Post-manifest failures know the derived marketplace name
 * (`MarketplaceDuplicateNameError` carries `mpName`; `StaleSourceCloneError`
 * and `UnreadableSourceCloneError` carry the derived `mpName`), so the row
 * renders on the real subject. Pre-clone/pre-manifest failures (unsupported
 * source, source missing, invalid manifest) have no derived name, so the
 * user-typed `rawSource` is the subject.
 */
function addSubjectName(rawErr: unknown, rawSource: string): string {
  const err = unwrapAddError(rawErr);
  if (err instanceof MarketplaceDuplicateNameError) {
    return err.mpName;
  }

  if (err instanceof StaleSourceCloneError && err.mpName !== undefined) {
    return err.mpName;
  }

  if (err instanceof UnreadableSourceCloneError) {
    return err.mpName;
  }

  return rawSource;
}

/**
 * WR-06: a typed path source names the recorded marketplace only when it
 * resolves, as the add resolves it (`~` expanded, relative to the command's
 * directory), to the record's root or its recorded manifest. The same
 * spelling typed in another directory names another directory, which the add
 * must read. Other kinds match on `samePlannedSource` alone.
 */
function resolvesToRecord(
  record: ExtensionState["marketplaces"][string],
  rawSource: string,
  cwd: string,
): boolean {
  const typed = parsePluginSource(rawSource);
  if (typed.kind !== "path") {
    return true;
  }

  const onDisk = resolvePathSource(typed.logical, cwd);
  return onDisk === record.marketplaceRoot || onDisk === recordedManifestPath(record);
}

/**
 * LAYER-01 / D-MF-03: the same marketplace may be declared in both config
 * layers of a scope. When exactly one record of the scope has the typed
 * source, a standalone add declares that marketplace in the target layer and
 * reuses the record and its clone: no clone, no git call, no state write. The
 * match is `samePlannedSource`, the reconcile planner's own identity rule, so
 * the declared source never reads as a source mismatch on reload, and for a
 * path source also `resolvesToRecord` (WR-06). A path spelled another way
 * (`~/tools` for `/home/me/tools`) is therefore not a match even when it names
 * the same directory: declaring it would make the planner report a source
 * mismatch on every reload.
 *
 * MPA-01: a target layer that already declares the name with a source that
 * plans the same is the marketplace already added, so the add writes nothing
 * (Claude Code: "already added; nothing changed"). A target layer that
 * declares the name with another source refuses as a duplicate.
 *
 * Returns the matched name and whether the add declared it, or `undefined`
 * when no single record matches or the add is orchestrated (reconcile and
 * import never write a config back, WR-09). The caller runs this outside the
 * MA-9 / WR-07 cleanup catch: that cleanup removes a clone the add created,
 * and this path creates none.
 */
async function redeclareRecordedSource(args: {
  marketplaces: ExtensionState["marketplaces"];
  current: ScopeConfig;
  targetConfigPath: string;
  locations: ScopedLocations;
  rawSource: string;
  cwd: string;
  orchestrated: boolean;
}): Promise<RecordedAdd | undefined> {
  const { current, locations, rawSource } = args;
  if (args.orchestrated) {
    return undefined;
  }

  const [match, ...others] = Object.entries(args.marketplaces).filter(
    ([, record]) =>
      samePlannedSource(record.source, rawSource) === "same" &&
      resolvesToRecord(record, rawSource, args.cwd),
  );
  if (match === undefined || others.length > 0) {
    return undefined;
  }

  const [name] = match;
  const declared = ownValue(current.marketplaces, name);
  if (declared !== undefined) {
    if (samePlannedSource(declared.source, rawSource) !== "same") {
      throw new MarketplaceDuplicateNameError(name, locations.scope);
    }

    return { name, alreadyAdded: true };
  }

  await writeMarketplaceConfigEntry(current, args.targetConfigPath, locations.scopeRoot, name, {
    source: rawSource,
  });
  return { name, alreadyAdded: false };
}

/**
 * The name an add recorded or matched, and whether the scope already held it
 * with the typed source, so the add changed nothing (MPA-01).
 */
interface RecordedAdd {
  readonly name: string;
  readonly alreadyAdded: boolean;
}

/**
 * WB-01 mitigation: a CFG-03 invalid-config arm aborts the
 * command BEFORE any state mutation or network call. Thrown so the
 * entrypoint catch routes through `classifyAddError` -> `invalid manifest`
 * with a basename-only cause (T-56-02-05 information disclosure mitigation).
 */
class ConfigInvalidError extends InvalidMarketplaceManifestError {
  constructor(configBasename: string) {
    super(`Config file "${configBasename}" failed schema validation.`);
    this.name = "ConfigInvalidError";
  }
}

/**
 * S5a / S5b (MA-10): parse the raw source and refuse every kind `marketplace
 * add` cannot record, before any lock or disk access. The refusal is an
 * `UnsupportedSourceError`, classified as `unsupported source` (D-48-C A3).
 */
export function parseAddableSource(rawSource: string): GitHubSource | UrlSource | PathSource {
  const source = parsePluginSource(rawSource);

  // S5a: the parser produced an unknown kind with a reason, surfaced verbatim
  // on the cause.
  if (source.kind === "unknown") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${rawSource}": ${source.reason}`,
    );
  }

  // S5b: valid-but-unsupported kinds. MURL-01 / D-76-05: `url` is admitted;
  // only `git-subdir` and `npm` (marketplace-level) stay rejected.
  if (source.kind !== "github" && source.kind !== "path" && source.kind !== "url") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${rawSource}": unsupported source kind ${source.kind}`,
    );
  }

  return source;
}

/**
 * LAYER-07 / D-MF-04: the lock-free add body. It records the marketplace `source` names in
 * `state` and, for a github or url source, clones it into `sources/<name>/`
 * with the MA-6 / MA-12 / MA-13 leftover handling and the MA-9 staging
 * cleanup. It returns the recorded name and, for a github or url source, the
 * final clone directory.
 *
 * LAYER-07 / D-MF-04: a project-scope install that needs a marketplace only
 * the user scope records runs this body inside its own lock, so the project
 * gets the record and the clone an explicit `marketplace add --scope project`
 * gives it.
 *
 * Locking contract: the caller holds the scope's state lock and owns the
 * config write-back and the save. `proper-lockfile` (`retries: 0`) is not
 * re-entrant, so this body takes no lock of its own. When the caller's
 * transaction does not save, the caller removes the returned `cloneDir`
 * (WR-07), as `runAddInGuard` does for itself. A failure inside this body
 * cleans its own staging (MA-9).
 */
export async function addMarketplaceToState(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly source: GitHubSource | UrlSource | PathSource;
  readonly cwd: string;
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly removalOps: RemovalOps;
  readonly credentialOps?: CredentialOps | undefined;
  readonly deviceFlowHttp?: DeviceFlowHttp | undefined;
  readonly gitOps?: GitOps | undefined;
  /**
   * FTCH-06 / D-79-02: the command's once-per-host Device Flow memo. An
   * install passes its own, so its add and its plugin clones share one memo.
   */
  readonly authMemo?: Map<string, AuthAttemptResult> | undefined;
  /** D-PL6-19: the plugins the new record starts with. Omitted, it starts with none. */
  readonly plugins?: ExtensionState["marketplaces"][string]["plugins"] | undefined;
  /**
   * D-PL6-19: runs once the new source is fetched and its manifest validated,
   * with the name it declares, right before the new clone takes its place.
   */
  readonly beforePlace?: ((name: string) => Promise<void>) | undefined;
}): Promise<{ readonly name: string; readonly cloneDir?: string }> {
  const { state, locations, source, cwd, removalOps, deviceFlowHttp, authMemo, beforePlace } = args;
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = args.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  const plugins = args.plugins ?? {};
  if (source.kind === "path") {
    return { name: await addPathInGuard({ state, locations, source, cwd, plugins, beforePlace }) };
  }

  // MURL-01 / D-76-06: source.url is the stored canonical identity; the wire
  // url derives from the source via `networkCloneUrl` (D-2-01, D-2-03). Every
  // host carries an auth bundle; the provider lookup decides its Device Flow
  // half (PROV-03).
  const auth = cloneAuthFor(source, {
    credentialOps,
    ctx: args.ctx,
    run: args.run,
    ...(deviceFlowHttp !== undefined && { deviceFlowHttp }),
    ...(authMemo !== undefined && { authMemo }),
  });
  const name = await addGitClonedInGuard({
    state,
    locations,
    source,
    gitOps,
    removalOps,
    auth,
    cwd,
    plugins,
    beforePlace,
  });
  return { name, cloneDir: await locations.sourceCloneDir(name) };
}

type AddToStateArgs = Parameters<typeof addMarketplaceToState>[0];
type RecordedPlugins = ExtensionState["marketplaces"][string]["plugins"];

/**
 * What an add recorded: the name, the new clone of a github or url source,
 * and, for a replace (D-PL6-19), the replaced clone it set aside.
 */
interface AddedToState {
  readonly name: string;
  readonly cloneDir?: string;
  readonly setAside?: string;
}

/**
 * D-PL6-19: move the github or url clone of the replaced marketplace into
 * `sources-staging/`, the same filesystem (D-09), so the new clone can take
 * its place. Both getters enforce containment (NFR-10). A path source's
 * directory is the user's own and is never moved. Returns where the clone
 * went, or `undefined` when nothing was moved.
 */
async function setAsideReplacedClone(
  locations: ScopedLocations,
  name: string,
  source: unknown,
): Promise<string | undefined> {
  const kind = parsePluginSource(source).kind;
  const cloneDir = await locations.sourceCloneDir(name);
  if ((kind !== "github" && kind !== "url") || !(await pathExists(cloneDir))) {
    return undefined;
  }

  const setAside = await locations.sourcesStagingDir(randomUUID());
  await mkdir(path.dirname(setAside), { recursive: true });
  await rename(cloneDir, setAside);
  return setAside;
}

/**
 * D-PL6-19: rename a set-aside clone back to `sources/<name>/`. Returns a leak
 * message when the rename fails, so the caller appends it to its error
 * (MA-9).
 */
async function restoreReplacedClone(
  locations: ScopedLocations,
  name: string,
  setAside: string | undefined,
): Promise<string | undefined> {
  if (setAside === undefined) {
    return undefined;
  }

  const cloneDir = await locations.sourceCloneDir(name);
  try {
    await rename(setAside, cloneDir);
    return undefined;
  } catch (err) {
    return `failed to restore marketplace clone ${setAside} to ${cloneDir}: ${errorMessage(err)}`;
  }
}

async function discardNewClone(
  removalOps: RemovalOps,
  cloneDir: string | undefined,
): Promise<string | undefined> {
  return cloneDir === undefined
    ? undefined
    : cleanupStaging(removalOps, cloneDir, `marketplace final clone ${cloneDir}`);
}

/**
 * D-PL6-19: the lock-free replace body. The caller holds the scope's state
 * lock, as for `addMarketplaceToState`, and saves nothing on a throw. The
 * replaced record leaves the working state and the add runs with its plugins.
 * The replaced clone is set aside only after the new source is fetched and its
 * manifest names the replaced marketplace, so the clone is missing for two
 * renames and the save, not for the fetch. A failed add puts the clone and the
 * record back and throws. A replaced name the scope no longer records gets a
 * plain add.
 */
async function replaceMarketplaceInState(
  args: AddToStateArgs,
  replaced: string,
): Promise<AddedToState> {
  const { state, locations } = args;
  const record = ownValue(state.marketplaces, replaced);
  if (record === undefined) {
    return addMarketplaceToState(args);
  }

  let setAside: string | undefined;
  const beforePlace = async (name: string): Promise<void> => {
    if (name !== replaced) {
      throw new InvalidMarketplaceManifestError(
        `marketplace.json names the marketplace "${name}", not "${replaced}", which it replaces`,
      );
    }

    setAside = await setAsideReplacedClone(locations, replaced, record.source);
  };

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
  delete state.marketplaces[replaced];
  let added: AddedToState;
  try {
    added = await addMarketplaceToState({ ...args, plugins: record.plugins, beforePlace });
  } catch (err) {
    setOwn(state.marketplaces, replaced, record);
    throw appendLeakToError(err, await restoreReplacedClone(locations, replaced, setAside));
  }

  return setAside === undefined ? added : { ...added, setAside };
}

/**
 * The source-kind precondition plus the in-guard add. Extracted so the
 * entrypoint try/catch (ATTR-07) wraps BOTH the synchronous source-kind refusal
 * (S5a/S5b -> UnsupportedSourceError) and the guard body uniformly.
 *
 * WB-01 / WR-09: config write-back happens inside the SAME per-scope lock as
 * the state mutation. The config write-back fires only in standalone mode
 * (orchestrated/reconcile-driven calls derive desired state FROM the merged
 * config; writing back would clobber a per-machine override).
 */
async function runAddInGuard(args: {
  opts: AddMarketplaceOptions;
  removalOps: RemovalOps;
  locations: ScopedLocations;
  orchestrated: boolean;
}): Promise<RecordedAdd> {
  const { opts, locations, orchestrated, removalOps } = args;
  const source = parseAddableSource(opts.rawSource);

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base config on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.localConfigJsonPath : locations.baseConfigJsonPath;
  const configBasename = path.basename(targetConfigPath);

  return withLockedStateTransaction(locations, async (tx) => {
    const state = tx.state;

    // CFG-03 (T-56-02-05): abort BEFORE any state mutation. The
    // basename-only error message prevents an absolute-path information leak.
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      throw new ConfigInvalidError(configBasename);
    }

    const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    const redeclared = await redeclareRecordedSource({
      marketplaces: state.marketplaces,
      current,
      targetConfigPath,
      locations,
      rawSource: opts.rawSource,
      cwd: opts.cwd,
      orchestrated,
    });
    if (redeclared !== undefined) {
      return redeclared;
    }

    const addArgs: AddToStateArgs = {
      state,
      locations,
      source,
      cwd: opts.cwd,
      ctx: opts.ctx,
      run: opts.run,
      removalOps,
      credentialOps: opts.credentialOps,
      deviceFlowHttp: opts.deviceFlowHttp,
      gitOps: opts.gitOps,
    };
    const added: AddedToState =
      opts.replaceRecorded === undefined
        ? await addMarketplaceToState(addArgs)
        : await replaceMarketplaceInState(addArgs, opts.replaceRecorded);

    // WB-01 / WR-09: write-back the marketplace entry to the user-authored
    // config. SKIPPED in orchestrated mode (reconcile derives desired state
    // FROM the config; writing back would clobber a per-machine override).
    // The `source` field is `opts.rawSource` VERBATIM so the reconcile
    // planner's `samePlannedSource` comparison stays a no-op on the next
    // load.
    //
    // WR-07: by this point a github or url add has ALREADY renamed the clone
    // into its final `sources/<name>/` path, and the body's own MA-9 cleanup
    // catch is out of scope. If the config write-back or tx.save() throws
    // (disk full, EACCES on claude-plugins.json), the state snapshot is
    // discarded (no save) but the clone would be orphaned -- making every
    // retry fail MA-6 `{stale clone}` until the user manually deletes the
    // directory (NFR-3 violation). Mirror the MA-9 discipline: remove the
    // committed final clone and append any cleanup leak to the rethrown
    // error. A path source has no clone directory. D-PL6-19: a replace then
    // puts the clone it set aside back, once the new clone has freed its place.
    try {
      if (!orchestrated) {
        await writeMarketplaceConfigEntry(
          current,
          targetConfigPath,
          locations.scopeRoot,
          added.name,
          { source: opts.rawSource },
        );
      }

      await tx.save();
    } catch (err) {
      throw await unwindUnsavedAdd(err, added, removalOps, locations);
    }

    await removeSetAsideClone(removalOps, added.setAside);
    return { name: added.name, alreadyAdded: false };
  });
}

/**
 * D-PL6-19: the error of an add whose save failed, after removing its
 * new clone and putting back any clone a replace set aside, with the cleanup
 * leaks appended (MA-9).
 */
async function unwindUnsavedAdd(
  err: unknown,
  added: AddedToState,
  removalOps: RemovalOps,
  locations: ScopedLocations,
): Promise<Error> {
  let wrapped: unknown = err;
  if (added.cloneDir !== undefined || added.setAside !== undefined) {
    const leak = joinLeaks(
      await discardNewClone(removalOps, added.cloneDir),
      await restoreReplacedClone(locations, added.name, added.setAside),
    );
    wrapped = appendLeakToError(wrapped, leak);
  }

  return wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
}

/**
 * D-PL6-19: once the state is saved, remove the clone a replace set aside.
 * Best-effort post-commit hygiene, as D-18-01 treats remove's cleanup: a leak
 * is only logged, because the replace already succeeded.
 */
async function removeSetAsideClone(
  removalOps: RemovalOps,
  setAside: string | undefined,
): Promise<void> {
  if (setAside === undefined) {
    return;
  }

  const leak = await cleanupStaging(removalOps, setAside, "replaced marketplace clone");
  if (leak !== undefined) {
    hookDebugLog(`post-replace clone cleanup failed: ${leak}`);
  }
}

/**
 * The post-commit settle of one added marketplace: the D-03-INV completion
 * cache invalidation and the D-SEED-01 mirror seeding. Run it only after the
 * state save that recorded the marketplace. Each step is best effort and
 * swallows its own failure, so neither can roll back the committed add
 * (NFR-3).
 */
export async function settleAddedMarketplace(args: {
  readonly locations: ScopedLocations;
  readonly name: string;
  readonly completionCache: CompletionCache;
  readonly gitOps?: GitOps | undefined;
}): Promise<void> {
  const { locations, name, completionCache } = args;

  // D-03-INV: the marketplace-names cache for this scope and the plugin index
  // for the newly recorded marketplace are both stale by construction.
  try {
    await completionCache.invalidateMarketplaceNames(
      locations.marketplaceNamesCacheFile,
      locations.scope,
    );
    await completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(name),
      locations.scope,
      name,
    );
  } catch (err) {
    // Cache-refresh failures are swallowed: there is no clean notification
    // shape for "cache failure after a successful state mutation" and
    // emitting a second notify() would double severity routing. The state
    // mutation already succeeded; only the completion-cache is stale.
    hookDebugLog(`completion-cache invalidation after add failed: ${errorMessage(err)}`);
  }

  // D-SEED-01 / SEED-01..06: seed same-repo git plugin mirrors from the local
  // marketplace checkout, network-free. Both standalone and reconcile-driven
  // adds seed; seeding touches no network, so it is load-time safe (NFR-5).
  try {
    await seedSameRepoPluginMirrors({
      locations,
      marketplaceName: name,
      gitOps: args.gitOps ?? DEFAULT_GIT_OPS,
    });
  } catch (err) {
    // Seeding is best-effort; the add already committed.
    hookDebugLog(`plugin-mirror seeding after add failed: ${errorMessage(err)}`);
  }
}

/**
 * WR-02 / MA-14 / NFR-9: the advisory line naming a leftover clone the add
 * recognized but could not remove. The presentation layer formats the leak.
 * Undefined for every other failure.
 */
function removalAdvisories(err: unknown): readonly string[] | undefined {
  const cause = unwrapAddError(err);
  return cause instanceof UnremovableLeftoverCloneError
    ? composeLeftoverRemovalAdvisories(cause.removalLeak)
    : undefined;
}

/**
 * The standalone failed-add row, `(failed) {<reason>}` with no child row.
 *
 * GHB-01 / GHB-04: a marketplace row carries no cause (SNM-10). When the GitHub
 * base override rewrote the URL the add fetched, the reason moves to one
 * synthetic failed child row whose cause line ends with the fetched URL, the
 * same shape `marketplace update` renders for a failed refresh. A failure the
 * override did not rewrite keeps the bare row.
 *
 * ADD-10 / UPD-11: a `network error` takes the same child row, and its cause
 * line opens with the `{status} on {url}` frame (`hostFrame`), as on update.
 *
 * ADD-10: the child names the source, not a plugin, so its JSON id is that
 * source alone.
 */
function failedAddRow(
  subject: string,
  scope: Scope,
  reason: ContentReason,
  error: Error,
  hostFrame: string | undefined,
): MarketplaceRows<PluginFailedMessage> {
  const cause = hostFrame === undefined ? error : new Error(hostFrame, { cause: error });
  if (hostFrame === undefined && !hasFetchedUrlCause(error)) {
    // D-03: a failed marketplace add -> error.
    return {
      name: subject,
      scope,
      status: "failed",
      reasons: [reason],
      severity: "error",
      plugins: [],
    };
  }

  const fetchedRow: PluginFailedMessage = {
    status: "failed",
    name: subject,
    reasons: [reason],
    cause,
    marketplaceSubject: true,
    // D-03/D-06: a failed marketplace add -> error, no reload.
    severity: "error",
    needsReload: false,
  };
  return { name: subject, scope, status: "failed", severity: "error", plugins: [fetchedRow] };
}

/**
 * ADD-10: the `{status} on {url}` frame of a clone the git host answered with
 * an HTTP status, for a `network error` row. An unsupported source never
 * parsed, and a path source never clones, so neither has a frame.
 */
function hostErrorFrame(
  err: unknown,
  rawSource: string,
  reason: ContentReason,
): string | undefined {
  if (reason === "unsupported source") {
    return undefined;
  }

  const source = parseAddableSource(rawSource);
  const frame =
    source.kind === "path"
      ? undefined
      : hostHttpFailureFrame(unwrapAddError(err), networkCloneUrl(source));
  return reason === "network error" ? frame : undefined;
}

/**
 * FLR-02: an add that another process's state lock stopped fails with the
 * row `marketplace update` shows for a held lock: the failed header and one
 * failed child carrying `lock held` and the lock error as its cause. The add
 * takes the lock before it reads a manifest, so the row names the marketplace
 * by the typed source, as every failure before the manifest read does
 * (ATTR-07 A2). Its child names that source, not a plugin, so the child's
 * JSON id is the source alone, as on every failed add (ADD-10). The caller
 * tests the raw error: `unwrapAddError` would read its ELOCKED cause instead.
 */
function surfaceLockHeldAdd(
  opts: AddMarketplaceOptions,
  err: StateLockHeldError,
  orchestrated: boolean,
): AddMarketplaceOutcome {
  if (!orchestrated) {
    const [block] = marketplaceFailureRows(opts.rawSource, opts.scope, "lock held", err);
    const plugins = block.plugins.map((row) => ({ ...row, marketplaceSubject: true as const }));
    notifyWithContext(
      opts.ctx,
      opts.run,
      ADD_CONTEXT,
      [{ ...block, plugins }],
      undefined,
      "single",
    );
  }

  return { status: "failed", reason: "lock held", error: err, cause: errorMessage(err) };
}

/**
 * RECON-03: route the catch arm of `addMarketplace` to a typed
 * `AddMarketplaceOutcome`, emitting the standalone notify() row first when the
 * caller is not orchestrated. The outcome is returned on BOTH paths; the
 * standalone entrypoint discards it, and returning it unconditionally is what
 * lets `runAddOutcome` declare a `Promise<AddMarketplaceOutcome>` return the
 * compiler can check (WR-01).
 *
 * The non-enumerated catastrophic branch in orchestrated mode collapses to
 * the closed-set `"unparseable"` reason because every recognised add
 * precondition yields a typed error and network reachability failures are
 * classified by `classifyAddError`'s errno ladder (WR-03 -- the github
 * guard's clone-catch only cleans staging and rethrows unclassified), so an
 * unrecognised throw is by construction an opaque source-tree shape. A
 * malformed-JSON manifest also reads `"unparseable"` (MPA-02), so an
 * orchestrated caller that needs to tell the two apart narrows `outcome.error`.
 * GHB-03: an `InvalidGitHubBaseUrlError` is the exception. Both modes rethrow
 * it, so an invalid variable fails the whole command.
 *
 * FLR-02: a held state lock fails the add as `lock held` in both modes (see
 * `surfaceLockHeldAdd`).
 *
 * WR-02 / MA-14: the standalone row of a leftover the add could not remove
 * carries one advisory line naming the cleanup failure; the orchestrated
 * outcome carries the same leak in `cause`.
 *
 * GHB-01: the standalone row names the URL actually fetched when the GitHub base
 * override rewrote it (see `failedAddRow`).
 */
function handleAddFailure(
  opts: AddMarketplaceOptions,
  err: unknown,
  orchestrated: boolean,
): AddMarketplaceOutcome {
  if (err instanceof StateLockHeldError) {
    return surfaceLockHeldAdd(opts, err, orchestrated);
  }

  const reason = classifyAddError(err);
  const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
  if (reason === undefined) {
    rethrowInvalidGitHubBaseUrl(err);
    if (!orchestrated) {
      // Not an enumerated add precondition (an unforeseen catastrophic error)
      // -- never swallow it in standalone mode.
      throw err;
    }

    return {
      status: "failed",
      reason: "unparseable",
      error: wrapped,
      cause: errorMessage(err),
    };
  }

  if (!orchestrated) {
    // OUT-07 / D-12: `marketplace add` is a single-target op -> Single 1-tuple.
    // The `(failed) {<reason>}` header, or under the GitHub base override a bare
    // `(failed)` header with a failed child row (see `failedAddRow`), renders via
    // the central renderMpHeader seam; ADD_CONTEXT carries the add vocabulary.
    const failedRows: Single<MarketplaceRows<PluginFailedMessage>> = [
      failedAddRow(
        addSubjectName(err, opts.rawSource),
        opts.scope,
        reason,
        wrapped,
        hostErrorFrame(err, opts.rawSource, reason),
      ),
    ];
    const advisories = removalAdvisories(err);
    notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, failedRows, undefined, "single", {
      ...(advisories !== undefined && { advisories }),
    });
  }

  return { status: "failed", reason, error: wrapped, cause: errorMessage(err) };
}

/**
 * Renders a failed add exactly as the public `marketplace add` command does,
 * for a composer that passed `rethrowPreconditionErrors` and caught the error
 * (bootstrap). An error that is not an add precondition is rethrown.
 */
export function notifyAddFailure(opts: AddMarketplaceOptions, err: unknown): void {
  handleAddFailure(opts, err, false);
}

/**
 * RECON-03: returns `AddMarketplaceOutcome` in orchestrated mode and
 * `undefined` in standalone mode (after firing the standalone notify()).
 * Callers in orchestrated mode know the outcome is defined; standalone
 * callers ignore the return.
 *
 * D-115-10: the overload pair narrows the orchestrated-mode return to
 * `Promise<AddMarketplaceOutcome>` (no `| undefined`), mirroring
 * `setPluginEnabled`. A reconcile cascade that dropped the row on an absent
 * outcome is now a compile error rather than a silent `continue`, so every
 * driven add always materialises a row. The wide overload stays last so a
 * caller holding the entrypoint in a single-signature variable -- the import
 * cascade's collaborator resolver -- keeps its `undefined` arm.
 *
 * WR-01: the overload is backed by a compile-time check, not by an assertion.
 * The body lives in `runAddOutcome`, whose DECLARED return type is
 * `Promise<AddMarketplaceOutcome>`, so TypeScript checks every return statement
 * and the fall-off-the-end path in it: an arm that yielded `undefined` is a
 * compile error there. A narrower overload return alone would not give that --
 * TypeScript checks an overload signature against the implementation only
 * loosely, and accepts a narrowed return with no diagnostic even when the
 * implementation demonstrably returns the excluded value. This entrypoint is
 * the thin mode switch that reintroduces `undefined` for the standalone arm and
 * for that arm only, so the narrow overload can never outrun the body.
 */
export function addMarketplace(
  opts: AddMarketplaceOptions & { notifications: { mode: "orchestrated" } },
): Promise<AddMarketplaceOutcome>;
export function addMarketplace(
  opts: AddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined>;
export async function addMarketplace(
  opts: AddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined> {
  // RECON-03: orchestrated mode suppresses every notify() call and returns the
  // typed outcome instead. Standalone (default/omitted) preserves byte-identity.
  const orchestrated = opts.notifications?.mode === "orchestrated";
  const outcome = await runAddOutcome(opts, orchestrated);

  return orchestrated ? outcome : undefined;
}

/**
 * The whole add body, always answering with a typed `AddMarketplaceOutcome`.
 * Standalone mode emits its notify() rows on the way through and its outcome is
 * discarded by the entrypoint above; the declared return type is what proves
 * the orchestrated arms never yield `undefined` (WR-01).
 */
async function runAddOutcome(
  opts: AddMarketplaceOptions,
  orchestrated: boolean,
): Promise<AddMarketplaceOutcome> {
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its in-guard helpers perform their
  // cleanup through. The port is required with no default, so there is nothing
  // to fall back to and no way for a new cleanup site to go uninjected.
  const removalOps = createRemovalOps();
  const locations = locationsFor(opts.scope, opts.cwd);

  // ATTR-07: route every enumerated precondition failure through notify as a
  // structured `⊘ <subject> [<scope>] (failed) {<reason>}` row on the
  // marketplace subject (D-48-A reasons brace) instead of throwing raw past the
  // orchestrator. Genuinely unexpected/catastrophic errors re-throw -- only the
  // closed-set add preconditions are caught here. The github guard's own catch
  // (cleanupStaging + appendLeakToError) runs FIRST and re-throws; this catch
  // sees the already-cleaned error, so no staging dir leaks.
  let recorded: RecordedAdd;
  try {
    recorded = await runAddInGuard({ opts, locations, removalOps, orchestrated });
  } catch (err) {
    // rethrowPreconditionErrors short-circuits BEFORE the mode branch so the
    // bootstrap composer contract is preserved in BOTH standalone and
    // orchestrated modes (the typed precondition flows past the orchestrator).
    if (opts.rethrowPreconditionErrors === true) {
      // Composition seam (bootstrap): re-throw the typed precondition so the
      // caller can make a control-flow decision (e.g. skip a later step)
      // instead of emitting a structured failed row.
      throw err;
    }

    return handleAddFailure(opts, err, orchestrated);
  }

  const recordedName = recorded.name;
  if (recorded.alreadyAdded) {
    // MPA-01: only a standalone add matches a declared record (WR-09), so this
    // arm always notifies and the entrypoint discards the outcome. Nothing
    // changed, so there is nothing to settle. The header carries no severity
    // stamp, so the result is `info`.
    const skippedRows: Single<MarketplaceRows<never>> = [
      {
        name: recordedName,
        scope: opts.scope,
        status: "skipped",
        reasons: ["already added"],
        plugins: [],
      },
    ];
    notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, skippedRows, undefined, "single");
    return { status: "added", name: recordedName };
  }

  // D-03-INV / D-SEED-01: the settle runs after the state commit and before
  // the orchestrated return, so both standalone and reconcile-driven adds
  // settle.
  await settleAddedMarketplace({
    locations,
    name: recordedName,
    completionCache: opts.completionCache,
    gitOps: opts.gitOps,
  });

  if (!orchestrated) {
    await notifyAdded(opts, recordedName);
  }

  return { status: "added", name: recordedName };
}

const NO_DEPENDENCY_INSTALLS: ScopeDependencyInstallResult = { rows: [], mcpConfigNotices: [] };

/**
 * The standalone `(added)` notification. D-PL2-09: the missing-dependency
 * step runs first, outside the add's lock (CR-01), in the add's scope and
 * only for dependencies the added marketplace offers (SC-1, D-29), and its
 * rows render under the `(added)` header. A step that throws still lets the
 * committed add report before the throw reaches the caller.
 */
async function notifyAdded(opts: AddMarketplaceOptions, recordedName: string): Promise<void> {
  let installs = NO_DEPENDENCY_INSTALLS;
  try {
    installs =
      (await opts.installMissingDependencies?.({
        ctx: opts.ctx,
        run: opts.run,
        scope: opts.scope,
        cwd: opts.cwd,
        select: (install) => install.marketplace === recordedName,
      })) ?? NO_DEPENDENCY_INSTALLS;
  } finally {
    // Emit one MarketplaceNotificationMessage per outcome. Severity and
    // reload-hint are computed by the shared seam; callers MUST NOT compose them.
    // Catalog: `path-source` + `github-source` fixtures in catalog-uat.test.ts.
    // OUT-07 / D-12: single-target op -> Single 1-tuple. The `(added)` header
    // renders via the central renderMpHeader seam the spine reuses.
    const addedRows: Single<MarketplaceRows<ScopeDependencyInstallRow>> = [
      {
        name: recordedName,
        scope: opts.scope,
        status: "added",
        plugins: installs.rows,
      },
    ];
    notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, addedRows, undefined, "single");
    // AFILE-04: the notices of the step's installs follow the rows they explain.
    notifyMcpConfigNotices(opts.ctx, opts.run, installs.mcpConfigNotices);
  }
}

/**
 * Q-01: the ownership marker `marketplace add` writes into `.git/` of every
 * clone it creates, before the rename into `sources/<name>`. The name and the
 * `.git/` location are a user contract: renaming either orphans every leftover
 * created before the rename, which then refuses as `{stale clone}`.
 */
const OWNERSHIP_MARKER_FILE = "pi-claude-marketplace.json";

/** The path of the ownership marker inside the clone at `cloneDir`. */
function ownershipMarkerPath(cloneDir: string): string {
  return path.join(cloneDir, ".git", OWNERSHIP_MARKER_FILE);
}

/**
 * Q-01 / NFR-1 / NFR-10: write the ownership marker into the staging clone.
 * `assertPathInside` refuses a `.git` that is a symlink, so the write stays
 * inside `stagingDir`.
 */
async function writeOwnershipMarker(stagingDir: string): Promise<void> {
  const markerPath = ownershipMarkerPath(stagingDir);
  await assertPathInside(stagingDir, markerPath, "marketplace ownership marker");
  await atomicWriteJson(markerPath, { generatedBy: "pi-claude-marketplace" });
}

/**
 * MA-12/MA-13 (D-3-01, D-3-02): recognize whether `finalDir` is the
 * extension's own leftover clone of `source` and, if so, remove it so the
 * caller's atomic rename can proceed. A leftover is recognized only when it
 * carries the ownership marker and its `origin` names the source through
 * `originMatchesSource` (Q-01, Q-03). Throws `StaleSourceCloneError` for any
 * other tree, and `UnreadableSourceCloneError` when the tree's `.git/config`
 * cannot be read, so the row names the read failure instead of calling the
 * tree stale. Recognition is the only authority for removal (D-3-02).
 *
 * @returns the leak message from removing a recognized leftover, or
 *   `undefined` when the removal left nothing behind or the destination no
 *   longer exists (IN-06). The caller throws `UnremovableLeftoverCloneError`
 *   for a non-undefined leak, because a partially-removed tree must not be
 *   renamed over (MA-14).
 */
async function recognizeLeftover(args: {
  finalDir: string;
  derivedName: string;
  source: GitHubSource | UrlSource;
  gitOps: GitOps;
  removalOps: RemovalOps;
}): Promise<string | undefined> {
  const { finalDir, derivedName, source, gitOps, removalOps } = args;
  const remotes = await gitOps.listRemotes({ dir: finalDir });
  switch (remotes.kind) {
    case "origin":
      if (
        !originMatchesSource(remotes.url, source) ||
        !(await pathExists(ownershipMarkerPath(finalDir)))
      ) {
        // Carry the derived name so the ATTR-07 entrypoint catch renders the
        // `(failed) {stale clone}` row on the marketplace SUBJECT (A2).
        throw new StaleSourceCloneError(finalDir, derivedName);
      }

      return cleanupStaging(removalOps, finalDir, "marketplace leftover clone");
    case "no-origin":
      throw new StaleSourceCloneError(finalDir, derivedName);
    case "not-a-repo":
      // IN-06: a destination removed since the caller's existence check
      // leaves nothing to recognize, so the rename proceeds.
      if (await pathExists(finalDir)) {
        throw new StaleSourceCloneError(finalDir, derivedName);
      }

      return undefined;
    case "permission-denied":
    case "unreadable":
      throw new UnreadableSourceCloneError(finalDir, derivedName, remotes.kind);
  }
}

/**
 * Shared clone-into-guard body for git-cloned marketplace sources (github and
 * url). Owns everything from staging-dir creation through the clone, the Q-01
 * ownership-marker write, manifest read, MA-8 duplicate check, MA-6/MA-12/MA-13
 * leftover recognition, atomic rename, state mutation, and the MA-9
 * append-leak-not-mask cleanup catch. The only per-kind
 * differences are the parsed `source` (from which the clone url is derived)
 * and the `auth` bundle, so that subtle MA-9 discipline lives in
 * exactly one place.
 *
 * MURL-01 / GAUTH-03: every git-cloned source carries a host-keyed `auth`
 * bundle, so the clone consults the user's git credential helper when the
 * server challenges. A public clone never challenges, so nothing is consulted.
 */
async function addGitClonedInGuard(args: {
  state: ExtensionState;
  removalOps: RemovalOps;
  locations: ScopedLocations;
  source: GitHubSource | UrlSource;
  gitOps: GitOps;
  auth: GitAuthBundle;
  cwd: string;
  plugins: RecordedPlugins;
  beforePlace: ((name: string) => Promise<void>) | undefined;
}): Promise<string> {
  const { state, locations, source, gitOps, auth, cwd, removalOps, beforePlace } = args;
  const stagingDir = await locations.sourcesStagingDir(randomUUID());

  // 1. Clone into staging (NFR-5: only git-cloned kinds reach gitOps.clone).
  try {
    await gitOps.clone({
      dir: stagingDir,
      url: networkCloneUrl(source),
      ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
      auth,
    });
  } catch (err) {
    // Clone itself failed -- there is no staging dir to clean up beyond a
    // potentially partial mkdir. cleanupStaging is ENOENT-tolerant.
    const leak = await cleanupStaging(removalOps, stagingDir, "marketplace clone staging");
    throw appendLeakToError(err, leak);
  }

  let stagedAtFinal = false;
  let finalDir: string | undefined;
  let leftoverLeak: string | undefined;
  try {
    // 2. Q-01: mark the clone as this extension's own before anything can
    //    rename it into place.
    await writeOwnershipMarker(stagingDir);

    // 3-4. Read + validate manifest; MA-8: duplicate name in this scope.
    const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
    const { name: derivedName, comparisonJson } = await newMarketplaceName(
      manifestPath,
      state.marketplaces,
      locations.scope,
    );

    // D-PL6-19: a replace sets the replaced clone aside here, after the clone
    // and the manifest have succeeded and before the destination is probed.
    await beforePlace?.(derivedName);

    // 5. MA-6/MA-12/MA-13: recognize-remove-rename on the final destination.
    // A leftover is the extension's own when it carries the ownership marker
    // and its `origin` names the same source, with the host case folded and
    // the path exact (Q-01, Q-03, D-3-01). Such a tree is removed so a partial
    // tree cannot leak into installed state (D-3-02); every other outcome
    // throws (MA-13). `sourceCloneDir` has already refused a symlinked
    // destination (PS-1), so recognition and removal act on one directory.
    finalDir = await locations.sourceCloneDir(derivedName);
    if (await pathExists(finalDir)) {
      leftoverLeak = await recognizeLeftover({
        finalDir,
        derivedName,
        source,
        gitOps,
        removalOps,
      });
      if (leftoverLeak !== undefined) {
        // A partially-removed tree must not be renamed over (MA-14).
        throw new UnremovableLeftoverCloneError(finalDir, derivedName, leftoverLeak);
      }
    }

    // 6. Atomic rename -- same FS by D-09 (sources-staging/ and sources/
    //    are siblings under extensionRoot). Ensure the parent (sources/)
    //    exists; on a fresh scope it has not been created yet.
    await mkdir(path.dirname(finalDir), { recursive: true });
    await rename(stagingDir, finalDir);
    stagedAtFinal = true;

    // 7. Mutate state.
    setOwn(state.marketplaces, derivedName, {
      name: derivedName,
      scope: locations.scope,
      source,
      addedFromCwd: cwd,
      manifestPath: path.join(finalDir, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: finalDir,
      lastUpdatedAt: new Date().toISOString(),
      lastSuccessfulManifest: comparisonJson,
      plugins: args.plugins,
    });
    return derivedName;
  } catch (err) {
    // MA-9: append leaks rather than mask original error.
    let wrapped: unknown = err;
    if (!stagedAtFinal) {
      const leak = await cleanupStaging(removalOps, stagingDir, "marketplace clone staging");
      wrapped = appendLeakToError(wrapped, joinLeaks(leftoverLeak, leak));
    } else if (finalDir !== undefined) {
      const leak = await cleanupStaging(
        removalOps,
        finalDir,
        `marketplace final clone ${finalDir}`,
      );
      wrapped = appendLeakToError(wrapped, joinLeaks(leftoverLeak, leak));
    }

    throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
  }
}

/** The credential half of a git add's auth bundle, shared by both source kinds. */
interface CloneAuthArgs {
  readonly credentialOps: CredentialOps;
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * The auth bundle a github or url add clones with.
 *
 * github: AUTH-01 / D-79-05: buildAuthForHost binds the GitHub provider's
 * Device Flow as the onAuthRequired closure for this clone.
 * platform/git.ts::buildAuthCallbacks first consults credentialOps.fill(host);
 * only on a miss does it invoke the closure. AUTH-09: the closure passes ONLY
 * user_code + verification_uri, through initiateDeviceFlow's onDeviceCode
 * callback -- the access token is acquired LATER in the poll loop and is never
 * passed back to a notify or Error. GHB-02: buildGitHubAuth binds github.com,
 * or the override host with a stored credential when
 * PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is set.
 *
 * url: MURL-01 / D-76-06: `source.url` is stored as the canonical identity
 * form (parse-time `.git`-stripped) and NOT reconstructed against github.com;
 * the url actually cloned is derived from `source.raw` via `networkCloneUrl`
 * (D-2-01, D-2-03), preserving whatever `.git` decision the user's own input
 * made. GAUTH-03: the host is extracted from the url and `buildAuthForHost`
 * binds a bundle to it, so a private source on any host authenticates from the
 * user's git credential helper; the provider registry decides only whether a
 * Device Flow runs on a helper miss (PROV-03). The bundle's host binding is
 * enforced by the compare in `buildAuthCallbacks.onAuth` (D-1-03, T-79-04).
 *
 * FTCH-06 / D-79-02: `authMemo` caps the Device Flow at once per host across
 * the command.
 */
function cloneAuthFor(source: GitHubSource | UrlSource, authArgs: CloneAuthArgs): GitAuthBundle {
  return source.kind === "github"
    ? buildGitHubAuth(authArgs)
    : buildAuthForHost({ ...authArgs, host: hostFromCloneUrl(source.url, "url") });
}

async function addPathInGuard(args: {
  state: ExtensionState;
  locations: ScopedLocations;
  source: PathSource;
  cwd: string;
  plugins: RecordedPlugins;
  beforePlace: ((name: string) => Promise<void>) | undefined;
}): Promise<string> {
  const { state, locations, source, cwd, beforePlace } = args;

  // MA-3: source.resolved may point at a directory OR directly at a
  // marketplace.json file. Probe and dispatch.
  //
  // Note: domain/source.ts PathSource exposes `raw` and `logical` (no
  // `resolved` field). We use `source.logical` here since it equals `raw`
  // verbatim (SP-7) and is the on-disk lookup key for path-source `add`.
  //
  // CR-02 (SP-7 / MA-4): Node's fs APIs do NOT perform shell tilde
  // expansion -- stat("~/...") returns ENOENT against a literal "~"
  // directory. Expand "~" and "~/..." against os.homedir() before
  // probing on disk. The stored `source.raw` keeps the verbatim "~"
  // form (SP-7); only the on-disk lookup is rewritten.
  const onDiskPath = resolvePathSource(source.logical, cwd);
  const probe = await stat(onDiskPath);
  let manifestPath: string;
  let marketplaceRoot: string;
  if (probe.isDirectory()) {
    marketplaceRoot = onDiskPath;
    manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  } else if (probe.isFile()) {
    manifestPath = onDiskPath;
    // Walk up two levels: <root>/.claude-plugin/marketplace.json -> <root>
    marketplaceRoot = path.dirname(path.dirname(manifestPath));
  } else {
    // ATTR-07 (S5e): a path that exists but is neither a regular file nor a
    // directory (e.g. a socket / fifo) is an unusable source. Tag it ENOTDIR so
    // classifyAddError routes it structurally to `source missing` alongside the
    // ENOENT (path absent) case -- no substring matching.
    const notUsable = new Error(
      `Local marketplace path is neither a file nor a directory: ${onDiskPath}`,
    ) as NodeJS.ErrnoException;
    notUsable.code = "ENOTDIR";
    throw notUsable;
  }

  // Read + validate manifest; MA-8: duplicate name in scope.
  const { name: derivedName, comparisonJson } = await newMarketplaceName(
    manifestPath,
    state.marketplaces,
    locations.scope,
  );
  await beforePlace?.(derivedName);

  // MA-4: source already preserves the user-typed `~` verbatim
  // (ParsedSource.raw) via pathSource() factory. We store the parsed
  // source object directly -- ST-6 funnel re-validates on next load.
  setOwn(state.marketplaces, derivedName, {
    name: derivedName,
    scope: locations.scope,
    source,
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    lastUpdatedAt: new Date().toISOString(),
    lastSuccessfulManifest: comparisonJson,
    plugins: args.plugins,
  });
  return derivedName;
}

/**
 * SP-7 / MA-4: the directory or manifest a path source names, as the add
 * reads it: `~` expanded, then resolved against the command's directory.
 */
export function resolvePathSource(logical: string, cwd: string): string {
  return path.resolve(cwd, expandTildePath(logical));
}

function expandTildePath(sourcePath: string): string {
  if (sourcePath === "~") {
    return os.homedir();
  }

  return sourcePath.startsWith("~/") ? path.join(os.homedir(), sourcePath.slice(2)) : sourcePath;
}
