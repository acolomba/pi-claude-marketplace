// tests/presentation/soft-dep.test.ts
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01 / D-13-07 / RESEARCH.md
// Open Question 3): the aggregated trailer helpers have been DELETED
// from `platform/pi-api.ts`. The `presentation/soft-dep.ts` shim now
// only re-exports the two probe helpers (`hasLoadedPiSubagents` /
// `hasLoadedPiMcpAdapter`); this test continues to cover that
// pass-through behavior so a future Phase 14 shim change does not
// silently regress the probe contract.

import assert from "node:assert/strict";
import test from "node:test";

import {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
} from "../../extensions/pi-claude-marketplace/presentation/soft-dep.ts";

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
