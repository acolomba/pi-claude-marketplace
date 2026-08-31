// tests/bridges/hooks/timeout.test.ts
//
// Unit tests for bridges/hooks/timeout.ts -- where a hook handler's `timeout`
// is resolved against its lane and event.
//
// This file pins what THIS module decides: seconds in, seconds out; the
// per-event defaults Claude Code documents for a turn-blocking handler; the
// flat 600 s a background handler keeps; and degradation to that default for a
// value the schema admits but this module cannot use.
//
// It deliberately does NOT pin the surrounding chain. The architecture tests in
// `tests/architecture/hooks-exec.test.ts` and
// `tests/architecture/hooks-async-rewake.test.ts` pin the net conversion factor
// at each call site -- which is what would catch a second `* 1000` creeping in,
// though nothing greps for one. `tests/domain/components/hooks.test.ts` pins
// that a handler carrying a quoted number survives schema validation and the
// drop partition, which is what makes this module's non-number arms reachable.

import assert from "node:assert/strict";
import test from "node:test";

import { resolveTimeoutSeconds } from "../../../extensions/pi-claude-marketplace/bridges/hooks/timeout.ts";

import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

function blocking(raw: unknown, event: BucketAEvent): number {
  return resolveTimeoutSeconds({ raw, event, pluginId: "p", lane: "blocking" });
}

test("preserves a positive integer timeout", () => {
  // arrange
  const options = {
    raw: 75,
    event: "PreToolUse",
    pluginId: "integer-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 75);
});

test("preserves a positive fractional timeout", () => {
  // arrange
  const options = {
    raw: 0.25,
    event: "SessionEnd",
    pluginId: "fractional-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 0.25);
});

test("defaults a blocking UserPromptSubmit timeout to 30 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "UserPromptSubmit",
    pluginId: "prompt-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 30);
});

test("defaults a blocking SessionEnd timeout to 1.5 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "SessionEnd",
    pluginId: "session-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 1.5);
});

test("defaults another blocking event timeout to 600 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "PostToolUse",
    pluginId: "tool-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
});

test("defaults a background event timeout to 600 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "SessionEnd",
    pluginId: "background-plugin",
    lane: "background",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
});

test("absent, null, and undefined fall back to the lane+event default", () => {
  assert.equal(blocking(undefined, "PreToolUse"), 600);
  assert.equal(blocking(null, "UserPromptSubmit"), 30);
});

test("zero and negative values fall back to the default (no instant-kill)", () => {
  assert.equal(blocking(0, "PreToolUse"), 600);
  assert.equal(blocking(-5, "UserPromptSubmit"), 30);
});

test("non-finite numbers fall back to the default", () => {
  assert.equal(blocking(Number.NaN, "PreToolUse"), 600);
  assert.equal(blocking(Number.POSITIVE_INFINITY, "PreToolUse"), 600);
});

test("non-number input falls back to the default, and never disqualifies the plugin", () => {
  // Reachable from real config: the schema admits `timeout` at any type
  // (HOOK-03), so this module -- not schema validation -- is what stands
  // between a quoted number and the timer ladder.
  assert.equal(blocking("2", "PreToolUse"), 600);
  assert.equal(blocking("1500ms", "PreToolUse"), 600);
  assert.equal(blocking(true, "PreToolUse"), 600);
  assert.equal(blocking({ value: 2 }, "PreToolUse"), 600);
});

test("no upper bound here -- the ceiling belongs to the timer, not the field", () => {
  assert.equal(blocking(3_600_000, "PreToolUse"), 3_600_000);
});

test("a declared-but-unusable timeout is reported on the debug channel", () => {
  const prev = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const original = console.error;
  const lines: string[] = [];
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  console.error = (...args: unknown[]): void => {
    lines.push(args.join(" "));
  };

  try {
    resolveTimeoutSeconds({
      raw: "30",
      event: "UserPromptSubmit",
      pluginId: "acme",
      lane: "blocking",
    });
    // Absence is not a degrade: most handlers declare no timeout at all.
    resolveTimeoutSeconds({
      raw: undefined,
      event: "PreToolUse",
      pluginId: "acme",
      lane: "blocking",
    });
  } finally {
    console.error = original;
    if (prev === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prev;
    }
  }

  assert.equal(lines.length, 1, "declared-but-unusable values log; absence does not");
  assert.match(lines[0] ?? "", /unusable timeout "30" on acme\/UserPromptSubmit \(blocking\)/);
  assert.match(lines[0] ?? "", /using the 30s default/);
});
