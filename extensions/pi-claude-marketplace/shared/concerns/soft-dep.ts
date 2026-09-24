import { type Reason } from "../notification-types.ts";

import type { SoftDepStatus } from "../../platform/pi-api.ts";

/**
 * shared/concerns/soft-dep.ts -- the soft-dep marker injection concern (D-01).
 * Owns the `Dependency` literal-union, the three soft-dep marker constants, and
 * the pure `softDepMarkers` helper that maps a per-row declares-flags triple + a
 * threaded `SoftDepStatus` probe to the soft-dep markers to append. The central
 * `composeReasons` (which stays in `notify.ts` as shared presentation
 * vocabulary) delegates its soft-dep branch here.
 *
 * The `softDepStatus(pi)` probe stays threaded by the renderer (environment is
 * the renderer's job); this module is pure given the probe result. `Reason` is
 * imported type-only from `notify.ts` -- the byte-critical `REASONS` tuple stays
 * the single source of catalog truth there, and the type-only import is the
 * cycle safeguard (no `import-x/no-cycle` rule is configured, so the
 * renderer->concern call direction plus type-only back-references prevent any
 * runtime cycle).
 */

/**
 * Closed set of dependency probe targets (SNM-06). 3 members, each driving the
 * renderer's per-dependency soft-dep probe path (`requires pi-subagents` /
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
