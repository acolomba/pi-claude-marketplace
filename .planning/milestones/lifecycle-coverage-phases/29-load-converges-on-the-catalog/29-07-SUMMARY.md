---
phase: 29-load-converges-on-the-catalog
plan: 07
subsystem: reconcile
tags: [pending, apply, dependency-verdict, load-01, miss-01, output-catalog, dependency-resolution, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-05: apply runs the MISS-01 dependency install on every run and drops the reason gate"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-03: planListNeedsApply selects the apply trailer and needsApply"
provides:
  - "pendingReconcile computes buildScopeSatisfactionVerdict per readable scope and passes it to planReconcile (D-21)"
  - "pending previews apply's D-09-07 re-plan: a dependent whose missing dependency a planned install brings gets no disable row, and a held-down dependent the install releases gets its enable"
  - "pending drops a planned dependency disable of a record that is already disabled"
  - "Catalog and dependency-resolution prose name apply as the command that disables, lifts, installs and removes; pending lists it first"
affects: [29-08, 29-14, pending, load, docs]

actuals:
  tokens: 16900
  tasks: 2
  commits: 2
plan_head_before: 99d54a41313df4b629743f20e329718c9498064d
plan_head_after: 807803481af1dc3cbd843a38c8b78cbe09ca97bc

tech-stack:
  added: []
  patterns:
    - "A read-only preview mirrors apply's re-plan by removing the dependents the planned installs satisfy from the verdict and planning again, taking only the toggle buckets from the second plan"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - test/orchestrators/reconcile/pending.test.ts
    - features/plugin/pending.feature
    - docs/output-catalog.md
    - docs/dependency-resolution.md

key-decisions:
  - "pending previews apply's D-09-07 re-plan: when the plan holds a dependency install, pending removes from the verdict each dependent the planned installs satisfy (fixpoint: a missing dependency a planned install names, or a dependency the check releases and nothing else disabled) and takes the enable, disable and dependency-disable buckets from a second planReconcile call"
  - "A planned dependency disable of a record already disabled is dropped in pending, because apply's disable answers it as a no-op with no row"
  - "pending reports no unreadable-declarer row for a failed walk; it only plans no dependency row (D-05-07). The load and apply keep their own warning row"

patterns-established:
  - "Pending dependency rows: `◍ <dependent> (will disable)` and `● <dependency> (will install)` under the scope's marketplace block, each one tally success"

requirements-completed: []

coverage:
  - id: D1
    description: "pending lists an enabled plugin whose declared dependency is unsatisfied as (will disable), with needsApply"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21: pending previews what apply makes for an enabled plugin whose declared dependency is too old"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists the disable of a plugin that an update left needing a newer version of its dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending lists a missing declared dependency as (will install) and no disable for the dependent the install satisfies"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21: pending previews what apply makes for a recorded plugin whose declared dependency is not installed"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21: pending previews what apply makes for a chain whose last link misses a dependency the install brings"
        status: pass
    human_judgment: false
  - id: D3
    description: "pending lists nothing for a user-disabled or still-held record, and (will enable) once the dependency is satisfied"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21 cases for the user-disabled, held-down and now-satisfied records"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unreadable declaration walk plans no dependency row, and pending writes nothing"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-05-07: a declarer whose manifest cannot be read plans no dependency row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-21 / NFR-5: previewing a dependency disable leaves state.json and the config byte-identical"
        status: pass
    human_judgment: false
  - id: D5
    description: "The catalog and the dependency-resolution guide say apply makes the dependency disable and install and pending lists them"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts (EXPECTED_UTF8_BYTES unchanged at 51_136)"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy and readability of the rewritten paragraphs need a reader's judgment"

duration: 19min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 07: Pending Lists the Dependency Disables and Installs Apply Makes Summary

**`/claude:plugin pending` now runs the LOAD-01 satisfaction verdict that `apply` runs. It lists `◍ <plugin> (will disable)` for an enabled plugin whose dependency is unsatisfied and `● <dependency> (will install)` for a missing declared dependency, and it lists nothing `apply` would not do (D-21, superseding PENDING-VERDICT-01).**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-24T17:32:29Z
- **Completed:** 2026-10-24T17:51:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `pending.ts`: for each readable scope, `buildScopeSatisfactionVerdict({ state, locations })` runs (offline, no lock), and `planReconcile` gets it as the fourth argument. The module header says D-21 supersedes PENDING-VERDICT-01 and that a failed walk plans nothing (D-05-07).
- `pending.ts`: `withPlannedInstallsLanded` previews apply's D-09-07 re-plan. When the plan holds a dependency install, the dependents that the planned installs satisfy are removed from the verdict (a fixpoint in `releasedDependents`), and the toggle buckets come from a second `planReconcile` call. `withoutDisabledDependents` drops a dependency disable of a record that is already disabled. Both build new plans with a spread.
- `notify.ts`: the projection header, the function doc comment, the disable loop comment and the `isReconcilePlanListEmpty` comment no longer say that every caller passes no verdict.
- `dependency-verdict.ts`: the header no longer says the read pass is its only caller.
- `pending.test.ts`: 10 new cases on a real temporary tree (disable, user-disabled skip, held-down stays out, lift, missing install, chain release, partial release, user-disabled dependency, unreadable walk, byte-identical state and config).
- `pending.feature`: "Pending lists the disable of a plugin that an update left needing a newer version of its dependency".
- `docs/output-catalog.md`: the pending intro names the dependency rows. The three LOAD-01 states and the MISS-01/MISS-02 states name `apply`. No example block changed.
- `docs/dependency-resolution.md`: every sentence that said a reload disables, lifts, installs, or removes now says `/claude:plugin apply` does it, `pending` lists it first, and a load only reports it. The "A reload never prunes" sentences stay. The `#the-load-time-check` anchor is unchanged.

## Task Commits

1. **Task 1: End-to-end `(will disable)` for a plugin whose dependency is too old** - `c8c158e1` (feat). Tracer gate: the full `<verify>` chain ran again after the commit and passed.
2. **Task 2: The catalog and the dependency doc say `apply` makes the LOAD-01 disable** - `80780348` (docs)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pending would list a disable that apply does not make**
- **Found during:** Task 1
- **Issue:** The round-1 plan holds a dependency disable for a dependent whose only unsatisfied declaration is a missing dependency. `apply` installs that dependency, plans again (D-09-07), and leaves the dependent enabled (apply.test.ts MISS-01 case: one `{dependency installed}` row, deploy-kit stays enabled). The plain verdict would have shown `◍ app (will disable)` beside `● vault (will install)`, which breaks the plan's own done criterion ("nothing apply would not make").
- **Fix:** `withPlannedInstallsLanded` and `releasedDependents` in pending.ts. They run only when the plan holds a dependency install, which is also when apply plans again. The other buckets stay the first plan's, as in apply.
- **Limit:** the preview assumes the planned installs succeed. If an install fails at apply time, apply disables the dependent; pending cannot know that in advance. It also does not check the catalog version of a newly installed dependency against a range.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts, test/orchestrators/reconcile/pending.test.ts
- **Commit:** c8c158e1

**2. [Rule 1 - Bug] Stale "only caller" comment in dependency-verdict.ts**
- **Found during:** Task 1
- **Issue:** The header said the read pass is the verdict's only caller.
- **Fix:** It names `pending` as the second, unlocked caller (D-21).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
- **Commit:** c8c158e1

**3. [Rule 1 - Doc accuracy] Two dependency-doc sentences described behavior D-02 already changed**
- **Found during:** Task 2
- **Issue:** "At the next reload, each named dependent is disabled" and "uninstalling `c` disables both `b` and `a`" are false since 29-05: apply now installs a missing declared dependency again (LOAD-03 / MISS-01 apply test), so the dependent is disabled only when that install fails.
- **Fix:** The named-uninstall paragraph says the next `apply` installs the plugin again and disables the dependents only if that install fails. The chain example uses disabling `c` instead of uninstalling it. The layer-removal paragraph says the next `apply` installs the dependency again.
- **Files modified:** docs/dependency-resolution.md
- **Commit:** 80780348

**Total deviations:** 3 auto-fixed (2 bug, 1 doc accuracy). **Impact:** pending matches apply's success path; no other production behavior changed.

## Verification

- Task 1 `<verify>` chain: passed (rerun as the tracer gate). Coverage at 100% for pending.ts, notify.ts and dependency-verdict.ts.
- Task 2 `<verify>`: catalog-contract.test.ts passed with `EXPECTED_UTF8_BYTES = 51_136` unchanged.
- Also run: the four features that call pending (143 scenarios), `npm run check:features`, `npm run test:unpaired`, test/edge/handlers/plugin/pending.test.ts, test/integration/plugin-layer-consistency.test.ts.
- Acceptance: `buildScopeSatisfactionVerdict` in pending.ts = 2 (baseline 0); `claude:plugin apply` in dependency-resolution.md = 10 (baseline 0); `npm run lint` exit 0; the new scenario passes by `--name`.
- `npm run check` at plan end (HEAD 80780348): **exit 0**. Tail of the log:

```text
passed typecheck (11.5 s)
passed lint (4.2 s)
passed lint:workflows (0.4 s)
passed fallow (5.6 s)
passed format:check (7.8 s)
passed test:corresponding (4.0 s)
passed check:features (3.3 s)
16 hooks (16 passed)
778 scenarios (778 passed)
7431 steps (7431 passed)
Merged LCOV: coverage/direct.lcov (284 records)
```

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- 29-08 (the load's pending block) gets the dependency rows through the same plans. The test/index.test.ts missing-dependency load case will see `● helper (will install)` alone, with no disable row for its dependent.
- docs/plugin-enablement.md still says "A `/reload` installs a MISSING dependency"; 29-14 owns that file.
- dependency-verdict.ts's WR-07 paragraph still says "disables it on the next reload" (pre-existing wording, left alone).

## Self-Check: PASSED

- c8c158e1 and 80780348 are ancestors of HEAD.
- All key files exist.
