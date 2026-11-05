import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  companionRequirements,
  declaredDependencies,
  isMcpDependency,
  mcpDependencyMarker,
  softDepMarkers,
  type Dependency,
  type McpDependency,
} from "../../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

import type {
  ActiveMcpImplementation,
  SoftDepStatus,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// D-P3-10: an MCP dependency that only pi-mcp-adapter runs every server of.
const ADAPTER_MCP: McpDependency = { kind: "mcp", runEvery: ["adapter"] };
const BOTH_RUN_EVERY: McpDependency = { kind: "mcp", runEvery: ["adapter", "builtin"] };
const BUILTIN_MCP: McpDependency = { kind: "mcp", runEvery: ["builtin"] };
const SPLIT_MCP: McpDependency = { kind: "mcp", runEvery: [] };

void ("agents" satisfies Dependency);
void ({ kind: "mcp", runEvery: ["builtin"] } satisfies Dependency);
void ("workflows" satisfies Dependency);
// @ts-expect-error Dependency excludes unknown companion targets
void ("hooks" satisfies Dependency);
// @ts-expect-error D-P3-10: the MCP member is the McpDependency, not a literal
void ("mcp" satisfies Dependency);

const markerCases = [
  {
    title:
      "returns no markers when neither dependency is declared and both companions are unavailable",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "none",
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
      mcpImplementation: "none",
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns the MCP marker when only MCP is declared and unavailable",
    declaresAgents: false,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "none",
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-mcp-adapter"],
  },
  {
    title: "returns agents before MCP when both dependencies are declared and unavailable",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "none",
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
      mcpImplementation: "adapter",
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
      mcpImplementation: "adapter",
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-subagents"],
  },
  {
    title: "returns no markers when only MCP is declared and loaded",
    declaresAgents: false,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "adapter",
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the agents marker when both dependencies are declared and only MCP is loaded",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "adapter",
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
      mcpImplementation: "none",
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
      mcpImplementation: "none",
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns the MCP marker when only MCP is declared and only agents are loaded",
    declaresAgents: false,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "none",
      workflowEngineLoaded: true,
    },
    expectedMarkers: ["requires pi-mcp-adapter"],
  },
  {
    title: "returns the MCP marker when both dependencies are declared and only agents are loaded",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "none",
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
      mcpImplementation: "adapter",
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
      mcpImplementation: "adapter",
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when only MCP is declared and both companions are loaded",
    declaresAgents: false,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "adapter",
      workflowEngineLoaded: true,
    },
    expectedMarkers: [],
  },
  {
    title: "returns no markers when both dependencies are declared and both companions are loaded",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "adapter",
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
      mcpImplementation: "adapter",
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
      mcpImplementation: "adapter",
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
      mcpImplementation: "adapter",
      workflowEngineLoaded: false,
    },
    expectedMarkers: [],
  },
  {
    // WDEP-04: the brace join is byte-critical, so the order is asserted as an
    // exact array rather than as membership.
    title: "returns agents, then MCP, then the host engine when all three are declared and absent",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "none",
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
      mcpImplementation: "none",
      workflowEngineLoaded: false,
    },
    expectedRequirements: [],
  },
  {
    title:
      "D-P3-08: tags pi-mcp-adapter missing for servers only the adapter runs with no MCP implementation (ADET-01)",
    declaresAgents: false,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: false,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "none",
      workflowEngineLoaded: true,
    },
    expectedRequirements: [{ companion: "pi-mcp-adapter", missing: true }],
  },
  {
    title:
      "MREC-07: orders every declared companion by name and tags each from the probe (ADET-01)",
    declaresAgents: true,
    declaresMcp: ADAPTER_MCP,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "adapter",
      workflowEngineLoaded: false,
    },
    expectedRequirements: [
      { companion: "pi-dynamic-workflows", missing: true },
      { companion: "pi-mcp-adapter", missing: false },
      { companion: "pi-subagents", missing: true },
    ],
  },
  {
    title: "MREC-07: sorts builtin mcp before the pi- companions (D-P3-08)",
    declaresAgents: true,
    declaresMcp: BUILTIN_MCP,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: false,
      mcpImplementation: "none",
      workflowEngineLoaded: false,
    },
    expectedRequirements: [
      { companion: "builtin mcp", missing: true },
      { companion: "pi-dynamic-workflows", missing: true },
      { companion: "pi-subagents", missing: true },
    ],
  },
  {
    title: "MREC-07: sorts mcp before the pi- companions (D-P3-08)",
    declaresAgents: true,
    declaresMcp: BOTH_RUN_EVERY,
    declaresWorkflows: true,
    probe: {
      piSubagentsLoaded: true,
      mcpImplementation: "builtin",
      workflowEngineLoaded: true,
    },
    expectedRequirements: [
      { companion: "mcp", missing: false },
      { companion: "pi-dynamic-workflows", missing: false },
      { companion: "pi-subagents", missing: false },
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

// D-P3-08: the MCP entry for each runEvery shape and active implementation.
const MCP_REQUIREMENT_CASES = [
  { label: "both", dependency: BOTH_RUN_EVERY, active: "none", companion: "mcp", missing: true },
  {
    label: "both",
    dependency: BOTH_RUN_EVERY,
    active: "adapter",
    companion: "mcp",
    missing: false,
  },
  {
    label: "both",
    dependency: BOTH_RUN_EVERY,
    active: "builtin",
    companion: "mcp",
    missing: false,
  },
  {
    label: "adapter only",
    dependency: ADAPTER_MCP,
    active: "adapter",
    companion: "pi-mcp-adapter",
    missing: false,
  },
  {
    label: "adapter only",
    dependency: ADAPTER_MCP,
    active: "builtin",
    companion: "pi-mcp-adapter",
    missing: true,
  },
  {
    label: "adapter only",
    dependency: ADAPTER_MCP,
    active: "none",
    companion: "pi-mcp-adapter",
    missing: true,
  },
  {
    label: "builtin only",
    dependency: BUILTIN_MCP,
    active: "builtin",
    companion: "builtin mcp",
    missing: false,
  },
  {
    label: "builtin only",
    dependency: BUILTIN_MCP,
    active: "adapter",
    companion: "builtin mcp",
    missing: true,
  },
  {
    label: "builtin only",
    dependency: BUILTIN_MCP,
    active: "none",
    companion: "builtin mcp",
    missing: true,
  },
  { label: "split", dependency: SPLIT_MCP, active: "none", companion: "mcp", missing: true },
  {
    label: "split",
    dependency: SPLIT_MCP,
    active: "adapter",
    companion: "builtin mcp",
    missing: true,
  },
  {
    label: "split",
    dependency: SPLIT_MCP,
    active: "builtin",
    companion: "pi-mcp-adapter",
    missing: true,
  },
] as const;

describe("companionRequirements MCP entry", () => {
  for (const { label, dependency, active, companion, missing } of MCP_REQUIREMENT_CASES) {
    test(`D-P3-08: ${label} MCP dependency under ${active} gives ${companion}${missing ? " (missing)" : ""}`, () => {
      // arrange
      const probe = probeWith(active);

      // act
      const requirements = companionRequirements(false, dependency, false, probe);

      // assert
      assert.deepStrictEqual(requirements, [{ companion, missing }]);
    });

    test(`D-P3-06: ${label} MCP dependency under ${active} names the entry's companion in the marker exactly when the entry is missing`, () => {
      // arrange
      const probe = probeWith(active);
      const expectedMarker = missing ? `requires ${companion}` : undefined;

      // act
      const marker = mcpDependencyMarker(dependency, probe);

      // assert
      assert.strictEqual(marker, expectedMarker);
    });
  }

  for (const active of ["none", "adapter", "builtin"] as const) {
    test(`MREC-07: gives no MCP entry for no MCP dependency under ${active} (D-P3-08)`, () => {
      // arrange
      const probe = probeWith(active);

      // act
      const requirements = companionRequirements(false, false, false, probe);

      // assert
      assert.deepStrictEqual(requirements, []);
    });
  }
});

const NOTHING_LOADED = {
  piSubagentsLoaded: false,
  mcpImplementation: "none",
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
    declaresMcp: ADAPTER_MCP,
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

describe("declaredDependencies", () => {
  test("returns no dependencies when no dependency is declared", () => {
    // arrange
    const outcome = {
      declaresAgents: false,
      declaresMcp: false as const,
      declaresWorkflows: false,
    };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, []);
  });

  test("returns agents when only agents are declared", () => {
    // arrange
    const outcome = { declaresAgents: true, declaresMcp: false as const, declaresWorkflows: false };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["agents"]);
  });

  test("returns mcp when only mcp is declared", () => {
    // arrange
    const outcome = { declaresAgents: false, declaresMcp: ADAPTER_MCP, declaresWorkflows: false };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, [ADAPTER_MCP]);
  });

  test("WDEP-02: returns workflows when only workflows are declared", () => {
    // arrange
    const outcome = { declaresAgents: false, declaresMcp: false as const, declaresWorkflows: true };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["workflows"]);
  });

  test("returns agents before mcp when both are declared", () => {
    // arrange
    const outcome = { declaresAgents: true, declaresMcp: ADAPTER_MCP, declaresWorkflows: false };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["agents", ADAPTER_MCP]);
  });

  test("WDEP-02: returns workflows last when all three are declared", () => {
    // arrange
    const outcome = { declaresAgents: true, declaresMcp: ADAPTER_MCP, declaresWorkflows: true };

    // act
    const dependencies = declaredDependencies(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["agents", ADAPTER_MCP, "workflows"]);
  });
});

