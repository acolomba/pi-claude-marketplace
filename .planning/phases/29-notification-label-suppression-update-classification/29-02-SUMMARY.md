---
phase: 29-notification-label-suppression-update-classification
plan: "02"
subsystem: notifications
tags: [catalog-uat, output-catalog, style-guide, adr, summary-line, UXG-07, docs]

# Dependency graph
requires:
  - phase: 29-notification-label-suppression-update-classification
    plan: "01"
    provides: buildSummaryLine + notify() error/warning summary prepend (the byte forms this plan locks into the catalog)
provides:
  - "docs/output-catalog.md error/warning byte blocks carry the Phase 29 summary line (byte-equal to notify())"
  - "catalog-uat byte-equality gate green against the summary-prefixed catalog"
  - "docs/messaging-style-guide.md + docs/adr/v2-001-structured-notify.md document the summary-line composition"
affects:
  - "29-03 (update.ts reclassification + update.test.ts) -- the remaining sibling plan to restore npm run check green for the whole phase"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catalog-UAT lockstep: docs/output-catalog.md fenced blocks are the byte-equal source the catalog-uat driver compares against live notify() output; a notify() output change requires the catalog block to move in lockstep"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - docs/messaging-style-guide.md
    - docs/adr/v2-001-structured-notify.md

key-decisions:
  - "Derived the exact per-fixture summary line from the catalog-uat byte-mismatch output (the live notify() string) rather than recomputing by hand -- the test's actual output is the ground truth for all 16 error/warning blocks"
  - "Task 2 needed only the fixture comment-block note: the catalog-uat driver reads the catalog at test time and byte-compares against notify(), so the Task 1 catalog edit is the primary update; no hardcoded fixture strings carried cascade bytes (expectedSeverity kept per D-29-06)"

patterns-established:
  - "Summary-line catalog form: error/warning fenced blocks open with '{summary}\\n\\n' before the cascade body; info blocks unchanged"

requirements-completed: [UXG-07]

# Metrics
duration: ~25 min
completed: 2026-05-31
---

# Phase 29 Plan 02: Catalog / Style-Guide / ADR Summary-Line Sync Summary

**Updated all 16 `error`/`warning` byte blocks in `docs/output-catalog.md` to prepend the Phase 29 summary line so each fenced block is byte-equal to `notify()`'s post-Plan-29-01 output, kept the catalog-UAT byte-equality gate green, and documented the summary-line composition in the messaging style guide and the structured-notify ADR.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (all auto)
- **Files modified:** 4

## Accomplishments

- Prepended the correct summary line to every `error`/`warning` catalog byte block (16 fixtures across `list`, `install`, `uninstall`, `reinstall`, `update`, `marketplace add`/`remove`/`update`/`autoupdate`, and the manual-recovery anchor). The per-fixture line was read directly from the catalog-uat byte-mismatch output (the live `notify()` string), so the catalog now agrees byte-for-byte: e.g. `1 plugin operation failed.`, `2 plugin operations failed.`, `1 marketplace operation failed.`, `1 plugin operation and 1 marketplace operation failed.` (marketplace `remove` partial), `1 plugin operation skipped.` (manual-recovery).
- Added a `Summary line (error / warning)` subsection under the catalog's `Severity routing` H2 plus a severity-routing note in the Conventions prose (D-29-07).
- Confirmed the catalog-UAT byte-equality gate (`catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()`) now passes; `expectedSeverity` fixtures preserved (D-29-06). Added a SUMMARY-LINE note to the FIXTURES comment block.
- Documented the summary-line composition in `docs/messaging-style-guide.md` (a new grammar-invariant bullet + a `Severity Routing -- Summary line` subsection) and in `docs/adr/v2-001-structured-notify.md` (an Implementation-seam note + a full `Amendment: Phase 29` section).
- `npm run check` exits 0 (1168 tests pass; typecheck + ESLint + Prettier clean).

## Task Commits

1. **Task 1: prepend summary line to error/warning catalog blocks** - `0529b68` (docs)
2. **Task 2: note summary-line prefix in catalog-uat fixture comment** - `84a2892` (test)
3. **Task 3: note summary-line composition in style guide and ADR** - `2426a94` (docs)

