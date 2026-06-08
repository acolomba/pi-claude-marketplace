---
phase: 47-plugin-ops-attribution-cross-scope
plan: 01
subsystem: api
tags: [typescript, discriminated-union, error-attribution, cross-scope, notify, catalog-uat]

# Dependency graph
requires:
  - phase: 46-type-model-foundations
    provides: MarketplaceNotAddedMessage variant + renderMarketplaceNotAdded + isInfoKind guard + ContentReason
provides:
  - "Discriminated cross-scope plugin-target resolver (resolveCrossScopePluginTarget) in plugin/shared.ts: resolved | other-scope | marketplace-absent"
  - "install M1 re-attribution: marketplace-absent emits standalone {not added} on the marketplace subject (ATTR-01), preserving the M2 {not in manifest} plugin-row case (ATTR-08)"
  - "uninstall M3/M4 loud {not added} for a never-added or other-scope-only marketplace (ATTR-04, SCOPE-01); M4b silent PU-5 converge preserved for an already-gone plugin record"
  - "ATTR-09 truthful narrowCascadeFailure reasons (AgentsUnstageFailureError -> source mismatch; unclassified -> unreadable), no more lying {not in manifest}"
  - "install + uninstall missing-marketplace-not-added catalog states (byte forms) paired with catalog-uat FIXTURES entries"
