---
phase: 05-injection-and-ownership-design
plan: 21
subsystem: extension-lifecycle-ownership
tags: [completion-cache, marketplace-update, edge-registration, cascade-order, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned CompletionCache and exact lifecycle composition from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound PluginUpdateFn and shared HooksRouting owner from Plan 05-17
  - phase: 05-injection-and-ownership-design
    provides: required lifecycle CompletionCache propagation through marketplace add/remove from Plans 05-19 and 05-20
provides:
  - registered named and all-target marketplace update bound to the root CompletionCache beside the unchanged PluginUpdateFn
  - changed-target persistence then scoped plugin-index invalidation then cascade ordering
  - exact no-effect, failure, multi-scope, rebuild, target, and peer-isolation evidence
affects: [05-22, marketplace-update, completion-lifecycle, plugin-update-cascade]

actuals:
  tokens: 14147
  tasks: 2
  commits: 4
plan_head_before: e2570a4d5c9a197ad6b596eae9c20c680044c86d

tech-stack:
  added: []
  patterns:
    - lifecycle owners pass one required CompletionCache beside the exact PluginUpdateFn capability
    - changed durable marketplace persistence precedes target cache invalidation, which precedes plugin cascade
    - direct tests create fresh production cache owners and share one only across intentional lifecycle calls

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Require CompletionCache at marketplace update's actual handler and orchestrator consumers while preserving PluginUpdateFn's exact shared signature."
  - "Invalidate only changed targets after durable persistence and before cascade; no-effect and pre-persistence failure paths remain cache-inert."
  - "Keep cache hygiene failure non-surfacing after commit so public classification, notifications, continuation, and durable state remain exact."

patterns-established:
  - "Update cache owner: one root CompletionCache crosses registration, the exact handler port, and named/all-target orchestrator calls."
  - "Update freshness boundary: a changed persisted manifest drops only its scope/marketplace plugin index before the existing plugin cascade observes state."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered marketplace update forwards the root CompletionCache and rebuilds the next public completion through that owner while peer and unrelated cache rows remain isolated."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered update"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts and edge/handlers/marketplace/update.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changed targets persist, invalidate their exact plugin index, then cascade in project-before-user order; no-effect and failed targets do not invalidate."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#drops a changed target after persistence and before its plugin cascade"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#all-target update drops changed rows in project-before-user order and isolates no-effect and peer rows"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/marketplace/update.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "No-effect, pre-persistence failure, peer-owner, and swallowed cache-hygiene failure cases retain their exact rows, state, classification, and notifications."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#leaves completion rows intact when a marketplace refresh has no effect"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#silently retains a failed changed-target cache cleanup and preserves later no-effect rows"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 21: Lifecycle-Owned Marketplace Update Cache Summary

**Named and all-target marketplace updates now use the root completion-cache owner, invalidating each changed target after persistence and before its unchanged plugin-update cascade.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-08T06:28:48Z
- **Completed:** 2026-09-08T06:52:33Z
- **Tasks:** 2
- **Files modified:** 7 production/test files

## Accomplishments

- Routed the required root `CompletionCache` through edge registration and the marketplace-update handler into both named and all-target orchestrator calls without changing `PluginUpdateFn`.
- Replaced the transition-cache invalidator with the supplied lifecycle owner and restricted invalidation to changed manifests after durable persistence and before cascade.
- Preserved project-before-user and within-scope order, named/all parsing, no-effect and failure eligibility, target classification, durable state, aggregate notifications, and cascade behavior.
- Proved same-owner completion rebuilds for changed targets, retained rows for no-effect and failed targets, exact target/scope drop order, peer-owner isolation, and committed-state stability when cache hygiene fails.
- Preserved both full-observation composition exceptions, `HooksRuntime` ownership outside `EdgeDeps`, Phase 6 boundaries, and the exact existing Fallow suppression.

## Task Commits

1. **Task 1 RED: Add failing registered-update cache proof** - `83a7f1c0` (test)
2. **Task 1 GREEN: Route marketplace update through lifecycle cache** - `5bb82e97` (feat)
3. **Task 2 RED: Add failing no-effect cache eligibility proof** - `a0842d68` (test)
4. **Task 2 GREEN: Limit update cache drops to changed targets** - `46f22630` (feat)

## Files Created/Modified

Production ownership and propagation:

- `extensions/pi-claude-marketplace/edge/register.ts` supplies the same required cache used by completions and the other marketplace lifecycle operations.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` accepts the exact required cache port beside `gitOps` and `pluginUpdate`, and forwards it for both named and all-target calls.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` requires CompletionCache and performs changed-target post-commit invalidation before the existing cascade.

Owner and direct-caller evidence:

- `tests/edge/register.test.ts` proves a real registered update refreshes the next public completion only on the registration's supplied owner while preserving peer and unrelated rows.
- `tests/edge/handlers/marketplace/update.test.ts` supplies fresh production owners without changing parsing, scope, state, filesystem, or notification assertions.
- `tests/orchestrators/marketplace/update.test.ts` proves durable order, changed-only eligibility, exact multi-scope ordering, no-effect/failure inertness, same-owner rebuild, peer isolation, and non-surfacing hygiene failure behavior.
- `tests/architecture/cross-op-convergence.test.ts` supplies its existing lifecycle CompletionCache to the direct marketplace-update call.

## Decisions Made

- `CompletionCache` is required at every actual marketplace-update consumer. The cache travels beside the unchanged `PluginUpdateFn`; no handler or orchestrator constructs an optional, default, global, or second owner.
- A marketplace target invalidates its plugin index only when its manifest changed and durable persistence succeeded. The exact scoped drop completes before that target's plugin cascade.
- Cache-drop failure remains deliberately non-surfacing after the durable commit. It does not change state, target classification, later target processing, rows, warnings, or notifications.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 3 - Required caller propagation] Migrated one direct architecture caller beyond the six-file frontmatter list**

