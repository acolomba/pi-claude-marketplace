---
phase: 04-dependency-resolver-residue
plan: 02
subsystem: plugin-lifecycle
tags: [release-tag, dependency-tag-probe, install-cascade, install-flow, types]
status: complete

requires:
  - "04-01 (wave ordering only; no shared file)"
provides:
  - "SelectedReleaseTag and DependencyTagProbeResult: range-free `{ kind: \"no-matching-tag\" }` arm"
  - "InstallMissingDependencyOutcome failed arm declares `rollbackPartials?: readonly RollbackPartial[]`"
affects: [install-cascade member constraint decode, marketplace-tag-probe result type, apply's missing-dependency installs]

actuals:
  tokens: 5885
  tasks: 2
  commits: 2
plan_head_before: 2147b8a70ed7679a21883446b81a28e36e8a421f
plan_head_after: cfe202172ac0ce0852487a87cd3334d328a373c1

tech-stack:
  added: []
  patterns:
    - "A probe's no-match answer carries no rendering; the caller renders the member's declared ranges"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/release-tag.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - test/domain/release-tag.test.ts
    - test/orchestrators/plugin/dependency-tag-probe.test.ts
    - test/orchestrators/plugin/marketplace-tag-probe.test.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - test/orchestrators/plugin/install-flow.test.ts

key-decisions:
  - "The `range` parameter of selectHighestSatisfyingTag stays: the selection reads it; only the returned copy goes (D-PL4-05)"
  - "rollbackPartials is a type-only declaration; installMissingDependencyWithTransaction already spreads it from handleCaughtInstallFailure (D-PL4-06)"

patterns-established: []

requirements-completed: [RSV-05]

metrics:
  completed: 2026-10-26
---

# Phase 4 Plan 02: Resolver loose types Summary

The no-match arm of `SelectedReleaseTag` and `DependencyTagProbeResult` is now `{ kind: "no-matching-tag" }`, with no unread rendered range (D-PL4-05). The failed arm of `InstallMissingDependencyOutcome` now declares the `rollbackPartials` it already carried, and a new REC-06 case proves the partial arrives (D-PL4-06).

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | a760f41e | refactor(plugin): drop the unread range from the no-match tag answer |
| 2 | cfe20217 | refactor(plugin): declare the rollback partials of a failed dependency |

## What changed

- `domain/release-tag.ts`: the no-match arm and the `selectHighestSatisfyingTag` return drop `range`. The import of `renderConstraintRange` is gone; it is still used by `constraint-fold.ts` and `dependency-range.ts`, so no export goes dead.
- `dependency-tag-probe.ts`: the no-match arm drops `range`. The arm doc and the AUTH-09 header sentence now say the caller renders the declared ranges and the failure arm carries the classified transport cause only.
- `install-cascade.ts`: the `no-matching-tag` member of `toMemberConstraintOutcome`'s `probed` parameter type drops `range`. The body already built the failure from `declared`. `CascadeConstraintFailure` is unchanged.
- `install-flow.ts`: `RollbackPartial` joins the existing type import, and the failed arm of `InstallMissingDependencyOutcome` declares `rollbackPartials?` with the REC-06 doc from `InstallPluginOutcome`. No executable line changed.
- Tests: 20 probe-answer fakes in `install-cascade.test.ts` lose `range` (prettier then joined some of them onto one line). 12 runtime expectations lose `range` (5 in release-tag, 5 in dependency-tag-probe, 2 in marketplace-tag-probe). Two titles were changed as the plan said. Two `marketplaceTagProbe` fakes in `install-flow.test.ts` (WR-03, D-09-05) lose `range`. A new case was added: "REC-06: a missing-dependency install whose own ledger cannot finish an undo reports the rollback partial". Its helper `failAfterSkillsWithUndoFault` wraps `transactionControl.runPhases`. It fails the per-plugin ledger at `commands` and makes the `skills` undo throw after the real undo runs. The case runs under `withHermeticHome`.

## Verification

- RED for Task 2: with the test added and before the declaration, `tsc --noEmit` reported TS2339 (`rollbackPartials` does not exist on the failed arm). At runtime the case already passed, which shows that the value already arrived.
- `node --test` over release-tag, dependency-tag-probe, marketplace-tag-probe, and install-cascade: 151/151 passed. The tracer gate re-ran the suite after the commit: 151/151 again.
- `node --test --test-name-pattern 'REC-06|WR-03|D-09-05' test/orchestrators/plugin/install-flow.test.ts`: 11/11 passed.
- `npm run test:coverage:direct` exited 0 for `release-tag.ts`, `dependency-tag-probe.ts`, `marketplace-tag-probe.ts`, `install-cascade.ts`, and `install-flow.ts`.
- Both commits passed the commit hook (`npm run check:commit`, gitlint, prettier, TruffleHog).
- Acceptance greps: each of the three source files has 1 `{ readonly kind: "no-matching-tag" }`. The narrowed import appears once. The three probe test files and `install-flow.test.ts` have 0 `kind: "no-matching-tag", range`. The `rollbackPartials` declaration appears once, and the REC-06 title appears once.
- The full `npm run check` was not run, as the dispatch said. The phase gate runs in plan 04-06.

## Files edited outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`: only the `toMemberConstraintOutcome` parameter type. Phase 3 owns this file.
- `test/orchestrators/plugin/install-cascade.test.ts`: the probe-answer fakes.
- `test/orchestrators/plugin/marketplace-tag-probe.test.ts`: two expectations.

All three are in the plan's `files_modified`. No file outside the plan was touched. `update-constraint-gate.test.ts` still has fakes that return a dead `range` (lines 99, 105, 461). They still compile, and the plan leaves them alone.

## Deviations from Plan

None. The plan was executed as written. The first Task 2 commit attempt failed gitlint because the title had 73 characters. The title was shortened and the commit was made again, with no `--amend` and no `--no-verify`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: a760f41e, cfe20217 (both ancestors of HEAD)
- FOUND: all nine modified files
