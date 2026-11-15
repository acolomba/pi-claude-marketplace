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
// PG-SEC-01 / D-PG4-13 and PG-WF-02 / D-PG8-04: this is also where the
// workflow agent notes are built: the note for an agent type that restricts
// its tools, and the note for an agent type the plugin does not install. They
// join the agents discovery with the workflows discovery, and no bridge may
// import a sibling bridge, so the join lives in the one orchestrator module
// that already holds both results.

import path from "node:path";

import { discoverPluginAgents, listedToolNames } from "../../bridges/agents/index.ts";
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
   * Both kinds of workflow agent note in one list, so no surface can print
   * one kind and forget the other: PG-SEC-01 notes an agent type that
   * restricts its tools, and PG-WF-02 / D-PG8-04 notes an agent type of the
   * plugin's own namespace that the plugin does not install.
   */
  readonly workflowAgentNotes: readonly string[];
}

/** The part of a discovered agent the workflow agent join reads. */
export interface WorkflowNoteAgent {
  readonly sourceName: string;
  readonly generatedName: string;
  readonly namespace?: readonly string[];
  readonly raw: { readonly tools?: string; readonly disallowedTools?: string };
}

/** The part of a discovered workflow script the workflow agent join reads. */
export interface WorkflowNoteScript {
  readonly verdict: WorkflowVerdict;
  readonly scriptFile: string;
}

function resolvedAgentsDirs(resolved: MaterializablePlugin): readonly string[] {
  return resolved.componentPaths.agents.map((agentsDir) =>
    path.resolve(resolved.pluginRoot, agentsDir),
  );
}

/**
 * D-PG4-11: the Pi built-in tools that Pi's default tool set gives a workflow
 * engine subagent, each with its Claude Code name (AG-7). The engine filters
 * them only when its `providerMiddlewareExtensions` setting lists
 * `builtin:codemode`.
 */
const ENGINE_BUILTIN_TOOLS: readonly (readonly [pi: string, claude: string])[] = [
  ["read", "Read"],
  ["bash", "Bash"],
  ["edit", "Edit"],
  ["write", "Write"],
];

/**
 * D-PG4-11: the built-in tools that the agent's `tools` does not allow or its
 * `disallowedTools` denies, which the agent may get anyway. An absent or blank
 * `tools`, or one that lists `*`, allows every tool, as in Claude Code.
 */
function unkeptBuiltinTools(agent: WorkflowNoteAgent): readonly string[] {
  const allowed = listedToolNames(agent.raw.tools);
  const denied = new Set(listedToolNames(agent.raw.disallowedTools));
  const allowsAll = allowed.length === 0 || allowed.includes("*");
  return ENGINE_BUILTIN_TOOLS.filter(
    ([, claude]) => denied.has(claude) || (!allowsAll && !allowed.includes(claude)),
  ).map(([pi]) => pi);
}

/**
 * D-PG4-11: the built-ins each restricted agent of the plugin gets anyway,
 * under each name a script may use for it: the upstream `<plugin>:<agent>`,
 * which the engine's registry resolves, and the generated name. An agent
 * whose restriction keeps every built-in is left out. Discovery already
 * checked every part of both names, so `declaredAgentName` cannot throw here.
 */
function restrictedAgentTools(
  pluginName: string,
  agents: readonly WorkflowNoteAgent[],
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    agents.flatMap((agent) => {
      const unkept = unkeptBuiltinTools(agent);
      return unkept.length === 0
        ? []
        : [
            [declaredAgentName(pluginName, agent.sourceName, agent.namespace), unkept] as const,
            [agent.generatedName, unkept] as const,
          ];
    }),
  );
}

const TOOL_LIST_FORMAT = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * D-PG8-05: the most missing-agent notes one script prints, and the longest
 * agent type a note prints. A script may hold as many literals as its
 * 524,288 bytes allow, and one literal may be as long as the script, so
 * without them one script could flood the install output. A missing agent
 * type past either limit is counted in one line instead.
 */
const MISSING_AGENT_NOTE_LIMIT = 5;
const AGENT_TYPE_DISPLAY_LIMIT = 128;

/**
 * D-PG4-12: the start of every workflow agent note, in the shape of the
 * workflows bridge's notes. Each span of plugin text goes through
 * `forMessage` where it enters the string.
 *
 * The folder is the script folder's base name, which is what the bridge's
 * notes show once `redactAbsolutePaths` reduces their absolute folder. These
 * notes cannot leave that to the redaction: a quoted absolute path that more
 * quotes follow is redacted to the end of the line, and the agent type is
 * quoted after the folder.
 */
function scriptLead(fileName: string, scriptFile: string): string {
  const folder = path.basename(path.dirname(scriptFile));

  return `workflow script "${forMessage(fileName)}" in "${forMessage(folder)}"`;
}

function agentTypeLead(fileName: string, scriptFile: string, agentType: string): string {
  return `${scriptLead(fileName, scriptFile)} runs agent type "${forMessage(agentType)}"`;
}

function restrictionNote(
  fileName: string,
  scriptFile: string,
  agentType: string,
  unkept: readonly string[],
): string {
  return `${agentTypeLead(fileName, scriptFile, agentType)}, which restricts its tools; unless the workflow engine's providerMiddlewareExtensions setting lists builtin:codemode, the engine does not keep that restriction, so the agent may use ${TOOL_LIST_FORMAT.format(unkept)}`;
}

