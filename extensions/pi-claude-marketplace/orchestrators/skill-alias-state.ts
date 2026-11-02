// orchestrators/skill-alias-state.ts
//
// D-CF2-02: the slash names a user can type for a bridged skill besides
// `/skill:<generated name>`. They are exactly Claude Code 2.1.316's names for
// the skill, which install stored in the record line of each staged
// `SKILL.md` (`readSkillRecord`); this module reads them back at session time
// and never reads the plugin source.
//
// P3-DC-07: a bridged command with a frontmatter `name` also answers to
// `<plugin>:<name>` and, for a name with no `:`, the bare `<name>`, as Claude
// Code 2.1.316 names it (03-UPSTREAM-EVIDENCE, supplementary observations).
// The staged command keeps its source frontmatter, so its names are read from
// the staged file at session time with the skills' own rule
// (`frontmatterNameAliases`).
//
// A name goes to the first skill or command that claims it, in loader order:
// the user root before the project root, and state order within a root. Every
// skill claims before any command, so a command alias never takes a name a
// skill already answers to. SK-6: a name that a Pi command of another source
// already has stays with that command.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { commandFileDigest } from "../bridges/commands/project-ledger.ts";
import { frontmatterNameAliases, readSkillRecord } from "../bridges/skills/skill-names.ts";
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
          Record<
            string,
            {
              readonly resources: {
                readonly skills: readonly string[];
                readonly prompts?: readonly string[];
              };
            }
          >
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

/** What a plugin alias stands for: a bridged skill or a bridged command. */
export type PluginAliasTarget =
  | { readonly kind: "skill"; readonly generatedName: string }
  | { readonly kind: "command"; readonly name: string };

const DEFAULT_DEPENDENCIES: SkillAliasDependencies = {
  loadState,
  getAgentDir,
  readFile: (file) => readFile(file, "utf8"),
  listSkillTree: NODE_SKILL_TREE_LISTER,
};

/** A skill or command of the state whose staged file Pi has loaded. */
interface LoadedEntry {
  readonly pluginName: string;
  /** The generated skill name, or the command's Pi name. */
  readonly name: string;
  readonly file: string;
  /**
   * D-CF2-13 / D-CF3-07: for a project entry, the digests the user's project
   * ledger lists for the project; `undefined` for a user entry.
   */
  readonly proven: ReadonlyMap<string, string> | undefined;
}

