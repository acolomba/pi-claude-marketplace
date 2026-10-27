// orchestrators/marketplace/update.ts
//
// MU-1, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9 + RH-1/RH-2/RH-5 + SC-6 + NFR-5.
//
// Each orchestration emits exactly one `notify(ctx, run,...)` call with a
// discriminated `NotificationMessage` payload. Severity, reload-hint,
// soft-dep marker, and per-row glyph dispatch are owned by the renderer in
// `shared/notification-grammar.ts`.
//
// Outcomes -> NotificationMessage payloads:
//  - autoupdate OFF (manifest-only refresh): UXG-05 distinguishes a no-op from
//  a real change via a manifest-CONTENT compare (pre/post validated
//  marketplace.json content; NOT lastUpdatedAt, NOT git SHA). No change ->
//  `{ marketplaces: [{ name, scope, status: "skipped", reasons:
//  ["up-to-date"], plugins: [] }] }` (catalog UAT state `update-no-op-skipped`,
//  warning). Changed -> `{ marketplaces: [{ name, scope, status: "updated",
//  plugins: [] }] }` (catalog UAT state `manifest-refresh-changed`). NEITHER
//  fires the reload-hint: `shouldEmitReloadHint` triggers only on a PLUGIN row
//  with a state-changing status, never on a marketplace status, and these
//  payloads have no plugin rows.
//  - autoupdate ON (cascade): `{ marketplaces: [{ name, scope, status:
//  "updated", plugins: outcomes.map(outcomeToCascadePluginMessage) }] }`.
//  The per-plugin cause chain rides on `PluginFailedMessage.cause`;
//  `unchanged` renders as `⊘... (skipped) {up-to-date}`. Catalog UAT
//  fixture `mixed-outcomes`.
//  - mp-level failure (clone/manifest unreachable): the failed marketplace
//  header plus a synthetic `PluginFailedMessage` child carrying
//  `cause: err` so the underlying MarketplaceUpdateError reaches the user
//  (`err.retryHint` remains on the error for programmatic inspection).
//  - invalid GitHub base override: an `InvalidGitHubBaseUrlError` from the
//  refresh or from a cascade plugin update fails the whole command; no row is
//  rendered (GHB-03).
//  - empty targets (no marketplaces configured): `{ marketplaces: [] }`
//  renders the `(no marketplaces)` sentinel.
//  - post-success cache cleanup: a `rm` runs to drop the stale completion
//  cache; a cleanup leak there is intentionally NOT surfaced (PU-4 / AS-6).
//
// Per-row soft-dep markers are driven by the per-plugin
// `dependencies: Dependency[]` field on `PluginUpdatedMessage` /
// `PluginInstalledMessage` / `PluginReinstalledMessage`. D-05: the markers come
// from the command run's soft-dependency snapshot, composed in the resolve step.
//
// MU-2 and MU-3 do not apply under the "follow upstream blindly" contract --
// the local marketplace clone is read-only, so the pull --ff-only
// choreography and non-fast-forward divergence detection have no role.
//
// Flow:
//  1. Resolve scope(s):
//  - opts.name === undefined → bare form (MU-1, SC-6)
//  - opts.name + opts.scope === undefined → resolveScopeFromState
//  - opts.name + opts.scope set → use it directly
//
//  2. For each (scope, marketplaceName) pair:
//  a. OUTER GUARD (wraps refresh + persist, NOT cascade):
//  withLockedStateTransaction(locations, async (tx) => {
//  record = state.marketplaces[name]
//  if (record.source.kind === "github"):
//  cloneAdvanced = false
//  try {
//  refreshGitHubClone(cloneDir, record.source.ref, gitOps,
//  => { cloneAdvanced = true; });
// MU-5: the onFetchSucceeded callback flips
//  // cloneAdvanced to true ONLY after gitOps.fetch returns.
//  // Pre-fetch throws (DNS/network/auth) leave cloneAdvanced
//  // at false so the "Retry the command." hint is suppressed.
//  // Any later step throw (forceUpdateRef/checkout) or
//  // manifest re-read throw still produces the retry hint.
//  manifest = read+validate recordedManifestPath(record)
//  record.lastUpdatedAt = now
//  } catch (err) {
//  throw new MarketplaceUpdateError(..., { cause, retryHint: cloneAdvanced ? "Retry the command." : "" })
//  }
//  else if path:
//  manifest = read+validate recordedManifestPath(record) // NO gitOps; NFR-5
//  // capture snapshot for cascade-outside-guard:
//  snapshot = { autoupdate: record.autoupdate ?? false, plugins: Object.keys(record.plugins) }
//  return snapshot
//  })
//
//  b. CASCADE OUTSIDE GUARD (honors MU-4 literal "persisted before cascade"):
//  if (snapshot.autoupdate === true && pluginUpdate is provided):
//  for each plugin in snapshot.plugins:
//  outcome = await pluginUpdate(plugin, name, scope);
//  partition[outcome.partition].push(outcome)
//  // MU-7: per-plugin outcomes feed outcomeToCascadePluginMessage construction
//
//  3. Compose user-visible output via a single notify(ctx, run,...)
//  call per orchestration (see header comment above for
//  the catalog UAT fixtures bound to each shape). Empty targets,
//  mp-level failure, autoupdate-OFF success, and autoupdate-ON
//  cascade each map to a distinct NotificationMessage shape;
//  severity and reload-hint are renderer-computed and MUST NOT be
//  composed by callers.
//
//  D-14 sequence: fetch + (symbolic HEAD) forceUpdateRef + checkout, OR
//  (detached HEAD) checkout directly. NO `pull`.

