---
phase: 39
plan: 01
subsystem: orchestrators
tags: [TR-03, cascade, ghost-record, AG-5, partial-failure, hardening]
requires: [phase-38-baseline]
provides: [TR-03 cascade-ghost-record-fix]
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
tech_stack_added: []
tech_stack_patterns: [discriminated-instanceof-dispatch, in-place-state-mutation, sentinel-post-guard-branch]
key_files_created: []
key_files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
decisions:
  - Inline 4-row filter at both call sites (TR-D03 helper extraction DEFERRED to v1.8).
  - Use sentinel-capture + post-guard branch in uninstall.ts to keep ST-7 "save on no-throw" semantics while still firing the failure notification AFTER the shrunken-row save commits.
  - AG-5 carve-out via `cause instanceof AgentsUnstageFailureError` -- typed dispatch only, no substring matching.
metrics:
  duration_minutes: ~30
  completed: 2026-06-02
  tasks_total: 3
  tasks_committed: 2
  tests_before: 1358
  tests_after: 1362
  tests_added: 4
---

# Phase 39 Plan 01: Cascade Ghost Record Summary

TR-03 fix: orchestrators now materialise `cascadeUnstagePlugin`'s
`outcome.dropped.*` ledger into a partial `sRecord.resources.*` filter on
non-AG-5 cascade failure, while preserving the full state row intact on AG-5
(`AgentsUnstageFailureError`) foreign-content failure.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | uninstall.ts hybrid (sentinel + AG-5 throw) + 2 regression tests | `685d10e` | uninstall.ts, uninstall.test.ts |
| 2 | remove.ts per-plugin loop filter + 2 regression tests | `302ba4b` | remove.ts, remove.test.ts |
| 3 | Regression gate (shared.test.ts + `npm run check`) | (no commit; verification only) | -- |

## Acceptance Criteria

Per `.planning/phases/39-cascade-ghost-record/39-VALIDATION.md`:

| Task ID | Requirement | Verification | Status | Evidence |
|---------|-------------|--------------|--------|----------|
| 39-01-01 | TR-03: uninstall.ts filters sRecord.resources.* by outcome.dropped.* on non-AG-5 partial; AG-5 preserves row | `npx tsx --test tests/orchestrators/plugin/uninstall.test.ts` | PASS | 19/19 tests green (17 baseline + 2 new TR-03 regression tests) |
| 39-01-02 | TR-03: remove.ts per-plugin loop applies same filter; AG-5 preserves row | `npx tsx --test tests/orchestrators/marketplace/remove.test.ts` | PASS | 18/18 tests green (16 baseline + 2 new TR-03 regression tests) |
| 39-01-03 | cascade primitive (cascadeUnstagePlugin) makes no state mutation; outcome.dropped frozen | `npx tsx --test tests/orchestrators/marketplace/shared.test.ts` | PASS | 6/6 tests green; primitive untouched (no edits to shared.ts) |
| 39-01-04 | field-name mapping correctness: dropped.commands -> resources.prompts | `grep -nE "dropped\\.commands.*prompts" ...uninstall.ts ...remove.ts` | PASS | Match found in both files (uninstall.ts:214 + remove.ts:224) |
| 39-01-05 | full check passes, no regression from 1358 baseline | `npm run check` | PASS | 1362 tests green (1358 baseline + 4 new). Lint + format + typecheck clean. |

## Implementation Notes

### uninstall.ts (Task 1)

Restructured the `withStateGuard` closure to split failure handling by cause type:

- **AG-5 (`AgentsUnstageFailureError`):** `throw cause` inside the guard. ST-7's
  "save only on no-throw" contract aborts the save, preserving the full row.
  PU-3+PU-7 invariant byte-identical to Phase 38 baseline.
- **Non-AG-5 partial failure:** Mutate `sRecord.resources.{skills,prompts,agents,mcpServers}`
  in place by filtering out the names present in `outcome.dropped.{skills,commands,agents,mcpServers}`.
  Return normally (no throw) so the guard's trailing `saveState` commits the
  shrunken row. Capture the cause in a `cascadeFailure` sentinel declared in the
  outer scope.

After the guard returns:

- `alreadyGone` -> silent converge (PU-5, unchanged).
- `cascadeFailure !== undefined` -> emit `PluginFailedMessage` with
  `narrowCascadeFailure(cascadeFailure)`, then `return` so the post-state
  cleanup (cache-drop, data-dir rm, `PluginUninstalledMessage`) is SKIPPED.
  Pitfall 4 explicitly covered.
- Otherwise -> existing success branches (cache-drop, data-dir rm,
  `PluginUninstalledMessage`).

The pre-Phase-39 outer `try/catch` on the guard is RETAINED as the AG-5
surface (AG-5 still throws and the existing catch fires the failure
notification, preserving the PU-3+PU-7 test verbatim).

### remove.ts (Task 2)

Extended the existing `else` arm of the per-plugin loop (lines 209-213) with
the same AG-5 carve-out:

- `cause instanceof AgentsUnstageFailureError` -> skip the filter, push to
  `failedPlugins[]` unchanged (row preserved).
- Otherwise -> filter `plugin.resources.*` by `outcome.dropped.*` in place,
  then push to `failedPlugins[]`. The loop never throws; the guard's trailing
  `saveState` commits the shrunken record alongside any successfully-removed
  plugin deletes.

