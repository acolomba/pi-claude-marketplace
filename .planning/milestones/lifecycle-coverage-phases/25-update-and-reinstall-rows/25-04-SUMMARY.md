---
phase: 25-update-and-reinstall-rows
plan: 04
subsystem: update-rows
tags: [update, autoupdate, version-arrow, failed-row, partially-installed, UPR-03]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 03's VersionCommits, RevisionMove, the commit-aware arrow, and revisionCommits
provides:
  - update-row.ts::revisionVersionSlot, the one rule for every row that can show a move
  - optional from / commits on PluginReinstalledMessage, PluginPartiallyInstalledMessage, and PluginFailedMessage (RevisionMoveFields)
  - the grammar's move layout for those three statuses, and their wire from / fromCommit / toCommit
  - ThreePhaseArgsBase.onCandidate, called by materializeLatestVersion before the swap
  - update-swap.ts::preflightMove, the one reader of both shas
  - fromCommit / toCommit on PluginUpdateFailedOutcome
  - failed update rows that name the move on the direct path and the autoupdate cascade
affects: [25-05 reinstalled rows adopt onCandidate and revisionVersionSlot]

actuals:
  tokens: 23300
  tasks: 3
  commits: 4
plan_head_before: c80ae673212b7f5e331dc7c5a0b8d6d90013c9ef
plan_head_after: f4ad5b3e85d35b8fd0951c1b339e02a35414be06

tech-stack:
  added: []
  patterns:
    - "A caller-owned per-target holder (CandidateReport) receives the runner's candidate report, so a thrown failure names the move without wrapping the error"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - features/plugin/update.feature
    - features/plugin/update-rollback.feature
    - features/plugin/state-lock.feature
    - features/marketplace/update.feature
    - docs/json-output.md
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - test/architecture/catalog-uat/fixtures/plugin-update.ts
    - test/architecture/catalog-uat/fixtures/marketplace-update.ts

key-decisions:
  - "The three move-capable messages share one RevisionMoveFields interface (from?, commits?), so the grammar and the wire read one shape"
  - "revisionCommits stays file-private; revisionVersionSlot is the export other modules consume"
  - "An empty version counts as unknown in revisionVersionSlot, so it never yields a version or an arrow"
  - "The autoupdate failed arm moved into task 1's commit: it is the only consumer outside update-row.ts that made the revisionVersionSlot export pass fallow's unused-export gate"

requirements-completed: [UPR-03]

duration: 80min
completed: 2026-10-23
status: complete
---

# Phase 25 Plan 04: Partial and failed update rows show the move Summary

**`update --partial` now renders `◉ demo v1.0.0 → v1.1.0 (partially-installed) {unsupported component}`, and an update that fails after its candidate exists renders `⊘ demo v1.0.0 → v1.1.0 (failed) {<reason>}` on both cascades, with the commits on a same-version move. A failure before any candidate keeps its old bytes, and every cause chain is unchanged.**

## Performance

- Duration: about 80 min
- Tasks: 3 of 3
- Commits: 4 (one per task, plus one scenario fix)

## Accomplishments

