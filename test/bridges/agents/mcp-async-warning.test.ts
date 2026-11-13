import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isMcpAsyncWarning,
  mcpAsyncWarning,
  rewriteMcpAsyncWarning,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts";

const historicalLead =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; ";
const correctedLead =
  "tools include MCP tools, which require a pi-subagents background child -- the agent runs in the background (`async: true`); ";
const adapterTail = "a launch before pi-mcp-adapter has cached the server's tools still fails";
const builtinTail = "a launch before Pi's built-in MCP has listed the server's tools still fails";

describe("mcpAsyncWarning", () => {
  test("D-CF6-10: the adapter text names pi-mcp-adapter's tool cache", () => {
    // arrange
    const expectedWarning =
      "tools include MCP tools, which require a pi-subagents background child -- the agent runs in the background (`async: true`); a launch before pi-mcp-adapter has cached the server's tools still fails";

    // act
    const warning = mcpAsyncWarning("adapter");

    // assert
    assert.strictEqual(warning, expectedWarning);
  });

  test("MGRT-01: the built-in text names Pi's built-in MCP listing the server's tools", () => {
    // arrange
    const expectedWarning =
      "tools include MCP tools, which require a pi-subagents background child -- the agent runs in the background (`async: true`); a launch before Pi's built-in MCP has listed the server's tools still fails";

    // act
    const warning = mcpAsyncWarning("builtin");

    // assert
    assert.strictEqual(warning, expectedWarning);
  });
});

describe("isMcpAsyncWarning", () => {
  for (const { generation, lead } of [
    { generation: "historical", lead: historicalLead },
    { generation: "corrected", lead: correctedLead },
  ]) {
    test(`recognizes only the complete ${generation} warning for its implementation`, () => {
      // arrange
      const adapter = lead + adapterTail;
      const builtin = lead + builtinTail;

      // act
      const adapterMatch = isMcpAsyncWarning(adapter, "adapter");
      const builtinMatch = isMcpAsyncWarning(builtin, "builtin");

      // assert
      assert.strictEqual(adapterMatch, true);
      assert.strictEqual(builtinMatch, true);
      assert.strictEqual(isMcpAsyncWarning(adapter, "builtin"), false);
      assert.strictEqual(isMcpAsyncWarning(builtin, "adapter"), false);
      assert.strictEqual(isMcpAsyncWarning(`${adapter}!`, "adapter"), false);
    });
  }
});

describe("rewriteMcpAsyncWarning", () => {
  for (const { generation, lead } of [
    { generation: "historical", lead: historicalLead },
    { generation: "corrected", lead: correctedLead },
  ]) {
    test(`translates the exact ${generation} warning in both directions`, () => {
      // arrange
      const adapter = lead + adapterTail;
      const builtin = lead + builtinTail;

      // act
      const toBuiltin = rewriteMcpAsyncWarning(adapter, "builtin");
      const toAdapter = rewriteMcpAsyncWarning(builtin, "adapter");

      // assert
      assert.strictEqual(toBuiltin, builtin);
      assert.strictEqual(toAdapter, adapter);
      assert.strictEqual(rewriteMcpAsyncWarning(toBuiltin, "adapter"), adapter);
      assert.strictEqual(rewriteMcpAsyncWarning(toAdapter, "builtin"), builtin);
      assert.strictEqual(rewriteMcpAsyncWarning(adapter, "adapter"), adapter);
      assert.strictEqual(rewriteMcpAsyncWarning(builtin, "builtin"), builtin);
    });
  }

  for (const { label, warning } of [
    { label: "truncated", warning: historicalLead + adapterTail.slice(0, -1) },
    { label: "case changed", warning: historicalLead.replace("MCP", "mcp") + adapterTail },
    { label: "prefixed", warning: "note: " + historicalLead + adapterTail },
    { label: "suffixed", warning: correctedLead + adapterTail + "!" },
    { label: "other text", warning: "a different warning" },
  ]) {
    test(`leaves a ${label} warning unchanged`, () => {
      // arrange
      const original = warning;

      // act
      const translated = rewriteMcpAsyncWarning(original, "builtin");

      // assert
      assert.strictEqual(translated, original);
    });
  }
});
