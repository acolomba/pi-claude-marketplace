---
phase: 47-plugin-ops-attribution-cross-scope
plan: 02
subsystem: api
tags: [discriminated-union, error-attribution, cross-scope, reinstall, notify, typebox]

# Dependency graph
requires:
  - phase: 47-01-plugin-ops-attribution-cross-scope
    provides: "resolveCrossScopePluginTarget discriminated cross-scope resolver in plugin/shared.ts; install+uninstall missing-marketplace-not-added catalog states + fixtures; MarketplaceNotAddedMessage standalone-emission precedent"
  - phase: 46-type-model-foundations
    provides: "MarketplaceNotAddedMessage variant, renderMarketplaceNotAdded, isInfoKind standalone dispatch, ContentReason (REASONS minus 'not added')"
provides:
  - "reinstall marketplace-existence precondition re-attributed to standalone (failed) {not added}, form-independent across explicit-scope-plugin / explicit-scope-marketplace / bare forms (ATTR-03)"
  - "reinstall narrowReason last-resort fallback returns truthful 'unreadable' instead of lying 'not in manifest' (ATTR-09 reinstall half)"
  - "explicit-scope reinstall of an other-scope-only target reports it via the [requestedScope] {not added} bracket (SCOPE-01 reinstall half)"
  - "reinstall catalog states missing-marketplace-not-added (bracketed) + missing-marketplace-not-added-absent-from-both (no bracket) with paired catalog-uat FIXTURES"