## Files Created/Modified

- `docs/output-catalog.md` - 16 `error`/`warning` fenced blocks prefixed with the summary line; `Summary line` subsection added under `Severity routing`; Conventions severity-routing note added.
- `tests/architecture/catalog-uat.test.ts` - FIXTURES comment block notes the summary-line prefix (UXG-07 / D-29-02) while preserving `expectedSeverity` (D-29-06). No driver change needed -- the driver byte-compares the catalog against live `notify()`.
- `docs/messaging-style-guide.md` - `Computed summary line` grammar bullet + `Severity Routing -- Summary line` subsection describing the `{summary}\n\n{body}` composition and the structurally-computed (not free-text) provenance.
- `docs/adr/v2-001-structured-notify.md` - Implementation-seam note on the `{summary-line}\n\n{body}` emission + `Amendment: Phase 29 (2026-05-31)` section (buildSummaryLine, the composition, the kept severity routing per D-29-01, and the REQUIREMENTS.md UXG-07 supersession).

## Decisions Made

- **Ground-truthed the summary lines from the failing test, not by hand.** The catalog-uat driver emitted the exact live `notify()` string for every error/warning fixture as the byte-mismatch "actual"; I copied each into the catalog block. This eliminates any pluralization/mixed-grammar transcription error and guarantees byte-equality.
- **Task 2 is comment-only.** Because the catalog-uat driver reads `docs/output-catalog.md` at test time and compares it against `notify()` output (no hardcoded cascade strings in fixtures), the Task 1 catalog edit drove the gate green on its own; the only fixture-file change was the documentation note plus preservation of `expectedSeverity` (D-29-06).

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated that the catalog-uat driver compares the catalog against `notify()` (not hardcoded strings), so Task 2 reduced to the comment-block note; this is the documented expected path, not a deviation.

## Issues Encountered

- **node_modules absent in the worktree.** The parallel worktree had no `node_modules`, so `npm run check` could not run natively. Resolved by symlinking the main repo's `node_modules` (`node_modules/` is gitignored; staging was per-file so it was never committed; the symlink is removed before returning). No network install needed.
- **trufflehog pre-commit hook fails in the worktree.** The hook errors with `failed to read index file: open .../.git/index: not a directory` because the worktree's `.git` is a file pointing at `.git/worktrees/<id>/`. This is the documented worktree limitation in CLAUDE.md; commits used `SKIP=trufflehog` per that guidance. The changed files are docs/tests with no secrets.
- **mdformat reformatted `docs/output-catalog.md`** on first pre-commit pass (whitespace/wrapping only). Re-ran the catalog-uat gate after reformatting to confirm the fenced-block bytes were untouched -- it stayed green -- then re-ran mdformat to confirm idempotence before committing.

## Cross-Plan Convergence

`npm run check` exits 0 from THIS worktree because Plan 29-01's lockstep test moves are present on the base commit (`8423a23`). The full phase green state additionally requires Plan 29-03 (`update.ts` reclassification + `update.test.ts` PUP assertion updates). This plan owns only the catalog/style-guide/ADR surface and does not touch `update.test.ts` or `notify.ts`.

## Threat Flags

None -- no new security-relevant surface. Changes are docs and a test-file comment. No npm installs (matches the plan `<threat_model>` T-29-SC `accept` disposition). The catalog-uat byte gate locks the catalog byte forms (T-29-02 `accept`).

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- FOUND: `.planning/phases/29-notification-label-suppression-update-classification/29-02-SUMMARY.md`
- FOUND: `docs/output-catalog.md` (16 summary-line occurrences; catalog-uat byte gate green)
- FOUND: `docs/messaging-style-guide.md` (Summary line subsection)
- FOUND: `docs/adr/v2-001-structured-notify.md` (Amendment: Phase 29 section)
- FOUND commit `0529b68` (Task 1 docs)
- FOUND commit `84a2892` (Task 2 test)
- FOUND commit `2426a94` (Task 3 docs)

---
*Phase: 29-notification-label-suppression-update-classification*
*Completed: 2026-05-31*
