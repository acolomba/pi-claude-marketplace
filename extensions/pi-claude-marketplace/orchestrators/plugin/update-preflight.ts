import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import {
  requireInstallable,
  requirePartialInstallable,
  resolveStrict,
} from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  CleanupLeakError,
  errorMessage,
  PluginShapeError,
  rethrowInvalidGitHubBaseUrl,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { classifyGitHostFailure } from "../../shared/git-failure-classifiers.ts";
import { ownValue } from "../../shared/own-key.ts";
import { narrowResolverNotes, narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import {
  withExistingScopeLock,
  withLockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import {
  DEFAULT_CREDENTIAL_OPS,
  buildCloneAuth,
  buildStoredCredentialAuth,
  hostFromCloneUrl,
} from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeMarketplaceTagClone,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  materializePluginCommitCopy,
  materializeUnpinnedSource,
  networkCloneUrl,
  resolveGitSubdirRoot,
  resolvePluginPin,
} from "./clone-cache.ts";
import { resolvePluginVersion } from "./shared.ts";
import { admitResolvedVersion, evaluateUpdateConstraint } from "./update-constraint-gate.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { GitPluginRootResult, MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { GitBackedSource, PathSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { GitAuthBundle, GitOps } from "../marketplace/shared.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateSkippedOutcome,
  PluginUpdateUnchangedOutcome,
  UpdateConstraintDisclosure,
} from "../types.ts";
import type {
  UpdateConstraintOptions,
  UpdateConstraintVerdict,
  UpdateTagPin,
} from "./update-constraint-gate.ts";

/** Target selected by the three public plugin-update invocation forms. */
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

/** Clone-cache operations used while probing one update candidate. */
export interface UpdateCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
  readonly materializePluginCommitCopy: typeof materializePluginCommitCopy;
}

/** Direct update request validated and classified by the update flow. */
export interface UpdatePluginsOptions {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: UpdatePluginsTarget;
  readonly gitOps?: GitOps;
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  readonly mapModel?: boolean;
  readonly local?: boolean;
  readonly partial?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/** Candidate state required by the staged update swap. */
export interface PreparedPluginUpdate {
  readonly state: ExtensionState;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
  readonly entry: PluginEntry;
  readonly installable: MaterializablePlugin;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly resolvedSha?: string;
  /**
   * D-10-17a: the constraint gate's disclosure, carried from the verdict this
   * preflight already evaluated. REQUIRED-BUT-NULLABLE (never `constraint?:`),
   * so `exactOptionalPropertyTypes` makes an omitting construction site a
   * compile error. This slot has exactly ONE justified consumer --
   * `update-swap.ts`'s `updated`-outcome literal -- because that literal is
   * composed AFTER the swap and this is its only channel back to the
   * preflight's verdict; the `unchanged` rows are built HERE, where the
   * verdict is already in scope, so they read it directly and never this
   * slot. A second consumer re-opens D-10-17a.
   */
  readonly constraint: UpdateConstraintDisclosure | undefined;
}

/**
 * D-18-04 / D-18-15: the three per-verb knobs of the shared materialization
 * path. They are the only behavioral difference between `update` and
 * `reinstall` inside it.
 */
export interface MaterializationPolicy {
  /**
   * `true` refreshes an unpinned git source's mirror before it reads the
   * mirror's HEAD. `false` reads a present mirror's HEAD with no network and
   * clones only a missing mirror (NFR-5 cache miss).
   */
  readonly refreshSource: boolean;
  /**
   * `true` returns `unchanged` for a candidate at the revision the record
   * holds. `false` re-materializes it, which is how `reinstall` restores
   * deleted artifacts (REI-01 / REI-02).
   */
  readonly skipSameRevision: boolean;
  /**
   * `true` lets the swap's agents commit replace this plugin's own previous
   * agent files whose bytes a user changed, the RINST-01 repair overwrite.
   * `false` keeps `update`'s refusal.
   */
  readonly overwrite: boolean;
}

/** Inputs required to classify and prepare one installed plugin update. */
export interface PreparePluginUpdateOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  /** D-18-04: the calling verb's knobs; required so no caller inherits update's by omission. */
  readonly policy: MaterializationPolicy;
  /** State I/O for the disabled-pin refresh; production callers omit it. */
  readonly stateTransaction?: LockedStateTransactionDeps;
  readonly partial?: boolean;
  readonly notification?: { readonly ctx: NotificationContext; readonly run: NotificationRun };
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  /**
   * D-10-02 / D-10-19: the constraint gate is composed through this field,
   * defaulted to the real `evaluateUpdateConstraint`. The field name is not
   * one the network-free ESLint block in `eslint.config.js` bans, and
   * production omits it.
   */
  readonly constraintGate?: typeof evaluateUpdateConstraint;
  /**
   * D-10-17: materializes a `path`-source pin's marketplace-tag clone,
   * defaulted to the real `materializeMarketplaceTagClone` so the path arm's
   * pin materialization is testable without a real clone.
   */
  readonly pathPinProbe?: typeof materializeMarketplaceTagClone;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /**
   * D-10-18: the run-scoped tag memos an update run allocates once and
   * threads into every target's gate evaluation, so a repository or
   * marketplace clone shared by several targets is listed once.
   */
  readonly constraintTagMemo?: Map<string, readonly RemoteTag[]>;
  readonly constraintMarketplaceTagMemo?: Map<string, readonly ReleaseTagCandidate[]>;
  readonly cleanupClones: (locations: ScopedLocations) => Promise<unknown>;
  /**
   * UPR-03: receives the installed version once the preflight found the
   * record, so a failure thrown before any candidate can show the version it
   * left in place, as a returned preflight failure does.
   */
  readonly onRecord?: (fromVersion: string) => void;
}

