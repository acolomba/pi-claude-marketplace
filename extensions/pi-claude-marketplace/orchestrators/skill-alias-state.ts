// orchestrators/skill-alias-state.ts
//
// D-CF2-02: the slash names a user can type for a bridged skill besides
// `/skill:<generated name>`. They are exactly Claude Code 2.1.316's names for
// the skill, which install stored in the record line of each staged
// `SKILL.md` (`readSkillRecord`); this module reads them back at session time
// and never reads the plugin source.
//
// D-CF2-02, extended to commands: a bridged command with a frontmatter `name`
// also answers to `<plugin>:<name>` and, for a name with no `:`, the bare
// `<name>`, as Claude Code 2.1.316 names it.
// The staged command keeps its source frontmatter, so its names are read from
// the staged file at session time with the skills' own rule
// (`frontmatterNameAliases`).
//
// A name goes to the first skill or command that claims it, in loader order:
// the user root before the project root, and state order within a root. Every
// skill claims before any command, so a command alias never takes a name a
// skill already answers to. SK-6: a name that a Pi command of another source
// already has stays with that command.
//
// D-PG6-18 / D-PG6-19: the same read pass gives the typed-line resolver the
// Claude-form name of each loaded bridged skill and the bridged commands Pi
// loaded. One cache (`createPluginNamesCache`) holds the table of a directory
// and trust state for a session, and the alias handler and the resolver share it.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { frontmatterNameAliases, readSkillRecord } from "../bridges/skills/skill-names.ts";
import { generatedSkillName } from "../domain/name.ts";
import { loadState } from "../persistence/state-io.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

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
}

/** What a plugin alias stands for: a bridged skill or a bridged command. */
export type PluginAliasTarget =
  | { readonly kind: "skill"; readonly generatedName: string }
  | { readonly kind: "command"; readonly name: string };

const DEFAULT_DEPENDENCIES: SkillAliasDependencies = {
  loadState,
  getAgentDir,
  readFile: (file) => readFile(file, "utf8"),
};

/** A skill or command of the state whose staged file Pi has loaded. */
interface LoadedEntry {
  readonly pluginName: string;
  /** The generated skill name, or the command's Pi name. */
  readonly name: string;
  readonly file: string;
}

/** How one kind of bridged resource is found and named. */
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
 * D-CF2-02 residual: the one alias of a skill staged before install stored its
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
  names: (entry, frontmatter) => frontmatterNameAliases(entry.pluginName, frontmatter.name),
};

/** The names the staged file of `entry` claims; none when it cannot be read. */
async function entryNames(
  kind: AliasKind,
  entry: LoadedEntry,
  dependencies: Pick<SkillAliasDependencies, "readFile">,
): Promise<readonly string[]> {
  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parseFrontmatter(await dependencies.readFile(entry.file)).frontmatter;
  } catch (err) {
    hookDebugLog(`skill aliases skip ${entry.file}: ${errorMessage(err)}`, "skills");
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
): readonly LoadedEntry[] {
  return Object.values(state.marketplaces)
    .flatMap((marketplace) => Object.entries(marketplace.plugins))
    .flatMap(([pluginName, plugin]) =>
      kind.resources(plugin.resources).map((name) => ({
        pluginName,
        name,
        file: path.resolve(kind.stagedFile(root, name)),
      })),
    )
    .filter((entry) => loadedPaths.has(entry.file));
}

/** One scope root whose state could be read. */
interface ReadScope {
  readonly root: string;
  readonly state: SkillAliasState;
}

/**
 * The scope roots whose state can be read, user first. T-02-17: the project
 * root is read only when Pi trusts the project (`projectTrusted`), as Claude
 * Code loads no project-scope plugin before the workspace is trusted.
 */
async function readScopes(
  cwd: string,
  projectTrusted: boolean,
  resolved: SkillAliasDependencies,
): Promise<readonly ReadScope[]> {
  const roots = [resolved.getAgentDir(), ...(projectTrusted ? [path.join(cwd, ".pi")] : [])];
  const scopes: ReadScope[] = [];
  for (const root of roots) {
    let state: SkillAliasState;
    try {
      // eslint-disable-next-line no-await-in-loop -- two scope roots, one state read each
      state = await resolved.loadState(path.join(root, "pi-claude-marketplace"));
    } catch (err) {
      hookDebugLog(`skill aliases skip the state under ${root}: ${errorMessage(err)}`, "skills");
      continue;
    }

    scopes.push({ root, state });
  }

  return scopes;
}

/** The names that the staged file of one loaded entry claims. */
interface EntryClaim {
  readonly entry: LoadedEntry;
  readonly names: readonly string[];
}

/** The claims of the loaded entries of `kind`, user root first, state order within a root. */
async function kindClaims(
  kind: AliasKind,
  commands: ReturnType<ExtensionAPI["getCommands"]>,
  scopes: readonly ReadScope[],
  resolved: SkillAliasDependencies,
): Promise<readonly EntryClaim[]> {
  const loadedPaths = new Set(
    commands
      .filter((command) => command.source === kind.source)
      .map((command) => path.resolve(command.sourceInfo.path)),
  );
  const entries = scopes.flatMap(({ root, state }) =>
    loadedEntries(kind, state, root, loadedPaths),
  );
  return Promise.all(
    entries.map(async (entry) => ({ entry, names: await entryNames(kind, entry, resolved) })),
  );
}

