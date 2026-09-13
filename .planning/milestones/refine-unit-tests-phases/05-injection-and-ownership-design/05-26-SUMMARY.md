---
phase: 05-injection-and-ownership-design
plan: 26
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, completion-cache, generation-guards, reload, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound routing and mutation capabilities from Plans 05-13 through 05-25
provides:
  - public proof that each extension load owns one isolated HooksRuntime and CompletionCache graph
  - post-await generation guards before retained callback runtime and Pi effects
  - exact reload-order evidence without callback disposal assumptions
  - bounded transition-surface census assigned to Plan 05-31
affects: [05-27, 05-28, 05-29, 05-30, 05-31, hooks-lifecycle, completion-lifecycle]

actuals:
  tokens: 12978
  tasks: 2
  commits: 4
plan_head_before: 0fe020d42b6f3cc825a760d86e336d5a7bf1f7ca

tech-stack:
  added: []
  patterns:
    - retained callbacks capture a generation and recheck it after every await before runtime or Pi effects
    - one root-owned HooksRuntime and CompletionCache pair is constructed per extension invocation
    - transition bindings remain explicitly bounded for the terminal Plan 05-31 migration

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/index.test.ts

key-decisions:
  - "Keep HooksRuntime state private and prove root owner identity through public hook, command, and completion behavior rather than expose raw state or a reset seam."
  - "Treat a generation change during awaited dispatch, hydration, containment, filesystem, shared-directory, or composite-handler work as stale and return before every later runtime or Pi effect."
  - "Retain the production transition bindings until their already-scheduled Plan 05-31 deletion; this plan records but does not remove them."

patterns-established:
  - "Stale-after-await boundary: capture before work, then recheck immediately after each await and before mutation, route rebuild, notification, or message delivery."
  - "Lifecycle isolation evidence: create independent extension invocations and observe their hook routes and completion rows only through public APIs."

requirements-completed: []

coverage:
  - id: D1
    description: "One extension invocation owns one runtime/cache graph and a peer invocation cannot observe its hooks or completion rows."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/index.test.ts public hook, marketplace-add, completion, and peer-lifecycle case"
        status: pass
      - kind: other
        ref: "100% direct coverage for extensions/pi-claude-marketplace/index.ts and bridges/hooks/runtime.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Retained callbacks become inert at entry and after awaited work before runtime or Pi effects."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts and tests/bridges/hooks/dispatch.test.ts deferred-generation cases"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-cross-scope-reconcile.test.ts and tests/integration/hooks-spawn-end-to-end.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for event-router.ts and dispatch.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reload preserves generation, pending/settle, child shutdown, hydration/rebuild, directory preparation, orphan reap, and registration order."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts exact operation-log assertion"
        status: pass
    human_judgment: false

duration: 39min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 26: Lifecycle Graph and Stale Callback Summary

**Each extension load now has public proof of one isolated runtime/cache graph, while retained callbacks recheck generation after awaited work and cannot affect a newer registration.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-09-08T09:03:20Z
- **Completed:** 2026-09-08T09:42:43Z
- **Tasks:** 2
- **Files modified:** 5 production/test files

## Accomplishments

- Exercised hooks, a successful marketplace mutation, and completion rebuilding through one extension lifecycle, then loaded a peer lifecycle and proved its hook routing and completion cache remained empty and independent.
- Added generation checks after every awaited dispatch and event-router boundary that could otherwise reach mutation, route rebuild, pending context, notification, message, or later hook execution.
- Preserved live-generation behavior and asserted the exact reload sequence: generation invalidation, pending/settle transition, owned-child shutdown, hydration/rebuild, shared-directory preparation, orphan reap, and callback registration.
- Kept runtime state private and added no reset, disposal, test-only, raw-state, optional/default, or global fallback seam.

## Root Ownership Proof

`tests/index.test.ts` now drives one extension invocation through its registered bridge callback, denies a Bash tool call from a hydrated project hook, performs a real successful `marketplace add`, and reads the resulting completion row. A second extension invocation receives fresh root-owned runtime and cache objects: it has no inherited route or completion row, while the first invocation remains live. The existing source-structure assertion also confirms exactly one `createHooksRuntime()` and one `createCompletionCache()` construction in the root factory.

No production root forwarding change was necessary. Plans 05-12 through 05-25 had already completed the owner graph; Task 1 supplied the missing public identity and peer-isolation evidence without creating an artificial regression.