test("D-P3-10: isMcpDependency picks the McpDependency out of a mixed list", () => {
  // arrange
  const dependencies: readonly Dependency[] = ["agents", "workflows", ADAPTER_MCP];

  // act
  const picked = dependencies.filter((dependency) => isMcpDependency(dependency));

  // assert
  assert.deepStrictEqual(picked, [ADAPTER_MCP]);
});

/** A snapshot with every non-MCP companion loaded and `active` as the MCP implementation. */
function probeWith(active: ActiveMcpImplementation): SoftDepStatus {
  return {
    piSubagentsLoaded: true,
    mcpImplementation: active,
    workflowEngineLoaded: true,
  };
}

describe("mcpDependencyMarker", () => {
  for (const { label, dependency, active, expectedMarker } of [
    { label: "both", dependency: BOTH_RUN_EVERY, active: "none", expectedMarker: "requires mcp" },
    {
      label: "adapter only",
      dependency: ADAPTER_MCP,
      active: "none",
      expectedMarker: "requires pi-mcp-adapter",
    },
    {
      label: "builtin only",
      dependency: BUILTIN_MCP,
      active: "none",
      expectedMarker: "requires builtin mcp",
    },
    { label: "split", dependency: SPLIT_MCP, active: "none", expectedMarker: "requires mcp" },
    { label: "both", dependency: BOTH_RUN_EVERY, active: "adapter", expectedMarker: undefined },
    { label: "both", dependency: BOTH_RUN_EVERY, active: "builtin", expectedMarker: undefined },
    {
      label: "adapter only",
      dependency: ADAPTER_MCP,
      active: "builtin",
      expectedMarker: "requires pi-mcp-adapter",
    },
    {
      label: "adapter only",
      dependency: ADAPTER_MCP,
      active: "adapter",
      expectedMarker: undefined,
    },
    {
      label: "builtin only",
      dependency: BUILTIN_MCP,
      active: "adapter",
      expectedMarker: "requires builtin mcp",
    },
    {
      label: "builtin only",
      dependency: BUILTIN_MCP,
      active: "builtin",
      expectedMarker: undefined,
    },
    {
      label: "split",
      dependency: SPLIT_MCP,
      active: "adapter",
      expectedMarker: "requires builtin mcp",
    },
    {
      label: "split",
      dependency: SPLIT_MCP,
      active: "builtin",
      expectedMarker: "requires pi-mcp-adapter",
    },
    { label: "no", dependency: false, active: "none", expectedMarker: undefined },
    { label: "no", dependency: false, active: "adapter", expectedMarker: undefined },
    { label: "no", dependency: false, active: "builtin", expectedMarker: undefined },
  ] as const) {
    test(`D-MB-07: ${label} MCP dependency under ${active} gives ${expectedMarker ?? "no marker"}`, () => {
      // arrange
      const probe = probeWith(active);

      // act
      const marker = mcpDependencyMarker(dependency, probe);

      // assert
      assert.strictEqual(marker, expectedMarker);
    });
  }
});

