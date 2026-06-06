import assert from "node:assert/strict";
import test from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { formatRollbackError } from "../../extensions/pi-claude-marketplace/transaction/rollback.ts";

import type { RunPhasesResult } from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

/**
 * D-03 / AS-4 / ES-4 / D-14-04 -- formatRollbackError structured result.
 *
 * Orchestrator-owns-rendering: formatRollbackError does not compose the
 * user-visible body. It returns a structured `RollbackErrorResult` -- the
 * original (or cause-wrapped) Error PLUS the raw `RollbackPartial[]` data so
 * the orchestrator can render via the `notify` path.
 *
 * Tests verify (a) zero-partial fast path returns the original Error
 * instance unwrapped with an empty partials array, (b) the cause-wrapped
 * Error preserves the original .message and sets .cause, (c) the raw
 * `rollbackPartials` array is forwarded verbatim, (d) PathContainmentError
 * / SymlinkRefusedError bypass returns the original instance verbatim
 * with an empty partials array.
 *
 * The byte-equivalent rendering of the children block is enforced by
 * `tests/architecture/catalog-uat.test.ts` against the renderer in
 * `shared/notify.ts`.
 */

test("D-03 formatRollbackError: empty partials returns original error unchanged + empty partials array", () => {
  const original = new Error("staging failed");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.strictEqual(got.error, original, "no partials -> same Error instance");
  assert.deepEqual(got.rollbackPartials, [], "no partials -> empty array");
});

test("D-03 / AS-4 formatRollbackError: 2 partials return cause-wrapped Error + raw RollbackPartial[] data", () => {
  const original = new Error("staging failed");
  const partials = [
    { phase: "skills/prompts", msg: "rm failed" },
    { phase: "agents", msg: "index unreadable" },
  ] as const;
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: partials,
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // Original message preserved on the wrapper Error (D-14-04: rendering
  // moves to orchestrator; transaction layer just preserves the message).
  assert.equal(
    got.error.message,
    "staging failed",
    `expected original message preserved on wrapper Error; got: "${got.error.message}"`,
  );
  // ES-4 cause chain set so notifyError can traverse to the original.
  assert.strictEqual(
    got.error.cause,
    original,
    "expected cause-wrapped Error to retain reference to originalError",
  );
  // Raw partials forwarded verbatim -- the V2 notify renderer consumes
  // this array to render the children block via composeRollbackPartialLines
  // in shared/notify.ts.
  assert.equal(got.rollbackPartials.length, 2);
  assert.equal(got.rollbackPartials[0]?.phase, "skills/prompts");
  assert.equal(got.rollbackPartials[1]?.phase, "agents");
});

test("D-03 formatRollbackError: 1 partial returns cause-wrapped Error + single-element array", () => {
  const original = new Error("base");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "reason" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.equal(got.error.message, "base");
  assert.strictEqual(got.error.cause, original);
  assert.equal(got.rollbackPartials.length, 1);
  assert.equal(got.rollbackPartials[0]?.phase, "p1");
  // F-4 (case-insensitive guard): no free-text prose with a
  // colon-prefixed marker form (the ES-5 shape) seeps back into the
  // wrapper Error's message. The token vocabulary is the closed CMC-11
  // set composed on the orchestrator side, not in the wrapper.
  assert.ok(
    !got.error.message.toLowerCase().includes("reason"),
    `legacy "reason:" prose detected on wrapper Error; got: "${got.error.message}"`,
  );
});

test("ES-4 formatRollbackError: cause-wrapped Error retains originalError reference", () => {
  const original = new Error("base");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "x" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.strictEqual(got.error.cause, original);
  // Identity check: the returned Error is a fresh wrapper (NOT the
  // originalError reference) because a partial occurred.
  assert.notStrictEqual(got.error, original);
});

test("D-14-04 orchestrator-owns-rendering: transaction layer no longer composes the user-visible body", () => {
  const original = new Error("x");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "x" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // The transaction-layer chokepoint MUST NOT include the parent token
  // or child rendering -- those are the orchestrator's responsibility.
  assert.ok(
    !got.error.message.includes("(failed) {rollback partial}"),
    `parent token leaked into transaction-layer wrapper Error: "${got.error.message}"`,
  );
  assert.ok(
    !got.error.message.includes("(rollback failed)"),
    `child token leaked into transaction-layer wrapper Error: "${got.error.message}"`,
  );
});

/**
 * D-02 / PI-14 -- formatRollbackError MUST short-circuit when the
 * originalError is a PathContainmentError (or its SymlinkRefusedError
 * subclass per D-17). The violation surfaces verbatim instead
 * of being folded into the rollback-partial body, so every mutating
 * orchestrator (install / update / uninstall) inherits PI-14 compliance
 * from this single chokepoint.
 *
 * These tests deliberately pass a non-empty `rollbackPartials` array;
 * the bypass MUST suppress it (D-14-04) -- suppression means returning
 * the originalError reference + an EMPTY partials array so the
 * orchestrator skips rendering entirely.
 */
test("PI-14 / D-02: PathContainmentError originalError bypasses rollback-partial wrapping", () => {
  const original = new PathContainmentError("/scope-root", "/escaped/path", "test");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "skills", msg: "leak" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // Verbatim return -- NOT cause-wrapped.
  assert.strictEqual(got.error, original, "expected the original PathContainmentError reference");
  // Empty partials array -- orchestrator MUST skip the children block.
  assert.deepEqual(
    got.rollbackPartials,
    [],
    "expected empty partials array under PathContainmentError bypass",
  );
  // Type discrimination preserved (name + instanceof) so downstream
  // notifyError can still identify a containment violation.
  assert.equal(got.error.name, "PathContainmentError");
  assert.ok(got.error instanceof PathContainmentError);
});

test("PI-14 / D-02: SymlinkRefusedError (subclass) bypasses rollback-partial wrapping", () => {
  const original = new SymlinkRefusedError(
    "/scope",
    "/scope/link/escaped",
    "test",
    "/scope/link",
    "/escaped",
  );
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "agents", msg: "leak" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  assert.strictEqual(got.error, original, "expected the original SymlinkRefusedError reference");
  assert.deepEqual(got.rollbackPartials, [], "expected empty partials array under bypass");
  assert.equal(got.error.name, "SymlinkRefusedError");
  // Subclass relationship intact -- one instanceof at the chokepoint
  // catches both (D-17 contract).
  assert.ok(
    got.error instanceof PathContainmentError,
    "SymlinkRefusedError must remain an instance of PathContainmentError",
  );
  assert.ok(got.error instanceof SymlinkRefusedError);
});

// D-21-02: `composeRollbackPartialLines` in `shared/notify.ts` owns the
// rollback children-block grammar, and `tests/architecture/catalog-uat.test.ts`
// asserts byte-equality against the catalog fixtures.
