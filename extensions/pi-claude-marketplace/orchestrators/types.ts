// orchestrators/types.ts
//
// Cross-orchestrator types (Phase 4 D-06). Sits at the ROOT of
// `orchestrators/` so Phase 4 (marketplace/update.ts) and Phase 5
// (plugin/update.ts) both import from here without an
// orchestrators/marketplace ↔ orchestrators/plugin cycle. Mirrors
// Phase 3 D-01's escalation note about a future BridgeOps<Prep, Target>
// belonging at this same path.

import type { Reason } from "../shared/grammar/reasons.ts";
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
   * Plan 13-02a-01 / CMC-13: per-row soft-dep predicate inputs. `true` iff
   * the plugin's resolved manifest declared the kind AND it was actually
   * staged at reinstall time (the orchestrator already tracks
   * `stagedAgents.length > 0` / `stagedMcpServers.length > 0` per-outcome;
   * these flags surface them through the typed outcome so cascade rendering
   * (`PluginCascadeRow.declaresAgents` / `.declaresMcp`) consumes the
   * effective-state-at-render-time signal without re-deriving from the
   * stagedAgents / stagedMcpServers arrays at the renderer site).
   *
   * MSG-SD-3 / D-13-07: per-row markers fire on `(reinstalled)` rows only;
   * `(skipped)` and `(failed)` rows omit them (failed sets these to false
   * to make the constraint explicit even though the renderer narrows on
   * `status === "skipped"` / `"failed"` anyway).
   *
   * Task 260525-cjr B1 / CMC-13: required `boolean` (not `?: boolean`)
   * so every reinstalled-outcome producer populates the predicate
   * EXPLICITLY rather than relying on `undefined ~= false`. The closed
   * type enforces the contract at compile time; the `tsc --noEmit` gate
   * catches any forgotten emitter on every CI run.
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
   * Plan 13-02a-02 / CMC-16 / CMC-11: structural failure-class tag
   * consumed by `outcomeToCascadeRow`'s closed-set Reason mapping. When the
   * orchestrator catches a `ManualRecoveryError` (thrown by the bridges'
   * leak-on-rollback path), it sets `failureClass: "manual-recovery"` so
   * the cascade row renders `(failed) {rollback partial}` without
   * substring-matching the legacy ES-5 `notes` text. Omitted on
   * non-manual-recovery failures; the cascade renderer falls back to
   * `narrowReason` on `notes` for those.
   */
  readonly failureClass?: "manual-recovery";
}

export type ReinstallPluginOutcome =
  | ReinstallReinstalledOutcome
  | ReinstallSkippedOutcome
  | ReinstallFailedOutcome;

/** MU-7 partition tag. Phase 5's plugin/update.ts returns one outcome per plugin. */
export type PluginUpdatePartition = "updated" | "unchanged" | "skipped" | "failed";

/**
 * D-06 outcome shape. Discriminated by `partition`; consumers exhaust-switch.
 * Field optionality reflects MU-7 per-partition semantics:
 *   - updated: fromVersion + toVersion present (string compare changed)
 *   - unchanged: name only (resolved version matched install record)
 *   - skipped: name + optional notes (e.g., resolver could not load)
 *   - failed: notes carries the chained error message tail (Error.cause walk)
 *
 * WR-04: optional stagedAgents / stagedMcpServers fields carry the
 * names of resources the plugin's update actually staged. RH-5 soft-dep
 * warnings (Phase 4 marketplace update; Phase 5 plugin update) use
 * these to decide whether pi-subagents / pi-mcp-adapter need a warning,
 * instead of firing on every plugin update regardless of staged content.
 * Optional because Phase 4 ships the orchestrator before Phase 5 wires
 * the real implementation; tests that don't exercise RH-5 omit them.
 */