import { isDeepStrictEqual } from "node:util";

import { networkCloneUrl } from "../../domain/clone-key.ts";
import { loadMarketplaceManifestDocument } from "../../domain/manifest.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  InvalidMarketplaceManifestError,
  MarketplaceBaselineUnreadableError,
  MarketplaceUpdateError,
  PluginShapeError,
  StateLockHeldError,
  composeErrorWithCauseChain,
  errorMessage,
  isErrnoException,
  rethrowInvalidGitHubBaseUrl,
} from "../../shared/errors.ts";
import {
  classifyGitTransportFailure,
  hostHttpFailureFrame,
  hostHttpStatus,
} from "../../shared/git-failure-classifiers.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
  type Single,
} from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import {
  withLockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import {
  DEFAULT_CREDENTIAL_OPS,
  NO_STORED_CREDENTIAL_CAUSE,
  buildGitHubAuth,
} from "../auth-host.ts";
// WR-12 / WR-03: the `(updated)` row composer, imported from the LEAF module
// that holds it rather than from the plugin-update ledger. The ledger stays
// behind the injected `pluginUpdate` seam -- and now stays out of this module's
// import graph too, so no future edge can close an
// `orchestrators/marketplace` <-> `orchestrators/plugin` cycle here.

import {
  DEFAULT_GIT_OPS,
  lacksStoredCredential,
  recordedManifestPath,
  refreshGitHubClone,
  refreshUrlClone,
  resolveScopeOrNotifyNotAdded,
  type GitAuthBundle,
  type GitOps,
} from "./shared.ts";
import {
  UPDATE_CONTEXT,
  outcomeToCascadePluginMessage,
  type UpdateRowMsg,
} from "./update.messaging.ts";

import type { DeviceFlowHttp } from "../../domain/github-auth.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { CredentialOps } from "../../platform/git-credential.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFn,
  PluginUpdateOutcome,
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
} from "../types.ts";

export interface UpdateMarketplaceOptions {
  readonly completionCache: CompletionCache;
  readonly ctx: NotificationContext;
  /** Single marketplace by name. Required for `updateMarketplace`; rejected by `updateAllMarketplaces` (which derives the list from state). */
  readonly name: string;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  /**
   * Autoupdate-cascade injection seam. When omitted, the autoupdate cascade
   * is a NO-OP (tests inject a mock).
   */
  readonly pluginUpdate?: PluginUpdateFn;
  /**
   * D-PL2-10: `apply`'s missing-dependency step over the marketplace's scope.
   * The autoupdate cascade runs it after its plugin updates, for missing
   * dependencies of this marketplace's plugins, as Claude Code does after a
   * background autoupdate. When omitted, the cascade runs no such step.
   */
  readonly installMissingDependencies?: ScopeDependencyInstallFn;
  /**
   * D-05: the command's run. Every emission renders from its soft-dependency
   * snapshot, and the `{requires ...}` markers are composed from it in the
   * resolve step.
   */
  readonly run: NotificationRun;
  /**
   * AUTH-02 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject createCredentialOpsFake() from test/platform/credential-ops-fake.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam for Device Flow integration tests. Production callers omit
   * this field and get DEFAULT_DEVICE_FLOW_HTTP (real github.com fetch)
   * inside the orchestrator's onAuthRequired closure.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * D-12-style injection seam for the locked-state transaction around the
   * refresh. Tests inject a `loadState` that omits the target record, which
   * is the only deterministic way to reach the in-lock disappearance arm: the
   * pre-guard probe reads the real file and finds the record, while the
   * in-lock load does not. Zero runtime cost in production: the value is
   * forwarded unchanged.
   */
  readonly stateTransaction?: LockedStateTransactionDeps;
}

export interface UpdateAllMarketplacesOptions {
  readonly completionCache: CompletionCache;
  readonly ctx: NotificationContext;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  /** See `UpdateMarketplaceOptions.installMissingDependencies`. */
  readonly installMissingDependencies?: ScopeDependencyInstallFn;
  /** See `UpdateMarketplaceOptions.run`. */
  readonly run: NotificationRun;
  /**
   * AUTH-02 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS which
   * wraps `git credential fill/approve/reject` via subprocess. Tests
   * inject createCredentialOpsFake() from test/platform/credential-ops-fake.ts
   * so the developer's OS keychain is never touched.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * Test seam for Device Flow integration tests. Production callers omit
   * this field and get DEFAULT_DEVICE_FLOW_HTTP (real github.com fetch)
   * inside the orchestrator's onAuthRequired closure.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/** MU-1 single-name form. */
export async function updateMarketplace(opts: UpdateMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);

