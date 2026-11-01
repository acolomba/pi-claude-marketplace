/**
 * @fileoverview Writes the agents of a published plugin: one markdown file
 * per agent, at `agents/<name>.md` inside the plugin (HAR-07, D-CF1-08).
 */

import path from "node:path";

import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

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