/**
 * D-CF2-02: maps each name that a claim holds to the entry's own name. The
 * first claim wins, and a name in `reserved`, which a Pi command of another
 * source has, is never mapped (SK-6).
 */
function claimedAliases(
  claims: readonly EntryClaim[],
  reserved: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const aliases = new Map<string, string>();
  for (const { entry, names } of claims) {
    for (const alias of names) {
      if (!reserved.has(alias) && !aliases.has(alias)) {
        aliases.set(alias, entry.name);
      }
    }
  }

  return aliases;
}

/**
 * D-PG6-19: the Claude-form name of each loaded bridged skill, by its generated
 * name: the first name it claims under its plugin's prefix, which is the stored
 * identity `<plugin>:<directory>`, or the legacy alias of a skill staged with
 * no record. It is the skill's own name even when another claimant took it as
 * an alias.
 */
function skillClaudeNames(claims: readonly EntryClaim[]): ReadonlyMap<string, string> {
  const skills = new Map<string, string>();
  for (const { entry, names } of claims) {
    const own = names.find((name) => name.startsWith(`${entry.pluginName}:`));
    if (own !== undefined) {
      skills.set(entry.name, own);
    }
  }

  return skills;
}

/** The names a user can type for the bridged skills and commands Pi has loaded. */
export interface PluginNames {
  /**
   * D-CF2-02: every name a loaded bridged skill stored, mapped to its generated
   * name, then each name that the frontmatter `name` of a loaded bridged
   * command gives it and no skill claimed, mapped to the command's Pi name. A
   * command alias never displaces a name a skill answers to.
   */
  readonly aliases: ReadonlyMap<string, PluginAliasTarget>;
  /** D-PG6-19: the Claude-form name of each loaded bridged skill, by its generated name. */
  readonly skills: ReadonlyMap<string, string>;
  /** D-PG6-19: the Pi names of the loaded bridged commands. */
  readonly commands: ReadonlySet<string>;
}

/** D-CF2-02 / D-PG6-18: the plugin name table of a directory and trust state, in one read pass. */
export async function loadPluginNames(
  pi: ExtensionAPI,
  cwd: string,
  projectTrusted: boolean,
  dependencies: Partial<SkillAliasDependencies> = {},
): Promise<PluginNames> {
  const resolved = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const commands = pi.getCommands();
  const reserved = new Set(
    commands.filter((command) => command.source !== "skill").map((command) => command.name),
  );
  const scopes = await readScopes(cwd, projectTrusted, resolved);
  const [skillClaims, commandClaims] = await Promise.all([
    kindClaims(SKILL_KIND, commands, scopes, resolved),
    kindClaims(COMMAND_KIND, commands, scopes, resolved),
  ]);
  const aliases = new Map<string, PluginAliasTarget>();
  for (const [alias, generatedName] of claimedAliases(skillClaims, reserved)) {
    aliases.set(alias, { kind: "skill", generatedName });
  }

  for (const [alias, name] of claimedAliases(commandClaims, reserved)) {
    if (!aliases.has(alias)) {
      aliases.set(alias, { kind: "command", name });
    }
  }

  return {
    aliases,
    skills: skillClaudeNames(skillClaims),
    commands: new Set(commandClaims.map(({ entry }) => entry.name)),
  };
}

/** The plugin name table of each directory and trust state, loaded once per session. */
export interface PluginNamesCache {
  readonly get: (cwd: string, projectTrusted: boolean) => Promise<PluginNames>;
  /** Empties the cache; the `session_start` handler of the alias handler calls it. */
  readonly clear: () => void;
}

/**
 * D-PG6-18: the one cache of the plugin name table, which the alias handler and
 * the typed-line resolver share; `load` is `loadPluginNames` in production.
 * Creating it calls nothing on `pi`.
 */
export function createPluginNamesCache(
  pi: ExtensionAPI,
  load: (pi: ExtensionAPI, cwd: string, projectTrusted: boolean) => Promise<PluginNames>,
): PluginNamesCache {
  // T-02-17: the table of an untrusted project leaves out its project skills,
  // so it is kept apart from the table of the same directory once trusted.
  const cache = new Map<string, Promise<PluginNames>>();
  return {
    get: (cwd, projectTrusted) => {
      const key = `${projectTrusted ? "trusted" : "untrusted"}\0${cwd}`;
      let names = cache.get(key);
      if (names === undefined) {
        const loading = load(pi, cwd, projectTrusted);
        names = loading;
        cache.set(key, loading);
        // A rejected load is not kept: the next lookup loads the table again.
        loading.catch(() => {
          if (cache.get(key) === loading) {
            cache.delete(key);
          }
        });
      }

      return names;
    },
    clear: () => {
      cache.clear();
    },
  };
}
