import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  builtinRegistrationStep,
  resyncBuiltinRegistrations,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithSoftDeps } from "../../shared/notification-run-seeds.ts";

import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ActiveMcpImplementation,
  ExtensionContext,
  McpServerConfig,
  PiMcpRegistry,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { HermeticEnvironment } from "../../platform/hermetic-environment.ts";

type Step = typeof builtinRegistrationStep;

const STEPS: readonly { readonly name: string; readonly step: Step }[] = [
  { name: "builtinRegistrationStep", step: builtinRegistrationStep },
  { name: "resyncBuiltinRegistrations", step: resyncBuiltinRegistrations },
];

const STUB_SERVER = {
  command: "node",
  args: ["${CLAUDE_PLUGIN_ROOT}/server.js"],
  env: { TOKEN: "${PI_CM_STEP_TOKEN}" },
};

function runOf(mcpImplementation: ActiveMcpImplementation): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: mcpImplementation === "adapter",
    mcpImplementation,
    workflowEngineLoaded: false,
  });
}

function installRecord(resolvedSource: string): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    mcpServerConfigs: [{ name: "stub", config: STUB_SERVER }],
  };
}

/** A user-scope session with the local marketplace `mp` under `{root}/marketplaces/mp`. */
interface UserSession {
  readonly environment: HermeticEnvironment;
  readonly marketplaceRoot: string;
  readonly userRoot: string;
}

async function userSession(t: TestContext): Promise<UserSession> {
  const environment = await createHermeticEnvironment(t, "builtin-registration-step-");
  const hadToken = Object.hasOwn(process.env, "PI_CM_STEP_TOKEN");
  const previousToken = process.env.PI_CM_STEP_TOKEN;
  t.after(() => {
    if (hadToken) {
      process.env.PI_CM_STEP_TOKEN = previousToken;
    } else {
      delete process.env.PI_CM_STEP_TOKEN;
    }
  });
  process.env.PI_CM_STEP_TOKEN = "t$1";
  const marketplaceRoot = path.join(environment.root, "marketplaces", "mp");
  await mkdir(path.join(marketplaceRoot, "plugins", "demo"), { recursive: true });
  return {
    environment,
    marketplaceRoot,
    userRoot: path.join(environment.agentDir, "pi-claude-marketplace"),
  };
}

async function writeUserState(
  session: UserSession,
  plugins: Readonly<Record<string, PluginInstallRecord>>,
): Promise<void> {
  const { marketplaceRoot } = session;
  await mkdir(session.userRoot, { recursive: true });
  await writeFile(
    path.join(session.userRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 3,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: { kind: "path", raw: marketplaceRoot },
          addedFromCwd: session.environment.cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins,
        },
      },
    }),
  );
}

/** Writes the marketplace manifest of `mp`, listing `plugins`. */
async function writeManifest(
  session: UserSession,
  plugins: readonly Readonly<Record<string, unknown>>[],
): Promise<void> {
  const manifestDir = path.join(session.marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    path.join(manifestDir, "marketplace.json"),
    JSON.stringify({ name: "mp", plugins }),
  );
}

/** The config the stub server of `demo` registers with, rooted at `pluginRoot`. */
function stubConfig(session: UserSession, pluginRoot: string): McpServerConfig {
  return {
    command: "node",
    args: [`${pluginRoot}/server.js`],
    env: {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(session.userRoot, "data", "mp", "demo"),
      TOKEN: "t$$1",
    },
    exposure: "deferred",
  };
}

function sessionContext(session: UserSession): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  when(() => ctx.cwd).thenReturn(session.environment.cwd);
  return ctx;
}

function emptyRegistry(): PiMcpRegistry {
  const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  when(() => pi.getMcpServers()).thenReturn([]);
  return pi;
}

for (const { name, step } of STEPS) {
  describe(name, () => {
    for (const mcpImplementation of ["adapter", "none"] as const) {
      test(`MSEL-03: under ${mcpImplementation} it reads no context and registers nothing`, async () => {
        // arrange
        const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
        const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

        // act & assert
        await assert.doesNotReject(step({ pi, ctx, snapshot: runOf(mcpImplementation) }));
        verify(pi);
        verify(ctx);
      });
    }

    test("BLT-01: registers the recorded stdio server of an enabled user record", async (t) => {
      // arrange
      const session = await userSession(t);
      const pluginRoot = path.join(session.marketplaceRoot, "plugins", "demo");
      await writeUserState(session, { demo: installRecord(pluginRoot) });
      const ctx = sessionContext(session);
      const pi = emptyRegistry();
      when(() => {
        pi.registerMcpServer("plugin_demo_stub", stubConfig(session, pluginRoot));
      }).thenReturn(undefined);

      // act & assert
      await assert.doesNotReject(step({ pi, ctx, snapshot: runOf("builtin") }));
      verify(pi);
      verify(ctx);
    });
  });
}

