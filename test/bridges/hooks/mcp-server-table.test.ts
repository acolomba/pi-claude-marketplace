import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  findMcpServer,
  mcpServerEntries,
  type McpServerEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts";

import type { McpToolIdentity } from "../../../extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type StoredPlugin = ExtensionState["marketplaces"][string]["plugins"][string];

function storedPlugin(servers: readonly string[] | undefined, enabled = true): StoredPlugin {
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/demo",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled,
    provenance: "explicit",
    installedAt: "2026-11-14T10:00:00.000Z",
    updatedAt: "2026-11-14T10:00:00.000Z",
    ...(servers === undefined
      ? {}
      : { mcpServerConfigs: servers.map((name) => ({ name, config: { command: "stub" } })) }),
  };
}

function scopeState(
  scope: "user" | "project",
  plugins: Record<string, StoredPlugin>,
): ExtensionState["marketplaces"][string] {
  return {
    name: `${scope}-catalog`,
    scope,
    source: { kind: "path", raw: "/catalog", logical: "/catalog" },
    addedFromCwd: "/workspace",
    manifestPath: "/catalog/.claude-plugin/marketplace.json",
    marketplaceRoot: "/catalog",
    plugins,
  };
}

function stateOf(...marketplaces: ExtensionState["marketplaces"][string][]): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(
      marketplaces.map((marketplace) => [marketplace.name, marketplace]),
    ),
  };
}

function demoStubEntry(): McpServerEntry {
  return {
    builtinServer: "plugin_demo_stub",
    adapterKey: "plugin_demo_stub_",
    server: { name: "plugin:demo:stub", source: "plugin" },
  };
}

function adapterTool(piName: string, claudeName?: string): McpToolIdentity {
  return { piName, builtinServer: undefined, ...(claudeName === undefined ? {} : { claudeName }) };
}

describe("mcpServerEntries", () => {
  test("names each server of an enabled record under both keys (D-PG6-07)", () => {
    // arrange
    const state = stateOf(scopeState("user", { demo: storedPlugin(["stub"]) }));

    // act
    const entries = mcpServerEntries(state, "user");

    // assert
    assert.deepStrictEqual(entries, [demoStubEntry()]);
  });

  test("keeps a `-` and a `.` of the server name in the name it sends", () => {
    // arrange
    const state = stateOf(scopeState("user", { demo: storedPlugin(["stub-server.v1"]) }));

    // act
    const entries = mcpServerEntries(state, "user");

    // assert
    assert.deepStrictEqual(entries, [
      {
        builtinServer: "plugin_demo_stub-server_v1",
        adapterKey: "plugin_demo_stub-server_v1_",
        server: { name: "plugin:demo:stub-server.v1", source: "plugin" },
      },
    ]);
  });

  for (const { name, plugins } of [
    { name: "a disabled record", plugins: { demo: storedPlugin(["stub"], false) } },
    {
      name: "a record written before mcpServerConfigs",
      plugins: { demo: storedPlugin(undefined) },
    },
    { name: "a record that declares no server", plugins: { demo: storedPlugin([]) } },
    { name: "a plugin name the key builders refuse", plugins: { "de/mo": storedPlugin(["stub"]) } },
  ]) {
    test(`gives no entry for ${name}`, () => {
      // arrange
      const state = stateOf(scopeState("user", plugins));

      // act
      const entries = mcpServerEntries(state, "user");

      // assert
      assert.deepStrictEqual(entries, []);
    });
  }

  test("gives no entry for a record of the other scope", () => {
    // arrange
    const state = stateOf(scopeState("project", { demo: storedPlugin(["stub"]) }));

    // act
    const entries = mcpServerEntries(state, "user");

    // assert
    assert.deepStrictEqual(entries, []);
  });
});

describe("findMcpServer", () => {
  test("finds the server of a tool of Pi's built-in MCP by its registered name", () => {
    // arrange
    const tool = { piName: "mcp__plugin_demo_stub__echo", builtinServer: "plugin_demo_stub" };

    // act
    const server = findMcpServer([demoStubEntry()], tool);

    // assert
    assert.deepStrictEqual(server, { name: "plugin:demo:stub", source: "plugin" });
  });

  test("finds nothing for a built-in server no entry has, such as one of Pi's mcp.json", () => {
    // arrange
    const tool = { piName: "mcp__plugin_demo_stub__echo", builtinServer: "stub" };

    // act
    const server = findMcpServer([demoStubEntry()], tool);

    // assert
    assert.strictEqual(server, undefined);
  });

  test("finds the server of a pi-mcp-adapter tool by its key prefix", () => {
    // act
    const server = findMcpServer([demoStubEntry()], adapterTool("mcp__plugin_demo_stub__echo"));

    // assert
    assert.deepStrictEqual(server, { name: "plugin:demo:stub", source: "plugin" });
  });

  test("reads a recovered full name in place of a cut adapter name (D-PG1-08)", () => {
    // arrange
    const piName = "mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plug_aa6b8bc3";
    const claudeName =
      "mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo";
    const entry = {
      builtinServer: "plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server",
      adapterKey: "plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server_",
      server: {
        name: "plugin:hook-proxy-shaped-tool-names-of-a-long-plugin:stub-server",
        source: "plugin",
      },
    } satisfies McpServerEntry;

    // act
    const servers = [
      findMcpServer([entry], adapterTool(piName, claudeName)),
      findMcpServer([entry], adapterTool(piName)),
    ];

    // assert
    assert.deepStrictEqual(servers, [entry.server, undefined]);
  });

  for (const piName of [
    "mcp__other__echo",
    "mcp__plugin_demo_stub_x__echo",
    "mcp__plugin_demo_stub",
    "bash",
  ]) {
    test(`finds nothing for the tool ${piName}`, () => {
      // act
      const server = findMcpServer([demoStubEntry()], adapterTool(piName));

      // assert
      assert.strictEqual(server, undefined);
    });
  }

  test("finds nothing when two different servers claim the tool's key", () => {
    // arrange
    const other = {
      ...demoStubEntry(),
      server: { name: "plugin:demo:stub.", source: "plugin" },
    } satisfies McpServerEntry;

    // act
    const servers = [
      findMcpServer([demoStubEntry(), other], adapterTool("mcp__plugin_demo_stub__echo")),
      findMcpServer([demoStubEntry(), other], {
        piName: "mcp__plugin_demo_stub__echo",
        builtinServer: "plugin_demo_stub",
      }),
    ];

    // assert
    assert.deepStrictEqual(servers, [undefined, undefined]);
  });

  test("finds the server that one plugin declares in both scopes", () => {
    // act
    const server = findMcpServer(
      [demoStubEntry(), demoStubEntry()],
      adapterTool("mcp__plugin_demo_stub__echo"),
    );

    // assert
    assert.deepStrictEqual(server, { name: "plugin:demo:stub", source: "plugin" });
  });
});
