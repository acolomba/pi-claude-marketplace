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
// Pins the cross-event plumbing the hooks bridge was missing:
// without the fix, the bridge silently dropped the additionalContext at
// `adaptObservationResult`'s mutate arm and Pi's first agent turn never
// saw the injected text.

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

test("HOOK-E2E-03: SessionStart hook stdout additionalContext reaches the before_agent_start message end-to-end", async () => {
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, { loadState, readHooksJson });

  await withHermeticPiHome(async ({ extensionRoot, sourcesPluginRoot }) => {
    // Lay out the source plugin tree the way the install pipeline would
    // (sources/<marketplace>/plugins/<pluginId>/hooks-handlers/<script>).
    const handlersDir = path.join(sourcesPluginRoot, "hooks-handlers");
    await mkdir(handlersDir, { recursive: true });
    // Handler emits the Claude-style additionalContext envelope on
    // stdout. The bridge's wire-protocol parser maps the
    // hookSpecificOutput.additionalContext arm onto a HookExecResult of
    // kind "mutate" with the additionalContext field populated.
    const handlerScript = `#!/usr/bin/env bash
set -euo pipefail
cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "LEARN-MODE-MARK"
  }
}
JSON
`;
    const handlerPath = path.join(handlersDir, "session-start.sh");
    await writeFile(handlerPath, handlerScript, { mode: 0o755 });

    // Seed state.json + on-disk hooks.json (the bridge's read side).
    const installedHooksDir = path.join(extensionRoot, "hooks", "test-plugin");
    await mkdir(installedHooksDir, { recursive: true });
    await saveState(extensionRoot, buildStateWithHooksPlugin(sourcesPluginRoot));

    // hooks.json -- bare-event-key form the parser ingests directly.
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

    // Boot the bridge against the production dispatch path. No executor
    // seam: registerHooksBridge wires up the real composite handlers and
    // the new before_agent_start drain handler.
    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {
      mode: "tui",
      cwd: extensionRoot,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-addctx-e2e-session",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;
    await hooksHydration.registerHooksBridge(pi, { cwd: extensionRoot });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");
    const beforeAgentStartReg = registrations.find((r) => r.event === "before_agent_start");
    assert.ok(beforeAgentStartReg, "bridge must register before_agent_start handler (drain point)");

    // Pre-flight: pending buffer empty after a fresh registerHooksBridge.
    assert.deepStrictEqual(
      runtime.pendingSessionStartContextEntries(),
      [],
      "registerHooksBridge must clear the pending buffer so /reload cannot leak stale context",
    );

    // Fire session_start. The bridge spawns the handler via bash, the
    // handler's stdout JSON is parsed by wire-protocol.ts into a
    // HookExecResult mutate arm carrying additionalContext, and
    // adaptObservationResultForEvent appends "LEARN-MODE-MARK" into the
    // pending buffer.
    const sessionStartEvent: SessionStartEvent = {
      type: "session_start",
      reason: "startup",
    };
    await sessionStartReg.handler(sessionStartEvent, placeholderCtx);

    assert.deepStrictEqual(
      runtime.pendingSessionStartContextEntries().map((entry) => entry.context),
      ["LEARN-MODE-MARK"],
      "wire-protocol.ts must parse the additionalContext envelope and adaptObservationResultForEvent must append into the buffer",
    );

    // Fire before_agent_start. The bridge's drain handler returns the
    // buffered text as one context message, leaves the system prompt
    // alone, and clears the buffer (D-CF5-13).
    const beforeAgentResult = await beforeAgentStartReg.handler(
      makeBeforeAgentStartEvent("BASE-SYSTEM-PROMPT"),
      placeholderCtx,
    );

    assert.deepStrictEqual(
      beforeAgentResult,
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
      runtime.pendingSessionStartContextEntries(),
      [],
      "drain semantics: pending buffer cleared after the first before_agent_start",
    );

    // Second before_agent_start (subsequent agent turn) returns undefined:
    // the message sent on the first turn stays in the session history, so
    // no later turn sends it again.
    const secondTurnResult = await beforeAgentStartReg.handler(
      makeBeforeAgentStartEvent("BASE-SYSTEM-PROMPT-NEXT"),
      placeholderCtx,
    );
    assert.equal(
      secondTurnResult,
      undefined,
      "second before_agent_start must return undefined (buffer was drained)",
    );
  });
});

test("HOOK-E2E-04: registerHooksBridge clears the pending buffer on /reload (re-entry)", async () => {
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, { loadState, readHooksJson });

  await withHermeticPiHome(async ({ extensionRoot, sourcesPluginRoot }) => {
    const handlersDir = path.join(sourcesPluginRoot, "hooks-handlers");
    await mkdir(handlersDir, { recursive: true });
    const handlerScript = `#!/usr/bin/env bash
set -euo pipefail
cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "FIRST-LOAD-MARK"
  }
}
JSON
`;
    await writeFile(path.join(handlersDir, "session-start.sh"), handlerScript, { mode: 0o755 });

    const installedHooksDir = path.join(extensionRoot, "hooks", "test-plugin");
    await mkdir(installedHooksDir, { recursive: true });
    await saveState(extensionRoot, buildStateWithHooksPlugin(sourcesPluginRoot));
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

    const placeholderCtx = {
      mode: "tui",
      cwd: extensionRoot,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-addctx-reload-e2e-session",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;

    // First load: fire session_start to populate the buffer, but do NOT
    // drain it. This simulates the pathological case where the user
    // /reload's before submitting a prompt, leaving a stale buffer.
    const firstLoad = makeMockPi();
    await hooksHydration.registerHooksBridge(firstLoad.pi, {
      cwd: extensionRoot,
    });
    const firstSessionStartReg = firstLoad.registrations.find((r) => r.event === "session_start");
    assert.ok(firstSessionStartReg);
    const firstReloadEvent: SessionStartEvent = { type: "session_start", reason: "startup" };
    await firstSessionStartReg.handler(firstReloadEvent, placeholderCtx);
    assert.deepStrictEqual(
      runtime.pendingSessionStartContextEntries().map((entry) => entry.context),
      ["FIRST-LOAD-MARK"],
    );

    // Second load (mirrors /reload re-emitting session_start with
    // reason="reload"): the buffer must be cleared by
    // registerHooksBridge entry so the prior session's stale entry does
    // not contaminate the new session's drain.
    const secondLoad = makeMockPi();
    await hooksHydration.registerHooksBridge(secondLoad.pi, {
      cwd: extensionRoot,
    });
    assert.deepStrictEqual(
      runtime.pendingSessionStartContextEntries(),
      [],
      "registerHooksBridge re-entry must clear the pending buffer (no stale-context leak across /reload)",
    );

    // Sanity check: the new session's drain handler returns undefined
    // (empty buffer).
    const drainRegistration = secondLoad.registrations.find(
      (registration) => registration.event === "before_agent_start",
    );
    assert.ok(drainRegistration);
    const result = await drainRegistration.handler(
      makeBeforeAgentStartEvent("BASE"),
      placeholderCtx,
    );
    assert.equal(result, undefined, "empty buffer after /reload must drain to undefined");
  });
});
