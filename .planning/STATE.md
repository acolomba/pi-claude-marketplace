---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Manifest-Independent Installed Plugin Info
current_phase: 97
current_phase_name: disabled-state-classification-repair
status: executing
stopped_at: Completed 97-05-PLAN.md — all 5 plans complete, phase at gates
last_updated: "2026-08-09T20:12:00.000Z"
last_activity: 2026-08-09
last_activity_desc: Phase 97 plan 05 closed out; ENBL-09 verified post-hoc against concurrently-landed commits — the disabled-record refresh derives its availability discriminant, the update --partial short-circuit stages nothing on disk, and two identical calls are a fixed point; one guard-tripping comment fixed and the full suite green
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-09 after Phase 96)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** Phase 97 — disabled-state-classification-repair
A disabled partially-installed plugin is recognized as disabled by every
surface, restoring the orthogonality of declared, enabled and available.
No state migration and no schema-version change.

## Current Position

Phase: 97 (disabled-state-classification-repair) — EXECUTED, AT GATES
Plan: 5 of 5
Status: Plans 01-05 complete. The ENBL-05 root repair landed first: one
disabled-state predicate in `persistence/state-io.ts` keyed only on
`enabled`, six modules on it, and the CR-01 repro (a manifest-absent
disabled partial reaching the state-only info arm) green. Plan 02 then
froze the rendering that repair exposed — ENBL-06 is closed on both
surfaces, with a byte-exact `list` contrast row and an `info --fetch`
cause pin, and the stale two-axis-marker prose swept from the render
surfaces and the output catalog. Plan 03 closed ENBL-07: `runEnableBranch`
derives the install ledger's admission gate from the record's own
availability discriminant, so a disabled partial re-materializes through
the partially-available arm instead of dying on `requireInstallable`, with
the manifest-absent enable and the repeat disable pinned byte-exactly.
Plan 04 closed ENBL-08 by making load-time reconcile a fixed point for a
disabled partial: the BFILL-01 backfill scan now filters on `enabled` as
well as availability, so no unattended pass re-materializes — and through
reinstall's record write re-enables — a plugin the user disabled, and two
identical planner passes are pinned to the empty plan with a
declared-enabled counter-case. Plan 05 closed ENBL-09, the second-order
edit the collapse exposed: `refreshDisabledRecord` now derives the
persisted availability discriminant from the resolution instead of
hard-coding `installable: true`, so the short-circuit a disabled partial
reaches can no longer write full availability beside a non-empty
unsupported array — proven by a degraded/promotion counter-case pair and
by mutation. The short-circuit itself is pinned by an on-disk no-stage
assertion, and two identical `update --partial` calls are a fixed point.
Its production work landed as concurrent commits outside the paused
session's dispatch and was verified criterion-by-criterion at close-out,
which caught one comment tripping the D-75-01 vocabulary guard (fixed in
`be4da56d`).
Last activity: 2026-08-09 — Phase 97 plan 05 closed out (full suite green,
exit 0); phase awaits its verification gates

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
  BOUND-01/02): COMPLETE 2026-08-09. The buildBlock arm split renders
  manifest-absent installations from the record; containment-guarded hooks
  reconstruction with truthful-split degradation; INFO-12 zero-call network
  guard; visible fetch-skip note (broadened to disabled scopes in review);
  own-manifest authority pinned and the catalog's open note closed. CR-01
  (disabled-partial predicate) carried to Phase 97.

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
- [Phase 96]: INFO-09/10: a manifest-absent installation record is described from the record (installed/partially-installed with 'not in manifest' as a reason), not reported as a failure; severity for that input moves error -> info
- [Phase 96]: The state-only row builders are synchronous and take no locations: require-await (strictTypeChecked) and noUnusedParameters reject the planned async + threaded-unused-param shape; the hooks read converts both in one edit
- [Phase 96]: derivePersistedInstalledStatus extracted so the persisted installed/partially-installed derivation has one copy shared by the non-path and state-only info rows
- [Phase 96]: State-only hooks degradation reuses the existing narrowProbeError reason ladder at row level; no new closed-set token
- [Phase 96]: info's cascade render map widens to skipped so a --fetch the state-only arm cannot carry out is reported as its own warning note (D-96-04)
- [Phase 96]: INFO-12 is asserted as zero call counts on injected clone and credential seams, not read off the control flow
- [Phase 96]: D-96-02 ratified — a folded row reads its OWN record's manifest for absence, upgradable and description alike, all three from one ManifestLookup value
- [Phase 96]: BOUND-01's wholesale non-render under a failed owning manifest is contract, not a defect: the bare (failed) header suppresses folded rows the fold already computed
- [Phase 97]: ENBL-05: the sole disabled-state predicate lives in persistence/state-io.ts beside toDisabledRecord, keyed only on `enabled`; reconcile/plan.ts deliberately does NOT re-export it
- [Phase 97]: The disabled-state drift gate asserts an absence (no conjunctive twin in any former definition site) plus a presence (each imports the one predicate), replacing the name-keyed body-shape pin
- [Phase 97]: D-97-01 anchor 1 resolved toward parity: a disabled PARTIAL row renders bare, byte-identical to the canonical (disabled) row -- no catalog amendment
- [Phase 97]: ENBL-06 is pinned as a contrast pair in one rendered block (disabled partial vs enabled partial), asserted as a single byte-exact join so the status tokens, the brace asymmetry, and the row order are all frozen together
- [Phase 97]: The enable branch's ledger gate is derived from the record's availability discriminant, not hard-coded, so a fully-installable record keeps the strict gate
- [Phase 97]: ENBL-08 backfill guard reads record.enabled directly rather than isRecordedButDisabled: apply.ts is not a drift-gate site and the guard is a scan filter symmetric with the availability filter above it
- [Phase 97]: ENBL-09: the derive landed in refreshDisabledRecord, not runThreePhaseUpdate, so the edit adds no pressure to an already complexity-suppressed function; suppression count in update.ts unchanged at 6
- [Phase 97]: A persisted discriminant is proven derived only by a counter-case pair — the degraded assertion alone is satisfied by hard-coding the opposite constant; the promotion case on the same fixture excludes both
- [Phase 97]: The update short-circuit's no-stage claim is asserted on disk (the generated skill absent from the skills target dir), not by the record's empty resource arrays, because re-staging is the defect and unrecorded files would still satisfy a state-only check

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

