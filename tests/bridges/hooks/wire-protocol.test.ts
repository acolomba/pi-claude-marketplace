import assert from "node:assert/strict";
import test from "node:test";

import { parseHookStdout } from "../../../extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";

/**
 * D-60-01: wire-protocol parse table. Each fixture pins one branch of
 * `parseHookStdout`'s wire-protocol-to-outcome mapping. The parser
 * NEVER throws -- malformed JSON, signal-kill exits, unrecognized
 * shapes all fall back to `noop` (the v1.13 permissive default).
 */

interface Fixture {
  readonly name: string;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly expected: HookExecResult;
}

const FIXTURES: readonly Fixture[] = [
  {
    name: "exit 2 + stderr 'denied' -> block with reason",
    exitCode: 2,
    stdout: "",
    stderr: "denied",
    expected: { kind: "block", reason: "denied" },
  },
  {
    name: "exit 2 + empty stderr -> block without reason",
    exitCode: 2,
    stdout: "",
    stderr: "",
    expected: { kind: "block" },
  },
  {
    name: "exit 0 + empty stdout -> noop",
    exitCode: 0,
    stdout: "",
    stderr: "",
    expected: { kind: "noop" },
  },
  {
    name: "exit 0 + non-JSON stdout -> noop (parse failure path)",
    exitCode: 0,
    stdout: "hello",
    stderr: "",
    expected: { kind: "noop" },
  },
  {
    name: "exit 0 + continue:false JSON -> stop",
    exitCode: 0,
    stdout: '{"continue":false,"stopReason":"X"}',
    stderr: "",
    expected: { kind: "stop", stopReason: "X" },
  },
  {
    name: "exit 0 + decision:block JSON -> block",
    exitCode: 0,
    stdout: '{"decision":"block","reason":"R"}',
    stderr: "",
    expected: { kind: "block", reason: "R" },
  },
  {
    name: "exit 0 + permissionDecision:deny -> block with permissionDecisionReason",
    exitCode: 0,
    stdout: '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"R"}}',
    stderr: "",
    expected: { kind: "block", reason: "R" },
  },
  {
    name: "exit 0 + updatedInput+additionalContext -> mutate",
    exitCode: 0,
    stdout: '{"hookSpecificOutput":{"updatedInput":{"a":1},"additionalContext":"X"}}',
    stderr: "",
    expected: { kind: "mutate", updatedInput: { a: 1 }, additionalContext: "X" },
  },
  {
    name: "exit 0 + updatedToolOutput -> mutate",
    exitCode: 0,
    stdout: '{"hookSpecificOutput":{"updatedToolOutput":{"b":2}}}',
    stderr: "",
    expected: { kind: "mutate", updatedToolOutput: { b: 2 } },
  },
  {
    name: "exit 1 -> noop (permissive non-zero default)",
    exitCode: 1,
    stdout: "",
    stderr: "noise",
    expected: { kind: "noop" },
  },
  {
    name: "exit null (signal-kill) -> noop",
    exitCode: null,
    stdout: "",
    stderr: "",
    expected: { kind: "noop" },
  },
];

for (const fixture of FIXTURES) {
  test(`parseHookStdout: ${fixture.name}`, () => {
    const result = parseHookStdout(fixture.exitCode, fixture.stdout, fixture.stderr);
    assert.deepEqual(result, fixture.expected);
  });
}
