import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
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
type ScopeName = "user" | "project";

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

function installRecord(
  resolvedSource: string,
  servers: PluginInstallRecord["mcpServerConfigs"] = [{ name: "stub", config: STUB_SERVER }],
): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    mcpServerConfigs: servers,
  };
}

function legacyRecord(resolvedSource: string): PluginInstallRecord {
  const { mcpServerConfigs: _servers, ...record } = installRecord(resolvedSource);
  return record;
}

/** A session with the local marketplace `mp` under `{root}/marketplaces/mp`, holding `demo`. */
interface Session {
  readonly environment: HermeticEnvironment;
  readonly marketplaceRoot: string;
  readonly pluginRoot: string;
  readonly roots: Readonly<Record<ScopeName, string>>;
}

async function session(t: TestContext): Promise<Session> {
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
  const pluginRoot = path.join(marketplaceRoot, "plugins", "demo");
  await mkdir(pluginRoot, { recursive: true });
  return {
    environment,
    marketplaceRoot,
    pluginRoot,
    roots: {
      user: path.join(environment.agentDir, "pi-claude-marketplace"),
      project: path.join(environment.cwd, ".pi", "pi-claude-marketplace"),
    },
  };
}

async function writeJson(filePath: string, document: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document));
}

/** The marketplace record of `mp`: the local marketplace unless a test names another. */
interface MarketplaceShape {
  readonly source: unknown;
  readonly marketplaceRoot: string;
}

async function writeState(
  fixture: Session,
  scope: ScopeName,
  plugins: Readonly<Record<string, PluginInstallRecord>>,
  shape: MarketplaceShape = {
    source: { kind: "path", raw: fixture.marketplaceRoot },
    marketplaceRoot: fixture.marketplaceRoot,
  },
): Promise<void> {
  const { marketplaceRoot } = shape;
  await writeJson(path.join(fixture.roots[scope], "state.json"), {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
        source: shape.source,
        addedFromCwd: fixture.environment.cwd,
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        plugins,
      },
    },
  });
}

/** A record installed from a git source at a commit: `resolvedSha` is set. */
function gitRecord(resolvedSource: string): PluginInstallRecord {
  return { ...installRecord(resolvedSource), resolvedSha: "0123456789ab".padEnd(40, "0") };
}

const GITHUB_MARKETPLACE = { kind: "github", raw: "owner/mp" } as const;

/** Writes the marketplace manifest of `mp`, listing `plugins`. */
async function writeManifest(
  fixture: Session,
  plugins: readonly Readonly<Record<string, unknown>>[],
): Promise<void> {
  await writeJson(path.join(fixture.marketplaceRoot, ".claude-plugin", "marketplace.json"), {
    name: "mp",
    plugins,
  });
}

function dataDir(fixture: Session, scope: ScopeName): string {
  return path.join(fixture.roots[scope], "data", "mp", "demo");
}

/** The config the stub server of `demo` registers with in `scope`, rooted at `pluginRoot`. */
function stubConfig(fixture: Session, scope: ScopeName, pluginRoot: string): McpServerConfig {
  return {
    command: "node",
    args: [`${pluginRoot}/server.js`],
    env: {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: dataDir(fixture, scope),
      TOKEN: "t$$1",
    },
    exposure: "deferred",
  };
}

function sessionContext(fixture: Session, trusted: boolean): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  when(() => ctx.cwd).thenReturn(fixture.environment.cwd);
  when(() => ctx.isProjectTrusted()).thenReturn(trusted);
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
      const fixture = await session(t);
      await writeState(fixture, "user", { demo: installRecord(fixture.pluginRoot) });
      const ctx = sessionContext(fixture, false);
      const pi = emptyRegistry();
      when(() => {
        pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", fixture.pluginRoot));
      }).thenReturn(undefined);

      // act & assert
      await assert.doesNotReject(step({ pi, ctx, snapshot: runOf("builtin") }));
      verify(pi);
      verify(ctx);
    });
  });
}

