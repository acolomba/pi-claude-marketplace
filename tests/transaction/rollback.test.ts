import assert from "node:assert/strict";
import test from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { formatRollbackError } from "../../extensions/pi-claude-marketplace/transaction/rollback.ts";

import type { RunPhasesResult } from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

/**
 * D-03 / AS-4 / ES-4 -- formatRollbackError body composition.
 *
 * formatRollbackError is the single chokepoint for the rollback-partial
 * user-visible message body. Per Plan 13-02a-02 / CMC-17 the body uses
 * the closed-set CMC-11 token vocabulary hand-composed inline (parent
 * `(failed) {rollback partial}` + 2-space-indented per-phase children of
 * the form `[<phase>] (rollback failed) {rollback partial}`).
 *
 * Tests verify (a) zero-partial fast path returns the original error
 * instance unchanged, (b) the composed body uses the closed-set tokens
 * byte-for-byte, (c) ES-4 cause chain is set so downstream notifyError
 * can traverse to the original, (d) PathContainmentError /
 * SymlinkRefusedError bypass returns the original instance verbatim.
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

test("D-03 / AS-4 formatRollbackError: 2 partials emit rendered rollback-partial shape", () => {
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
  // Closed-set CMC-11 parent token (catalog form per
  // docs/output-catalog.md L330).
  assert.ok(
    got.message.includes("(failed) {rollback partial}"),
    `expected parent token; got: "${got.message}"`,
  );
  // Bracketed per-phase children with the closed-set status token
  // `(rollback failed)` + `{rollback partial}` reason (catalog form per
  // docs/output-catalog.md L330-333).
  assert.ok(
    got.message.includes("[skills/prompts] (rollback failed) {rollback partial}"),
    `expected skills/prompts child; got: "${got.message}"`,
  );
  assert.ok(
    got.message.includes("[agents] (rollback failed) {rollback partial}"),
    `expected agents child; got: "${got.message}"`,
  );
  // Original error message preserved at the start of the body.
  assert.ok(
    got.message.startsWith("staging failed"),
    `expected original message at start; got: "${got.message}"`,
  );
});

test("D-03 formatRollbackError: 1 partial produces single rendered child row", () => {
  const original = new Error("base");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "reason" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // F-4 tightening (Plan 13-02a-02): explicit per-phase child token plus
  // parent token; both byte-for-byte against the closed-set form.
  assert.ok(
    got.message.includes("[p1] (rollback failed) {rollback partial}"),
    `expected single child row; got: "${got.message}"`,
  );
  assert.ok(
    got.message.includes("(failed) {rollback partial}"),
    `expected parent token; got: "${got.message}"`,
  );
  // F-4 (case-insensitive guard): legacy free-text prose with a
  // colon-prefixed marker form (the retired ES-5 shape) or `reason: foo`
  // MUST NOT seep back into the rendered body. The token vocabulary is
  // the closed CMC-11 set (`{rollback partial}` as a Reason block, NOT
  // `reason:` prose).
  assert.ok(
    !got.message.toLowerCase().includes("reason"),
    `legacy "reason:" prose detected; got: "${got.message}"`,
  );
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

test("D-03 single-chokepoint: rendered shape is composed via hand-composed inline tokens", () => {
  const original = new Error("x");
  const result: RunPhasesResult = {
    ok: false,
    error: original,
    rollbackPartials: [{ phase: "p1", msg: "x" }],
    leaks: [],
  };
  const got = formatRollbackError(result, original);
  // Hand-composed inline body using the closed-set CMC-11 token
  // vocabulary mirrors the `composeRollbackPartialBody` precedent in
  // `orchestrators/plugin/install.ts:802-839`. Verify the parent token
  // AND the child token AND the child's status discriminator all
  // present byte-for-byte.
  assert.ok(
    got.message.includes("(failed) {rollback partial}"),
    `expected parent token; got: "${got.message}"`,
  );
  assert.ok(got.message.includes("[p1]"), `expected child phase label; got: "${got.message}"`);
  assert.ok(
    got.message.includes("(rollback failed) {rollback partial}"),
    `expected child status + reason; got: "${got.message}"`,
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
 * suppress it and return the originalError reference unchanged.
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
  // Verbatim return -- NOT wrapped.
  assert.strictEqual(got, original, "expected the original PathContainmentError reference");
  // The new rendered token MUST NOT be composed onto the message.
  assert.equal(
    got.message.includes("(failed) {rollback partial}"),
    false,
    `rollback-partial token leaked into PathContainmentError message: "${got.message}"`,
  );
  // Type discrimination preserved (name + instanceof) so downstream
  // notifyError can still identify a containment violation.
  assert.equal(got.name, "PathContainmentError");
  assert.ok(got instanceof PathContainmentError);
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
  assert.strictEqual(got, original, "expected the original SymlinkRefusedError reference");
  assert.equal(
    got.message.includes("(failed) {rollback partial}"),
    false,
    `rollback-partial token leaked into SymlinkRefusedError message: "${got.message}"`,
  );
  assert.equal(got.name, "SymlinkRefusedError");
  // Subclass relationship intact -- one instanceof at the chokepoint
  // catches both (Phase 1 D-17 contract).
  assert.ok(
    got instanceof PathContainmentError,
    "SymlinkRefusedError must remain an instance of PathContainmentError",
  );
  assert.ok(got instanceof SymlinkRefusedError);
});

/**
 * Plan 13-02a-02 / CMC-17 byte-equivalence test.
 *
 * The hand-composed inline body produced by formatRollbackError reuses
 * the SAME closed-set CMC-11 token vocabulary that
 * `presentation/rollback-partial.ts::renderRollbackPartial` produces (per
 * docs/output-catalog.md L330-333 catalog form). This test asserts the
 * exact body shape so a future refactor cannot silently drift the
 * transaction-layer chokepoint away from the catalog-conformant rendered
 * form.
 *
 * The free-text `msg` fields on each RollbackPartial surface ONLY via
 * the ES-4 Error.cause chain (preserved by the original error message);
 * they are intentionally NOT embedded in the rendered child rows
 * themselves (per the closed-set CMC-11 narrowing; the phaseLabel +
 * status pair carries the user-visible failure shape).
 */
test("Plan 13-02a-02 / CMC-17: rendered body is byte-equivalent to the catalog form for a 2-phase rollback", () => {
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
  // Byte-exact catalog form (parent + 2-space-indented children).
  const expected =
    "staging failed\n\n(failed) {rollback partial}\n" +
    "  [skills/prompts] (rollback failed) {rollback partial}\n" +
    "  [agents] (rollback failed) {rollback partial}";
  assert.equal(got.message, expected, `body drift; got: "${got.message}"`);
  // Free-text `msg` fields MUST NOT appear in the rendered child rows
  // themselves (per CMC-11 closed-set narrowing; the orchestrator's
  // notify-boundary cause-chain trailer surfaces them).
  assert.ok(
    !got.message.includes("rm failed"),
    `unexpected free-text msg "rm failed" in body: "${got.message}"`,
  );
  assert.ok(
    !got.message.includes("index unreadable"),
    `unexpected free-text msg "index unreadable" in body: "${got.message}"`,
  );
});
