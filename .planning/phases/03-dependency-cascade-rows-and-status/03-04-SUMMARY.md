---
phase: 03-dependency-cascade-rows-and-status
plan: 04
subsystem: dependency-cascade
tags: [install, dependency-cascade, anthropic-plugin-directory, refusal, truncation, cucumber]

requires:
  - phase: 03-dependency-cascade-rows-and-status
    provides: "truncateForRefusal (03-01); the hoisted recordingLookup and the declared map resolveCascade fills (03-03)"
provides:
  - "export const MAX_DIRECTORY_PIN_FIELD_CHARS = 120 in domain/dependency-range.ts"
  - "MemberConstraintOptions.declared (module-private), filled from resolveCascade's recorded walk edges"
  - "rangeRequirers names every range-declaring cascade member in reverse closure post order; the root keeps rootRequiredBy or []"
  - "directoryPin.declared is the joined range list cut once at 120 units"
  - "assertDirectoryPinSatisfied passes DirectoryPinUnsatisfiedError the plugin name, listed version, and each requirer cut at 120"
  - "two install-dependencies.feature scenarios (every declarer, long version)"
affects: [03-06 phase gate and the D-PL3 decision records]

actuals:
  tokens: 6300
  tasks: 2
  commits: 2
plan_head_before: 81905cf5acb7abfe4a389f4b883870c8b9aac08b
plan_head_after: cca36ac5c078cf313be3d1243aba12f4b58e33ce

tech-stack:
  added: []
  patterns:
    - "A refusal whose message a shared/ error class builds gets its fields cut by the orchestrator caller, because shared/ cannot import domain/"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/dependency-range.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - features/plugin/install-dependencies.feature
    - docs/output-catalog.md

key-decisions:
  - "D-PL3-08 as amended by D-PL3-13: a non-root directory member's refusal names every cascade member that declared a range on it, nearest the requested plugin first (reverse closure post order); installed plugins outside the closure are not named"
  - "D-PL3-09: name, listed version, joined ranges, and each requirer are cut at 120 UTF-16 code units with a single ellipsis; requirer count uncapped"
  - "D-PL3-10: every other refusal keeps MAX_RENDERED_RANGE_CHARS = 200 with '... (+N chars)'"

patterns-established:
  - "Requirer order comes from the closure, not from the walk's lookup order, so a diamond names its declarers as Claude Code does"

requirements-completed: [CAS-05]

coverage:
  - id: D1
    description: "A directory pin refusal for a non-root member names every range-declaring cascade member, nearest the requested plugin first"
    requirement: CAS-05
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose anthropic-plugin-directory dependency two of its plugins constrain names both plugins in the version conflict"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#GV-01 / D-PL3-08: a plugin directory member's range names every member that declared a range on it, nearest the requested plugin first"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#GV-01 / D-PL3-08: a plugin directory member's range does not name a member that declared it with no range"
        status: pass
    human_judgment: false
  - id: D2
    description: "The directory pin refusal cuts the plugin name, listed version, joined ranges, and each requirer at 120 code units"
    requirement: CAS-05
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose anthropic-plugin-directory dependency lists a very long version shows the version cut to 120 characters in the version conflict"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#GV-01 / D-PL3-09: a plugin directory member's joined ranges are cut once at 120 characters"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#GV-01: a plugin directory copy with a version and a requirer past 120 characters refuses the install as Claude Code does"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#GV-01 / D-PL3-09: a plugin directory refusal cuts a plugin name past 120 characters at 120"
        status: pass
    human_judgment: false
  - id: D3
    description: "The catalog prose of dependency-directory-pin-unsatisfied states both rules, with no example byte change"
    requirement: CAS-05
    verification:
      - kind: other
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 04: Directory Pin Refusal Requirers and Cuts Summary

