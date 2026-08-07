---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: env-parity
status: Awaiting next milestone
stopped_at: Milestone v1.17 closed and archived (2026-08-05)
last_updated: "2026-08-05T12:18:50.749Z"
last_activity: 2026-08-05
last_activity_desc: Milestone v1.17 completed and archived
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 9
  completed_plans: 9
  percent: 100
current_phase: 90
current_phase_name: session-environment-initialization
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05 after v1.17 close)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** Planning next milestone. v1.17 env-parity shipped 2026-08-05;
PR #115 (`features/env-parity`) carries the milestone and awaits review/merge;
npm 0.13.0 releases via the v-tag CI publish path after the squash-merge.

## Current Position

Phase: Milestone v1.17 complete (Phases 90-94 archived to
.planning/milestones/v1.17-phases/)
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-05 — Milestone v1.17 completed and archived

## Milestone Summary

v1.17 env-parity shipped 2026-08-05 — 5 phases (90-94), 9 plans, 23 tasks,
14/14 requirements satisfied; milestone audit passed (9/9 integration seams,
5/5 E2E flows); all five phases UAT-confirmed. Full detail:
.planning/milestones/v1.17-ROADMAP.md, .planning/milestones/v1.17-REQUIREMENTS.md,
and the entry in .planning/MILESTONES.md.

Known tech debt carried out of the milestone (recorded in
milestones/v1.17-MILESTONE-AUDIT.md): Phase 90's VALIDATION.md was left at
`status: draft` (coverage itself re-verified 20/20), and 91-01-SUMMARY.md
predates review-fix commit 96cb08c5 (narrative staleness only).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-v2z | amend v1.17 env-parity planning docs per validation findings | 2026-08-02 | 1ce8f203 | [260802-v2z-amend-v1-17-env-parity-planning-docs-per](./quick/260802-v2z-amend-v1-17-env-parity-planning-docs-per/) |
| 260804-gcs | Fix applyPathLedger non-owned PATH stripping | 2026-08-04 | aeef0882 | [260804-gcs-fix-applypathledger-non-owned-path-strip](./quick/260804-gcs-fix-applypathledger-non-owned-path-strip/) |

## Decisions

The v1.17 decision log is folded into PROJECT.md Key Decisions (D-90-05,
D-90-06, and the docs/env-vars.md authority decision added at the close).
No open decisions.

## Deferred Items

Items acknowledged and deferred at the v1.14 milestone close on 2026-07-23,
re-acknowledged unchanged at the v1.16 close on 2026-07-31, and re-acknowledged
at the v1.17 close on 2026-08-05 (override_closeout, known deferred artifacts: 6).
The one addition at the v1.17 close is the `async-rewake-lane-inert` debug
session — a concluded diagnose-only investigation (root cause confirmed: the
async-rewake lane is inert on Stop by design; no fix applied or intended).
None of the carryover items originate from v1.17 env-parity.

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred |
| debug | async-rewake-lane-inert | diagnosed (diagnose-only; by design) |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Merge PR #115 (`gh pr merge --squash`) once review completes; npm 0.13.0
  releases via the v-tag CI publish path.
- Start the next milestone with /gsd-new-milestone

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
