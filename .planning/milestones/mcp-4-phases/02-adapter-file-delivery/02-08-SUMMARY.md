---
phase: 02-adapter-file-delivery
plan: 08
subsystem: notifications
status: complete
tags: [notifications, jsonc-comments, reconcile, import, marketplace-update, cascades]
requires:
  - phase: 02-adapter-file-delivery
    provides: McpConfigNotice and notifyMcpConfigNotices (plan 02-04); mcpConfigNotices on the update, failed-update and render-none reinstall outcomes (plan 02-05); on the uninstall and marketplace-remove outcomes (plan 02-06); on the enable/disable outcome (plan 02-07)
provides:
  - OutcomeBase.mcpConfigNotices? (reconcile/apply-outcomes.ts), set only when non-empty
  - carriedMcpConfigNotices (reconcile/apply-outcomes.ts), the omit-when-absent lift from an orchestrated outcome onto a reconcile outcome
  - surfaceMcpConfigNotices (reconcile/apply.ts, private), one seam call after surfacePostCommitWarnings
  - MutableImportResult.mcpConfigNotices (import/execute.ts, module-private), shown after surfaceImportDiagnostics and left off the returned result
  - the marketplace update autoupdate cascade's notice call after its cascade rows
affects: [phase gate (npm run check, npm run test:e2e), AFILE-04 complete]
actuals:
  tokens: 7200
  tasks: 3
  commits: 1
plan_head_before: 82e598e90724b8292015c400935812afb7e86ddc
plan_head_after: 90a123873a397604339bf56aceff72d6de2eea3a
tech-stack:
  added: []
  patterns:
    - "A cascade owner gathers every orchestrated outcome's mcpConfigNotices and calls notifyMcpConfigNotices once, after its cascade row and its other post-cascade diagnostics"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/orchestrators/reconcile/apply-outcomes.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json
key-decisions:
  - "Reconcile notices ride the outcome rows (OutcomeBase.mcpConfigNotices), and one private surfaceMcpConfigNotices gathers them in outcome order after surfacePostCommitWarnings; the empty-reconcile return stays first, so RECON-05 silence holds"
  - "carriedMcpConfigNotices lives beside dependenciesFromInstall in apply-outcomes.ts because apply.ts and backfill.ts both lift notices; one helper keeps each push site branch-free"
  - "Failure rows carry notices too (failed install, failed dependency install, failed uninstall, failed toggle, failed dependency disable), because the rewrite already happened"
  - "Marketplace removal notices ride the mp-removed and mp-remove-partial header rows; dependency-install notices ride the root member's row, like postCommitWarnings"
  - "Import keeps the notice list on the module-private MutableImportResult and strips it from the returned ClaudeImportExecutionResult; the edge has no reader for it, and a public member nothing reads would trip the unused-type-member gate"
  - "The marketplace update cascade reads notices from updated and failed outcomes; the no-op and manifest-only paths send none"
  - "AFILE-04 marked complete: every rewrite path in the phase now routes the notice"
patterns-established:
  - "orchestrated outcome.mcpConfigNotices -> cascade-owner accumulator -> notifyMcpConfigNotices after the cascade"
requirements-completed: [AFILE-04]
coverage:
  - id: D1
    description: "A reload install over a commented mcp-adapter.json shows the applied cascade, then the exact comments-removed notice at warning severity; a reload with nothing to apply stays silent and leaves the file's bytes alone"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#AFILE-04: a reload install over a commented mcp-adapter.json shows the comments-removed notice after the cascade"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#AFILE-04: a reload with nothing to apply stays silent and leaves the commented mcp-adapter.json unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uninstall, enable, disable, load-time dependency disable, marketplace removal and reload dependency install each show the cascade, then the notice; two buckets rewriting one file give one notice"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#AFILE-04"
        status: pass
    human_judgment: false
  - id: D3
    description: "A load-time backfill whose re-materialize rewrites a commented mcp-adapter.json pushes a plugin-backfilled outcome carrying the notice"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/backfill.test.ts#AFILE-04: a promotion that rewrites a commented mcp-adapter.json carries the comments-removed notice"
        status: pass
    human_judgment: false
  - id: D4
    description: "Import shows its cascade, its diagnostics, then one notice that joins the installed and failed installs' notices and collapses the repeated file"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/import/execute.test.ts#AFILE-04: import over a commented mcp-adapter.json shows the comments-removed notice after its cascade"
        status: pass
    human_judgment: false
  - id: D5
    description: "A marketplace update whose autoupdate cascade reports rewrites shows its cascade, then the notice; a no-op update sends none and leaves the file's bytes alone"
    requirement: AFILE-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/marketplace/update.test.ts#AFILE-04"
        status: pass
    human_judgment: false