  // MU-1 + ATTR-06 / SC#1: resolve scope and enforce the missing-marketplace
  // precondition. On a miss the helper has already emitted the standalone
  // `(failed) {marketplace not added}` variant, so return without entering the refresh path.
  const resolved = await resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);
  if (resolved === undefined) {
    return;
  }

  await refreshOneMarketplace({
    completionCache: opts.completionCache,
    ctx: opts.ctx,
    run: opts.run,
    cardinality: "single",
    name: opts.name,
    scope: resolved.scope,
    cwd: opts.cwd,
    locations: resolved.locations,
    gitOps,
    credentialOps,
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
    ...(opts.installMissingDependencies !== undefined && {
      installMissingDependencies: opts.installMissingDependencies,
    }),
    ...(opts.stateTransaction !== undefined && { stateTransaction: opts.stateTransaction }),
  });
}

/**
 * MU-1 bare form (no name): refresh every marketplace in target scope(s).
 * SC-6 enumerates both scopes when --scope omitted.
 */
export async function updateAllMarketplaces(opts: UpdateAllMarketplacesOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  // Iteration order is project-first per MSG-GR-3 so same-name cross-scope
  // stable-sort ties render project-before-user.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Collect (scope, marketplaceName) pairs from a single fresh state read per scope.
  const targets: { scope: Scope; locations: ScopedLocations; name: string }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
    const state = await loadState(locations.extensionRoot);
    for (const name of Object.keys(state.marketplaces)) {
      targets.push({ scope, locations, name });
    }
  }

  // CMC-10: empty-set succeeds silently. The renderer emits the
  // "(no marketplaces)" sentinel when `message.marketplaces` is the empty
  // array; callers MUST NOT compose the sentinel text.
  if (targets.length === 0) {
    // OUT-07 / D-12: empty inventory -> Plural (zero rows). Renders the
    // `(no marketplaces)` sentinel via the central seam the spine reuses.
    const emptyRows: Plural<MarketplaceRows<UpdateRowMsg>> = [];
    notifyWithContext(opts.ctx, opts.run, UPDATE_CONTEXT, emptyRows, undefined, "plural");
    return;
  }

  // Process sequentially.
  for (const t of targets) {
    // eslint-disable-next-line no-await-in-loop -- each refresh locks the scope and notifies in order
    await refreshOneMarketplace({
      completionCache: opts.completionCache,
      ctx: opts.ctx,
      run: opts.run,
      cardinality: "plural",
      name: t.name,
      scope: t.scope,
      cwd: opts.cwd,
      locations: t.locations,
      gitOps,
      credentialOps,
      ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
      ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
      ...(opts.installMissingDependencies !== undefined && {
        installMissingDependencies: opts.installMissingDependencies,
      }),
    });
  }
}

interface RefreshOneArgs {
  readonly completionCache: CompletionCache;
  readonly ctx: NotificationContext;
  readonly cardinality: "single" | "plural";
  readonly name: string;
  readonly scope: Scope;
  /** The command's working directory, which roots the project scope of the missing-dependency step. */
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly gitOps: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  readonly installMissingDependencies?: ScopeDependencyInstallFn;
  readonly run: NotificationRun;
  readonly credentialOps: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly stateTransaction?: LockedStateTransactionDeps;
}

/**
 * Reads the pre-fetch comparison for a git record without a saved baseline.
 * A manifest that is missing or invalid gives no comparison, so the refresh
 * counts as changed once the fetched manifest validates. D-07: a later update
 * can succeed once the source is fixed. Any other read failure (EACCES, EIO,
 * EISDIR) fails the refresh.
 */
async function manifestContentKey(
  record: ExtensionState["marketplaces"][string],
): Promise<string | undefined> {
  try {
    return (await loadMarketplaceManifestDocument(recordedManifestPath(record))).comparisonJson;
  } catch (err) {
    // The fetched manifest is still validated, so an invalid one fails there.
    if (
      err instanceof InvalidMarketplaceManifestError ||
      (isErrnoException(err) && err.code === "ENOENT")
    ) {
      return undefined;
    }

    throw err;
  }
}

/**
 * Parses the comparison text, or returns undefined when there is none. A saved
 * baseline that does not parse refuses the refresh as unreadable before any
 * source read or fetch.
 */
function parseBaseline(name: string, text: string | undefined): unknown {
  if (text === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new MarketplaceBaselineUnreadableError(name, { cause });
  }
}

/**
 * UPD-12 / GAUTH-04 / GHB-01: refresh a github clone. Under
 * `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` the bundle is a stored credential
 * bound to the override's host, so a failed credential lookup gains the line
 * that names how to store one. The line goes before the fetched-URL link, which
 * stays the last link, and the code-bearing error stays at depth 0. With the
 * override unset the bundle is the github.com Device Flow and nothing changes
 * (GHB-04).
 */
