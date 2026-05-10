import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverPluginSkills } from "../../../extensions/claude-marketplace/bridges/skills/discover.ts";
import { cleanupStaging } from "../../../extensions/claude-marketplace/shared/fs-utils.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/claude-marketplace/domain/resolver.ts";

// Resolve fixture root relative to THIS file (worktree-safe; do NOT use cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "_fixtures");

function makeResolved(
  pluginRoot: string,
  skillsDirAbs: string | undefined,
): ResolvedPluginInstallable {
  return {
    installable: true,
    name: "acme",
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: skillsDirAbs === undefined ? {} : { skills: skillsDirAbs },
    mcpServers: {},
  };
}

test("SK-5 discoverPluginSkills returns sorted DiscoveredSkill[] for fixture plugin", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const result = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.equal(result.length, 2, "expected 2 discovered skills");

  // Alphabetic sort: "acme-knowledge" < "helper".
  assert.equal(result[0]!.sourceName, "acme-knowledge");
  assert.equal(result[1]!.sourceName, "helper");
});

test("SK-2 discoverPluginSkills generates name 'acme-knowledge' (elided) for source already prefixed", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const result = await discoverPluginSkills({ pluginName: "acme", resolved });
  const acmeKnowledge = result.find((s) => s.sourceName === "acme-knowledge");
  assert.ok(acmeKnowledge, "acme-knowledge entry missing");
  assert.equal(acmeKnowledge.generatedName, "acme-knowledge");
});

test("SK-2 discoverPluginSkills generates name 'acme-helper' (prefix-add) for unprefixed source", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const result = await discoverPluginSkills({ pluginName: "acme", resolved });
  const helper = result.find((s) => s.sourceName === "helper");
  assert.ok(helper, "helper entry missing");
  assert.equal(helper.generatedName, "acme-helper");
});

test("SK-5 discoverPluginSkills returns [] when skills dir missing (ENOENT graceful)", async () => {
  // empty-mcp fixture has no `skills/` dir.
  const pluginRoot = path.join(FIXTURES, "empty-mcp");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const result = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual(result, []);
});

test("SK-5 discoverPluginSkills returns [] when componentPaths.skills is undefined", async () => {
  const resolved = makeResolved("/anywhere", undefined);
  const result = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual(result, []);
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
    const result = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(result.length, 1);
    assert.equal(result[0]!.sourceName, "visible");
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
    const result = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(result.length, 1);
    assert.equal(result[0]!.sourceName, "with-skill");
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
    const result = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(result.length, 1);
    assert.equal(result[0]!.sourceName, "real-skill");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});
