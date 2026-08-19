// tests/shared/timeout.test.ts
//
// Unit tests for shared/timeout.ts -- the EXEC-02 timeout-units parser.
//
// Pins the contract: a hook handler's `timeout` is a bare number in
// SECONDS (Claude Code parity), so `2` -> 2000ms. This is the fix for the
// units mismatch that made Claude Code's `timeout: 2` (2 seconds) fire
// SIGTERM at 2ms under the bridge, silently no-op'ing every timed hook.

import assert from "node:assert/strict";
import test from "node:test";

import { parseTimeoutMs } from "../../extensions/pi-claude-marketplace/shared/timeout.ts";

const DEFAULT = 600_000;

test("bare number is interpreted as seconds (Claude Code parity)", () => {
  assert.equal(parseTimeoutMs(2, DEFAULT), 2_000);
  assert.equal(parseTimeoutMs(15, DEFAULT), 15_000);
  assert.equal(parseTimeoutMs(600, DEFAULT), 600_000);
  assert.equal(parseTimeoutMs(7200, DEFAULT), 7_200_000);
});

test("decimal second values are accepted", () => {
  assert.equal(parseTimeoutMs(1.5, DEFAULT), 1_500);
  assert.equal(parseTimeoutMs(0.25, DEFAULT), 250);
});

test("absent, null, and undefined fall back to default", () => {
  assert.equal(parseTimeoutMs(undefined, DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs(null, DEFAULT), DEFAULT);
});

test("zero and negative values fall back to default (no instant-kill)", () => {
  assert.equal(parseTimeoutMs(0, DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs(-5, DEFAULT), DEFAULT);
});

test("non-finite numbers fall back to default", () => {
  assert.equal(parseTimeoutMs(Number.NaN, DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs(Number.POSITIVE_INFINITY, DEFAULT), DEFAULT);
});

test("non-number input falls back to default (not reinterpreted as seconds)", () => {
  // Claude Code's spec is `timeout: <number>`; a string or other type is
  // malformed config and defaults rather than a silent reinterpretation.
  assert.equal(parseTimeoutMs("2", DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs("1500ms", DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs(true, DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs(false, DEFAULT), DEFAULT);
  assert.equal(parseTimeoutMs({ value: 2 }, DEFAULT), DEFAULT);
});
