---
phase: 06-import-marketplace-planning
plan: 05
subsystem: reconcile apply
status: complete
tags: [mim-03, rollback-partials, apply, reconcile, redaction]
requires: ["06-01", "06-02"]
provides:
  - "apply's failed-install row reads (failed) {rollback partial} with the redacted install error and the per-phase rows (D-PL6-05, D-PL6-12)"
  - "a dependency's partial rollback gets its own apply row under the dependency's marketplace, by its bare name; the requested plugin keeps {dependency failed} with no cause"
  - "the reconcile failed-row projection threads rollbackPartial from the outcome"
affects: [06-06 phase gate, phase merge with Phases 2 and 7 on apply.ts]
tech-stack:
  added: []
  patterns:
    - "conditional spread for an optional redacted cause (exactOptionalPropertyTypes, NREG-01)"
    - "a unit case reads Node-specific fs error wording back from the runtime instead of pinning it"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - features/plugin/apply.feature
decisions:
  - "The requested plugin's row comes before the dependency's own rollback row, in the order the plan states them; the block is not re-sorted"
  - "The helpers take structural parameter types, so apply.ts's import blocks stay untouched (merge friction with Phases 2 and 7)"
requirements: [MIM-03]
metrics:
  duration: 45min
  completed: 2026-10-27
estimate:
  tokens: 75000
  tasks: 2
actuals:
  tokens: 4150
  tasks: 2
  commits: 5
plan_head_before: fe870eeabfdd68050c8f83fe8fd3e9a9235964a5
plan_head_after: 9c74563d20a30bfb1a09ae194af699e5af767204
---

# Phase 06 Plan 05: Apply rollback-partial rows Summary

`apply` now shows a partial rollback with the detail `install` shows. A failed install whose undo could not finish reads `(failed) {rollback partial}`, with the redacted install error as its cause and one `[<phase>] (rollback failed)` row per phase. When the undo that could not finish was a dependency's, the dependency gets that row of its own, and the requested plugin keeps `{dependency failed}` with no cause.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | apply's failed-install row shows a root partial rollback (tracer) | da7bcd32 | apply.ts, notify.ts, apply.test.ts, notify.test.ts, apply.feature |
| 2 | A dependency's partial rollback gets its own apply row | 00006f07 | apply.ts, apply.test.ts, apply.feature |

`commits: 5` is the unfiltered `git rev-list --count fe870eea..HEAD`. It includes three commits of sibling plan 06-04 (e747bfae, 425d29cd, 9c74563d). This plan made 2 commits; `git rev-list --count fe870eea..HEAD -- <the five plan files>` is 2.

## Changed functions per shared file (for the phase merge against Phases 2 and 7)

- `orchestrators/reconcile/apply.ts`: the `else` (failure) arm of `applyPluginInstalls` is now one line, `outcomes.push(...installFailedOutcomes(op, result));`. **The failure arm lives in `installFailedOutcomes`**, placed directly after `redactedDependencyCascadeError`, with three module-private companions in the same spot: the type `FailedPluginInstall`, `redactedRollbackPartials`, and `dependencyRollbackOutcome`. The RESV-06 comment moved from the arm into the helper's doc comment. No import changed.
- `orchestrators/reconcile/notify.ts`: new module-private `failedRowRollback` directly after `failedRowCause`, spread into the failed arm of `applyPluginOutcomeToBlock`. The `failedRowCause` doc comment and the failed arm's comment name the new MIM-03 case. No import changed. `shared/notification-grammar.ts` is untouched.

## The three outcome shapes of installFailedOutcomes

- No rollback partials: today's single outcome, unchanged (classified reason, the redacted cause of a `DependencyCascadeError`, carried MCP notices).
- Partials and a `DependencyCascadeError`: the requested plugin's outcome with `reason: "dependency failed"`, no cause, and the carried MCP notices. Then the dependency's outcome, keyed from `error.key` split at its last `@` (T-06-12), with `reason: "rollback partial"`, `cause: redactedDependencyCascadeError(error)`, and the redacted phases.
- Partials and any other error: one outcome with `reason: "rollback partial"`, `cause: redactCauseChain(error)`, the redacted phases, and the carried MCP notices.

Each phase keeps its name. Its cause is rebuilt through `redactCauseChain`, and the raw ledger `msg` is dropped (D-PL6-12).

## RED runs

