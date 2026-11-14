import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compactionBlockedText,
  hookBlockingErrorText,
  hookErrorText,
  hookEventLabel,
  hookFailureText,
  hookMatchLabel,
  hookSaysText,
  postCompactLineText,
  promptBlockedText,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts";

import type { HookFailure } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { FailedHook } from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts";

const GUARD_COMMAND = "$" + "{CLAUDE_PLUGIN_ROOT}/hooks/guard.sh";
const EXIT_HEAD = "UserPromptSubmit hook error: Failed with non-blocking status code: ";
const SPAWN_HEAD =
  "PreToolUse:Bash hook error: Failed with non-blocking status code: Error occurred while executing hook command: ";
const FAILED_HOOK = {
  command: GUARD_COMMAND,
  plugin: "demo",
  marketplace: "fixtures",
  scope: "user",
} satisfies FailedHook;
// The em dash (U+2014) of the missing-script notice, escaped because the
// fix-unicode-dashes hook rewrites a literal one.
const EM_DASH = "\u2014";
const MISSING_STDERR = "python3: can't open file '/x/gone.py': [Errno 2] No such file or directory";

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

describe("postCompactLineText", () => {
  for (const { name, succeeded, output, text } of [
    {
      name: "a hook that succeeded with its output",
      succeeded: true,
      output: "notes saved",
      text: `PostCompact [${GUARD_COMMAND}] completed successfully: notes saved`,
    },
    {
      name: "a hook that succeeded with no output",
      succeeded: true,
      output: "",
      text: `PostCompact [${GUARD_COMMAND}] completed successfully`,
    },
    {
      name: "a hook that failed with its output",
      succeeded: false,
      output: "disk full",
      text: `PostCompact [${GUARD_COMMAND}] failed: disk full`,
    },
    {
      name: "a hook that failed with no output",
      succeeded: false,
      output: "",
      text: `PostCompact [${GUARD_COMMAND}] failed`,
    },
    {
      name: "white space alone as no output",
      succeeded: false,
      output: " \n\t",
      text: `PostCompact [${GUARD_COMMAND}] failed`,
    },
    {
      name: "the output trimmed and its inner line breaks kept",
      succeeded: true,
      output: "\n first\nsecond \n",
      text: `PostCompact [${GUARD_COMMAND}] completed successfully: first\nsecond`,
    },
  ]) {
    test(`writes ${name} (D-BG-501)`, () => {
      // act
      const line = postCompactLineText(GUARD_COMMAND, succeeded, output);

      // assert
      assert.strictEqual(line, text);
    });
  }
});

describe("hookFailureText", () => {
  for (const { name, label, failure, text } of [
    {
      name: "a failed exit with its stderr",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "boom" },
      text: `${EXIT_HEAD}boom`,
    },
    {
      name: "a failed exit with the first line of its stderr only",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "first line\nsecond line" },
      text: `${EXIT_HEAD}first line`,
    },
    {
      name: "a failed exit without the blank lines and white space around its stderr",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "\n  \n  boom  \n" },
      text: `${EXIT_HEAD}boom`,
    },
    {
      name: "a failed exit with no stderr as Claude Code's default",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "" },
      text: `${EXIT_HEAD}No stderr output`,
    },
    {
      name: "a failed exit with blank stderr as Claude Code's default",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: " \n\t\n" },
      text: `${EXIT_HEAD}No stderr output`,
    },
    {
      name: "a failed exit whose line holds 200 characters whole",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "x".repeat(162) },
      text: `${EXIT_HEAD}${"x".repeat(162)}`,
    },
    {
      name: "a failed exit whose line holds 201 characters cut to 200 and an ellipsis",
      label: "UserPromptSubmit",
      failure: { kind: "exit", stderr: "x".repeat(163) },
      text: `${EXIT_HEAD}${"x".repeat(162)}…`,
    },
    {
      name: "a command that cannot be spawned with its error",
      label: "PreToolUse:Bash",
      failure: { kind: "spawn", error: "spawn guard.sh ENOENT" },
      text: `${SPAWN_HEAD}spawn guard.sh ENOENT`,
    },
    {
      name: "a command that cannot be spawned with the first line of its error",
      label: "PreToolUse:Bash",
      failure: { kind: "spawn", error: "spawn guard.sh ENOENT\n    at spawn" },
      text: `${SPAWN_HEAD}spawn guard.sh ENOENT`,
    },
    {
      name: "a command that cannot be spawned cut to 200 characters and an ellipsis",
      label: "PreToolUse:Bash",
      failure: { kind: "spawn", error: "e".repeat(118) },
      text: `${SPAWN_HEAD}${"e".repeat(117)}…`,
    },
    {
      name: "an exception in the runner with its error",
      label: "SessionStart:startup",
      failure: { kind: "run", error: "bad root" },
      text: "SessionStart:startup hook error: Failed to run: bad root",
    },
    {
      name: "an exception in the runner with the first line of its error",
      label: "SessionStart:startup",
      failure: { kind: "run", error: "bad root\n    at runner" },
      text: "SessionStart:startup hook error: Failed to run: bad root",
    },
    {
      name: "an exception in the runner whose line holds 200 characters whole",
      label: "SessionStart:startup",
      failure: { kind: "run", error: "r".repeat(185) },
      text: `SessionStart:startup hook error: Failed to run: ${"r".repeat(185)}`,
    },
    {
      name: "an exception in the runner cut to 200 characters and an ellipsis",
      label: "SessionStart:startup",
      failure: { kind: "run", error: "r".repeat(186) },
      text: `SessionStart:startup hook error: Failed to run: ${"r".repeat(185)}…`,
    },
  ] satisfies { name: string; label: string; failure: HookFailure; text: string }[]) {
    test(`writes ${name} (D-PG5-11)`, () => {
      // act
      const notice = hookFailureText(label, failure, FAILED_HOOK);

      // assert
      assert.strictEqual(notice, text);
    });
  }

  for (const { name, stderr, hook, text } of [
    {
      name: "the trimmed stderr and the reinstall command of a user-scope hook",
      stderr: `\n  ${MISSING_STDERR}  \n`,
      hook: FAILED_HOOK,
      text: `Stop hook error: Hook script appears to be missing ${EM_DASH} "${GUARD_COMMAND}" exited 2 with: ${MISSING_STDERR}. Treating as non-blocking. Run /claude:plugin reinstall demo@fixtures --scope user to reinstall it.`,
    },
    {
      name: "the plugin, marketplace, and scope of a project-scope hook",
      stderr: "no such file",
      hook: { command: "./run.sh", plugin: "lint", marketplace: "tools", scope: "project" },
      text: `Stop hook error: Hook script appears to be missing ${EM_DASH} "./run.sh" exited 2 with: no such file. Treating as non-blocking. Run /claude:plugin reinstall lint@tools --scope project to reinstall it.`,
    },
    {
      name: "a stderr of 400 characters whole",
      stderr: "n".repeat(400),
      hook: FAILED_HOOK,
      text: `Stop hook error: Hook script appears to be missing ${EM_DASH} "${GUARD_COMMAND}" exited 2 with: ${"n".repeat(400)}. Treating as non-blocking. Run /claude:plugin reinstall demo@fixtures --scope user to reinstall it.`,
    },
  ] satisfies { name: string; stderr: string; hook: FailedHook; text: string }[]) {
    test(`writes the missing-script notice with ${name} (D-PG5-08, D-PG5-11)`, () => {
      // act
      const notice = hookFailureText("Stop", { kind: "missing-script", stderr }, hook);

      // assert
      assert.strictEqual(notice, text);
    });
  }
});
