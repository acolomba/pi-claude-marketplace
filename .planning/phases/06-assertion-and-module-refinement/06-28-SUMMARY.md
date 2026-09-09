---
phase: 06-assertion-and-module-refinement
plan: "28"
subsystem: catalog test infrastructure
tags: [typescript, node-test, catalog-parser, strict-mocks, tdd]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Stable six-owner notification boundary and retained catalog UAT hub through Plan 06-33
provides:
  - A direct-tested catalog parser that preserves all 190 recognized section/state output tuples byte-for-byte
  - Deterministic rejection of missing, duplicate, adjacent, empty, malformed, and unclosed catalog boundaries
  - Test-only fixture contracts and strict notification/Pi probe helpers
  - Direct legacy-driver imports with bidirectional fixture/catalog completeness intact
affects: [06-29-catalog-fixtures, 06-30-catalog-fixtures, 06-31-catalog-fixtures, 06-32-catalog-fixtures, 06-33-catalog-contract]
actuals:
  tokens: 8258
  tasks: 2
  commits: 3
plan_head_before: f017e8eaacfba321fe8cf00df5e36db05041b538
tech-stack:
  added: []
  patterns: [strict fail-closed parser, independent catalog oracle, exact interaction boundary, atomic caller migration]
key-files:
  created:
    - tests/architecture/catalog-uat/catalog-parser.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/catalog-uat/fixture-types.ts
    - tests/architecture/catalog-uat/mock-pi.ts
  modified:
    - tests/architecture/catalog-uat.test.ts
key-decisions:
  - "Recognize exactly the existing 20 catalog surfaces while deliberately ignoring annotated out-of-band sections that the catalog driver does not own."
  - "Reject malformed tuple boundaries with stable line-numbered Error messages instead of silently skipping or overwriting state."
  - "Keep the catalog as a test-only independent oracle; only the retained catalog driver imports its parser, fixture contracts, and strict Pi utilities."
patterns-established:
  - "Catalog parser tests cover exact byte preservation against both synthetic edge cases and the complete 190-tuple document."
  - "Catalog notification mocks state one exact emission and two exact tool probes, then verify every case locally."
requirements-completed: [TREF-07, TREF-09]
duration: 16min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 28: Catalog Test Infrastructure Summary

**The catalog UAT now consumes a fail-closed, direct-tested parser plus test-only fixture and strict Pi boundaries while preserving all 190 documented tuples and both completeness directions.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-09T11:50:34Z
- **Completed:** 2026-09-09T12:06:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extracted `loadCatalogExamples` and `CatalogExample` into a named test utility, with exact preservation of blank lines, trailing spaces, section names, state names, and output bytes.
- Added 12 direct parser cases covering the complete live document and deterministic failure diagnostics for missing state/fence boundaries, duplicate tuples, adjacent markers, empty markers/output, malformed markers, and unclosed fences.
- Moved `CatalogFixture` and `FixtureMap` into a test-only model module without changing fixture payloads or expected output ownership.
- Replaced permissive Node mock helpers with strict case-local context/UI/Pi doubles. Every catalog fixture now proves one exact notification, its one-vs-two argument severity shape, ordered captured bytes, and exactly two soft-dependency tool probes.
- Preserved the generic hub-ledger fixture on `catalog-uat.test.ts` for its valid Plans 06-28 through 06-33 lifecycle.

## TDD Evidence

