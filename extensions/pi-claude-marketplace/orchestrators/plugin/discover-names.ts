// extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
//
// Shared helper for plugin orchestrators that need the set of generated
// names a plugin would produce when staged. `update.ts` uses it to wire
// the agents-knownSkills validator and to build cross-plugin conflict
// inputs; `reinstall.ts` uses it for the same purposes. Extracted to
// remove the duplicated body in both orchestrators (Sonar new-code
// duplication).
//
// Lives outside `shared.ts` because it imports from `bridges/`; the
// shared-helpers module is intentionally domain/persistence-only.

import {
  discoverPluginAgents,
  discoverPluginCommands,
  discoverPluginSkills,
} from "../../bridges/index.ts";

import { pickAgentsSourceDir } from "./shared.ts";

import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";

export interface DiscoveredGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
  readonly agentsSourceDir: string | null;
}

export async function discoverGeneratedNames(
  plugin: string,
  installable: ResolvedPluginInstallable,
): Promise<DiscoveredGeneratedNames> {
  const skillsDiscovery = await discoverPluginSkills({ pluginName: plugin, resolved: installable });
  const commandsDiscovery = await discoverPluginCommands({
    pluginName: plugin,
    resolved: installable,
  });
  const agentsSourceDir = pickAgentsSourceDir(installable);
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
