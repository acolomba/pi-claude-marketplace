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
import { BUCKET_A_EVENTS } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

/** The events Claude Code lowers the `command` default on. */
const LOWERED: readonly BucketAEvent[] = ["UserPromptSubmit", "SessionEnd"];

/**
 * Everything else. Derived rather than listed: `satisfies` only checks that
 * each element IS a BucketAEvent, so a hand-written list silently stops
 * covering a newly-admitted event while still compiling.
 */
const UNLOWERED: readonly BucketAEvent[] = BUCKET_A_EVENTS.filter((e) => !LOWERED.includes(e));

test("the derived UNLOWERED set is non-empty and complements LOWERED", () => {
  // Without this, widening LOWERED to every event would leave the two
  // loop-driven tests below iterating nothing and passing having asserted
  // nothing at all.
  assert.equal(UNLOWERED.length, BUCKET_A_EVENTS.length - LOWERED.length);
  assert.ok(UNLOWERED.length > 0);
});

function blocking(raw: unknown, event: BucketAEvent): number {
  return resolveTimeoutSeconds({ raw, event, pluginId: "p", lane: "blocking" });
}

function background(raw: unknown, event: BucketAEvent): number {
  return resolveTimeoutSeconds({ raw, event, pluginId: "p", lane: "background" });
}

test("a positive number is the handler's own value, in seconds, unconverted", () => {
  assert.equal(blocking(2, "PreToolUse"), 2);
  assert.equal(blocking(600, "PreToolUse"), 600);
  assert.equal(blocking(7200, "PreToolUse"), 7200);
});

test("decimal second values are accepted", () => {
  assert.equal(blocking(1.5, "PreToolUse"), 1.5);
  assert.equal(blocking(0.25, "PreToolUse"), 0.25);
});

test("a declared value wins over the event default, including where it is lower", () => {
  assert.equal(blocking(120, "UserPromptSubmit"), 120);
  assert.equal(blocking(45, "SessionEnd"), 45);
});

test("blocking lane: 600 s on every event Claude Code does not lower", () => {
  for (const event of UNLOWERED) {
    assert.equal(blocking(undefined, event), 600, `${event} default`);
  }
});

test("blocking lane: UserPromptSubmit lowers to 30 s, as Claude Code does", () => {
  assert.equal(blocking(undefined, "UserPromptSubmit"), 30);
});

test("blocking lane: SessionEnd lowers to upstream's 1.5 s budget figure", () => {
  // Upstream describes 1.5 s as a budget shared across every SessionEnd hook,
  // and caps a longer declared timeout at 60 s. Applied per hook here and
  // uncapped; both deviations are recorded as HKTO-01.
  assert.equal(blocking(undefined, "SessionEnd"), 1.5);
});

test("background lane keeps 600 s on the events the blocking lane lowers", () => {
  // Upstream lowers those budgets because the handler holds up the turn. An
  // asyncRewake handler is registered and left to run while dispatch returns,
  // so the rationale does not transfer -- and applying it would silently
  // truncate long-running background work that declared no timeout at all.
  assert.equal(background(undefined, "UserPromptSubmit"), 600);
  assert.equal(background(undefined, "SessionEnd"), 600);
  for (const event of UNLOWERED) {
    assert.equal(background(undefined, event), 600, `${event} background default`);
  }
});

test("background lane still honors a declared value", () => {
  assert.equal(background(90, "UserPromptSubmit"), 90);
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
