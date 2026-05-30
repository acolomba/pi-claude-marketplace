// orchestrators/types.ts
//
// Cross-orchestrator types (D-06). Sits at the ROOT of
// `orchestrators/` so (marketplace/update.ts) and
// (plugin/update.ts) both import from here without an
// orchestrators/marketplace ↔ orchestrators/plugin cycle. Mirrors
//  D-01's escalation note about a future BridgeOps<Prep, Target>
// belonging at this same path.

import type { Reason } from "../shared/notify.ts";
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
   * substring-matching the legacy ES-5 `notes` text. Omitted on
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
   * `narrowReasons(notes)`; when absent, the legacy substring narrow
   * is used (back-compat for fixtures that build outcomes without
   * `reasons`). Populated by the catch in `reinstallPlugins` so an
   * EACCES / EPERM / ENOENT failure renders as the matching closed
   * Reason (`permission denied` / `source missing`) rather than the
   * permissive `not in manifest` default.
   */
  readonly reasons?: readonly Reason[];
}

export type ReinstallPluginOutcome =
  | ReinstallReinstalledOutcome
  | ReinstallSkippedOutcome
  | ReinstallFailedOutcome;

/** MU-7 partition tag. 's plugin/update.ts returns one outcome per plugin. */
export type PluginUpdatePartition = "updated" | "unchanged" | "skipped" | "failed";

/**
 * Bridge identifier for `PluginUpdateFailedOutcome.phaseFailures` on the
 * update path. Promoted to a named type so callers and tests don't repeat
 * the literal union inline. (Distinct from the free-form
 * `PluginFailedMessage.rollbackPartial[].phase` label, which also carries the
 * install path's `phase3a` / `phase3b` tokens.)
 */
export type UpdatePhaseBridge = "skills" | "commands" | "agents" | "mcp";

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
 */
export interface PluginUpdateSkippedOutcome extends PluginUpdateBase {
  readonly partition: "skipped";
  readonly fromVersion?: string;
  readonly notes: readonly string[];
  readonly reasons: readonly Reason[];
}

/**
 * `(failed)` partition. `fromVersion` / `toVersion`
 * are optional -- catch sites that don't have version context (e.g. a
 * marketplace-not-found cascade catch in `cascadeAutoupdates`) leave
 * them undefined. `notes` is REQUIRED (the composed cause-chain text
 * for the notify trailer). `reasons` and `phaseFailures` are optional
 * structured supplements consumed by the cascade renderer; when
 * neither is set the consumer falls back to the legacy notes
 * substring parse for back-compat.
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
  readonly reasons?: readonly Reason[];
  readonly phaseFailures?: readonly UpdatePhaseFailure[];
  readonly cause?: Error;
}

/**
 * split into a discriminated union on `partition`
 * (previously a single interface with every field optional). The
 * discriminated union makes partition-specific fields (fromVersion /
 * toVersion on updated; phaseFailures on failed) STRUCTURALLY
 * unreachable on the wrong partition, so the renderer cannot read
 * `outcome.fromVersion!` from a skipped outcome without a narrow.
 *
 * Each partition variant carries `declaresAgents` / `declaresMcp` via
 * the shared `PluginUpdateBase` base (Task B1 / CMC-13 required
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
 * during the autoupdate cascade. ships the real implementation
 * (`orchestrators/plugin/update.ts`); tests inject a mock. 's
 * `index.ts` performs the registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;