async function refreshGitHubSource(
  cloneDir: string,
  ref: string | undefined,
  gitOps: GitOps,
  onFetchSucceeded: () => void,
  auth: GitAuthBundle,
): Promise<void> {
  try {
    await refreshGitHubClone(cloneDir, ref, gitOps, onFetchSucceeded, auth);
  } catch (err) {
    if (lacksStoredCredential(err, auth)) {
      err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(auth.host), { cause: err.cause });
    }

    throw err;
  }
}

async function refreshRecord(
  record: ExtensionState["marketplaces"][string],
  args: RefreshOneArgs,
): Promise<boolean> {
  const { name, locations, gitOps } = args;
  const source = record.source as ParsedSource;
  const remoteUrl =
    source.kind === "github" || source.kind === "url" ? networkCloneUrl(source) : undefined;
  let cloneAdvanced = false;
  try {
    // A local legacy record has no historical content to compare. Its first
    // successful refresh establishes the baseline and reports a change.
    const preKey =
      record.lastSuccessfulManifest ??
      (source.kind === "path" ? undefined : await manifestContentKey(record));
    const baseline = parseBaseline(name, preKey);
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(name);
      // AUTH-02 / D-79-05: buildGitHubAuth binds github.com with the GitHub
      // provider's Device Flow as the onAuthRequired closure for this fetch,
      // or the override host with a stored credential and no Device Flow when
      // PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is set (GHB-02).
      // platform/git.ts::buildAuthCallbacks first consults
      // credentialOps.fill(host); on a hit (the post-add common case) the
      // stored token is returned and Device Flow does NOT trigger -- this is
      // the AUTH-02 silent-reuse contract. AUTH-09: only the user code and
      // the verification URI cross the flow's onDeviceCode callback.
      const { ctx, credentialOps, deviceFlowHttp } = args;
      const auth = buildGitHubAuth({
        credentialOps,
        ctx,
        run: args.run,
        ...(deviceFlowHttp !== undefined && { deviceFlowHttp }),
      });

      await refreshGitHubSource(
        cloneDir,
        source.ref,
        gitOps,
        () => {
          cloneAdvanced = true;
        },
        auth,
      );
    } else if (source.kind === "url") {
      const cloneDir = await locations.sourceCloneDir(name);
      const { ctx, credentialOps, deviceFlowHttp } = args;
      await refreshUrlClone({
        cloneDir,
        source,
        gitOps,
        ctx,
        run: args.run,
        credentialOps,
        ...(deviceFlowHttp !== undefined && { deviceFlowHttp }),
        onFetchSucceeded: () => {
          cloneAdvanced = true;
        },
      });
    } else if (source.kind !== "path") {
      throw new Error(
        `Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`,
      );
    }

    const document = await loadMarketplaceManifestDocument(recordedManifestPath(record));

    const changed =
      preKey === undefined || !isDeepStrictEqual(baseline, JSON.parse(document.comparisonJson));

    record.lastSuccessfulManifest = document.comparisonJson;
    // lastUpdatedAt is stamped on EVERY refresh (used elsewhere); it is
    // deliberately NOT the change signal.
    record.lastUpdatedAt = new Date().toISOString();
    return changed;
  } catch (err) {
    throw new MarketplaceUpdateError(
      refreshFailureMessage(name, err, remoteUrl, cloneAdvanced),
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone.
      { cause: err, retryHint: cloneAdvanced ? "Retry the command." : "" },
    );
  }
}

/**
 * UPD-11: the first frame of a refresh failure's cause line. When the git host
 * answered with an HTTP status, the frame names the status and the URL the
 * fetch sent (see `hostHttpFailureFrame`).
 */
function refreshFailureMessage(
  name: string,
  err: unknown,
  remoteUrl: string | undefined,
  cloneAdvanced: boolean,
): string {
  const frame = remoteUrl === undefined ? undefined : hostHttpFailureFrame(err, remoteUrl);
  if (frame !== undefined) {
    return frame;
  }

  return cloneAdvanced
    ? `Marketplace "${name}" clone advanced but manifest could not be persisted.`
    : `Failed to update marketplace "${name}".`;
}

interface RefreshSnapshot {
  readonly autoupdate: boolean;
  readonly plugins: readonly string[];
  /**
   * UXG-05: true when the refresh changed the complete parsed manifest
   * content; false when it equals the last successful baseline
   * (the no-op case). Drives the autoupdate-OFF `updated` vs `skipped
   * {up-to-date}` emission. Source-kind-uniform (path + github).
   */
  readonly changed: boolean;
}