for (const { active, dependency, expectedMarkers } of [
  {
    active: "none",
    dependency: BOTH_RUN_EVERY,
    expectedMarkers: ["requires pi-subagents", "requires mcp", "requires pi-dynamic-workflows"],
  },
  {
    active: "adapter",
    dependency: BUILTIN_MCP,
    expectedMarkers: [
      "requires pi-subagents",
      "requires builtin mcp",
      "requires pi-dynamic-workflows",
    ],
  },
  {
    active: "builtin",
    dependency: ADAPTER_MCP,
    expectedMarkers: [
      "requires pi-subagents",
      "requires pi-mcp-adapter",
      "requires pi-dynamic-workflows",
    ],
  },
  {
    active: "builtin",
    dependency: BOTH_RUN_EVERY,
    expectedMarkers: ["requires pi-subagents", "requires pi-dynamic-workflows"],
  },
] as const) {
  test(`D-MB-07: puts the MCP marker between agents and workflows under ${active} for runEvery [${dependency.runEvery.join(", ")}]`, () => {
    // arrange
    const probe: SoftDepStatus = {
      piSubagentsLoaded: false,
      mcpImplementation: active,
      workflowEngineLoaded: false,
    };

    // act
    const markers = softDepMarkers(true, dependency, true, probe);

    // assert
    assert.deepStrictEqual(markers, [...expectedMarkers]);
  });
}
