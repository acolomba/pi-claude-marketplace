---
phase: 60-hook-execution-payload-translators-env-vars
plan: 03
subsystem: bridges
tags: [hooks, reducer, adapter, composite-handler, esm, node-test, discriminated-union]

requires:
  - phase: 60-hook-execution-payload-translators-env-vars
    provides: HookExecResult + parseHookStdout + dispatchHookExec body + RoutingEntry.claudeEvent (Plan 60-02)
  - phase: 60-hook-execution-payload-translators-env-vars
    provides: 8 payload translators (Plan 60-01)
  - phase: 59-bridge-dispatch-core-debug-seam
    provides: registerHooksBridge + composite handler + dispatch core + hookDebugLog seam
provides:
  - bridges/hooks/event-adapters.ts -- 4 per-Pi-event adapters (D-60-03) + applyMutationInPlace helper
  - bridges/hooks/dispatch.ts -- D-60-02 reducer loop (reduceBucket) + adapter wiring at composite-handler exit
  - HookExecutor type alias widened from Promise<void> to Promise<HookExecResult> (D-59-04 signature evolution)
  - CompositeReturnFor<E> bridge mapping each claudeEvent to its Pi-side handler return type
  - platform/pi-api.ts -- structural ToolResultEventResult + PiTextContentBlock (peer-dep export gap workaround)
  - tests/architecture/hooks-adapters.test.ts (23 fixtures, Blocks A-E)
  - tests/architecture/hooks-reducer.test.ts (12 fixtures, Blocks A-F)
affects:
  - 60-04 (lifecycle hardening -- WR-01 + WR-03; consumes the now-live exec layer)

tech-stack:
  added: []
  patterns:
    - "Discriminated outcome reducer (D-60-02) -- folds HookExecResult across the bucket with first-block-wins short-circuit, terminal stop, left-to-right mutate composition, assertNever exhaustiveness gate (NFR-7)"
    - "Per-Pi-event adapter table (D-60-03) -- one adapt* function per Pi event family (tool_call / tool_result / input / observation); each adapter narrows the discriminated union to the Pi-side handler return shape"
    - "Mutate-and-finalResult dual write: mutate updates both event in place (so next entry sees post-mutation) AND finalResult (so input adapter can convert additionalContext to { action: 'transform', text })"
    - "Wave 0 architecture pin -- per-block layout pinning the 4×4 = 16 adapter cells (hooks-adapters) and the 6 reducer / adapter invariants (hooks-reducer)"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - tests/architecture/hooks-adapters.test.ts
    - tests/architecture/hooks-reducer.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts (reducer + adapter wiring; HookExecutor widened to Promise<HookExecResult>)
    - extensions/pi-claude-marketplace/platform/pi-api.ts (re-export InputEventResult / ToolCallEventResult; define structural ToolResultEventResult + PiTextContentBlock)

key-decisions:
  - "Mutate carries forward as finalResult (planner discretion -- the plan text said 'finalResult stays at the prior outcome' but the D-60-03 adapter table requires the Input adapter to consume mutate.additionalContext as the Pi-side { action: 'transform', text } return; carrying mutate forward is the only way both contracts can be satisfied; applyMutationInPlace is idempotent on identical patches so the double-call from reducer + adapter is harmless)"
  - "applyMutationInPlace lives in event-adapters.ts (planner discretion picked event-adapters as the cleaner home -- the helper is the shared call site between the reducer and the adapter switch)"
  - "tool_result block adapter returns { isError: true, content: [{ type: 'text', text: reason }] } (planner discretion -- the Pi tool_result handler return shape has no block field; signal the block via isError + text content carrying the reason; mirrors Claude Code upstream's PostToolUse decision='block' semantics)"
  - "Structural ToolResultEventResult lives in platform/pi-api.ts (peer-dep export gap -- @earendil-works/pi-coding-agent does NOT re-export ToolResultEventResult; structural shape with content?: PiTextContentBlock[] is in-spec since the bridge only emits { type: 'text', text } blocks)"

