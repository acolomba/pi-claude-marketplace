import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { errorMessage } from "../errors.ts";
import { pathExists } from "../fs-utils.ts";
import { generateSkillName, substitutePluginVars } from "../plugin/vars.ts";
import { assertPathInside, assertSafeName, resolveContainedPath } from "../validation.ts";

import type { ResolvedPluginInstallable } from "../plugin/resolve.ts";
import type { Dirent } from "node:fs";

export interface DiscoveredSkill {
  name: string;
  generatedName: string;
  skillDir: string; // absolute path to the skill directory containing SKILL.md
}

export interface DiscoveredCommand {
  name: string;
  generatedName: string;
  commandFile: string; // absolute path to the .md file
}

export interface DiscoveredResources {
  skills: DiscoveredSkill[];
  commands: DiscoveredCommand[];
  /** Absolute path to the resolved agents/ dir, or `undefined` if the plugin
   *  declares no agents component or the resolved directory does not exist.
   *  Discovery of the actual agent files is delegated to agents.ts so the
   *  staging API owns frontmatter parsing and conversion. */
  agentsDir?: string;
}

export function generateCommandName(pluginName: string, commandName: string): string {
  assertSafeName(pluginName, "plugin name");
  assertSafeName(commandName, "command name");
  const withoutPrefix = commandName.startsWith(pluginName + "-")
    ? commandName.slice(pluginName.length + 1)
    : commandName;
  const generatedName = pluginName + ":" + withoutPrefix;
  assertSafeName(generatedName, "generated command name");
  return generatedName;
}

export async function discoverPluginResources(
  resolved: ResolvedPluginInstallable,
): Promise<DiscoveredResources> {
  const skills: DiscoveredSkill[] = [];
  const commands: DiscoveredCommand[] = [];

  const skillsComponent = await readComponentDirectory(resolved, "skills");
  if (skillsComponent !== undefined) {
    for (const entry of skillsComponent.entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      assertSafeName(entry.name, `skill directory name in ${skillsComponent.dir}`);
      const skillDir = path.join(skillsComponent.dir, entry.name);
      if (!(await pathExists(path.join(skillDir, "SKILL.md")))) {
        continue;
      }

      skills.push({
        name: entry.name,
        generatedName: generateSkillName(resolved.name, entry.name),
        skillDir,
      });
    }
  }

  const commandsComponent = await readComponentDirectory(resolved, "commands");
  if (commandsComponent !== undefined) {
    for (const entry of commandsComponent.entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const commandName = entry.name.slice(0, -3); // strip .md
      commands.push({
        name: commandName,
        generatedName: generateCommandName(resolved.name, commandName),
        commandFile: path.join(commandsComponent.dir, entry.name),
      });
    }
  }

  // Resolve the agents directory if declared; agents.ts handles content
  // discovery. Explicit manifest paths must exist; implicit conventional
  // paths remain optional.
  let agentsDir: string | undefined;
  if (resolved.componentPaths.agents !== undefined) {
    agentsDir = await resolveComponentDirectory(resolved, "agents");
  }

  const result: DiscoveredResources = { skills, commands };
  if (agentsDir !== undefined) {
    result.agentsDir = agentsDir;
  }

  return result;
}

async function readComponentDirectory(
  resolved: ResolvedPluginInstallable,
  key: "skills" | "commands",
): Promise<{ dir: string; entries: Dirent[] } | undefined> {
  const dir = await resolveComponentDirectory(resolved, key);
  if (dir === undefined) {
    return undefined;
  }

  return { dir, entries: await readdir(dir, { withFileTypes: true }) };
}

async function resolveComponentDirectory(
  resolved: ResolvedPluginInstallable,
  key: "skills" | "commands" | "agents",
): Promise<string | undefined> {
  const rawPath = resolved.componentPaths[key];
  if (rawPath === undefined) {
    return undefined;
  }

  const dir = resolveContainedPath(
    resolved.pluginRoot,
    rawPath,
    `${key} component path for plugin "${resolved.name}"`,
  );
  try {
    const s = await stat(dir);
    if (s.isDirectory()) {
      return dir;
    }

    if ((resolved.componentPathSources?.[key] ?? "explicit") === "explicit") {
      throw new Error(
        `Plugin "${resolved.name}" declares ${key} at "${rawPath}", but it is not a directory.`,
      );
    }

    return undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (
      (code === "ENOENT" || code === "ENOTDIR") &&
      (resolved.componentPathSources?.[key] ?? "explicit") !== "explicit"
    ) {
      return undefined;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new Error(
        `Plugin "${resolved.name}" declares ${key} at "${rawPath}", but that directory does not exist.`,
        { cause: err },
      );
    }

    throw err;
  }
}

export interface StageResourcesInput {
  pluginName: string;
  pluginRoot: string;
  pluginDataDir: string;
  skills: DiscoveredSkill[];
  commands: DiscoveredCommand[];
  stagingDir: string;
}

