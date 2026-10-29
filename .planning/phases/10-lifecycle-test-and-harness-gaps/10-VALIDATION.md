---
phase: "10"
slug: "lifecycle-test-and-harness-gaps"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-27"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property               | Value                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Framework**          | Node `node:test`, Cucumber, direct coverage                         |
| **Config file**        | `package.json`, `cucumber.json`                                     |
| **Quick run command**  | `node --test <owner-test>` or `npx cucumber-js --name '<scenario>'` |
| **Full suite command** | `npm run check`                                                     |
| **Estimated runtime**  | ~600 seconds                                                        |

## Sampling Rate

- **After every task commit:** Run the named owner test or scenario and direct coverage for changed source pairs.
- **After every plan wave:** Run every touched feature and source/test pair; run `npm run check:features` after shared Cucumber changes.
- **Before `$gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 120 seconds for focused checks.

## Per-Task Verification Map

The planner must give every task an exact owner-test or scenario command and an observable failing direction. Each requirement is covered by at least one automated task:

| Requirement | Primary automated proof                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| TST-01      | Named Cucumber scenarios or discriminating unit cases with a recorded harness limit |
| TST-02      | Harness owner tests plus `npm run check:features`                                   |
| TST-03      | Install/reinstall owner tests for a record-plus-manifest seeder                     |
| CAS-08      | Three named install-dependency scenarios plus direct coverage                       |
| MIM-05      | Apply partial-rollback scenario plus direct coverage                                |
| XPH-01      | TUI, completion, reinstall, reconcile, and import scenarios                         |
| XPH-02      | A named scenario for each user-visible correction and focused unit parity cases     |

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

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 1     |
| Resolved   | 1     |
| Escalated  | 0     |

The integrated Phase 11 tree had renamed the owner case cited by
`LCTEST-SKIP-CACHE`. The case still asserted both no completion-cache
invalidation and no clone, but the exact-title coverage checker could no longer
find it. The title now retains the Phase 10 evidence phrase and describes the
orchestrated `unchanged` result added in Phase 11.

The audit passed `node scripts/check-phase10-coverage.mjs` (56/56 rows), the
focused marketplace-add and real-child process-tree owner cases (1/1 each), and
10 representative Cucumber scenarios (116/116 steps) on the integrated tree.

## Post-Split Validation Audit 2026-10-28

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 2     |
| Resolved   | 2     |
| Escalated  | 0     |

Plan 11-06 moved the PI-6 marketplace-fixture case into the ledger pair and
split the `rootCommit` hand-off proof between planning selection and ledger
persistence. The behavioral assertions remained in place, but the coverage
ledger still named the retired monolithic owner path and title.

The ledger now cites the PI-6 ledger case and both `rootCommit` owner cases.
`node scripts/check-phase10-coverage.mjs` passes all 56 rows, and the three
focused post-split cases pass without changing implementation.

## Post-Review-Fix Validation Audit 2026-10-28

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

The final install-flow boundary keeps all 56 Phase 10 evidence rows valid. The
relocated PI-6 and `rootCommit` owner cases pass. The three CAS-08 scenarios
also pass with 39 steps. Direct coverage for the public root, planning leaf,
and ledger leaf remains 100% for lines, branches, and functions.

The full `npm run check` result from `8184f337` remains valid for the current
tree because only Phase 10 review Markdown changed after that commit. It passed
1,120 scenarios, 11,411 steps, and 306 direct LCOV records. No behavior is
unverified.

## Stale-Verification Validation Audit 2026-10-28

| Metric              | Count |
| ------------------- | ----- |
| Gaps found          | 1     |
| Resolved            | 1     |
| Escalated           | 0     |
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

## Final Post-Fix Validation Audit 2026-10-29

| Metric                        | Count |
| ----------------------------- | ----- |
| Prior gaps                    | 1     |
| Resolved                      | 1     |
| Escalated                     | 0     |
| Evidence rows valid           | 56/56 |
| Unique expected IDs           | 56/56 |
| Must-haves behaviorally green | 28/28 |

The final evidence-binding gap is closed. `XPH02-MOVE-DIAGNOSTICS` now pins
commit `741516af` and binds exactly these three current behavioral titles:

- `features/plugin/update.feature` — `Scenario: Update preserves dependency move warnings and MCP notices`
- `features/plugin/package-dependencies.feature` — `Scenario: A direct update reports a moved dependency package failure only on that dependency`
- `features/plugin/package-dependencies.feature` — `Scenario: A direct update reports a newly installed dependency package failure once`

The strict checker passed 56/56 rows. Independent in-memory mutations proved
that the new rule can fail: deleting the newly-installed-dependency title was
rejected by the complete-evidence-set check, and repinning the row to
`291b2df1` was rejected because both package-dependency titles are absent at
that commit. No tracked coverage artifact was modified for these probes.

The exhaustive ledger contains 56 unique IDs: 10 `LCHARN`, 18 `LCTEST`, 13
`XPH01`, nine `XPH02`, two manifest-first `PHANTOM`, three `CAS08`, and one
`MIM05`. Its dispositions remain 35 scenarios, 14 unit-with-reason, six fixed,
and one declined-with-reason. The seven roadmap truths and 21 plan-specific
truths remain verified, for 28/28 must-haves.

Fresh focused execution passed:

- all three final move-diagnostic scenarios: 3/3 scenarios and 48/48 steps;
- the D-PL10-13 owner: 1/1 test, with no skip or todo;
- `node scripts/check-phase10-coverage.mjs`: 56/56 exact rows valid.

The exact full `npm run check` result at executable source commit `741516af`
remains reusable: 1,144 scenarios, 11,758 steps, and 309 merged LCOV records.
Only the standalone Phase 10 checker and planning Markdown changed afterward;
no runtime, test, feature, dependency, configuration, or npm gate input
changed.

D-PL10-13 remains the formal superseding decision over the older Plan 01-03
literal. Its current owner proof passed, so the superseded broad behavior must
not be restored. Phase 10 is Nyquist-compliant with no remaining validation
gap or implementation escalation.
