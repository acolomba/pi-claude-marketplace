---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/architecture/hooks-translators.test.ts
  - tests/bridges/hooks/payloads/stop-failure.test.ts
  - tests/bridges/hooks/payloads/stop.test.ts
  - tests/bridges/hooks/settle.test.ts
  - tests/live-uat/README.md
  - tests/live-uat/stop-canary.mjs
  - tests/shared/index-smoke.test.ts
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 88: Code Review Report

**Reviewed:** 2026-07-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the `agent_settled` settle dispatcher (`settle.ts`), the no-short-circuit
`collectBucketOutcomes` path, the Stop/StopFailure payload translators + classifier,
the loop-protection cap notify seam, and the supporting registration/architecture
tests. The state machine is carefully built and well-tested for the block lane, and
the StopFailure arm is correctly kept off `sendMessage`/flag/counter mutations.

The most serious defect is a **loop-protection bypass**: the STOP-05
`additionalContext`-without-block re-entry lane is uncapped and additionally *resets*
the consecutive-block counter, so an always-`additionalContext` Stop hook (or one that
alternates block/additionalContext) livelocks the agent unbounded — exactly the
failure the STOP-07 / T-88-02 cap claims to prevent. Secondary findings cover an
observation-completeness bug in the StopFailure arm, a stale-cache double-settle
hazard, a classifier substring hazard on bare HTTP-status digits, comment-policy
anchor violations, and a `stop_hook_active` semantic inconsistency.

## Critical Issues

### CR-01: `additionalContext`-without-block re-entry (STOP-05) bypasses the STOP-07 livelock cap

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:259-266` (with `handleBlockOutcome` at `315-334`)
**Issue:**
The STOP-07 override cap is enforced only inside `handleBlockOutcome`, which is reached
solely on a `block` outcome. The STOP-05 `mutate`/`additionalContext` re-entry lane
re-enters the agent loop via `reenter(...)` with **no counter increment and no cap
check**, and it calls `resetConsecutiveBlockState()` first — zeroing the
consecutive-block counter and re-arming the one-shot latch.

Consequences:
1. A Stop hook that unconditionally emits `{"hookSpecificOutput":{"additionalContext":"…"}}`
   (parsed to `{kind:"mutate", additionalContext}`) re-enters on every settle forever.
   `consecutiveBlockCount` never advances, the cap never trips, and no
   `notifyStopHookOverrideCap` warning is ever surfaced — an unbounded livelock that
   also re-invokes the model each turn.
2. A hook alternating `block` → `additionalContext` → `block` → … never reaches the cap
   either, because each `additionalContext` turn resets the block counter to 0.

This defeats the phase's explicit T-88-02 guarantee ("an always-blocking hook is
bounded … never spun unbounded"). The block lane is capped precisely because hooks
cannot be trusted to be one-shot; the `additionalContext` lane has identical livelock
potential and identical untrusted-input provenance but is left uncapped.

Note the existing `tests/bridges/hooks/settle.test.ts:687` test ("additionalContext…
resets the consecutive counter") locks in this very behavior, so the bug is currently
codified as intended — it needs a decision + test change, not just a code fix.

**Fix:** Route `additionalContext` re-entry through the same bounded bookkeeping as
`block` (count it toward the cap and suppress at the cap), rather than resetting the
counter. For example, funnel both lanes through a shared `reenterBounded` that
increments and cap-checks:

```ts
// Both block and additionalContext are UNTRUSTED re-entry lanes; both must be
// bounded by STOP_OVERRIDE_CAP so neither can livelock the agent.
function reenterBounded(pi, ctx, content, pluginId): void {
  consecutiveBlockCount += 1;
  if (consecutiveBlockCount >= STOP_OVERRIDE_CAP) {
    if (!capNotifiedThisSession) {
      notifyStopHookOverrideCap(ctx, pluginId);
      capNotifiedThisSession = true;
    }
    return;
  }
  stopHookActive = true;
  reenter(pi, content, pluginId);
}
```

and call it from both the `block` and `mutate.additionalContext` arms (drop the
`resetConsecutiveBlockState()` from the `additionalContext` arm). If the product
decision is that `additionalContext` genuinely should be uncapped, that must be
recorded as an explicit decision and the livelock risk documented — the current code
silently contradicts the stated T-88-02 mitigation.

## Warnings

### WR-01: StopFailure observation drops later observer hooks on a leading block/stop/exit-2

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:283-302`
**Issue:**
`runStopFailure` calls `reduceBucket`, which short-circuits (`return`) on the first
`block` or `stop` outcome (`dispatch.ts:200-208`). StopFailure is documented as
"observation-only … run the bucket for its side effects", i.e. *every* registered
StopFailure hook should get to observe the failure. But if an earlier hook in the
bucket returns `block`/`stop` (or exits 2, which `parseHookStdout` maps to `block`),
`reduceBucket` returns immediately and the remaining StopFailure hooks are **never
spawned** — they silently miss the observation. This contradicts the observation-only
contract (an observer hook cannot control flow, yet it can suppress its peers).

