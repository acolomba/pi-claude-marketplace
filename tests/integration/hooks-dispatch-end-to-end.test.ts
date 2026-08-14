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
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
    schemaVersion: 2,
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
            enabled: true,
            installedAt: "2026-06-17T00:00:00Z",
            updatedAt: "2026-06-17T00:00:00Z",
          },
        },
      },
    },
  };
}

function buildProjectScopeStateWithHooksPlugin(): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      "claude-plugins-official": {
        name: "claude-plugins-official",
        scope: "project",
        source: { kind: "path", raw: "/tmp/test-source" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/test-source/.claude-plugin/marketplace.json",
        marketplaceRoot: "/tmp/test-source",
        plugins: {
          "project-session-start": {
            version: "1.0.0",
            resolvedSource: "/tmp/test-source/plugins/project-session-start",
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
              hooks: ["project-session-start"],
            },
            enabled: true,
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
    // ctx.cwd is read by the session_start handler's lazy project hydrate;
    // carry the real project cwd so the hydrate resolves the right scope root.
    const placeholderCtx = { cwd: projectCwd } as unknown as ExtensionContext;
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

test("HOOK-E2E-02: project-scope SessionStart plugin dispatches via the session_start lazy project hydrate", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
    _resetExecutorForTest();
  });

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // Seed PROJECT-scope state.json + hooks.json on disk under the real
    // project cwd. The factory-time hydrate will NOT see this because
    // registerHooksBridge is called with a different cwd (agentDir) --
    // mirroring production, where the factory runs with cwd=homedir()
    // before the real project cwd is known. This is the bug condition:
    // project-scope SessionStart hooks are installed on disk but absent
    // from the routing table at session_start time.
    const projectExtensionRoot = path.join(projectCwd, ".pi", "pi-claude-marketplace");
    const projectHooksDir = path.join(projectExtensionRoot, "hooks", "project-session-start");
    await mkdir(projectHooksDir, { recursive: true });
    await saveState(projectExtensionRoot, buildProjectScopeStateWithHooksPlugin());
    await writeFile(path.join(projectHooksDir, "hooks.json"), HOOKS_JSON_BYTES, "utf8");

    const executorCalls: Array<{ pluginId: string; claudeEvent: string; scope: string }> = [];
    _setExecutorForTest((entry: RoutingEntry) => {
      executorCalls.push({
        pluginId: entry.pluginId,
        claudeEvent: entry.claudeEvent,
        scope: entry.scope,
      });
      return Promise.resolve({ kind: "noop" });
    });

    // Boot the bridge with cwd=agentDir (a stand-in for the factory's
    // homedir() -- NOT the real project). The factory-time project hydrate
    // reads <agentDir>/.pi/... which is empty, so the SessionStart bucket
    // is empty at boot.
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = { cwd: projectCwd } as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: agentDir });

    // Bug condition: no SessionStart entries are dispatchable right after
    // boot, because the factory could not hydrate project scope against the
    // real project cwd.
    const bucketBefore = _routingTableForTest().get("SessionStart") ?? [];
    assert.equal(
      bucketBefore.length,
      0,
      "SessionStart bucket must be empty at boot when the factory cwd is not the real project (the bug condition)",
    );

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");

    // Fire session_start with ctx.cwd = the real project. The handler's
    // lazy project hydrate reads <projectCwd>/.pi/..., rebuilds the routing
    // tables, and the SessionStart bucket now carries the project plugin --
    // so the composite handler dispatches it.
    await sessionStartReg.handler({ type: "session_start", reason: "startup" }, placeholderCtx);

    assert.equal(
      executorCalls.length,
      1,
      `executor must be invoked for the project-scope SessionStart plugin after the lazy hydrate; observed ${executorCalls.length} invocations`,
    );
    assert.equal(executorCalls[0]!.pluginId, "project-session-start");
    assert.equal(executorCalls[0]!.claudeEvent, "SessionStart");
    assert.equal(executorCalls[0]!.scope, "project");
  });
});

