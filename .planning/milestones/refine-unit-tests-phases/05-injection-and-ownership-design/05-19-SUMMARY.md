---
phase: 05-injection-and-ownership-design
plan: 19
subsystem: extension-lifecycle-ownership
tags: [completion-cache, marketplace-add, edge-registration, post-commit-hygiene, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned CompletionCache and exact lifecycle composition from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: owner-bound plugin lifecycle operations through Plan 05-18
provides:
  - registered marketplace add bound to the same required CompletionCache as public completions
  - durable-success names-then-plugin cache invalidation on the owning cache
  - exact no-effect, rollback, hygiene-failure, rebuild, and peer-isolation evidence
affects: [05-20, 05-21, marketplace-remove, marketplace-update, completion-lifecycle]

actuals:
  tokens: 18088
  tasks: 2
  commits: 4
plan_head_before: d727e0b07449a9edbd66335a702401ee3e033411

tech-stack:
  added: []
  patterns:
    - lifecycle owners pass one required CompletionCache through exact consumer boundaries
    - durable marketplace mutation precedes names-file and plugin-index hygiene
    - direct tests use fresh production cache owners and share one only across intentional lifecycle spans

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - tests/edge/register.test.ts
    - tests/orchestrators/marketplace/add.test.ts

key-decisions:
  - "Keep HooksRuntime outside EdgeDeps; marketplace add receives only the required lifecycle CompletionCache used by its real consumer."
  - "Propagate CompletionCache through add, bootstrap, reconcile, and import instead of constructing any fallback owner mid-lifecycle."
  - "Preserve the existing single swallowed post-commit hygiene sequence: names invalidation first, then plugin-index drop when names invalidation succeeds."

patterns-established:
  - "Add cache owner: one root CompletionCache crosses registration, the exact handler port, and every real-child add composition."
  - "Add freshness boundary: only a durable successful add may invalidate completion data; failed, rolled-back, and duplicate operations remain cache-inert."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered marketplace add forwards the root CompletionCache and rebuilds the next public completion through that same owner while a peer remains isolated."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered add"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts and edge/handlers/marketplace/add.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Durable add invalidates scoped names before the target plugin index; pre-commit, duplicate, and rollback paths do not invalidate."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#invalidates names before the plugin index only after the add is durable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#does not invalidate a duplicate no-effect add through the same cache owner"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/marketplace/add.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each post-commit cache hygiene failure remains swallowed while committed state, configuration, source tree, result, and notification stay exact."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#swallows each cache hygiene failure without rewriting the durable add"
        status: pass
      - kind: integration
        ref: "tests/integration/marketplace-add-seed-mirrors.test.ts"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 19: Lifecycle-Owned Marketplace Add Cache Summary

**Marketplace add now uses the root completion-cache owner end to end and refreshes names then plugin rows only after its durable transaction succeeds.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-08T05:13:24Z
- **Completed:** 2026-09-08T05:55:10Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments

- Routed the required root `CompletionCache` through edge registration and the marketplace-add handler into the real orchestrator, without an optional port, default owner, global fallback, or invalidation-only substitute.
- Propagated the same lifecycle cache through every real add child used by bootstrap, reconcile, and import so nested operations cannot create a second lifetime.
- Replaced marketplace add's module-level invalidators with the supplied owner while preserving the existing post-commit names-then-plugin order and swallowed hygiene policy.
- Proved public same-owner rebuild and peer isolation, exact invalidation targets/order, durable eligibility, duplicate/pre-commit/rollback inertness, unrelated-file preservation, and committed-byte/tree/notification stability under either hygiene failure.
- Preserved source classification, validation, containment, clone and configuration behavior, result/error/warning/notification shapes, bootstrap composition, HooksRuntime ownership, and the deferred Phase 6 boundaries.

## Task Commits

1. **Task 1 RED: Add failing registered-add cache proof** - `d232d442` (test)
2. **Task 1 GREEN: Route marketplace add through the lifecycle cache** - `a28770b0` (feat)
3. **Task 2 evidence: Prove add cache invalidation contract** - `98f9eea8` (test)
4. **Gate correction: Restore exact TypeScript proof placement** - `3ef934c6` (fix)

## Files Created/Modified

Production ownership and propagation:

- `extensions/pi-claude-marketplace/index.ts` passes its one root CompletionCache into reconcile as well as registration.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` requires the exact `completionCache` and `gitOps` members and forwards the cache unchanged.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` requires CompletionCache and performs post-commit names invalidation followed by target plugin-index drop on that owner.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` and `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` propagate the existing lifecycle cache into bootstrap's real add child.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` and `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` propagate the existing import lifecycle cache into every real add.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` and `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` require and forward the existing apply lifecycle cache.

Owner and direct-caller evidence:

- `tests/edge/register.test.ts` proves a real registered add refreshes the next public completion only on the registration's supplied owner.
- `tests/edge/handlers/marketplace/add.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`, and `tests/edge/handlers/plugin/import.test.ts` prove exact required forwarding at the handler boundaries.
- `tests/orchestrators/marketplace/add.test.ts` proves durable order, exact paths, no-effect/failure/rollback inertness, and swallowed post-commit failure behavior.
- `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/import/execute.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/reconcile/backfill.test.ts`, and `tests/orchestrators/reconcile/types.test.ts` preserve the real child flows with production cache owners.
- `tests/architecture/config-state-consistency.test.ts`, `tests/integration/fold-adoption.test.ts`, `tests/integration/hooks-cross-scope-reconcile.test.ts`, `tests/integration/load-reconcile-race-child.ts`, `tests/integration/marketplace-add-seed-mirrors.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, and `tests/orchestrators/plugin/install.test.ts` mechanically supply fresh production caches at direct composition roots. Existing assertions and lifecycle behavior remain unchanged.

## Decisions Made

- `CompletionCache` stays lifecycle-owned and required at every actual add consumer. It does not enter a generic optional dependencies bag, and no handler or orchestrator constructs a fallback owner.
- `HooksRuntime` remains root-owned and outside `EdgeDeps`, consistent with Plan 05-12. This plan routes only the already-defined CompletionCache capability.
- Marketplace add retains its existing single swallowed cache-hygiene block. A names failure stops the later plugin drop; a plugin failure occurs after names invalidation. Both leave the already-committed primary result intact.
- Orchestrated flows reuse the cache already carried by apply/import options. Bootstrap receives the root cache once and forwards it into its real add child.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 3 - Required caller propagation] Propagated CompletionCache beyond the six-file frontmatter list**

