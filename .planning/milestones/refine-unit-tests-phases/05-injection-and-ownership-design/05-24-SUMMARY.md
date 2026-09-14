---
phase: 05-injection-and-ownership-design
plan: 24
subsystem: extension-lifecycle-ownership
tags: [completion-cache, plugin-reinstall, hooks-routing, reconcile-backfill, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound reinstall operations from Plan 05-18
  - phase: 05-injection-and-ownership-design
    provides: lifecycle-owned plugin update cache from Plan 05-23
provides:
  - required lifecycle CompletionCache propagation through direct, bulk, and reconcile-backfill reinstall
  - removal of the optional reinstall cache-drop selector, type, member, and selection logic after a zero-caller census
  - same-owner completion rebuild and peer/unrelated cache-isolation evidence at the durable reinstall boundary
affects: [05-25, 05-28, plugin-reinstall, completion-lifecycle, reconcile-backfill]

actuals:
  tokens: 9794
  tasks: 2
  commits: 3
plan_head_before: 4b5408c351b32ed0a42e6ed8f612389e700fc095

tech-stack:
  added: []
  patterns:
    - reinstall factories require HooksRouting and CompletionCache together at production composition
    - direct, bulk, and backfill reinstall share the existing lifecycle cache without a child owner
    - only post-success maintenance drops the exact scoped marketplace plugin index

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "Require CompletionCache beside HooksRouting at every reinstall factory; do not retain a cache-drop callback selector, optional member, default owner, or second lifetime."
  - "Pass reconcile apply's existing lifecycle CompletionCache through backfill into real reinstall rather than construct or bundle a child owner."
  - "Keep cache invalidation at the existing post-success maintenance point so transaction ordering, eligibility, warnings, cleanup, and notifications remain unchanged."

patterns-established:
  - "Reinstall ownership boundary: root registration and reconcile backfill supply the same required runtime-bound routing and completion owners to real reinstall."
  - "Reinstall freshness boundary: durable success drops only the exact target; same-owner next reads rebuild while peer and unrelated rows remain untouched."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered direct and bulk reinstall forward the root HooksRouting and CompletionCache into the required transaction path."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered reinstall"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/reinstall.test.ts and tests/orchestrators/plugin/reinstall.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts, edge/handlers/plugin/reinstall.ts, and orchestrators/plugin/reinstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The optional DropMarketplaceCacheFn selector, optional member, and __deps selection path are absent after every genuine caller migrated."
    requirement: TREF-06
    verification:
      - kind: other
        ref: "final production/test census for DropMarketplaceCacheFn, optional dropMarketplaceCache, __deps selector, and cacheDrop selection returned zero matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real reconcile backfill uses apply's existing cache and routing owners; durable targets rebuild through that owner while peer and unrelated cache rows remain unchanged."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#SURF-05 orphan rewake"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/reconcile/backfill.ts"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 24: Lifecycle-Owned Reinstall Cache Summary

**Direct, bulk, and reconcile-backfill reinstall now use one required lifecycle completion-cache owner, with the last optional cache-drop selector removed.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-08T08:06:16Z
- **Completed:** 2026-09-08T08:33:14Z
- **Tasks:** 2
- **Files modified:** 10 production/test files

## Accomplishments

- Recorded a fresh census of the optional reinstall cache-drop type, member, selector, and all production/test callers before editing.
- Required `CompletionCache` beside `HooksRouting` in the direct, bulk, and single reinstall factories, then removed `DropMarketplaceCacheFn`, the optional dependency member, and the `__deps` selection path.
- Passed edge registration's root completion cache into direct and bulk reinstall and passed reconcile apply's existing cache through backfill into real reinstall.
- Preserved prepare-all ordering, replacement and save behavior, rollback and abort handling, post-success finalization, deferred warnings, independent cleanup, routes, rows, results, and notifications.
- Proved a successful registered reinstall and a real backfill reinstall rebuild through their owning cache while peer caches and unrelated completion rows remain unchanged.

## Consumer Census

The pre-edit census found one production selector in `orchestrators/plugin/reinstall.ts`: the `DropMarketplaceCacheFn` alias, optional `ReinstallPluginDeps.dropMarketplaceCache`, and `opts.__deps?.dropMarketplaceCache ?? dropMarketplaceCache` selection. Genuine production callers were edge registration's direct/bulk operation and reconcile backfill's real reinstall. Direct test factories in the reinstall handler, transaction lifecycle, convergence, enable/disable, and reinstall owner suites also needed the required cache argument.

After migration, a repository census for `DropMarketplaceCacheFn`, `dropMarketplaceCache?:`, `__deps?.dropMarketplaceCache`, and the `cacheDrop` selection returned zero matches. Remaining `dropMarketplaceCache` calls are required `CompletionCache` operations or test observations of that required owner, not selectors or fallback authority.

## Task Commits

1. **Task 1 RED: Add failing registered reinstall cache-owner proof** - `cf945c98` (test)
2. **Task 1 GREEN: Bind reinstall to lifecycle completion cache** - `f22df597` (feat)
3. **Task 2 evidence: Prove backfill owner identity and isolation** - `d0b59e36` (test)

## Files Created/Modified

Production ownership:

- `extensions/pi-claude-marketplace/edge/register.ts` passes the root registration cache into the required direct/bulk reinstall factory.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` requires the cache through its factories and transaction, uses it only at existing post-success maintenance, and no longer exports or selects an optional cache-drop seam.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` forwards apply's existing required cache beside its existing routing owner to real reinstall.

Owner and behavior evidence:

- `tests/edge/register.test.ts` proves registered reinstall invalidates and rebuilds through the captured owner while a peer cache remains stale by design.
- `tests/edge/handlers/plugin/reinstall.test.ts` gives each isolated direct handler case a fresh production cache without changing parser or output assertions.
- `tests/orchestrators/plugin/reinstall.test.ts` migrates selector-spy and retry cases to required case-owned caches while retaining exact ordering, failure, rollback, warning, cleanup, and notification assertions.
- `tests/orchestrators/reconcile/backfill.test.ts` proves real backfill uses the same lifecycle owner, rebuilds its durable target, and preserves peer and unrelated rows alongside the complete existing tree/state/route/outcome assertions.
- `tests/integration/transaction-lifecycle-cascade.test.ts` shares its existing lifecycle cache across the intentional multi-operation transaction.
- `tests/architecture/cross-op-convergence.test.ts` and `tests/orchestrators/plugin/enable-disable.test.ts` mechanically bind direct factory callers to fresh production owners with behavior assertions unchanged.

The frontmatter-listed reinstall handler production source did not change: it consumes the already-bound reinstall operation and neither owns nor constructs routing/cache state. Its paired tests and direct coverage were still verified.

## Decisions Made

- `CompletionCache` is a required reinstall-factory dependency beside `HooksRouting`; it is never optional, defaulted, global, or put into an ad hoc child bundle.
- Reconcile backfill receives the cache already owned by apply. Backfill does not construct a cache mid-lifecycle.
- Existing post-success maintenance remains the sole invalidation point. Skipped, failed, rolled-back, aborted, and no-effect targets remain cache-inert.
- Retry tests observe the required case-owned `CompletionCache` rather than retain the removed optional callback selector.

## Deviations from Plan

### Authorized Scope and Execution Corrections

**1. [Rule 3 - Required caller propagation] Migrated direct test callers outside the eight-file frontmatter list**

- **Found during:** Task 1 caller census and typecheck
- **Issue:** Requiring `CompletionCache` at the reinstall factory exposed direct test callers in convergence, enable/disable, and transaction-lifecycle suites beyond the declared file list.
- **Fix:** Bound isolated callers to fresh production caches and reused an existing lifecycle cache only where a test intentionally spans operations. Assertions and production behavior were unchanged.
- **Authorization:** Root explicitly authorized the contained direct-caller propagation.
- **Files:** `tests/architecture/cross-op-convergence.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, and `tests/integration/transaction-lifecycle-cascade.test.ts`.
- **Commit:** `f22df597`

**2. [TDD prerequisite overlap] Task 1 necessarily propagated the required cache through backfill**

- **Found during:** Task 1 GREEN caller migration
- **Issue:** Removing the optional selector at zero callers required every real production caller, including reconcile backfill, to supply the required cache. Leaving backfill on the old signature would not compile and would make the zero-caller claim false.
- **Fix:** Passed backfill's existing lifecycle cache during Task 1 GREEN. With root approval, Task 2 added exact real-backfill rebuild and isolation evidence without manufacturing a false regression.
- **Commits:** `f22df597`, `d0b59e36`

**3. [Rule 3 - Test observation migration] Replaced retry selector spies with required cache owners**

- **Found during:** Task 1 selector census
- **Issue:** Retry tests observed maintenance order through the optional callback that the plan required deleting.
- **Fix:** Each case now owns a production `CompletionCache` whose exact drop method records the same schedule. Intentional retry sequences share that one case owner; all ordering and outcome assertions remain unchanged.
- **Commit:** `f22df597`

**4. [Plan artifact correction] Kept the handler source unchanged at its honest operation boundary**

- **Found during:** Task 1 composition review
- **Issue:** The frontmatter expected the handler source to change, but it receives an already-bound reinstall capability and has no legitimate reason to accept or construct `HooksRouting` or `CompletionCache`.
- **Fix:** Changed only its direct test owner construction and verified the unchanged production handler at 100% direct coverage. No dead port or child bundle was introduced.

**5. [Rule 3 - Verification environment] Re-ran subprocess gates with required process permissions**

- **Found during:** Direct-coverage negative controls and full unit execution
- **Issue:** The workspace sandbox hid output from deliberate child Node processes, causing the negative-control gate and two unrelated unit workers to fail at the environment boundary.
- **Fix:** Re-ran the identical negative-control command and full unit suite with contained child-process permission. Direct negative controls passed, and all 5,456 unit tests passed.

**6. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`, verified all changed files with Prettier, and ran every later gate independently.

**Total deviations:** 6 contained caller-propagation, TDD-order, test-observation, boundary, environment, or known-workspace corrections.
**Impact on plan:** The required single-owner reinstall contract is complete without a callback selector, second cache lifetime, fallback, child bundle, behavior drift, suppression change, apply modification, Phase 6 split, or excluded cleanup.

## TDD Gate Compliance

- Task 1 RED commit `cf945c98` failed on the intended stale same-owner completion row. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `f22df597` required the root cache, removed the optional selector after caller migration, and made the tracer proof pass. Its exact suites, direct coverage, typecheck, and focused ESLint passed.
- Task 2 production propagation was a prerequisite of Task 1's zero-caller contract. Root authorized the overlap; no artificial regression was introduced. Evidence commit `d0b59e36` proves real backfill same-owner rebuilding plus peer and unrelated isolation while retaining complete existing lifecycle assertions.
- No production refactor followed the evidence commit. Google TypeScript style and the project's test pairing, public-outcome, hermeticity, and test-double rules remain satisfied.

## Gate Results

- Exact Task 1 suites passed: edge registration, reinstall handler, reinstall owner, completion data, and transaction-lifecycle cascade.
- Exact Task 2 suites passed: reinstall owner, reconcile backfill, reconcile apply, completion cache, and transaction-lifecycle cascade.
- Direct coverage passed at 100% for `edge/register.ts` (156/156 lines), `edge/handlers/plugin/reinstall.ts` (104/104 lines), `orchestrators/plugin/reinstall.ts` (1,733/1,733 lines), and `orchestrators/reconcile/backfill.ts` (475/475 lines).
- TypeScript typecheck, focused and repository-wide ESLint, corresponding-test gates, changed-file Prettier, and `git diff --check` passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains exactly `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`, and no suppression was added.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed with required child-process permission: 5,456 tests across 300 suites, zero failures, skips, or todos.
- Full integration suite passed: 13 test files, zero failures, skips, or todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. Every subsequent gate ran independently and passed.

## Known Stubs

None. No TODO/FIXME marker, skipped test, hard-coded production placeholder, or unwired ownership path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-25 can route uninstall through the same lifecycle-owned completion-cache pattern. Reinstall remains in its current Phase 6-ready module with transaction order and public behavior intact.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All three measured task commits exist on the authorized feature branch.
- All 10 modified production/test files exist and no tracked file was deleted.
- The optional selector census is zero; `.mcp.json` and the required Fallow suppression remain byte-exact; root-owned tracking and configuration files were not changed by this plan.
