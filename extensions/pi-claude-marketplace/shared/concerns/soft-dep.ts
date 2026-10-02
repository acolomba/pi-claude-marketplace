import { type Reason } from "../notification-types.ts";

import type { SoftDepStatus } from "../../platform/pi-api.ts";

/**
 * shared/concerns/soft-dep.ts -- the soft-dep marker injection concern (D-01).
 * Owns the `Dependency` literal-union, the three soft-dep marker constants, and
 * the pure `softDepMarkers` helper that maps a per-row declares-flags triple + a
 * threaded `SoftDepStatus` probe to the soft-dep markers to append. It also owns
 * the companion package names and `companionRequirements`, the same mapping
 * shaped for the info `requires:` line (ADET-01). The central
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
 * `requires pi-mcp-adapter` / `requires pi-dynamic-workflows` reason emission).
 *
 * Spelled out as a literal union rather than a runtime `DEPENDENCIES` tuple:
 * nothing iterates the members at runtime, so the union type alone is the
 * sole declaration site.
 */
export type Dependency = "agents" | "mcp" | "workflows";

/**
 * ADET-01: the companion extension a component kind needs at runtime -- agents
 * need pi-subagents, mcp needs pi-mcp-adapter, workflows need the host
 * workflow engine.
 */
export type Companion = "pi-dynamic-workflows" | "pi-mcp-adapter" | "pi-subagents";

/**
 * ADET-01: one companion a plugin needs. `missing` is true when the probe
 * snapshot reports the companion not loaded.
 */
export interface CompanionRequirement {
  readonly companion: Companion;
  readonly missing: boolean;
}

// ADET-01: each companion name is declared once, and both the soft-dep marker
// and the info `requires:` entry derive from it, so the two surfaces cannot
// name a companion differently.
const COMPANION_AGENTS = "pi-subagents" satisfies Companion;
const COMPANION_MCP = "pi-mcp-adapter" satisfies Companion;

/**
 * WDEP-04: the host workflow engine `@quintinshaw/pi-dynamic-workflows`.
 * Deliberately NOT spelled `pi-workflows` -- that is the npm name of
 * `@nicknisi/pi-workflows`, a different engine, so the short form would point
 * the operator at the wrong package to install.
 */
const COMPANION_WORKFLOWS = "pi-dynamic-workflows" satisfies Companion;

/** Soft-dep marker literals -- all three are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = `requires ${COMPANION_AGENTS}`;
const SOFT_DEP_MARKER_MCP: Reason = `requires ${COMPANION_MCP}`;
const SOFT_DEP_MARKER_WORKFLOWS: Reason = `requires ${COMPANION_WORKFLOWS}`;

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

/**
 * ADET-01: returns the companions a plugin's declared component kinds need,
 * one entry per declared kind, sorted by companion name ascending. Each entry
 * is tagged `missing` from the probe, so the caller stamps the result as is.
 * Pure given the probe result.
 */
export function companionRequirements(
  declaresAgents: boolean,
  declaresMcp: boolean,
  declaresWorkflows: boolean,
  probe: SoftDepStatus,
): readonly CompanionRequirement[] {
  const requirements: CompanionRequirement[] = [];

  // Pushed in companion-name order: pi-dynamic-workflows, pi-mcp-adapter,
  // pi-subagents. Each kind maps to a distinct companion, so no tie exists.
  if (declaresWorkflows) {
    requirements.push({ companion: COMPANION_WORKFLOWS, missing: !probe.workflowEngineLoaded });
  }

  if (declaresMcp) {
    requirements.push({ companion: COMPANION_MCP, missing: !probe.piMcpAdapterLoaded });
  }

  if (declaresAgents) {
    requirements.push({ companion: COMPANION_AGENTS, missing: !probe.piSubagentsLoaded });
  }

  return requirements;
}