patterns-established:
  - "Reducer template: let finalResult = { kind: 'noop' }; for-of bucket; await activeExecutor; switch on r.kind; block/stop -> capture+return; mutate -> applyMutationInPlace + capture; noop -> continue; default -> assertNever (NFR-7 exhaustiveness)"
  - "CompositeReturnFor<E> mapped type: PreToolUse -> ToolCallEventResult; UserPromptSubmit -> InputEventResult; observation events -> undefined"
  - "Test spy pattern: makeSpy(results: Record<pluginId, HookExecResult>) returns { calls, impl } so each architecture test can declaratively pin the per-entry outcome the executor returns"

requirements-completed: []

duration: ~40min
completed: 2026-06-15
---

# Phase 60 Plan 03: Reducer Loop + Per-Pi-Event Adapter Summary

**The dispatch chain is end-to-end live: a Pi event fires -> matcher narrows -> dispatchHookExec runs with the real spawn body (Plan 60-02) -> the D-60-02 reducer composes outcomes across entries with first-block-wins + left-to-right mutate -> the D-60-03 per-event adapter returns the Pi-shaped value the runtime expects.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-15T03:21:00Z
- **Completed:** 2026-06-15T04:03:41Z
- **Tasks:** 2
- **Files modified:** 5 (3 created + 2 modified)
- **Test impact:** +35 tests added (23 adapter fixtures + 12 reducer fixtures)
- **`npm run check`:** GREEN end-to-end

## Reducer-Loop Shape

