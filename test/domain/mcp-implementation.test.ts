import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { classifyBuiltinMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts";
import {
  effectiveMcpCompatibility,
  profileFor,
} from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import { classifyMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

import type {
  ActiveMcpImplementation,
  EffectiveMcpCompatibility,
  McpImplementationId,
  RecordedMcpServer,
  RecordedMcpServers,
  StoredMcpCompatibility,
} from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

interface NamingRow {
  readonly id: McpImplementationId;
  readonly serverName: string;
  readonly toolNamePrefix: string;
  readonly toolName: string;
  readonly grantSelector: string;
}

// Every row names server "api.v1" of plugin "my-plugin" and tool "get-item".
const NAMING_ROWS: readonly NamingRow[] = [
  {
    id: "adapter",
    serverName: "plugin_my-plugin_api_v1_",
    toolNamePrefix: "mcp__plugin_my-plugin_api_v1__",
    toolName: "mcp__plugin_my-plugin_api_v1__get-item",
    grantSelector: "mcp:plugin_my-plugin_api_v1_",
  },
  {
    id: "builtin",
    serverName: "plugin_my-plugin_api_v1",
    toolNamePrefix: "mcp__plugin_my_plugin_api_v1__",
    toolName: "mcp__plugin_my_plugin_api_v1__get_item",
    grantSelector: "mcp:plugin_my-plugin_api_v1",
  },
];

interface AdapterToolNameRow {
  readonly title: string;
  readonly tool: string;
  readonly toolName: string;
}

// pi-mcp-adapter 7.0.0 `formatToolName` with `toolPrefix: "mcp"`, for server "stub" of plugin "demo".
const ADAPTER_TOOL_NAME_ROWS: readonly AdapterToolNameRow[] = [
  {
    title: "ANAME-01: the adapter profile turns each dot in a tool name into an underscore",
    tool: "files.read.all",
    toolName: "mcp__plugin_demo_stub__files_read_all",
  },
  {
    title:
      "ANAME-01: the adapter profile does not prefix a tool name that already carries the prefix",
    tool: "mcp__plugin_demo_stub__echo",
    toolName: "mcp__plugin_demo_stub__echo",
  },
  {
    title: "ANAME-01: the adapter profile prefixes a tool name equal to the bare prefix",
    tool: "mcp__plugin_demo_stub__",
    toolName: "mcp__plugin_demo_stub__mcp__plugin_demo_stub__",
  },
];

interface BuiltinToolNameRow {
  readonly title: string;
  readonly plugin: string;
  readonly server: string;
  readonly tool: string;
  readonly toolName: string;
}

// Expected names were computed once with Pi 1.5.0's `createMcpToolName`.
const BUILTIN_TOOL_NAME_ROWS: readonly BuiltinToolNameRow[] = [
  {
    title: "D-MB-13: keeps a short built-in tool name whole",
    plugin: "demo",
    server: "stub",
    tool: "echo",
    toolName: "mcp__plugin_demo_stub__echo",
  },
  {
    title: "D-MB-13: keeps a built-in tool name of exactly 64 characters whole",
    plugin: "demo",
    server: "stub",
    tool: "a".repeat(41),
    toolName: `mcp__plugin_demo_stub__${"a".repeat(41)}`,
  },
  {
    title: "D-MB-13: cuts a 65-character built-in tool name to 55 characters, _, and 8 hex",
    plugin: "demo",
    server: "stub",
    tool: "a".repeat(42),
    toolName: `mcp__plugin_demo_stub__${"a".repeat(32)}_719baffe`,
  },
  {
    title: "D-MB-13: folds - in the server segment and the tool of a built-in tool name",
    plugin: "my-plugin",
    server: "api-v2",
    tool: "list-items",
    toolName: "mcp__plugin_my_plugin_api_v2__list_items",
  },
  {
    title: "D-MB-13: hashes the registered server name with - kept when it cuts a long name",
    plugin: "my-plugin",
    server: "api-v2",
    tool: `fetch-${"b".repeat(40)}`,
    toolName: `mcp__plugin_my_plugin_api_v2__fetch_${"b".repeat(19)}_3c0ec9f2`,
  },
  {
    title: "D-MB-13: replaces each UTF-16 code unit outside [A-Za-z0-9_] in a tool name",
    plugin: "demo",
    server: "stub",
    tool: "café-\u{1F600}",
    toolName: "mcp__plugin_demo_stub__caf____",
  },
];

interface LongNameRow {
  readonly title: string;
  readonly id: McpImplementationId;
  readonly server: string;
  readonly toolNamePrefix: string | undefined;
  readonly toolName: string;
}

// Every row names tool "search_pages" of plugin "atlassian-confluence-tools".
// The built-in names were computed once with Pi 1.5.0's `createMcpToolName`.
const LONG_NAME_ROWS: readonly LongNameRow[] = [
  {
    title:
      "D-MB-13: the built-in profile promises a 55-character namespace that a cut tool name keeps",
    id: "builtin",
    server: "confluence-api",
    toolNamePrefix: "mcp__plugin_atlassian_confluence_tools_confluence_api__",
    toolName: "mcp__plugin_atlassian_confluence_tools_confluence_api___aa54f171",
  },
  {
    title:
      "D-MB-13: the built-in profile promises no prefix for a namespace that a cut tool name loses",
    id: "builtin",
    server: "confluence-cloud",
    toolNamePrefix: undefined,
    toolName: "mcp__plugin_atlassian_confluence_tools_confluence_cloud_0e6bb645",
  },
  {
    title: "ANAME-01: the adapter profile keeps the prefix of a long server name",
    id: "adapter",
    server: "confluence-cloud",
    toolNamePrefix: "mcp__plugin_atlassian-confluence-tools_confluence-cloud__",
    toolName: "mcp__plugin_atlassian-confluence-tools_confluence-cloud__search_pages",
  },
];

describe("profileFor", () => {
  for (const id of ["adapter", "builtin"] as const) {
    test(`MSEL-01: returns the same frozen ${id} profile on every call`, () => {
      // arrange
      const implementation = id;

      // act
      const profile = profileFor(implementation);

      // assert
      assert.strictEqual(profile, profileFor(implementation));
      assert.strictEqual(profile.id, implementation);
      assert.strictEqual(Object.isFrozen(profile), true);
    });
  }

  test("MSEL-01: the adapter profile classifies with the adapter verdict table", () => {
    // arrange
    const expectedClassify = classifyMcpServer;

    // act
    const profile = profileFor("adapter");

    // assert
    assert.strictEqual(profile.classify, expectedClassify);
  });

  test("MSEL-01: the built-in profile classifies with the built-in verdict table", () => {
    // arrange
    const expectedClassify = classifyBuiltinMcpServer;

    // act
    const profile = profileFor("builtin");

    // assert
    assert.strictEqual(profile.classify, expectedClassify);
  });

  for (const row of NAMING_ROWS) {
    test(`ANAME-01 / D-MB-13: the ${row.id} profile names a server, its tools, and its grant`, () => {
      // arrange
      const { id, ...expectedNames } = row;
      const profile = profileFor(id);

      // act
      const names = {
        serverName: profile.serverName("my-plugin", "api.v1"),
        toolNamePrefix: profile.toolNamePrefix("my-plugin", "api.v1"),
        toolName: profile.toolName("my-plugin", "api.v1", "get-item"),
        grantSelector: profile.grantSelector("my-plugin", "api.v1"),
      };

      // assert
      assert.deepStrictEqual(names, expectedNames);
    });
  }

  for (const { title, id, server, ...expectedNames } of LONG_NAME_ROWS) {
    test(title, () => {
      // arrange
      const profile = profileFor(id);

      // act
      const names = {
        toolNamePrefix: profile.toolNamePrefix("atlassian-confluence-tools", server),
        toolName: profile.toolName("atlassian-confluence-tools", server, "search_pages"),
      };

      // assert
      assert.deepStrictEqual(names, expectedNames);
    });
  }

  for (const { title, tool, toolName } of ADAPTER_TOOL_NAME_ROWS) {
    test(title, () => {
      // arrange
      const profile = profileFor("adapter");

      // act
      const adapterToolName = profile.toolName("demo", "stub", tool);

      // assert
      assert.strictEqual(adapterToolName, toolName);
    });
  }

  for (const { title, plugin, server, tool, toolName } of BUILTIN_TOOL_NAME_ROWS) {
    test(title, () => {
      // arrange
      const profile = profileFor("builtin");

      // act
      const builtinToolName = profile.toolName(plugin, server, tool);

      // assert
      assert.strictEqual(builtinToolName, toolName);
    });
  }
});

const IMPLEMENTATIONS = [
  "adapter",
  "builtin",
  "none",
] as const satisfies readonly ActiveMcpImplementation[];

// The adapter blocks `ws` and `bareElicitationCapability`; the built-in MCP
// blocks `ws` and `sse`.
function stdioServer(): RecordedMcpServer {
  return { name: "local", config: { command: "node" } };
}

function sseServer(): RecordedMcpServer {
  return { name: "events", config: { type: "sse", url: "https://mcp.example.com/sse" } };
}

function wsServer(): RecordedMcpServer {
  return { name: "socket", config: { type: "ws", url: "wss://mcp.example.com/ws" } };
}

function elicitingServer(): RecordedMcpServer {
  return { name: "asker", config: { command: "node", bareElicitationCapability: true } };
}

function malformedServer(): RecordedMcpServer {
  return { name: "broken", config: { command: "" } };
}

function storedVerdict(
  installable: boolean,
  unsupported: readonly string[],
  options: { readonly notes?: readonly string[]; readonly neutral?: true } = {},
): StoredMcpCompatibility {
  const compatibility = { installable, notes: options.notes ?? [], unsupported };
  return options.neutral === true
    ? { compatibility, compatibilityBasis: "neutral" }
    : { compatibility };
}

function recordedServers(
  servers: readonly RecordedMcpServer[],
  bundle = false,
): RecordedMcpServers {
  return { kind: "recorded", servers, bundle };
}

function reResolvedServers(
  servers: readonly RecordedMcpServer[],
  bundle = false,
): RecordedMcpServers {
  return { kind: "re-resolved", servers, bundle };
}

interface EffectiveRow {
  readonly title: string;
  readonly stored: StoredMcpCompatibility;
  readonly recorded: RecordedMcpServers;
  readonly active: ActiveMcpImplementation;
  readonly effective: EffectiveMcpCompatibility;
}

const EFFECTIVE_ROWS: readonly EffectiveRow[] = [
  ...IMPLEMENTATIONS.map((active): EffectiveRow => ({
    title: `MREC-01: unreadable recorded servers keep the stored verdict under ${active}`,
    stored: storedVerdict(false, ["hooks", "mcpServers"], { neutral: true }),
    recorded: { kind: "unreadable" },
    active,
    effective: { installable: false, unsupported: ["hooks", "mcpServers"], blocked: [] },
  })),
  ...IMPLEMENTATIONS.map((active): EffectiveRow => ({
    title: `MREC-01: a malformed recorded config keeps the stored verdict under ${active}`,
    stored: storedVerdict(true, ["skills"]),
    recorded: recordedServers([wsServer(), malformedServer()]),
    active,
    effective: { installable: true, unsupported: ["skills"], blocked: [] },
  })),
  {
    title:
      "MSEL-01: the adapter keeps a legacy stored verdict and lists adapter-blocked servers in recorded order",
    stored: storedVerdict(true, []),
    recorded: recordedServers([wsServer(), stdioServer(), elicitingServer(), sseServer()]),
    active: "adapter",
    effective: {
      installable: true,
      unsupported: [],
      blocked: [
        { server: "socket", feature: "ws" },
        { server: "asker", feature: "bareElicitationCapability" },
      ],
    },
  },
  {
    title:
      "MSEL-01: the built-in MCP blocks an sse server of a legacy installable record and appends mcpServers",
    stored: storedVerdict(true, ["hooks"]),
    recorded: recordedServers([stdioServer(), sseServer()]),
    active: "builtin",
    effective: {
      installable: false,
      unsupported: ["hooks", "mcpServers"],
      blocked: [{ server: "events", feature: "sse" }],
    },
  },
  {
    title:
      "MSEL-01: the built-in MCP makes a legacy record installable that only bareElicitationCapability held back",
    stored: storedVerdict(false, ["mcpServers"]),
    recorded: recordedServers([elicitingServer(), stdioServer()]),
    active: "builtin",
    effective: { installable: true, unsupported: [], blocked: [] },
  },
  {
    title: "MSEL-01: a stored false with a non-MCP unsupported kind stays false",
    stored: storedVerdict(false, ["mcpServers", "hooks"]),
    recorded: recordedServers([elicitingServer()]),
    active: "builtin",
    effective: { installable: false, unsupported: ["hooks"], blocked: [] },
  },
  {
    title: "MSEL-01: a stored false with the update-in-progress note stays false",
    stored: storedVerdict(false, ["mcpServers"], { notes: ["update-in-progress"] }),
    recorded: recordedServers([elicitingServer()]),
    active: "builtin",
    effective: { installable: false, unsupported: [], blocked: [] },
  },
  {
    title: "MSEL-01: a stored false with no unsupported kind stays false",
    stored: storedVerdict(false, []),
    recorded: recordedServers([stdioServer()]),
    active: "builtin",
    effective: { installable: false, unsupported: [], blocked: [] },
  },
  ...IMPLEMENTATIONS.map((active): EffectiveRow => ({
    title: `MSEL-01: a bundle keeps mcpServers and installable false under ${active}`,
    stored: storedVerdict(false, ["mcpServers"]),
    recorded: reResolvedServers([stdioServer()], true),
    active,
    effective: { installable: false, unsupported: ["mcpServers"], blocked: [] },
  })),
  {
    title: "MSEL-01: a bundle blocks an installable neutral record under the built-in MCP",
    stored: storedVerdict(true, [], { neutral: true }),
    recorded: recordedServers([stdioServer()], true),
    active: "builtin",
    effective: { installable: false, unsupported: ["mcpServers"], blocked: [] },
  },
  ...IMPLEMENTATIONS.map((active): EffectiveRow => ({
    title: `MSEL-01: a neutral basis with mcpServers stored keeps the block under ${active}`,
    stored: storedVerdict(false, ["mcpServers"], { neutral: true }),
    recorded: recordedServers([stdioServer()]),
    active,
    effective: { installable: false, unsupported: ["mcpServers"], blocked: [] },
  })),
  {
    title: "MSEL-01: a neutral record under the adapter is recomputed with the adapter profile",
    stored: storedVerdict(true, [], { neutral: true }),
    recorded: recordedServers([sseServer(), elicitingServer()]),
    active: "adapter",
    effective: {
      installable: false,
      unsupported: ["mcpServers"],
      blocked: [{ server: "asker", feature: "bareElicitationCapability" }],
    },
  },
  {
    title:
      "MSEL-01: with no implementation only a server both profiles block is blocked, with the adapter feature",
    stored: storedVerdict(true, []),
    recorded: recordedServers([sseServer(), wsServer(), elicitingServer()]),
    active: "none",
    effective: {
      installable: false,
      unsupported: ["mcpServers"],
      blocked: [{ server: "socket", feature: "ws" }],
    },
  },
  {
    title: "MSEL-01: with no implementation an sse and a bareElicitationCapability server run",
    stored: storedVerdict(false, ["mcpServers"]),
    recorded: recordedServers([sseServer(), elicitingServer()]),
    active: "none",
    effective: { installable: true, unsupported: [], blocked: [] },
  },
  {
    title: "MSEL-01: mcpServers keeps its stored position among the unsupported kinds",
    stored: storedVerdict(false, ["skills", "mcpServers", "hooks"]),
    recorded: reResolvedServers([sseServer()]),
    active: "builtin",
    effective: {
      installable: false,
      unsupported: ["skills", "mcpServers", "hooks"],
      blocked: [{ server: "events", feature: "sse" }],
    },
  },
  {
    title: "MSEL-01: removing mcpServers keeps the stored order of the other kinds",
    stored: storedVerdict(false, ["skills", "mcpServers", "hooks"]),
    recorded: reResolvedServers([elicitingServer()]),
    active: "builtin",
    effective: { installable: false, unsupported: ["skills", "hooks"], blocked: [] },
  },
];

interface LegacyRow {
  readonly title: string;
  readonly stored: StoredMcpCompatibility;
  readonly recorded: RecordedMcpServers;
  readonly blocked: EffectiveMcpCompatibility["blocked"];
}

// Records as the adapter verdict wrote them: a blocked server or a bundle puts
// mcpServers in unsupported, and a partial install is not installable.
const LEGACY_ROWS: readonly LegacyRow[] = [
  {
    title: "a plugin with no server",
    stored: storedVerdict(true, []),
    recorded: recordedServers([]),
    blocked: [],
  },
  {
    title: "a plugin whose servers the adapter runs",
    stored: storedVerdict(true, []),
    recorded: recordedServers([stdioServer(), sseServer()]),
    blocked: [],
  },
  {
    title: "a partial install with a ws server",
    stored: storedVerdict(false, ["mcpServers"]),
    recorded: recordedServers([wsServer(), stdioServer()]),
    blocked: [{ server: "socket", feature: "ws" }],
  },
  {
    title: "a partial install with a dropped hook and a bareElicitationCapability server",
    stored: storedVerdict(false, ["hooks", "mcpServers"]),
    recorded: reResolvedServers([elicitingServer()]),
    blocked: [{ server: "asker", feature: "bareElicitationCapability" }],
  },
  {
    title: "a partial install with a bundle",
    stored: storedVerdict(false, ["mcpServers"]),
    recorded: reResolvedServers([], true),
    blocked: [],
  },
  {
    title: "a record held by the update intent mark",
    stored: storedVerdict(false, [], { notes: ["update-in-progress"] }),
    recorded: recordedServers([stdioServer()]),
    blocked: [],
  },
];

describe("effectiveMcpCompatibility", () => {
  for (const { title, stored, recorded, active, effective } of EFFECTIVE_ROWS) {
    test(title, () => {
      // arrange
      const expectedEffective = effective;

      // act
      const computed = effectiveMcpCompatibility(stored, recorded, active);

      // assert
      assert.deepStrictEqual(computed, expectedEffective);
    });
  }

  for (const { title, stored, recorded, blocked } of LEGACY_ROWS) {
    test(`MSEL-01: under the adapter the effective verdict of ${title} equals its stored verdict`, () => {
      // arrange
      const expectedEffective: EffectiveMcpCompatibility = {
        installable: stored.compatibility.installable,
        unsupported: stored.compatibility.unsupported,
        blocked,
      };

      // act
      const computed = effectiveMcpCompatibility(stored, recorded, "adapter");

      // assert
      assert.deepStrictEqual(computed, expectedEffective);
    });
  }
});
