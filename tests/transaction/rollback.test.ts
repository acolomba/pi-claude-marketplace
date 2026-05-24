import assert from "node:assert/strict";
import test from "node:test";

import { composeRollbackPartialChildren } from "../../extensions/pi-claude-marketplace/presentation/rollback-partial.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { formatRollbackError } from "../../extensions/pi-claude-marketplace/transaction/rollback.ts";

import type { RunPhasesResult } from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

/**
 * D-03 / AS-4 / ES-4 / D-14-04 -- formatRollbackError structured result.
 *
 * Plan 14-06 refactor (orchestrator-owns-rendering per RESEARCH.md
 * Pitfall 6): formatRollbackError no longer composes the user-visible
 * body. It returns a structured `RollbackErrorResult` -- the original
 * (or cause-wrapped) Error PLUS the raw `RollbackPartial[]` data so the
 * orchestrator can render via `presentation/rollback-partial.ts`.
 *
 * The transaction layer cannot import from presentation/ (BLOCK C /
 * D-11), so the rendering moves to the orchestrator side. The pre-Plan-
 * 14-06 hand-composed `(failed) {rollback partial}` body is gone from
 * the transaction-layer code; MSG-RP-1 (Plan 14-05) catches any
 * re-introduction.
 *
 * Tests verify (a) zero-partial fast path returns the original Error
 * instance unwrapped with an empty partials array, (b) the cause-wrapped
 * Error preserves the original .message and sets .cause, (c) the raw
 * `rollbackPartials` array is forwarded verbatim, (d) PathContainmentError
 * / SymlinkRefusedError bypass returns the original instance verbatim
 * with an empty partials array, (e) the bare-children composer in
 * `presentation/rollback-partial.ts` produces the byte-equivalent
 * `[<phase>] (rollback failed) {rollback partial}` children block the
 * pre-refactor inline composer produced.
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
  // Raw partials forwarded verbatim -- orchestrator consumes this array
  // to render the children block via composeRollbackPartialChildren.
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
  // F-4 (case-insensitive guard): no legacy free-text prose with a
  // colon-prefixed marker form (retired ES-5 shape) seeps back into the
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
  // or child rendering -- those are the orchestrator's responsibility
  // (Plan 14-06 / RESEARCH.md Pitfall 6).
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
 * subclass per Phase 1 D-17). The violation surfaces verbatim instead
 * of being folded into the rollback-partial body, so every mutating
 * orchestrator (install / update / uninstall) inherits PI-14 compliance
 * from this single chokepoint.
 *
 * These tests deliberately pass a non-empty `rollbackPartials` array so
 * the pre-D-02 code path would compose the body; the bypass MUST
 * suppress it -- in the D-14-04 refactor, suppression means returning
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
  // catches both (Phase 1 D-17 contract).
  assert.ok(
    got.error instanceof PathContainmentError,
    "SymlinkRefusedError must remain an instance of PathContainmentError",
  );
  assert.ok(got.error instanceof SymlinkRefusedError);
});

/**
 * Plan 14-06 / D-14-04 byte-equivalence test for the orchestrator-side
 * children-block composer.
 *
 * The bare-children helper (`composeRollbackPartialChildren`) lives in
 * `presentation/rollback-partial.ts` and produces a string that the
 * orchestrator stitches under its own `(failed) {rollback partial}`
 * parent line. The output MUST be byte-equal to what the pre-Plan-
 * 14-06 `transaction/rollback.ts` hand-composed inline at its
 * `childLines` step (docs/output-catalog.md L330-333 catalog form).
 *
 * The free-text `msg` fields on each RollbackPartial surface ONLY via
 * the ES-4 Error.cause chain (preserved by the original error message);
 * they are intentionally NOT embedded in the rendered child rows
 * themselves (per the closed-set CMC-11 narrowing; the phaseLabel +
 * status pair carries the user-visible failure shape).
 */
test("Plan 14-06 / D-14-04: composeRollbackPartialChildren produces the byte-equivalent catalog children block", () => {
  const partials = [
    { phase: "skills/prompts", msg: "rm failed" },
    { phase: "agents", msg: "index unreadable" },
  ] as const;
  const got = composeRollbackPartialChildren(partials);
  const expected =
    "  [skills/prompts] (rollback failed) {rollback partial}\n" +
    "  [agents] (rollback failed) {rollback partial}";
  assert.equal(got, expected, `children block drift; got: "${got}"`);
  // Free-text `msg` fields MUST NOT appear in the rendered child rows
  // themselves (per CMC-11 closed-set narrowing; the orchestrator's
  // notify-boundary cause-chain trailer surfaces them).
  assert.ok(
    !got.includes("rm failed"),
    `unexpected free-text msg "rm failed" in children block: "${got}"`,
  );
  assert.ok(
    !got.includes("index unreadable"),
    `unexpected free-text msg "index unreadable" in children block: "${got}"`,
  );
});

test("Plan 14-06 / D-14-04: composeRollbackPartialChildren returns empty string for zero partials", () => {
  assert.equal(composeRollbackPartialChildren([]), "");
});

test("Plan 14-06 / D-14-04: composeRollbackPartialChildren handles a single partial", () => {
  const got = composeRollbackPartialChildren([{ phase: "p1" }]);
  assert.equal(got, "  [p1] (rollback failed) {rollback partial}");
});
