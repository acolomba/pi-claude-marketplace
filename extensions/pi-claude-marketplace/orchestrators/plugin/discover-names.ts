// extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
//
// Shared helper for plugin orchestrators that need the set of generated
// names a plugin would produce when staged. `install.ts`, `update.ts` and
// `reinstall.ts` all use it for the same two purposes: wiring the
// agents-knownSkills validator and building cross-plugin conflict inputs.
//
// Lives outside `shared.ts` because it imports from `bridges/`; the
// shared-helpers module is intentionally domain/persistence-only.
//
// Imports the three per-kind bridge barrels directly. An aggregate
// `bridges/index.ts` used to re-export across all five bridge kinds, which
// made importing it a laundering route around the no-cross-bridge-imports
// boundary rule; that file is gone, and the per-kind barrels are the only
// bridge entry points.

import { discoverPluginAgents } from "../../bridges/agents/index.ts";
import { discoverPluginCommands } from "../../bridges/commands/index.ts";
import { discoverPluginSkills } from "../../bridges/skills/index.ts";

import { pickAgentsSourceDir } from "./shared.ts";

import type { MaterializablePlugin } from "../../domain/resolver.ts";

export interface DiscoveredGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
  readonly agentsSourceDir: string | null;
}

export async function discoverGeneratedNames(
  plugin: string,
  resolved: MaterializablePlugin,
): Promise<DiscoveredGeneratedNames> {
  const skillsDiscovery = await discoverPluginSkills({ pluginName: plugin, resolved });
  const commandsDiscovery = await discoverPluginCommands({
    pluginName: plugin,
    resolved,
  });
  const agentsSourceDir = pickAgentsSourceDir(resolved);
  const agentsDiscovery =
    agentsSourceDir === null
      ? { discovered: [] as readonly { readonly generatedName: string }[] }
      : await discoverPluginAgents({ pluginName: plugin, agentsDirs: [agentsSourceDir] });

  return {
    skills: skillsDiscovery.discovered.map((s) => s.generatedName),
    commands: commandsDiscovery.discovered.map((c) => c.generatedName),
    agents: agentsDiscovery.discovered.map((a) => a.generatedName),
    agentsSourceDir,
  };
}