describe("builtinRegistrationStep", () => {
  test("UF-1: a git record inside the scope's plugin clones registers", async (t) => {
    // arrange
    const session = await userSession(t);
    const pluginRoot = path.join(session.userRoot, "plugin-clones", "0123456789ab", "demo");
    await mkdir(pluginRoot, { recursive: true });
    await writeUserState(session, { demo: installRecord(pluginRoot) });
    const ctx = sessionContext(session);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(session, pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("UF-1: a record whose plugin root escapes both roots registers nothing and is logged", async (t) => {
    // arrange
    const session = await userSession(t);
    const logged = captureDebugLog(t);
    const pluginRoot = path.join(session.marketplaceRoot, "..", "elsewhere");
    await writeUserState(session, { demo: installRecord(pluginRoot) });
    const ctx = sessionContext(session);
    const pi = emptyRegistry();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, [
      "[mcp] MCP servers of demo@mp not registered: its plugin root is outside its sources",
    ]);
    verify(pi);
    verify(ctx);
  });

  test("MREC-02: a legacy record whose servers are unreadable registers nothing and is logged", async (t) => {
    // arrange
    const session = await userSession(t);
    const logged = captureDebugLog(t);
    const pluginRoot = path.join(session.marketplaceRoot, "plugins", "demo");
    const { mcpServerConfigs: _servers, ...legacyRecord } = installRecord(pluginRoot);
    await writeManifest(session, []);
    await writeUserState(session, { demo: legacyRecord });
    const ctx = sessionContext(session);
    const pi = emptyRegistry();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, [
      "[mcp] recorded MCP servers unreadable: cannot re-resolve the MCP servers of demo@mp: not-in-manifest",
      "[mcp] MCP servers of demo@mp not registered: its servers are unreadable",
    ]);
    verify(pi);
    verify(ctx);
  });

  test("D-MB-10: a disabled and a dependency-disabled record register nothing", async (t) => {
    // arrange
    const session = await userSession(t);
    const pluginRoot = path.join(session.marketplaceRoot, "plugins", "demo");
    await writeUserState(session, {
      off: { ...installRecord(pluginRoot), enabled: false },
      held: { ...installRecord(pluginRoot), dependencyDisabled: true },
    });
    const ctx = sessionContext(session);
    const pi = emptyRegistry();

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: an unreadable user state registers nothing and is logged", async (t) => {
    // arrange
    const session = await userSession(t);
    const logged = captureDebugLog(t);
    await mkdir(session.userRoot, { recursive: true });
    const statePath = path.join(session.userRoot, "state.json");
    await writeFile(statePath, JSON.stringify({ schemaVersion: 9, marketplaces: {} }));
    const ctx = sessionContext(session);
    const pi = emptyRegistry();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, [
      `[mcp] MCP servers of the user scope not registered: state.json at ${statePath} has an unsupported schema version`,
    ]);
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: a record whose data directory cannot be named registers nothing and is logged", async (t) => {
    // arrange
    const session = await userSession(t);
    const logged = captureDebugLog(t);
    const pluginRoot = path.join(session.marketplaceRoot, "plugins", "demo");
    await writeUserState(session, { "..": installRecord(pluginRoot) });
    const ctx = sessionContext(session);
    const pi = emptyRegistry();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, [
      '[mcp] MCP servers of ..@mp not registered: pluginDataDir plugin name ".." must not be "." or "..".',
    ]);
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: a registry that fails to list is logged and the step resolves", async (t) => {
    // arrange
    const session = await userSession(t);
    const logged = captureDebugLog(t);
    const ctx = sessionContext(session);
    const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
    when(() => pi.getMcpServers()).thenThrow(new Error("runtime is stale"));

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, ["[mcp] MCP built-in registration skipped: runtime is stale"]);
    verify(pi);
    verify(ctx);
  });
});
