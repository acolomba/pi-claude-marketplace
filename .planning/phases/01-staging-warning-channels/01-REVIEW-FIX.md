---
phase: 01-staging-warning-channels
fixed_at: 2026-10-27T00:00:00Z
review_path: .planning/phases/01-staging-warning-channels/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/01-staging-warning-channels/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (WR-01, WR-02, IN-01, IN-05, IN-07, as selected by the caller)
- Fixed: 5
- Skipped: 0
- Not in scope: IN-02, IN-03, IN-04 and IN-06 stay as they are, as the caller asked.

## Fixed Issues

### WR-01: Staging diagnostics render in outcome order, not row order, across marketplace blocks

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/orchestrators/reconcile/apply-outcomes.test.ts`
**Commit:** a6513334
**Applied fix:** Both paths now stable-sort by the marketplace block key `{ name: marketplace, scope }` with `compareByNameThenScope`, the comparator `update-cascade.ts` and `reconcile/notify.ts` use for their blocks. Inside a block, rows keep outcome order, so the stable sort gives the row order. `stagingDiagnosticsOf` now filters to the three staging outcome kinds with a type guard before it sorts, because not every `PerEntryOutcome` carries `marketplace`. The existing `stagingDiagnosticsOf` test now pins row order (project block before user block). There is a new unit case with marketplaces `zeta` then `alpha`, and a new direct-update case: a project `zeta` and a user `alpha`, where the bare update visits zeta first and the diagnostics follow the alpha-first rows. Both new cases fail without the source change.
**Status:** fixed: requires human verification (logic change)

### WR-02: `marketplace/update.messaging.ts` imports the `plugin/shared.ts` hub

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts` (new), `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `test/orchestrators/plugin/shared.test.ts`, `test/orchestrators/plugin/staging-diagnostics.test.ts` (new), `.planning/codebase/ARCHITECTURE.md`
**Commit:** 28c9304b
**Applied fix:** `StagingDiagnostic`, `surfaceStagingDiagnostics` and `surfaceDiscoveryWarnings` moved unchanged to the leaf `orchestrators/plugin/staging-diagnostics.ts`. That module imports only `shared/` modules: notification-dispatch, redact-absolute-paths and staging-warnings, plus type-only imports. Every caller imports the leaf directly, and `plugin/shared.ts` does not re-export it. Their tests, including the D-PL1-04 `@ts-expect-error` pin, moved to the paired `test/orchestrators/plugin/staging-diagnostics.test.ts`. The leaf list in the ARCHITECTURE.md marketplace-to-plugin import rule now names `staging-diagnostics.ts`. The leaf is in the same fallow `orchestrators` zone and is not a BLOCK C ledger, so no gate config changed.
**Status:** fixed

### IN-01: Comments the change made false

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`
**Commit:** 2000fed3
**Applied fix:**

- `install-outcome.ts` (WR-04 block): the comment now says that on a phase throw, `captureStagingWarnings` copies the collected warnings onto the failure capture (D-PL1-13).
- `update-swap.ts` (`prepareUpdateHandles`): the comment now says that a throw reports the prepared handles' warnings through `reportStagingWarnings`, and that the caller reports the full set on success.
- `reinstall-flow.ts` header: the self-rendering arm's reinstalled outcome leaves `discoveryWarnings` undefined, and failed outcomes carry it on both arms.
- `reinstall-flow.ts` maintenance note: the side effect is now only the data-dir rm.

**Status:** fixed

### IN-05: D-PL1-15 matches rows by `generatedName` but deletes each row's own `targetPath`

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, `test/bridges/agents/stage.test.ts`
**Commit:** 7d9d624c
**Applied fix:** Under `force`, `partitionPreviousEntries` maps each staged `generatedName` to the `targetPath` this staging writes for it. A foreign-preserved row is replaced (file removed, row dropped) only when its target equals that path. A staged-name row that points at another file goes in neither set: the commit drops the row, because the new entry takes its name, and leaves the file. A new unit case covers this with a hand-edited row whose `targetPath` is another user file inside `agents/`. It fails without the fix.

The change had a knock-on effect on the existing NFR-10 escape case. A foreign row can no longer reach the forced containment check, because a replaced foreign row always sits at a path this staging writes. So that case now uses an owned row: the file outside `agents/` carries the generated marker and passes the ownership check. That is the one kind of replaced row that can still point outside `agents/`. The case still proves the refusal. The containment check's comment says the same.
**Status:** fixed: requires human verification (logic change)

### IN-07: `materializeLatestVersion` relies on an unstated rule that a settle with no rows has no notices

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`
**Commit:** f5c4aec7
**Applied fix:** I chose to read the notices rather than add a type invariant. A type invariant would change the `UpdateDependencySettlement` producers in `dependency-settle.ts`, and this fix needs no producer change. A settle now goes through `swapAfterSettle` when it reports rows or MCP notices (`reportsChanges`). `swapAfterSettle` adds `dependencyRows` only when there are rows (`dependencyRowsMember`, NREG-01), on both its updated and failed returns. A new unit case: a settle with notices and no rows keeps its notices and has no `dependencyRows` key. It fails without the fix.
**Status:** fixed

## Verification

All checks ran in the main checkout of this worktree (`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p1-warnings-6e004c`, branch `features/plugin-lifecycle-p1`). No nested review-fix worktree was created.

Per fix: typecheck, ESLint on the touched files, `npm run test:coverage:direct -- <source>` for each touched source (all exit 0), `npm run fallow` for WR-02 and IN-07, and the commit hook's `check:commit`.

After all fixes: `npm run check` exited 0. That run included 912 cucumber scenarios, all passed.

## Open item

WR-01 changes the order of user-visible diagnostics. AGENTS.md asks for a cucumber scenario under `features/` for a user-visible `/claude:plugin` change. As the caller asked, this fix adds unit coverage only: a direct-update case and an `apply` projection case. Decide whether to add a two-marketplace ordering scenario to `features/plugin/staging-warnings.feature`.

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