- `update-row.ts::revisionVersionSlot` holds the rule. It returns nothing when no version is known. It returns the single version when one side is known or both sides are the same revision. It returns `version` (the to side) plus `from` when the revision moved, and adds `commits` under `revisionCommits`. A commit on one side only counts as a move but names no commits. An empty version counts as unknown.
- `PluginReinstalledMessage`, `PluginPartiallyInstalledMessage`, and `PluginFailedMessage` extend `RevisionMoveFields` (`from?`, `commits?`). The grammar's new `move` layout draws `composeVersionArrow(from, version, commits)` when `from` is present, and the single version otherwise. The version slot moved into `renderVersionSlot`, so `formatPluginRow` stays under the complexity caps. `wireVersion` emits `from`, `fromCommit`, and `toCommit` beside `version` through a `moveFields` helper (fallow's cyclomatic cap of 20 forced the helper).
- The `partially-installed` form of `updatedRowFromOutcome` uses the slot, so both update cascades show the arrow.
- `ThreePhaseArgsBase.onCandidate` is called once by `materializeLatestVersion` with `preflightMove(preflight)` after the preflight derived a candidate and before `swapPluginUpdate`. It is never called for a preflight verdict.
- `update-swap.ts::preflightMove` replaces plan 03's private commit helper. The success outcome, `composePhase3FailureOutcome`, and the runner's report all read both shas through it.
- `update-flow.ts`: a fresh `CandidateReport` per target on the direct path and per call on the autoupdate path. `buildDirectThreePhaseArgs` sets `onCandidate` and passes the report to the phase-3 `notifyDirectFailure`. The runner catch passes it too. `notifyDirectFailure` spreads `revisionVersionSlot(report?.move ?? {})`. The cascade catch spreads the reported move onto the failed outcome.
- `marketplace/update.messaging.ts`'s failed arm spreads `revisionVersionSlot(outcome)`.
- Scenarios: the `--partial` update states `from 1.0.0`. The mcp-phase failure in `update-rollback.feature` and both held-lock update scenarios in `state-lock.feature` state `from 1.0.0` and `version 1.1.0`. Their cause chains did not change.
- Catalog: `failed-with-rollback-partial`, `update-degraded-and-dropped`, and the two `autoupdate-partially-installed-*` states render the arrow. The prose that said a failed row never carries a move is rewritten. The count stays at 301. `EXPECTED_UTF8_BYTES` moved 48_761 -> 48_805 (four arrows of 11 bytes each).

## Task Commits

1. Task 1: a partial update shows the version it moved from, with the grammar, the wire, and the autoupdate failed arm. Commit `e1d64242`.
2. Task 2: a failed update names the move it attempted, on both cascades. Commit `2ed2b634`.
3. Task 3: the catalog shows the moves on partial and failed update rows. Commit `322fb597`.
4. Scenario fix found by `npm run check`: a failed autoupdate row in `features/marketplace/update.feature`. Commit `f4ad5b3e`.

## update-flow.test.ts rows whose expectation changed

| Case | Row | After the candidate? |
| --- | --- | --- |
| FLR-02: updateSinglePlugin under a held state lock | cascade failed outcome gains `fromVersion 1.0.0` / `toVersion 1.0.1` | yes, the lock is hit at the intent mark |
| FLR-01: a held scope lock fails an update that is due | `⊘ hello v1.0.0 → v1.1.0 (failed) {lock held}` | yes, the intent mark |
| ST-9: a version that advanced under an in-flight update | `⊘ gp v9.9.9 (1111111) → v9.9.9 (2222222) (failed) {concurrently updated}` | yes, the intent mark; the same version with two commits names both |
| ST-9: a record uninstalled under an in-flight update | `⊘ gp v9.9.9 (1111111) → v9.9.9 (2222222) (failed) {concurrently uninstalled}` | yes, the intent mark |
| AFILE-04: an update that fails after its MCP commit | `⊘ hello v1.0.0 → v1.0.1 (failed) {rollback partial}` | yes, phase 3 |
| AFILE-04 / CR-01: a bulk update that aborts on a later plugin's failure | `⊘ zzz v1.0.0 → v1.0.1 (failed) {unreadable manifest}` | yes, the intent-mark state load |
| FORCE-02 and CR-01 `--partial` cases (not failed rows) | `◉ hello v1.0.0 → v1.1.0 (partially-installed) …` | not applicable, task 1's partially-installed arrow |

