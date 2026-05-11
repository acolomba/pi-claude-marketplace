import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverPluginAgents } from "../../../extensions/claude-marketplace/bridges/agents/discover.ts";

// AG-1 / AG-6: discoverPluginAgents -- frontmatter parse, sourceHash, AG-1
// elision, dotfile + non-md + symlink skip.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEST_PLUGIN_FIXTURE = path.resolve(HERE, "../_fixtures/test-plugin/agents");

async function makeTmpDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-discover-test-"));
  return {
    dir,
    cleanup: async (): Promise<void> => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("AG-6 discoverPluginAgents parses frontmatter from real fixtures (test-plugin/agents/)", async () => {
  const { discovered: got } = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [TEST_PLUGIN_FIXTURE],
  });
  assert.equal(got.length, 2);
  // Sorted by filename: acme-helper.md before bot.md
  assert.equal(got[0]?.sourceName, "acme-helper");
  assert.equal(got[1]?.sourceName, "bot");
});

test("AG-1 generatedName for source 'bot' under plugin 'acme' is 'claude-marketplace-acme-bot'", async () => {
  const { discovered: got } = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [TEST_PLUGIN_FIXTURE],
  });
  const bot = got.find((d) => d.sourceName === "bot");
  assert.ok(bot);
  assert.equal(bot.generatedName, "claude-marketplace-acme-bot");
});

test("AG-1 generatedName elides plugin prefix: source 'acme-helper' under plugin 'acme' is 'claude-marketplace-acme-helper'", async () => {
  const { discovered: got } = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [TEST_PLUGIN_FIXTURE],
  });
  const helper = got.find((d) => d.sourceName === "acme-helper");
  assert.ok(helper);
  // AG-1 elision: 'acme-helper' starts with 'acme-', so suffix = 'helper'.
  // Result: 'claude-marketplace-acme-helper' (NOT 'claude-marketplace-acme-acme-helper').
  assert.equal(helper.generatedName, "claude-marketplace-acme-helper");
});

test("discoverPluginAgents computes sourceHash over raw bytes (BOM-tolerant)", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    // Two files with the SAME utf8 content but different byte sequences (BOM vs no-BOM).
    const noBom = "---\nname: bot\ntools: Read\n---\nbody\n";
    const withBom = "﻿" + noBom;
    await writeFile(path.join(dir, "a.md"), noBom, "utf8");
    await writeFile(path.join(dir, "b.md"), withBom, "utf8");
    const { discovered: got } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [dir],
    });
    assert.equal(got.length, 2);
    assert.notEqual(got[0]?.sourceHash, got[1]?.sourceHash);
  } finally {
    await cleanup();
  }
});

test("discoverPluginAgents returns [] when agents dir missing (ENOENT)", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    const { discovered: got } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [path.join(dir, "no-such-dir")],
    });
    assert.deepEqual([...got], []);
  } finally {
    await cleanup();
  }
});

test("discoverPluginAgents skips dotfiles and non-md files", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    await writeFile(path.join(dir, ".hidden.md"), "---\nname: a\n---\nb\n");
    await writeFile(path.join(dir, "not-md.txt"), "x");
    await writeFile(path.join(dir, "real.md"), "---\nname: real\ntools: Read\n---\nbody\n");
    const { discovered: got } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [dir],
    });
    assert.equal(got.length, 1);
    assert.equal(got[0]?.sourceName, "real");
  } finally {
    await cleanup();
  }
});

test("discoverPluginAgents skips symlinked .md files (T-03-27)", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    // Create a target outside the agents dir, then symlink it in.
    const outside = path.join(dir, "outside");
    await mkdir(outside, { recursive: true });
    const realPath = path.join(outside, "real.md");
    await writeFile(realPath, "---\nname: target\n---\n");
    const agentsDir = path.join(dir, "agents");
    await mkdir(agentsDir, { recursive: true });
    await symlink(realPath, path.join(agentsDir, "linked.md"));
    // And one regular file we want kept.
    await writeFile(path.join(agentsDir, "real.md"), "---\nname: real\ntools: Read\n---\n");

    const { discovered: got } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [agentsDir],
    });
    assert.equal(got.length, 1);
    assert.equal(got[0]?.sourceName, "real");
  } finally {
    await cleanup();
  }
});

test("discoverPluginAgents falls back to filename stem when frontmatter has no name field", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    await writeFile(path.join(dir, "stem-name.md"), "---\ntools: Read\n---\nbody\n");
    const { discovered: got } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [dir],
    });
    assert.equal(got.length, 1);
    assert.equal(got[0]?.sourceName, "stem-name");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07 (COMP-01): agentsDirs is now `readonly string[]`. Multi-element
// arrays iterate per-dir; first-wins dedup by generated name surfaces a
// warning rather than throwing.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 discoverPluginAgents iterates multi-element agentsDirs (no collision)", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    const a = path.join(dir, "a");
    const b = path.join(dir, "b");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, "one.md"), "---\nname: one\ntools: Read\n---\nbody\n");
    await writeFile(path.join(b, "two.md"), "---\nname: two\ntools: Read\n---\nbody\n");

    const { discovered: got, warnings } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [a, b],
    });
    const names = got.map((d) => d.sourceName).sort();
    assert.deepEqual(names, ["one", "two"]);
    assert.deepEqual([...warnings], [], "no warnings when generated names disjoint");
  } finally {
    await cleanup();
  }
});

test("D-07 discoverPluginAgents first-wins dedup across array elements (collision -> warning)", async () => {
  const { dir, cleanup } = await makeTmpDir();
  try {
    // Both dirs declare an agent with frontmatter name 'shared'. Generated
    // name is `claude-marketplace-p-shared`; first-wins keeps dir `a`.
    const a = path.join(dir, "a");
    const b = path.join(dir, "b");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, "shared.md"), "---\nname: shared\ntools: Read\n---\nfrom-a\n");
    await writeFile(path.join(b, "shared.md"), "---\nname: shared\ntools: Read\n---\nfrom-b\n");

    const { discovered: got, warnings } = await discoverPluginAgents({
      pluginName: "p",
      agentsDirs: [a, b],
    });
    assert.equal(got.length, 1, "first-wins keeps only one");
    assert.equal(got[0]!.sourcePath, path.join(a, "shared.md"), "dir 'a' wins");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /elides to generated name "claude-marketplace-p-shared"/);
    assert.match(warnings[0]!, /ignoring duplicate/);
  } finally {
    await cleanup();
  }
});
