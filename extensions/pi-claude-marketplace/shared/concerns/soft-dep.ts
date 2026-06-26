import type { SoftDepStatus } from "../../platform/pi-api.ts";
import type { Reason } from "../notify.ts";

/**
 * shared/concerns/soft-dep.ts -- the soft-dep marker injection concern (D-01).
 * Owns the closed dependency tuple `DEPENDENCIES`, the derived `Dependency`
 * literal-union, the two soft-dep marker constants, and the pure
 * `softDepMarkers` helper that maps a per-row declares-flags pair + a threaded
 * `SoftDepStatus` probe to the soft-dep markers to append. The central
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
 * Runtime tuple of every dependency literal (SNM-06). 2 entries. Drives the
 * renderer's per-dependency soft-dep probe path (`requires pi-subagents` /
 * `requires pi-mcp` reason emission).
 *
 * Pattern: closed-set `as const` tuple + `(typeof X)[number]` literal-union.
 */
export const DEPENDENCIES = ["agents", "mcp"] as const;

/**
 * Closed set of dependency probe targets (SNM-06). Derived from
 * `DEPENDENCIES` via indexed access.
 */
export type Dependency = (typeof DEPENDENCIES)[number];

/** Soft-dep marker literals -- both are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";

/**
 * Pure given the probe result. Returns the soft-dep markers to append, in
 * canonical order (agents before mcp -- byte-critical for the `{<r1>, <r2>}`
 * brace join).
 *
 *  - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *  - Appends `SOFT_DEP_MARKER_MCP` iff `declaresMcp && !probe.piMcpAdapterLoaded`.
 */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }

  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    markers.push(SOFT_DEP_MARKER_MCP);
  }

  return markers;
}