type PluginStateRecord = PreparedPluginUpdate["record"];

/**
 * NFR-7: a `(failed)` row the preflight itself can reach. It may name the
 * installed version (UPR-03: a failure before any candidate shows the version
 * it left in place) and the error behind it (SRC-01: a source the update could
 * not read or fetch). The four fields only a staged replacement can know stay
 * pinned `never`, so a preflight failure cannot claim a version transition it
 * never attempted, nor a `phaseFailures` aggregate that only phase-3a produces
 * -- the shape `update-flow.ts` narrows on to tell a phase-3a aggregate
 * (already notified, `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint composed from
 * `phaseFailures`) apart from every other failure. Threading any of the four
 * onto a preflight row therefore requires widening this type deliberately, and
 * that widening is what forces the phase-3a narrowing to be revisited
 * alongside it.
 */
export interface PreflightFailedOutcome extends Omit<
  PluginUpdateFailedOutcome,
  "fromCommit" | "phaseFailures" | "reasons" | "toCommit" | "toVersion"
> {
  readonly reasons: readonly ContentReason[];
  readonly fromCommit?: never;
  readonly phaseFailures?: never;
  readonly toCommit?: never;
  readonly toVersion?: never;
}

/**
 * Every verdict the preflight reaches without staging a replacement. A strict
 * subset of the swap stage's `UpdateRunOutcome`, so the update flow returns a
 * preflight verdict straight through to its caller with no cast (NFR-7).
 */
export type UpdatePreflightOutcome =
  PluginUpdateSkippedOutcome | PluginUpdateUnchangedOutcome | PreflightFailedOutcome;

type PartialableUpdateShapeError = PluginShapeError & {
  readonly shape: Extract<PluginShapeError["shape"], { kind: "no-longer-installable" }> & {
    readonly partialable: true;
    readonly unsupportedKinds: readonly string[];
  };
};

interface UpdateCloneProbe {
  readonly probe: (source: GitBackedSource) => Promise<GitPluginRootResult>;
  readonly resolvedSha: () => string | undefined;
}

/**
 * `cloneAuth` supplies the host-bound auth bundle for both arms below. The
 * autoupdate cascade calls this probe with no notification context, so it gets
 * `buildStoredCredentialAuth`'s bundle: the Device Flow renders a user code
 * through the context and the cascade has none (D-3-04). Every other caller
 * gets `buildCloneAuth`'s bundle.
 *
 * `refreshSource` is the policy knob the unpinned arm passes to the mirror
 * (D-18-04). The pinned arm never fetches a present clone, so it ignores it.
 */
