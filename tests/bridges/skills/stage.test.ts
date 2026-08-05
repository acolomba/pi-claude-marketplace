import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
import { parseFrontmatter } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
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
  // D-07: componentPaths.skills is `readonly string[]`.
  return {
    state: "installable",
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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

test("SK-4 / AG-8: a ${CLAUDE_PLUGIN_ROOT} in a body-synthesized description survives a backslash (Windows) plugin root (substitute-then-escape)", async () => {
  await withTmpScope(async ({ locations }) => {
    const srcRoot = await mkdtemp(path.join(os.tmpdir(), "skills-winpath-src-"));
    try {
      // No `description` -> the augment arm fills it from the first body paragraph,
      // which references ${CLAUDE_PLUGIN_ROOT}, and re-emits it as a double-quoted
      // scalar. If substitution happened AFTER escaping, a Windows path's backslashes
      // would splice in raw and form an invalid `\U...` escape that the PARSE-02
      // gate-2 backstop rejects -- hard-failing the whole prepare.
      const skillsDir = path.join(srcRoot, "skills");
      await mkdir(path.join(skillsDir, "winpath"), { recursive: true });
      await writeFile(
        path.join(skillsDir, "winpath", "SKILL.md"),
        "---\nname: winpath\n---\nUses ${CLAUDE_PLUGIN_ROOT} at runtime.\n",
      );

      // A Windows-style plugin root (only used for substitution; the real source
      // tree lives at srcRoot). Backslashes are the escape hazard under test.
      const winPluginRoot = "C:\\Users\\me\\acme-plugin";

      const prepared = await prepareStageSkills({
        locations,
        cwd: locations.scopeRoot,
        marketplaceName: "mp",
        pluginName: "acme",
        pluginRoot: winPluginRoot,
        pluginDataDir: "D:\\pi-data\\mp\\acme",
        resolved: makeResolved("acme", srcRoot, skillsDir),
      });

      // Gate-2 did NOT throw: the value re-emitted with escaped backslashes.
      assert.equal(prepared.kind, "staged");
      assert.equal(prepared.result.degraded.length, 0);

      await commitPreparedSkills(prepared);
      const staged = await readFile(
        path.join(locations.skillsTargetDir, "acme-winpath", "SKILL.md"),
        "utf8",
      );

      assert.ok(!staged.includes("${CLAUDE_PLUGIN_ROOT}"), "the var must be substituted");
      const { frontmatter } = parseFrontmatter(staged);
      assert.equal(frontmatter.description, "Uses C:\\Users\\me\\acme-plugin at runtime.");
    } finally {
      await rm(srcRoot, { recursive: true, force: true });
    }
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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

test("PRL-10 replacePreparedSkills can rollback to previous skill bytes", async () => {
  await withTmpScope(async ({ locations }) => {
    const oldDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "old skill bytes");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
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

test("PRL-10 finalizeSkillsReplacement removes backups and keeps staged content", async () => {
  await withTmpScope(async ({ locations }) => {
    const oldDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "SKILL.md"), "old skill bytes");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
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

test("PRL-10 replacePreparedSkills restores backups if an unrelated target blocks rename", async () => {
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
      cwd: locations.scopeRoot,
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

test("PRL-10 noop skills replacements rollback and finalize without leaks", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "empty-mcp");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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
      cwd: locations.scopeRoot,
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
          cwd: locations.scopeRoot,
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

test("PRL-10 finalizeSkillsReplacement throws on unknown replacement handle (defensive)", async () => {
  const bogus = { kind: "replaced" } as Parameters<typeof finalizeSkillsReplacement>[0];
  await assert.rejects(() => finalizeSkillsReplacement(bogus), /Unknown skills replacement handle/);
});

test("PRL-10 replacePreparedSkills skips backup when previous skill dir vanished", async () => {
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
      cwd: locations.scopeRoot,
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

// TR-06 orphan tolerance in replacePreparedSkills ------------------------

test("TR-06 replacePreparedSkills tolerates owned orphan dir from prior partial install", async () => {
  // A previous partial install left an orphan skill dir at the target.
  // Because the basename matches an owned previousSkillName, the 3-arm
  // policy pre-removes the orphan via removeOrphanIfPresent and proceeds
  // with the rename. The new staged content lands; the orphan bytes are
  // overwritten.
  await withTmpScope(async ({ locations }) => {
    const orphanDir = path.join(locations.skillsTargetDir, "acme-knowledge");
    await mkdir(orphanDir, { recursive: true });
    await writeFile(path.join(orphanDir, "SKILL.md"), "orphan-bytes\n");
    await writeFile(path.join(orphanDir, "leftover.txt"), "from-prior-attempt\n");

    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
      previousSkillNames: ["acme-knowledge"],
    });

    const replacement = await replacePreparedSkills(prepared);
    assert.equal(replacement.kind, "replaced");

    // The orphan dir was removed (its leftover.txt is gone), and the new
    // staged content (with rewritten frontmatter) landed in its place.
    const replacedSkillMd = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.notEqual(replacedSkillMd, "orphan-bytes\n");
    assert.equal(
      await stat(path.join(locations.skillsTargetDir, "acme-knowledge", "leftover.txt")).catch(
        () => null,
      ),
      null,
      "orphan leftover.txt must be gone (helper rm -r the whole owned orphan dir)",
    );
  });
});

test("SKILL-01 / PARSE-01 unparseable source frontmatter -> synthesized disable-model-invocation block, body verbatim, degrade record", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "unparseable-skill-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
      resolved,
    });
    assert.equal(prepared.kind, "staged");

    // Degrade record: exactly one, carrying the generated name + a non-empty
    // parse error (the actionable detail the install warning surfaces).
    assert.equal(prepared.result.degraded.length, 1);
    const record = prepared.result.degraded[0]!;
    assert.ok(record.generatedName.length > 0);
    assert.ok(record.parseError.length > 0, "parse error must be non-empty");

    await commitPreparedSkills(prepared);

    const staged = await readFile(
      path.join(locations.skillsTargetDir, record.generatedName, "SKILL.md"),
      "utf8",
    );
    // Synthesized frontmatter: generated name, disable-model-invocation, and the
    // fixed placeholder description.
    assert.match(staged, new RegExp(`^name: ${record.generatedName}$`, "m"));
    assert.match(staged, /^disable-model-invocation: true$/m);
    assert.match(staged, /^description: /m);
    // Body preserved verbatim (the malformed frontmatter is discarded, not the body).
    assert.ok(staged.includes("# Bad Skill\n\nThis body must survive verbatim."));
    // Gate-2 parity: the staged bytes re-parse (do NOT throw) -- Pi accepts them.
    assert.doesNotThrow(() => parseFrontmatter(staged));
  });
});

test("NREG-01 valid skill is staged byte-for-byte identical to a name-rewrite + var-substitution of the source (gates mutate nothing)", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const skillsDir = path.join(pluginRoot, "skills");
    const resolved = makeResolved("acme", pluginRoot, skillsDir);

    const pluginDataDir = path.join(locations.dataRoot, "mp", "acme");
    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    // The all-valid path degrades nothing.
    assert.equal(prepared.result.degraded.length, 0);

    await commitPreparedSkills(prepared);

    // The `helper` source has `name: helper` (rewritten to `acme-helper`) and a
    // `${CLAUDE_PLUGIN_DATA}` body reference. Build the expected bytes with
    // INDEPENDENT literal string replacements -- NOT the production rewrite /
    // substitute helpers -- so the assertion proves the read-only gates
    // introduced no reformatting, re-quoting, or field reordering.
    const source = await readFile(path.join(skillsDir, "helper", "SKILL.md"), "utf8");
    const expected = source
      .replace("name: helper", "name: acme-helper")
      .replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot)
      .replaceAll("${CLAUDE_PLUGIN_DATA}", pluginDataDir);

    const staged = await readFile(
      path.join(locations.skillsTargetDir, "acme-helper", "SKILL.md"),
      "utf8",
    );
    // Byte-for-byte: the only differences from source are the name rewrite and
    // the two variable substitutions.
    assert.equal(staged, expected);
  });
});

// SKILL-02 / WTU-01 / WTU-02 augment arm (gate-1 RETURN branch) ------------

/**
 * Stage a single dynamically-authored source skill and return the staged
 * SKILL.md bytes. The source `name` is `s`, so the generated name is `acme-s`.
 */
async function stageAugmentSource(
  locations: ReturnType<typeof locationsFor>,
  dataRoot: string,
  sourceSkillMd: string,
): Promise<string> {
  const srcRoot = await mkdtemp(path.join(os.tmpdir(), "augment-src-"));
  try {
    const skillsDir = path.join(srcRoot, "skills");
    await mkdir(path.join(skillsDir, "s"), { recursive: true });
    await writeFile(path.join(skillsDir, "s", "SKILL.md"), sourceSkillMd);

    const resolved = makeResolved("acme", srcRoot, skillsDir);
    const prepared = await prepareStageSkills({
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "mp",
      pluginName: "acme",
      pluginRoot: srcRoot,
      pluginDataDir: dataRoot,
      resolved,
    });
    await commitPreparedSkills(prepared);

    return await readFile(path.join(locations.skillsTargetDir, "acme-s", "SKILL.md"), "utf8");
  } finally {
    await cleanupStaging(srcRoot, "test-cleanup");
  }
}

test("SKILL-02 description-less skill stages a first-body-paragraph description and stays model-invocable", async () => {
  await withTmpScope(async ({ locations }) => {
    const source =
      "---\nname: no-desc\nversion: 1.0.0\n---\n\n" +
      "# A Heading\n\n" +
      "The first genuine prose paragraph.\nSecond line of that paragraph.\n\n" +
      "A later paragraph that must not be captured.\n";

    const staged = await stageAugmentSource(
      locations,
      path.join(locations.dataRoot, "mp", "acme"),
      source,
    );

    const { frontmatter } = parseFrontmatter<{
      name: string;
      description: string;
      "disable-model-invocation"?: boolean;
    }>(staged);
    assert.equal(frontmatter.name, "acme-s");
    // The first-body paragraph spans two source lines; the safe single-line
    // double-quoted scalar emitter collapses its internal newline to a space.
    assert.equal(
      frontmatter.description,
      "The first genuine prose paragraph. Second line of that paragraph.",
    );
    // SKILL-02: filled skills stay model-invocable (no disable flag inserted).
    assert.equal(frontmatter["disable-model-invocation"], undefined);
    assert.ok(!staged.includes("disable-model-invocation"));
    // The later paragraph is not part of the description.
    assert.ok(!(frontmatter.description ?? "").includes("later paragraph"));
  });
});

test("SKILL-02 empty probe: a description-less skill with no prose body still stages a non-empty description", async () => {
  await withTmpScope(async ({ locations }) => {
    // Frontmatter parses cleanly; there is no description and no prose body.
    const source = "---\nname: empty-body\n---\n";

    const staged = await stageAugmentSource(
      locations,
      path.join(locations.dataRoot, "mp", "acme"),
      source,
    );

    const { frontmatter } = parseFrontmatter<{ description: string }>(staged);
    assert.ok(
      typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0,
      "empty-body skill must still carry a non-empty description (Pi drops empty-desc skills)",
    );
    assert.doesNotThrow(() => parseFrontmatter(staged));
  });
});

test("WTU-01 / WTU-02 when_to_use is folded into the description and hard-cut at 1,536", async () => {
  await withTmpScope(async ({ locations }) => {
    // Source combined length = 1000 + 1 (\n) + 536 = 1537 -> hard cut to 1536.
    const description = "a".repeat(1000);
    const whenToUse = "b".repeat(536);
    const source = `---\nname: wtu\ndescription: ${description}\nwhen_to_use: ${whenToUse}\n---\n\nBody.\n`;

    const staged = await stageAugmentSource(
      locations,
      path.join(locations.dataRoot, "mp", "acme"),
      source,
    );

    const { frontmatter } = parseFrontmatter<{ description: string }>(staged);
    // Hard cut to exactly 1,536 UTF-16 code units (no ellipsis).
    assert.equal(frontmatter.description.length, 1536);
    // The description carries the source description and the folded when_to_use
    // tail (the single `\n` fold separator collapses to a space in the emitted
    // double-quoted scalar).
    assert.ok(frontmatter.description.startsWith("a".repeat(1000)));
    assert.ok(frontmatter.description.includes("b"), "folded when_to_use tail present");
    assert.ok(frontmatter.description.endsWith("b"), "tail is the when_to_use text");
  });
});

test("WTU-02 / D-86-05 a >1024 combined description still parses to a non-empty description (Pi loads it)", async () => {
  await withTmpScope(async ({ locations }) => {
    // Combined length = 1000 + 1 + 200 = 1201 (in the 1025..1536 range): no cut.
    const description = "a".repeat(1000);
    const whenToUse = "b".repeat(200);
    const source = `---\nname: long\ndescription: ${description}\nwhen_to_use: ${whenToUse}\n---\n\nBody.\n`;

    const staged = await stageAugmentSource(
      locations,
      path.join(locations.dataRoot, "mp", "acme"),
      source,
    );

    // The staged bytes re-parse (do NOT throw) to a non-empty, >1024 description
    // -- NOT secretly truncated to Pi's 1,024 warning threshold (D-86-05).
    let parsed: { frontmatter: { description?: unknown } } | undefined;
    assert.doesNotThrow(() => {
      parsed = parseFrontmatter(staged);
    });
    const description2 = parsed?.frontmatter.description;
    assert.ok(typeof description2 === "string" && description2.length > 1024);
  });
});

test("SKILL-03 / WTU-01 a `>-` block-scalar description is replaced as a full node span, siblings byte-identical", async () => {
  await withTmpScope(async ({ locations }) => {
    const source =
      "---\n" +
      "name: block\n" +
      "description: >-\n" +
      "  A folded block scalar description\n" +
      "  spanning several source lines.\n" +
      "version: 2.3.1\n" +
      "tags: alpha, beta\n" +
      "when_to_use: Use it when triggered.\n" +
      "---\n\n" +
      "Body prose.\n";

    const staged = await stageAugmentSource(
      locations,
      path.join(locations.dataRoot, "mp", "acme"),
      source,
    );

    // Gate-2 parity: the staged bytes re-parse (do NOT throw).
    assert.doesNotThrow(() => parseFrontmatter(staged));
    const { frontmatter } = parseFrontmatter<{
      description: string;
      version: string;
      tags: string;
    }>(staged);
    // The folded scalar was folded WITH when_to_use into a single scalar.
    assert.ok(frontmatter.description.includes("A folded block scalar description"));
    assert.ok(frontmatter.description.endsWith("Use it when triggered."));
    // Sibling keys survive byte-identically (still their exact source lines).
    assert.ok(staged.includes("version: 2.3.1"), "version sibling byte-identical");
    assert.ok(staged.includes("tags: alpha, beta"), "tags sibling byte-identical");
    // The multi-line continuation lines are gone (collapsed into one scalar).
    assert.ok(
      !staged.includes("  spanning several source lines."),
      "block-scalar continuation lines removed",
    );
  });
});

test("SKILL-01 lone-CR (\\r-only) unparseable source: the malformed frontmatter is not leaked into the synthesized body (line-ending parity with parseFrontmatter)", async () => {
  await withTmpScope(async ({ locations }) => {
    const srcRoot = await mkdtemp(path.join(os.tmpdir(), "skill-cr-src-"));
    try {
      // A classic-Mac (lone-CR) source whose closed `---` block holds malformed
      // YAML. parseFrontmatter normalizes CR->LF and THROWS; the body extractor
      // must normalize CR the same way so it locates the close and does NOT
      // embed the malformed frontmatter block in the synthesized skill body.
      const skillsDir = path.join(srcRoot, "skills");
      await mkdir(path.join(skillsDir, "bad"), { recursive: true });
      const loneCr =
        "---\rname: [unterminated\rdescription: never reached\r---\r\r" +
        "# Bad Skill\r\rThis body must survive verbatim.\r";
      await writeFile(path.join(skillsDir, "bad", "SKILL.md"), loneCr);

      const resolved = makeResolved("acme", srcRoot, skillsDir);
      const prepared = await prepareStageSkills({
        locations,
        cwd: locations.scopeRoot,
        marketplaceName: "mp",
        pluginName: "acme",
        pluginRoot: srcRoot,
        pluginDataDir: path.join(locations.dataRoot, "mp", "acme"),
        resolved,
      });
      assert.equal(prepared.kind, "staged");
      assert.equal(prepared.result.degraded.length, 1);

      await commitPreparedSkills(prepared);
      const staged = await readFile(
        path.join(locations.skillsTargetDir, "acme-bad", "SKILL.md"),
        "utf8",
      );

      // The malformed frontmatter must NOT survive inside the synthesized body.
      assert.ok(!staged.includes("[unterminated"), "malformed frontmatter must not leak into body");
      assert.ok(!staged.includes("never reached"), "malformed frontmatter must not leak into body");
      // The real body survives and the synthesized block re-parses cleanly.
      assert.ok(staged.includes("This body must survive verbatim."));
      const { frontmatter } = parseFrontmatter<{
        name: string;
        "disable-model-invocation": boolean;
      }>(staged);
      assert.equal(frontmatter.name, "acme-bad");
      assert.equal(frontmatter["disable-model-invocation"], true);
    } finally {
      await cleanupStaging(srcRoot, "test-cleanup");
    }
  });
});

// SUB-01 / SUB-02: the skills surface consumes BOTH new substitution variables.
// A source skill whose body carries all four ${CLAUDE_*} tokens proves the
// end-to-end wiring: skillDir = <skillsTargetDir>/<generatedName>, and
// projectDir gated on install scope.
async function withFourTokenSkill<T>(
  fn: (ctx: { srcRoot: string; skillsDir: string }) => Promise<T>,
): Promise<T> {
  const srcRoot = await mkdtemp(path.join(os.tmpdir(), "skills-fourtoken-src-"));
  try {
    const skillsDir = path.join(srcRoot, "skills");
    await mkdir(path.join(skillsDir, "vars"), { recursive: true });
    await writeFile(
      path.join(skillsDir, "vars", "SKILL.md"),
      "---\nname: vars\ndescription: static\n---\n" +
        "Root: ${CLAUDE_PLUGIN_ROOT}\n" +
        "Data: ${CLAUDE_PLUGIN_DATA}\n" +
        "Skill: ${CLAUDE_SKILL_DIR}\n" +
        "Project: ${CLAUDE_PROJECT_DIR}\n",
    );
    return await fn({ srcRoot, skillsDir });
  } finally {
    await cleanupStaging(srcRoot, "test-cleanup");
  }
}

test("SUB-01/SUB-02 project-scope skill substitutes all four ${CLAUDE_*} tokens", async () => {
  await withFourTokenSkill(async ({ srcRoot, skillsDir }) => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "skills-proj-scope-"));
    try {
      const locations = locationsFor("project", tmp);
      const pluginDataDir = path.join(locations.dataRoot, "mp", "acme");
      const prepared = await prepareStageSkills({
        locations,
        marketplaceName: "mp",
        pluginName: "acme",
        pluginRoot: srcRoot,
        pluginDataDir,
        resolved: makeResolved("acme", srcRoot, skillsDir),
        cwd: tmp,
      });
      await commitPreparedSkills(prepared);

      const targetDir = path.join(locations.skillsTargetDir, "acme-vars");
      const staged = await readFile(path.join(targetDir, "SKILL.md"), "utf8");
      assert.ok(staged.includes(`Root: ${srcRoot}`), "pluginRoot substituted");
      assert.ok(staged.includes(`Data: ${pluginDataDir}`), "pluginData substituted");
      // SUB-01: skillDir resolves to the installed target dir.
      assert.ok(staged.includes(`Skill: ${targetDir}`), "skillDir substituted");
      // SUB-02: projectDir resolves to the install cwd for project scope.
      assert.ok(staged.includes(`Project: ${tmp}`), "projectDir substituted");
      assert.ok(!staged.includes("${CLAUDE_"), "no ${CLAUDE_*} token remains");
    } finally {
      await cleanupStaging(tmp, "test-cleanup");
    }
  });
});

