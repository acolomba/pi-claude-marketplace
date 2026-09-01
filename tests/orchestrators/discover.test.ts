import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { aggregateDiscoveredResources } from "../../extensions/pi-claude-marketplace/orchestrators/discover.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { AggregateResourcesDiscoverError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

interface TestLocations {
  readonly root: string;
  readonly user: ScopedLocations;
  readonly project: ScopedLocations;
}

async function makeTestLocations(t: TestContext, prefix: string): Promise<TestLocations> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  let user: ScopedLocations;
  try {
    process.env.PI_CODING_AGENT_DIR = path.join(root, "user");
    user = locationsFor("user", root);
  } finally {
    if (previousAgentDirectory === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
    }
  }

  return {
    root,
    user,
    project: locationsFor("project", path.join(root, "project")),
  };
}

async function stageSkill(locations: ScopedLocations, name: string): Promise<void> {
  const skillDirectory = path.join(locations.skillsTargetDir, name);
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(
    path.join(skillDirectory, "SKILL.md"),
    `---
name: ${name}
---
body`,
  );
}

async function stagePrompt(locations: ScopedLocations, name: string): Promise<void> {
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(
    path.join(locations.promptsTargetDir, `${name}.md`),
    `# ${name}
`,
  );
}

function errorCode(cause: unknown): string | undefined {
  if (
    typeof cause !== "object" ||
    cause === null ||
    !("code" in cause) ||
    typeof cause.code !== "string"
  ) {
    return undefined;
  }

  return cause.code;
}

test("aggregateDiscoveredResources keeps scope order and sorts within each resource directory", async (t) => {
  // arrange
  const { user, project } = await makeTestLocations(t, "resources-discover-order-");
  await stageSkill(user, "zulu");
  await stageSkill(user, "alpha");
  await stageSkill(project, "aardvark");
  await stagePrompt(user, "zulu");
  await stagePrompt(user, "alpha");
  await stagePrompt(project, "aardvark");

  // act
  const result = await aggregateDiscoveredResources(user, project);

  // assert
  assert.deepEqual(result, {
    skillPaths: [
      path.join(user.skillsTargetDir, "alpha"),
      path.join(user.skillsTargetDir, "zulu"),
      path.join(project.skillsTargetDir, "aardvark"),
    ],
    promptPaths: [
      path.join(user.promptsTargetDir, "alpha.md"),
      path.join(user.promptsTargetDir, "zulu.md"),
      path.join(project.promptsTargetDir, "aardvark.md"),
    ],
  });
  assert.equal(Object.isFrozen(result.skillPaths), true);
  assert.equal(Object.isFrozen(result.promptPaths), true);
});

test("aggregateDiscoveredResources excludes hidden, nonmatching, nondirectory, and symlink entries", async (t) => {
  // arrange
  const { root, user, project } = await makeTestLocations(t, "resources-discover-filter-");
  await stageSkill(user, "visible-skill");
  await stageSkill(user, ".hidden-skill");
  await writeFile(path.join(user.skillsTargetDir, "regular-file"), "not a skill directory");

  await mkdir(path.join(user.skillsTargetDir, "missing-skill-file"), { recursive: true });
  await mkdir(path.join(user.skillsTargetDir, "skill-file-directory", "SKILL.md"), {
    recursive: true,
  });

  const linkedSkillFileSource = path.join(root, "linked-skill-file-source.md");
  const skillFileLinkDirectory = path.join(user.skillsTargetDir, "skill-file-link");
  await writeFile(linkedSkillFileSource, "linked skill body");
  await mkdir(skillFileLinkDirectory, { recursive: true });
  await symlink(linkedSkillFileSource, path.join(skillFileLinkDirectory, "SKILL.md"), "file");

  const linkedSkillDirectorySource = path.join(user.skillsTargetDir, ".linked-skill-source");
  await stageSkill(user, ".linked-skill-source");
  await symlink(
    linkedSkillDirectorySource,
    path.join(user.skillsTargetDir, "linked-skill-directory"),
    "junction",
  );

  await stagePrompt(user, "visible-prompt");
  await stagePrompt(user, ".hidden-prompt");
  await writeFile(path.join(user.promptsTargetDir, "wrong-extension.txt"), "not markdown");
  await mkdir(path.join(user.promptsTargetDir, "prompt-directory.md"));
  const linkedPromptSource = path.join(user.promptsTargetDir, ".linked-prompt-source.md");
  await writeFile(linkedPromptSource, "linked prompt body");
  await symlink(linkedPromptSource, path.join(user.promptsTargetDir, "linked-prompt.md"), "file");

  // act
  const result = await aggregateDiscoveredResources(user, project);

  // assert
  assert.deepEqual(result, {
    skillPaths: [path.join(user.skillsTargetDir, "visible-skill")],
    promptPaths: [path.join(user.promptsTargetDir, "visible-prompt.md")],
  });
});

