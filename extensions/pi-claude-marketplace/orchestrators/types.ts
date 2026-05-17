// orchestrators/types.ts
//
// Cross-orchestrator types (Phase 4 D-06). Sits at the ROOT of
// `orchestrators/` so Phase 4 (marketplace/update.ts) and Phase 5
// (plugin/update.ts) both import from here without an
// orchestrators/marketplace ↔ orchestrators/plugin cycle. Mirrors
// Phase 3 D-01's escalation note about a future BridgeOps<Prep, Target>
// belonging at this same path.

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
  readonly notes?: readonly string[];
}

export interface ReinstallSkippedOutcome extends ReinstallOutcomeBase {
  readonly partition: "skipped";
  readonly notes: readonly string[];
}

export interface ReinstallFailedOutcome extends ReinstallOutcomeBase {
  readonly partition: "failed";
  readonly notes: readonly string[];
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
  readonly notes?: readonly string[];
  /** WR-04: agents staged by this plugin's update (RH-5 input). */
  readonly stagedAgents?: readonly string[];
  /** WR-04: MCP servers staged by this plugin's update (RH-5 input). */
  readonly stagedMcpServers?: readonly string[];
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
