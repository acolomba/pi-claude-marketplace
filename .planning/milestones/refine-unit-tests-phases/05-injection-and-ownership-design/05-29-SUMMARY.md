---
phase: 05-injection-and-ownership-design
plan: 29
subsystem: hooks-test-ownership
tags: [hooks-runtime, completion-cache, integration, test-isolation, reset-census, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache lifecycle graph from Plans 05-12 through 05-26
  - phase: 05-injection-and-ownership-design
    provides: reset-free hooks unit and architecture owners from Plan 05-28
provides:
  - five reset-free hooks integration suites using case-owned production lifecycle graphs
  - end-to-end context, dispatch, reconcile, spawn, and transaction-cascade behavior without process-global cleanup
  - a post-migration census assigning every remaining reset caller to Plan 05-30
affects: [05-30, 05-31, hooks-runtime, integration-tests, fallow]

actuals:
  tokens: 5087
  tasks: 2
  commits: 2
plan_head_before: b835fb4829de5e4dac2d2459e6d0b41f7a1b8741

tech-stack:
  added: []
  patterns:
    - each integration case constructs and binds its own production HooksRuntime
    - runtime and completion-cache owners are shared only inside an intentional multi-operation lifecycle
    - registered callbacks and runtime snapshots replace transition-module cleanup and observation

key-files:
  created: []
  modified:
    - tests/integration/hooks-additionalcontext-end-to-end.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/hooks-dispatch-end-to-end.test.ts
    - tests/integration/hooks-spawn-end-to-end.test.ts

key-decisions:
  - "Bind registration and reconcile to the same case-owned HooksRuntime so route assertions observe the real lifecycle owner."
  - "Keep transaction-lifecycle-cascade read/verify-only because it already used one fresh HooksRuntime and CompletionCache for its intentional multi-operation case."
  - "Retain the six now-dead transition exports without suppression or artificial callers because Plan 05-31 owns their terminal deletion."

patterns-established:
  - "Integration owner fixture: createHooksRuntime is local to each case and is passed through createHooksHydration/createHooksRouting."
  - "Reload evidence: use the callback registered by the re-entered production hydration owner instead of constructing a transition handler directly."

requirements-completed: []

coverage:
  - id: D1
    description: "Additional-context, dispatch, and cross-scope reconcile integrations use case-owned production runtimes while preserving exact routes, context, state, results, silence, and notifications."
    requirement: TREF-05
    verification:
      - kind: integration
        ref: "Task 1 three integration suites plus reconcile/event-router owner suites"
        status: pass
      - kind: other
        ref: "npm run typecheck and scoped ESLint --max-warnings=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Spawn and transaction-cascade integrations use fresh lifecycle ownership while preserving real process and plugin-operation behavior."
    requirement: TREF-06
    verification:
      - kind: integration
        ref: "Task 2 spawn and transaction-lifecycle suites plus install/reinstall/uninstall owner suites"
        status: pass
      - kind: unit
        ref: "TEST_CONCURRENCY=1 npm test (5471 tests passed)"
        status: pass
      - kind: integration
        ref: "TEST_CONCURRENCY=1 npm run test:integration (32 tests passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All five Plan 05-29 integrations contain zero reset imports or calls, and every remaining caller is assigned to Plan 05-30."
    requirement: TREF-06
    verification:
      - kind: other
        ref: "fresh pre-task and post-task reset caller census"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 29: Hooks Integration Reset Migration Summary

**Five hooks integration suites now exercise case-owned production lifecycle graphs without process-global reset cleanup, while preserving context, routing, reconcile, spawn, and transaction behavior.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-08T10:45:12Z
- **Completed:** 2026-09-08T11:05:03Z
- **Tasks:** 2
- **Files modified:** 4 test files; the fifth plan-owned suite was verified unchanged

## Accomplishments

- Removed all 18 `resetRoutingState()` calls and their imports/cleanup hooks from the four integration suites that still used the transition owner.
- Routed registration, re-entry, pending context, route snapshots, and cross-scope reconcile through fresh case-owned `HooksRuntime` instances and production hydration/routing factories.
- Verified the existing transaction lifecycle case retains one intentional owner graph across install, update, reinstall, and uninstall without manufacturing a no-op edit.
- Left exactly the 11 Plan 05-30 completion/reset callers and no unassigned test caller.

## Reset Census

The fresh base census at `b835fb48` found these direct calls:

| Plan 05-29 suite | `resetRoutingState()` | `resetEpoch()` |
| --- | ---: | ---: |
| `hooks-additionalcontext-end-to-end.test.ts` | 4 | 0 |
| `hooks-cross-scope-reconcile.test.ts` | 2 | 0 |
| `hooks-dispatch-end-to-end.test.ts` | 8 | 0 |
| `hooks-spawn-end-to-end.test.ts` | 4 | 0 |
| `transaction-lifecycle-cascade.test.ts` | 0 | 0 |

The only callers outside this plan were already assigned to Plan 05-30: seven calls in `tests/orchestrators/plugin/install.test.ts` and four calls in `tests/orchestrators/plugin/update.test.ts`.

The post-task census found zero reset imports/calls in all five Plan 05-29 suites, zero `resetEpoch()` callers anywhere, and exactly those 11 Plan 05-30 `resetRoutingState()` calls. Production transition definitions remain untouched for Plan 05-31.

## Task Commits

1. **Task 1: Migrate context, cross-scope, and dispatch integrations** - `604a3bbe` (test)
2. **Task 2: Migrate spawn and transaction-cascade integrations** - `c0981377` (test)

## Files Created/Modified

- `tests/integration/hooks-additionalcontext-end-to-end.test.ts` uses a case-owned runtime, production hydration, and the re-entered registration's real drain callback.
- `tests/integration/hooks-cross-scope-reconcile.test.ts` shares one case-owned runtime/routing/cache graph between production hydration and real reconcile.
- `tests/integration/hooks-dispatch-end-to-end.test.ts` isolates every boot and lazy-hydration scenario with its own runtime owner.
- `tests/integration/hooks-spawn-end-to-end.test.ts` isolates both real child-process cases with fresh production hydration owners.
- `tests/integration/transaction-lifecycle-cascade.test.ts` was verified unchanged because it already had the required fresh runtime/cache graph.

## Decisions Made

- Runtime snapshots are acceptable public owner observations; the tests no longer import transition-module route or pending-context readers.
- Reload context is drained through the actual `before_agent_start` callback registered by the second production hydration pass.
- TREF-05 and TREF-06 remain pending in root-owned tracking. This executor did not edit `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, or state/config files.

## Deviations from Plan

### Contained Execution Corrections

**1. [TDD prerequisite overlap] Required production lifecycle behavior already existed**

- **Found during:** Tasks 1 and 2
- **Issue:** The plan is a test-only ownership migration, and the production owner factories already satisfied the target behavior. A conventional production RED would have required manufacturing a regression.
- **Resolution:** Migrated the reset-dependent fixtures atomically, retained every public assertion, and ran the exact owner and full-suite gates. The transaction-cascade file required no edit because its prerequisite owner migration was already complete.
- **Commits:** `604a3bbe`, `c0981377`

**2. [Plan sequencing contradiction] Integration migration exposes six transition exports before terminal deletion**

- **Found during:** Task 2 verification
- **Issue:** Plan 05-28 exposed `addPluginConfigToCache` and `resetEpoch`. Removing the final integration callers additionally exposed `currentEpoch`, `pendingSessionStartContextEntries`, `routingTableEntries`, and `beforeAgentStartHandlerFor`. The full temporary set is:
  - `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:193 currentEpoch`
  - `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:211 resetEpoch`
  - `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:250 pendingSessionStartContextEntries`
  - `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:313 routingTableEntries`
  - `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:135 addPluginConfigToCache`
  - `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1134 beforeAgentStartHandlerFor`
- **Resolution:** Retained all six exactly as required, added no suppression or artificial caller, and assigned the zero-caller deletion to Plan 05-31. Every independent non-dead-export gate ran.
- **Impact:** This is the only deferred aggregate gate; no behavior or production code changed.

**3. [Rule 3 - Verification environment] Direct-negative coverage required child-process permissions**

- **Found during:** Full verification
- **Issue:** The negative-control runner spawns isolated Node subprocesses that the workspace sandbox restricts.
- **Resolution:** Re-ran the unchanged command with approved child-process permissions; it passed.
- **Files modified:** none

**Total deviations:** 3 contained execution corrections. No production scope expansion occurred.

## TDD Gate Compliance

- Both tasks were fixture/evidence migrations over pre-existing production behavior; no false production regression was introduced to obtain a RED state.
- Each task was committed atomically only after its exact behavior command passed.
- The tracer feedback gate repeated Task 1's complete command before Task 2 expansion and passed.

## Verification

- Task 1 exact test command: 84 tests passed; typecheck and scoped ESLint passed. The tracer feedback rerun also passed.
- Task 2 exact test command: 316 tests passed; typecheck and scoped ESLint passed.
- `npm run check`: typecheck and full lint passed, then stopped only on the six authorized Plan 05-31 dead exports.
- `npx fallow health --fail-on-issues --format human`: passed with `0 above threshold`.
- `npx fallow dupes --fail-on-issues --format human`: passed its configured threshold.
- Owned five-file Prettier check: passed.
- `npm run format:check`: stopped only on the known untracked `.mcp.json`; its SHA-256 remained `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`.
- `npm run test:corresponding` and `npm run test:corresponding:negative`: passed.
- `npm run test:coverage:direct:negative`: passed.
- `TEST_CONCURRENCY=1 npm test`: 5,471 passed, 0 failed, 0 skipped.
- `TEST_CONCURRENCY=1 npm run test:integration`: 32 passed, 0 failed, 0 skipped.
- Exact existing Fallow suppression remains byte-identical: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.
- Only four plan-owned test files changed; production, operation-owner suites, transaction-cascade, root tracking, and `.mcp.json` remained untouched.

## Known Stubs

None introduced. The six retained transition exports are scheduled compatibility surfaces, not stubs; Plan 05-31 owns their deletion.

## Issues Encountered

The plan ordering creates the expected temporary Fallow dead-export result documented above. No other failures remain.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05-30 can migrate the final 11 install/update reset callers.
- Plan 05-31 must repeat the complete census and delete the six transition exports plus `resetRoutingState` only after the caller count reaches zero.

## Self-Check: PASSED
