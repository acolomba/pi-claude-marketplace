---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
fixed_at: 2026-07-31T02:03:19Z
review_path: .planning/phases/88-agent-settled-dispatcher-stop-contract-stopfailure/88-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 88: Code Review Fix Report

**Fixed at:** 2026-07-31T02:03:19Z
**Source review:** .planning/phases/88-agent-settled-dispatcher-stop-contract-stopfailure/88-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 7
- Fixed: 6 (CR-01, WR-01, WR-02, WR-03, WR-04, WR-05)
- No change needed: 1 (WR-06)
- Skipped: 0
- Out of scope (info): IN-01, IN-02 (not addressed — critical_warning scope)

All fixes were applied per the explicit user decision D-88-08 (recorded in
88-CONTEXT.md) and the accompanying fix directions. Each fix was verified with
`tsc --noEmit`, the relevant unit suites, and `pre-commit run --files`
(TruffleHog runs green on the repo separately; its worktree-sandbox failure on
`.git/index` is the known limitation and was skipped only for the in-worktree
commit per house policy).

## Fixed Issues

### CR-01 / WR-05: `additionalContext` re-entry bypassed the STOP-07 cap (D-88-08)

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `tests/bridges/hooks/settle.test.ts`
**Commit:** 432dda24
**Applied fix:** Introduced a shared bounded re-entry path (`reenterBounded`,
replacing `handleBlockOutcome`) used by BOTH the `block` lane and the STOP-05
`additionalContext`-without-block lane. The two lanes now share ONE consecutive
re-entry counter capped at `STOP_OVERRIDE_CAP` (8) with the same one-shot
`notifyStopHookOverrideCap` latch, and both set `stopHookActive` (WR-05). A
context re-entry now INCREMENTS the counter (D-88-08) instead of calling
`resetConsecutiveBlockState()`; only a non-re-entry outcome (`continue:false` or
a plain allow) resets the counter and re-arms the latch. This closes both
livelock bypasses (pure-`additionalContext` loop and `block`/`additionalContext`
alternation). Updated the previously codified reset-on-context test to assert the
increment + `stop_hook_active` behavior, and added two cap regression tests: a
pure-`additionalContext` loop bounded at 7 re-entries and a block/context
alternation sharing one cap. Comment blocks (loop-state, cap constant,
`resetConsecutiveBlockState`, `reenterBounded`, `runStopBucket` arms) rewritten
for D-88-08 semantics; the "Pitfall behind STOP-07" anchor (also flagged in
WR-04) was removed here as part of the loop-state comment rewrite.

### WR-01: StopFailure dropped later observers on a leading block/stop/exit-2

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `tests/bridges/hooks/settle.test.ts`
**Commit:** cc01c7c4
**Applied fix:** `runStopFailure` now walks the bucket with
`collectBucketOutcomes` (no short-circuit) instead of `reduceBucket`, so a
leading `block`/`stop`/exit-2 hook no longer starves the later observation-only
StopFailure hooks. Collected outcomes are still discarded — StopFailure has no
decision lane (SFAIL-01), so no re-entry and no loop-state mutation occur. Dropped
the now-unused `reduceBucket` import and added a regression test with two
observers where the first blocks, asserting both still run.

### WR-02: `cachedLastAssistant` was never cleared after consumption

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `tests/bridges/hooks/settle.test.ts`
**Commit:** 2d055a3a
**Applied fix:** `settleHandlerFor` now clears `cachedLastAssistant` the moment
it reads it (one-shot consumption), so a spurious second `agent_settled` without
an intervening `agent_end` no-ops instead of reprocessing a stale message. Each
legitimate re-entry emits a fresh `agent_end` that repopulates the cache, so the
block loop is unaffected. Added a duplicate-settle no-op regression test.

### WR-03: classifier matched bare 3-digit HTTP codes as unbounded substrings

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`, `tests/bridges/hooks/payloads/stop-failure.test.ts`
**Commit:** 673c949a
**Applied fix:** The numeric HTTP-status matches in `CLASSIFIER_TABLE` are now
word-boundary RegExps (`/\b429\b/` etc.) instead of `includes("429")`. The
matcher type widened to `string | RegExp`; the named substrings (rate limit,
overloaded, ...) stay case-insensitive `includes` as before. Added regression
fixtures proving "retry after 5000ms", "request 4290 failed", and "consumed 4013
tokens" now fall through to `unknown` rather than aliasing `500`/`429`/`401`.

### WR-04: comment / test-title research anchors (typescript-comments.md)

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`, `tests/bridges/hooks/settle.test.ts`, `tests/bridges/hooks/payloads/stop-failure.test.ts`
**Commit:** 3532a40e
**Applied fix:** Removed the non-portable RESEARCH.md list anchors banned by
`.claude/rules/typescript-comments.md`: `(A2)` (stop-failure.ts + test),
`(research A5)` (dispatch.ts + settle.ts), the `Research A5:` section comment and
`test("A5: ...")` title (settle.test.ts). The `Pitfall behind STOP-07` anchor was
removed in the CR-01 comment rewrite. The surviving STOP-* / SFAIL-* / D-88-* IDs
and surrounding rationale carry the traceability. Verified with a repo grep that
no research/pitfall anchors remain in the touched files.

## No Change Needed

### WR-06: STOP-07 rests on the injected-re-entry-does-not-fire-`input` assumption

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`; `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`
**Reason:** Per the fix directions, this is not a code fix — it is a load-bearing
integration assumption already routed to the live-UAT `human_needed` item
(tests/live-uat/README.md item 3). The mocked unit tests exercise the `input`
reset handler directly; proving Pi routes injected `sendMessage` re-entries away
from `input` requires the live/interactive path. Left as-is; keep the
`human_needed` UAT item open until verified against the target Pi version.

## Notes

- IN-01 (`assertNever` exhaustiveness pin) and IN-02 (per-process vs per-session
  wording) are Info-tier and out of the critical_warning scope; not addressed.
- Verification per fix: `tsc --noEmit` green; suites green — settle.test.ts
  (26 tests), payloads/stop-failure.test.ts (28), architecture/hooks-dispatch
  + hooks-cap-notify (13 combined).

---

_Fixed: 2026-07-31T02:03:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