```
┌─ compositeHandlerFor(claudeEvent, capturedEpoch) ────────────────────┐
│                                                                       │
│  if (capturedEpoch !== currentEpoch()) return undefined;  // DISP-03 │
│                                                                       │
│  bucket = getRoutingBucket(claudeEvent);                              │
│  if (bucket.length === 0) return undefined;                           │
│                                                                       │
│  finalResult = await reduceBucket(bucket, event, ctx, matcherFires):  │
│                                                                       │
│      ┌─ for entry in bucket ───────────────────────────────────────┐ │
│      │   if (!matcherFires(entry)) continue;                        │ │
│      │                                                              │ │
│      │   r = await activeExecutor(entry, event, ctx);   // D-59-04 │ │
│      │                                                              │ │
│      │   switch (r.kind):                                           │ │
│      │     case "block":   finalResult = r; return;     // D-60-02 │ │
│      │     case "stop":    finalResult = r; return;     // D-60-02 │ │
│      │     case "mutate":  applyMutationInPlace(event, r);          │ │
│      │                     finalResult = r; continue;   // D-60-02 │ │
│      │     case "noop":    continue;                                │ │
│      │     default:        assertNever(r);              // NFR-7   │ │
│      └──────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  return adaptForEvent(claudeEvent, finalResult, event); // D-60-03   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

Cross-reference: CONTEXT.md D-60-02 lines 109-118 (the canonical reducer loop) and RESEARCH.md § "Sequential-await reducer template" lines 779-801.

The `toolResultCompositeHandler` body has the same reducer shape; the only difference is the `event.isError ? "PostToolUseFailure" : "PostToolUse"` bucket selection happens BEFORE the reducer loop, preserving DISP-01.

## Per-Pi-Event Adapter Table (D-60-03)

| Pi event | Claude bucket | block | mutate | stop | noop |
| --- | --- | --- | --- | --- | --- |
| `tool_call` | PreToolUse | `{ block: true, reason }` | mutate `event.input` in place + return `undefined` | debug-log + `undefined` | `undefined` |
| `tool_result` | PostToolUse + PostToolUseFailure | `{ isError: true, content: [{ type: "text", text: reason }] }` | mutate `event` in place + return `undefined` | debug-log + `undefined` | `undefined` |
| `input` | UserPromptSubmit | `{ action: "handled" }` | `{ action: "transform", text: result.additionalContext }` (or `undefined` if no `additionalContext`) | debug-log + `undefined` | `undefined` |
| `session_start` / `session_shutdown` / `session_before_compact` / `session_compact` | SessionStart / SessionEnd / PreCompact / PostCompact | debug-log + `undefined` (no Pi block slot) | `undefined` (no mutation surface) | debug-log + `undefined` | `undefined` |

Each adapter exhaustively switches on `result.kind` and routes through `assertNever` (NFR-7). Adding a fifth `HookExecResult` arm would fail `tsc` at every call site.

## Accomplishments

- **`event-adapters.ts` ships** with 4 per-Pi-event adapters + `applyMutationInPlace` helper. Pure leaf -- only imports `hookDebugLog`, the `HookExecResult` / `assertNever` pair, and the Pi event payload types.
- **`dispatch.ts` rewritten** with the D-60-02 reducer (`reduceBucket`) factored out for sharing across both composite-handler factories. `HookExecutor` type alias widened from `Promise<void>` (D-59-04 stub) to `Promise<HookExecResult>` (D-60-01 outcome union). Per-event adapter dispatch lives in `adaptForEvent(claudeEvent, finalResult, event)` for the six-uniform handler; `toolResultCompositeHandler` calls `adaptToolResultResult` directly because its `claudeEvent` is fixed to the two PostToolUse buckets.
- **`CompositeReturnFor<E>` type bridge** maps each `claudeEvent` to its Pi-side handler return type so closures expose the right shape to `pi.on`. Pre/UserPromptSubmit get `ToolCallEventResult | undefined` / `InputEventResult | undefined`; the four observation events get `undefined`.
- **`platform/pi-api.ts` re-exports** `InputEventResult` + `ToolCallEventResult` (peer-dep exports them from root) and defines a structural `ToolResultEventResult` + `PiTextContentBlock` (peer-dep export gap; the structural shape is in-spec since the adapter only emits `{ type: "text", text }` content blocks).
- **23 architecture fixtures in `hooks-adapters.test.ts`** -- Blocks A-D cover the 4 adapters × 4 result arms; Block E pins exhaustiveness (every adapter has `assertNever`) + IL-2 (no `ctx.ui.notify`; no `process.stdout/stderr.write`).
- **12 architecture fixtures in `hooks-reducer.test.ts`** -- Blocks A-F pin first-block-wins (entries 2-3 NOT invoked), mutate composition (entry-2 sees post-mutation event; two mutates compose left-to-right with entry-2 overlaying entry-1's shared keys), stop terminal, full noop chain, `tool_result.isError` split survives the reducer rewrite, and per-event adapter return-shape pinning.
- **Phase 59 invariants preserved** -- `tests/architecture/hooks-dispatch.test.ts` (DISP-01..04 + OBS-01 + D-59-05) and `tests/bridges/hooks/event-router.test.ts` stay GREEN with no source changes at this commit (their spy returns were already widened in Plan 60-02 -- `return Promise.resolve({ kind: "noop" as const })`).
- **`npm run check` GREEN** -- typecheck + ESLint + Prettier + 2081+ unit tests + 10 integration tests.

## Task Commits

1. **Task 1: Ship per-Pi-event adapters (D-60-03)** -- `2607f26` (feat)
2. **Task 2: Reducer + per-event adapter wiring (D-60-02 / D-60-03)** -- `5b6de5c` (feat)

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` -- 4 per-Pi-event adapters (D-60-03) + `applyMutationInPlace` helper. Pure leaf in the hooks-bridge subtree; not re-exported from `bridges/hooks/index.ts`.
- `tests/architecture/hooks-adapters.test.ts` -- 23 fixtures across Blocks A-E pinning every adapter cell + the NFR-7 exhaustiveness gate + IL-2 sole-sink invariant.
- `tests/architecture/hooks-reducer.test.ts` -- 12 fixtures across Blocks A-F pinning D-60-02 reducer semantics + D-60-03 per-event return-shape table.