- Run Phase 97's verification gates. All five plans are executed and the full
  suite is green; ENBL-05..09 are each closed and summarized. The CR-01 carrier
  todo (`.planning/todos/pending/2026-08-09-disabled-partial-reaches-state-only-info-arm.md`)
  was absorbed by ENBL-05's single-predicate collapse and ENBL-06's widened
  guard test — close it out as part of the phase verification.

- Then plan and execute Phase 98, which carries the notify.ts/tools.ts
  stale-comment reconciliation todo (DOC-08) plus the D-96-01 divergence
  documentation.

- Verify each phase against its mapped requirements before transition.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 95 P01 | 30min | 3 tasks | 3 files |
| Phase 95 P02 | 25min | 2 tasks | 2 files |
| Phase 96 P01 | 25min | 3 tasks | 5 files |
| Phase 96 P02 | 31min | 3 tasks | 4 files |
| Phase 96 P03 | 40min | 3 tasks | 5 files |
| Phase 96 P04 | 25min | 2 tasks | 3 files |
| Phase 97 P01 | 22min | 2 tasks | 11 files |
| Phase 97 P02 | 35min | 3 tasks | 6 files |
| Phase 97 P03 | 25min | 2 tasks | 2 files |
| Phase 97 P04 | 30min | 2 tasks | 3 files |
| Phase 97 P05 | 25min | 2 tasks | 2 files |

## Session

**Last session:** 2026-08-09T20:12:00.000Z
**Stopped at:** Completed 97-05-PLAN.md — Phase 97 fully executed (5/5), awaiting verification gates
**Resume file:** None
