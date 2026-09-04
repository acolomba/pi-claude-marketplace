import assert from "node:assert/strict";
import filesystemPromises, {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { unstagePluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

interface SkillScope {
  readonly directory: string;
  readonly locations: ScopedLocations;
}

async function createSkillScope(t: TestContext, prefix: string): Promise<SkillScope> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", directory);
  await mkdir(locations.skillsTargetDir, { recursive: true });
  return { directory, locations };
}

test("removes recorded skill trees in order and preserves foreign bytes", async (t) => {
  // arrange
  const { locations } = await createSkillScope(t, "skills-unstage-recorded-");
  const firstSkillDirectory = path.join(locations.skillsTargetDir, "acme-first");
  const secondSkillDirectory = path.join(locations.skillsTargetDir, "acme-second");
  const foreignSkillDirectory = path.join(locations.skillsTargetDir, "other-keep");
  const foreignSkillPath = path.join(foreignSkillDirectory, "SKILL.md");
  await mkdir(path.join(firstSkillDirectory, "resources"), { recursive: true });
  await mkdir(secondSkillDirectory, { recursive: true });
  await mkdir(foreignSkillDirectory, { recursive: true });
  await writeFile(path.join(firstSkillDirectory, "SKILL.md"), "first skill bytes\n");
  await writeFile(path.join(firstSkillDirectory, "resources", "lookup.json"), '{"first":true}\n');
  await writeFile(path.join(secondSkillDirectory, "SKILL.md"), "second skill bytes\n");
  await writeFile(foreignSkillPath, "foreign skill bytes\n");
  const expectedUnstagedSkills = {
    removedNames: ["acme-second", "acme-first"],
    warnings: [],
  };

  // act
  const unstagedSkills = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-second", "acme-missing", "acme-first"],
  });

  // assert
  assert.deepStrictEqual(unstagedSkills, expectedUnstagedSkills);
  assert.strictEqual(Object.isFrozen(unstagedSkills.removedNames), true);
  assert.strictEqual(Object.isFrozen(unstagedSkills.warnings), true);
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["other-keep"]);
  assert.strictEqual(await readFile(foreignSkillPath, "utf8"), "foreign skill bytes\n");
});

test("returns an empty result when no skill names were recorded", async (t) => {
  // arrange
  const { locations } = await createSkillScope(t, "skills-unstage-empty-");
  const foreignSkillDirectory = path.join(locations.skillsTargetDir, "other-keep");
  const foreignSkillPath = path.join(foreignSkillDirectory, "SKILL.md");
  await mkdir(foreignSkillDirectory);
  await writeFile(foreignSkillPath, "foreign skill bytes\n");

  // act
  const unstagedSkills = await unstagePluginSkills({
    locations,
    previousSkillNames: [],
  });

  // assert
  assert.deepStrictEqual(unstagedSkills, { removedNames: [], warnings: [] });
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["other-keep"]);
  assert.strictEqual(await readFile(foreignSkillPath, "utf8"), "foreign skill bytes\n");
});

test("makes repeated unstaging a missing-directory fixed point", async (t) => {
  // arrange
  const { locations } = await createSkillScope(t, "skills-unstage-repeat-");
  const skillDirectory = path.join(locations.skillsTargetDir, "acme-once");
  await mkdir(skillDirectory);
  await writeFile(path.join(skillDirectory, "SKILL.md"), "one-time skill bytes\n");

  // act
  const firstUnstage = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-once"],
  });
  const replayedUnstage = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-once"],
  });

  // assert
  assert.deepStrictEqual(firstUnstage, { removedNames: ["acme-once"], warnings: [] });
  assert.deepStrictEqual(replayedUnstage, { removedNames: [], warnings: [] });
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), []);
});

