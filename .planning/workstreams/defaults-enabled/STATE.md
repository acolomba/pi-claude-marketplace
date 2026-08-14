---
gsd_state_version: 1.0
milestone: defaults-enabled
milestone_name: defaultEnabled Manifest Field
current_phase: 101
current_phase_name: manifest-field-and-precedence-resolution
current_plan: N/A
status: Ready to execute
stopped_at: Phase 101 planned — 3 plans in 2 waves, plan-checker passed
last_updated: "2026-08-14T14:25:23.712Z"
last_activity: 2026-08-14
last_activity_desc: Phase 101 planned — 3 plans in 2 waves, 13/13 decisions covered
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (shared across workstreams; updated 2026-08-12 after
the v1.18 close)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Milestone `defaults-enabled` — a plugin author can ship a
plugin that installs disabled (`defaultEnabled: false`), and nothing later
re-enables it behind the user's back. Roadmap complete: 5 phases (101-105),
15/15 requirements mapped.

## Current Position

Phase: 101 — Manifest field and precedence resolution (planned, not executed)
Plan: 3 plans in 2 waves — 101-01 (wave 1), 101-02 + 101-03 (wave 2, parallel)
Status: Ready to execute
Last activity: 2026-08-14 — Phase 101 planned; plan-checker passed with no blockers

## Progress

**Phases Complete:** 0/5
**Current Plan:** N/A

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 101 | Manifest field and precedence resolution | DFEN-01, DFEN-02, DFEN-03 | Planned (0/3 plans) |
| 102 | Reason token, install write-through and notification | OUT-01, DFEN-04, DFEN-05, OUT-04 | Not started |
| 103 | Reconcile stability and lifecycle non-reapplication | DFEN-06, DFEN-07 | Not started |
| 104 | Pre-install read surfaces | OUT-02, OUT-03, OUT-05 | Not started |
| 105 | No-op parity sweep and contract documentation | DFEN-08, DOC-01, DOC-02 | Not started |

## Accumulated Context

**Design anchor (fixed, not re-litigable per phase):** install-time
write-through. Install stamps `enabled: false` into the scope's
`claude-plugins.json` entry rather than resolving the manifest value at consume
time. The rejected alternative — teaching `isDeclaredEnabled`
(`persistence/config-io.ts`) the manifest value — must not reappear in any
phase: the reconcile planner has no manifest access, a manifest edit would flip
a user's plugin off underneath them on reload, and it contradicts the upstream
install-time-only timing.

**Milestone-wide constraints:** `npm run check` green at every phase boundary
(NFR-6); no phase introduces a network call on a read path (NFR-5); no state
schema migration; `--skip-ui` on every `/gsd-plan-phase` call (the UI keyword
gate matches this project's domain vocabulary as a known false positive).

## Open Decisions

Two design questions are deliberately unresolved and carried into Phase 102's
CONTEXT for `/gsd-discuss-phase`. Neither may be settled by an executor.

1. **Materialization path for an install-disabled plugin.** The install ledger
   is a fixed literal 6-phase array (`orchestrators/plugin/install.ts:1239`)
   whose order is a contract under D-01 literal-array discipline. Does a
   `defaultEnabled: false` install run the five materialization phases and then
   drop the artifacts, or skip them and run only the state phase? This changes
   the ledger's shape and its rollback story.

2. **Orchestrated-mode installs.** The config write-back is deliberately
   skipped in orchestrated mode (`orchestrators/plugin/install.ts:1409`)
   because reconcile derives desired state FROM the config. A cascade install
   (import, reconcile) of a `defaultEnabled: false` plugin therefore has no
   write-back seam, and its config entry already exists with `enabled` absent.
   Decide whether that pre-existing entry counts as the user's explicit setting
   (DFEN-05 wins, plugin enables) or as no setting at all (DFEN-04 applies).

## Session Continuity

**Stopped At:** Roadmap written to
`.planning/workstreams/defaults-enabled/ROADMAP.md`; awaiting user approval.
**Resume File:** None
**Next Action:** `/gsd-discuss-phase 101` after approval.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
