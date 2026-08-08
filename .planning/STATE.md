---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Manifest-Independent Installed Plugin Info
current_phase: 96
current_phase_name: Installation-record-backed plugin info
status: planning
stopped_at: Completed 95-02-PLAN.md
last_updated: "2026-08-08T21:07:13.054Z"
last_activity: 2026-08-08
last_activity_desc: Phase 95 plan 02 executed; both plans complete, phase ready for verification
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08 after Phase 95)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** v1.18 Manifest-Independent Installed Plugin Info. Make
list/info derive installed truth from the existing installation record when a
valid marketplace manifest no longer contains the plugin entry, without
persistence or update-semantics changes.

## Current Position

Phase: 96 — Installation-record-backed plugin info
Plan: Not started
Status: Ready to discuss (no CONTEXT.md yet; open decision D-95-11 — component
name fidelity on the state-only info arm — is gated to this discuss)
Last activity: 2026-08-08 — Phase 95 complete (verification passed 21/21 with
operator UAT sign-off; Nyquist-compliant; threats_open 0), transitioned to
Phase 96

## Roadmap Summary

- 4 sequential phases (95-98), continuing the global counter from Phase 94.
  All 21 v1 requirements map exactly once; no orphans.

- Eight requirements (INV-02/03/04, BOUND-01/02, LIFE-04/05/06) describe behavior
  the code already exhibits. They are carried as contracts the milestone must not
  break, and their deliverable is characterization and regression coverage. The
  net-new work is INV-01, BOUND-03, INFO-09..12, COMPAT-01, and DOC-08.

- **Phase 95 — Manifest-independent installed inventory** (INV-01..05, BOUND-03):
  COMPLETE 2026-08-08. Characterized the union behavior, opened the render-map
  seam (`{not in manifest}` on installed rows), threaded the manifest load error
  through the cross-scope fold, widened the LLM tool payload (INV-05), and — via
  the review fix loop — hardened absence into a `ManifestLookup` discriminated
  value judged against the record's own manifest, with both new row forms under
  the output-catalog byte gate.

- **Phase 96 — Installation-record-backed plugin info** (INFO-09..12,
  BOUND-01/02): the substantive phase. Reorder the valid-manifest miss path,
  reconstruct local component structure, preserve partial compatibility, add the
  explicit network guard the reorder requires, and lock read-failure versus
  unknown-name boundaries.

- **Phase 97 — Disabled-state classification repair** (ENBL-05..09): collapse the
  four copies of the disabled-state predicate into one keyed only on `enabled`,
  then restore list/info rendering, enable/disable idempotency, reconcile steady
  state, and the update short-circuit for disabled partially-installed records.
  Repairs ENBL-04 from v1.12. No state migration.

- **Phase 98 — Lifecycle regression and contract documentation** (LIFE-04..06,
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
| 260807-ur3 | bring disabled-partial classification repair into v1.18 scope | 2026-08-07 | d543f74 | [260807-ur3-bring-disabled-partial-classification-re](./quick/260807-ur3-bring-disabled-partial-classification-re/) |
| 260808-dhm | amend v1.18 requirements for LLM tool-surface reason widening | 2026-08-08 | 74df349 | [260808-dhm-amend-v1-18-requirements-for-llm-tool-su](./quick/260808-dhm-amend-v1-18-requirements-for-llm-tool-su/) |

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

- The disabled-plus-partial classification defect is IN scope for v1.18 as
  Phase 97 (operator decision 2026-08-07, reversing the same-day exclusion).
  It repairs ENBL-04, shipped in v1.12 and silently broken by partial installs.
  INV-04 still covers the canonical disabled shape only, because the partial
  shape is not recognized as disabled until Phase 97 lands; ENBL-06 widens it.

- [Phase 95]: Gate the {not in manifest} claim on a SUCCESSFUL manifest read (loadError === undefined) so no row states a fact about a manifest never parsed (BOUND-03 / D-95-05)
- [Phase 95]: Thread the whole ScopedManifest bundle into enumerateMarketplacePlugins rather than a parallel manifestLoaded boolean (D-95-04)
- [Phase 95]: INV-05: pluginReasons forwards reasons on both installed-family arms; the installed arm guards on undefined and empty so a clean row keeps no reasons key (D-95-06)
- [Phase 95]: projectRowStatus left byte-unchanged: the tool-payload widening adds information inside the installed bucket rather than re-partitioning it
- [Phase 95 fix loop]: Absence is judged against the manifest the record itself names — `ScopedManifest` is a discriminated union (`{ok,manifest}|{ok:false,loadError}`) and `ManifestLookup` (`declared`/`absent`/`unverified`) is the single value flowing into the row builder, making "entry present + absence claimed" unrepresentable (WR-05/06/07)
- [Phase 95 fix loop]: `pluginReasons` covers all four flattened installed-family arms incl. `partially-upgradable` (CR-01); the two new manifest-absent row forms are catalog states under the byte-equality gate (WR-03)

### Open decisions

Recorded 2026-08-07 by quick task 260807-q0v after validating two independent
reviews against the codebase. Full statements in ROADMAP.md. Resolved at the
Phase 95 discuss session on 2026-08-08 unless noted.

1. **RESOLVED (D-95-01/02/03)** — Installed inventory rows may carry reason
   braces, under a general rule: the orchestrator stamps reasons and
   `notify.ts` renders them, with no allowlist in the render path. Recorded
   guidance is durable-vs-transient. Note the premise was imprecise: there is
   no render-map suppression to reverse. `notify.ts:2180-2193` already composes
   reasons on the `installed` arm and `PluginInstalledMessage.reasons?` already
   exists; the omission is one orchestrator field at `list.ts:485-499`.

2. **DEFERRED to Phase 96 discuss (D-95-11)** — Whether the state-only info arm
   renders Pi-generated installed names or reverse-maps them to original source
   names. Re-gated: it governs no Phase 95 code, and Phase 96 discuss will have
   the `info.ts` reconstruction in front of it.

3. **RESOLVED (D-95-06/07)** — The LLM tool surface widens: `pluginReasons`
   forwards reasons for both `installed` and `partially-installed`, landing in
   Phase 95 beside INV-01. This reverses a REQUIREMENTS.md § Out of Scope row.
   Driven by two findings — `projectRowStatus` already flattens four statuses
   into `"installed"`, so a degraded install is today indistinguishable from a
   clean one in the tool payload; and `upgradable` already forwards reasons
   while also projecting to `"installed"`.

### Blockers

None. The D-95-10 requirement amendment landed as quick task 260808-dhm on
2026-08-08: INV-05 covers the LLM tool-surface reason widening, is mapped to
Phase 95 in the traceability table, appears in Phase 95's requirement list and
success criteria, and the superseded Out of Scope row is retired. Phase 95
planning is unblocked.

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

- Discuss Phase 96 (installation-record-backed plugin info). Bring into the
  discuss: deferred decision D-95-11 (component name fidelity on the state-only
  info arm) and the pending todo on folded-row manifest choice
  (`.planning/todos/pending/2026-08-08-folded-row-manifest-choice-*`).

- Then plan and execute Phases 96-98 in order; Phase 98 additionally carries
  the notify.ts/tools.ts stale-comment reconciliation todo (DOC-08).

- Verify each phase against its mapped requirements before transition.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 95 P01 | 30min | 3 tasks | 3 files |
| Phase 95 P02 | 25min | 2 tasks | 2 files |

## Session

**Last session:** 2026-08-08T21:15:00Z
**Stopped at:** Phase 95 complete, ready to discuss Phase 96
**Resume file:** None
