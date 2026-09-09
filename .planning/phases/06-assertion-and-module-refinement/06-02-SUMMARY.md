---
phase: 06-assertion-and-module-refinement
plan: "02"
subsystem: testing
tags: [typescript, node-test, codegraph, hermeticity, builtin-patching]

requires:
  - phase: 06-assertion-and-module-refinement
    plan: "01"
    provides: exact public assertion contracts for the module-refinement wave
  - phase: 05-test-infrastructure-hardening
    plan: "34"
    provides: authorized global-patch census and narrow production-owned seams
provides:
  - deterministic 24-row MF-DEC-01 census with fail-closed census, pre-edit, and closure modes
  - bridge, reconcile, and path-safety owners without authorized shared-process builtin mutation
  - exact owner, fixture, legacy-hub, and residual-patch closure invariants for Phase 6
affects: [06-assertion-and-module-refinement, bridge-tests, reconcile-tests, path-safety-tests]

actuals:
  tokens: 22477
  tasks: 3
  commits: 6
plan_head_before: 92d511289e2d302f76eac0822a91f74d465b0530

tech-stack:
  added: []
  patterns:
    - case-owned filesystem state replaces shared Node builtin mutation
    - existing reader and inspector ports provoke deterministic race and fault outcomes
    - deterministic ledgers bind resolved finding IDs to tracked sources, owners, and routes

key-files:
  created:
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - .planning/phases/06-assertion-and-module-refinement/06-MF-DEC-01-CENSUS.md
  modified:
    - tests/bridges/commands/discover.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/skills/unstage.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/shared/path-safety.test.ts

key-decisions:
  - "The MF-DEC-01 census is bound to exactly 24 resolved finding IDs and explicit current routes; ER-F19 remains reserved for Phase 8."
  - "Bridge lifecycle proofs use case-owned state plus existing readers, executors, runtimes, and public results; no test-only production export is added."
  - "Irreproducible builtin timing cases are removed only where an existing production port or direct owner retains the same public failure or convergence contract."

requirements-completed: [TREF-08]

coverage:
  - id: D1
    description: "The deterministic MF-DEC-01 census contains exactly 24 canonical, uniquely routed rows with fresh CodeGraph evidence and ER-F19 assigned to Phase 8."
    requirement: TREF-08
    verification:
      - kind: unit
        ref: "node --test tests/scripts/check-phase-06-hub-ledger.test.ts"
        status: pass
      - kind: artifact
        ref: ".planning/phases/06-assertion-and-module-refinement/06-MF-DEC-01-CENSUS.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Discover, event routing, and unstage owners preserve exact public outcomes without mutating shared Node builtins."
    requirement: TREF-08
    verification:
      - kind: unit
        ref: "node --test tests/bridges/commands/discover.test.ts tests/bridges/hooks/event-router.test.ts tests/bridges/skills/unstage.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reconcile race and path-safety fault proofs use existing ports or real temporary trees while retaining result, traversal, redaction, and error-identity assertions."
    requirement: TREF-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/apply.test.ts tests/shared/path-safety.test.ts"
        status: pass
      - kind: quality
        ref: "npm run typecheck && npm run fallow"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 02: Assertion and Module Refinement Summary

**A deterministic 24-case decision ledger now guards Phase 6 ownership changes, while five owner suites prove the same public outcomes without shared-process builtin surgery.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-09T03:23:08Z
- **Completed:** 2026-09-09T03:52:50Z
- **Tasks:** 3
- **Files created or modified:** 8

## Accomplishments

- Added a fail-closed ledger verifier with `census`, `preedit`, and `closure` modes plus a mirrored direct owner test. The census records all 24 MF-DEC-01 findings, their tracked source and owner, fresh trace evidence, and an explicit route.
- Removed builtin patching from discover, event-router, and unstage owners. Exact warnings, route state, cache state, notification payloads, error identity, and cleanup results remain asserted.
- Replaced reconcile race and path-safety fault setup with the existing `ReconcileStateReader` and `PathSafetyInspector` boundaries or real case-owned trees. Traversal rejection, redaction, walk order, partial state, and whole public results remain observable.
- Left the two authorized residual patch owners untouched: `tests/bridges/skills/stage.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts`.

## Task Commits

Each task and its verification fixes were committed atomically:

