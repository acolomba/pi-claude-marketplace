import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { LIFECYCLE_ENABLED_READ_TARGETS } from "./gate-targets.ts";
import { assertNoForbiddenSurface, REPO_ROOT } from "./source-scan.ts";
import {
  materializeTargets,
  plantBenignNearMiss,
  plantOffender,
  withTempRoot,
} from "./temp-root-control.ts";

/**
 * DFEN-07 architectural surface guard (D-103-08, D-103-09).
 *
 * Forbidden surface, by file:
 *   - the update flow, preflight, and swap owners
 *     MUST NOT reference `defaultEnabled` or `applyDefaultEnabled`.
 *   - the reinstall flow owner and retained sequencer MUST NOT reference
 *     `defaultEnabled` or `applyDefaultEnabled`.
 *
 * The gated set lives in `LIFECYCLE_ENABLED_READ_TARGETS`
 * (`tests/architecture/gate-targets.ts`, D-07-05), which is the authoritative
 * list and carries its own membership rule beside it. Restating the four paths
 * here would give the obligation two homes that drift apart.
 *
 * Why these update owners and reinstall: a plugin release that changes the declared field must
 * not move a user who already installed. `defaultEnabled` is third-party
 * content -- a lifecycle verb that re-consulted it would turn the field into a
 * remote switch over code that is already on disk. Both verbs re-materialize
 * artifacts and both hold a resolved plugin object that CARRIES the field, so
 * the guarantee is precisely that neither reads it off. That guarantee is
 * negative: nothing observable changes until the read already exists, which is
 * why it is defended at the source rather than only in behavior.
 *
 * Exempt files (do NOT add):
 *   - orchestrators/plugin/install-flow.ts reads the field legitimately. That read
 *     IS DFEN-04, gated by the caller opt-in and by the DFEN-05 precedence rule
 *     (an existing `enabled` value wins and is never overwritten).
 *   - orchestrators/plugin/enable-disable.ts re-materializes from the RECORD on
 *     its enable branch, never from a manifest declaration, so it never names
 *     the field either -- but it is not gated here because its subject is the
 *     user's own explicit choice, not a third-party declaration.
 *
 * The resolver carve-out:
 *   This gate forbids NAMING the field, not obtaining the object that carries
 *   it. Both targets call `resolveStrict` and must keep doing so; no pattern
 *   here mentions that call, and adding one would break both verbs for a
 *   guarantee it does not express. Neither pattern matches the resolver's own
 *   `resolveDefaultEnabled` accessor either.
 *
 * The two patterns are independent, not redundant:
 *   The short identifier is a strict suffix of the long one, and both
 *   characters at the join are word characters, so there is no word boundary
 *   between them -- a `\b`-anchored match on the short name does NOT fire
 *   inside the long one. Removing either pattern leaves a real hole.
 *
 * No target is excused as missing (WR-06). Both files exist; excusing either
 * would let a rename silently uncover the guarantee, which is the same failure
 * mode as inspecting nothing at all.
 *
 * What the gate proves, beyond the absence itself:
 *   - It VISITED what it claims to guard. The scan reports the paths it really
 *     opened and this file deep-compares them against the registry group
 *     (D-07-03), so a target that stopped resolving fails here instead of
 *     dropping out unnoticed.
 *   - It FIRES. A temp-root copy of the real targets with one mutated copy
 *     rejects (D-07-01), and the planted line is built from an identifier the
 *     target really declares, so the offender cannot drift away from the file
 *     it stands for.
 *   - It is not simply failing everything. The same copies unmutated pass, and
 *     the forbidden token planted inside a line comment also passes (D-07-04).
 *
 * Comment-strip rationale (mandatory):
 *   The shared helper strips comments before matching, so a source header that
 *   explains the absence in prose is legal. Today a raw search over both files
 *   finds neither token at all, so an unstripped gate would pass -- right up
 *   until someone documents the rule in the very file it governs, at which
 *   point the gate would fail on its own subject's prose. Delegate to the
 *   helper; never hand-roll a raw read plus a match (D-98-09, D-98-10).
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "defaultEnabled reference", pattern: /\bdefaultEnabled\b/ },
  { name: "applyDefaultEnabled reference", pattern: /\bapplyDefaultEnabled\b/ },
];

/** The gated file the temp-root controls copy, mutate, and scan. */
const CONTROL_TARGET = LIFECYCLE_ENABLED_READ_TARGETS[0];

