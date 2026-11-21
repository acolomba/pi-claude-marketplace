// test/integration/hooks-dispatch-end-to-end.test.ts
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
// Regression gate for the cross-scope wipe and for any future change that
// would make the boot loop fail to populate the routing table for a
// user-scope plugin when the project scope is empty. The boot loop lives in
// rebuildRoutingTablesWith() / collectAllCachedPlugins() in
// bridges/hooks/event-router.ts.
//
// Test shape: real on-disk state.json + hooks.json, real cache + rebuild,
// composite-handler dispatch routed through the `executor` injected into
// `registerHooksBridge` (no child process spawned).

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
import { useAllowlistedProcessEnvironment } from "../platform/process-environment.ts";

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

function buildStateWithHooksPlugin(
  scope: "user" | "project",
  pluginId: string,
  userConfig?: unknown,
): ExtensionState {
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
            ...(userConfig === undefined ? {} : { userConfig }),
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
  userConfig?: unknown,
): Promise<void> {
  const hooksDir = path.join(extensionRoot, "hooks", pluginId);
  await mkdir(hooksDir, { recursive: true });
  await saveState(extensionRoot, buildStateWithHooksPlugin(scope, pluginId, userConfig));
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

test("HOOK-E2E-01: registerHooksBridge boots a user-scope hooks-only plugin and dispatches SessionStart end-to-end", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: recordedMcpServerNames,
  });
  const { calls, executor } = recordingExecutor();

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // Project scope stays empty (only agentDir is seeded): the shape that
    // triggered the cross-scope wipe regression.
    await seedHooksPlugin(
      path.join(agentDir, "pi-claude-marketplace"),
      "user",
      "learning-output-style",
    );
    const { pi, registrations } = makeMockPi();
    // ctx.cwd is read by the session_start handler's lazy project hydrate;
    // carry the real project cwd so the hydrate resolves the right scope root.
    const placeholderCtx = {
      cwd: projectCwd,
      mode: "print",
      isProjectTrusted: () => true,
      sessionManager: E2E_SESSION,
    } as unknown as ExtensionContext;

    // act
    await hooksHydration.registerHooksBridge(pi, { cwd: projectCwd, executor });
    const sessionStart = findSessionStartHandler(registrations);
    // The SessionStart bucket must keep the plugin's entry after the
    // sequential per-scope rebuild (the cross-scope wipe regression emptied
    // it after the project-scope rebuild).
    const bucketAfterBoot = (runtime.routingTableEntries().get("SessionStart") ?? []).map(
      (entry) => ({ pluginId: entry.pluginId, scope: entry.scope }),
    );
    await sessionStart(SESSION_START_EVENT, placeholderCtx);

    // assert
    assert.deepStrictEqual(
      bucketAfterBoot,
      [{ pluginId: "learning-output-style", scope: "user" }],
      "SessionStart routing bucket must contain the user-scope plugin's entry after boot (cross-scope wipe regression)",
    );
    assert.deepStrictEqual(
      calls,
      [{ pluginId: "learning-output-style", claudeEvent: "SessionStart", scope: "user" }],
      "executor must be invoked exactly once for the user-scope plugin's SessionStart entry",
    );
  });
});

/**
 * Boots the bridge over a user-scope plugin whose record holds `userConfig`,
 * fires SessionStart, and returns the options of each routed entry and the
 * executor calls.
 */
async function bootWithRecordedOptions(userConfig: unknown): Promise<{
  readonly options: { readonly declared: boolean; readonly values: [string, string][] }[];
  readonly calls: readonly ExecutorCall[];
}> {
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: recordedMcpServerNames,
  });
  const { calls, executor } = recordingExecutor();
  return withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    await seedHooksPlugin(
      path.join(agentDir, "pi-claude-marketplace"),
      "user",
      "optioned",
      userConfig,
    );
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {
      cwd: projectCwd,
      mode: "print",
      isProjectTrusted: () => true,
      sessionManager: E2E_SESSION,
    } as unknown as ExtensionContext;

    await hooksHydration.registerHooksBridge(pi, { cwd: projectCwd, executor });
    const options = (runtime.routingTableEntries().get("SessionStart") ?? []).map((entry) => ({
      declared: entry.options.declared,
      values: [...entry.options.values],
    }));
    await findSessionStartHandler(registrations)(SESSION_START_EVENT, placeholderCtx);
    return { options, calls };
  });
}

