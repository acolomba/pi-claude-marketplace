import assert from "node:assert/strict";
import { test } from "node:test";

import {
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
    expectedMarkers: ["requires pi-mcp"],
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
    expectedMarkers: ["requires pi-subagents", "requires pi-mcp"],
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
    expectedMarkers: ["requires pi-mcp"],
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
    expectedMarkers: ["requires pi-mcp"],
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
    expectedMarkers: ["requires pi-subagents", "requires pi-mcp", "requires pi-dynamic-workflows"],
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