async function snapshotAfterRefresh(args: RefreshOneArgs): Promise<RefreshSnapshot | undefined> {
  const { name, locations } = args;
  // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config), not
  // state. Read it OUTSIDE the lock (read-only seam; mergeScopeConfigs is a
  // pure reducer over loadConfig, which never throws).
  const { merged } = await loadMergedScopeConfig(locations);
  const autoupdate = ownValue(merged.marketplaces, name)?.entry.autoupdate ?? false;
  return withLockedStateTransaction(
    locations,
    async (tx) => {
      const record = ownValue(tx.state.marketplaces, name);
      if (record === undefined) {
        // TOCTOU race: the marketplace was removed between
        // `resolveScopeOrNotifyNotAdded`'s pre-guard `loadState` and this guard's
        // fresh `loadState`. The pre-guard already proved existence and the
        // missing-marketplace precondition is handled there (routed to the
        // standalone `{marketplace not added}` variant); reaching here means a concurrent
        // removal in that window. Return undefined so the caller skips the
        // cascade and emits NOTHING further -- no raw MarketplaceNotFoundError
        // escapes to `refreshOneMarketplace`'s catch, which would render a
        // second, failed row for a marketplace that is already gone (ATTR-10).
        // Mirrors runRemoveLockBody's silent-return in remove.ts
        // at the same withLockedStateTransaction boundary; that path also
        // saves the unmodified state (a harmless re-write of the same content).
        await tx.save();
        return undefined;
      }

      const changed = await refreshRecord(record, args);
      await tx.save();
      return {
        autoupdate,
        plugins: Object.keys(record.plugins),
        changed,
      };
    },
    args.stateTransaction,
  );
}

/** What the autoupdate cascade did: its plugin updates, then its missing-dependency installs. */
interface AutoupdateCascade {
  readonly outcomes: readonly PluginUpdateOutcome[];
  readonly installs: ScopeDependencyInstallResult;
}

const NO_DEPENDENCY_INSTALLS: ScopeDependencyInstallResult = { rows: [], mcpConfigNotices: [] };

const NO_AUTOUPDATE_CASCADE: AutoupdateCascade = { outcomes: [], installs: NO_DEPENDENCY_INSTALLS };

/**
 * The autoupdate cascade: each installed plugin's update, then (D-PL2-10) the
 * missing-dependency step, so the step sees the versions the updates landed
 * (E4 order).
 */
async function cascadeAutoupdates(
  snapshot: RefreshSnapshot,
  args: RefreshOneArgs,
): Promise<AutoupdateCascade> {
  const { name, scope, pluginUpdate } = args;
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    return NO_AUTOUPDATE_CASCADE;
  }

  const outcomes: PluginUpdateOutcome[] = [];
  for (const plugin of snapshot.plugins) {
    try {
      // eslint-disable-next-line no-await-in-loop -- each update locks the scope (retries: 0)
      outcomes.push(await pluginUpdate(plugin, name, scope));
    } catch (err) {
      rethrowInvalidGitHubBaseUrl(err);
      // `notes` is consumed by callers OUTSIDE the notify path (e.g.
      // JSON-mode outcome aggregation in tests) and by the
      // narrowFailReason notes-substring fallback below, so the cause-chain
      // trailer is composed inline here. The user-visible cause-chain trailer
      // renders via PluginFailedMessage.cause at the 4-space indent the
      // renderer owns; the `outcome.cause` stamp below carries the raw `err`
      // for that path.
      //
      // Pre-narrow the closed-set Reason via `reasonsFromCascadeError(err)`
      // so the cascade row renders the precise cause class (`permission
      // denied` / `source missing` / `no longer installable` / ...) instead
      // of degrading to the permissive `not in manifest` fallback via the
      // consumer's `narrowFailReasons` substring parse.
      const typedReasons = reasonsFromCascadeError(err);
      outcomes.push({
        partition: "failed",
        name: plugin,
        notes: [composeErrorWithCauseChain(err)],
        ...(typedReasons !== undefined && { reasons: typedReasons }),
        // CMC-13: required `boolean` on the outcome contract. `(failed)`
        // cascade rows do not render the soft-dep marker (MSG-SD-3), so the
        // value is deliberately `false`; explicit emission keeps every
        // producer site honest.
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        // Carry the raw `err` so the cascade mapper
        // (outcomeToCascadePluginMessage) can attach it to
        // PluginFailedMessage.cause for the 4-space-indent cause-chain
        // trailer. `notes` above is retained for the non-notify consumers
        // (test fixtures + outcome aggregators) and for the narrowFailReason
        // notes-substring fallback.
        ...(err instanceof Error && { cause: err }),
      });
    }
  }

  return { outcomes, installs: await installAutoupdateDependencies(args, outcomes) };
}

/**
 * D-PL2-10: the missing-dependency step after an autoupdate, in the
 * marketplace's scope, for missing dependencies that a plugin of this
 * marketplace declares, as Claude Code limits it to declarers whose
 * marketplace has autoupdate on (E1). A dependency an update of this cascade
 * already reported a row for is not tried again, so one command reports one
 * row per dependency (D-PL2-01).
 */
