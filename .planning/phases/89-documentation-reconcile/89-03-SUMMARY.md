---
phase: 89-documentation-reconcile
plan: 03
subsystem: docs
tags: [hooks, stop, stopfailure, agent_settled, research-note, reconcile]

# Dependency graph
requires:
  - phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
    provides: shipped Stop/StopFailure behavior (agent_settled dispatcher, stopReason gate, decision control)
  - phase: 89-documentation-reconcile (plan 01)
    provides: issue-103 doc riders landed (agent_settled 0.80.5 attribution) — the pointer target for DOC-05
provides:
  - "docs/research/claude-hooks-vs-pi-events.md reconciled in place with shipped v1.16 Stop/StopFailure"
  - "agent_settled documented as Pi extension-event inventory row #31"
  - "DOC-05 pointers from every corrected Stop/StopFailure claim to the issue-103 authority doc"
affects: [gsd-verify-work, milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correct-in-place research-note amendment (D-89-05): no strikethrough, no superseded relics; git carries history"
    - "Falsified-claim-only scope (Pitfall 3): historical feasibility analysis preserved where still accurate"

key-files:
  created:
    - .planning/phases/89-documentation-reconcile/89-03-SUMMARY.md
  modified:
    - docs/research/claude-hooks-vs-pi-events.md

key-decisions:
  - "Stop/StopFailure cross-mapping rows marked ● (exact) — shipped bucket-A with full decision control, not lossy ◐ syntheses"
  - "Feasibility bucket membership corrected (A 8->10, D 5->3); A+B+D total held at 14 (arithmetic unchanged), so totals prose left untouched per Pitfall 3"
  - "agent_settled appended as inventory row #31 rather than inserted near agent_end (row 13) — matches the must-have 'row #31' phrasing and avoids renumbering 30 rows"
  - "Bucket-D synthesis-table Stop/StopFailure rows rewritten as 'Promoted to bucket A — shipped, not synthesized' to stay internally consistent with the D=3 feasibility count"

patterns-established:
  - "Grep-gated doc reconcile: retired-claim strings asserted absent (count 0), pointer strings asserted present (count >=N)"

requirements-completed: [DOC-05]

coverage:
  - id: D1
    description: "Naive-table 'agent_end is observation-only / Bridge cannot honor block' Stop claim retired; StopFailure 'no turn-ended-by-error terminal event' synthesis claim retired; both cross-mapping rows now read as agent_settled dispatch + stopReason contract"
    requirement: "DOC-05"
    verification:
      - kind: other
        ref: "grep -c 'Bridge cannot honor' docs/research/claude-hooks-vs-pi-events.md == 0; grep -c 'has no .turn ended by error. terminal event' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "agent_settled added as Pi inventory row #31; Pi event count updated 30 -> 31 in executive summary and inventory prose"
    requirement: "DOC-05"
    verification:
      - kind: other
        ref: "grep -c 'agent_settled' docs/research/claude-hooks-vs-pi-events.md >= 1; grep -c 'Pi has 30 extension events' == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "DOC-05-required pointers to issue-103-stop-stopfailure-promotion.md land at every corrected Stop/StopFailure claim"
    requirement: "DOC-05"
    verification:
      - kind: other
        ref: "grep -c 'issue-103-stop-stopfailure-promotion.md' docs/research/claude-hooks-vs-pi-events.md == 9 (>=2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only shipping-falsified claims changed; historical feasibility analysis (E/F/G/H, soft-dep audit, non-Stop marketplace coverage) preserved; no strikethrough/superseded relics introduced; doc internally consistent post-correction"
    requirement: "DOC-05"
    verification:
      - kind: manual_procedural
        ref: "human review at /gsd-verify-work against 89-RESEARCH.md Stale-Claim Inventory §B; git diff -U0 shows no hunk in E/F/G/H tables or Soft-dep audit sections"
        status: pass
    human_judgment: true
    rationale: "Prose fidelity to the §B inventory and the 'internally consistent / only falsified claims' editorial judgment cannot be fully proven by grep; requires human review (the DOC-05 UAT surface)."

# Metrics
duration: 20min
completed: 2026-07-31
status: complete
---

# Phase 89 Plan 03: DOC-05 research-note reconcile Summary

**`docs/research/claude-hooks-vs-pi-events.md` corrected in place so the Stop/StopFailure mapping analysis matches shipped v1.16 — `agent_settled` dispatch, the `stopReason` protocol contract, bucket-A promotion, and issue-103 pointers — while the still-accurate historical feasibility analysis is preserved untouched.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-31T10:35Z (approx)
- **Completed:** 2026-07-31T10:53Z
- **Tasks:** 2
- **Files modified:** 1 (docs source) + planning docs

## Accomplishments

- Retired the naive-table "Pi's `agent_end` is observation-only / Bridge cannot honor `decision: block`" Stop claim and the StopFailure "no turn-ended-by-error terminal event" synthesis claim; both cross-mapping rows now read as `agent_settled` dispatch with full decision control (Stop) and the `stopReason` protocol contract (StopFailure), marked ● exact.
- Added `agent_settled` as Pi extension-event inventory row #31 and bumped the Pi event count 30 → 31 (executive summary + inventory prose); Claude's 30-event count left unchanged.
- Corrected every shipping-falsified cell: executive-summary framing, naive-summary buckets (◐ 6 → 4), the perfect-fidelity feasibility table (A 8 → 10, D 5 → 3), the bucket-D synthesis table Stop/StopFailure rows (rewritten as "Promoted to bucket A — shipped, not synthesized"), the `after_provider_response` no-Claude-analog note, path-forward item 2, and the marketplace coverage bucket labels (Stop → A; ralph-wiggum/hookify flip to fully available; highest-risk-synthesis framing retired).
- Landed DOC-05 pointers to `issue-103-stop-stopfailure-promotion.md` at every corrected claim (9 references total).

## Task Commits

Each task was committed atomically:

1. **Task 1: Date/status line, Pi count, agent_settled row #31, exec-summary Stop retire (B1-B4)** - `df5914f9` (docs)
2. **Task 2: Cross-mapping rows, naive summary, feasibility + bucket-D + path-forward, marketplace labels (B5-B12)** - `ff4d2598` (docs)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `docs/research/claude-hooks-vs-pi-events.md` - Correct-in-place amendment of the Stop/StopFailure mapping analysis (rows B1-B12 of the research Stale-Claim Inventory §B).
- `.planning/phases/89-documentation-reconcile/89-03-SUMMARY.md` - This summary.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` - Position/decisions/progress and DOC-05 completion.

## Decisions Made

- Marked both cross-mapping rows ● (exact): the timing shift is not hook-observable, consistent with D-89-02 flipping the compatibility-doc rows to ✓.
- Left the A+B+D "14 events shippable / 16 supported" totals prose unchanged — moving Stop/StopFailure from D to A keeps the sum at 14, so no re-count was warranted (Pitfall 3, Deferred Ideas).
- Kept the Stop/StopFailure rows in the bucket-D synthesis table but rewrote their cells to say "Promoted to bucket A — shipped, not synthesized" so the table stays internally consistent with the corrected D=3 feasibility count.
- Appended `agent_settled` as row #31 (not inserted near `agent_end`) to match the must-have "row #31" phrasing and avoid renumbering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The `mdformat` pre-commit hook reformatted the inventory and bucket-D synthesis tables (widened columns to fit the new/longer cells) on both task commits. Expected formatter behavior; restaged and re-ran until clean per project policy (no `--amend` recovery, no `--no-verify`).
- `state.update-progress` reported "Progress field not found in STATE.md" (it looks for a text progress bar; this project tracks progress in frontmatter). Bumped `completed_plans` 10 → 11 in the STATE.md frontmatter manually.

## Flagged Assumptions (surfaced, not dropped)

Per the plan's edge-probe requirement, these are recorded for /gsd-verify-work rather than silently resolved:

- **DOC-05 spec-less probe (`unclassified` — "review manually") remains UNRESOLVED.** There is no crisp boundary/precision predicate to author for DOC-05 beyond the §B row-by-row inventory; correctness is proven structurally by the grep assertions here and confirmed by human review against Stale-Claim Inventory §B at /gsd-verify-work. It was NOT converted into a false-precision acceptance criterion.
- **The issue-103 doc's line-73 StopFailure-classifier phrasing** ("optionally firmed by HTTP status via `after_provider_response`") is intentionally left untouched (out of scope for this doc; plan 01/02 scope note). This plan's B8 touch-up concerned only THIS doc's `after_provider_response` no-Claude-analog note.

## Verification

- Task 1 automated: `agent_settled` present (2), `Pi has 30 extension events` count 0, issue-103 pointer present.
- Task 2 automated: `Bridge cannot honor` count 0, `has no "turn ended by error" terminal event` count 0, issue-103 pointer count 9 (≥2).
- No introduced `~~` strikethrough or `superseded` relics (`git diff` added-line grep clean). Two pre-existing `~~` in the answered-open-questions tail (lines 591/595) are outside edit scope and untouched.
- `git diff -U0` hunks confined to falsified-claim sections; E/F/G/H blocker tables, synthesis-caveats, and the Soft-dep extension audit show no hunks.
- Doc-coupled architecture tests green (61/61: catalog-uat, hooks-cap-notify, partial-vocabulary-guard) — this doc is read by no test; the untouched `output-catalog.md` couplings did not regress.

## Next Phase Readiness

- Phase 89 (Documentation reconcile) is the last phase of milestone v1.16; all three plans complete. Ready for `/gsd-verify-work` — DOC-04 and DOC-05 verification is human review against the Stale-Claim Inventory (no automated byte-gate for the three narrative docs).
- No blockers.

## Self-Check: PASSED

- `89-03-SUMMARY.md` — FOUND
- `docs/research/claude-hooks-vs-pi-events.md` — FOUND
- Commits `df5914f9`, `ff4d2598`, `1bb1caf3` — all FOUND in git log

---
*Phase: 89-documentation-reconcile*
*Completed: 2026-07-31*
