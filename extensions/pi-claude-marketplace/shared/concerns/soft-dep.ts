import { type Reason } from "../notification-types.ts";

import type {
  ActiveMcpImplementation,
  McpImplementationId,
  SoftDepStatus,
} from "../../platform/pi-api.ts";

/**
 * shared/concerns/soft-dep.ts -- the soft-dep marker injection concern (D-01).
 * Owns the `Dependency` union, the three soft-dep marker constants, and the
 * pure `softDepMarkers` helper that maps a per-row declares triple + a
 * `SoftDepStatus` snapshot to the soft-dep markers to append. It also owns the
 * companion package names and `companionRequirements`, the same mapping shaped
 * for the info `requires:` line (ADET-01).
 *
 * D-MB-07: the MCP marker names an implementation, not a package:
 * `mcpDependencyMarker` reads the active implementation from the snapshot and
 * the implementations that run every server from the row's `McpDependency`.
 *
 * Resolve calls `softDepMarkers` with the command run's snapshot (D-05, D-12),
 * and plugin info calls `companionRequirements` with it; this module never
 * probes and is pure given the snapshot. `Reason` is imported type-only from
 * `notification-types.ts`, and the type-only import is the cycle safeguard:
 * the resolve->concern call direction plus type-only back-references prevent
 * any runtime cycle.
 */

/**
 * D-P3-10 / D-MB-07: a plugin's MCP dependency. It exists only when at least
 * one MCP implementation runs one of the plugin's servers; `runEvery` lists,
 * in the order adapter then builtin, each implementation that runs every such
 * server, and is empty when the servers split between the two.
 */
export interface McpDependency {
  readonly kind: "mcp";
  readonly runEvery: readonly McpImplementationId[];
}

/**
 * Closed set of dependency probe targets (SNM-06). 3 members, each selecting
 * the snapshot flag behind one soft-dep marker (`requires pi-subagents` /
 * the MCP marker / `requires pi-dynamic-workflows` reason emission).
 * D-P3-10: the MCP member is the `McpDependency` itself, so a row carries
 * which implementations run every server.
 *
 * Spelled out as a union rather than a runtime `DEPENDENCIES` tuple:
 * nothing iterates the members at runtime, so the union type alone is the
 * sole declaration site.
 */
export type Dependency = "agents" | McpDependency | "workflows";

/** D-P3-10: picks the MCP member out of a row's dependency list. */
export function isMcpDependency(dependency: Dependency): dependency is McpDependency {
  return typeof dependency === "object";
}

/**
 * ADET-01: the companion extension a component kind needs at runtime -- agents
 * need pi-subagents, mcp needs pi-mcp-adapter, workflows need the host
 * workflow engine.
 *
 * D-MB-07: `mcp` and `builtin mcp` name an MCP implementation the way the
 * `requires mcp` and `requires builtin mcp` markers do: `mcp` when either
 * implementation would run every server, `builtin mcp` when only Pi's
 * built-in MCP would.
 */
export type Companion =
  "pi-dynamic-workflows" | "pi-mcp-adapter" | "pi-subagents" | "mcp" | "builtin mcp";

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

// D-MB-07: the two MCP companions that name an implementation rather than a
// package -- either implementation, or Pi's built-in MCP alone.
const COMPANION_ANY_MCP = "mcp" satisfies Companion;
const COMPANION_BUILTIN_MCP = "builtin mcp" satisfies Companion;

/** Soft-dep marker literals -- every one is a REASONS member (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = `requires ${COMPANION_AGENTS}`;
const SOFT_DEP_MARKER_MCP: Reason = `requires ${COMPANION_MCP}`;
const SOFT_DEP_MARKER_ANY_MCP: Reason = `requires ${COMPANION_ANY_MCP}`;
const SOFT_DEP_MARKER_BUILTIN_MCP: Reason = `requires ${COMPANION_BUILTIN_MCP}`;
const SOFT_DEP_MARKER_WORKFLOWS: Reason = `requires ${COMPANION_WORKFLOWS}`;

/**
 * D-MB-07: which implementations run every server of an `McpDependency`.
 * `split` is the empty `runEvery`: each implementation runs some server the
 * other cannot.
 */
