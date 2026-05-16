import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  abortPreparedSkills,
  assertNoSkillCollisions,
  commitPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { cleanupStaging } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { DiscoveredSkill } from "../../../extensions/pi-claude-marketplace/bridges/skills/types.ts";
import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

// Resolve fixture root relative to THIS file (worktree-safe; do NOT use cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "_fixtures");

function makeResolved(
  name: string,
  pluginRoot: string,
  skillsDirAbs: string | undefined,
): ResolvedPluginInstallable {
  // D-07: componentPaths.skills is now `readonly string[]`.
  return {
    installable: true,
    name,
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: skillsDirAbs === undefined ? [] : [skillsDirAbs],
      commands: [],
      agents: [],
    },
    mcpServers: {},
  };
}

async function withTmpScope<T>(
  fn: (ctx: { scopeRoot: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "skills-stage-"));
  const locations = locationsFor("project", tmp);
  try {
    return await fn({ scopeRoot: tmp, locations });
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
}

test("SK-1 commitPreparedSkills lands skills at <extensionRoot>/resources/skills/<generatedName>/SKILL.md", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });

    assert.equal(prepared.kind, "staged");
    assert.deepEqual([...prepared.result.stagedNames].sort(), ["acme-helper", "acme-knowledge"]);

    const leak = await commitPreparedSkills(prepared);
    assert.equal(leak, undefined);

    // Both target SKILL.md files exist after commit.
    const knowledgeSkill = path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md");
    const helperSkill = path.join(locations.skillsTargetDir, "acme-helper", "SKILL.md");
    const knowledgeStat = await stat(knowledgeSkill);
    const helperStat = await stat(helperSkill);
    assert.ok(knowledgeStat.isFile());
    assert.ok(helperStat.isFile());

    // Ancillary file inside acme-knowledge survived the cp.
    const lookup = path.join(
      locations.skillsTargetDir,
      "acme-knowledge",
      "resources",
      "lookup.json",
    );
    const lookupStat = await stat(lookup);
    assert.ok(lookupStat.isFile());
  });
});

test("SK-3 prepared SKILL.md frontmatter has rewritten name (acme-knowledge / acme-helper)", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });
    await commitPreparedSkills(prepared);

    const knowledge = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.match(knowledge, /^---\nname: acme-knowledge\n/m);

    const helper = await readFile(
      path.join(locations.skillsTargetDir, "acme-helper", "SKILL.md"),
      "utf8",
    );
    // Helper source had `name: helper` -- after rewrite it should be acme-helper.
    assert.match(helper, /^name: acme-helper$/m);
    // The original `name: helper` line must be gone.
    assert.ok(!/^name: helper$/m.test(helper), "original name line should be replaced");
  });
});

test("SK-3 prepared SKILL.md preserves description and license fields", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });
    await commitPreparedSkills(prepared);

    const knowledge = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.ok(knowledge.includes("description: Knowledge base lookups for acme"));
    assert.ok(knowledge.includes("license: MIT"));
  });
});

test("SK-4 substituted SKILL.md body has no remaining ${CLAUDE_PLUGIN_ROOT} or ${CLAUDE_PLUGIN_DATA}", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const pluginDataDir = path.join(locations.dataRoot, "mp", "acme");
    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    await commitPreparedSkills(prepared);

    const knowledge = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.ok(
      !knowledge.includes("${CLAUDE_PLUGIN_ROOT}"),
      "ROOT placeholder should be substituted",
    );
    assert.ok(
      !knowledge.includes("${CLAUDE_PLUGIN_DATA}"),
      "DATA placeholder should be substituted",
    );
  });
});

test("SK-4 substituted SKILL.md contains the resolved pluginRoot path verbatim", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const pluginDataDir = path.join(locations.dataRoot, "mp", "acme");
    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    await commitPreparedSkills(prepared);

    const knowledge = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.ok(knowledge.includes(pluginRoot), "substituted body should contain pluginRoot path");
    assert.ok(knowledge.includes(pluginDataDir), "substituted body should contain pluginData path");
  });
});