function makeUpdateCloneProbe(
  seam: UpdateCloneCacheSeam,
  locations: ScopedLocations,
  auth: {
    readonly notification?: { readonly ctx: NotificationContext; readonly run: NotificationRun };
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
  refreshSource: boolean,
): UpdateCloneProbe {
  let captured: string | undefined;

  function cloneAuth(cloneUrl: string, kind: GitBackedSource["kind"]): GitAuthBundle {
    return auth.notification === undefined
      ? buildStoredCredentialAuth(hostFromCloneUrl(cloneUrl, kind), auth.credentialOps)
      : buildCloneAuth(cloneUrl, kind, { ...auth, ...auth.notification });
  }

  async function probeUnpinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    // GIT-01 / GIT-04 / GIT-03: the shared unpinned step, under the scope's
    // state lock so no `fetch` refreshes the mirror while its commit is read
    // and copied. The preflight runs before the swap takes the lock.
    const result = await withExistingScopeLock(locations, () =>
      materializeUnpinnedSource(seam, {
        locations,
        source: gitSource,
        auth: cloneAuth(canonicalCloneUrl(gitSource), gitSource.kind),
        refresh: refreshSource,
      }),
    );
    if (result.kind === "materialized") {
      captured = result.resolvedSha;
    }

    return result;
  }

  async function probePinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    const authBundle = cloneAuth(canonicalCloneUrl(gitSource), gitSource.kind);
    const pin = await seam.resolvePluginPin({
      source: gitSource,
      auth: authBundle,
    });
    const cloneRoot = await seam.materializePluginClone({
      locations,
      cloneUrl: pin.cloneUrl,
      networkUrl: networkCloneUrl(gitSource),
      pin: pin.pin,
      ...(pin.ref !== undefined && { ref: pin.ref }),
      resolveAuth: () => authBundle,
    });
    if (gitSource.kind === "git-subdir") {
      const subdir = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
      if (subdir.kind !== "materialized") {
        return subdir;
      }

      captured = pin.pin;
      return { ...subdir, resolvedSha: pin.pin };
    }

    captured = pin.pin;
    return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: pin.pin };
  }

  return {
    probe: (source) => (source.sha === undefined ? probeUnpinned(source) : probePinned(source)),
    resolvedSha: () => captured,
  };
}

/**
 * A tag-pinned update records the version the TAG names, for both source
 * kinds -- never a value derived from the resolved sha, and never the
 * marketplace-entry / manifest fallback `resolvePluginVersion` reads. This is
 * the ONLY way `deriveUpdateToVersion` can tell "pinned to a release tag"
 * apart from "refreshed to the branch head" or "resolved a `path` source's
 * current copy": a resolved sha is present either way, so the pin's own
 * version has to travel alongside it rather than being re-derived from it.
 */
async function deriveUpdateToVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  resolvedSha: string | undefined,
  pinnedVersion: string | undefined,
): Promise<string> {
  if (pinnedVersion !== undefined) {
    return pinnedVersion;
  }

  return resolvePluginVersion(
    entry,
    installable,
    isGitSourceEntry(entry) ? resolvedSha : undefined,
  );
}

/**
 * D-16-09: whether an update candidate is the revision the record holds. A
 * source that moved to a new commit is a new revision even when its declared
 * version did not change, because the stored sha is the revision; a switch
 * between a git and a `path` source adds or drops the sha, so it is a new
 * revision too. Only when neither side has a sha does the version alone
 * decide.
 *
 * This is the disabled branch's rule (D-99-05a). The enabled branch also
 * compares the plugin root, through `isRecordedCandidate`.
 */
function isSameRevision(
  record: PluginStateRecord,
  toVersion: string,
  resolvedSha: string | undefined,
): boolean {
  return toVersion === record.version && resolvedSha === record.resolvedSha;
}

/**
 * D-18-11: whether an enabled record already holds the candidate. A record made
 * before per-commit copies names the mutable mirror as its root, so the copy at
 * the same commit is a new revision and the swap re-anchors the record onto it.
 */
function isRecordedCandidate(
  record: PluginStateRecord,
  candidate: {
    readonly toVersion: string;
    readonly resolvedSha: string | undefined;
    readonly pluginRoot: string;
  },
): boolean {
  return (
    isSameRevision(record, candidate.toVersion, candidate.resolvedSha) &&
    candidate.pluginRoot === record.resolvedSource
  );
}

/** Whether `entry` installs from a git source (url / git-subdir / github). */
function isGitSourceEntry(entry: PluginEntry): boolean {
  const kind = parsePluginSource(entry.source).kind;
  return kind === "url" || kind === "git-subdir" || kind === "github";
}

function isPartialableUpdateShapeError(error: unknown): error is PartialableUpdateShapeError {
  return (
    error instanceof PluginShapeError &&
    error.shape.kind === "no-longer-installable" &&
    error.shape.partialable
  );
}

/** What `resolveUpdateCandidate` reaches: a candidate (or a skip or failure verdict), plus a `path`-pin's own resolved sha. */
interface UpdateCandidateResolution {
  readonly candidate: MaterializablePlugin | PluginUpdateSkippedOutcome | PreflightFailedOutcome;
  /**
   * The commit a `path`-source pin materialized, when one did. The git arm's
   * own resolved sha is unaffected -- it stays `clone.resolvedSha()`'s own
   * capture, read by the caller exactly as before a pin existed.
   */
  readonly pathResolvedSha: string | undefined;
}