### Modified

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` -- reducer body (`reduceBucket`) + per-event adapter wiring at the composite-handler exit; `HookExecutor` type widened; `CompositeReturnFor<E>` mapped type added; per-event filter dispatch (`entryFires`) unchanged.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` -- re-export `InputEventResult` + `ToolCallEventResult`; define structural `ToolResultEventResult` + `PiTextContentBlock` to bridge the peer-dep export gap.

## Decision Closure

- **D-60-02 (first-block-wins + left-to-right mutate composition):** CLOSED. The reducer in `dispatch.ts` short-circuits on `block` and `stop`; `mutate` mutates the Pi event in place via `applyMutationInPlace` so the next entry's executor sees post-mutation state, AND carries the mutate forward as `finalResult` so the per-event adapter at exit can consume it. Pinned by `hooks-reducer.test.ts` Blocks A-D (and Block B-2 for two-mutate left-to-right composition).
- **D-60-03 (per-Pi-event adapter table):** CLOSED. `event-adapters.ts` exports 4 adapters covering the 4 Pi event families; each adapter exhaustively switches on `result.kind` with an `assertNever` default arm. Pinned by `hooks-adapters.test.ts` Blocks A-D + Block E (exhaustiveness + IL-2).
- **D-59-04 (signature evolution -- `Promise<void>` -> `Promise<HookExecResult>`):** CLOSED. The `HookExecutor` type alias in `dispatch.ts` widens; the `_setExecutorForTest` seam evolves automatically; the spy injections in `hooks-dispatch.test.ts` + `event-router.test.ts` were already updated in Plan 60-02 and stay GREEN.
- **D-60-01 (discriminated outcome union):** CONSUMED throughout. The reducer + each adapter switch on `result.kind` with `assertNever` exhaustiveness; adding a fifth arm fails `tsc` at multiple call sites.

## Phase 59 architecture-test invariants preserved

- **DISP-01** (registerHooksBridge calls `pi.on` exactly 7 times with the locked event-name set) -- still GREEN (no source change at this commit; Plan 60-02 already updated `pi.on("tool_result", ...)` and the test fixture for the spy return type).
- **DISP-02** (rebuildRoutingTables produces exactly the BUCKET_A_EVENTS 8-tuple keyset) -- still GREEN.
- **DISP-03** (composite handler with stale `capturedEpoch` no-ops without invoking `dispatchHookExec`) -- still GREEN; the new reducer body preserves the epoch-check-first ordering.
- **DISP-04** (sequential awaited fan-out, cross-plugin sort by `compareByNameThenScope`, within-plugin declaration order via `declarationIndex`) -- still GREEN; the reducer is sequential `for-of` with `await` (no `Promise.all`); the early-exit on `block` / `stop` is compatible because DISP-04 pins ordering, not every-entry-must-run.
- **OBS-01** (`console.error` appears ONLY in `shared/debug-log.ts` within the extension source tree; `eslint.config.js` scopes the no-console allowance to the 3 sanctioned files) -- still GREEN; `event-adapters.ts` routes all dropped-outcome side effects through `hookDebugLog`.
- **D-59-01** (`tool_result` composite handler routes `event.isError` to PostToolUse / PostToolUseFailure) -- still GREEN; the `isError` split happens BEFORE the reducer loop runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] Mutate carries forward as `finalResult` (planner-discretion deviation from plan text)**

- **Found during:** Task 2 test run -- the "UserPromptSubmit mutate.additionalContext returns `{ action: 'transform', text }`" test red-failed because the reducer dropped the mutate after applying it in place.
- **Issue:** The plan text says "finalResult stays at the prior outcome (a mutate is not, by itself, a terminal Pi-side return)". The D-60-03 adapter table simultaneously requires `adaptInputResult(mutate.additionalContext) -> { action: "transform", text }`. Both contracts cannot hold without the reducer carrying mutate forward as `finalResult`.
- **Fix:** The reducer's mutate arm now both applies the in-place mutation AND captures the mutate as `finalResult`. The double effect (reducer mutates + adapter mutates again) is harmless because `applyMutationInPlace` is idempotent on identical patches (`Object.assign` of same key=value pairs).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`.
- **Verification:** All 12 reducer fixtures + all 23 adapter fixtures GREEN.
- **Committed in:** `5b6de5c` (Task 2 commit -- the fix landed atomically with the reducer rewrite).

