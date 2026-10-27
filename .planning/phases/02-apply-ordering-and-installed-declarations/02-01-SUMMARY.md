---
phase: 02-apply-ordering-and-installed-declarations
plan: 01
subsystem: reconcile
tags: [pending, apply, convergence, dependency-verdict, MISS-01]

requires: []
provides:
  - "ScopeSatisfactionOptions.scheduled, forwarded by buildScopeSatisfactionVerdict"
  - "releasableDependents(verdict, state, scheduled?) and verdictWithout(verdict, released, scheduled?)"
  - "withPlannedInstallsLanded exported from reconcile/convergence.ts (moved from pending.ts), with the D-PL2-14 fixpoint"
  - "MoveCascade.enablesAfterInstalls (D-PL2-16)"
  - "buildReconcilePendingNotification(..., enablesAfterInstalls) trailing parameter; pending rows in apply's order"
affects: [02-03 apply driver, 02-02, read-pass]

actuals:
  tokens: 14445
  tasks: 2
  commits: 2
plan_head_before: 138eb4ca285965555afa64bad6c9f73a5b2593df
plan_head_after: 3684379c77f12fbca52f6412006a17344283968b

tech-stack:
  added: []
  patterns:
    - "Scheduled installs count as present in the release loop and in the replanned verdict (one shared planner path for pending and apply)"
    - "Bounded grow-only fixpoints for the D-PL2-14 release and the D-PL2-16 waiting set"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - test/orchestrators/reconcile/dependency-verdict.test.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "D-PL2-02: the release loop and its verdicts count every planned install (config and MISS-01) as present; a released dependent keeps its scheduled-missing entries so the replan still plans those installs"
  - "D-PL2-14: withPlannedInstallsLanded counts a record the replan enables as released, to a bounded fixpoint"
  - "D-PL2-16: enables of records that wait on a planned install leave plan, deferredEnables and preview and travel as MoveCascade.enablesAfterInstalls"

patterns-established:
  - "pending row order inside a block mirrors apply: marketplace actions, config installs, uninstalls, disables, enables, moves, dependency installs, after-install enables, holds, declines"

requirements-completed: [RCN-01, RCN-02, RCN-04]

coverage:
  - id: D1
    description: "pending lists PENDMOVE-01 as zcore and widget moves, then the extra install, with no disable"
    requirement: RCN-01
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#APL-02 / D-14: pending previews what apply makes for a move whose newer dependency declares a plugin the scope lacks, moved before that install (D-PL2-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending lists MISSORDER-01 as widget and ycore moves, then the newdep install"
    requirement: RCN-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#APL-02 / D-14: pending previews what apply makes for a missing dependency that needs a version the catalog moves to, installed after the moves (D-PL2-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-PL2-14 release and D-PL2-16 after-install enables in the shared planner, listed by pending after the installs"
    requirement: RCN-01
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-PL2-14 / D-PL2-16 cases"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21: ... the config enables and the check holds down"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-PL2-05 recorded at judgeFinalScope; the WR-07 header says apply, not the load, disables the dependent"
    requirement: RCN-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/dependency-verdict.test.ts#D-PL2-05 / D-05-07: a final judgement whose walk fails answers the walk's failure"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-10-27
status: complete
---

# Phase 2 Plan 01: Pending in apply's order Summary

**`pending` now counts every planned install as present when it judges catalog moves, and lists moves, then missing-dependency installs, then the enables that wait on them, which is the order the reordered `apply` makes them in.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-10-27T03:09:14Z
- **Completed:** 2026-10-27T03:42:08Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- PENDMOVE-01 (pending side): `pending` lists `zcore v1.0.0 → v2.0.0 (will update)`, `widget v1.0.0 → v1.1.0 (will update)`, `extra (will install)` and no `widget (will disable)`.
- MISSORDER-01 (pending side): `pending` lists `widget (will update)`, `ycore (will update)`, then `newdep (will install)`.
- `scheduled` threads through `buildScopeSatisfactionVerdict`, `releasableDependents`, `verdictWithout` and the `releaseOnLandedMoves` loop (D-PL2-02). `judgePlannedScope` and the release loop share one `plannedInstallKeys` helper.
- `withPlannedInstallsLanded`, `releasedDependents` and `independentlyDisabledKeys` moved from pending.ts to convergence.ts; only `withPlannedInstallsLanded` is exported. Their direct coverage is in convergence.test.ts.
- D-PL2-14: a dependency the user disabled and the replan enables releases its dependents (bounded fixpoint in `withPlannedInstallsLanded`).
- D-PL2-16: `MoveCascade.enablesAfterInstalls` carries the enables whose record waits on a planned install; `pending` lists them after the dependency installs and counts them for emptiness and the apply trailer.
- RCN-04 / D-PL2-05: comment at `judgeFinalScope`'s first-unreadable-record return; the WR-07 header paragraph now says the load changes nothing (APL-D1) and `apply` disables the dependent.

## Task Commits

