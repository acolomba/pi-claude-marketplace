---
phase: 07-integration-pi-wiring
plan: 03
subsystem: integration
tags: [pi-api, resources-discover, extension-entrypoint, tdd]

requires:
  - phase: 07-integration-pi-wiring
    provides: [pi-api-wrapper, phase-6-edge-registration]
provides:
  - Disk-backed resources_discover aggregation across user and project scopes
  - Real Pi extension entrypoint for command, tools, and resources discovery
  - TDD coverage for discovery and index wiring behavior
affects: [phase-7-integration, pi-runtime-wiring, reload-discovery]

tech-stack:
  added: []
  patterns:
    - Pure disk-walk aggregator over ScopedLocations resources directories
    - Structural resources_discover event binding through platform/pi-api.ts types

key-files:
  created:
    - extensions/claude-marketplace/orchestrators/discover.ts
    - tests/orchestrators/discover.test.ts
  modified:
    - extensions/claude-marketplace/index.ts
    - extensions/claude-marketplace/shared/errors.ts
    - tests/shared/index-smoke.test.ts

key-decisions:
  - "resources_discover now treats staged resource directories on disk as the source of truth, not state.json."
  - "index.ts binds the resources_discover event structurally because the peer ExtensionAPI type does not expose that event overload."

patterns-established:
  - "Discovery aggregation attempts user and project scopes before throwing AggregateResourcesDiscoverError."
  - "The extension entrypoint is limited to resources_discover, /claude:plugin, and two read-only marketplace tools."

requirements-completed: [NFR-2, NFR-11]

duration: 6 min
completed: 2026-05-11
---

# Phase 07 Plan 03: Pi Entrypoint and resources_discover Summary

**Disk-backed resources_discover plus real Pi entrypoint wiring for `/claude:plugin` and read-only marketplace tools**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-11T20:08:02Z
- **Completed:** 2026-05-11T20:13:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `aggregateDiscoveredResources` to enumerate staged skills and prompts from both user and project `ScopedLocations` without reading `state.json`.
- Added `AggregateResourcesDiscoverError` with per-scope/per-kind failure details and a useful `Error.cause` root.
- Replaced the Phase 1 `index.ts` stub with real Pi wiring for `resources_discover`, `/claude:plugin`, `session_start` completion registration, and the two read-only marketplace LLM tools.
- Updated smoke and orchestrator tests using RED/GREEN commits for both TDD tasks.

## Task Commits

1. **Task 1 RED: resources_discover behavior tests** - `4bf8b2f` (test)
2. **Task 1 GREEN: disk-backed discovery aggregator** - `48a14e5` (feat)
3. **Task 2 RED: index wiring smoke test** - `4da05e2` (test)
4. **Task 2 GREEN: real Pi entrypoint wiring** - `0086ba0` (feat)

**Plan metadata:** pending at summary creation time

## Files Created/Modified

- `extensions/claude-marketplace/orchestrators/discover.ts` - Pure disk-backed resources discovery aggregator for Pi reloads.
- `extensions/claude-marketplace/shared/errors.ts` - Adds `AggregateResourcesDiscoverError` and structured failure metadata.
- `extensions/claude-marketplace/index.ts` - Real Pi extension entrypoint wiring command, tools, and discovery.
- `tests/orchestrators/discover.test.ts` - Discovery behavior tests for missing dirs, deterministic output, no dedup, filtering, and aggregate failures.
- `tests/shared/index-smoke.test.ts` - Entrypoint smoke coverage for real command/tool/event registration and invocation-time cwd discovery.

## Decisions Made

- Used staged resources on disk as the discovery source of truth per D-11; stale or missing state does not affect `/reload` discovery.
- Bound `resources_discover` structurally in `index.ts` because `@mariozechner/pi-coding-agent@0.73.1` does not expose a typed `pi.on("resources_discover", ...)` overload even though Phase 7 models the result shape in `platform/pi-api.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added structural resources_discover event binding**
- **Found during:** Task 2 (real Pi entrypoint wiring)
- **Issue:** TypeScript rejected `pi.on("resources_discover", ...)` because the peer `ExtensionAPI` overload set does not include that event name.
- **Fix:** Bound `pi.on` to `pi`, cast only the event registration function to the modeled `resources_discover` signature, and returned mutable arrays matching `ResourcesDiscoverResult`.
- **Files modified:** `extensions/claude-marketplace/index.ts`
- **Verification:** `npm run typecheck`, `npm run lint`, and plan test suite passed.
- **Committed in:** `0086ba0`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves the planned runtime behavior while satisfying the current peer package type surface.

## Issues Encountered

- Pre-commit hooks formatted files during initial commit attempts; changes were re-staged and committed with hooks enabled.
- The index smoke test was adjusted to tolerate existing real user-scope resources while still proving project cwd is resolved at handler invocation time.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Stub-pattern scan found only local accumulator initializers and an existing optional parameter default, not UI-facing stubs.

## Threat Flags

None. The new filesystem and Pi runtime surfaces are covered by the plan threat model.

## TDD Gate Compliance

- RED commits present: `4bf8b2f`, `4da05e2`
- GREEN commits present after RED: `48a14e5`, `0086ba0`
- REFACTOR commits: not needed

## Next Phase Readiness

Plan 07-04 can build on a loadable Pi extension entrypoint. `/reload` discovery now reflects staged skill and prompt files under both scopes, and command/tool registration flows through the Phase 6 helpers.

## Verification

- `node --test tests/shared/index-smoke.test.ts tests/orchestrators/discover.test.ts tests/edge/register.test.ts` passed (16 tests).
- `npm run typecheck` passed.
- `npm run lint` passed during commit hooks.

## Self-Check: PASSED

- Found `extensions/claude-marketplace/orchestrators/discover.ts`.
- Found `tests/orchestrators/discover.test.ts`.
- Found commits `4bf8b2f`, `48a14e5`, `4da05e2`, and `0086ba0`.
- Verified plan-level test suite and typecheck completed successfully.

---
*Phase: 07-integration-pi-wiring*
*Completed: 2026-05-11*
