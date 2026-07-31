# Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure - Research

**Researched:** 2026-07-30
**Domain:** Pi extension event dispatch (hooks bridge) — settle-time event promotion, re-entry, loop protection, error classification
**Confidence:** HIGH (Pi API surface, existing bridge machinery, and classifier evidence all verified in-session against installed/published typings and dist)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-88-01 (cap-trip notification):** The one-shot override-cap notification is **warning severity** (tri-state: the turn ended / protection worked, but a plugin's block desire was deliberately suppressed). Form: non-empty summary first line on the `Warning:` label (e.g. "Stop hook override cap reached.") with detail naming the plugin and stating 8 consecutive blocks / turn ended despite an active block; exact wording finalized during planning within the notify grammar. Ships with a **new byte-stable `docs/output-catalog.md` entry + catalog-UAT coverage** (IL-2: through `ctx.ui.notify`; summary-line grammar per the notify-grammar invariant).
- **D-88-02 (StopFailure classification):** **errorMessage-only** — a substring/regex table over Pi's rendered `errorMessage` mapping into the 10-value vocabulary, with `unknown` as the in-vocabulary fallback; `length` maps deterministically to `max_output_tokens`. Do NOT subscribe to `after_provider_response`; do NOT hold an HTTP-status cell (the firming variant was explicitly declined — staleness across auto-retries, new subscription, no consumer needs it).
- **D-88-03 (verification harness):** **Both** mocked and live in-phase — (a) mocked-Pi event-sequence unit tests through the router/dispatcher with a fake `pi` (offline, deterministic, in `npm run check`) covering the gate, decision-control arms, loop protections, and classifier; (b) a **live Pi runtime UAT** answering the four implementation-time questions against a real Pi >= 0.80.5. Live UAT expected to surface as `human_needed` items if it cannot run fully scripted.

### Claude's Discretion
- Cache-cell placement for the last assistant message under existing epoch/`/reload` hygiene (stale cell must never leak; last-write-wins across auto-retry/compaction).
- `stop_hook_active` state mechanics (per-session; set on block-re-entry, cleared on next genuine `input`; bridge-injected messages do not pass through `input`).
- Hook timeout: Stop/StopFailure inherit the existing executor timeout (upstream 600s) — verify parity; no bespoke timeout.
- Exact substring-table entries for the classifier (offline-testable fixture strings; keep small and evidence-based).
- Re-entry message `customType` naming (precedent: `claude-hook-rewake` with `display:false`; content model-visible, display-suppressed per STOP-03).
- Live-UAT session script shape (canary plugin + abort/queue scenarios).
- Consecutive-block counter reset semantics (upstream: 8 *consecutive* — a non-block outcome resets) and the one-shot latch scope.

### Deferred Ideas (OUT OF SCOPE)
- `docs/hooks-compatibility.md` + `docs/research/claude-hooks-vs-pi-events.md` reconcile — Phase 89 (DOC-04, DOC-05).
- `after_provider_response` HTTP-status firming for the classifier — explicitly declined for v1.16 (D-88-02).
- UPSTREAM-SETTLE (cancelable settle / continue-directive) — v2, would erase the timing shift.
- SubagentStop blocking semantics — PAYL-V2-07, needs pi-subagents cooperation.
- The turn-boundary "timing shift" (re-entry starts a new turn) is documented in Phase 89, NOT fixed here (invisible to hook scripts).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOP-01 | Single `agent_settled` subscriber; stopReason gate; last-assistant cached from `agent_end.messages` under epoch hygiene | Pattern 1, 4; cache cell in `event-router.ts`; StopReason verified pi-ai:273 |
| STOP-02 | Stop stdin: common fields + `last_assistant_message` + `stop_hook_active`; omit `background_tasks`/`session_crons` | Pattern 5 (session-end.ts template); synthetic-event translator input |
| STOP-03 | `decision:block` → re-enter via `sendMessage(followUp+triggerTurn)`, display-suppressed | Pattern 2 (async-rewake:431 precedent); wire-protocol:110 |
| STOP-04 | exit-2 → block with stderr reason | wire-protocol:37-39 (already implemented) |
| STOP-05 | `additionalContext` without block → keeps going (same re-entry) | wire-protocol:154-157 → `{kind:"mutate"}`; Pattern 3 |
| STOP-06 | `continue:false` precedence over block | wire-protocol:105-108; Pitfall 3 / Open Q2 (cross-hook) |
| STOP-07 | `stop_hook_active` set/clear-on-`input`; 8-block cap + one-shot warning | Pattern (loop state cells); Pitfall 4,5; D-88-01 |
| SFAIL-01 | StopFailure observation-only (output/exit ignored) | Pattern 3 (discard reduceBucket result) |
| SFAIL-02 | Payload: `error` + optional `error_details` + `last_assistant_message` = rendered errorMessage | Pattern 5; SFAIL-02 envelope |
| SFAIL-03 | Classify into closed 10-value vocab; `length`→`max_output_tokens`; `unknown` fallback | Classifier grounding (agent-session.js:1972,1989); Phase 87 closed set |
</phase_requirements>

## Summary

Phase 88 wires dispatch for the two events Phase 87 already admitted (`Stop`, `StopFailure`). All the load-bearing machinery already exists in `bridges/hooks/`: the routing table, the `reduceBucket` reducer, `dispatchHookExec` (spawn + timeout + wire-protocol parse), the per-event payload translators, and the `pi.sendMessage(..., { deliverAs, triggerTurn })` re-entry precedent in `async-rewake/registry.ts`. The new work is a **single `agent_settled` subscriber** that reads a **cached last-assistant message** (captured from the preceding `agent_end.messages`), gates on its `stopReason`, and routes to either the `Stop` bucket (full decision-control contract) or the `StopFailure` bucket (observation-only), plus a per-session `stop_hook_active` flag / 8-block cap and a one-shot warning notify.

The single highest-risk finding is a **BLOCKING dev-tree prerequisite**: the installed `node_modules/@earendil-works/pi-coding-agent` is **0.79.10**, which **predates `agent_settled`** and is **missing its nested `pi-agent-core` / `pi-ai` sub-deps entirely**. `pi.on("agent_settled", ...)` will NOT typecheck against the installed tree. The lockfile already resolves the peer to **0.82.1** (which has `agent_settled` — verified via unpkg), so a dev-tree refresh (`npm install`) must land before any settle subscription can compile.

**Primary recommendation:** Land a dev-tree refresh to 0.82.1 as the first task (verify `pi.on("agent_settled")` typechecks), then build one bespoke `settleHandlerFor(capturedEpoch, pi)` subscriber that reuses `reduceBucket` + `dispatchHookExec`, fold `Stop`/`StopFailure` into `DISPATCHABLE_EVENTS` (which compile-forces the translator + required-field entries), and keep the settle handler's result-adaptation SEPARATE from the per-Pi-event `adaptForEvent` switch (widen its `Exclude<>` to also drop `Stop`/`StopFailure`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settle-time event fan-out (Stop vs StopFailure gate) | Hooks bridge (`bridges/hooks/`) | Pi runtime (`agent_settled` fire-point) | Pi emits `agent_settled`; the bridge owns the gate + dispatch |
| Last-assistant-message cache | Hooks bridge module state (`event-router.ts`) | Pi runtime (`agent_end.messages`) | `AgentSettledEvent` carries no payload; the bridge must cache from `agent_end` |
| Hook subprocess exec (spawn/timeout/stdin) | Hooks bridge (`dispatch-exec.ts`) | OS process | Existing `dispatchHookExec` path — unchanged |
| Wire-protocol decision parse | Hooks bridge (`wire-protocol.ts`) | — | Existing `parseHookStdout` already covers block/exit-2/additionalContext/continue:false |
| Block re-entry (new turn) | Hooks bridge → Pi API `sendMessage` | Pi agent loop | `sendMessage({deliverAs:"followUp", triggerTurn:true})` starts a turn from idle |
| `stop_hook_active` / 8-block cap | Hooks bridge module state | Pi `input` event (reset signal) | Per-session flag; upstream loop-protection contract |
| Cap-trip warning | `shared/notify.ts` seam → `ctx.ui.notify` | — | IL-2: all user-visible output through the notify boundary |
| Error-type classification | Hooks bridge (`StopFailure` translator/classifier) | Pi `errorMessage` string | errorMessage-only substring table → closed 10-value vocab (D-88-02) |

## Standard Stack

No new external dependencies. This phase is pure in-repo dispatch wiring on the existing Node built-in + Pi peer-dep stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | peer `>=0.80.5`; dev/lockfile `0.82.1` | `agent_settled`, `AgentEndEvent.messages`, `sendMessage`, `input` | Required peer; provides the entire event surface. [VERIFIED: unpkg 0.82.1 types.d.ts:539,868] |
| `@earendil-works/pi-ai` (transitive) | `0.82.1` | `StopReason`, `AssistantMessage.errorMessage` | Provider protocol contract types. [VERIFIED: unpkg pi-ai 0.82.1 types.d.ts:273,289-290] |
| `node:child_process` (built-in) | Node `>=20.19.0` | hook subprocess spawn | Existing `dispatchHookExec` path — no new import site |

**No `npm install` of new packages.** The only dependency action is a **dev-tree refresh** so `node_modules` matches the lockfile's already-resolved 0.82.1.

### Version verification (session-confirmed)
- Installed tree: `node_modules/@earendil-works/pi-coding-agent` = **0.79.10** (stale; `agent_settled` absent; `pi-agent-core`/`pi-ai` sub-deps missing). [VERIFIED: node_modules package.json + `grep agent_settled` returns empty]
- Lockfile resolves: pi-coding-agent **0.82.1**, nested pi-agent-core **0.82.1**, pi-ai **0.82.1**. [VERIFIED: package-lock.json:549-567]
- `package.json` peer floor: `>=0.80.5` (Phase 87 FLOOR-01); devDep `^0.82.1`. [VERIFIED]
- Live `pi` CLI on this machine: **0.80.10** — meets `>=0.80.5`, has `agent_settled`. [VERIFIED: `pi --version`]

## Package Legitimacy Audit

No external packages are installed in this phase. All symbols come from the already-declared `@earendil-works/*` peer/dev deps and Node built-ins. **Audit N/A** — no registry additions.

## Architecture Patterns

### System Architecture Diagram

```
Pi runtime
  │
  ├─ agent_end (per low-level run; may auto-retry/compact/queue after)
  │     └─▶ [NEW] agentEndCacheHandler(capturedEpoch)
  │            └─ cache ← findLastAssistant(event.messages)   (last-write-wins)
  │
  ├─ agent_settled (exactly once per logical completion)
  │     └─▶ [NEW] settleHandlerFor(capturedEpoch, pi)
  │            ├─ epoch check → read cached last-assistant message
  │            ├─ GATE on message.stopReason:
  │            │     "stop"    → Stop bucket   (full decision control)
  │            │     "error"   → StopFailure bucket (classify errorMessage)
  │            │     "length"  → StopFailure bucket (error = max_output_tokens)
  │            │     "aborted" → neither (return)
  │            │     "toolUse" → defensive no-op (return)
  │            │
  │            ├─ Stop path:
  │            │     reduceBucket("Stop") ─→ dispatchHookExec ─→ spawn+wire-protocol
  │            │        result:
  │            │          stop(continue:false) → do NOT re-enter (precedence)   [STOP-06]
  │            │          block(reason)         → sendMessage(reason, followUp+triggerTurn)  [STOP-03/04]
  │            │          mutate.additionalContext → sendMessage(ctx)          [STOP-05]
  │            │          noop                   → nothing
  │            │        side-effects: set stop_hook_active; ++blockCount;
  │            │                      cap at 8 → suppress + one-shot Warning notify [STOP-07]
  │            │
  │            └─ StopFailure path (observation-only) [SFAIL-01]:
  │                  reduceBucket("StopFailure") ─→ dispatchHookExec  (result DISCARDED)
  │
  └─ input (genuine user input only) [existing UserPromptSubmit sub + NEW reset]
        └─▶ clear stop_hook_active; reset consecutive-block counter + one-shot latch  [STOP-07]
```

### Recommended structure (files touched — all existing)
```
bridges/hooks/
├── event-router.ts        # +cache cell, +stop_hook_active/blockCount/latch cells,
│                          #   +agent_end + agent_settled + input-reset subscriptions,
│                          #   +epoch-hygiene reset in registerHooksBridge
├── settle.ts (NEW)        # settleHandlerFor + agentEndCacheHandler + the Stop gate/re-entry adapter
├── dispatch-exec.ts       # TRANSLATORS/REQUIRED_EVENT_FIELDS gain Stop/StopFailure entries
├── dispatch.ts            # widen Exclude<> to also drop Stop/StopFailure from adaptForEvent/entryFires/compositeHandlerFor
├── wire-protocol.ts       # reused UNCHANGED (already covers all Stop decision arms)
├── payloads/stop.ts (NEW) # Stop stdin translator
├── payloads/stop-failure.ts (NEW) # StopFailure stdin translator + errorMessage classifier
└── async-rewake/registry.ts # TRANSLATORS Record<DispatchableEvent> forces Stop/StopFailure entries too
domain/components/hook-events.ts   # DISPATCHABLE_EVENTS 8→10; drop or keep isDispatchableEvent guards
shared/notify.ts                   # NEW warning seam for the cap-trip notify (IL-2)
docs/output-catalog.md             # NEW byte-stable cap-trip warning entry + catalog-UAT fixture
```

### Pattern 1: `agent_settled` reads a cached `agent_end` message
`AgentSettledEvent` carries no payload (`{ type: "agent_settled" }` — [VERIFIED: unpkg 0.82.1 types.d.ts:539-541]). The dispatcher must cache `agent_end.messages` and read the cached last-assistant message at settle time. `agent_end` fires per low-level run; last-write-wins across auto-retry/compaction chains yields the final run's messages (the authority doc § Dispatcher design; STOP-01). The cache cell rides the SAME module-state + epoch hygiene as `pendingSessionStartContext` (event-router.ts:182), reset in `registerHooksBridge` (event-router.ts:803) so `/reload` can't leak a stale cell.

**Finding the last assistant message:** walk `event.messages` for `role === "assistant"` (with a `stopReason`). Pi's own `AssistantMessage` is `{ ...; stopReason: StopReason; errorMessage?: string }` [VERIFIED: pi-ai 0.82.1 types.d.ts:279-290]. `AgentEndEvent.messages: AgentMessage[]` [VERIFIED: 0.82.1 types.d.ts:534]. `pi-api.ts` must re-export the relevant types (`AgentEndEvent`, `AgentSettledEvent`, and the `AssistantMessage`/`AgentMessage`/`StopReason` needed to read `stopReason`) — the platform boundary is the only sanctioned import site (`platform/pi-api.ts:40-57`).

### Pattern 2: block re-entry via `sendMessage` (precedent: async-rewake)
`async-rewake/registry.ts:431-442` is the exact precedent:
```typescript
// Source: bridges/hooks/async-rewake/registry.ts (existing)
pi.sendMessage(
  { customType: REWAKE_CUSTOM_TYPE, content, display: false, details: {...} },
  { deliverAs: lane },   // lane = ctx.isIdle() ? "nextTurn" : "followUp"
);
```
The installed 0.79.10 AND published 0.82.1 both expose `sendMessage<T>(message: Pick<CustomMessage<T>,"customType"|"content"|"display"|"details">, options?: { triggerTurn?: boolean; deliverAs?: "steer"|"followUp"|"nextTurn" })` [VERIFIED: 0.79.10 types.d.ts:290-293; 0.82.1 confirmed present]. `ctx.isIdle()` exists [VERIFIED: 0.82.1 types.d.ts:226,1184].

**Difference from async-rewake:** the Stop block re-entry MUST pass `{ deliverAs: "followUp", triggerTurn: true }` (STOP-03 / authority doc § Stop decision control). At settle the agent is idle, so `triggerTurn: true` is what starts the new turn. async-rewake uses `nextTurn` (no `triggerTurn`) when idle because it injects context the next turn picks up — a DIFFERENT semantic. Do not copy the `nextTurn` lane for Stop. `customType` naming is Claude's Discretion (precedent `claude-hook-rewake`; a distinct value such as `claude-hook-stop-block` avoids conflating the two re-entry semantics); `display: false` per STOP-03 (content model-visible, display-suppressed).

### Pattern 3: reuse `reduceBucket` + `dispatchHookExec`; keep settle result-adaptation bespoke
`reduceBucket(bucket, event, ctx, pi, matcherFires)` (dispatch.ts:177) already folds a bucket to one `HookExecResult` with first-block-wins / stop-terminal short-circuit, and `dispatchHookExec` (dispatch-exec.ts:155) handles spawn + timeout + `parseHookStdout`. The settle handler reuses BOTH but does NOT go through `adaptForEvent` (dispatch.ts:317) — that switch produces `ToolCallEventResult | InputEventResult | undefined` for the per-Pi-event registrations. Stop's outcome is a `sendMessage` side-effect + loop-state mutation, not a Pi handler return. So the settle handler owns a small bespoke adapter over the `HookExecResult` union:
- `{kind:"stop"}` (continue:false) → do NOT re-enter (STOP-06 precedence; already checked first in `parseHookStdout`, wire-protocol.ts:105-108).
- `{kind:"block", reason}` → `sendMessage(reason)` (STOP-03; exit-2 already maps to `{kind:"block", reason:stderr}` at wire-protocol.ts:37-39, so STOP-04 is free).
- `{kind:"mutate", additionalContext}` → `sendMessage(additionalContext)` (STOP-05; wire-protocol.ts:154-157 already produces this).
- `{kind:"noop"}` → nothing.

For `StopFailure` (SFAIL-01, observation-only): call the executors for each matching entry and **discard the result entirely** (output + exit code ignored — no re-entry, no loop guard). Reuse `reduceBucket` and drop its return, or a thin loop over the bucket.

### Pattern 4: `StopReason` gate (from Pi's own union)
`StopReason = "stop" | "length" | "toolUse" | "error" | "aborted"` [VERIFIED: pi-ai 0.82.1 types.d.ts:273]. Gate table (authority doc § Dispatcher design; STOP-01 / SFAIL-01):

| `stopReason` | Fires | Notes |
|---|---|---|
| `stop` | Stop | full decision control |
| `error` | StopFailure | classify from `errorMessage` |
| `length` | StopFailure | `error = max_output_tokens` deterministically (SFAIL-03) |
| `aborted` | neither | upstream suppresses Stop on user interrupt |
| `toolUse` | neither | defensive no-op — not expected at settle |

### Pattern 5: payload translators follow the house common-fields shape
`session-end.ts` is the template: common fields `session_id`, `transcript_path`, `cwd`, `hook_event_name` come from `TranslationContext` (`ctx.sessionId`, `ctx.transcriptPath`, `ctx.cwd`), with per-event fields appended (session-end.ts:24-32). `transcript_path` = `ctx.sessionManager.getSessionFile() ?? ""` (translation-context.ts:57).
- Stop stdin (STOP-02): common fields + `last_assistant_message` (from cache) + `stop_hook_active` (from loop state). `background_tasks`/`session_crons` omitted (contract-legal — no Pi task registry).
- StopFailure stdin (SFAIL-02): common fields + `error` (classified type) + optional `error_details` + `last_assistant_message` = rendered `errorMessage`.

**Design decision (Claude's Discretion — cache-cell placement):** the Stop/StopFailure translators need data (`last_assistant_message`, `stop_hook_active`, `error`) NOT present on the empty `AgentSettledEvent` nor in `TranslationContext`. Recommended: the settle handler constructs a **synthetic event object** carrying the cached message + loop flags and passes it into the `event: never` translator slot (mirrors how tool translators read `event.toolName`). Avoid widening the shared `TranslationContext` (used by all 8 existing translators).

### Anti-Patterns to Avoid
- **Firing on `agent_end` instead of `agent_settled`.** `agent_end` over-fires relative to Claude's contract (fires on runs Pi is about to auto-retry). Authority doc § Issue #103 assessment is explicit. Use `agent_settled`.
- **Routing Stop through `adaptForEvent`.** That switch is for per-Pi-event handler returns; Stop's effect is a side-effect. Keep it bespoke.
- **Letting a Stop hook take the `asyncRewake` branch.** `dispatchHookExec` (dispatch-exec.ts:176) routes `asyncRewake === true` to fire-and-forget `spawnAndRegister` and returns `{kind:"noop"}` BEFORE any result is available — which would silently break the Stop block contract (the settle handler needs the synchronous decision). Decide explicitly: either the settle path bypasses the async branch for Stop, or a Stop hook declaring `asyncRewake` is documented as degrading to no-block. Flag for the planner.
- **A second `pi.on("input")` that assumes single-handler semantics.** Pi supports multiple handlers per event (runner.d.ts:13 "all before_agent_start handlers"; :63 "no handlers"), so a dedicated input-reset subscription is safe — but note the pinned test asserts BOTH `calls.length` (grows) and `new Set(calls)` (a 2nd `"input"` does NOT grow the Set).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parse hook stdout → decision | New parser | `parseHookStdout` (wire-protocol.ts:32) | Already maps exit-2/block/continue:false/additionalContext to `HookExecResult` |
| Spawn + timeout + stdin cap | New spawn | `dispatchHookExec` (dispatch-exec.ts:155) | EXEC-01..04, 600s ladder, EPIPE/overflow defense done |
| Bucket fold (first-block-wins) | New loop | `reduceBucket` (dispatch.ts:177) | Reducer semantics + epoch already correct |
| Re-entry into agent loop | Custom queue | `pi.sendMessage(..., {deliverAs,triggerTurn})` | async-rewake:431 precedent; Pi API surface |
| User-visible warning | `console.warn` / stdout | new `shared/notify.ts` seam → `ctx.ui.notify` | IL-2; `notifyDiagnostic`/`notifyAsyncRewakeSummary` precedents |
| Timeout constant | New value | existing `DEFAULT_TIMEOUT_MS = 600_000` (dispatch-exec.ts:86) | Matches upstream 600s exactly; inherit unchanged |

**Key insight:** Phase 87 deliberately left the machinery a superset with a defensive `isDispatchableEvent` no-op arm. Phase 88 is mostly *removing* that belt and adding two translators + one bespoke subscriber — not building dispatch from scratch.

## Common Pitfalls

### Pitfall 1: Stale dev tree blocks compilation
**What goes wrong:** `pi.on("agent_settled", ...)` fails to typecheck; `AssistantMessage.stopReason`/`errorMessage` resolve to `any` (missing `pi-agent-core`/`pi-ai`).
**Why:** installed `node_modules` is 0.79.10 (no `agent_settled` overload; nested sub-deps absent). `skipLibCheck: true` (tsconfig.json) HIDES the missing sub-deps today only because no project code references those types yet.
**How to avoid:** first task = dev-tree refresh to lockfile 0.82.1 (`npm install`), then confirm `npm run typecheck` sees the `agent_settled` overload. Phase 87 SUMMARY (87-02:119) explicitly noted the 0.79.10 tree and that no `npm install` was run.
**Warning signs:** TS2769 (no overload matches `pi.on("agent_settled")`); `stopReason` typed `any`.

### Pitfall 2: The two env-flaky integration tests fail after a tree refresh
**What goes wrong:** `tests/integration/skill-path-resolution.test.ts` and `tests/integration/provenance-invisibility.test.ts` resolve the `pi-subagents` optional peer from global `npm root -g` and fail on a stale/absent global. [VERIFIED: MEMORY note + Phase 87 SUMMARY:118]
**How to avoid:** treat these as known environment skips, not regressions; do not let a refresh's ripple mask them. Gate `npm run check` interpretation accordingly.

### Pitfall 3: `continue:false` precedence vs first-block-wins across multiple Stop hooks
**What goes wrong:** STOP-06 says `continue:false` takes precedence over block. Within a SINGLE hook's JSON, `parseHookStdout` checks `continue:false` first (wire-protocol.ts:105), so it wins. But across MULTIPLE Stop hooks in the bucket, `reduceBucket` is first-outcome-wins (both `block` and `stop` short-circuit, dispatch.ts:199-206), so declaration order decides which fires.
**How to avoid:** decide the cross-hook precedence explicitly. Options: (a) accept declaration-order (documented), or (b) the settle adapter scans the bucket for any `stop` before honoring a `block`. Flag for planner; the requirement text (STOP-06 "takes precedence over any block decision") leans toward (b).

### Pitfall 4: `stop_hook_active` self-clear on re-entry
**What goes wrong:** if the bridge's own `sendMessage` re-entry fired `input`, the flag would clear immediately, defeating the loop guard.
**Why it doesn't (verified):** the `input` event fires only for genuine user input; bridge-injected custom messages do NOT pass through it (authority doc § Pi API surface). `InputEvent.source` ∈ `"interactive"|"rpc"|"extension"` (0.79.10 types.d.ts:595-599) — an extension-injected custom message is not a user `input`. This is one of the four live-UAT verification items (D-88-03 item 3).
**How to avoid:** reset the flag on `input` (a new dedicated subscription or folded into the existing input handler); confirm via live UAT that re-entry does not self-clear.

### Pitfall 5: Cap-trip warning vs the notify-grammar invariant
**What goes wrong:** `tests/architecture/notify-grammar-invariant.test.ts` requires every error/warning notify to have a non-empty summary first line + `\n\n` block, and its rule 3 matches a CLOSED summary grammar (`N (plugin|marketplace) operation(s) ... (failed|skipped).`). A bespoke warning ("Stop hook override cap reached.") does not fit that closed grammar.
**Nuance:** the invariant test only drives specific fixtures (it does not auto-scan every notify), and `notifyDiagnostic` (notify.ts:355) is a warning-severity bridge seam that emits `${header}\n\n${lines}` and is NOT in that fixture set. So a new cap-trip seam modeled on `notifyDiagnostic`/`notifyAsyncRewakeSummary` can ship warning-severity with a `\n\n` block without tripping the invariant — but D-88-01 says it must satisfy the notify-grammar invariant AND get catalog-UAT byte-equality coverage.
**How to avoid:** the planner must (a) add a new `shared/notify.ts` seam for the cap-trip (IL-2 sanctioned, like `notifyAsyncRewakeSummary`), (b) add a byte-stable `docs/output-catalog.md` entry + catalog-UAT fixture, and (c) reconcile with the grammar invariant — either conform to the closed grammar or add an explicit carve-out. See Open Questions.

### Pitfall 6: Widening `DISPATCHABLE_EVENTS` breaks two switches AND two translator tables
**What goes wrong:** adding `Stop`/`StopFailure` to `DISPATCHABLE_EVENTS` (hook-events.ts:100) forces entries in `TRANSLATORS` + `REQUIRED_EVENT_FIELDS` (dispatch-exec.ts:110,235) AND `TRANSLATORS` in `async-rewake/registry.ts:97` (all `Record<DispatchableEvent>`), and makes `adaptForEvent`/`entryFires`/`compositeHandlerFor` (dispatch.ts, keyed `Exclude<DispatchableEvent,"PostToolUse"|"PostToolUseFailure">`) non-exhaustive (TS7030/TS2366 — the exact Phase 87 Rule-3 fix, 87-02 SUMMARY:105-110).
**How to avoid:** widen those three `Exclude<>` sites to `Exclude<DispatchableEvent, "PostToolUse"|"PostToolUseFailure"|"Stop"|"StopFailure">` (Stop/StopFailure are dispatched by the settle handler, not the per-Pi-event composite). Add Stop/StopFailure translator entries to BOTH `TRANSLATORS` tables. The async-rewake entries never fire for these events (they have no async Pi surface) but the `Record` totality demands them — supply thin translators or reuse the dispatch-exec ones.

### Pitfall 7: Comment policy
`.claude/rules/typescript-comments.md` — no phase/milestone/plan refs in comments or test titles; decision IDs (`D-88-01`) and requirement IDs (`STOP-03`, `SFAIL-03`) ARE allowed. No bare `Pitfall N` refs.

## Code Examples

### The `agent_settled` gate skeleton (composed from verified surfaces)
```typescript
// Source: composed from bridges/hooks/dispatch.ts:249-272 (compositeHandlerFor)
//         + async-rewake/registry.ts:428-442 (sendMessage)
//         + pi-ai StopReason (types.d.ts:273)
export function settleHandlerFor(capturedEpoch: number, pi: ExtensionAPI) {
  return async (_event: AgentSettledEvent, ctx: ExtensionContext): Promise<void> => {
    if (capturedEpoch !== currentEpoch()) return;              // epoch hygiene (event-router.ts:355)
    const last = getCachedLastAssistant();                     // from agent_end cache cell
    if (last === undefined) return;
    switch (last.stopReason) {
      case "stop":    return runStopBucket(last, ctx, pi);      // full decision control
      case "error":   return runStopFailure(last, "error", ctx, pi);
      case "length":  return runStopFailure(last, "max_output_tokens", ctx, pi);
      case "aborted": return;                                   // neither (STOP-01)
      case "toolUse": return;                                   // defensive no-op
    }
  };
}
```

### Wire-protocol already covers every Stop arm (no changes needed)
```typescript
// Source: bridges/hooks/wire-protocol.ts:37-39, 105-116, 154-157 (existing)
// exit 2               -> { kind: "block", reason: stderr.trim() }   [STOP-04]
// { continue: false }  -> { kind: "stop" }  (checked FIRST)          [STOP-06]
// { decision: "block", reason } -> { kind: "block", reason }         [STOP-03]
// hookSpecificOutput.additionalContext -> { kind: "mutate", additionalContext }  [STOP-05]
```

### StopFailure classifier grounding (errorMessage substrings Pi actually emits)
Pi's OWN retry/limit classifiers are the authoritative substring vocabulary (the settle-time `errorMessage` is the provider's rendered string):
```
// Source: node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js
// :1972  _isNonRetryableProviderLimitError:
//   /GoUsageLimitError|FreeUsageLimitError|Monthly usage limit reached|
//    available balance|insufficient_quota|out of budget|quota exceeded|billing/i
// :1989  _isRetryableError:
//   /overloaded|provider.?returned.?error|rate.?limit|too many requests|429|
//    500|502|503|504|service.?unavailable|server.?error|internal.?error|.../i
// :164,766  throw new Error(`Authentication failed for "${provider}". ...`)
// :1463  529 (Anthropic overloaded)
```
Evidence-based substring table (SFAIL-03 closed 10-value vocab; `unknown` fallback):

| errorMessage contains (case-insensitive) | classified `error` type |
|---|---|
| `billing`, `quota exceeded`, `insufficient_quota`, `usage limit`, `available balance`, `out of budget` | `billing_error` |
| `rate limit`, `429`, `too many requests` | `rate_limit` |
| `overloaded`, `529` | `overloaded` |
| `authentication failed`, `401`, `403` | `authentication_failed` |
| `500`, `502`, `503`, `504`, `server error`, `internal error`, `service unavailable` | `server_error` |
| `model not found`, `model_not_found` | `model_not_found` |
| `invalid request`, `400` | `invalid_request` |
| (stopReason `length`) | `max_output_tokens` (deterministic, not from errorMessage) |
| anything else | `unknown` |

`oauth_org_not_allowed` has no observed Pi substring — keep it in the vocab (closed set is validated at admission, Phase 87) but expect `unknown` for org-policy errors unless a fixture string is found. Keep the table SMALL and fixture-tested (Claude's Discretion); classification is best-effort and non-load-bearing (no first-party plugin consumes StopFailure — authority doc § Executive summary).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `agent_end` as Stop fire-point (issue #103 proposal, v1.13 PAYL-V2-04) | `agent_settled` | pi 0.80.5 (2026-07-09) | Fires once per logical completion; avoids over-firing on auto-retry |
| StopFailure via `after_provider_response` HTTP-status synthesis (v1.13) | errorMessage-only substring table | D-88-02 | Declined the firming variant (staleness across retries, new subscription, no consumer) |
| Draft cap of 10 consecutive blocks (PAYL-V2-04) | 8 (upstream parity) | issue-103 doc | STOP-07; matches upstream |

**Deprecated/outdated:** `docs/research/claude-hooks-vs-pi-events.md` "agent_end is observation-only" and the StopFailure `after_provider_response` synthesis rows — retired in Phase 89 (DOC-05), do NOT follow them.

## Runtime State Inventory

Not a rename/refactor/migration phase — this is feature dispatch wiring. The only "state" is new **module-level cells** in `event-router.ts` (design, not migration):
- **last-assistant cache cell** — reset in `registerHooksBridge` (epoch hygiene), last-write-wins across `agent_end` fires.
- **`stop_hook_active` flag** (per session) — set on block-re-entry, cleared on `input`.
- **consecutive-block counter + one-shot cap latch** — reset on `input` (non-block outcome resets; Claude's Discretion on exact reset scope).

All ride the existing `capturedEpoch`/`pendingSessionStartContext` hygiene pattern (event-router.ts:145-182, 803). **No stored data, no external service config, no OS-registered state, no secrets, no build artifacts** touched — verified: the only persisted bridge state is the async-rewake PID table, which is unrelated to settle dispatch.

## Common Pitfalls (verification hooks for the planner)
Verification steps should assert: (1) `pi.on` count updated deliberately from 8; (2) settle fires Stop only on `stopReason:"stop"`, StopFailure only on `error`/`length`, neither on `aborted`/`toolUse`; (3) `continue:false` suppresses re-entry; (4) 8th consecutive block trips the cap + one-shot notify; (5) `stop_hook_active` clears on `input` but NOT on bridge re-entry; (6) 600s timeout unchanged; (7) StopFailure result discarded (observation-only).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pi-coding-agent` typings w/ `agent_settled` | compile `pi.on("agent_settled")` | ✗ (installed) / ✓ (lockfile) | 0.79.10 installed; 0.82.1 in lockfile | **`npm install` refresh — BLOCKING, no fallback** |
| `pi-agent-core` / `pi-ai` sub-deps | `StopReason`/`errorMessage` types | ✗ (installed) | absent; 0.82.1 in lockfile | `npm install` refresh |
| live `pi` CLI >= 0.80.5 | D-88-03 live UAT | ✓ | 0.80.10 | — |
| `PI_CODING_AGENT_DIR` sandbox | live UAT harness | ✓ | `tmp/pi-uat/agent/` exists | — |
| `ralph-wiggum` fixture | canary | ✓ | `tests/fixtures/ralph-wiggum-hooks.json` (Stop-only) | — |

**Missing dependencies with no fallback:** none once the dev-tree refresh runs — but that refresh is a hard prerequisite (Pitfall 1). **Missing dependencies with fallback:** the two env-flaky integration tests (skip, not block — Pitfall 2).

## Validation Architecture

`nyquist_validation: true` (.planning/config.json:19) — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node --import tsx` (existing) |
| Config file | none — `tsconfig.json` strict; tests under `tests/**/*.test.ts` |
| Quick run command | `node --import tsx --test tests/architecture/hooks-dispatch.test.ts` (or the new settle test) |
| Full suite command | `npm run check` (typecheck + eslint + prettier + `npm test`) |

### Phase Requirements → Test Map (mocked-Pi unit tests — D-88-03(a))
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOP-01 | stopReason gate (stop→Stop; aborted/toolUse→neither; error/length→StopFailure) | unit | `node --import tsx --test tests/bridges/hooks/settle-dispatch.test.ts` | ❌ Wave 0 |
| STOP-01 | last-assistant cache last-write-wins + epoch reset | unit | same | ❌ Wave 0 |
| STOP-02 | Stop stdin envelope shape (common + last_assistant_message + stop_hook_active) | unit | `...tests/bridges/hooks/payloads-stop.test.ts` | ❌ Wave 0 |
| STOP-03 | decision:block → sendMessage(followUp+triggerTurn), display:false | unit | settle-dispatch | ❌ Wave 0 |
| STOP-04 | exit-2 → block with stderr reason | unit | settle-dispatch (reuses wire-protocol) | ❌ Wave 0 |
| STOP-05 | additionalContext-no-block → re-entry | unit | settle-dispatch | ❌ Wave 0 |
| STOP-06 | continue:false precedence → no re-entry | unit | settle-dispatch | ❌ Wave 0 |
| STOP-07 | stop_hook_active set/clear; 8-block cap + one-shot warning | unit | settle-dispatch + notify test | ❌ Wave 0 |
| SFAIL-01 | observation-only (result discarded) | unit | settle-dispatch | ❌ Wave 0 |
| SFAIL-02 | StopFailure envelope (error + error_details + last_assistant_message) | unit | payloads-stop-failure | ❌ Wave 0 |
| SFAIL-03 | errorMessage classifier → 10-value vocab; length→max_output_tokens | unit | `...tests/bridges/hooks/stop-failure-classifier.test.ts` (fixture strings) | ❌ Wave 0 |
| STOP-07 | cap-trip warning byte-equality | catalog-uat | `node --import tsx --test tests/architecture/catalog-uat.test.ts` | ✅ (extend) |
| (drift) | pi.on count updated from 8; keyset unchanged | architecture | `...tests/architecture/hooks-dispatch.test.ts` | ✅ (update pin) |

### Sampling Rate
- **Per task commit:** the touched settle/translator/classifier test.
- **Per wave merge:** `tests/bridges/hooks/*` + `tests/architecture/hooks-*` + catalog-uat.
- **Phase gate:** full `npm run check` green (minus the two documented env-flaky integration tests) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/bridges/hooks/settle-dispatch.test.ts` — gate + decision arms + loop protections (STOP-01,03-07, SFAIL-01)
- [ ] `tests/bridges/hooks/payloads-stop.test.ts` / `payloads-stop-failure.test.ts` — envelope shapes (STOP-02, SFAIL-02)
- [ ] `tests/bridges/hooks/stop-failure-classifier.test.ts` — fixture errorMessage strings → vocab (SFAIL-03)
- [ ] Update `tests/architecture/hooks-dispatch.test.ts:200-220` pinned `pi.on` count + locked event-name Set (add `agent_end`, `agent_settled`; `input` already present)
- [ ] Extend `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` with the cap-trip warning fixture
- [ ] Mock-Pi fixture must expose `sendMessage`, `isIdle`, and an `agent_end`→`agent_settled` sequence

### Live UAT (D-88-03(b) — likely `human_needed` items)
Harness prior art: `tmp/pi-uat/agent/` is a `PI_CODING_AGENT_DIR` sandbox with `claude-plugins.json`; live `pi` 0.80.10 is installed. A scripted session sets `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent`, installs this extension + a `ralph-wiggum`-shaped Stop-only plugin (`tests/fixtures/ralph-wiggum-hooks.json`), and drives Pi. The four verification items (D-88-03): (1) `agent_settled` + `stopReason:"aborted"` after a mid-tool-call abort; (2) settle timing with queued messages; (3) `sendMessage` re-entry does not fire `input`; (4) ralph-wiggum canary exercising block path + 8-cap. Scripted single-turn and cap behavior are feasible; the abort-mid-tool-call and queued-message timing likely need a human driver → expect `human_needed` UAT items.

## Security Domain

`security_enforcement` absent from config → treated as enabled. This phase spawns hook subprocesses and injects model-visible content, so the relevant controls are already established and reused unchanged.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `parseHookStdout` never throws; unknown shapes → noop (wire-protocol.ts) |
| V5 (path containment) | yes | `assertPathInside` on all env-var paths (NFR-10; dispatch-exec.ts:303,314) — reused |
| V10 Malicious Code / process | yes | 3-site `node:child_process` whitelist (no-shell-out.test.ts); settle path adds NO new spawn site (reuses `dispatchHookExec`) |
| V6 Cryptography | no | none |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious hook stdout injecting a re-entry loop | DoS | 8-block cap + one-shot warning (STOP-07) — the loop protection IS the mitigation |
| Model-visible content from untrusted hook stderr/stdout | Tampering/Info | `display:false` re-entry; content is model-visible by contract (STOP-03), same trust boundary as async-rewake exit-2 injection |
| errorMessage substring spoofing → misclassification | Tampering | Non-load-bearing (no consumer); closed vocab + `unknown` fallback bounds impact |
| Stale handler firing post-`/reload` | — | `capturedEpoch` guard on the settle + cache handlers (event-router.ts:355 pattern) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `error` field label on the StopFailure envelope matches upstream (carried `[ASSUMED]` from Phase 87, hook-events.ts:182) | Pattern 5 / SFAIL-02 | Field-name mismatch; non-load-bearing (no consumer); Phase 89 confirms |
| A2 | `oauth_org_not_allowed` has no observable Pi errorMessage substring | Classifier | Org-policy errors classify `unknown` instead — acceptable fallback |
| A3 | A single `pi.on("input")` reset handler + the existing UserPromptSubmit `input` handler coexist (multi-handler support) | Pattern 2 / event router | If Pi coalesces handlers, fold the reset into the existing handler instead — runner.d.ts wording strongly implies multi-handler OK |
| A4 | `agent_end` reliably precedes `agent_settled` with the final run's messages | Pattern 1 | If a settle can fire with no cached message, the gate returns early (safe) but Stop silently never fires — live UAT item |
| A5 | A Stop hook will not commonly declare `asyncRewake:true` | Anti-patterns | If one does, the block contract silently degrades — planner must gate |

## Open Questions

1. **Cap-trip warning vs the notify-grammar invariant.**
   - Known: D-88-01 requires warning severity, a byte-stable catalog entry + catalog-UAT, and "summary-line grammar per the notify-grammar invariant." Precedents: `notifyDiagnostic` (warning, `header\n\n lines`), `notifyAsyncRewakeSummary` (info, single string).
   - Unclear: whether the invariant's closed summary regex (`N (plugin|marketplace) operation(s) ... failed|skipped.`) admits a bespoke warning summary, or needs a carve-out.
   - Recommendation: add a dedicated `shared/notify.ts` seam (IL-2 sanctioned) emitting `Stop hook override cap reached.\n\n<detail naming plugin + 8 consecutive blocks>`; add catalog + fixture; if the grammar-invariant fixture set is extended to include it, add an explicit non-cascade carve-out to the invariant.

2. **Cross-hook `continue:false` vs `block` precedence (STOP-06).**
   - Known: single-hook JSON already prioritizes `continue:false` (wire-protocol.ts:105).
   - Unclear: across multiple Stop hooks, is declaration-order acceptable or must any `stop` in the bucket override all blocks?
   - Recommendation: scan the reduced bucket for a `stop` outcome before honoring a `block` (matches STOP-06 wording); pin with a two-hook fixture.

3. **`pi.on` count target.** 8 → 10 (fold input-reset into existing handler) or 8 → 11 (dedicated input-reset subscription). Recommendation: dedicated subscription for clarity; update `hooks-dispatch.test.ts:200-220` deliberately.

4. **Consecutive-block counter reset scope (Claude's Discretion).** Does an `additionalContext`-without-block (STOP-05) re-entry reset the counter (non-block outcome) or count toward the cap? Recommendation: reset on any non-block outcome (upstream: "8 *consecutive* blocks"); document.

## Sources

### Primary (HIGH confidence)
- `@earendil-works/pi-coding-agent` 0.82.1 `dist/core/extensions/types.d.ts` (unpkg) — `AgentSettledEvent` (:539), `on("agent_settled")` (:868), `AgentEndEvent.messages` (:534), `sendMessage`/`isIdle`
- `@earendil-works/pi-ai` 0.82.1 `dist/types.d.ts` (unpkg) — `StopReason` (:273), `AssistantMessage.stopReason`/`errorMessage` (:289-290)
- Installed `dist/core/agent-session.js` — errorMessage classifier regexes (:1972, :1989), auth-failure strings (:164, :766)
- Existing bridge source: `event-router.ts`, `dispatch.ts`, `dispatch-exec.ts`, `wire-protocol.ts`, `exec-result.ts`, `exec-timer.ts`, `translation-context.ts`, `payloads/session-end.ts`, `async-rewake/registry.ts`, `domain/components/hook-events.ts`, `shared/notify.ts`
- Pinned test `tests/architecture/hooks-dispatch.test.ts:175-271`; catalog-uat + notify-grammar-invariant tests
- `docs/research/issue-103-stop-stopfailure-promotion.md` (THE authority) + `.planning/REQUIREMENTS.md` + 87-CONTEXT/87-02-SUMMARY + 88-CONTEXT

### Secondary (MEDIUM confidence)
- `docs/messaging-style-guide.md`, `docs/output-catalog.md` — notify grammar / catalog conventions
- Upstream contract <https://code.claude.com/docs/en/hooks> (verified in authority doc 2026-07-28)

## Metadata

**Confidence breakdown:**
- Standard stack / API surface: HIGH — verified against installed AND published 0.82.1 typings
- Architecture / reuse map: HIGH — every reused seam read in-session with line cites
- Classifier grounding: MEDIUM-HIGH — substrings from Pi's own dist regexes; exact provider strings live in pi-ai (not installed), so `unknown` fallback is the safety net
- Cap-trip notify grammar reconciliation: MEDIUM — depends on a planner decision (Open Q1)

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 (stable in-repo surfaces; re-verify if the pi peer floor moves again)
