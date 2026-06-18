// tests/integration/hooks-spawn-end-to-end.test.ts
//
// End-to-end regression test for the hooks-bridge SPAWN path: the contract
// that "Pi emits session_start" -> "bridge spawns the declared handler
// process with the right CLAUDE_PLUGIN_ROOT, the handler runs, exits 0,
// produces an observable side effect".
//
// Distinct from `hooks-dispatch-end-to-end.test.ts` (the dispatch-layer
// gate via the `_setExecutorForTest` seam) -- this one stays on the
// production executor (`dispatchHookExec`) and asserts via a real
// `spawn(bash, [...])` invocation whose handler writes a sentinel file.
//
// Pins the CLAUDE_PLUGIN_ROOT regression: a hook command using
// `${CLAUDE_PLUGIN_ROOT}/...` interpolation must resolve to the plugin's
// actual on-disk source, not a synthesized non-existent path.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  _resetForTest,
  registerHooksBridge,
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

async function withHermeticPiHome<T>(
  fn: (env: {
    agentDir: string;
    extensionRoot: string;
    sourcesPluginRoot: string;
    sentinelPath: string;
  }) => Promise<T>,
): Promise<T> {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "hooks-spawn-e2e-"));
  const agentDir = path.join(tmpRoot, "agent");
  const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
  const sourcesPluginRoot = path.join(
    extensionRoot,
    "sources",
    "test-mp",
    "plugins",
    "test-plugin",
  );
  const sentinelPath = path.join(tmpRoot, "sentinel.log");
  await mkdir(agentDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    return await fn({ agentDir, extensionRoot, sourcesPluginRoot, sentinelPath });
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
    schemaVersion: 1,
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
            installedAt: "2026-06-17T00:00:00Z",
            updatedAt: "2026-06-17T00:00:00Z",
          },
        },
      },
    },
  };
}

