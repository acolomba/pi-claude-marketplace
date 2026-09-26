import path from "node:path";

import { generatedSkillName } from "../domain/name.ts";
import { loadState } from "../persistence/state-io.ts";
import { getAgentDir } from "../platform/pi-api.ts";

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
}

const DEFAULT_DEPENDENCIES: SkillAliasDependencies = { loadState, getAgentDir };

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

/** Adds only aliases whose recorded skill file Pi has loaded. */
function addPluginAliases(
  aliases: Map<string, string>,
  pluginName: string,
  generatedNames: readonly string[],
  root: string,
  loadedPaths: ReadonlySet<string>,
  reserved: ReadonlySet<string>,
): void {
  for (const generatedName of generatedNames) {
    const suffix = skillSuffix(pluginName, generatedName);
    if (suffix === undefined) {
      continue;
    }

    const alias = `${pluginName}:${suffix}`;
    const skillPath = path.resolve(
      root,
      "pi-claude-marketplace",
      "resources",
      "skills",
      generatedName,
      "SKILL.md",
    );
    if (loadedPaths.has(skillPath) && !reserved.has(alias)) {
      aliases.set(alias, generatedName);
    }
  }
}

/** Maps loaded plugin skills from state to their qualified slash names. */
export async function loadQualifiedSkillAliases(
  pi: ExtensionAPI,
  cwd: string,
  dependencies: SkillAliasDependencies = DEFAULT_DEPENDENCIES,
): Promise<ReadonlyMap<string, string>> {
  const commands = pi.getCommands();
  const reserved = new Set(
    commands.filter((command) => command.source !== "skill").map((command) => command.name),
  );
  const loadedPaths = new Set(
    commands
      .filter((command) => command.source === "skill")
      .map((command) => path.resolve(command.sourceInfo.path)),
  );
  const roots = [dependencies.getAgentDir(), path.join(cwd, ".pi")];
  const aliases = new Map<string, string>();

  for (const root of roots) {
    let state: SkillAliasState;
    try {
      state = await dependencies.loadState(path.join(root, "pi-claude-marketplace"));
    } catch {
      continue;
    }

    for (const marketplace of Object.values(state.marketplaces)) {
      for (const [pluginName, plugin] of Object.entries(marketplace.plugins)) {
        addPluginAliases(aliases, pluginName, plugin.resources.skills, root, loadedPaths, reserved);
      }
    }
  }

  return aliases;
}
