import assert from "node:assert/strict";
import test from "node:test";

import { NETWORK_FREE_CONTROL_TARGET, NETWORK_FREE_TARGETS } from "./gate-targets.ts";
import { assertNoForbiddenSurface } from "./source-scan.ts";
import {
  materializeTargets,
  plantBenignNearMiss,
  plantOffender,
  withTempRoot,
} from "./temp-root-control.ts";

import type { ScanReport } from "./source-scan.ts";

/**
 * NFR-5 / PI-2 / PL-3 / PRL-07 architectural surface guard.
 *
 * Forbidden surface:
 *   Every file named in `NETWORK_FREE_TARGETS` MUST NOT import `gitOps` /
 *   `platform/git` / `DEFAULT_GIT_OPS`, nor reference `refreshGitHubClone`.
 *   That group lives in `tests/architecture/gate-targets.ts` (D-07-05), which
 *   is the authoritative target list and carries each entry's own rationale
 *   beside it, so the set is NOT restated here -- a hand-maintained second copy
 *   of an annotated list only drifts out of step with it. The pattern list and
 *   this gate's failure wording stay owned here.
 *
 * What the gate proves, and how:
 *   - It VISITED what it claims to guard. The scan reports the paths it really
 *     opened and this file deep-compares them against the registry group
 *     (D-07-03). A target that stops resolving drops out of the report, so the
 *     comparison fails rather than greening over an uninspected file.
 *   - It FIRES. A temp-root copy of the real targets with one mutated file
 *     rejects (D-07-01), and the offender is derived from the real file, so it
 *     cannot drift away from the target it represents.
 *   - It is not simply failing everything. The same copies unmutated pass, and
 *     the forbidden token planted inside a line comment also passes (D-07-04).
 *
 * Skip-path rationale:
 *   The scan skips ENOENT targets only when they are named in `allowMissing`,
 *   which this gate never does: every target exists today.
 *
 * Why this test is NOT replaceable by a fallow boundary rule (measured):
 *   Planting `import { clone } from "platform/git.ts"` plus a `clone()` call
 *   in install-flow.ts was observed leaving `npm run fallow` at exit 0, while this
 *   test failed. Three reasons, each independent:
 *     1. `orchestrators` -> `platform` is a LEGAL edge -- update-flow.ts,
 *        clone-cache.ts and auth-host.ts all need it -- so an import rule at
 *        zone granularity cannot forbid it for three files only.
 *     2. Splitting a narrow `orchestrators-network-free` zone out was tried and
 *        produces 26 false violations, because the two halves legitimately
 *        import each other. Allowing them back lets `DEFAULT_GIT_OPS` reach
 *        install-flow.ts through the `marketplace/shared.ts` re-export anyway, so
 *        the rule would enforce nothing.
 *     3. `platform/git.ts` and `platform/pi-api.ts` share a directory, and
 *        install-flow.ts legitimately imports the latter. Fallow zones are
 *        directory-scoped, so they cannot separate the two.
 *   `boundaries.calls.forbidden` catches a CALL; this gate additionally
 *   catches an IMPORT and a bare `gitOps` field declaration, which is the
 *   surface NFR-5 actually cares about. Keep this test.
 *
 * stripComments rationale (mandatory):
 *   Source files include header docstrings that legally mention the forbidden
 *   symbols (e.g. "MUST NOT import platform/git"). Without `stripComments`,
 *   the assertion would fail on prose.
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  // OPEF-F01: the static `from` form above cannot see a specifier that arrives
  // through a call expression, so a dynamic import of the git surface would
  // pass the gate untouched. Non-global on purpose -- a /g regex carries
  // `lastIndex` across `.test()` calls and would skip every second target.
  {
    name: "dynamic import of platform/git",
    pattern: /import\(\s*["'][^"']*platform\/git[^"']*["']\s*\)/,
  },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
  { name: "refreshGitHubClone reference", pattern: /\brefreshGitHubClone\b/ },
];

function describeNetworkViolation(offenders: ReadonlyArray<string>): string {
  return `NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in network-free module(s):\n  ${offenders.join("\n  ")}\n  (every gated target is network-free by contract; among the update owners only update-flow.ts and update-preflight.ts may name gitOps via Pattern S-9 -- the flow to invoke the seam, the preflight to declare the injected \`gitOps?\` field it is handed. Every other update and list owner is gated.)`;
}

test("NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface", async () => {
  // The read / stripComments / offender-accumulate mechanic lives in
  // tests/architecture/source-scan.ts so this gate and the COMPAT-01 no-expansion
  // gate share one implementation (D-98-09). The target list, the pattern list,
  // and this failure message stay owned here.

  // act
  const report = await assertNoForbiddenSurface(
    NETWORK_FREE_TARGETS,
    FORBIDDEN_PATTERNS,
    describeNetworkViolation,
  );

  // assert
  assert.ok(
    NETWORK_FREE_TARGETS.length > 0,
    "D-07-03: an empty target group makes the scan above report success over zero files. The group must name at least one module.",
  );
  assert.deepEqual(
    report.visited,
    [...NETWORK_FREE_TARGETS],
    "D-07-03: the scan must have opened every declared target. A target that was waived or stopped resolving drops out of `visited`, so this comparison is what turns an uncovered gate into a failure instead of a pass.",
  );
});

test("NFR-5: the gate fires on a gitOps surface planted in a copy of a real target", async () => {
  await withTempRoot("network-gate-offender-", async (root) => {
    // arrange
    await materializeTargets(root, NETWORK_FREE_TARGETS);
    await plantOffender(root, NETWORK_FREE_CONTROL_TARGET, "const gitOps = DEFAULT_GIT_OPS;");

    // act & assert
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          NETWORK_FREE_TARGETS,
          FORBIDDEN_PATTERNS,
          describeNetworkViolation,
          { root },
        ),
      /gitOps surface detected in network-free module\(s\)/,
    );
  });
});

test("NFR-5: unmutated copies of the same real targets pass and report every path opened", async () => {
  await withTempRoot("network-gate-benign-", async (root) => {
    // arrange
    await materializeTargets(root, NETWORK_FREE_TARGETS);

    // act
    const report: ScanReport = await assertNoForbiddenSurface(
      NETWORK_FREE_TARGETS,
      FORBIDDEN_PATTERNS,
      describeNetworkViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...NETWORK_FREE_TARGETS]);
    assert.deepEqual(report.waived, []);
  });
});

test("NFR-5: a forbidden token inside a line comment passes, so the gate still strips comments", async () => {
  await withTempRoot("network-gate-near-miss-", async (root) => {
    // arrange
    await materializeTargets(root, NETWORK_FREE_TARGETS);
    await plantBenignNearMiss(root, NETWORK_FREE_CONTROL_TARGET, "DEFAULT_GIT_OPS");

    // act
    const report = await assertNoForbiddenSurface(
      NETWORK_FREE_TARGETS,
      FORBIDDEN_PATTERNS,
      describeNetworkViolation,
      { root },
    );

    // assert
    assert.deepEqual(report.visited, [...NETWORK_FREE_TARGETS]);
  });
});
