---
phase: 03-dependency-cascade-rows-and-status
plan: 01
subsystem: dependency-cascade
tags: [semver, notification, truncation, cucumber]

requires: []
provides:
  - "truncateForRefusal(text, limit) and MAX_REFUSAL_VERSION_CHARS = 64 in domain/dependency-range.ts"
  - "describeConstraint cuts the stage-two version to 64 UTF-16 code units"
  - "refusalCause and the WR-1 ruled-out cause in dependency-move.ts cut toVersion to 64 code units"
affects: [03-04 directory pin cut reuses truncateForRefusal]

actuals:
  tokens: 3318
  tasks: 2
  commits: 2
plan_head_before: 4b623b71d7f21def577c916dd0cc57229ac919ce
plan_head_after: 90c18e5d6d41c38a5c74449e777b88ff60f969eb

tech-stack:
  added: []
  patterns:
    - "Bound a marketplace-controlled string at render, never at parse (D-PL3-12)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/dependency-range.ts
    - test/domain/dependency-range.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
    - test/orchestrators/plugin/constraint-fold.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
    - test/orchestrators/plugin/dependency-move.test.ts
    - features/plugin/update.feature

key-decisions:
  - "D-PL3-12: a version quoted in a hold cause is cut at render to 64 UTF-16 code units plus a single U+2026; plugin.json version parsing stays unbounded, as upstream"
  - "D-PL3-16: the two dependency move refusal sentences that quote a candidate version take the same 64-unit cut"

patterns-established:
  - "truncateForRefusal: Claude Code's re()/J9 cut -- limit code units, drop a dangling high surrogate, append one U+2026"

requirements-completed: [CAS-07]

coverage:
  - id: D1
    description: "A {dependents constrain} hold cause quotes at most 64 code units of the offered version, then a single U+2026"
    requirement: CAS-07
    verification:
      - kind: e2e
        ref: "features/plugin/update.feature#Updating a dependency past its dependent's version range to a very long version shows the version cut to 64 characters"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/constraint-fold.test.ts#D-PL3-12: the out-of-range hold cuts a long offered version to 64 code units"
        status: pass
    human_judgment: false
  - id: D2
    description: "truncateForRefusal keeps short text, cuts long text with U+2026, and never ends on a lone high surrogate"
    requirement: CAS-07
    verification:
      - kind: unit
        ref: "test/domain/dependency-range.test.ts#truncateForRefusal (four D-PL3-12 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dependency move refusals ('is the newest version it can move to', 'was ruled out by the plan') cut the candidate version to 64 code units"
    requirement: CAS-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-move.test.ts#D-PL3-16 (two cases)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 01: Version Cut in Hold and Move Refusals Summary

**A catalog version quoted in a `{dependents constrain}` hold cause or a dependency move refusal is now cut to 64 UTF-16 code units plus `…`, through one `truncateForRefusal` helper that mirrors Claude Code's cut.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-27T03:15:02Z
- **Completed:** 2026-10-27T03:32:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `truncateForRefusal(text, limit)` and `MAX_REFUSAL_VERSION_CHARS = 64` in `domain/dependency-range.ts`. They cut at `limit` code units, drop a dangling high surrogate, and append one U+2026. `renderConstraintRange`, `renderDeclaredRanges`, and the 200-character bound are unchanged (D-PL3-10).
- `describeConstraint` cuts the stage-two version before it interpolates it. Every `version X falls outside ...` hold cause is bounded, and so is a move refusal that goes through the same line.
- `dependency-move.ts` cuts `toVersion` in `refusalCause` (the `unchanged` sentence) and in the WR-1 `was ruled out by the plan` sentence.
- A new `update.feature` scenario failed on the uncut 76-unit version and passes with the cut.
- `domain/components/plugin.ts` is untouched. A version of any length still parses (E6).

## Task Commits

