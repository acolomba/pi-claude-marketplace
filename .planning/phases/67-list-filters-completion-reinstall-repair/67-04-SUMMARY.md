---
phase: 67-list-filters-completion-reinstall-repair
plan: 04
subsystem: api
tags: [completion, force, install, update, candidate-sets, edge, list-filters]

# Dependency graph
requires:
  - phase: 67-list-filters-completion-reinstall-repair
    plan: 03
    provides: "the finer 7-status plugin-index cache (schema v2) + shared classifier the force-gated candidate sets read"
  - phase: 65-force-install-update
    provides: "the install/update --force flag whose presence now also gates completion candidate sets"
provides:
  - "edge/completions/provider.ts: --force flag completion under install/update; --force registered as a boolean flag for install/update positional extraction (fixes install --force <TAB> -> null); force boolean threaded through PluginRefBranchConfig"
  - "edge/completions/data.ts: per-(mode, force) candidate-set narrowing over the finer PluginIndexRow statuses (install force = available + unsupported; update force = upgradable + force-upgradable; unavailable excluded everywhere)"
affects: [force-install-candidate-sets, prd-section-11-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boolean-flag-aware positional extraction: the head is recovered via a flag-free first pass (the subcommand token is never a flag), then the head-specific boolean-flag allow-list (--force for install/update) re-runs extractPositionals so a leading --force does not get mis-parsed as the plugin positional"
    - "Candidate-set selection by ReadonlySet membership keyed on (mode, force): no per-status if-ladder; the force discriminator swaps the allowed-status Set, keeping no-force output byte-identical and the force narrowing a one-line set swap"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/edge/completions/provider.test.ts

key-decisions:
  - "force is an OPTION on the existing install/update PluginRefModes, not a new mode (D-67-02): a `force?: boolean` on PluginRefBranchConfig / PluginMapOptions threads through the existing dispatch; no PluginRefMode was added."
  - "No provider-local classification: data.ts filters purely on the cache `row.status` derived by the shared classifier (67-03), enforced green by tests/architecture/import-boundaries.test.ts (T-67-10)."

patterns-established:
  - "Pattern: gate a completion candidate set on a leading boolean flag by recovering the head with a flag-free extractPositionals pass first, then re-extracting with the head-specific boolean-flag allow-list"

requirements-completed: [LIST-02]

# Metrics
duration: 12min
completed: 2026-06-27
---

# Phase 67 Plan 04: Force-Gated Install/Update Completion Candidate Sets Summary

**With `--force` preceding the plugin positional, install completion now offers the force-installable candidates (`available` + `unsupported`) and update completion offers the force-upgrade candidates (`upgradable` + `force-upgradable`) -- `unavailable` excluded in both -- sourced from the finer 67-03 cache statuses via the shared classifier (no provider-local reclassification); without `--force` the candidate sets are byte-identical to today; `--force` is also a flag completion for install/update (not reinstall) and is registered as a boolean flag for positional extraction, fixing the `install --force <TAB>` -> null bug.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (Task 1 via TDD RED/GREEN; Task 3 gate-only)
- **Files created:** 0; **modified:** 3

## Accomplishments

- **Task 1 (TDD RED):** Added six `LIST-02 / D-67-02` provider cases: `install --force` = available + unsupported (excludes unavailable); `update --force` = upgradable + force-upgradable (excludes installed/force-installed/unavailable); no-force install = available-only and no-force update = all-installed-family byte-identical regressions; `--force` flag present for install/update and absent for reinstall; `install --force <TAB>` non-null. Four failed RED (the two no-force regressions already passed -- 67-03 kept that output byte-identical).
- **Task 2 (GREEN):** provider.ts -- added a `--force` entry to `flagCompletions` under the install/update head; recover the head via a flag-free `extractPositionals` pass, then re-extract with `["--force"]` as a boolean flag for install/update so a leading `--force` no longer mis-parses as the plugin positional (the null-bug fix); compute a `force: boolean` and thread it through `PluginRefBranchConfig` for the install/update arms. data.ts -- added `INSTALL_STATUSES` (available-only), `FORCE_INSTALL_STATUSES` (available + unsupported), and `FORCE_UPDATE_STATUSES` (upgradable + force-upgradable) sets; `getInstallPluginToMarketplacesMap` and `getInstalledPluginToMarketplacesMap` take a `force` arg and swap the allowed-status Set accordingly; `getMarketplaceOnlyCompletions` inherits the update force-narrowing through the shared `getPluginToMarketplacesMap("update", ...)` path. Updated the mode->status doc comment to the per-(mode, force) table.
- **Task 3 (gate):** `npm run check` fully green; edge import-boundary, no-orchestrator-network, catalog-UAT, and the closed-set tripwire all satisfied. No source changes required.

## Task Commits

1. **Task 1 RED:** add failing --force-gated completion candidate tests - `8c207a51` (test)
2. **Task 2 GREEN:** force-gate install/update completion candidate sets - `e5ca6683` (feat)
3. **Task 3:** gate-only (`npm run check`); no files changed -> no commit.

**Plan metadata:** committed separately with this SUMMARY.

## Files Modified

- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - `--force` flag completion under install/update; `--force` boolean-flag-aware positional extraction (head recovered flag-free first, then re-extracted); `force` boolean threaded through `PluginRefBranchConfig` and `pluginRefBranchConfig(positionalHead, explicitScope, force)`.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` - `INSTALL_STATUSES` / `FORCE_INSTALL_STATUSES` / `FORCE_UPDATE_STATUSES` sets; `force` arg on the install + installed map builders and `PluginMapOptions` / `getPluginRefCompletions` options; per-(mode, force) status narrowing; updated mode->status doc comment.
- `tests/edge/completions/provider.test.ts` - six new `LIST-02 / D-67-02` cases; updated the pre-existing `PRL-16 / RINST-01` flag-exclusion loop to drop install/update (which now correctly carry `--force`), keeping uninstall/list/ls/marketplace in the exclusion set.

## Decisions Made

- **`force` is an option, not a `PluginRefMode`.** A `force?: boolean` on `PluginRefBranchConfig` (provider) and `PluginMapOptions` (data) threads the discriminator through the existing install/update dispatch; no new mode was introduced (D-67-02 acceptance criterion).
- **Head recovered before deciding boolean flags.** Positional extraction needs the head to know which boolean flags apply, but the head IS the first positional regardless of boolean flags (the subcommand token is never a flag). A flag-free first `extractPositionals` pass recovers the head, then the head-specific allow-list (`["--force"]` for install/update) re-runs the extraction. This scopes the `--force` strip to install/update without affecting reinstall (already `--force`-free per 67-01) or other heads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing RINST-01 flag-exclusion test asserted install/update have no `--force`**
- **Found during:** Task 2 (GREEN run)
- **Issue:** `tests/edge/completions/provider.test.ts` `PRL-16 / RINST-01 :: reinstall flag completion excludes --force` looped over `["install", "uninstall", "update", "list", "ls", "marketplace"]` asserting none offer `--force`. D-67-02 deliberately adds `--force` to install/update completion, so install/update now (correctly) fail that assertion.
- **Fix:** Removed `install` and `update` from the exclusion loop (they are covered by the new positive `--force is a flag completion for install/update` case); kept `uninstall`/`list`/`ls`/`marketplace` in the exclusion set and the reinstall-specific assertion unchanged.
- **Files modified:** tests/edge/completions/provider.test.ts
- **Commit:** e5ca6683

**Total deviations:** 1 test-contract update made in lockstep with the locked D-67-02 behavior change. No scope creep -- every touched line serves the LIST-02 / D-67-02 force-gated candidate-set goal.

## Threat Surface

- **T-67-09 (accept):** the force-gated sets only read the already-built plugin-index cache (populated no-network in 67-03); completion performs no resolution or network I/O. No new data path; NFR-5 preserved.
- **T-67-10 (mitigate):** no classification logic added to the provider -- `data.ts` filters on the cache `row.status` from the shared classifier; `tests/architecture/import-boundaries.test.ts` stays green (no new edge->orchestrator/domain import).
- **T-67-11 (mitigate):** registering `--force` as a boolean flag for install/update positional extraction fixes the `install --force <TAB>` -> null return; a regression test asserts the branch fires.

No new threat surface beyond the register; no Threat Flags.

## Closed-set tripwire evidence

- `tests/architecture/notify-closed-set-locks.test.ts` passes: `STATUS_TOKENS.length === 22`, `PLUGIN_STATUSES.length === 17`, `MARKETPLACE_STATUSES.length === 7`. No token bump (none expected -- the force gating reads the existing finer completion-cache status union from 67-03; no new render token).
- `tests/architecture/import-boundaries.test.ts` + `tests/architecture/catalog-uat.test.ts` + `tests/architecture/no-orchestrator-network.test.ts` green.
- `npm run check` exit 0: `tests 2430 / pass 2428 / fail 0 / skipped 2` plus `test:integration 16 / pass 16 / fail 0`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LIST-02 (Phase 67 success criterion 2) is satisfied across both the list (67-02/03) and completion (this plan) surfaces. The remaining phase work (reinstall repair, RINST-01) is independent (67-01, merged). Phase 70 owns the final PRD section 11 reconcile.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/edge/completions/provider.ts`, `extensions/pi-claude-marketplace/edge/completions/data.ts`, `tests/edge/completions/provider.test.ts` all exist on disk with the described changes.
- Task commits `8c207a51` (test) and `e5ca6683` (feat) exist in history.
- `npm run check` exits 0; closed-set tripwire 22/17/7.
- STATE.md / ROADMAP.md untouched (worktree mode; orchestrator owns those writes).

---
*Phase: 67-list-filters-completion-reinstall-repair*
*Completed: 2026-06-27*
