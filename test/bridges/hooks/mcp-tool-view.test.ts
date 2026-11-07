import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { createHookToolView } from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
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
const READ_FAILURE_LINE =
  "[mcp] mcp-tool-view: a read of Pi's tools or commands failed (logged once per bridge load): no session";

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
  const hookToolView = createHookToolView(pi);

  // act
  const tool = hookToolView.identify("bash");

  // assert
  assert.deepStrictEqual(tool, { piName: "bash", builtinServer: undefined });
  verify(pi);
});

test("keeps the name of an MCP tool when there is no Pi API to read", () => {
  // arrange
  const hookToolView = createHookToolView(undefined);

  // act
  const tool = hookToolView.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: PI_NAME, builtinServer: undefined });
});

test("names the registered server of a built-in MCP tool after one tool read (D-P5-01, D-P5-02)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenReturn([toolInfo("bash"), hookDemoBuiltinTool()]);
  const hookToolView = createHookToolView(pi);

  // act
  const tool = hookToolView.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: PI_NAME, builtinServer: SERVER });
  verify(pi);
});

test("names the server of a built-in tool whose name Pi cut inside the namespace (D-P5-02)", () => {
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
  const hookToolView = createHookToolView(pi);

  // act
  const tool = hookToolView.identify(LONG_PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: LONG_PI_NAME, builtinServer: LONG_SERVER });
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
    const hookToolView = createHookToolView(pi);

    // act
    const tool = hookToolView.identify(PI_NAME);

    // assert
    assert.deepStrictEqual(tool, { piName: PI_NAME, builtinServer: undefined });
    verify(pi);
  });
}

test("keeps the name of an MCP tool that Pi does not list (D-P5-01)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenReturn([hookDemoBuiltinTool()]);
  const hookToolView = createHookToolView(pi);

  // act
  const tool = hookToolView.identify("mcp__plugin_other_stub__echo");

  // assert
  assert.deepStrictEqual(tool, {
    piName: "mcp__plugin_other_stub__echo",
    builtinServer: undefined,
  });
  verify(pi);
});

test("keeps the name of an MCP tool when the tool read throws (D-P5-01)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools()).thenThrow(new Error("no session"));
  const hookToolView = createHookToolView(pi);

  // act
  const tool = hookToolView.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(tool, { piName: PI_NAME, builtinServer: undefined });
  verify(pi);
});

test("reads the tool list again for each MCP tool event", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenReturn([hookDemoBuiltinTool()])
    .times(2);
  const hookToolView = createHookToolView(pi);

  // act
  const first = hookToolView.identify(PI_NAME);
  const second = hookToolView.identify(PI_NAME);

  // assert
  assert.deepStrictEqual(
    [first, second],
    [
      { piName: PI_NAME, builtinServer: SERVER },
      { piName: PI_NAME, builtinServer: SERVER },
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
    const hookToolView = createHookToolView(pi);

    // act
    const answer = hookToolView.proxyRuleApplies();

    // assert
    assert.strictEqual(answer, applies);
    verify(pi);
  });
}

test("does not apply the proxy rule when there is no Pi API to read (D-P5-06)", () => {
  // arrange
  const hookToolView = createHookToolView(undefined);

  // act
  const answer = hookToolView.proxyRuleApplies();

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
  const hookToolView = createHookToolView(pi);

  // act
  const answers = [hookToolView.proxyRuleApplies(), hookToolView.proxyRuleApplies()];

  // assert
  assert.deepStrictEqual(answers, [true, true]);
  verify(pi);
});

test("probes the proxy rule again after a probe whose tool read threw, and keeps the next answer (HOOKTOOLREAD-01, D-P5-07)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenThrow(new Error("no session"))
    .times(3);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(3);
  when(() => pi.getCommands()).thenReturn([]);
  when(() => pi.getCommands()).thenReturn([adapterCommand()]);
  const hookToolView = createHookToolView(pi);

  // act
  const answers = [
    hookToolView.proxyRuleApplies(),
    hookToolView.proxyRuleApplies(),
    hookToolView.proxyRuleApplies(),
  ];

  // assert
  assert.deepStrictEqual(answers, [false, true, true]);
  verify(pi);
});

test("probes the proxy rule again after a probe whose command read threw, and keeps the next answer (HOOKTOOLREAD-01, D-P5-07)", () => {
  // arrange
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(6);
  when(() => pi.getCommands()).thenThrow(new Error("no session"));
  when(() => pi.getCommands()).thenReturn([adapterCommand()]);
  const hookToolView = createHookToolView(pi);

  // act
  const answers = [
    hookToolView.proxyRuleApplies(),
    hookToolView.proxyRuleApplies(),
    hookToolView.proxyRuleApplies(),
  ];

  // assert
  assert.deepStrictEqual(answers, [false, true, true]);
  verify(pi);
});

test("writes one mcp debug line for a generation whose tool reads keep failing (HOOKTOOLREAD-01, OBS-01)", (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenThrow(new Error("no session"))
    .times(8);
  when(() => pi.getCommands())
    .thenReturn([])
    .times(2);
  const hookToolView = createHookToolView(pi);

  // act
  const outcomes = [
    hookToolView.identify(PI_NAME),
    hookToolView.proxyRuleApplies(),
    hookToolView.proxyRuleApplies(),
    hookToolView.identify(PI_NAME),
  ];

  // assert
  assert.deepStrictEqual(outcomes, [
    { piName: PI_NAME, builtinServer: undefined },
    false,
    false,
    { piName: PI_NAME, builtinServer: undefined },
  ]);
  assert.deepStrictEqual(
    logged.filter((line) => line.startsWith("[mcp] mcp-tool-view:")),
    [READ_FAILURE_LINE],
  );
  verify(pi);
});

test("writes the debug line once for each generation's view (HOOKTOOLREAD-01)", (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const pi = mock<ToolSource>({ exactParams: true, name: "extension api" });
  when(() => pi.getAllTools())
    .thenThrow(new Error("no session"))
    .times(2);
  const firstView = createHookToolView(pi);
  const secondView = createHookToolView(pi);

  // act
  const tools = [firstView.identify(PI_NAME), secondView.identify(PI_NAME)];

  // assert
  assert.deepStrictEqual(tools, [
    { piName: PI_NAME, builtinServer: undefined },
    { piName: PI_NAME, builtinServer: undefined },
  ]);
  assert.deepStrictEqual(logged, [READ_FAILURE_LINE, READ_FAILURE_LINE]);
  verify(pi);
});
