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
//   //   notify(opts.ctx, opts.pi, { marketplaces: [{ status: "added", ... }] })
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
// WR-05 trade-off note: the MA-8 duplicate-name check for github sources
// runs AFTER the clone fills `stagingDir`. We accept the cost of one
// wasted network clone per duplicate-name attempt because the marketplace
// name is derived from the manifest's `name` field -- which only exists
// inside the cloned tree. Resolving without cloning would require a
// raw.githubusercontent.com manifest probe that bypasses the GitOps
// surface (and the D-12/D-13 layering rules); the current cost is
// considered acceptable per design.

import { randomUUID } from "node:crypto";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { networkCloneUrl, originMatchesSource } from "../../domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { writeMarketplaceConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  InvalidMarketplaceManifestError,
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  UnreadableSourceCloneError,
  UnremovableLeftoverCloneError,
  UnsupportedSourceError,
  appendLeakToError,
  errorMessage,
} from "../../shared/errors.ts";
import {
  cleanupStaging,
  createRemovalOps,
  pathExists,
  type RemovalOps,
} from "../../shared/fs-utils.ts";
import { classifyGitSourceAccessFailure } from "../../shared/git-failure-classifiers.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type Reason } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Single,
} from "../../shared/notify-context.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import {
  DEFAULT_CREDENTIAL_OPS,
  GITHUB_HOST,
  buildAuthForHost,
  hostFromCloneUrl,
} from "../auth-host.ts";
import { seedSameRepoPluginMirrors } from "../plugin/clone-cache.ts";

import { ADD_CONTEXT } from "./add.messaging.ts";
import { DEFAULT_GIT_OPS, type GitAuthBundle, type GitOps } from "./shared.ts";

import type { DeviceFlowHttp } from "../../domain/github-auth.ts";
import type { GitHubSource, PathSource, UrlSource } from "../../domain/source.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { NotificationContext, PiInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03: controls how `addMarketplace` surfaces
 * notifications. Mirrors the `InstallPluginNotifications` precedent.
 *
 * - `"standalone"` (default when option is omitted): the orchestrator fires
 *   one `notify(ctx, pi, ...)` per outcome arm with the per-variant
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
 * denied / unreadable / invalid manifest / unsupported source / source
 * missing / network unreachable)
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

export interface AddMarketplaceOptions {
  readonly ctx: NotificationContext;
  /**
   * Required by `notify(ctx, pi, message)` for soft-dep probing.
   */
  readonly pi: PiInventory;
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
   * inject createCredentialOpsFake() from tests/platform/credential-ops-fake.ts
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
   * routed through `notify` as a `(failed) {<reason>}` row. Bootstrap relies on
   * catching `MarketplaceDuplicateNameError` to detect the idempotent re-run
   * and SUPPRESS a duplicate add notification (one-signal-per-state-change). The
   * public `marketplace add` command path omits this flag and gets the ATTR-07
   * structured failed row. Omitted (undefined) => route through notify.
   */
  readonly rethrowPreconditionErrors?: boolean;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- byte-identical to today.
   * Orchestrated mode suppresses notify() and returns a typed outcome.
   */
  readonly notifications?: AddMarketplaceNotifications;
  /**
   * WB-01: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json`. The base
   * file is NEVER touched on the --local path; loadConfig's `absent` arm
   * yields an empty starting shape that saveConfig writes back to the local
   * path.
   */
  readonly local?: boolean;
}

/**
 * Resolve the typed add-precondition error from a thrown value, unwrapping ONE
 * level of `Error.cause`. The github guard's MA-9 catch wraps a precondition
 * error via `appendLeakToError` when `cleanupStaging` itself leaks -- that
 * produces a generic `Error` whose `.cause` is the original typed error. Both
 * the unwrapped (no-leak) and wrapped (leak) shapes must classify identically,
 * so ATTR-07 routing survives a cleanup leak. Single level only --
 * a deeper chain is not an add-precondition shape this orchestrator produces.
 */