**The Anthropic Directory pin refusal now names every plugin of the install that declared a range on the dependency, in Claude Code's order (`required by "app", "mid"`), and cuts the plugin name, the listed version, the joined ranges, and each requirer to 120 code units with `…`.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-27T05:19:44Z
- **Completed:** 2026-10-27T05:34:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `MemberConstraintOptions` gains `declared`, the edges `recordingLookup` recorded during the walk. `resolveCascade` passes its map in, and `requestersOf` now takes a `ReadonlyMap`.
- `rangeRequirers` returns `rootRequiredBy ?? []` for the root (MISS-01). For any other member it takes the declarers from `requestersOf` whose ranges are non-empty, then orders them by the reversed closure post order. A diamond `foo -> a, b` with both `a` and `b` constraining `dirp` names `b, a`, not the walk order `a, b`. A member that declares the dependency with no range is not named. `ClosureMember.requiredBy` and the walk's not-found wording are unchanged.
- The directory-pin arm of `resolveOneMember` sets `declared` to `truncateForRefusal(ranges.join(", "), 120)`. Every other `renderDeclaredRanges` caller keeps the 200-character bound (D-PL3-10).
- `assertDirectoryPinSatisfied` cuts the plugin name, the listed version (an undefined version stays undefined, so `no version` still renders), and each requirer after the `@marketplace` part is dropped. `shared/errors.ts` is unchanged.
- The catalog prose for `dependency-directory-pin-unsatisfied` states the every-declarer rule, the D-PL3-13 divergence, and the 120 cut. No example bytes changed.

## Task Commits

