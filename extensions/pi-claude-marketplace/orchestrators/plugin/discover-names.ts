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
//
// PG-SEC-01 / D-PG4-13: this is also where the workflow agent restriction
// notes are built. They join the agents discovery with the workflows
// discovery, and no bridge may import a sibling bridge, so the join lives in
// the one orchestrator module that already holds both results.

import path from "node:path";

import { discoverPluginAgents } from "../../bridges/agents/index.ts";
import { discoverPluginCommands } from "../../bridges/commands/index.ts";
import { discoverPluginSkills } from "../../bridges/skills/index.ts";
import { discoverPluginWorkflows } from "../../bridges/workflows/index.ts";
import { declaredAgentName } from "../../domain/name.ts";
import { forMessage } from "../../domain/workflow-script.ts";

import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { WorkflowVerdict } from "../../domain/workflow-script.ts";

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
  /**
   * PG-SEC-01: one note for each distinct pair of an admitted script and an
   * agent type it names that restricts its tools.
   */
  readonly workflowAgentRestrictionNotes: readonly string[];
}

/** The part of a discovered agent the restriction join reads. */
export interface RestrictionAgent {
  readonly sourceName: string;
  readonly generatedName: string;
  readonly namespace?: readonly string[];
  readonly raw: { readonly tools?: string; readonly disallowedTools?: string };
}

/** The part of a discovered workflow script the restriction join reads. */
export interface RestrictionWorkflow {
  readonly verdict: WorkflowVerdict;
  readonly scriptFile: string;
}

function resolvedAgentsDirs(resolved: MaterializablePlugin): readonly string[] {
  return resolved.componentPaths.agents.map((agentsDir) =>
    path.resolve(resolved.pluginRoot, agentsDir),
  );
}

/**
 * D-PG4-11: a `tools` or `disallowedTools` value that is not blank restricts
 * the agent's tools. A YAML list arrives folded into one comma-joined string.
 */
function restrictsTools(agent: RestrictionAgent): boolean {
  return [agent.raw.tools, agent.raw.disallowedTools].some(
    (field) => field !== undefined && field.trim() !== "",
  );
}

/**
 * D-PG4-11: the names a script may use for a restricted agent of the plugin:
 * the upstream `<plugin>:<agent>`, which the engine's registry resolves, and
 * the generated name. Discovery already checked every part of both names, so
 * `declaredAgentName` cannot throw here.
 */
function restrictedAgentNames(
  pluginName: string,
  agents: readonly RestrictionAgent[],
): ReadonlySet<string> {
  return new Set(
    agents
      .filter(restrictsTools)
      .flatMap((agent) => [
        declaredAgentName(pluginName, agent.sourceName, agent.namespace),
        agent.generatedName,
      ]),
  );
}

/**
 * D-PG4-12: one note in the shape of the workflows bridge's notes. Each span
 * of plugin text goes through `forMessage` where it enters the string.
 *
 * The folder is the script folder's base name, which is what the bridge's
 * notes show once `redactAbsolutePaths` reduces their absolute folder. This
 * note cannot leave that to the redaction: a quoted absolute path that more
 * quotes follow is redacted to the end of the line, and the agent type is
 * quoted after the folder.
 */
function restrictionNote(fileName: string, scriptFile: string, agentType: string): string {
  const folder = path.basename(path.dirname(scriptFile));

  return `workflow script "${forMessage(fileName)}" in "${forMessage(folder)}" runs agent type "${forMessage(agentType)}", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write`;
}

/**
 * PG-SEC-01 / D-PG4-11: the notes for a plugin whose admitted workflow
 * scripts name, as a string literal, an agent of the same plugin that
 * restricts its tools. Claude Code keeps that restriction when a workflow
 * runs the agent; the workflow engine passes no tool list to Pi for the
 * child session, so the agent gets read, bash, edit, and write.
 *
 * Matching is exact string equality, with no case folding or Unicode
 * normalization. One note for each distinct pair of script and agent type,
 * in script order and then in the order the script names them. Pure: it reads
 * no file.
 *
 * Two surfaces consume it: the install and update discovery below, and the
 * `info` surface, which joins the agents and workflows it previews itself.
 */
export function workflowAgentRestrictionNotes(
  pluginName: string,
  agents: readonly RestrictionAgent[],
  workflows: readonly RestrictionWorkflow[],
): readonly string[] {
  const restricted = restrictedAgentNames(pluginName, agents);

  return workflows.flatMap(({ verdict, scriptFile }) =>
    verdict.outcome === "named"
      ? (verdict.agentTypes ?? [])
          .filter((agentType) => restricted.has(agentType))
          .map((agentType) => restrictionNote(verdict.fileName, scriptFile, agentType))
      : [],
  );
}

/**
 * Name preview, plus the workflow agent restriction notes. The four
 * discoveries also return D-07 warnings, and this function drops them on
 * purpose.
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
 *
 * PG-SEC-01: the restriction notes are the one output this function reports.
 * No staging pass builds them, because the join needs the agents and the
 * workflows together and each bridge sees only its own kind. Each caller adds
 * them at exactly one site, so a verb prints them once. They are recomputed
 * at every call and never stored (D-PG4-13).
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
    workflowAgentRestrictionNotes: workflowAgentRestrictionNotes(
      plugin,
      agentsDiscovery.discovered,
      workflowsDiscovery.discovered,
    ),
  };
}