duration: about 30 min of editing and focused checks, plus the full-scope pre-commit run
completed: 2026-10-03
---

# Phase 2 Plan 08: MCP config notices for reload, import and marketplace update Summary

**The `/reload` reconcile, `/claude:plugin import` and the `marketplace update` autoupdate cascade now show the comments-removed notice after their cascades. Every reconcile bucket that can rewrite `mcp-adapter.json`, and the load-time backfill, feeds it. All four temporary unused-type-member exceptions are gone, and AFILE-04 is complete.**

## Performance

- **Duration:** about 30 min of editing and focused checks, plus the full-scope pre-commit run
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 12 (all modified)

## Accomplishments

- `reconcile/apply-outcomes.ts`: `OutcomeBase.mcpConfigNotices?`, so every marketplace and plugin outcome can carry notices; `InvalidBlockOutcome` and `SourceMismatchOutcome` do not extend it. `carriedMcpConfigNotices(carrier)` returns `{ mcpConfigNotices }` or `{}`.
- `reconcile/apply.ts`: each bucket spreads the orchestrated outcome's notices onto the row it pushes:
  - `foldRemoveOutcome`: the `mp-removed` and `mp-remove-partial` headers.
  - `applyOnePluginUninstall`: the uninstalled and failed rows.
  - `applyPluginInstalls`: installed, landed-disabled and failed.
  - `applyDependencyInstalls`: the root member's row and the failed row.
  - `applyPluginToggles`: success and failed rows, wrapped around `buildSuccess`/`buildFailed`.
  - `applyDependencyDisables`: the dependency-disabled row and the failed row.

  `surfaceMcpConfigNotices` makes one `notifyMcpConfigNotices` call over all outcomes, after `surfacePostCommitWarnings`.
- `reconcile/backfill.ts`: the `plugin-backfilled` outcome carries the reinstall result's notices.
- `import/execute.ts`: `installOnePlannedPlugin` appends each install outcome's notices, from both arms. `importClaudeSettings` calls the seam after `surfaceImportDiagnostics` and returns the result without the list.
- `marketplace/update.ts`: after the cascade-rows `notifyWithContext`, one seam call over the `updated` and `failed` outcomes' notices.

## Notification order (exact, from the tests)

- Reload install: `● mp [project]` / `● hello (installed) {requires pi-mcp-adapter}` / `Reconcile: 1 success`, then `MCP config comments removed.` (warning).
- Reload uninstall, disable, dependency disable and marketplace removal: the cascade, then the notice. The adapter file ends as `{"mcpServers": {}}`, pretty-printed.
- Two buckets in one reload (uninstall `alfa`, install `bravo`): one cascade with both rows, then one notice.
- Empty reload over a commented file: zero notifications; the file keeps its bytes.
- Import: the failed cascade (error), then `1 import diagnostic surfaced.` (warning), then one notice listing `mcp-adapter.json` once and `mcp.json` once.
- Marketplace update: the `(updated)` cascade with `alpha` updated and `beta` failed (error), then one notice with both files.

## Task Commits

All three tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-3: report dropped comments from reload, import and updates** - `90a12387` (feat)

## Verification evidence

- Owner suites (`tmp/p2-08-verify.log`, `SUITES_EXIT=0`): apply-outcomes, apply, backfill, import execute, marketplace update, 312 pass, 0 fail.
- Pattern runs: `^AFILE-04` over apply, import execute and marketplace update, pass 12 (`PATTERN_EXIT=0`). The backfill `AFILE-04` case passes.
- Mutation check: with the `surfaceMcpConfigNotices` call removed, 8 of the 9 apply `AFILE-04` cases fail. The ninth is the silent-reload case, which passes either way by design.
- Direct coverage (`tmp/p2-08-verify.log`, `COVERAGE_EXIT=0`): `apply.ts` branches 188/188, functions 41/41, lines 1537/1537. `apply-outcomes.ts` 44/44, 11/11, 694/694. `backfill.ts` 67/67, 13/13, 558/558. `import/execute.ts` 191/191, 40/40, 1510/1510. `marketplace/update.ts` 127/127, 17/17, 914/914.
- `npm run typecheck` exit 0. ESLint over the 10 changed `.ts` files: 0 errors (`tmp/p2-08-lint.log`). The 7 warnings are unused `no-await-in-loop` directives on lines this plan did not touch.
- `npm run lint:type-members` exit 0 with 4 recorded exceptions (`tmp/p2-08-typemembers.log`).
- `fallow audit --base HEAD`: verdict `pass`, 0 introduced findings.
- `rg "D-02-" extensions tests`: 11 lines, the baseline.
- Pre-commit over the 12 code paths plus this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md: `PRECOMMIT_EXIT=0` (`tmp/p2-08-precommit.log`). The contracts.json and exceptions.json edits select the full `npm changed checks` scope, which passed. No hook rewrote a file.
- focused task verification passed; full phase/PR verification pending.