## Generation Guard Contract

- `reduceBucket` captures its runtime generation and returns the event's no-op result when the generation changes during a hook executor await, before event adaptation or input mutation.
- `collectBucketOutcomes` stops the bucket when its generation changes during an executor await, preventing later entries from starting; settle's existing generation check continues to discard stale collected outcomes before Pi/runtime effects.
- Runtime-bound event routing checks generation after state loading, path containment, hook-file reads, project hydration, shared-directory preparation, and composite dispatch.
- The public hydration mirror is updated only while its captured generation remains current.
- The retained transition `beforeAgentStartHandlerFor` clears pending transition context synchronously before returning the handler promise, leaving no post-await transition side effect.

Deferred tests advance the runtime while each await is held, then verify no tool-input mutation, pending-context append, route rebuild, later hook execution, notification, or message occurs. Current-generation callbacks retain their exact results.

## Reload Order

The registration-order evidence observes the complete production sequence:

1. generation invalidation
2. pending-context and settle transition
3. owned-child shutdown
4. user/project hydration and route rebuild
5. user/project shared-directory preparation
6. orphan reap
7. callback registration

The test retains callbacks from the earlier registration and invokes them after re-registration. Safety is therefore independent of any unproven Pi callback disposal behavior.

## Plan 05-31 Transition Census

This plan intentionally did not delete any transition surface. The remaining bounded, production-used surfaces assigned to Plan 05-31 are:

- `bridges/hooks/routing-state.ts`: the private eager `transitionRoutingState` and its epoch, pending-context, parsed-config, routing-table, and `resetRoutingState` compatibility exports.
- `bridges/hooks/event-router.ts`: `TRANSITION_ROUTING_STATE`, `NODE_TRANSITION_RUNTIME`, `NODE_HOOKS_HYDRATION`, and their compatibility exports for config cache mutation, hook reads/rebuild, before-agent context, project hydration, and bridge registration.
- `shared/completion-cache.ts`: `transitionCompletionCacheOwner`, `transitionCompletionCache`, the legacy read/invalidate/drop functions that delegate to it, and `resetCompletionCache`.

These are the previously scheduled terminal migration surfaces only. No additional transition, owner, or cleanup surface was introduced.

## Task Commits

1. **Task 1 evidence: Prove per-load lifecycle owner isolation** - `3dff1109` (test)
2. **Task 2 RED: Expose stale post-await hook effects** - `f0c95ff8` (test)
3. **Task 2 GREEN: Block stale post-await hook effects** - `a1e0030d` (fix)
4. **Verification formatting: Format lifecycle guard evidence** - `22f9adbc` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` checks the captured generation after awaited executor work before adapting or mutating an event, and stops collection before later entries.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` threads a required generation guard through awaited hydration/registration work and preserves the exact lifecycle order.
- `tests/bridges/hooks/dispatch.test.ts` proves stale executor completions cannot mutate tool input, append pending context, adapt results, or start later bucket entries.
- `tests/bridges/hooks/event-router.test.ts` proves every awaited routing boundary is stale-safe and records the complete reload order.
- `tests/index.test.ts` proves root owner identity and peer isolation through public hook, mutation, and completion behavior.

The plan-frontmatter `index.ts`, `runtime.ts`, architecture, and integration controls were read and verified but required no modification.

## Decisions Made

- Owner identity stays observable through behavior, not through raw runtime/cache access or a test-only reset.
- Generation checks are required capabilities at the actual event-router and dispatch consumers; they are not optional, defaulted, or backed by a global fallback.
- A stale bucket may return already-collected private outcomes because settle performs its own generation check and suppresses all later runtime/Pi effects; later hook entries never begin after invalidation.
- Remaining transitions stay in place until Plan 05-31 completes their planned caller migration and terminal deletion.

## Deviations from Plan

### Authorized Scope and Execution Corrections

**1. [Rule 3 - Required stale-effect propagation] Added the dispatch source/test pair**

- **Found during:** Task 2 RED generation-boundary tracing
- **Issue:** The event-router wrapper delegates awaited bucket execution to `reduceBucket`; guarding only the wrapper would occur after tool input and pending context could already be mutated.
- **Fix:** Threaded the runtime-required generation guard through the event-router to `dispatch.ts` and rechecked it at the exact post-await mutation boundary. Added paired direct tests with no optional/default/test seam or dispatch redesign.
- **Authorization:** Root explicitly authorized this two-file frontmatter expansion and the exact event-router-to-`reduceBucket` propagation.
- **Files:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `tests/bridges/hooks/dispatch.test.ts`
- **Commits:** `f0c95ff8`, `a1e0030d`

