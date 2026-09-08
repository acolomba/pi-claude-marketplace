---
phase: 05-injection-and-ownership-design
plan: 27
subsystem: extension-lifecycle-ownership
tags: [bootstrap, reconcile, hooks-runtime, completion-cache, composition-census, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache graph from Plans 05-12 through 05-26
  - phase: 05-injection-and-ownership-design
    provides: required cache/runtime mutation boundaries from Plans 05-19 through 05-25
provides:
  - real registered bootstrap evidence across marketplace add then autoupdate on one lifecycle cache
  - full applyReconcile real-child evidence with its independently selected state reader
  - a production-and-test census that fails unless exactly two behavioral-composition exceptions remain
affects: [05-28, 05-29, 05-30, 05-31, 05-33, lifecycle-ownership, composition-testing]

actuals:
  tokens: 6380
  tasks: 2
  commits: 2
plan_head_before: ccd9fdd0757f4c92dc0dd287d75276af4f3d29fe

tech-stack:
  added: []
  patterns:
    - production-internal composition markers are behavior-neutral and audited by the owner suite
    - behavioral-composition tests use real children and assert public state, files, caches, routes, and notifications
    - lifecycle owners are explicit per case and shared only when the case intentionally spans calls

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/edge/register.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Keep bootstrapClaudePlugin and applyReconcile as the only two behavioral-composition exceptions, identified by non-exported behavior-neutral source markers and an exact source/test census."
  - "Prove bootstrap ownership through the registration's supplied CompletionCache and real add/autoupdate effects; do not introduce a child bundle or hidden test cache lifetime."
  - "Keep apply's selected-state reader as its only independently classified boundary while every mutation child remains real."

patterns-established:
  - "Exact exception census: scan production and test TypeScript sources and compare the complete marked set to the two authored path/symbol pairs."
  - "Composition evidence: public results precede supplemental ownership observations; no interaction-only child replacement is permitted."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered bootstrap runs real marketplace add and then real autoupdate through the supplied lifecycle cache while preserving complete public effects."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#runs registered bootstrap through the supplied lifecycle cache and both real children"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/bootstrap.test.ts real add/autoupdate success, partial-success, failure, convergence, and scope cases"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts, edge/handlers/plugin/bootstrap.ts, and orchestrators/plugin/bootstrap.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyReconcile retains real mutation children, project-before-user ordering, public state/tree/route/cache outcomes, and its narrow state reader."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts complete owner suite"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-cross-scope-reconcile.test.ts and tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/reconcile/apply.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The production/test census contains exactly bootstrapClaudePlugin and applyReconcile and rejects either absence or any third marked exception."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-02 exact behavioral-composition census"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 27: Behavioral Composition Exceptions Summary

**Bootstrap and reconcile remain the only two full behavioral compositions, with real children on one lifecycle graph and an exact production/test census guarding the boundary.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-08T09:46:27Z
- **Completed:** 2026-09-08T10:07:37Z
- **Tasks:** 2
- **Files modified:** 5 production/test files

## Accomplishments

- Registered bootstrap now has public proof that the registration-supplied lifecycle cache reaches the real marketplace add before the real autoupdate operation, including clean success, convergence, partial success, add failure, exact state/configuration, both scope trees, cache isolation, and notification bytes.
- Removed a test-owned WeakMap cache lifetime from the bootstrap owner suite. Each isolated case now creates an explicit production CompletionCache, and only the intentional repeat lifecycle shares its owner.
- Preserved applyReconcile's real marketplace, plugin, enable/disable, and backfill children plus its narrow selected-state reader; its existing owner suite continues to cover state, configuration, scope trees, routes, cache rows, results, failures, redaction, silence, and notification bytes.
- Added an exact production/test census whose authored result is only `bootstrapClaudePlugin` and `applyReconcile`; either missing marker or any third marker fails the owner suite.

## Composition Exception Census

The complete census is:

| Kind | Source | Exception |
| --- | --- | --- |
| production | `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` | `bootstrapClaudePlugin` |
| production | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | `applyReconcile` |
| owner test | `tests/orchestrators/plugin/bootstrap.test.ts` | `bootstrapClaudePlugin` |
| owner test | `tests/orchestrators/reconcile/apply.test.ts` | `applyReconcile` |

The markers are internal comments only. They export no seam and change no runtime behavior. The census recursively scans the production and test TypeScript roots, then compares the entire sorted set to these four paired records.

## Bootstrap Ownership Proof

The edge registration test invokes the captured public `bootstrap` command with one supplied CompletionCache. The real add child persists the canonical marketplace, writes configuration, changes only user scope, and invalidates that exact cache. The real autoupdate child then enables the recorded marketplace. The case asserts exact notifications, state, configuration, user and project trees, an owner-cache rebuild, and a stale peer-cache row.

The orchestrator owner suite retains clean success, second-pass convergence, already-enabled, enable-after-add, user-only, and add-failure behavior. Its partial-success case proves that a committed add survives a subsequent real autoupdate failure, including exact state, malformed configuration bytes, tree, clone URL, and both notifications.

## Apply Ownership Proof

`applyReconcile` continues to call real uninstall, marketplace remove/add, install, enable/disable, and backfill operations in the established order. `createApplyReconcile` still selects only the independently classified state reader; it does not supply or replace mutation children. The owner suite's real filesystem and public-result coverage remains unchanged, while the exact census is colocated with that suite. Cross-scope and transaction-lifecycle integration controls passed unchanged.

## Task Commits

1. **Task 1: Preserve bootstrap as real add-then-autoupdate composition** - `8d8048e5` (test)
2. **Task 2: Preserve apply real children and seal the two-exception census** - `b7de6de4` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` identifies the existing bootstrap composition with a behavior-neutral internal census marker.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` identifies the existing reconcile composition with the matching behavior-neutral marker.
- `tests/edge/register.test.ts` proves the public registered bootstrap uses its supplied cache across both real children and remains isolated from a peer cache.
- `tests/orchestrators/plugin/bootstrap.test.ts` removes the hidden WeakMap lifetime and expands real-child public evidence for cache isolation and partial success.
- `tests/orchestrators/reconcile/apply.test.ts` owns the exact production/test census while retaining full real-child apply coverage.

The frontmatter-listed edge registration source, bootstrap handler source/test, and integration controls were read and verified but required no modification.

## Decisions Made

- Runtime/cache ownership remains explicit at actual consumers. No HooksRuntime was added to EdgeDeps, and no optional/default/global fallback or second lifetime was introduced.
- Bootstrap's autoupdate child receives no invented cache/runtime port because it consumes neither; the registration cache reaches the real add child that owns completion invalidation.
- Apply retains the production state-reader factory as its only independent reader boundary. All mutation children remain direct production calls.
- Requirements TREF-04, TREF-05, and TREF-06 remain pending for root-owned tracking rather than being marked complete by this plan executor.

## Deviations from Plan

### Contained Execution Corrections

**1. [TDD prerequisite overlap] Both production compositions were already correctly wired**

- **Found during:** Tasks 1 and 2 ownership audit
- **Issue:** Plans 05-12 through 05-26 had already completed the required owner graph and real-child forwarding, so no genuine production regression remained for a RED commit.
- **Fix:** Added the missing public composition evidence and exact census atomically without manufacturing a false failure.
- **Commits:** `8d8048e5`, `b7de6de4`

**2. [Rule 3 - Test ownership correction] Removed the bootstrap suite's hidden WeakMap cache lifetime**

- **Found during:** Task 1 owner census
- **Issue:** The local wrapper silently constructed and retained CompletionCache instances by GitOps identity, obscuring the lifecycle owner under test.
- **Fix:** Called the production bootstrap entrypoint directly with explicit fresh production caches, shared only by the deliberate two-call convergence case.
- **Files:** `tests/orchestrators/plugin/bootstrap.test.ts`
- **Commit:** `8d8048e5`

**3. [Rule 3 - Verification environment] Ran process/socket tests with contained permissions**

- **Found during:** Scoped and full verification
- **Issue:** Direct coverage, unit, and integration harnesses require temporary Unix socket and child-process access unavailable in the workspace sandbox.
- **Fix:** Re-ran the identical commands with the required contained permission; all gates passed.

**4. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The chain reached `format:check` and stopped because untracked `.mcp.json` is not Prettier-formatted and lies outside plan ownership.
- **Fix:** Preserved `.mcp.json` byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`, verified all changed tracked files separately, and ran every later gate independently.

**Total deviations:** 4 prerequisite, test-ownership, environment, or known-workspace corrections.
**Impact on plan:** The exact two-exception contract is stronger and no production API, child boundary, behavior, Phase 6 surface, or suppression changed.

## TDD Gate Compliance

- Task 1 encountered prerequisite implementation overlap from dependent plans. Its atomic evidence commit proves registered and direct bootstrap public behavior, explicit owner identity, peer isolation, and the real add-before-autoupdate sequence; no false RED was manufactured.
- Task 2 likewise found the real apply child graph already complete. Its atomic evidence commit adds the exact fail-on-absence/expansion census while preserving the full apply owner suite and integration controls.
- Production changes are behavior-neutral internal comments only. Both task commits passed their exact owner tests, direct coverage, typecheck, focused lint, and the plan's expanded gates.
- Google TypeScript style and the project's pairing, public-outcome, hermeticity, and test-double rules remain satisfied.

## Gate Results

- Exact Task 2 suite passed: 82 tests across the apply, bootstrap, edge registration, cross-scope reconcile, and transaction-lifecycle files; zero failures, skips, or todos.
- Task 1's exact tracer suite and post-commit tracer feedback gate passed, including marketplace add/update controls and every direct source pair.
- Direct coverage passed at 100% for `orchestrators/reconcile/apply.ts` (119/119 branches, 23/23 functions, 955/955 lines), `edge/register.ts`, `edge/handlers/plugin/bootstrap.ts`, and `orchestrators/plugin/bootstrap.ts`.
- TypeScript typecheck, focused and repository ESLint, changed-file Prettier, `git diff --check`, corresponding-test gates, and both negative controls passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains exactly `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`, and no suppression was added or changed.
- Full unit suite passed: 5,471 tests across 300 suites, zero failures, skips, or todos.
- Full integration suite passed: 32 tests, zero failures, skips, or todos.
- `npm run check` passed typecheck, lint, and Fallow before stopping only at the known `.mcp.json` formatting exception. All subsequent gates ran independently and passed.

## Known Stubs

None.

## Security Review

The plan closes the declared composition trust boundaries with real-child public evidence and a fail-closed exact exception census. Existing basename redaction, failure isolation, scope attribution, and notification bytes remain covered. No endpoint, authentication path, schema, filesystem trust boundary, or network behavior was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 05-28 through 05-31 can continue the scheduled transition-surface migration with the exact two-composition boundary now guarded. No blocker remains for Plan 05-28.

## Self-Check: PASSED

- All five modified production/test files and this summary exist.
- Commits `8d8048e5` and `b7de6de4` exist in history.
- No tracked file was deleted.
- `.mcp.json` and the exact existing Fallow suppression remain unchanged.

---
*Phase: 05-injection-and-ownership-design*
*Completed: 2026-09-08*
