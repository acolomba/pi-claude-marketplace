---
phase: 59-bridge-dispatch-core-debug-seam
plan: 01
subsystem: observability
tags: [hooks, debug-log, obs-01, shared-seam, eslint-override, il-2, il-3]

# Dependency graph
requires:
  - phase: 58-hooks-supportability-dispatch-stub
    provides: "Phase 57 hookDebugLog stub at domain/components/hooks.ts and its three call sites in parseHooksConfig"
provides:
  - "extensions/pi-claude-marketplace/shared/debug-log.ts: canonical OBS-01 debug-output seam exporting hookDebugLog(detail: string): void; env-gated on PI_CLAUDE_MARKETPLACE_DEBUG === \"1\" (exact-equal)"
  - "Per-file ESLint override block in eslint.config.js authorizing console.* in shared/debug-log.ts only, mirroring BLOCK B (shared/notify.ts)"
  - "tests/shared/debug-log.test.ts: three unit tests pinning the env-gated emission contract incl. seven near-miss fuzzy-truthy fixtures"
  - "domain/components/hooks.ts: stub deleted, TODO(OBS-01) closed, three callers rewired via named import from shared/debug-log.ts"
affects: [phase-59-plan-02-event-router, phase-59-plan-03-dispatch-architecture-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OBS-01 seam pattern: env-gated console.error wrapper as a pure leaf module with a per-file ESLint override scoped to the single literal file path (mirrors shared/notify.ts BLOCK B)"
    - "Exact-equal env-var gate (=== \"1\") locked by fuzzy-truthy near-miss fixtures in tests (T-59-01-01 mitigation)"

key-files:
  created:
    - "extensions/pi-claude-marketplace/shared/debug-log.ts"
    - "tests/shared/debug-log.test.ts"
  modified:
    - "extensions/pi-claude-marketplace/domain/components/hooks.ts"
    - "eslint.config.js"

key-decisions:
  - "D-59-05 locked: the OBS-01 seam lives at shared/debug-log.ts as a pure leaf module; the function signature hookDebugLog(detail: string): void and the exact-equal PI_CLAUDE_MARKETPLACE_DEBUG === \"1\" gate are preserved byte-for-byte from the Phase 57 stub, so the migration is a file move + import rewrite, not a behavior change."
  - "No inline eslint-disable-next-line directives in shared/debug-log.ts: the per-file ESLint override block carries the IL-2 / IL-3 authorization. Any drift of the override block surfaces as a red lint at the seam's call site rather than a silently-absorbed inline disable (defense-in-depth excluded by D-59-05 hygiene)."

patterns-established:
  - "Per-file ESLint override block placement: new console-allowing overrides sit immediately adjacent to BLOCK B (shared/notify.ts) for visual grouping of \"per-file console allowances\""
  - "Test fixture for env-gated gates: lock the exact-equal value against fuzzy-truthy widening with a fixture array of near-miss values ([\"0\", \"true\", \"\", \"yes\", \"ON\", \"01\", \" 1 \"])"

requirements-completed: [OBS-01]

# Metrics
duration: ~25min
completed: 2026-06-14
---

# Phase 59 Plan 01: Bridge-Dispatch-Core Debug Seam Summary

**OBS-01 debug-output seam re-homed at `shared/debug-log.ts` with a per-file ESLint override; Phase 57 stub and TODO retired; three call sites rewired byte-for-byte.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-14T20:39:49Z
- **Completed:** 2026-06-14T21:05:00Z
- **Tasks:** 2 (TDD: RED + GREEN folded into Task 1 commit; Task 2 is a pure refactor)
- **Files modified:** 4 (2 new, 2 edited)

## Accomplishments

- Created `extensions/pi-claude-marketplace/shared/debug-log.ts` as the canonical OBS-01 seam: a pure leaf module exporting `hookDebugLog(detail: string): void` that forwards `[hooks] ${detail}` to `console.error` only on exact-equal `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`.
- Added a per-file ESLint override block in `eslint.config.js` immediately after BLOCK B (`shared/notify.ts`), scoped to the single literal file path `extensions/pi-claude-marketplace/shared/debug-log.ts`. No other file gains `console.*` access through this plan.
- Retired the Phase 57 stub in `domain/components/hooks.ts`: deleted the JSDoc + function definition, removed the two inline `eslint-disable-next-line` directives, added a named import from `../../shared/debug-log.ts`, and updated the file-header doc-block prose to re-anchor the seam reference. The three call sites in `parseHooksConfig` (JSON-parse failure, schema-validation failure, supportability failure arms) are byte-unchanged.
- Pinned the env-gated emission contract with three unit tests: env-on emits exactly `[hooks] sample detail` once; env-unset is silent; seven near-miss fuzzy-truthy fixtures (`"0"`, `"true"`, `""`, `"yes"`, `"ON"`, `"01"`, `" 1 "`) are all silent. The near-miss fixtures lock T-59-01-01 against a future widening of the gate.

## Task Commits

Each task was committed atomically. Task 1 folds the TDD RED+GREEN cycle into a single `feat` commit (the failing test was authored in the same working tree as the implementation; the module did not exist before the commit, so the RED state was the pre-commit transient `import { hookDebugLog } from "../../extensions/pi-claude-marketplace/shared/debug-log.ts"` resolution failure that the same commit closes).

1. **Task 1: Create shared/debug-log.ts + ESLint per-file override + unit tests** — `d92cd76` (feat)
2. **Task 2: Retire the Phase 57 hookDebugLog stub and rewire callers** — `fb25012` (refactor)

**Plan metadata:** TBD (final docs commit)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/debug-log.ts` (NEW, 24 lines) — pure leaf module exporting the OBS-01 seam.
- `tests/shared/debug-log.test.ts` (NEW, ~95 lines) — three tests pinning env-gated emission incl. the seven near-miss fuzzy-truthy fixtures.
- `eslint.config.js` (MODIFIED, +13 lines) — new per-file override block adjacent to BLOCK B.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` (MODIFIED, −27 / +5 lines) — stub deleted, TODO(OBS-01) closed, import added, file-header doc-block prose updated.

## Decisions Made

- **The per-file ESLint override sits in `eslint.config.js`, not as an inline `eslint-disable-next-line` in `shared/debug-log.ts` itself.** Defense-in-depth inline disables were explicitly excluded so any drift of the per-file block surfaces as a red lint at the seam's call site, rather than a silently-absorbed inline disable.
- **Import ordering in `hooks.ts`** uses alphabetical asc within the parent group: `debug-log` < `errors`, so the new import line precedes the existing `errorMessage` import. Verified GREEN by `import-x/order`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the artifacts and behaviors specified in the plan's `must_haves.truths` block.

## Issues Encountered

- **Prettier reformatted the multi-line `assert.equal` call** in `tests/shared/debug-log.test.ts` on the first pre-commit run (single-line → 4-line form). Restaged and re-ran pre-commit; second run was clean. Not a plan deviation — standard formatter-driven reflow.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The OBS-01 seam is at its canonical home; Plan 02 (event router) imports `hookDebugLog` from `shared/debug-log.ts` without any mid-plan cross-file coupling.
- Plan 03 (architecture tests) can pin the seam's no-other-console contract via static introspection against the file glob `extensions/pi-claude-marketplace/**/*.ts` minus the two allowed files (`shared/notify.ts`, `shared/debug-log.ts`, plus the IL-3 `persistence/migrate.ts` exception).
- No blockers; `npm run check` is GREEN at plan close.

## Verification

- `node --test tests/shared/debug-log.test.ts` — 3/3 pass.
- `node --test tests/architecture/hooks-foundation.test.ts tests/architecture/hooks-supportability.test.ts tests/domain/components/hooks.test.ts` — 50/50 pass; Phase 57/58 architecture and domain contracts preserved.
- `npm run check` — GREEN (typecheck + lint + format + full test suite).
- `grep -c "^export function hookDebugLog\|^export const hookDebugLog" extensions/pi-claude-marketplace/domain/components/hooks.ts` — 0 (stub gone).
- `grep -c "hookDebugLog(" extensions/pi-claude-marketplace/domain/components/hooks.ts` — 3 (three call sites preserved).
- `grep -c "TODO(OBS-01)\|TODO.OBS-01" extensions/pi-claude-marketplace/domain/components/hooks.ts` — 0 (TODO closed).

## Self-Check: PASSED

- Created files exist:
  - `extensions/pi-claude-marketplace/shared/debug-log.ts` — FOUND
  - `tests/shared/debug-log.test.ts` — FOUND
- Modified files exist:
  - `extensions/pi-claude-marketplace/domain/components/hooks.ts` — FOUND
  - `eslint.config.js` — FOUND
- Commits exist:
  - `d92cd76` (Task 1) — FOUND
  - `fb25012` (Task 2) — FOUND

---

*Phase: 59-bridge-dispatch-core-debug-seam*
*Completed: 2026-06-14*
