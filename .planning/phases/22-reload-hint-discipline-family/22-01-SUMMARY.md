---
phase: 22-reload-hint-discipline-family
plan: 01
subsystem: api
tags: [notify, reload-hint, marketplace, catalog-uat, byte-equality, structured-notification]

# Dependency graph
requires:
  - phase: 21-final-teardown-green-gate
    provides: "shouldEmitReloadHint chokepoint + G-21-01 discriminator-keyed reload-gate precedent (Plan 21-04); PluginPresentMessage inventory/transition split"
  - phase: 16-renderer-public-api
    provides: "notify(ctx, pi, message) renderer + RELOAD_HINT_TRAILER + computeSeverity + catalog-uat byte-equality runner"
provides:
  - "shouldEmitReloadHint collapsed to a purely plugin-row-driven rule (no marketplace-status arm); reload trailer fires iff a plugin row carries installed | updated | reinstalled | uninstalled"
  - "Clean marketplace remove carries one PluginUninstalledMessage row per unstaged plugin (D-22-02); empty remove is header-only"
  - "Autoupdate fresh-flip, empty add, and no-op update no longer emit the /reload trailer (G-MIL-01 / G-MIL-02 / G-MIL-06 closed)"
  - "docs/output-catalog.md reload-hint rule narrowed to plugin-rows-only; add/clean-remove/update-no-op/autoupdate-fresh/bootstrap byte forms updated"
  - "5 D-22-04 reload-trailer regression tests (3 negative G-MIL guards + 2 positive SC#4 guards)"
