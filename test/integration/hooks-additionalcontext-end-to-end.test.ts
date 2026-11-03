// test/integration/hooks-additionalcontext-end-to-end.test.ts
//
// End-to-end regression test for the SessionStart additionalContext
// drain pipeline: the contract that "a SessionStart hook emitting
// `{hookSpecificOutput: {additionalContext: <text>}}` on stdout reaches
// Pi's next agent turn as a persisted message that the `before_agent_start`
// handler returns" (D-CF5-13).
//
// Distinct from the unit-level coverage that calls those two functions
// directly -- `adaptObservationResultForEvent` in
// `test/bridges/hooks/event-adapters.test.ts` and the `before_agent_start`
// handler in `test/bridges/hooks/event-router.test.ts` -- this one runs the production
// executor (`dispatchHookExec`) through a real `spawn(bash, [...])`
// invocation whose handler writes the additionalContext envelope, the
// bridge's stdout parser fold lands in the pending buffer, and the
// before_agent_start handler then drains it into a context message.
//
// Pins the cross-event plumbing of the hooks bridge: the additionalContext
// survives `adaptObservationResult`'s mutate arm, so Pi's first agent turn
// sees the injected text.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createHooksHydration,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  BeforeAgentStartEvent,
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

async function withHermeticPiHome<T>(
  fn: (env: { agentDir: string; extensionRoot: string; sourcesPluginRoot: string }) => Promise<T>,
): Promise<T> {
  return withHermeticEnvironment("hooks-addctx-e2e-", async ({ agentDir }) => {
    const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
    const sourcesPluginRoot = path.join(
      extensionRoot,
      "sources",
      "test-mp",
      "plugins",
      "test-plugin",
    );
    return await fn({ agentDir, extensionRoot, sourcesPluginRoot });
  });
}