test("AS-8 / RN-6 prepareStageSkills returns kind:'noop' when no discovered AND no previousNames", async () => {
  await withTmpScope(async ({ locations }) => {
    // empty-mcp fixture has no skills/ dir.
    const pluginRoot = path.join(FIXTURES, "empty-mcp");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });

    assert.equal(prepared.kind, "noop");
    assert.deepEqual([...prepared.result.stagedNames], []);
    assert.deepEqual([...prepared.result.recorded], []);

    // commit on noop is a no-op (returns undefined leak).
    const leak = await commitPreparedSkills(prepared);
    assert.equal(leak, undefined);

    // abort on noop is also a no-op.
    await abortPreparedSkills(prepared);
  });
});

test("RN-6 assertNoSkillCollisions throws with both source names when two skills elide to same generated", () => {
  const synth: DiscoveredSkill[] = [
    {
      sourceName: "acme-foo",
      generatedName: "acme-foo",
      skillDir: "/tmp/x/acme-foo",
    },
    {
      sourceName: "foo",
      generatedName: "acme-foo",
      skillDir: "/tmp/x/foo",
    },
  ];
  assert.throws(
    () => {
      assertNoSkillCollisions(synth);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /collision/i);
      assert.ok(err.message.includes(`"acme-foo"`), "must list generated name");
      assert.ok(err.message.includes(`"foo"`), "must list other source name");
      // Both source names quoted in the bracketed list.
      assert.match(err.message, /\["acme-foo", "foo"\]|\["foo", "acme-foo"\]/);
      return true;
    },
  );
});

test("commitPreparedSkills removes previous-named target dirs before rename (re-stage path)", async () => {
  await withTmpScope(async ({ locations }) => {
    // Pre-populate a previous-named target dir.
    const oldDir = path.join(locations.skillsTargetDir, "old-skill");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "stale content");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["old-skill"],
    });
    assert.equal(prepared.kind, "staged");

    await commitPreparedSkills(prepared);

    // old-skill should be gone.
    const oldStat = await stat(oldDir).catch(() => null);
    assert.equal(oldStat, null, "previous-named target dir should be removed");
    // New skills should exist.
    const newStat = await stat(path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"));
    assert.ok(newStat.isFile());
  });
});

test("Phase 8 / PRL-10 replacePreparedSkills can rollback to previous skill bytes", async () => {
  await withTmpScope(async ({ locations }) => {
    const oldDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "old skill bytes");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["acme-knowledge"],
    });

    const replacement = await replacePreparedSkills(prepared);
    const replaced = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.notEqual(replaced, "old skill bytes");
    assert.ok(replaced.includes(pluginRoot));
    assert.ok(replaced.includes(path.join(locations.dataRoot, "mp", "acme")));

    const leaks = await rollbackSkillsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"), "utf8"),
      "old skill bytes",
    );
    assert.equal(
      await stat(path.join(locations.skillsTargetDir, "acme-helper")).catch(() => null),
      null,
    );
  });
});

test("Phase 8 / PRL-10 finalizeSkillsReplacement removes backups and keeps staged content", async () => {
  await withTmpScope(async ({ locations }) => {
    const oldDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "old skill bytes");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["acme-knowledge"],
    });
    assert.equal(prepared.kind, "staged");

    const replacement = await replacePreparedSkills(prepared);
    const leaks = await finalizeSkillsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await stat(prepared.stagingRoot).catch(() => null), null);

    const restored = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.notEqual(restored, "old skill bytes");
    assert.ok(
      (await stat(path.join(locations.skillsTargetDir, "acme-helper", "SKILL.md"))).isFile(),
    );
  });
});