affects: [23-version-display-bundle, 24-grammar-consistency, 26-green-gate-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminator-keyed reload gate: every status discriminator either always triggers the reload-hint or never does (G-21-01 invariant extended by removing the marketplace-status arm)"
    - "Content-driven reload decision: clean-remove emits real PluginUninstalledMessage rows rather than a hidden flag/count field (no new MarketplaceNotificationMessage field)"
    - "Lockstep catalog/fixture/test single-commit discipline (Pattern C): source + catalog + catalog-uat fixtures + notify-v2 byte assertions move together so byte-equality stays GREEN"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts - collapsed shouldEmitReloadHint to plugin-row-only; rewrote docblock (SNM-33/D-22-01/D-22-03)"
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts - clean path emits successfullyUnstaged.map(uninstalled rows); file-header + recipe comments rewritten"
    - "docs/output-catalog.md - reload-hint rule narrowed; add/clean-remove/update-no-op/autoupdate-fresh/bootstrap fences + prose updated"
    - "tests/architecture/catalog-uat.test.ts - clean-remove fixture gains a {status:uninstalled, name:helper} row"
    - "tests/shared/notify-v2.test.ts - 5 new D-22-04 tests + 9 byte assertions updated to drop the trailer"

key-decisions:
  - "Followed plan D-22-01/02/03/04/06 exactly for the 5 named files"
  - "Extended the breaking-test fix across 6 additional orchestrator/handler suites (bootstrap, add, autoupdate, remove, update, import) that the plan's PATTERNS scan did not enumerate but were the same marketplace-status-arm class -- required for npm run check GREEN (lockstep gate)"
  - "Fixed the catalog `bootstrap` fresh/already-bootstrapped fences (also unlisted by the plan) -- caught by the catalog-uat byte-equality runner"

patterns-established:
  - "Plugin-row-only reload gate: marketplace records are bookkeeping, not Pi-visible resources; only the 4 plugin transition tokens drive the trailer"

requirements-completed: [SNM-33]

# Metrics
duration: 21min
completed: 2026-05-29
---

# Phase 22 Plan 01: Reload-hint Discipline Family Summary

**Collapsed `shouldEmitReloadHint` to a purely plugin-row-driven rule so empty `marketplace add`/`remove`, no-op `update`, and autoupdate fresh-flips stop emitting the `/reload` trailer; clean remove now carries `(uninstalled)` rows so true state changes still fire it (closes SNM-33 / G-MIL-01 / G-MIL-02 / G-MIL-06).**

## Performance

- **Duration:** 21 min
- **Started:** 2026-05-29T01:58:58Z
- **Completed:** 2026-05-29T02:19:xxZ
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Deleted the marketplace-status arm from `shouldEmitReloadHint`; the trailer now fires iff a plugin row carries `installed | updated | reinstalled | uninstalled`. Every status discriminator is now unambiguous (always-trigger or never-trigger), extending the G-21-01 invariant.
- Rewired the clean `marketplace remove` path to emit one `PluginUninstalledMessage` row per `successfullyUnstaged` plugin (D-22-02): non-empty remove still fires the trailer via the `uninstalled` token; empty remove is header-only (G-MIL-02).
- Narrowed the `docs/output-catalog.md` reload-hint rule to the single plugin-row bullet and updated every affected byte form (add path/github, clean-remove with `(uninstalled)` row, update no-op manifest-refresh, autoupdate enable/disable fresh, and the bootstrap fresh/already-bootstrapped fences).
- Added 5 D-22-04 reload-trailer regression tests (3 negative G-MIL guards + 2 positive SC#4 guards) and updated all breaking byte assertions across the marketplace/plugin/import orchestrator suites in lockstep.
- `npm run check` GREEN: typecheck + ESLint + Prettier + 1128/1128 tests; catalog-uat byte-equality runner 3/3.

## Task Commits

All three tasks landed as one atomic lockstep commit (the phase is a single-commit byte-equality change per D-22-06 / Pattern C):

1. **Task 1: Collapse shouldEmitReloadHint + clean-remove uninstalled rows** - `c6734cf` (fix)
2. **Task 2: Update output-catalog.md and catalog-uat fixtures** - `c6734cf` (fix)
3. **Task 3: Add D-22-04 tests + fix breaking byte assertions** - `c6734cf` (fix)

_Single commit because any intermediate state leaves the catalog-uat byte-equality runner RED; the lockstep constraint forbids splitting._

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - `shouldEmitReloadHint` body reduced to the inner plugin-row loop; docblock rewritten to the single plugin-row rule citing SNM-33 / D-22-01 / D-22-03. `computeSeverity`, `RELOAD_HINT_TRAILER`, type unions, and `MARKETPLACE_STATUSES` untouched.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` - clean path `plugins: []` replaced with `successfullyUnstaged.map((name): PluginUninstalledMessage => ({ status: "uninstalled", name }))`; file-header prose, inline clean comment, and the construction-recipe comment rewritten (stale "reload fires regardless" language removed).
- `docs/output-catalog.md` - reload-hint rule second bullet deleted; line-15 header-alone note narrowed; trailer stripped from add/update-no-op/autoupdate-fresh/bootstrap fences; clean-remove fence now shows `○ helper (uninstalled)` + trailer; rationale prose rewritten across the affected sections.
- `tests/architecture/catalog-uat.test.ts` - `clean` remove fixture's `plugins` now `[{ status: "uninstalled", name: "helper" }]` matching the catalog byte-for-byte.
- `tests/shared/notify-v2.test.ts` - 5 new D-22-04 tests; skipped-plugin-with-reasons keeps `"warning"` and drops trailer; added/removed/updated/autoupdate-enabled/autoupdate-disabled/header-only-empty-added byte forms dropped trailer; 2 multi-cause cause-chain byte forms dropped trailer (failed-only rows). failed-header-alone left byte-unchanged.
- `tests/edge/handlers/plugin/bootstrap.test.ts`, `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/marketplace/{add,autoupdate,remove,update}.test.ts`, `tests/orchestrators/import/execute.test.ts` - byte/predicate assertions updated to drop the trailer for the now-suppressed marketplace-status-only / no-op-cascade cases.

## Decisions Made

- Followed the plan's D-22-01/02/03/04/06 transforms verbatim for the 5 named files.
- The empty-remove canonical form stays header-only (no trailer); the catalog `clean` fence became the canonical NON-empty remove with one `(uninstalled)` row + trailer, matching the catalog-uat `clean` fixture byte-for-byte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Breaking byte assertions in 6 orchestrator/handler test suites beyond the plan's enumerated set**
- **Found during:** Task 3 (running `npm run check`)
- **Issue:** The plan's PATTERNS scan only enumerated the breaking tests inside `tests/shared/notify-v2.test.ts`. Collapsing `shouldEmitReloadHint` (Task 1) also broke 19 assertions across `tests/orchestrators/marketplace/{add,autoupdate,remove,update}.test.ts`, `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`, and `tests/orchestrators/import/execute.test.ts` -- all asserting the deleted marketplace-status arm (empty add/remove/update, autoupdate fresh-flip, no-op import cascade, failed-only cascade under an `(added)` marketplace).
- **Fix:** Updated each assertion to drop the `\n\n/reload to pick up changes` suffix (or flip `.includes(...)` from true to false / `assert.match` to `assert.doesNotMatch`), with comments retitled to cite SNM-33 / D-22-01 / D-22-03. Severity arguments left intact (computeSeverity is independent).
- **Files modified:** the 6 test files above.
- **Verification:** `npm run check` exits 0; 1128/1128 tests pass.
- **Committed in:** `c6734cf` (lockstep commit)

**2. [Rule 1 - Bug] Catalog `bootstrap` fresh/already-bootstrapped fences also misfiring**
- **Found during:** Task 2 (running `node --test tests/architecture/catalog-uat.test.ts`)
- **Issue:** The `bootstrap` command section (`<!-- catalog-state: fresh -->` `(added)` and `<!-- catalog-state: already-bootstrapped -->` `(updated)`, both `plugins:[]`) was not enumerated by the plan but carried the now-misfiring trailer; the byte-equality runner flagged both as mismatches.
- **Fix:** Stripped the trailer line + preceding blank line from both fences and rewrote their rationale prose to cite SNM-33 / D-22-01.
- **Files modified:** `docs/output-catalog.md`.
- **Verification:** catalog-uat runner 3/3 GREEN.
- **Committed in:** `c6734cf` (lockstep commit)

**3. [Rule 2 - Missing Critical] remove.ts construction-recipe comment claimed "`plugins: []` is required"**
- **Found during:** Task 1
- **Issue:** Beyond the plan-named file-header (8-13) and inline (327-330) comments, the construction-recipe block comment still asserted `plugins: []` is required and that the trailer is computed "per D-16-12" -- both factually wrong after D-22-02.
- **Fix:** Rewrote the recipe comment to state `plugins[]` carries one `PluginUninstalledMessage` per unstaged plugin and the trailer is computed per D-22-01.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`.
- **Verification:** lint/typecheck/tests GREEN.
- **Committed in:** `c6734cf` (lockstep commit)

---

**Total deviations:** 3 auto-fixed (2 bug, 1 missing-critical doc accuracy)
**Impact on plan:** All necessary for the plan's stated success criterion (`npm run check` GREEN under the lockstep byte-equality gate). The deviations are the same marketplace-status-arm class the plan targets; no scope creep -- no behavior beyond the collapsed reload-hint rule was changed. The plan's PATTERNS scan simply under-enumerated the breaking tests/fences.

## Issues Encountered

- Prettier reflowed two test files (`tests/shared/notify-v2.test.ts`, `tests/orchestrators/marketplace/update.test.ts`) after edits (single-arg `deepEqual` calls collapsed onto one line; import grouping). Resolved with `prettier --write`; byte-string contents unchanged.

## Threat Flags

None - no new network endpoints, auth paths, file access patterns, or schema changes. T-22-01 (user-trust/misinformation) is fully mitigated by the D-22-04 positive guards (trailer still fires for remove >=1 uninstalled and update >=1 changed) and the catalog-uat byte-equality runner, as the plan's threat register specifies.

## Known Stubs

None - the change is output-gating logic with all data wired and tested. No placeholder values, no unwired components.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SNM-33 closed; `npm run check` GREEN at 1128/1128.
- Phase 23 (Version Display Bundle, SNM-34/35) is next and also touches `shared/notify.ts`; the reload-hint chokepoint is now stable and the catalog-uat runner remains the byte-equality gate. No blockers.

## Self-Check: PASSED

- `22-01-SUMMARY.md` exists.
- Commit `c6734cf` (source/catalog/test lockstep) exists.
- Commit `52066b9` (SUMMARY) exists.

---
*Phase: 22-reload-hint-discipline-family*
*Completed: 2026-05-29*