- **Found during:** Task 1 implementation and caller census
- **Issue:** Making `UpdateMarketplaceOptions.completionCache` honest and required exposed the direct update call in `cross-op-convergence.test.ts`. Leaving it unchanged would not compile and would hide the real lifecycle owner.
- **Fix:** Passed that architecture case's existing lifecycle CompletionCache into `updateMarketplace`, preserving every assertion and constructing no owner mid-lifecycle.
- **Authorization:** Root explicitly authorized this contained caller propagation and the frontmatter contradiction.
- **Commit:** `5bb82e97`

**2. [Rule 3 - Blocking unreachable branch] Removed the update handler's structurally unreachable usage-string comparison**

- **Found during:** Task 1 direct-coverage verification
- **Issue:** The handler's sole positional argument is optional, so its parser failure callback can receive tokenizer diagnostics but cannot receive the usage string. The stale ternary created one unreachable branch and held required direct coverage below 100%.
- **Fix:** Forwarded the only reachable diagnostic directly and updated only the paired test commentary. Reachable output bytes and negative parsing assertions remain unchanged.
- **Authorization:** Root explicitly authorized this Rule 3 correction with no suppression.
- **Commit:** `5bb82e97`

**3. [Rule 3 - Verification environment] Re-ran subprocess and socket gates outside sandbox restrictions**

- **Found during:** Direct-coverage negative controls and full unit execution
- **Issue:** The sandbox prevents deliberate nested Node processes and local socket fixtures from exercising their normal paths.
- **Fix:** Re-ran the identical direct-coverage negative, full unit, and integration gates with contained subprocess/socket permission. All passed.

**4. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 4 contained corrections or environment exceptions.
**Impact on plan:** The required one-owner update contract is fully implemented and tested. No public behavior, callback signature, target order, lifecycle ownership, suppression, or deferred boundary was weakened.

## TDD Gate Compliance

- Task 1 RED commit `83a7f1c0` failed on the intended registered same-owner completion assertion: the owner returned `owner-stale@registered-update` instead of rebuilding `fresh@registered-update`. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `5bb82e97` routed the required lifecycle cache through registration, the exact handler boundary, named/all orchestration, and the necessary direct caller. The tracer suites, 100% register/handler direct coverage, typecheck, and focused ESLint passed before expansion.
- Task 2 RED commit `a0842d68` failed on the intended changed-only eligibility assertion: a no-effect refresh dropped the warmed `still-current` row and rebuilt an empty set. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 2 GREEN commit `46f22630` gated invalidation on the persisted snapshot's changed status and added exact owner evidence for order, multi-target eligibility, peer isolation, and swallowed hygiene failure behavior.
- No separate refactor commit was necessary. Google TypeScript style, unit-test structure, public behavior, and direct coverage remained green after the GREEN commits.

## Gate Results

- Exact Task 1 and Task 2 suites, including registration, handler, marketplace update, plugin update, completion cache, completion data, and transaction-lifecycle integration, passed with zero failures.
- Direct coverage passed at 100% for `edge/register.ts`, `edge/handlers/marketplace/update.ts`, and `orchestrators/marketplace/update.ts`.
- TypeScript typecheck, focused and repository-wide ESLint, Fallow, and corresponding-test gates passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains the exact required suppression comment.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed outside the sandbox: 5,452 tests across 300 suites, zero failures/skips/todos.
- Full integration suite passed outside the sandbox: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. Every owned file passes Prettier, and every subsequent gate ran independently and passed.

## Known Stubs

None. The added empty notification array is a test-owned event collector, not a production placeholder. No TODO/FIXME marker, skipped test, or unwired cache path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-22 can continue the same required CompletionCache ownership across the next marketplace invalidator. Phase 6 and terminal compatibility/reset cleanup remain deferred.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task commits exist on the authorized feature branch.
- All seven modified production/test files exist and no tracked file was deleted.
- `.mcp.json` and the required Fallow suppression comment remain byte-exact; root-owned planning state and configuration were not changed by this plan.