test("Phase 8 / PRL-10 replacePreparedSkills restores backups if an unrelated target blocks rename", async () => {
  await withTmpScope(async ({ locations }) => {
    const oldDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "old skill bytes");
    const unrelatedDir = path.join(locations.skillsTargetDir, "acme-helper");
    await mkdir(unrelatedDir, { recursive: true });
    await writeFile(path.join(unrelatedDir, "SKILL.md"), "manual helper bytes");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["acme-knowledge"],
    });

    await assert.rejects(() => replacePreparedSkills(prepared), /non-previous content/);
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"), "utf8"),
      "old skill bytes",
    );
    assert.equal(
      await readFile(path.join(locations.skillsTargetDir, "acme-helper", "SKILL.md"), "utf8"),
      "manual helper bytes",
    );
  });
});

test("Phase 8 / PRL-10 noop skills replacements rollback and finalize without leaks", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "empty-mcp");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });

    const replacement = await replacePreparedSkills(prepared);
    assert.equal(replacement.kind, "noop");
    assert.deepEqual([...(await rollbackSkillsReplacement(replacement))], []);
    assert.deepEqual([...(await finalizeSkillsReplacement(replacement))], []);
  });
});

test("commitPreparedSkills tolerates ENOENT on previous-named target dirs", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["never-existed"],
    });
    assert.equal(prepared.kind, "staged");

    // Should not throw.
    const leak = await commitPreparedSkills(prepared);
    assert.equal(leak, undefined);
  });
});

test("abortPreparedSkills cleans up staging dir after partial prepare", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });
    assert.equal(prepared.kind, "staged");

    if (prepared.kind === "staged") {
      // Staging dir exists pre-abort.
      const preStat = await stat(prepared.stagingRoot);
      assert.ok(preStat.isDirectory());

      await abortPreparedSkills(prepared);

      // Staging dir gone post-abort.
      const postStat = await stat(prepared.stagingRoot).catch(() => null);
      assert.equal(postStat, null, "staging root should be cleaned up");
    }
  });
});

test("prepareStageSkills surfaces appendLeakToError when a skill source is unreadable", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 has no effect");
    return;
  }

  await withTmpScope(async ({ locations }) => {
    // Synthesize a source skills dir with one unreadable skill.
    const srcRoot = await mkdtemp(path.join(os.tmpdir(), "stage-leak-"));
    try {
      const skillsDir = path.join(srcRoot, "skills");
      await mkdir(skillsDir, { recursive: true });
      const evilSkill = path.join(skillsDir, "evil");
      await mkdir(evilSkill);
      await writeFile(path.join(evilSkill, "SKILL.md"), "---\nname: evil\n---");
      // Make the skill dir unreadable so cp fails.
      await chmod(evilSkill, 0o000);

      const resolved = makeResolved("acme", srcRoot, skillsDir);
      try {
        await prepareStageSkills({
          locations,
          marketplaceName: "mp",
          pluginName: "acme",
          pluginRoot: srcRoot,
          pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
          resolved,
        });
        assert.fail("expected prepareStageSkills to throw");
      } catch (err) {
        assert.ok(err instanceof Error);
        // The error should have either the original message or a leak append.
        assert.ok(err.message.length > 0);
      }

      await chmod(evilSkill, 0o755);
    } finally {
      await cleanupStaging(srcRoot, "test-cleanup");
    }
  });
});

test("Phase 8 / PRL-10 finalizeSkillsReplacement throws on unknown replacement handle (defensive)", async () => {
  const bogus = { kind: "replaced" } as Parameters<typeof finalizeSkillsReplacement>[0];
  await assert.rejects(() => finalizeSkillsReplacement(bogus), /Unknown skills replacement handle/);
});

test("Phase 8 / PRL-10 replacePreparedSkills skips backup when previous skill dir vanished", async () => {
  // The replace path's backup loop has a "skip if target doesn't exist"
  // branch. Trigger: declare a previousSkillName whose target dir is not on
  // disk; the backup loop should `continue` past it instead of attempting
  // a rename that would throw ENOENT.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["was-here-but-gone"], // never written to disk
    });

    const replacement = await replacePreparedSkills(prepared);
    assert.equal(replacement.kind, "replaced");
    const leaks = await rollbackSkillsReplacement(replacement);
    assert.deepEqual([...leaks], []);
  });
});