**2. [TDD prerequisite overlap] Task 1 production ownership was already complete**

- **Found during:** Task 1 root graph audit
- **Issue:** Plans 05-12 through 05-25 already constructed and forwarded one runtime/cache pair per load. A genuine failing production owner case no longer existed.
- **Fix:** Added the missing public multi-consumer and peer-isolation tracer evidence in one atomic test commit. No false regression was manufactured.
- **Commit:** `3dff1109`

**3. [Rule 3 - Verification formatting] Formatted three plan-owned files after the repository format gate**

- **Found during:** `npm run check`
- **Issue:** The new evidence and generation-guard edits were not yet in repository Prettier form.
- **Fix:** Formatted only the three tracked plan files, re-ran affected tests, direct coverage, typecheck, lint, and format checks, and committed the mechanical result separately.
- **Commit:** `22f9adbc`

**4. [Rule 3 - Verification environment] Re-ran process/socket gates with required permissions**

- **Found during:** Direct-coverage negative controls and the full unit suite
- **Issue:** The workspace sandbox returned `EPERM` for the negative harness's child Node processes, the revalidation suite's child processes, and a Unix-domain-socket fixture.
- **Fix:** Re-ran the identical gates with contained process/socket permission. Direct-coverage negative controls and all 5,468 unit tests passed.

**5. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check` and the independent format check
- **Issue:** The full check reaches `format:check` and stops because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`, made every changed tracked file Prettier-clean, and ran every later gate independently.

**Total deviations:** 5 contained scope, prerequisite, formatting, environment, or known-workspace corrections.
**Impact on plan:** The lifecycle graph and stale-callback contract are complete without a second owner, raw state, disposal assumption, optional/default/global fallback, new suppression, Phase 6 work, or premature transition deletion.

## TDD Gate Compliance

- Task 1 encountered prerequisite implementation overlap: the required production owner graph was already complete from dependent plans. Public owner identity and peer isolation were committed atomically in `3dff1109`; no artificial RED was introduced.
- Task 2 RED commit `f0c95ff8` failed on intended stale post-await effects: tool input mutated, SessionStart context appended, and hydration read/rebuilt routes after generation advancement.
- Task 2 GREEN commit `a1e0030d` placed required generation checks at the actual effect boundaries and made every deferred stale-work case pass while preserving current-generation behavior.
- The separate formatting commit `22f9adbc` was mechanical and passed the full affected test/coverage/static slice.
- Google TypeScript style and the project's test pairing, public-outcome, hermeticity, and test-double rules remain satisfied.

## Gate Results

- Exact Task 1 and Task 2 suites passed, including index, event-router, lifecycle architecture, cross-scope reconcile, edge registration/completions, settle, spawn end-to-end, and the authorized dispatch pair.
- Direct coverage passed at 100% for `index.ts` (183/183 lines), `event-router.ts` (1190/1190 lines), `dispatch.ts` (509/509 lines), and `runtime.ts` (248/248 lines), with 100% branches and functions for each owned source.
- TypeScript typecheck, focused ESLint, corresponding-test gates, changed-file Prettier, and `git diff --check` passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains exactly `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`, and no suppression was added.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed: 5,468 tests across 300 suites, zero failures, skips, or todos.
- Full integration suite passed: 13 test files, zero failures, skips, or todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at formatting. After the three tracked plan files were formatted and reverified, the independent format check reported only the known `.mcp.json` exception; every subsequent gate ran independently and passed.

## Known Stubs

None.

## Security Review

The plan closes the three declared lifecycle trust boundaries: peer extension invocations do not share hook/cache observations, retained wrappers no-op after generation invalidation, and awaited work rechecks generation before mutation or Pi effects. No network endpoint, authentication path, schema, or new filesystem trust boundary was introduced.

## Self-Check: PASSED

- All five modified production/test files exist.
- Commits `3dff1109`, `f0c95ff8`, `a1e0030d`, and `22f9adbc` exist in history.
- No tracked file was deleted.
- `.mcp.json` and the exact existing Fallow suppression remain unchanged.