1. **Task 1: A held update shows the offered version cut to 64 code units** - `1667ca33` (fix)
2. **Task 2: A dependency move refusal shows a candidate version cut to 64 code units** - `90c18e5d` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-range.ts` - adds `truncateForRefusal` and `MAX_REFUSAL_VERSION_CHARS`
- `test/domain/dependency-range.test.ts` - `describe("truncateForRefusal")`: at the limit, past the limit, cut on a high surrogate, cut after a full pair
- `extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts` - `describeConstraint` cuts `line.version`; the doc comment states the cut
- `test/orchestrators/plugin/constraint-fold.test.ts` - a 76-unit version held by `^1.0.0`, compared as a whole verdict
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts` - cuts `toVersion` in both refusal sentences
- `test/orchestrators/plugin/dependency-move.test.ts` - two D-PL3-16 cases next to the cases they mirror
- `features/plugin/update.feature` - scenario "Updating a dependency past its dependent's version range to a very long version shows the version cut to 64 characters"

## Decisions Made

None beyond the plan. D-PL3-12 and D-PL3-16 were applied as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Task 2 test inputs could not reach the refusal sentences**
- **Found during:** Task 2
- **Issue:** The plan's inputs stopped at the range check before either sentence. `"release-" + 70 z` has no digit, so `coerce` returns nothing and the version fails `>=2.0.0`. The refusal was then `falls outside what the combined range admits`, not `was ruled out by the plan`. `"2.0.0-" + 70 z` is a prerelease, so it fails the default requester range `^2.0.0` before the `unchanged` partition.
- **Fix:** The ruled-out case uses `"release-7-" + 66 z` (76 units, no semver form, coerces to 7.0.0, as the `release-7` case does). It expects `"release-7-" + 54 z + "…"`. The newest-version case keeps `"2.0.0-" + 70 z` and gives the requester the range `>=2.0.0-0`, which admits that prerelease. Both cases failed on the uncut code for the right reason before the change.
- **Files modified:** test/orchestrators/plugin/dependency-move.test.ts
- **Verification:** Red run showed the uncut version in the expected sentence; green after the cut; direct coverage 100%.
- **Committed in:** 90c18e5d

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test inputs only. The production change is as planned.

## Issues Encountered

None.

## Unit-only behavior

The two `dependency-move.ts` sentences (D-PL3-16), `version X is the newest version it can move to` and `version X was ruled out by the plan`, have unit cases only. They show up only through update-preflight states that the existing cucumber steps do not set up: the `unchanged` partition of a judged move, and the WR-1 branch where the plan rules out a version that has no semver form. Task 1's `update.feature` scenario proves the bound a user sees, through the same `truncateForRefusal` helper.

## Touched outside Files

None.

## CHANGELOG line

- A hold or refusal line now cuts a very long plugin version to 64 characters.

## Decision rows

| **D-PL3-12 (plugin-lifecycle): a version in a hold cause is cut at render to 64 code units** -- `describeConstraint` quotes the stage-two version through `truncateForRefusal(..., 64)`: no dangling high surrogate, one `…` | Claude Code cuts a version to 64 UTF-16 code units when it renders one, and accepts any version string at parse (E4, E6). A parse-time bound would refuse plugins Claude Code installs | Shipped; unit cases plus the `update.feature` long-version scenario |
| **D-PL3-16 (plugin-lifecycle): a dependency move refusal cuts the candidate version the same way** -- `refusalCause` and the WR-1 ruled-out sentence quote `toVersion` through the 64-unit cut | Extends D-PL3-12: the same marketplace-controlled string reaches these lines | Shipped; unit cases only (see Unit-only behavior) |

## Backlog dispositions

- `VERSTR-01`: fixed. The version is bounded at render to 64 code units (D-PL3-12). The parse-time alternative was declined, because Claude Code accepts any version string (E6).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`truncateForRefusal` is ready for plan 03-04's 120-unit directory pin cut. That plan adds its own constant with its first consumer.

## Self-Check: PASSED

- All seven modified files exist; commits `1667ca33` and `90c18e5d` are on HEAD.
- Acceptance greps: `export function truncateForRefusal` 1; `MAX_REFUSAL_VERSION_CHARS` in constraint-fold.ts 2, in dependency-move.ts 3; `…` in update.feature 1.
- Plan verification: 89 unit tests pass across the three test files; direct coverage of the three sources reports nothing (exit 0); `features/plugin/update.feature` 22 scenarios pass.
- Both commits passed the `npm run check:commit` hook.

---
*Phase: 03-dependency-cascade-rows-and-status*
*Completed: 2026-10-27*