async function resolveUpdateCandidate(
  entry: PluginEntry,
  marketplace: ExtensionState["marketplaces"][string],
  resolveGitPluginRoot: (source: GitBackedSource) => Promise<GitPluginRootResult>,
  options: {
    readonly plugin: string;
    readonly fromVersion: string;
    readonly partial: boolean;
    readonly locations: ScopedLocations;
    readonly pin?: UpdateTagPin;
    readonly pathPinProbe?: typeof materializeMarketplaceTagClone;
  },
): Promise<UpdateCandidateResolution> {
  let pathResolvedSha: string | undefined;
  try {
    const resolved = await resolveStrict(entry, {
      marketplaceRoot: marketplace.marketplaceRoot,
      marketplaceName: marketplace.name,
      resolveGitPluginRoot: (gitSource) =>
        // D-10-17: overriding `sha` is what routes the EXISTING probe down
        // its already-pinned arm, exactly as an explicitly pinned entry
        // source already does -- no second materialization path exists for
        // a constrained update. `clone.resolvedSha()` (read by the caller
        // after this call returns) already captures whatever this probe
        // resolves to, pinned or not, so nothing here needs to intercept it.
        resolveGitPluginRoot(
          options.pin === undefined ? gitSource : { ...gitSource, sha: options.pin.oid },
        ),
      // D-07-06 / D-10-17: added ONLY when a pin is present, so an
      // unconstrained update's resolver context has exactly the keys it has
      // today (success criterion 3) -- neither field is set at all.
      ...(options.pin !== undefined && {
        pathPluginPin: options.pin.oid,
        resolvePathPluginRoot: async (
          pathSource: PathSource,
          tagPin: string,
        ): Promise<GitPluginRootResult> => {
          const result = await (options.pathPinProbe ?? materializeMarketplaceTagClone)({
            locations: options.locations,
            marketplaceRoot: marketplace.marketplaceRoot,
            marketplaceSource: marketplace.source,
            marketplaceName: marketplace.name,
            pathSource,
            tagOid: tagPin,
          });
          if (result.kind === "materialized") {
            pathResolvedSha = result.resolvedSha;
          }

          return result;
        },
      }),
    });
    if (options.partial) {
      requirePartialInstallable(resolved, "update");
    } else {
      requireInstallable(resolved, "update");
    }

    return { candidate: resolved, pathResolvedSha };
  } catch (error: unknown) {
    // GHB-03: an invalid GitHub base override fails the whole command; it never
    // becomes a skipped row.
    rethrowInvalidGitHubBaseUrl(error);
    // GIT-03: `probeUnpinned` takes the state lock; a held lock is the
    // command's own `lock held` failure, never a candidate verdict.
    if (error instanceof StateLockHeldError) {
      throw error;
    }

    return { candidate: candidateFailure(error, options), pathResolvedSha: undefined };
  }
}

/**
 * The verdict for a candidate the resolver could not produce. Only reached
 * after the GHB-03 and GIT-03 rethrows, which fail the whole command.
 *
 * SRC-01: a source the update could not read or fetch fails, as Claude Code's
 * update does. A clone the git host refused reads install's reason for the
 * same answer, and a throw no ladder classifies keeps its cause and no reason
 * -- the source has not stopped being installable. Only the resolver's own
 * refusal skips.
 */
function candidateFailure(
  error: unknown,
  options: { readonly plugin: string; readonly fromVersion: string },
): PluginUpdateSkippedOutcome | PreflightFailedOutcome {
  const notes = [errorMessage(error)];
  const cause = error instanceof Error ? error : new Error(errorMessage(error));
  const hostReason = classifyGitHostFailure(error);
  if (hostReason !== undefined) {
    // The bare auth row keeps no cause, unless a cleanup leaked: its cause
    // carries the manual-cleanup hint (MA-9, INR-02).
    const keepsCause =
      hostReason !== "authentication required" || error instanceof CleanupLeakError;
    return failedCandidate(options, notes, [hostReason], keepsCause ? cause : undefined);
  }

  if (isPartialableUpdateShapeError(error)) {
    return {
      ...skippedCandidate(options, notes, narrowUnsupportedKinds(error.shape.unsupportedKinds)),
      partialUpgradable: true,
    };
  }

  if (error instanceof PluginShapeError && error.shape.kind === "no-longer-installable") {
    // The reason carries a missing directory; the note embeds the absolute
    // path, so no cause rides along.
    return narrowResolverNotes(error.shape.reasons).includes("source missing")
      ? failedCandidate(options, notes, ["source missing"])
      : skippedCandidate(options, notes, ["no longer installable"]);
  }

  return failedCandidate(options, notes, [], cause);
}

