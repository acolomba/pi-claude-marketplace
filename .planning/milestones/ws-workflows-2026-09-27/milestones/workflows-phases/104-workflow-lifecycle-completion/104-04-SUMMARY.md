---
phase: 104-workflow-lifecycle-completion
plan: 04
subsystem: orchestrators
tags: [workflows, update, three-phase-swap, closed-union, per-bridge-guard]

# Dependency graph
requires:
  - phase: 104-workflow-lifecycle-completion
    provides: the array-shaped workflows fixture option and makePluginRecord's workflows override; withHermeticWorkflowHome
  - phase: 104-workflow-lifecycle-completion
    provides: previousWorkflowNames as a live parameter and the WR-06 ownership refusal
  - phase: 103-workflow-artifact-materialization
    provides: prepareStageWorkflows / commitPreparedWorkflows / abortPreparedWorkflows
provides:
  - the workflows slot in update's hand-rolled three-phase swap (prepare, both aborts, commit, inventory)
  - "workflows" as a member of all THREE mirrors of the update path's closed phase set
  - the add + remove + rename triad proven over one fixture pair
affects: [104-05, 104-06]

actuals:
  tokens: 4600
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - A closed set mirrored in more than two places is found by the compiler, not by inspection — widening two of three mirrors fails typecheck at the third
    - A negative guard case states why it reads as vacuous before the guard exists, and asserts a sibling advanced so the run is pinned as a real one

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "The previous-name list is `record.resources.workflows` — the recorded inventory — supplied as a REQUIRED field, not a conditional spread. The update path always has a record; a plugin without one is not an update candidate."
  - "`UpdatePhaseBridge` in `orchestrators/types.ts` is a THIRD mirror of the closed phase set the plan named two of. It had to be widened too: it is what carries a bridge failure OUT to the cascade caller's row, so a member missing there is a failure the caller cannot be told about."
  - "No warning aggregation was invented on the update path. It aggregates no bridge's `result.warnings` at all — only reinstall has `collectStagingWarnings`. The gap is pre-existing and symmetric across all six bridges."
  - "No workflows arm in `collectDegradedKinds`: `DegradeKind` is closed over skills and commands, and the workflows handle carries soft-fails on `warnings`, not on a `degraded` member."

patterns-established:
  - "The triad is ONE case over ONE fixture pair. A rename is an add plus a remove, and only the interaction catches reading it as a replace."
  - "Planting the previous version's envelopes before the update is what makes the remove half observable; without them the case passes on an accumulate."

requirements-completed: [WLIF-02]

coverage:
  - id: D1
    description: "An update materializes the new version's workflow envelopes at the engine's canonical saved path — the swap reaches the workflows bridge at all."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts — 'WLIF-02: an update stages the new version's workflow envelope at the engine's canonical path' (RED observed: ENOENT on the saved directory)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Updating to a version that adds one workflow, removes another and renames a third leaves exactly the new version's envelopes and nothing from the old one; a name unchanged between versions is replaced in place."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts — 'WLIF-02: an update adds, removes and renames workflows in one pass' (asserts the renamed workflow's NEW name present AND its OLD name absent, separately)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`resources.workflows` is reassigned under its own independent per-bridge failure guard, so a failed workflows commit leaves the OLD inventory intact."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts — 'WLIF-02: a refused workflows commit leaves the OLD recorded inventory in place' (deep-equals version A's names; asserts `resources.skills` advanced so the run is pinned as a real update)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A workflows failure during the commit sequence is representable: omitting the member from the type union or the runtime tuple is a compile error."
    requirement: "WLIF-02"
    verification:
      - kind: other
        ref: "`npm run typecheck` failed with TS2322 at update.ts:2174 until `UpdatePhaseBridge` was widened — the guard demonstrated itself during execution"
        status: pass
    human_judgment: false
  - id: D5
    description: "Materialize order mirrors the install ledger (workflows after mcp) and unwind order is its exact reverse (workflows first)."
    requirement: "WLIF-02"
    verification:
      - kind: other
        ref: "code inspection: the commit arm sits after the mcp arm (update.ts:2066); both abort helpers unwind workflows first (update.ts:1275, :1300)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Updating again over identical workflow scripts replaces each envelope in place with no accumulation and no duplicate names."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts — 'WLIF-02: a second update over identical workflows changes neither disk nor record' (deep-equals the saved-directory contents map across both runs)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Recorded `resources.workflows` is stable in filename order, because discovery sorts its directory entries before staging."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "the triad asserts `['hello:added', 'hello:keep', 'hello:after']` — the order of `added.js`, `keep.js`, `renamed.js`, not of the generated names"
        status: pass
    human_judgment: false
  - id: D8
    description: "Previous-versus-staged name comparison is exact string equality — no normalization, no case folding, no collation."
    requirement: "WLIF-02"
    verification:
      - kind: other
        ref: "code inspection: update supplies `record.resources.workflows` verbatim; the bridge's `displacePreviousTargets` joins each name unchanged. No Intl, normalize, localeCompare or toLowerCase on either side of the comparison."
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 04: The workflows slot in update's three-phase swap Summary

