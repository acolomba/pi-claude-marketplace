import assert from "node:assert/strict";
import { test } from "node:test";

import {
  softDepMarkers,
  type Dependency,
} from "../../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

void ("agents" satisfies Dependency);
void ("mcp" satisfies Dependency);
// @ts-expect-error Dependency excludes unknown companion targets
void ("hooks" satisfies Dependency);

const markerCases = [
  {
    title: "returns no markers when neither dependency is declared",
    declaresAgents: false,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedMarkers: [],
  },
  {
    title: "returns the agents marker when only agents are declared and unavailable",
    declaresAgents: true,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns the MCP marker when only MCP is declared and unavailable",
    declaresAgents: false,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedMarkers: ["requires pi-mcp"],
  },
  {
    title: "returns agents before MCP when both dependencies are declared and unavailable",
    declaresAgents: true,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedMarkers: ["requires pi-subagents", "requires pi-mcp"],
  },
] as const;

for (const { title, declaresAgents, declaresMcp, probe, expectedMarkers } of markerCases) {
  test(title, () => {
    // arrange
    const expectedSoftDepMarkers = [...expectedMarkers];

    // act
    const softDependencyMarkers = softDepMarkers(declaresAgents, declaresMcp, probe);

    // assert
    assert.deepStrictEqual(softDependencyMarkers, expectedSoftDepMarkers);
  });
}