async function installAutoupdateDependencies(
  args: RefreshOneArgs,
  outcomes: readonly PluginUpdateOutcome[],
): Promise<ScopeDependencyInstallResult> {
  const { installMissingDependencies, name } = args;
  if (installMissingDependencies === undefined) {
    return NO_DEPENDENCY_INSTALLS;
  }

  const reported = new Set(outcomes.flatMap((o) => (o.dependencyRows ?? []).map((r) => r.name)));
  return installMissingDependencies({
    ctx: args.ctx,
    run: args.run,
    scope: args.scope,
    cwd: args.cwd,
    select: (install) =>
      !reported.has(`${install.plugin}@${install.marketplace}`) &&
      install.declarers.some((declarer) => declarer.endsWith(`@${name}`)),
  });
}

/**
 * Typed-dispatch helper for the `cascadeAutoupdates` catch. Maps a thrown
 * error to a closed-set Reason[] using the same priority order as the cascade
 * narrowers in `orchestrators/plugin/{update,reinstall}.ts::reasonsFromTypedError`:
 * PluginShapeError variants first, then errno-bearing FS errors, then
 * `undefined` to defer to the consumer's substring fallback. The refresh
 * classification in `refreshFailureReasons` calls it as well, with the
 * `MarketplaceUpdateError` that wraps a refresh failure.
 */
function reasonsFromCascadeError(err: unknown): readonly ContentReason[] | undefined {
  if (err instanceof PluginShapeError) {
    // Switch on `err.shape.kind` for compile-time exhaustiveness.
    switch (err.shape.kind) {
      case "no-longer-installable":
      case "not-installable":
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" is unexpected (we only
        // cascade-update plugins already in the record); map to the
        // permissive `not in manifest` fallback.
        return ["not in manifest"] as const;
    }
  }

  // ATTR-10 / D-48-B / MPA-02: a typed marketplace-manifest parse or
  // validation failure maps to the token `list` and `info` use (D-11):
  // malformed JSON reads `unparseable`, a schema-invalid manifest
  // `invalid manifest`, for both path and github sources. The refresh
  // classification sees the InvalidMarketplaceManifestError WRAPPED inside a
  // MarketplaceUpdateError (refreshRecord rethrows with `{ cause }`), so unwrap
  // ONE level of cause (mirrors add.ts::unwrapAddError); the cascadeAutoupdates
  // catch passes the raw error. Placed before the errno checks so the typed
  // class takes precedence over any incidental errno on the cause chain.
  const manifestError =
    err instanceof Error && err.cause instanceof InvalidMarketplaceManifestError ? err.cause : err;
  if (manifestError instanceof InvalidMarketplaceManifestError) {
    return [narrowProbeError(manifestError)] as const;
  }

  if (err instanceof Error && err.cause instanceof MarketplaceBaselineUnreadableError) {
    return ["unreadable"] as const;
  }

  // Mirror the one-level cause unwrap above for code-bearing transport
  // errors (errno + HttpError); the narrowing lives in `transportReason`.
  if (err instanceof Error) {
    const reason = transportReason(err);
    if (reason !== undefined) {
      return [reason] as const;
    }
  }

  return undefined;
}

/**
 * Narrow a code-bearing transport failure to its closed-set Reason. The
 * refresh classification receives the transport error WRAPPED inside a
 * MarketplaceUpdateError (refreshRecord rethrows with `{ cause }`), so the
 * wrapper itself carries no `code` -- hence the one-level cause unwrap. A
 * path-source refresh that hits ENOENT/ENOTDIR/EACCES/EPERM is a network-free
 * failure (NFR-5) and maps to `source missing` / `permission denied`.
 *
 * EACCES/EPERM/ENOENT/ENOTDIR classify first since the shared classifier
 * has no opinion on them (path-source failures never reach git). The
 * remaining ladder -- `StoredCredentialRejectedError` (a stored credential the
 * host refused), isomorphic-git `HttpError` 401/403, `UserCanceledError` (a
 * helper miss, a declined or failed Device Flow, or a device-flow credential
 * the host refused), and network errno --
 * delegates to `classifyGitTransportFailure` (`shared/git-failure-classifiers.ts`)
 * instead of a hand-rolled copy, so `update` cannot drift out of sync with
 * `install-outcome.ts`/`fetch.ts` (plugin), which already delegate to it.
 */
function transportReason(err: Error): ContentReason | undefined {
  let bearer: NodeJS.ErrnoException | undefined;
  if ((err as NodeJS.ErrnoException).code !== undefined) {
    bearer = err;
  } else if (err.cause instanceof Error) {
    bearer = err.cause;
  }

  if (bearer === undefined) {
    return undefined;
  }

  if (bearer.code === "EACCES" || bearer.code === "EPERM") {
    return "permission denied";
  }

  if (bearer.code === "ENOENT" || bearer.code === "ENOTDIR") {
    return "source missing";
  }

  return classifyGitTransportFailure(bearer);
}

/**
 * ATTR-10 / UPD-11: the reasons of a failed marketplace refresh row. Only a
 * failure of the refresh itself, which `refreshRecord` wraps in a
 * `MarketplaceUpdateError`, is classified. A held state lock is `lock held`,
 * as in autoupdate. Any other error failed outside the refresh (the state
 * load, the state save, or the lock release), so no errno code on it is
 * mapped. A refresh failure that no rule names gets no reason; its cause chain
 * still prints.
 */