affects: [47-02, 47-03, reinstall, update, marketplace-op-attribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union scope resolution (NFR-7 precedent installable: true | false applied to lifecycle scope)"
    - "Standalone top-level MarketplaceNotAddedMessage emission for the marketplace-existence precondition (D-47-A)"
    - "In-guard sentinel (marketplaceAbsent) returned-clean then handled post-guard, mirroring uninstall alreadyGone"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "D-47-A: standalone top-level MarketplaceNotAddedMessage emission (notify(ctx, pi, { kind: marketplace-not-added, name, scope? }); return), not an embedded cascade row"
  - "D-47-B: reuse existing REASONS members for cascade failures -- AgentsUnstageFailureError -> source mismatch, unclassified -> unreadable; NO new REASONS member"
  - "D-47-C / SCOPE-01: new discriminated resolver resolveCrossScopePluginTarget; the [requestedScope] bracket on {not added} satisfies SCOPE-01 (no richer other-scope phrase, no renderer touch)"
  - "resolveInstallMarketplaceSource (CMP-3) left byte-unchanged; install M1 uses an in-guard sentinel, not the cross-scope resolver"

patterns-established:
  - "Cross-scope discriminated resolution: marketplace-container absence vs plugin-row absence is the load-bearing distinction (container present -> resolved so the caller's silent-converge path applies; container absent -> marketplace-absent loud)"
  - "Marketplace-existence is a PRECONDITION checked before the cascade, surfaced on the marketplace subject; {not in manifest} is reserved for plugin-absent-from-a-present-manifest"

requirements-completed: [ATTR-01, ATTR-08, ATTR-04, ATTR-09, SCOPE-01]

# Metrics
duration: ~40min
completed: 2026-06-07
---

# Phase 47 Plan 01: Plugin-Ops Attribution & Cross-Scope (install + uninstall) Summary

**install/uninstall now converge on info's model: a missing or wrong-scope marketplace renders standalone `(failed) {not added}` on the marketplace subject (not `{not in manifest}` on a plugin row, not silent), backed by a new discriminated cross-scope resolver and truthful cascade-failure reasons.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-07T21:47Z (approx, orchestrator-recorded execution start)
- **Completed:** 2026-06-07T22:06Z
- **Tasks:** 3
- **Files modified:** 10 (3 source, 5 test, 1 catalog doc, 1 catalog-uat fixture file)

## Accomplishments

- **Task 1 (SCOPE-01 foundation):** Added the exported `resolveCrossScopePluginTarget` discriminated resolver to `plugin/shared.ts` (`resolved | other-scope | marketplace-absent`), mirroring the `loadState`/`locationsFor` read pattern from `resolveScopeFromState`. It distinguishes marketplace-container absence from plugin-row absence (the load-bearing fix per RESEARCH M13 / Pitfall 4) and reads only via `loadState` (NFR-5, no network). `resolveInstallMarketplaceSource` (CMP-3) and the legacy `resolveInstalled*Target` exports are byte-unchanged (Plan 47-03 migrates the latter). 7 new SCOPE-01 test cases.
- **Task 2 (install M1 + uninstall M3/M4/M4b + ATTR-09):**
  - install M1 (`source === undefined` after the CMP-3 fallback also misses) now sets an in-guard sentinel and post-guard emits standalone `{not added}` carrying the resolved `[scope]` bracket (standalone mode) or returns a failed outcome WITHOUT emitting (orchestrated mode). The M2 `entryRaw === undefined` branch (plugin absent from a present manifest) is left exactly as `{not in manifest}` (ATTR-08).
  - uninstall routes through the new resolver: `marketplace-absent` AND `other-scope` map to standalone `{not added}` carrying the requested scope; `resolved` flows into the existing guard where `installed === undefined` keeps the PU-5 silent converge (ATTR-04). The old `mp === undefined -> alreadyGone` collapse is re-documented as a concurrent-removal-only race.
  - `narrowCascadeFailure` now returns truthful reasons (`AgentsUnstageFailureError -> source mismatch`; unclassified `-> unreadable`); errno branches unchanged (ATTR-09).
- **Task 3 (byte gate):** Added `missing-marketplace-not-added` catalog states for install (`⊘ ghost-mp [project] (failed) {not added}`) and uninstall (`⊘ ghost-mp [user] (failed) {not added}`), each paired with a catalog-uat FIXTURES entry copying the info not-added template (`pi: piWithBothLoaded()`, `expectedSeverity: "error"`, `message satisfies NotificationMessage`).

## Task Commits

This plan is committed by the orchestrator as ONE green commit (sequential-executor / orchestrator-owns-commits policy). No per-task commits were made by the executor.

1. **Task 1: cross-scope resolver in shared.ts** -- committed by orchestrator
2. **Task 2: install M1 + uninstall M3/M4/M4b + ATTR-09 reasons** -- committed by orchestrator
3. **Task 3: catalog states + catalog-uat fixtures** -- committed by orchestrator

**Plan metadata (SUMMARY):** committed by orchestrator

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- Added `CrossScopePluginResolution` type, `resolveCrossScopePluginTarget`, and `otherScope` helper (pure additions; CMP-3 resolver untouched).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- M1 re-attribution: `marketplaceAbsent` in-guard sentinel + post-guard standalone `{not added}` emission / orchestrated failed-outcome gate.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- Routed `uninstallPlugin` through the new resolver; `marketplace-absent`/`other-scope` -> standalone `{not added}`; amended `narrowCascadeFailure` (ATTR-09).
- `tests/orchestrators/plugin/shared.test.ts` -- 7 SCOPE-01 resolver cases (each discriminated arm).
- `tests/orchestrators/plugin/install.test.ts` -- Re-attributed the marketplace-absent test to standalone `{not added}`; added an orchestrated-mode M1 test; updated the CMP-4/PI-16 user-target test.
- `tests/orchestrators/plugin/uninstall.test.ts` -- ATTR-04 loud `{not added}` test, SCOPE-01 other-scope-only test; updated PU-3/PU-7 + AG-5 (`source mismatch`) and the two narrow-default tests (`unreadable`).
- `tests/edge/handlers/plugin/install.test.ts` -- Shim valid-args/scope/map-model tests now assert the `{not added}` byte form.
- `tests/edge/handlers/plugin/uninstall.test.ts` -- Shim valid-args/scope tests now assert the loud `{not added}` (bare form = no bracket; `--scope project` = `[project]` bracket).
- `docs/output-catalog.md` -- Two new `missing-marketplace-not-added` catalog states (install + uninstall) with ATTR prose. +20 lines, additions only.
- `tests/architecture/catalog-uat.test.ts` -- Two new FIXTURES entries pairing the new catalog states.

## Decisions Made

- **D-47-A (standalone emission):** The marketplace-existence precondition fails before any cascade row exists, and the variant is not type-representable as a cascade `plugins[]` row, so it is emitted standalone top-level, matching `info` exactly.
- **D-47-B (truthful reasons, no new member):** `source mismatch` for foreign-content (`AgentsUnstageFailureError`) and `unreadable` for the unclassified default -- both existing closed-set members.
- **D-47-C / SCOPE-01 (bracket-only hint):** The `[requestedScope]` bracket on `{not added}` communicates "not added in the scope you asked for"; no richer "present in <other> scope" phrase (which would expand the byte surface and touch the renderer) -- locked out by the milestone's lean.
- **install M1 uses an in-guard sentinel, NOT the cross-scope resolver:** `resolveInstallMarketplaceSource` already owns the CMP-3 project->user fallback; only a double-miss reaches the not-added emission. The cross-scope resolver is for the explicit-scope lifecycle path (uninstall here; reinstall/update in 47-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated edge-handler shim tests not listed in the plan's files_modified**
- **Found during:** Task 2 / final gate (`npm run check`)
- **Issue:** `tests/edge/handlers/plugin/install.test.ts` (4 tests) and `tests/edge/handlers/plugin/uninstall.test.ts` (2 tests) asserted the OLD byte forms -- install asserted the `not found in marketplace "mymkt"` cause-chain (former `{not in manifest}`), and uninstall asserted silent converge for a never-added marketplace. The re-attribution made all 6 fail. These tests verify "control reached the orchestrator and the right scope was selected" against empty hermetic state -- the new `{not added}` byte form proves the same intent (and more, via the `[scope]` bracket).
- **Fix:** Updated the 6 shim assertions to the new `{not added}` byte forms (bare form = no bracket; explicit/default scope = `[scope]` bracket) and refreshed the uninstall.test.ts header comment.
- **Files modified:** `tests/edge/handlers/plugin/install.test.ts`, `tests/edge/handlers/plugin/uninstall.test.ts`
- **Verification:** `npm run check` exits 0 (1482 tests pass).
- **Committed in:** committed by orchestrator

**2. [Rule 3 - Blocking] eslint no-unnecessary-condition on the install `marketplaceAbsent` sentinel**
- **Found during:** Task 2 / lint sub-gate
- **Issue:** `if (marketplaceAbsent)` tripped `@typescript-eslint/no-unnecessary-condition` because TS flow analysis cannot see the mutation inside the `withStateGuard` closure (identical to the existing `alreadyGone` case in uninstall.ts).
- **Fix:** Added the same documented `eslint-disable-next-line @typescript-eslint/no-unnecessary-condition` comment used for uninstall's `alreadyGone`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- **Verification:** `npm run lint` reports no problems.
- **Committed in:** committed by orchestrator

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both auto-fixes were necessary for the plan to be independently GREEN. The edge-test updates are a direct consequence of the intended byte change and were the only tests outside the plan's `files_modified` that the re-attribution touched. No scope creep.

## Issues Encountered

None beyond the two auto-fixed blocking issues above. `resolveInstallMarketplaceSource` (CMP-3) confirmed byte-unchanged (shared.ts diff is pure additions, 0 deletion lines). No `@ts-expect-error` introduced. No new REASONS member. No new package installs.

## Verification

- `npx tsc --noEmit` exits 0 (discriminated-union NFR-7 shape compiles; no `as` casts introduced).
- `node --test tests/orchestrators/plugin/shared.test.ts` -- 25 pass (7 new SCOPE-01 arms).
- `node --test tests/orchestrators/plugin/install.test.ts` -- 52 pass.
- `node --test tests/orchestrators/plugin/uninstall.test.ts` -- 20 pass.
- `node --test tests/architecture/catalog-uat.test.ts` -- byte-equality GREEN.
- `git diff --stat docs/output-catalog.md` -- non-empty (+20 insertions, additions only).
- grep: no `return "not in manifest"` remains in uninstall.ts `narrowCascadeFailure`.
- grep: `resolveInstallMarketplaceSource` body byte-unchanged (CMP-3 preserved).
- **`npm run check` exits 0** (typecheck + eslint + prettier:check + full node:test suite, 1482 tests pass).

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `resolveCrossScopePluginTarget` is the shared chokepoint Plan 47-03 (reinstall/update) consumes for SCOPE-01; the legacy `resolveInstalled*Target` exports remain for 47-03 to migrate.
- The `missing-marketplace-not-added` catalog/fixture pattern is established for reinstall/update to extend.
- No blockers. This plan is independently GREEN; Plan 47-02 and 47-03 run strictly after it (they re-touch shared.ts / notify.ts reasons / the catalog).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- FOUND (resolveCrossScopePluginTarget exported)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- FOUND (M1 standalone emission)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- FOUND (resolver routing + ATTR-09 reasons)
- `docs/output-catalog.md` -- FOUND (2 new missing-marketplace-not-added states)
- `tests/architecture/catalog-uat.test.ts` -- FOUND (2 new FIXTURES entries)
- All commits: deferred to orchestrator (sequential-executor policy) -- nothing committed by the executor.

---
*Phase: 47-plugin-ops-attribution-cross-scope*
*Completed: 2026-06-07*
