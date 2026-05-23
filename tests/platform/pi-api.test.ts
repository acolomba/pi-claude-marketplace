// tests/platform/pi-api.test.ts
//
// Phase 13 sub-wave 2c (Plan 13-02c-01 / D-13-07 / RESEARCH.md Open
// Question 3): the legacy aggregated soft-dep trailer helpers have
// been DELETED from `platform/pi-api.ts` -- their tests are removed
// alongside. The three surviving exports are the probe helpers
// (`hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter` / `softDepStatus`),
// which feed the `SoftDepProbe` injected into `renderRow`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  softDepStatus,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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

test("platform pi-api owns soft-dep probes (subagent)", () => {
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

test("softDepStatus composes the SoftDepProbe shape from the two probes", () => {
  const probe = softDepStatus(makePi([{ name: "subagent" }, { name: "mcp" }]));
  assert.deepEqual(probe, { piSubagentsLoaded: true, piMcpAdapterLoaded: true });

  const empty = softDepStatus(makePi([]));
  assert.deepEqual(empty, { piSubagentsLoaded: false, piMcpAdapterLoaded: false });
});
