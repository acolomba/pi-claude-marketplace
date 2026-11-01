import assert from "node:assert/strict";
import test from "node:test";

import { expandContextInjections } from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

import type {
  ShellRun,
  ShellRunResult,
} from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

function bashExit(stdout: string, stderr = "", code: number | null = 0): ShellRunResult {
  return { kind: "exited", code, stdout, stderr, shell: "bash" };
}

test("D-CF1-02: replaces an inline command with its output", async () => {
  // arrange
  const commands: string[] = [];
  const run: ShellRun = (command) => {
    commands.push(command);
    return Promise.resolve(bashExit("clean\n"));
  };

  // act
  const expanded = await expandContextInjections("Status: !`git status`", run);

  // assert
  assert.strictEqual(expanded, "Status: clean");
  assert.deepStrictEqual(commands, ["git status"]);
});

test("D-CF1-02: rejects when a command exits with a non-zero code", async () => {
  // arrange
  const run: ShellRun = () => Promise.resolve(bashExit("", "", 1));

  // act & assert
  await assert.rejects(expandContextInjections("!`false`", run), {
    message: 'Shell command failed for pattern "!`false`"',
  });
});

test("D-CF1-02: returns a text with no command unchanged and runs nothing", async () => {
  // arrange
  const run: ShellRun = () => assert.fail("a text with no command ran one");

  // act
  const expanded = await expandContextInjections("Plain `code` and text", run);

  // assert
  assert.strictEqual(expanded, "Plain `code` and text");
});
