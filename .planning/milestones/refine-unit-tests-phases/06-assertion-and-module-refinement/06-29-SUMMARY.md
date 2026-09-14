---
phase: 06-assertion-and-module-refinement
plan: "29"
subsystem: catalog test infrastructure
tags: [typescript, node-test, catalog-fixtures, exact-output, inverse-completeness]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Strict catalog parser, typed fixture contracts, strict Pi boundary, and retained catalog UAT hub from Plan 06-28
provides:
  - Five independently owned typed fixture maps for plugin list, install, uninstall, reinstall, and update
  - Exact preservation of 75 catalog states and 10,737 documented UTF-8 output bytes
  - Bidirectional completeness and severity proof for 41 info, 8 warning, and 26 error states
affects: [06-33-catalog-contract, catalog-uat, output-catalog]
actuals:
  tokens: 18419
  tasks: 2
  commits: 2
plan_head_before: 08b4a81c9956c23b3c054baef683f75ed8f4ca28
tech-stack:
  added: []
  patterns: [typed command fixture map, independent catalog oracle, disjoint section ownership, preserved command-specific emit seam]
key-files:
  created:
    - tests/architecture/catalog-uat/fixtures/plugin-list.ts
    - tests/architecture/catalog-uat/fixtures/plugin-install.ts
    - tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts
    - tests/architecture/catalog-uat/fixtures/plugin-reinstall.ts
    - tests/architecture/catalog-uat/fixtures/plugin-update.ts
  modified: []
key-decisions:
  - "Each fixture module owns exactly one complete command section and exports only one explicitly typed FixtureMap."
  - "Keep plugin-list and plugin-update command-specific emit seams local to their fixture modules so catalog bytes continue to exercise the real producer rendering path."
  - "Leave catalog-uat.test.ts unchanged in this Wave 21 slice; Plan 06-33 owns the atomic shared-driver repoint and legacy-hub deletion."
patterns-established:
  - "Command fixture slices preserve source payloads byte-for-byte while typed map boundaries make ownership explicit."
  - "Fixture completeness is checked in both directions against independently parsed catalog tuples, never by importing expected producer bytes."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: "Plugin list and install own complete typed fixture maps covering 40 exact catalog states."
    requirement: TREF-09
    verification:
      - kind: integration
        ref: "node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck"
        status: pass
      - kind: other
        ref: "five-map bidirectional catalog render check (40/40 list/install states included)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Plugin uninstall, reinstall, and update own complete typed fixture maps covering 35 exact catalog states."
    requirement: TREF-09
    verification:
      - kind: integration
        ref: "node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck"
        status: pass
      - kind: other
        ref: "five-map bidirectional catalog render check (35/35 uninstall/reinstall/update states included)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 75 states retain exact documented output bytes and notification severity argument shape."
    requirement: TREF-07
    verification:
      - kind: integration
        ref: "five-map render walk: 75/75 byte-exact and 75/75 severity-exact"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 29: Five Command Catalog Fixture Slices Summary

**Five typed command fixture modules preserve all 75 list/install/uninstall/reinstall/update catalog states, 10,737 documented output bytes, and exact severity routing without touching the shared driver.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-09T12:10:56Z
- **Completed:** 2026-09-09T12:23:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extracted the 24-state plugin-list and 16-state plugin-install slices into independent `FixtureMap` modules.
- Extracted the 6-state plugin-uninstall, 13-state plugin-reinstall, and 16-state plugin-update slices into independent `FixtureMap` modules.
- Preserved all command-specific payloads, `Error` cause chains, special list/update emit callbacks, and severity declarations exactly.
- Proved five disjoint outer sections, 75 fixture/catalog keys in both directions, 75/75 exact rendered bytes, and 75/75 exact severity argument shapes.

## Task Commits

1. **Task 1: Extract first catalog fixtures** — `6429e187` (refactor)
2. **Task 2: Extract remaining catalog fixtures** — `9c1d64ee` (refactor)

## Files Created/Modified

