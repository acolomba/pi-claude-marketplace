---
phase: 70-spec-documentation-reconcile
plan: 02
subsystem: docs
tags: [prd, force-install, resolver-state, severity, documentation]

# Dependency graph
requires:
  - phase: 64-69
    provides: shipped force-install behavior (RSTATE, FORCE, FSTAT, SEV) the PRD now documents
provides:
  - PRD section reconciled to the shipped force design (--force install/update, three-way resolver state, force-installed/force-upgradable tokens, force-upgradable rules)
  - Dropped-scope force item fully excised from PRD section 11
  - WR-01 autoupdate companion-warning scoping recorded in the PRD (D-70-03)
affects: [70-03, milestone-audit, milestone-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spec prose anchors shipped behavior to canonical requirement/decision IDs (RSTATE/FORCE/FSTAT/SEV/LIST/WR-01/D-70-NN); no GSD phase/plan numbers in PRD prose"

key-files:
  created: []
  modified:
    - docs/prd/pi-claude-marketplace-prd.md

key-decisions:
  - "Documented --force in the body and Appendix A subcommand index rather than altering section headings, to keep the Table-of-Contents anchors stable"
  - "Used the canonical requirement IDs (FORCE-/RSTATE-/FSTAT-) as PRD row anchors so the spec cross-references REQUIREMENTS.md directly"
  - "Matched the document's existing underscore single-emphasis style (MD049 consistency) for new prose"

patterns-established:
  - "Three-way resolver state documented as installable | unsupported | unavailable with structural precedence"
  - "Force tokens (force-installed, force-upgradable) documented as DERIVED states with explicit glyph roles (the dedicated force-installed glyph vs the clean installed glyph)"

requirements-completed: [DOC-01]

# Metrics
duration: 18min
completed: 2026-06-28
---

# Phase 70 Plan 02: Reconcile PRD to the shipped force design Summary

**PRD reconciled to the shipped force feature set -- `--force` install/update, the three-way resolver state (installable | unsupported | unavailable), the force-installed/force-upgradable derived tokens and rules, the frozen `--force` hint trailer, and the WR-01 autoupdate companion-warning scoping -- with the dropped-scope force out-of-scope bullet fully excised.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-28T16:08:00Z
- **Completed:** 2026-06-28T16:26:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Removed the section 11 `--force`/`incomplete`-state out-of-scope bullet so the spec reads as if the dropped design was never planned (D-70-04). The "global force default" and manual `complete` command concepts were already absent from the PRD; confirmed via grep that no force-specific residue remains.
- Documented `--force` as a per-invocation opt-in on BOTH `install` and `update` that degrades unsupported components and never bypasses hard failures (FORCE-01..05), with no `Warning:` summary on the force path.
- Documented the three-way discriminated resolver state with structural precedence and the two narrowing gates (RSTATE-01..05); updated the glossary, the resolver requirement rows (PR-1..PR-3 amended, PR-7..PR-9 added), and the install/list/update sections.
- Documented the `force-installed` and `force-upgradable` derived tokens, their glyphs, and the force-upgradable rules (FSTAT-01..05), including the frozen hint trailer `Re-run with --force to install the supported components.` and the SEV-02 severity split (D-70-01 / D-70-02).
- Recorded the WR-01 autoupdate companion-warning scoping in section 5.4 as intentional, shipped behavior (D-70-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dropped scope from the PRD (D-70-04)** - `e8258d27` (docs)
2. **Task 2: Document the shipped force design + WR-01 scoping** - `9a37bd70` (docs)

## Files Created/Modified
- `docs/prd/pi-claude-marketplace-prd.md` - Excised the dropped-scope out-of-scope bullet; documented the shipped force design across the glossary (section 3), install (5.2.1), update (5.2.3), list (5.3.1 / PL-4, PL-8, PL-9), autoupdate cascade (5.4 / WR-01), the resolver (6.4 / RSTATE), error severity (6.12 / ES-6), and the Appendix A subcommand index.

## Decisions Made
- Documented `--force` in section bodies and the Appendix A index rather than editing the `### 5.2.1` / `### 5.2.3` headings, to avoid breaking the Table-of-Contents anchor slugs (surgical, no churn).
- Anchored new requirement rows with the shipped requirement IDs (FORCE-/RSTATE-/FSTAT-/SEV-) so the PRD cross-references REQUIREMENTS.md directly, per the plan's ID-citation policy. No GSD phase/plan numbers appear in PRD prose.
- Included the `--unsupported` list filter and the force token closed-set/glyph additions to PL-4 so the list section stays internally consistent with the new tokens (LIST-01 is part of the shipped force design).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MD049 emphasis-style consistency failure**
- **Found during:** Task 2 (pre-commit `markdownlint-cli2`)
- **Issue:** New prose used asterisk single-emphasis (`*partially*`), which made the document's pre-existing underscore emphasis (`_End of document._`) inconsistent under MD049's consistent-style rule, failing the lint hook.
- **Fix:** Changed the new emphasis to underscore form (`_partially_`) to match the document's established style (also satisfies CLAUDE.md rule 3, match existing style).
- **Files modified:** docs/prd/pi-claude-marketplace-prd.md
- **Verification:** `pre-commit run --files docs/prd/pi-claude-marketplace-prd.md` passes clean (two runs to settle mdformat auto-fix).
- **Committed in:** `9a37bd70` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mechanical lint-consistency fix; no content or scope impact.

## Issues Encountered
- `npm run check` reports a single failing test (`autoupdate.test.ts:533` IDEMPOTENT flip, `ENOTEMPTY` rmdir). This is the pre-existing tmpdir teardown flake under parallel runs explicitly documented as carry-forward tech-debt in 70-CONTEXT.md. Confirmed the file passes 20/20 in isolation (`node --test tests/orchestrators/marketplace/autoupdate.test.ts`). Out of scope for this docs-only plan; not introduced by the PRD change.
- `mdformat` auto-reformats the PRD tables on first pre-commit run (known: requires a second run to settle). Handled by re-running until clean before committing.

## Next Phase Readiness
- DOC-01 satisfied; the PRD now matches the shipped force design. Ready for 70-03 (freeze `FORCE_INSTALL_HINT_TRAILER`, stale-comment sweep) and the milestone audit/complete lifecycle.
- No blockers introduced. The parallel-run test flake remains a post-milestone cleanup candidate.

## Self-Check: PASSED

- FOUND: `.planning/phases/70-spec-documentation-reconcile/70-02-SUMMARY.md`
- FOUND: `docs/prd/pi-claude-marketplace-prd.md`
- FOUND commit: `e8258d27` (Task 1)
- FOUND commit: `9a37bd70` (Task 2)

---
*Phase: 70-spec-documentation-reconcile*
*Completed: 2026-06-28*
