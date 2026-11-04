/**
 * @fileoverview pi-subagents texts a scenario reads, reduced to the facts
 * this extension owns. pi-subagents words its agent list, agent detail, run
 * wrapper, errors, and child task message itself, and a release may reword
 * any of them, so no feature file states that wording.
 *
 * The facts this extension owns are what the agents bridge writes into a
 * staged agent file: the agent's name, its path, its description and
 * aliases, the tools, model, and thinking level it converts, the flags it
 * sets, and the body, preloaded skills included. A projection keeps those
 * facts in a form of our own:
 *
 * - an agent list: one line per bridged agent, sorted by name,
 *   `agent <name>, aliases <aliases>: <description>`, and in the
 *   capabilities form `; tools <tools>`, `; excluded tools <tools>`,
 *   `; model <model>`, and `; thinking <level>` after it for each value the
 *   agent sets. pi-subagents' own agents, such as its builtins, read as one
 *   line `pi-subagents' own agents`. An empty list reads `no agents`;
 * - an agent detail: one `<field> <value>` line per field this extension
 *   writes, in a fixed order, then `system prompt:` and the body;
 * - a run: the child's final text alone;
 * - an error: `error`, or `error naming <value>, <value>` with each value
 *   that this extension wrote and the error names: a model id, an adapter
 *   selector `plugin_<plugin>_<server>_/<tool>`, or a built-in server or
 *   selector `plugin_<plugin>_<server>[/<tool>]`.
 *
 * Headings, counts, hints, the run's budget and mission lines, and every
 * field pi-subagents fills in itself are dropped. Each reader anchors on the
 * line structure and on the values above, and throws on a text it cannot
 * read, so a real format break fails the scenario with the text in the
 * message.
 */

// A run result ends with the id of the mission pi-subagents files it under.
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/u;

// The run's fan-out budget line, such as `1/64 used`, before the child's text.
const BUDGET_PATTERN = /\b\d+\s*\/\s*\d+\b/u;

// One agent of a list: `- <name> (<source>, <metadata>): <description>`.
const LIST_LINE_PATTERN = /^-\s+(\S+)\s+\(([^)]*)\)(?::\s*(.*))?$/u;

// The empty list's one item.
const EMPTY_LIST_PATTERN = /^-\s*\(?none\)?$/iu;

// One `<label>: <value>` field of an agent detail.
const FIELD_PATTERN = /^([A-Za-z][A-Za-z -]*):\s*(.*)$/u;

// A value pi-subagents prints for a field the agent leaves unset, such as
// `default/ambient` tools or a model that `inherits current session`.
const UNSET_PATTERN = /\b(?:default|ambient|inherits?)\b/iu;

// The values an error can name that this extension wrote into an agent: a
// model id its model mapping produced, an MCP tool selector of a server key it
// wrote for pi-mcp-adapter (`plugin_<plugin>_<server>_/<tool>`), and a server
// name or selector it wrote for Pi's built-in MCP
// (`plugin_<plugin>_<server>[/<tool>]`, MGRT-01). The built-in alternative
// comes after the adapter one, so an adapter selector keeps its trailing `_`.
// It matches only a whole name that starts the text or follows a space, `(`,
// `:`, or `,`, and that no name character or `/` continues. So an adapter
// whole-server key `plugin_<plugin>_<server>_` and a path piece such as
// `/x/plugin_cache/y` project nothing, as they did before MGRT-01.
const OWNED_ERROR_VALUE_PATTERN =
  /\b(?:[a-z0-9-]+\/claude-[A-Za-z0-9.[\]-]*[A-Za-z0-9\]]|plugin_[A-Za-z0-9_-]*_\/[A-Za-z0-9_-]+|(?<=^|[\s(:,])plugin_[A-Za-z0-9_-]*[A-Za-z0-9-](?:\/[A-Za-z0-9_-]+)?(?![A-Za-z0-9_/-]))/gu;

// The sources an agent of this extension is listed under: the scopes the
// agents bridge stages into.
const OWN_SOURCES: ReadonlySet<string> = new Set(["user", "project"]);

// The detail fields this extension writes, by normalized label, in the
// order a projection lists them, each with the word the projection uses.
const DETAIL_FIELDS: readonly (readonly [string, string])[] = [
  ["agent", "agent"],
  ["path", "path"],
  ["description", "description"],
  ["aliases", "aliases"],
  ["model", "model"],
  ["tools", "tools"],
  ["excluded tools", "excluded tools"],
  ["skills", "skills"],
  ["thinking", "thinking"],
  ["system prompt mode", "system prompt mode"],
  ["inherit project context", "inherit project context"],
  ["inherit skills", "inherit skills"],
  ["async", "async"],
];

// The capability values this extension writes, by normalized label.
const CAPABILITY_FIELDS: ReadonlyMap<string, string> = new Map([
  ["tools", "tools"],
  ["excludes", "excluded tools"],
  ["excluded tools", "excluded tools"],
  ["model", "model"],
  ["thinking", "thinking"],
]);

const OWN_AGENTS_OF_PI_SUBAGENTS = "pi-subagents' own agents";

function unreadable(kind: string, text: string): Error {
  return new Error(`cannot read pi-subagents' ${kind}: ${JSON.stringify(text)}`);
}

function normalizedLabel(label: string): string {
  return label
    .toLowerCase()
    .replaceAll(/[^a-z]+/gu, " ")
    .trim();
}

