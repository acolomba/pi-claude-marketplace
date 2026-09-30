import { type Reason } from "../notification-types.ts";

import type { SoftDepStatus } from "../../platform/pi-api.ts";

/**
 * shared/concerns/soft-dep.ts -- the soft-dep marker injection concern (D-01).
 * Owns the `Dependency` literal-union, the three soft-dep marker constants, and
 * the pure `softDepMarkers` helper that maps a per-row declares-flags triple + a
 * `SoftDepStatus` snapshot to the soft-dep markers to append.
 *
 * Resolve calls `softDepMarkers` with the command run's snapshot (D-05, D-12);
 * this module never probes and is pure given the snapshot. `Reason` is
 * imported type-only from `notification-types.ts`, and the type-only import is
 * the cycle safeguard: the resolve->concern call direction plus type-only
 * back-references prevent any runtime cycle.
 */

/**
 * Closed set of dependency probe targets (SNM-06). 3 members, each selecting
 * the snapshot flag behind one soft-dep marker (`requires pi-subagents` /
 * `requires pi-mcp` / `requires pi-dynamic-workflows` reason emission).
 *
 * Spelled out as a literal union rather than a runtime `DEPENDENCIES` tuple:
 * nothing iterates the members at runtime, so the union type alone is the
 * sole declaration site.
 */
export type Dependency = "agents" | "mcp" | "workflows";

/** Soft-dep marker literals -- all three are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";

/**
 * WDEP-04: the host workflow engine `@quintinshaw/pi-dynamic-workflows`.
 * Deliberately NOT spelled `pi-workflows` -- that is the npm name of
 * `@nicknisi/pi-workflows`, a different engine, so the short form would point
 * the operator at the wrong package to install.
 */
const SOFT_DEP_MARKER_WORKFLOWS: Reason = "requires pi-dynamic-workflows";

/**
 * Pure given the probe result. Returns the soft-dep markers to append, in
 * canonical order (agents, then mcp, then workflows -- byte-critical for the
 * `{<r1>, <r2>}` brace join).
 *
 *  - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *  - Appends `SOFT_DEP_MARKER_MCP` iff `declaresMcp && !probe.piMcpAdapterLoaded`.
 *  - Appends `SOFT_DEP_MARKER_WORKFLOWS` iff `declaresWorkflows && !probe.workflowEngineLoaded`.
 */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  declaresWorkflows: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }

  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    markers.push(SOFT_DEP_MARKER_MCP);
  }

  // Appended LAST: the brace join is byte-critical and this order is what the
  // catalog states pin.
  if (declaresWorkflows && !probe.workflowEngineLoaded) {
    markers.push(SOFT_DEP_MARKER_WORKFLOWS);
  }

  return markers;
}