1. **Task 1: A plugin directory refusal names every plugin of the install that declared a range on the dependency** - `dd722ab0` (fix)
2. **Task 2: The plugin directory refusal cuts each field at 120 characters** - `cca36ac5` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-range.ts` - `MAX_DIRECTORY_PIN_FIELD_CHARS = 120`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `declared` option, every-declarer `rangeRequirers`, the 120 cut of `directoryPin.declared`
- `test/orchestrators/plugin/install-cascade.test.ts` - two D-PL3-08 rows (reverse post order, no-range declarer left out) and the D-PL3-09 joined-range cut case
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - `assertDirectoryPinSatisfied` and its import only
- `test/orchestrators/plugin/install-outcome.test.ts` - `SeedOptions.pluginName`, two rows in the GV-01 loop (120 units shown whole, past 120 cut), and a long plugin name case
- `features/plugin/install-dependencies.feature` - two new scenarios
- `docs/output-catalog.md` - prose only

## Decisions Made

D-PL3-08 (as amended by D-PL3-13), D-PL3-09, and D-PL3-10 were applied as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scenario dependency syntax for `mid`**
- **Found during:** Task 1
- **Issue:** The plan wrote `mid`'s dependency as `dirp@>=2.0.0`. A string dependency carries a range only through the caret marker `@^` (D-01-27), so `dirp@>=2.0.0` would read as a marketplace name.
- **Fix:** The scenario uses the object form `dirp (>=2.0.0)`, which the `dependencies` cell reader already supports. The marketplace defaults to the declarer's, so the dependency is the same `dirp@anthropic-plugin-directory`.
- **Committed in:** dd722ab0

**2. [Rule 1 - Expectation] The intersected range of `^1.0.0` and `>=1.0.0`**
- **Found during:** Task 1
- **Issue:** The intersection keeps both conjuncts (`>=1.0.0 <2.0.0-0 >=1.0.0`). The first draft of the unit expectation simplified it.
- **Fix:** The expectation uses the real range. The case is about `requiredBy`, which was already correct.
- **Committed in:** dd722ab0

---

**Total deviations:** 2 (1 blocking scenario syntax fix, 1 test expectation fix).
**Impact on plan:** None on behavior.

## Issues Encountered

- RED evidence: the every-declarer scenario failed on `required by "app"` alone before the code change. The long-version scenario and the three past-120 unit cases failed with the three source files reverted (`git checkout` of those files only, then `git apply` of the saved diff). The 120-unit boundary row passed before and after, as expected.
- The D-PL3-08 unit case for a direct `foo -> dirp@^1.0.0` dependency is the existing GV-01 case, which still passes with `requiredBy: ["foo@marketplace"]`. The two root GV-01 / D-09-05 cases also pass unchanged.

## Touched outside Files

- `orchestrators/plugin/install-outcome.ts`: `assertDirectoryPinSatisfied` and its import block only. The listed version is read there, and `shared/errors.ts` cannot import `domain/`, so the cut fields are passed in (D-PL3-09). `git diff dd722ab0..cca36ac5 -- extensions/pi-claude-marketplace/shared/errors.ts` prints nothing.
- `test/orchestrators/plugin/install-outcome.test.ts`: its paired test, including the optional `pluginName` seed option.

## Known gaps

- Installed plugins outside the closure that constrain the member are not named (D-PL3-13). Claude Code names them. Naming them would need a scan of installed declarations and would print a range this extension does not check (D-03-10).
- The requirer order matches Claude Code only as far as this closure post order matches upstream's closure order (RESEARCH A1). It can differ for some diamonds. The difference is cosmetic.
- Upstream's `Mt` normalization (ANSI strip, whitespace collapse, NFC, backticks) is not applied. Names pass the token allowlist and ranges pass the range parser.

## CHANGELOG line

- A plugin directory version conflict now names every plugin of the install that asked for a range, and cuts long names, versions, and ranges to 120 characters.

## Decision rows

| **D-PL3-08 / D-PL3-13 (plugin-lifecycle, uncertain): a non-root plugin directory member's refusal names every cascade member that declared a range on it** -- nearest the requested plugin first (reverse closure post order); installed plugins outside the closure are not named; the root keeps `rootRequiredBy` | Claude Code names every range-declaring cascade member in the same order; it also names installed plugins outside the closure, but D-03-10 keeps their ranges out of the walk and the check, so naming them would print a requirer whose range is neither shown nor checked | Shipped; two unit rows and one `install-dependencies.feature` scenario. For user review (alternative: scan installed declarations and name them) |
| **D-PL3-09 (plugin-lifecycle): the plugin directory pin refusal cuts the plugin name, the listed version, the joined ranges, and each requirer at 120 UTF-16 code units with `…`** -- no dangling high surrogate; requirer count uncapped; `MAX_DIRECTORY_PIN_FIELD_CHARS` | Claude Code cuts each field with `Mt(…, 120)` | Shipped; unit cases and one scenario |
| **D-PL3-10 (plugin-lifecycle, uncertain): every other refusal keeps `MAX_RENDERED_RANGE_CHARS = 200` with `... (+N chars)`** | Upstream uses 64 per range and 200 for the joined list with `…`; aligning them is deferred | Kept. For user review |

## Backlog dispositions

- `PARITYGV-01` b2 (every declarer): fixed for cascade members (CAS-05), with the D-PL3-13 divergence recorded.
- `PARITYGV-01` b3 (truncation): fixed for the directory pin refusal (D-PL3-09). Other refusals keep their bounds (D-PL3-10).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-49 (the 120 cuts) and T-03-50 (only range-declaring cascade members are named) are mitigated as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-05 can proceed. The catalog still holds 324 states and 54_539 bytes. Plan 03-06 runs the phase gate (`npm run check`).

## Self-Check: PASSED

- All seven modified files exist. Commits `dd722ab0` and `cca36ac5` are ancestors of HEAD, and each lists exactly its task's files.
- Acceptance greps: `required by "app", "mid"` in the feature file 1; `options.declared` in install-cascade.ts 1; `MAX_DIRECTORY_PIN_FIELD_CHARS` in install-outcome.ts 2 and in install-cascade.ts 2. The Task 2 diff of `shared/errors.ts` is empty, and its diff of install-outcome.ts touches only the import block and `assertDirectoryPinSatisfied`.
- `node --test` over install-cascade, install-outcome, dependency-range, and catalog-contract: 226 pass, 0 fail. Direct coverage of dependency-range.ts, install-cascade.ts, and install-outcome.ts reports nothing (exit 0). `install-dependencies.feature`: 40 of 40 scenarios pass. install-flow and reconcile/apply tests: 454 pass. The apply directory-pin scenario passes.
- Both commits passed the commit hook (`npm run check:commit` passed on the Task 2 commit).

---
*Phase: 03-dependency-cascade-rows-and-status*
*Completed: 2026-10-27*
