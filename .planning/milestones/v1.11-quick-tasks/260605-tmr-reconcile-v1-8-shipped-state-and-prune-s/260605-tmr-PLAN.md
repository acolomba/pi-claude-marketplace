---
quick_id: 260605-tmr
title: Reconcile v1.8 shipped state and prune stale v1.4-UAT backlog
status: planned
created: 2026-06-05
---

# Quick Task 260605-tmr: Reconcile v1.8 shipped state + prune stale backlog

## Problem

Two `.planning/` docs carry stale claims now that v1.8 (Plugin and Marketplace
Info Commands) shipped via PR #36 (merged 2026-06-04, commit 47a63f7):

1. **STATE.md** still reads mid-flight -- frontmatter `status: "PR #36 open for
   review"`, `completed_phases: 0`, `completed_plans: 0`, `percent: 0`,
   `stopped_at: v1.8 roadmap created`; Session Continuity "Stopped At: v1.8
   roadmap created" / "Resume File: ... (Phase 42 next)". This contradicts its
   own body line "Phase: Milestone v1.8 complete" and MILESTONES.md
   ("v1.8 ... Shipped: 2026-06-04"). `milestone_name` is also garbled
   ("milestone closes.").
2. **BACKLOG.md** still carries the whole "v1.4 UAT findings" section (items
   1-6), but all six were resolved in v1.5: item 1 -> UXG-01 (27-02), item 2 ->
   UXG-02 (28-01), item 3 -> UXG-07 (already marked CLOSED inline), item 4 ->
   UXG-04 (27-03), item 5 -> UXG-05 (27-04), item 6 -> UXG-06 (27-01).

## Tasks

### Task 1: Reconcile STATE.md to v1.8-shipped

- files: .planning/STATE.md
- action: Update frontmatter (status, stopped_at, last_updated, last_activity,
  milestone_name, progress completed counts -> 3 phases / 5 plans / 100%), body
  Current Position (Status + Last activity), and Session Continuity (Stopped At
  + Resume File) so every field agrees v1.8 is shipped.
- verify: `grep -n "PR #36 open" .planning/STATE.md` returns nothing; frontmatter
  `percent: 100`.
- done: STATE.md frontmatter and body agree v1.8 is shipped; next step is a new
  milestone.

### Task 2: Prune resolved v1.4-UAT section from BACKLOG.md

- files: .planning/BACKLOG.md
- action: Delete the "## v1.4 UAT findings (output-grammar / severity UX)"
  section in full (all six items shipped in v1.5).
- verify: `grep -c "v1.4 UAT findings" .planning/BACKLOG.md` == 0; the three
  remaining sections (Manifest cache NFR-8, Install error misattribution,
  Structural `{not added}` variant) stay intact.
- done: BACKLOG.md holds only genuinely-deferred items.
