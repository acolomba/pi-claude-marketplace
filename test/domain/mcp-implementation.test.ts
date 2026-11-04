import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { classifyBuiltinMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts";
import { profileFor } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import { classifyMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

import type { McpImplementationId } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

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
