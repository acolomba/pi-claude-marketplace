import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { unstagePluginSkills } from "../../../extensions/claude-marketplace/bridges/skills/unstage.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";
import { cleanupStaging } from "../../../extensions/claude-marketplace/shared/fs-utils.ts";

async function withTmpScope<T>(
  fn: (ctx: { scopeRoot: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "skills-unstage-"));
  const locations = locationsFor("project", tmp);
  try {
    return await fn({ scopeRoot: tmp, locations });
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
}

test("unstagePluginSkills removes named dirs idempotently (ENOENT silenced)", async () => {
  await withTmpScope(async ({ locations }) => {
    // Pre-create 2 of the 3 names; the third does not exist.
    const a = path.join(locations.skillsTargetDir, "a");
    const b = path.join(locations.skillsTargetDir, "b");
    await mkdir(a, { recursive: true });
    await writeFile(path.join(a, "SKILL.md"), "x");
    await mkdir(b, { recursive: true });
    await writeFile(path.join(b, "SKILL.md"), "y");

    const result = await unstagePluginSkills({
      locations,
      previousSkillNames: ["a", "b", "missing"],
    });

    // Only `a` and `b` were actually present, so they should appear in removed.
    assert.deepEqual([...result.removedNames].sort(), ["a", "b"]);
    assert.deepEqual([...result.warnings], []);

    // Verify they're gone.
    const aStat = await stat(a).catch(() => null);
    const bStat = await stat(b).catch(() => null);
    assert.equal(aStat, null);
    assert.equal(bStat, null);
  });
});

test("unstagePluginSkills returns empty array when previousSkillNames is empty", async () => {
  await withTmpScope(async ({ locations }) => {
    const result = await unstagePluginSkills({
      locations,
      previousSkillNames: [],
    });
    assert.deepEqual([...result.removedNames], []);
    assert.deepEqual([...result.warnings], []);
  });
});

test("unstagePluginSkills returns empty removed list when no targets exist (all ENOENT)", async () => {
  await withTmpScope(async ({ locations }) => {
    const result = await unstagePluginSkills({
      locations,
      previousSkillNames: ["nope-1", "nope-2"],
    });
    assert.deepEqual([...result.removedNames], []);
  });
});

test("unstagePluginSkills validates names with assertSafeName", async () => {
  await withTmpScope(async ({ locations }) => {
    await assert.rejects(
      unstagePluginSkills({
        locations,
        previousSkillNames: ["../escape-attempt"],
      }),
      /must not contain path separators/,
    );
  });
});
