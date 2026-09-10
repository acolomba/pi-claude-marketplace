import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, assertNoForbiddenSurface, stripComments } from "./source-scan.ts";

/**
 * tests/architecture/workflows-update-placed-names.test.ts -- WLIF-02 / WR-01:
 * the update orchestrator learns which workflow envelopes are at their targets
 * from the COMMIT, never from a commit that threw.
 *
 * The invariant:
 *   `commitPreparedWorkflows` reports the placed names through its `onPlaced`
 *   callback, which fires exactly once -- on the success path AND before the
 *   throw on every failure path. A refusal, an inspection failure inside the
 *   occupancy check, and a fully-reversed rollback all place NOTHING. So on the
 *   arm where the commit did not complete, the persisted `resources.workflows`
 *   set must be the pre-update inventory unioned with what the CALLBACK
 *   reported, and never the prepare-time `stagedNames` intent. Deriving that
 *   arm from the intent names an envelope that is not on disk -- and on the
 *   refusal path names the foreign file the commit declined to replace, which
 *   is worse than a phantom: it claims ownership of somebody else's bytes.
 *   `retiresWorkflowCommand` then stamps a false `{stale workflow command}` on
 *   the next update and `info` lists the phantom entries verbatim.
 *
 * What this gate does NOT claim:
 *   That `stagedNames` is absent from `update.ts`. It is legitimately the
 *   record source on the arm where the commit RAN to completion -- there the
 *   truth is exactly what it staged -- and it is legitimately the pre-update
 *   inventory input to the workflows-difference row. A whole-file refusal of
 *   the token would be red on a correct tree, so this gate refuses the two
 *   SHAPES that source a placed-name answer from the prepare, and separately
 *   requires the callback wiring and the failure-arm read to still be present.
 *
 * Why a required-surface half exists at all:
 *   A forbidden-token gate alone is satisfied by DELETING the mechanism. Drop
 *   the `onPlaced` wiring and the failure arm reduces to the previous inventory
 *   with no commit-time contribution at all -- no forbidden shape appears, and
 *   the gate greens over a regression. The presence assertions are what make
 *   removal red, and they are the half the behavioral case in
 *   `tests/orchestrators/plugin/update.test.ts` cannot cover for a code path it
 *   does not exercise.
 *
 * Both sides are asserted NON-EMPTY before anything is compared. An unreadable
 * or emptied `update.ts` must fail loudly as an unbound gate rather than pass
 * over zero inspected bytes -- the WR-06 failure mode `./source-scan.ts` names.
 *
 * stripComments rationale (mandatory):
 *   `update.ts` explains this very rule in its own header and in the comment
 *   above the record write, naming `stagedNames`, `placedNames` and `onPlaced`
 *   in prose. Matching an unstripped file would judge the documentation rather
 *   than the code.
 */
const UPDATE_ORCHESTRATOR = "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";

/**
 * The shapes that would source a placed-name answer from the prepare-time
 * intent. Each is anchored to the placed-name vocabulary on one side and the
 * staged vocabulary on the other, within a single statement (no newline and no
 * `;` crossed), so the pair has to appear in one expression to match.
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: "placed-name binding fed from the prepare-time staged intent",
    pattern: /\bplacedNames\b[^;\n]*\bstagedNames\b/,
  },
  {
    name: "failure-arm record union fed from the prepare-time staged intent",
    pattern: /\bpreviousWorkflowNames\b[^;\n]*\bstagedNames\b/,
  },
];

/**
 * The mechanisms whose DELETION the forbidden half cannot see. Each entry is a
 * shape, not a bare token, so renaming the surface out from under it is red.
 */
const REQUIRED_SURFACES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: "the bridge's onPlaced callback, wired at the commit call",
    pattern: /\bonPlaced\s*:\s*\(/,
  },
  {
    name: "the failure arm reading the commit-reported placed names",
    pattern: /\bpreviousWorkflowNames\b[^;\n]*\bplacedNames\b/,
  },
];

test("WLIF-02 + WR-01: update records workflow names the commit reported, not the prepare's intent", async () => {
  // arrange -- read the module once and prove the gate is bound to real bytes
  // before any pattern decides anything.
  const src = stripComments(await readFile(path.join(REPO_ROOT, UPDATE_ORCHESTRATOR), "utf8"));
  assert.ok(
    src.trim().length > 0,
    `WLIF-02 unbound gate: ${UPDATE_ORCHESTRATOR} stripped to nothing, so every assertion below would pass over zero inspected bytes.`,
  );

  // assert -- the mechanism is still there. Checked FIRST: a deletion makes the
  // forbidden half vacuously green, so reporting the absence is the more
  // truthful diagnosis of that tree.
  for (const { name, pattern } of REQUIRED_SURFACES) {
    assert.ok(
      pattern.test(src),
      `WLIF-02 / WR-01 violation: ${UPDATE_ORCHESTRATOR} no longer carries ${name} (${String(pattern)}). Without it the persisted workflow names on the commit-failed arm carry no commit-time contribution, so a refusal or a reversed rollback is recorded as though the envelopes were placed.`,
    );
  }

  // assert -- and no code path sources a placed-name answer from the prepare.
  // The read / stripComments / offender-accumulate mechanic is shared with the
  // sibling gates (D-98-09); the target, the patterns and this message stay
  // owned here.
  await assertNoForbiddenSurface(
    [UPDATE_ORCHESTRATOR],
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `WLIF-02 / WR-01 violation: prepare-time workflow names reached a placed-name answer:\n  ${offenders.join("\n  ")}\n  (the prepared names are an INTENT. A refusal, an occupancy-inspection failure and a fully-reversed rollback all place nothing, so recording the intent names envelopes that are not on disk -- and on the refusal path names the foreign file the commit declined to replace. The commit reports what it placed through onPlaced; read that.)`,
  );
});
