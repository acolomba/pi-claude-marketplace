---
phase: 47-plugin-ops-attribution-cross-scope
plan: 03
subsystem: orchestrators
tags: [discriminated-union, error-attribution, cross-scope, notify, marketplace-not-added, catalog-uat]

# Dependency graph
requires:
  - phase: 47-01-plugin-ops-attribution-cross-scope
    provides: resolveCrossScopePluginTarget discriminated resolver; install/uninstall {not added} re-attribution; catalog/fixture conventions
  - phase: 47-02-plugin-ops-attribution-cross-scope
    provides: reinstall MarketplaceNotAddedSignal pattern; cross-scope resolver consumption; reinstall {not added} states
  - phase: 46-type-model-foundations
    provides: MarketplaceNotAddedMessage variant + renderMarketplaceNotAdded + isInfoKind routing (the Phase 46 primitive reused verbatim)
provides:
  - update direct-path standalone (failed) {not added} for missing marketplace (both <plugin>@<mp> and @<mp> forms)
  - resolveInstalledMarketplaceTarget migrated to ScopedMarketplaceResolution discriminated result (no raw MarketplaceNotFoundError escape)
  - SCOPE-01 [requestedScope] bracket on update's missing-marketplace attribution
  - update missing-marketplace-not-added catalog states + paired catalog-uat fixtures
