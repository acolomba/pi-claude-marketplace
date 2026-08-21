---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 01
subsystem: testing
tags: [reconcile, planner, fixed-point, node-test, config-merge]

# Dependency graph
requires:
  - phase: 102
    provides: the install-time config stamp that writes `enabled: false` into the physical file the declaration lives in, which is the state this plan asserts over
provides:
  - planner-level proof that a declared-disabled plugin over an install-disabled record reaches no action bucket, with a counter-case that makes the empty plan non-vacuous
  - a three-pass end-to-end fixed point for a base-declared install-disabled plugin, ending at `planReconcile` over state and config re-read from disk
  - the same fixed point for a plugin declared only in `claude-plugins.local.json`, read through the merged view
  - a reusable `assertInstallDisabledReloadFixedPoint` helper in `apply.test.ts` shared by both declaration sites
affects: [104-pre-install-read-surfaces, 105-dfen-08-parity-sweep]

actuals:
  tokens: 4143
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "anti-vacuity anchoring: every silence assertion sits behind a positive anchor (pass-1 row bytes end-to-end, opposite-declaration counter-case at the planner)"
    - "disk-driven planner capstone: `loadState` + `loadMergedScopeConfig` re-read AFTER the last apply pass, mirroring `apply.ts`'s own read order"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "The shared three-pass helper was introduced in Task 2 rather than extracted in Task 3, so the local-declared case reuses it instead of duplicating a 60-line body that `sonarjs/no-identical-functions` would reject."
  - "The populated-inventory control (D-103-06's case 3) is an assertion inside the planner fixed-point case rather than its own `test()`, which the plan explicitly permitted."
  - "`stateWithDisabledRecord` gained a `skills` array knob rather than a whole-`resources` override: one axis is what the ENBL-18 shape needs, and the array reads at the call site."

patterns-established:
  - "Vacuity is disproven by mutation, not by inspection: each new case was run once with its subject removed (planner key deleted; stamp stripped before the capstone; stamp mis-targeted to the base file) and observed to fail before being committed."

requirements-completed: [DFEN-06]

coverage:
  - id: D1
    description: "The reconcile planner classifies a declared-disabled plugin over an install-disabled record (`installable: true`, `enabled: false`, inventory retained) into NO action bucket, asserted as whole-plan equality with `emptyReconcilePlan` plus per-identifier negatives"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#DFEN-06 / D-103-04 / D-103-06: a declared-disabled plugin over an install-disabled record reaches NO action bucket, on two identical passes"
        status: pass
    human_judgment: false
  - id: D2
    description: "The empty plan is non-vacuous: the same state fixture under `enabled: true` reaches the enable bucket, proving it reaches `classifyDeclaredPlugin`"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#DFEN-06 counter-case: the SAME install-disabled record under a declared enabled:true DOES reach the enable bucket"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three `applyReconcile` passes over a base-declared install-disabled plugin: pass 1 renders the `(disabled)` row, passes 2 and 3 render nothing and move neither config bytes nor state record; the planner asked over disk after the last pass plans nothing"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#DFEN-06 / D-103-04 / D-103-05 / D-103-06: three reloads over a base-declared install-disabled plugin render nothing after the first, move nothing, and leave the planner with nothing to plan"
        status: pass
    human_judgment: false
  - id: D4
    description: "The same fixed point for a plugin declared only in `claude-plugins.local.json`, with the base file byte-identical across all three passes and the merged view resolving through the local file"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#DFEN-06 / D-103-07: the three-reload fixed point holds identically for a plugin declared ONLY in claude-plugins.local.json, in the MERGED view the planner reads"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 01: DFEN-06 reconcile fixed point Summary

**An install-disabled plugin is now pinned as a fixed point at both seams — the planner reaches no bucket for it, and three real reloads over the bytes a real install wrote render nothing and change nothing — with every silence assertion proven able to fail.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-15T12:06:46Z
- **Completed:** 2026-08-15T12:21:00Z
- **Tasks:** 3 of 3
- **Files modified:** 2 test files (+ 1 planning doc)

