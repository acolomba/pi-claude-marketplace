---
phase: 27-marketplace-autoupdate-output-grammar
plan: 01
subsystem: testing
tags: [catalog, output-grammar, autoupdate, marketplace, docs, byte-equality]

# Dependency graph
requires:
  - phase: 24-grammar-consistency
    provides: catalog-uat byte-equality runner contract + autoupdate surface fixtures
provides:
  - "Corrected github-source `marketplace add` prose (no source kind auto-enables autoupdate)"
  - "Renamed autoupdate heading to the real verbs `autoupdate|noautoupdate`"
  - "FIXTURES key synced byte-for-byte to the renamed `## ` heading"
affects: [UXG-04, autoupdate-fixtures, marketplace-list-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catalog-uat FIXTURES key is byte-coupled to the `## ` heading inner backtick text (loadCatalogExamples sectionRe)"

key-files:
  created:
    - .planning/phases/27-marketplace-autoupdate-output-grammar/27-01-SUMMARY.md
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "Heading renamed to `/claude:plugin marketplace autoupdate|noautoupdate <name>` (names both real edge verbs; drops the non-existent `disable` subcommand per router.ts:74-75)"
  - "github-source prose now states `marketplace add` never enables autoupdate for any source kind; autoupdate is opt-in via `bootstrap` or explicit `marketplace autoupdate` (verified against add.ts:235-244 / 311-320)"
  - "Preamble at L845 left unchanged: it describes V2 outcome states, not the verb form, and its cross-link targets the `## marketplace list` heading (unaffected by the rename)"

patterns-established:
  - "Pattern: when renaming a `## ` heading in output-catalog.md, the catalog-uat FIXTURES map key MUST be updated byte-for-byte in the same commit (loadCatalogExamples derives the section key from the heading inner backtick text via sectionRe at catalog-uat.test.ts:82)"

requirements-completed: [UXG-06]

# Metrics
duration: 6min
completed: 2026-05-30
---

# Phase 27 Plan 01: Marketplace Autoupdate Output Grammar (UXG-06) Summary

**Corrected the false "github `marketplace add` defaults autoupdate ON" catalog claim and renamed the autoupdate command heading to the real `autoupdate|noautoupdate` verbs, with the catalog-uat FIXTURES key synced byte-for-byte to keep byte-equality GREEN.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-30T22:55:25Z
- **Completed:** 2026-05-30
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed the verified-false prose claiming GitHub-source `marketplace add` persists `autoupdate: true`. `add.ts` writes no `autoupdate` field for any source kind (github at add.ts:235-244, path at add.ts:311-320); only `bootstrap` enables it. The corrected prose states autoupdate is opt-in via `bootstrap` or an explicit `marketplace autoupdate`.
- Renamed the backtick-wrapped `## ` heading from `/claude:plugin marketplace autoupdate <enable|disable> <name>` to `/claude:plugin marketplace autoupdate|noautoupdate <name>`, naming the two real edge verbs (router.ts:74-75, 179-182) and dropping the non-existent `disable` subcommand.
- Synced the catalog-uat `FIXTURES` map key (catalog-uat.test.ts:1285) byte-for-byte to the renamed heading's inner backtick text, the forced 1-line test edit driven by `loadCatalogExamples` section-key derivation.
- catalog-uat byte-equality stays GREEN; `npm run check` GREEN end-to-end (1143/1143 tests, exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct github-source prose + rename the autoupdate heading + sync the FIXTURES key** - `0169992` (docs)
2. **Task 2: Full-suite GREEN gate for UXG-06** - no commit (GREEN gate only; no source change, as planned)

**Plan metadata:** see final `docs(27-01)` commit (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

- `docs/output-catalog.md` - Corrected github-source autoupdate prose (L750); renamed the autoupdate command heading to the real verbs (L843)
- `tests/architecture/catalog-uat.test.ts` - FIXTURES map key (L1285) synced byte-for-byte to the renamed heading

## Decisions Made

- Heading uses the `autoupdate|noautoupdate` pipe form to name both edge verbs while dropping the fictional `disable` subcommand; backtick wrapping retained because the driver's `sectionRe` requires it.
- github-source prose now also references the `<no autoupdate>` off-marker (consistent with the path-source block at L740) so the two add-surface descriptions are symmetric.
- Preamble at L845 left unchanged after inspection: it enumerates V2 outcome states (fresh-flip enable/disable, idempotent, failure), not the `<enable|disable>` verb form, and its cross-reference anchor targets `## /claude:plugin marketplace list` (unaffected by the autoupdate heading rename). Confirmed the anchor still resolves.

## Deviations from Plan

None - plan executed exactly as written. The FIXTURES-key edit was a planned, driver-forced part of Task 1 (UXG-06 doc-only modulo the test-key coupling), not a deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UXG-06 closed: catalog no longer claims github `add` auto-enables autoupdate; the heading names the real `autoupdate`/`noautoupdate` verbs; FIXTURES key matches the heading byte-for-byte.
- UXG-04 (Plan 03) can now rewrite the autoupdate state fixtures' byte forms without double-touching the heading or its FIXTURES key. The 5 nested state fixtures (enable-fresh, disable-fresh, enable-idempotent, disable-idempotent, failure-not-found) were intentionally left unchanged in this plan.

## Self-Check: PASSED

- FOUND: docs/output-catalog.md (renamed heading at L843, corrected prose at L750)
- FOUND: tests/architecture/catalog-uat.test.ts (FIXTURES key synced at L1285)
- FOUND: commit 0169992 (Task 1)
- catalog-uat GREEN (3/3); `npm run check` GREEN (1143/1143, exit 0)

---
*Phase: 27-marketplace-autoupdate-output-grammar*
*Completed: 2026-05-30*
