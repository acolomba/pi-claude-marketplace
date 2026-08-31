import assert from "node:assert/strict";
import test from "node:test";

import { parseHookStdout } from "../../../extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";

test("blocks exit 2 with its trimmed stderr reason before reading stdout", () => {
  // arrange
  const exitCode = 2;
  const stdout = '{"continue":false,"stopReason":"ignored stop"}';
  const stderr = "  denied by hook  ";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "block", reason: "denied by hook" });
});

test("blocks exit 2 without a reason when stderr is blank", () => {
  // arrange
  const exitCode = 2;
  const stdout = '{"decision":"block","reason":"ignored stdout reason"}';
  const stderr = " \n ";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "block" });
});

test("defaults another nonzero exit to noop and reports its semantic diagnostic", (t) => {
  // arrange
  const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
  const hadDebug = Object.hasOwn(process.env, debugKey);
  const previousDebug = process.env[debugKey];
  process.env[debugKey] = "1";
  t.after(() => {
    if (hadDebug) {
      process.env[debugKey] = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
  const exitCode = 7;
  const stdout = '{"decision":"block","reason":"ignored block"}';
  const stderr = "ignored stderr";
  let hookOutcome: HookExecResult | undefined;
  let thrown: unknown;

  // act
  try {
    hookOutcome = parseHookStdout(exitCode, stdout, stderr);
  } catch (error) {
    thrown = error;
  }

  // assert
  assert.equal(thrown, undefined);
  assert.deepEqual(hookOutcome, { kind: "noop" });
  const diagnostic = String(consoleErrorSpy.mock.calls[0]?.arguments[0]);
  assert.deepEqual(
    {
      callCount: consoleErrorSpy.mock.callCount(),
      argumentCount: consoleErrorSpy.mock.calls[0]?.arguments.length,
      hookDestination: diagnostic.startsWith("[hooks] "),
      category: diagnostic.includes("non-zero exit (7)"),
      outcome: diagnostic.includes("defaulting to noop"),
    },
    {
      callCount: 1,
      argumentCount: 1,
      hookDestination: true,
      category: true,
      outcome: true,
    },
  );
});

test("defaults a signal-kill exit to noop and reports its semantic diagnostic", (t) => {
  // arrange
  const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
  const hadDebug = Object.hasOwn(process.env, debugKey);
  const previousDebug = process.env[debugKey];
  process.env[debugKey] = "1";
  t.after(() => {
    if (hadDebug) {
      process.env[debugKey] = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
  const exitCode = null;
  const stdout = '{"continue":false,"stopReason":"ignored stop"}';
  const stderr = "ignored stderr";
  let hookOutcome: HookExecResult | undefined;
  let thrown: unknown;

  // act
  try {
    hookOutcome = parseHookStdout(exitCode, stdout, stderr);
  } catch (error) {
    thrown = error;
  }

  // assert
  assert.equal(thrown, undefined);
  assert.deepEqual(hookOutcome, { kind: "noop" });
  const diagnostic = String(consoleErrorSpy.mock.calls[0]?.arguments[0]);
  assert.deepEqual(
    {
      callCount: consoleErrorSpy.mock.callCount(),
      argumentCount: consoleErrorSpy.mock.calls[0]?.arguments.length,
      hookDestination: diagnostic.startsWith("[hooks] "),
      category: diagnostic.includes("non-zero exit"),
      detail: diagnostic.includes("signal-kill"),
      outcome: diagnostic.includes("defaulting to noop"),
    },
    {
      callCount: 1,
      argumentCount: 1,
      hookDestination: true,
      category: true,
      detail: true,
      outcome: true,
    },
  );
});

test("defaults zero exit with empty stdout to noop", () => {
  // arrange
  const exitCode = 0;
  const stdout = " \n\t ";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "noop" });
});

test("defaults malformed JSON to noop and reports its semantic diagnostic", (t) => {
  // arrange
  const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
  const hadDebug = Object.hasOwn(process.env, debugKey);
  const previousDebug = process.env[debugKey];
  process.env[debugKey] = "1";
  t.after(() => {
    if (hadDebug) {
      process.env[debugKey] = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
  const exitCode = 0;
  const stdout = "{not-json";
  const stderr = "ignored stderr";
  let hookOutcome: HookExecResult | undefined;
  let thrown: unknown;

  // act
  try {
    hookOutcome = parseHookStdout(exitCode, stdout, stderr);
  } catch (error) {
    thrown = error;
  }

  // assert
  assert.equal(thrown, undefined);
  assert.deepEqual(hookOutcome, { kind: "noop" });
  const diagnostic = String(consoleErrorSpy.mock.calls[0]?.arguments[0]);
  assert.deepEqual(
    {
      callCount: consoleErrorSpy.mock.callCount(),
      argumentCount: consoleErrorSpy.mock.calls[0]?.arguments.length,
      hookDestination: diagnostic.startsWith("[hooks] "),
      category: diagnostic.includes("JSON.parse failed"),
      outcome: diagnostic.includes("defaulting to noop"),
    },
    {
      callCount: 1,
      argumentCount: 1,
      hookDestination: true,
      category: true,
      outcome: true,
    },
  );
});

test("defaults a JSON primitive to noop", () => {
  // arrange
  const exitCode = 0;
  const stdout = "42";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "noop" });
});

test("defaults JSON null to noop", () => {
  // arrange
  const exitCode = 0;
  const stdout = "null";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "noop" });
});

test("gives top-level stop precedence over top-level block and nested output", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"continue":false,"stopReason":"top stop","decision":"block","reason":"top block","hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nested deny","updatedInput":{"source":"nested mutation"}},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "stop", stopReason: "top stop" });
});

test("gives top-level block precedence over nested decisions", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"decision":"block","reason":"top block","hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nested deny","updatedToolOutput":{"source":"nested mutation"}},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "block", reason: "top block" });
});

test("blocks a nested deny with its permission reason", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nested deny"}}';
  const stderr = "";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, { kind: "block", reason: "nested deny" });
});

test("returns updated input and additional context as one mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"updatedInput":{"input":"replacement"},"additionalContext":"context"}}';
  const stderr = "";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, {
    kind: "mutate",
    updatedInput: { input: "replacement" },
    additionalContext: "context",
  });
});

test("returns updated tool output as a mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{"updatedToolOutput":{"output":"replacement"}}}';
  const stderr = "";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepEqual(hookOutcome, {
    kind: "mutate",
    updatedToolOutput: { output: "replacement" },
  });
});