test("D-PG10-23 a booted hook entry holds the options its record holds", async () => {
  // act
  const booted = await bootWithRecordedOptions({
    mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
  });

  // assert
  assert.deepStrictEqual(booted, {
    options: [{ declared: true, values: [["mode", "fast"]] }],
    calls: [{ pluginId: "optioned", claudeEvent: "SessionStart", scope: "user" }],
  });
});

test("D-PG10-25 a record whose userConfig is a string boots with declared options and no values, and dispatches", async () => {
  // act
  const booted = await bootWithRecordedOptions("mode=fast");

  // assert
  assert.deepStrictEqual(booted, {
    options: [{ declared: true, values: [] }],
    calls: [{ pluginId: "optioned", claudeEvent: "SessionStart", scope: "user" }],
  });
});

test("HOOK-E2E-02: project-scope SessionStart plugin dispatches via the session_start lazy project hydrate", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: recordedMcpServerNames,
  });
  const { calls, executor } = recordingExecutor();

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // Project-scope state lives under the real project cwd. The factory-time
    // hydrate does not see it, because registerHooksBridge is called with
    // agentDir, a stand-in for the factory's homedir() cwd: project-scope
    // SessionStart hooks are on disk but absent from the routing table at
    // boot.
    await seedHooksPlugin(
      path.join(projectCwd, ".pi", "pi-claude-marketplace"),
      "project",
      "project-session-start",
    );
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {
      cwd: projectCwd,
      mode: "print",
      isProjectTrusted: () => true,
      sessionManager: E2E_SESSION,
    } as unknown as ExtensionContext;

    // act
    await hooksHydration.registerHooksBridge(pi, { cwd: agentDir, executor });
    const bucketAfterBoot = runtime.routingTableEntries().get("SessionStart") ?? [];
    // With ctx.cwd = the real project, the handler's lazy project hydrate
    // rebuilds the routing tables, so the composite handler dispatches the
    // project plugin.
    await findSessionStartHandler(registrations)(SESSION_START_EVENT, placeholderCtx);

    // assert
    assert.deepStrictEqual(
      bucketAfterBoot,
      [],
      "SessionStart bucket must be empty at boot when the factory cwd is not the real project",
    );
    assert.deepStrictEqual(
      calls,
      [{ pluginId: "project-session-start", claudeEvent: "SessionStart", scope: "project" }],
      "executor must be invoked for the project-scope SessionStart plugin after the lazy hydrate",
    );
  });
});

test("HOOK-E2E-03: WR-05 -- session_start lazy hydrate writes nothing under a pristine project cwd", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: recordedMcpServerNames,
  });
  const { executor } = recordingExecutor();

  await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
    // User scope owns the only SessionStart-declaring plugin; the project
    // scope is pristine (no state.json, no hooks.json, no `.pi` at all).
    await seedHooksPlugin(
      path.join(agentDir, "pi-claude-marketplace"),
      "user",
      "learning-output-style",
    );
    // Boot against a third cwd so the factory's own `_shared` mkdir cannot
    // land in projectCwd and mask what the session_start path does.
    const bootCwd = path.join(agentDir, "boot-cwd");
    await mkdir(bootCwd, { recursive: true });
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {
      cwd: projectCwd,
      mode: "print",
      isProjectTrusted: () => true,
      sessionManager: E2E_SESSION,
    } as unknown as ExtensionContext;

    // act
    await hooksHydration.registerHooksBridge(pi, { cwd: bootCwd, executor });
    await findSessionStartHandler(registrations)(SESSION_START_EVENT, placeholderCtx);
    const projectCwdEntries = await readdir(projectCwd);

    // assert
    // The lazy hydrate gates its `_shared` mkdir on a project-scope
    // SessionStart entry existing. With only a user-scope plugin installed,
    // an unsolicited mkdir would create `<cwd>/.pi/...` in the user's project
    // on every session start (WR-05).
    assert.deepStrictEqual(
      projectCwdEntries,
      [],
      "pristine project cwd must stay empty across session_start (WR-05)",
    );
  });
});

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