1. **Task 1: Pending lists the PENDMOVE-01 moves and the MISSORDER-01 install in apply's order** - `90921cf7` (fix)
2. **Task 2: A plan-enabled dependency counts as released, and enables that wait on a planned install are listed after it** - `3684379c` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts` - `scheduled` on `ScopeSatisfactionOptions`; `releasableDependents` and `verdictWithout` take `scheduled`; D-PL2-05 comment; WR-07 paragraph fixed.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts` - `plannedInstallKeys`; scheduled-aware release loop; moved helpers; D-PL2-14 fixpoint; `waitingOnInstalls` and `MoveCascade.enablesAfterInstalls`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` - imports `withPlannedInstallsLanded`; passes `enablesAfterInstalls` to the projection, the empty check and `needsApply`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - `pushConvergence` split into `pushConvergenceMoves` and `pushBlockedMoves`; dependency installs and after-install enables render after the moves and before the holds.
- Four owner test files, as listed in key-files.

## Pre-change failures (RED)

Task 1, the two new `catalogMoveRows` cases on the pre-change code (HEAD `138eb4ca`):

```text
✖ APL-02 / D-14: pending previews what apply makes for a move whose newer dependency declares a plugin the scope lacks, moved before that install (D-PL2-02)
  + actual - expected
        message: '● tools [project]\n' +
  +       '  ● extra (will install)\n' +
  +       '  ◍ widget (will disable)\n' +
          '  ● zcore v1.0.0 → v2.0.0 (will update)\n' +
  -       '  ● widget v1.0.0 → v1.1.0 (will update)\n' +
  -       '  ● extra (will install)\n' +

✖ APL-02 / D-14: pending previews what apply makes for a missing dependency that needs a version the catalog moves to, installed after the moves (D-PL2-02)
  + actual - expected
        message: '● tools [project]\n' +
  +       '  ● newdep (will install)\n' +
          '  ● widget v1.0.0 → v1.1.0 (will update)\n' +
          '  ● ycore v1.0.0 → v2.0.0 (will update)\n' +
  -       '  ● newdep (will install)\n' +
```

After the planner change alone (before the notify reorder), PENDMOVE-01 already listed the two moves and no disable; only the row order still failed.

Task 2, the D-PL2-14 D-21 row on the code Task 1 left (`90921cf7`):

```text
✖ D-21: pending previews what apply makes for a dependency the user disabled, the config enables and the check holds down
  + actual - expected
        message: '● tools [project]\n' +
  +       '  ● core (will enable)\n' +
          '  ● vault (will install)\n' +
  -       '  ● core (will enable)\n' +
```

The new marker-lift row ("a plugin the check holds down whose missing dependency the same apply installs") and the `composePendingReport` D-PL2-16 case failed the same way (`app (will enable)` before `vault (will install)`). The convergence.test.ts D-PL2-14 and D-PL2-16 cases were checked by mutation instead (not committed): dropping the `enabled` clause in `releasedDependents` fails the D-PL2-14 case, and an empty waiting set fails all three D-PL2-16 convergence cases plus the three pending cases.

## Changed expectations (with reason)

- pending.test.ts D-21 row "a plugin whose missing dependency is installed but whose other one stays too old": `vault (will install)`, `app (will disable)` became `app (will disable)`, `vault (will install)`. Reason: the projection now lists dependency installs after the moves, and disables come before both, as in the reordered `apply` (D-PL2-01/02).
- pending.test.ts D-21 row "a dependency the user disabled, the config enables and the check holds down": `vault (will install)`, `app (will disable)`, `core (will enable)` became `core (will enable)`, `vault (will install)` in Task 1 and `vault (will install)`, `core (will enable)` in Task 2. Reason for the dropped `app` disable in Task 1: the release loop now releases `core` (its only missing dependency is scheduled), and `verdictWithout` drops `app`'s `disabled` entry naming a released dependent. Task 2 moves `core`'s enable after the install (D-PL2-16).
- convergence.test.ts "APPLY1-01: a released dependent whose own move stays held keeps the caller's plan" and "a held-down dependent that waits on no move is enabled with the toggles": add `enablesAfterInstalls: []` (new required field).
- No apply.test.ts, read-pass.test.ts or cucumber expectation changed. `npm run test:cucumber`: 901 scenarios passed. `features/plugin/pending.feature` was not edited.

## Decisions Made

See `## Decision rows` and `## Uncertain choices (for user review)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `verdictWithout` dropped the install the release relied on**
- **Found during:** Task 1
- **Issue:** with `releasableDependents` honouring `scheduled`, a dependent whose only blocking entry was a scheduled missing dependency was released, and `verdictWithout` then removed that `missing` entry. The planner derives the MISS-01 bucket from it, so the replanned plan lost the install, the after-moves verdict found the dependency missing again, and the loop fell back to the caller's plan (PENDMOVE-01 stayed `widget (will disable)`).
- **Fix:** `verdictWithout(verdict, released, scheduled = new Set())` keeps a released dependent's `missing` entries whose dependency is scheduled. The replan (which goes through `withPlannedInstallsLanded`) re-plans the install and releases the dependent again. Not in the plan's artifact table; signature-compatible (optional third parameter).
- **Files modified:** dependency-verdict.ts, dependency-verdict.test.ts
- **Commit:** `90921cf7`

