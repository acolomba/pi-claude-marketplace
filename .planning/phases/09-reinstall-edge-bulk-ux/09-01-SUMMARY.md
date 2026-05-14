---
phase: 09-reinstall-edge-bulk-ux
plan: 01
subsystem: orchestrators
tags: [reinstall, batch, reload-hint, soft-dependencies]

requires:
  - phase: 08-atomic-reinstall-core
    provides: atomic single-plugin reinstall core and rollback-safe bridge replacement
provides:
  - quiet single-plugin reinstall rendering for batch callers
  - bulk reinstall target enumeration across user and project scopes
  - deterministic reinstall batch partitions with reload and soft-dependency aggregation
affects: [edge-reinstall-handler, reinstall-completions, reinstall-docs]

tech-stack:
  added: []
  patterns:
    - quiet render seam for orchestrator batch composition
    - update-analogous scope resolution without Git/network imports
    - deterministic scope/marketplace/plugin partition rendering

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/index.ts
    - extensions/pi-claude-marketplace/orchestrators/index.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - 'Bulk reinstall reuses reinstallPlugin with render: "none" so the single-plugin rollback core remains the only replacement implementation.'
  - "Batch output treats per-plugin failed outcomes as a Failed partition rather than separate error notifications."
  - "Reload and soft-dependency hints are aggregated only from successful reinstalled outcomes."

patterns-established:
  - "Quiet orchestrator seam: single-plugin APIs can suppress notifications and return warning notes for higher-level batch renderers."
  - "Batch reinstall ordering: user scope before project scope, then marketplace, then plugin."

requirements-completed: [PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15]

duration: 45min
completed: 2026-05-14
---

# Phase 09 Plan 01 Summary

**Network-free bulk reinstall orchestrator with quiet single-plugin rendering and deterministic batch UX**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-14T02:45:00Z
- **Completed:** 2026-05-14T03:30:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `render: "default" | "none"` to `reinstallPlugin`; quiet mode suppresses per-plugin notifications and returns warning notes for successful cleanup/bridge warnings.
- Added `reinstallPlugins` with all, marketplace, and plugin target forms; bare reinstall enumerates user then project scope and marketplace/plugin targets reuse update-style implicit scope resolution.
- Added deterministic batch rendering with `Reinstalled`, `Skipped`, and `Failed` partitions, reload hints only for changed successes, and soft-dependency warnings only for successful restaged resources.
- Exported the bulk reinstall API through plugin and top-level orchestrator barrels.
- Extended orchestrator tests for PRL-03/04/05/13/14/15 and kept the no-network architecture guard green.

## Task Commits

Plan executed inline as one implementation slice; commit hash recorded by git history for `feat(09-01): add bulk reinstall orchestrator`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - quiet render seam, bulk target enumeration, sequential batch execution, and deterministic batch rendering.
- `extensions/pi-claude-marketplace/orchestrators/plugin/index.ts` - exports `reinstallPlugins` and its option/target types.
- `extensions/pi-claude-marketplace/orchestrators/index.ts` - re-exports the bulk reinstall API at the top-level orchestrator surface.
- `tests/orchestrators/plugin/reinstall.test.ts` - adds quiet render, bulk target, partition, reload hint, and soft-dependency aggregation coverage.

## Decisions Made

- Bulk reinstall does not import or reference Git helpers; it loads cached state/manifest data only.
- Batch mode continues after failed per-plugin outcomes and reports failures in a deterministic partition instead of emitting per-plugin error notifications.
- Quiet single-plugin mode returns warnings as `warning: ...` notes while preserving `partition: "reinstalled"`.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- Test fixture helper initially overwrote same-marketplace state/manifest entries when seeding multiple plugins. Fixed the helper to merge manifest entries and preserve existing installed plugin records so batch tests exercise true multi-plugin marketplaces.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-02 can route `/claude:plugin reinstall` to `reinstallPlugins` and pass through `--scope`/`--force`.
- Plan 09-03 can add installed-only reinstall completions independently of the orchestrator API.

## Self-Check: PASSED

- Key modified files exist on disk.
- `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` passed.
- `npm run typecheck` passed.

---

_Phase: 09-reinstall-edge-bulk-ux_
_Completed: 2026-05-14_
