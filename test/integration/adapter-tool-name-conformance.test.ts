// test/integration/adapter-tool-name-conformance.test.ts
//
// PG-MCP-02, D-PG1-09: compare this extension's adapter tool names with
// pi-mcp-adapter's own formatToolName, including length and encoding edges.
//
// pi-mcp-adapter is an optional peer. The test loads formatToolName from the
// compiled dist/types.js of the version the suites run. A missing or wrong-
// version package fails the test. Each run reports the proven version.

import assert from "node:assert/strict";
import test from "node:test";

import { profileFor } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

import { findPiMcpAdapterPackage, loadPiMcpAdapterModule } from "./pi-mcp-adapter-peer.ts";

import type { PiMcpAdapterTypes } from "./pi-mcp-adapter-peer.ts";

interface ToolNameCase {
  readonly words: string;
  readonly plugin: string;
  readonly server: string;
  readonly serverKey: string;
  readonly tool: string;
}

const TOOL_NAME_CASES: readonly ToolNameCase[] = [
  {
    words: "a joined name of 64 characters",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "x".repeat(41),
  },
  {
    words: "a joined name of 65 characters",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "x".repeat(42),
  },
  {
    words: "the 84-character screenshot tool",
    plugin: "chrome-devtools-mcp",
    server: "chrome-devtools",
    serverKey: "plugin_chrome-devtools-mcp_chrome-devtools_",
    tool: "take_screenshot_of_the_current_page",
  },
  {
    words: "a tool with dots before cutting it",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "get.the.thing.with.dots.and.a.very.long.tool.name.indeed",
  },
  {
    words: "a name cut inside its server segment",
    plugin: "demo",
    server: "a-server-whose-name-runs-well-past-the-limit",
    serverKey: "plugin_demo_a-server-whose-name-runs-well-past-the-limit_",
    tool: "echo",
  },
  {
    words: "an empty tool name as the bare prefix",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "",
  },
  {
    words: "a one-character tool name",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "x",
  },
  {
    words: "a tool name that already carries its prefix",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: "mcp__plugin_demo_stub__echo",
  },
  {
    words: "a non-ASCII tool name before the limit",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: `caf\u00e9_${"y".repeat(37)}`,
  },
  {
    words: "65 UTF-16 units that are 64 code points",
    plugin: "demo",
    server: "stub",
    serverKey: "plugin_demo_stub_",
    tool: `${"y".repeat(40)}\u{1F600}`,
  },
];

for (const { words, plugin, server, serverKey, tool } of TOOL_NAME_CASES) {
  test(`D-PG1-09: names ${words} as pi-mcp-adapter's formatToolName does`, async (t) => {
    // arrange
    const peer = await findPiMcpAdapterPackage();
    t.diagnostic(`pi-mcp-adapter ${peer.version} at ${peer.root}`);
    const adapter = await loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");

    // act
    const actual = profileFor("adapter").toolName(plugin, server, tool);
    const expected = adapter.formatToolName(tool, serverKey, "mcp");

    // assert
    assert.strictEqual(actual, expected);
  });
}

test("D-PG1-09: the installed adapter cuts the screenshot tool to the pinned name", async (t) => {
  // arrange
  const peer = await findPiMcpAdapterPackage();
  t.diagnostic(`pi-mcp-adapter ${peer.version} at ${peer.root}`);
  const adapter = await loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");

  // act
  const name = adapter.formatToolName(
    "take_screenshot_of_the_current_page",
    "plugin_chrome-devtools-mcp_chrome-devtools_",
    "mcp",
  );

  // assert
  assert.strictEqual(name, "mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_s_d9a1c2f1");
});
