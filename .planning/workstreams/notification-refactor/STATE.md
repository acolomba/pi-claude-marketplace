---
gsd_state_version: 1.0
milestone: Notification Refactor
milestone_name: milestone
current_phase: 03
current_plan: 2
status: executing
last_updated: "2026-06-24T23:34:43.932Z"
last_activity: 2026-06-24
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 9
  percent: 55
---

# Project State

## Project Reference

See: .planning/PROJECT.md (shared project context)

**Milestone:** Notification Refactor (unnumbered — concurrency-friendly workstream)
**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Current Position

Phase: 03 (desired-state-output-atomic-catalog-supersession) — EXECUTING
Plan: 2 of 3 (Plan 01 complete)
**Status:** Executing Phase 03
**Current Phase:** 03
**Phase Count:** 4 (Phase 1–4; isolated workstream numbering, does not continue from main project)
**Last Activity:** 2026-06-24
**Last Activity Description:** Completed 03-01 (D-02 leading sentence + D-03 mixed-subject + D-01 absent-target error flips)

## Phases

1. Localized type model & registry spine — MOD-01/02/03, OUT-07 (output-neutral scaffold)
2. Caller-stamped severity & reload reducer — SEV-01..05, RLD-01..05, GATE-01
3. Desired-state output & atomic catalog supersession — OUT-01..06, OUT-08, GATE-02
4. Concern-module extraction & open-closed proof — MOD-04/05/06, GATE-03

## Progress

**Phases Complete:** 2 / 4
**Current Plan:** 2

## Decisions

- 02-01: Narrowed only the 5 plugin transition arms (TransitionMessageBase); marketplace-level transition arms stay optional and default correctly. GATE-01 proven live (TS2741 on omitted needsReload).
- 02-01: Kept the computeSeverity standalone info-kind switch (Q1 LOCKED) — a kind→severity map, not reason inference; only the cascade branch became the dumb MAX reducer.
- 02-01: Extended MarketplaceRows<Msg> with optional severity?/needsReload? so header-only failed mp blocks stamp their own error severity.
- 02-01: Stamped non-success rows in producers outside the plan's file list (marketplace/add, reconcile/pending, plugin/list) — the dumb reducer reads every non-success row (Rule 2). edge-deps/plugin-info installed rows correctly excluded (PluginIndexRow / PluginInfoRow, not cascade rows).
- 02-02: Collapsed present→installed (RLD-04/D-08); PluginInstalledMessage gained an optional description and both PL-4 description predicates were widened to installed so the list row's description second line stays byte-identical (the former present row carried it).
- 02-02: Removed the disable-cascade kind (RLD-05/D-07); the disable reload trailer is driven by the per-row needsReload:true stamp via the RLD-02 OR-reduce. Kept the notifyWithContext kind? param (narrowed to "cascade") + the notify() exhaustiveness switch as the structural seam.
- 02-03: Closed GATE-01's dynamic-case gap (D-05) with a runtime arch test (notify-stamp-coverage.test.ts) driving both reconcile projections; TRANSITION_STATUSES pinned via `satisfies readonly PluginStatus[]` for drift-proofing. Negative proof confirmed the test fails on a stripped stamp. Test-only addition; catalog byte-identical.
- 03-01: D-02 leading sentence via a single `summaryPhrase(count, severity, subject|null)` helper (replaces `operationPhrase`); D-03 mixed-subject branch drops the noun keyed off the combined row total. Single `emitWithSummary` notify seam preserved (IL-2).
- 03-01: uninstall PU-5 already-gone row is `(failed) {not installed}`, NOT `(skipped)` — uninstall's render map renders `uninstalled`/`failed` only (no skipped arm). reinstall/update keep `(skipped) {not installed}` (severity-only flip). Absent-target severity stamped at the producer (`reasons.includes("not installed") ? "error" : skipSeverity`); skipSeverity + the reasons set untouched.
- 03-01: ORCHESTRATED uninstall converge stays silent (apply.ts untouched, WR-06/NFR-2); only the STANDALONE path flips to error. enable/disable not-installed stays warning (not in the D-01 absent-target enumeration).

## Session Continuity

**Stopped At:** 03-01 complete (leading sentence + absent-target error severity landed; catalog-uat green at every boundary)
**Resume File:** .planning/workstreams/notification-refactor/phases/03-desired-state-output-atomic-catalog-supersession/03-01-SUMMARY.md
**Next:** Plan/execute 03-02 (remaining Phase 3 scope, e.g. the OUT-03/04/D-04 trailing tally + Messaging.label threading)
