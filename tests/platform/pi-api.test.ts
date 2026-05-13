import assert from "node:assert/strict";
import test from "node:test";

import {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import {
  PI_MCP_ADAPTER_NOT_LOADED,
  PI_SUBAGENTS_NOT_LOADED,
} from "../../extensions/pi-claude-marketplace/shared/markers.ts";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface ToolStub {
  name: string;
  sourceInfo?: { source?: string };
}

function makePi(tools: ToolStub[]): ExtensionAPI {
  return { getAllTools: () => tools } as unknown as ExtensionAPI;
}

function makeThrowingPi(): ExtensionAPI {
  return {
    getAllTools: () => {
      throw new Error("not ready");
    },
  } as unknown as ExtensionAPI;
}

test("platform pi-api owns soft-dep probes", () => {
  assert.equal(hasLoadedPiSubagents(makePi([{ name: "subagent" }])), true);
  assert.equal(hasLoadedPiSubagents(makePi([{ name: "other" }])), false);
  assert.equal(hasLoadedPiSubagents(makeThrowingPi()), false);
});

test("platform pi-api detects mcp adapter by name or source", () => {
  assert.equal(hasLoadedPiMcpAdapter(makePi([{ name: "mcp" }])), true);
  assert.equal(
    hasLoadedPiMcpAdapter(
      makePi([{ name: "other", sourceInfo: { source: "@scope/pi-mcp-adapter@1.0.0" } }]),
    ),
    true,
  );
  assert.equal(hasLoadedPiMcpAdapter(makePi([{ name: "other" }])), false);
  assert.equal(hasLoadedPiMcpAdapter(makeThrowingPi()), false);
});

test("platform pi-api warning composers preserve marker text", () => {
  assert.equal(subagentWarningIfNeeded(makePi([{ name: "subagent" }]), ["agent"]), "");
  assert.equal(mcpAdapterWarningIfNeeded(makePi([{ name: "mcp" }]), ["server"]), "");

  assert.equal(
    subagentWarningIfNeeded(makePi([]), ["agent"]),
    `${PI_SUBAGENTS_NOT_LOADED}install it with \`pi install npm:pi-subagents\`, then run \`/reload\`.`,
  );
  assert.equal(
    mcpAdapterWarningIfNeeded(makePi([]), ["server"]),
    `${PI_MCP_ADAPTER_NOT_LOADED}install it with \`pi install npm:pi-mcp-adapter\`, then run \`/reload\`.`,
  );
});