- `tests/architecture/catalog-uat/fixtures/plugin-list.ts` — Owns 24 `/claude:plugin list` states, including both list-context emit overrides.
- `tests/architecture/catalog-uat/fixtures/plugin-install.ts` — Owns 16 install states and their exact warning/error declarations.
- `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` — Owns 6 uninstall states.
- `tests/architecture/catalog-uat/fixtures/plugin-reinstall.ts` — Owns 13 reinstall states.
- `tests/architecture/catalog-uat/fixtures/plugin-update.ts` — Owns 16 update states, including both never-silent no-op emit overrides.

## Exactness, Disjointness, and Independence Proof

| Surface | States | Catalog UTF-8 bytes | Info | Warning | Error |
| --- | ---: | ---: | ---: | ---: | ---: |
| plugin list | 24 | 3,482 | 23 | 0 | 1 |
| plugin install | 16 | 2,295 | 4 | 4 | 8 |
| plugin uninstall | 6 | 620 | 2 | 0 | 4 |
| plugin reinstall | 13 | 2,010 | 5 | 1 | 7 |
| plugin update | 16 | 2,330 | 7 | 3 | 6 |
| **Total** | **75** | **10,737** | **41** | **8** | **26** |

- Textual slice comparisons prove each extracted fixture object is byte-identical to its source block in the retained hub.
- A fresh render walk used the five new maps against independently parsed `docs/output-catalog.md` tuples and produced 75/75 byte matches plus 75/75 severity-argument matches.
- Every module owns one unique outer section; the merged map has five sections, and the forward/inverse walk finds no missing or orphan state.
- Each file has exactly one export, an explicitly annotated `FixtureMap`; no file imports the catalog parser, output catalog, production owner tests, or another fixture slice.
- No production module or producer owner test imports these fixture modules. The shared-driver migration remains intentionally deferred to Plan 06-33.

## Verification

- Exact task and plan gate, run after each task and again after both commits: `node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck` — passed.
- Five-map forward/inverse render proof — 5 disjoint sections, 75 states, 75/75 byte-exact, 75/75 severity-exact, zero missing/orphan keys.
- Focused ESLint, Prettier, `git diff --check`, Google TypeScript style review, and unit-test fixture review for all five files — passed.
- `npm run lint` — passed.
- `npm run test:corresponding` and `npm run test:corresponding:negative` — passed.
- Aggregate `npm test` ran 261 files: 259 passed. The declared sealed `tests/architecture/revalidation.test.ts` debt failed, and marketplace/add failed only under sandbox Unix-socket denial; `tests/orchestrators/marketplace/add.test.ts` passed 63/63 unrestricted.
- `npm run fallow` reported exactly the five newly exported maps as temporarily unused. This is the expected Wave 21 intermediate state because Plan 06-33 owns the shared-driver repoint; no ignore pragma or cross-sibling edit was added.

## Decisions Made

- Used one outer command-section map per module so object-map merging is disjoint by construction.
- Retained command-specific list and update emit paths inside their owning fixture modules; central notification rendering remains the default for every other state.
- Preserved the current hub and all shared structural artifacts for the downstream atomic migration rather than creating a Wave 21 conflict.

## Deviations from Plan

None — the plan executed exactly as written.

## Issues Encountered

- Fallow sees the five fixture exports before the downstream driver imports them. This planned intermediate finding closes when Plan 06-33 performs the atomic caller migration; suppressing it here would violate the no-ignore constraint.
- Aggregate tests reproduced the declared sealed Phase 1 revalidation fixture debt. The file was not modified.
- The aggregate sandbox denied marketplace/add's Unix socket; the complete owner suite passed 63/63 unrestricted.

## Known Stubs

None. The five modules contain no placeholder, TODO, FIXME, skipped test, mock expected-byte source, or unwired empty behavior.

## Threat Flags

None. All new files are test-only. Their independent catalog oracle and bidirectional key walk preserve exact already-redacted public output without adding a network, filesystem, authentication, or schema boundary.

## User Setup Required

None.

## Next Phase Readiness

- The five command slices are ready for Plan 06-33 to merge into the final catalog contract driver.
- Plans 06-30 through 06-32 can add their disjoint fixture sections without modifying these files.
- The shared catalog driver and legacy hub remain unchanged by design until the serialized closure plan.

## Self-Check: PASSED

All five created files exist. Commits `6429e187` and `9c1d64ee` exist in order. The exact catalog/typecheck gate, focused style checks, five-map bidirectional proof, and aggregate attribution were re-run from the committed task state.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
