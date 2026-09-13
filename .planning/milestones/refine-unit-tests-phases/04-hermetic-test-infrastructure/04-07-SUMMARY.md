---
phase: 04-hermetic-test-infrastructure
plan: "07"
subsystem: test-infrastructure
tags: [typescript, test-doubles, naming, fallow, revalidation]

requires:
  - phase: 04-hermetic-test-infrastructure
    plan: "04"
    provides: Shared credential, Device Flow, and Git test collaborators
  - phase: 04-hermetic-test-infrastructure
    plan: "06"
    provides: Typed plugin fixtures and narrowed production collaborator ports
provides:
  - Exact role-only names for the 16 traced local collaborator factories
  - Current test-double, import, and Fallow suppression conventions
  - A complete green repository quality gate for Phase 4
affects: [phase-04, test-infrastructure, conventions, revalidation]

actuals:
  tokens: 37000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - Local configurable doubles use production-role create names
    - Reusable concern-owned abstractions retain explicit create-Fake names
    - Planning-table parsers accept formatter alignment whitespace

key-files:
  created:
    - .planning/phases/04-hermetic-test-infrastructure/04-07-SUMMARY.md
  modified:
    - .planning/codebase/CONVENTIONS.md
    - scripts/revalidation.mjs
    - tests/architecture/revalidation.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Keep local factory names role-only while preserving concern-owned create*Fake APIs."
  - "Remove credential stripping from the config/state Git fake because auth fidelity is part of the shared collaborator contract."
  - "Normalize only copied test-fixture table rows; keep the live parser responsible for Prettier-aligned Markdown."

requirements-completed: [TREF-02, TREF-03]

coverage:
  - id: H12
    description: "Exactly nine GitOps, four CredentialOps, and three DeviceFlowHttp local factories use role-only names without changing the reusable fake APIs."
    requirement: TREF-02
    verification:
      - kind: unit
        ref: "focused ten-suite Phase 04-07 command: 715 tests"
        status: pass
      - kind: other
        ref: "exact old/new factory definition census"
        status: pass
    human_judgment: false
  - id: H13
    description: "Phase 4 test infrastructure and repository conventions pass the complete project quality gate."
    requirement: TREF-03
    verification:
      - kind: unit
        ref: "npm run check: 5397 unit tests"
        status: pass
      - kind: integration
        ref: "npm run check: 32 integration tests"
        status: pass
      - kind: other
        ref: "npm run check: typecheck, ESLint, Fallow, Prettier, and structural controls"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 07: Role-Named Test Collaborators Summary

**Sixteen traced local factories now use production-role names, the conventions match the implemented fake architecture, and the complete repository gate is green.**

## Accomplishments

- Renamed exactly 16 definitions and their local calls: nine `createGitOps`, four `createCredentialOps`, and three `createDeviceFlowHttp`; the selected old names are absent.
- Reworded four production option comments without test-helper names and documented the distinction between local role-named factories and reusable concern-owned `create*Fake` abstractions.
- Closed final gate fallout while preserving the temporary function-scoped Fallow complexity suppression and its Phase 01-71 removal target.

## Task Commit

1. **Tasks 1-2: Align collaborator naming, conventions, and complete gates** — `b78809bf`

## Deviations from Plan

### Auto-fixed Issues

**1. Config/state fixture stripped injected clone authentication**

- **Found during:** Task 2 policy census
- **Issue:** The selected `createGitOps` wrapper silently removed `auth` before delegating, violating the Phase 4 no-auth-stripping contract.
- **Fix:** Returned the shared `createGitOpsFake` directly and removed the obsolete wrapper type.
- **Verification:** The focused config/state suite and full repository gate passed.
- **Committed in:** `b78809bf`

**2. Type narrowing made 12 SDK assertions and one import order stale**

- **Found during:** Task 2 full ESLint gate
- **Issue:** Earlier Phase 4 port narrowing made 12 `fixture.pi as never` assertions unnecessary; one shared-fake test import no longer matched project ordering.
- **Fix:** Removed only the redundant assertions and reordered the local import.
- **Verification:** Focused architecture tests, ESLint, and the full gate passed.
- **Committed in:** `b78809bf`

**3. Revalidation assumed compact Markdown rows and stale Phase 3 statuses**

- **Found during:** Task 2 full unit gate
- **Issue:** The live traceability parser rejected Prettier-aligned cells, while sealed routes and negative fixtures still treated completed Phase 3 PDEF requirements as pending.
- **Fix:** Accepted alignment whitespace in the parser, synchronized the sealed Phase 3 statuses, and compacted only copied negative-test fixtures before their exact mutations.
- **Verification:** `tests/architecture/revalidation.test.ts` passed 136/136 and `npm run check` passed.
- **Committed in:** `b78809bf`

---

**Total deviations:** 3 auto-fixed correctness and gate-maintenance issues.
**Impact on plan:** The fixes were required to enforce existing Phase 4 contracts and verify the final source state; no new runtime behavior or dependency was introduced.

## Verification

- Focused ten-file suite: 715/715 passed with socket/process permissions.
- Exact definition census: 16 role-only definitions and zero selected old names.
- Revalidation architecture suite: 136/136 passed.
- `npm run check`: typecheck, ESLint, Fallow, Prettier, structural negative controls, 5,397 unit tests, and 32 integration tests passed.
- Fallow health exited zero with `0 above threshold`; the existing scoped complexity suppression remains unchanged.
- The direct all-pairs run passed the shared-support pairs before stopping at the already routed Phase 7 `edge/args.ts` branch/line gap.
- The untracked user-owned `.mcp.json` was excluded from formatting and restored byte-identically (`09237a8c...49e6`).

## User Setup Required

None.

## Next Phase Readiness

Phase 4 implementation and its authoritative repository gate are complete. The remaining direct-coverage gap belongs to Phase 7 and does not block Phase 5.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_