describe("builtinRegistrationStep", () => {
  test("D-MB-09: a trusted project's enabled record registers", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeState(fixture, "project", { demo: installRecord(fixture.pluginRoot) });
    const ctx = sessionContext(fixture, true);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "project", fixture.pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("D-MB-09: trust is asked on every call, so a project trusted later registers then", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeState(fixture, "project", { demo: installRecord(fixture.pluginRoot) });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    when(() => ctx.cwd)
      .thenReturn(fixture.environment.cwd)
      .twice();
    when(() => ctx.isProjectTrusted()).thenReturn(false);
    when(() => ctx.isProjectTrusted()).thenReturn(true);
    const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
    when(() => pi.getMcpServers())
      .thenReturn([])
      .twice();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "project", fixture.pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    await assert.doesNotReject(resyncBuiltinRegistrations({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("P2-DC-14: a trusted project server replaces the same-named user server in place", async (t) => {
    // arrange
    const fixture = await session(t);
    const extra = { name: "extra", config: { command: "extra" } };
    const projectStub = { name: "stub", config: { command: "project-stub" } };
    await writeState(fixture, "user", {
      demo: installRecord(fixture.pluginRoot, [{ name: "stub", config: STUB_SERVER }, extra]),
    });
    await writeState(fixture, "project", {
      demo: installRecord(fixture.pluginRoot, [projectStub]),
    });
    const ctx = sessionContext(fixture, true);
    const registered: [string, McpServerConfig][] = [];
    const pi = emptyRegistry();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- strong-mock records the call order through the method reference
    when(() => pi.registerMcpServer)
      .thenReturn((serverName, config) => {
        registered.push([serverName, config]);
      })
      .twice();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(registered, [
      [
        "plugin_demo_stub",
        {
          command: "project-stub",
          env: {
            CLAUDE_PLUGIN_ROOT: fixture.pluginRoot,
            CLAUDE_PLUGIN_DATA: dataDir(fixture, "project"),
          },
          exposure: "deferred",
        },
      ],
      [
        "plugin_demo_extra",
        {
          command: "extra",
          env: {
            CLAUDE_PLUGIN_ROOT: fixture.pluginRoot,
            CLAUDE_PLUGIN_DATA: dataDir(fixture, "user"),
          },
          exposure: "deferred",
        },
      ],
    ]);
    verify(pi);
    verify(ctx);
  });

  test("P2-DC-07: with the project untrusted the user record of the same plugin registers", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeState(fixture, "user", { demo: installRecord(fixture.pluginRoot) });
    await writeState(fixture, "project", {
      demo: installRecord(fixture.pluginRoot, [{ name: "stub", config: { command: "other" } }]),
    });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", fixture.pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: an unreadable project state is logged and the user record still registers", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    await writeState(fixture, "user", { demo: installRecord(fixture.pluginRoot) });
    const projectState = path.join(fixture.roots.project, "state.json");
    await writeJson(projectState, { schemaVersion: 9, marketplaces: {} });
    const ctx = sessionContext(fixture, true);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", fixture.pluginRoot));
    }).thenReturn(undefined);

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, [
      `[mcp] MCP servers of the project scope not registered: state.json at ${projectState} has an unsupported schema version`,
    ]);
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: an unreadable user state registers nothing and is logged", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    const statePath = path.join(fixture.roots.user, "state.json");
    await writeJson(statePath, { schemaVersion: 9, marketplaces: {} });
    const ctx = sessionContext(fixture, false);
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

  test("MREC-02: a legacy record registers the servers the legacy reader re-resolves", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeManifest(fixture, [{ name: "demo", source: "./plugins/demo", version: "1.0.0" }]);
    await writeJson(path.join(fixture.pluginRoot, ".mcp.json"), {
      mcpServers: { stub: STUB_SERVER },
    });
    await writeState(fixture, "user", { demo: legacyRecord(fixture.pluginRoot) });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", fixture.pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("MREC-02: a legacy record whose servers are unreadable registers nothing and is logged", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    await writeManifest(fixture, []);
    await writeState(fixture, "user", { demo: legacyRecord(fixture.pluginRoot) });
    const ctx = sessionContext(fixture, false);
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

  test("MREC-02: a record with an empty server list registers nothing and reads no declaration", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    await writeState(fixture, "user", { demo: installRecord(fixture.pluginRoot, []) });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();

    // act
    await builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") });

    // assert
    assert.deepStrictEqual(logged, []);
    verify(pi);
    verify(ctx);
  });

  test("UF-1: a git record inside its own plugin clone registers", async (t) => {
    // arrange
    const fixture = await session(t);
    const pluginRoot = path.join(
      fixture.roots.user,
      "plugin-clones",
      "0123456789ab-0123456789ab",
      "demo",
    );
    await mkdir(pluginRoot, { recursive: true });
    await writeState(fixture, "user", { demo: gitRecord(pluginRoot) });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  for (const { title, record } of [
    {
      title: "a record without a commit whose root lies in the plugin clones",
      record: (clones: string) =>
        installRecord(path.join(clones, "0123456789ab-0123456789ab", "demo")),
    },
    {
      title: "a git record whose root lies outside a clone entry of the plugin clones",
      record: (clones: string) => gitRecord(path.join(clones, "shared", "demo")),
    },
  ]) {
    test(`UF-1: ${title} registers nothing and is logged`, async (t) => {
      // arrange
      const fixture = await session(t);
      const logged = captureDebugLog(t);
      const clones = path.join(fixture.roots.user, "plugin-clones");
      await writeState(fixture, "user", { demo: record(clones) });
      const ctx = sessionContext(fixture, false);
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
  }

  test("UF-1: a path record of a cloned marketplace inside its checkout registers", async (t) => {
    // arrange
    const fixture = await session(t);
    const marketplaceRoot = path.join(fixture.roots.user, "sources", "mp");
    const pluginRoot = path.join(marketplaceRoot, "plugins", "demo");
    await mkdir(pluginRoot, { recursive: true });
    await writeState(
      fixture,
      "user",
      { demo: installRecord(pluginRoot) },
      { source: GITHUB_MARKETPLACE, marketplaceRoot },
    );
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", stubConfig(fixture, "user", pluginRoot));
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("UF-1: a cloned marketplace whose recorded root lies outside its checkout registers nothing", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    await writeState(
      fixture,
      "user",
      { demo: installRecord(fixture.pluginRoot) },
      { source: GITHUB_MARKETPLACE, marketplaceRoot: fixture.marketplaceRoot },
    );
    const ctx = sessionContext(fixture, false);
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

  test("UF-1: a record whose plugin root climbs out of its marketplace registers nothing and is logged", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    const pluginRoot = path.join(fixture.marketplaceRoot, "..", "elsewhere");
    await writeState(fixture, "user", { demo: installRecord(pluginRoot) });
    const ctx = sessionContext(fixture, false);
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

  test("UF-1: a record whose plugin root runs through a symlink registers nothing and is logged", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    const outside = path.join(fixture.environment.root, "outside");
    await mkdir(outside, { recursive: true });
    await symlink(outside, path.join(fixture.marketplaceRoot, "linked"));
    await writeState(fixture, "user", {
      demo: installRecord(path.join(fixture.marketplaceRoot, "linked", "demo")),
    });
    const ctx = sessionContext(fixture, false);
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

  test("D-MB-10: a disabled and a dependency-disabled record register nothing", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeState(fixture, "user", {
      off: { ...installRecord(fixture.pluginRoot), enabled: false },
      held: { ...installRecord(fixture.pluginRoot), dependencyDisabled: true },
    });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("P2-DC-06: blocked and malformed servers are skipped and an adapter-blocked one registers", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeState(fixture, "user", {
      demo: installRecord(fixture.pluginRoot, [
        { name: "sse", config: { type: "sse", url: "https://mcp.example.test/sse" } },
        { name: "bad", config: { command: "" } },
        { name: "elicit", config: { command: "node", bareElicitationCapability: true } },
      ]),
    });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_elicit", {
        command: "node",
        env: {
          CLAUDE_PLUGIN_ROOT: fixture.pluginRoot,
          CLAUDE_PLUGIN_DATA: dataDir(fixture, "user"),
        },
        exposure: "deferred",
      });
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("ANAME-06: the plugin's description reaches its registered server", async (t) => {
    // arrange
    const fixture = await session(t);
    await writeManifest(fixture, [
      { name: "demo", source: "./plugins/demo", version: "1.0.0", description: "Demo entry" },
    ]);
    await writeState(fixture, "user", { demo: installRecord(fixture.pluginRoot) });
    const ctx = sessionContext(fixture, false);
    const pi = emptyRegistry();
    when(() => {
      pi.registerMcpServer("plugin_demo_stub", {
        ...stubConfig(fixture, "user", fixture.pluginRoot),
        description: "Demo entry",
      });
    }).thenReturn(undefined);

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot: runOf("builtin") }));
    verify(pi);
    verify(ctx);
  });

  test("NFR-2: a record whose data directory cannot be named registers nothing and is logged", async (t) => {
    // arrange
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    await writeState(fixture, "user", { "..": installRecord(fixture.pluginRoot) });
    const ctx = sessionContext(fixture, false);
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
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    const ctx = sessionContext(fixture, false);
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
