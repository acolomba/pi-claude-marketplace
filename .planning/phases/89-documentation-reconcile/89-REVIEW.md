---
phase: 89-documentation-reconcile
reviewed: 2026-07-31T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - docs/hooks-compatibility.md
  - docs/output-catalog.md
  - docs/research/claude-hooks-vs-pi-events.md
  - docs/research/issue-103-stop-stopfailure-promotion.md
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 89: Code Review Report

**Reviewed:** 2026-07-31
**Depth:** standard (iteration 3, final — fix/re-review loop)
**Files Reviewed:** 4
**Status:** clean (info-only)

## Summary

Docs-only phase reconciling the v1.16 stop-hooks documentation with shipped
behavior. This is the third and final re-review pass; it verifies the two prior
fixes (CR-01, WR-01) and re-scans for any inconsistency the fixes may have
introduced. All narrative claims were cross-checked against the ground-truth
sources: `extensions/pi-claude-marketplace/domain/components/hook-events.ts`,
`extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, and the phase
89-RESEARCH / 89-CONTEXT decisions.

Both prior fixes are genuinely resolved and introduce no new defect. No Critical
or Warning findings remain. Two Info items stand: IN-01 (carried forward,
accepted-as-is per orchestrator) and IN-02 (a newly surfaced minor completeness
gap, pre-existing, non-blocking). Per protocol, info-only findings permit
`status: clean`.

### Fix verification

**CR-01 — StopFailure promoted to the exact-mapping (●) bucket — RESOLVED.**
- `claude-hooks-vs-pi-events.md` line 8 (exec summary) reads `10 exact, 4
  partial, 16 with no Pi analog`; the summary table (lines 161–163) lists the
  same 10/4/16, with `StopFailure` present in the ● row alongside `Stop`.
- The perfect-fidelity table (line 198) independently lists bucket A = 10 with
  both `Stop` and `StopFailure`. Naive totals (10 + 4 + 16 = 30) and the
  reclassification accounting (A+B+D = 14, +2 subagent-conditional, +9 E/F/G,
  +5 H = 30) both close.
- Ground truth: `hook-events.ts` `BUCKET_A_EVENTS` includes `"Stop"` and
  `"StopFailure"` (lines 49–50); the shipped set matches the doc.

**WR-01 — stale 7/3 bucket counts reconciled to 9/5 — RESOLVED.**
- `claude-hooks-vs-pi-events.md` line 323 now reads `9 upstream-fixable
  blockers` / `5 H-bucket inapplicable events`. Verified agreement with every
  other reference in the file: lines 10, 11, 12 (incl. the `14 = 9 + 5`
  arithmetic), 210, 211, 310, 311, 386, 457, 458.
- Cross-doc: `hooks-compatibility.md` "Event status classification" lists the
  "Blocked on upstream Pi support" bucket at 9 events and "Permanently
  inapplicable" at 5, matching the 9/5 split.

**No new inconsistency introduced.** The CR-01 edit touched only the exec
summary and the two summary rows; the "earlier drafts" note (line 165) correctly
states StopFailure "joins the ● row." The WR-01 edit was a single 7/3 → 9/5
correction at line 323. The StopFailure 10-value error vocabulary
(`hooks-compatibility.md` line 90; `issue-103` line 73; `hook-events.ts` lines
260–269) and the 8-block cap (`settle.ts` `STOP_OVERRIDE_CAP = 8`;
`hooks-compatibility.md` line 41; `issue-103` line 64) are consistent
everywhere. The `agent_settled` `stopReason` dispatch table (`issue-103` lines
47–53) matches the shipped `settle.ts` switch: `stop`→Stop, `error`/`length`→
StopFailure (observation-only), `aborted`/`toolUse`→no-op.

## Info

### IN-01: issue-103 CHANGELOG version-label imprecision (carried forward, accepted)

**File:** `docs/research/issue-103-stop-stopfailure-promotion.md:12`
**Issue:** The "Cost" bullet states the upstream CHANGELOG "attributes
`agent_settled` to a patch the npm registry never released — 0.80.3 → 0.80.5".
The version-label narration is imprecise but the load-bearing claim (`>=0.80.5`
is the correct installable floor, since the typings first ship in 0.80.5) is
correct and consistent with line 21 and line 37.
**Status:** Accepted-as-is per orchestrator direction. Not escalated. No action
required.

### IN-02: additionalContext re-entry lane omitted from cap / flag prose (pre-existing)

**File:** `docs/research/issue-103-stop-stopfailure-promotion.md:63-64`; also
`docs/hooks-compatibility.md:161`
**Issue:** The docs describe `stop_hook_active` as "set when the bridge blocks
and re-enters" and the loop cap as "8 consecutive blocks." The shipped code
(`settle.ts`, D-88-08) folds the `additionalContext`-without-block continuation
into the *same* per-session flag and the *same* consecutive-re-entry counter:
`stopHookActive` is "set on ... block OR an additionalContext continuation
(D-88-08)" and `consecutiveBlockCount` is "incremented on EVERY bridge re-entry
— block AND additionalContext share one counter." The prose is accurate for the
block lane but silent on the additionalContext lane also counting toward the
cap and setting the flag.
**Fix:** Optional — when next touched, extend the cap/flag sentences to note the
additionalContext continuation shares the counter and flag (D-88-08). Low
priority: the doc is a design/research note, the omission is a completeness gap
rather than a contradiction, and it is pre-existing (not introduced by the
CR-01/WR-01 fixes). Non-blocking; does not affect `status: clean`.

---

_Reviewed: 2026-07-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
