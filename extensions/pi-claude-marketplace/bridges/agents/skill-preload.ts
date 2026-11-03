// bridges/agents/skill-preload.ts
//
// D-CF4-04: the content of the plugin skills a bridged agent preloads.
// Claude Code 2.1.316 gives a subagent each skill its `skills:` names as
// `Base directory for this skill: <skill dir>`, a blank line, and the
// `SKILL.md` body without its frontmatter. It preloads only from the skills
// the model can invoke: a skill with `disable-model-invocation: true` is
// skipped, and so is a plugin skill with neither a `description` nor a
// `when_to_use`. pi-subagents hands a child only a skill's name and path, so
// the agents bridge writes the content into the agent itself; the converter
// places it after the agent body (a Pi gap: pi-subagents has no hook on a
// child's first message, where Claude Code puts it).
//
// The text comes from the skill's plugin source, never from the staged copy:
// an update or reinstall prepares every bridge before any commits, so the
// staged copy may still hold the previous version. The body gets the skills
// bridge's two transforms in its order: same-plugin references, then the
// Claude variables, with `${CLAUDE_SKILL_DIR}` at the staged skill folder.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { rewriteMarkdownReferences } from "../../domain/skill-tokens.ts";
import { parseFrontmatter } from "../../platform/pi-api.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { preloadedSkillNames } from "./convert.ts";

import type { AgentSkillSource, DiscoveredAgent, SkillPreload } from "./types.ts";
import type { InstalledReferenceNames } from "../../domain/skill-tokens.ts";

/** The arguments of `readSkillPreloads`. */
export interface ReadSkillPreloadsInput {
  readonly discovered: readonly DiscoveredAgent[];
  readonly knownSkills: readonly string[];
  readonly skillSources?: readonly AgentSkillSource[] | undefined;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  /** SUB-02: present only for a project-scope install. */
  readonly projectDir?: string | undefined;
  readonly referenceNames: InstalledReferenceNames;
}

/**
 * D-CF4-04: the preload of each source row whose skill some agent's
 * `skills:` names, keyed by generated skill name. A row no agent names is
 * not read. A read error propagates.
 */
export async function readSkillPreloads(
  input: ReadSkillPreloadsInput,
): Promise<ReadonlyMap<string, SkillPreload>> {
  const named = new Set(
    input.discovered.flatMap((agent) =>
      preloadedSkillNames(agent.raw.skills, input.pluginName, input.knownSkills),
    ),
  );
  const rows = (input.skillSources ?? []).filter((row) => named.has(row.generatedName));
  const preloads = await Promise.all(
    rows.map(async (row) => {
      const text = await readFile(path.join(row.sourcePath, "SKILL.md"), "utf8");
      return [row.generatedName, skillPreload(text, row, input)] as const;
    }),
  );
  return new Map(preloads);
}

function skillPreload(
  text: string,
  row: AgentSkillSource,
  input: ReadSkillPreloadsInput,
): SkillPreload {
  let parsed: { frontmatter: Record<string, unknown>; body: string };
  try {
    parsed = parseFrontmatter(text);
  } catch {
    return { kind: "skip", reason: "unparseable" };
  }

  const { frontmatter, body } = parsed;
  if (frontmatter["disable-model-invocation"] === true) {
    return { kind: "skip", reason: "disable-model-invocation" };
  }

  if (!isNonBlank(frontmatter.description) && !isNonBlank(frontmatter.when_to_use)) {
    return { kind: "skip", reason: "no-description" };
  }

  const rewritten = rewriteMarkdownReferences(body.trim(), input.pluginName, input.referenceNames);
  const substituted = substituteClaudeVars(rewritten, {
    pluginRoot: input.pluginRoot,
    pluginData: input.pluginDataDir,
    skillDir: row.targetPath,
    projectDir: input.projectDir,
  });
  return {
    kind: "inline",
    text: `Base directory for this skill: ${row.targetPath}\n\n${substituted}`,
  };
}

function isNonBlank(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}
