/**
 * @fileoverview Writes the skills of a published plugin: one `SKILL.md` per
 * skill, at `skills/<name>/SKILL.md` inside the plugin (HAR-07).
 */

import path from "node:path";

import { writePublishedPluginFile } from "./published-marketplace.ts";

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