/** First `const <name> =` binding in a module, used to derive offender text. */
const FIRST_CONST_BINDING = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=/m;

function describeLifecycleViolation(offenders: ReadonlyArray<string>): string {
  return `DFEN-07 violation: a re-materializing lifecycle verb names the declared-enablement field:\n  ${offenders.join("\n  ")}\n  (Enablement for an already-installed plugin comes from the RECORD. The manifest declaration is an install-time input only, read by the install verb alone; re-applying it would let a plugin release flip a user's existing choice.)`;
}

/**
 * Build the offending line from an identifier `target` really declares.
 *
 * D-07-01: a hand-authored offender is a claim about the target rather than a
 * fact about it, and drifts the moment the target changes shape. Reading the
 * real file for the receiver keeps the planted violation anchored to the module
 * it stands for, and the assertion below makes a failed derivation loud instead
 * of silently substituting a synthetic name.
 */
async function offenderLineFor(target: string): Promise<string> {
  const src = await readFile(path.join(REPO_ROOT, target), "utf8");
  const receiver = FIRST_CONST_BINDING.exec(src)?.[1];

  assert.ok(
    receiver,
    `D-07-01: ${target} declares no \`const\` binding, so the offender below would be hand-authored rather than derived from the real file.`,
  );

  return `const declaredEnablement = ${receiver}.defaultEnabled;`;
}

test("DFEN-07 (D-103-08, D-103-09): the lifecycle verbs never name the declared-enablement field", async () => {
  // act
  const report = await assertNoForbiddenSurface(
    LIFECYCLE_ENABLED_READ_TARGETS,
    FORBIDDEN_PATTERNS,
    describeLifecycleViolation,
  );

  // assert
  assert.ok(
    LIFECYCLE_ENABLED_READ_TARGETS.length > 0,
    "D-07-03: an empty target group makes the scan above report success over zero files. The group must name at least one lifecycle owner.",
  );
  assert.deepEqual(
    report.visited,
    [...LIFECYCLE_ENABLED_READ_TARGETS],
    "D-07-03: the scan must have opened every declared target. A target that was waived or stopped resolving drops out of `visited`, so this comparison is what turns an uncovered gate into a failure instead of a pass.",
  );
});

test("DFEN-07: the gate fires on a declared-enablement read planted in a copy of a real target", async () => {
  await withTempRoot("lifecycle-gate-offender-", async (root) => {
    // arrange
    await materializeTargets(root, LIFECYCLE_ENABLED_READ_TARGETS);
    await plantOffender(root, CONTROL_TARGET, await offenderLineFor(CONTROL_TARGET));

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          LIFECYCLE_ENABLED_READ_TARGETS,
          FORBIDDEN_PATTERNS,
          describeLifecycleViolation,
          { root },
        ),
      /a re-materializing lifecycle verb names the declared-enablement field/,
    );
  });
});

test("DFEN-07: unmutated copies of the same real targets pass and report every path opened", async () => {
  await withTempRoot("lifecycle-gate-benign-", async (root) => {
    // arrange
    await materializeTargets(root, LIFECYCLE_ENABLED_READ_TARGETS);

    // act
    const report = await assertNoForbiddenSurface(
      LIFECYCLE_ENABLED_READ_TARGETS,
      FORBIDDEN_PATTERNS,
      describeLifecycleViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...LIFECYCLE_ENABLED_READ_TARGETS]);
    assert.deepEqual(report.waived, []);
  });
});

test("DFEN-07: a forbidden token inside a line comment passes, so the gate still strips comments", async () => {
  await withTempRoot("lifecycle-gate-near-miss-", async (root) => {
    // arrange
    await materializeTargets(root, LIFECYCLE_ENABLED_READ_TARGETS);
    await plantBenignNearMiss(root, CONTROL_TARGET, "applyDefaultEnabled");

    // act
    const report = await assertNoForbiddenSurface(
      LIFECYCLE_ENABLED_READ_TARGETS,
      FORBIDDEN_PATTERNS,
      describeLifecycleViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...LIFECYCLE_ENABLED_READ_TARGETS]);
  });
});
