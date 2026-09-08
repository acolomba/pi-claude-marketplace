---
phase: 05-injection-and-ownership-design
plan: 20
subsystem: extension-lifecycle-ownership
tags: [completion-cache, marketplace-remove, edge-registration, post-commit-hygiene, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned CompletionCache and exact lifecycle composition from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: lifecycle-owned marketplace add cache propagation from Plan 05-19
provides:
  - registered marketplace remove bound to the same required CompletionCache as add and public completions
  - durable-commit names-then-plugin invalidation before marketplace data and clone hygiene
  - exact full, partial, ineligible, failure, rebuild, target, scope, and peer-isolation evidence
affects: [05-21, marketplace-update, completion-lifecycle, reconcile]

actuals:
  tokens: 9389
  tasks: 2
  commits: 4
plan_head_before: caf5351888bc8eaae2a325cea6a848c990a1a8c2

tech-stack:
  added: []
  patterns:
    - lifecycle owners pass one required CompletionCache through exact remove consumers
    - locked durable mutation precedes cache invalidation, which precedes destructive data hygiene
    - direct tests create fresh production cache owners and share one only across intentional lifecycles

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/architecture/config-state-consistency.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/register.test.ts
    - tests/orchestrators/marketplace/remove.test.ts

key-decisions:
  - "Require CompletionCache at marketplace remove's real handler and orchestrator consumers; never construct or select a fallback owner."
  - "Preserve the existing single swallowed invalidation sequence: names first, target plugin index second only when names invalidation succeeds, then independent data/clone hygiene."
  - "Propagate reconcile's existing lifecycle cache into its real remove child rather than adding a second cache lifetime."

patterns-established:
  - "Remove cache owner: one root CompletionCache crosses registration, the exact handler port, and reconcile's real remove child."
  - "Remove freshness boundary: only a transaction that returns from the locked durable path reaches cache invalidation; precondition, no-effect, and rollback paths remain cache-inert."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered marketplace remove forwards the root CompletionCache and rebuilds the next public completion through that owner while peer and unrelated cache rows remain isolated."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered remove"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts and edge/handlers/marketplace/remove.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full and partial durable removal invalidates scoped names then the target plugin index after persistence and before data hygiene; no-effect, pre-commit, and rollback paths do not invalidate."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#invalidates committed full removal after persistence and before data hygiene"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#invalidates a partial removal while retaining failed plugin data"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/marketplace/remove.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Either cache invalidation failure remains swallowed while committed state, result, notification, and later data hygiene remain exact."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#continues data hygiene after names invalidation fails"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#continues data hygiene after plugins invalidation fails"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 20: Lifecycle-Owned Marketplace Remove Cache Summary

**Marketplace remove now uses the root completion-cache owner end to end, invalidating only after its locked mutation commits and before data and clone hygiene.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-08T05:59:26Z
- **Completed:** 2026-09-08T06:23:57Z
- **Tasks:** 2
- **Files modified:** 9 production/test files

## Accomplishments

- Routed the required root `CompletionCache` through edge registration and the marketplace-remove handler into the real orchestrator, without an optional port, default owner, global fallback, or invalidation-only substitute.
- Replaced marketplace remove's module-level invalidators with the supplied owner while preserving locked state/config persistence, full/partial classification, names-then-plugin invalidation, and later data/clone cleanup.
- Propagated reconcile's existing lifecycle cache into its real remove child and migrated direct architecture callers to fresh production cache owners.
- Proved public same-owner rebuild, peer and unrelated-target isolation, exact full/partial invalidation paths, no-effect/pre-commit/rollback inertness, and committed state/tree/notification stability under either cache hygiene failure.
- Preserved scope resolution, containment, cascade continuation, write-back, source clone policy, errors, warnings, outcomes, notifications, the two composition exceptions, and all deferred Phase 6 boundaries.

## Task Commits

1. **Task 1 RED: Add failing registered-remove cache proof** - `51e6f964` (test)
2. **Task 1 GREEN: Route marketplace remove through lifecycle cache** - `2420c05b` (feat)
3. **Task 2 evidence: Lock durable invalidation order and isolation** - `dbb40a02` (test)
4. **Task 2 refactor: Apply scoped Prettier output** - `4acb2370` (style)

## Files Created/Modified

Production ownership and propagation:

- `extensions/pi-claude-marketplace/edge/register.ts` supplies the same required cache to remove that it already supplies to add and completions.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` accepts the exact `completionCache` port and forwards it unchanged.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` requires CompletionCache and performs post-commit names invalidation followed by target plugin-index drop before data and clone cleanup.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` passes apply's existing lifecycle cache to its real remove child.

Owner and direct-caller evidence:

- `tests/edge/register.test.ts` proves a real registered remove refreshes the next public completion only on the registration's supplied owner while preserving peer and unrelated cache rows.
- `tests/edge/handlers/marketplace/remove.test.ts` supplies fresh production owners without changing parsing, filesystem, state, or notification assertions.
- `tests/orchestrators/marketplace/remove.test.ts` proves durable order, full/partial eligibility, exact paths, ineligible arms, rollback inertness, cleanup progression, and result/tree/notification stability.
- `tests/architecture/config-state-consistency.test.ts` shares one production cache across its intentional add/remove round trip.
- `tests/architecture/cross-op-convergence.test.ts` supplies a fresh production cache for each isolated remove convergence invocation.

## Decisions Made

- `CompletionCache` is required at every actual remove consumer. It does not enter an optional/default seam, and no handler or orchestrator creates a fallback owner.
- Marketplace remove retains its existing single swallowed cache-hygiene block. A names failure prevents the later plugin drop; a plugin failure occurs after names invalidation. Either failure leaves the already-committed result intact and does not prevent subsequent data/clone hygiene.
- Reconcile reuses its existing cache owner. `HooksRuntime` remains root-owned and outside `EdgeDeps`; this plan adds no runtime or broad dependency bundle.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 3 - Required caller propagation] Propagated CompletionCache beyond the six-file frontmatter list**

- **Found during:** Task 1 implementation and caller census
- **Issue:** Making `RemoveMarketplaceOptions.completionCache` honest and required exposed reconcile's real remove child plus direct architecture callers. Leaving them unchanged would rely on an undefined cache hidden by the swallowed hygiene catch.
- **Fix:** Passed reconcile's already-required lifecycle cache into remove; shared a production cache across the intentional architecture add/remove round trip; and supplied a fresh production cache to each isolated cross-operation convergence call.
- **Authorization:** Root explicitly authorized the production and architecture caller propagation and the frontmatter/read-only contradiction.
- **Commit:** `2420c05b`

**2. [Rule 3 - TDD prerequisite overlap] Used Task 1's required invalidator replacement as Task 2's prerequisite**

- **Found during:** Task 2 RED planning
- **Issue:** Task 1's public same-owner freshness could not turn green until marketplace remove used the supplied cache operations. Task 2's production change therefore already existed before its owner evidence was added.
- **Fix:** Added one atomic owner-evidence commit for durable order, full/partial/ineligible behavior, target and peer isolation, rollback inertness, and swallowed cache failure progression without reverting correct code or manufacturing a regression.
- **Authorization:** Root explicitly approved the prerequisite-overlap exception.
- **Commit:** `dbb40a02`

**3. [Rule 3 - Verification environment] Re-ran subprocess and socket gates outside sandbox restrictions**

- **Found during:** Direct-coverage negative controls and full unit execution
- **Issue:** The sandbox returned `EPERM` for deliberate nested Node processes and a Unix-domain socket fixture, producing file-level failures unrelated to product behavior.
- **Fix:** Re-ran the identical direct-coverage negative and full unit gates with contained subprocess/socket permission. Both passed.

**4. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 4 contained corrections or environment exceptions.
**Impact on plan:** The required one-owner remove contract is fully implemented and tested. No transaction, public behavior, lifecycle, suppression, or deferred boundary was weakened.

## TDD Gate Compliance

- Task 1 RED commit `51e6f964` failed on the intended same-registration completion assertion: the owner cache returned `owner-stale@registered-remove` instead of rebuilding `fresh@registered-remove` after the public remove. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `2420c05b` routed the required cache through registration, the exact handler boundary, the remove orchestrator, reconcile, and required direct callers. The tracer suites, direct coverage, typecheck, and focused ESLint passed before expansion.
- Task 2 used the prerequisite-overlap exception above. Commit `dbb40a02` added exact production-owner evidence without creating an invalid RED; commit `4acb2370` applied the repository formatter to one assertion without changing behavior.
- No further refactor was necessary. Google TypeScript style, unit-test structure, public behavior, and direct coverage remained green after formatting.

## Gate Results

- Exact Task 1 and Task 2 suites, including remove, registration, handler, completion, reconcile, transaction-lifecycle, and both direct architecture callers, passed with zero failures.
- Direct coverage passed at 100% for `edge/register.ts`, `edge/handlers/marketplace/remove.ts`, and `orchestrators/marketplace/remove.ts`.
- TypeScript typecheck, focused and repository-wide ESLint, Fallow, and corresponding-test gates passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains the exact required suppression comment.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed outside the sandbox: 5,450 tests, zero failures/skips/todos.
- Full integration suite passed outside the sandbox: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. The owned files pass Prettier, and every subsequent gate ran independently and passed.

## Known Stubs

None. The added empty arrays are test-owned event and notification collectors, not production placeholders. No TODO/FIXME marker, skipped test, or unwired cache path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-21 can apply the same required CompletionCache ownership to marketplace update. Phase 6 and terminal compatibility/reset cleanup remain deferred.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task/style commits exist on the authorized feature branch.
- All nine modified production/test files exist and no tracked file was deleted.
- `.mcp.json` and the required Fallow suppression comment remain byte-exact; root-owned planning state and configuration were not changed by this plan.
