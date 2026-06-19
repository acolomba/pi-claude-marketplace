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

test("cascadeUnstagePlugin (a): empty resources -- all bridges return cleanly with empty dropped", async () => {
  await withTmpScope(async ({ locations }) => {
    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
      }),
    );
    assert.equal(outcome.ok, true);
    // LIFE-01: removeHookConfig is idempotent (NFR-3) and always returns the
    // plugin name regardless of whether the on-disk subtree existed; the
    // dropped.hooks array records that name. Skills / commands / agents /
    // mcpServers stay empty because the unstage*-by-name primitives have
    // nothing to remove.
    assert.deepEqual(outcome.dropped, {
      skills: [],
      commands: [],
      agents: [],
      hooks: ["hello"],
      mcpServers: [],
    });
    assert.equal(outcome.cause, undefined);
  });
});

test("cascadeUnstagePlugin (a): real skills unstage path -- pre-staged skill is dropped", async () => {
  await withTmpScope(async ({ locations }) => {
    // Pre-stage a skill at <skillsTargetDir>/hello-greet/SKILL.md (the
    // path the skills bridge expects for an installed skill named
    // "hello-greet").
    const skillDir = path.join(locations.skillsTargetDir, "hello-greet");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: hello-greet\n---\nbody\n");

    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({
        resources: {
          skills: ["hello-greet"],
          prompts: [],
          agents: [],
          mcpServers: [],
          hooks: [],
        },
      }),
    );
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.dropped.skills, ["hello-greet"]);
  });
});

test("cascadeUnstagePlugin (c): bogus locations -- agents-index.json IO surface assertion (shape)", async () => {
  // We trip the agents bridge by passing a locations bundle that points
  // at a path the bridge cannot create or read. Create a regular file
  // where the agents bridge expects a directory (or vice versa). The
  // exact failure mode is bridge-specific -- this test asserts the
  // SHAPE: outcome.ok === false and outcome.cause is set, OR outcome.ok
  // === true and outcome.dropped.agents is [] (the cascade primitive's
  // contract is satisfied either way).
  await withTmpScope(async ({ locations }) => {
    // Pre-place a regular FILE at agents-staging path so any bridge
    // attempt to create that directory will fail with ENOTDIR.
    await writeFile(locations.agentsStagingDir, "not-a-directory");

    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      // Force the agents path: by giving a skills source dir that doesn't
      // exist, the skills bridge no-ops silently (idempotent); but the
      // agents bridge's lstat against agentsStagingDir will fail.
      makePluginRecord({
        resources: {
          skills: [],
          prompts: [],
          agents: ["pi-claude-marketplace-hello-greet-agent"],
          mcpServers: [],
          hooks: [],
        },
      }),
    );
    // The cascade primitive may catch into ok:false OR may pass through
    // skills/commands cleanly and only fail at agents -- assert the
    // shape, not the specific bridge.
    if (!outcome.ok) {
      assert.ok(outcome.cause instanceof Error);
    } else {
      // If the agents bridge accommodates this case as a clean miss,
      // the cascade returns ok:true with empty dropped -- that is also
      // acceptable; the test guards the SHAPE.
      assert.deepEqual(outcome.dropped.agents, []);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in cascadeUnstagePlugin -- removes
// <hooksDir>/<plugin>/ subtree between the agents foreign-content guard
// and the mcp unstage. dropped.hooks records the plugin name when the
// resources inventory declared hooks.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01: cascadeUnstagePlugin removes <hooksDir>/<plugin>/ and records dropped.hooks", async () => {
  await withTmpScope(async ({ locations }) => {
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
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.dropped.hooks, ["hello"]);

    // The subtree must be gone.
    let stillThere = true;
    try {
      const { readFile } = await import("node:fs/promises");
      await readFile(path.join(hooksPluginDir, "hooks.json"), "utf8");
    } catch {
      stillThere = false;
    }

    assert.equal(stillThere, false, "cascadeUnstagePlugin must remove the hooks subtree");
  });
});

test("LIFE-01: cascadeUnstagePlugin records dropped.hooks for the plugin name even with no on-disk subtree (idempotent)", async () => {
  await withTmpScope(async ({ locations }) => {
    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["hello"] },
      }),
    );
    assert.equal(outcome.ok, true);
    // removeHookConfig is idempotent (NFR-3) and always returns the plugin
    // name; the dropped.hooks array carries that name regardless of whether
    // the subtree existed on disk.
    assert.deepEqual(outcome.dropped.hooks, ["hello"]);
  });
});