test("HOOK-E2E-03: WR-05 -- session_start lazy hydrate writes nothing under a pristine project cwd", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
    _resetExecutorForTest();
  });

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // USER scope owns the only SessionStart-declaring plugin; the project
    // scope is pristine (no state.json, no hooks.json, no `.pi` at all).
    const userExtensionRoot = path.join(agentDir, "pi-claude-marketplace");
    const userHooksDir = path.join(userExtensionRoot, "hooks", "learning-output-style");
    await mkdir(userHooksDir, { recursive: true });
    await saveState(userExtensionRoot, buildUserScopeStateWithHooksPlugin());
    await writeFile(path.join(userHooksDir, "hooks.json"), HOOKS_JSON_BYTES, "utf8");

    _setExecutorForTest(() => Promise.resolve({ kind: "noop" }));

    // Boot against a THIRD cwd so the factory's own `_shared` mkdir cannot
    // land in projectCwd and mask what the session_start path does.
    const bootCwd = path.join(agentDir, "boot-cwd");
    await mkdir(bootCwd, { recursive: true });

    const { pi, registrations } = makeMockPi();
    const placeholderCtx = { cwd: projectCwd } as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: bootCwd });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");

    await sessionStartReg.handler({ type: "session_start", reason: "startup" }, placeholderCtx);

    // The lazy hydrate gates its `_shared` mkdir on a PROJECT-scope
    // SessionStart entry actually existing. With only a user-scope plugin
    // installed, an unsolicited mkdir here would create `<cwd>/.pi/...` in
    // the user's project on every session start -- the WR-05 violation.
    assert.deepEqual(
      await readdir(projectCwd),
      [],
      "pristine project cwd must stay empty across session_start (WR-05)",
    );
  });
});

test("HOOK-E2E-04: a throwing lazy project hydrate never blocks SessionStart dispatch", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
    _resetExecutorForTest();
  });

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // USER scope owns the SessionStart-declaring plugin, so there IS an
    // entry that must still dispatch once the hydrate blows up.
    const userExtensionRoot = path.join(agentDir, "pi-claude-marketplace");
    const userHooksDir = path.join(userExtensionRoot, "hooks", "learning-output-style");
    await mkdir(userHooksDir, { recursive: true });
    await saveState(userExtensionRoot, buildUserScopeStateWithHooksPlugin());
    await writeFile(path.join(userHooksDir, "hooks.json"), HOOKS_JSON_BYTES, "utf8");

    const executorCalls: Array<{ pluginId: string; claudeEvent: string }> = [];
    _setExecutorForTest((entry: RoutingEntry) => {
      executorCalls.push({ pluginId: entry.pluginId, claudeEvent: entry.claudeEvent });
      return Promise.resolve({ kind: "noop" });
    });

    const { pi, registrations } = makeMockPi();
    await registerHooksBridge(pi, {
      ctx: { cwd: projectCwd } as unknown as ExtensionContext,
      cwd: projectCwd,
    });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");

    // Fire session_start with a ctx carrying NO `cwd`. The lazy hydrate
    // calls `locationsFor("project", ctx.cwd)`, whose `path.join(cwd, ".pi")`
    // rejects a non-string with ERR_INVALID_ARG_TYPE. That throw escapes
    // `hydrateProjectScopeForCwd` -- its own try/catch wraps only the
    // `loadState` call, not the `locationsFor` above it -- so it lands in
    // the handler's catch and routes through the OBS-01 debug seam.
    //
    // This ctx shape is not hypothetical: it is what the bridge was called
    // with before the lazy hydrate existed, so the catch is what keeps a Pi
    // build that omits `cwd` from degrading a broken hydrate into a dead
    // SessionStart.
    const ctxWithoutCwd = {} as unknown as ExtensionContext;

    // Awaited bare rather than through assert.doesNotReject: a regression
    // here should surface the real ERR_INVALID_ARG_TYPE stack, not a
    // generic "got rejection" message.
    await sessionStartReg.handler({ type: "session_start", reason: "startup" }, ctxWithoutCwd);

    // The contract the catch exists to hold: dispatch proceeds anyway.
    assert.equal(
      executorCalls.length,
      1,
      `executor must still be invoked for the user-scope SessionStart entry after the hydrate throws; observed ${executorCalls.length} invocations`,
    );
    assert.equal(executorCalls[0]!.pluginId, "learning-output-style");
    assert.equal(executorCalls[0]!.claudeEvent, "SessionStart");
  });
});