test("SUB-02 user-scope skill keeps ${CLAUDE_PROJECT_DIR} literal; other three substitute", async () => {
  await withFourTokenSkill(async ({ srcRoot, skillsDir }) => {
    // User scope ignores cwd and derives scopeRoot from PI_CODING_AGENT_DIR;
    // relocate it to a tmpdir so the staged writes stay hermetic.
    const tmp = await mkdtemp(path.join(os.tmpdir(), "skills-user-scope-"));
    const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = tmp;
    try {
      const locations = locationsFor("user", tmp);
      const pluginDataDir = path.join(locations.dataRoot, "mp", "acme");
      const prepared = await prepareStageSkills({
        locations,
        marketplaceName: "mp",
        pluginName: "acme",
        pluginRoot: srcRoot,
        pluginDataDir,
        resolved: makeResolved("acme", srcRoot, skillsDir),
        // A user-scope caller may still supply cwd; the scope gate must ignore it.
        cwd: tmp,
      });
      await commitPreparedSkills(prepared);

      const targetDir = path.join(locations.skillsTargetDir, "acme-vars");
      const staged = await readFile(path.join(targetDir, "SKILL.md"), "utf8");
      assert.ok(staged.includes(`Root: ${srcRoot}`), "pluginRoot substituted");
      assert.ok(staged.includes(`Data: ${pluginDataDir}`), "pluginData substituted");
      assert.ok(staged.includes(`Skill: ${targetDir}`), "skillDir substituted");
      // SUB-02 divergence: user scope leaves the token literal.
      assert.ok(
        staged.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "projectDir stays literal under user scope",
      );
    } finally {
      if (prevAgentDir === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = prevAgentDir;
      }

      await cleanupStaging(tmp, "test-cleanup");
    }
  });
});