**2. [Rule 3 - Blocking] Architecture guard rejected the prose "force-install"**
- **Found during:** Task 1 commit hook (`test/architecture/partial-vocabulary-guard.test.ts`, D-75-01)
- **Issue:** the reworded projection doc comment put `force-install key` on one line.
- **Fix:** reworded to "It never carries the partial modifier". Commit retried.
- **Commit:** `90921cf7`

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## CHANGELOG line

- `pending` now lists a plugin's catalog update and the missing dependency it needs in the order `apply` makes them, and no longer shows a disable that `apply` does not make.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-02 | The shared planner (`releaseOnLandedMoves`, `verdictAfterMoves`, `buildScopeSatisfactionVerdict`, `releasableDependents`) counts every planned install, config or MISS-01, as present; a released dependent keeps its scheduled `missing` entries so the replan still plans them; `pending` lists moves, then dependency installs | `apply` installs missing dependencies after its moves (D-PL2-01), so a dependent waiting only on such an install is never disabled by `apply`; one planner path for `pending` and `apply` keeps the preview exact |
| D-PL2-14 | `withPlannedInstallsLanded` counts a dependency that the replan enables as released, to a grow-only fixpoint | `apply` enables that dependency in the same pass, so `pending` must not list its dependent as disabled (APL-D1: `pending` is the preview contract) |
| D-PL2-16 | Enables of records that wait on a planned install (a `missing` entry the install satisfies, or a `disabled` entry on a waiting record) leave `plan`, `deferredEnables` and `preview` and travel as `MoveCascade.enablesAfterInstalls`; `pending` lists them after the installs | `enable` refuses a record whose closure holds an uninstalled member (enable-disable.ts:816-821), so `apply` must run them after MISS-01 |

## Backlog dispositions

- **PENDMOVE-01:** pending side done here (`pending` lists the two moves and the install, no disable). Closes in 02-03 with the `apply` side and the scenarios.
- **MISSORDER-01:** pending side done here (`pending` lists the moves before the install). Closes in 02-03 with the `apply` side and the scenarios.

## Uncertain choices (for user review)

1. **`verdictWithout` keeps scheduled `missing` entries** (deviation 1). Alternative: copy the input plan's install buckets into the replanned plan. Why: the planner keeps deriving the MISS-01 bucket from the verdict, and `withPlannedInstallsLanded` already releases such a dependent. For `apply`'s read pass, which replans with bare `planReconcile` until 02-03, a released dependent with a retained entry is dependency-disabled in the replan, as it was in the input plan before; no apply/read-pass test moved.
2. **D-PL2-14 fixpoint bound:** the records any replan enabled are accumulated across rounds, so the released set only grows and the loop stops when a round adds no dependent (at most one round per dependent). Alternative: use only the latest replan's enables (not provably monotone).
3. **D-PL2-14 overlap with the release loop:** with D-PL2-02 in place, the release loop already removes the `app` disable for the D-21 row through `verdictWithout`; the `releasedDependents` change covers the path where the release loop falls back to the caller's plan. The mutation check showed the D-21 pending row still passes without the `releasedDependents` change; the direct convergence case pins it.
4. **D-PL2-16 waiting set uses `input.verdict`** (the verdict before toggles of the release loop) and the judged plan's planned-install keys, as the plan specifies. A record waiting on a planned *config* install is also withheld (the plan's key set includes `pluginsToInstall`); 02-03's re-read after the config install moves such records back into plain enables.
5. **A withheld record with its own move** is listed twice by `pending`, as `(will update)` and then `(will enable)` after the installs. The WR-02 one-row rule applies to `deferredEnables`; 02-03 decides how `apply` reports such a record's move.
6. **The emptiness and `needsApply` counts of `enablesAfterInstalls` in `composePendingReport`** cannot change the result today: an after-install enable always comes with the install it waits on, which is already counted. Kept as the plan asks.

## Requirements status

The plan lists RCN-01, RCN-02 and RCN-04, and `requirements-completed` copies them, but each is shared with a later plan (RCN-01/RCN-02 with 02-03, RCN-04 with 02-02), so this plan delivers only their planner and verdict halves. `requirements.mark-complete` was run and then reverted: REQUIREMENTS.md keeps all three unchecked until 02-02 and 02-03 land.

## Next Phase Readiness

02-03 can adopt `withPlannedInstallsLanded` in `readPassForScope`'s replan and carry `MoveCascade.enablesAfterInstalls` out on `ScopeReadResult`. The wave gate runs `npm run check` on the combined tree.

## Self-Check: PASSED

- FOUND: all 8 modified files
- FOUND: `90921cf7`, `3684379c` (ancestors of HEAD)
- Commits measured: `git rev-list --count 138eb4ca..HEAD` = 2