affects: [47-03-plugin-ops-attribution-cross-scope, 49-cross-op-convergence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural marketplace-absent signal (typed MarketplaceNotAddedSignal Error subclass) caught at the orchestrator enumeration boundary and re-attributed to a standalone top-level MarketplaceNotAddedMessage (D-47-A) -- replaces synthesized phantom targets and raw MarketplaceNotFoundError/Error throws"
    - "Reuse of the Plan 47-01 resolveCrossScopePluginTarget discriminated resolver for the reinstall plugin form: resolved-against-container preserves the legitimate (skipped) {not installed} silent-converge (Pitfall 4); marketplace-absent/other-scope -> {not added}"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts"
    - "tests/orchestrators/plugin/reinstall.test.ts"
    - "tests/edge/handlers/plugin/reinstall.test.ts"
    - "docs/output-catalog.md"
    - "tests/architecture/catalog-uat.test.ts"

key-decisions:
  - "Chose plan option (b): a typed MarketplaceNotAddedSignal raised by the enumerator and caught at the reinstallPlugins enumeration boundary, converted to the standalone {not added} variant -- lowest churn because reinstallPlugins already wraps enumeration in try/catch"
  - "Reused resolveCrossScopePluginTarget for BOTH the explicit-scope AND bare plugin forms (not just explicit) so the bare-plugin scope resolution distinguishes container-present/row-absent (-> resolved, keeps {not installed}) from container-absent (-> {not added}); replaces the old resolveReinstallScope plugin-presence read"
  - "Left reasonsFromTypedError's MarketplaceNotFoundError -> ['not found'] mapping in place (defensive): the mp-existence case no longer reaches it (resolveScopeFromState's throw is caught and re-attributed to the no-bracket signal inside resolveMarketplaceReinstallScope), but no live non-mp-existence caller was removed"
  - "narrowReason last-resort fallback -> 'unreadable' (ContentReason member); recognized 'not in manifest' / 'not found in cached manifest' branches kept intact (legitimate plugin-not-in-manifest case stays {not in manifest})"

patterns-established:
  - "Pattern: orchestrator-boundary structural-signal -> standalone notify -- a precondition miss (marketplace-absent) is raised as a typed signal and re-attributed to a top-level message BEFORE any cascade row, never embedded as a plugins[] row"

requirements-completed: [ATTR-03, ATTR-09, SCOPE-01]

# Metrics
duration: ~25min
completed: 2026-06-07
---

# Phase 47 Plan 02: Reinstall Attribution & Cross-Scope Summary

**Reinstall's marketplace-existence/scope precondition now emits one standalone `(failed) {not added}` consistently across the explicit-scope-plugin, explicit-scope-marketplace, and bare forms (ATTR-03), with a truthful `unreadable` cascade last-resort (ATTR-09) and the `[requestedScope]` cross-scope bracket (SCOPE-01).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-07
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **ATTR-03 form-independence:** `enumerateMarketplaceReinstallTargets` now signals marketplace-absence STRUCTURALLY via a typed `MarketplaceNotAddedSignal` instead of (a) synthesizing a phantom target for the explicit-scope-plugin form (-> `(skipped) {not installed}`, old M6/M7) and (b) throwing a raw `MarketplaceNotFoundError`/`Error` for the explicit-scope-marketplace and bare forms (-> synthetic `(reinstall)` `{not found}` row, old M7/M8). The `reinstallPlugins` enumeration catch detects the signal via `instanceof` and emits ONE standalone top-level `MarketplaceNotAddedMessage`, returning `[]` BEFORE the cascade. No raw `MarketplaceNotFoundError`/`Error` escapes the orchestrator for the mp-existence case.
- **SCOPE-01 (reinstall half):** the explicit-scope plugin form reuses the Plan 47-01 `resolveCrossScopePluginTarget` resolver, so an other-scope-only target yields the `marketplace-absent`/`other-scope` arm and the signal carries the REQUESTED scope -> renders `⊘ <mp> [project] (failed) {not added}`.
- **ATTR-09 (reinstall half):** `narrowReason`'s permissive last-resort returns `unreadable` (a truthful "could not reconcile this row" `ContentReason`) instead of the former lying `not in manifest`. `reasonsFromTypedError` (the primary EACCES/EPERM/ENOENT/typed classifier) is untouched; the recognized-note branches (`not installed`, `not in manifest`, `not found in cached manifest`) are intact, so the legitimate plugin-not-in-manifest case still reads `{not in manifest}`.
- **Pitfall 4 preserved:** the legitimate "marketplace present, plugin not installed" case (container present, plugin row absent) resolves against the container's scope (`resolveCrossScopePluginTarget` -> `resolved`) so `runLockedReinstall`'s `oldRecord === undefined` branch keeps its `(skipped) {not installed}` outcome (GAP-14 green).
- **Byte gate:** two reinstall catalog states added (`missing-marketplace-not-added` bracketed + `missing-marketplace-not-added-absent-from-both` no-bracket), each paired with a catalog-uat FIXTURES entry. `git diff --stat docs/output-catalog.md` non-empty (+20). catalog-uat byte-equality + parser-coverage GREEN.

## Task Commits

Commits owned by the orchestrator (this plan lands as one GREEN commit). Per-task commit hashes: **committed by orchestrator**.

1. **Task 1: reinstall structural marketplace-absent signal + standalone {not added} across all three forms (ATTR-03, SCOPE-01)** -- committed by orchestrator
2. **Task 2: tighten reinstall narrowReason fallback to a truthful reason (ATTR-09)** -- committed by orchestrator
3. **Task 3: reinstall catalog state(s) + catalog-uat fixtures (byte gate)** -- committed by orchestrator

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- Added the typed `MarketplaceNotAddedSignal`; rewrote `enumerateMarketplaceReinstallTargets` to probe existence via the new `resolveMarketplaceReinstallScope` helper (reuses `resolveCrossScopePluginTarget` for the plugin form, direct container check for the explicit-scope-marketplace form, `resolveScopeFromState` for the bare form with `MarketplaceNotFoundError` -> no-bracket signal re-attribution); removed the dead `resolveReinstallScope` + `resolveInstalledPluginTarget` import; extracted the enumeration-failure catch into `handleEnumerationFailure` (signal -> standalone `{not added}`; otherwise the legacy synthetic row) to stay under the cognitive-complexity ceiling; changed `narrowReason`'s last-resort fallback `not in manifest` -> `unreadable` and updated the stale docstrings.
- `tests/orchestrators/plugin/reinstall.test.ts` -- Re-attributed the explicit-scope-plugin and explicit-scope-marketplace cases to assert `⊘ <mp> [project] (failed) {not added}`/error; added a bare-absent-from-both case asserting the no-bracket `{not added}`; retargeted GAP-18; updated two `outcomeToPluginMessage` opaque-fallback tests to assert `unreadable`; kept the recognized `{not in manifest}` (GAP-02) and the `{not installed}` (GAP-14) assertions intact.
- `tests/edge/handlers/plugin/reinstall.test.ts` -- Amended the three shim tests that exercise the marketplace-absent path through the edge layer to assert the new `{not added}`/error byte form (was `{not found}`/`{not installed}`/warning).
- `docs/output-catalog.md` -- Added the reinstall `missing-marketplace-not-added` (bracketed, ATTR-03/SCOPE-01) and `missing-marketplace-not-added-absent-from-both` (no-bracket, ATTR-03) catalog states with prose.
- `tests/architecture/catalog-uat.test.ts` -- Added the two paired FIXTURES entries under the `/claude:plugin reinstall` section key (info template shape: `piWithBothLoaded()`, `expectedSeverity: "error"`, `message: { kind: "marketplace-not-added", name, [scope] } satisfies NotificationMessage`).

## Decisions Made

See `key-decisions` frontmatter. The load-bearing choices: structural signal over discriminated enumeration-result (lower churn); resolver reuse for both plugin forms (preserves Pitfall 4); `reasonsFromTypedError`'s `MarketplaceNotFoundError` mapping left in place defensively (now unreachable for the mp-existence case but no live caller removed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted `handleEnumerationFailure` to satisfy the sonarjs cognitive-complexity ceiling**
- **Found during:** Task 1 (final `npm run check` gate)
- **Issue:** Adding the `if (err instanceof MarketplaceNotAddedSignal)` branch to the `reinstallPlugins` enumeration catch raised its cognitive complexity from 15 to 16, failing the `sonarjs/cognitive-complexity` ESLint rule (a `npm run check` blocker).
- **Fix:** Extracted the entire enumeration-failure catch body into a dedicated `handleEnumerationFailure(opts, err)` helper (two arms: signal -> standalone `{not added}`; otherwise the legacy synthetic `(reinstall)` row). Behavior unchanged; complexity restored under the ceiling.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
- **Verification:** `npm run check` exits 0 (eslint clean).

**2. [Rule 1 - Bug] Amended edge-handler shim tests that asserted the pre-ATTR-03 byte forms**
- **Found during:** Task 3 (final `npm run check` gate)
- **Issue:** Three `tests/edge/handlers/plugin/reinstall.test.ts` shim tests exercise the marketplace-absent path through the edge layer and asserted the OLD `/not found/`, `(skipped) {not installed}`, and `warning`-severity outputs -- now incorrect after the ATTR-03 re-attribution. These were outside the plan's `files_modified` list but are direct, in-scope consequences of the Task 1 behavior change (the edge handler delegates to `reinstallPlugins`).
- **Fix:** Updated each to assert the standalone `{not added}` byte form (no-bracket for the two bare forms, `[project]` bracket for the explicit-scope form) and `error` severity.
- **Files modified:** tests/edge/handlers/plugin/reinstall.test.ts
- **Verification:** `node --test` for the edge reinstall suite passes; full `npm run check` GREEN.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary to land the plan GREEN. No scope creep -- both are direct mechanical consequences of the ATTR-03 re-attribution (the edge test amendments verify the same behavior change from the handler entrypoint; the helper extraction is a pure refactor).

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 47-03 (update/reinstall remaining sites) can proceed: it re-touches `shared.ts` resolvers / `notify.ts` reasons / the catalog but the reinstall states added here are disjoint from update's.
- The `resolveInstalledPluginTarget` / `resolveInstalledMarketplaceTarget` legacy resolvers in `shared.ts` remain (update still consumes them; 47-03 migrates). Reinstall no longer imports `resolveInstalledPluginTarget`.

## Self-Check: PASSED

- `npm run check` exits 0 (typecheck + eslint + prettier:check + 1483 tests pass, 0 fail).
- `git diff --stat docs/output-catalog.md` non-empty (+20); both new reinstall `missing-marketplace-not-added` states present in the diff.
- No `git commit` / `git add` performed; STATE.md / ROADMAP.md untouched by this plan; `resolveInstallMarketplaceSource` (CMP-3) untouched; no new REASONS member; no `--no-verify`.

---
*Phase: 47-plugin-ops-attribution-cross-scope*
*Completed: 2026-06-07*
