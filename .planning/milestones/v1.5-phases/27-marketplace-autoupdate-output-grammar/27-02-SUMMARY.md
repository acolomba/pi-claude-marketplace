---
phase: 27-marketplace-autoupdate-output-grammar
plan: 02
subsystem: ui
tags: [notify, output-grammar, marketplace-list, catalog-uat, byte-equality, UXG-01]

# Dependency graph
requires:
  - phase: 27-marketplace-autoupdate-output-grammar (Plan 27-01)
    provides: "catalog-uat FIXTURES key sync + autoupdate heading grammar (UXG-06) on the same branch"
  - phase: 16-renderer
    provides: "renderMpHeader SUB-BRANCH A/B list-surface arms + MarketplaceDetails type"
provides:
  - "marketplace list surface no longer renders the <last-updated <iso>> token on any header"
  - "MarketplaceDetails.lastUpdatedAt? retained in type + state persistence; renderer emission only is removed"
  - "catalog + catalog-uat fixture + notify-v2 byte test + orchestrator list test updated in one atomic commit (lockstep)"
affects: [27-03, 27-04, autoupdate-output-grammar, marketplace-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-emission removal without type/state removal: drop a token from the renderer while keeping the backing optional field in the type + state schema"
    - "Lockstep grammar edit: renderer + catalog + byte-equality gate + per-variant byte test + dedicated orchestrator test land in ONE commit so catalog-uat never sees an intermediate RED"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/marketplace/list.test.ts

key-decisions:
  - "Dropped lastUpdatedToken from the renderMpHeader SUB-BRANCH B token array entirely (removed the array element, not emptied it) to avoid a double-space risk and match the catalog byte form"
  - "Retained MarketplaceDetails.lastUpdatedAt? (notify.ts:285) + state persistence (state-io.ts:70) so notify-types.test.ts:221-232 (_MarketplaceDetailsExpected) stays untouched and GREEN"
  - "Orchestrator list test keeps lastUpdatedAt on the persisted record to prove the field round-trips through state while the byte form no longer carries the token"

patterns-established:
  - "UXG-01 closure pattern: a render-time-only token removal that does not touch the type, the state schema, or the field-shape compile proof"

requirements-completed: [UXG-01]

# Metrics
duration: 9min
completed: 2026-05-30
---

# Phase 27 Plan 02: Drop `<last-updated>` from marketplace list surface Summary

**`marketplace list` headers stop rendering the `<last-updated <iso>>` token (UXG-01); `MarketplaceDetails.lastUpdatedAt?` stays in the type + state, only the renderer emission is removed -- landed across renderer + catalog + 3 byte surfaces in one atomic commit.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-30T23:05:15Z
- **Completed:** 2026-05-30T23:12:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `renderMpHeader` SUB-BRANCH B no longer composes or joins `lastUpdatedToken`; the token array is now `[ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken]`. The `<autoupdate>` marker is byte-unchanged (alpha/project + zeta/project still render `<autoupdate>`).
- `MarketplaceDetails.lastUpdatedAt?` (notify.ts:285) and state persistence are intact; `notify-types.test.ts` was untouched and stays GREEN (field-retention compile proof unaffected).
- The lockstep contract held: renderer, `docs/output-catalog.md` (header-shape table row + marker prose + `mixed-scopes` fenced block + explainer), the catalog-uat `mixed-scopes` fixture, the notify-v2 SUB-BRANCH B byte test, and the dedicated orchestrator `ML-V2` test all moved in one commit, so the catalog-uat byte-equality gate never saw an intermediate RED.
- Full-suite GREEN gate: `npm run check` exits 0 (1143/1143 tests; typecheck + ESLint + Prettier all clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Drop the `<last-updated>` token from the renderer + catalog + all three byte tests (one atomic commit)** - `a0909d4` (feat)
2. **Task 2: Full-suite GREEN gate for UXG-01** - (no source change; verification only, `npm run check` GREEN -- no commit produced)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md) committed in the final metadata commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Removed `lastUpdatedToken` local + its slot in the SUB-BRANCH B `.filter().join(" ")` array; updated the `renderMpHeader` block-comment and the inner SUB-BRANCH B comment to drop the `<last-updated>` mention while keeping the `<autoupdate>` bullet. `MarketplaceDetails.lastUpdatedAt?` field untouched.
- `docs/output-catalog.md` - Deleted the `details.lastUpdatedAt` header-shape table row; rewrote the marker prose to state the field is retained but not rendered (UXG-01); updated the `## /claude:plugin marketplace list` prose, the `mixed-scopes` fenced block (alpha/project now `● alpha [project] <autoupdate>`), and the explainer. (mdformat normalized the header-shape table column widths after the row removal -- expected.)
- `tests/architecture/catalog-uat.test.ts` - Removed `lastUpdatedAt: "2026-05-25T00:00:00Z"` from the `mixed-scopes` alpha/project `details` (now `{ autoupdate: true }`); `examples.length` count unaffected.
- `tests/shared/notify-v2.test.ts` - Updated the SUB-BRANCH B byte test expectation to `● demo [user] <autoupdate>` (fixture keeps `lastUpdatedAt` to prove the retained field is no longer rendered); refreshed the file-header mini-spec and the SUB-BRANCH A comment wording.
- `tests/orchestrators/marketplace/list.test.ts` - Renamed/recommented the `ML-V2` test from "emits the marker" to "field persists, token not rendered" (UXG-01); fixture keeps `lastUpdatedAt` on the persisted record; expected byte form now `● test-mp [project] <autoupdate>`.

## Decisions Made

- Removed the `lastUpdatedToken` array element entirely rather than emptying it (Pitfall 2: an empty trailing slot risks a double-space; the `.filter` collapses it but removing the element is cleaner and matches the catalog).
- Kept `MarketplaceDetails.lastUpdatedAt?` and state persistence so `notify-types.test.ts:221-232` (`_MarketplaceDetailsExpected`) is untouched -- only the renderer stops emitting the token.
- The orchestrator + notify-v2 fixtures continue to set `lastUpdatedAt` to demonstrate the field still round-trips while the byte form no longer carries it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The `mdformat` pre-commit hook reformatted `docs/output-catalog.md` (the header-shape Markdown table's column widths shrank after removing the longest cell, the `<last-updated <iso>>` row). Resolved by restaging and re-running `pre-commit --files ...` until clean; re-ran the catalog-uat byte-equality gate afterward to confirm the fenced code blocks (which the gate reads) were unaffected -- GREEN.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UXG-01 closed: the `marketplace list` surface no longer renders `<last-updated <iso>>` on any header; `MarketplaceDetails.lastUpdatedAt` remains in state/type. The `<autoupdate>` list-surface marker behavior is unchanged, ready for the remaining Phase 27 autoupdate-grammar plans (UXG-04/05).
- No blockers.

## Self-Check: PASSED

- `27-02-SUMMARY.md` present.
- Task 1 commit `a0909d4` present in git log.
- All 5 modified files present on disk.

---
*Phase: 27-marketplace-autoupdate-output-grammar*
*Completed: 2026-05-30*
