import assert from "node:assert/strict";
import test from "node:test";

import { parseHookStdout } from "../../../extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";

test("blocks exit 2 with its trimmed stderr reason, marked, when stdout names no block reason", () => {
  // arrange
  const exitCode = 2;
  const stdout = '{"continue":false,"stopReason":"ignored stop"}';
  const stderr = "  denied by hook  ";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: "denied by hook",
    fromStderr: true,
  });
});

test("blocks exit 2 with a marked stderr block and no reason when stderr is blank", () => {
  // arrange
  const exitCode = 2;
  const stdout = "plain text";
  const stderr = " \n ";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", fromStderr: true });
});

for (const { name, stdout, reason } of [
  {
    name: "a block decision",
    stdout: '{"decision":"block","reason":"json block reason"}',
    reason: "json block reason",
  },
  {
    name: "a deny decision",
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"json deny reason"}}',
    reason: "json deny reason",
  },
]) {
  test(`blocks exit 2 with the reason of ${name} over stderr, unmarked (D-CF5-11)`, () => {
    // act
    const hookOutcome = parseHookStdout(2, stdout, "stderr reason\n", "PreToolUse");

    // assert
    assert.deepStrictEqual(hookOutcome, { kind: "block", reason });
  });
}

test("blocks exit 2 with stderr when the stdout block decision has no reason", () => {
  // act
  const hookOutcome = parseHookStdout(2, '{"decision":"block"}', "stderr reason\n", "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: "stderr reason",
    fromStderr: true,
  });
});

for (const { name, stdout, hookOutcome } of [
  {
    name: "a deny decision",
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo"}}',
    hookOutcome: { kind: "block", reason: "no echo" },
  },
  {
    name: "a block decision",
    stdout: '{"decision":"block","reason":"r"}',
    hookOutcome: { kind: "block", reason: "r" },
  },
]) {
  test(`applies ${name} that a hook prints before it exits 1 (D-CF5-11)`, (t) => {
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

    // act
    const parsed = parseHookStdout(1, stdout, "ignored stderr", "PreToolUse");

    // assert
    assert.deepStrictEqual(parsed, hookOutcome);
    assert.deepStrictEqual(
      consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
      [["[hooks] wire-protocol: non-zero exit (1); applying its JSON output"]],
    );
  });
}

for (const { name, stdout } of [
  { name: "plain", stdout: "denied, sort of" },
  { name: "invalid JSON", stdout: '{"decision":"block"' },
  { name: "a JSON array", stdout: '["deny"]' },
  { name: "JSON null", stdout: "null" },
]) {
  test(`defaults exit 1 with ${name} stdout to noop`, () => {
    // act
    const hookOutcome = parseHookStdout(1, stdout, "ignored stderr", "PreToolUse");

    // assert
    assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  });
}

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
  const stdout = "ignored plain stdout";
  const stderr = "ignored stderr";
  let hookOutcome: HookExecResult | undefined;
  let thrown: unknown;

  // act
  try {
    hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");
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
    hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");
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

for (const claudeEvent of ["UserPromptSubmit", "SessionStart"] as const) {
  test(`reads plain stdout on exit 0 as ${claudeEvent} additional context (D-CF5-13)`, () => {
    // act
    const hookOutcome = parseHookStdout(0, "  plain words\n", "ignored stderr", claudeEvent);

    // assert
    assert.deepStrictEqual(hookOutcome, { kind: "mutate", additionalContext: "plain words" });
  });
}

for (const { name, stdout } of [
  { name: "a JSON array", stdout: '["a","b"]' },
  { name: "a quoted JSON string", stdout: '"quoted"' },
  { name: "an unclosed brace", stdout: "{not closed" },
]) {
  test(`reads ${name} on exit 0 as plain UserPromptSubmit context (D-CF5-13)`, () => {
    // act
    const hookOutcome = parseHookStdout(0, stdout, "", "UserPromptSubmit");

    // assert
    assert.deepStrictEqual(hookOutcome, { kind: "mutate", additionalContext: stdout });
  });
}

test("adds no context for UserPromptSubmit stdout that is braced but not JSON", () => {
  // act
  const hookOutcome = parseHookStdout(0, "{not json}", "", "UserPromptSubmit");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

for (const claudeEvent of [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
] as const) {
  test(`ignores plain stdout on exit 0 for ${claudeEvent} and reports it (D-CF5-13)`, (t) => {
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

    // act
    const hookOutcome = parseHookStdout(0, "plain words\n", "", claudeEvent);

    // assert
    assert.deepStrictEqual(hookOutcome, { kind: "noop" });
    assert.deepStrictEqual(
      consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
      [[`[hooks] wire-protocol: plain stdout ignored on ${claudeEvent}; defaulting to noop`]],
    );
  });
}

test("parses JSON stdout on exit 0 for UserPromptSubmit as for every event", () => {
  // act
  const hookOutcome = parseHookStdout(
    0,
    '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"json ctx"}}',
    "",
    "UserPromptSubmit",
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "mutate", additionalContext: "json ctx" });
});

test("defaults empty UserPromptSubmit stdout on exit 0 to noop", () => {
  // act
  const hookOutcome = parseHookStdout(0, " \n", "", "UserPromptSubmit");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("defaults zero exit with empty stdout to noop", () => {
  // arrange
  const exitCode = 0;
  const stdout = " \n\t ";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const stdout = "{not-json}";
  const stderr = "ignored stderr";
  let hookOutcome: HookExecResult | undefined;
  let thrown: unknown;

  // act
  try {
    hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");
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
    hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");
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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepEqual(hookOutcome, { kind: "noop" });
});

test("defaults JSON null to noop", () => {
  // arrange
  const exitCode = 0;
  const stdout = "null";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepEqual(hookOutcome, { kind: "block", reason: "top block" });
});

test("gives a nested deny precedence over every mutation field and keeps its context", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nested deny","updatedInput":{"command":"ignored input"},"updatedToolOutput":{"content":"ignored output"},"additionalContext":"denied context"},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: "nested deny",
    additionalContext: "denied context",
  });
});

test("omits a wrong-type nested deny reason", () => {
  // arrange
  const exitCode = 0;
  const stdout =
    '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":["not","a","reason"],"updatedInput":{"command":"ignored input"}}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block" });
});

test("returns updated input as an exact mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{"updatedInput":{"command":"replacement input"}}}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "stop" });
});

test("omits a wrong-type top-level block reason", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"decision":"block","reason":false}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block" });
});

