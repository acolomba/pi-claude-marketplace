---
phase: 69-force-path-severity
plan: 04
subsystem: api
tags: [notify, severity, reconcile, backfill, force-installed, reasons-brace, output-catalog]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: the installable/unsupported/unavailable three-way discriminant whose unsupported arm carries the dropped-component kinds the backfill re-resolve reads
  - phase: 68-load-time-backfill
    provides: the maybeBackfillPlugin re-resolve + PluginBackfilledOutcome the brace threads onto
  - phase: 69-force-path-severity (plan 03)
    provides: the SEV-03 autoupdate force-installed severity disposition this plan confirms the backfill counterpart of (benign promotion stays info)
provides:
  - PluginBackfilledOutcome carries the re-resolved unsupported component kinds
  - the load-time backfill (force-installed) reconcile row composes a factual {reasons} brace via the shared narrowUnsupportedKinds seam (SEV-05)
  - confirmation that installed / force-installed / force-upgradable rows all route reasons through composeReasons + narrowUnsupportedKinds (no per-state mechanism, D-69-04)
affects: [70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-side reasons threading: the re-resolved unsupported[] rides PluginBackfilledOutcome; the reconcile projection populates the row reasons via the shared narrowUnsupportedKinds helper (mirrors install.ts:1432), so the brace is composed once and stays cross-surface byte-identical"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "Reused the shared narrowUnsupportedKinds seam (D-69-04) rather than a per-state kind->reason map: the backfill force-installed arm calls the SAME helper install/list/info use, so the dropped-kind tokens (lsp / unsupported source) are byte-identical across every surface by construction"
  - "Kept the backfill row at info (SEV-03 / A3 / D-68-04): a load-time backfill is a benign promotion of now-supported components, not a new degradation, so the newly-degrades warning stays scoped to the autoupdate cascade (landed in 69-03)"
  - "Made the new unsupported field REQUIRED (readonly unsupported: readonly string[]) on PluginBackfilledOutcome, not optional: every producer of the outcome (the single maybeBackfillPlugin site) sets it, and a required field forces the value to be threaded rather than silently defaulting to []"

patterns-established:
  - "Backfill force-installed reasons: reasons: narrowUnsupportedKinds(outcome.unsupported) -- an empty set renders brace-less (byte-identical), a non-empty set composes the {dropped kinds} brace"

requirements-completed: [SEV-05, SEV-03]

# Metrics
duration: ~35min
completed: 2026-06-28
---

# Phase 69 Plan 04: Force-Path Severity (SEV-05) Summary

**The load-time backfill `(force-installed)` reconcile row now carries a factual `{reasons}` brace -- the re-resolved dropped-component kinds threaded onto `PluginBackfilledOutcome` and composed through the SAME shared `narrowUnsupportedKinds` seam install/list/info use -- so a re-materialized-but-still-degraded plugin renders `(force-installed) {lsp}` instead of a bare `(force-installed)`; a backfill with no dropped kinds stays brace-less (byte-identical to today), and the benign promotion stays info.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-28
- **Tasks:** 1
- **Files modified:** 6 (3 source, 1 doc, 2 test)

## Accomplishments

- SEV-05 / D-69-04: closed the one remaining producer gap. The Phase 68 backfill `force-installed` row previously passed `reasons: []`, so a re-materialized-but-still-degraded plugin rendered a bare `(force-installed)` with NO factual `{reasons}` brace. The render seam (`composeReasons` via the force-installed arm) already composed the brace -- the gap was purely producer-side.
- Added a REQUIRED `readonly unsupported: readonly string[]` field to `PluginBackfilledOutcome` carrying the re-resolved dropped-component kinds.
- In `maybeBackfillPlugin` set the field from the re-resolved state -- `resolved.state === "unsupported" ? resolved.unsupported : []` (the `installable` arm projects to the brace-less `(installed)` row, so its unsupported set is empty).
- In `reconcile/notify.ts` replaced `reasons: []` with `reasons: narrowUnsupportedKinds(outcome.unsupported)` on the `force-installed` branch of the `plugin-backfilled` case -- mirroring `install.ts:1432`, importing the shared helper from `shared/probe-classifiers.ts`. No hand-rolled kind->reason map, no new per-state reasons mechanism (D-69-04 -- reuse the shared seam).
- SEV-03 disposition confirmed (A3 / D-68-04): kept `severity: "info"` on the backfill row with an anchored rationale comment -- a benign promotion is not a new degradation; the SEV-03 newly-degrades warning fires only on the autoupdate cascade (handled in 69-03).
- Landed the byte-visible change in lockstep (no RED window on the byte-equality gate): two new `docs/output-catalog.md` reconcile states (`backfill-force-installed` with the `{lsp}` brace, `backfill-force-installed-no-reasons` brace-less) + matching `catalog-uat` fixtures (info severity -> no `expectedSeverity`), in the SAME commit as the producer change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Carry re-resolved unsupported kinds on PluginBackfilledOutcome and populate the brace** - `6d3f4da0` (feat)

_The task is `tdd="true"`; the byte-equality lockstep constraint (no RED window on the catalog-uat gate) requires producer + catalog + fixture in a single commit, so RED/GREEN collapsed into one GREEN commit (the prior waves' documented pattern). The producer-level `notify.test.ts` projection tests (brace present, brace-less, RECON-04 fold) were updated in the same commit._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` - added `readonly unsupported: readonly string[]` to `PluginBackfilledOutcome` with an SEV-05 / D-69-04 doc comment
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - `maybeBackfillPlugin` sets `unsupported` from the re-resolved `unsupported` arm (empty when promoted to `installable`)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - imported `narrowUnsupportedKinds`; the `plugin-backfilled` force-installed branch populates `reasons: narrowUnsupportedKinds(outcome.unsupported)`; anchored SEV-05 / D-69-04 + SEV-03 / A3 rationale comments; kept `severity: "info"`
- `docs/output-catalog.md` - two new reconcile-applied-cascade states (`backfill-force-installed` brace, `backfill-force-installed-no-reasons` brace-less)
- `tests/architecture/catalog-uat.test.ts` - two new fixtures (both info, no `expectedSeverity`) under `reconcile-applied-cascade`
- `tests/orchestrators/reconcile/notify.test.ts` - threaded the required `unsupported` field onto the three existing backfill fixtures; renamed/strengthened the partial-backfill test to assert the `{lsp}` brace; added a no-dropped-kinds brace-less test

## Decisions Made

- **Shared seam, not a per-state map (D-69-04).** The backfill force-installed arm calls the SAME `narrowUnsupportedKinds` helper install/list/info use (`lspServers` -> `lsp`, else `unsupported source`, first-wins dedup), so the dropped-kind tokens are byte-identical across every surface by construction -- no drift-prone copies, no new mechanism. `installed` / `force-installed` / `force-upgradable` rows all route reasons through `composeReasons` + `narrowUnsupportedKinds`.
- **Benign promotion stays info (SEV-03 / A3 / D-68-04).** A load-time backfill re-materializes now-supported components -- it is not a new degradation the user did not opt into. The only byte change on the row is the new brace; the severity is unchanged. The SEV-03 newly-degrades warning is scoped to the autoupdate cascade (69-03), where an automatic upgrade can silently drop components.
- **Required field, not optional.** `unsupported` is a required `readonly string[]` on the outcome: the single producer (`maybeBackfillPlugin`) always sets it, and requiring the field forces the re-resolved kinds to be threaded rather than silently defaulting to `[]` (which would re-introduce the bare-`(force-installed)` bug).

## Deviations from Plan

None - plan executed exactly as written.

The plan's `files_modified` listed five files; the implementation touched the same five plus `tests/orchestrators/reconcile/notify.test.ts` (the plan's `<verify>` block already named `notify.test.ts` as an automated gate, and the new required field forced the three existing backfill fixtures in that file to thread `unsupported`). This is the plan's own named verification surface, not a scope expansion.

The catalog change is realized as NEW reconcile-applied-cascade states rather than an edit to an existing backfill state: the `reconcile-applied-cascade` H2 had no pre-existing backfill `(force-installed)` catalog state (the backfill rows were exercised only by the integration suite). The two new states encode the brace / brace-less forms the SEV-05 change introduces.

## Closed-set token counts

Unchanged at **22 / 17 / 7** (STATUS_TOKENS / PLUGIN_STATUSES / MARKETPLACE_STATUSES). `force-installed` already existed in the closed sets (Phase 66); SEV-05 reuses it and only adds a reasons brace composed from existing closed-set reason tokens (`lsp` / `unsupported source`) -- no new token, no tripwire bump (`notify-closed-set-locks.test.ts` green untouched).

## Issues Encountered

- **gitlint title length.** The first commit title was 73 chars (max 72); shortened by dropping `reasons` from the title. No code change.
- **Known parallel flake (NOT a regression):** the tmpdir `ENOTEMPTY` flake documented in 69-RESEARCH affects reconcile/autoupdate/update tests under parallel runs. It did NOT surface this run -- `npm run check` passed fully GREEN (2470 unit pass / 2 skipped / 0 fail, 16 integration pass, exit 0) on the parallel default; the focused suites (`notify.test.ts`, `catalog-uat.test.ts`, `backfill.test.ts`) all pass.

## Next Phase Readiness

- SEV-01..05 are complete (plans 01-04). All five force-path severities are wired onto the caller-stamped desired-state notification model, including the backfill reasons brace. Phase 70 (Spec & Documentation Reconcile) owns the byte-exact wording / final PRD §11 reconcile of all severity-affected rows, including the backfill force-installed forms landed here.

## Self-Check: PASSED

All modified source/doc/test files exist; the task commit (`6d3f4da0`) is present in git history.

---
*Phase: 69-force-path-severity*
*Completed: 2026-06-28*
