// tests/integration/hooks-additionalcontext-end-to-end.test.ts
//
// End-to-end regression test for the SessionStart additionalContext
// drain pipeline: the contract that "a SessionStart hook emitting
// `{hookSpecificOutput: {additionalContext: <text>}}` on stdout reaches
// Pi's next agent turn through the `before_agent_start` handler's
// `systemPrompt` slot".
//
// Distinct from `tests/bridges/hooks/session-start-additional-context.test.ts`
// (the unit-level test that calls `adaptObservationResultForEvent` and
// `beforeAgentStartHandlerFor` directly) -- this one runs the production
// executor (`dispatchHookExec`) through a real `spawn(bash, [...])`
// invocation whose handler writes the additionalContext envelope, the
// bridge's stdout parser fold lands in the pending buffer, and the
// before_agent_start handler then drains it onto a synthesized
// `event.systemPrompt`.
//
// Pins the cross-event plumbing the v1.13 phase-63 bridge was missing:
// without the fix, the bridge silently dropped the additionalContext at
// `adaptObservationResult`'s mutate arm and Pi's first agent turn never
// saw the injected text.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  _peekPendingSessionStartContextForTest,
  _resetForTest,
  beforeAgentStartHandlerFor,
  currentEpoch,
  registerHooksBridge,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "hooks-addctx-e2e-"));
  const agentDir = path.join(tmpRoot, "agent");
  const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
  const sourcesPluginRoot = path.join(
    extensionRoot,
    "sources",
    "test-mp",
    "plugins",
    "test-plugin",
  );
  await mkdir(agentDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    return await fn({ agentDir, extensionRoot, sourcesPluginRoot });
  } finally {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(tmpRoot, { recursive: true, force: true });
  }
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

function makeBeforeAgentStartEvent(systemPrompt: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    prompt: "user prompt",
    systemPrompt,
    systemPromptOptions: {},
  } as unknown as BeforeAgentStartEvent;
}

test("HOOK-E2E-03: SessionStart hook stdout additionalContext reaches before_agent_start.systemPrompt end-to-end", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
  });

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
      cwd: extensionRoot,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-addctx-e2e-session",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: extensionRoot });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");
    const beforeAgentStartReg = registrations.find((r) => r.event === "before_agent_start");
    assert.ok(beforeAgentStartReg, "bridge must register before_agent_start handler (drain point)");

    // Pre-flight: pending buffer empty after a fresh registerHooksBridge.
    assert.deepEqual(
      _peekPendingSessionStartContextForTest(),
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

    assert.deepEqual(
      _peekPendingSessionStartContextForTest().map((e) => e.context),
      ["LEARN-MODE-MARK"],
      "wire-protocol.ts must parse the additionalContext envelope and adaptObservationResultForEvent must append into the buffer",
    );

    // Fire before_agent_start with a synthesized base systemPrompt. The
    // bridge's drain handler joins base + buffered text with "\n\n" and
    // clears the buffer.
    const beforeAgentResult = await beforeAgentStartReg.handler(
      makeBeforeAgentStartEvent("BASE-SYSTEM-PROMPT"),
      placeholderCtx,
    );

    assert.deepEqual(
      beforeAgentResult,
      { systemPrompt: "BASE-SYSTEM-PROMPT\n\nLEARN-MODE-MARK" },
      "before_agent_start handler must surface the joined systemPrompt to Pi's chain",
    );
    assert.deepEqual(
      _peekPendingSessionStartContextForTest(),
      [],
      "drain semantics: pending buffer cleared after the first before_agent_start",
    );

    // Second before_agent_start (subsequent agent turn) returns undefined
    // -- the additionalContext is a one-shot turn primer, not a permanent
    // system-prompt addition.
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

test("HOOK-E2E-04: registerHooksBridge clears the pending buffer on /reload (re-entry)", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
  });

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
    await registerHooksBridge(firstLoad.pi, { ctx: placeholderCtx, cwd: extensionRoot });
    const firstSessionStartReg = firstLoad.registrations.find((r) => r.event === "session_start");
    assert.ok(firstSessionStartReg);
    const firstReloadEvent: SessionStartEvent = { type: "session_start", reason: "startup" };
    await firstSessionStartReg.handler(firstReloadEvent, placeholderCtx);
    assert.deepEqual(
      _peekPendingSessionStartContextForTest().map((e) => e.context),
      ["FIRST-LOAD-MARK"],
    );

    // Second load (mirrors /reload re-emitting session_start with
    // reason="reload"): the buffer must be cleared by
    // registerHooksBridge entry so the prior session's stale entry does
    // not contaminate the new session's drain.
    const secondLoad = makeMockPi();
    await registerHooksBridge(secondLoad.pi, { ctx: placeholderCtx, cwd: extensionRoot });
    assert.deepEqual(
      _peekPendingSessionStartContextForTest(),
      [],
      "registerHooksBridge re-entry must clear the pending buffer (no stale-context leak across /reload)",
    );

    // Sanity check: the new session's drain handler returns undefined
    // (empty buffer).
    const drainHandler = beforeAgentStartHandlerFor(currentEpoch());
    const result = await drainHandler(makeBeforeAgentStartEvent("BASE"), placeholderCtx);
    assert.equal(result, undefined, "empty buffer after /reload must drain to undefined");
  });
});
