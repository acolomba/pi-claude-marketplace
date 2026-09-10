// tests/architecture/source-scan.test.ts
//
// Gate-the-gate coverage for the shared source-scanning mechanic in
// `source-scan.ts`. Both architecture gates that consume it (the NFR-5
// orchestrator-network gate and the COMPAT-01 no-expansion gate) assert an
// ABSENCE, so every one of their failure modes is silent: a scan that inspects
// nothing passes exactly like a scan that inspects everything and finds nothing.
// These cases pin the difference.

import assert from "node:assert/strict";
import test from "node:test";

import { MISSING_TARGET_PROBES } from "./gate-targets.ts";
import { assertNoForbiddenSurface, stripComments } from "./source-scan.ts";
import { materializeTargets, plantOffender, withTempRoot } from "./temp-root-control.ts";

import type { ScanReport } from "./source-scan.ts";

const NEVER_MATCHES = [{ name: "impossible token", pattern: /zzz-no-such-token-zzz/ }];

// The four deliberate non-paths live in the registry so a stale-path scan of
// tests/architecture/** reads one file and can tell a probe apart from a target
// that really stopped resolving (D-07-05).
const [RENAMED_AWAY, NOT_YET_WRITTEN, OTHER_MISSING, NOT_THIS_ONE] = MISSING_TARGET_PROBES;

// A real module under the test tree, which is not a production path and so is
// spelled here rather than registered.
const REAL_TARGET = "tests/architecture/source-scan.ts";

test("WR-06: a target that does not exist fails the scan instead of being skipped", async () => {
  await assert.rejects(
    () =>
      assertNoForbiddenSurface(
        [RENAMED_AWAY],
        NEVER_MATCHES,
        () => "unused: the scan never reaches the offender assertion",
      ),
    /does not exist/,
    "a renamed or deleted target must not green the gate over zero inspected files",
  );
});

test("WR-06: a not-yet-written target passes only when it is named in allowMissing", async () => {
  await assertNoForbiddenSurface([NOT_YET_WRITTEN], NEVER_MATCHES, () => "unused", {
    allowMissing: [NOT_YET_WRITTEN],
  });

  // The waiver is per-path, not a blanket opt-out.
  await assert.rejects(
    () =>
      assertNoForbiddenSurface([OTHER_MISSING], NEVER_MATCHES, () => "unused", {
        allowMissing: [NOT_THIS_ONE],
      }),
    /does not exist/,
  );
});

test("WR-06: an existing target is really inspected -- a forbidden pattern in it fails", async () => {
  await assert.rejects(
    () =>
      assertNoForbiddenSurface(
        [REAL_TARGET],
        [{ name: "the helper's own export", pattern: /assertNoForbiddenSurface/ }],
        (offenders) => `expected-failure: ${offenders.join(", ")}`,
      ),
    /expected-failure/,
  );
});

test("stripComments removes block and line comments so a gate does not match its own prose", () => {
  const stripped = stripComments(
    ["/* MUST NOT import gitOps */", "// gitOps is forbidden here", "const ok = 1;"].join("\n"),
  );
  assert.equal(stripped.includes("gitOps"), false);
  assert.match(stripped, /const ok = 1;/);
});

test("a scan with no injected root reads the repository and reports its targets in declared order", async () => {
  // arrange
  // Deliberately not alphabetical: a scan that sorted, deduplicated, or
  // otherwise rebuilt its report would pass an alphabetical list and fail here.
  const declaredTargets = ["tests/architecture/temp-root-control.ts", REAL_TARGET];
  const expectedReport: ScanReport = { visited: declaredTargets, waived: [] };

  // act
  const report = await assertNoForbiddenSurface(declaredTargets, NEVER_MATCHES, () => "unused");

  // assert
  assert.deepEqual(report, expectedReport);
});

test("an injected root replaces the repository root for every read the scan performs", async () => {
  await withTempRoot("source-scan-injected-root-", async (root) => {
    // arrange
    // D-07-01: the two assertions below are the promoted-root invariant. A root
    // that reached only half the scan -- one that still joined REPO_ROOT under
    // the read loop -- would resolve BOTH of them, because it would never open
    // the mutated copy at all.
    const targets = [REAL_TARGET];
    const plantedSurface = [{ name: "planted probe surface", pattern: /plantedProbeSurface/ }];
    await materializeTargets(root, targets);
    await plantOffender(root, REAL_TARGET, "const plantedProbeSurface = 1;");

    // act
    const realTreeReport = await assertNoForbiddenSurface(
      targets,
      plantedSurface,
      () => "unused: the real file carries no planted surface",
    );

    // assert
    assert.deepEqual(realTreeReport.visited, targets);
    await assert.rejects(
      () =>
        assertNoForbiddenSurface(
          targets,
          plantedSurface,
          (offenders) => `expected-failure: ${offenders.join(", ")}`,
          { root },
        ),
      /expected-failure/,
    );
  });
});

test("a waived target is reported as waived and is absent from the visited paths", async () => {
  // arrange
  const expectedReport: ScanReport = { visited: [REAL_TARGET], waived: [NOT_YET_WRITTEN] };

  // act
  const report = await assertNoForbiddenSurface(
    [REAL_TARGET, NOT_YET_WRITTEN],
    NEVER_MATCHES,
    () => "unused",
    { allowMissing: [NOT_YET_WRITTEN] },
  );

  // assert
  assert.deepEqual(report, expectedReport);
});

test("an empty target list resolves with nothing visited and nothing waived", async () => {
  // arrange
  // D-07-03: the scan cannot tell an empty target list from a satisfied one --
  // both reach the offender assertion with zero offenders. That is why every
  // gate separately asserts its own declared group is non-empty.
  const expectedReport: ScanReport = { visited: [], waived: [] };

  // act
  const report = await assertNoForbiddenSurface([], NEVER_MATCHES, () => "unused");

  // assert
  assert.deepEqual(report, expectedReport);
});