test("aggregateDiscoveredResources soft-skips missing resource directories", async (t) => {
  // arrange
  const { user, project } = await makeTestLocations(t, "resources-discover-missing-");

  // act
  const result = await aggregateDiscoveredResources(user, project);

  // assert
  assert.deepEqual(result, { skillPaths: [], promptPaths: [] });
  assert.equal(Object.isFrozen(result.skillPaths), true);
  assert.equal(Object.isFrozen(result.promptPaths), true);
});

test("aggregateDiscoveredResources soft-skips resource paths below a regular file", async (t) => {
  // arrange
  const { user, project } = await makeTestLocations(t, "resources-discover-not-directory-");
  await mkdir(user.extensionRoot, { recursive: true });
  await writeFile(path.dirname(user.skillsTargetDir), "not a resource directory");

  // act
  const result = await aggregateDiscoveredResources(user, project);

  // assert
  assert.deepEqual(result, { skillPaths: [], promptPaths: [] });
});

test("aggregateDiscoveredResources aggregates all four hard read failures in traversal order", async (t) => {
  // arrange
  const { root, user, project } = await makeTestLocations(t, "resources-discover-errors-");
  const invalidTargets = {
    userSkills: path.join(root, "user-skills\0"),
    userPrompts: path.join(root, "user-prompts\0"),
    projectSkills: path.join(root, "project-skills\0"),
    projectPrompts: path.join(root, "project-prompts\0"),
  };
  const invalidUser = Object.freeze({
    ...user,
    skillsTargetDir: invalidTargets.userSkills,
    promptsTargetDir: invalidTargets.userPrompts,
  });
  const invalidProject = Object.freeze({
    ...project,
    skillsTargetDir: invalidTargets.projectSkills,
    promptsTargetDir: invalidTargets.projectPrompts,
  });

  // act
  const error: unknown = await aggregateDiscoveredResources(invalidUser, invalidProject).then(
    () => undefined,
    (cause: unknown) => cause,
  );

  // assert
  assert.ok(error instanceof AggregateResourcesDiscoverError);
  assert.deepEqual(
    error.failures.map((failure) => ({
      scope: failure.scope,
      kind: failure.kind,
      path: failure.path,
      causeType: failure.cause instanceof TypeError ? "TypeError" : "unexpected",
      causeCode: errorCode(failure.cause),
    })),
    [
      {
        scope: "user",
        kind: "skills",
        path: invalidTargets.userSkills,
        causeType: "TypeError",
        causeCode: "ERR_INVALID_ARG_VALUE",
      },
      {
        scope: "user",
        kind: "prompts",
        path: invalidTargets.userPrompts,
        causeType: "TypeError",
        causeCode: "ERR_INVALID_ARG_VALUE",
      },
      {
        scope: "project",
        kind: "skills",
        path: invalidTargets.projectSkills,
        causeType: "TypeError",
        causeCode: "ERR_INVALID_ARG_VALUE",
      },
      {
        scope: "project",
        kind: "prompts",
        path: invalidTargets.projectPrompts,
        causeType: "TypeError",
        causeCode: "ERR_INVALID_ARG_VALUE",
      },
    ],
  );
  assert.strictEqual(error.cause, error.failures[0]?.cause);
  assert.equal(Object.isFrozen(error.failures), true);
});