No structural change to the loop -- additive `if/else` on the cause type.
The trailing `if (failedPlugins.length === 0) delete state.marketplaces[opts.name]`
at line 246+ preserves the marketplace record when any plugin failed (MR-7
unchanged).

### Field-name mapping

Locked inline at both sites with the `dropped.commands -> resources.prompts`
note in a comment. The mapping:

| `outcome.dropped.*` | `sRecord.resources.*` |
|---|---|
| `skills` | `skills` |
| `commands` | `prompts` |
| `agents` | `agents` |
| `mcpServers` | `mcpServers` |

is verified by `grep -nE "dropped\.commands.*prompts"` in both files
(validation row 39-01-04 PASS).

## Deviations from Plan

### Minor: removed unused `outcome` outer variable in uninstall.ts

- **Rule:** Auto-fix lint failure (Rule 3 / blocking)
- **Found during:** Task 1 pre-commit lint
- **Issue:** After refactoring the closure to bind a `localOutcome` const inside
  the `await cascade(...)` call (so the filter could read `outcome.dropped.*`
  without `outcome!` non-null assertions), the original outer
  `let outcome: UnstageOutcome | undefined;` variable was no longer read.
  ESLint flagged it as unused; TS `noUnusedLocals` failed.
- **Fix:** Removed the outer `let outcome` declaration and the now-unused
  `UnstageOutcome` type import. The `localOutcome` const inside the closure
  retains the full type-narrowing semantics; the post-guard success path
  never needed `outcome` (it was a hoisted leftover from a prior structure).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Commit:** Folded into `685d10e` (Task 1 commit).

### Minor: removed stale `eslint-disable-next-line` directive

- **Rule:** Auto-fix lint warning (Rule 3 / blocking)
- **Found during:** Task 1 pre-commit lint
- **Issue:** A pre-existing comment above the new `if (cascadeFailure !== undefined)`
  branch carried an `eslint-disable-next-line @typescript-eslint/no-unnecessary-condition`
  directive that the lint reported as unused. Since `cascadeFailure` is
  declared with the union type `Error | undefined`, the `!== undefined` check
  is in fact necessary -- the disable was over-cautious.
- **Fix:** Removed the disable comment; lint now clean without it.
- **Commit:** Folded into `685d10e`.

No architectural deviations. Plan executed exactly as scoped by the
embedded task_execution_protocol.

## Authentication Gates

None. The plan is in-place TypeScript refactoring + tests; no auth, no
network, no FS-permission gates.

## Threat Flags

None. The changes are at the orchestrator boundary inside an existing
`withStateGuard` lock -- the same transactional surface that already
protects `state.json` mutation. No new attack surface introduced.

## Known Stubs

None. The new code paths are fully wired and exercised by the 4 new
regression tests.

## TDD Gate Compliance

Plan was not marked `tdd="true"`; the test additions land alongside the
implementation in the same per-task commits (test-as-evidence rather than
RED/GREEN cycle).

## Verification Results

### Per-row VALIDATION.md status

| Validation row | Command | Result |
|---|---|---|
| 39-01-01 | `npx tsx --test tests/orchestrators/plugin/uninstall.test.ts` | PASS (19/19 tests, including 2 new TR-03 tests) |
| 39-01-02 | `npx tsx --test tests/orchestrators/marketplace/remove.test.ts` | PASS (18/18 tests, including 2 new TR-03 tests) |
| 39-01-03 | `npx tsx --test tests/orchestrators/marketplace/shared.test.ts` | PASS (6/6 tests) |
| 39-01-04 | `grep -nE "dropped\\.commands.*prompts" ...uninstall.ts ...remove.ts` | PASS (match at uninstall.ts:214 + remove.ts:224) |
| 39-01-05 | `npm run check` | PASS (typecheck + lint + format + 1362 tests GREEN) |

### Final `npm run check` tail (last 20 lines)

```
✔ SC-3 / ST-8 hard-fail: caller B detects A's prior commit and throws 'was installed concurrently' (7.255833ms)
✔ SC-3 / ST-8 soft-converge: caller B's idempotent uninstall sees record already gone -> no throw (22.86475ms)
✔ ST-9 update concurrent change: caller B sees caller A's version bump and throws 'changed concurrently' (16.719459ms)
✔ Phase 8 / PRL-10 manual transaction surfaces StateLockHeldError when scope lock is pre-held (1.144834ms)
✔ Phase 8 / PRL-10 manual transaction surfaces release errors when callback succeeds (5.493625ms)
✔ ST-7 withStateGuard surfaces release errors when mutate succeeds (2.189584ms)
ℹ tests 1362
ℹ suites 3
ℹ pass 1362
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 17256.065459
```

## Self-Check

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` modified (cascadeFailure sentinel + AG-5 carve-out + post-guard branch) -- FOUND
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` modified (per-plugin loop filter + AG-5 carve-out) -- FOUND
- `tests/orchestrators/plugin/uninstall.test.ts` two new TR-03 tests appended -- FOUND
- `tests/orchestrators/marketplace/remove.test.ts` two new TR-03 tests appended -- FOUND
- Commit `685d10e` (Task 1) -- FOUND in git log
- Commit `302ba4b` (Task 2) -- FOUND in git log

## Self-Check: PASSED