## Accomplishments

- The planner tier now states DFEN-06 as a property of the DECLARATION: a `cr@mp` entry saying `enabled: false` over a record that is `installable: true`, `enabled: false` with a populated `resources.skills` deep-equals `emptyReconcilePlan("project")` on two identical passes, and the same record under `enabled: true` reaches the enable bucket.
- The end-to-end tier now goes past the apply seam the DFEN-04 case deliberately stopped at: a third pass, zero rendered notifications, and `planReconcile` called over `loadState` + `loadMergedScopeConfig` re-read from disk after the last pass.
- The local-declared twin is green, which is the only assertion in the phase that separates a correct stamp from a silently ineffective one.
- Each new assertion was proven capable of failing before commit (see Decisions/Issues below), so none of the three is a vacuous pass.

## Task Commits

1. **Task 1: the planner cell and its counter-case** - `14fd0e2d` (test)
2. **Task 2: three reloads, base-declared, ending at the planner** - `8f370f94` (test)
3. **Task 3: the same fixed point for a local-only declaration** - `c07c4aca` (test)

## Files Created/Modified

- `tests/orchestrators/reconcile/plan.test.ts` - two new cases beside the ENBL-08 / ENBL-05 pair; `stateWithDisabledRecord` gained an optional `skills` knob defaulted to today's empty shape.
- `tests/orchestrators/reconcile/apply.test.ts` - two new cases beside their DFEN-04 siblings, plus the shared `assertInstallDisabledReloadFixedPoint` helper and five imports (`planReconcile`, `emptyReconcilePlan`, and three type imports).
- `.planning/.../103-VALIDATION.md` - the four `103-01-*` rows moved from ⬜ pending to ✅ green.

## Decisions Made

- **The helper landed in Task 2, not Task 3.** The plan allowed either. Introducing it with the base case and consuming it twice by the end of Task 3 keeps Task 3's diff to what only a local declaration can assert, and avoids two near-identical 60-line bodies that `sonarjs/no-identical-functions` treats as an error.
- **The merged-entry `enabled: false` assertion lives inside the helper.** Both declaration sites need it, and it is the assertion that stops the empty plan from being a verdict about a key the planner never saw. The local case adds `source === "local"` and `isDeclaredEnabled(...) === false` on top.
- **The inventory control is an assertion, not a case.** `resources.skills.length > 0`, `compatibility.installable === true` and `isRecordedButDisabled(record) === true` are asserted on the fixture inside the planner fixed-point case, which the plan named as the acceptable form.

## Deviations from Plan

Three, all small and all shape rather than substance.

**1. [Rule 3 - Blocking] Import ordering in `apply.test.ts`**
- **Found during:** Task 2
- **Issue:** The three new type imports tripped `import-x/order` — the external `@earendil-works/pi-coding-agent` type import must follow the relative ones inside the single type group, with no blank line between them. The plan's "add the two imports the file lacks" did not anticipate the three type imports the annotated helper signature needs.
- **Fix:** `npx eslint --fix` then `npx prettier --write`; the type group is now one block with `@earendil-works` last.
- **Verification:** `npx eslint` and `npx prettier --check` both clean on the file.
- **Committed in:** `8f370f94`

**2. Doc-comment amendment on `stateWithDisabledRecord`**
- **Found during:** Task 1
- **Issue:** The existing JSDoc asserted "every `resources.*` array emptied", which the new `skills` knob makes conditionally false.
- **Fix:** Reworded to describe both axes and cite ENBL-18 / D-100-10 for why a disabled record keeps its inventory, stating that the default preserves the shape the older cases were written against.
- **Committed in:** `14fd0e2d`

**3. The planner cases assert two extra fixture properties the plan did not name**
- **Found during:** Task 1
- **Issue:** The plan named the populated-inventory control. `compatibility.installable === true` and `isRecordedButDisabled(record) === true` are equally load-bearing: without them a future edit to the fixture could quietly drift the cell back onto the ENBL-08 PARTIAL shape or off the disabled marker entirely, and the case would still pass.
- **Fix:** Both asserted on the fixture before the plan is computed, using the already-imported predicate rather than a twin spelling.
- **Committed in:** `14fd0e2d`