The layer-refusal and unreadable-walk cases needed no change: they fail before any candidate and still render no version. A new case proves that in a bulk update the second target's failure names its own move (`zzz v1.0.0 → v1.0.1`), not the first target's (`hello v1.0.0 → v2.0.0`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The autoupdate failed arm moved from task 2 into task 1**
- Found during: task 1 commit (the hook's `fallow` run)
- Issue: exporting `revisionVersionSlot` with only in-module and test consumers failed fallow's unused-export gate. Its planned consumers were all in task 2.
- Fix: task 1 also carries `marketplace/update.messaging.ts`'s failed arm (`...revisionVersionSlot(outcome)`) and the `fromCommit` / `toCommit` fields on `PluginUpdateFailedOutcome` that arm reads, with their tests. The test "prefers a typed failure reason and preserves its Error cause" now expects `version 9.1.0` and `from 9.0.0`, because its outcome carries both versions. Task 2 kept the rest.
- Commit: `e1d64242`

**2. [Rule 3 - Blocking] `revisionCommits` stays file-private**
- The plan's artifact list names it as an export. It has no consumer outside `update-row.ts`, so exporting it would fail the same gate (see the 25-03 summary).

**3. [Rule 1 - Expected behavior change] Two update-flow `--partial` cases and one autoupdate scenario**
- Found during: task 2 (`update-flow.test.ts`) and the first `npm run check` run (cucumber)
- Issue: the FORCE-02 and CR-01 `--partial` cases in `update-flow.test.ts` pin the partially-installed row. Task 1's change made them show the arrow, but task 1's hook did not run that pair. Separately, "Autoupdate continues in installed order after a plugin fails" in `features/marketplace/update.feature` (outside the plan's file list) has a failed `zeta` row that fails while staging, after its candidate.
- Fix: the two cases expect the arrow (task 2 commit). The scenario states `from 1.0.0` and `version 1.10.0` on the `zeta` row (commit `f4ad5b3e`).

**4. [Rule 3 - Blocking] Complexity caps**
- `wireVersion` reached cyclomatic 21 with the new arm. The `from` and commit fields moved into a `moveFields` helper.
- `formatPluginRow`'s version slot moved into `renderVersionSlot`, a switch over the layout mode.
- `composeVersionArrow` takes `to: string | undefined`, so the move arm needs no branch for a row with `from` but no `version` (no producer builds one).

**5. [Rule 2 - Test hygiene] Two test helpers gained parameters**
- `refusedUpdateNotification`'s first parameter is now `subject`, so the FLR-01 case can pass `hello v1.0.0 → v1.1.0`.
- `failLoadsAfterHelloUpdate(helloVersion)` takes the version whose save trips the failing loads, so the new bulk case can move `hello` to 2.0.0.
- `update-swap.test.ts` extracted `seedRefusedWorkflowTarget` so the new phase-3 commits case and the existing AFILE-04 case share the setup.

No file owned by Phase 26 was staged, and `update-preflight.ts` was not edited. Reinstall compiles unchanged and sets no `onCandidate` yet.

## Verification

- `npm run test:coverage:direct` on every task 1 and task 2 source (including `reinstall-flow.ts`, `marketplace/update.ts`, and `update-cascade.ts`): exit 0.
- `node --test test/architecture/json-output-docs.test.ts`: pass. `npm run test:architecture`: exit 0.
- `npx fallow health --quiet --fail-on-issues --format human --complexity`, `fallow dead-code`, `fallow dupes`: exit 0.
- Cucumber: `update.feature`, `update-rollback.feature`, `state-lock.feature`, `reinstall.feature` (unedited), and `git-source-update.feature`, 59 of 59 passed. All of `features/marketplace/` passed after the fix.
- `npm run check` at `322fb597`: exit 1. One autoupdate scenario failed (deviation 3).
- `npm run check` at `f4ad5b3e`: exit 0, with 750 of 750 scenarios passing.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-07 is mitigated: `updatePluginsWith` creates a fresh `CandidateReport` inside the per-target loop, `updateSinglePluginWith` creates one per call, and a bulk unit case proves that the second target names its own move. T-25-08 holds: the thrown error is passed through unwrapped, and every cause-chain cell in the changed scenarios is the same as before.

## Self-Check: PASSED

- Commits `e1d64242`, `2ed2b634`, `322fb597`, and `f4ad5b3e` are ancestors of HEAD.
- `export function revisionVersionSlot` appears once in `update-row.ts`. `export function preflightMove` appears once in `update-swap.ts`.
- `onCandidate` appears in `materialize-latest.ts` and twice in `update-flow.ts`, once per cascade.
- `carrying the post-update version rather than the arrow` does not appear in `docs/output-catalog.md`.
