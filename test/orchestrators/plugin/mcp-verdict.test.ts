import assert from "node:assert/strict";
import test from "node:test";

import {
  degradeBaselineOf,
  mcpDependencyOf,
  newlyDroppedKinds,
  recordMcpDependency,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts";

import type {
  ActiveMcpImplementation,
  RecordedMcpServers,
} from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { McpDependency } from "../../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

const STDIO = { command: "node" };
const EVENTS = { type: "sse", url: "https://mcp.example.com/sse" };
const ASKER = { command: "node", bareElicitationCapability: true };
const LIVE = { type: "ws", url: "wss://mcp.example.com/ws" };

interface DependencyRow {
  readonly title: string;
  readonly configs: readonly unknown[];
  readonly expectedDependency: McpDependency | false;
}

const DEPENDENCY_ROWS: readonly DependencyRow[] = [
  {
    title: "D-P3-06: both implementations run a stdio server",
    configs: [STDIO],
    expectedDependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "D-P3-06: only the adapter runs an sse server",
    configs: [EVENTS],
    expectedDependency: { kind: "mcp", runEvery: ["adapter"] },
  },
  {
    title: "D-P3-06: only Pi's built-in MCP runs a bare-elicitation server",
    configs: [ASKER],
    expectedDependency: { kind: "mcp", runEvery: ["builtin"] },
  },
  {
    title: "D-P3-06: a ws server that both implementations block gives no dependency",
    configs: [LIVE],
    expectedDependency: false,
  },
  {
    title: "D-P3-06: no server gives no dependency",
    configs: [],
    expectedDependency: false,
  },
  {
    title: "D-P3-06: servers split between the implementations leave runEvery empty",
    configs: [EVENTS, ASKER],
    expectedDependency: { kind: "mcp", runEvery: [] },
  },
  {
    title: "D-P3-06: a server both implementations block is left out of R",
    configs: [STDIO, LIVE],
    expectedDependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "D-P3-06: runEvery keeps only the implementations that run every server",
    configs: [EVENTS, STDIO],
    expectedDependency: { kind: "mcp", runEvery: ["adapter"] },
  },
];

for (const { title, configs, expectedDependency } of DEPENDENCY_ROWS) {
  test(title, () => {
    // act
    const dependency = mcpDependencyOf(configs);

    // assert
    assert.deepStrictEqual(dependency, expectedDependency);
  });
}

function recordStaging(mcpServers: readonly string[]): Pick<PluginInstallRecord, "resources"> {
  return {
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: [...mcpServers],
      hooks: [],
      workflows: [],
    },
  };
}

interface RecordRow {
  readonly title: string;
  readonly recorded: RecordedMcpServers;
  readonly staged: readonly string[];
  readonly expectedDependency: McpDependency | false;
}

const RECORD_ROWS: readonly RecordRow[] = [
  {
    title: "D-P3-10: a recorded read gives the dependency of its configs",
    recorded: { kind: "recorded", servers: [{ name: "asker", config: ASKER }], bundle: false },
    staged: [],
    expectedDependency: { kind: "mcp", runEvery: ["builtin"] },
  },
  {
    title: "D-P3-10: a re-resolved read gives the dependency of its configs",
    recorded: { kind: "re-resolved", servers: [{ name: "tool", config: STDIO }], bundle: false },
    staged: ["tool"],
    expectedDependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "P3-DC-24: an unreadable read of a record that staged a server keeps the adapter",
    recorded: { kind: "unreadable", reason: "read-failed" },
    staged: ["events"],
    expectedDependency: { kind: "mcp", runEvery: ["adapter"] },
  },
  {
    title: "P3-DC-24: an unreadable read of a record that staged no server gives no dependency",
    recorded: { kind: "unreadable", reason: "uncontained" },
    staged: [],
    expectedDependency: false,
  },
];

