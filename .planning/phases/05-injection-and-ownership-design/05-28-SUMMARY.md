---
phase: 05-injection-and-ownership-design
plan: 28
subsystem: hooks-test-ownership
tags: [hooks-runtime, test-isolation, routing, settle, reset-census, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime lifecycle graph and stale-generation guards from Plans 05-12 through 05-26
  - phase: 05-injection-and-ownership-design
    provides: exact behavioral-composition boundary from Plan 05-27
provides:
  - eight reset-free hooks unit and architecture suites with case-owned HooksRuntime fixtures
  - public lifecycle evidence for routing, async children, dispatch, context, generation, and settle behavior
  - a before-and-after reset census that preserves later-plan production transition surfaces
affects: [05-29, 05-30, 05-31, hooks-runtime, test-isolation, fallow]

actuals:
  tokens: 28612
  tasks: 2
  commits: 2
plan_head_before: c90ed74c35bb45b112b5ae764ed2c4fb6b4badec

tech-stack:
  added: []
  patterns:
    - each isolated test case constructs and binds its own production HooksRuntime
    - intentional multi-step lifecycle behavior shares one explicit runtime only within that case
    - public routing and runtime operations replace module reset setup and internal transition assertions

key-files:
  created: []
  modified:
    - tests/architecture/hooks-async-rewake.test.ts
    - tests/architecture/hooks-if-field.test.ts
    - tests/bridges/hooks/async-rewake/registry.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/bridges/hooks/event-adapters.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/routing-state.test.ts
    - tests/bridges/hooks/settle.test.ts

key-decisions:
  - "Replace reset-driven setup with a fresh production HooksRuntime per case, using runtime-bound routing/state operations whenever tests need seeded public state."
  - "Replace assertions whose only subject was resetEpoch/resetRoutingState with generation advance, public route behavior, and peer-isolation evidence."
  - "Retain addPluginConfigToCache and resetEpoch without suppression or artificial callers because Plan 05-31 owns their terminal zero-caller census and deletion."

patterns-established:
  - "Owner fixture: createHooksRuntime is local to each test and is forwarded through production factories rather than stored in mutable module state."
  - "Transition evidence: generation invalidation and settle transitions are driven through public owner operations, not cleanup aliases or raw state."

requirements-completed: []

coverage:
  - id: D1
    description: "Async, if-field, registry, and dispatch tests use fresh runtime owners while preserving child, timer, buffer, PID, marker, matcher, reducer, and Pi-result behavior."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "Task 1 four-file node --test command"
        status: pass
      - kind: other
        ref: "npm run typecheck and scoped ESLint --max-warnings=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Event adapter, router, routing-state, and settle tests use case-owned runtimes and public transitions while preserving routes, context, stale callbacks, settle precedence, results, and messages."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "Task 2 five-file node --test command including tests/architecture/hooks-lifecycle.test.ts"
        status: pass
      - kind: unit
        ref: "npm test (5471 tests passed)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (32 tests passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All eight owned suites contain zero resetEpoch/resetRoutingState imports or calls and no shared mutable runtime fixture."
    requirement: TREF-06
    verification:
      - kind: other
        ref: "post-task reset and mutable-fixture census across all eight files"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 28: Hooks Test Reset Migration Summary

**Eight hooks unit and architecture suites now isolate state with case-owned production runtimes and public lifecycle transitions, with exact behavior preserved and terminal reset deletion left to Plan 05-31.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-08T10:11:29Z
- **Completed:** 2026-09-08T10:41:00Z
- **Tasks:** 2
- **Files modified:** 8 test files

## Accomplishments

- Removed every `resetRoutingState` and `resetEpoch` import/call from the eight-file Plan 05-28 census without editing production.
- Replaced mutable module runtimes and reset hooks with fresh case-owned `createHooksRuntime()` instances passed through production routing, hydration, dispatch, adapter, async registry, and settle APIs.
- Replaced reset-surface-only assertions with public generation, routing-bucket, re-entry, stale-callback, and peer-isolation observations while retaining the existing async, PID, matcher, reducer, route, context, settle, result, error, message, and notification assertions.
- Kept the production transition surfaces in place for Plans 05-29 through 05-31 and recorded their now-dead intermediate state for the terminal deletion plan.

## Reset Census

The fresh base census at `c90ed74c` found these direct calls:

| Owned suite                                         | `resetRoutingState()` | `resetEpoch()` | Other shared fixture                             |
| --------------------------------------------------- | --------------------: | -------------: | ------------------------------------------------ |
| `tests/architecture/hooks-async-rewake.test.ts`     |                     6 |              0 | none                                             |
| `tests/architecture/hooks-if-field.test.ts`         |                     2 |              0 | none                                             |
| `tests/bridges/hooks/async-rewake/registry.test.ts` |                    50 |              0 | none                                             |
| `tests/bridges/hooks/dispatch.test.ts`              |                     0 |              0 | mutable module runtime refreshed in `beforeEach` |
| `tests/bridges/hooks/event-adapters.test.ts`        |                     0 |              0 | mutable module runtime refreshed in `beforeEach` |
| `tests/bridges/hooks/event-router.test.ts`          |                     5 |              0 | reset-backed routing fixture                     |
| `tests/bridges/hooks/routing-state.test.ts`         |                    23 |              6 | reset-backed routing fixture                     |
| `tests/bridges/hooks/settle.test.ts`                |                     0 |              0 | mutable module runtime refreshed in `beforeEach` |

The post-task census is zero reset imports/calls and zero mutable module runtime/`beforeEach` fixtures across all eight files.

The callers intentionally left for later plans are 29 `resetRoutingState()` calls: 18 across four integration suites assigned to Plan 05-29 and 11 across the install/update owner suites assigned to Plan 05-30. There are no remaining `resetEpoch()` callers. The production definitions remain untouched for Plan 05-31's terminal census and deletion.

## Task Commits

1. **Task 1: Migrate async, if-field, registry, and dispatch owners to fresh runtimes** - `e7748d5e` (test)
2. **Task 2: Migrate event, routing, and settle owners without early deletion** - `02b28867` (test)

## Files Created/Modified

- `tests/architecture/hooks-async-rewake.test.ts` removes process-global reset cleanup from cases that already own production runtimes.
- `tests/architecture/hooks-if-field.test.ts` seeds and reads route state through runtime-bound public operations.
- `tests/bridges/hooks/async-rewake/registry.test.ts` removes reset cleanup from 50 isolated registry cases.
- `tests/bridges/hooks/dispatch.test.ts` replaces its mutable module runtime with case-local owners.
- `tests/bridges/hooks/event-adapters.test.ts` creates runtime owners inside the observation-result cases that consume them.
- `tests/bridges/hooks/event-router.test.ts` binds direct routing, hydration, configuration seeding, reload, and stale behavior to explicit case owners.
- `tests/bridges/hooks/routing-state.test.ts` replaces transition reset assertions with fresh-owner, generation-advance, and peer-isolation evidence.
- `tests/bridges/hooks/settle.test.ts` makes every settle case and `runStop` invocation use the case's explicit runtime while retaining genuine settle-state transitions.

## Decisions Made

- Tests seed runtime state only through production `createRoutingStateOperations`, `createHooksRouting`, and hydration operations. No raw state reader, reset alias, `ForTest` export, or replacement seam was introduced.
- Fresh runtimes are the isolation boundary. A runtime is shared only inside one test whose behavior intentionally spans multiple lifecycle calls.
- Production reset/transition definitions remain for the ordered Plans 05-29 and 05-30 migrations. Plan 05-31 owns the repeat zero-caller census and deletion.
- TREF-05 and TREF-06 remain pending in root-owned tracking; this executor did not edit `STATE.md`, `ROADMAP.md`, or `REQUIREMENTS.md`.

## Deviations from Plan

### Contained Execution Corrections

**1. [TDD prerequisite overlap] The migration was test-only and production behavior already existed**

- **Found during:** Tasks 1 and 2
- **Issue:** The plan's required production owner factories and public lifecycle behavior already existed. A failing production RED would have required manufacturing a regression or temporarily weakening the owner contract.
- **Fix:** Performed each test-fixture migration atomically, then ran the exact task behavior gates and the broader unit/integration controls.
- **Commits:** `e7748d5e`, `02b28867`

**2. [Plan sequencing contradiction] Task 2's `npm run fallow` gate precedes the planned terminal deletion**

- **Found during:** Task 2 verification
- **Issue:** Removing the last unit/architecture callers makes two deliberately retained production transition exports dead before Plans 05-29/05-30 finish their migrations. Fallow therefore reports exactly `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:135 addPluginConfigToCache` and `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:211 resetEpoch`.
- **Resolution:** Retained both exports exactly as the plan requires, added no suppression or artificial production caller, and assigned their zero-caller deletion to Plan 05-31. All independent Fallow and non-Fallow gates were run.
- **Impact:** This is the sole deferred gate. `fallow health` and `fallow dupes` pass; the aggregate dead-export check remains intentionally open until Plan 05-31.

**3. [Rule 3 - Verification environment] Direct-negative coverage required child-process permissions**

- **Found during:** Full verification
- **Issue:** The workspace sandbox denied a `spawnSync` probe with `EPERM`.
- **Fix:** Re-ran the unchanged negative coverage command with approved child-process permissions; it passed.
- **Files modified:** none

**Total deviations:** 3 contained execution corrections. No production scope expansion or behavior change occurred.

## Verification

- Task 1 four-file `node --test`: passed.
- Task 2 four owner files plus `tests/architecture/hooks-lifecycle.test.ts`: passed.
- `npm run typecheck`: passed.
- Scoped ESLint for both task groups with `--max-warnings=0`: passed.
- Full repository lint through `npm run check`: passed before the authorized Fallow stop.
- `npx fallow health --fail-on-issues --format human`: passed with `0 above threshold`.
- `npx fallow dupes --fail-on-issues --format human`: passed.
- `npm run fallow`: deferred only for `addPluginConfigToCache` and `resetEpoch`, both retained for Plan 05-31 as required.
- Owned eight-file Prettier check: passed.
- `npm run format:check`: stopped only on the known untracked `.mcp.json`; its SHA-256 remained `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`.
- `npm run test:corresponding`: passed.
- `npm run test:corresponding:negative`: passed.
- `npm run test:coverage:direct:negative`: passed after the permission-only retry.
- `TEST_CONCURRENCY=1 npm test`: 5,471 passed, 0 failed, 0 skipped.
- `npm run test:integration`: 32 passed, 0 failed, 0 skipped.
- Exact existing Fallow suppression remains byte-identical: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## Known Stubs

None introduced. The two retained transition exports are scheduled production surfaces, not stubs; their terminal removal is explicitly assigned to Plan 05-31.

## Issues Encountered

The plan's own ordering creates the expected temporary Fallow dead-export result described above. No other failures remain.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05-29 can migrate the four remaining integration suites from `resetRoutingState()`.
- Plan 05-30 can migrate the install/update owner suites.
- Plan 05-31 must repeat the complete caller census and remove `resetEpoch`, `resetRoutingState`, `addPluginConfigToCache`, and any other transition-only surface only when the caller count is zero.

## Self-Check: PASSED

- All eight modified test files exist and contain no hooks reset import/call or shared mutable runtime fixture.
- Task commits `e7748d5e` and `02b28867` exist on the authorized branch.
- Production reset/transition files are unchanged by this plan.
- `.mcp.json`, root-owned planning state, and the existing Fallow suppression remain unmodified.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_
