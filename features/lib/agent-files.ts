/**
 * @fileoverview Writes the agents of a published plugin: one markdown file
 * per agent. `publishAgentFile` writes one agent at `agents/<name>.md` inside
 * the plugin (HAR-07, D-CF1-08). `publishAgentFiles` writes the rows of an
 * agents table, each at its own path under `agents/`, so a scenario can name
 * nested, hidden, or frontmatter-less files (AGT-01, D-CF4-01).
 */

import path from "node:path";

import { writePublishedPluginFile, writePublishedPluginFiles } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";
import type { DataTable } from "@cucumber/cucumber";

/** An agent of a plugin: its name, its description, and the body after its frontmatter. */
export interface PluginAgent {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

/** Returns the text of the agent file of `agent`: its frontmatter, then its body. */
export function agentFileText(agent: PluginAgent): string {
  return `---\nname: ${agent.name}\ndescription: ${agent.description}\n---\n\n${agent.body}\n`;
}

/**
 * Writes `agent` into the published plugin `plugin`, which must not hold it
 * yet, and returns the path of its file.
 */
export async function publishAgentFile(
  published: PublishedMarketplace,
  plugin: string,
  agent: PluginAgent,
): Promise<string> {
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("agents", `${agent.name}.md`),
    agentFileText(agent),
  );
}

/**
 * One row of an agents table: the file's path under the plugin's `agents/`
 * folder, its frontmatter as ordered `[key, value]` pairs, and its body.
 */
export interface AgentFileRow {
  readonly file: string;
  readonly frontmatter: readonly (readonly [string, string])[];
  readonly body: string;
}

const REQUIRED_AGENT_COLUMNS = ["file", "body"] as const;

/**
 * Reads an agents table. The header must hold `file` and `body`; every other
 * column is a frontmatter key, in column order, and an empty cell leaves its
 * key out of that row. Gherkin reads `\n` in a cell as a newline.
 */
export function readAgentFileRows(table: DataTable): AgentFileRow[] {
  const [header = [], ...rows] = table.raw();
  const missing = REQUIRED_AGENT_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`the agents table has no ${missing.join(" or ")} column`);
  }

  return rows.map((cells) => {
    const cell = (column: string): string => cells[header.indexOf(column)] ?? "";
    const frontmatter = header
      .map((key, index) => [key, cells[index] ?? ""] as const)
      .filter(
        ([key, value]) =>
          value !== "" && !(REQUIRED_AGENT_COLUMNS as readonly string[]).includes(key),
      );
    return { file: cell("file"), frontmatter, body: cell("body") };
  });
}

/**
 * Returns the text of the agent file of `row`: a frontmatter block with one
 * `key: value` line per pair, a blank line, then the body. A row with no
 * pair is only its body, with no frontmatter block.
 */
export function agentRowText(row: AgentFileRow): string {
  if (row.frontmatter.length === 0) {
    return `${row.body}\n`;
  }

  const lines = row.frontmatter.map(([key, value]) => `${key}: ${value}\n`).join("");
  return `---\n${lines}---\n\n${row.body}\n`;
}

/**
 * Writes every row into the published plugin `plugin` at `agents/<file>` as
 * one publication change, replacing a file that exists, and returns the
 * paths of the written files in row order.
 */
export async function publishAgentFiles(
  published: PublishedMarketplace,
  plugin: string,
  rows: readonly AgentFileRow[],
): Promise<string[]> {
  const files = Object.fromEntries(
    rows.map((row) => [path.join("agents", row.file), agentRowText(row)]),
  );
  await writePublishedPluginFiles(published, plugin, files);
  return rows.map((row) => path.join(published.root, "plugins", plugin, "agents", row.file));
}
