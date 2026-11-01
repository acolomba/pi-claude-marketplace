import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compactionBlockedText,
  hookBlockingErrorText,
  hookErrorText,
  hookEventLabel,
  hookMatchLabel,
  hookSaysText,
  promptBlockedText,
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

describe("hookSaysText", () => {
  for (const { name, label, message, text } of [
    {
      name: "a prompt hook's system message after its event",
      label: "UserPromptSubmit",
      message: "hi",
      text: "UserPromptSubmit says: hi",
    },
    {
      name: "a tool hook's system message after its event and tool",
      label: "PreToolUse:Bash",
      message: "checked",
      text: "PreToolUse:Bash says: checked",
    },
  ]) {
    test(`writes ${name} (D-CF5-14)`, () => {
      // act
      const notice = hookSaysText(label, message);

      // assert
      assert.strictEqual(notice, text);
    });
  }
});

describe("hookMatchLabel", () => {
  for (const { claudeEvent, matchValue, label } of [
    { claudeEvent: "SessionStart", matchValue: "startup", label: "SessionStart:startup" },
    { claudeEvent: "SessionEnd", matchValue: "clear", label: "SessionEnd:clear" },
    { claudeEvent: "PostCompact", matchValue: "auto", label: "PostCompact:auto" },
  ]) {
    test(`labels ${claudeEvent} by the value ${matchValue} its matcher selects on (D-CF5-14)`, () => {
      // act
      const text = hookMatchLabel(claudeEvent, matchValue);

      // assert
      assert.strictEqual(text, label);
    });
  }
});

describe("promptBlockedText", () => {
  for (const { name, reason, fromStderr, text } of [
    {
      name: "an exit-2 stderr reason after the bracketed command",
      reason: "no prompts today",
      fromStderr: true,
      text: `UserPromptSubmit operation blocked by hook:\n[${GUARD_COMMAND}]: no prompts today`,
    },
    {
      name: "a decision reason alone",
      reason: "not now",
      fromStderr: false,
      text: "UserPromptSubmit operation blocked by hook:\nnot now",
    },
    {
      name: "Claude Code's default for a decision without a reason",
      reason: undefined,
      fromStderr: false,
      text: "UserPromptSubmit operation blocked by hook:\nBlocked by hook",
    },
  ]) {
    test(`writes ${name} (D-CF5-24)`, () => {
      // act
      const notice = promptBlockedText(reason, GUARD_COMMAND, fromStderr);

      // assert
      assert.strictEqual(notice, text);
    });
  }
});

describe("compactionBlockedText", () => {
  test("joins the message of each blocking hook in routing order (Claude Code 2.1.316)", () => {
    // act
    const text = compactionBlockedText([
      { reason: "not now", command: GUARD_COMMAND, fromStderr: true },
      { reason: "keep the history", command: "other", fromStderr: false },
      { reason: undefined, command: "quiet", fromStderr: true },
    ]);

    // assert
    assert.strictEqual(
      text,
      `Compaction blocked by PreCompact hook: [${GUARD_COMMAND}]: not now\nkeep the history\n[quiet]: No stderr output`,
    );
  });
});