// The value after `aliases:` in a list line's metadata, up to the next
// `<label>:` item.
function listAliases(metadata: string): string | undefined {
  const match = /\baliases:\s*(.*)$/u.exec(metadata);
  if (match?.[1] === undefined) {
    return undefined;
  }

  const items = match[1].split(/,\s*/u);
  const end = items.findIndex((item) => item.includes(":"));
  return (end === -1 ? items : items.slice(0, end)).join(", ");
}

// The capability values one capabilities-form line sets, in our words.
function capabilityValues(items: readonly string[]): string {
  return items
    .flatMap((item) => {
      const match = FIELD_PATTERN.exec(item);
      const word =
        match === null ? undefined : CAPABILITY_FIELDS.get(normalizedLabel(match[1] ?? ""));
      const value = match?.[2]?.trim() ?? "";
      return word === undefined || value === "" || UNSET_PATTERN.test(value)
        ? []
        : [`; ${word} ${value}`];
    })
    .join("");
}

// The description and the set capability values of a list line's text after
// the metadata. The capabilities form starts with a `Description:` field.
function listDescription(rest: string): string {
  const capabilities = /^description:\s*/iu.exec(rest);
  if (capabilities === null) {
    return rest;
  }

  const [description = "", ...items] = rest.slice(capabilities[0].length).split(/;\s+/u);
  return `${description}${capabilityValues(items)}`;
}

interface ListedAgent {
  readonly name: string;
  readonly line: string | undefined;
}

function listedAgent(line: string, text: string): ListedAgent | undefined {
  const match = LIST_LINE_PATTERN.exec(line);
  if (match === null) {
    return undefined;
  }

  const [, name = "", metadata = "", rest = ""] = match;
  const source = metadata.split(",")[0]?.trim() ?? "";
  if (!OWN_SOURCES.has(source)) {
    return { name, line: undefined };
  }

  const aliases = listAliases(metadata);
  if (aliases === undefined) {
    throw unreadable("agent list", text);
  }

  return { name, line: `agent ${name}, aliases ${aliases}: ${listDescription(rest)}` };
}

function projectList(text: string): string {
  const lines = text.split("\n").map((line) => line.trim());
  const agents = lines.flatMap((line) => {
    const agent = listedAgent(line, text);
    return agent === undefined ? [] : [agent];
  });
  if (agents.length === 0) {
    if (!lines.some((line) => EMPTY_LIST_PATTERN.test(line))) {
      throw unreadable("agent list", text);
    }

    return "no agents";
  }

  const own = agents
    .flatMap(({ line }) => (line === undefined ? [] : [line]))
    .sort((left, right) => (left < right ? -1 : Number(left > right)));
  const others = agents.some(({ line }) => line === undefined) ? [OWN_AGENTS_OF_PI_SUBAGENTS] : [];
  return [...own, ...others].join("\n");
}

// The `<label>: <value>` fields before the first blank line of a detail, by
// normalized label.
function detailFields(head: readonly string[]): ReadonlyMap<string, string> {
  return new Map(
    head.flatMap((line) => {
      const match = FIELD_PATTERN.exec(line);
      return match === null ? [] : [[normalizedLabel(match[1] ?? ""), (match[2] ?? "").trim()]];
    }),
  );
}

// An agent detail: the fields, a blank line, a `<label>:` line, and the body.
function projectDetail(text: string): string | undefined {
  const lines = text.split("\n");
  const blank = lines.indexOf("");
  const fields = detailFields(blank === -1 ? lines : lines.slice(0, blank));
  if (!fields.has("agent") || !fields.has("path")) {
    return undefined;
  }

  const projected = DETAIL_FIELDS.flatMap(([label, word]) => {
    const value = fields.get(label);
    // The agent field ends with the source pi-subagents found it under.
    const shown = label === "agent" ? value?.replace(/\s*\([^)]*\)$/u, "") : value;
    return shown === undefined ? [] : [`${word} ${shown}`];
  });
  if (blank === -1) {
    return projected.join("\n");
  }

  const [promptLabel, ...body] = lines.slice(blank + 1);
  if (promptLabel?.trimEnd().endsWith(":") !== true) {
    throw unreadable("agent detail", text);
  }

  return [...projected, "system prompt:", ...body].join("\n");
}

// A run: the budget line, the child's final text, and the mission line.
function projectRun(text: string): string | undefined {
  const lines = text.split("\n");
  const mission = lines.map((line) => UUID_PATTERN.test(line)).lastIndexOf(true);
  if (mission === -1) {
    return undefined;
  }

  const before = lines.slice(0, mission);
  const start = BUDGET_PATTERN.test(before[0] ?? "") ? 1 : 0;
  return [...before.slice(start), ...lines.slice(mission + 1)].join("\n").trim();
}

function projectError(text: string): string {
  const values = [...text.matchAll(OWNED_ERROR_VALUE_PATTERN)].map(([value]) => value);
  return values.length === 0 ? "error" : `error naming ${[...new Set(values)].join(", ")}`;
}

/** A pi-subagents tool result, reduced to the facts this extension owns. */
export function projectSubagentResult(text: string, failed: boolean): string {
  if (failed) {
    return projectError(text);
  }

  return projectRun(text) ?? projectDetail(text) ?? projectList(text);
}

// pi-subagents hands a child its task as the first user message, after a
// `Task:` label.
const CHILD_TASK_PATTERN = /^task:\s*/iu;

/** A user message pi-subagents writes into a child's conversation. */
export function projectChildTask(text: string): string {
  const label = CHILD_TASK_PATTERN.exec(text);
  return label === null ? text : `task ${text.slice(label[0].length)}`;
}
