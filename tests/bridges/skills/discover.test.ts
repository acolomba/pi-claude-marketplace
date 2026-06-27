import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverPluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/discover.ts";
import { cleanupStaging } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

// Resolve fixture root relative to THIS file (worktree-safe; do NOT use cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "_fixtures");

function makeResolved(
  pluginRoot: string,
  skillsDirAbs: string | undefined,
): ResolvedPluginInstallable {
  // D-07: componentPaths.skills is `readonly string[]`. Tests pass the
  // absolute fixture dir directly (verbatim element); the bridge accepts
  // both absolute and relative-to-pluginRoot elements.
  return {
    state: "installable",
    name: "acme",
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

test("SK-5 discoverPluginSkills returns sorted DiscoveredSkill[] for fixture plugin", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.equal(discovered.length, 2, "expected 2 discovered skills");
  assert.deepEqual([...warnings], [], "no warnings expected on happy path");

  // Alphabetic sort: "acme-knowledge" < "helper".
  assert.equal(discovered[0]!.sourceName, "acme-knowledge");
  assert.equal(discovered[1]!.sourceName, "helper");
});

test("SK-2 discoverPluginSkills generates name 'acme-knowledge' (elided) for source already prefixed", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
  const acmeKnowledge = discovered.find((s) => s.sourceName === "acme-knowledge");
  assert.ok(acmeKnowledge, "acme-knowledge entry missing");
  assert.equal(acmeKnowledge.generatedName, "acme-knowledge");
});

test("SK-2 discoverPluginSkills generates name 'acme-helper' for unprefixed source", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
  const helper = discovered.find((s) => s.sourceName === "helper");
  assert.ok(helper, "helper entry missing");
  assert.equal(helper.generatedName, "acme-helper");
});

test("SK-5 discoverPluginSkills returns [] when skills dir missing (ENOENT graceful)", async () => {
  // empty-mcp fixture has no `skills/` dir.
  const pluginRoot = path.join(FIXTURES, "empty-mcp");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual([...discovered], []);
  assert.deepEqual([...warnings], []);
});

test("SK-5 discoverPluginSkills returns [] when componentPaths.skills is empty", async () => {
  const resolved = makeResolved("/anywhere", undefined);
  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual([...discovered], []);
  assert.deepEqual([...warnings], []);
});

test("discoverPluginSkills skips dotfile-prefixed directories", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-dotfiles-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Hidden dir with SKILL.md should be skipped.
    await mkdir(path.join(skillsDir, ".hidden"));
    await writeFile(path.join(skillsDir, ".hidden", "SKILL.md"), "---\nname: x\n---\nbody");
    // Visible dir should be included.
    await mkdir(path.join(skillsDir, "visible"));
    await writeFile(path.join(skillsDir, "visible", "SKILL.md"), "---\nname: visible\n---\nbody");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "visible");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills skips entries without SKILL.md", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-no-skillmd-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Dir without SKILL.md should be skipped.
    await mkdir(path.join(skillsDir, "no-skill-md"));
    await writeFile(path.join(skillsDir, "no-skill-md", "README.md"), "no skill here");
    // Dir with SKILL.md present.
    await mkdir(path.join(skillsDir, "with-skill"));
    await writeFile(path.join(skillsDir, "with-skill", "SKILL.md"), "---\nname: with-skill\n---");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "with-skill");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills skips symlinked skill dirs (T-03-15 hardening)", async (t) => {
  if (process.platform === "win32") {
    t.skip("symlink semantics differ on Windows");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-symlink-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Real directory outside skillsDir.
    const elsewhere = path.join(tmp, "elsewhere");
    await mkdir(elsewhere);
    await writeFile(path.join(elsewhere, "SKILL.md"), "---\nname: evil\n---");
    // Symlink inside skillsDir pointing to elsewhere.
    await symlink(elsewhere, path.join(skillsDir, "evil-link"));
    // Plus a regular skill so we know discovery itself ran.
    await mkdir(path.join(skillsDir, "real-skill"));
    await writeFile(path.join(skillsDir, "real-skill", "SKILL.md"), "---\nname: real\n---");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "real-skill");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07 (COMP-01): multi-element componentPaths.skills with first-wins dedup.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 discoverPluginSkills iterates multi-element componentPaths.skills (no collision)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-multi-"));
  try {
    // Two independent skills dirs, no overlap.
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(path.join(a, "one"), { recursive: true });
    await writeFile(path.join(a, "one", "SKILL.md"), "---\nname: one\n---\nbody");
    await mkdir(path.join(b, "two"), { recursive: true });
    await writeFile(path.join(b, "two", "SKILL.md"), "---\nname: two\n---\nbody");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [a, b], commands: [], agents: [] },
      mcpServers: {},
    };

    const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 2, "both dirs' sources discovered");
    const names = discovered.map((d) => d.sourceName).sort();
    assert.deepEqual(names, ["one", "two"]);
    assert.deepEqual([...warnings], [], "no warnings when generated names disjoint");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("D-07 discoverPluginSkills first-wins dedup across array elements (collision -> warning)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-dedup-"));
  try {
    // Two dirs each contain a "shared" subdir with SKILL.md. Both generate
    // the name "acme-shared". First-wins: dir `a` is kept; dir
    // `b` surfaces a soft-fail warning. RN-6 within-dir collisions are NOT
    // exercised here -- those are HARD errors at `assertNoSkillCollisions`.
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(path.join(a, "shared"), { recursive: true });
    await writeFile(path.join(a, "shared", "SKILL.md"), "---\nname: shared\n---\nfrom-a");
    await mkdir(path.join(b, "shared"), { recursive: true });
    await writeFile(path.join(b, "shared", "SKILL.md"), "---\nname: shared\n---\nfrom-b");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [a, b], commands: [], agents: [] },
      mcpServers: {},
    };

    const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1, "first-wins keeps only one");
    assert.equal(discovered[0]!.skillDir, path.join(a, "shared"), "dir 'a' wins");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /elides to generated name "acme-shared"/);
    assert.match(warnings[0]!, /ignoring duplicate/);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});
