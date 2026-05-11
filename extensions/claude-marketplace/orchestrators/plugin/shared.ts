// extensions/claude-marketplace/orchestrators/plugin/shared.ts
//
// Phase 5 shared helpers for the plugin orchestrator family. Mirrors
// orchestrators/marketplace/shared.ts in spirit: pure-function helpers
// that the install / update / uninstall / list orchestrators import to
// satisfy a single named requirement.
//
// Right now this file exports exactly one helper, `assertNoCrossPluginConflicts`
// (PI-6 / RN-3 cross-bridge name conflict guard). If a second consumer
// emerges across plugin + marketplace orchestrators, promote helpers to
// `orchestrators/types.ts` per the Phase 4 D-06 elevation rule.
//
// Per D-11 import boundaries, this file lives in `orchestrators/plugin/`
// and may import from `shared/` and `persistence/` (type-only). No
// imports from `bridges/` or `orchestrators/marketplace/*` for THIS
// helper.

import { CrossPluginConflictError } from "../../shared/errors.ts";

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
      // MCP server names INTENTIONALLY skipped per PRD §6.5 / D-05 corollary.
    }
  }

  const conflicts: string[] = [];

  for (const n of [...generatedNames.skills].sort()) {
    const owner = skillOwners.get(n);
    if (owner !== undefined) {
      conflicts.push(`skill "${n}" already owned by plugin "${owner.plugin}"`);
    }
  }

  for (const n of [...generatedNames.commands].sort()) {
    const owner = commandOwners.get(n);
    if (owner !== undefined) {
      conflicts.push(`command "${n}" already owned by plugin "${owner.plugin}"`);
    }
  }

  for (const n of [...generatedNames.agents].sort()) {
    const owner = agentOwners.get(n);
    if (owner !== undefined) {
      conflicts.push(`agent "${n}" already owned by plugin "${owner.plugin}"`);
    }
  }

  if (conflicts.length > 0) {
    throw new CrossPluginConflictError(conflicts);
  }
}
