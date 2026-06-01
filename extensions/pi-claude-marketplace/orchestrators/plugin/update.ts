// orchestrators/plugin/update.ts
//
// PUP-1..9 + AS-3 (3-phase) + AS-7 (orphan agent index entries) + WR-04 +
// NFR-2 + NFR-3.
//
// Two exported entrypoints (D-09 corollary):
//  1. updateSinglePlugin: PluginUpdateFn -- cascade-safe; NEVER throws
//  2. updatePlugins(opts) -- direct entrypoint; PUP-1 three forms
//
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow D-02 precedent):
//
//  (prepare): sequential bridge prepare* into tmp (skills -> commands
//  -> agents -> mcp). Any throw triggers abort of already-prepared handles
//  + appendLeaks of cleanup-leak descriptors.
//
//  (state-guard swap with old-resource snapshot): inside
//  `withStateGuard` re-read the plugin record, ST-9 stale-version check,
//  overwrite resources + version + updatedAt in-memory. Throw on ST-9
//  mismatch; guard does NOT save (ST-7).
//
//  Phase 3a (physical replace, aggregate failures, continue across bridges):
//  call each bridge's commitPrepared* in skills -> commands -> agents -> mcp
//  order. D-03 specifies CONTINUE across bridge failures (not fail-fast)
//  so the partial-replace state is fully observed. Failures aggregate
//  into Phase3Failure[].
//
//  Phase 3b (compose recovery hint or success): if any failures, wrap in
//  PluginUpdatePhase3Error with RECOVERY_PLUGIN_REINSTALL_PREFIX hint.
//  Else: success outcome carries WR-04 stagedAgents/stagedMcpServers.
//
// PUP-9 routing:
//  updateSinglePlugin -- cascade path -- catches into partition='failed'
//  updatePlugins -- direct path -- surfaces phase-2-or-earlier throws via
//  a single notify(ctx, pi, NotificationMessage) per
//  orchestration arm (cause threaded structurally on a
//  PluginFailedMessage; renderer composes the 4-space
//  cause-chain trailer).
//
// Success and failure notifications are a single
//  notify(opts.ctx, opts.pi, { marketplaces: [{..., plugins: [...] }] })
// call per orchestration arm. notify() owns severity, the reload-hint
// trailer, and the cause-chain. The post-success completion-cache-refresh
// warning inside dropPluginCompletionCache is NOT surfaced: the underlying
// dropMarketplaceCache call still runs (correctness preserved), only the
// standalone-mode user-visible warning surface is absent.
//
// D-11 import boundaries: orchestrators/plugin/ may import named exports
// from orchestrators/marketplace/shared.ts (GitOps, DEFAULT_GIT_OPS,
// resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import {
  abortPreparedAgents,
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
  prepareStageCommands,
} from "../../bridges/commands/index.ts";
import {
  abortPreparedMcp,
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  abortPreparedSkills,
  commitPreparedSkills,
  prepareStageSkills,
} from "../../bridges/skills/index.ts";
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  appendLeaks,
  assertNever,
  composeErrorWithCauseChain,
  errorMessage,
  PluginShapeError,
  PluginUpdatePhase3Error,
  type Phase3Failure,
} from "../../shared/errors.ts";
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { DEFAULT_GIT_OPS, refreshGitHubClone, type GitOps } from "../marketplace/shared.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import {
  assertNoCrossPluginConflicts,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  resolvePluginVersion,
} from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  Dependency,
  MarketplaceNotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateFn, PluginUpdateOutcome } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// updatePlugins -- direct entrypoint (PUP-1 three forms)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Target spec for PUP-1 three forms. edge layer parses argv and
 * constructs this discriminated union:
 *  - `{ kind: "all" }` (bare form)
 *  - `{ kind: "marketplace", marketplace }` (@mp form)
 *  - `{ kind: "plugin", plugin, marketplace }` (pl@mp form)
 */
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

export interface UpdatePluginsOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: UpdatePluginsTarget;
  /** D-12 injection seam; defaults to DEFAULT_GIT_OPS. */
  readonly gitOps?: GitOps;
  /**
   * AG-7 opt-in flag. Default false: re-staged agents omit `model:` and
   * Pi picks its own default. The edge handler sets this to `true` only
   * when the user supplies `--map-model` on `/claude:plugin update`.
   * The marketplace autoupdate cascade (`updateSinglePlugin`) does NOT
   * accept this flag; cascade-driven re-installs always omit `model:`.
   */
  readonly mapModel?: boolean;
}

/**
 * PUP-1..9 direct entrypoint. Enumerates targets per PUP-1 three forms,
 * runs PUP-2 syncCloneOnce per (scope, marketplace) pair, then drives each
 * plugin through the shared 3-phase swap. Partitions outcomes and renders
 * a single cascade notification per orchestration arm.
 *
 * PUP-9 direct routing: phase-2-or-earlier throws from `runThreePhaseUpdate`
 * surface via a synthetic `PluginFailedMessage` carrying the typed `cause`
 * (Option B); the renderer composes the 4-space cause-chain
 * trailer. Phase-3a aggregate failures land in
 * `partition='failed'` outcomes and also fire a direct-path notification
 * BEFORE the cascade is built (the cascade body still names them via the
 * `PluginUpdatedMessage`/`PluginSkippedMessage`/`PluginFailedMessage` rows).
 */