affects: [phase-48-marketplace-op-attribution, phase-49-cross-op-convergence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MarketplaceNotAddedSignal exception class hoists the marketplace-existence precondition to the direct-path entrypoint, caught at updatePlugins and re-attributed to the standalone {not added} variant -- mirrors reinstall.ts (47-02), leaves the shared cascade-safe preflightUpdate non-throwing (Pitfall 3 / A3)"
    - "ScopedMarketplaceResolution discriminated union (resolved | other-scope | marketplace-absent) replaces the raw-throw return on resolveInstalledMarketplaceTarget (NFR-7 precedent)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "resolveInstalledMarketplaceTarget returns ScopedMarketplaceResolution (3-arm discriminated union) instead of throwing MarketplaceNotFoundError; the explicit-scope miss reads the other scope (other-scope arm) per SCOPE-01"
  - "The marketplace-existence check is hoisted to the DIRECT-path entrypoint (resolveUpdateMarketplaceScope -> MarketplaceNotAddedSignal -> updatePlugins catch). The shared preflightUpdate mp===undefined branch is left UNCHANGED as the cascade-safe concurrent-removal guard (Pitfall 3 / OQ#2 / A3)"
  - "Extracted handleEnumerateFailure helper from updatePlugins to keep cognitive complexity <= 15 (sonarjs); mirrors reinstall.ts::handleEnumerationFailure"

patterns-established:
  - "Both <plugin>@<mp> and @<mp> update forms converge on enumerateMarketplaceTarget -> resolveUpdateMarketplaceScope, so a single MarketplaceNotAddedSignal emission covers both (ATTR-02 form-independence)"

requirements-completed: [ATTR-02, SCOPE-01]

# Metrics
duration: ~75min
completed: 2026-06-07
---

# Phase 47 Plan 03: update Attribution & Cross-Scope Summary

**update's missing-marketplace precondition re-attributed to the canonical standalone `(failed) {not added}` for both the `<plugin>@<mp>` and `@<mp>` forms, eliminating the raw `MarketplaceNotFoundError`/`Error` -> `{not found}` misattribution while preserving the cascade never-throw contract -- closing ATTR-02 and the update half of SCOPE-01.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-07T21:47Z
- **Completed:** 2026-06-07T23:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `resolveInstalledMarketplaceTarget` (shared.ts) migrated from a raw `throw new MarketplaceNotFoundError` (M11) to the discriminated `ScopedMarketplaceResolution` union (`resolved` | `other-scope` | `marketplace-absent`). CMP-5 scope precedence preserved for the resolved arms; the explicit-scope miss reads the other scope to surface the SCOPE-01 hint. The `MarketplaceNotFoundError` import was removed (now unused).
- update direct path hoists the marketplace-existence check to the entrypoint via a new `resolveUpdateMarketplaceScope` helper that raises `MarketplaceNotAddedSignal`; `updatePlugins` catches it (in the extracted `handleEnumerateFailure`) and emits ONE standalone `notify(ctx, pi, { kind: "marketplace-not-added", name, scope? })` before any cascade row exists (M10/M11). Both update forms converge here.
- SCOPE-01: an explicit-scope update against a marketplace present only in the other scope (`other-scope` arm) and an absent-in-both explicit-scope miss both carry the `[requestedScope]` bracket; the bare `@mp` form absent from both scopes carries no bracket.
- The shared `preflightUpdate` `mp === undefined` branch (M9) is left UNCHANGED as the non-throwing cascade-safe concurrent-removal guard -- the cascade path (`updateSinglePlugin`) still never throws (Pitfall 3 / OQ#2 / A3 preserved; PUP-9 cascade test + swapState concurrent-removal test both GREEN).
- Two new `missing-marketplace-not-added` catalog states (bracketed + absent-from-both) added to the update H2 in `docs/output-catalog.md`, each paired with a catalog-uat FIXTURES entry under the `/claude:plugin update` section key.

## Task Commits

Committed by orchestrator (this plan lands as one GREEN commit; this executor committed NOTHING).

1. **Task 1: resolveInstalledMarketplaceTarget structural not-found result (shared.ts + shared.test.ts)** -- committed by orchestrator (refactor/test)
2. **Task 2: update direct-path standalone {not added}; cascade never-throw preserved (update.ts + update.test.ts)** -- committed by orchestrator (feat/test)
3. **Task 3: update catalog state(s) + catalog-uat fixtures (output-catalog.md + catalog-uat.test.ts)** -- committed by orchestrator (docs/test)

**Plan metadata:** committed by orchestrator (docs: complete plan)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- `resolveInstalledMarketplaceTarget` returns `ScopedMarketplaceResolution` (new discriminated union exported) instead of throwing; `MarketplaceNotFoundError` import removed. `resolveInstallMarketplaceSource` (CMP-3) and `resolveCrossScopePluginTarget` (47-01) byte-unchanged.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- added `MarketplaceNotAddedSignal` class; new `resolveUpdateMarketplaceScope` helper consumes the discriminated result for both forms and raises the signal on marketplace-absent/other-scope; `enumerateMarketplaceTarget` rewired to consume it (no more raw `throw new Error` M10); `updatePlugins` enumerate-catch extracted into `handleEnumerateFailure` (cognitive-complexity ceiling) which emits the standalone `kind: "marketplace-not-added"`. `preflightUpdate` M9 branch untouched.
- `tests/orchestrators/plugin/shared.test.ts` -- `resolveInstalledMarketplaceTarget` tests migrated to assert discriminated arms; added ATTR-02 marketplace-absent (bare + explicit) and SCOPE-01 other-scope cases; `MarketplaceNotFoundError` import removed.
- `tests/orchestrators/plugin/update.test.ts` -- amended the former `{not found}` missing-marketplace test to standalone `{not added}`; added ATTR-02 `@<mp>` (bracketed), `<plugin>@<mp>` (bracketed), bare `@<mp>` (no bracket), and SCOPE-01 other-scope cases.
- `tests/edge/handlers/plugin/update.test.ts` -- amended 4 shim tests that asserted the old `/not found/` to assert the new standalone `{not added}` (ATTR-02 behavior change; see Deviations).
- `docs/output-catalog.md` -- added `missing-marketplace-not-added` (bracketed `[user]`) and `missing-marketplace-not-added-absent-from-both` (no bracket) states under `## /claude:plugin update`, with ATTR-02/SCOPE-01 prose.
- `tests/architecture/catalog-uat.test.ts` -- added the two paired FIXTURES entries under the `/claude:plugin update` section key (`piWithBothLoaded()`, `expectedSeverity: "error"`, `kind: "marketplace-not-added"`).

## Decisions Made

- Reused the 47-02 `MarketplaceNotAddedSignal` pattern (a per-file exception class) rather than threading the discriminated result all the way through `enumerateTargets`'s union return -- keeps the entrypoint emission at the right layer and matches the established cross-op convention.
- Did NOT retype the `preflightUpdate` M9 reason: the swapState concurrent-removal test proves that branch is still reachable on the direct path via concurrent removal (after `enumerateTargets` ran, then `syncCloneOnce` removed the mp), and its `skipped` outcome is the correct cascade-safe + concurrent-removal behavior. Leaving it as-is honors Pitfall 3 / A3.
- `syncCloneOnce`'s `mp === undefined` raw throw is left as-is: the entrypoint preflight establishes marketplace existence first, so it is only reachable as a concurrent-removal edge already routed through `notifyDirectFailure` (swapState test GREEN) -- not the marketplace-existence precondition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / amended test] Re-attributed 4 edge-handler shim tests to the new `{not added}` byte form**
- **Found during:** Task 2 (full `npm run check` after the update.ts change)
- **Issue:** `tests/edge/handlers/plugin/update.test.ts` had 4 shim tests asserting the OLD `/not found/` output for a missing marketplace (`myplug@mymkt`, `@mymkt`, and their `--map-model` variants). The plan's `files_modified` listed only the orchestrator/shared/catalog test files, but these edge tests exercise the orchestrator end-to-end through the handler and were correctly producing the NEW `⊘ mymkt (failed) {not added}` -- failing the old assertion.
- **Fix:** Amended the 4 assertions to `assert.equal(... "⊘ mymkt (failed) {not added}")` (bare/no-scope form -> no bracket). This is the "Amended existing states/tests" the RESEARCH Catalog/Fixture Impact section anticipated for update; the behavior change is the intended ATTR-02 outcome, not a regression.
- **Files modified:** tests/edge/handlers/plugin/update.test.ts
- **Verification:** `node --test tests/edge/handlers/plugin/update.test.ts` 10/10 GREEN; full `npm run check` exit 0.
- **Committed in:** committed by orchestrator (Task 2)

**2. [Rule 3 - Blocking] Extracted `handleEnumerateFailure` to satisfy the sonarjs cognitive-complexity ceiling**
- **Found during:** Task 2 (eslint sub-gate of `npm run check`)
- **Issue:** Adding the `MarketplaceNotAddedSignal` instanceof branch to `updatePlugins`'s enumerate-catch pushed its cognitive complexity from 15 to 16 (`sonarjs/cognitive-complexity` error).
- **Fix:** Extracted the entire enumerate-failure handling (the new signal arm + the existing bare-form / marketplace-plugin arms) into a `handleEnumerateFailure(opts, err)` helper, mirroring `reinstall.ts::handleEnumerationFailure`. Trimmed the now-unused `target`/`explicitScope` destructure in `updatePlugins`.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
- **Verification:** `npm run lint` clean; `npx tsc --noEmit` exit 0.
- **Committed in:** committed by orchestrator (Task 2)

---

**Total deviations:** 2 auto-fixed (1 amended-test behavior change, 1 blocking refactor)
**Impact on plan:** Both necessary for an independently-GREEN plan. The edge-test amendment is the intended ATTR-02 attribution change; the extraction is a structural refactor with no behavior change. No scope creep -- `resolveInstallMarketplaceSource` (CMP-3) and `resolveCrossScopePluginTarget` (47-01) untouched; no new REASONS member; preflightUpdate cascade-safe outcome preserved.

## Issues Encountered

- First catalog-uat run reported MISSING FIXTURE for the two new update states: the FIXTURES entries had been added to the wrong `same-mp-both-scopes` block (the one in the `/claude:plugin import` section, not `/claude:plugin update`). Moved them after the update section's `hash-version-arrow` fixture; catalog-uat then GREEN.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- ATTR-02 and the update half of SCOPE-01 are closed; this is the LAST plan of the serialized single-wave Phase 47. All four plugin ops (install/uninstall/reinstall/update) now converge on the `info` model for the marketplace-existence / scope precondition.
- `npm run check` exits 0 (typecheck + eslint + prettier:check + full node:test, 1489 tests). The serialized wave closes GREEN.
- Phase 48 (marketplace-op attribution) and Phase 49 (cross-op convergence proof) can build on the now-uniform `MarketplaceNotAddedSignal` + discriminated-resolver pattern across the plugin orchestrators.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- FOUND (modified)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- FOUND (modified)
- `tests/orchestrators/plugin/shared.test.ts` -- FOUND (modified)
- `tests/orchestrators/plugin/update.test.ts` -- FOUND (modified)
- `tests/edge/handlers/plugin/update.test.ts` -- FOUND (modified)
- `docs/output-catalog.md` -- FOUND (modified; `git diff --stat` = 20 insertions, non-empty)
- `tests/architecture/catalog-uat.test.ts` -- FOUND (modified)
- grep `throw new MarketplaceNotFoundError` in shared.ts -- NONE (correct)
- grep `kind: "marketplace-not-added"` in update.ts -- present (line ~379)
- preflightUpdate `mp === undefined` branch -- non-throwing `skipped` outcome, no notify (cascade contract preserved)
- `npm run check` -- exit 0 (1489/1489 tests pass)

---
*Phase: 47-plugin-ops-attribution-cross-scope*
*Completed: 2026-06-07*
