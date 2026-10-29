---
phase: 05-marketplace-command-parity
plan: 02
subsystem: orchestrators
tags: [marketplace-remove, cascade, partial-failure, exhaustiveness, satisfies]

requires: []
provides:
  - "marketplace remove folds a partial cascade through the shared applyPartialCascadeFold, hooks axis included (MKT-08)"
  - "applyPartialCascadeFold maps every UnstageOutcome dropped axis through one table typed satisfies Record<keyof UnstageOutcome[\"dropped\"], ...>, so a new axis fails the typecheck until mapped"
  - "D-PL5-14 recorded: marketplace remove reports no stranded dependents (MKT-06, PRUNE-GUARD-MR-01 closed as decided)"
affects: [marketplace remove, uninstall, disable, install cascades]

actuals:
  tokens: 3459
  tasks: 2
  commits: 2
plan_head_before: 3843c0f1
plan_head_after: 2f51d2a9796bee7ce028deb12aef666698982ff8

tech-stack:
  added: []
  patterns:
    - "as const satisfies Record<keyof Outcome, keyof Target> axis table with an Object.keys loop, the key-list assertion justified by the satisfies clause"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - test/orchestrators/marketplace/remove.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - test/orchestrators/plugin/shared.test.ts

key-decisions:
  - "D-PL5-14: marketplace remove names no dependents it strands in other marketplaces; LOAD-03 / D-06-07 report them at the next load, pending, and apply; refusal stays off the table (D-05-07)"
  - "D-PL5-15: one typed axis table drives applyPartialCascadeFold; remove.ts calls it instead of a hand-rolled five-axis copy"

patterns-established:
  - "Exhaustive dropped-axis fold: extend UnstageOutcome[\"dropped\"] and the typecheck points at DROPPED_AXIS_FIELDS"

requirements-completed: [MKT-08, MKT-06]

coverage:
  - id: D1
    description: "A partially failed marketplace remove subtracts all six dropped axes, hooks included, from the kept row; an AG-5 failure keeps the row intact"
    requirement: MKT-08
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/remove.test.ts#D-PL5-15: a partial failure subtracts every dropped axis, hooks and workflows included, from the persisted row"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyPartialCascadeFold maps each dropped axis to its record field through a satisfies-typed table (commands -> prompts)"
    requirement: MKT-08
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/shared.test.ts#D-PL5-15: subtracts every dropped axis from its record field and keeps the rest"
        status: pass
      - kind: other
        ref: "scratch copy with a seventh UnstageOutcome dropped axis: tsc reports TS1360 at plugin/shared.ts DROPPED_AXIS_FIELDS (not committed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MKT-06 settled as D-PL5-14 with no code change"
    requirement: MKT-06
    verification: []
    human_judgment: true
    rationale: "Decision record only; the prohibition (never refuse a remove over a cross-marketplace dependent) is held by the absence of such code, which a reviewer confirms"

duration: 47min
completed: 2026-10-27
status: complete
---

# Phase 05 Plan 02: Exhaustive cascade fold for marketplace remove Summary

**A partially failed `marketplace remove` now drops the deleted hooks from the kept plugin row: remove.ts calls the shared `applyPartialCascadeFold`, which maps all six unstage axes through one `satisfies`-typed table, so a new axis fails the typecheck until it is mapped.**

## Performance

