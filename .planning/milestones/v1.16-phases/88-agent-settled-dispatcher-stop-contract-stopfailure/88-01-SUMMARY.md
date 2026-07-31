---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
plan: 01
subsystem: api
tags: [hooks, pi-coding-agent, agent_settled, stop-hook, dispatch, typescript]

requires:
  - phase: 87-bucket-a-admission-platform-floor
    provides: "BUCKET_A_EVENTS 8->10 (Stop/StopFailure admitted), DISPATCHABLE_EVENTS subset (D-87-04), peer floor >=0.80.5, 0.82.1 resolved in lockfile"
provides:
  - "Dev tree materialized at pi-coding-agent 0.82.1 (agent_settled overload available)"
  - "pi-api.ts re-exports: AgentEndEvent, AgentSettledEvent + derived AgentMessage/AssistantMessage/StopReason"
  - "settle.ts: agent_end last-assistant cache + agent_settled stopReason gate + Stop block re-entry (STOP-01, STOP-03)"
  - "Stop/StopFailure payload translators + DISPATCHABLE_EVENTS at 10 with both translator tables total"
  - "reduceBucket/ReducedBucket exported from dispatch.ts for the settle handler"
  - "registerHooksBridge registers agent_end + agent_settled (pinned pi.on count 8->10)"
affects: [88-02, 88-03, 88-04, 89]

tech-stack:
  added: []
  patterns:
    - "Settle-time dispatch: agent_end caches last-assistant; agent_settled reads cache + gates on stopReason"
    - "Bespoke result adapter over reduceBucket for Stop (block -> sendMessage), separate from adaptForEvent"
    - "Synthetic event into the never-typed translator slot (no TranslationContext widening)"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
    - tests/bridges/hooks/settle.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - tests/architecture/hooks-dispatch.test.ts
    - tests/architecture/hooks-translators.test.ts

key-decisions:
  - "AgentMessage/AssistantMessage/StopReason derived structurally from AgentEndEvent.messages (nested pi-ai/pi-agent-core are not top-level resolvable), keeping pi-api.ts the sole Pi import site"
  - "npm install produced no lockfile drift (0.82.1 already resolved in Phase 87) -- nothing to commit for package.json/lock"
  - "Stop block re-entry uses a distinct customType claude-hook-stop-block with {deliverAs:followUp, triggerTurn:true} (not async-rewake's nextTurn idle lane)"
  - "isDispatchableEvent guard + DISPATCHABLE_MEMBERS retained (now dead-but-harmless) as a defensive belt for a future admission that outruns its translator"
  - "stop_hook_active/consecutive-block cells deferred to plan 03 (STOP-07) rather than declared-unused, to keep lint clean"

patterns-established:
  - "Settle dispatcher: cache-from-agent_end + gate-on-stopReason under capturedEpoch hygiene"
  - "Terminal-event dispatch reuses reduceBucket with a bespoke block->sendMessage adapter"

requirements-completed: [STOP-01, STOP-03]