- Scenario 5, "Apply that cannot finish the rollback of a failed install names the rollback phase", before the change: the row read `failed`, reasons `unreadable`, no `cause chain` and no `cause truncated` cell, and an empty `rollback partial` cell.
- Scenario 6, "Apply that cannot finish the rollback of a failed dependency reports the dependency's own row", before Task 2: `tally failures` was `1`, because only the requested plugin's row appeared.
- notify.test.ts "MIM-03: carries the rollback phases of a plugin-install-failed row that left them" failed before the projection.
- apply.test.ts root case failed before Task 1 with `⊘ hello (failed) {unreadable}` and no cause or phase rows. The dependency case failed before Task 2 with only `⊘ hello (failed) {dependency failed}` and its cause line.

## Rendered rows after the change

Root partial (apply.test.ts, Node 26 wording; the case reads the EISDIR wording from the runtime):

```
● mp [project]
  ⊘ hello (failed) {rollback partial}
    cause: EISDIR: illegal operation on a directory, read 'mcp-adapter.json' -> EISDIR: illegal operation on a directory, read 'mcp-adapter.json'
    [skills] (rollback failed)
      cause: EACCES: permission denied, unlink 'data.txt'
```

Dependency partial: summary `Some plugin operations have failed.`, then `⊘ hello (failed) {dependency failed}` with no cause, then `⊘ bar (failed) {rollback partial}` with the same cause and phase rows, then `Reconcile: 2 failures`.

## Verification

- `node --test test/orchestrators/reconcile/notify.test.ts test/orchestrators/reconcile/apply.test.ts`: 274 pass, 0 fail (127 notify, 147 apply). The existing RESV-06 cases pass unchanged.
- `npm run test:coverage:direct -- <source>`: exit 0 for apply.ts (after both tasks) and notify.ts.
- `npx cucumber-js features/plugin/apply.feature`: 40 scenarios passed. Both new scenarios also passed when run again on their own. `npm run check:features` is clean.
- Both new apply.test.ts cases passed on a second run, so their teardown left nothing read-only.
- ESLint on the four TypeScript files: clean. The commit hook (`npm run check:commit`) passed on both commits.
- Acceptance greps: `read-only skill directory removal error` in apply.feature 2; `rollbackPartials` in apply.ts 9; `rollbackPartial` in notify.ts 3.
- Run on Node v26.12.1, uid 1000. The full `npm run check` is left to plan 06-06, as instructed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The EISDIR wording differs between Node 24 and Node 26**

- **Found during:** Task 1
- **Issue:** Node 26 appends the path to the EISDIR read message and Node 24 does not. A literal expectation would pass locally and fail in CI, or the reverse.
- **Fix:** A test helper, `redactedReadErrorMessage`, reads the blocked `mcp-adapter.json` and cuts its own path to the basename. Both apply cases build the expected cause from that value. The scenarios already handle this through the path-cut error tokens of 06-01.
- **Files modified:** test/orchestrators/reconcile/apply.test.ts
- **Commit:** da7bcd32

**2. [Rule 3 - Blocking] Teardown for the copy the failed undo leaves**

- **Found during:** Task 1
- **Issue:** The failed skills undo leaves `resources/skills/<plugin>-tool/read-only` at mode 0555. The hermetic tree removal cannot delete it.
- **Fix:** `createHermeticScopes` gained `restoreWrites(directory)`. It records a directory that the same teardown hook makes writable, if the directory exists, before the tree removal. The plan said to extend the restore list; this is that list.
- **Files modified:** test/orchestrators/reconcile/apply.test.ts
- **Commit:** da7bcd32

Two choices inside the plan's latitude:

- Scenario 5 has no `version` column and no `tally success count` field. The row has no version and a zero success count is omitted, as the first runs showed.
- The plan's notify behavior names a no-partials case. The existing case "RESV-06: carries the dependency-cascade cause on a plugin-install-failed row that names one" already deep-equals a failed row without a `rollbackPartial` member, so no duplicate case was added.

## Process notes

During Task 1, a sibling commit hook stashed every unstaged edit in the worktree, so my five files read as unmodified for a short time. Pre-commit put them back when the hook ended. Before each later run and commit, I waited for any running hook (`waithook.sh`), and after each commit I checked that my files were committed and clean.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-11 is mitigated: the root cause, each phase cause, and the dependency row's cause are all rebuilt with redaction, and both apply.test.ts cases assert the exact rendered text. T-06-12 is mitigated: the dependency key splits at its last `@`.

## Self-Check: PASSED

- FOUND: da7bcd32, 00006f07 (both ancestors of HEAD)
- FOUND: all five modified files