- **RED — `6744a0dd`:** `loadCatalogExamples preserves exact section, state, and output bytes` received an empty tuple list instead of two exact tuples. The targeted TAP run exited 1, and `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- **GREEN — `d10b6c1f`:** the extracted parser passed all 12 direct cases and the retained catalog driver passed its full 190-tuple exact-byte contract.
- **REFACTOR:** No separate parser cleanup commit was needed. Task 2's independent structural extraction is commit `03fcc901`, not a synthetic TDD refactor gate.

## Task Commits

1. **Task 1 RED: Define the failing parser contract** — `6744a0dd` (test)
2. **Task 1 GREEN: Extract the strict catalog parser** — `d10b6c1f` (feat)
3. **Task 2: Extract fixture types and strict Pi boundary** — `03fcc901` (refactor)

## Files Created/Modified

- `tests/architecture/catalog-uat/catalog-parser.ts` — Owns exact tuple parsing and stable fail-closed diagnostics.
- `tests/architecture/catalog-uat/catalog-parser.test.ts` — Directly proves complete-catalog parsing and malformed boundary behavior.
- `tests/architecture/catalog-uat/fixture-types.ts` — Owns the catalog fixture/model contracts.
- `tests/architecture/catalog-uat/mock-pi.ts` — Owns strict notification capture and soft-dependency probe doubles.
- `tests/architecture/catalog-uat.test.ts` — Imports the new owners directly while retaining fixtures, forward/inverse completeness, and end-to-end byte/severity checks.

## Exactness and Independence Proof

- The direct parser suite reads `docs/output-catalog.md` and proves exactly 190 recognized tuples across exactly 20 surfaces, including the exact first and final tuple bytes.
- The retained driver still forward-walks every catalog tuple to a fixture and inverse-walks every fixture key to a catalog annotation; both tests pass.
- Strict boundaries capture every notification record in call order and preserve whether severity was omitted or supplied as a second argument. All 190 renderer/orchestrator fixture cases remain byte- and severity-exact.
- `git grep` finds zero production imports of `catalog-parser.ts`, `fixture-types.ts`, or `mock-pi.ts`.
- Import scans find only the retained catalog driver and parser direct test consuming the new utilities. Producer owner tests do not import catalog/parser/fixture data.
- The hub-ledger checker remains green and continues to name `catalog-uat.test.ts` as the live generic retirement fixture through Plan 06-33.

## Verification

- `node --test tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/catalog-uat.test.ts` — passed.
- `npm run typecheck` — passed.
- Full `npm run lint` and focused ESLint for all five changed TypeScript files — passed.
- Focused Prettier and `git diff --check` — passed.
- `node --test tests/scripts/check-phase-06-hub-ledger.test.ts` — passed.
- `npm run test:corresponding` and `npm run test:corresponding:negative` — passed.
- `npm run test:coverage:direct:negative` — passed unrestricted after the sandbox suppressed its expected child-process diagnostic.
- `npm run fallow` — passed with zero dead-code issues and zero items above the configured health threshold.
- Focused TypeScript unit-test review — passed: direct parser ownership, one behavior per case, exact assertions, no skips/todos, hermetic document access, case-local strict doubles, and explicit verification.
- Focused Google TypeScript style review — passed: typecheck, ESLint, Prettier, import grouping, named exports, `.ts` relative imports, no unsafe assertions in new utilities, and no unsupported constructs.
- Aggregate `npm test` attribution ran 261 files: 259 passed. The only reds were the declared sealed `tests/architecture/revalidation.test.ts` Phase 1 fixture debt and the sandbox-only marketplace/add Unix-socket case. `tests/orchestrators/marketplace/add.test.ts` then passed 63/63 unrestricted, leaving only the sealed unrelated debt.

## Decisions Made

- Retained the existing 20-surface section grammar, including the command-less `reconcile-applied-cascade` and kebab-cased manual recovery owner.
- Kept out-of-band annotated sections intentionally excluded, matching the catalog's documented ownership boundary.
- Used strict mocks only in test support and added no production export or compatibility seam.
- Kept the catalog hub and its generic ledger references intact for the scheduled Plan 06-33 guarded deletion.

## Deviations from Plan

None — the plan executed as written.

## Issues Encountered

- Aggregate tests reproduced the declared sealed Phase 1 `tests/architecture/revalidation.test.ts` TREF-04 through TREF-09 fixture debt. The file was not modified.
- The aggregate sandbox denied the marketplace/add Unix socket; the complete file passed 63/63 unrestricted.
- The direct-coverage negative controls needed the same unrestricted child-process diagnostic path already documented in prior Phase 6 plans; they passed unrestricted.

## Known Stubs

None. The created and modified files contain no placeholder, TODO, FIXME, skipped test, or unwired empty behavior.

## Threat Flags

None. All new files are test-only. The parser fails closed on tampered marker boundaries, and captured output remains limited to the existing redacted public notification boundary.

## User Setup Required

None.

## Next Phase Readiness

- Plans 06-29 through 06-32 can move the 20 command-surface fixture slices onto `FixtureMap` and the strict Pi helpers without changing the catalog parser or producer expectations.
- Plan 06-33 can assemble the final bidirectional contract and retire the retained hub using the already-rotated generic ledger fixture.
- The sealed Phase 1 revalidation fixture debt remains unchanged and out of scope.

## Self-Check: PASSED

All four created files and the modified driver exist. Commits `6744a0dd`, `d10b6c1f`, and `03fcc901` exist in order. Focused, structural, style, type, independence, and hub-transfer checks pass.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