export interface PluginUpdateOutcome {
  readonly partition: PluginUpdatePartition;
  readonly name: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  /**
   * Free-form note blob for the cause-chain trailer composition (used by
   * `composeErrorWithCauseChain` at the producer site to capture the full
   * chained error message). Cascade consumers (`marketplace/update.ts::
   * outcomeToCascadeRow`) MUST prefer `reasons` (typed, closed-set) for
   * classification; `notes` is retained ONLY for the notifyError trailer
   * text path so the user still sees the underlying error message body.
   *
   * Quick task 260525-aub: a future cleanup task may remove `notes` from
   * the consumer contract once every notifyError consumer composes the
   * trailer from `Error.cause` directly. Today the cascade rendering
   * partition body and JSON outcome aggregation still consume it.
   */
  readonly notes?: readonly string[];
  /**
   * Quick task 260525-aub / CR-06 precedent (NFR-7 discriminated dispatch):
   * pre-narrowed closed-set `Reason[]` produced at the throw/catch site
   * rather than re-derived by the consumer via substring matching of
   * `notes`. The cascade renderer (`outcomeToCascadeRow`) reads
   * `reasons?.[0]` directly when populated; falls back to the legacy
   * `narrowSkipReason` / `narrowFailReason` substring parse on `notes`
   * only when `reasons` is undefined (backward-compat for test fixtures
   * that build outcomes without `reasons`).
   *
   * Populated by `plugin/update.ts` producers (the catch in
   * `updateSinglePlugin` and the static skipped-partition returns in
   * `preflightUpdate`). All values must be members of the closed
   * `Reason` set per `shared/grammar/reasons.ts`.
   */
  readonly reasons?: readonly Reason[];
  /** WR-04: agents staged by this plugin's update (RH-5 input). */
  readonly stagedAgents?: readonly string[];
  /** WR-04: MCP servers staged by this plugin's update (RH-5 input). */
  readonly stagedMcpServers?: readonly string[];
  /**
   * Plan 13-02a-01 / CMC-13: per-row soft-dep predicate inputs (same
   * semantics as `ReinstallReinstalledOutcome.declaresAgents/Mcp`). True
   * iff the plugin's manifest declared the kind AND it was actually
   * staged. The renderer probes companion-loaded state via SoftDepProbe
   * and emits `{requires pi-subagents}` / `{requires pi-mcp}` iff
   * (declares AND unloaded). Populated on `(updated)` outcomes; on
   * `(unchanged) / (skipped) / (failed)` outcomes the producer sets
   * these to `false` (MSG-SD-3 forbids the marker on those rows; the
   * renderer narrows on `partition` anyway, but the explicit value
   * keeps every producer site honest about emitting both booleans).
   *
   * Task 260525-cjr B1 / CMC-13: required `boolean` (not `?: boolean`)
   * so every plugin-update producer populates the predicate
   * EXPLICITLY rather than relying on `undefined ~= false`.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  /**
   * Plan 13-02a-01 / CMC-17 / MSG-RP-1: per-phase rollback-partial
   * children for the `(failed)` partition when phase-3a aggregation
   * occurred. Each entry names one bridge (`skills` | `commands` |
   * `agents` | `mcp`) whose `commit*` threw or leaked. The cascade
   * renderer uses these to build the indented children block beneath
   * the `(failed) {rollback partial}` parent row.
   *
   * Encoded as the bridge-name + cause-message pair so the rendering
   * stays close to the catalog's `[phase3a] failed to remove staged
   * agent: EACCES` form (the phaseLabel is the bridge name, prefixed
   * by `[<phase>]` at render time; the reason embeds the cause text
   * via the closed-set `"rollback partial"` Reason).
   *
   * Omitted on `(updated)` / `(unchanged)` / `(skipped)` outcomes and
   * on `(failed)` outcomes that did not reach phase-3a (preflight
   * failures, manifest errors, etc.).
   */
  readonly phaseFailures?: readonly {
    readonly phase: "skills" | "commands" | "agents" | "mcp";
    readonly msg: string;
  }[];
}

/**
 * D-05 function-injection seam. Phase 4 (`marketplace update` with
 * `record.autoupdate === true`) calls this once per installed plugin
 * during the autoupdate cascade. Phase 5 ships the real implementation
 * (`orchestrators/plugin/update.ts`); tests inject a mock. Phase 7's
 * `index.ts` performs the registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;
