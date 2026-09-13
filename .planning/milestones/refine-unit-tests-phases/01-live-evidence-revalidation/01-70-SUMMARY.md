---
phase: 01-live-evidence-revalidation
plan: 70
subsystem: testing
tags: [node, cli, markdown, contract-validation, tdd]
requires:
  - phase: 01-live-evidence-revalidation
    provides: canonical 40-row scope crosswalk and evidence-derived planning contracts
provides:
  - fail-closed scope-impact planning-contract validation
  - planted requirement, route, disposition, phase, and anchor drift controls
  - standalone negative planning-contract witnesses
affects: [phase-planning, requirements, roadmap, verification]
actuals:
  tokens: 7418
  tasks: 2
  commits: 9
tech-stack:
  added: []
  patterns: [fixed-path confined reads, deterministic structured violations, public-CLI contract tests]
key-files:
  created: []
  modified:
    - scripts/revalidation.mjs
    - scripts/revalidation.negative.mjs
    - tests/architecture/revalidation.test.ts
key-decisions:
  - "Parse requirement definitions separately from traceability dispositions so moved evidence-only IDs remain stable without authorizing active work."
  - "Validate Phase 2-9 membership against traceability and require path-, phase-, and ID-qualified after anchors."
patterns-established:
  - "Planning contract checks read only fixed repository-relative paths through the existing containment boundary."
  - "Every plausible contract drift is planted through the public CLI with an exact structured outcome."
requirements-completed: [RVAL-01, RVAL-02, RVAL-03, RVAL-04]
coverage:
  - id: D1
    description: "scope-impact --check enforces the live 32 requirement and eight route contracts"
    requirement: RVAL-04
    verification:
      - kind: integration
        ref: "tests/architecture/revalidation.test.ts#RVAL-04 scope-impact checks all live planning-contract records"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs scope-impact --check"
        status: pass
    human_judgment: false
  - id: D2
    description: "contract, route, disposition, phase, and anchor drift fail closed"
    requirement: RVAL-04
    verification:
      - kind: unit
        ref: "tests/architecture/revalidation.test.ts#RVAL-04 scope-impact planted offenders"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.negative.mjs"
        status: pass
    human_judgment: false
duration: 19min
completed: 2026-09-06
status: complete
---

# Phase 01 Plan 70: Scope-Impact Planning Contract Gate Summary

**The public scope-impact check now round-trips all 40 evidence-derived rows through confined REQUIREMENTS.md and ROADMAP.md reads and rejects deterministic contract drift.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-06T13:08:17Z
- **Completed:** 2026-09-06T13:26:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Enforced exactly 32 stable requirement rows and eight stable Phase 2-9 route rows against the live planning contracts.
- Required mandatory, distinct, three-part before/after anchors and verified after anchors against requirement section/disposition or roadmap phase identity.
- Added 19 focused positive and planted negative controls while retaining ordinary scope-impact JSON bytes and achieving 100% direct branch, function, and line coverage.

## Task Commits

1. **Task 1 RED: public contract checks** - `d7031bfb`
2. **Task 1 GREEN: planning-contract checker** - `5206586b`
3. **Task 2 RED: planted drift controls** - `d3aa150c`
4. **Task 2 GREEN: fail-closed controls and negative runner** - `0aeab36c`
5. **Task 2 fix: strict fixture lookup** - `6b263b4b`
6. **Task 2 refactor: contract helper complexity** - `8a0fb16b`
7. **Task 2 refactor: anchor helper complexity** - `aa7af107`
8. **Task 2 style: test formatting** - `5172f5db`
9. **Task 2 style: implementation formatting** - `0ad373ee`

## Files Created/Modified

- `scripts/revalidation.mjs` - Parses and validates planning contracts, strict anchors, stable identities, dispositions, and routing.
- `scripts/revalidation.negative.mjs` - Plants missing and tampered planning-contract controls under its temporary root.
- `tests/architecture/revalidation.test.ts` - Proves positive 40-row behavior and every required fail-closed drift class through the public CLI.

## Decisions Made

- Requirement definitions and traceability dispositions are parsed independently so evidence-history rows can retain stable IDs without becoming active requirements.
- Roadmap requirements are compared as exact sets derived from REQUIREMENTS.md traceability; Phase 2-9 numbering and titles remain stable through qualified after anchors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced an unchecked array lookup in a planted offender**
- **Found during:** Task 2 aggregate typecheck
- **Issue:** Strict TypeScript correctly rejected direct index access as possibly undefined.
- **Fix:** Located the canonical row by its stable scope ID before mutation.
- **Files modified:** `tests/architecture/revalidation.test.ts`
- **Verification:** `npm run typecheck` passed.
- **Committed in:** `6b263b4b`

**2. [Rule 3 - Blocking] Split validation helpers to satisfy repository complexity gates**
- **Found during:** Task 2 aggregate lint and fallow gates
- **Issue:** The complete semantic checker and anchor validation exceeded enforced complexity thresholds.
- **Fix:** Extracted focused requirement, phase, and scope-anchor validation helpers without changing public behavior.
- **Files modified:** `scripts/revalidation.mjs`
- **Verification:** ESLint, fallow health, and 100% direct coverage passed.
- **Committed in:** `8a0fb16b`, `aa7af107`

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both changes were required for correctness and repository quality compliance; scope remained limited to the three plan-owned files.

## Issues Encountered

- The aggregate `npm run check` cannot pass formatting while the pre-existing untracked `.mcp.json` remains non-Prettier-compliant. The file was preserved as required. All plan-owned files pass targeted Prettier, typecheck, ESLint, fallow, architecture, negative-control, live-validation, scope-check, and direct-coverage gates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RVAL-04 now has a reproducible fail-closed round-trip gate for the evidence-derived planning contracts.
- The orchestrator can re-run Phase 1 goal verification; this plan does not transition the phase.

## Self-Check: PASSED

- All three modified implementation/test files exist.
- All nine task commits exist in git history.
- The final plan verification chain passes: 108/108 tests, negative controls, ledger validation, 40-record scope validation, and 100% direct coverage.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-06*
