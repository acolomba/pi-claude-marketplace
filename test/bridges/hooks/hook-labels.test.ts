import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hookBlockingErrorText,
  hookErrorText,
  hookEventLabel,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts";

const GUARD_COMMAND = "$" + "{CLAUDE_PLUGIN_ROOT}/hooks/guard.sh";

describe("hookEventLabel", () => {
  for (const { name, claudeEvent, piToolName, label } of [
    {
      name: "an event without a tool by its name",
      claudeEvent: "SessionStart",
      label: "SessionStart",
    },
    {
      name: "a tool event by its name and Claude's tool name",
      claudeEvent: "PreToolUse",
      piToolName: "bash",
      label: "PreToolUse:Bash",
    },
    {
      name: "an MCP tool event by the tool's own name",
      claudeEvent: "PostToolUse",
      piToolName: "mcp__plugin_demo_stub__echo",
      label: "PostToolUse:mcp__plugin_demo_stub__echo",
    },
  ]) {
    test(`labels ${name} (D-CF5-11)`, () => {
      // act
      const text = hookEventLabel(claudeEvent, piToolName);

      // assert
      assert.strictEqual(text, label);
    });
  }
});

describe("hookErrorText", () => {
  for (const { name, reason, fromStderr, text } of [
    {
      name: "a decision reason alone",
      reason: "no echo",
      fromStderr: false,
      text: "PreToolUse:Bash hook error: no echo",
    },
    {
      name: "an exit-2 stderr reason after the bracketed command",
      reason: "blocked by policy",
      fromStderr: true,
      text: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: blocked by policy`,
    },
    {
      name: "a reason that already names the command without bracketing it again",
      reason: `[${GUARD_COMMAND}]: failed; blocking because onFailure is "block"`,
      fromStderr: false,
      text: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: failed; blocking because onFailure is "block"`,
    },
    {
      name: "Claude Code's default for a decision without a reason",
      reason: undefined,
      fromStderr: false,
      text: "PreToolUse:Bash hook error: Blocked by hook",
    },
    {
      name: "Claude Code's default for an exit 2 without stderr",
      reason: undefined,
      fromStderr: true,
      text: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: No stderr output`,
    },
  ]) {
    test(`writes ${name} (D-CF5-11)`, () => {
      // act
      const errorText = hookErrorText("PreToolUse:Bash", reason, GUARD_COMMAND, fromStderr);

      // assert
      assert.strictEqual(errorText, text);
    });
  }
});

describe("hookBlockingErrorText", () => {
  for (const { name, reason, fromStderr, text } of [
    {
      name: "a decision reason after the quoted command",
      reason: "check the output",
      fromStderr: false,
      text: `PostToolUse:Bash hook blocking error from command: "${GUARD_COMMAND}": check the output`,
    },
    {
      name: "an exit-2 stderr reason after the bracketed command",
      reason: "look again",
      fromStderr: true,
      text: `PostToolUse:Bash hook blocking error from command: "${GUARD_COMMAND}": [${GUARD_COMMAND}]: look again`,
    },
  ]) {
    test(`writes ${name} (D-CF5-11)`, () => {
      // act
      const feedback = hookBlockingErrorText("PostToolUse:Bash", reason, GUARD_COMMAND, fromStderr);

      // assert
      assert.strictEqual(feedback, text);
    });
  }
});