export async function updatePlugins(opts: UpdatePluginsOptions): Promise<void> {
  const { ctx, pi, cwd, target, scope: explicitScope } = opts;
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;

  let targets: readonly ResolvedTarget[];
  try {
    targets = await enumerateTargets(opts);
  } catch (err) {
    // WR-05: the previous code path assumed `target.kind !== "all"` was the
    // only reachable failure mode (the comment claimed "the bare form never
    // throws here"), but `enumerateTargets` for the bare form calls
    // `loadState` for both scopes and propagates any I/O / schema-validation
    // throw. When the bare form throws, the synthetic identity collapsed
    // onto the literal string `"(targets)"` returned by
    // `targetMarketplaceName` -- producing a user-visible row reading
    // `⊘ (targets) (failed)...` under a marketplace block named
    // `(targets)`. Hardcoding `scope: "project"` as the default also did
    // not necessarily match the scope whose state.json actually failed
    // to load.
    //
    // Split the failure path on `target.kind`:
    //  - `marketplace` / `plugin`: the marketplace identity is present
    //  on the target; surface the failure via `notifyDirectFailure`
    //  under the real marketplace name (behavior preserved).
    //  - `all` (bare form): no marketplace identity is available;
    //  surface a marketplace-level failure via the `(no marketplaces)`
    //  sentinel `{ marketplaces: [] }` and a separate explicit-failure
    //  emission carrying just the cause chain. Avoid the misleading
    //  `(targets)` stand-in entirely.
    if (target.kind === "all") {
      notifyBareFormEnumerateFailure({ ctx, pi, scope: explicitScope, err });
      return;
    }

    //  Option B: synthesize a PluginFailedMessage
    // carrying the typed `cause` so the renderer's 4-space cause-chain
    // trailer preserves the error-message text. Reaching
    // here implies `target.kind === "marketplace" | "plugin"` so
    // `target.marketplace` is structurally present.
    //
    // WR-01: when target.kind === "marketplace" (no plugin name) the
    // previous code put the marketplace name in the plugin-row name slot,
    // which renders as `⊘ <marketplace> (failed) {<reason>}` directly
    // underneath a marketplace block ALSO named `<marketplace>` -- a
    // redundant / confusing row. Wrap the marketplace identity in parens
    // when used as a synthetic plugin-row name (mirroring the bare-form
    // SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)" precedent) so the
    // row reads `⊘ (<marketplace>) (failed) {<reason>}` and is visually
    // distinguishable from the surrounding mp header.
    notifyDirectFailure({
      ctx,
      pi,
      marketplace: target.marketplace,
      // No state.json was read yet, so explicit scope is the best fact
      // available; default to "project" when omitted (matches the enumerate
      // failure mode where `not found in <explicitScope> scope.` was the
      // user-facing text).
      scope: explicitScope ?? "project",
      pluginName: target.kind === "plugin" ? target.plugin : `(${target.marketplace})`,
      err,
    });
    return;
  }

  if (targets.length === 0) {
    // empty-targets success mirrors 's
    // empty-targets shape -- `marketplaces: []` round-trips through notify
    // to the (no marketplaces) sentinel. Severity: undefined. No reload-hint.
    notify(ctx, pi, { marketplaces: [] });
    return;
  }

  // PUP-2 syncCloneOnce memoization -- per (scope, marketplace) pair.
  // Path-source marketplaces are noops (NFR-5: no network for path sources).
  // GitHub-source marketplaces refresh via gitOps.fetch + forceUpdateRef + checkout
  // (D-14 sequence). syncCloneOnce throws on git-side failures.
  const synced = new Set<string>();
  const syncCloneOnce = async (
    scope: Scope,
    mpName: string,
    locations: ScopedLocations,
  ): Promise<void> => {
    const key = `${scope}/${mpName}`;
    if (synced.has(key)) {
      return;
    }

    synced.add(key);

    const state = await loadState(locations.extensionRoot);
    const mp = state.marketplaces[mpName];
    if (mp === undefined) {
      throw new Error(`Marketplace "${mpName}" not found in ${scope} scope.`);
    }

    const source = mp.source as ParsedSource;
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(mpName);
      await refreshGitHubClone(cloneDir, source.ref, gitOps);
    }
    // path-source: NFR-5 noop. The manifest is re-read per-plugin below.
  };

  // Pair each outcome with its target so the cascade renderer can group
  // by (scope, marketplace) per CMC-21 (per-scope rendering, no collapse).
  // The bare update across multiple scopes / marketplaces becomes one
  // cascade block per (scope, marketplace) pair.
  const outcomes: { readonly target: ResolvedTarget; readonly outcome: PluginUpdateOutcome }[] = [];
  for (const t of targets) {
    try {
      await syncCloneOnce(t.scope, t.marketplace, t.locations);
    } catch (err) {
      // Pre-3-phase error (D-14 step failure or marketplace-missing): surface
      // via a single notify with a synthetic PluginFailedMessage carrying
      // the typed cause (Option B). Abort the whole
      // batch -- a syncClone failure means we cannot read the refreshed
      // manifest for ANY plugin in that marketplace and the rest of the
      // batch is suspect. The renderer composes the 4-space cause-chain
      // trailer.
      notifyDirectFailure({
        ctx,
        pi,
        marketplace: t.marketplace,
        scope: t.scope,
        // The marketplace is implicated but no single plugin "caused" the
        // syncClone failure; use the marketplace name as the synthetic
        // failed-row identity (Option B) so the cause-chain trailer renders.
        pluginName: t.marketplace,
        err,
      });
      return;
    }

    let outcome: PluginUpdateOutcome;
    try {
      outcome = await runThreePhaseUpdate({
        plugin: t.plugin,
        marketplace: t.marketplace,
        scope: t.scope,
        cwd,
        locations: t.locations,
        cascade: false,
        ctx,
        // thread `pi` for the phase-3a aggregate
        // direct-path notify invocation inside runThreePhaseUpdate.
        // Cascade mode leaves `pi` undefined (the cascade orchestrator
        // owns its own notify call).
        pi,
        // AG-7 opt-in: thread `--map-model` from the user-facing options
        // bag into the per-plugin 3-phase swap. The cascade entrypoint
        // (`updateSinglePlugin`) intentionally never sets this -- it
        // resolves to false at the bridge call site so cascade re-installs
        // always omit `model:`.
        mapModel: opts.mapModel ?? false,
      });
    } catch (err) {
      // PUP-9 direct path: phase-2-or-earlier throws (including PI-14
      // PathContainmentError, ST-9 stale-version, prep-phase errors) surface
      // via a single notify with a synthetic PluginFailedMessage
      // carrying the typed cause (Option B). The
      // renderer composes the 4-space cause-chain trailer.
      // Abort the batch -- the plugin's resources may be in an unknown
      // state and continuing risks compounding the failure.
      notifyDirectFailure({
        ctx,
        pi,
        marketplace: t.marketplace,
        scope: t.scope,
        pluginName: t.plugin,
        err,
      });
      return;
    }

    // CR-01: phase-3a aggregate failures already fire `notifyDirectFailure`
    // inline from `runThreePhaseUpdate` (with `reasonOverride: "rollback
    // partial"` and the structural `rollbackPartial[]` children). We must
    // skip pushing the failing plugin into `outcomes` so the cascade
    // renderer does NOT re-render the same failure via
    // `outcomeToCascadePluginMessage`'s failed arm (which would produce
    // a duplicate notification for the failing plugin). But earlier
    // plugins in the same batch that succeeded already committed state
    // to disk via their own `withStateGuard` closures; suppressing the
    // cascade for them entirely would leave the on-disk state and the
    // user-visible report divergent (successful #1-#3 updates invisible
    // when #4 hits phase-3a). Instead, emit the cascade for the
    // already-accumulated successful outcomes and abort the batch.
    //
    // Phase-3a aggregates are distinguishable from phase-2-or-earlier
    // failures by the presence of `phaseFailures` on the returned outcome
    // (only the aggregate path populates it). Phase-2-or-earlier failures
    // throw and are handled by the `catch` block above, never reaching
    // this branch.
    if (isPhase3aAggregateFailure(outcome)) {
      renderUpdateCascadeIfAny(ctx, pi, outcomes);
      return;
    }

    outcomes.push({ target: t, outcome });
  }

  renderUpdateCascadeAndNotify(ctx, pi, outcomes);
}