**Fix:** Use the no-short-circuit walker for StopFailure the same way the Stop path
does, then discard the collected outcomes:

```ts
await collectBucketOutcomes(bucket, event, ctx, pi, () => true);
// result intentionally discarded — StopFailure has no decision lane (SFAIL-01)
```

### WR-02: `cachedLastAssistant` is never cleared after consumption — double-settle reprocesses a stale message

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:141, 152-184`
**Issue:**
`agentEndCacheHandler` writes the cache; `settleHandlerFor` reads it but never clears
it. The correctness of the whole dispatcher rests on the undocumented assumption that
`agent_settled` always follows a fresh `agent_end`. If Pi emits a second
`agent_settled` for the same logical completion without an intervening `agent_end`
(the README itself flags settle-cadence as an open `human_needed` question — item 2),
the handler re-reads the *same* cached assistant message and re-runs the Stop bucket:
re-spawning hook subprocesses and potentially re-entering the loop a second time off a
stale message. The `/reload` path is protected (`resetSettleState`), but the
per-completion path is not.

**Fix:** Clear the cache after a settle consumes it so a spurious second settle is a
no-op:

```ts
const last = cachedLastAssistant;
cachedLastAssistant = undefined; // one-shot: a duplicate settle without a new agent_end no-ops
if (last === undefined) return;
```

(Each legitimate re-entry produces a new `agent_end` that repopulates the cache, so
one-shot consumption does not break the block loop.)

### WR-03: classifier matches bare 3-digit HTTP codes as substrings anywhere in the message

**File:** `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts:60-106`
**Issue:**
`classifyStopFailure` lowercases the message and tests `haystack.includes(s)` for
digit substrings `"429"`, `"529"`, `"401"`, `"403"`, `"500"`, `"502"`, `"503"`,
`"504"`, `"400"`. Because these are unbounded substring matches, unrelated digit runs
misclassify:
- `"retry after 5000ms"` contains `"500"` → `server_error`.
- `"request 4290 failed"` contains `"429"` → `rate_limit`.
- `"consumed 4013 tokens"` contains `"401"` → `authentication_failed`.

The output is observation-only (fed to StopFailure hooks, no control flow), so this is
a mislabeling bug rather than a crash — but it degrades the fidelity the classifier
exists to provide, and the failure is silent.

**Fix:** Anchor numeric matches to an HTTP-status shape rather than bare substrings —
e.g. match `\b(status|http|code)?\s*4\d\d\b`/`5\d\d` word-boundary tokens, or require
the status code to be preceded by non-digit context. At minimum, wrap the digit
tokens so `\d{3}` is bounded (`\b429\b`) so multi-digit numbers do not alias.

### WR-04: comment / test-title anchors cite RESEARCH artifacts (typescript-comments.md)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts:58`; `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:256`; `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:60,220`; `tests/bridges/hooks/settle.test.ts:451,456`; `tests/bridges/hooks/payloads/stop-failure.test.ts:81`
**Issue:**
`.claude/rules/typescript-comments.md` bans anchors whose only purpose is to record
the authoring planning artifact and bans bare `Pitfall N`/`Pattern N`. The phase
introduced several research-list anchors that are not requirement/decision IDs:
- `(A2)` — `stop-failure.ts:58`, `stop-failure.test.ts:81`
- `(research A5)` — `dispatch.ts:256`, `settle.ts:220`
- `Research A5:` section comment and `test("A5: …")` title — `settle.test.ts:451,456`
- `Pitfall behind STOP-07` — `settle.ts:60`

