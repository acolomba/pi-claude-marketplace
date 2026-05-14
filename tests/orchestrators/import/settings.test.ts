import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadMergedClaudeSettingsForScope,
  mergeClaudeSettings,
  resolveClaudeSettingsPaths,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-claude-settings-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("resolveClaudeSettingsPaths resolves user paths from explicit config dir", () => {
  const got = resolveClaudeSettingsPaths("user", { claudeConfigDir: "/tmp/claude-config" });
  assert.equal(got.basePath, path.join("/tmp/claude-config", "settings.json"));
  assert.equal(got.localPath, path.join("/tmp/claude-config", "settings.local.json"));
});

test("resolveClaudeSettingsPaths resolves project paths from cwd", () => {
  const got = resolveClaudeSettingsPaths("project", { cwd: "/repo" });
  assert.equal(got.basePath, path.join("/repo", ".claude", "settings.json"));
  assert.equal(got.localPath, path.join("/repo", ".claude", "settings.local.json"));
});

test("resolveClaudeSettingsPaths default user paths point under .claude", () => {
  const got = resolveClaudeSettingsPaths("user", { claudeConfigDir: "/home/test/.claude" });
  assert.equal(got.basePath, path.join("/home/test/.claude", "settings.json"));
  assert.equal(got.localPath, path.join("/home/test/.claude", "settings.local.json"));
});

test("loadMergedClaudeSettingsForScope treats missing settings as empty without diagnostics", async () => {
  const { dir, cleanup } = await tempDir();
  try {
    const got = await loadMergedClaudeSettingsForScope("user", { claudeConfigDir: dir });
    assert.deepEqual(got.settings, { enabledPlugins: {}, extraKnownMarketplaces: {} });
    assert.deepEqual(got.diagnostics, []);
  } finally {
    await cleanup();
  }
});

test("loadMergedClaudeSettingsForScope diagnoses malformed base while valid local contributes", async () => {
  const { dir, cleanup } = await tempDir();
  try {
    await writeFile(path.join(dir, "settings.json"), "{not json");
    await writeFile(
      path.join(dir, "settings.local.json"),
      JSON.stringify({ enabledPlugins: { "local@mp": true } }),
    );

    const got = await loadMergedClaudeSettingsForScope("user", { claudeConfigDir: dir });
    assert.deepEqual(got.settings.enabledPlugins, { "local@mp": true });
    assert.equal(got.diagnostics.length, 1);
    assert.equal(got.diagnostics[0]?.code, "malformed-json");
    assert.equal(got.diagnostics[0]?.path, path.join(dir, "settings.json"));
  } finally {
    await cleanup();
  }
});

test("loadMergedClaudeSettingsForScope diagnoses malformed local while valid base contributes", async () => {
  const { dir, cleanup } = await tempDir();
  try {
    await writeFile(
      path.join(dir, "settings.json"),
      JSON.stringify({ enabledPlugins: { "base@mp": true } }),
    );
    await writeFile(path.join(dir, "settings.local.json"), "{not json");

    const got = await loadMergedClaudeSettingsForScope("user", { claudeConfigDir: dir });
    assert.deepEqual(got.settings.enabledPlugins, { "base@mp": true });
    assert.equal(got.diagnostics.length, 1);
    assert.equal(got.diagnostics[0]?.code, "malformed-json");
    assert.equal(got.diagnostics[0]?.path, path.join(dir, "settings.local.json"));
  } finally {
    await cleanup();
  }
});

test("mergeClaudeSettings shallow merges known sections with local override", () => {
  const got = mergeClaudeSettings(
    {
      enabledPlugins: { "a@mp": true, "base@mp": true },
      extraKnownMarketplaces: { private: { github: { repo: "old/repo" }, other: true }, base: {} },
    },
    {
      enabledPlugins: { "a@mp": false, "local@mp": true },
      extraKnownMarketplaces: { private: { directory: "../local" } },
    },
  );

  assert.deepEqual(got.enabledPlugins, { "a@mp": false, "base@mp": true, "local@mp": true });
  assert.deepEqual(got.extraKnownMarketplaces, {
    private: { directory: "../local" },
    base: {},
  });
});

test("mergeClaudeSettings treats non-object known sections as empty", () => {
  const got = mergeClaudeSettings(
    { enabledPlugins: "bad", extraKnownMarketplaces: null },
    { enabledPlugins: { "ok@mp": true }, extraKnownMarketplaces: [] },
  );

  assert.deepEqual(got, { enabledPlugins: { "ok@mp": true }, extraKnownMarketplaces: {} });
});