/**
 * CR-01 predicate: discriminates phase-3a aggregate failures (which carry
 * a populated `phaseFailures` array and have already fired their own
 * direct-path notify) from phase-2-or-earlier failures (which throw and
 * are handled by the `catch` block in the enclosing batch loop).
 */
function isPhase3aAggregateFailure(outcome: PluginUpdateOutcome): boolean {
  return outcome.partition === "failed" && outcome.phaseFailures !== undefined;
}

/**
 * CR-01 helper: emit the cascade notification ONLY when at least one
 * outcome accumulated. Empty accumulators skip the call so we do not
 * emit an empty-marketplaces sentinel after a phase-3a abort.
 */
function renderUpdateCascadeIfAny(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
): void {
  if (outcomes.length > 0) {
    renderUpdateCascadeAndNotify(ctx, pi, outcomes);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSinglePlugin -- PluginUpdateFn impl (cascade-safe; NEVER throws)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D-09 corollary: ships the `PluginUpdateFn` impl reserved by D-05.
 *  wires this into the marketplace autoupdate cascade.
 *
 * Cascade-safe contract: this function NEVER throws. All errors (including
 * PathContainmentError, ST-9 stale-version, prep failures, phase-3a aggregate
 * failures) are captured into `partition='failed'` outcomes. PUP-9.
 */
export const updateSinglePlugin: PluginUpdateFn = async (plugin, marketplace, scope) => {
  // The cascade signature does not carry `cwd`; we default to process.cwd
  // because the cascade is invoked from a marketplace orchestrator that
  // already operates in the user's session cwd. wiring may add a
  // dependency-injection seam if needed.
  const cwd = process.cwd();
  const locations = locationsFor(scope, cwd);

  try {
    return await runThreePhaseUpdate({
      plugin,
      marketplace,
      scope,
      cwd,
      locations,
      cascade: true,
    });
  } catch (err) {
    // Cascade-safe: capture throws into a partition='failed' outcome so the
    // marketplace cascade can continue aggregating outcomes across plugins
    // without aborting the whole batch. `notes` is consumed outside the
    // notify path so the MSG-CC-1 trailer is composed inline here.
    //
    // Pre-narrow to a closed-set `Reason` so the cascade consumer reads
    // `outcome.reasons[0]` directly. Only `PluginShapeError` (from
    // `requireInstallable` during preflight) is recognized; other errors
    // leave `reasons` undefined and the consumer falls back to substring-narrow.
    const typedReasons = reasonsFromTypedError(err);
    const base: PluginUpdateOutcome = {
      partition: "failed",
      name: plugin,
      notes: [composeErrorWithCauseChain(err)],
      // CMC-13: required booleans on every
      // PluginUpdateOutcome partition. `(failed)` rows do NOT render
      // the soft-dep marker (MSG-SD-3), so the value is `false`.
      declaresAgents: false,
      declaresMcp: false,
    };
    return typedReasons === undefined ? base : { ...base, reasons: typedReasons };
  }
};

/**
 * Map a typed error to a closed-set `Reason[]` for cascade-failure outcomes.
 * Returns `undefined` when no recognized typed error is present; the consumer
 * then falls back to substring-narrowing on `notes`. Only `PluginShapeError`
 * carries enough structure to map directly.
 */
function reasonsFromTypedError(err: unknown): readonly Reason[] | undefined {
  if (err instanceof PluginShapeError) {
    // switch on `err.shape.kind` for compile-time
    // exhaustiveness against the typed discriminated union.
    switch (err.shape.kind) {
      case "no-longer-installable":
        return ["no longer installable"] as const;
      case "not-installable":
        // Cascade-path version: a not-installable throw from a CASCADE
        // update means the source classification changed since install;
        // we still surface as `"no longer installable"` because the
        // cascade-row catalog form is `(failed) {no longer installable}`.
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" should not happen at runtime
        // (the cascade walks installed plugins only); map to `"not in
        // manifest"` as the documented permissive fallback.
        return ["not in manifest"] as const;
    }
  }

  // errno-bearing FS errors map to the matching
  // closed Reason instead of falling through to the consumer's
  // legacy notes-substring parse (which would land on the permissive
  // `not in manifest` default for both narrowSkipReasons and
  // narrowFailReasons).
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared 3-phase swap implementation
// ─────────────────────────────────────────────────────────────────────────────

interface ThreePhaseArgs {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /**
   * PUP-9 routing flag. `true` for the cascade path (caller is
   * `updateSinglePlugin`); `false` for the direct path (caller is
   * `updatePlugins`). Decides whether phase-3a aggregate-error rendering
   * emits a failed row for the direct path (cascade leaves notification
   * to the marketplace orchestrator).
   */
  readonly cascade: boolean;
  /**
   * Direct-path-only notification surface. Undefined in cascade mode.
   * When defined AND phase-3a aggregates failures, this is used for the
   * direct-path notify fire. Phase-2-or-earlier throws propagate to
   * the caller who does its own notify (so this field is only consulted
   * at the phase-3 aggregate-error step).
   */
  readonly ctx?: ExtensionContext;
  /**
   * Direct-path-only ExtensionAPI handle. Required alongside `ctx` for the
   * single softDepStatus(pi) probe per notify invocation.
   * Undefined in cascade mode; the cascade orchestrator (marketplace
   * autoupdate) owns its own notify invocation.
   */
  readonly pi?: ExtensionAPI;
  /**
   * AG-7 opt-in. Set by `updatePlugins` from `UpdatePluginsOptions.mapModel`
   * (which the edge handler populates from `--map-model`). The cascade
   * entrypoint `updateSinglePlugin` intentionally NEVER sets this -- the
   * `PluginUpdateFn` cascade signature has no flag, and cascade-driven
   * re-installs must always use the omit-by-default behavior so they
   * don't override the user's Pi default model with whatever the
   * upstream agent declares. Resolves to false at the bridge call site
   * via `args.mapModel ?? false` in `prepareUpdateHandles`.
   */
  readonly mapModel?: boolean;
}

interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}

interface PluginPreflight {
  readonly state: ExtensionState;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
  readonly entry: PluginEntry;
  readonly installable: ResolvedPluginInstallable;
  readonly fromVersion: string;
  readonly toVersion: string;
}

async function preflightUpdate(
  args: ThreePhaseArgs,
): Promise<PluginPreflight | PluginUpdateOutcome> {
  const { plugin, marketplace, scope, locations } = args;
  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    // Pre-narrow to a closed-set Reason so the cascade consumer reads it
    // directly instead of regex-parsing `notes`.
    //
    // required `boolean` predicates -- skipped
    // outcomes do NOT render the soft-dep marker (MSG-SD-3), so the
    // value is `false`. Repeated on every static-skipped return below.
    return {
      partition: "skipped",
      name: plugin,
      notes: [`marketplace "${marketplace}" not found in ${scope} scope`],
      reasons: ["not in manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // UXG-08 / D-29-08/09: consult the marketplace manifest BEFORE concluding
  // "not installed". `loadCachedMarketplaceManifest` is the cached path (also
  // used below for the installed-but-absent case), so moving the load up adds
  // no net I/O. A plugin absent from BOTH state and manifest is a typo /
  // nonexistent name -- it must classify as `(failed) {not in manifest}` like
  // `install`, not the misleading `(skipped) {not installed}` that the
  // installed-state-first ordering produced.
  const manifest = await loadCachedMarketplaceManifest(mp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);

  const record = mp.plugins[plugin];
  if (record === undefined) {
    if (entryRaw === undefined) {
      // Not installed AND absent from the manifest -> failed {not in manifest}
      // (matches install.ts's `not-in-manifest` arm). No `fromVersion` since
      // there is no install record to read a version from.
      return {
        partition: "failed",
        name: plugin,
        notes: ["not in manifest"],
        reasons: ["not in manifest"] as const,
        declaresAgents: false,
        declaresMcp: false,
      };
    }

    // In the manifest but not installed -> skipped {not installed}
    // (preserved behavior). No manifest-entry validation is needed here
    // because we return early without resolving the entry.
    return {
      partition: "skipped",
      name: plugin,
      notes: ["not installed"],
      reasons: ["not installed"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  if (entryRaw === undefined) {
    // Installed but no longer listed in the refreshed manifest -> skipped
    // {not in manifest} with the recorded `fromVersion` (preserved behavior).
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["not in manifest"],
      reasons: ["not in manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["entry failed schema validation"],
      reasons: ["invalid manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  const entry: PluginEntry = entryRaw;
  let installable: ResolvedPluginInstallable;
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
    requireInstallable(resolved, "update");
    installable = resolved;
  } catch (err) {
    // `requireInstallable` throws `PluginShapeError` with
    // `kind === "no-longer-installable"`. Pre-narrow to the closed Reason
    // so the cascade row renders `(skipped) {no longer installable}`
    // without substring-matching. `resolveStrict` itself never throws
    // (returns a not-installable variant), so the only
    // typed-throw producer in this block is `requireInstallable`.
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: [errorMessage(err)],
      reasons: ["no longer installable"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  const fromVersion = record.version;
  const toVersion = await resolvePluginVersion(entry, installable);
  if (toVersion === fromVersion) {
    // `(unchanged)` rows do not render the soft-dep marker either.
    return {
      partition: "unchanged",
      name: plugin,
      fromVersion,
      toVersion,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  return { state, record, entry, installable, fromVersion, toVersion };
}

function isOutcome(value: PluginPreflight | PluginUpdateOutcome): value is PluginUpdateOutcome {
  return "partition" in value;
}

async function prepareUpdateHandles(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  agentsSourceDir: string | null,
): Promise<PrepHandles> {
  const { plugin, marketplace, cwd, locations } = args;
  const { installable, record } = preflight;
  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const handles: Partial<PrepHandles> = {};

  try {
    handles.skills = await prepareStageSkills({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousSkillNames: record.resources.skills,
    });
    handles.commands = await prepareStageCommands({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousCommandNames: record.resources.prompts,
    });
    handles.agents = await prepareStagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      agentsSourceDir,
      // AG-7 opt-in: forward the direct-path `--map-model` setting. The
      // cascade entrypoint never sets `args.mapModel`, so cascade re-
      // installs always resolve to false (omit `model:`).
      mapModel: args.mapModel ?? false,
    });
    handles.mcp = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: marketplace,
      pluginName: plugin,
      servers: installable.mcpServers,
      sourcePath: `${installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    throw appendLeaks(err, await abortPartialHandles(handles));
  }

  return handles as PrepHandles;
}

async function abortPartialHandles(handles: Partial<PrepHandles>): Promise<(string | undefined)[]> {
  const leaks: (string | undefined)[] = [];
  if (handles.mcp !== undefined) {
    abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    leaks.push(await abortPreparedAgents(handles.agents));
  }

  if (handles.commands !== undefined) {
    await abortPreparedCommands(handles.commands);
  }

  if (handles.skills !== undefined) {
    await abortPreparedSkills(handles.skills);
  }

  return leaks;
}

async function abortHandles(handles: PrepHandles): Promise<(string | undefined)[]> {
  abortPreparedMcp(handles.mcp);
  const leaks = [await abortPreparedAgents(handles.agents)];
  await abortPreparedCommands(handles.commands);
  await abortPreparedSkills(handles.skills);
  return leaks;
}

async function swapStateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { installable, fromVersion, toVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
    }

    if (sRecord.version !== fromVersion) {
      throw new Error(
        `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
      );
    }

    sRecord.version = toVersion;
    sRecord.resources = {
      skills: handles.skills.result.recorded.map((r) => r.generatedName),
      prompts: handles.commands.result.recorded.map((r) => r.generatedName),
      agents: handles.agents.result.recorded.map((r) => r.generatedName),
      mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
    };
    sRecord.compatibility = {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    };
    sRecord.resolvedSource = installable.pluginRoot;
    sRecord.updatedAt = new Date().toISOString();
  });
}

async function runThreePhaseUpdate(args: ThreePhaseArgs): Promise<PluginUpdateOutcome> {
  const { plugin, marketplace, scope } = args;

  // ─── Pre-phase: resolve current vs new (PUP-3/4/5 short-circuits) ─────────

  const preflight = await preflightUpdate(args);
  if (isOutcome(preflight)) {
    return preflight;
  }

  const { installable, fromVersion, toVersion } = preflight;

  // ─── : prepare into tmp ────────────────────────────────────────────
  //
  // Bridge prepare* writes only under <extensionRoot>/<bridge>-staging/<uuid>/.
  // Sequential ordering -- skills -> commands -> agents -> mcp -- matches
  //  D-03 PU-1 order, but mcp's "prepare" is in-memory only (it
  // materializes the merged doc; commit writes mcp.json atomically).
  //
  // PI-6 cross-plugin guard: re-check generated names against the SAME-SCOPE
  // state EXCLUDING this plugin's currently-recorded resources -- updating
  // your own plugin against your own state must not count as cross-plugin
  // conflict (a plugin updating its skill names from {a,b} -> {a,c} would
  // otherwise self-conflict on "a").

  const generatedNames = await discoverGeneratedNames(plugin, installable);
  const stateForGuard = removePluginRecord(preflight.state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);
  const handles = await prepareUpdateHandles(args, preflight, generatedNames.agentsSourceDir);

  // ─── : state-guard swap (with old-resource snapshot) ───────────────
  //
  // ST-9 stale-version check INSIDE the closure: if another process updated
  // this plugin between our pre-phase load and the guard's fresh load,
  // record.version !== fromVersion -> throw. The guard does NOT save (ST-7).
  //
  // The closure mutates the plugin record in-place; the guard atomically
  // saves on no-throw. After the guard returns successfully, state.json on
  // disk reflects the NEW version + NEW resources; phase 3a then performs
  // the physical replace -- bridge commits write under <scopeRoot>/agents/,
  // <extensionRoot>/resources/skills/, etc.

  try {
    await swapStateRecord(args, preflight, handles);
  } catch (err) {
    //  failure: abort all prep handles + rethrow.
    throw appendLeaks(err, await abortHandles(handles));
  }

  // ─── Phase 3a: physical replace; aggregate failures across bridges ────────
  //
  // D-03 discipline: CONTINUE across bridge-commit failures (not fail-fast)
  // so the partial-replace state is fully observed. Phase3Failure entries
  // carry per-bridge cause references; the aggregate error wraps them.
  //
  // The four commits run in skills -> commands -> agents -> mcp order
  // (matching install's PI-9 order). Each commit is independently atomic
  // at the OS level (rename for skills/commands/agents; atomicWriteJson
  // for mcp).

  const phase3aFailures: Phase3Failure[] = [];

  try {
    const leak = await commitPreparedSkills(handles.skills);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedCommands(handles.commands);
  } catch (err) {
    phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
  }

  try {
    const leak = await commitPreparedAgents(handles.agents);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "agents",
        msg: `agents staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "agents", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedMcp(handles.mcp);
  } catch (err) {
    phase3aFailures.push({ phase: "mcp", msg: errorMessage(err), cause: err });
  }

  // ─── Phase 3b: aggregate error path with recovery hint, OR success ────────

  if (phase3aFailures.length > 0) {
    const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
    const aggregateMsg = `Plugin "${plugin}" update failed during physical replace. ${recoveryHint}`;
    const firstCause = phase3aFailures[0]?.cause;
    const aggregate = new PluginUpdatePhase3Error(
      aggregateMsg,
      phase3aFailures,
      aggregateCause(firstCause),
    );
    // PUP-9 direct path: surface the aggregate failure via a single
    // notify with a synthetic PluginFailedMessage carrying the typed
    // cause (Option B). Per the catalog UAT fixture
    // `failed-with-rollback-partial` (docs/output-catalog.md:510-522) the
    // renderer composes the 4-space cause-chain trailer beneath the
    // failed plugin row. The cascade is NOT re-rendered here -- aborting
    // before the cascade walk means there's exactly one row to surface.
    // NB: the renderer does NOT walk phase3aFailures structurally here
    // (rollbackPartial is the structural channel for that, but the
    // direct-path aggregate is itself a single failure summary; the
    // returned `partition: "failed"` outcome below provides the cascade
    // shape when reached through the cascade pathway).
    if (isDirectUpdate(args) && args.ctx !== undefined && args.pi !== undefined) {
      notifyDirectFailure({
        ctx: args.ctx,
        pi: args.pi,
        marketplace: args.marketplace,
        scope: args.scope,
        pluginName: args.plugin,
        err: aggregate,
        // Phase-3a aggregate failures map to the catalog "rollback partial"
        // reason form. Thread the per-phase rollback children structurally
        // so the renderer emits the indented 4-space child rows + 6-space
        // per-phase cause-chains.
        reasonOverride: "rollback partial" as const,
        rollbackPartial: phase3aFailures,
      });
    }

    // CMC-17 / MSG-RP-1: surface phaseFailures structurally
    // so the cascade renderer can build the rollback-partial parent +
    // indented children block. notes[] is retained for outcome-level text
    // aggregation (consumed by outcomeOnly callers and the cascade
    // post-render trailer).
    return {
      partition: "failed",
      name: plugin,
      fromVersion,
      toVersion,
      notes: [aggregateMsg, ...phase3aFailures.map((f) => `${f.phase}: ${f.msg}`)],
      // Pre-narrow to `{rollback partial}` -- phase-3 aggregate failures
      // always render as `(failed) {rollback partial}` per the catalog
      // (docs/output-catalog.md). The local `outcomeToCascadePluginMessage`
      // short-circuits on `phaseFailures.length
      // > 0` and ignores `reasons`; the marketplace cascade consumer
      // reads `reasons[0]` directly.
      reasons: ["rollback partial"] as const,
      phaseFailures: phase3aFailures.map((f) => ({ phase: f.phase, msg: f.msg })),
      // required `boolean`. `(failed)` rows do
      // not render the soft-dep marker.
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // Success: WR-04 fields populated for cascade-side RH-5 composition.
  // CMC-13: declaresAgents / declaresMcp predicate inputs
  // mirror reinstall's effective-state contract (declares iff actually
  // staged this update). The renderer probes companion-loaded state via
  // SoftDepProbe and emits `{requires pi-subagents}` / `{requires pi-mcp}`
  // iff (declares AND unloaded).
  const stagedAgents = handles.agents.result.recorded.map((r) => r.generatedName);
  const stagedMcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
  await dropPluginCompletionCache(args);
  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgents,
    stagedMcpServers,
    declaresAgents: stagedAgents.length > 0,
    declaresMcp: stagedMcpServers.length > 0,
  };
}

async function dropPluginCompletionCache(args: ThreePhaseArgs): Promise<void> {
  try {
    await dropMarketplaceCache(
      await args.locations.pluginCacheFile(args.marketplace),
      args.scope,
      args.marketplace,
    );
  } catch {
    //  precedent (lineage): direct-path completion-cache-refresh
    // warnings are swallowed silently The cache-refresh side effect
    // still fires above; only the user-visible standalone-mode warning
    // surface is gone. The orchestrated/cascade path is unaffected by
    //  (no separate warning emission in cascade mode).
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade construction (CMC-26). notify()'s content-derived severity and
// reload-hint drive the dispatch; the renderer in shared/notify.ts owns every
// rendering concern (icon, version arrow, reasons brace, reload-hint,
// rollback-partial children).
// ─────────────────────────────────────────────────────────────────────────────

interface TargetedOutcome {
  readonly target: ResolvedTarget;
  readonly outcome: PluginUpdateOutcome;
}

/**
 * Map an outcome to a `PluginNotificationMessage`. Returns `undefined`
 * for outcomes the cascade should skip rendering entirely (currently
 * none -- the `unchanged` partition maps to a `(skipped) {up-to-date}`
 * cascade row per the catalog).
 *
 * Per-partition mapping (mirrors marketplace/update.ts:446 precedent):
 *  - updated -> PluginUpdatedMessage ({ from, to, dependencies })
 *  - unchanged -> PluginSkippedMessage (reasons: ["up-to-date"])
 *  - skipped -> PluginSkippedMessage (reasons from producer or notes-fallback)
 *  - failed -> PluginFailedMessage (reasons + cause? + rollbackPartial?)
 *
 * Plugin scope is forwarded so the renderer's orphan-fold
 * can suppress the redundant `[<scope>]` bracket when plugin.scope ===
 * mp.scope.
 */
function outcomeToCascadePluginMessage(
  target: ResolvedTarget,
  outcome: PluginUpdateOutcome,
): PluginNotificationMessage {
  switch (outcome.partition) {
    case "updated":
      return {
        status: "updated",
        name: outcome.name,
        scope: target.scope,
        from: outcome.fromVersion,
        to: outcome.toVersion,
        // declared kinds drive the renderer-time soft-dep
        // marker (MSG-SD-3). The renderer narrows on `dependencies`
        // membership + the notify-time probe.
        dependencies: outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp),
      };
    case "unchanged":
      // Catalog `all-up-to-date-noop` (docs/output-catalog.md:528-532):
      // unchanged renders as `(skipped) {up-to-date}`. severity for
      // skipped is `warning` (consistent with the existing
      // CMC-26 dispatch ternary's `aggregatedSeverity` behavior).
      return {
        status: "skipped",
        name: outcome.name,
        scope: target.scope,
        reasons: ["up-to-date"],
      };
    case "skipped": {
      // Producer-narrowed `outcome.reasons` (CR-06) takes precedence over
      // the legacy notes-substring parse; empty `reasons` opts into the
      // back-compat fallback path.
      const reasons =
        outcome.reasons.length > 0 ? outcome.reasons : narrowSkipReasons(outcome.notes);
      return {
        status: "skipped",
        name: outcome.name,
        scope: target.scope,
        ...(outcome.fromVersion !== undefined &&
          outcome.fromVersion !== "" && { version: outcome.fromVersion }),
        reasons,
      };
    }

    case "failed": {
      const phaseFailures = outcome.phaseFailures ?? [];
      const hasPhaseFailures = phaseFailures.length > 0;
      const reasons: readonly Reason[] = hasPhaseFailures
        ? (["rollback partial"] as const)
        : (outcome.reasons ?? narrowFailReasons(outcome.notes));
      //  carve-out: PluginFailedMessage has NO `from`/`to` fields
      // (only the `updated` variant carries them). The renderer emits at
      // most the bare `version?` token, so we surface only the
      // pre-update version (`fromVersion`) when available -- the catalog
      // form `failed-with-rollback-partial` (510-522) renders
      // `⊘ delta v1.0.0 (failed) {rollback partial}` using the old
      // version.
      const version = outcome.fromVersion;
      const base: PluginFailedMessage = {
        status: "failed",
        name: outcome.name,
        scope: target.scope,
        reasons,
        ...(version !== undefined && version !== "" && { version }),
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
      };
      if (!hasPhaseFailures) {
        return base;
      }

      // Catalog `failed-with-rollback-partial` (docs/output-catalog.md:510-522):
      // the renderer composes ` [<phase>] (rollback failed)` at 4-space
      // indent followed by the optional 6-space-indent per-phase cause-chain
      // . `UpdatePhaseFailure` carries `msg: string` (and the
      // underlying `Phase3Failure.cause` carries an `unknown` cause); the
      // outcome's `phaseFailures` is pre-narrowed to `{phase, msg}` only,
      // so synthesize an Error from the typed msg to feed the cause-chain
      // walker caveat fallback.
      return {
        ...base,
        rollbackPartial: phaseFailures.map((p) => ({
          phase: p.phase,
          // `UpdatePhaseFailure` discards the original `Phase3Failure.cause`
          // (it's typed `unknown` and never threaded into the outcome
          // shape); synthesize a typed Error from `msg` so the renderer's
          // 6-space-indent cause-chain walker has structured input.
          ...(p.msg !== "" && { cause: new Error(p.msg) }),
        })),
      };
    }

    default:
      // exhaustiveness guard for PluginUpdateOutcome's
      // discriminated union; any future partition must update this switch.
      return assertNever(outcome);
  }
}

/** Derive the v2 Dependency[] tuple from the outcome's declared kinds. */
function outcomeDependencies(declaresAgents: boolean, declaresMcp: boolean): readonly Dependency[] {
  return [
    ...(declaresAgents ? (["agents"] as const) : []),
    ...(declaresMcp ? (["mcp"] as const) : []),
  ];
}

/**
 * Build the cascade payload and emit via a single notify(ctx, pi, ...) call.
 *
 * Marketplace blocks are grouped by (scope, marketplace) per CMC-21 and
 * sorted via compareByNameThenScope before emission so the renderer's
 * caller-order honored discipline preserves alphabetic ordering.
 *
 * Severity (`error` / `warning` / info) is computed by notify per
 * ; reload-hint trailer is appended by notify; the
 * per-row soft-dep marker is injected by the renderer
 * . Orchestrator MUST NOT compose any of these.
 */
function renderUpdateCascadeAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
): void {
  // Group by (scope, marketplace) per CMC-21. Insertion order tracks the
  // first occurrence of each (scope, marketplace) pair -- the post-grouping
  // sort below restores alphabetic-by-name then project-before-user
  // (MSG-GR-3) ordering across marketplaces, while plugin rows within a
  // marketplace stay in caller order.
  interface MpGroup {
    readonly name: string;
    readonly scope: Scope;
    readonly plugins: PluginNotificationMessage[];
  }
  const byMp = new Map<string, MpGroup>();
  for (const { target, outcome } of outcomes) {
    const key = `${target.scope}:${target.marketplace}`;
    // WR-01: mirror the reinstall.ts:597-610 get-existing-or-construct-new
    // shape so the in-place mutation invariant does not rely on the
    // get-then-conditional-set pattern (which was correct but obscured the
    // intent -- a future refactor that converted the conditional set to an
    // unconditional one would silently break the second-iteration mutation
    // path).
    const existing = byMp.get(key);
    if (existing === undefined) {
      byMp.set(key, {
        name: target.marketplace,
        scope: target.scope,
        plugins: [outcomeToCascadePluginMessage(target, outcome)],
      });
    } else {
      existing.plugins.push(outcomeToCascadePluginMessage(target, outcome));
    }
  }

  // Sort marketplace blocks via compareByNameThenScope (orchestrator
  // controls iteration order; notify does not sort). The comparator's
  // `Sortable` shape requires only `name` + `scope`.
  const marketplaces: MarketplaceNotificationMessage[] = [...byMp.values()]
    .sort((a, b) =>
      compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
    )
    .map((g) => ({
      name: g.name,
      scope: g.scope,
      plugins: g.plugins,
    }));

  // cascade construction recipe (mirrors pilot at
  // orchestrators/plugin/uninstall.ts; substitutes the
  // version-arrow cascade variant set).
  // - One MarketplaceNotificationMessage per affected (scope, marketplace)
  //  group, emitted via a single notify(ctx, pi,...) call per
  //  orchestration.
  // - plugins: readonly PluginNotificationMessage[] carries the
  //  PluginUpdatedMessage (status "updated" with required from/to per
  // ) / PluginSkippedMessage (status "skipped" with required
  //  reasons) / PluginFailedMessage (status "failed" with required
  //  reasons + optional cause + optional rollbackPartial) variants.
  //  The renderer composes the version-arrow `<from> → v<to>` with the
  //  asymmetric `v` prefix on `to` only per docs/output-catalog.md:499.
  // - Severity and `/reload to pick up changes` trailer are computed by
  //  notify from the variant set.
  // - Reference: catalog UAT plugin-update fixtures at
  //  docs/output-catalog.md:489-568 (single-mp-mixed, failed-with-
  //  rollback-partial, all-up-to-date-noop, bare-multi-mp,
  //  same-mp-both-scopes).
  notify(ctx, pi, { marketplaces });
}

// ─────────────────────────────────────────────────────────────────────────────
// direct-path failure helper. The direct-path failure sites
// (enumerate-targets / syncCloneOnce / runThreePhaseUpdate / phase-3
// aggregate) consolidate through this helper. Per Option B, each
// site emits a synthetic PluginFailedMessage carrying the typed `cause`
// so the renderer composes the 4-space cause-chain trailer.
// ─────────────────────────────────────────────────────────────────────────────

interface NotifyDirectFailureArgs {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly pluginName: string;
  readonly err: unknown;
  /**
   * Optional override that pins the closed-set Reason on the synthetic
   * PluginFailedMessage. Used by the phase-3 aggregate path where the
   * `"rollback partial"` reason is the catalog form (510-522). Omitted
   * for direct-path enumerate / syncClone / phase-2 failures, which
   * route through `narrowDirectFailReason` for a best-fit Reason from
   * the typed error.
   */
  readonly reasonOverride?: Reason;
  /**
   * Optional per-phase rollback children. Threaded only by the phase-3
   * aggregate path. Each entry's `msg` is wrapped in a synthesized Error
   * so the renderer's 6-space-indent cause-chain walker has structured
   * input (the underlying Phase3Failure.cause is `unknown` and discarded
   * earlier in the pipeline; this preserves the cause-text via the
   * msg field).
   */
  readonly rollbackPartial?: readonly Phase3Failure[];
}

function notifyDirectFailure(args: NotifyDirectFailureArgs): void {
  const { ctx, pi, marketplace, scope, pluginName, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly Reason[] = [args.reasonOverride ?? narrowDirectFailReason(cause)];
  // WR-05: row-level `scope` is OMITTED -- it always matched the
  // marketplace block's `scope` at every callsite below, and
  // `renderScopeBracket` (shared/notify.ts) suppresses the bracket in
  // that case. Aligning on the omit convention (matching uninstall.ts,
  // reinstall.ts, and install.ts's IN-04 commentary at lines 936-944)
  // removes a structural redundancy that diverged from the canonical
  // emission recipe.
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: pluginName,
    reasons,
    cause,
    ...(args.rollbackPartial !== undefined &&
      args.rollbackPartial.length > 0 && {
        rollbackPartial: args.rollbackPartial.map((p) => ({
          phase: p.phase,
          ...rollbackPartialCauseSlot(p),
        })),
      }),
  };
  notify(ctx, pi, {
    marketplaces: [
      {
        name: marketplace,
        scope,
        plugins: [failedRow],
      },
    ],
  });
}

/**
 * Coerce a `Phase3Failure.cause` (typed `unknown`) into the optional
 * `{ cause?: Error }` slot consumed by `PluginFailedMessage.rollbackPartial`.
 * Prefers the typed Error when present; falls back to synthesizing a typed
 * Error from `msg` caveat so the renderer's 6-space-indent
 * cause-chain walker has structured input. Returns the empty object when
 * neither is available (caller spreads it via `...`).
 */
function rollbackPartialCauseSlot(p: Phase3Failure): { readonly cause?: Error } {
  if (p.cause instanceof Error) {
    return { cause: p.cause };
  }

  if (p.msg !== "") {
    return { cause: new Error(p.msg) };
  }

  return {};
}

/**
 * Narrow a direct-path failure's typed error to a closed-set `Reason` for
 * the synthetic `PluginFailedMessage`. Order: instanceof typed errors
 * first, errno-bearing FS errors second, message-substring fallback last.
 * The fallback `"unreadable manifest"` mirrors the marketplace/update.ts
 * narrowFailReason precedent for unknown error shapes.
 */
function narrowDirectFailReason(err: Error): Reason {
  // Phase-3 aggregate failures are surfaced via reasonOverride; here we
  // handle the enumerate / syncClone / phase-2 paths only.
  if (err instanceof PluginShapeError) {
    // IN-03: add `default: assertNever(err.shape)` for compile-time
    // exhaustiveness against the `PluginShapeError.shape.kind`
    // discriminator. Mirrors the install.ts:1155 +
    // outcomeToCascadePluginMessage default-arm precedent. Without this
    // a future 5th shape kind would silently fall through to the errno-
    // substring branch below and surface as `unreadable manifest` --
    // masking a class of errors that should have a precise mapping.
    switch (err.shape.kind) {
      case "no-longer-installable":
      case "not-installable":
        return "no longer installable";
      case "not-in-manifest":
      case "already-installed":
        return "not in manifest";
      default:
        return assertNever(err.shape);
    }
  }

  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM") {
    return "permission denied";
  }

  if (code === "ENOENT" || code === "ENOTDIR") {
    return "source missing";
  }

  // Message-substring fallback. Mirrors marketplace/update.ts:553-580
  // narrowFailReason classification ladder, scoped to the direct-path
  // failure modes (enumerate target / syncClone / phase-2 throw).
  const text = err.message.toLowerCase();
  if (text.includes("not found")) {
    return "not found";
  }

  if (text.includes("rollback")) {
    return "rollback partial";
  }

  if (text.includes("concurrently uninstalled") || text.includes("concurrently removed")) {
    return "concurrently uninstalled";
  }

  if (text.includes("concurrently updated")) {
    return "concurrently updated";
  }

  if (text.includes("network")) {
    return "network unreachable";
  }

  if (text.includes("unparseable") || text.includes("invalid")) {
    return "invalid manifest";
  }

  return "unreadable manifest";
}

/**
 * WR-05: bare-form (`target.kind === "all"`) enumerate-failure emission.
 * Distinct from the marketplace/plugin failure path because the bare
 * form has no marketplace identity to thread into the row; using the
 * marketplace identity slot for a synthetic `"(targets)"` literal
 * produced operator-confusing output (`⊘ (targets) (failed)...` under
 * a marketplace block named `(targets)`).
 *
 * Mirrors the `orchestrators/plugin/reinstall.ts::reinstallPlugins`
 * bare-form enumeration-failure precedent (line 350: synthetic
 * `"(reinstall)"` marketplace name). Use `"(update)"` here so the
 * parens-wrapped form reads to the operator as "synthetic placeholder
 * for the bare-form update orchestration". The scope defaults to the
 * caller's explicit scope when present, else `"user"` -- the choice is
 * cosmetic (no real marketplace exists with this name; the cause-chain
 * trailer carries the diagnostic).
 */
function notifyBareFormEnumerateFailure(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope: Scope | undefined;
  readonly err: unknown;
}): void {
  const { ctx, pi, scope, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly Reason[] = [narrowDirectFailReason(cause)];
  // WR-05: row-level `scope` is OMITTED -- the marketplace block carries
  // the same scope, and `renderScopeBracket` suppresses the per-row
  // bracket in that case. Matches the omit convention used by
  // uninstall.ts / reinstall.ts / install.ts (IN-04).
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
    reasons,
    cause,
  };
  notify(ctx, pi, {
    marketplaces: [
      {
        name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
        scope: scope ?? "user",
        plugins: [failedRow],
      },
    ],
  });
}

/**
 * WR-05: synthetic placeholder for the bare-form enumerate-failure path.
 * Held as a module-level constant so a future change has a single edit
 * point. Mirrors the `"(reinstall)"` precedent in
 * `orchestrators/plugin/reinstall.ts`.
 */
const SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)";

// the legacy version-arrow helper is no longer imported -- the
// renderer (shared/notify.ts) owns version-arrow composition via the
// PluginUpdatedMessage's required from/to fields.

function narrowSkipReasons(notes: readonly string[] | undefined): readonly Reason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowSkipReason(notes[0] ?? "")];
}

function narrowSkipReason(note: string): Reason {
  if (note === "not installed") {
    return "not installed";
  }

  if (note === "not in manifest") {
    return "not in manifest";
  }

  if (note === "up-to-date") {
    return "up-to-date";
  }

  // PUP-4 path: "Plugin "...." is no longer installable: <cause>" -> closed
  // Reason "no longer installable".
  if (note.includes("no longer installable") || note.includes("not installable")) {
    return "no longer installable";
  }

  if (note.includes("entry failed schema validation")) {
    return "invalid manifest";
  }

  return "not in manifest";
}

function narrowFailReasons(notes: readonly string[] | undefined): readonly Reason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowFailReason(notes[0] ?? "")];
}

function narrowFailReason(note: string): Reason {
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  if (note.includes("concurrently uninstalled") || note.includes("concurrently removed")) {
    return "concurrently uninstalled";
  }

  if (note.includes("concurrently updated")) {
    return "concurrently updated";
  }

  return "not in manifest";
}

function aggregateCause(firstCause: unknown): { cause: unknown } | undefined {
  return firstCause === undefined ? undefined : { cause: firstCause };
}

function isDirectUpdate(args: ThreePhaseArgs): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare -- keeps Sonar S7735 from flagging an inverted boolean condition at the callsite.
  return args.cascade === false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
}