`A2` / `A5` are RESEARCH.md assumption/pitfall list entries (single-letter + digit),
not one of the allowed `D-…` / `XXX-NN` traceability forms; per-doc numbering makes
them non-portable, which is exactly what the rule targets.

**Fix:** Drop the `(A2)` / `(A5)` / `Research A5` / `Pitfall` tokens and let the
surrounding rationale (or the surviving `STOP-*` / `SFAIL-*` / `D-88-*` IDs) carry the
anchor. E.g. `test("A5: an asyncRewake Stop hook …")` → `test("an asyncRewake Stop hook
is degraded to noop and does not re-enter")`.

### WR-05: `stop_hook_active` is not set on the `additionalContext` re-entry lane

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:262-264, 332`
**Issue:**
A `block` re-entry sets `stopHookActive = true` before re-entering, so the next Stop
payload correctly reports it is inside a bridge-driven continuation. The STOP-05
`additionalContext` re-entry re-enters the agent loop identically (a new
followUp+triggerTurn turn) but never sets `stopHookActive`. The subsequent Stop
payload therefore reports `stop_hook_active: false` even though the turn *is* a
bridge-driven continuation, which is semantically inconsistent with the block lane and
misleading to any Stop hook that keys off `stop_hook_active`.

**Fix:** If the `additionalContext` lane is retained as a re-entry (see CR-01), set
`stopHookActive = true` on that lane as well so the flag truthfully reflects "we are in
a bridge continuation" regardless of which lane drove it.

### WR-06: STOP-07 protection rests on an unverified assumption that injected re-entries do not fire `input`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:874-879`; `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:104-113`
**Issue:**
The entire loop-protection design depends on `pi.sendMessage({…}, {deliverAs:"followUp",
triggerTurn:true})` **not** dispatching Pi's `input` event. If a bridge-injected
re-entry did pass through `input`, the dedicated second `pi.on("input", …)` reset
handler would clear `stopHookActive` and zero `consecutiveBlockCount` on every
re-entry — the cap would never trip and `stop_hook_active` would never thread through.
The unit tests exercise the reset handler by calling it directly (they do not prove Pi
routes injected messages away from `input`), and `tests/live-uat/README.md` explicitly
routes this to `human_needed` (item 3). This is a load-bearing integration assumption
with no automated guard.

**Fix:** Not a code change per se, but track it: add a regression assertion the moment
the live/interactive path is available, and keep the `human_needed` UAT item open until
verified against the target `pi` version. Consider a defensive marker so the reset
handler can distinguish a genuine user `input` from an echoed injection if Pi ever
surfaces one.

## Info

### IN-01: `settleHandlerFor` stopReason switch lacks an `assertNever` exhaustiveness pin

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:166-182`
**Issue:**
The rest of the codebase pins discriminated-union exhaustiveness with `assertNever`
(NFR-7). The `switch (last.stopReason)` here has arms for `stop`/`error`/`length`/
`aborted`/`toolUse` but no `default: assertNever(...)`. If a future `@earendil-works`
peer-dep widens `StopReason` (the type is derived structurally from
`AgentEndEvent.messages`), the new value silently no-ops with no compile-time signal.
The runtime no-op is arguably a safe default, but the missing pin is a deviation from
the project's stated convention.

**Fix:** Add an `assertNever` default arm (or an explicit documented `default:` no-op)
so a widened `StopReason` is a visible decision rather than a silent fall-through.

### IN-02: loop-protection state described as "per-session" is per-process / global across scopes

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:55-68`
**Issue:**
`stopHookActive`, `consecutiveBlockCount`, and `capNotifiedThisSession` are module-level
singletons reset only on `resetSettleState` (bridge load / `/reload`). The comments call
them "per-session", but they are really per-process-per-bridge-load and are shared
across both the user- and project-scope Stop buckets (a single global cap over all
plugins). This is consistent with Pi's single-session-per-process model and is likely
intended (a global livelock guard), but the "per-session" wording could mislead a
future maintainer into assuming session-keyed isolation that does not exist.

**Fix:** Reword the comments to "per bridge load (per process); shared across scopes"
to match the actual lifetime, or key the state by session if per-session isolation is
ever required.

---

_Reviewed: 2026-07-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
