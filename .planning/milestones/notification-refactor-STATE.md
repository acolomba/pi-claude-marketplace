---
gsd_state_version: 1.0
milestone: Notification Refactor
milestone_name: milestone
current_phase: 04
current_plan: Not started
status: completed
stopped_at: Phase 4 context gathered (concern extraction, documented open-closed proof)
last_updated: "2026-06-25T02:45:37.684Z"
last_activity: 2026-06-25
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (shared project context)

**Milestone:** Notification Refactor (unnumbered — concurrency-friendly workstream)
**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Current Position

Phase: 04 (concern-module-extraction-open-closed-proof) — EXECUTING
Plan: 1 of 3
**Status:** Milestone complete
**Current Phase:** 04
**Phase Count:** 4 (Phase 1–4; isolated workstream numbering, does not continue from main project)
**Last Activity:** 2026-06-25
**Last Activity Description:** Phase 04 complete

## Phases

1. Localized type model & registry spine — MOD-01/02/03, OUT-07 (output-neutral scaffold)
2. Caller-stamped severity & reload reducer — SEV-01..05, RLD-01..05, GATE-01
3. Desired-state output & atomic catalog supersession — OUT-01..06, OUT-08, GATE-02
4. Concern-module extraction & open-closed proof — MOD-04/05/06, GATE-03

## Progress

**Phases Complete:** 3 / 4
**Current Plan:** Not started

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
- 03-02: OUT-03/04 trailing tally (`<Operation>: <n> failure(s), <n> warning(s), <n> success(es)`) gated on a STRUCTURAL single/plural cardinality threaded from the invocation form; `label`+`cardinality` ride on CascadeNotificationMessage/ReconcileAppliedCascadeMessage (so the catalog-uat notify() driver and fixtures exercise the tally). countRowsBySeverity widened to count "info" (success). Single emitWithSummary seam preserved.
- 03-02: marketplace update OMITS the tally — it is STRUCTURALLY single (one named marketplace per invocation, Single<...> at the call site), diverging from the plan's plural-section enumeration; the D-04 structural-cardinality HARD constraint overrides. A bare marketplace grouping header (no status, no severity) is excluded from the success count; an mp row WITH a status (import added, remove removed) counts as a real operation (D-03 mixed-subject uniform counting).
- 03-02: Wired the bulk reinstall/update/import orchestrators to thread cardinality (Rule 2 — the tally is dead without it); apply.ts (reconcile converge) untouched and notify-reasons.ts (closed set) untouched.
- 03-03: OUT-08/D-06 catalog present→installed grammar collapse landed prose/table-only (catalog L73/L131-132/L247/L289/L318). Merged the two status-token table rows into a single (installed) row; zero fenced-block byte change confirmed (RESEARCH A4 — no fence emitted (present)), so catalog-uat + notify-grammar-invariant stay green with no fixture edit. mdformat re-tabulated the table column widths after removing the wide (via present discriminator) row label (mechanical).

## Session Continuity

**Stopped At:** Phase 4 context gathered (concern extraction, documented open-closed proof)
**Resume File:** .planning/workstreams/notification-refactor/phases/04-concern-module-extraction-open-closed-proof/04-CONTEXT.md
**Next:** Phase 04 (concern-module extraction & open-closed proof — MOD-04/05/06, GATE-03)