/** How one kind of bridged resource is found, proven, and named. */
interface AliasKind {
  /** The Pi command source that loads the kind. */
  readonly source: "skill" | "prompt";
  /** The names a plugin record lists for the kind. */
  readonly resources: (record: {
    readonly skills: readonly string[];
    readonly prompts?: readonly string[];
  }) => readonly string[];
  /** The staged file of `name` under the scope root `root`. */
  readonly stagedFile: (root: string, name: string) => string;
  /** The digest the ledger must list for the entry whose staged file holds `content`. */
  readonly digest: (
    entry: LoadedEntry,
    content: string,
    listSkillTree: SkillTreeLister,
  ) => Promise<string>;
  /** The names the entry claims, read from its staged frontmatter. */
  readonly names: (entry: LoadedEntry, frontmatter: Record<string, unknown>) => readonly string[];
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
function legacyAliases(skill: LoadedEntry): readonly string[] {
  const suffix = skillSuffix(skill.pluginName, skill.name);
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

const SKILL_KIND: AliasKind = {
  source: "skill",
  resources: (record) => record.skills,
  stagedFile: (root, name) =>
    path.join(root, "pi-claude-marketplace", "resources", "skills", name, "SKILL.md"),
  // WR-03: the digest covers every file of the staged skill directory.
  digest: async (entry, content, listSkillTree) =>
    skillTreeDigest(await listSkillTree(path.dirname(entry.file)), content),
  names: (entry, frontmatter) => {
    const record = readSkillRecord(frontmatter);
    return record === undefined
      ? legacyAliases(entry)
      : installedForms(entry.pluginName, record.names);
  },
};

const COMMAND_KIND: AliasKind = {
  source: "prompt",
  resources: (record) => record.prompts ?? [],
  stagedFile: (root, name) =>
    path.join(root, "pi-claude-marketplace", "resources", "prompts", `${name}.md`),
  digest: (_entry, content) => Promise.resolve(commandFileDigest(content)),
  names: (entry, frontmatter) => frontmatterNameAliases(entry.pluginName, frontmatter.name),
};

/**
 * D-CF2-13 / D-CF3-07 / WR-03: whether a project entry's staged file,
 * holding `content`, has the digest the user's project ledger lists. A user
 * entry (`proven` undefined) passes; a digest that cannot be taken fails.
 */
async function matchesLedger(
  kind: AliasKind,
  entry: LoadedEntry,
  content: string,
  listSkillTree: SkillTreeLister,
): Promise<boolean> {
  if (entry.proven === undefined) {
    return true;
  }

  const recorded = entry.proven.get(entry.name);
  try {
    return recorded === (await kind.digest(entry, content, listSkillTree));
  } catch {
    return false;
  }
}

/**
 * The names the staged file of `entry` claims; none when it cannot be read,
 * and none for a project entry that the user's project ledger does not list
 * with the digest of its staged file as it is now (D-CF2-13, WR-03).
 */
async function entryNames(
  kind: AliasKind,
  entry: LoadedEntry,
  dependencies: Pick<SkillAliasDependencies, "readFile" | "listSkillTree">,
): Promise<readonly string[]> {
  let content: string;
  let frontmatter: Record<string, unknown>;
  try {
    content = await dependencies.readFile(entry.file);
    frontmatter = parseFrontmatter(content).frontmatter;
  } catch {
    return [];
  }

  if (!(await matchesLedger(kind, entry, content, dependencies.listSkillTree))) {
    return [];
  }

  return kind.names(entry, frontmatter);
}

/** The entries of the state under `root` whose staged file Pi has loaded, in state order. */
function loadedEntries(
  kind: AliasKind,
  state: SkillAliasState,
  root: string,
  loadedPaths: ReadonlySet<string>,
  proven: ReadonlyMap<string, string> | undefined,
): readonly LoadedEntry[] {
  return Object.values(state.marketplaces)
    .flatMap((marketplace) => Object.entries(marketplace.plugins))
    .flatMap(([pluginName, plugin]) =>
      kind.resources(plugin.resources).map((name) => ({
        pluginName,
        name,
        file: path.resolve(kind.stagedFile(root, name)),
        proven,
      })),
    )
    .filter((entry) => loadedPaths.has(entry.file));
}

/** One scope root whose state could be read, with the ledger digests of a project root. */
interface ReadScope {
  readonly root: string;
  readonly state: SkillAliasState;
  readonly proven: ReadonlyMap<string, string> | undefined;
}

/**
 * The scope roots whose state can be read, user first. T-02-17: the project
 * root is read only when Pi trusts the project (`projectTrusted`), as Claude
 * Code loads no project-scope plugin before the workspace is trusted.
 * D-CF2-13 / D-CF3-07: a project root carries the user's ledger digests,
 * because the project's own `state.json` sits in the repository.
 */
async function readScopes(
  cwd: string,
  projectTrusted: boolean,
  resolved: SkillAliasDependencies,
): Promise<readonly ReadScope[]> {
  const agentDir = resolved.getAgentDir();
  const roots = [
    { root: agentDir, project: false },
    ...(projectTrusted ? [{ root: path.join(cwd, ".pi"), project: true }] : []),
  ];
  const scopes: ReadScope[] = [];
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
    scopes.push({ root, state, proven });
  }

  return scopes;
}

/**
 * D-CF2-02 / P3-DC-07: maps each name that a loaded entry of `kind` claims to
 * the entry's own name. The first claim wins, and a name that a Pi command of
 * another source has is never mapped (SK-6). A project entry claims names
 * only when the user's project ledger lists it (D-CF2-13, D-CF3-07).
 */
async function kindAliases(
  kind: AliasKind,
  commands: ReturnType<ExtensionAPI["getCommands"]>,
  scopes: readonly ReadScope[],
  resolved: SkillAliasDependencies,
): Promise<ReadonlyMap<string, string>> {
  const reserved = new Set(
    commands.filter((command) => command.source !== "skill").map((command) => command.name),
  );
  const loadedPaths = new Set(
    commands
      .filter((command) => command.source === kind.source)
      .map((command) => path.resolve(command.sourceInfo.path)),
  );
  const entries = scopes.flatMap(({ root, state, proven }) =>
    loadedEntries(kind, state, root, loadedPaths, proven),
  );
  const claims = await Promise.all(
    entries.map(async (entry) => ({
      name: entry.name,
      names: await entryNames(kind, entry, resolved),
    })),
  );
  const aliases = new Map<string, string>();
  for (const { name, names } of claims) {
    for (const alias of names) {
      if (!reserved.has(alias) && !aliases.has(alias)) {
        aliases.set(alias, name);
      }
    }
  }

  return aliases;
}

/**
 * D-CF2-02 / P3-DC-07: the plugin alias table under the rules of
 * `kindAliases`: every name a loaded bridged skill stored, mapped to its
 * generated name, then each name that the frontmatter `name` of a loaded
 * bridged command gives it and no skill claimed, mapped to the command's Pi
 * name. A skill keeps every name it already answers to, as before commands
 * had aliases.
 */
export async function loadPluginAliases(
  pi: ExtensionAPI,
  cwd: string,
  projectTrusted: boolean,
  dependencies: Partial<SkillAliasDependencies> = {},
): Promise<ReadonlyMap<string, PluginAliasTarget>> {
  const resolved = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const commands = pi.getCommands();
  const scopes = await readScopes(cwd, projectTrusted, resolved);
  const [skills, prompts] = await Promise.all([
    kindAliases(SKILL_KIND, commands, scopes, resolved),
    kindAliases(COMMAND_KIND, commands, scopes, resolved),
  ]);
  const aliases = new Map<string, PluginAliasTarget>();
  for (const [alias, generatedName] of skills) {
    aliases.set(alias, { kind: "skill", generatedName });
  }

  for (const [alias, name] of prompts) {
    if (!aliases.has(alias)) {
      aliases.set(alias, { kind: "command", name });
    }
  }

  return aliases;
}
