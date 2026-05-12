// extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
//
// Phase 5 shared helpers for the plugin orchestrator family. Mirrors
// orchestrators/marketplace/shared.ts in spirit: pure-function helpers
// that the install / update / uninstall / list orchestrators import to
// satisfy a single named requirement.
//
// Shared helpers stay here while their consumers are confined to the plugin
// orchestrator family. If a consumer emerges outside plugin orchestrators,
// promote the helper to a wider orchestrators/shared surface.
//
// Per D-11 import boundaries, this file lives in `orchestrators/plugin/`
// and may import from `domain/`, `shared/`, and `persistence/` (type-only).
// No imports from `bridges/` or `orchestrators/marketplace/*`.

import path from "node:path";

import { computeHashVersion } from "../../domain/version.ts";
import { CrossPluginConflictError } from "../../shared/errors.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Generated-name candidates produced by `domain/name.ts` generators for the
 * plugin being installed or updated. MCP server names are intentionally
 * EXCLUDED from this shape per PRD §6.5 (RN-3 same-kind cross-plugin guard
 * covers skills, prompts/commands, and agents only; MCP cross-slot
 * collision is the bridge's MC-4 concern, not the orchestrator's).
 */
export interface CrossPluginGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
}

/** PI-7 / PUP-3 version precedence: marketplace entry version, then content hash. */
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: ResolvedPluginInstallable,
): Promise<string> {
  if (typeof entry.version === "string" && entry.version.length > 0) {
    return entry.version;
  }

  return computeHashVersion(installable.pluginRoot);
}

/** Bridge adapter for the resolver's `componentPaths.agents` array shape. */
export function pickAgentsSourceDir(installable: ResolvedPluginInstallable): string {
  const first = installable.componentPaths.agents[0];
  if (first === undefined) {
    return "";
  }

  return path.isAbsolute(first) ? first : path.join(installable.pluginRoot, first);
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

function collectOwners(state: ExtensionState): {
  skillOwners: Map<string, { plugin: string; marketplace: string }>;
  commandOwners: Map<string, { plugin: string; marketplace: string }>;
  agentOwners: Map<string, { plugin: string; marketplace: string }>;
} {
  const skillOwners = new Map<string, { plugin: string; marketplace: string }>();
  const commandOwners = new Map<string, { plugin: string; marketplace: string }>();
  const agentOwners = new Map<string, { plugin: string; marketplace: string }>();

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      for (const n of plugin.resources.skills) {
        skillOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }

      for (const n of plugin.resources.prompts) {
        commandOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }

      for (const n of plugin.resources.agents) {
        agentOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return { skillOwners, commandOwners, agentOwners };
}

function collectConflicts(
  kind: string,
  names: readonly string[],
  owners: ReadonlyMap<string, { plugin: string; marketplace: string }>,
): string[] {
  const conflicts: string[] = [];
  for (const n of [...names].sort(compareNames)) {
    const owner = owners.get(n);
    if (owner !== undefined) {
      conflicts.push(`${kind} "${n}" already owned by plugin "${owner.plugin}"`);
    }
  }

  return conflicts;
}

/**
 * PI-6 / RN-3 cross-bridge name conflict guard.
 *
 * Pre-flight check: BEFORE any disk write, refuse to install or update if
 * the candidate generated names collide with names already owned by
 * another plugin in the SAME SCOPE. Reads only the caller-supplied state
 * snapshot; performs no I/O.
 *
 * Determinism: conflicts emitted in fixed order -- skills first, then
 * commands (state field `prompts`), then agents. Within each kind,
 * conflicts are emitted in alphabetical order of generated name. This
 * stable ordering means UI diff tooling (and tests) can assert message
 * content byte-for-byte.
 *
 * Cross-scope independence (Phase 2 D-10): the caller passes exactly one
 * scope's state. Other-scope plugins owning the same name do NOT trigger
 * conflicts here -- they are independent installations. The `scope`
 * parameter is retained for diagnostic-message enrichment and symmetry
 * with other orchestrator helpers; cross-scope safety is enforced BY
 * CONSTRUCTION (callers pass one scope's state at a time).
 *
 * MCP server names are EXCLUDED by construction: `CrossPluginGeneratedNames`
 * has no `mcpServers` field. PRD §6.5 places MCP cross-slot collision at
 * the bridge layer (MC-4), not in this orchestrator-tier guard.
 *
 * @throws CrossPluginConflictError when ANY name collides; the message
 *   lists every conflict in the order above. Pre-disk-write per RN-3.
 */
export function assertNoCrossPluginConflicts(
  _scope: Scope,
  generatedNames: CrossPluginGeneratedNames,
  state: ExtensionState,
): void {
  // Build owner maps from current state. Key: generated name; Value: owning
  // plugin name (the marketplace pair is also useful in messages; capture both).
  const { skillOwners, commandOwners, agentOwners } = collectOwners(state);
  const conflicts = [
    ...collectConflicts("skill", generatedNames.skills, skillOwners),
    ...collectConflicts("command", generatedNames.commands, commandOwners),
    ...collectConflicts("agent", generatedNames.agents, agentOwners),
  ];

  if (conflicts.length > 0) {
    throw new CrossPluginConflictError(conflicts);
  }
}
