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
  warning: 1
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

Iteration-2 re-review of docs-only Phase 89 (Documentation reconcile, milestone v1.16 stop-hooks).

**CR-01 is genuinely resolved.** The prior blocker (StopFailure removed from the naive-fidelity `◐` bucket but never added to the `●` bucket, leaving counts inconsistent) is fixed in commit `db507326`. All four verification checks pass in `docs/research/claude-hooks-vs-pi-events.md`:

- The `● Exact or near-exact mapping` row (line 161) lists **10** events and now includes `StopFailure`.
- Executive summary (line 8) reads "10 exact, 4 partial, 16 with no Pi analog."
- Buckets total 30 (10 + 4 + 16), matching the cross-mapping table (`Stop`/`StopFailure` both `●` at lines 140-141) and the perfect-fidelity feasibility table (bucket A = 10, line 198).
- The note at line 165 is coherent: it folds both `Stop` and `StopFailure` into the `●` row with the `agent_settled` / `stopReason` rationale.

Ground-truth verification confirms the docs match the shipped implementation. `BUCKET_A_EVENTS` in `extensions/pi-claude-marketplace/domain/components/hook-events.ts` includes `StopFailure`; the 10-value closed error-type set (lines 259-270) is byte-for-byte identical across `hook-events.ts`, `docs/hooks-compatibility.md:90`, and `docs/research/issue-103-...md:73`. `bridges/hooks/settle.ts` dispatches off `agent_settled`, gates on `stopReason` (`error`/`length` → StopFailure observation-only, `aborted` → neither), and caps re-entry at `STOP_OVERRIDE_CAP = 8`, matching the docs' claims.

The CR-01 fix introduced **no new inconsistencies** — it touched only 3 lines (exec summary, `●` bucket-table row, Stop note), all internally consistent.

However, an adversarial full-file sweep surfaced one pre-existing internal contradiction that the reconcile phase (whose entire deliverable is factual consistency) should have caught, and which lives on a line edited during this phase (commit `ff4d2598`, `docs(89-03): reconcile ...`). See WR-01.

## Warnings

### WR-01: Stale bucket counts (7 / 3) contradict the reconciled 9 / 5 counts

**File:** `docs/research/claude-hooks-vs-pi-events.md:323`
**Issue:** The "Official marketplace plugin coverage → Summary" sentence states: "...so neither the **7 upstream-fixable blockers** nor the **3 H-bucket** inapplicable events are exercised by Anthropic's own catalog." Both numbers are wrong and contradict the reconciled bucketing used everywhere else in the same document:

- Upstream-fixable blockers are **9** (E=4 + F=1 + G=4), stated at line 12, line 210, line 386, and line 457.
- H-bucket inapplicable events are **5** (`ConfigChange`, `Setup`, `InstructionsLoaded`, `TaskCreated`, `TaskCompleted`), stated at line 12, line 205, line 386, and the H-bucket table at line 275.

Line 386 — in the *same* section, 63 lines below — reads "None of the **9** upstream-fixable blocker events are used, and none of the **5** H-bucket silently-dropped events are used either," a direct contradiction. The `7`/`3` values are stale remnants of the pre-reclassification bucketing (when G held only `Elicitation`/`ElicitationResult` = 2 and H held only 3 events, before the Worktree pair moved C→G and the Task pair moved C→H — the very reclassification documented at lines 207 and 454). The sentence's own reference to "buckets E, F, G, or H" is internally inconsistent with its `7`/`3` figures (E+F+G=9, H=5).

**Fix:** Update line 323 to match the reconciled counts:
```markdown
**No plugin in the official marketplace hooks any event in buckets E, F, G, or H**, so neither the 9 upstream-fixable blockers nor the 5 H-bucket inapplicable events are exercised by Anthropic's own catalog.
```

## Info

### IN-01: issue-103 sources-table CHANGELOG version-label imprecision (previously accepted)

**File:** `docs/research/issue-103-stop-stopfailure-promotion.md:12,21`
**Issue:** The prose (line 12) notes the upstream CHANGELOG attributes `agent_settled` to "a patch the npm registry never released -- 0.80.3 → 0.80.5," while the authoritative-sources table (line 21) labels the introduction simply "0.80.5 (2026-07-09)." The two references are reconcilable but the version-label precision differs. This was deliberately left in iteration 1 and is carried forward here unchanged; the underlying installable-floor claim (`>=0.80.5`) is correct and consistent with the peer-floor bump described at line 12.
**Fix:** Optional — no action required. If tightened later, make the sources-table row mirror the prose's "0.80.3 → 0.80.5 (typings first ship 0.80.5)" nuance.

---

_Reviewed: 2026-07-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
