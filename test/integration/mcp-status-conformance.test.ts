// test/integration/mcp-status-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against pi-mcp-adapter's own status contract.
// ASTAT-02: the adapter's empty shutdown snapshot, sent on its own channel
// with its own snapshot version, leaves the MCP status tracker with no usable
// snapshot. ASTAT-01: a drift guard pins the channel, the version and the
// status union in the adapter's `dist/types.d.ts`, which info maps. Both cases
// need the adapter's own code. What info shows from the adapter's reports is
// in the scenarios of `features/mcp-server/`: `companion-missing.feature` and
// `project-scope.feature` show a server's status, and `project-scope.feature`
// also shows a user row that reads `(overridden by project scope)`.
//
// pi-mcp-adapter is an optional peer. The test imports its compiled
// `dist/types.js` constants in place from the declared floor that
// `scripts/install-test-peers.mjs` installs, through pi-mcp-adapter-peer.ts. A
// missing or wrong-version adapter fails every case.
//
// The adapter ships its snapshot builder only as TypeScript source under
// `node_modules`, which Node does not type-strip, so the test builds the
// snapshot by hand in the adapter's shape.

import assert from "node:assert/strict";
import test from "node:test";

import { createEventBus } from "@earendil-works/pi-coding-agent";

import { createMcpStatusTracker } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";

import {
  findPiMcpAdapterPackage,
  loadPiMcpAdapterModule,
  readPiMcpAdapterDist,
} from "./pi-mcp-adapter-peer.ts";

import type { PiMcpAdapterTypes } from "./pi-mcp-adapter-peer.ts";

const CONTRACT_LINE_PREFIXES = [
  "export declare const MCP_STATUS_EVENT",
  "export declare const MCP_STATUS_SNAPSHOT_VERSION",
  "export type McpServerRuntimeStatus",
];

async function loadAdapterTypes(): Promise<PiMcpAdapterTypes> {
  const peer = await findPiMcpAdapterPackage();
  return loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");
}

test("ASTAT-02: pi-mcp-adapter's shutdown snapshot leaves the tracker with no usable snapshot", async () => {
  // arrange
  const types = await loadAdapterTypes();
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

test("ASTAT-01: pi-mcp-adapter's status union, channel and snapshot version are the ones info maps", async () => {
  // arrange
  const peer = await findPiMcpAdapterPackage();
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
