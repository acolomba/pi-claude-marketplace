---
phase: 07-integration-pi-wiring
plan: 01
subsystem: integration
tags: [pi-api, peer-dependency, eslint, soft-dependencies]

requires:
  - phase: 06-edge-layer-tab-completion
    provides: [edge registration helpers, LLM tools, command handlers]
provides:
  - Single Pi API wrapper at extensions/pi-claude-marketplace/platform/pi-api.ts
  - Soft-dependency helpers owned by the platform wrapper with presentation shim compatibility
  - ESLint guard forbidding direct @mariozechner/pi-coding-agent imports outside the wrapper
  - Peer dependency floor @mariozechner/pi-coding-agent >=0.73.1
affects: [phase-7-integration, pi-runtime-wiring, package-publishing]

tech-stack:
  added: []
  patterns:
    - Thin typed platform re-export wrapper for Pi API surface
    - Import-boundary enforcement with no-restricted-imports plus no-restricted-paths update

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - tests/platform/pi-api.test.ts
  modified:
    - extensions/pi-claude-marketplace/presentation/soft-dep.ts
    - eslint.config.js
    - .prettierignore
    - package.json
    - tests/architecture/import-boundaries.test.ts
    - extensions/pi-claude-marketplace/**/handlers and orchestrator type imports
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/shared/notify.ts

key-decisions:
  - "Pi API imports now flow through platform/pi-api.ts; the wrapper exports only the currently needed surface."
  - "@mariozechner/pi-coding-agent peer floor is pinned to >=0.73.1 after surface verification."
  - "AutocompleteItem is re-exported from @mariozechner/pi-tui and resources_discover types are modeled structurally because they are not top-level exports from @mariozechner/pi-coding-agent@0.73.1."

patterns-established:
  - "Platform Pi API boundary: extension modules import Pi API types from platform/pi-api.ts instead of the peer package."
  - "Soft-dependency probing lives in platform/pi-api.ts while presentation/soft-dep.ts remains a compatibility re-export."
  - "Generated harness directories are excluded from project lint/format checks."

requirements-completed: [NFR-11]

duration: 9 min
completed: 2026-05-11
---

# Phase 07 Plan 01: Pi API Boundary and Peer Floor Summary

**Pi extension API boundary with soft-dep probing moved to platform/pi-api.ts and @mariozechner/pi-coding-agent pinned at >=0.73.1**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-11T19:30:59Z
- **Completed:** 2026-05-11T19:39:31Z
- **Tasks:** 3
- **Files modified:** 29

## Accomplishments

- Created the sole production Pi API import surface at `extensions/pi-claude-marketplace/platform/pi-api.ts`.
- Moved soft-dependency probes and warning composers into the wrapper while preserving `presentation/soft-dep.ts` imports through a shim.
- Migrated production Pi peer imports across the extension tree and added an ESLint guard to prevent drift.
- Raised `@mariozechner/pi-coding-agent` peer dependency floor to `>=0.73.1` and validated package dry-run output.

## Task Commits

1. **Task 1 RED: Pi API wrapper behavior test** - `d366c58` (test)
2. **Task 1 GREEN: Pi API wrapper and soft-dep shim** - `79d3499` (feat)
3. **Task 2: Import migration and ESLint boundary** - `36abb7c` (refactor)
4. **Task 3: Peer dependency floor** - `facc804` (chore)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/pi-api.ts` - Thin Pi API type wrapper plus soft-dependency helpers.
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts` - Compatibility shim re-exporting platform helpers.
- `tests/platform/pi-api.test.ts` - Wrapper behavior tests for soft-dependency probing and warning text.
- `eslint.config.js` - Allows platform type imports where needed and forbids direct peer imports outside the wrapper.
- `.prettierignore` - Excludes generated harness files from global format checks.
- `tests/architecture/import-boundaries.test.ts` - Updates the import-boundary matrix for the new platform wrapper dependency direction.
- `package.json` - Pins `@mariozechner/pi-coding-agent` peer dependency floor to `>=0.73.1`.
- `extensions/pi-claude-marketplace/**` - Migrated direct Pi peer type imports to relative `platform/pi-api.ts` imports.