- **Found during:** Task 1 implementation and typecheck
- **Issue:** Making `AddMarketplaceOptions.completionCache` honest and required exposed real add callers in bootstrap, reconcile, and import. Leaving them unchanged required a forbidden optional/default owner and would split cache identity.
- **Fix:** Added the existing lifecycle cache to direct add, bootstrap, reconcile, and import composition paths; narrowed handlers to exact required members; and mechanically supplied fresh production caches in their direct tests.
- **Authorization:** Root explicitly authorized this contained propagation and the frontmatter/read-only contradiction.
- **Commit:** `a28770b0`

**2. [Rule 3 - TDD prerequisite overlap] Used Task 1's required production propagation as Task 2's prerequisite**

- **Found during:** Task 2 RED planning
- **Issue:** Task 1 could not reach green without replacing module-level invalidators on the required cache and propagating that cache through real callers. Task 2's production change therefore already existed before its owner tests were added.
- **Fix:** Added one atomic evidence commit for durable order, no-effect/failure/rollback behavior, peer isolation, and swallowed hygiene without reverting correct code or manufacturing a regression.
- **Authorization:** Root explicitly approved the prerequisite-overlap exception.
- **Commit:** `98f9eea8`

**3. [Rule 3 - Compile gate] Kept type-only owner proofs aligned with their diagnostics**

- **Found during:** Repository-wide typecheck
- **Issue:** The required CompletionCache property made an existing reconcile negative type proof report its missing-context error at the closing `satisfies` expression, leaving the preceding `@ts-expect-error` unused. The new durable config assertion also needed to respect the schema's optional marketplace map.
- **Fix:** Moved the existing directive onto its exact diagnostic and used optional indexed access in the test-only durable observation. No assertion contract or production behavior changed.
- **Commit:** `3ef934c6`

**4. [Rule 3 - Verification environment] Re-ran subprocess gates outside sandbox restrictions**

- **Found during:** Direct-coverage negative control and test execution
- **Issue:** The sandbox returns `EPERM` for deliberate nested Node processes and Unix-domain socket fixtures, producing empty process output rather than testing the intended behavior.
- **Fix:** Re-ran the identical gates with contained subprocess/socket permission. All passed.

**5. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 5 contained corrections or environment exceptions.
**Impact on plan:** The required one-owner contract is fully implemented and tested. No lifecycle, transaction, public behavior, suppression, or deferred boundary was weakened.

## TDD Gate Compliance

- Task 1 RED commit `d232d442` failed on the intended same-registration completion assertion: the owner cache returned the seeded stale row instead of the marketplace added through the public handler. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `a28770b0` routed the required cache through registration, the exact handler boundary, the add orchestrator, and every required real-child caller. The tracer suites, direct coverage, typecheck, and focused lint passed before expansion.
- Task 2 used the prerequisite-overlap exception above. Commit `98f9eea8` added production-owner evidence without creating an invalid RED; commit `3ef934c6` corrected type-only diagnostic placement discovered by the repository-wide gate.
- No refactor commit was necessary. Formatting, Google TypeScript style, unit-test structure, and public behavior remained green.

## Gate Results

- Exact Task 2 suites passed: 192 tests, zero failures/skips/todos.
- Direct coverage passed at 100% for `edge/register.ts`, `edge/handlers/marketplace/add.ts`, and `orchestrators/marketplace/add.ts`.
- TypeScript typecheck, focused and repository-wide ESLint, and corresponding-test gates passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains the exact required suppression comment.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed: 5,445 tests, zero failures/skips/todos.
- Full integration suite passed: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. All subsequent gates ran independently and passed.

## Known Stubs

None. No production placeholder, TODO/FIXME marker, skipped test, or unwired cache path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plans 05-20 and 05-21 can apply the same required CompletionCache ownership to marketplace remove and update. Phase 6 and terminal compatibility/reset cleanup remain deferred.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task/fix commits exist on the authorized feature branch.
- All 26 modified production/test files exist and no tracked file was deleted.
- `.mcp.json` and the required Fallow suppression comment remain byte-exact; root-owned planning state and configuration were not changed by this plan.
