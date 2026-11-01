// orchestrators/skill-alias-state.ts
//
// D-CF2-02: the slash names a user can type for a bridged skill besides
// `/skill:<generated name>`. They are exactly Claude Code 2.1.316's names for
// the skill, which install stored in the record line of each staged
// `SKILL.md` (`readSkillRecord`); this module reads them back at session time
// and never reads the plugin source.
//
// A name goes to the first skill that claims it, in loader order: the user
// root before the project root, and state order within a root. SK-6: a name
// that a Pi command of another source already has stays with that command.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readSkillRecord } from "../bridges/skills/skill-names.ts";
import { generatedSkillName } from "../domain/name.ts";
import {
  NODE_SKILL_TREE_LISTER,
  provenProjectSkills,
  skillTreeDigest,
} from "../persistence/project-installs.ts";
import { loadState } from "../persistence/state-io.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";

import type { SkillTreeLister } from "../persistence/project-installs.ts";
import type { ExtensionAPI } from "../platform/pi-api.ts";

export interface SkillAliasState {
  readonly marketplaces: Readonly<
    Record<
      string,
      {
        readonly plugins: Readonly<
          Record<string, { readonly resources: { readonly skills: readonly string[] } }>
        >;
      }
    >
  >;
}

export interface SkillAliasDependencies {
  readonly loadState: (extensionRoot: string) => Promise<SkillAliasState>;
  readonly getAgentDir: () => string;
  readonly readFile: (file: string) => Promise<string>;
  /** Lists the files and symbolic links of a staged skill directory (WR-03). */
  readonly listSkillTree: SkillTreeLister;
}

const DEFAULT_DEPENDENCIES: SkillAliasDependencies = {
  loadState,
  getAgentDir,
  readFile: (file) => readFile(file, "utf8"),
  listSkillTree: NODE_SKILL_TREE_LISTER,
};

/** A skill of the state whose staged `SKILL.md` Pi has loaded. */
interface LoadedSkill {
  readonly pluginName: string;
  readonly generatedName: string;
  readonly skillPath: string;
  /**
   * D-CF2-13: for a project skill, the digests the user's project ledger
   * lists for the project; `undefined` for a user skill.
   */
  readonly proven: ReadonlyMap<string, string> | undefined;
}

/** Removes the plugin prefix from a generated Pi skill name. */
function skillSuffix(pluginName: string, generatedName: string): string | undefined {
  let prefix: string;
  try {
    prefix = generatedSkillName(pluginName, pluginName);
  } catch {
    return undefined;
  }

  if (generatedName === prefix) {
    return prefix;
  }

  return generatedName.startsWith(`${prefix}-`)
    ? generatedName.slice(prefix.length + 1)
    : undefined;
}

/**
 * DC-25 item 1: the one alias of a skill staged before install stored its
 * names, derived from its generated name with the plugin prefix cut off. Claude
 * Code has no such name; the skill keeps it until its plugin is staged again.
 */
function legacyAliases(skill: LoadedSkill): readonly string[] {
  const suffix = skillSuffix(skill.pluginName, skill.generatedName);
  return suffix === undefined ? [] : [`${skill.pluginName}:${suffix}`];
}

/**
 * D-CF2-02 / T-02-17: the stored names in the forms install writes for a skill
 * of `pluginName`: names under the plugin's own prefix, and the one bare
 * frontmatter name. A record that claims other names was not written by
 * install for this plugin, so those names are dropped.
 */
function installedForms(pluginName: string, names: readonly string[]): readonly string[] {
  const prefix = `${pluginName}:`;
  const bare = names.find((name) => !name.includes(":"));
  return names.filter((name) => name.startsWith(prefix) || name === bare);
}

/**
 * D-CF2-13 / WR-03: whether a project skill's staged directory, `content`
 * standing for its `SKILL.md`, has the digest the user's project ledger
 * lists. A user skill (`proven` undefined) passes; a directory that cannot be
 * listed fails.
 */
async function matchesLedger(
  skill: LoadedSkill,
  content: string,
  listSkillTree: SkillTreeLister,
): Promise<boolean> {
  if (skill.proven === undefined) {
    return true;
  }

  const recorded = skill.proven.get(skill.generatedName);
  try {
    return (
      recorded === skillTreeDigest(await listSkillTree(path.dirname(skill.skillPath)), content)
    );
  } catch {
    return false;
  }
}