test("rejects an unsafe recorded name before changing the target tree", async (t) => {
  // arrange
  const { directory, locations } = await createSkillScope(t, "skills-unstage-unsafe-");
  const retainedSkillDirectory = path.join(locations.skillsTargetDir, "acme-safe");
  const retainedSkillPath = path.join(retainedSkillDirectory, "SKILL.md");
  const outsideDirectory = path.join(directory, "escape");
  await mkdir(retainedSkillDirectory);
  await mkdir(outsideDirectory);
  await writeFile(retainedSkillPath, "retained skill bytes\n");
  await writeFile(path.join(outsideDirectory, "SKILL.md"), "outside bytes\n");

  // act
  const unstageError = await unstagePluginSkills({
    locations,
    previousSkillNames: ["../escape"],
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(unstageError instanceof Error);
  assert.deepStrictEqual(
    { name: unstageError.name, message: unstageError.message, cause: unstageError.cause },
    {
      name: "Error",
      message: 'skill name to unstage "../escape" must not contain path separators.',
      cause: undefined,
    },
  );
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["acme-safe"]);
  assert.strictEqual(await readFile(retainedSkillPath, "utf8"), "retained skill bytes\n");
  assert.strictEqual(
    await readFile(path.join(outsideDirectory, "SKILL.md"), "utf8"),
    "outside bytes\n",
  );
});

test("rejects a symlinked skill target and preserves its destination", async (t) => {
  // arrange
  const { directory, locations } = await createSkillScope(t, "skills-unstage-symlink-");
  const outsideDirectory = path.join(directory, "outside-skill");
  const outsideSkillPath = path.join(outsideDirectory, "SKILL.md");
  const linkedSkillDirectory = path.join(locations.skillsTargetDir, "acme-linked");
  await mkdir(outsideDirectory);
  await writeFile(outsideSkillPath, "outside skill bytes\n");
  await symlink(outsideDirectory, linkedSkillDirectory, "dir");

  // act
  const unstageError = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-linked"],
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.ok(unstageError instanceof SymlinkRefusedError);
  assert.deepStrictEqual(
    {
      name: unstageError.name,
      message: unstageError.message,
      parent: unstageError.parent,
      child: unstageError.child,
      linkPath: unstageError.linkPath,
      linkTarget: unstageError.linkTarget,
      cause: unstageError.cause,
    },
    {
      name: "SymlinkRefusedError",
      message: `skill to unstage contains symlink ${linkedSkillDirectory} -> ${outsideDirectory} (parent: ${locations.skillsTargetDir}, target: ${linkedSkillDirectory}).`,
      parent: locations.skillsTargetDir,
      child: linkedSkillDirectory,
      linkPath: linkedSkillDirectory,
      linkTarget: outsideDirectory,
      cause: undefined,
    },
  );
  assert.strictEqual((await lstat(linkedSkillDirectory)).isSymbolicLink(), true);
  assert.strictEqual(await readlink(linkedSkillDirectory), outsideDirectory);
  assert.strictEqual(await readFile(outsideSkillPath, "utf8"), "outside skill bytes\n");
});

test("continues after a raced skill directory disappears", async (t) => {
  // arrange
  const { locations } = await createSkillScope(t, "skills-unstage-race-");
  const racedSkillDirectory = path.join(locations.skillsTargetDir, "acme-raced");
  const retainedSkillDirectory = path.join(locations.skillsTargetDir, "acme-after");
  await mkdir(racedSkillDirectory);
  await mkdir(retainedSkillDirectory);
  await writeFile(path.join(racedSkillDirectory, "SKILL.md"), "raced bytes\n");
  await writeFile(path.join(retainedSkillDirectory, "SKILL.md"), "after bytes\n");
  const originalRm = filesystemPromises.rm.bind(filesystemPromises);
  const raceError = Object.assign(new Error("skill disappeared during removal"), {
    code: "ENOENT",
  });
  const removal = t.mock.method(
    filesystemPromises,
    "rm",
    async (
      target: Parameters<typeof originalRm>[0],
      options?: Parameters<typeof originalRm>[1],
    ) => {
      await originalRm(target, options);
      if (String(target) === racedSkillDirectory) {
        throw raceError;
      }
    },
  );
  t.after(() => {
    removal.mock.restore();
    syncBuiltinESMExports();
  });
  syncBuiltinESMExports();

  // act
  const unstagedSkills = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-raced", "acme-after"],
  });

  // assert
  assert.deepStrictEqual(unstagedSkills, { removedNames: ["acme-after"], warnings: [] });
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), []);
});

test("propagates a removal failure after retaining the partial filesystem state", async (t) => {
  // arrange
  const { locations } = await createSkillScope(t, "skills-unstage-failure-");
  const removedSkillDirectory = path.join(locations.skillsTargetDir, "acme-removed");
  const blockedSkillDirectory = path.join(locations.skillsTargetDir, "acme-blocked");
  const foreignSkillDirectory = path.join(locations.skillsTargetDir, "other-keep");
  await mkdir(removedSkillDirectory);
  await mkdir(blockedSkillDirectory);
  await mkdir(foreignSkillDirectory);
  await writeFile(path.join(removedSkillDirectory, "SKILL.md"), "removed skill bytes\n");
  await writeFile(path.join(blockedSkillDirectory, "SKILL.md"), "blocked skill bytes\n");
  await writeFile(path.join(foreignSkillDirectory, "SKILL.md"), "foreign skill bytes\n");
  const originalRm = filesystemPromises.rm.bind(filesystemPromises);
  const removalError = Object.assign(new Error("skill removal denied"), {
    code: "EACCES",
    errno: -13,
    syscall: "rm",
    path: blockedSkillDirectory,
  });
  const removal = t.mock.method(
    filesystemPromises,
    "rm",
    async (
      target: Parameters<typeof originalRm>[0],
      options?: Parameters<typeof originalRm>[1],
    ) => {
      if (String(target) === blockedSkillDirectory) {
        throw removalError;
      }

      await originalRm(target, options);
    },
  );
  t.after(() => {
    removal.mock.restore();
    syncBuiltinESMExports();
  });
  syncBuiltinESMExports();

  // act
  const unstageError = await unstagePluginSkills({
    locations,
    previousSkillNames: ["acme-removed", "acme-blocked", "acme-never-reached"],
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );

  // assert
  assert.strictEqual(unstageError, removalError);
  assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["acme-blocked", "other-keep"]);
  assert.strictEqual(
    await readFile(path.join(blockedSkillDirectory, "SKILL.md"), "utf8"),
    "blocked skill bytes\n",
  );
  assert.strictEqual(
    await readFile(path.join(foreignSkillDirectory, "SKILL.md"), "utf8"),
    "foreign skill bytes\n",
  );
});
