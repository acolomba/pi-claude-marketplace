// tests/integration/hooks-cross-scope-reconcile.test.ts
//
// End-to-end coverage for the cross-scope-wipe regression's PRODUCTION
// caller: `applyReconcile` iterates per-scope and, after each scope's apply
// pass, calls `rebuildScopeRoutingTable -> rebuildRoutingTables()`. Before
// the fix the per-scope rebuild filtered the cache by `loc.scope` and the
// last scope's empty view overwrote the first scope's populated buckets.
//
// The unit pin in `tests/bridges/hooks/event-router.test.ts` covers the
// rebuild primitive in isolation. This file covers the full applyReconcile
// fan-out with hooks plugins seeded in BOTH user AND project scope and
// verifies the routing table still holds entries from both scopes after
// the reconcile completes.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  _resetForTest,
  _routingTableForTest,
  registerHooksBridge,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { applyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function makeMockPi(): ExtensionAPI {
  return {
    on: () => undefined,
  } as unknown as ExtensionAPI;
}

function buildStateWithSingleHooksPlugin(opts: {
  scope: "user" | "project";
  marketplace: string;
  plugin: string;
  resolvedSource: string;
  marketplaceRoot: string;
}): ExtensionState {
  return {
    schemaVersion: 1,
    marketplaces: {
      [opts.marketplace]: {
        name: opts.marketplace,
        scope: opts.scope,
        source: { kind: "path", raw: opts.marketplaceRoot },
        addedFromCwd: opts.marketplaceRoot,
        manifestPath: path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {
          [opts.plugin]: {
            version: "1.0.0",
            resolvedSource: opts.resolvedSource,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["hooks"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [opts.plugin],
            },
            installedAt: "2026-06-17T00:00:00Z",
            updatedAt: "2026-06-17T00:00:00Z",
          },
        },
      },
    },
  };
}

test("RECON / cross-scope: applyReconcile's per-scope rebuild loop preserves hooks-plugin entries in BOTH scopes", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
  });

  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "hooks-cross-scope-recon-"));
  const agentDir = path.join(tmpRoot, "agent");
  const projectCwd = path.join(tmpRoot, "project");

  await mkdir(agentDir, { recursive: true });
  await mkdir(projectCwd, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    // Seed USER scope: one hooks-bearing plugin with a PreToolUse handler.
    const userLoc = locationsFor("user", projectCwd);
    const userPluginRoot = path.join(tmpRoot, "user-mp-src", "plugins", "user-plugin");
    await mkdir(userPluginRoot, { recursive: true });
    await saveState(
      userLoc.extensionRoot,
      buildStateWithSingleHooksPlugin({
        scope: "user",
        marketplace: "user-mp",
        plugin: "user-plugin",
        resolvedSource: userPluginRoot,
        marketplaceRoot: path.join(tmpRoot, "user-mp-src"),
      }),
    );
    const userHooksDir = path.join(userLoc.extensionRoot, "hooks", "user-plugin");
    await mkdir(userHooksDir, { recursive: true });
    await writeFile(
      path.join(userHooksDir, "hooks.json"),
      JSON.stringify({
        PreToolUse: [
          {
            hooks: [{ type: "command", command: "echo user" }],
          },
        ],
      }),
      "utf8",
    );

    // Seed PROJECT scope: one DIFFERENT hooks-bearing plugin with the same
    // event so the routing bucket should hold BOTH entries after rebuild.
    const projectLoc = locationsFor("project", projectCwd);
    const projectPluginRoot = path.join(tmpRoot, "project-mp-src", "plugins", "project-plugin");
    await mkdir(projectPluginRoot, { recursive: true });
    await saveState(
      projectLoc.extensionRoot,
      buildStateWithSingleHooksPlugin({
        scope: "project",
        marketplace: "project-mp",
        plugin: "project-plugin",
        resolvedSource: projectPluginRoot,
        marketplaceRoot: path.join(tmpRoot, "project-mp-src"),
      }),
    );
    const projectHooksDir = path.join(projectLoc.extensionRoot, "hooks", "project-plugin");
    await mkdir(projectHooksDir, { recursive: true });
    await writeFile(
      path.join(projectHooksDir, "hooks.json"),
      JSON.stringify({
        PreToolUse: [
          {
            hooks: [{ type: "command", command: "echo project" }],
          },
        ],
      }),
      "utf8",
    );

    // Boot the bridge: hydrate the cache from disk for both scopes so the
    // rebuild walks both scopes' cached entries.
    const placeholderCtx = {
      cwd: projectCwd,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-cross-scope-recon",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;
    await registerHooksBridge(makeMockPi(), { ctx: placeholderCtx, cwd: projectCwd });

    // Sanity: after boot, the routing table holds both scopes' PreToolUse
    // entries. This is the pre-condition the regression broke.
    const preBucket = _routingTableForTest().get("PreToolUse") ?? [];
    assert.equal(
      preBucket.length,
      2,
      `expected user + project PreToolUse entries after registerHooksBridge; got ${String(preBucket.length)}`,
    );

    // Drive applyReconcile across BOTH scopes (omitted `scope` fan-out).
    // The per-scope rebuild loop runs for project then user. Before the
    // fix, the second iteration's filtered view would wipe the first
    // scope's entries from the global routing table.
    await applyReconcile({
      ctx: placeholderCtx,
      pi: makeMockPi(),
      cwd: projectCwd,
    });

    // Post-condition: BOTH scopes' PreToolUse entries must still surface.
    // This is the regression gate -- if the per-scope rebuild ever
    // returns to a scope-filtered cache walk, the test red-fails because
    // one of the two entries goes missing.
    const postBucket = _routingTableForTest().get("PreToolUse") ?? [];
    assert.equal(
      postBucket.length,
      2,
      `cross-scope wipe regression: expected BOTH user + project entries after applyReconcile; got ${String(postBucket.length)}`,
    );
    const pluginIds = postBucket.map((e) => `${e.scope}/${e.pluginId}`).sort();
    assert.deepEqual(
      pluginIds,
      ["project/project-plugin", "user/user-plugin"],
      "applyReconcile's per-scope rebuild must preserve entries from BOTH scopes",
    );
  } finally {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(tmpRoot, { recursive: true, force: true });
  }
});