/**
 * The names stored in the staged `SKILL.md` of `skill`; none when it cannot
 * be read, and none for a project skill that the user's project ledger does
 * not list with the digest of its directory as it is now (D-CF2-13, WR-03).
 */
async function skillNames(
  skill: LoadedSkill,
  dependencies: Pick<SkillAliasDependencies, "readFile" | "listSkillTree">,
): Promise<readonly string[]> {
  let content: string;
  let frontmatter: Record<string, unknown>;
  try {
    content = await dependencies.readFile(skill.skillPath);
    frontmatter = parseFrontmatter(content).frontmatter;
  } catch {
    return [];
  }

  if (!(await matchesLedger(skill, content, dependencies.listSkillTree))) {
    return [];
  }

  const record = readSkillRecord(frontmatter);
  return record === undefined
    ? legacyAliases(skill)
    : installedForms(skill.pluginName, record.names);
}

/** The skills of the state under `root` whose staged file Pi has loaded, in state order. */
function loadedSkills(
  state: SkillAliasState,
  root: string,
  loadedPaths: ReadonlySet<string>,
  proven: ReadonlyMap<string, string> | undefined,
): readonly LoadedSkill[] {
  const skillsDir = path.resolve(root, "pi-claude-marketplace", "resources", "skills");
  return Object.values(state.marketplaces)
    .flatMap((marketplace) => Object.entries(marketplace.plugins))
    .flatMap(([pluginName, plugin]) =>
      plugin.resources.skills.map((generatedName) => ({
        pluginName,
        generatedName,
        skillPath: path.join(skillsDir, generatedName, "SKILL.md"),
        proven,
      })),
    )
    .filter((skill) => loadedPaths.has(skill.skillPath));
}

/**
 * D-CF2-02: maps each name that a loaded bridged skill stored to its
 * generated name. The first claim wins, and a name that `reserved` holds is
 * never mapped (SK-6). T-02-17: the project root is read only when Pi trusts
 * the project (`projectTrusted`), as Claude Code loads no project-scope
 * plugin before the workspace is trusted. D-CF2-13: a project skill claims
 * names only when the user's project ledger lists it, because the project's
 * own `state.json` sits in the repository.
 */
export async function loadQualifiedSkillAliases(
  pi: ExtensionAPI,
  cwd: string,
  projectTrusted: boolean,
  dependencies: Partial<SkillAliasDependencies> = {},
): Promise<ReadonlyMap<string, string>> {
  const resolved = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const commands = pi.getCommands();
  const reserved = new Set(
    commands.filter((command) => command.source !== "skill").map((command) => command.name),
  );
  const loadedPaths = new Set(
    commands
      .filter((command) => command.source === "skill")
      .map((command) => path.resolve(command.sourceInfo.path)),
  );
  const skills: LoadedSkill[] = [];
  const agentDir = resolved.getAgentDir();
  const roots = [
    { root: agentDir, project: false },
    ...(projectTrusted ? [{ root: path.join(cwd, ".pi"), project: true }] : []),
  ];
  for (const { root, project } of roots) {
    let state: SkillAliasState;
    try {
      // eslint-disable-next-line no-await-in-loop -- two scope roots, one state read each
      state = await resolved.loadState(path.join(root, "pi-claude-marketplace"));
    } catch {
      continue;
    }

    const proven = project
      ? // eslint-disable-next-line no-await-in-loop -- the project root alone reads the ledger
        await provenProjectSkills(agentDir, cwd, resolved.readFile)
      : undefined;
    skills.push(...loadedSkills(state, root, loadedPaths, proven));
  }

  const claims = await Promise.all(
    skills.map(async (skill) => ({
      generatedName: skill.generatedName,
      names: await skillNames(skill, resolved),
    })),
  );
  const aliases = new Map<string, string>();
  for (const { generatedName, names } of claims) {
    for (const name of names) {
      if (!reserved.has(name) && !aliases.has(name)) {
        aliases.set(name, generatedName);
      }
    }
  }

  return aliases;
}
