---
phase: 06-import-marketplace-planning
plan: 04
subsystem: orchestrators
status: complete
tags: [mim-03, import, rollback-partials, redaction]
requires:
  - "06-01: read-only skill directory fixture and {read-only skill directory removal error} token"
  - "06-02: rollbackPartials on the orchestrated install (dependency) and enable failed outcomes"
  - "06-03: wave-1 edits of execute.ts and import.feature"
provides:
  - "UnexpectedPluginFailureOutcome.rollbackPartial: redacted per-phase rows on import's failed install or enable row (D-PL6-03, D-PL6-12)"
  - "UnexpectedPluginFailureOutcome.failedDependency: the dependency's own (failed) {rollback partial} row beside the requested plugin's bare {dependency failed} row (D-PL6-04)"
affects: [06-06 phase gate]
tech-stack:
  added: []
  patterns: ["the partial list replaces a boolean flag; the brace derives from list length"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - test/orchestrators/import/execute.test.ts
    - features/plugin/import.feature
decisions:
  - "The dependency member is named failedDependency and carries only the key and the redacted phases; the dependency row's cause is the outcome's own cause and causeChain, which already are the dependency's redacted message and chain"
  - "A dependency partial's two rows are ordered by name with compareByNameThenScope, as install-cascade.messaging.ts sortRows orders them; both go under the requested plugin's marketplace block"
  - "The own-install scenario ends with a header-only installation record and the staged demo-skill, as 06-01's install scenario does, because the skills undo that failed leaves the skill staged"
requirements: [MIM-03]
metrics:
  duration: 27min
  completed: 2026-10-27
estimate:
  tokens: 75000
  tasks: 2
actuals:
  tokens: 6500
  tasks: 2
  commits: 3
plan_head_before: fe870eeabfdd68050c8f83fe8fd3e9a9235964a5
plan_head_after: 425d29cdb96484439a215c24aa98e159645d8192
---

# Phase 6 Plan 04: Import rollback-partial rows Summary

Import now shows a partial rollback with the same detail as install. A failed install or enable row lists each `[<phase>] (rollback failed)` and the phase's redacted cause. A dependency whose rollback could not finish gets its own `(failed) {rollback partial}` row, named by its `plugin@marketplace` key.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Per-phase rollback rows on import's failed install and enable rows (tracer) | e747bfae | execute.ts, execute.test.ts, import.feature |
| 2 | A dependency's partial rollback gets its own import row | 425d29cd | execute.ts, execute.test.ts, import.feature |

`commits: 3` is the measured `git rev-list --count fe870eea..HEAD`. It includes sibling commit da7bcd32 (`fix(apply): ...`, plan 06-05). This plan made 2 commits (`git rev-list --count fe870eea..HEAD -- <the three plan files>` = 2).

## What changed in execute.ts

- `UnexpectedPluginFailureOutcome` gained two optional members:
  - `rollbackPartial?: PluginFailedMessage["rollbackPartial"]` (D-PL6-03). The phases of the plugin's own install or enable, each already redacted.
  - **`failedDependency?: { key; rollbackPartial }`** (D-PL6-04). The dependency's key (`DependencyCascadeError.key`) and its redacted phases. Its cause is the outcome's own `cause` / `causeChain`. Those already hold the dependency's redacted message and chain, because install's `memberCause` builds the `DependencyCascadeError` from the dependency's ledger error.
- The boolean `rolledBackPartial` is gone (grep count 0). `dispatchFailedOutcome`, `pushUnexpectedFailure` and `runtimeFailureReason` now take `readonly RollbackPartial[]`. The install arm passes `outcome.rollbackPartials ?? []`, and so does the enable arm (plan 06-02). `{rollback partial}` is the runtime reason exactly when the list is not empty. So the enable arm reads the list now, not `outcome.reason`.
- New module-private helpers:
  - `redactedRollbackPartials` keeps each phase and rebuilds its cause through `redactCauseChain` (T-06-10, D-PL6-12).
  - `partialMember` puts the redacted phases on `failedDependency` for a `DependencyCascadeError` and on `rollbackPartial` otherwise.
  - `unexpectedFailureRows` / `unexpectedFailureRow` build the row or rows. `buildImportNotificationMarketplaces`' failure loop is now one line, which keeps it under both complexity ceilings.
- The `DependencyCascadeError` branch passes the partial list too. An empty list keeps today's single row with its cause line.
- `shared/notification-grammar.ts` is unchanged. It already renders `PluginFailedMessage.rollbackPartial`.

## Row order pinned

For a dependency partial, the two rows go through `compareByNameThenScope` with the outcome's scope. That is install's `sortRows` order. In both the unit case and the scenario, `app` sorts before `lib@...`. The rows are pushed as `[dependency, requested]`, so a passing case proves the sort runs. The pair sits where the failure loop puts it: after the installed, skipped and source-mismatch rows of the block, and before the dependency-change rows.

## Unit cases (execute.test.ts)

- REC-06 (updated): the result gains `rollbackPartial: [{ phase: "skills" }]`, and the rendered row gains `    [skills] (rollback failed)`.
- D-PL6-12 (new): a phase cause whose nested link holds an absolute path shows `data.txt` only. The test asserts the whole result and the exact rendered text.
- D-PL6-03 (new): a failed enable with two partials, one with a cause and one without, renders `(failed) {rollback partial}` with both phase rows.
- D-PL6-04 (new): a `DependencyCascadeError` keyed `lib@mp` with a skills partial renders `app (failed) {dependency failed}` with no cause, then `lib@mp (failed) {rollback partial}` with the redacted cause chain and the redacted phase cause. The summary is `Some plugin operations have failed.` and the tally is `Import: 2 failures, 1 success`.
- The existing RESV-06 dependency cases pass with no expectation changed.

## RED runs of the three scenarios

- Before Task 1, **"Importing a plugin whose install rollback cannot finish names the rollback phase"** and **"Importing a disabled plugin whose enable rollback cannot finish names the rollback phase"** both failed: `2 scenarios (2 failed)`. Each failed only at `Then the result lists these plugins`. The actual `rollback partial` cell was `""`, and the expected cell was `[{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}]`. Every field, the reasons and the cause chain already matched.
- Before Task 2, **"Importing a plugin whose dependency rollback cannot finish names the dependency and its rollback phase"** failed: `1 scenario (1 failed)`. It failed at `Then the result has these fields`, where `tally failures` was 1 (expected 2) and `summary` was `A plugin operation has failed.`. Only the root's `{dependency failed}` row was rendered.
- After both tasks: `npx cucumber-js features/plugin/import.feature` gives 21 scenarios (21 passed) and 262 steps, on Node v26.12.1 with uid 1000. The redacted causes match their tokens through 06-01's path-cut projection.

## Verification

- `node --test test/orchestrators/import/execute.test.ts`: 92/92 pass.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/import/execute.ts`: exit 0 (100%), after each task.
- ESLint and Prettier are clean on the two TS files, and `tsc --noEmit` is clean on the combined tree.
- The commit hook (`npm run check:commit`) passed on both commits.
- The full `npm run check` is left to plan 06-06, as instructed.
- Acceptance greps: `rolledBackPartial` 0; `readonly rollbackPartial?:` 1; `read-only skill directory removal error` in import.feature 3.
- Tracer gate: Task 1's `<verify>` commands all passed before its commit (owner tests, direct coverage, full import feature). Expansion went ahead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The own-install scenario cannot claim an empty user scope**
- **Found during:** Task 1
- **Issue:** The plan asks the scenario to state that the user scope has no installed plugins. `the user scope has no installed plugins` also compares the staged skills, and the skills undo that failed leaves `demo-skill` staged. 06-01 hit the same issue.
- **Fix:** The scenario ends with a header-only `the installation record of the user scope holds these plugins:` table and `the user scope stages these skills and prompts:` `| skill | demo-skill |`, as 06-01's install scenario does. Scenario 4 states only the empty record.
- **Files modified:** features/plugin/import.feature
- **Commit:** e747bfae

### Choices inside the plan's latitude

- **Contents of the dependency member.** The plan has the member carry the dependency's redacted cause head and chain. `failedDependency` carries only `key` and `rollbackPartial`. The dependency row takes the outcome's own `cause` / `causeChain`. Those are the dependency's message and chain, redacted by `pushUnexpectedFailure`, so a second copy would duplicate them. The rendered rows are the ones the plan asks for. The unit case and the scenario pin the dependency row's redacted cause.
- **Summary wording.** Scenario 4's summary is `Some plugin operations have failed.`, read from the first passing run. The tally has two plugin failures and no marketplace failure.

## Process notes

Mid-Task-2, a sibling's pre-commit run stashed my unstaged edits of execute.ts and import.feature for a moment. A `tsc` and a `cucumber-js` run during that window saw HEAD (`0 scenarios`). After `waithook.sh` returned, the edits were back. I re-applied one `sed` that had run against the stashed copy, then re-ran every check before committing.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-10 is mitigated as planned: phase causes go through `redactCauseChain`. The dependency row's head goes through `redactAbsolutePaths` and its chain through `redactCauseChain`. The D-PL6-12 and D-PL6-04 unit cases assert exact rendered text with no absolute path.

## Self-Check: PASSED

- FOUND: e747bfae, 425d29cd (ancestors of HEAD)
- FOUND: extensions/pi-claude-marketplace/orchestrators/import/execute.ts, test/orchestrators/import/execute.test.ts, features/plugin/import.feature
