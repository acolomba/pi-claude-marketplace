import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import {
  requireInstallable,
  requirePartialInstallable,
  resolveStrict,
} from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { shaVersion } from "../../domain/version.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeMarketplaceTagClone,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
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
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { GitOps } from "../marketplace/shared.ts";
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
}

/** Direct update request validated and classified by the update flow. */
export interface UpdatePluginsOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
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

/** Inputs required to classify and prepare one installed plugin update. */
export interface PreparePluginUpdateOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly partial?: boolean;
  readonly ctx?: NotificationContext;
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  /**
   * D-10-02 / D-10-19: the constraint gate is composed through this field,
   * defaulted to the real `evaluateUpdateConstraint`. The field name is not
   * one `tests/architecture/gate-targets.ts`'s network-free gate matches, and
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
}

type PluginStateRecord = PreparedPluginUpdate["record"];

/**
 * NFR-7: a `(failed)` row the preflight itself can reach. The four fields only a
 * staged replacement can know are pinned `never`, so a preflight failure cannot
 * claim a version transition it never attempted, nor a `phaseFailures` aggregate
 * that only phase-3a produces -- the shape `update-flow.ts` narrows on to tell a
 * phase-3a aggregate (already notified, `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint
 * composed from `phaseFailures`) apart from every other failure. Threading any
 * of the four onto a preflight row therefore requires widening this type
 * deliberately, and that widening is what forces the phase-3a narrowing to be
 * revisited alongside it.
 */
export interface PreflightFailedOutcome extends Omit<
  PluginUpdateFailedOutcome,
  "cause" | "fromVersion" | "phaseFailures" | "reasons" | "toVersion"
