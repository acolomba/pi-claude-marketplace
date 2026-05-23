import assert from "node:assert/strict";
import test from "node:test";

// Probes (hasLoadedPi*) come via the thin presentation/soft-dep.ts
// re-export shim -- this test verifies the shim's surface after the
// Plan 13-01-03 thinning (D-13-07: aggregated-trailer helpers retired
// from the shim). The trailer helpers themselves
// (subagentWarningIfNeeded / mcpAdapterWarningIfNeeded) source directly
// from platform/pi-api.ts where they still live until sub-wave 2c
// finalization may delete them.
import {
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
} from "../../extensions/pi-claude-marketplace/presentation/soft-dep.ts";
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

// RH-3 -------------------------------------------------------------

test("RH-3: hasLoadedPiSubagents returns true when 'subagent' tool present", () => {
  assert.equal(hasLoadedPiSubagents(makePi([{ name: "subagent" }])), true);
});

test("RH-3: hasLoadedPiSubagents returns false when 'subagent' tool absent", () => {
  assert.equal(hasLoadedPiSubagents(makePi([{ name: "other" }])), false);
  assert.equal(hasLoadedPiSubagents(makePi([])), false);
});

test("Pitfall 3: hasLoadedPiSubagents returns false when probe throws", () => {
  assert.equal(hasLoadedPiSubagents(makeThrowingPi()), false);
});

// RH-4 -------------------------------------------------------------

test("RH-4: hasLoadedPiMcpAdapter returns true when 'mcp' tool present", () => {
  assert.equal(hasLoadedPiMcpAdapter(makePi([{ name: "mcp" }])), true);
});

test("RH-4: hasLoadedPiMcpAdapter returns true when sourceInfo.source includes 'pi-mcp-adapter'", () => {
  assert.equal(
    hasLoadedPiMcpAdapter(
      makePi([{ name: "other", sourceInfo: { source: "@scope/pi-mcp-adapter@1.0.0" } }]),
    ),
    true,
  );
});

test("RH-4: hasLoadedPiMcpAdapter returns false when neither name nor source matches", () => {
  assert.equal(
    hasLoadedPiMcpAdapter(
      makePi([{ name: "other", sourceInfo: { source: "@scope/something-else" } }]),
    ),
    false,
  );
  assert.equal(hasLoadedPiMcpAdapter(makePi([])), false);
});

test("Pitfall 3: hasLoadedPiMcpAdapter returns false when probe throws", () => {
  assert.equal(hasLoadedPiMcpAdapter(makeThrowingPi()), false);
});

// RH-5 ------------------------------------------------------------

test("RH-5: subagentWarningIfNeeded returns '' when no agents were staged", () => {
  assert.equal(subagentWarningIfNeeded(makePi([]), []), "");
});

test("RH-5: subagentWarningIfNeeded returns '' when dep IS loaded", () => {
  assert.equal(subagentWarningIfNeeded(makePi([{ name: "subagent" }]), ["a"]), "");
});

test("RH-5: subagentWarningIfNeeded returns canonical warning when staged + unloaded", () => {
  const out = subagentWarningIfNeeded(makePi([]), ["a"]);
  assert.equal(
    out,
    `${PI_SUBAGENTS_NOT_LOADED}install it with \`pi install npm:pi-subagents\`, then run \`/reload\`.`,
  );
  // Sanity: the marker prefix is the locked PRD §6.12 ES-5 contract.
  assert.ok(out.startsWith(PI_SUBAGENTS_NOT_LOADED));
});

test("RH-5: mcpAdapterWarningIfNeeded returns canonical warning when staged + unloaded", () => {
  const out = mcpAdapterWarningIfNeeded(makePi([]), ["server-1"]);
  assert.equal(
    out,
    `${PI_MCP_ADAPTER_NOT_LOADED}install it with \`pi install npm:pi-mcp-adapter\`, then run \`/reload\`.`,
  );
  assert.ok(out.startsWith(PI_MCP_ADAPTER_NOT_LOADED));
});

test("RH-5: mcpAdapterWarningIfNeeded returns '' when no MCP servers staged", () => {
  assert.equal(mcpAdapterWarningIfNeeded(makePi([]), []), "");
});

test("RH-5: mcpAdapterWarningIfNeeded returns '' when dep IS loaded (by name)", () => {
  assert.equal(mcpAdapterWarningIfNeeded(makePi([{ name: "mcp" }]), ["s"]), "");
});