---

**Total deviations:** 3 (1 Rule 3 blocking, 2 additive within task scope)
**Impact on plan:** None on scope. No production file was touched — each of the three commits changes exactly one test file and nothing else (`git show --stat` per commit: `plan.test.ts` +86/-4, `apply.test.ts` +126, `apply.test.ts` +44).

## Issues Encountered

**The anti-vacuity mandate was executed as three mutation runs, not as inspection.** The plan named two vacuity modes and asked whether a third exists. Each new assertion was temporarily broken and observed to fail:

1. **Planner counter-case** — deleting `cr@mp` from the seeded config made it fail (`not ok 23`), confirming the fixture is not passing by absence.
2. **Base-declared capstone** — stripping the `enabled: false` stamp from the declaring file just before the planner call made the capstone fail on `D-103-06: the plugin must be absent from all seven action buckets`. This is the `plan.ts` enable push firing, i.e. the exact hazard the milestone exists to close, so the capstone demonstrably detects it.
3. **Local-declared case** — simulating a mis-targeted stamp (bare entry left in the local file, `{ enabled: false }` written to the base file) made the LOCAL case fail at `pass 2 must render nothing` while the base-declared case stayed green. This is the discrimination D-103-07 predicts, observed rather than argued.

**A third vacuity mode, as the plan invited.** The two named modes are about the plan being empty and the notify count being zero. A third one sits under both: **the byte-identity assertion is vacuous if the captured baseline is itself wrong.** `assert.equal(await readFile(p), captured)` passes trivially when `p` is a file neither the code nor the test ever writes — for instance if `declaringConfigPath` were mistakenly pointed at the base file in the local case. The helper is immune only because the same path is also the file whose post-pass-1 content had to contain the stamp for the pass-1 anchor's record assertion to hold, and because the local case separately pins the base file against a pre-pass-1 capture. Worth stating for anyone extending the helper to a third declaration site: a byte-stability assertion needs the file it names to have demonstrably MOVED at some earlier point, or it proves nothing.

**Sibling-agent noise in shared verification commands.** `npm run typecheck` reports errors in `orchestrators/plugin/reinstall.ts` and `tests/orchestrators/plugin/update.test.ts`, both mid-edit by parallel plans in this wave. Neither file is mine; `npx tsc --noEmit` filtered to my two files is clean, and `node --test "tests/orchestrators/reconcile/**/*.test.ts"` is 158/158 green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DFEN-06 is fully pinned at both seams for both declaration sites. Nothing here blocks `103-05`'s phase-boundary `npm run check`, which will be the first honest whole-suite run once the sibling plans land.
- The `assertInstallDisabledReloadFixedPoint` helper is the natural reuse point for `103-06`'s "the loop is CLOSED, not relocated" criterion, which needs the same three-pass-plus-capstone shape through the standalone-install door.
- Not addressed here, and deliberately out of scope: the RESEARCH document's Finding 1 (`enable` without `--local` under a local declaration) and Finding 2 (`reinstall` re-enabling a disabled record). Plans `103-03` and `103-04` own those.

## Self-Check: PASSED

- Both modified files exist on disk.
- All three task commits exist in `git log`: `14fd0e2d`, `8f370f94`, `c07c4aca`.
- Each commit touches exactly one test file; no commit touches `extensions/`.
- `node --test "tests/orchestrators/reconcile/**/*.test.ts"` — 158 pass, 0 fail.
- `npx eslint` and `npx prettier --check` clean on both modified files.
- `npx tsc --noEmit` reports no error in either modified file.

## Known Stubs

None. No stub, skipped test, or unrun `<verify>` was left behind; every `<verify>` command in the plan was executed, except `npm run check`, which the dispatch instructions reserve for plan `103-05` because three sibling plans are mid-edit in this worktree.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*