> {
  readonly reasons: readonly ContentReason[];
  readonly cause?: never;
  readonly fromVersion?: never;
  readonly phaseFailures?: never;
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

function makeUpdateCloneProbe(
  seam: UpdateCloneCacheSeam,
  locations: ScopedLocations,
  auth: {
    readonly ctx?: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): UpdateCloneProbe {
  let captured: string | undefined;

  const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
    if (auth.ctx === undefined) {
      return undefined;
    }

    return buildAuthForHost({
      host: hostFromCloneUrl(cloneUrl, gitSource.kind),
      credentialOps: auth.credentialOps,
      ctx: auth.ctx,
      ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
      ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
    });
  };

  async function probeUnpinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const authBundle = buildBundle(gitSource, cloneUrl);
    const materialized = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    if (gitSource.kind === "git-subdir") {
      const subdir = await resolveGitSubdirRoot(materialized.pluginRoot, gitSource.path);
      if (subdir.kind !== "materialized") {
        return subdir;
      }

      captured = materialized.resolvedSha;
      return { ...subdir, resolvedSha: materialized.resolvedSha };
    }

    captured = materialized.resolvedSha;
    return {
      kind: "materialized",
      pluginRoot: materialized.pluginRoot,
      resolvedSha: materialized.resolvedSha,
    };
  }

  async function probePinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    const authBundle = buildBundle(gitSource, canonicalCloneUrl(gitSource));
    const pin = await seam.resolvePluginPin({
      source: gitSource,
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    const cloneRoot = await seam.materializePluginClone({
      locations,
      cloneUrl: pin.cloneUrl,
      pin: pin.pin,
      ...(pin.ref !== undefined && { ref: pin.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
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

  const kind = parsePluginSource(entry.source).kind;
  if ((kind === "url" || kind === "git-subdir" || kind === "github") && resolvedSha !== undefined) {
    return shaVersion(resolvedSha);
  }

  return resolvePluginVersion(entry, installable);
}

function isPartialableUpdateShapeError(error: unknown): error is PartialableUpdateShapeError {
  return (
    error instanceof PluginShapeError &&
    error.shape.kind === "no-longer-installable" &&
    error.shape.partialable
  );
}

/** What `resolveUpdateCandidate` reaches: a candidate (or skip verdict), plus a `path`-pin's own resolved sha. */
interface UpdateCandidateResolution {
  readonly candidate: MaterializablePlugin | PluginUpdateSkippedOutcome;
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
    const networkReason = classifyGitTransportFailure(error);
    if (networkReason !== undefined) {
      return {
        candidate: skippedCandidate(options, [errorMessage(error)], [networkReason]),
        pathResolvedSha: undefined,
      };
    }

    if (isPartialableUpdateShapeError(error)) {
      return {
        candidate: {
          ...skippedCandidate(
            options,
            [errorMessage(error)],
            narrowUnsupportedKinds(error.shape.unsupportedKinds),
          ),
          partialUpgradable: true,
        },
        pathResolvedSha: undefined,
      };
    }

    if (error instanceof PluginShapeError && error.shape.kind === "no-longer-installable") {
      return {
        candidate: skippedCandidate(options, [errorMessage(error)], ["no longer installable"]),
        pathResolvedSha: undefined,
      };
    }

    // Anything else is genuinely unexpected -- not a classified git-transport
    // failure and not the resolver's typed `no-longer-installable` shape.
    // "no longer installable" stays the user-facing verdict (the candidate
    // could not be resolved either way), but it is not necessarily the real
    // cause, so log the actual error for diagnosis.
    hookDebugLog(
      `resolveUpdateCandidate: unclassified error for "${options.plugin}": ${errorMessage(error)}`,
    );
    return {
      candidate: skippedCandidate(options, [errorMessage(error)], ["no longer installable"]),
      pathResolvedSha: undefined,
    };
  }
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
 * one the plugin is absent from the manifest for, so there is no install record
 * to read a version from; pinning the field `never` there keeps a version arrow
 * off a row for a plugin that was never installed.
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
  };
}

function triageUpdateMembership(
  plugin: string,
  record: PluginStateRecord | undefined,
  lookup: ReturnType<typeof lookupDeclaredPlugin>,
): UpdatePreflightOutcome | { readonly record: PluginStateRecord; readonly entry: PluginEntry } {
  if (record === undefined) {
    return lookup.kind === "absent"
      ? // Not installed AND absent from the manifest. No `fromVersion` -- there
        // is no install record to read a version from.
        staticPreflightRow({
          partition: "failed",
          plugin,
          notes: ["not in manifest"],
          reason: "not in manifest",
        })
      : staticPreflightRow({
          partition: "skipped",
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
  return withLockedStateTransaction(options.locations, async (transaction) => {
    const record = transaction.state.marketplaces[options.marketplace]?.plugins[options.plugin];
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
  });
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

  if (preflight.toVersion === preflight.fromVersion) {
    return {
      partition: "unchanged",
      name: options.plugin,
      fromVersion: preflight.fromVersion,
      toVersion: preflight.toVersion,
      declaresAgents: false,
      declaresMcp: false,
      constraint,
    };
  }

  return {
    partition: "skipped",
    name: options.plugin,
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
  };
}

/** What candidate resolution reaches once a pin (if any) has been threaded through it. */
interface PinnedUpdateCandidateResolution {
  readonly candidate: MaterializablePlugin | PluginUpdateSkippedOutcome;
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
  readonly ctx?: NotificationContext;
  readonly credentialOps: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
} {
  return {
    ...(options.ctx !== undefined && { ctx: options.ctx }),
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
  const marketplace = state.marketplaces[options.marketplace];
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
    marketplace.plugins[options.plugin],
    lookupDeclaredPlugin(manifest, options.plugin),
  );
  if ("partition" in triaged) {
    return triaged;
  }

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
    },
    options.locations,
    auth,
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

  if (toVersion === triaged.record.version && !isRecordedButDisabled(triaged.record)) {
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
    ? refreshDisabledPluginUpdate(options, prepared, constraintFromVerdict(verdict))
    : prepared;
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