- **Duration:** about 47 min (most of it waiting on commit hooks that siblings' concurrent writes kept failing)
- **Started:** 2026-10-27T02:59Z
- **Completed:** 2026-10-27T03:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `cascadePluginsInPlace` in `orchestrators/marketplace/remove.ts` no longer has its own five-axis filter, which skipped hooks. It calls `applyPartialCascadeFold(plugin, outcome.dropped)` inside the unchanged AG-5 guard.
- `applyPartialCascadeFold` in `orchestrators/plugin/shared.ts` takes `dropped: UnstageOutcome["dropped"]` and `installed: { resources: PluginInstallRecord["resources"] }`. It loops over a module-private `DROPPED_AXIS_FIELDS` table, `as const satisfies Record<keyof UnstageOutcome["dropped"], keyof RecordResources>`.
- Owner tests now assert the whole `resources` object for all six axes. The remove case seeds a kept name and a dropped name on every axis.

## Task Commits

1. **Task 1: A partial `marketplace remove` folds the dropped hooks through the shared fold:** `12e472fe` fix(marketplace): drop removed hooks from a partially removed plugin
2. **Task 2: Make the shared fold exhaustive over the unstage axes:** `2f51d2a9` refactor(plugin): map every dropped cascade axis through one typed table

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`: imports `applyPartialCascadeFold` from `../plugin/shared.ts` and calls it in place of the hand-rolled filter
- `test/orchestrators/marketplace/remove.test.ts`: the case that pinned the hooks gap now proves the fix across all six axes (`resources.hooks` keeps only the kept hook)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`: only `applyPartialCascadeFold` changed, plus the new `DROPPED_AXIS_FIELDS` table, the `RecordResources` alias, and an inline `type UnstageOutcome` import. Phase 1 owns the warning functions in this file, and they were not touched.
- `test/orchestrators/plugin/shared.test.ts`: one six-axis fold case, with workflows included

## Decisions Made

- **D-PL5-14 (MKT-06, PRUNE-GUARD-MR-01 closed as decided, no code change):** `marketplace remove` reports only the plugins it uninstalled. Claude Code 2.1.310 prints `Also uninstalled <n> plugin(s) from this marketplace:` and names no dependents (05-CONTEXT.md E-5). LOAD-03 / D-06-07 report each unmet dependent at the next load, `pending`, and `apply`. Refusing a remove because another marketplace's plugin depends on one of its plugins stays off the table (D-05-07), because that refusal would bring back the two-stale-records deadlock.
- **Key-list assertion:** the loop uses `Object.keys(DROPPED_AXIS_FIELDS) as (keyof typeof DROPPED_AXIS_FIELDS)[]`, with a comment explaining why it holds. The plan allows this. No cast can let a missing axis compile, because the `satisfies` clause checks the table itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The resources alias leaked into an exported signature**
- **Found during:** Task 2 commit hook (`fallow dead-code`, private-type-leak)
- **Issue:** Without an alias, Prettier wraps the `satisfies` clause over four lines, so the plan's one-line grep found nothing. I added a `RecordResources` alias to keep it on one line. Using that alias in the parameter of the exported `applyPartialCascadeFold` tripped fallow's private-type-leak rule.
- **Fix:** The alias is used only in the table's `satisfies` clause. The parameter is `PluginInstallRecord["resources"]`.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
- **Committed in:** 2f51d2a9

**2. [Scope] The second fold test case was merged into the first**
- The old case "subtracts the dropped workflow envelope and leaves the other four axes alone" said the workflows axis was "NOT compile-forced". That is no longer true. The merged six-axis case covers everything it asserted, so I removed it instead of leaving a false comment and a duplicate assertion.

**3. [Process] The exhaustiveness proof ran in a scratch copy**
- I added the seventh `UnstageOutcome["dropped"]` axis in a scratchpad copy of `extensions/` (node_modules symlinked). I did not edit and revert the shared tree, so sibling hooks never saw the scratch edit. `tsc` reported TS1360 at `DROPPED_AXIS_FIELDS` in plugin/shared.ts. The copy was deleted afterwards.

**Total deviations:** 1 auto-fixed bug and 2 scope or process choices. **Impact:** none on behavior. All callers (install-cascade.ts, enable-disable.ts, install-disable-cascade.ts, uninstall.ts) compile unchanged.

## Issues Encountered

- The shared-tree parallel mode made commits slow. Sibling pre-commit runs stashed my unstaged edits twice and restored them later. Separately, my own hook runs failed on sibling files that were mid-edit: `test/domain/name.test.ts` lint, `add.test.ts` format, `source.test.ts` typecheck, and "files were modified by this hook". Before each commit I backed up my diff as a patch. After each commit I checked that the committed diff was byte-identical to that backup (`t1-identical`, `t2-identical`).
- The plan's commit ledger (`git rev-list --count 3843c0f1..HEAD`) also counts sibling commits in this shared tree. The `commits: 2` above was measured with `git rev-list --count 3843c0f1..HEAD -- <this plan's four files>`.

## Verification

- `node --test test/orchestrators/plugin/shared.test.ts test/orchestrators/marketplace/remove.test.ts`: 230 pass, 0 fail (on the committed tree)
- `npm run test:coverage:direct -- .../marketplace/remove.ts` and `-- .../plugin/shared.ts`: both exit 0
- `tsc --noEmit`, eslint on all four files (`--max-warnings 0`), `fallow dead-code` (production run and the cycle run), `fallow dupes`, `fallow health`: all exit 0. The task 2 commit hook (`check:commit`) passed.
- Acceptance greps: the `satisfies Record<keyof UnstageOutcome["dropped"]` count is 1, the `dropped.workflows.includes` count in plugin/shared.ts is 0, the `applyPartialCascadeFold` count in remove.ts is 2, and the `dropped.commands.includes` count in remove.ts is 0.
- Not run: the full `npm run check`, which is the orchestrator's wave gate.

## User Setup Required

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-02 is mitigated: the typed axis table plus the six-axis remove assertion keep every dropped axis out of the saved row.

## Self-Check: PASSED

- FOUND: 12e472fe, 2f51d2a9 (both ancestors of HEAD)
- FOUND: all four modified files; there are no unstaged leftovers on this plan's paths
