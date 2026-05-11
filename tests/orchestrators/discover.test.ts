import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  aggregateDiscoveredResources,
  type DiscoveredResources,
} from "../../extensions/claude-marketplace/orchestrators/discover.ts";
import { AggregateResourcesDiscoverError } from "../../extensions/claude-marketplace/shared/errors.ts";
import { cleanupStaging } from "../../extensions/claude-marketplace/shared/fs-utils.ts";

import type { ScopedLocations } from "../../extensions/claude-marketplace/persistence/locations.ts";
import type { Scope } from "../../extensions/claude-marketplace/shared/types.ts";

function makeLocations(scope: Scope, root: string): ScopedLocations {
  const extensionRoot = path.join(root, "claude-marketplace");
  return {
    scope,
    scopeRoot: root,
    extensionRoot,
    stateJsonPath: path.join(extensionRoot, "state.json"),
    agentsDir: path.join(root, "agents"),
    agentsStagingDir: path.join(extensionRoot, "agents-staging"),
    agentsIndexPath: path.join(extensionRoot, "agents-index.json"),
    mcpJsonPath: path.join(root, "mcp.json"),
    skillsStagingDir: path.join(extensionRoot, "skills-staging"),
    commandsStagingDir: path.join(extensionRoot, "commands-staging"),
    skillsTargetDir: path.join(extensionRoot, "resources", "skills"),
    promptsTargetDir: path.join(extensionRoot, "resources", "prompts"),
    dataRoot: path.join(extensionRoot, "data"),
    sourcesDir: path.join(extensionRoot, "sources"),
    cacheDir: path.join(extensionRoot, "cache"),
    marketplaceNamesCacheFile: path.join(extensionRoot, "cache", "marketplace-names.json"),
    pluginDataDir: async () => path.join(extensionRoot, "data", "mp", "plugin"),
    marketplaceDataDir: async () => path.join(extensionRoot, "data", "mp"),
    sourceCloneDir: async () => path.join(extensionRoot, "sources", "mp"),
    sourcesStagingDir: async () => path.join(extensionRoot, "sources-staging", "uuid"),
    pluginCacheFile: async () => path.join(extensionRoot, "cache", "plugins", "mp.json"),
  } as unknown as ScopedLocations;
}

async function stageSkill(locations: ScopedLocations, name: string): Promise<string> {
  const dir = path.join(locations.skillsTargetDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\n---\nbody`);
  return dir;
}

async function stagePrompt(locations: ScopedLocations, name: string): Promise<string> {
  const file = path.join(locations.promptsTargetDir, `${name}.md`);
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(file, `# ${name}\n`);
  return file;
}

test("resources_discover returns empty lists when staged resource directories are missing", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "resources-discover-missing-"));
  try {
    const user = makeLocations("user", path.join(tmp, "user"));
    const project = makeLocations("project", path.join(tmp, "project"));

    const result = await aggregateDiscoveredResources(user, project);
    assert.deepEqual(result, { skillPaths: [], promptPaths: [] } satisfies DiscoveredResources);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("resources_discover returns deterministic user and project skill and prompt paths", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "resources-discover-staged-"));
  try {
    const user = makeLocations("user", path.join(tmp, "user"));
    const project = makeLocations("project", path.join(tmp, "project"));
    const userSkillB = await stageSkill(user, "same-name");
    const userSkillA = await stageSkill(user, "alpha");
    const projectSkill = await stageSkill(project, "same-name");
    const userPrompt = await stagePrompt(user, "same-name");
    const projectPrompt = await stagePrompt(project, "same-name");
    await writeFile(path.join(user.promptsTargetDir, "not-a-prompt.txt"), "ignore me");

    const result = await aggregateDiscoveredResources(user, project);

    assert.deepEqual(result.skillPaths, [userSkillA, userSkillB, projectSkill]);
    assert.deepEqual(result.promptPaths, [userPrompt, projectPrompt]);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("resources_discover aggregates non-missing filesystem failures after both scopes are attempted", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod permission semantics differ on Windows");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "resources-discover-error-"));
  const user = makeLocations("user", path.join(tmp, "user"));
  const project = makeLocations("project", path.join(tmp, "project"));
  try {
    await mkdir(user.skillsTargetDir, { recursive: true });
    await chmod(user.skillsTargetDir, 0o000);
    const projectPrompt = await stagePrompt(project, "still-attempted");

    await assert.rejects(aggregateDiscoveredResources(user, project), (err: unknown) => {
      assert.ok(err instanceof AggregateResourcesDiscoverError);
      assert.equal(err.failures.length, 1);
      assert.equal(err.failures[0]!.scope, "user");
      assert.equal(err.failures[0]!.kind, "skills");
      assert.equal(err.failures[0]!.path, user.skillsTargetDir);
      assert.ok(err.cause instanceof Error);
      return true;
    });

    assert.equal(projectPrompt.endsWith("still-attempted.md"), true);
  } finally {
    await chmod(user.skillsTargetDir, 0o700).catch(() => undefined);
    await cleanupStaging(tmp, "test-cleanup");
  }
});