test(
  "a registered child records complete successful and failed tool result payloads",
  { concurrency: false },
  async (t) => {
    // PATH, because the hook runs node by name. PI_SUBAGENT_CHILD marks the
    // process as a pi-subagents child for the whole case.
    useAllowlistedProcessEnvironment(t, ["PATH", "HOME", "PI_CODING_AGENT_DIR"], {
      PI_SUBAGENT_CHILD: "1",
    });
    await withHermeticPiHome(async ({ agentDir, projectCwd }) => {
      const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
      const pluginId = "result-recording";
      const sourceRoot = path.join(extensionRoot, "sources", "test-mp", "plugins", pluginId);
      const recordPath = path.join(sourceRoot, "received.jsonl");
      await mkdir(sourceRoot, { recursive: true });
      await writeFile(
        path.join(sourceRoot, "record.mjs"),
        'import fs from "node:fs";\nconst input = fs.readFileSync(0, "utf8");\nfs.appendFileSync(new URL("./received.jsonl", import.meta.url), JSON.stringify(JSON.parse(input)) + "\\n");\n',
      );
      const state = buildStateWithHooksPlugin("user", pluginId);
      state.marketplaces["claude-plugins-official"]!.plugins[pluginId]!.resolvedSource = sourceRoot;
      await saveState(extensionRoot, state);
      const hooksDir = path.join(extensionRoot, "hooks", pluginId);
      await mkdir(hooksDir, { recursive: true });
      const recorder = {
        hooks: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/record.mjs"' }],
      };
      await writeFile(
        path.join(hooksDir, "hooks.json"),
        JSON.stringify({ PostToolUse: [recorder], PostToolUseFailure: [recorder] }),
      );
      const runtime = createHooksRuntime();
      const hydration = createHooksHydration(runtime, {
        loadState,
        readHooksJson,
        readMcpServerNames: recordedMcpServerNames,
      });
      const { pi, registrations } = makeMockPi();
      const ctx = {
        cwd: projectCwd,
        mode: "print",
        ui: { notify: () => {} },
        sessionManager: {
          getSessionId: () => "child-session",
          getSessionFile: () => "/sessions/child-session.jsonl",
          getSessionName: () => undefined,
        },
      } as unknown as ExtensionContext;
      await hydration.registerHooksBridge(pi, { cwd: projectCwd });
      const before = registrations.find((entry) => entry.event === "before_agent_start");
      const result = registrations.find((entry) => entry.event === "tool_result");
      assert.ok(before);
      assert.ok(result);
      await before.handler(
        {
          type: "before_agent_start",
          systemPromptOptions: { customPrompt: '<active_agent name="reviewer"/>\n\n' },
        },
        ctx,
      );
      for (const isError of [false, true]) {
        await result.handler(
          {
            type: "tool_result",
            toolCallId: isError ? "failed-call" : "successful-call",
            toolName: "catalog",
            input: { query: "entry" },
            content: [{ type: "text", text: isError ? "lookup failed" : "found" }],
            isError,
            details: undefined,
          },
          ctx,
        );
      }

      const payloads = (await readFile(recordPath, "utf8"))
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown);
      assert.deepStrictEqual(payloads, [
        {
          session_id: "child-session",
          transcript_path: "/sessions/child-session.jsonl",
          cwd: projectCwd,
          hook_event_name: "PostToolUse",
          tool_name: "catalog",
          tool_input: { query: "entry" },
          tool_use_id: "successful-call",
          tool_response: [{ type: "text", text: "found" }],
          agent_type: "reviewer",
          agent_id: "child-session",
        },
        {
          session_id: "child-session",
          transcript_path: "/sessions/child-session.jsonl",
          cwd: projectCwd,
          hook_event_name: "PostToolUseFailure",
          tool_name: "catalog",
          tool_input: { query: "entry" },
          tool_use_id: "failed-call",
          error: "lookup failed",
          is_interrupt: false,
          agent_type: "reviewer",
          agent_id: "child-session",
        },
      ]);
    });
  },
);
