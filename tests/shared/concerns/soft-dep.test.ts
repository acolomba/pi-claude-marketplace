import assert from "node:assert/strict";
import { test } from "node:test";

import {
  companionRequirements,
  softDepMarkers,
  type Dependency,
} from "../../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

void ("agents" satisfies Dependency);
void ("mcp" satisfies Dependency);
void ("workflows" satisfies Dependency);
// @ts-expect-error Dependency excludes unknown companion targets
void ("hooks" satisfies Dependency);

const markerCases = [
  {
    title:
      "returns no markers when neither dependency is declared and both companions are unavailable",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the agents marker when only agents are declared and unavailable",
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns the MCP marker when only MCP is declared and unavailable",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-mcp-adapter"],
  },
  {
    title: "returns agents before MCP when both dependencies are declared and unavailable",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents", "requires pi-mcp-adapter"],
  },
  {
    title: "returns no markers when neither dependency is declared and only MCP is loaded",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the agents marker when only agents are declared and only MCP is loaded",
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns no markers when only MCP is declared and loaded",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the agents marker when both dependencies are declared and only MCP is loaded",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns no markers when neither dependency is declared and only agents are loaded",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when only agents are declared and loaded",
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the MCP marker when only MCP is declared and only agents are loaded",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-mcp-adapter"],
  },
  {
    title: "returns the MCP marker when both dependencies are declared and only agents are loaded",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-mcp-adapter"],
  },
  {
    title: "returns no markers when neither dependency is declared and both companions are loaded",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when only agents are declared and both companions are loaded",
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when only MCP is declared and both companions are loaded",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when both dependencies are declared and both companions are loaded",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    // WDEP-04: the workflows axis. The engine-absent probe is what makes the
    // marker fire; the declaration alone does not.
    title:
      "returns the host-engine marker when only workflows are declared and the engine is absent",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: false,
    },
    expectedMarkers: ["requires pi-dynamic-workflows"],
  },
  {
    title: "returns no markers when workflows are declared and the host engine is loaded",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when the host engine is absent and no workflow is declared",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: false,
    },
    expectedMarkers: [],
  },
  {
    // WDEP-04: the brace join is byte-critical, so the order is asserted as an
    // exact array rather than as membership.
    title: "returns agents, then MCP, then the host engine when all three are declared and absent",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    },
    expectedMarkers: [
      "requires pi-subagents",
      "requires pi-mcp-adapter",
      "requires pi-dynamic-workflows",
    ],
  },
] as const;

for (const {
  title,
  declaresAgents,
  declaresMcp,
  declaresWorkflows,
  probe,
  expectedMarkers,
} of markerCases) {
  test(title, () => {
    // arrange
    const expectedSoftDepMarkers = [...expectedMarkers];

    // act
    const softDependencyMarkers = softDepMarkers(
      declaresAgents,
      declaresMcp,
      declaresWorkflows,
      probe,
    );

    // assert
    assert.deepStrictEqual(softDependencyMarkers, expectedSoftDepMarkers);
  });
}

const requirementCases = [
  {
    title: "returns no companion requirement when no companion kind is declared",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    },
    expectedRequirements: [],
  },
  {
    title:
      "tags pi-mcp-adapter missing when MCP is declared and the adapter is not loaded (ADET-01)",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: true,
    },
    expectedRequirements: [{ companion: "pi-mcp-adapter", missing: true }],
  },
  {
    title: "orders every declared companion by name and tags each from the probe (ADET-01)",
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
      workflowEngineLoaded: false,
    },
    expectedRequirements: [
      { companion: "pi-dynamic-workflows", missing: true },
      { companion: "pi-mcp-adapter", missing: false },
      { companion: "pi-subagents", missing: true },
    ],
  },
] as const;

for (const {
  title,
  declaresAgents,
  declaresMcp,
  declaresWorkflows,
  probe,
  expectedRequirements,
} of requirementCases) {
  test(title, () => {
    // arrange
    const expectedCompanionRequirements = [...expectedRequirements];

    // act
    const requirements = companionRequirements(
      declaresAgents,
      declaresMcp,
      declaresWorkflows,
      probe,
    );

    // assert
    assert.deepStrictEqual(requirements, expectedCompanionRequirements);
  });
}

const NOTHING_LOADED = {
  piSubagentsLoaded: false,
  piMcpAdapterLoaded: false,
  workflowEngineLoaded: false,
} as const;

for (const { kind, declaresAgents, declaresMcp, declaresWorkflows, companion } of [
  {
    kind: "agents",
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    companion: "pi-subagents",
  },
  {
    kind: "mcp",
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    companion: "pi-mcp-adapter",
  },
  {
    kind: "workflows",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: true,
    companion: "pi-dynamic-workflows",
  },
] as const) {
  test(`names the same ${companion} companion in the ${kind} marker and the requires entry (ADET-01)`, () => {
    // arrange
    const expectedNames = {
      markers: [`requires ${companion}`],
      requirements: [{ companion, missing: true }],
    };

    // act
    const markers = softDepMarkers(declaresAgents, declaresMcp, declaresWorkflows, NOTHING_LOADED);
    const requirements = companionRequirements(
      declaresAgents,
      declaresMcp,
      declaresWorkflows,
      NOTHING_LOADED,
    );

    // assert
    assert.deepStrictEqual({ markers, requirements }, expectedNames);
  });
}