**2. [Rule 3 - Blocking issue] Peer-dep `ToolResultEventResult` is not re-exported from `@earendil-works/pi-coding-agent`**

- **Found during:** Task 2 typecheck (after adding `pi.on("tool_result", toolResultCompositeHandler(...))` with a narrowed return type).
- **Issue:** `@earendil-works/pi-coding-agent`'s root `dist/index.d.ts` re-exports `InputEventResult` + `ToolCallEventResult` but NOT `ToolResultEventResult` (gap in the peer-dep export surface). Importing it caused TS2724 ("has no exported member named 'ToolResultEventResult'").
- **Fix:** Defined a structural `ToolResultEventResult` + `PiTextContentBlock` in `platform/pi-api.ts` mirroring the peer-dep's internal `core/extensions/types.d.ts` shape. The structural shape is in-spec at runtime because the bridge's adapter only emits `{ type: "text", text }` content blocks, which the peer-dep narrows to `(TextContent | ImageContent)[]` internally.
- **Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`.
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean; `pi.on("tool_result", toolResultCompositeHandler(capturedEpoch))` typechecks against the structural return.
- **Committed in:** `5b6de5c` (Task 2 commit).

**3. [Rule 3 - Blocking issue] ESLint flat-config violations on Task 1 + Task 2**

- **Found during:** Task 1 + Task 2 pre-commit (`npm lint`).
- **Issue:** Multiple lint trips: `@typescript-eslint/no-unnecessary-type-assertion` (Task 1 -- a satisfied `InputEvent` const assertion), `@typescript-eslint/no-confusing-void-expression` (Task 1 -- calling `adaptObservationResult(...)` inside `assert.equal(...)` because its return type is `undefined`; Task 2 -- arm `return adaptObservationResult(result)` in `adaptForEvent` triggered the same rule), `@typescript-eslint/prefer-includes` (Task 1 -- regex `.test(...)` for substring checks), `import-x/order` (Task 2 -- `event-router.ts` import out of order), `@stylistic/padding-line-between-statements` (Task 2 -- missing blank line in `makeSpy`).
- **Fix:** (a) dropped the unnecessary `as InputEvent` assertion; (b) switched `assert.equal(adaptObservationResult(...), undefined)` to call the adapter as a statement (it's typed `: undefined` -- the side effect IS the test); (c) replaced regex `.test()` with `String#includes()` for substring matches; (d) reordered imports in `dispatch.ts` (`event-router` before `exec-result`); (e) split the `adaptForEvent` observation arm into `adaptObservationResult(result); return undefined;`; (f) added a blank line before `return { calls, impl }` in `makeSpy`.
- **Files modified:** `tests/architecture/hooks-adapters.test.ts`, `tests/architecture/hooks-reducer.test.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`.
- **Verification:** `npm run lint` GREEN; pre-commit GREEN.
- **Committed in:** `2607f26` (Task 1) + `5b6de5c` (Task 2).

**4. [Rule 1 - Bug] Comment-policy violations (`Phase 59` x 2 in `dispatch.ts`)**

