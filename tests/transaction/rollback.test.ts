import assert from "node:assert/strict";
import test from "node:test";

import { ROLLBACK_PARTIAL } from "../../extensions/claude-marketplace/shared/markers.ts";
import { formatRollbackError } from "../../extensions/claude-marketplace/transaction/rollback.ts";

import type { RunPhasesResult } from "../../extensions/claude-marketplace/transaction/phase-ledger.ts";

/**
 * D-03 / AS-4 / ES-4 -- formatRollbackError marker assembly.
 *
 * formatRollbackError is the single chokepoint for the ES-5 user-contract
 * marker prefix. Tests verify (a) zero-partial fast path returns the
 * original error instance unchanged, (b) the assembled marker uses the
 * imported ROLLBACK_PARTIAL constant verbatim (D-03 single-chokepoint
 * discipline -- no inline literal), (c) ES-4 cause chain is set so
 * downstream notifyError can traverse to the original.
 */

test("D-03 formatRollbackError: empty partials returns original error unchanged", () => {
  const original = new Error("staging failed");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.strictEqual(got, original, "no partials -> same Error instance");
});

test("D-03 / AS-4 formatRollbackError: 2 partials emit ES-5 marker exactly", () => {
  const original = new Error("staging failed");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [
      { phase: "skills/prompts", msg: "rm failed" },
      { phase: "agents", msg: "index unreadable" },
    ],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  const expectedMarker = `${ROLLBACK_PARTIAL}[skills/prompts] rm failed; [agents] index unreadable)`;
  assert.ok(
    got.message.includes(expectedMarker),
    `expected message to contain "${expectedMarker}"; got: "${got.message}"`,
  );
  assert.ok(
    got.message.startsWith("staging failed"),
    `expected original message at start; got: "${got.message}"`,
  );
});

test("D-03 formatRollbackError: 1 partial produces single-element marker (no trailing semicolon)", () => {
  const original = new Error("base");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "reason" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  const expected = `${ROLLBACK_PARTIAL}[p1] reason)`;
  assert.ok(got.message.includes(expected), `got: "${got.message}"`);
  assert.ok(!got.message.includes(";"), "single partial should have no semicolon");
});

test("ES-4 formatRollbackError: new Error has cause set to originalError", () => {
  const original = new Error("base");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "x" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.strictEqual(got.cause, original);
});

test("D-03 single-chokepoint: marker prefix is the imported ROLLBACK_PARTIAL constant", () => {
  const original = new Error("x");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "x" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // The marker prefix in the message must be exactly the imported constant.
  assert.ok(
    got.message.includes(ROLLBACK_PARTIAL),
    `marker prefix drift: got "${got.message}", expected to contain "${ROLLBACK_PARTIAL}"`,
  );
});
