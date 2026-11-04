import assert from "node:assert/strict";
import test from "node:test";

import {
  mcpDependencyOf,
  recordMcpDependency,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts";

import type { RecordedMcpServers } from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { McpDependency } from "../../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

const STDIO = { command: "node" };
const EVENTS = { type: "sse", url: "https://mcp.example.com/sse" };
const ASKER = { command: "node", bareElicitationCapability: true };
const LIVE = { type: "ws", url: "wss://mcp.example.com/ws" };

interface DependencyRow {
  readonly title: string;
  readonly configs: readonly unknown[];
  readonly dependency: McpDependency | false;
}

const DEPENDENCY_ROWS: readonly DependencyRow[] = [
  {
    title: "D-P3-06: both implementations run a stdio server",
    configs: [STDIO],
    dependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "D-P3-06: only the adapter runs an sse server",
    configs: [EVENTS],
    dependency: { kind: "mcp", runEvery: ["adapter"] },
  },
  {
    title: "D-P3-06: only Pi's built-in MCP runs a bare-elicitation server",
    configs: [ASKER],
    dependency: { kind: "mcp", runEvery: ["builtin"] },
  },
  {
    title: "D-P3-06: a ws server that both implementations block gives no dependency",
    configs: [LIVE],
    dependency: false,
  },
  {
    title: "D-P3-06: no server gives no dependency",
    configs: [],
    dependency: false,
  },
  {
    title: "D-P3-06: servers split between the implementations leave runEvery empty",
    configs: [EVENTS, ASKER],
    dependency: { kind: "mcp", runEvery: [] },
  },
  {
    title: "D-P3-06: a server both implementations block is left out of R",
    configs: [STDIO, LIVE],
    dependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "D-P3-06: runEvery keeps only the implementations that run every server",
    configs: [EVENTS, STDIO],
    dependency: { kind: "mcp", runEvery: ["adapter"] },
  },
];

for (const { title, configs, dependency } of DEPENDENCY_ROWS) {
  test(title, () => {
    // act
    const actual = mcpDependencyOf(configs);

    // assert
    assert.deepStrictEqual(actual, dependency);
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
  readonly dependency: McpDependency | false;
}

const RECORD_ROWS: readonly RecordRow[] = [
  {
    title: "D-P3-10: a recorded read gives the dependency of its configs",
    recorded: { kind: "recorded", servers: [{ name: "asker", config: ASKER }], bundle: false },
    staged: [],
    dependency: { kind: "mcp", runEvery: ["builtin"] },
  },
  {
    title: "D-P3-10: a re-resolved read gives the dependency of its configs",
    recorded: { kind: "re-resolved", servers: [{ name: "tool", config: STDIO }], bundle: false },
    staged: ["tool"],
    dependency: { kind: "mcp", runEvery: ["adapter", "builtin"] },
  },
  {
    title: "P3-DC-24: an unreadable read of a record that staged a server keeps the adapter",
    recorded: { kind: "unreadable" },
    staged: ["events"],
    dependency: { kind: "mcp", runEvery: ["adapter"] },
  },
  {
    title: "P3-DC-24: an unreadable read of a record that staged no server gives no dependency",
    recorded: { kind: "unreadable" },
    staged: [],
    dependency: false,
  },
];

for (const { title, recorded, staged, dependency } of RECORD_ROWS) {
  test(title, () => {
    // act
    const actual = recordMcpDependency(recorded, recordStaging(staged));

    // assert
    assert.deepStrictEqual(actual, dependency);
  });
}
