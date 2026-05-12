import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { AggregateResourcesDiscoverError } from "../shared/errors.ts";

import type { ScopedLocations } from "../persistence/locations.ts";
import type { ResourcesDiscoverFailure } from "../shared/errors.ts";
import type { Dirent } from "node:fs";

export interface DiscoveredResources {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
}

type ResourceKind = ResourcesDiscoverFailure["kind"];

export async function aggregateDiscoveredResources(
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<DiscoveredResources> {
  const skillPaths: string[] = [];
  const promptPaths: string[] = [];
  const failures: ResourcesDiscoverFailure[] = [];

  for (const locations of [userLocations, projectLocations]) {
    await collectForKind(
      locations,
      "skills",
      locations.skillsTargetDir,
      readSkillPaths,
      skillPaths,
      failures,
    );
    await collectForKind(
      locations,
      "prompts",
      locations.promptsTargetDir,
      readPromptPaths,
      promptPaths,
      failures,
    );
  }

  if (failures.length > 0) {
    throw new AggregateResourcesDiscoverError(failures);
  }

  return {
    skillPaths: Object.freeze(skillPaths),
    promptPaths: Object.freeze(promptPaths),
  };
}

async function collectForKind(
  locations: ScopedLocations,
  kind: ResourceKind,
  dir: string,
  reader: (dir: string) => Promise<readonly string[]>,
  output: string[],
  failures: ResourcesDiscoverFailure[],
): Promise<void> {
  try {
    output.push(...(await reader(dir)));
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return;
    }

    failures.push({ scope: locations.scope, kind, path: dir, cause });
  }
}

async function readSkillPaths(skillsDir: string): Promise<readonly string[]> {
  const entries = await readSortedDir(skillsDir);
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || !entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(skillsDir, entry.name);
    const stat = await lstat(skillDir);
    if (stat.isSymbolicLink()) {
      continue;
    }

    const skillFile = path.join(skillDir, "SKILL.md");
    const skillStat = await lstat(skillFile).catch((err: unknown) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return null;
      }

      throw err;
    });

    if (skillStat?.isFile() && !skillStat.isSymbolicLink()) {
      paths.push(skillDir);
    }
  }

  return Object.freeze(paths);
}

async function readPromptPaths(promptsDir: string): Promise<readonly string[]> {
  const entries = await readSortedDir(promptsDir);
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const promptFile = path.join(promptsDir, entry.name);
    const stat = await lstat(promptFile);
    if (!stat.isSymbolicLink() && stat.isFile()) {
      paths.push(promptFile);
    }
  }

  return Object.freeze(paths);
}

async function readSortedDir(dir: string): Promise<readonly Dirent[]> {
  const entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  return Object.freeze([...entries].sort((a, b) => a.name.localeCompare(b.name)));
}
