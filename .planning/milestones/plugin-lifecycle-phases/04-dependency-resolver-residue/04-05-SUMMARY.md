---
phase: 04-dependency-resolver-residue
plan: 05
subsystem: plugin-lifecycle
tags: [dependency-plan, git-source, commit-pin, install]
status: complete

requires:
  - "04-01 (previewInstall with the D-PL4-04 agent-target check)"
  - "04-02"
  - "04-04 (previewedCommit on the plan's members, DependencyPlanOptions.rootCommit)"
provides:
  - "memberLedgerPin: one helper both ledger option builders take a member's pin from"
  - "planInstallMoves passes the root preview's commit as rootCommit"
  - "D-PL4-02 stated on dependencyInstallsFollow"
  - "a WR-C case pinning D-PL4-04 on a plain update"
affects: [plan 04-06 (phase gate)]

actuals:
  tokens: 2336
  tasks: 2
  commits: 2
plan_head_before: 001e164d71b9545704308340094c1760f041f3df
plan_head_after: 5aed5184c2dc213ad69c9efad9bab0c747391c09

tech-stack:
  added: []
  patterns:
    - "A member's ledger pin comes from one helper: tag pin (commit + semver) wins, else the previewed commit as sourcePin alone"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - test/orchestrators/plugin/install-flow.test.ts

key-decisions:
  - "D-PL4-01: a member the plan previewed installs previewedCommit as sourcePinOverride with no resolvedVersion, so its version derives as an unpinned install's does; a release-tag pin still wins (RESV-03, GV-01)"
  - "D-PL4-01 (Uncertain choice 1): the plugin the user named installs the commit its own preview resolved, through rootCommit"

patterns-established: []

requirements-completed: [RSV-01, RSV-02, RSV-04]

metrics:
  completed: 2026-10-27
---

# Phase 4 Plan 05: Install at the previewed commit Summary

Every plugin the dependency plan previews and then installs now installs the commit its preview resolved, with one network resolve. A module-private `memberLedgerPin` gives both ledger option builders a member's pin: a release tag's commit and semver win, otherwise the previewed commit becomes `sourcePin` with no `resolvedVersion`. `planInstallMoves` passes the root preview's commit to the plan as `rootCommit`.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | ea6fe62d | fix(plugin): install a fresh dependency at the commit the plan previewed |
| 2 | 5aed5184 | fix(plugin): install the named plugin at the commit the plan previewed |

## What changed

- `install-flow.ts`:
  - New `memberLedgerPin(member)` above `dependencyLedgerOptions`, with a RESV-03 / GV-01 / D-PL4-01 doc.
  - `dependencyLedgerOptions` and the inline `ledgerOptionsFor` in `installPluginWithTransaction` both spread `...memberLedgerPin(member)`. The inline builder's `pinVersion` rule and `provenance` are unchanged. The RESV-03 comment above it and `dependencyLedgerOptions`' doc now name the D-PL4-01 case.
  - `planInstallMoves` keeps `previewInstall`'s answer and passes `...(rootCommit !== undefined && { rootCommit })` to `planDependencyGraph`; its doc names D-PL4-01. The update path passes no `rootCommit`.
  - `dependencyInstallsFollow`'s doc states D-PL4-02.
- `install-flow.test.ts`:
  - Helpers `offerGitPlugin` (appends an unpinned url-source plugin to `mp` and writes its repository fixture), `installAppCountingResolves` (wraps `seamWith`, counts `materializeOrRefreshPluginMirror` calls and records each `materializePluginClone` pin), and `recordedSha`.
  - A data-driven pair of D-PL4-01 cases (fresh git dependency in the final closure; fresh git dependency a moved dependency's new version needs, installed in a materialize step).
  - The D-PL4-01 root case (a git `app` installed after `lib` moves).
  - "D-PL4-04: refuses a version whose agent target a user's file holds before it installs any dependency" in the `createUpdateDependencyResolver` suite.

## Measured RED counts

| Case | Before | After |
| ---- | ------ | ----- |
| fresh dependency, final closure (inline builder) | 2 mirror calls, pins `[]` | 1 mirror call, pins `[HOST_HEAD]` |
| fresh dependency, materialize step (`dependencyLedgerOptions`) | 2 mirror calls, pins `[]` | 1 mirror call, pins `[HOST_HEAD]` |
| root after a move (`rootCommit`) | 2 mirror calls, pins `[]` (also measured after Task 1, before Task 2) | 1 mirror call, pins `[HOST_HEAD]` |

The root case measured exactly 1 after the change, so no extra resolve needed hunting. The D-PL4-04 case passed on first run: it pins behavior 04-01 already added to WR-C, as the plan intended.

## Verification

- Task 1: `node --test --test-name-pattern 'D-PL4-01|RESV-03|UPD-DEP-D1' …/install-flow.test.ts`: 13/13 passed. `npm run test:coverage:direct -- …/install-flow.ts` exited 0.
- Task 2: `node --test --test-name-pattern 'D-PL4-01|D-PL4-04|UPD-DEP-D1|MISS-01|WR-C' …/install-flow.test.ts`: 17/17 passed. `npm run test:coverage:direct -- …/install-flow.ts` exited 0 (both arms of the `rootCommit` spread covered). `tsc --noEmit` clean.
- `SKIP=npm-check pre-commit run --files` clean before each commit; both commits passed the commit hook (`check:commit`, including fallow dupes and both complexity gates).
- Acceptance greps: `function memberLedgerPin` 1; `...memberLedgerPin(member)` 2; `rootCommit` 2; `D-PL4-02` 1 (install-flow.ts); `D-PL4-01` 2 and `D-PL4-04` 1 (test).
- Tracer gate: Task 1's `<verify>` passed end to end before Task 2 started.
- The full `npm run check` was not run, as the dispatch said; the phase gate runs in plan 04-06.

## Deviations from Plan

- **Order of writing the root case.** The Task 2 root case was written together with the Task 1 cases so all three RED counts were measured at once. It was removed from the file before the Task 1 commit (it fails without `rootCommit`) and restored for Task 2, so each commit carries only its own cases.
- **Helper shape.** The plan described a counting helper that wraps `seamWith`; it also builds the git fake and runs the `app` install, so the three case bodies stay short and share no clone group. A third small helper, `recordedSha`, reads a record's commit.

## Files touched outside the plan

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: ea6fe62d, 5aed5184 (both ancestors of HEAD)
- FOUND: both modified files