test("HOOK-E2E-02: a real SessionStart hook fires through bash and the handler writes its sentinel file", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
  });

  await withHermeticPiHome(async ({ extensionRoot, sourcesPluginRoot, sentinelPath }) => {
    // Lay out the source plugin tree the way the install pipeline would
    // (sources/<marketplace>/plugins/<pluginId>/hooks-handlers/<script>).
    const handlersDir = path.join(sourcesPluginRoot, "hooks-handlers");
    await mkdir(handlersDir, { recursive: true });
    const handlerScript = `#!/usr/bin/env bash
set -euo pipefail
printf 'fired at %s\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${sentinelPath}"
# Echo a valid hook output so the bridge's stdout parser is satisfied.
echo '{}'
`;
    const handlerPath = path.join(handlersDir, "session-start.sh");
    await writeFile(handlerPath, handlerScript, { mode: 0o755 });

    // Seed state.json + on-disk hooks.json (the bridge's read side).
    const installedHooksDir = path.join(extensionRoot, "hooks", "test-plugin");
    await mkdir(installedHooksDir, { recursive: true });
    await saveState(extensionRoot, buildStateWithHooksPlugin(sourcesPluginRoot));

    // hooks.json -- the bridge's parsed shape uses the bare-event-key form
    // (the wrapped form is unwrapped at stage time by the install path).
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

    // Boot the bridge. Project scope is empty -- the same shape that
    // triggered the cross-scope wipe regression. No executor seam:
    // we run on the production `dispatchHookExec`, which calls
    // `spawn(bash, [...])`.
    const { pi, registrations } = makeMockPi();
    // The bridge calls `ctx.sessionManager.getSessionId()` /
    // `getSessionFile()` to build the TranslationContext for the
    // handler's stdin envelope, and `ctx.cwd` to resolve project-scope
    // locations. Stub each to a deterministic test fixture.
    const placeholderCtx = {
      cwd: extensionRoot,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-spawn-e2e-session",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: extensionRoot });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg, "bridge must register session_start handler");

    const sessionStartEvent: SessionStartEvent = {
      type: "session_start",
      reason: "startup",
    };
    await sessionStartReg.handler(sessionStartEvent, placeholderCtx);

    // The sentinel proves: handler was spawned by the bridge, bash resolved
    // ${CLAUDE_PLUGIN_ROOT} to the actual source path, and the script ran
    // to completion. If CLAUDE_PLUGIN_ROOT points at a non-existent path
    // (the regression this gate pins), bash exits non-zero and the
    // sentinel is never written.
    const sentinel = await readFile(sentinelPath, "utf8").catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `sentinel file at ${sentinelPath} was not written -- the handler did not run end-to-end. ` +
          `This usually means CLAUDE_PLUGIN_ROOT was set to a non-existent path. ` +
          `Original error: ${detail}`,
      );
    });
    assert.match(
      sentinel,
      /^fired at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\n$/,
      "sentinel must carry a timestamped 'fired at' line written by the spawned bash handler",
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Path-source spawn coverage: `dispatch-exec.ts` and `async-rewake/registry.ts`
// dropped their `assertPathInside(extensionRoot, pluginRoot, ...)` containment
// guards because path-source marketplaces deliberately point at user-chosen
// external paths (a local development checkout, a sibling repo). This test
// confirms that with `resolvedSource` set to a directory OUTSIDE
// `<extensionRoot>/sources/...`, the bridge still spawns the hook handler
// and `${CLAUDE_PLUGIN_ROOT}` resolves to the external path.
// ──────────────────────────────────────────────────────────────────────────

test("HOOK-E2E-05: path-source plugin whose resolvedSource is OUTSIDE extensionRoot still spawns the handler", async (t) => {
  _resetForTest();
  t.after(() => {
    _resetForTest();
  });

  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "hooks-spawn-pathsrc-"));
  const agentDir = path.join(tmpRoot, "agent");
  const extensionRoot = path.join(agentDir, "pi-claude-marketplace");
  // External path-source plugin -- a sibling directory OUTSIDE extensionRoot.
  // This is the shape the assertPathInside guard removal allows: the user
  // ran `marketplace add /path/to/external/checkout` and pointed at code that
  // lives elsewhere on disk.
  const externalPluginRoot = path.join(tmpRoot, "external-src", "plugins", "ext-plugin");
  const sentinelPath = path.join(tmpRoot, "external-sentinel.log");

  await mkdir(agentDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    // Lay out the external plugin tree.
    const externalHandlersDir = path.join(externalPluginRoot, "hooks-handlers");
    await mkdir(externalHandlersDir, { recursive: true });
    const handlerScript = `#!/usr/bin/env bash
set -euo pipefail
printf 'external-fired at %s\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${sentinelPath}"
echo '{}'
`;
    await writeFile(path.join(externalHandlersDir, "session-start.sh"), handlerScript, {
      mode: 0o755,
    });

    // Seed state.json: resolvedSource points OUTSIDE extensionRoot.
    const externalState: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        "external-mp": {
          name: "external-mp",
          scope: "user",
          source: { kind: "path", raw: path.join(tmpRoot, "external-src") },
          addedFromCwd: tmpRoot,
          manifestPath: path.join(tmpRoot, "external-src", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(tmpRoot, "external-src"),
          plugins: {
            "ext-plugin": {
              version: "1.0.0",
              resolvedSource: externalPluginRoot,
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
                hooks: ["ext-plugin"],
              },
              installedAt: "2026-06-17T00:00:00Z",
              updatedAt: "2026-06-17T00:00:00Z",
            },
          },
        },
      },
    };

    const installedHooksDir = path.join(extensionRoot, "hooks", "ext-plugin");
    await mkdir(installedHooksDir, { recursive: true });
    await saveState(extensionRoot, externalState);
    await writeFile(
      path.join(installedHooksDir, "hooks.json"),
      JSON.stringify(
        {
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
        null,
        2,
      ),
      "utf8",
    );

    const { pi, registrations } = makeMockPi();
    const placeholderCtx = {
      cwd: extensionRoot,
      ui: { notify: () => {} },
      sessionManager: {
        getSessionId: () => "hooks-spawn-pathsrc-session",
        getSessionFile: () => undefined,
      },
    } as unknown as ExtensionContext;
    await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: extensionRoot });

    const sessionStartReg = registrations.find((r) => r.event === "session_start");
    assert.ok(sessionStartReg);
    const sessionStartEvent2: SessionStartEvent = {
      type: "session_start",
      reason: "startup",
    };
    await sessionStartReg.handler(sessionStartEvent2, placeholderCtx);

    // The sentinel proves dispatch-exec exported the external resolvedSource
    // as CLAUDE_PLUGIN_ROOT and bash resolved the interpolation. If the
    // dropped `assertPathInside` had been re-added (or if the resolver had
    // silently rejected the external path), bash would exit non-zero and
    // the sentinel would never appear.
    const sentinel = await readFile(sentinelPath, "utf8").catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `external-source sentinel at ${sentinelPath} was not written -- ` +
          `path-source plugin OUTSIDE extensionRoot failed to spawn. Detail: ${detail}`,
      );
    });
    assert.match(
      sentinel,
      /^external-fired at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\n$/,
      "sentinel must prove the external-path handler ran",
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
