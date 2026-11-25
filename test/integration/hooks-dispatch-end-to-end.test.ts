// test/integration/hooks-dispatch-end-to-end.test.ts
//
// One case of the hooks bridge's SessionStart dispatch, kept as an internal
// case (ITSCOPE-01): a host context with no `cwd` makes the lazy project
// hydrate throw, and the user-scope entry still dispatches. No Pi that a
// scenario starts leaves `cwd` out of its context, so cucumber cannot reach
// the case. Everything a user can see of the boot and the dispatch is in
// cucumber: the user and project SessionStart runs and WR-05 in
// `features/hook/session.feature` and
// `features/plugin/session-start-hooks.feature`, the booted options in
// `features/hook/process.feature` (D-PG10-23) and
// `features/hook/failures.feature` (D-PG10-25), and a child's tool result
// payloads in `features/plugin/subagent-child.feature`.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createHooksHydration,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { type RoutingEntry } from "../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { recordedMcpServerNames } from "../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { HookExecutor } from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
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

function buildStateWithHooksPlugin(scope: "user" | "project", pluginId: string): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      "claude-plugins-official": {
        name: "claude-plugins-official",
        scope,
        source: { kind: "path", raw: "/tmp/test-source" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/test-source/.claude-plugin/marketplace.json",
        marketplaceRoot: "/tmp/test-source",
        plugins: {
          [pluginId]: {
            version: "1.0.0",
            resolvedSource: `/tmp/test-source/plugins/${pluginId}`,
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
              hooks: [pluginId],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-06-17T00:00:00Z",
            updatedAt: "2026-06-17T00:00:00Z",
          },
        },
      },
    },
  };
}

// The session_start handler reads the session id to drop a repeated start.
const E2E_SESSION = { getSessionId: () => "hooks-e2e-session" };

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
  return withHermeticEnvironment("hooks-e2e-", async ({ root: tmpRoot, agentDir }) => {
    const projectCwd = path.join(tmpRoot, "cwd");
    await mkdir(projectCwd, { recursive: true });
    return await fn({ agentDir, projectCwd });
  });
}

/** Seeds the state.json and hooks.json bytes the bridge observes after a real install. */
async function seedHooksPlugin(
  extensionRoot: string,
  scope: "user" | "project",
  pluginId: string,
): Promise<void> {
  const hooksDir = path.join(extensionRoot, "hooks", pluginId);
  await mkdir(hooksDir, { recursive: true });
  await saveState(extensionRoot, buildStateWithHooksPlugin(scope, pluginId));
  await writeFile(path.join(hooksDir, "hooks.json"), HOOKS_JSON_BYTES, "utf8");
}

interface ExecutorCall {
  readonly pluginId: string;
  readonly claudeEvent: string;
  readonly scope: string;
}

/** An executor that records each routed entry and runs nothing. */
function recordingExecutor(): { calls: ExecutorCall[]; executor: HookExecutor } {
  const calls: ExecutorCall[] = [];
  const executor: HookExecutor = (entry: RoutingEntry) => {
    calls.push({ pluginId: entry.pluginId, claudeEvent: entry.claudeEvent, scope: entry.scope });
    return Promise.resolve({ kind: "noop" });
  };

  return { calls, executor };
}

function findSessionStartHandler(
  registrations: readonly CapturedRegistration[],
): CapturedRegistration["handler"] {
  const sessionStartRegs = registrations.filter((r) => r.event === "session_start");
  assert.strictEqual(
    sessionStartRegs.length,
    1,
    "registerHooksBridge must register exactly one session_start handler",
  );
  return sessionStartRegs[0]!.handler;
}

const SESSION_START_EVENT: SessionStartEvent = { type: "session_start", reason: "startup" };

test("HOOK-E2E-04: a throwing lazy project hydrate never blocks SessionStart dispatch", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: recordedMcpServerNames,
  });
  const { calls, executor } = recordingExecutor();

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // User scope owns the SessionStart-declaring plugin, so an entry must
    // still dispatch once the hydrate blows up.
    await seedHooksPlugin(
      path.join(agentDir, "pi-claude-marketplace"),
      "user",
      "learning-output-style",
    );
    const { pi, registrations } = makeMockPi();
    // A ctx carrying no `cwd`: the lazy hydrate calls
    // `locationsFor("project", ctx.cwd)`, whose `path.join(cwd, ".pi")`
    // rejects a non-string with ERR_INVALID_ARG_TYPE. That throw escapes
    // `hydrateProjectScopeForCwd` (its own try/catch wraps only the
    // `loadState` call), so it lands in the handler's catch and routes
    // through the OBS-01 debug seam. The catch keeps a Pi build that omits
    // `cwd` from degrading a broken hydrate into a dead SessionStart.
    const ctxWithoutCwd = {
      mode: "print",
      sessionManager: E2E_SESSION,
    } as unknown as ExtensionContext;

    // act
    await hooksHydration.registerHooksBridge(pi, { cwd: projectCwd, executor });
    // Awaited bare rather than through assert.doesNotReject: a regression
    // here should surface the real ERR_INVALID_ARG_TYPE stack, not a
    // generic "got rejection" message.
    await findSessionStartHandler(registrations)(SESSION_START_EVENT, ctxWithoutCwd);

    // assert
    assert.deepStrictEqual(
      calls,
      [{ pluginId: "learning-output-style", claudeEvent: "SessionStart", scope: "user" }],
      "executor must still be invoked for the user-scope SessionStart entry after the hydrate throws",
    );
  });
});
