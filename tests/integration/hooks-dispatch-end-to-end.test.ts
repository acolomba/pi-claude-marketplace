// tests/integration/hooks-dispatch-end-to-end.test.ts
//
// End-to-end regression test for the hooks-bridge boot + dispatch path.
//
// Pins the contract: with a hooks-only user-scope plugin recorded in
// state.json + a valid hooks.json on disk, calling registerHooksBridge
// against a mock Pi must:
//   1. Subscribe pi.on("session_start", handler)
//   2. Populate the routing table's SessionStart bucket from the cache
//   3. Survive the sequential per-scope rebuild loop without wiping
//   4. Invoke the executor on the captured handler when session_start fires
//
// Regression gate for the cross-scope wipe (commit 2dbbcbd) and for any
// future change that would make the boot loop fail to populate the
// routing table for a user-scope plugin when the project scope is empty.
//
// Test shape: real on-disk state.json + hooks.json, real cache + rebuild,
// composite-handler dispatch routed through the `_setExecutorForTest` seam
// (no child process spawned). This is the smallest test that would have
// caught the runtime bug the unit tests missed.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  _resetExecutorForTest,
  _setExecutorForTest,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  _resetForTest,
  _routingTableForTest,
  registerHooksBridge,
  type RoutingEntry,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface CapturedRegistration {
  readonly event: string;
  readonly handler: (event: unknown, ctx: ExtensionContext) => unknown;
}

function makeMockPi(): { pi: ExtensionAPI; registrations: CapturedRegistration[] } {
  const registrations: CapturedRegistration[] = [];
  const pi = {
    on: (event: string, handler: CapturedRegistration["handler"]): void => {
      registrations.push({ event, handler });
    },
  } as unknown as ExtensionAPI;
  return { pi, registrations };
}

function buildUserScopeStateWithHooksPlugin(): ExtensionState {
  return {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        name: "claude-plugins-official",
        scope: "user",
        source: { kind: "path", raw: "/tmp/test-source" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/test-source/.claude-plugin/marketplace.json",
        marketplaceRoot: "/tmp/test-source",
        plugins: {
          "learning-output-style": {
            version: "1.0.0",
            resolvedSource: "/tmp/test-source/plugins/learning-output-style",
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
              hooks: ["learning-output-style"],
            },
            installedAt: "2026-06-17T00:00:00Z",
            updatedAt: "2026-06-17T00:00:00Z",
          },
        },
      },
    },
  };
}

const HOOKS_JSON_BYTES = JSON.stringify(
  {
    description: "Learning mode hook",
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/hooks-handlers/session-start.sh"',
            },
          ],
        },
      ],
    },
  },
  null,
  2,
);

async function withHermeticPiHome<T>(
  fn: (env: { agentDir: string; projectCwd: string }) => Promise<T>,
): Promise<T> {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "hooks-e2e-"));
  const agentDir = path.join(tmpRoot, "agent");
  const projectCwd = path.join(tmpRoot, "cwd");
  await mkdir(agentDir, { recursive: true });
  await mkdir(projectCwd, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    return await fn({ agentDir, projectCwd });
  } finally {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(tmpRoot, { recursive: true, force: true });
  }
}

test("HOOK-E2E-01: registerHooksBridge boots a user-scope hooks-only plugin and dispatches SessionStart end-to-end", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
    _resetExecutorForTest();
  });

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // Seed user-scope state.json + hooks.json on disk (the bytes the bridge
    // would observe after a real install).
    const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
    const hooksDir = path.join(extensionRoot, "hooks", "learning-output-style");
    await mkdir(hooksDir, { recursive: true });
    await saveState(extensionRoot, buildUserScopeStateWithHooksPlugin());
    await writeFile(path.join(hooksDir, "hooks.json"), HOOKS_JSON_BYTES, "utf8");

    // Capture every executor invocation to verify dispatch.
    const executorCalls: Array<{ pluginId: string; claudeEvent: string }> = [];
    _setExecutorForTest((entry: RoutingEntry) => {
      executorCalls.push({ pluginId: entry.pluginId, claudeEvent: entry.claudeEvent });
      return Promise.resolve({ kind: "noop" });
    });

    // Boot the bridge against the mock Pi. Project scope is empty (only
    // agentDir is seeded) -- this is the exact shape that triggered the
    // cross-scope wipe regression.
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {} as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: projectCwd });

    // pi.on("session_start", ...) must have been registered.
    const sessionStartRegs = registrations.filter((r) => r.event === "session_start");
    assert.equal(
      sessionStartRegs.length,
      1,
      "registerHooksBridge must register exactly one session_start handler",
    );

    // The routing table's SessionStart bucket must contain the plugin's
    // entry after the sequential per-scope rebuild (the cross-scope wipe
    // regression flipped this back to 0 after the project-scope rebuild).
    const sessionStartBucket = _routingTableForTest().get("SessionStart") ?? [];
    assert.equal(
      sessionStartBucket.length,
      1,
      `SessionStart routing bucket must contain the user-scope plugin's entry after boot (cross-scope wipe regression); observed ${sessionStartBucket.length} entries`,
    );
    assert.equal(sessionStartBucket[0]!.pluginId, "learning-output-style");
    assert.equal(sessionStartBucket[0]!.scope, "user");

    // Now fire a synthetic session_start event through the captured handler
    // and assert the executor was invoked for the plugin -- the contract Pi
    // exercises at every session launch.
    const sessionStartEvent: SessionStartEvent = {
      type: "session_start",
      reason: "startup",
    };
    await sessionStartRegs[0]!.handler(sessionStartEvent, placeholderCtx);

    assert.equal(
      executorCalls.length,
      1,
      `executor must be invoked exactly once for the user-scope plugin's SessionStart entry; observed ${executorCalls.length} invocations`,
    );
    assert.equal(executorCalls[0]!.pluginId, "learning-output-style");
    assert.equal(executorCalls[0]!.claudeEvent, "SessionStart");
  });
});