async function enumerateTargets(opts: UpdatePluginsOptions): Promise<readonly ResolvedTarget[]> {
  const { cwd, target } = opts;
  const explicitScope = opts.scope;

  if (target.kind === "plugin" || target.kind === "marketplace") {
    return enumerateMarketplaceTarget(cwd, explicitScope, target);
  }

  // bare form: every installed plugin across selected scope(s).
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  const out: ResolvedTarget[] = [];
  for (const sc of scopes) {
    const locations = locationsFor(sc, cwd);
    const state = await loadState(locations.extensionRoot);
    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      for (const p of Object.keys(mp.plugins)) {
        out.push({ plugin: p, marketplace: mpName, scope: sc, locations });
      }
    }
  }

  return out;
}

async function enumerateMarketplaceTarget(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<UpdatePluginsTarget, { kind: "plugin" | "marketplace" }>,
): Promise<readonly ResolvedTarget[]> {
  const mpName = target.marketplace;
  const resolved =
    target.kind === "plugin"
      ? ((await resolveInstalledPluginTarget({
          cwd,
          marketplace: mpName,
          plugin: target.plugin,
          ...(explicitScope !== undefined && { explicitScope }),
        })) ??
        (await resolveInstalledMarketplaceTarget({
          cwd,
          marketplace: mpName,
        })))
      : await resolveInstalledMarketplaceTarget({
          cwd,
          marketplace: mpName,
          ...(explicitScope !== undefined && { explicitScope }),
        });
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[mpName];
  if (mp === undefined) {
    throw new Error(`Marketplace "${mpName}" not found in ${resolved.scope} scope.`);
  }

  if (target.kind === "plugin") {
    return [
      {
        plugin: target.plugin,
        marketplace: mpName,
        scope: resolved.scope,
        locations: resolved.locations,
      },
    ];
  }

  return Object.keys(mp.plugins).map((p) => ({
    plugin: p,
    marketplace: mpName,
    scope: resolved.scope,
    locations: resolved.locations,
  }));
}

async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * PI-6 cross-plugin guard helper. Returns a shallow-cloned state with the
 * (marketplace, plugin) record removed -- so the guard counts this plugin's
 * OWN current resources as "not yet owned" and only catches conflicts
 * against OTHER plugins.
 *
 * Shallow-clone discipline: deep-clone only the bytes the guard reads
 * (marketplaces -> per-mp -> plugins map). Every other branch reference is
 * shared. This keeps the helper cheap on hot paths.
 */
function removePluginRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) {
    return cloned;
  }

  const newPlugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string,...>.
  delete newPlugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins: newPlugins };
  return cloned;
}
