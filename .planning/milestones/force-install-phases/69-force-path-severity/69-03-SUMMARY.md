---
phase: 69-force-path-severity
plan: 03
subsystem: api
tags: [notify, severity, autoupdate, force-installed, update, cascade, output-catalog]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: the installable/unsupported/unavailable three-way discriminant + requireForceInstallable gate the autoupdate cascade now drives
  - phase: 66-derived-force-state-glyphs
    provides: the force-installed row + forceInstalledRow composition site the autoupdate cascade reuses
  - phase: 69-force-path-severity (plan 02)
    provides: the cardinality/cascade severity-threading patterns and the SEV-04 decline row this plan builds beside
provides:
  - autoupdate cascade TAKES the force path -- a force-upgradable plugin degrades in place and renders (force-installed) {dropped kinds} instead of (skipped) {no longer installable}
  - UPDATE_CONTEXT force-installed render arm (reuses forceInstalledRow, byte-identical across surfaces)
  - newlyDegraded signal on PluginUpdateUpdatedOutcome (read from the prior persisted compatibility.unsupported; no schema change)
  - prior-state autoupdate severity -- warning when newly degrading a clean plugin, info when re-degrading an already force-installed one
affects: [70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cascade-entrypoint force opt-in: the autoupdate cascade (updateSinglePlugin) sets force: true so the per-plugin update resolves via requireForceInstallable, while the manual update path stays user-flag-gated"
    - "Prior-state severity conditioning: read the persisted compatibility.unsupported in preflight, carry a newlyDegraded fact on the outcome, and let ONLY the autoupdate renderer raise severity (manual force renderer ignores it)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "Chose the minimal force seam (Option B): updateSinglePlugin sets force: true rather than widening PluginUpdateFn -- the cascade entrypoint is force-only by construction, the manual updatePlugins path keeps its own --force gate"
  - "The marketplace `marketplace update` command context (UPDATE_CONTEXT) is a SEPARATE render pipeline from the central renderPluginRow and had no force-installed arm -- added one reusing forceInstalledRow (the SOLE composition site, D-11) so cascade bytes stay identical to the install/update success surfaces"
  - "newlyDegraded rides PluginUpdateUpdatedOutcome (computed once in preflight from the prior record) but is consumed for severity ONLY by the autoupdate cascade renderer; the manual update --force renderer ignores it, so the warning fires solely on the autoupdate surface (RESEARCH A4)"

patterns-established:
  - "UPDATE_CONTEXT force-installed arm: forceInstalledRow(p, mpScope, probe) -- the autoupdate cascade's degraded success row"
  - "newlyDegraded = prior persisted compatibility.unsupported empty -> the autoupdate force-installed row stamps warning; non-empty -> info"

requirements-completed: [SEV-03]

# Metrics
duration: ~70min
completed: 2026-06-28
---

# Phase 69 Plan 03: Force-Path Severity (SEV-03) Summary

**The marketplace autoupdate cascade now TAKES the force path automatically -- a force-upgradable plugin degrades in place and renders `(force-installed) {dropped kinds}` instead of a misleading `(skipped) {no longer installable}` -- and the row severity follows the persisted prior state: warning when it newly degrades a clean plugin, info when re-degrading an already force-installed one.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 8 (4 source, 1 doc, 3 test)

## Accomplishments
- SEV-03 Task 1: made the autoupdate cascade entrypoint (`updateSinglePlugin`) set `force: true`, so a candidate that re-resolves `unsupported` degrades through `requireForceInstallable` (supported components materialize, unsupported kinds skip) and surfaces as an `updated` outcome carrying `unsupportedKinds` instead of throwing `no-longer-installable`.
- Added a `force-installed` render arm to the `marketplace update` command context (`UPDATE_CONTEXT`) -- which is a separate render pipeline from the central `renderPluginRow` and previously had only `updated`/`skipped`/`failed` arms -- reusing `forceInstalledRow` so the bytes match the install/update success surfaces (`◉ <name> v<version> (force-installed) {dropped kinds}`).
- Wired the marketplace-side `outcomeToCascadePluginMessage` `updated` arm to render `(force-installed)` when `unsupportedKinds` is present; an `unavailable`/structural candidate still skips (`requireForceInstallable` blocks it -> FORCE-05 preserved).
- SEV-03 Task 2: added `newlyDegraded` to `PluginUpdateUpdatedOutcome`, computed in `preflightUpdate`/`runThreePhaseUpdate` from the PRIOR persisted `compatibility.unsupported` (empty -> newly degraded), with no schema change and no new tracking.
- The autoupdate cascade renderer stamps `severity: warning` on the force-installed row iff `newlyDegraded === true` (prepending the `A plugin operation needs attention.` summary line), else `info`; the manual `update --force` degrade renderer ignores `newlyDegraded` and keeps its unconditional `info` stamp, so the warning fires only on the autoupdate surface.
- Landed both byte-visible states (`autoupdate-force-installed-already-degraded` at info, `autoupdate-force-installed-newly-degraded` at warning) in `docs/output-catalog.md` + matching `catalog-uat` fixtures in lockstep with the producer changes (no RED window on the byte-equality gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: Autoupdate cascade TAKES the force path; land the skipped->force-installed flip in lockstep** - `fbec8f16` (feat)
2. **Task 2: Prior-state severity -- warning on newly-degraded autoupdate, info on already-degraded** - `dbfe7301` (feat)

_Both tasks are `tdd="true"`; the byte-equality lockstep constraint (no RED window on the catalog-uat gate) required producer + catalog + fixture in a single commit per task, so RED/GREEN collapsed into one GREEN commit each (the prior waves' documented pattern). Producer-level conditioning tests (marketplace/update.test.ts, plugin/update.test.ts) were updated in the same commits._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - `updateSinglePlugin` sets `force: true` (cascade-only); `runThreePhaseUpdate` sets `newlyDegraded` from the prior persisted `compatibility.unsupported`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - the autoupdate cascade `outcomeToCascadePluginMessage` `updated` arm renders `(force-installed)` (info, then warning on `newlyDegraded`); `narrowUnsupportedKinds` import
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` - `force-installed` joins `UpdateRowStatus`/`UpdateRowMsg`; new `force-installed` render arm calls `forceInstalledRow`
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - `newlyDegraded?: boolean` on `PluginUpdateUpdatedOutcome`
- `docs/output-catalog.md` - two new autoupdate cascade states (already-degraded info, newly-degraded warning)
- `tests/architecture/catalog-uat.test.ts` - two new fixtures (info / warning) under `marketplace update <name>`
- `tests/orchestrators/marketplace/update.test.ts` - mapper unit tests: force-installed render, warning-on-newlyDegraded, info-on-already-degraded, clean-still-updated
- `tests/orchestrators/plugin/update.test.ts` - e2e: cascade takes force (lspServers degrade), FORCE-05 unavailable still skips, manual no-force still skips, newlyDegraded true (prior clean) / false (prior degraded)

## Decisions Made
- **Minimal force seam (Option B).** `updateSinglePlugin` sets `force: true` directly rather than widening the `PluginUpdateFn` signature. The cascade entrypoint is the only force-only caller; the manual `updatePlugins` path drives `runThreePhaseUpdate` directly with its own `--force` gate, so it is untouched.
- **Two render pipelines, two force-installed arms.** The `marketplace update` autoupdate cascade renders through the command-local `UPDATE_CONTEXT`, NOT the central `renderPluginRow`. Both now have a force-installed arm calling the SOLE `forceInstalledRow` composition site (D-11 "call, never duplicate"), so the degraded autoupdate row is byte-identical to the install/update success rows.
- **newlyDegraded is a fact on the outcome, severity is a per-renderer choice.** The prior-state read happens once in `preflight` (where the persisted record is already loaded). The field rides the outcome, but only the autoupdate renderer consumes it for severity; the manual force renderer ignores it. This satisfies D-69-01 / RESEARCH A4 (the warning fires solely on the autoupdate surface) without a second state load.

## Deviations from Plan

### Documented lockstep / scope clarifications (gate-verified)

**1. Added a force-installed arm to `update.messaging.ts` (UPDATE_CONTEXT) -- a file not in the plan's `files_modified` list**
- **Found during:** Task 1.
- **Reason:** The plan assumed the degrading candidate would flow through "the EXISTING `force-installed` success arm of `outcomeToCascadePluginMessage`." That is true for the MANUAL `update` path (plugin/update.ts), but the AUTOUPDATE cascade renders through a SEPARATE command-local pipeline (`marketplace/update.ts` `outcomeToCascadePluginMessage` -> `UPDATE_CONTEXT`), which had no force-installed arm and would not compile/render the new row. Adding the arm (reusing `forceInstalledRow`) is the necessary, byte-faithful way to surface the force path on the autoupdate surface. No new model, no duplicated bytes.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
- **Committed in:** `fbec8f16` (Task 1).

**2. Catalog state framing: the plan describes a "(skipped) -> (force-installed) flip" but no pre-existing autoupdate `(skipped) {no longer installable}` catalog state existed**
- **Found during:** Task 1.
- **Reason:** The autoupdate cascade had no catalog state demonstrating a degrading candidate (the existing `mixed-outcomes` state shows updated/skipped-up-to-date/failed). The "flip" is therefore realized as NEW catalog states (`autoupdate-force-installed-already-degraded`, then `autoupdate-force-installed-newly-degraded`) plus the orchestrator-level behavior change (the producer now emits force-installed where it previously emitted a skip). The per-plugin byte flip and bulk tally shift are proven by the producer/e2e tests; the catalog encodes the new force-installed forms.
- **Files modified:** docs/output-catalog.md, tests/architecture/catalog-uat.test.ts.

---

**Total deviations:** 0 auto-fixed bugs + 2 documented lockstep/scope clarifications.
**Impact on plan:** No functional scope creep. The out-of-`files_modified` edit (`update.messaging.ts`) is required for the autoupdate render pipeline; the catalog framing resolves the plan's "flip" narrative against the actual absence of a prior autoupdate-skip state. Behavior matches D-69-01 exactly.

## Issues Encountered
- **Markdown prettier is NOT a project gate.** A reflex `prettier --write docs/output-catalog.md` mass-rewrote every `______` horizontal rule to `---` across the whole catalog (unrelated churn). The pre-commit prettier hook and `npm run format:check` both scope to `**/*.{js,json,ts}` only -- markdown is governed by `mdformat`/`markdownlint`, which keep the `______` style. Reverted the mass reformat and re-applied only the new catalog blocks in the existing style; pre-commit `mdformat` + `markdownlint` pass clean.
- **Known parallel flake (NOT a regression):** the tmpdir `ENOTEMPTY` flake documented in 69-RESEARCH affects autoupdate/update tests under parallel runs. It did NOT surface this run -- `npm run check` passed fully GREEN (2469 unit pass / 2 skipped / 0 fail, 16 integration pass, exit 0) on the parallel default, and the focused suites pass under `TEST_CONCURRENCY=1`.

## Closed-set token counts
Unchanged at **22 / 17 / 7** (STATUS_TOKENS / PLUGIN_STATUSES / MARKETPLACE_STATUSES). `force-installed` already existed in the closed sets (Phase 66); SEV-03 reuses it on a new surface and stamps severity -- no new token, no tripwire bump (`notify-closed-set-locks.test.ts` green untouched).

## Next Phase Readiness
- SEV-03 conditioning + the autoupdate force-take behavior are in place. With SEV-01/02/04 (plans 01-02) and SEV-03 (this plan) done, only SEV-05 (backfill reasons brace) remains for the final Phase 69 plan. Phase 70 owns the byte-exact wording / final PRD reconcile of all severity-affected rows (including the autoupdate force-installed forms landed here).

## Self-Check: PASSED

All modified source/doc/test files exist; both task commits (`fbec8f16`, `dbfe7301`) are present in git history.

---
*Phase: 69-force-path-severity*
*Completed: 2026-06-28*
