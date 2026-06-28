---
phase: 71-partial-hook-force-install
plan: 01
subsystem: api
tags: [hooks, resolver, typebox, partition, supportability, typescript]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: three-way resolver state + structural precedence (D-64-07)
  - phase: 58-hooks-supportability
    provides: checkMatcherSupportability four-condition TOOL-02 gate + bucket-A tables
provides:
  - "partitionHooks: accumulating event + matcher-group + handler partition of a validated HooksConfig"
  - "DroppedHook discriminated union + HooksPartition type"
  - "parseHooksConfig success arm returns the FILTERED supported subset as value plus a dropped enumeration"
  - "Structural-vs-supportability split: S1/S2/X1 stay {ok:false}; degradable drops no longer fail the parse"
  - "Three synthetic partial-hook fixtures (stop-only, posttooluse-and-stop, pretooluse-matcher-mix)"
affects: [resolver routing (Plan 02), info enumeration, catalog-uat, force-install staging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accumulating partition replaces reject-on-first-failure (return -> push + continue)"
    - "Structural failure signalled out of a pure partition via a tagged internal error caught at the parse seam"

key-files:
  created:
    - tests/fixtures/hooks-stop-only.json
    - tests/fixtures/hooks-posttooluse-and-stop.json
    - tests/fixtures/hooks-pretooluse-matcher-mix.json
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - tests/domain/components/hooks.test.ts
    - tests/architecture/hooks-supportability.test.ts

key-decisions:
  - "Q1 locked: non-command handlers drop at HANDLER granularity (filter group.hooks; empty group -> drop group; empty event -> drop event)"
  - "X1 table-desync surfaces structurally via HooksTableDesyncError caught by parseHooksConfig (stays loud {ok:false})"
  - "Two-commit split (fixtures first, then source+test migration) because the repo-wide npm-typecheck pre-commit hook couples the test-import migration to the source change"

patterns-established:
  - "partitionHooks: pure/total over validated input; the four trip helpers' (a)/(b)/(c)/(d) conditions map 1:1 onto the DroppedHook kind+cond discriminants"
  - "ifPredicates compiled over partition.supported, never the unfiltered candidate, so a dropped handler's if-predicate never enters dispatch"

requirements-completed: [PHOOK-01, PHOOK-03]

coverage:
  - id: D1
    description: "partitionHooks accumulates every supportability failure into a dropped enumeration and returns the supported strict subset at event + matcher-group + handler granularity (D-71-01/02, Q1)"
    requirement: PHOOK-01
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks.test.ts#PHOOK-01: regex matcher drops the group with cond=regex (a)"
        status: pass
      - kind: unit
        ref: "tests/domain/components/hooks.test.ts#D-71-02: a mixed event keeps the clean group and drops only the unsupportable group"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-supportability.test.ts#PHOOK-01: partitionHooks maps each unsupportable matcher to its DroppedHook discriminant"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseHooksConfig success arm returns the filtered subset as value plus dropped; structural S1/S2/X1 still return {ok:false} (structural precedence preserved)"
    requirement: PHOOK-03
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks.test.ts#PHOOK-03: parseHooksConfig success arm returns the filtered subset as value plus dropped"
        status: pass
      - kind: unit
        ref: "tests/domain/components/hooks.test.ts#parseHooksConfig returns {ok:false,reason} when a type:'command' entry is missing the required `command` field"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three synthetic partial-hook fixtures parse and partition correctly (empty-subset edge, event-level drop, intra-event matcher-group partition)"
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks.test.ts#D-71-02: hooks-pretooluse-matcher-mix fixture keeps the clean group, drops the regex group"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-06-28
status: complete
---

# Phase 71 Plan 01: partitionHooks foundation primitive Summary

**Converted the hooks supportability gate from reject-all to an accumulating `partitionHooks` that returns the supported `HooksConfig` strict subset plus a `dropped` enumeration at event + matcher-group + handler granularity, with `parseHooksConfig` threading the filtered subset while structural defects stay `{ok:false}`.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 6 (1 source, 3 fixtures, 2 tests)

## Accomplishments
- `partitionHooks(config): HooksPartition` replaces the first-fail `checkMatcherSupportability`, accumulating every drop instead of returning on the first trip (PHOOK-01 / D-71-01).
- A mixed event keeps only its supportable matcher groups; non-`command` handlers drop at HANDLER granularity, with empty groups and empty events omitted (D-71-02, Q1 locked).
- `parseHooksConfig` success arm returns `value` = filtered subset and `dropped` = the skip enumeration; `ifPredicates` are compiled over the filtered subset so a dropped handler's `if` predicate never enters dispatch (D-71-03).
- Structural precedence preserved: invalid JSON (S1), schema failure incl. `type:"command"` with no `command` (S2), and the X1 table-desync programmer bug all still resolve `{ok:false}` (PHOOK-03); X1 stays loud via `HooksTableDesyncError`.
- Three synthetic partial-hook fixtures added; unit + architecture supportability tests migrated to assert the partition discriminants.

## Task Commits

1. **Task 2 (fixtures portion): partial-hook fixtures** - `9c4552ce` (test)
2. **Task 1 + Task 2 (test migration): partition + migrated tests** - `175b2b67` (feat)

_Note: the fixtures landed first because the repo-wide `npm-typecheck` pre-commit hook runs on any `extensions/**/*.ts` change; the source change and its test-import migration had to land together to keep every commit green._

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` - `DroppedHook`/`HooksPartition` types, `partitionHooks` (+ `partitionEventGroups`/`partitionGroupHandlers` helpers), `MatcherCond`/`MatcherTrip` internal discriminants, `HooksTableDesyncError`, widened `HookConfigParseResult` ok-arm, `parseHooksConfig` partition seam.
- `tests/domain/components/hooks.test.ts` - migrated (a)/(b)/(c)/(d) supportability cases to `partitionHooks` assertions; added D-71-02 mixed-event/sibling-survival cases, the parseHooksConfig filtered-subset assertion, and three fixture-driven tests.
- `tests/architecture/hooks-supportability.test.ts` - migrated Block 6 from the debugDetail-prefix contract to the `DroppedHook` kind+cond discriminant contract; table blocks 1-5b unchanged.
- `tests/fixtures/hooks-stop-only.json`, `hooks-posttooluse-and-stop.json`, `hooks-pretooluse-matcher-mix.json` - synthetic partition fixtures.

## Decisions Made
- **Q1 (handler-drop granularity):** dropped non-`command` handlers at HANDLER level by filtering `group.hooks`; an emptied group is omitted and an emptied event is omitted. Maximizes installed surface and satisfies PHOOK-04 "never stage a dropped handler."
- **X1 structural signal:** `partitionHooks` raises an internal `HooksTableDesyncError` (caught by `parseHooksConfig` -> `{ok:false}`) rather than widening the public `HooksPartition` type. The function stays total for all validated user input; the only non-total path is the arch-test-guarded, statically-unreachable table-desync programmer bug.
- **Trip-helper refactor:** the four trip helpers now return a `cond`/structural discriminant directly instead of `(a)/(b)/(c)/(d)` debugDetail strings; the `(a)->regex`, `(b)->unmapped-tool`, `(c)->no-matcher-support|closed-set`, `(d)->handler` mapping is 1:1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test-import migration coupled into the source commit**
- **Found during:** Task 1
- **Issue:** The repo's `npm-typecheck` pre-commit hook runs a full-project `tsc` whenever any `extensions/**/*.ts` is staged. Committing the source change alone would fail that gate because both test files still imported the removed `checkMatcherSupportability`.
- **Fix:** Landed the three fixtures in a first commit (no typecheck trigger), then the source change plus both migrated test files together in a single green commit. Each commit passes the full pre-commit gate.
- **Files modified:** (commit ordering only; same files as planned)
- **Verification:** `pre-commit run` green on both commits; `npm run typecheck` green.
- **Committed in:** `9c4552ce`, `175b2b67`

**2. [Rule 1 - Bug] Refactored partitionHooks to satisfy the cognitive-complexity lint gate**
- **Found during:** Task 1
- **Issue:** The single-function `partitionHooks` tripped `sonarjs/cognitive-complexity` (25 > 15) on the triple-nested event/group/handler loop.
- **Fix:** Extracted `partitionEventGroups` (per-event) and `partitionGroupHandlers` (per-group P6/Q1 filter) helpers; behavior identical.
- **Files modified:** extensions/pi-claude-marketplace/domain/components/hooks.ts
- **Verification:** `npm run lint` green; the 55 migrated tests still pass.
- **Committed in:** `175b2b67`

**3. [Rule 1 - Bug] Repurposed the supportability-failure debug-log test**
- **Found during:** Task 2
- **Issue:** The pre-existing `hookDebugLog fires for supportability failure` test asserted `parseHooksConfig` returns `{ok:false}` on a regex matcher. That path is now degradable (`{ok:true}` + `dropped`), so the assertion is obsolete.
- **Fix:** Removed the obsolete assertion as part of migrating the supportability block to `partitionHooks`. Debug-log coverage for structural failures is unaffected (S1/S2 still log via the unchanged arms).
- **Files modified:** tests/domain/components/hooks.test.ts
- **Verification:** Migrated test file green (55/55).
- **Committed in:** `175b2b67`

---

**Total deviations:** 3 auto-fixed (1 blocking commit-ordering, 2 bug/lint-and-test consequences of the partition change)
**Impact on plan:** No scope creep. All changes stay within the plan's six declared files; resolver/info/catalog files were not touched.

## Issues Encountered

**Expected wave-transitional breakage (owned by downstream plans).** Because `parseHooksConfig` now returns `{ok:true}` (with `dropped`) for previously-failing non-bucket-A / unsupported-matcher configs, the resolver's `applyHooksConfig` currently treats those plugins as supported rather than dirty. This is the documented foundation for Plan 02's `partial.unsupported` routing. The full `npm run check` is therefore NOT green in isolation: exactly **2 tests fail**, both in `tests/orchestrators/plugin/info.test.ts` (the INFO-05 `Stop (unsupported)` lenient-reader cases). RESEARCH Deliverable 3/4 and Pitfall 1 explicitly assign this lenient->strict reader flip to a downstream plan (info enumeration migration). The resolver tests (54/54) and catalog-uat (4/4) remain green. Plan 01's scoped verification — `npm run typecheck` + `node --test` on the two named test files — is green (55/55).

## Self-Check: PASSED

- Files: all three fixtures + the two test files + `hooks.ts` present and committed.
- Commits `9c4552ce`, `175b2b67` present on `features/force-install`.
- `npm run typecheck` green; `partitionHooks`/`DroppedHook`/`HooksPartition` exported; no new REASONS member; closed-set tables unchanged.

## Next Phase Readiness
- `parseHooksConfig.value` is now the filtered subset and `dropped` is available — Plan 02 can route degradable drops to `partial.unsupported` and split `applyHooksConfig` into `unsupported` vs `unavailable`.
- The 2 failing INFO-05 tests are the expected hand-off to the info-enumeration migration plan; no action needed in this plan.

---
*Phase: 71-partial-hook-force-install*
*Completed: 2026-06-28*
