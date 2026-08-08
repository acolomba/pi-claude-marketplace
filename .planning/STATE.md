---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: manifest-independent-installed-plugin-info
status: planning
stopped_at: Roadmap approved; awaiting Phase 95 planning
last_updated: "2026-08-07T22:44:14Z"
last_activity: 2026-08-07
last_activity_desc: "v1.18 roadmap validated against the codebase; 16/16 requirements mapped, 3 open decisions"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-07 for v1.18 start)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** v1.18 Manifest-Independent Installed Plugin Info. Make
list/info derive installed truth from the existing installation record when a
valid marketplace manifest no longer contains the plugin entry, without
persistence or update-semantics changes.

## Current Position

Phase: Not started (roadmap created — Phases 95-97 mapped)
Plan: —
Status: Roadmap approved and validated; three open decisions block Phase 95 planning
Last activity: 2026-08-07 — Completed quick task 260807-q0v: amend v1.18 planning docs per two-review validation findings

## Roadmap Summary

- 3 sequential phases (95-97), continuing the global counter from Phase 94.
  All 16 v1 requirements map exactly once; no orphans.
- Eight requirements (INV-02/03/04, BOUND-01/02, LIFE-04/05/06) describe behavior
  the code already exhibits. They are carried as contracts the milestone must not
  break, and their deliverable is characterization and regression coverage. The
  net-new work is INV-01, BOUND-03, INFO-09..12, COMPAT-01, and DOC-08.
- **Phase 95 — Manifest-independent installed inventory** (INV-01..04, BOUND-03):
  characterize the existing union behavior, then open the render-map seam so
  `{not in manifest}` can appear on installed rows, and thread the manifest load
  error through the cross-scope orphan-fold path.
- **Phase 96 — Installation-record-backed plugin info** (INFO-09..12,
  BOUND-01/02): the substantive phase. Reorder the valid-manifest miss path,
  reconstruct local component structure, preserve partial compatibility, add the
  explicit network guard the reorder requires, and lock read-failure versus
  unknown-name boundaries.
- **Phase 97 — Lifecycle regression and contract documentation** (LIFE-04..06,
  COMPAT-01, DOC-08): no lifecycle production changes expected — pin
  uninstall/update/autoupdate non-regression, assert no persistence/token/network
  expansion, and reconcile the output catalog, PRD, and design doc.

## Milestone Context

v1.18 starts from a derived-state design: after a marketplace manifest loads
successfully, an enabled plugin present only in `state.json` is still installed
and renders with the existing `{not in manifest}` reason. Records carrying
persisted unsupported kinds retain `(partially-installed)` and their existing
reason markers. `plugin info` reconstructs installed components from the
persisted resources plus materialized hooks config while compatibility metadata
preserves unsupported kinds. Disabled records, unknown non-installed names,
manifest-read failures, update/autoupdate behavior, and the installation-record-
driven uninstall path retain their existing semantics. No persisted orphan
marker, schema migration, status, or reason token is added.

The feature branch is `features/manifest-independent-plugin-info` in the managed
worktree `.worktrees/manifest-independent-plugin-info`. Baseline `npm run check`
is green when `PI_SUBAGENTS_ROOT` points at Pi's active managed `pi-subagents`
0.42.1. The unqualified local fallback finds stale global 0.24.3, below the
project's `>=0.35.0` optional-peer floor; CI has no global peer and skips those
two integration checks.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-v2z | amend v1.17 env-parity planning docs per validation findings | 2026-08-02 | 1ce8f203 | [260802-v2z-amend-v1-17-env-parity-planning-docs-per](./quick/260802-v2z-amend-v1-17-env-parity-planning-docs-per/) |
| 260804-gcs | Fix applyPathLedger non-owned PATH stripping | 2026-08-04 | aeef0882 | [260804-gcs-fix-applypathledger-non-owned-path-strip](./quick/260804-gcs-fix-applypathledger-non-owned-path-strip/) |
| 260807-q0v | amend v1.18 planning docs per two-review validation findings | 2026-08-07 | d76b4f6 | [260807-q0v-amend-v1-18-planning-docs-per-two-review](./quick/260807-q0v-amend-v1-18-planning-docs-per-two-review/) |

## Decisions

- Do not add `orphaned` or `orphaned-installed`: fully supported records keep
  `(installed)`, while records with persisted unsupported kinds retain the
  existing `(partially-installed)` status and reason markers.
- Reuse `{not in manifest}` and emit it only after a successful manifest load
  whose plugin lookup misses.
- Reconstruct installed components from existing resource fields and retain
  unsupported kinds from `compatibility.unsupported`; do not persist a manifest
  snapshot or orphan flag.
- Keep disabled, unknown-name, manifest-read, update/autoupdate, and uninstall
  semantics unchanged.
- The disabled-plus-partial classification defect is excluded from v1.18. INV-04
  covers the canonical disabled shape only; the defect is tracked separately.

### Open decisions (resolve before Phase 95 planning)

Recorded 2026-08-07 by quick task 260807-q0v after validating two independent
reviews against the codebase. Full statements in ROADMAP.md.

1. Whether installed inventory rows may carry reason braces at all — INV-01
   reverses a deliberate suppression in the list render map.
2. Whether the state-only info arm renders Pi-generated installed names or
   reverse-maps them to original source names.
3. Whether the LLM tool surface widens its reason projection to carry
   `{not in manifest}` on installed and partial rows, or accepts the asymmetry.

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
| debug | disabled-partial-record-unrecognized | diagnosed (real defect; fix scoped out of v1.18) |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Resolve the three open decisions above; they change what Phase 95 and Phase 96
  build.
- Discuss and plan Phase 95: manifest-independent installed inventory.
- Implement through TDD in the isolated feature worktree, writing the
  characterization tests before any production edit.
- Verify each phase against its mapped requirements before transition.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
