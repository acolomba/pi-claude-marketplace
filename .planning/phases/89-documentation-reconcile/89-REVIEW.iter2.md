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
  critical: 1
  warning: 0
  info: 1
  total: 2
status: issues_found
---

# Phase 89: Code Review Report

**Reviewed:** 2026-07-31
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Docs-only reconcile phase (v1.16 Stop/StopFailure promotion). I verified all four files against ground-truth source — `hook-events.ts` (`BUCKET_A_EVENTS` = 10, `StopFailure` closed set = exactly 10 values), the Stale-Claim Inventory in `89-RESEARCH.md`, and decisions D-89-01..07 — plus the actual phase diffs (`a6dcfdf0..ff4d2598`).

Most of the reconcile landed cleanly and is confirmed correct:

- D-89-01: milestone-version framing (`v1.13`) is fully stripped from `hooks-compatibility.md`; only generic "future milestone" phrasing remains (acceptable). No `v1.16` was substituted.
- D-89-02: `Stop`/`StopFailure` rows flip to `✓`; timing-shift subsection added with issue-103 pointer; StopFailure 10-value matcher row matches `hook-events.ts:259-270` exactly.
- D-89-06: all four `0.80.4` sites corrected to `0.80.5` (grep confirms zero `0.80.4` remain in `docs/`).
- D-89-07: `output-catalog.md:390` re-pointed `Stop` → `Notification` (a genuinely non-bucket-A event); byte-safe, outside every fenced block; no other stale Stop-as-unsupported example remains.
- A7/A8/A9/A12: `(unavailable) {unsupported hooks}` partial-partition reconcile applied; the only surviving `(unavailable)` reference (line 230) is the correct structural-malformed arm.

One real defect: the `claude-hooks-vs-pi-events.md` naive-fidelity summary botched the StopFailure correction — it was removed from the `◐` bucket but never promoted to `●`, so it vanishes from the summary entirely, the `●` count is wrong, and the three buckets no longer total 30. This contradicts the doc's own cross-mapping and feasibility tables and the shipped code.

## Critical Issues

### CR-01: StopFailure dropped from the naive-fidelity summary — wrong count, event omitted, contradicts sibling tables and shipped code

**File:** `docs/research/claude-hooks-vs-pi-events.md:161` (and `:8`, `:165`)

**Issue:**
The phase moved `StopFailure` out of the `◐ Partial / lossy mapping` bucket (correctly — it now ships as bucket-A) but never added it to the `● Exact or near-exact mapping` bucket. The result is internally inconsistent three ways:

1. The `●` row (line 161) still reads count `9` and its event list omits `StopFailure`. The three buckets now sum to `9 + 4 + 16 = 29`, but the section maps all 30 Claude events. StopFailure fell through the cracks.
2. The cross-mapping table directly above (line 141) marks `StopFailure` `●` (exact), and the "Perfect-fidelity feasibility" table (line 198) lists it under bucket **A. Direct 1:1 mapping** (count 10). The summary contradicts both sibling tables in the same doc.
3. Shipped code confirms `StopFailure` is a direct/exact mapping: `hook-events.ts:40-51` includes it in `BUCKET_A_EVENTS`; `settle.ts` dispatches it off `agent_settled`. So `9 exact` is factually wrong — it must be `10`.

The executive-summary count on line 8 ("Direct correspondence: 9 exact, 6 partial, 16 with no Pi analog") was never touched this phase and is now doubly stale: `6 partial` contradicts the body table's corrected `4 partial`, and `9 exact` shares the same StopFailure undercount. D-89-05 required updating count prose "where it becomes false"; this one became false.

The note at line 165 also only accounts for `Stop` moving to the `●` row alone; it should acknowledge `StopFailure` joining `●` as well (or at minimum not leave StopFailure unexplained).

**Fix:**
Promote `StopFailure` into the `●` bucket and reconcile every dependent count:

```text
# line 161 — add StopFailure, bump count to 10
| ● Exact or near-exact mapping    | 10    | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd, Stop, StopFailure |

# line 8 — 9 exact → 10 exact, 6 partial → 4 partial
- **Naive 1:1 mapping is misleading.** Direct correspondence: 10 exact, 4 partial, 16 with no Pi analog. ...
```

Then extend the line 165 note so `StopFailure` (previously the `◐` `after_provider_response` synthesis) is explicitly folded into `●` alongside `Stop`. Verify the final buckets total 30 (`10 + 4 + 16`).

## Info

### IN-01: issue-103 sources-table cites "CHANGELOG -- 0.80.5" while the doc's own nuance says the CHANGELOG names an unreleased patch

**File:** `docs/research/issue-103-stop-stopfailure-promotion.md:21`

**Issue:**
The D-89-06 mechanical `0.80.4 → 0.80.5` sweep changed the sources-table row to `agent_settled` introduction ... `CHANGELOG -- 0.80.5 (2026-07-09)`. But lines 8 and 12 of the same doc explain that the upstream CHANGELOG attributes `agent_settled` to a patch npm never released (i.e. 0.80.4), and that `0.80.5` is the *installable* floor, not the CHANGELOG's own version label. Strictly, the CHANGELOG entry is not "0.80.5"; the `(2026-07-09)` date is that unreleased-patch entry's date. This is a minor imprecision, defensible because the row now cites the installable version, and the nuance is preserved elsewhere in the doc.

**Fix:** Optional. If tightening, phrase the row so it reflects the nuance, e.g. `CHANGELOG entry dated 2026-07-09; first installable in 0.80.5`. Not required — the directed edit is internally survivable given lines 8/12 carry the caveat.

---

_Reviewed: 2026-07-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
