// extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
//
// Shared helper for plugin orchestrators that need the set of generated
// names a plugin would produce when staged. `install-outcome.ts`, `update.ts` and
// `reinstall.ts` all use it for the same three purposes: wiring the
// agents-knownSkills validator, feeding the skills bridge the workflow names
// its token rewrite retargets onto (SKTK-01), and building cross-plugin
// conflict inputs.
//
// Lives outside `shared.ts` because it imports from `bridges/`; the
// shared-helpers module is intentionally domain/persistence-only.
//
// Imports the four per-kind bridge barrels directly. An aggregate barrel
// re-exporting across bridge kinds would launder around the
// no-cross-bridge-imports boundary rule, so the per-kind barrels are the
// only bridge entry points here.

import path from "node:path";

import { discoverPluginAgents } from "../../bridges/agents/index.ts";
import { discoverPluginCommands } from "../../bridges/commands/index.ts";
import { discoverPluginSkills } from "../../bridges/skills/index.ts";
import { discoverPluginWorkflows } from "../../bridges/workflows/index.ts";

import type { MaterializablePlugin } from "../../domain/resolver-types.ts";

export interface DiscoveredGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
  readonly agentsDirs: readonly string[];
  /**
   * The admitted scripts' generated `<plugin>:<name>`s. Read by the skills
   * bridge alone: the cross-plugin guard does not consult it, because a
   * workflow envelope's target is refused at commit if another owner holds it.
   */
  readonly workflows: readonly string[];
}

function resolvedAgentsDirs(resolved: MaterializablePlugin): readonly string[] {
  return resolved.componentPaths.agents.map((agentsDir) =>
    path.resolve(resolved.pluginRoot, agentsDir),
  );
}

/**
 * Name preview only. The four discoveries also return D-07 warnings, and
 * this function drops them on purpose.
 *
 * Every caller runs the same walk again during staging, and that pass is the
 * one that reports: `install-outcome.ts` folds each `prepareStage*` result onto
 * `discoveryWarnings` and `reinstall.ts` aggregates the same four results in
 * `collectStagingWarnings`. Reporting here as well would print every warning
 * twice for one install.
 *
 * The cost of the drop is a second walk of the same directories -- and for
 * workflows a second read of every candidate script, because a workflow's name
 * lives in its `meta.name`. It buys the cross-plugin conflict check a name set
 * BEFORE the ledger opens, which is where a conflict has to be refused, and the
 * skills bridge its sibling workflow names before the workflows bridge runs.
 *
 * The workflows tense is `install` because every caller is about to stage; the
 * warnings the tense would word are dropped here regardless.
 */
export async function discoverGeneratedNames(
  plugin: string,
  resolved: MaterializablePlugin,
): Promise<DiscoveredGeneratedNames> {
  const skillsDiscovery = await discoverPluginSkills({ pluginName: plugin, resolved });
  const commandsDiscovery = await discoverPluginCommands({
    pluginName: plugin,
    resolved,
  });
  const agentsDirs = resolvedAgentsDirs(resolved);
  const agentsDiscovery = await discoverPluginAgents({ pluginName: plugin, agentsDirs });
  const workflowsDiscovery = await discoverPluginWorkflows({
    pluginName: plugin,
    resolved,
    tense: "install",
  });

  return {
    skills: skillsDiscovery.discovered.map((s) => s.generatedName),
    commands: commandsDiscovery.discovered.map((c) => c.generatedName),
    agents: agentsDiscovery.discovered.map((a) => a.generatedName),
    agentsDirs,
    workflows: workflowsDiscovery.discovered.flatMap((w) =>
      w.verdict.outcome === "named" ? [w.verdict.generatedName] : [],
    ),
  };
}