type RunEveryShape = "both" | "adapter" | "builtin" | "split";

/**
 * D-P3-06 / D-MB-07: the MCP marker per `runEvery` shape and active
 * implementation; an absent entry means no marker. With no active
 * implementation the marker names what would run every server (`requires mcp`
 * when either would, or when neither runs them all). With an active
 * implementation that runs every server there is no marker; with one that
 * cannot, the marker names the other implementation.
 */
const MCP_MARKER_RULE: Readonly<
  Record<RunEveryShape, Readonly<Partial<Record<ActiveMcpImplementation, Reason>>>>
> = {
  both: { none: SOFT_DEP_MARKER_ANY_MCP },
  adapter: { builtin: SOFT_DEP_MARKER_MCP, none: SOFT_DEP_MARKER_MCP },
  builtin: { adapter: SOFT_DEP_MARKER_BUILTIN_MCP, none: SOFT_DEP_MARKER_BUILTIN_MCP },
  split: {
    adapter: SOFT_DEP_MARKER_BUILTIN_MCP,
    builtin: SOFT_DEP_MARKER_MCP,
    none: SOFT_DEP_MARKER_ANY_MCP,
  },
};

function runEveryShape(runEvery: readonly McpImplementationId[]): RunEveryShape {
  const runsAdapter = runEvery.includes("adapter");
  const runsBuiltin = runEvery.includes("builtin");
  if (runsAdapter && runsBuiltin) {
    return "both";
  }

  if (runsAdapter) {
    return "adapter";
  }

  return runsBuiltin ? "builtin" : "split";
}

/**
 * D-P3-06 / D-MB-07: the MCP soft-dep marker of a row, or `undefined` for
 * none. `false` (no server any implementation runs) never gets one. The
 * snapshot's active implementation decides it, through `MCP_MARKER_RULE`.
 */
export function mcpDependencyMarker(
  declaresMcp: McpDependency | false,
  probe: SoftDepStatus,
): Reason | undefined {
  return declaresMcp === false
    ? undefined
    : MCP_MARKER_RULE[runEveryShape(declaresMcp.runEvery)][probe.mcpImplementation];
}

/**
 * SNM-06: the dependencies a plugin's declares-flags select, in canonical order.
 * WDEP-02: `workflows` comes last, so a row that declares agents and mcp renders
 * the same two-marker brace whether or not it also declares workflows.
 * D-P3-10: an `McpDependency` fills the mcp slot with itself; `false` leaves
 * it empty.
 */
export function declaredDependencies(flags: {
  readonly declaresAgents: boolean;
  readonly declaresMcp: McpDependency | false;
  readonly declaresWorkflows: boolean;
}): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (flags.declaresAgents) {
    deps.push("agents");
  }

  if (flags.declaresMcp !== false) {
    deps.push(flags.declaresMcp);
  }

  if (flags.declaresWorkflows) {
    deps.push("workflows");
  }

  return Object.freeze(deps);
}

/**
 * Pure given the probe result. Returns the soft-dep markers to append, in
 * canonical order (agents, then mcp, then workflows -- byte-critical for the
 * `{<r1>, <r2>}` brace join).
 *
 *  - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *  - Appends the MCP marker `mcpDependencyMarker` returns, if any (D-MB-07).
 *  - Appends `SOFT_DEP_MARKER_WORKFLOWS` iff `declaresWorkflows && !probe.workflowEngineLoaded`.
 */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: McpDependency | false,
  declaresWorkflows: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }

  const mcpMarker = mcpDependencyMarker(declaresMcp, probe);
  if (mcpMarker !== undefined) {
    markers.push(mcpMarker);
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