/** PG-WF-02 / D-PG8-05: the text has no tense, so install and `info` print the same bytes. */
function missingAgentNote(fileName: string, scriptFile: string, agentType: string): string {
  return `${agentTypeLead(fileName, scriptFile, agentType)}, which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run`;
}

function missingAgentCountLine(fileName: string, scriptFile: string, count: number): string {
  const types = count === 1 ? "agent type" : "agent types";

  return `${scriptLead(fileName, scriptFile)} runs ${count} more ${types} that this plugin does not install`;
}

/** What the join knows about the plugin before it reads a script. */
interface AgentNoteJoin {
  /** `<plugin>:`, the prefix of every agent type the plugin could install. */
  readonly ownPrefix: string;
  /** The declared name of every discovered agent. */
  readonly installed: ReadonlySet<string>;
  readonly restricted: ReadonlyMap<string, readonly string[]>;
}

/**
 * The notes of one admitted script, in the order the script names its agent
 * types, and then the count line. An agent type is either a restricted agent
 * of the plugin or missing, never both, because a restricted agent is a
 * discovered one.
 */
function scriptAgentNotes(
  join: AgentNoteJoin,
  fileName: string,
  scriptFile: string,
  agentTypes: readonly string[],
): readonly string[] {
  const notes: string[] = [];
  let missing = 0;
  let shown = 0;
  for (const agentType of agentTypes) {
    const unkept = join.restricted.get(agentType);
    if (unkept !== undefined) {
      notes.push(restrictionNote(fileName, scriptFile, agentType, unkept));
    } else if (agentType.startsWith(join.ownPrefix) && !join.installed.has(agentType)) {
      missing += 1;
      if (shown < MISSING_AGENT_NOTE_LIMIT && agentType.length <= AGENT_TYPE_DISPLAY_LIMIT) {
        notes.push(missingAgentNote(fileName, scriptFile, agentType));
        shown += 1;
      }
    }
  }

  if (missing > shown) {
    notes.push(missingAgentCountLine(fileName, scriptFile, missing - shown));
  }

  return notes;
}

/**
 * The workflow agent notes of a plugin whose admitted workflow scripts name
 * agent types as string literals. Pure: it reads no file.
 *
 * PG-SEC-01 / D-PG4-11: a note for an agent of the same plugin that restricts
 * its tools. Claude Code keeps that restriction when a workflow runs the
 * agent. The workflow engine keeps it only when its
 * `providerMiddlewareExtensions` setting lists `builtin:codemode`, which is
 * not Pi's own `codemode` tool. Otherwise the engine passes no tool list to Pi
 * for the child session, and the child gets Pi's default tools. Those are
 * read, bash, edit, and write unless the user's Pi `defaultTools` setting or
 * the engine's `excludeSubagentTools` setting changes them. So the note says
 * the agent may use the ones its restriction does not keep, and an agent whose
 * restriction keeps all four gets no note.
 *
 * PG-WF-02 / D-PG8-04: a note for an agent type that starts with the plugin
 * name and a colon and equals the declared name of no discovered agent.
 * Claude Code stops such a step; the workflow engine runs a default agent in
 * its place. The discovered agents are exactly the ones a successful install
 * writes: AG-11 fails the whole install, and AG-12 drops a duplicate inside
 * discovery. A name outside the plugin's namespace gets no note, because
 * another install may provide it. A generated flat name is never compared: it
 * does not start with the plugin name and a colon. D-PG8-05 limits these
 * notes for one script.
 *
 * Matching is exact string equality, with no case folding or Unicode
 * normalization. One note for each distinct pair of script and agent type,
 * in script order and then in the order the script names them.
 *
 * Two surfaces consume it: the install and update discovery below, and the
 * `info` surface, which joins the agents and workflows it previews itself.
 */
export function workflowAgentNotes(
  pluginName: string,
  agents: readonly WorkflowNoteAgent[],
  workflows: readonly WorkflowNoteScript[],
): readonly string[] {
  const join: AgentNoteJoin = {
    ownPrefix: `${pluginName}:`,
    installed: new Set(
      agents.map((agent) => declaredAgentName(pluginName, agent.sourceName, agent.namespace)),
    ),
    restricted: restrictedAgentTools(pluginName, agents),
  };

  return workflows.flatMap(({ verdict, scriptFile }) =>
    verdict.outcome === "named"
      ? scriptAgentNotes(join, verdict.fileName, scriptFile, verdict.agentTypes ?? [])
      : [],
  );
}

/**
 * Name preview, plus the workflow agent notes. The four
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
 * PG-SEC-01 and PG-WF-02: the workflow agent notes are the one output this
 * function reports. No staging pass builds them, because the join needs the
 * agents and the workflows together and each bridge sees only its own kind.
 * Each caller adds them at exactly one site, so a verb prints them once. They
 * are recomputed at every call, never stored, and never refuse an install
 * (D-PG4-13, D-PG8-04).
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
    workflowAgentNotes: workflowAgentNotes(
      plugin,
      agentsDiscovery.discovered,
      workflowsDiscovery.discovered,
    ),
  };
}