**`update` now prepares, aborts, commits and records workflows as a sixth bridge, so an author's workflow fix reaches the user and a withdrawn workflow stops running — and the closed phase set turned out to have three mirrors, not two.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Commits:** 4
- **Files modified:** 4 (0 created)

## Accomplishments

- **Six insertion points, no phase array.** `update.ts` is a hand-rolled swap, not a `runPhases` ledger, so the work is `PrepHandles.workflows`, the prepare call after `mcp`, an arm in each of the two abort helpers, the phase-3a commit arm after `mcp`, and the inventory reassignment in `finalizeUpdateRecord`.
- **The previous-name list is the recorded inventory.** `record.resources.workflows` is the only thing naming what the previous version wrote — the envelopes sit outside every scope root, so nothing on disk can be enumerated to rediscover them. Deriving the list from version B would miss exactly the removed and renamed cases the triad exists to catch.
- **The compile guard proved itself mid-execution.** Widening the type union and the runtime tuple was not enough: `tsc` rejected the commit arm at a THIRD mirror, `UpdatePhaseBridge` in `orchestrators/types.ts`. See the deviation below. That is the guard behaving exactly as its comment promises.
- **The inventory advances only when the commit did.** The reassignment sits behind `!failedPhases.has("workflows")`, like the five arms above it, so a refused commit leaves the record naming version A's envelopes — the ones actually on disk.
- **The triad is one case.** Version B adds one workflow, drops another and rewrites a third's `meta.name`; the case asserts the new name present AND the old name absent, and that the unchanged name was replaced in place rather than skipped.

## Task Commits

1. **Task 1 RED — the failing staging proof** — `a68f4f6e` (test)
2. **Task 1 GREEN — the six insertion points and the three unions** — `c71358eb` (feat)
3. **Task 2 RED — the triad, the failure guard, idempotency** — `b1e3e00b` (test)
4. **Task 2 GREEN — the inventory reassignment guard** — `3af38cca` (feat)

## Files Created/Modified

- `orchestrators/plugin/update.ts` — the workflows bridge import; `PrepHandles.workflows`; the prepare call with `previousWorkflowNames`; workflows-first arms in `abortPartialHandles` and `abortHandles`; the two-branch commit arm after `mcp`; the widened `PHASE3_FAILURE_PHASES`; the sixth `finalizeUpdateRecord` guard; two documented non-changes (`collectDegradedKinds`, the warning gap); the reworded fifth-bridge comments.
- `orchestrators/types.ts` — `UpdatePhaseBridge` gains `"workflows"`, with a comment naming all three mirrors and what each one gates.
- `shared/errors.ts` — `Phase3Failure["phase"]` gains `"workflows"`.
- `tests/orchestrators/plugin/update.test.ts` — the `withHermeticWorkflowHome` import, a `namedWorkflowScript` builder, `readSavedWorkflows` and `plantEnvelope` helpers, and four cases.

## Decisions Made

- **`previousWorkflowNames` is a required field here, not a conditional spread.** The install path spreads conditionally because a fresh install has no record. The update path always has one — a plugin without a record is not an update candidate — so the optionality would be dead weight that hides the contract.
- **The third union mirror was widened rather than worked around.** Casting at the `phaseFailures` map site would have compiled, and would have made a workflows failure unrepresentable to the cascade caller. The union is the right place.
- **No new warning channel.** `handles.workflows.result.warnings` is not aggregated, because this path aggregates no bridge's warnings. Adding one for workflows alone would be a new mechanism dressed as a missing arm, and would leave five bridges silently asymmetric with it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The closed phase set has THREE mirrors, not two**