function refreshFailureReasons(err: unknown): readonly ContentReason[] {
  if (err instanceof StateLockHeldError) {
    return ["lock held"];
  }

  if (!(err instanceof MarketplaceUpdateError)) {
    return [];
  }

  const typedReasons = reasonsFromCascadeError(err);
  if (typedReasons !== undefined) {
    return typedReasons;
  }

  return hostHttpStatus(err.cause) === undefined ? [] : ["network error"];
}

async function refreshOneMarketplace(args: RefreshOneArgs): Promise<void> {
  const { ctx, cardinality, name, scope, locations, pluginUpdate, run } = args;

  let snapshot: RefreshSnapshot | undefined;
  try {
    snapshot = await snapshotAfterRefresh(args);
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    // A marketplace refresh failure renders as the header
    // `⊘ <name> [<scope>] (failed)`. The MarketplaceNotificationMessage
    // shape carries no `cause` (SNM-10 confines `cause` to plugin-level
    // variants), so surface the underlying MarketplaceUpdateError cause
    // (and its retry-hint, carried in the cause chain) via a synthetic
    // failed-plugin child whose `cause` drives the depth-5 cause-chain
    // trailer the renderer appends. Mirrors the reinstall synthetic-failed
    // recipe (orchestrators/plugin/reinstall-flow.ts).
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name,
      reasons: refreshFailureReasons(err),
      cause: err as Error,
      // D-03/D-06: a marketplace-refresh failure -> error, no reload.
      severity: "error",
      needsReload: false,
    };
    // OUT-07 / D-12: one marketplace block -> Single. The `(failed)` header
    // renders via the central seam; the failed child row dispatches through
    // UPDATE_CONTEXT.
    const failedRows: Single<MarketplaceRows<UpdateRowMsg>> = [
      // D-03: a failed marketplace update -> error.
      { name, scope, status: "failed", severity: "error", plugins: [failedRow] },
    ];
    notifyWithContext(ctx, run, UPDATE_CONTEXT, failedRows, undefined, cardinality);
    return;
  }

  if (snapshot === undefined) {
    // TOCTOU concurrent-removal no-op: the marketplace was removed between the
    // pre-guard existence read and snapshotAfterRefresh's fresh guard load. The
    // pre-guard already emitted the standalone `{marketplace not added}` notification, so
    // return silently -- NO second contradictory notification (the raw
    // MarketplaceNotFoundError does not escape; mirrors remove.ts).
    return;
  }

  // Post-state-commit completion-cache invalidation. Only a changed manifest
  // can change the marketplace's plugin index; an up-to-date refresh retains
  // the exact existing row. The successful target drop completes before any
  // plugin cascade observes the persisted state.
  if (snapshot.changed) {
    try {
      await args.completionCache.dropMarketplaceCache(
        await locations.pluginCacheFile(name),
        scope,
        name,
      );
    } catch (err) {
      // Intentional non-surfacing (PU-4 / AS-6): this cleanup runs AFTER the
      // durable atomic state save, so a leak here cannot corrupt state. A
      // cache-refresh failure is deliberately NOT surfaced -- emitting a second
      // notify after the primary would double severity routing. The cache `rm`
      // still runs above; only the user-facing warning is suppressed.
      hookDebugLog(`post-update cache drop failed: ${errorMessage(err)}`);
    }
  }

  // CASCADE OUTSIDE the outer guard. Honors MU-4 literal
  // "persisted before any plugin cascade runs".
  const { outcomes, installs } = await cascadeAutoupdates(snapshot, args);

  // CMC-32 / UXG-05 binding: BOTH the autoupdate-OFF (manifest-only refresh)
  // and the autoupdate-ON (cascade) paths now DISTINGUISH a no-op from a
  // genuine change via the change detector + the cascade outcomes:
  //   - no change: the validated manifest content is byte-identical pre/post
  //     (snapshot.changed === false) AND every cascaded plugin was a no-op
  //     (`partition === "unchanged"`) -> emit `(skipped) {up-to-date}` (catalog
  //     state `update-no-op-skipped` / `update-autoupdate-noop-skipped`).
  //     Routes WARNING via computeSeverity (mp.status === "skipped"); this is
  //     intentional -- the benign-skip -> info softening is UXG-02, NOT
  //     pre-empted here.
  //   - changed: the manifest content changed OR any plugin actually
  //     updated/installed/reinstalled/uninstalled/failed (i.e. NOT every
  //     outcome is `unchanged`) -> emit `(updated)` (catalog state
  //     `manifest-refresh-changed`, or the cascade-rows shape on the ON path).
  // The autoupdate-OFF payload has no plugin rows; the autoupdate-ON no-op
  // payload deliberately drops the all-`unchanged` cascade rows (plugins:[])
  // for byte-form consistency with the OFF no-op.
  // NEITHER no-op emits a reload-hint: `shouldEmitReloadHint` fires only on a
  // PLUGIN row with a state-changing status, never on a marketplace status, and
  // these payloads have no plugin rows (plugins:[]). UXG-05 is orthogonal to
  // the reload-hint discipline.
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    if (!snapshot.changed) {
      // OUT-07 / D-12: one marketplace block, no child rows -> Single.
      const skippedRows: Single<MarketplaceRows<UpdateRowMsg>> = [
        { name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] },
      ];
      notifyWithContext(ctx, run, UPDATE_CONTEXT, skippedRows, undefined, cardinality);
      return;
    }

    // OUT-07 / D-12: manifest-only refresh, no child rows -> Single.
    const updatedRows: Single<MarketplaceRows<UpdateRowMsg>> = [
      { name, scope, status: "updated", plugins: [] },
    ];
    notifyWithContext(ctx, run, UPDATE_CONTEXT, updatedRows, undefined, cardinality);
    return;
  }

  // Autoupdate-ON no-op gate: a true no-op requires BOTH
  // (A) the validated manifest content is unchanged (snapshot.changed === false)
  // AND (B) every cascaded plugin outcome is `unchanged`. `updated` / `skipped`
  // (e.g. a source-mismatch skip) / `failed` outcomes are NOT no-ops -- a
  // `failed` outcome keeps the existing `(updated)`-with-rows emission so the
  // per-plugin failed routing is preserved (a thrown refresh failure is already
  // handled upstream in `refreshOneMarketplace`'s catch and never reaches here).
  // WR-10: the `skipped` exclusion covers the disabled-record re-pin (WR-02),
  // which is reachable here precisely because the hash-version ladder is
  // CONTENT-derived: the plugin's files can move while marketplace.json stays
  // byte-identical, so (A) holds while the plugin pin does not. That refresh
  // REWRITES the record (version, source, sha, compatibility) and only declines
  // to re-materialize artifacts, so collapsing it to `{up-to-date}` would
  // restate at the marketplace level the same false version claim the plugin row
  // stopped making. Catalog state `update-autoupdate-disabled-repin`.
  // When both hold, emit the SAME `(skipped) {up-to-date}` payload as the OFF
  // no-op (plugins:[] -> shouldEmitReloadHint stays false, warning severity).
  // D-PL2-10: a missing-dependency install is a change too.
  const cascadeIsNoOp =
    outcomes.every((o) => o.partition === "unchanged") && installs.rows.length === 0;
  if (!snapshot.changed && cascadeIsNoOp) {
    // OUT-07 / D-12: autoupdate-ON no-op collapses to the OFF no-op shape
    // (plugins:[]) -> Single, one marketplace block.
    const noopRows: Single<MarketplaceRows<UpdateRowMsg>> = [
      { name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] },
    ];
    notifyWithContext(ctx, run, UPDATE_CONTEXT, noopRows, undefined, cardinality);
    return;
  }

  // Cascade rows -- per-plugin PluginFailedMessage.cause /
  // PluginUpdatedMessage{from,to,dependencies} / PluginSkippedMessage.
  // notify owns: severity (any failed -> error; any skipped/manual recovery
  // -> warning; otherwise info), reload-hint (fires only when a plugin row
  // carries a status in {installed, updated, reinstalled, uninstalled} -- the
  // marketplace status never triggers it), and the per-row soft-dep marker
  // (single probe per notify call, applied to every row by its row policy).
  // Caller-supplied plugin order is honored verbatim.
  // OUT-07 / D-12: one marketplace block carrying the per-plugin cascade child
  // rows -> Single. The `(updated)` header renders via the central seam; the
  // updated/skipped/failed child rows dispatch through UPDATE_CONTEXT.
  const cascadeRows: Single<MarketplaceRows<UpdateRowMsg>> = [
    {
      name,
      scope,
      status: "updated",
      // WR-01: `outcomeToCascadePluginMessage` returns `UpdateRowMsg` by
      // construction, so the mapped rows are the narrowed Msg the
      // UPDATE_CONTEXT requires with no cast.
      // UPD-DEP-D1: the dependencies an update changed render beside its row.
      // D-PL2-10: the missing-dependency step's rows follow the update rows.
      plugins: [
        ...outcomes.flatMap((o) => [
          outcomeToCascadePluginMessage(o, scope),
          ...(o.dependencyRows ?? []),
        ]),
        ...installs.rows,
      ],
    },
  ];
  notifyWithContext(ctx, run, UPDATE_CONTEXT, cascadeRows, undefined, cardinality);
  // AFILE-04: the notices of the cascade's updates, shown after the rows they
  // explain. A failed update can carry them too: its MCP commit succeeded
  // before a later bridge or the finalize failed. The no-op paths above have
  // only `unchanged` outcomes, which carry none.
  notifyMcpConfigNotices(ctx, run, [
    ...outcomes.flatMap((o) =>
      o.partition === "updated" || o.partition === "failed" ? (o.mcpConfigNotices ?? []) : [],
    ),
    ...installs.mcpConfigNotices,
  ]);
}
