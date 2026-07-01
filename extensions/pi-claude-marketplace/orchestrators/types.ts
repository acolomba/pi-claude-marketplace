// orchestrators/types.ts
//
// Cross-orchestrator types (D-06). Sits at the ROOT of
// `orchestrators/` so marketplace/update.ts and plugin/update.ts both
// import from here without an
// orchestrators/marketplace ↔ orchestrators/plugin cycle. Mirrors
// D-01's escalation note about a future BridgeOps<Prep, Target>
// belonging at this same path.

import type { ContentReason } from "../shared/notify.ts";
import type { Scope } from "../shared/types.ts";

export type ReinstallPluginPartition = "reinstalled" | "skipped" | "failed";

interface ReinstallOutcomeBase {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface ReinstallReinstalledOutcome extends ReinstallOutcomeBase {
  readonly partition: "reinstalled";
  readonly version: string;
  readonly resourcesChanged: boolean;
  readonly stagedAgents: readonly string[];
  readonly stagedMcpServers: readonly string[];
  /**
   * CMC-13: per-row soft-dep predicate inputs. `true` iff
   * the plugin's resolved manifest declared the kind AND it was actually
   * staged at reinstall time (the orchestrator already tracks
   * `stagedAgents.length > 0` / `stagedMcpServers.length > 0` per-outcome;
   * these flags surface them through the typed outcome so cascade rendering
   * (`PluginCascadeRow.declaresAgents` / `.declaresMcp`) consumes the
   * effective-state-at-render-time signal without re-deriving from the
   * stagedAgents / stagedMcpServers arrays at the renderer site).
   *
   * MSG-SD-3: per-row markers fire on `(reinstalled)` rows only. These
   * flags live ONLY on this reinstalled arm; the `(skipped)` and
   * `(failed)` arms do not declare them at all, because the renderer
   * narrows on the partition discriminator and never reads soft-dep flags
   * for those rows.
   *
   * CMC-13: required `boolean` (not `?: boolean`) so every reinstalled
   * outcome producer populates the predicate EXPLICITLY rather than
   * relying on `undefined ~= false`. The closed type enforces the contract
   * at compile time; the `tsc --noEmit` gate catches any forgotten emitter
   * on every CI run.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly notes?: readonly string[];
}

export interface ReinstallSkippedOutcome extends ReinstallOutcomeBase {
  readonly partition: "skipped";
  readonly notes: readonly string[];
}

export interface ReinstallFailedOutcome extends ReinstallOutcomeBase {
  readonly partition: "failed";
  readonly notes: readonly string[];
  /**
   * CMC-16 / CMC-11: structural failure-class tag
   * consumed by `outcomeToCascadePluginMessage`'s closed-set Reason mapping. When the
   * orchestrator catches a `ManualRecoveryError` (thrown by the bridges'
   * leak-on-rollback path), it sets `failureClass: "manual-recovery"` so
   * the cascade row renders `(failed) {rollback partial}` without
   * substring-matching the ES-5 `notes` text. Omitted on
   * non-manual-recovery failures; the cascade renderer falls back to
   * `narrowReason` on `notes` for those.
   */
  readonly failureClass?: "manual-recovery";
  /**
   * pre-narrowed closed-set `Reason[]` produced at
   * the throw/catch site instead of substring-matching the opaque
   * `composeErrorWithCauseChain(err)` text downstream. Mirrors the
   * `PluginUpdateOutcome.reasons` precedent (CR-06 / NFR-7). When
   * present, `outcomeToCascadePluginMessage` prefers `reasons[0]` over
   * `narrowReasons(notes)`; when absent, the substring narrow
   * is used (for fixtures that build outcomes without
   * `reasons`). Populated by the catch in `reinstallPlugins` so an
   * EACCES / EPERM / ENOENT failure renders as the matching closed
   * Reason (`permission denied` / `source missing`) rather than the
   * permissive `not in manifest` default. Typed `ContentReason` (TYPE-02):
   * the structural `not added` marker is never a per-plugin outcome reason.
   */
  readonly reasons?: readonly ContentReason[];
}

export type ReinstallPluginOutcome =
  | ReinstallReinstalledOutcome
  | ReinstallSkippedOutcome
  | ReinstallFailedOutcome;

/** MU-7 partition tag. plugin/update.ts returns one outcome per plugin. */
export type PluginUpdatePartition = "updated" | "unchanged" | "skipped" | "failed";

/**
 * Bridge identifier for `PluginUpdateFailedOutcome.phaseFailures` on the
 * update path. Promoted to a named type so callers and tests don't repeat
 * the literal union inline. (Distinct from the free-form
 * `PluginFailedMessage.rollbackPartial[].phase` label, which also carries the
 * install path's `phase3a` / `phase3b` tokens.)
 */
export type UpdatePhaseBridge = "skills" | "commands" | "agents" | "hooks" | "mcp";

/**
 * CMC-17 / MSG-RP-1: per-phase rollback-partial child
 * carried on the `(failed)` partition when phase-3a aggregation occurred.
 */
export interface UpdatePhaseFailure {
  readonly phase: UpdatePhaseBridge;
  readonly msg: string;
}

interface PluginUpdateBase {
  readonly name: string;
  /**
   * CMC-13: required `boolean` on every partition.
   * The renderer narrows on the partition discriminator (`(updated)` is
   * the only partition that emits the soft-dep marker per MSG-SD-3), but
   * the explicit field keeps every producer honest at compile time.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

/**
 * `(updated)` partition. `fromVersion` and `toVersion`
 * are REQUIRED here -- the orchestrator transitioned the install record
 * from one to the other. `stagedAgents` / `stagedMcpServers` are the
 * names of resources that were actually written during the update
 * (WR-04 / RH-5 input).
 */
export interface PluginUpdateUpdatedOutcome extends PluginUpdateBase {
  readonly partition: "updated";
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly stagedAgents: readonly string[];
  readonly stagedMcpServers: readonly string[];
  /**
   * FSTAT-07 / D-66-04 / SEV-03 / D-69-01: the force-degrade signal for a
   * `--force` update whose candidate re-resolved `unsupported`. Present
   * atomically -- both fields travel together or the whole sub-object is absent
   * -- so a consumer can never see a `newlyDegraded` flag without the `kinds`
   * that make it meaningful. Absent when the candidate resolved fully
   * `installable`; the cascade then renders the normal `(updated)` row.
   *
   * `kinds` are the unsupported component kinds carried on the candidate's
   * `unsupported` resolver arm. Non-empty flips the success row to
   * `(force-installed)` with the dropped-component detail (the same derived
   * signal the list deriver reads), so a force update reports its true realized
   * state.
   *
   * `newlyDegraded` is `true` when this force-degrading update NEWLY degrades a
   * previously-clean plugin -- the plugin's PERSISTED `compatibility.unsupported`
   * was EMPTY before the update applied. Read from the prior install record in
   * `preflightUpdate` (no new tracking, no schema change). The marketplace
   * autoupdate cascade renderer reads it to raise the `(force-installed)` row to
   * `warning` (a silent auto-update degradation is actionable); an
   * already-degraded re-degrade (prior `unsupported` non-empty) stays `info`.
   * The manual `update --force` renderer ignores it -- the explicit opt-in stays
   * info unconditionally (SEV-01), so the warning fires ONLY on the autoupdate
   * surface.
   */
  readonly forceDegrade?: {
    readonly kinds: readonly string[];
    readonly newlyDegraded: boolean;
  };
}

/**
 * `(unchanged)` partition. The resolved version
 * matched the install record version exactly; nothing was written.
 * `fromVersion === toVersion` is documented here on both fields for
 * outcome aggregators that want to display a `vX → vX` slot.
 */
export interface PluginUpdateUnchangedOutcome extends PluginUpdateBase {
  readonly partition: "unchanged";
  readonly fromVersion: string;
  readonly toVersion: string;
}

/**
 * `(skipped)` partition. `fromVersion` is optional --
 * preflight skipped paths (marketplace-missing / record-missing) have no
 * install record to read a version from; the manifest-skipped paths
 * (entry-missing / entry-invalid / no-longer-installable) do. `reasons`
 * is REQUIRED on skipped (one of the closed `not in manifest` /
 * `not installed` / `invalid manifest` / `no longer installable`
 * values). `notes` carries the free-form cause-chain text consumed by
 * the notify trailer.
 *
 * XSURF-03: `forceUpgradable` marks the force-upgradable manual update-decline
 * (the resolver verdict was `unsupported`, so `--force` could degrade-update
 * it). The projection flips ONLY this arm to the `force-upgradable` token; the
 * discriminant is a dedicated field, NOT the reason string, so the degrade
 * reason can carry the list-consistent kinds instead of `no longer
 * installable`. Structural declines (force cannot help) leave it unset.
 */
export interface PluginUpdateSkippedOutcome extends PluginUpdateBase {
  readonly partition: "skipped";
  readonly fromVersion?: string;
  readonly notes: readonly string[];
  readonly reasons: readonly ContentReason[];
  readonly forceUpgradable?: boolean;
}

/**
 * `(failed)` partition. `fromVersion` / `toVersion`
 * are optional -- catch sites that don't have version context (e.g. a
 * marketplace-not-found cascade catch in `cascadeAutoupdates`) leave
 * them undefined. `notes` is REQUIRED (the composed cause-chain text
 * for the notify trailer). `reasons` and `phaseFailures` are optional
 * structured supplements consumed by the cascade renderer; when
 * neither is set the consumer falls back to the notes
 * substring parse.
 *
 * `cause?: Error` carries the raw thrown error
 * (only populated by the cascadeAutoupdates catch where the error is
 * in scope) so the `outcomeToCascadePluginMessage` mapper can attach
 * it to `PluginFailedMessage.cause` for the per-plugin 4-space-indent
 * cause-chain trailer. Producers that don't have the original
 * Error instance (e.g. failed outcomes built by plugin/update.ts) leave
 * this undefined; the renderer simply omits the trailer.
 */
export interface PluginUpdateFailedOutcome extends PluginUpdateBase {
  readonly partition: "failed";
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly notes: readonly string[];
  readonly reasons?: readonly ContentReason[];
  readonly phaseFailures?: readonly UpdatePhaseFailure[];
  readonly cause?: Error;
}

/**
 * Discriminated union on `partition`. The
 * discriminated union makes partition-specific fields (fromVersion /
 * toVersion on updated; phaseFailures on failed) STRUCTURALLY
 * unreachable on the wrong partition, so the renderer cannot read
 * `outcome.fromVersion!` from a skipped outcome without a narrow.
 *
 * Each partition variant carries `declaresAgents` / `declaresMcp` via
 * the shared `PluginUpdateBase` base (CMC-13 required
 * booleans).
 */
export type PluginUpdateOutcome =
  | PluginUpdateUpdatedOutcome
  | PluginUpdateUnchangedOutcome
  | PluginUpdateSkippedOutcome
  | PluginUpdateFailedOutcome;

/**
 * D-05 function-injection seam. (`marketplace update` with
 * `record.autoupdate === true`) calls this once per installed plugin
 * during the autoupdate cascade. `orchestrators/plugin/update.ts` ships
 * the real implementation; tests inject a mock. The
 * `index.ts` barrel performs the registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;
