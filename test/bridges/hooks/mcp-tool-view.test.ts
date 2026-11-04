import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { createHookToolView } from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts";
import {
  adapterCommand,
  adapterProxyTool,
  builtinMcpCommand,
  builtinMcpTool,
  toolInfo,
} from "../../platform/pi-inventory-seed.ts";

import type { ExtensionAPI } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";

type ToolSource = Pick<ExtensionAPI, "getAllTools" | "getCommands">;

const PI_NAME = "mcp__plugin_hook_demo_stub_server__echo";
const SERVER = "plugin_hook-demo_stub-server";
const LONG_SERVER = "plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server";
const LONG_PI_NAME = "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d";

function hookDemoBuiltinTool(): ToolInfo {
  return {
    ...builtinMcpTool(),
    name: PI_NAME,
    namespace: { name: "mcp__plugin_hook_demo_stub_server", aliases: [SERVER] },
  } satisfies ToolInfo;
}

function hookDemoAdapterTool(): ToolInfo {
  return {
    ...adapterProxyTool(),
    name: "mcp__plugin_hook-demo_stub-server__echo",
    namespace: { name: "mcp__plugin_hook-demo_stub-server" },
  } satisfies ToolInfo;
}

test("reads nothing and keeps the name of a tool that is not an MCP tool", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  const tools = createHookToolView(pi);

  // act
  const tool = tools.identify("bash");

  // assert
  assert.deepStrictEqual(tool, { piName: "bash", name: "bash", builtinServer: undefined });
  verify(pi);
});

test("keeps the name of an MCP tool when there is no Pi API to read", () => {
  // arrange
  const tools = createHookToolView(undefined);

  // act
  const tool = tools.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: PI_NAME, name: PI_NAME, builtinServer: undefined });
});

test("names a built-in MCP tool with its server's registered name after one tool read (D-P5-01, D-P5-02)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenReturn([toolInfo("bash"), hookDemoBuiltinTool()]);
  const tools = createHookToolView(pi);

  // act
  const tool = tools.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, {
    piName: PI_NAME,
    name: "mcp__plugin_hook-demo_stub-server__echo",
    builtinServer: SERVER,
  });
  verify(pi);
});

test("keeps Pi's name and the server of a built-in tool whose name Pi cut inside the namespace (D-P5-02)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenReturn([
    {
      ...builtinMcpTool(),
      name: LONG_PI_NAME,
      namespace: {
        name: "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plugin_stub_server",
        aliases: [LONG_SERVER],
      },
    },
  ]);
  const tools = createHookToolView(pi);

  // act
  const tool = tools.identify(LONG_PI_NAME);

  // assert
  assert.deepStrictEqual(tool, {
    piName: LONG_PI_NAME,
    name: LONG_PI_NAME,
    builtinServer: LONG_SERVER,
  });
  verify(pi);
});

for (const { description, listed } of [
  {
    description: "a pi-mcp-adapter tool, whose namespace has no alias",
    listed: hookDemoAdapterTool(),
  },
  {
    description: "a tool from another source that carries a namespace alias",
    listed: {
      ...toolInfo(PI_NAME),
      namespace: { name: "mcp__plugin_hook_demo_stub_server", aliases: [SERVER] },
    } satisfies ToolInfo,
  },
  {
    description: "a built-in tool with no namespace alias",
    listed: {
      ...hookDemoBuiltinTool(),
      namespace: { name: "mcp__plugin_hook_demo_stub_server" },
    } satisfies ToolInfo,
  },
  {
    description: "a built-in tool with no namespace",
    listed: { ...toolInfo(PI_NAME), sourceInfo: builtinMcpTool().sourceInfo } satisfies ToolInfo,
  },
]) {
  test(`keeps Pi's name of ${description} (D-P5-05)`, () => {
    // arrange
    const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
    when(() => pi.getAllTools()).thenReturn([{ ...listed, name: PI_NAME }]);
    const tools = createHookToolView(pi);

    // act
    const tool = tools.identify(PI_NAME);

    // assert
    assert.deepStrictEqual(tool, { piName: PI_NAME, name: PI_NAME, builtinServer: undefined });
    verify(pi);
  });
}

test("keeps the name of an MCP tool that Pi does not list (D-P5-01)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenReturn([hookDemoBuiltinTool()]);
  const tools = createHookToolView(pi);

  // act
  const tool = tools.identify("mcp__plugin_other_stub__echo");

  // assert
  assert.deepStrictEqual(tool, {
    piName: "mcp__plugin_other_stub__echo",
    name: "mcp__plugin_other_stub__echo",
    builtinServer: undefined,
  });
  verify(pi);
});

test("keeps the name of an MCP tool when the tool read throws (D-P5-01)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenThrow(new Error("no session"));
  const tools = createHookToolView(pi);

  // act
  const tool = tools.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: PI_NAME, name: PI_NAME, builtinServer: undefined });
  verify(pi);
});

test("reads the tool list again for each MCP tool event", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenReturn([hookDemoBuiltinTool()])
    .times(2);
  const tools = createHookToolView(pi);

  // act
  const first = tools.identify(PI_NAME);
  const second = tools.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(
    [first, second],
    [
      { piName: PI_NAME, name: "mcp__plugin_hook-demo_stub-server__echo", builtinServer: SERVER },
      { piName: PI_NAME, name: "mcp__plugin_hook-demo_stub-server__echo", builtinServer: SERVER },
    ],
  );
  verify(pi);
});

for (const { description, commands, applies } of [
  { description: "pi-mcp-adapter is", commands: () => [adapterCommand()], applies: true },
  { description: "Pi's built-in MCP is", commands: () => [builtinMcpCommand()], applies: false },
  { description: "no MCP implementation is", commands: () => [], applies: false },
]) {
  test(`${applies ? "applies" : "does not apply"} the proxy rule when ${description} the active implementation, after one snapshot (D-P5-06)`, () => {
    // arrange
    const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(3);
    when(() => pi.getCommands()).thenReturn(commands());
    const tools = createHookToolView(pi);

    // act
    const answer = tools.proxyRuleApplies();

    // assert
    assert.strictEqual(answer, applies);
    verify(pi);
  });
}

test("does not apply the proxy rule when there is no Pi API to read (D-P5-06)", () => {
  // arrange
  const tools = createHookToolView(undefined);

  // act
  const answer = tools.proxyRuleApplies();

  // assert
  assert.strictEqual(answer, false);
});

test("keeps the first answer of the proxy rule for the view's generation (D-P5-07)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(3);
  when(() => pi.getCommands()).thenReturn([adapterCommand()]);
  const tools = createHookToolView(pi);

  // act
  const answers = [tools.proxyRuleApplies(), tools.proxyRuleApplies()];

  // assert
  assert.deepStrictEqual(answers, [true, true]);
  verify(pi);
});
