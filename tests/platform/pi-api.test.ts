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

// Phase 17.2 Plan 03 (WR-04 / D-17.2-08): `name` relaxed to optional so the
// `tool.name === undefined` boundary case (Test 6) can be constructed without
// a cast. Mirrors the `MockTool` shape in tests/shared/notify-v2.test.ts.
interface ToolStub {
  name?: string;
  sourceInfo?: { source?: unknown };
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

// -----------------------------------------------------------------------------
// Phase 17.2 Plan 03 -- WR-04 / D-17.2-08 boundary coverage.
//
// The three previously-thin or uncovered branches of `hasLoadedPiSubagents` /
// `hasLoadedPiMcpAdapter` (at platform/pi-api.ts:51-78) are locked below:
//   (a) `pi-mcp-adapter` `sourceInfo.source` substring boundary
//   (b) try/catch fallback when `getAllTools()` throws or a tool accessor
//       throws inside the `.some()` callback
//   (c) `tool.name === undefined` boundary case (the real coverage gap)
// -----------------------------------------------------------------------------

// WR-04 branch (a): substring boundary of the `pi-mcp-adapter` source path.
test("platform pi-api: hasLoadedPiMcpAdapter source-substring boundary matches", () => {
  // Exact substring match -- minimal positive case.
  assert.equal(
    hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: { source: "pi-mcp-adapter" } }])),
    true,
  );

  // Substring embedded within a larger path-like string.
  assert.equal(
    hasLoadedPiMcpAdapter(
      makePi([{ name: "other", sourceInfo: { source: "wrapper/pi-mcp-adapter-clone" } }]),
    ),
    true,
  );

  // Prefix-only "pi-mcp" without "-adapter" suffix MUST NOT match.
  assert.equal(
    hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: { source: "pi-mcp" } }])),
    false,
  );

  // Empty `source` string -- includes() returns false for non-empty needle.
  assert.equal(
    hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: { source: "" } }])),
    false,
  );

  // `sourceInfo` present but without a `source` field at all.
  assert.equal(hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: {} }])), false);

  // Non-string `source` (number, undefined) -- the `typeof src === "string"`
  // guard at pi-api.ts:73 protects against `.includes()` blowing up.
  assert.equal(
    hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: { source: undefined } }])),
    false,
  );
  assert.equal(
    hasLoadedPiMcpAdapter(makePi([{ name: "other", sourceInfo: { source: 42 } }])),
    false,
  );
});

// WR-04 branch (b): try/catch fallback. `getAllTools()` throwing is covered by
// existing Tests 1 and 2; this test hardens that coverage and adds a tool-level
// accessor-throws case to exercise the in-callback fault path.
test("platform pi-api: probes return false when getAllTools() throws or a tool accessor throws", () => {
  // `getAllTools()` throws -- both probes degrade to false, composed status
  // is the clean negative.
  assert.equal(hasLoadedPiSubagents(makeThrowingPi()), false);
  assert.equal(hasLoadedPiMcpAdapter(makeThrowingPi()), false);
  assert.deepEqual(softDepStatus(makeThrowingPi()), {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  });

  // In-callback throw: a tool whose `name` getter throws is consulted inside
  // `.some(...)`; the outer try/catch in both probes must catch and degrade.
  function makePiWithThrowingTool(): ExtensionAPI {
    return {
      getAllTools: () => [
        new Proxy(
          {},
          {
            get(_target, prop) {
              if (prop === "name") {
                throw new Error("accessor failed");
              }

              return undefined;
            },
          },
        ),
      ],
    } as unknown as ExtensionAPI;
  }

  assert.equal(hasLoadedPiSubagents(makePiWithThrowingTool()), false);
  // For the mcp probe, accessing `name` on the same Proxy throws -- the outer
  // try/catch catches it and degrades to false (consistent with branch policy).
  assert.equal(hasLoadedPiMcpAdapter(makePiWithThrowingTool()), false);
});

// WR-04 branch (c): `tool.name === undefined` boundary. This is the real
// coverage gap -- the existing ToolStub previously forbade omitting `name`.
test("platform pi-api: probes do not crash on tool.name === undefined; fall through to source-substring or false", () => {
  // Subagent probe: undefined === "subagent" is false; no crash, no spurious true.
  assert.equal(hasLoadedPiSubagents(makePi([{}])), false);

  // Subagent probe has NO source-substring fallback -- even a tool whose
  // sourceInfo.source is "pi-subagents" returns false because the probe only
  // checks `tool.name === "subagent"`.
  assert.equal(hasLoadedPiSubagents(makePi([{ sourceInfo: { source: "pi-subagents" } }])), false);

  // Mcp adapter probe: no name, no sourceInfo -- false.
  assert.equal(hasLoadedPiMcpAdapter(makePi([{}])), false);

  // Mcp adapter probe: undefined name, but sourceInfo.source contains the
  // substring -- the fallback fires and the probe returns true.
  assert.equal(hasLoadedPiMcpAdapter(makePi([{ sourceInfo: { source: "pi-mcp-adapter" } }])), true);
});
