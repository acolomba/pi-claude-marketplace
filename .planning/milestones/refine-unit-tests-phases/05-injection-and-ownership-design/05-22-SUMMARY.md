---
phase: 05-injection-and-ownership-design
plan: 22
subsystem: extension-lifecycle-ownership
tags: [completion-cache, plugin-install, edge-registration, transaction-order, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned CompletionCache and exact lifecycle composition from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound HooksRouting and registered operation ownership from Plan 05-13
  - phase: 05-injection-and-ownership-design
    provides: required lifecycle CompletionCache propagation through marketplace operations from Plans 05-19 through 05-21
provides:
  - registered, imported, and reconciled plugin install bound to the lifecycle CompletionCache and HooksRouting owners
  - exact post-save target plugin-index invalidation through the same cache read by public completions
  - durable-success, abort, rollback, save-race, cascade-failure, warning-mode, and peer-isolation evidence
affects: [05-23, plugin-install, completion-lifecycle, reconcile, import]

actuals:
  tokens: 29197
  tasks: 2
  commits: 4
plan_head_before: 54de616f56e2984c8c80294fe1e12f56024e7aab

tech-stack:
  added: []
  patterns:
    - lifecycle composition binds one required CompletionCache beside the exact HooksRouting and InstallTransaction capabilities
    - only durable install success enters post-commit cache hygiene and drops the exact scope/marketplace plugin index
    - direct tests create fresh production owners and share them only across intentional lifecycle sequences

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "Require CompletionCache at plugin install's actual edge, import, reconcile, and factory consumers; remove the runtime-free install entrypoint instead of hiding ownership behind a fallback."
  - "Keep cache invalidation in the existing post-commit warning collector so durable state, route finalization, rollback, and cascade-failure eligibility remain exact."
  - "Exercise routing fault behavior through each case-owned production HooksRouting rather than the removed transition-global state."

patterns-established:
  - "Install owner bundle: required HooksRouting plus CompletionCache are bound once and passed beside the unchanged semantic InstallTransaction."
  - "Install freshness boundary: a durable successful ledger drops only its scope/marketplace plugin index; all non-success arms remain cache-inert."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered install uses the same lifecycle CompletionCache as public completion reads and rebuilds only the owning target after success."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered install"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts and edge/handlers/plugin/install.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only durable install success drops the exact target after state save; rejection, abort, rollback, save-race, and cascade failure do not drop cache eligibility."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#D-03-INV :: install invalidates plugin cache for the target marketplace"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PI-3, ATTR-01, Rollback-skills-undo, D-102-02, and state commit race cache-drop assertions"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/plugin/install.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Completion-cache failure leaves committed state, routes, trees, results, and notifications exact: silent standalone and an exact warning when orchestrated."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#install keeps a completion-cache maintenance failure silent in standalone mode"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#retry proof: install: completion-cache maintenance failure stays installed and retry is idempotent"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 22: Lifecycle-Owned Plugin Install Cache Summary

**Plugin install now shares the root completion-cache owner with public completion reads and invalidates only its exact target after durable success.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-08T06:59:00Z
- **Completed:** 2026-09-08T07:34:00Z
- **Tasks:** 2
- **Files modified:** 15 production/test files

## Accomplishments

- Bound production install factories to required `HooksRouting` and `CompletionCache` owners while preserving the semantic `InstallTransaction` port and removing the runtime-free compatibility entrypoint.
- Routed the lifecycle cache through registered install, import, and reconcile paths without optional, default, global, handler-local, or second cache ownership.
- Kept target invalidation in the existing post-commit warning collector after durable save and before unchanged notification/result projection.
- Proved exact same-owner completion rebuild, peer and unrelated isolation, success ordering, non-success eligibility, and standalone/orchestrated cache-failure behavior.
- Preserved parsing flags, state/configuration/tree bytes, route behavior, rollback partials, cleanup, rows, warnings, and notifications across the full owner and integration suites.

## Task Commits

1. **Task 1 RED: Add failing registered-install cache proof** - `b3ecd0e2` (test)
2. **Task 1 GREEN: Bind install to lifecycle routing and completion owners** - `21e48aaa` (refactor)
3. **Task 2 evidence: Prove install invalidation eligibility and warning behavior** - `ef6a2e49` (test)
4. **Task 2 coverage correction: Route fault proofs through owned runtime** - `b8a6c03e` (test)

## Files Created/Modified

Production ownership and propagation:

- `extensions/pi-claude-marketplace/edge/register.ts` forwards the registration's lifecycle cache to install.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` requires the cache beside the existing routing capability and binds the production install operation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` requires both owners, removes the runtime-free entrypoint, and performs exact post-commit invalidation through the supplied cache.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` passes the import lifecycle cache into its real install child.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` passes apply's existing lifecycle cache into its real install child.

Owner and direct-caller evidence:

- `tests/edge/register.test.ts` proves public installed/uninstalled completion freshness through one registration while peer and unrelated cache rows remain isolated.
- `tests/edge/handlers/plugin/install.test.ts` supplies a fresh production cache owner without changing handler parsing or result assertions.
- `tests/orchestrators/plugin/install.test.ts` uses case-owned routing/cache bundles and proves durable order, exact drops, failure inertness, warning modes, routes, trees, state, and retry behavior.
- `tests/architecture/config-state-consistency.test.ts` and `tests/architecture/cross-op-convergence.test.ts` bind direct install calls to fresh production owners.
- `tests/integration/concurrent-install-child.ts`, `tests/integration/fold-adoption.test.ts`, and `tests/integration/transaction-lifecycle-cascade.test.ts` preserve real multi-process and lifecycle flows with exact owners.
- `tests/orchestrators/plugin/reinstall.test.ts` and `tests/orchestrators/plugin/update.test.ts` bind their direct install setup calls to production owners without assertion changes.

## Decisions Made

- `CompletionCache` is required at every actual install consumer. It is not part of `EdgeDeps` beyond the existing cache owner, is not part of the transaction port, and is never selected through an optional/default/global path.
- The runtime-free `installPlugin` export was removed at this handoff. `createInstallPlugin` and `createNodeInstallPlugin` now require the exact routing/cache owners while preserving every install option.
- Completion invalidation remains hygiene after durable success. Failure is swallowed for standalone calls and projected only through the existing orchestrated post-commit warning channel.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 3 - Required caller propagation] Migrated production and direct-test callers beyond the six-file frontmatter list**

