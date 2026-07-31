# Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 11 (2 new source, 2 new payload, 5 modified source, 1 doc, tests)
**Analogs found:** 11 / 11 (every new/modified file maps to an existing seam — this is dispatch wiring, not greenfield)

> Base path for all source citations: `extensions/pi-claude-marketplace/`.
> Repo-root paths (tests, docs) are noted explicitly.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bridges/hooks/settle.ts` (NEW) | dispatcher/handler | event-driven | `bridges/hooks/dispatch.ts` `compositeHandlerFor` (dispatch.ts:249) + `async-rewake/registry.ts` sendMessage (registry.ts:431) | role-match (bespoke adapter, reuses reduceBucket) |
| `bridges/hooks/payloads/stop.ts` (NEW) | translator | transform | `bridges/hooks/payloads/session-end.ts` | exact |
| `bridges/hooks/payloads/stop-failure.ts` (NEW) | translator + classifier | transform | `bridges/hooks/payloads/session-end.ts` + Pi dist regexes | role-match |
| `bridges/hooks/event-router.ts` (MOD) | router/registration | event-driven | self — existing `pi.on` block (event-router.ts:839-850) + epoch cell (event-router.ts:182,295,803) | exact (extend in place) |
| `bridges/hooks/dispatch-exec.ts` (MOD) | dispatch table | transform | self — `TRANSLATORS`/`REQUIRED_EVENT_FIELDS` (dispatch-exec.ts:110,235) | exact |
| `bridges/hooks/dispatch.ts` (MOD) | dispatch machinery | event-driven | self — three `Exclude<>` sites (dispatch.ts:250,318,398) | exact |
| `bridges/hooks/async-rewake/registry.ts` (MOD) | translator table | transform | self — `TRANSLATORS` Record (registry.ts:97) | exact |
| `domain/components/hook-events.ts` (MOD) | domain constant | — | self — `DISPATCHABLE_EVENTS` (hook-events.ts:100) | exact |
| `shared/notify.ts` (MOD) | notify seam | request-response | `notifyDiagnostic` (notify.ts:355) / `notifyAsyncRewakeSummary` (notify.ts:380) | exact |
| `docs/output-catalog.md` (MOD) | doc/fixture | — | `success-with-orphan-rewake` entry (output-catalog.md:437) | exact |
| `tests/architecture/hooks-dispatch.test.ts` (MOD) | test pin | — | self — DISP-01 pin (hooks-dispatch.test.ts:175-237) | exact |

New test files (`tests/bridges/hooks/settle-dispatch.test.ts`, `payloads-stop.test.ts`, `payloads-stop-failure.test.ts`, `stop-failure-classifier.test.ts`) copy structure from the existing `tests/bridges/hooks/payloads/*.test.ts` and `dispatch-exec.test.ts` (out of scope to excerpt here; follow sibling test files).

## Pattern Assignments

### `bridges/hooks/payloads/stop.ts` + `stop-failure.ts` (translator, transform)

**Analog:** `bridges/hooks/payloads/session-end.ts` (whole file, 32 lines — the canonical common-fields shape)

**Full template to copy:**
```typescript
// bridges/hooks/payloads/session-end.ts
import type { SessionShutdownEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface SessionEndStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionEnd";
  readonly reason: string;
}

export function translate(event: SessionShutdownEvent, ctx: TranslationContext): SessionEndStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionEnd",
    reason: event.reason,
  };
}
```

**Adaptation for Stop/StopFailure (Research Pattern 5, cache-cell placement decision):**
- Common fields `session_id`/`transcript_path`/`cwd` come from `TranslationContext` (translation-context.ts:35-37: `sessionId`, `transcriptPath`, `cwd`); `transcriptPath` already falls back to `""` when `getSessionFile()` is undefined.
- The `event` slot is typed `never` in the `TRANSLATORS` Record (see dispatch-exec.ts:110). The settle handler constructs a **synthetic event** carrying the cached `last_assistant_message` + loop flags (`stop_hook_active` for Stop; `error`/`error_details` for StopFailure) and passes it into that slot — do NOT widen `TranslationContext` (used by all 8 existing translators).
- `stop.ts`: `hook_event_name: "Stop"`, `last_assistant_message`, `stop_hook_active`. Omit `background_tasks`/`session_crons` (STOP-02, contract-legal).
- `stop-failure.ts`: `hook_event_name: "StopFailure"`, `error` (classified), optional `error_details`, `last_assistant_message` = rendered errorMessage (SFAIL-02).

**Classifier for `stop-failure.ts` (SFAIL-03):** substring table over `errorMessage`, closed 10-value vocab, `unknown` fallback; `length` stopReason maps deterministically to `max_output_tokens` (NOT from errorMessage). Substring evidence and full table are in 88-RESEARCH.md "StopFailure classifier grounding" (do not re-derive). Keep the table small and fixture-tested.

**Import site constraint:** the `AssistantMessage`/`AgentMessage`/`StopReason`/`AgentEndEvent`/`AgentSettledEvent` types must be re-exported through `platform/pi-api.ts` (the only sanctioned import site — see pi-api.ts:40-57 existing re-export block; add the new type names there, NOT a direct `@earendil-works` import in bridge code).

---

### `bridges/hooks/settle.ts` (NEW — dispatcher, event-driven)

**Analog A — bucket reduction (reuse UNCHANGED):** `dispatch.ts` `reduceBucket` (dispatch.ts:177-229). First-block/stop-wins short-circuit (dispatch.ts:199-206); `mutate` carried forward (dispatch.ts:207-220); default `{ kind: "noop" }`. The settle handler calls `reduceBucket("Stop", syntheticEvent, ctx, pi, matcherFires)` then adapts the `ReducedBucket.result` with a **bespoke** switch (do NOT route through `adaptForEvent`, dispatch.ts:317 — that switch is for per-Pi-event handler returns).

**Bespoke result adapter arms (Research Pattern 3 — over the `HookExecResult` union produced by `parseHookStdout`):**
```typescript
// { kind: "stop" }   (continue:false) -> do NOT re-enter      [STOP-06]
// { kind: "block", reason }           -> sendMessage(reason)  [STOP-03] (exit-2 already maps here [STOP-04])
// { kind: "mutate", additionalContext } -> sendMessage(ctx)   [STOP-05]
// { kind: "noop" }                    -> nothing
```
STOP-06 cross-hook precedence (D-88-05, Open Q2): scan the reduced bucket for ANY `stop` before honoring a `block` — aggregate, not first-encountered.

**Analog B — re-entry via sendMessage (precedent):** `async-rewake/registry.ts:431-442`:
```typescript
pi.sendMessage(
  {
    customType: REWAKE_CUSTOM_TYPE,      // registry.ts:91 = "claude-hook-rewake" as const
    content,
    display: false,
    details: { pluginId: entry.pluginId, dispatchId },
  },
  { deliverAs: lane },                    // registry.ts:428: ctx.isIdle() ? "nextTurn" : "followUp"
);
```
**Critical delta from async-rewake:** Stop block re-entry MUST pass `{ deliverAs: "followUp", triggerTurn: true }` (STOP-03) — at settle the agent is idle so `triggerTurn: true` starts the new turn. Do NOT copy async-rewake's `nextTurn` idle lane (different semantic). Use a distinct `customType` (e.g. `claude-hook-stop-block`); `display: false` per STOP-03. Wrap in try/catch + `hookDebugLog` exactly as registry.ts:443-444.

**Analog C — gate skeleton + epoch hygiene:** copy the `capturedEpoch !== currentEpoch()` guard shape from `compositeHandlerFor` (dispatch.ts:257) and `currentEpoch()` accessor (event-router.ts:295). Gate table (Research Pattern 4): `stop`→Stop, `error`→StopFailure(classified), `length`→StopFailure(`max_output_tokens`), `aborted`→neither, `toolUse`→defensive no-op.

**StopFailure arm (SFAIL-01, observation-only):** call `reduceBucket("StopFailure", ...)` and **discard the result** — no re-entry, no loop guard.

**Anti-pattern gate (Research A5):** a Stop hook declaring `asyncRewake: true` routes to fire-and-forget in `dispatchHookExec` (dispatch-exec.ts:176) and returns `{ kind: "noop" }` before a decision exists — silently breaking the block contract. Settle path must bypass the async branch for Stop or document the degrade. Flag in plan.

---

### `bridges/hooks/event-router.ts` (MOD — router/registration, event-driven)

**Analog:** the existing `pi.on` registration block (event-router.ts:839-850) and the epoch/reset hygiene for `pendingSessionStartContext`.

**Existing subscription block to extend (event-router.ts:839-850):**
```typescript
pi.on("session_start", compositeHandlerFor("SessionStart", capturedEpoch, pi));
pi.on("session_shutdown", compositeHandlerFor("SessionEnd", capturedEpoch, pi));
pi.on("session_before_compact", compositeHandlerFor("PreCompact", capturedEpoch, pi));
pi.on("session_compact", compositeHandlerFor("PostCompact", capturedEpoch, pi));
pi.on("input", compositeHandlerFor("UserPromptSubmit", capturedEpoch, pi));
pi.on("tool_call", compositeHandlerFor("PreToolUse", capturedEpoch, pi));
pi.on("tool_result", toolResultCompositeHandler(capturedEpoch, pi));
// + before_agent_start (line 850)
```
Add: `pi.on("agent_end", agentEndCacheHandler(capturedEpoch))`, `pi.on("agent_settled", settleHandlerFor(capturedEpoch, pi))`, and an `input`-reset for `stop_hook_active` (dedicated subscription per Research Open Q3, or fold into the existing `input` handler — A3). `capturedEpoch = liveEpoch` is set at event-router.ts:796.

**Epoch-hygiene cell pattern to mirror (event-router.ts:182, 295, 803):**
```typescript
let pendingSessionStartContext: PendingSessionStartContext[] = [];   // :182  module-state cell
export function currentEpoch(): number { ... }                       // :295  read-only accessor
pendingSessionStartContext = [];                                     // :803  reset in registerHooksBridge (epoch hygiene)
```
New cells (last-assistant cache, `stop_hook_active` flag, consecutive-block counter, one-shot cap latch) must all be reset in `registerHooksBridge` the same way so `/reload` cannot leak a stale cell. Counter semantics (D-88-06): only `block` increments; any non-block outcome resets; latch re-arms with the reset.

---

### `domain/components/hook-events.ts` (MOD — domain constant)

**Analog:** self — `DISPATCHABLE_EVENTS` array (hook-events.ts:100-109). Add `"Stop"`, `"StopFailure"` (8→10). This is the D-87-04 design paying off — the widen forces compile errors at every `Record<DispatchableEvent>` table (see Pitfall 6 below). `Stop`/`StopFailure` already carry matcher dispositions in `NON_TOOL_EVENT_FIELDS` (hook-events.ts:182-183) and closed-set handling (hook-events.ts:220-231). `isDispatchableEvent`/`DISPATCHABLE_MEMBERS` (hook-events.ts:127-131) — the defensive belt Phase 87 added — can now be simplified since the two events become genuinely dispatchable.

---

### `bridges/hooks/dispatch-exec.ts` + `dispatch.ts` + `async-rewake/registry.ts` (MOD — forced by the widen)

**dispatch-exec.ts:** add `Stop`/`StopFailure` entries to `TRANSLATORS` (dispatch-exec.ts:110-119) and `REQUIRED_EVENT_FIELDS` (dispatch-exec.ts:235). Existing shape:
```typescript
const TRANSLATORS: Record<DispatchableEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart, /* ... */ SessionEnd: translateSessionEnd,
};
```

**async-rewake/registry.ts:** same `TRANSLATORS` Record shape (registry.ts:97-106) — add `Stop`/`StopFailure` entries (these never fire an async surface but the `Record` totality demands them; supply thin translators or reuse the dispatch-exec ones).

**dispatch.ts:** widen the three `Exclude<>` sites — `compositeHandlerFor` (dispatch.ts:250), `adaptForEvent` (dispatch.ts:318), and dispatch.ts:398 — from `Exclude<DispatchableEvent, "PostToolUse" | "PostToolUseFailure">` to also drop `"Stop" | "StopFailure"` (they are dispatched by the settle handler, not the per-Pi-event composite). This is the exact Phase 87 Rule-3 fix repeated (TS7030/TS2366 if omitted).

**Reuse UNCHANGED (Don't Hand-Roll):** `parseHookStdout` (wire-protocol.ts:32 — already covers exit-2/block/continue:false/additionalContext, see arm map below), `dispatchHookExec` (dispatch-exec.ts:155), `DEFAULT_TIMEOUT_MS = 600_000` (dispatch-exec.ts:82 and registry.ts:82 — inherit, no bespoke timeout).

---

### `shared/notify.ts` (MOD — cap-trip warning seam, D-88-01)

**Analog:** `notifyDiagnostic` (notify.ts:355-365) — the exact warning-severity bridge-seam shape:
```typescript
export function notifyDiagnostic(
  ctx: ExtensionContext,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }
  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}
