import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mcpAsyncWarning } from "../../../extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts";

describe("mcpAsyncWarning", () => {
  test("D-CF6-10: the adapter text names pi-mcp-adapter's tool cache", () => {
    // arrange
    const expectedWarning =
      "tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails";

    // act
    const warning = mcpAsyncWarning("adapter");

    // assert
    assert.strictEqual(warning, expectedWarning);
  });

  test("MGRT-01: the built-in text names Pi's built-in MCP listing the server's tools", () => {
    // arrange
    const expectedWarning =
      "tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails";

    // act
    const warning = mcpAsyncWarning("builtin");

    // assert
    assert.strictEqual(warning, expectedWarning);
  });
});