## Unused-type-member exceptions

`scripts/check-unused-type-members.exceptions.json` matches its pre-phase content again: `git diff 52c4db89 -- scripts/check-unused-type-members.exceptions.json` is empty. These four rows are gone, because their members now have production readers:

- `install-flow.ts:2237:7` (`InstallMissingDependencyOutcome.mcpConfigNotices`), read by `applyDependencyInstalls`.
- `enable-disable.ts:206:3` (`McpConfigNoticesCarrier.mcpConfigNotices`), read by `applyPluginToggles` and `applyDependencyDisables`.
- `uninstall.ts:156:7` and `uninstall.ts:164:7` (`UninstallPluginOutcome.mcpConfigNotices`), read by `applyOnePluginUninstall`.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shift only (column unchanged; `id` and its `filter` together):

- `orchestrators/reconcile/apply.ts` `:840:49` (filter `:840:11`) -> `:860:49` (filter `:860:11`), owner `degradationFromEnable.result`.

## Files calling `notifyMcpConfigNotices`

`rg -ln "notifyMcpConfigNotices\(" extensions/pi-claude-marketplace/orchestrators`:

- `import/execute.ts`
- `marketplace/remove.ts`
- `marketplace/update.ts`
- `plugin/enable-disable.ts`
- `plugin/install-flow.ts`
- `plugin/prune.ts`
- `plugin/reinstall-flow.ts`
- `plugin/uninstall.ts`
- `plugin/update-flow.ts`
- `reconcile/apply.ts`

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Failure rows in every bucket carry notices**

- **Found during:** Task 2
- **Issue:** the plan names the failed rows for installs, uninstalls and toggles. The failed dependency install and the failed dependency disable can also follow a rewrite.
- **Fix:** both failed rows spread `carriedMcpConfigNotices(result)` too.
- **Files modified:** `reconcile/apply.ts`

**2. [Design] `dependencyDisabledOutcome` keeps its signature**

- The plan suggests passing the notices into `dependencyDisabledOutcome`. Spreading `carriedMcpConfigNotices(result)` at the push site gives the same row and leaves the builder alone.

**3. [Rule 3 - Blocking] Import result shape**

- **Issue:** `importClaudeSettings` returns its mutable accumulator, and the import suites compare the whole returned result. A runtime-only member would break those comparisons. A public member would have no production reader, which the unused-type-member gate rejects.
- **Fix:** `importClaudeSettings` destructures `mcpConfigNotices` off the result, sends it, and returns the rest. `ClaudeImportExecutionResult` is unchanged.
- **Files modified:** `import/execute.ts`

**4. [Test fixture] The backfill case grows the supported set through a workflow**

- MCP servers are not a `compatibility.supported` kind, so a plugin that gains only a server never triggers a backfill. The case adds a workflow script so the supported set grows; the re-materialize then restages the MCP server and rewrites the commented file. `backfill.test.ts`'s `PluginTree` gains an `mcpServer` flag.

**5. [Scope] `scripts/check-unused-type-members.exceptions.json` is edited though not in `files_modified`**

- The handoff requires the four temporary rows to go; the file now equals its pre-phase content.

## Open items

- The marketplace remove gap that plan 02-06 reported still exists. A thrown `withLockedStateTransaction` in `removeMarketplace`, such as a failed save after the cascades, propagates before any row, and the notices collected so far go with it. In a reconcile, `applyMarketplaceRemoves` catches the throw as an `mp-remove-failed` row with no notices. This plan does not change that path.
- The two-bucket reload case shows one notice whether or not the seam de-duplicates, because the first rewrite already removed the comments. The seam's `(kind, scope, file)` de-duplication is proved in this plan by the import and marketplace update cases, and by `tests/shared/notification-dispatch.test.ts`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 7200 (chars/4 over the added lines of the code diff from `82e598e9`: 28867 chars) against the 115000 estimate (6%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

This is the last plan of phase 02. The orchestrator runs the phase gate (`npm run check` and `npm run test:e2e`) on the combined tree.

## Self-Check: PASSED

- All 12 code paths are in code commit `90a12387` on `features/mcp-4`; `git rev-list --count 82e598e9..90a12387` is 1.
- `.planning/phases/02-adapter-file-delivery/02-08-SUMMARY.md` exists; `rg -n "notifyMcpConfigNotices\(" reconcile/apply.ts` prints one line.
