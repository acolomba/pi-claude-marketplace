---
phase: "10"
slug: "lifecycle-test-and-harness-gaps"
status: gaps_found
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-27"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test`, Cucumber, direct coverage |
| **Config file** | `package.json`, `cucumber.json` |
| **Quick run command** | `node --test <owner-test>` or `npx cucumber-js --name '<scenario>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~600 seconds |

## Sampling Rate

- **After every task commit:** Run the named owner test or scenario and direct coverage for changed source pairs.
- **After every plan wave:** Run every touched feature and source/test pair; run `npm run check:features` after shared Cucumber changes.
- **Before `$gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 120 seconds for focused checks.

## Per-Task Verification Map

The planner must give every task an exact owner-test or scenario command and an observable failing direction. Each requirement is covered by at least one automated task:

| Requirement | Primary automated proof |
|-------------|-------------------------|
| TST-01 | Named Cucumber scenarios or discriminating unit cases with a recorded harness limit |
| TST-02 | Harness owner tests plus `npm run check:features` |
| TST-03 | Install/reinstall owner tests for a record-plus-manifest seeder |
| CAS-08 | Three named install-dependency scenarios plus direct coverage |
| MIM-05 | Apply partial-rollback scenario plus direct coverage |
| XPH-01 | TUI, completion, reinstall, reconcile, and import scenarios |
| XPH-02 | A named scenario for each user-visible correction and focused unit parity cases |

## Wave 0 Requirements

- [x] PTY TUI driver and world lifecycle support.
- [x] Completion capture step/API.
- [x] Shared marketplace-record seeder for unit fixtures.
- [x] Test fixtures selecting each CAS-08 failure route.

## Manual-Only Verifications

None planned. Any unreachable behavior must carry a concrete harness-limit reason and a discriminating unit case.

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or explicit Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive tasks without automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Focused feedback latency stays below 120 seconds.
- [x] `nyquist_compliant: true` is set after execution evidence is complete.

**Approval:** complete -- `node scripts/check-phase10-coverage.mjs` validates all
56 source rows and their exact evidence commits, paths, and titles.

## Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

The integrated Phase 11 tree had renamed the owner case cited by
`LCTEST-SKIP-CACHE`. The case still asserted both no completion-cache
invalidation and no clone, but the exact-title coverage checker could no longer
find it. The title now retains the Phase 10 evidence phrase and describes the
orchestrated `unchanged` result added in Phase 11.

The audit passed `node scripts/check-phase10-coverage.mjs` (56/56 rows), the
focused marketplace-add and real-child process-tree owner cases (1/1 each), and
10 representative Cucumber scenarios (116/116 steps) on the integrated tree.

## Post-Split Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

Plan 11-06 moved the PI-6 marketplace-fixture case into the ledger pair and
split the `rootCommit` hand-off proof between planning selection and ledger
persistence. The behavioral assertions remained in place, but the coverage
ledger still named the retired monolithic owner path and title.

The ledger now cites the PI-6 ledger case and both `rootCommit` owner cases.
`node scripts/check-phase10-coverage.mjs` passes all 56 rows, and the three
focused post-split cases pass without changing implementation.

## Post-Review-Fix Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

The final install-flow boundary keeps all 56 Phase 10 evidence rows valid. The
relocated PI-6 and `rootCommit` owner cases pass. The three CAS-08 scenarios
also pass with 39 steps. Direct coverage for the public root, planning leaf,
and ledger leaf remains 100% for lines, branches, and functions.

The full `npm run check` result from `8184f337` remains valid for the current
tree because only Phase 10 review Markdown changed after that commit. It passed
1,120 scenarios, 11,411 steps, and 306 direct LCOV records. No behavior is
unverified.

## Stale-Verification Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
| Evidence rows valid | 56/56 |

The post-split coverage ledger still cited the removed ledger-owner title for
`LCTEST-ROOT-COMMIT`. The behavior remains directly owned at its current
boundaries: the dependency planner proves that the root receives
`previewedCommit`, and the public install-planning owner proves that the same
pin materializes after one mirror resolution when a dependency moves. The two
focused owner cases pass, so the ledger now cites those current tests instead
of restoring a duplicate ledger case.

`node scripts/check-phase10-coverage.mjs` passes all 56 rows.
`npm run check:features` passes. Four focused harness and fixture owners pass,
including the real-child process-tree case under process-group permissions.
Thirteen representative Cucumber scenarios pass with 162 steps across TST-01,
TST-02, CAS-08, MIM-05, XPH-01, and XPH-02. Direct coverage for the public
install root, planning leaf, and ledger leaf remains 100% for lines, branches,
and functions. TST-03 is covered by the focused manifest-first install and
reinstall fixture owners. No production or test source changed.

## Final Integrated Convergence Audit 2026-10-29

| Metric                           | Count |
| -------------------------------- | ----- |
| Gaps found                       | 1     |
| Resolved                         | 0     |
| Escalated                        | 1     |
| Evidence rows structurally valid | 56/56 |
| Must-haves behaviorally green    | 28/28 |

The integrated implementation and behavioral tests are green, but one exact
evidence pin is semantically stale. `XPH02-MOVE-DIAGNOSTICS` cites commit
`291b2df1`. At that commit, the scenario titled `Update preserves dependency
move warnings and MCP notices` attributed the dependency warning to the root
plugin `app`. Phase 9 later fixed the carrier to retain the producing
dependency and changed the same scenario to require `lib` at `741516af`; it
also added direct-update package-failure scenarios at `16e4c849` and
`db79c003`. The checker passes because it verifies that the unchanged title is
present at the cited commit, not that the committed assertion contains the
final owner contract.

Keep the existing row and ID, but update its exact evidence commit to
`741516af` and bind all three current behavioral titles:

- `features/plugin/update.feature` — `Scenario: Update preserves dependency move warnings and MCP notices`
- `features/plugin/package-dependencies.feature` — `Scenario: A direct update reports a moved dependency package failure only on that dependency`
- `features/plugin/package-dependencies.feature` — `Scenario: A direct update reports a newly installed dependency package failure once`

No implementation or test failure was found. The focused final audit passed:

- `node scripts/check-phase10-coverage.mjs`: 56/56 rows structurally valid.
- Focused Cucumber: 9/9 scenarios and 139/139 steps, covering all three
  CAS-08 routes, MIM-05, both repaired Phase 8 PTY oracles, and the final
  Phase 9 warning-owner behaviors.
- Focused owners: 10/10 passed with no skips or todos, including D-PL10-13,
  both manifest-first fixtures, the real process-tree child, Phase 6 lock-path
  redaction, and the Phase 8 config-read stop/abort races.
- Direct coverage: all 11 selected final Phase 6/8/9 source-test pairs passed
  100% line, branch, and function thresholds.
- The owner-provided exact full gate remains green on this unchanged build
  tree: 1,144 scenarios, 11,758 steps, and 309 merged LCOV records.

D-PL10-13 remains the formal superseding decision over the older Plan 01-03
literal. Its focused owner case passed; no older behavior should be restored.