```
Companion precedent `notifyAsyncRewakeSummary` (notify.ts:380-386, info-severity, IL-2 exemption).

**Adaptation:** new one-shot cap-trip seam emitting `Stop hook override cap reached.\n\n<detail naming plugin + 8 consecutive blocks / turn ended despite active block>` at `"warning"` severity — summary line first, `\n\n` block (tri-state model: turn ended / protection worked / block deliberately suppressed). Must satisfy the notify-grammar invariant (Pitfall 5 / Open Q1): `notifyDiagnostic` is warning-severity with a `\n\n` block and is NOT in the invariant's driven fixture set, so a seam modeled on it ships without tripping the invariant — but D-88-07 requires either conforming to the closed summary grammar or surfacing a genuine structural conflict in the plan (do NOT silently exempt).

---

### `docs/output-catalog.md` + catalog-UAT (MOD — byte-stable fixture, D-88-01)

**Analog:** `docs/output-catalog.md:437-448` (`success-with-orphan-rewake`) — the `<!-- catalog-state: STATE -->` comment paired with the next fenced renderer-output block. Catalog-UAT runner (`tests/architecture/catalog-uat.test.ts`) walks these annotations, pairs each with a `NotificationMessage` fixture + optional `expectedSeverity` ("warning"|"error"), and asserts byte equality against `notify()` output (catalog-uat.test.ts:5-30, 206). Add a new `catalog-state:` entry for the cap-trip warning + its fixture (`expectedSeverity: "warning"`).

---

### `tests/architecture/hooks-dispatch.test.ts` (MOD — deliberate pin update)

**Analog:** self — DISP-01 pin (hooks-dispatch.test.ts:175-237). Two assertions to update deliberately:
```typescript
assert.equal(piMock.calls.length, 8, ...);        // :200  -> new count (9, 10, or 11 per Open Q3)
const locked = new Set([ "session_start", ..., "before_agent_start" ]);  // :206-215
assert.deepEqual(new Set(piMock.calls), locked, ...);                    // :216-220
```
Add `"agent_end"`, `"agent_settled"` to the locked Set (`"input"` already present). Note (Anti-pattern): a 2nd `pi.on("input")` grows `calls.length` but NOT the `Set` — account for that if using a dedicated input-reset subscription. Mock-Pi fixture (`makePiMock`) must gain `sendMessage`, `isIdle`, and an `agent_end`→`agent_settled` sequence.

## Shared Patterns

### Epoch / `/reload` hygiene
**Source:** `bridges/hooks/event-router.ts:182,295,803` (`currentEpoch()`, module-state cell, reset in `registerHooksBridge`); guard shape at `dispatch.ts:257`.
**Apply to:** `settle.ts` (settle + agent_end cache handlers), all new module-state cells in `event-router.ts`.
```typescript
if (capturedEpoch !== currentEpoch()) return;   // stale-handler guard on every closure
```

### Wire-protocol decision arms (reuse, no changes)
**Source:** `bridges/hooks/wire-protocol.ts:37-39, 105-116, 154-157`.
**Apply to:** the settle bespoke result adapter — every Stop arm is already produced by `parseHookStdout`:
```typescript
// exit 2                          -> { kind: "block", reason: stderr.trim() }   [STOP-04]  (wire-protocol.ts:37-39)
// { continue: false }             -> { kind: "stop" } (checked FIRST)           [STOP-06]  (wire-protocol.ts:105-108)
// { decision: "block", reason }   -> { kind: "block", reason }                  [STOP-03]  (wire-protocol.ts:110-112)
// hookSpecificOutput.additionalContext -> { kind: "mutate", additionalContext } [STOP-05]  (wire-protocol.ts:154-157)
```

### Notify boundary (IL-2)
**Source:** `shared/notify.ts:355` (`notifyDiagnostic`), `:380` (`notifyAsyncRewakeSummary`).
**Apply to:** the cap-trip warning — all user-visible output through `ctx.ui.notify`; notify.ts is a dumb renderer (the settle dispatcher determines cap-trip state + stamps `"warning"`, notify does not probe).

### Comment policy
**Source:** `.claude/rules/typescript-comments.md`.
**Apply to:** every new file/test title — no phase/milestone/plan refs, no bare `Pitfall N`/`Pattern N`; decision IDs (`D-88-01`) and requirement IDs (`STOP-03`, `SFAIL-03`) ARE allowed.

## No Analog Found

None. Every file maps to an existing seam — this phase removes the Phase 87 defensive belt and adds two translators + one bespoke subscriber onto machinery that already exists.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/bridges/hooks/**`, `domain/components/hook-events.ts`, `shared/notify.ts`, `platform/pi-api.ts`, `tests/architecture/{hooks-dispatch,catalog-uat}.test.ts`, `docs/output-catalog.md`.
**Files scanned:** ~14 (all read in-session; every excerpt above is a verified line cite).
**Pattern extraction date:** 2026-07-30
**Prerequisite (D-88-04, Pitfall 1):** dev-tree refresh to lockfile 0.82.1 (`npm install`) MUST precede any code referencing `agent_settled`/`StopReason`/`errorMessage` typings — installed tree is 0.79.10.