test("honors output suppression when nested output has no mutation", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":{},"suppressOutput":true}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop", suppressOutput: true });
});

test("ignores null nested output and nonboolean output suppression", () => {
  // arrange
  const exitCode = 0;
  const stdout = '{"hookSpecificOutput":null,"suppressOutput":"true"}';
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

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
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("returns the final noop outcome for an otherwise valid empty object", () => {
  // arrange
  const exitCode = 0;
  const stdout = "{}";
  const stderr = "ignored stderr";

  // act
  const hookOutcome = parseHookStdout(exitCode, stdout, stderr, "PreToolUse");

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
  });
});

for (const { name, stdout, hookOutcome } of [
  {
    name: "a block",
    stdout:
      '{"decision":"block","reason":"r","systemMessage":"shown","hookSpecificOutput":{"additionalContext":"ctx"}}',
    hookOutcome: { kind: "block", reason: "r", systemMessage: "shown", additionalContext: "ctx" },
  },
  {
    name: "a stop",
    stdout:
      '{"continue":false,"stopReason":"halt","systemMessage":"shown","hookSpecificOutput":{"additionalContext":"ctx"}}',
    hookOutcome: {
      kind: "stop",
      stopReason: "halt",
      systemMessage: "shown",
      additionalContext: "ctx",
    },
  },
  {
    name: "a mutation",
    stdout:
      '{"systemMessage":"shown","hookSpecificOutput":{"updatedInput":{"command":"x"},"additionalContext":"ctx"}}',
    hookOutcome: {
      kind: "mutate",
      updatedInput: { command: "x" },
      systemMessage: "shown",
      additionalContext: "ctx",
    },
  },
  {
    name: "a noop",
    stdout: '{"systemMessage":"shown","suppressOutput":true}',
    hookOutcome: { kind: "noop", suppressOutput: true, systemMessage: "shown" },
  },
]) {
  test(`keeps the system message and context on ${name} (D-CF5-13, D-CF5-14)`, () => {
    // act
    const parsed = parseHookStdout(0, stdout, "ignored stderr", "PreToolUse");

    // assert
    assert.deepStrictEqual(parsed, hookOutcome);
  });
}

test("keeps the stdout outputs on an exit-2 stderr block", () => {
  // act
  const hookOutcome = parseHookStdout(
    2,
    '{"systemMessage":"shown","hookSpecificOutput":{"additionalContext":"ctx"}}',
    "denied\n",
    "PreToolUse",
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: "denied",
    fromStderr: true,
    systemMessage: "shown",
    additionalContext: "ctx",
  });
});

test("ignores a non-string system message and context", () => {
  // act
  const hookOutcome = parseHookStdout(
    0,
    '{"systemMessage":7,"hookSpecificOutput":{"additionalContext":["ctx"]}}',
    "ignored stderr",
    "PreToolUse",
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("ignores a defer decision and reports it (D-CF5-11)", (t) => {
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

  // act
  const hookOutcome = parseHookStdout(
    0,
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"defer","permissionDecisionReason":"later"}}',
    "ignored stderr",
    "PreToolUse",
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(
    consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
    [["[hooks] wire-protocol: permissionDecision defer ignored (no deferred permission in Pi)"]],
  );
});
