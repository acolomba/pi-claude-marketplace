/**
 * @fileoverview Writes the slash commands of a published plugin: one
 * Markdown file per command, at `commands/<name>.md` inside the plugin
 * (HAR-07, D-CF1-08).
 */

import path from "node:path";

import { writePublishedPluginFile, writePublishedPluginFiles } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** A slash command of a plugin: its name, its description, and the body after its frontmatter. */
export interface PluginSlashCommand {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

/** Returns the text of the command file of `command`: its frontmatter, then its body. */
export function slashCommandFileText(command: PluginSlashCommand): string {
  return `---\ndescription: ${command.description}\n---\n\n${command.body}\n`;
}

/**
 * Writes `command` into the published plugin `plugin`, which must not hold it
 * yet, and returns the path of its command file.
 */
export async function publishSlashCommand(
  published: PublishedMarketplace,
  plugin: string,
  command: PluginSlashCommand,
): Promise<string> {
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("commands", `${command.name}.md`),
    slashCommandFileText(command),
  );
}

/**
 * Writes `text`, unchanged, as the whole command file of the command `name`
 * in the published plugin `plugin`, and returns the path of that file. A
 * `name` holding `/` writes a nested file (CM-4), and a file that exists is
 * replaced.
 */
export async function publishSlashCommandFile(
  published: PublishedMarketplace,
  plugin: string,
  name: string,
  text: string,
): Promise<string> {
  const relative = `commands/${name}.md`;
  await writePublishedPluginFiles(published, plugin, { [relative]: text });
  return path.join(published.root, "plugins", plugin, ...relative.split("/"));
}