- **Found during:** Task 2 acceptance-criteria grep (`grep -nE "Phase [0-9]|Plan [0-9]|Pitfall [0-9]|Pattern [0-9]" ...`).
- **Issue:** The docstring at lines 39 + 78 of the rewritten `dispatch.ts` mentioned "the Phase 59 contract" and "the Phase 59 stub". Both are forbidden by `.claude/rules/typescript-comments.md`.
- **Fix:** Replaced the planning-step references with the surviving decision/contract anchors (`DISP-04 pins sequential ordering` and `the DISP-04 stub previously returned Promise<void>`). Comment policy gate clean.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`.
- **Committed in:** Folded into the same `5b6de5c` Task 2 commit (the fix was made before commit).

**5. [Rule 3 - Blocking issue] `pi.on("tool_result", ...)` overload-resolution mismatch on the wider return type**

- **Found during:** Task 2 typecheck (intermediate state -- before deviation 2 was applied).
- **Issue:** With my initial `ToolResultEventResult` defined as `{ content?: unknown[] }`, the peer-dep's `pi.on("tool_result", handler)` overload (which expects `Promise<ToolResultEventResult | void>` where the peer-dep's `content?: (TextContent | ImageContent)[]`) rejected our return type because `unknown[]` is wider than `(TextContent | ImageContent)[]` (covariance failure on the return slot).
- **Fix:** Narrowed the local `ToolResultEventResult`'s `content` to `PiTextContentBlock[]` where `PiTextContentBlock = { type: "text"; text: string }` -- structurally compatible with the peer-dep's internal `TextContent` interface. The `pi.on` overload now accepts the handler without a cast.
- **Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`.
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean; `pi.on("tool_result", ...)` overload resolves without `as unknown as` cast.
- **Committed in:** `5b6de5c` (Task 2 commit -- folded with deviation 2).

---

**Total deviations:** 5 auto-fixed (1 planner-discretion semantic fold, 1 peer-dep export gap workaround, 1 covariance-narrowing fix, 1 mechanical lint cleanup, 1 comment-policy cleanup).
**Impact on plan:** Scope unchanged; deliverables all present; the reducer's mutate-carries-forward semantics close a contract gap between the plan text and the D-60-03 adapter table.

## Issues Encountered

None significant. The reducer + adapter wiring was straightforward once the mutate-and-finalResult dual-write decision was made. The peer-dep `ToolResultEventResult` export gap was an unexpected blocking issue resolved with a structural local type.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` exists -- FOUND
- `tests/architecture/hooks-adapters.test.ts` exists -- FOUND (23 fixtures GREEN)
- `tests/architecture/hooks-reducer.test.ts` exists -- FOUND (12 fixtures GREEN)
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` modified (reducer + adapter wiring) -- FOUND (`grep -cE "Promise<HookExecResult>" dispatch.ts` = 3; `grep -cE "adapt(ToolCall|ToolResult|Input|Observation)Result" dispatch.ts` = 9; `grep -cE "assertNever" dispatch.ts` = 3)
- `extensions/pi-claude-marketplace/platform/pi-api.ts` modified (re-exports + structural ToolResultEventResult) -- FOUND
- Task 1 commit `2607f26` -- FOUND in `git log`
- Task 2 commit `5b6de5c` -- FOUND in `git log`
- `node --test tests/architecture/hooks-reducer.test.ts tests/architecture/hooks-adapters.test.ts tests/architecture/hooks-dispatch.test.ts tests/architecture/hooks-exec.test.ts tests/architecture/hooks-translators.test.ts` -- 69 tests GREEN
- `npm run check` -- GREEN end-to-end (typecheck + lint + format:check + 2081+ unit + 10 integration)
- Comment policy gate (`Phase N` / `Plan N` / `Pitfall N` / `Pattern N` ban) -- no offenders in any new/modified source file

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

Plan 60-04 (lifecycle hardening -- WR-01 + WR-03) can now:

1. Wire `rebuildRoutingTables` calls into `orchestrators/plugin/install.ts` + `uninstall.ts` AFTER the per-plugin lock's stage commit / drop. The dispatch chain is end-to-end live, so install/uninstall observe routing-table updates without a `/reload` -- the correctness-critical contract for D-60-05.
2. Add the ~5 LOC clear-project-arm prefix to `hydrateProjectScopeForCwd` in `bridges/hooks/event-router.ts` for WR-01.
3. Audit `reinstall.ts` / `update.ts` to confirm the rebuild flows through the existing uninstall-then-install paths.

The reducer + adapter contracts are frozen for the rest of Phase 60. No blockers.

---
*Phase: 60-hook-execution-payload-translators-env-vars*
*Completed: 2026-06-15*