function unwrapAddError(err: unknown): unknown {
  if (
    err instanceof MarketplaceDuplicateNameError ||
    err instanceof StaleSourceCloneError ||
    err instanceof UnreadableSourceCloneError ||
    err instanceof InvalidMarketplaceManifestError ||
    err instanceof UnsupportedSourceError
  ) {
    return err;
  }

  if (err instanceof Error && err.cause !== undefined) {
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
 * catch-all returns `undefined` -- a non-enumerated error (e.g.
 * `StateLockHeldError`, an unforeseen catastrophic failure) re-throws at the
 * entrypoint rather than being silently mislabeled. No substring matching.
 */
function classifyAddError(rawErr: unknown): ContentReason | undefined {
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

  if (err instanceof InvalidMarketplaceManifestError) {
    return "invalid manifest";
  }

  if (err instanceof UnsupportedSourceError) {
    return "unsupported source";
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return "source missing";
    }

    // GAUTH-02 / D-76-09: delegate git clone errors to the source-access
    // classifier. It includes the shared auth/network ladder and adds
    // repository-missing plus transient HTTP statuses for this source-access
    // boundary. The opt-in layer keeps other callers' fallthrough semantics
    // unchanged. The clone catch only cleans staging and rethrows, so this
    // boundary must classify the error before Pi renders a raw exception.
    const transportReason = classifyGitSourceAccessFailure(err);
    if (transportReason !== undefined) {
      return transportReason;
    }
  }

  return undefined;
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
 * Dispatch the source-kind precondition + the in-guard add. Extracted so the
 * entrypoint try/catch (ATTR-07) wraps BOTH the synchronous source-kind refusal
 * (S5a/S5b -> UnsupportedSourceError) and the guard body uniformly.
 *
 * WB-01 / WR-09: converted from `withStateGuard` to
 * `withLockedStateTransaction` so config write-back happens inside the SAME
 * per-scope lock as the state mutation. The config write-back fires only in
 * standalone mode (orchestrated/reconcile-driven calls derive desired state
 * FROM the merged config; writing back would clobber a per-machine override).
 */
async function runAddInGuard(args: {
  opts: AddMarketplaceOptions;
  removalOps: RemovalOps;
  locations: ScopedLocations;
  source: ReturnType<typeof parsePluginSource>;
  gitOps: GitOps;
  credentialOps: CredentialOps;
  orchestrated: boolean;
}): Promise<string> {
  const { opts, locations, source, gitOps, credentialOps, orchestrated, removalOps } = args;

  // S5a (MA-10): parser produced an unknown kind with a reason -- surface
  // verbatim on the cause, classified as `unsupported source` (D-48-C A3).
  if (source.kind === "unknown") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${opts.rawSource}": ${source.reason}`,
    );
  }

  // S5b: valid-but-unsupported kinds. MURL-01 / D-76-05: `url` is now
  // admitted; only `git-subdir` and `npm` (marketplace-level) stay rejected.
  if (source.kind !== "github" && source.kind !== "path" && source.kind !== "url") {
    throw new UnsupportedSourceError(
      `Cannot add marketplace from "${opts.rawSource}": unsupported source kind ${source.kind}`,
    );
  }

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base file on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  return withLockedStateTransaction(locations, async (tx) => {
    const state = tx.state;
    let recordedName: string;

    // CFG-03 (T-56-02-05): abort BEFORE any state mutation. The
    // basename-only error message prevents an absolute-path information leak.
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      throw new ConfigInvalidError(configBasename);
    }

    if (source.kind === "github") {
      recordedName = await addGithubInGuard({
        ctx: opts.ctx,
        state,
        locations,
        source,
        gitOps,
        credentialOps,
        removalOps,
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        cwd: opts.cwd,
      });
    } else if (source.kind === "url") {
      // MURL-01 / D-76-06: source.url is the stored canonical identity; the wire url derives from
      // the source via `networkCloneUrl` (D-2-01, D-2-03). Every host carries an auth bundle; the
      // provider lookup decides its Device Flow half (PROV-03).
      recordedName = await addUrlInGuard({
        ctx: opts.ctx,
        state,
        locations,
        source,
        gitOps,
        credentialOps,
        removalOps,
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        cwd: opts.cwd,
      });
    } else {
      recordedName = await addPathInGuard({
        state,
        locations,
        source,
        cwd: opts.cwd,
      });
    }

    // WB-01 / WR-09: write-back the marketplace entry to the user-authored
    // config. SKIPPED in orchestrated mode (reconcile derives desired state
    // FROM the config; writing back would clobber a per-machine override).
    // The `source` field is `opts.rawSource` VERBATIM so the reconcile
    // planner's `samePlannedSource` comparison stays a no-op on the next
    // load.
    //
    // WR-07: by this point `addGithubInGuard` has ALREADY
    // renamed the clone into its final `sources/<name>/` path, and its own
    // MA-9 cleanup catch is out of scope. If the config write-back or
    // tx.save() throws (disk full, EACCES on claude-plugins.json), the state
    // snapshot is discarded (no save) but the clone would be orphaned --
    // making every retry fail MA-6 `{stale clone}` until the user manually
    // deletes the directory (NFR-3 violation). Mirror the MA-9 discipline:
    // remove the committed final clone and append any cleanup leak to the
    // rethrown error.
    try {
      if (!orchestrated) {
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        await writeMarketplaceConfigEntry(
          current,
          targetConfigPath,
          locations.scopeRoot,
          recordedName,
          { source: opts.rawSource },
        );
      }

      await tx.save();
    } catch (err) {
      let wrapped: unknown = err;
      // MURL-01 / NFR-3: both github and url sources committed a clone into
      // sources/<name>/; a write-back failure must remove it so a retry never
      // trips MA-6 {stale clone}. path sources have no clone dir.
      if (source.kind === "github" || source.kind === "url") {
        const finalDir = await locations.sourceCloneDir(recordedName);
        const leak = await cleanupStaging(
          removalOps,
          finalDir,
          `marketplace final clone ${finalDir}`,
        );
        wrapped = appendLeakToError(wrapped, leak);
      }

      throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
    }

    return recordedName;
  });
}

