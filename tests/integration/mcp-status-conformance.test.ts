// tests/integration/mcp-status-conformance.test.ts
//
// ASTAT-01 / ASTAT-02: the MCP status tracker reads pi-mcp-adapter's own
// status contract. The tracker subscribes to the adapter's own channel and
// accepts its own snapshot version, and `/claude:plugin info` joins the
// snapshot on the keys a real install wrote to `mcp-adapter.json`, in both
// scopes, through Pi's real event bus. The adapter's empty shutdown snapshot
// reads as no usable snapshot. A drift guard pins the channel, the version and
// the status union in the adapter's `dist/types.d.ts`.
//
// pi-mcp-adapter is an optional peer. The test finds it through
// `PI_MCP_ADAPTER_ROOT` only (pi-mcp-adapter-peer.ts) and imports its
// `dist/types.js` constants in place. Each case skips only when that variable
// is unset. The CI `integration` job installs the pinned peer and always sets
// it, so CI runs every case.
//
// The adapter ships its snapshot builder only as TypeScript source under
// `node_modules`, which Node does not type-strip, so the test builds the
// snapshot by hand in the adapter's shape. The adapter names each server by
// its config key, so the snapshot lists the keys the install wrote.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEventBus } from "@earendil-works/pi-coding-agent";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createInstallOperation,
  getPluginInfo,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createMcpStatusTracker } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";
import {
  findPiMcpAdapterPackage,
  loadPiMcpAdapterModule,
  readPiMcpAdapterDist,
} from "./pi-mcp-adapter-peer.ts";

import type { PiMcpAdapterTypes } from "./pi-mcp-adapter-peer.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

const NOT_INSTALLED = "PI_MCP_ADAPTER_ROOT is not set";

const CONTRACT_LINE_PREFIXES = [
  "export declare const MCP_STATUS_EVENT",
  "export declare const MCP_STATUS_SNAPSHOT_VERSION",
  "export type McpServerRuntimeStatus",
];

async function loadAdapterTypes(): Promise<PiMcpAdapterTypes | undefined> {
  const peer = await findPiMcpAdapterPackage();
  if (peer === undefined) {
    return undefined;
  }

  return loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");
}

async function installHello(cwd: string, scope: Scope): Promise<void> {
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  await createInstallOperation(
    hooksRouting,
    createCompletionCache(),
  )({ ...makeCtx().session, scope, cwd, marketplace: "mp", plugin: "hello" });
}

async function readAdapterKeys(cwd: string, scope: Scope): Promise<string[]> {
  const config = JSON.parse(
    await readFile(locationsFor(scope, cwd).mcpAdapterJsonPath, "utf8"),
  ) as {
    readonly mcpServers: Readonly<Record<string, unknown>>;
  };
  return Object.keys(config.mcpServers);
}

test("ASTAT-01: a snapshot on pi-mcp-adapter's own channel, for the keys install wrote, reaches info through Pi's event bus", async (t) => {
  const types = await loadAdapterTypes();
  if (types === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  await withHermeticEnvironment("mcp-status-conformance-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project", "user"]);
    await installHello(cwd, "user");
    await installHello(cwd, "project");
    const userKeys = await readAdapterKeys(cwd, "user");
    const projectKeys = await readAdapterKeys(cwd, "project");
    const events = createEventBus();
    const mcpStatus = createMcpStatusTracker(events);
    const info = makeCtx();

    // act
    events.emit(types.MCP_STATUS_EVENT, {
      version: types.MCP_STATUS_SNAPSHOT_VERSION,
      servers: projectKeys.map((name) => ({
        name,
        status: "connected",
        toolCount: 1,
        directToolCount: 0,
        disabled: false,
        listenState: "active",
      })),
      totalTools: 1,
      totalResources: 0,
      connectedCount: 1,
      disabledCount: 0,
    });
    await getPluginInfo({ ...info.session, mcpStatus, marketplace: "mp", plugin: "hello", cwd });

    // assert
    assert.deepStrictEqual(userKeys, ["plugin_hello_srv_"]);
    assert.deepStrictEqual(projectKeys, ["plugin_hello_srv_"]);
    assert.deepStrictEqual(info.notifications, [
      {
        message: [
          "● mp [project] <no autoupdate>",
          "  ● hello v1.0.0 (installed)",
          "    mcp: plugin:hello:srv (connected)",
          "    requires: pi-mcp-adapter (missing)",
          "",
          "● mp [user] <no autoupdate>",
          "  ● hello v1.0.0 (installed)",
          "    mcp: plugin:hello:srv (overridden by project scope)",
          "    requires: pi-mcp-adapter (missing)",
        ].join("\n"),
        severity: undefined,
      },
    ]);
  });
});

test("ASTAT-02: pi-mcp-adapter's shutdown snapshot leaves the tracker with no usable snapshot", async (t) => {
  // arrange
  const types = await loadAdapterTypes();
  if (types === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  const events = createEventBus();
  const mcpStatus = createMcpStatusTracker(events);
  events.emit(types.MCP_STATUS_EVENT, {
    version: types.MCP_STATUS_SNAPSHOT_VERSION,
    servers: [
      {
        name: "plugin_hello_srv_",
        status: "connected",
        toolCount: 1,
        directToolCount: 0,
        disabled: false,
        listenState: "active",
      },
    ],
    totalTools: 1,
    totalResources: 0,
    connectedCount: 1,
    disabledCount: 0,
  });
  const statusBeforeShutdown = mcpStatus.lookup("plugin_hello_srv_");

  // act
  events.emit(types.MCP_STATUS_EVENT, {
    version: types.MCP_STATUS_SNAPSHOT_VERSION,
    servers: [],
    totalTools: 0,
    totalResources: 0,
    connectedCount: 0,
    disabledCount: 0,
  });

  // assert
  assert.strictEqual(statusBeforeShutdown, "connected");
  assert.strictEqual(mcpStatus.lookup("plugin_hello_srv_"), "no-snapshot");
});

test("ASTAT-01: pi-mcp-adapter's status union, channel and snapshot version are the ones info maps", async (t) => {
  // arrange
  const peer = await findPiMcpAdapterPackage();
  if (peer === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  // act
  const declarations = await readPiMcpAdapterDist(peer, "types.d.ts");

  // assert
  // A failure means the adapter changed its status contract: a new status
  // needs an info token, and a new snapshot version needs a decision on the
  // channel, before this test is updated.
  assert.deepStrictEqual(
    declarations
      .split("\n")
      .filter((line) => CONTRACT_LINE_PREFIXES.some((prefix) => line.startsWith(prefix))),
    [
      'export declare const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";',
      "export declare const MCP_STATUS_SNAPSHOT_VERSION: 1;",
      'export type McpServerRuntimeStatus = "connected" | "cached" | "failed" | "needs-auth" | "not-connected" | "blocked" | "disabled";',
    ],
  );
});
