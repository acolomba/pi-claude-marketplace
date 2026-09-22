# Deferred Items — Phase 10

Out-of-scope discoveries logged during plan execution (per gsd-executor SCOPE BOUNDARY rule).
Not fixed here; tracked for a future, unrelated pass.

## 10-02: Pre-existing PDEF-01 test failure (unrelated to UPDT-01)

- **Test:** `tests/orchestrators/plugin/update-flow.test.ts` — "PDEF-01: update preview detects
  an agent conflict from a later resolved directory"
- **Symptom:** asserts severity `'error'`, actual `'warning'`.
- **Scope check:** the test itself is untouched by any 10-02 diff (`git diff HEAD -- tests/orchestrators/plugin/update-flow.test.ts`
  shows no hunk touching this test), and it was introduced in commit `553513a5`, long before this
  plan's work. `PDEF-01` is a requirement ID from the unrelated, already-archived `refine-unit-tests`
  milestone (see `.planning/milestones/refine-unit-tests-REQUIREMENTS.md`), not a phase-10
  requirement — the shared prefix is coincidental.
- **Effect on this plan's verification:** causes `npm run test:coverage:direct:commit` to report a
  non-zero exit (the `(update-flow.ts, update-flow.test.ts)` pair's focused test run fails), even
  though phase 10-02's own added/changed code is 100% covered by its own tests. All 4 target test
  files (`update-constraint-gate.test.ts`, `update-preflight.test.ts`, `update-flow.test.ts`,
  `update-swap.test.ts`) pass except this one pre-existing case.
- **Action:** not fixed — out of scope per SCOPE BOUNDARY (only auto-fix issues directly caused by
  the current task's changes). Left for a dedicated defect-repair pass.
