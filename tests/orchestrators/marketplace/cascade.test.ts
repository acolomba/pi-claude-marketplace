import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { cascadeUnstagePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(
  over: Partial<PluginRecord> & { resources?: Partial<PluginRecord["resources"]> } = {},
): PluginRecord {
  return {
    version: over.version ?? "0.0.1",
    resolvedSource: over.resolvedSource ?? "/tmp",
    compatibility: over.compatibility ?? {
      installable: true,
      notes: [],
      supported: [],
      unsupported: [],
    },
    resources: {
      skills: over.resources?.skills ?? [],
      prompts: over.resources?.prompts ?? [],
      agents: over.resources?.agents ?? [],
      mcpServers: over.resources?.mcpServers ?? [],
      hooks: over.resources?.hooks ?? [],
    },
    enabled: over.enabled ?? true,
    installedAt: over.installedAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

async function withTmpScope<T>(
  fn: (env: { cwd: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-cascade-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in cascadeUnstagePlugin -- removes
// <hooksDir>/<plugin>/ subtree between the agents foreign-content guard
// and the mcp unstage. dropped.hooks records the plugin name when the
// resources inventory declared hooks.
// ─────────────────────────────────────────────────────────────────────────────

test("cross-bridge lifecycle removes the hooks subtree and records the hook drop", async () => {
  await withTmpScope(async ({ locations }) => {
    // arrange
    // Pre-stage a hooks subtree at the documented bridge write path so we can
    // observe its removal.
    const hooksPluginDir = path.join(locations.hooksDir, "hello");
    await mkdir(hooksPluginDir, { recursive: true });
    await writeFile(
      path.join(hooksPluginDir, "hooks.json"),
      // HOOK-03 / LIFE-01: source-plugin seed uses the upstream PLUGIN-format
      // wrapper per Claude Code `plugin-dev/skills/hook-development/SKILL.md`.
      // This test does not compare on-disk bytes against the fixture -- it
      // only observes removal of the subtree -- so no consumer assertion
      // needs adjustment.
      JSON.stringify({
        hooks: {
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo bye" }] }],
        },
      }),
    );

    // act
    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({
        resources: {
          skills: [],
          prompts: [],
          agents: [],
          mcpServers: [],
          hooks: ["hello"],
        },
      }),
    );
    let stillThere = true;
    try {
      const { readFile } = await import("node:fs/promises");
      await readFile(path.join(hooksPluginDir, "hooks.json"), "utf8");
    } catch {
      stillThere = false;
    }

    // assert
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.dropped.hooks, ["hello"]);
    assert.equal(stillThere, false, "cascadeUnstagePlugin must remove the hooks subtree");
  });
});

test("cross-bridge lifecycle keeps hook removal idempotent when the subtree is absent", async () => {
  await withTmpScope(async ({ locations }) => {
    // arrange
    const record = makePluginRecord({
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["hello"] },
    });

    // act
    const outcome = await cascadeUnstagePlugin("hello", "valid-marketplace", locations, record);

    // assert
    assert.equal(outcome.ok, true);
    // removeHookConfig is idempotent (NFR-3) and always returns the plugin
    // name; the dropped.hooks array carries that name regardless of whether
    // the subtree existed on disk.
    assert.deepEqual(outcome.dropped.hooks, ["hello"]);
  });
});
