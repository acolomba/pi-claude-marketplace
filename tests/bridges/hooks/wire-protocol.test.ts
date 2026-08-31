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

test("defaults a non-Error JSON parser failure to noop without throwing", (t) => {
  // arrange
  class ParserFailure implements Error {
    readonly name = "ParserFailure";
    readonly message = "parser unavailable";

    toString(): string {
      return this.message;
    }
  }

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
  const parserFailure: Error = new ParserFailure();
  t.mock.method(JSON, "parse", () => {
    throw parserFailure;
  });
  const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
  const exitCode = 0;
  const stdout = '{"otherwise":"valid"}';
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
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  const diagnostic = String(consoleErrorSpy.mock.calls[0]?.arguments[0]);
  assert.deepStrictEqual(
    {
      callCount: consoleErrorSpy.mock.callCount(),
      argumentCount: consoleErrorSpy.mock.calls[0]?.arguments.length,
      hookDestination: diagnostic.startsWith("[hooks] "),
      category: diagnostic.includes("JSON.parse failed"),
      detail: diagnostic.includes("parser unavailable"),
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

test("gives a nested deny precedence over every mutation field and output suppression", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nested deny","updatedInput":{"command":"ignored input"},"updatedToolOutput":{"content":"ignored output"},"additionalContext":"ignored context"},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "nested deny" });
});

test("omits a wrong-type nested deny reason", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":["not","a","reason"],"updatedInput":{"command":"ignored input"}}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block" });
});

test("returns updated input as an exact mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{"updatedInput":{"command":"replacement input"}}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    updatedInput: { command: "replacement input" },
  });
});

test("returns updated tool output as an exact mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"updatedToolOutput":{"content":[{"type":"text","text":"replacement output"}],"isError":false}}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    updatedToolOutput: {
      content: [{ type: "text", text: "replacement output" }],
      isError: false,
    },
  });
});

test("returns additional context as an exact mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{"additionalContext":"replacement context"}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    additionalContext: "replacement context",
  });
});

test("retains an allow decision with its string reason", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"allow","permissionDecisionReason":"approved by policy"}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    permissionDecision: "allow",
    permissionDecisionReason: "approved by policy",
  });
});

test("retains an ask decision with its string reason", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"ask","permissionDecisionReason":"confirm with the user"}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    permissionDecision: "ask",
    permissionDecisionReason: "confirm with the user",
  });
});

test("retains every mutation field together before output suppression", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"updatedInput":{"command":"combined input"},"updatedToolOutput":{"content":[{"type":"text","text":"combined output"}],"isError":true},"additionalContext":"combined context","permissionDecision":"allow","permissionDecisionReason":"combined approval"},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    updatedInput: { command: "combined input" },
    updatedToolOutput: {
      content: [{ type: "text", text: "combined output" }],
      isError: true,
    },
    additionalContext: "combined context",
    permissionDecision: "allow",
    permissionDecisionReason: "combined approval",
  });
});

test("omits wrong-type optional mutation fields without coercion", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"additionalContext":{"text":"not a string"},"permissionDecision":"allow","permissionDecisionReason":17}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    permissionDecision: "allow",
  });
});

test("omits a wrong-type top-level stop reason", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"continue":false,"stopReason":{"text":"not a string"}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "stop" });
});

test("omits a wrong-type top-level block reason", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"decision":"block","reason":false}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block" });
});

test("honors output suppression when nested output has no mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop", suppressOutput: true });
});

test("ignores null nested output and nonboolean output suppression", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":null,"suppressOutput":"true"}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("ignores unrecognized nested fields instead of widening the mutation whitelist", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"replacementInput":{"command":"not allowed"},"replacementOutput":"not allowed","context":["not allowed"],"permissionDecision":"later"}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("returns the final noop outcome for an otherwise valid empty object", () => {
  // arrange
  const exitCode = 0;
  const stdout = "{}";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
  });
});
