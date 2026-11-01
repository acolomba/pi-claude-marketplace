import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextInjectionError,
  expandContextInjections,
} from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

import type {
  ShellRun,
  ShellRunResult,
} from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

function bashExit(stdout: string, stderr = "", code: number | null = 0): ShellRunResult {
  return { kind: "exited", code, stdout, stderr, shell: "bash" };
}

// A runner that answers each command from a table and records the commands it ran.
function tableRun(outputs: Readonly<Record<string, string>>, commands: string[]): ShellRun {
  return (command) => {
    commands.push(command);
    return Promise.resolve(bashExit(outputs[command] ?? assert.fail(`unexpected ${command}`)));
  };
}

test("D-CF1-02: replaces an inline command with its output", async () => {
  // arrange
  const commands: string[] = [];
  const run = tableRun({ "git status": "clean\n" }, commands);

  // act
  const expanded = await expandContextInjections("Status: !`git status`", run);

  // assert
  assert.strictEqual(expanded, "Status: clean");
  assert.deepStrictEqual(commands, ["git status"]);
});

test("D-CF1-02: returns a text with no command unchanged and runs nothing", async () => {
  // arrange
  const run: ShellRun = () => assert.fail("a text with no command ran one");

  // act
  const expanded = await expandContextInjections("Plain `code` and text", run);

  // assert
  assert.strictEqual(expanded, "Plain `code` and text");
});

test("D-CF1-02: replaces a fenced block and an inline command, starting both runs before either ends", async () => {
  // arrange
  const commands: string[] = [];
  const pending: Array<(result: ShellRunResult) => void> = [];
  const run: ShellRun = (command) => {
    commands.push(command);
    return new Promise((resolve) => {
      pending.push(resolve);
    });
  };

  // act
  const expanding = expandContextInjections("Dir: !`pwd`\n```!\nls\n```\nend", run);
  await Promise.resolve();
  const startedBeforeAnyEnded = [...commands];
  pending[1]?.(bashExit("/work\n"));
  pending[0]?.(bashExit("a.txt\n"));
  const expanded = await expanding;

  // assert
  assert.deepStrictEqual(startedBeforeAnyEnded, ["ls", "pwd"]);
  assert.strictEqual(expanded, "Dir: /work\na.txt\nend");
});

for (const { text, why } of [
  { text: "Code `!`not a pattern`", why: "inside an ordinary code span" },
  { text: "Type `git !`log` to see", why: "after whitespace inside an ordinary code span" },
  { text: "x!`cmd`", why: "with no whitespace before the !" },
  { text: "Empty !` ` here", why: "with an empty command" },
  { text: "```!\n\n```", why: "in an empty fenced block" },
  { text: "```!\nls\n", why: "in a fenced block with no closing marker" },
]) {
  test(`D-CF1-02: leaves a pattern ${why} alone`, async () => {
    // arrange
    const run: ShellRun = () => assert.fail(`ran a pattern ${why}`);

    // act
    const expanded = await expandContextInjections(text, run);

    // assert
    assert.strictEqual(expanded, text);
  });
}

test("D-CF1-02: runs a pattern after an ordinary code span on the same line", async () => {
  // arrange
  const commands: string[] = [];
  const run = tableRun({ date: "today" }, commands);

  // act
  const expanded = await expandContextInjections("Use `make` on !`date`", run);

  // assert
  assert.strictEqual(expanded, "Use `make` on today");
  assert.deepStrictEqual(commands, ["date"]);
});

test("D-CF1-02: replaces two identical patterns one occurrence at a time, in order", async () => {
  // arrange
  const outputs = ["first", "second"];
  const run: ShellRun = () => Promise.resolve(bashExit(outputs.shift() ?? ""));

  // act
  const expanded = await expandContextInjections("!`date` and !`date`", run);

  // assert
  assert.strictEqual(expanded, "first and second");
});

test("D-CF1-02: keeps a $& sequence in the output literal", async () => {
  // arrange
  const run = tableRun({ price: "$& and $1" }, []);

  // act
  const expanded = await expandContextInjections("Cost: !`price`", run);

  // assert
  assert.strictEqual(expanded, "Cost: $& and $1");
});

test("D-CF1-02: runs a fenced command with LF line ends and no surrounding space", async () => {
  // arrange
  const commands: string[] = [];
  const run = tableRun({ "echo a\necho b": "a\nb\n" }, commands);

  // act
  const expanded = await expandContextInjections("```!\r\n  echo a\r\necho b  \r\n```", run);

  // assert
  assert.strictEqual(expanded, "a\nb");
  assert.deepStrictEqual(commands, ["echo a\necho b"]);
});

test("D-CF1-02: gives stdout without leading blank lines or trailing space, then the trimmed stderr", async () => {
  // arrange
  const run: ShellRun = () => Promise.resolve(bashExit("\n\n  out  \n", " warn "));

  // act
  const expanded = await expandContextInjections("!`cmd`", run);

  // assert
  assert.strictEqual(expanded, "  out\nwarn");
});

for (const { shell, note } of [
  { shell: "bash", note: "(Bash completed with no output)" },
  { shell: "powershell", note: "(PowerShell completed with no output)" },
] as const) {
  test(`D-CF1-02: replaces a ${shell} command with no output by ${note}`, async () => {
    // arrange
    const run: ShellRun = () =>
      Promise.resolve({ kind: "exited", code: 0, stdout: " \n", stderr: "  ", shell });

    // act
    const expanded = await expandContextInjections("Result: !`true`.", run);

    // assert
    assert.strictEqual(expanded, `Result: ${note}.`);
  });
}

for (const { ending, result, reason, message } of [
  {
    ending: "exits 1 with stdout and stderr",
    result: bashExit("o", "e", 1),
    reason: "failed",
    message: 'Shell command failed for pattern "!`cmd`": o\n[stderr]\ne',
  },
  {
    ending: "ends with no exit code",
    result: bashExit(" o \n", "", null),
    reason: "failed",
    message: 'Shell command failed for pattern "!`cmd`": o',
  },
  {
    ending: "exits 2 with no output",
    result: bashExit("", "", 2),
    reason: "failed",
    message: 'Shell command failed for pattern "!`cmd`": ',
  },
  {
    ending: "is interrupted",
    result: { kind: "interrupted" },
    reason: "interrupted",
    message: 'Shell command interrupted for pattern "!`cmd`": [Command interrupted]',
  },
  {
    ending: "cannot start",
    result: { kind: "not-started", message: "spawn bash ENOENT" },
    reason: "not-started",
    message: "[Error]\nspawn bash ENOENT",
  },
] satisfies ReadonlyArray<{
  ending: string;
  result: ShellRunResult;
  reason: ContextInjectionError["reason"];
  message: string;
}>) {
  test(`D-CF1-02: aborts with a ${reason} error when a command ${ending}`, async () => {
    // arrange
    const run: ShellRun = () => Promise.resolve(result);

    // act & assert
    await assert.rejects(expandContextInjections("Run !`cmd` now", run), (error: unknown) => {
      assert.ok(error instanceof ContextInjectionError);
      assert.strictEqual(error.name, "ContextInjectionError");
      assert.strictEqual(error.pattern, "!`cmd`");
      assert.strictEqual(error.reason, reason);
      assert.strictEqual(error.message, message);
      return true;
    });
  });
}