- **Found during:** Task 1, at the first `npm run typecheck` after the commit arm landed
- **Issue:** The plan names two places `"workflows"` must join — `Phase3Failure["phase"]` in `shared/errors.ts` and the `PHASE3_FAILURE_PHASES` runtime tuple. Widening both left `tsc` failing with TS2322 at `update.ts`'s `phaseFailures` map: `UpdatePhaseFailure.phase` is typed `UpdatePhaseBridge`, a third mirror of the same set living in `orchestrators/types.ts`. It is the shape that carries a bridge failure OUT to the cascade caller's rendered row, so leaving it un-widened would have made a workflows failure unnameable to the caller even though the finalize gate could see it.
- **Fix:** `UpdatePhaseBridge` gains `"workflows"`, and its doc comment now names all three mirrors and states what each one gates, so the next bridge finds the full set instead of two thirds of it. `PluginFailedMessage.rollbackPartial[].phase` is documented as a free-form label and needed no change.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`
- **Commit:** `c71358eb`

### Plan Statements Corrected

**2. [Acceptance-criterion wording] The `commitPreparedWorkflows` and `abortPreparedWorkflows` greps return 2 and 3, not 1 and 2**

The criteria expect the comment-stripped greps over `update.ts` to return `1` and `2`. They return `2` and `3`: the named-import block contributes one occurrence of each symbol on top of the call sites. The stated intent — one commit arm after `mcp`, two abort arms — holds exactly, confirmed by `grep -n`: `commitPreparedWorkflows` at the import (`:87`) and `:2066`; `abortPreparedWorkflows` at the import (`:86`), `:1275` and `:1300`. This is the same class of wording gap 104-02 and 104-03 each recorded once.

**3. [Test-shape clarification] "Updating twice to the same version" cannot be taken literally**

The plan asks for an idempotency case that runs "the same update twice". A literal second run short-circuits on version equality (PUP-3) and materializes nothing, so it would prove nothing about the commit. The case therefore bumps the manifest to a third version shipping the IDENTICAL workflow scripts, which is the shape that would actually expose an accumulate or a duplicate. The test comment states this so it is not later "simplified" back into a no-op.

**4. [Test-shape note] The failure-guard case is vacuous before the guard exists**

An inventory that is never written trivially keeps its old value, so this case passed on the RED run. That is inherent to a negative guard, not a defect in the case. It is written to compensate: it also asserts `resources.skills` advanced to `["hello-tool"]`, which pins the run as a real update in which the workflows arm alone held back, rather than an update that did nothing at all. The comment above the case says so.

## Issues Encountered

None beyond the deviation above.

## Verification

- `npm run check` exits 0 — typecheck, ESLint, Prettier, the unit suite and the integration suite (18/18) all pass.
- `node --test tests/orchestrators/plugin/update.test.ts` — 105/105 (101 before this plan, plus four new cases).
- `node --test "tests/orchestrators/plugin/*.test.ts" "tests/orchestrators/marketplace/*.test.ts" "tests/bridges/workflows/*.test.ts"` — 1017/1017, 0 skipped.
- RED was observed before GREEN on both tasks: Task 1's case failed with `ENOENT ... /saved`; Task 2's triad failed on the record assertion (`['hello:keep','hello:gone','hello:before']` where `['hello:added','hello:keep','hello:after']` was expected) while its disk assertions already passed — the exact split the two tasks divide.
- `grep -v comments shared/errors.ts | grep -c '"workflows"'` → 1.
- `grep -v comments update.ts | grep -c 'sRecord.resources.workflows'` → 1; `| grep -c 'stagedNames'` → 1 (read directly, no `generatedName` mapping).
- `grep -rniE 'future fifth bridge' extensions/ | wc -l` → 0.
- `grep -rn 'Phase<UpdateCtx>' extensions/ | wc -l` → 0 — no phase-array construct was introduced for `update.ts`.
- `npx eslint` on both changed source files and the test file — zero errors, including `sonarjs/cognitive-complexity`; no new disable directive was added.
- No line added by this plan cites a GSD process artifact: `git diff 02339c0b..HEAD -- extensions tests | grep '^+' | grep -inE 'phase [0-9]|plan [0-9]|wave [0-9]|task [0-9]|milestone|pitfall [0-9]|pattern [0-9]'` returns nothing. The anchors used are `WLIF-02`, `CR-03`, `WR-06`, `D-63-01`.
- `STATE.md` and `ROADMAP.md` were not staged or modified by this plan. (`STATE.md` carries an unrelated working-tree modification owned by the orchestrator, unchanged since before this plan started.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 104-05 (`reinstall`) inherits the same shape and the same trap: it must widen every mirror of its own closed sets, and its record composer drops the carried-forward `previousWorkflows` parameter rather than branching on it. Unlike update, reinstall DOES have a warning-aggregation channel (`collectStagingWarnings`), so a workflows arm belongs there.
- Any future bridge added to the update path must join three unions, not two. `UpdatePhaseBridge`'s doc comment now names all three.

No blockers.

## Self-Check: PASSED

All 4 modified files verified present on disk. All four task commits verified in `git log`: `a68f4f6e`, `c71358eb`, `b1e3e00b`, `3af38cca`. `git status --short` shows only the pre-existing orchestrator-owned `STATE.md` modification. `npm run check` re-run green after the last code commit.

---
*Phase: 104-workflow-lifecycle-completion*
*Completed: 2026-08-15*