for (const { title, recorded, staged, expectedDependency } of RECORD_ROWS) {
  test(title, () => {
    // act
    const dependency = recordMcpDependency(recorded, recordStaging(staged));

    // assert
    assert.deepStrictEqual(dependency, expectedDependency);
  });
}

interface BaselineRow {
  readonly kind: RecordedMcpServers["kind"];
  readonly basis: string;
  readonly record: Pick<PluginInstallRecord, "compatibilityBasis">;
  readonly active: ActiveMcpImplementation;
  readonly readable: boolean;
}

const NEUTRAL: Pick<PluginInstallRecord, "compatibilityBasis"> = { compatibilityBasis: "neutral" };

const BASELINE_ROWS: readonly BaselineRow[] = [
  { kind: "recorded", basis: "neutral", record: NEUTRAL, active: "builtin", readable: true },
  { kind: "re-resolved", basis: "no", record: {}, active: "builtin", readable: true },
  { kind: "unreadable", basis: "no", record: {}, active: "builtin", readable: false },
  { kind: "unreadable", basis: "no", record: {}, active: "none", readable: false },
  { kind: "unreadable", basis: "neutral", record: NEUTRAL, active: "adapter", readable: false },
  { kind: "unreadable", basis: "no", record: {}, active: "adapter", readable: true },
];

for (const { kind, basis, record, active, readable } of BASELINE_ROWS) {
  test(`D-P3-13: a ${kind} read of a record with ${basis} basis under ${active} gives a ${readable ? "readable" : "unreadable"} baseline`, () => {
    // act
    const baseline = degradeBaselineOf({ unsupported: ["lspServers"] }, { kind }, record, active);

    // assert
    assert.deepStrictEqual(baseline, { unsupported: ["lspServers"], readable });
  });
}

test("D-MB-06: under the adapter, an unreadable legacy record does not excuse an mcpServers drop the neutral resolution does not make", () => {
  // arrange
  const baseline = degradeBaselineOf({ unsupported: [] }, { kind: "unreadable" }, {}, "adapter");

  // act
  const newlyDropped = newlyDroppedKinds(
    { unsupported: ["mcpServers"] },
    { unsupported: [] },
    baseline,
  );

  // assert
  assert.deepStrictEqual(newlyDropped, ["mcpServers"]);
});

interface DropRow {
  readonly title: string;
  readonly view: readonly string[];
  readonly neutral: readonly string[];
  readonly recordDrops: readonly string[];
  readonly readable: boolean;
  readonly dropped: readonly string[];
}

const DROP_ROWS: readonly DropRow[] = [
  {
    title: "D-P3-12: a kind the record already drops is not new",
    view: ["mcpServers", "lspServers"],
    neutral: ["lspServers"],
    recordDrops: ["mcpServers", "lspServers"],
    readable: true,
    dropped: [],
  },
  {
    title:
      "D-P3-13: an mcpServers drop only the active implementation makes is new for a readable record",
    view: ["mcpServers"],
    neutral: [],
    recordDrops: [],
    readable: true,
    dropped: ["mcpServers"],
  },
  {
    title:
      "D-MB-06: an mcpServers drop only the active implementation makes is not new for an unreadable record",
    view: ["mcpServers", "lspServers"],
    neutral: ["lspServers"],
    recordDrops: [],
    readable: false,
    dropped: ["lspServers"],
  },
  {
    title: "D-MB-06: an mcpServers drop every implementation makes is new for an unreadable record",
    view: ["mcpServers"],
    neutral: ["mcpServers"],
    recordDrops: [],
    readable: false,
    dropped: ["mcpServers"],
  },
];

for (const { title, view, neutral, recordDrops, readable, dropped } of DROP_ROWS) {
  test(title, () => {
    // act
    const newlyDropped = newlyDroppedKinds(
      { unsupported: view },
      { unsupported: neutral },
      { unsupported: recordDrops, readable },
    );

    // assert
    assert.deepStrictEqual(newlyDropped, dropped);
  });
}