function skippedCandidate(
  options: { readonly plugin: string; readonly fromVersion: string },
  notes: readonly string[],
  reasons: readonly ContentReason[],
): PluginUpdateSkippedOutcome {
  return {
    partition: "skipped",
    name: options.plugin,
    fromVersion: options.fromVersion,
    notes: [...notes],
    reasons: [...reasons],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/** UPR-03: a candidate failure names the installed version it left in place. */
function failedCandidate(
  options: { readonly plugin: string; readonly fromVersion: string },
  notes: readonly string[],
  reasons: readonly ContentReason[],
  cause?: Error,
): PreflightFailedOutcome {
  return {
    partition: "failed",
    name: options.plugin,
    fromVersion: options.fromVersion,
    notes: [...notes],
    reasons: [...reasons],
    ...(cause !== undefined && { cause }),
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/**
 * The slots every static preflight verdict carries, including the version slot
 * only the `skipped` partition ever fills.
 *
 * The version sits here rather than on each arm so the `failed` arm has
 * something to narrow: an absence marker closes a slot the rest of the
 * intersection already declares, while a slot spelled only inside a union arm
 * would be an addition instead.
 */
interface StaticPreflightRowBase {
  readonly plugin: string;
  readonly notes: readonly string[];
  readonly reason: ContentReason;
  readonly fromVersion?: string;
}

/**
 * A static preflight verdict -- one the update reaches without resolving a
 * candidate.
 *
 * `fromVersion` is reachable on the `skipped` partition only. A `failed` row is
 * one for a plugin with no install record (UPR-04), so there is no record to
 * read a version from; pinning the field `never` there keeps a version arrow
 * off a row for a plugin that is not installed.
 */
type StaticPreflightRowOptions =
  | (StaticPreflightRowBase & { readonly partition: "failed"; readonly fromVersion?: never })
  | (StaticPreflightRowBase & { readonly partition: "skipped" });

function staticPreflightRow(
  options: StaticPreflightRowOptions,
): PluginUpdateSkippedOutcome | PreflightFailedOutcome {
  if (options.partition === "failed") {
    return {
      partition: "failed",
      name: options.plugin,
      notes: [...options.notes],
      reasons: [options.reason],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };
  }

  return {
    partition: "skipped",
    name: options.plugin,
    ...(options.fromVersion !== undefined && { fromVersion: options.fromVersion }),
    notes: [...options.notes],
    reasons: [options.reason],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

function triageUpdateMembership(
  plugin: string,
  record: PluginStateRecord | undefined,
  lookup: ReturnType<typeof lookupDeclaredPlugin>,
): UpdatePreflightOutcome | { readonly record: PluginStateRecord; readonly entry: PluginEntry } {
  if (record === undefined) {
    // UPR-04: the record is checked before the manifest, as Claude Code does,
    // so a plugin with no install record fails as not installed whether or not
    // the manifest still lists it -- the row `uninstall` renders. No
    // `fromVersion`: there is no record to read a version from.
    return staticPreflightRow({
      partition: "failed",
      plugin,
      notes: ["not installed"],
      reason: "not installed",
    });
  }

  if (lookup.kind === "absent") {
    return staticPreflightRow({
      partition: "skipped",
      plugin,
      notes: ["not in manifest"],
      reason: "not in manifest",
      fromVersion: record.version,
    });
  }

  return { record, entry: lookup.entry };
}

function widensPartialGate(record: PluginStateRecord): boolean {
  return isRecordedButDisabled(record) && !record.compatibility.installable;
}

function disabledPinProjection(
  version: string,
  resolvedSource: string,
  resolvedSha: string | undefined,
  compatibility: PluginStateRecord["compatibility"],
): string {
  return JSON.stringify([
    version,
    resolvedSource,
    resolvedSha ?? null,
    compatibility.installable,
    [...compatibility.notes],
    [...compatibility.supported],
    [...compatibility.unsupported],
  ]);
}

function nextDisabledPin(preflight: PreparedPluginUpdate): {
  readonly compatibility: PluginStateRecord["compatibility"];
  readonly projection: string;
} {
  const compatibility = {
    installable: preflight.installable.state === "installable",
    notes: [...preflight.installable.notes],
    supported: [...preflight.installable.supported],
    unsupported: [...preflight.installable.unsupported],
  };
  return {
    compatibility,
    // No `?? shaFallback`: a re-resolution that produced no pin PROJECTS no
    // pin, so a record still carrying one reads as changed and gets it
    // cleared.
    projection: disabledPinProjection(
      preflight.toVersion,
      preflight.installable.pluginRoot,
      preflight.resolvedSha,
      compatibility,
    ),
  };
}

function disabledRefreshWouldWrite(preflight: PreparedPluginUpdate): boolean {
  const next = nextDisabledPin(preflight);
  const current = disabledPinProjection(
    preflight.record.version,
    preflight.record.resolvedSource,
    preflight.record.resolvedSha,
    preflight.record.compatibility,
  );
  return next.projection !== current;
}

async function refreshDisabledRecord(
  options: PreparePluginUpdateOptions,
  preflight: PreparedPluginUpdate,
): Promise<boolean> {
  return withLockedStateTransaction(
    options.locations,
    async (transaction) => {
      const record = ownValue(
        ownValue(transaction.state.marketplaces, options.marketplace)?.plugins,
        options.plugin,
      );
      if (record === undefined) {
        return false;
      }

      const next = nextDisabledPin(preflight);
      const current = disabledPinProjection(
        record.version,
        record.resolvedSource,
        record.resolvedSha,
        record.compatibility,
      );
      if (next.projection === current) {
        return false;
      }

      record.version = preflight.toVersion;
      record.resolvedSource = preflight.installable.pluginRoot;
      // WR-01: a re-resolution that produced no pin (a `path` source with no
      // satisfying marketplace tag) must not leave the OLD `resolvedSha` on the
      // record -- it would name a commit `resolvedSource` no longer sits at.
      if (preflight.resolvedSha === undefined) {
        delete record.resolvedSha;
      } else {
        record.resolvedSha = preflight.resolvedSha;
      }

      record.compatibility = next.compatibility;
      record.updatedAt = new Date().toISOString();
      await transaction.save();
      return true;
    },
    options.stateTransaction,
  );
}

async function refreshDisabledPluginUpdate(
  options: PreparePluginUpdateOptions,
  preflight: PreparedPluginUpdate,
  // D-10-13 / D-10-17a: the disabled record refresh runs outside the scope
  // where the gate verdict is local, so the caller passes its OWN
  // `constraintFromVerdict(verdict)` result here -- never
  // `preflight.constraint`, which would make the prepared slot a second
  // consumer and re-open D-10-17a.
  constraint: UpdateConstraintDisclosure | undefined,
): Promise<PluginUpdateSkippedOutcome | PluginUpdateUnchangedOutcome> {
  const wrote = disabledRefreshWouldWrite(preflight)
    ? await refreshDisabledRecord(options, preflight)
    : false;
  // The sweep runs whenever the record's commit identity MOVED -- including
  // to nothing, which is when the old clone stops being referenced at all.
  if (wrote && preflight.resolvedSha !== preflight.record.resolvedSha) {
    try {
      await options.cleanupClones(options.locations);
    } catch (err) {
      // Clone cleanup is hygienic and retries on a later lifecycle operation.
      hookDebugLog(
        `refreshDisabledPluginUpdate: clone cleanup failed for ${options.plugin}: ${errorMessage(err)}`,
      );
    }
  }

  if (isSameRevision(preflight.record, preflight.toVersion, preflight.resolvedSha)) {
    return {
      partition: "unchanged",
      name: options.plugin,
      fromVersion: preflight.fromVersion,
      toVersion: preflight.toVersion,
      declaresAgents: false,
      declaresMcp: false,
      constraint,
      declaresWorkflows: false,
    };
  }

  return {
    partition: "skipped",
    name: options.plugin,
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/** What candidate resolution reaches once a pin (if any) has been threaded through it. */
interface PinnedUpdateCandidateResolution {
  readonly candidate: MaterializablePlugin | PluginUpdateSkippedOutcome | PreflightFailedOutcome;
  readonly resolvedSha: string | undefined;
  readonly pin: UpdateTagPin | undefined;
}

/**
 * Wraps `resolveUpdateCandidate`, threading the gate verdict's own pin (D-10-17)
 * into it. Every constraint-specific branch stays here, out of
 * `preparePluginUpdate`, which is already close to ESLint's and fallow's
 * cognitive-complexity cap (D-10-02).
 */
async function resolvePinnedUpdateCandidate(
  entry: PluginEntry,
  marketplace: ExtensionState["marketplaces"][string],
  clone: UpdateCloneProbe,
  verdict: UpdateConstraintVerdict,
  base: {
    readonly plugin: string;
    readonly fromVersion: string;
    readonly partial: boolean;
    readonly locations: ScopedLocations;
  },
  pathPinProbe: typeof materializeMarketplaceTagClone | undefined,
): Promise<PinnedUpdateCandidateResolution> {
  // D-10-17: the `admits` arm's own pin -- a tag oid and the version it
  // names -- threads into candidate resolution below; `unconstrained` and a
  // no-satisfying-tag `admits` both carry no pin.
  const pin = verdict.kind === "admits" ? verdict.pin : undefined;
  const resolution = await resolveUpdateCandidate(entry, marketplace, clone.probe, {
    ...base,
    ...(pin !== undefined && { pin }),
    ...(pathPinProbe !== undefined && { pathPinProbe }),
  });
  return {
    candidate: resolution.candidate,
    resolvedSha: clone.resolvedSha() ?? resolution.pathResolvedSha,
    pin,
  };
}

/**
 * UPDT-01 / UPDT-02 / D-10-01 stage two: a verdict that admitted with NO
 * pin (a no-tag repository, or a path source that fell back to the
 * marketplace's current copy) has not yet been checked against the
 * intersection -- the tag probe answered nothing. Re-checks the version
 * that actually landed against the SAME range and returns a `skipped`
 * outcome when it is held, or `undefined` to let the caller continue. A
 * pinned verdict skips the check entirely: the tag was already selected
 * FROM the range, so it would always pass. Kept out of
 * `preparePluginUpdate`'s own body for the same cognitive-complexity reason
 * as `resolvePinnedUpdateCandidate` above.
 */
function postFetchGuard(
  verdict: UpdateConstraintVerdict,
  toVersion: string,
  base: { readonly plugin: string; readonly fromVersion: string },
): PluginUpdateSkippedOutcome | undefined {
  if (verdict.kind !== "admits" || verdict.pin !== undefined) {
    return undefined;
  }

  const stageTwo = admitResolvedVersion(verdict, toVersion);
  if (stageTwo.kind === "admitted") {
    return undefined;
  }

  return skippedCandidate(base, [stageTwo.cause], ["dependents constrain"]);
}

/**
 * AUTH-09: the ONE credential composition `preparePluginUpdate` shares
 * between the constraint gate and the clone probe -- kept out of its own
 * body for the same cognitive-complexity reason as the other extractions
 * on this file.
 */
function buildUpdateAuth(options: PreparePluginUpdateOptions): {
  readonly notification?: { readonly ctx: NotificationContext; readonly run: NotificationRun };
  readonly credentialOps: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
} {
  return {
    ...(options.notification !== undefined && { notification: options.notification }),
    credentialOps: options.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
    ...(options.deviceFlowHttp !== undefined && { deviceFlowHttp: options.deviceFlowHttp }),
    ...(options.authMemo !== undefined && { authMemo: options.authMemo }),
  };
}

/**
 * The `admits` verdict's disclosure, ready for `PreparedPluginUpdate.constraint`
 * (D-10-17a). `undefined` for an unconstrained or held verdict -- held never
 * reaches this call, since `preparePluginUpdate` returns on it earlier, but
 * the type still carries the arm.
 */
function constraintFromVerdict(
  verdict: UpdateConstraintVerdict,
): UpdateConstraintDisclosure | undefined {
  return verdict.kind === "admits"
    ? { disclosure: verdict.disclosure, fellBackToCurrentCopy: verdict.fellBackToCurrentCopy }
    : undefined;
}

/**
 * Builds the constraint gate's own options, threading the run-scoped tag
 * memos in only when the caller supplied them (D-10-18) -- kept out of
 * `preparePluginUpdate`'s own body for the same cognitive-complexity reason
 * as `resolvePinnedUpdateCandidate` above.
 */
function constraintGateOptions(
  options: PreparePluginUpdateOptions,
  base: Omit<UpdateConstraintOptions, "marketplaceTagMemo" | "seam" | "tagMemo">,
): UpdateConstraintOptions {
  return {
    ...base,
    ...(options.constraintTagMemo !== undefined && { tagMemo: options.constraintTagMemo }),
    ...(options.constraintMarketplaceTagMemo !== undefined && {
      marketplaceTagMemo: options.constraintMarketplaceTagMemo,
    }),
  };
}

/** Resolves, validates, and classifies one plugin before any staged replacement. */
export async function preparePluginUpdate(
  options: PreparePluginUpdateOptions,
): Promise<PreparedPluginUpdate | UpdatePreflightOutcome> {
  const state = await loadState(options.locations.extensionRoot);
  const marketplace = ownValue(state.marketplaces, options.marketplace);
  if (marketplace === undefined) {
    return staticPreflightRow({
      partition: "skipped",
      plugin: options.plugin,
      notes: [`marketplace "${options.marketplace}" not found in ${options.scope} scope`],
      reason: "not in manifest",
    });
  }

  const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
  const triaged = triageUpdateMembership(
    options.plugin,
    ownValue(marketplace.plugins, options.plugin),
    lookupDeclaredPlugin(manifest, options.plugin),
  );
  if ("partition" in triaged) {
    return triaged;
  }

  options.onRecord?.(triaged.record.version);
  // AUTH-09: ONE credential composition in this function, shared by the
  // constraint gate and the clone probe below.
  const auth = buildUpdateAuth(options);

  // D-10-03: the gate runs after triage (there must be a record and a
  // manifest entry to constrain) and before candidate resolution (a held
  // verdict must never reach the clone probe). Every other constraint branch
  // stays inside the leaf -- `preparePluginUpdate` is already close to
  // ESLint's cognitive-complexity cap.
  const constraintGate = options.constraintGate ?? evaluateUpdateConstraint;
  const verdict = await constraintGate(
    constraintGateOptions(options, {
      plugin: options.plugin,
      marketplace: options.marketplace,
      entry: triaged.entry,
      marketplaceRoot: marketplace.marketplaceRoot,
      state,
      locations: options.locations,
      auth,
    }),
  );
  if (verdict.kind === "held") {
    return skippedCandidate(
      { plugin: options.plugin, fromVersion: triaged.record.version },
      [verdict.cause],
      ["dependents constrain"],
    );
  }

  const clone = makeUpdateCloneProbe(
    options.cloneCacheSeam ?? {
      resolvePluginPin,
      materializePluginClone,
      materializeOrRefreshPluginMirror,
      materializePluginCommitCopy,
    },
    options.locations,
    auth,
    options.policy.refreshSource,
  );
  const { candidate, resolvedSha, pin } = await resolvePinnedUpdateCandidate(
    triaged.entry,
    marketplace,
    clone,
    verdict,
    {
      plugin: options.plugin,
      fromVersion: triaged.record.version,
      partial: options.partial === true || widensPartialGate(triaged.record),
      locations: options.locations,
    },
    options.pathPinProbe,
  );
  if ("partition" in candidate) {
    return candidate;
  }

  const toVersion = await deriveUpdateToVersion(
    triaged.entry,
    candidate,
    resolvedSha,
    pin?.version,
  );

  const stageTwoHold = postFetchGuard(verdict, toVersion, {
    plugin: options.plugin,
    fromVersion: triaged.record.version,
  });
  if (stageTwoHold !== undefined) {
    return stageTwoHold;
  }

  if (
    options.policy.skipSameRevision &&
    !isRecordedButDisabled(triaged.record) &&
    isRecordedCandidate(triaged.record, {
      toVersion,
      resolvedSha,
      pluginRoot: candidate.pluginRoot,
    })
  ) {
    return {
      partition: "unchanged",
      name: options.plugin,
      fromVersion: triaged.record.version,
      toVersion,
      declaresAgents: false,
      declaresMcp: false,
      // D-10-13: the ceiling disclosure, read from the SAME `verdict` local
      // this function already holds -- never routed through `prepared`.
      constraint: constraintFromVerdict(verdict),
      declaresWorkflows: false,
    };
  }

  const prepared: PreparedPluginUpdate = {
    state,
    record: triaged.record,
    entry: triaged.entry,
    installable: candidate,
    fromVersion: triaged.record.version,
    toVersion,
    // D-10-17a: the ONE consumer of this slot is `update-swap.ts`'s
    // `updated`-outcome literal -- the prepared update is its only channel
    // back to the verdict this preflight already evaluated.
    constraint: constraintFromVerdict(verdict),
    ...(resolvedSha !== undefined && { resolvedSha }),
  };
  return isRecordedButDisabled(triaged.record)
    ? finishDisabledPreflight(options, prepared, constraintFromVerdict(verdict))
    : prepared;
}

/**
 * D-05 / D-18-05: the disabled-record pin refresh is update's alone. A policy
 * that re-materializes the recorded revision (reinstall's) reaches a disabled
 * record only when it was disabled after the verb read it, and skips it as
 * `already disabled` without writing the record.
 */
async function finishDisabledPreflight(
  options: PreparePluginUpdateOptions,
  prepared: PreparedPluginUpdate,
  constraint: UpdateConstraintDisclosure | undefined,
): Promise<PluginUpdateSkippedOutcome | PluginUpdateUnchangedOutcome> {
  if (!options.policy.skipSameRevision) {
    return {
      partition: "skipped",
      name: options.plugin,
      notes: [],
      reasons: ["already disabled"],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };
  }

  return refreshDisabledPluginUpdate(options, prepared, constraint);
}

/**
 * Discriminates a finished preflight verdict from a candidate ready to swap.
 * Typed on the narrow `UpdatePreflightOutcome` so the flow's verdict arm keeps
 * the four `never` proofs instead of widening to `PluginUpdateOutcome` (NFR-7).
 */
export function isUpdatePreflightOutcome(
  value: PreparedPluginUpdate | UpdatePreflightOutcome,
): value is UpdatePreflightOutcome {
  return "partition" in value;
}