function buildStateWithHooksPlugin(sourcesPluginRoot: string): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      "test-mp": {
        name: "test-mp",
        scope: "user",
        source: { kind: "path", raw: "/tmp/test-source" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/test-source/.claude-plugin/marketplace.json",
        marketplaceRoot: "/tmp/test-source",
        plugins: {
          "test-plugin": {
            version: "1.0.0",
            resolvedSource: sourcesPluginRoot,
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
              hooks: ["test-plugin"],
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

function makeBeforeAgentStartEvent(systemPrompt: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    prompt: "user prompt",
    systemPrompt,
    systemPromptOptions: {},
  } as unknown as BeforeAgentStartEvent;
}

/**
 * Lays out a source plugin whose SessionStart handler prints an
 * additionalContext envelope carrying `marker`, seeds state.json and the
 * installed hooks.json, and returns the context the handlers run with.
 */
async function installSessionStartHook(
  { extensionRoot, sourcesPluginRoot }: { extensionRoot: string; sourcesPluginRoot: string },
  marker: string,
  sessionId: string,
): Promise<ExtensionContext> {
  // sources/<marketplace>/plugins/<pluginId>/hooks-handlers/<script>
  const handlersDir = path.join(sourcesPluginRoot, "hooks-handlers");
  await mkdir(handlersDir, { recursive: true });
  const handlerScript = `#!/usr/bin/env bash
set -euo pipefail
cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${marker}"
  }
}
JSON
`;
  await writeFile(path.join(handlersDir, "session-start.sh"), handlerScript, { mode: 0o755 });

  const installedHooksDir = path.join(extensionRoot, "hooks", "test-plugin");
  await mkdir(installedHooksDir, { recursive: true });
  await saveState(extensionRoot, buildStateWithHooksPlugin(sourcesPluginRoot));
  // Bare-event-key form the parser ingests directly.
  const hooksJson = {
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
  };
  await writeFile(
    path.join(installedHooksDir, "hooks.json"),
    JSON.stringify(hooksJson, null, 2),
    "utf8",
  );

  return {
    mode: "tui",
    cwd: extensionRoot,
    ui: { notify: () => {} },
    sessionManager: {
      getSessionId: () => sessionId,
      getSessionFile: () => undefined,
    },
  } as unknown as ExtensionContext;
}

function findHandler(
  registrations: readonly CapturedRegistration[],
  event: string,
): CapturedRegistration["handler"] {
  const registration = registrations.find((candidate) => candidate.event === event);
  assert.ok(registration, `bridge must register a ${event} handler`);
  return registration.handler;
}

test("HOOK-E2E-03: SessionStart hook stdout additionalContext reaches the before_agent_start message end-to-end", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, { loadState, readHooksJson });
  const sessionStartEvent: SessionStartEvent = { type: "session_start", reason: "startup" };

  await withHermeticPiHome(async (env) => {
    const placeholderCtx = await installSessionStartHook(
      env,
      "LEARN-MODE-MARK",
      "hooks-addctx-e2e-session",
    );
    const { pi, registrations } = makeMockPi();
    await hooksHydration.registerHooksBridge(pi, { cwd: env.extensionRoot });
    const sessionStart = findHandler(registrations, "session_start");
    const beforeAgentStart = findHandler(registrations, "before_agent_start");

    // act
    const pendingAfterRegistration = runtime.pendingSessionStartContextEntries();
    await sessionStart(sessionStartEvent, placeholderCtx);
    const pendingAfterSessionStart = runtime
      .pendingSessionStartContextEntries()
      .map((entry) => entry.context);
    const firstTurnResult = await beforeAgentStart(
      makeBeforeAgentStartEvent("BASE-SYSTEM-PROMPT"),
      placeholderCtx,
    );
    const pendingAfterFirstTurn = runtime.pendingSessionStartContextEntries();
    const secondTurnResult = await beforeAgentStart(
      makeBeforeAgentStartEvent("BASE-SYSTEM-PROMPT-NEXT"),
      placeholderCtx,
    );

    // assert
    assert.deepStrictEqual(
      pendingAfterRegistration,
      [],
      "registerHooksBridge must clear the pending buffer so /reload cannot leak stale context",
    );
    assert.deepStrictEqual(
      pendingAfterSessionStart,
      ["LEARN-MODE-MARK"],
      "wire-protocol.ts must parse the additionalContext envelope and adaptObservationResultForEvent must append into the buffer",
    );
    assert.deepStrictEqual(
      firstTurnResult,
      {
        message: {
          customType: "claude-hook-additional-context",
          content: [
            { type: "text", text: "SessionStart hook additional context: LEARN-MODE-MARK" },
          ],
          display: false,
        },
      },
      "before_agent_start handler must return the context message to Pi's chain",
    );
    assert.deepStrictEqual(
      pendingAfterFirstTurn,
      [],
      "drain semantics: pending buffer cleared after the first before_agent_start",
    );
    // The message sent on the first turn stays in the session history, so no
    // later turn sends it again.
    assert.strictEqual(
      secondTurnResult,
      undefined,
      "second before_agent_start must return undefined (buffer was drained)",
    );
  });
});

test("HOOK-E2E-04: registerHooksBridge clears the pending buffer on /reload (re-entry)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, { loadState, readHooksJson });
  const sessionStartEvent: SessionStartEvent = { type: "session_start", reason: "startup" };

  await withHermeticPiHome(async (env) => {
    const placeholderCtx = await installSessionStartHook(
      env,
      "FIRST-LOAD-MARK",
      "hooks-addctx-reload-e2e-session",
    );
    // First load: fire session_start to populate the buffer, but do not drain
    // it. This is the case where the user reloads before submitting a prompt.
    const firstLoad = makeMockPi();
    await hooksHydration.registerHooksBridge(firstLoad.pi, { cwd: env.extensionRoot });
    await findHandler(firstLoad.registrations, "session_start")(sessionStartEvent, placeholderCtx);
    const pendingAfterFirstLoad = runtime
      .pendingSessionStartContextEntries()
      .map((entry) => entry.context);

    // act
    const secondLoad = makeMockPi();
    await hooksHydration.registerHooksBridge(secondLoad.pi, { cwd: env.extensionRoot });
    const pendingAfterSecondLoad = runtime.pendingSessionStartContextEntries();
    const drainResult = await findHandler(secondLoad.registrations, "before_agent_start")(
      makeBeforeAgentStartEvent("BASE"),
      placeholderCtx,
    );

    // assert
    assert.deepStrictEqual(pendingAfterFirstLoad, ["FIRST-LOAD-MARK"]);
    assert.deepStrictEqual(
      pendingAfterSecondLoad,
      [],
      "registerHooksBridge re-entry must clear the pending buffer (no stale-context leak across /reload)",
    );
    assert.strictEqual(
      drainResult,
      undefined,
      "empty buffer after /reload must drain to undefined",
    );
  });
});
