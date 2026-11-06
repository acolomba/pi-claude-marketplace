import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  claudeFormToolName,
  serverPrefixNames,
  toolLiteralNames,
} from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts";

import type { McpToolIdentity } from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts";

const LONG_SERVER = "plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server";
const LONG_PI_NAME = "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d";
const EDGE_SERVER = `edge-server-${"a".repeat(37)}`;
const EDGE_NAMESPACE = `mcp__edge_server_${"a".repeat(37)}`;

function hookDemoTool(piName = "mcp__plugin_hook_demo_stub_server__echo"): McpToolIdentity {
  return { piName, builtinServer: "plugin_hook-demo_stub-server" };
}

describe("toolLiteralNames", () => {
  for (const { literal, fires } of [
    { literal: "mcp__plugin_demo_stub__echo", fires: true },
    { literal: "mcp__plugin_demo_stub__other", fires: false },
    { literal: "mcp__plugin_demo_stub__", fires: false },
  ]) {
    test(`compares ${literal} with Pi's name when no built-in server serves the tool (D-P5-05)`, () => {
      // arrange
      const tool = { piName: "mcp__plugin_demo_stub__echo", builtinServer: undefined };

      // act
      const named = toolLiteralNames(literal, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }

  for (const { literal, fires } of [
    { literal: "mcp__plugin_hook-demo_stub-server__echo", fires: true },
    { literal: "mcp__plugin_hook_demo_stub_server__echo", fires: false },
    { literal: "mcp__plugin_other_stub-server__echo", fires: false },
    { literal: "mcp__plugin_hook-demo_stub-server__", fires: false },
    { literal: "mcp__plugin_hook-demo_stub-server__other", fires: false },
  ]) {
    test(`fires ${literal} on a built-in tool only under its server's registered name: ${fires} (D-P5-04)`, () => {
      // arrange
      const tool = hookDemoTool();

      // act
      const named = toolLiteralNames(literal, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }

  for (const literal of ["mcp__echo-server__echo-text", "mcp__echo-server__echo_text"]) {
    test(`fires ${literal} on a tool whose segment Pi folded, with or without the fold (D-P5-04)`, () => {
      // arrange
      const tool = { piName: "mcp__echo_server__echo_text", builtinServer: "echo-server" };

      // act
      const named = toolLiteralNames(literal, tool);

      // assert
      assert.strictEqual(named, true);
    });
  }

  for (const { piName, server, literal, fires } of [
    {
      piName: "mcp__plugin_hook_demo_stub_server__echo_9bab19c4",
      server: "plugin_hook-demo_stub-server",
      literal: "mcp__plugin_hook-demo_stub-server__echo",
      fires: true,
    },
    {
      piName: "mcp__docs_server__a_b_e1640312",
      server: "docs-server",
      literal: "mcp__docs-server__a-b",
      fires: true,
    },
    {
      piName: "mcp__docs_server__a_b_e1640312",
      server: "docs-server",
      literal: "mcp__docs-server__a_b",
      fires: false,
    },
    {
      piName: "mcp__docs_server__a_b_35d05d6d",
      server: "docs-server",
      literal: "mcp__docs-server__a_b",
      fires: true,
    },
    {
      piName: "mcp__docs_server__a_b_35d05d6d",
      server: "docs-server",
      literal: "mcp__docs-server__a-b",
      fires: false,
    },
    {
      piName: "mcp__echo_server__echo_text_ba79b118",
      server: "echo-server",
      literal: "mcp__echo-server__echo-text",
      fires: true,
    },
  ]) {
    test(`fires ${literal} on Pi's hashed name ${piName}: ${fires} (D-P5-04)`, () => {
      // arrange
      const tool = { piName, builtinServer: server };

      // act
      const named = toolLiteralNames(literal, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }

  test("fires the full name on a tool whose name Pi cut at 64 characters (D-P5-04)", () => {
    // arrange
    const tool = { piName: LONG_PI_NAME, builtinServer: LONG_SERVER };

    // act
    const named = toolLiteralNames(`mcp__${LONG_SERVER}__echo`, tool);

    // assert
    assert.strictEqual(named, true);
  });

  for (const { literal, fires } of [
    {
      literal: "mcp__echo-server__summarize-the-current-repository-state-and-history-now",
      fires: true,
    },
    {
      literal: "mcp__echo-server__summarize_the_current_repository_state_and_history_now",
      fires: false,
    },
  ]) {
    test(`fires ${literal} on a tool whose name Pi cut and hashed: ${fires} (D-P5-04)`, () => {
      // arrange
      const tool = {
        piName: "mcp__echo_server__summarize_the_current_repository_stat_03a79582",
        builtinServer: "echo-server",
      };

      // act
      const named = toolLiteralNames(literal, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }
});

describe("serverPrefixNames", () => {
  for (const { prefix, fires } of [
    { prefix: "mcp__plugin_demo_stub__", fires: true },
    { prefix: "mcp__plugin_demo_other__", fires: false },
  ]) {
    test(`compares ${prefix} with the start of Pi's name when no built-in server serves the tool (D-P5-05)`, () => {
      // arrange
      const tool = { piName: "mcp__plugin_demo_stub__echo", builtinServer: undefined };

      // act
      const named = serverPrefixNames(prefix, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }

  for (const { prefix, fires } of [
    { prefix: "mcp__plugin_hook-demo_stub-server__", fires: true },
    { prefix: "mcp__plugin_hook_demo_stub_server__", fires: false },
    { prefix: "mcp__plugin_hook-demo_stub-", fires: false },
  ]) {
    test(`fires ${prefix} on a built-in tool only under its server's registered name: ${fires} (D-P5-04)`, () => {
      // arrange
      const tool = hookDemoTool();

      // act
      const named = serverPrefixNames(prefix, tool);

      // assert
      assert.strictEqual(named, fires);
    });
  }
});

describe("claudeFormToolName", () => {
  test("puts the registered server name in place of Pi's namespace (D-P5-02)", () => {
    // arrange
    const piName = "mcp__plugin_hook_demo_stub_server__echo";
    const namespace = "mcp__plugin_hook_demo_stub_server";
    const server = "plugin_hook-demo_stub-server";

    // act
    const hookToolName = claudeFormToolName(piName, namespace, server);

    // assert
    assert.strictEqual(hookToolName, "mcp__plugin_hook-demo_stub-server__echo");
  });

  test("keeps Pi's name when Pi cut it inside the namespace (D-P5-02)", () => {
    // arrange
    const namespace = "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plugin_stub_server";

    // act
    const hookToolName = claudeFormToolName(LONG_PI_NAME, namespace, LONG_SERVER);

    // assert
    assert.strictEqual(hookToolName, LONG_PI_NAME);
  });

  test("keeps the hash as the tool segment when Pi's cut ends just past the namespace (D-P5-02)", () => {
    // arrange
    const piName = `${EDGE_NAMESPACE}__f5437d26`;

    // act
    const hookToolName = claudeFormToolName(piName, EDGE_NAMESPACE, EDGE_SERVER);

    // assert
    assert.strictEqual(hookToolName, `mcp__${EDGE_SERVER}__f5437d26`);
  });
});
