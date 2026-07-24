---
phase: 04-concern-module-extraction-open-closed-proof
plan: 01
subsystem: shared
tags: [typescript, notify, concerns, soft-dep, refactor]

requires:
  - phase: 01-command-local-messaging
    provides: command-local render maps that call composeReasons
provides:
  - shared/concerns/soft-dep.ts owning DEPENDENCIES, Dependency, markers, softDepMarkers
  - composeReasons delegating its soft-dep branch via a direct function call
affects: [04-02, 04-03, open-closed-proof]

tech-stack:
  added: []
  patterns:
    - "Concern-module: standalone shared/concerns/*.ts owning data + pure logic, called directly (no Concern interface, no registry)"
    - "import type discipline as the cycle safeguard (no import-x/no-cycle rule configured)"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts

key-decisions:
  - "composeReasons stays central with its exact 4-arg signature; only its internals change (delegation) so the 13+ orchestrator callers are untouched"
  - "DEPENDENCIES + Dependency moved to the concern (per CONTEXT concern assignment); 7 Dependency importers repointed"
  - "marketplace/update.ts needed no edit -- it gates soft-dep via p.dependencies.includes(...) booleans, not a Dependency type import"

patterns-established:
  - "Direct-function-call concern wiring (D-01): renderer -> concern, concern depends only on Reason/SoftDepStatus types"

requirements-completed: [MOD-04]

duration: 1
completed: 2026-06-24
---

# Phase 4 / Plan 01: Soft-dep concern extraction

**Soft-dep marker injection lifted out of the notify.ts monolith into a pure `shared/concerns/soft-dep.ts` module; `composeReasons` stays central and delegates its soft-dep branch via a direct call -- output byte-identical.**

## Performance

- **Tasks:** 1
- **Files modified:** 9 (1 created, 8 modified)
- **Completed:** 2026-06-24

## Accomplishments

- Created `shared/concerns/soft-dep.ts` owning `DEPENDENCIES`, the `Dependency` type, the two soft-dep marker constants (file-private), and the pure `softDepMarkers(declaresAgents, declaresMcp, probe)` helper (agents-before-mcp order preserved).
- Slimmed `composeReasons` in notify.ts: its soft-dep branch is now `composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe))`; the 4-arg signature and `export` are unchanged, so the 13+ orchestrator render-map callers are invisible to the change.
- Deleted `DEPENDENCIES`, `Dependency`, `SOFT_DEP_MARKER_AGENTS`, `SOFT_DEP_MARKER_MCP` from notify.ts; re-imported `Dependency` (type) and `softDepMarkers` (value) from the concern.
- Repointed all 7 `Dependency` importers (reconcile/apply-outcomes, reconcile/apply, plugin/install, plugin/reinstall, plugin/list, plugin/update, import/execute) to the concern.

## Task Commits

1. **Task 1: Extract soft-dep concern and delegate composeReasons** - `8ab786d7` (refactor)

## Files Created/Modified

- `shared/concerns/soft-dep.ts` - New concern: DEPENDENCIES, Dependency, markers, pure softDepMarkers helper
- `shared/notify.ts` - Removed moved declarations; composeReasons delegates; imports softDepMarkers + Dependency from concern
- 7 orchestrators - `Dependency` import repointed from notify.ts to concerns/soft-dep.ts

## Decisions Made

- `marketplace/update.ts` (listed in plan files_modified) needed no edit: it derives soft-dep flags via `p.dependencies.includes("agents"/"mcp")` booleans, not a `Dependency` type import.
- Concern imports `Reason` and `SoftDepStatus` type-only (the cycle safeguard, since no `import-x/no-cycle` rule exists).

## Deviations from Plan

None - plan executed exactly as written. (The `marketplace/update.ts` no-op is a clarification, not a deviation: the file declared in `files_modified` simply had no `Dependency` type import to repoint.)

## Issues Encountered

None.

## Next Phase Readiness

- Soft-dep half of MOD-04 closed. Ready for 04-02 (hooks concern extraction).
- Verification at commit `8ab786d7`: catalog-uat 4/4 green, `git diff --exit-code docs/output-catalog.md` empty, `npm run typecheck` + `npm run lint` exit 0.

---
*Phase: 04-concern-module-extraction-open-closed-proof*
*Completed: 2026-06-24*
