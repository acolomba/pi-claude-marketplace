/**
 * @fileoverview Writes the skills of a published plugin: one `SKILL.md` per
 * skill, at `skills/<name>/SKILL.md` inside the plugin (HAR-07), either built
 * from a name, a description, and a body, or written as a whole text.
 */

import path from "node:path";

import { writePublishedPluginFile, writePublishedPluginFiles } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** A skill of a plugin: its name, its description, and the body after its frontmatter. */
export interface PluginSkill {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

/** Returns the text of the `SKILL.md` of `skill`: its frontmatter, then its body. */
export function skillFileText(skill: PluginSkill): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}\n`;
}

/**
 * Writes `skill` into the published plugin `plugin`, which must not hold it
 * yet, and returns the path of its `SKILL.md`.
 */
export async function publishSkill(
  published: PublishedMarketplace,
  plugin: string,
  skill: PluginSkill,
): Promise<string> {
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("skills", skill.name, "SKILL.md"),
    skillFileText(skill),
  );
}

/**
 * Writes `text` as the whole `SKILL.md` of the skill directory `directory` in
 * the published plugin `plugin`, replacing a file that exists, and returns
 * the path of that `SKILL.md`.
 */
export async function publishSkillFile(
  published: PublishedMarketplace,
  plugin: string,
  directory: string,
  text: string,
): Promise<string> {
  const file = path.join("skills", directory, "SKILL.md");
  await writePublishedPluginFiles(published, plugin, { [file]: text });
  return path.join(published.root, "plugins", plugin, file);
}