coverage:
  - id: D1
    description: "Dev tree at pi-coding-agent 0.82.1; AgentEndEvent/AgentSettledEvent/StopReason/AssistantMessage/AgentMessage available through pi-api.ts (StopReason resolves to the concrete union, not any)"
    requirement: "STOP-01"
    verification:
      - kind: other
        ref: "node -e require pi-coding-agent/package.json version startsWith 0.82"
        status: pass
      - kind: other
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "agent_settled gate: stop->Stop bucket->block->one sendMessage(followUp,triggerTurn,display:false); aborted/toolUse/empty-cache->zero dispatch; two agent_end last-write-wins; stale epoch no-op (STOP-01, STOP-03)"
    requirement: "STOP-03"
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts (6 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "DISPATCHABLE_EVENTS 8->10 with Stop/StopFailure translators total in both TRANSLATORS records + REQUIRED_EVENT_FIELDS; pinned pi.on count 8->10 incl agent_end/agent_settled"
    requirement: "STOP-01"
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-translators.test.ts + tests/architecture/hooks-dispatch.test.ts"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-07-30
status: complete
---

# Phase 88 Plan 01: agent_settled dispatcher tracer Summary

**One `agent_settled` subscriber reads the last-assistant message cached from `agent_end`, gates on `stopReason`, and on `stop` runs the Stop bucket and re-enters the agent loop via `sendMessage(followUp+triggerTurn)` for a blocking hook -- proven end-to-end through every layer.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-30T07:4x (dev-tree refresh)
- **Completed:** 2026-07-30T08:23:52-04:00
- **Tasks:** 2 (Task 2 is a TDD tracer: RED test + GREEN feat)
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments
- Refreshed the dev tree to pi-coding-agent 0.82.1 so `pi.on("agent_settled")` typechecks and `AssistantMessage.stopReason` resolves to the concrete `StopReason` union.
- Landed `settle.ts`: `agentEndCacheHandler` caches the run's last-assistant message (last-write-wins, epoch-guarded); `settleHandlerFor` gates on `stopReason` and, on `stop`, runs the Stop bucket via the shared `reduceBucket` and re-enters on a `block` outcome (STOP-01, STOP-03).
- Folded `Stop`/`StopFailure` into `DISPATCHABLE_EVENTS` (8->10), forcing and supplying both payload translators across the dispatch-exec and async-rewake translator tables + `REQUIRED_EVENT_FIELDS`, and widened the three `dispatch.ts` `Exclude<>` sites.
- Wired `agent_end` + `agent_settled` into `registerHooksBridge` (pinned pi.on count 8->10) with cache reset on `/reload`.

## Task Commits

1. **Task 1: Dev-tree refresh + platform re-exports** - `ba90f09c` (feat)
2. **Task 2 (tracer, RED): failing settle tests + skeleton** - `5ddd6738` (test)
3. **Task 2 (tracer, GREEN): Stop block re-entry off agent_settled** - `5967ffaa` (feat)

## Files Created/Modified
- `platform/pi-api.ts` - re-export AgentEndEvent/AgentSettledEvent; derive AgentMessage/AssistantMessage/StopReason from AgentEndEvent.messages
- `bridges/hooks/settle.ts` (new) - cache handler + settle gate + Stop block re-entry adapter
- `bridges/hooks/payloads/stop.ts` (new) - Stop stdin translator + synthetic StopEvent
- `bridges/hooks/payloads/stop-failure.ts` (new) - thin StopFailure translator + synthetic StopFailureEvent (classifier lands in plan 04)
- `domain/components/hook-events.ts` - DISPATCHABLE_EVENTS 8->10; comment updates
- `bridges/hooks/dispatch.ts` - export reduceBucket/ReducedBucket; widen three Exclude sites
- `bridges/hooks/dispatch-exec.ts` - Stop/StopFailure in TRANSLATORS + REQUIRED_EVENT_FIELDS
- `bridges/hooks/async-rewake/registry.ts` - Stop/StopFailure in TRANSLATORS (inert, totality only)
- `bridges/hooks/event-router.ts` - register agent_end/agent_settled; resetSettleState on load; docstring 8->10
- `tests/bridges/hooks/settle.test.ts` (new) - six settle behavior cases
- `tests/architecture/hooks-dispatch.test.ts` - DISP-01 pin 8->10 + agent_end/agent_settled
- `tests/architecture/hooks-translators.test.ts` - length pin 8->10; Stop/StopFailure fixtures + expected JSON + kebab map

## Decisions Made
- **Structural type derivation:** `@earendil-works/pi-ai` and `@earendil-works/pi-agent-core` are nested under pi-coding-agent's own `node_modules` and are not top-level resolvable under NodeNext, so `StopReason`/`AssistantMessage`/`AgentMessage` are derived from `AgentEndEvent["messages"][number]` rather than re-exported from those entrypoints. Net surface is identical and pi-api.ts remains the sole Pi import site.
- **No lockfile drift:** `npm install` only materialized node_modules; `package.json`/`package-lock.json` were already at 0.82.1 from Phase 87, so there was nothing to commit (the plan's "or none" acceptance case).
- **Defensive belt retained:** `isDispatchableEvent`/`DISPATCHABLE_MEMBERS` now admit every event (dead guard), kept as a belt for a future admission that outruns its translator; the `DispatchableEvent` subset type is preserved per the assumption-delta decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Derived nested-package types instead of re-exporting from their entrypoints**
- **Found during:** Task 1 (platform re-exports)
- **Issue:** The plan directed re-exporting `StopReason`/`AssistantMessage` "from whichever `@earendil-works/*` entrypoint exposes it," but pi-ai/pi-agent-core are nested (not hoisted) and unresolvable from a top-level bare specifier under NodeNext.
- **Fix:** Derived `AgentMessage = AgentEndEvent["messages"][number]`, `AssistantMessage = Extract<AgentMessage, {role:"assistant"}>`, `StopReason = AssistantMessage["stopReason"]` from the re-exported `AgentEndEvent`.
- **Files modified:** platform/pi-api.ts
- **Verification:** `npm run typecheck` green; probe confirmed `StopReason` rejects a bogus value (concrete union, not `any`).
- **Committed in:** ba90f09c

**2. [Rule 2 - Simplicity] Deferred stop_hook_active/counter cells to plan 03**
- **Found during:** Task 2 (settle.ts)
- **Issue:** The plan mentioned declaring the loop-protection cells now "but only the cache is used this plan"; declaring unused module `let` cells trips `no-unused-vars`.
- **Fix:** Declared only the cache cell this plan; the `stop_hook_active`/consecutive-block cells land with STOP-07 (plan 03). The synthetic Stop event hardcodes `stop_hook_active: false` for now.
- **Files modified:** bridges/hooks/settle.ts
- **Verification:** lint clean; settle tests green.
- **Committed in:** 5967ffaa

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 simplicity). Minor lint iterations (optional-chain, import-order, prettier line-wrap) were fixed inline and are not deviations.
**Impact on plan:** No scope change. The tracer path is proven end-to-end; deferred cells are explicitly scoped to a later plan.

## Known Stubs

These are intentional, scoped to later plans (the tracer deliberately lands only the Stop block happy-path):

- `bridges/hooks/settle.ts` `runStopBucket` — `stop_hook_active` is hardcoded `false` in the synthetic Stop event; the loop-protection flag + 8-block cap land in **plan 03 (STOP-07)**.
- `bridges/hooks/settle.ts` settle gate `error`/`length` arms — return without dispatch; the StopFailure observation arm + `runStopFailure` land in **plan 04 (SFAIL-01..03)**.
- `bridges/hooks/payloads/stop-failure.ts` — thin passthrough; the errorMessage classifier lands in **plan 04 (SFAIL-03)**.
- Stop `additionalContext`-without-block re-entry (STOP-05) and cross-hook `continue:false` precedence (STOP-06) are not yet adapted; scoped to later plans.

## Issues Encountered
- The broader hooks-suite run initially reported one failure, which was a `node --test <directory>` invocation artifact (the directory path resolved as a module, MODULE_NOT_FOUND). Re-running the async-rewake tests with a file glob showed all 27 passing. Not a code regression.
- pre-commit's combined system hooks (eslint over the whole repo + typecheck + trufflehog) exceed a 3-minute window; ran with an extended timeout. All hooks pass.

## Verification

- `npm run typecheck` — green (0.82.1 tree; `agent_settled` overload resolves; DISPATCHABLE_EVENTS widen compiles).
- `node --test tests/bridges/hooks/settle.test.ts tests/architecture/hooks-dispatch.test.ts tests/architecture/hooks-translators.test.ts` — 20 pass, 0 fail.
- Broader spot-check (`tests/architecture/hooks-*.test.ts` + `tests/bridges/hooks/**`) — 325 pass, 0 fail, 1 pre-existing skip.
- The two GLOBAL-npm-root pi-subagents integration tests were not exercised by this local refresh; unchanged behavior expected (documented env condition, not a regression).

## Tracer Feedback Gate
This plan's tracer (Task 2) is its terminal task — expansion (STOP-04..07, SFAIL-01..03) lives in plans 88-02..04, executed by separate invocations. The tracer's `<verify>` (typecheck + settle.test + hooks-dispatch.test) is fully automated and green, so the feedback gate is satisfied without a human-verify stall (auto mode inactive, but the verify is scriptable, not visual).

## Next Phase Readiness
- The settle path is proven end-to-end. Plans 88-02..04 expand onto it: STOP-04 (exit-2, free via wire-protocol), STOP-05 (additionalContext re-entry), STOP-06 (cross-hook continue:false precedence), STOP-07 (stop_hook_active + 8-block cap + cap-trip notify), SFAIL-01..03 (StopFailure observation arm + classifier).
- No blockers.

## Self-Check: PASSED

All created files present on disk; all three task commits present in git history.

---
*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Completed: 2026-07-30*