- **Found during:** Task 1 caller census and typecheck
- **Issue:** Making install's CompletionCache honest and required exposed real import/reconcile children and direct test callers that still used the runtime-free entrypoint. The plan simultaneously described these integration suites as read-only and required the compatibility entrypoint to disappear.
- **Fix:** Passed each production lifecycle's existing cache into import/reconcile install children and mechanically bound direct callers to fresh production routing/cache owners, shared only for intentional multi-call lifecycles. Assertions were unchanged.
- **Authorization:** Root explicitly authorized this contained handoff and the frontmatter/read-only contradiction.
- **Files:** `orchestrators/import/execute.ts`, `orchestrators/reconcile/apply.ts`, and seven direct-caller test files listed above.
- **Commit:** `21e48aaa`

**2. [TDD prerequisite overlap] Task 1 necessarily implemented Task 2's supplied-cache drop**

- **Found during:** Task 1 GREEN
- **Issue:** The registered same-owner completion tracer could not pass while install still invalidated the transition-global cache. The Task 2 production change was therefore a prerequisite of Task 1's public behavior.
- **Fix:** Replaced the global drop in the Task 1 GREEN commit, retained the exact post-commit position, and did not manufacture a false Task 2 regression. Task 2 added focused success/failure/warning evidence atomically.
- **Authorization:** Root explicitly confirmed the prerequisite overlap and evidence-only Task 2 cycle.
- **Commits:** `21e48aaa`, `ef6a2e49`

**3. [Rule 3 - Blocking direct coverage] Migrated two fault proofs from transition-global routing state**

- **Found during:** Task 2 direct-coverage gate
- **Issue:** Two existing fault tests poisoned transition-global routing state. After install became owner-bound, those poisons no longer reached the tested operation, leaving the two defensive routing catches uncovered.
- **Fix:** Exposed the case-owned production `HooksRouting` in the local test owner and injected the same faults through that exact owner. Behavior and assertions stayed unchanged; install direct coverage returned to 100%.
- **Commit:** `b8a6c03e`

**4. [Rule 3 - Verification environment] Re-ran subprocess and socket gates outside sandbox restrictions**

- **Found during:** Direct-coverage negative controls and full unit execution
- **Issue:** The workspace sandbox prevented deliberate child Node processes, producing empty negative-control stderr rather than the expected assertion surface.
- **Fix:** Re-ran the identical direct-coverage negative, full unit, and integration gates with contained subprocess/socket permission. All passed.

**5. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 5 contained architecture, TDD-order, coverage, or environment corrections.
**Impact on plan:** The required single-owner install contract is complete without changing public behavior, transaction semantics, suppression state, or deferred Phase 6 boundaries.

## TDD Gate Compliance

- Task 1 RED commit `b3ecd0e2` failed on the intended registered completion assertion: the public install changed durable state but invalidated a transition cache, so the registration owner's next uninstall candidates remained empty. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `21e48aaa` routed the required lifecycle cache and routing owner through registration and every necessary real caller. The exact tracer gate, typecheck, focused ESLint, and 100% register/handler direct coverage passed.
- Task 2 production was already required by Task 1's public tracer. With root authorization, no artificial regression was introduced. Evidence commit `ef6a2e49` proved durable-save ordering, exact target isolation, rejection/abort/rollback/save-race/cascade inertness, and both cache-failure warning modes.
- Coverage correction commit `b8a6c03e` migrated legacy transition-global fault setup to the same case-owned production routing capability and restored 100% install direct coverage.
- No production refactor followed the evidence commits. Google TypeScript style, unit-test structure, hermeticity, and public behavior remained green.

## Gate Results

- Exact Task 1 and Task 2 suites passed with zero failures, including registration, handler, install owner, completion data/cache, reconcile apply, and transaction-lifecycle integration.
- Direct coverage passed at 100% for `edge/register.ts`, `edge/handlers/plugin/install.ts`, and `orchestrators/plugin/install.ts`.
- TypeScript typecheck, focused and repository-wide ESLint, corresponding-test gates, and Fallow passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains the exact required suppression comment.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed with subprocess permission: 5,454 tests across 300 suites, zero failures/skips/todos.
- Full integration suite passed with subprocess/socket permission: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. Every changed file passes Prettier, and every subsequent gate ran independently and passed.

## Known Stubs

None. No TODO/FIXME marker, skipped test, hard-coded production placeholder, or unwired ownership path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-23 can continue the same required lifecycle CompletionCache pattern for the next plugin invalidator. Install remains cohesive for the planned Phase 6 split, and reset-surface cleanup remains deferred.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task commits exist on the authorized feature branch.
- All 15 modified production/test files exist and no tracked file was deleted.
- `.mcp.json` and the required Fallow suppression comment remain byte-exact; root-owned tracking and configuration files were not changed by this plan.