## Decisions Made

- Used a thin typed re-export wrapper rather than an adapter class, matching D-02 through D-05.
- Re-exported `AutocompleteItem` from `@mariozechner/pi-tui` and modeled `ResourcesDiscoverEvent` / `ResourcesDiscoverResult` structurally because the 0.73.1 top-level package does not export those names directly.
- Allowed all extension layers to import type-only Pi API surface from `platform/pi-api.ts`; the stricter constraint is now "no direct peer imports outside the wrapper."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded generated harness files from lint/format gates**
- **Found during:** Task 1 (Pi API wrapper implementation)
- **Issue:** Pre-commit hooks ran `npm run lint` / `npm run format:check` across generated `.opencode` files, causing commits with TypeScript changes to fail on unrelated generated harness content.
- **Fix:** Added `.opencode/` to ESLint ignores and `.prettierignore`.
- **Files modified:** `eslint.config.js`, `.prettierignore`
- **Verification:** `npm run lint`, `npm run format:check`, and commit hooks passed.
- **Committed in:** `79d3499`

**2. [Rule 1 - Bug] Corrected unavailable 0.73.1 top-level type exports**
- **Found during:** Task 1 (Pi API wrapper implementation)
- **Issue:** `AutocompleteItem`, `ResourcesDiscoverEvent`, `ResourcesDiscoverResult`, and `Tool` are not all available as top-level exports from `@mariozechner/pi-coding-agent@0.73.1`.
- **Fix:** Removed unused `Tool`, re-exported `AutocompleteItem` from `@mariozechner/pi-tui`, and defined structural resources-discover event/result types matching the package declarations.
- **Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`
- **Verification:** `npm run typecheck`, wrapper tests, and soft-dep tests passed.
- **Committed in:** `79d3499`

**3. [Rule 2 - Missing Critical] Updated architecture import-boundary expectations for wrapper imports**
- **Found during:** Task 2 (Import migration and ESLint boundary)
- **Issue:** The existing architecture test still expected `platform/` to be forbidden from most layers, contradicting the new D-04 wrapper boundary.
- **Fix:** Updated the expected restricted-path matrix so layers can import the platform type wrapper while retaining direct-peer import enforcement.
- **Files modified:** `tests/architecture/import-boundaries.test.ts`, `eslint.config.js`
- **Verification:** `node --test tests/architecture/import-boundaries.test.ts` and `npm run lint` passed.
- **Committed in:** `36abb7c`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All deviations were required for the Pi API wrapper boundary to compile, commit with hooks, and remain enforceable by tests.

## Issues Encountered

- `npm test -- tests/presentation/soft-dep.test.ts` runs the full test suite because the script ignores positional test file arguments. Targeted verification used `node --test` for focused test files where needed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Stub-pattern scan found only existing architecture-test comments referring to historical placeholder fixtures, not runtime stubs.

## Threat Flags

None.

## Next Phase Readiness

Plan 07-02 can build on a stable Pi API import boundary and peer floor. Future Pi wiring should import every Pi API type from `platform/pi-api.ts` and will be blocked by ESLint if it imports `@mariozechner/pi-coding-agent` directly.

## Self-Check: PASSED

- Found `extensions/pi-claude-marketplace/platform/pi-api.ts`.
- Found `tests/platform/pi-api.test.ts`.
- Found commits `d366c58`, `79d3499`, `36abb7c`, and `facc804`.
- Verified `npm run lint`, `npm run typecheck`, and `npm pack --dry-run` completed successfully.

---
*Phase: 07-integration-pi-wiring*
*Completed: 2026-05-11*
