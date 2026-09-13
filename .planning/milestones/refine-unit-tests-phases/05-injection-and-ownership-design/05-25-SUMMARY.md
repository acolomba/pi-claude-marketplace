---
phase: 05-injection-and-ownership-design
plan: 25
subsystem: extension-lifecycle-ownership
tags: [completion-cache, plugin-uninstall, hooks-routing, reconcile-apply, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound uninstall routing from Plan 05-15
  - phase: 05-injection-and-ownership-design
    provides: required lifecycle completion-cache propagation from Plans 05-19 through 05-24
provides:
  - required lifecycle CompletionCache propagation through registered, direct, and real apply-child uninstall
  - post-commit uninstall cache invalidation through the supplied owner with no runtime-free operation
  - same-owner completion rebuild plus failed, peer, unrelated, routing, and cache-hygiene isolation evidence
affects: [05-26, 05-28, plugin-uninstall, completion-lifecycle, reconcile-apply]

actuals:
  tokens: 16652
  tasks: 2
  commits: 3
plan_head_before: 26ba62f05657bb8c612d42e210928afef51fdedb

tech-stack:
  added: []
  patterns:
    - uninstall factories require HooksRouting and CompletionCache together at production composition
    - registered and reconcile-child uninstall share the existing lifecycle cache without a child owner
    - only a committed uninstall drops the exact scoped marketplace plugin index

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/architecture/cross-op-convergence.test.ts

key-decisions:
  - "Require CompletionCache beside HooksRouting at every uninstall factory; retain no runtime-free uninstall operation, optional/default owner, or global fallback."
  - "Pass reconcile apply's existing lifecycle CompletionCache and HooksRouting into its real uninstall child rather than construct or bundle a child owner."
  - "Keep cache invalidation in the existing post-commit cleanup window so failed, aborted, rolled-back, converged, and pre-commit paths remain cache-inert."

patterns-established:
  - "Uninstall ownership boundary: root registration and reconcile apply supply the same required routing and completion owners to real uninstall."
  - "Uninstall freshness boundary: durable removal drops only the exact target; same-owner next reads rebuild while peer and unrelated rows remain untouched."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered direct uninstall forwards the root HooksRouting and CompletionCache into the required transaction path."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered uninstall"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts and tests/orchestrators/plugin/uninstall.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts, edge/handlers/plugin/uninstall.ts, and orchestrators/plugin/uninstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed uninstall drops only the required lifecycle owner after durable state, while cache failure is silent and later cleanup continues."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts D-03 invalidation and cache-drop retry/failure cases"
        status: pass
      - kind: other
        ref: "final census found no runtime-free uninstall export or module-level cache drop in plugin/uninstall.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real reconcile apply uses its existing cache and routing owners; successful targets rebuild through that owner while failed, peer, unrelated, and sibling observations remain exact."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts WR-06 owner, failure, and cache-cleanup cases"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-cross-scope-reconcile.test.ts and tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/reconcile/apply.ts"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 25: Lifecycle-Owned Uninstall Cache Summary

**Registered, direct, and reconcile-child uninstall now use one required lifecycle completion-cache owner, with cache invalidation restricted to committed removal.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-08T08:36:18Z
- **Completed:** 2026-09-08T09:00:00Z
- **Tasks:** 2
- **Files modified:** 10 production/test files

## Accomplishments

- Required `CompletionCache` beside `HooksRouting` in direct and node uninstall factories and removed the runtime-free transition uninstall export.
- Passed edge registration's root cache into direct uninstall and reconcile apply's existing cache into its real uninstall child.
- Replaced the module-level cache drop with the supplied cache only in the existing post-state-commit cleanup window, preserving state/configuration order and independent data/clone cleanup.
- Proved a successful registered uninstall and real apply-child uninstall rebuild through their owning cache while peer and unrelated completion rows remain unchanged.
- Preserved failed-uninstall cache rows and exact corrupt-state reporting, and proved a cache-file cleanup error stays silent while target cleanup, sibling state, routes, rows, and notification remain exact.

## Consumer Census

The pre-edit census found production uninstall construction in edge registration, the uninstall handler, and reconcile apply. Direct factory consumers also existed in the uninstall owner suite plus transaction-lifecycle and cross-operation architecture controls. The transition export was used only as a runtime-free test entrypoint.

After migration, every `createUninstallPlugin` and `createNodeUninstallPlugin` caller supplies both required owners. `orchestrators/plugin/uninstall.ts` has exactly one cache-drop site, `completionCache.dropMarketplaceCache`, in post-commit cleanup. It no longer imports a module-level drop function and no longer exports a runtime-free `uninstallPlugin` operation.

## Task Commits

1. **Task 1 RED: Add failing registered uninstall cache-owner proof** - `a620c22f` (test)
2. **Task 1 GREEN: Bind uninstall to lifecycle completion cache** - `9054bd21` (feat)
3. **Task 2 evidence: Prove apply uninstall owner identity and isolation** - `77cea693` (test)

## Files Created/Modified

Production ownership:

- `extensions/pi-claude-marketplace/edge/register.ts` passes the root registration cache into the required uninstall handler operation.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` requires both routing and completion owners when binding real uninstall.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` requires the cache through its factories and transaction, invokes it only after durable removal, and no longer exposes a runtime-free operation.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` forwards apply's existing lifecycle cache beside its existing routing owner to the real uninstall child.

Owner and behavior evidence:

- `tests/edge/register.test.ts` proves registered uninstall invalidates and rebuilds through the captured owner while a peer cache stays stale by design.
- `tests/edge/handlers/plugin/uninstall.test.ts` gives each isolated direct handler case a fresh production cache without changing parser or output assertions.
- `tests/orchestrators/plugin/uninstall.test.ts` migrates direct and retry cases to required case-owned production operations while retaining exact eligibility, transaction order, partial failure, cleanup, tree, state, route, result, and notification assertions.
- `tests/orchestrators/reconcile/apply.test.ts` proves real apply-child owner rebuilding, failed-removal cache inertia, peer/unrelated isolation, silent cache-cleanup failure, sibling preservation, exact trees/routes/rows, and second-pass silence.
- `tests/integration/transaction-lifecycle-cascade.test.ts` shares its existing lifecycle cache across the intentional multi-operation transaction.
- `tests/architecture/cross-op-convergence.test.ts` binds its isolated direct uninstall caller to a fresh production owner with all behavior assertions unchanged.

## Decisions Made

- `CompletionCache` is a required uninstall-factory dependency beside `HooksRouting`; it is never optional, defaulted, global, or placed into an ad hoc child bundle.
- Reconcile apply passes the cache and routing owners it already owns. Apply does not replace the real uninstall child or construct an owner mid-lifecycle.
- The existing post-commit cleanup window remains the sole invalidation point. Failed, rolled-back, aborted, converged, and pre-commit paths remain cache-inert.
- Retry tests share one case owner only when they intentionally span attempts; otherwise direct tests use fresh production owners.

## Deviations from Plan

### Authorized Scope and Execution Corrections

**1. [Rule 3 - Required caller propagation] Migrated two direct test consumers outside the eight-file frontmatter list**

- **Found during:** Task 1 caller census and typecheck
- **Issue:** Requiring `CompletionCache` at the uninstall factory exposed direct callers in transaction-lifecycle and cross-operation convergence controls beyond the declared file list.
- **Fix:** Bound isolated callers to fresh production owners and reused the test's existing cache only for the intentional transaction lifecycle. Assertions and production behavior were unchanged.
- **Authorization:** Root explicitly authorized the contained direct-caller propagation.
- **Files:** `tests/integration/transaction-lifecycle-cascade.test.ts` and `tests/architecture/cross-op-convergence.test.ts`.
- **Commit:** `9054bd21`

**2. [TDD prerequisite overlap] Task 1 necessarily propagated the required cache through reconcile apply**

- **Found during:** Task 1 GREEN caller migration
- **Issue:** Removing the runtime-free uninstall entrypoint required every real production caller, including reconcile apply, to supply the required cache. Leaving apply on the old signature would not compile and would retain a second ownership path.
- **Fix:** Passed apply's existing lifecycle cache during Task 1 GREEN. With root approval, Task 2 added exact real-child owner, rebuild, failure, cleanup, and isolation evidence without manufacturing a false regression.
- **Commits:** `9054bd21`, `77cea693`

**3. [Rule 3 - Test observation migration] Replaced transition operation and retry construction with required production owners**

- **Found during:** Task 1 caller census
- **Issue:** The uninstall owner suite imported the runtime-free transition operation and several retry cases constructed an operation without an explicit cache lifetime.
- **Fix:** Isolated one-call cases use fresh production owners; intentional retry sequences share one case-owned routing/cache operation. Existing ordering, state, tree, route, result, and notification assertions remain unchanged.
- **Commit:** `9054bd21`

**4. [Rule 3 - Verification environment] Re-ran filesystem and child-process gates with required permissions**

- **Found during:** Focused owner tests, direct coverage, full unit, and integration verification
- **Issue:** The workspace sandbox hides or blocks deliberate permission faults and child Node processes used by the hermetic suites.
- **Fix:** Re-ran the identical commands with contained process/filesystem permission. All scoped, coverage, full-unit, and integration gates passed.

**5. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`, verified every changed file with Prettier, and ran every later gate independently.

**Total deviations:** 5 contained caller-propagation, TDD-order, test-observation, environment, or known-workspace corrections.
**Impact on plan:** The required single-owner uninstall contract is complete without a second cache lifetime, optional/default/global fallback, child bundle, behavior drift, suppression change, Phase 6 split, or excluded cleanup.

## TDD Gate Compliance

- Task 1 RED commit `a620c22f` failed on the intended stale same-owner completion row. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `9054bd21` required the lifecycle cache, removed the runtime-free operation after caller migration, and made the owner proof pass. Its exact suites, direct coverage, typecheck, and focused ESLint passed.
- Task 2 production propagation was a prerequisite of Task 1's required-owner contract. Root authorized the overlap; no artificial regression was introduced. Evidence commit `77cea693` proves real apply-child same-owner rebuilding, failed-path inertia, peer/unrelated isolation, and silent cleanup failure while retaining complete lifecycle assertions.
- No production refactor followed the evidence commit. Google TypeScript style and the project's test pairing, public-outcome, hermeticity, and test-double rules remain satisfied.

## Gate Results

- Exact Plan 05-25 suites passed: edge registration, uninstall handler, uninstall owner, reconcile apply, completion cache, bootstrap, cross-scope reconcile, and transaction lifecycle.
- Direct coverage passed at 100% for `edge/register.ts` (156/156 lines), `edge/handlers/plugin/uninstall.ts` (47/47 lines), `orchestrators/plugin/uninstall.ts` (881/881 lines), and `orchestrators/reconcile/apply.ts` (954/954 lines).
- TypeScript typecheck, focused and repository-wide ESLint, corresponding-test gates, changed-file Prettier, and `git diff --check` passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains exactly `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`, and no suppression was added.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed: 5,458 tests across 300 suites, zero failures, skips, or todos.
- Full integration suite passed: 32 tests, zero failures, skips, or todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. Every subsequent gate ran independently and passed.

## Known Stubs

None. No TODO/FIXME marker, skipped test, hard-coded production placeholder, or unwired ownership path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-26 can continue the required owner-bound lifecycle pattern. Uninstall remains cohesive and ready for the later Phase 6 split without changing public behavior.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All three measured task commits exist on the authorized feature branch.
- All 10 modified production/test files exist and no tracked file was deleted.
- The runtime-free uninstall census is zero; `.mcp.json` and the required Fallow suppression remain byte-exact; root-owned tracking and configuration files were not changed by this plan.
