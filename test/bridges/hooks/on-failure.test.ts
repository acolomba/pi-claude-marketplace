import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  onFailureBlock,
  type HookExitFacts,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

const COMMAND = "${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh";

const FAILED_REASON = `[${COMMAND}]: failed; blocking because onFailure is "block"\nboom`;

const CLEAN_EXIT = {
  startFailed: false,
  timedOut: false,
  exitCode: 0,
  stdout: "",
  stderr: "boom\n",
} satisfies HookExitFacts;

const NOOP = { kind: "noop" } satisfies HookExecResult;

function guardEntry(
  handler: Readonly<Record<string, unknown>>,
  claudeEvent: BucketAEvent = "UserPromptSubmit",
): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId: "guard-plugin",
    resolvedSource: asAbsolutePluginRoot("/plugins/guard-plugin"),
    claudeEvent,
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: COMMAND, ...handler },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  };
}

function observeDebug(t: import("node:test").TestContext): string[] {
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const lines: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  });
  return lines;
}

describe("onFailureBlock with onFailure block", () => {
  const entry = guardEntry({ onFailure: "block" });

  for (const { name, facts } of [
    {
      name: "a hook that cannot start",
      facts: { ...CLEAN_EXIT, startFailed: true, exitCode: null },
    },
    { name: "exit code 1", facts: { ...CLEAN_EXIT, exitCode: 1 } },
    { name: "an exit with no code", facts: { ...CLEAN_EXIT, exitCode: null } },
    {
      name: "stdout that starts and ends a JSON object and does not parse",
      facts: { ...CLEAN_EXIT, stdout: " {not json}\n" },
    },
    {
      name: "JSON lines mixed with a broken line",
      facts: { ...CLEAN_EXIT, stdout: '{"continue":true}\n{not json}' },
    },
  ] as const) {
    test(`blocks with upstream's failed message for ${name}`, () => {
      // act
      const result = onFailureBlock(entry, facts, NOOP);

      // assert
      assert.deepStrictEqual(result, { kind: "block", reason: FAILED_REASON });
    });
  }

  test("says timed out for a hook its timeout killed", () => {
    // act
    const result = onFailureBlock(entry, { ...CLEAN_EXIT, timedOut: true, exitCode: null }, NOOP);

    // assert
    assert.deepStrictEqual(result, {
      kind: "block",
      reason: `[${COMMAND}]: timed out; blocking because onFailure is "block"\nboom`,
    });
  });

  test("ends the message at the reason when the hook printed no stderr", () => {
    // act
    const result = onFailureBlock(entry, { ...CLEAN_EXIT, exitCode: 1, stderr: " \n" }, NOOP);

    // assert
    assert.deepStrictEqual(result, {
      kind: "block",
      reason: `[${COMMAND}]: failed; blocking because onFailure is "block"`,
    });
  });

  test("quotes an absent command as empty brackets", () => {
    // arrange
    const commandless = { ...entry, handlerDecl: { type: "command", onFailure: "block" } };

    // act
    const result = onFailureBlock(commandless, { ...CLEAN_EXIT, exitCode: 1, stderr: "" }, NOOP);

    // assert
    assert.deepStrictEqual(result, {
      kind: "block",
      reason: '[]: failed; blocking because onFailure is "block"',
    });
  });

  for (const { name, facts } of [
    { name: "exit 0 with valid JSON", facts: { ...CLEAN_EXIT, stdout: '{"continue":true}' } },
    { name: "exit 0 with plain text", facts: { ...CLEAN_EXIT, stdout: "all good" } },
    {
      name: "exit 0 with text that opens a JSON object and does not close it",
      facts: { ...CLEAN_EXIT, stdout: " {not json\n" },
    },
    {
      name: "exit 0 with JSON lines",
      facts: { ...CLEAN_EXIT, stdout: '{"continue":true}\n\n{"suppressOutput":true}\n' },
    },
    { name: "exit 2", facts: { ...CLEAN_EXIT, exitCode: 2 } },
  ] as const) {
    test(`leaves ${name} to the wire protocol`, () => {
      // act
      const result = onFailureBlock(entry, facts, NOOP);

      // assert
      assert.strictEqual(result, undefined);
    });
  }

  test("leaves the JSON deny of a hook that exits 1 to apply with its own reason", (t) => {
    // arrange
    const lines = observeDebug(t);
    const deny = { kind: "block", reason: "no echo" } satisfies HookExecResult;

    // act
    const result = onFailureBlock(entry, { ...CLEAN_EXIT, exitCode: 1 }, deny);

    // assert
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(lines, [
      "[hooks] on-failure: the JSON block of a failed hook applies (guard-plugin/UserPromptSubmit)",
    ]);
  });

  test("blocks with the timed out message over the JSON deny of a hook its timeout killed", () => {
    // arrange
    const deny = { kind: "block", reason: "no echo" } satisfies HookExecResult;

    // act
    const result = onFailureBlock(entry, { ...CLEAN_EXIT, timedOut: true, exitCode: 1 }, deny);

    // assert
    assert.deepStrictEqual(result, {
      kind: "block",
      reason: `[${COMMAND}]: timed out; blocking because onFailure is "block"\nboom`,
    });
  });

  test("blocks a hook that exits 1 whose JSON allows the call", () => {
    // arrange
    const allow = { kind: "mutate", permissionDecision: "allow" } satisfies HookExecResult;

    // act
    const result = onFailureBlock(entry, { ...CLEAN_EXIT, exitCode: 1 }, allow);

    // assert
    assert.deepStrictEqual(result, { kind: "block", reason: FAILED_REASON });
  });
});

describe("onFailureBlock without onFailure block", () => {
  for (const { name, handler } of [
    { name: "no onFailure", handler: {} },
    { name: "onFailure continue", handler: { onFailure: "continue" } },
    { name: "an unknown onFailure", handler: { onFailure: "stop" } },
  ] as const) {
    test(`changes nothing for a failing hook with ${name}`, () => {
      // act
      const result = onFailureBlock(guardEntry(handler), { ...CLEAN_EXIT, exitCode: 1 }, NOOP);

      // assert
      assert.strictEqual(result, undefined);
    });
  }

  for (const { name, entry, debugLine } of [
    {
      name: "a Stop hook",
      entry: guardEntry({ onFailure: "block" }, "Stop"),
      debugLine: '[hooks] on-failure: onFailure "block" ignored on Stop (guard-plugin/Stop)',
    },
    {
      name: "an async hook",
      entry: guardEntry({ onFailure: "block", async: true }),
      debugLine:
        '[hooks] on-failure: onFailure "block" ignored on an async hook (guard-plugin/UserPromptSubmit)',
    },
    {
      name: "an asyncRewake hook",
      entry: guardEntry({ onFailure: "block", asyncRewake: true }),
      debugLine:
        '[hooks] on-failure: onFailure "block" ignored on an async hook (guard-plugin/UserPromptSubmit)',
    },
  ] as const) {
    test(`ignores onFailure block on ${name} with a debug line`, (t) => {
      // arrange
      const lines = observeDebug(t);

      // act
      const result = onFailureBlock(entry, { ...CLEAN_EXIT, exitCode: 1 }, NOOP);

      // assert
      assert.strictEqual(result, undefined);
      assert.deepStrictEqual(lines, [debugLine]);
    });
  }
});