1. **Task 1 RED: Add failing ledger contracts** - `fe71e87f` (test)
2. **Task 1 GREEN: Implement the ledger and 24-row census** - `7a267156` (feat)
3. **Task 2: Remove bridge builtin mutation** - `6527a944` (test)
4. **Verification fix: Split closure validation into focused health-gate helpers** - `f502044f` (refactor)
5. **Task 3: Remove reconcile and path builtin mutation** - `84a889b5` (test)
6. **Verification fix: Harden closure arguments, residual scope, and race-helper types** - `26476f9c` (fix)

## Files Created/Modified

- `scripts/check-phase-06-hub-ledger.mjs` - Validates the exact decision census, pre-edit ledgers, and Phase 6 closure inventory.
- `tests/scripts/check-phase-06-hub-ledger.test.ts` - Directly owns the verifier's accepted and fail-closed contracts.
- `.planning/phases/06-assertion-and-module-refinement/06-MF-DEC-01-CENSUS.md` - Records all 24 current source, owner, dependency, route, and replacement mappings.
- `tests/bridges/commands/discover.test.ts` - Retains unsafe-name and filesystem-error outcomes without patching builtins.
- `tests/bridges/hooks/event-router.test.ts` - Uses the existing hydration reader, executor, runtime, and real process state for lifecycle proofs.
- `tests/bridges/skills/unstage.test.ts` - Retains exact ENOENT, failure-identity, removal-target, and partial-tree outcomes through the remover port.
- `tests/orchestrators/reconcile/apply.test.ts` - Drives selected-state races through the existing state reader and real child reconciliation.
- `tests/shared/path-safety.test.ts` - Uses real temporary trees and the existing inspector port for path walk and filesystem failures.

## Decisions Made

- The census accepts only the resolved MF-DEC-01 selection, exact canonical ID set, tracked source/owner pairs, and known route vocabulary. Missing, duplicate, stale, cyclic, or unmapped evidence fails closed.
- Closure scanning ignores the verifier and its direct owner so their token literals cannot pollute the production residual-patch census. Its CLI accepts the multi-root spelling already specified by the Phase 6 closure plan.
- Existing narrow ports are the deterministic boundary for otherwise irreproducible timing or filesystem faults. Public result assertions remain authoritative; collaborator calls are supporting evidence only.
- Cases that existed solely to patch an internal builtin timing point were removed when the equivalent public outcome remains covered through a production-owned port or the operation's direct owner.

## TDD Gate Compliance

- **RED:** `fe71e87f` introduced intentionally failing census, pre-edit, and closure contracts; the runtime RED-evidence check passed before implementation.
- **GREEN:** `7a267156` implemented all three modes and generated the exact 24-row census.
- **REFACTOR:** `f502044f` split closure checks into focused helpers without changing accepted inputs or diagnostics.
- Tasks 2 and 3 changed only test mechanics around already-implemented public behavior. Their focused owner suites passed before each behavior-preserving commit; no production behavior was added.

## Verification

- `node --test` passed all six focused owners: the five plan suites plus the ledger verifier owner.
- `npm run typecheck` passed.
- ESLint passed with zero warnings for the verifier and all five refined owner suites.
- Prettier checks passed for all plan artifacts.
- `npm run fallow` passed dead-code, health, and duplication enforcement.
- A prohibited-token scan found no `syncBuiltinESMExports`, `createRequire`, prototype mutation, or direct `fs` mock patching in the five refined owner suites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split the initial closure validator after the health gate reported excessive complexity**

- **Found during:** Task 3 verification
- **Issue:** The first correct closure implementation exceeded Fallow's function-complexity threshold.
- **Fix:** Extracted tracked-inventory, legacy-inventory, and residual-census helpers while preserving exact fail-closed diagnostics.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`
- **Commit:** `f502044f`

**2. [Rule 1 - Bug] Corrected closure CLI scope and reconcile helper types found by final verification**

- **Found during:** Overall verification
- **Issue:** The closure parser accepted only one root value and counted its own verifier literals; TypeScript also exposed an incomplete reconcile-helper option type.
- **Fix:** Accepted variadic flag values, excluded the verifier pair from residual scanning, owner-tested the exclusion, and defaulted only omitted routing/cache dependencies with exact types.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`
- **Commit:** `26476f9c`

## Issues Encountered

The previously known Phase 1 sealed-route drift in `tests/architecture/revalidation.test.ts` is outside this plan's verification scope. This plan did not modify, run around, or conceal it, and it did not affect any specified gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All scoped shared-process patches are gone, the two authorized residual owners remain unchanged, and the fail-closed ledger is ready for later Phase 6 pre-edit and closure checks. No blockers remain.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary, all eight plan artifacts, the persisted plan-head ledger, and all six recorded task or verification-fix commits exist. The measured pre-metadata commit count is six.