/**
 * WR-02 / MA-14 / NFR-9: the advisory line naming a leftover clone the add
 * recognized but could not remove, with every absolute path reduced to its last
 * segment at this composition site. Undefined for every other failure.
 */
function removalAdvisories(err: unknown): readonly string[] | undefined {
  const cause = unwrapAddError(err);
  return cause instanceof UnremovableLeftoverCloneError
    ? [`    ${redactAbsolutePaths(cause.removalLeak)}`]
    : undefined;
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
 * unrecognised throw is by construction an opaque source-tree shape.
 *
 * WR-02 / MA-14: the standalone row of a leftover the add could not remove
 * carries one advisory line naming the cleanup failure; the orchestrated
 * outcome carries the same leak in `cause`.
 */
function handleAddFailure(
  opts: AddMarketplaceOptions,
  err: unknown,
  orchestrated: boolean,
): AddMarketplaceOutcome {
  const reason = classifyAddError(err);
  const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
  if (reason === undefined) {
    if (!orchestrated) {
      // Not an enumerated add precondition (e.g. a StateLockHeldError or an
      // unforeseen catastrophic error) -- never swallow it in standalone mode.
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
    // The `(failed) {<reason>}` header renders via the central renderMpHeader seam
    // the spine reuses; ADD_CONTEXT carries the localized add vocabulary.
    const failedRows: Single<MarketplaceRows<never>> = [
      {
        name: addSubjectName(err, opts.rawSource),
        scope: opts.scope,
        status: "failed",
        reasons: [reason],
        // D-03: a failed marketplace add -> error.
        severity: "error",
        plugins: [],
      },
    ];
    notifyWithContext(
      opts.ctx,
      opts.pi,
      ADD_CONTEXT,
      failedRows,
      undefined,
      "single",
      removalAdvisories(err),
    );
  }

  return { status: "failed", reason, error: wrapped, cause: errorMessage(err) };
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
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its in-guard helpers perform their
  // cleanup through. The port is required with no default, so there is nothing
  // to fall back to and no way for a new cleanup site to go uninjected.
  const removalOps = createRemovalOps();
  const locations = locationsFor(opts.scope, opts.cwd);
  const source = parsePluginSource(opts.rawSource);

  // ATTR-07: route every enumerated precondition failure through notify as a
  // structured `⊘ <subject> [<scope>] (failed) {<reason>}` row on the
  // marketplace subject (D-48-A reasons brace) instead of throwing raw past the
  // orchestrator. Genuinely unexpected/catastrophic errors re-throw -- only the
  // closed-set add preconditions are caught here. The github guard's own catch
  // (cleanupStaging + appendLeakToError) runs FIRST and re-throws; this catch
  // sees the already-cleaned error, so no staging dir leaks.
  let recordedName: string;
  try {
    recordedName = await runAddInGuard({
      opts,
      locations,
      source,
      gitOps,
      credentialOps,
      removalOps,
      orchestrated,
    });
  } catch (err) {
    // rethrowPreconditionErrors short-circuits BEFORE the mode branch so the
    // bootstrap composer contract is preserved in BOTH standalone and
    // orchestrated modes (the typed precondition flows past the orchestrator).
    if (opts.rethrowPreconditionErrors === true) {
      // Composition seam (bootstrap): re-throw the typed precondition so the
      // caller can make a control-flow decision (e.g. swallow the idempotent
      // duplicate-name re-run) instead of emitting a structured failed row.
      throw err;
    }

    return handleAddFailure(opts, err, orchestrated);
  }

  // D-03-INV: post-state-commit completion-cache invalidation.
  // The marketplace-names cache for this scope and the plugin index for the
  // newly recorded marketplace are both stale-by-construction. Cache cleanup
  // runs after the state commit so a cache hiccup never rolls back the user's
  // primary success.
  try {
    await opts.completionCache.invalidateMarketplaceNames(
      locations.marketplaceNamesCacheFile,
      opts.scope,
    );
    await opts.completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(recordedName),
      opts.scope,
      recordedName,
    );
  } catch (err) {
    // Cache-refresh failures are swallowed: there is no clean notification
    // shape for "cache failure after a successful state mutation" and
    // emitting a second notify() would double severity routing. The state
    // mutation already succeeded; only the completion-cache is stale.
    hookDebugLog(`completion-cache invalidation after add failed: ${errorMessage(err)}`);
  }

  // D-SEED-01 / SEED-01..06: best-effort post-commit seeding of same-repo git
  // plugin mirrors from the local marketplace checkout, network-free. Runs in
  // the same swallowing tier as the cache invalidation above so a seeding
  // failure can never roll back the already-committed add (NFR-3). Placed BEFORE
  // the orchestrated return so both standalone and reconcile-driven adds seed;
  // seeding touches no network, so it is load-time safe (NFR-5).
  try {
    await seedSameRepoPluginMirrors({ locations, marketplaceName: recordedName, gitOps });
  } catch (err) {
    // Seeding is best-effort; the add already committed.
    hookDebugLog(`plugin-mirror seeding after add failed: ${errorMessage(err)}`);
  }

  if (!orchestrated) {
    // Emit one MarketplaceNotificationMessage per outcome. Severity and
    // reload-hint are computed by the shared seam; callers MUST NOT compose them.
    // Catalog: `path-source` + `github-source` fixtures in catalog-uat.test.ts.
    // OUT-07 / D-12: single-target op -> Single 1-tuple. The `(added)` header
    // renders via the central renderMpHeader seam the spine reuses.
    const addedRows: Single<MarketplaceRows<never>> = [
      {
        name: recordedName,
        scope: opts.scope,
        status: "added",
        plugins: [],
      },
    ];
    notifyWithContext(opts.ctx, opts.pi, ADD_CONTEXT, addedRows, undefined, "single");
  }

  return { status: "added", name: recordedName };
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
}): Promise<string> {
  const { state, locations, source, gitOps, auth, cwd, removalOps } = args;
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

    // 3. Read + validate manifest.
    const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
    const parsed = await loadMarketplaceManifest(manifestPath);

    const derivedName = parsed.name;

    // 4. MA-8: duplicate name in this scope.
    if (ownValue(state.marketplaces, derivedName) !== undefined) {
      throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
    }

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
      plugins: {},
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

async function addGithubInGuard(args: {
  ctx: NotificationContext;
  state: ExtensionState;
  locations: ScopedLocations;
  source: GitHubSource;
  removalOps: RemovalOps;
  gitOps: GitOps;
  credentialOps: CredentialOps;
  deviceFlowHttp?: DeviceFlowHttp;
  cwd: string;
}): Promise<string> {
  const { ctx, state, locations, source, gitOps, credentialOps, deviceFlowHttp, cwd, removalOps } =
    args;

  // AUTH-01 / D-79-05: buildAuthForHost binds the GitHub provider's Device
  // Flow as the onAuthRequired closure for this clone.
  // platform/git.ts::buildAuthCallbacks first consults
  // credentialOps.fill(host); only on a miss does it invoke the closure.
  // AUTH-09: the closure interpolates ONLY user_code + verification_uri
  // (via initiateDeviceFlow's notifyFn) -- the access token is acquired
  // LATER in the poll loop and is never passed back to a notify or Error.
  // D-77-06: this arm's source is statically `github`, whose host is the literal
  // `GITHUB_HOST` -- `hostFromCloneUrl` returns it without reading a url, so
  // there is nothing to derive here.
  const host = GITHUB_HOST;
  const auth = buildAuthForHost({
    host,
    credentialOps,
    ctx,
    ...(deviceFlowHttp !== undefined && { deviceFlowHttp }),
  });

  return addGitClonedInGuard({
    state,
    locations,
    source,
    gitOps,
    removalOps,
    auth,
    cwd,
  });
}

/**
 * MURL-01 / D-76-06: url-source add. `source.url` is stored as the canonical
 * identity form (parse-time `.git`-stripped) and NOT reconstructed against
 * github.com; the url actually cloned is derived from `source.raw` via
 * `networkCloneUrl` (D-2-01, D-2-03), preserving whatever `.git` decision the
 * user's own input made. GAUTH-03: the host is extracted from the url and
 * `buildAuthForHost` binds a bundle to it, so a private source on any host
 * authenticates from the user's git credential helper; the provider registry
 * decides only whether a Device Flow runs on a helper miss (PROV-03). The
 * bundle's host binding is enforced by the compare in
 * `buildAuthCallbacks.onAuth` (D-1-03, T-79-04).
 */
async function addUrlInGuard(args: {
  ctx: NotificationContext;
  state: ExtensionState;
  locations: ScopedLocations;
  source: UrlSource;
  removalOps: RemovalOps;
  gitOps: GitOps;
  credentialOps: CredentialOps;
  deviceFlowHttp?: DeviceFlowHttp;
  cwd: string;
}): Promise<string> {
  const { ctx, state, locations, source, gitOps, credentialOps, deviceFlowHttp, cwd, removalOps } =
    args;
  const host = hostFromCloneUrl(source.url, "url");
  const auth = buildAuthForHost({
    host,
    credentialOps,
    ctx,
    ...(deviceFlowHttp !== undefined && { deviceFlowHttp }),
  });

  return addGitClonedInGuard({
    state,
    locations,
    source,
    gitOps,
    removalOps,
    auth,
    cwd,
  });
}

async function addPathInGuard(args: {
  state: ExtensionState;
  locations: ScopedLocations;
  source: PathSource;
  cwd: string;
}): Promise<string> {
  const { state, locations, source, cwd } = args;

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
  const onDiskPath = expandTildePath(source.logical);
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

  // Read + validate manifest.
  const parsed = await loadMarketplaceManifest(manifestPath);

  const derivedName = parsed.name;

  // MA-8: duplicate name in scope.
  if (ownValue(state.marketplaces, derivedName) !== undefined) {
    throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
  }

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
    plugins: {},
  });
  return derivedName;
}

function expandTildePath(sourcePath: string): string {
  if (sourcePath === "~") {
    return os.homedir();
  }

  return sourcePath.startsWith("~/") ? path.join(os.homedir(), sourcePath.slice(2)) : sourcePath;
}