export interface StagedResources {
  skills: string[]; // generated skill names
  prompts: string[]; // generated command names (prompt template names)
}

export async function stagePluginResources(input: StageResourcesInput): Promise<StagedResources> {
  const { pluginRoot, pluginDataDir, skills, commands, stagingDir } = input;
  assertSafeName(input.pluginName, "plugin name");

  const skillsOutDir = path.join(stagingDir, "skills");
  const promptsOutDir = path.join(stagingDir, "prompts");

  const stagedSkills: string[] = [];
  const stagedPrompts: string[] = [];

  for (const skill of skills) {
    assertSafeName(skill.generatedName, "generated skill name");
    const destDir = path.join(skillsOutDir, skill.generatedName);
    assertPathInside(skillsOutDir, destDir, "staged skill destination");
    // Copy entire skill directory recursively
    await cp(skill.skillDir, destDir, { recursive: true });

    // Rewrite SKILL.md frontmatter name and substitute variables
    const skillMdPath = path.join(destDir, "SKILL.md");
    let content = await readFile(skillMdPath, "utf8");
    content = rewriteFrontmatterName(content, skill.generatedName);
    content = substitutePluginVars(content, pluginRoot, pluginDataDir);
    await writeFile(skillMdPath, content, "utf8");

    stagedSkills.push(skill.generatedName);
  }

  if (commands.length > 0) {
    await mkdir(promptsOutDir, { recursive: true });
  }

  for (const command of commands) {
    assertSafeName(command.generatedName, "generated command name");
    const destFile = path.join(promptsOutDir, command.generatedName + ".md");
    assertPathInside(promptsOutDir, destFile, "staged prompt destination");
    let content = await readFile(command.commandFile, "utf8");
    content = substitutePluginVars(content, pluginRoot, pluginDataDir);
    await writeFile(destFile, content, "utf8");

    stagedPrompts.push(command.generatedName);
  }

  return { skills: stagedSkills, prompts: stagedPrompts };
}

export async function resolvePluginVersion(
  pluginRoot: string,
  marketplaceEntryVersion: string | undefined,
): Promise<string> {
  // 1. Plugin manifest version. Absent or version-less manifests fall through;
  //    real I/O errors (EACCES, etc.) and JSON syntax errors propagate so a
  //    corrupted plugin is not silently recorded as version "unknown".
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  let raw: string | undefined;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") {
      throw err;
    }
  }

  if (raw !== undefined) {
    let manifest: { version?: string };
    try {
      manifest = JSON.parse(raw) as { version?: string };
    } catch (err) {
      throw new Error(`Failed to parse plugin manifest at ${manifestPath}: ${errorMessage(err)}`, {
        cause: err,
      });
    }

    if (manifest.version !== undefined && manifest.version !== "") {
      return manifest.version;
    }
  }

  // 2. Marketplace entry version
  if (marketplaceEntryVersion !== undefined && marketplaceEntryVersion !== "") {
    return marketplaceEntryVersion;
  }

  // 3. Stable content hash of plugin directory file contents (fallback).
  //    ENOENT/ENOTDIR here means the plugin dir vanished mid-flight (race
  //    with concurrent uninstall, partial install, etc.); surfacing the
  //    cause beats recording "unknown" -- two installs of the same broken
  //    plugin would both record "unknown" and updatePlugin's
  //    `toVersion === fromVersion` short-circuit would mask the breakage
  //    forever.
  try {
    const hash = createHash("sha256");
    await hashDirectory(pluginRoot, hash);
    return "hash-" + hash.digest("hex").slice(0, 12);
  } catch (err) {
    throw new Error(
      `Failed to compute version hash for plugin at ${pluginRoot}: ${errorMessage(err)}`,
      { cause: err },
    );
  }
}

async function hashDirectory(dirPath: string, hash: ReturnType<typeof createHash>): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);
    hash.update(entry.name);
    if (entry.isDirectory()) {
      await hashDirectory(fullPath, hash);
    } else if (entry.isFile()) {
      hash.update(await readFile(fullPath));
    }
  }
}

function rewriteFrontmatterName(content: string, newName: string): string {
  // YAML frontmatter is delimited by --- lines at the top
  if (!content.startsWith("---")) {
    // No frontmatter -- add it
    return `---\nname: ${newName}\n---\n\n${content}`;
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    // Malformed frontmatter -- prepend new one
    return `---\nname: ${newName}\n---\n\n${content}`;
  }

  const frontmatter = content.slice(3, end);
  const body = content.slice(end + 4); // skip \n---

  // Replace or add name: field
  const nameRegex = /^name:.*$/m;
  let newFrontmatter: string;
  if (nameRegex.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(nameRegex, `name: ${newName}`);
  } else {
    newFrontmatter = `\nname: ${newName}` + frontmatter;
  }

  return `---${newFrontmatter}\n---${body}`;
}
