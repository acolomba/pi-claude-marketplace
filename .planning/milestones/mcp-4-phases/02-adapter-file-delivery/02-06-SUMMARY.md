---
phase: 02-adapter-file-delivery
plan: 06
subsystem: notifications
status: complete
tags: [notifications, jsonc-comments, uninstall, prune, marketplace-remove, unstage]

requires:
  - phase: 02-adapter-file-delivery
    provides: McpConfigNotice and notifyMcpConfigNotices (plan 02-04), McpConfigDoc.hadComments and the two-file unstage (plans 02-01 and 02-02)
provides:
  - UnstageMcpResult.notices (bridges/mcp/types.ts), filled by unstageMcpServers per rewritten commented file, mcp-adapter.json before mcp.json
  - UnstageOutcome.mcpConfigNotices? on the success and the failure outcome of cascadeUnstagePlugin
  - mcpConfigNoticesMember (orchestrators/marketplace/shared.ts), the omit-when-empty spread used by uninstall and marketplace remove
  - PrunedMember.mcpConfigNotices (required), set on removed and failed members
  - UninstallPluginOutcome mcpConfigNotices? on the uninstalled and failed arms
  - RemoveMarketplaceOutcome mcpConfigNotices? on the removed and partial arms
  - notice surfacing after the rows in standalone uninstall (with --prune), prune and marketplace remove
affects: [02-07 disable and cascade-undo routing through UnstageOutcome.mcpConfigNotices, 02-08 reconcile routing of the orchestrated uninstall and remove outcomes]

actuals:
  tokens: 9100
  tasks: 3
  commits: 1
plan_head_before: 4f87cf8472d4c64121f0077eaafae881e97b58a2
plan_head_after: 2b45d17a1310ce3d862dfabdc91ce9faf9645b6c

tech-stack:
  added: []
  patterns:
    - "The cascade primitive carries its MCP slot's notices on both arms; a verb collects every cascade's notices and calls notifyMcpConfigNotices once after its rows"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - tests/bridges/mcp/types.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/prune.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json

key-decisions:
  - "cascadeUnstagePlugin carries the MCP slot's notices on its failure outcome too, because a later slot (workflows) can fail after the MCP slot rewrote the file"
  - "Uninstall collects the primary cascade's notices first, then each pruned member's, in one hoisted list that the success arm and both failure arms report"
  - "A failed uninstall shows the notices after its failed row; the orchestrated failed outcome carries them"
  - "Marketplace remove keeps the notices of failed plugin cascades as well as successful ones"
  - "A rolled-back prune sends no notice: its rollback-partial row names each rewritten MCP file, and the recovery backup keeps the commented original"
  - "UninstallPluginOutcome.mcpConfigNotices is excepted in the unused-type-member gate until reconcile reads it (plan 02-08 drops both rows)"

patterns-established:
  - "UnstageMcpResult.notices -> UnstageOutcome.mcpConfigNotices -> verb accumulator -> notifyMcpConfigNotices after the rows"

requirements-completed: []

duration: about 55 min
completed: 2026-10-03
---

# Phase 2 Plan 06: MCP config notices for uninstall, prune and marketplace remove Summary

**The unstage reports each commented MCP config file it rewrites. `cascadeUnstagePlugin` carries that report on both arms. Uninstall (with its pruned dependencies), prune and marketplace remove show the comments-removed notice after their rows, and the orchestrated uninstall and remove return it on their outcomes.**

## Performance

- **Duration:** about 55 min, most of it the full-scope pre-commit run
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3
- **Files changed:** 14 (0 created, 14 modified)

## Accomplishments

- `bridges/mcp`: `UnstageMcpResult.notices` is required and frozen. `unstageMcpServers` adds a `comments-dropped` notice for each file it rewrites whose read bytes held comments, `mcp-adapter.json` first, then `mcp.json`. A file with no owned entry is not rewritten and gets no notice.
- `orchestrators/marketplace/shared.ts`: `UnstageOutcome.mcpConfigNotices?` is set on the success and the failure outcome, only when non-empty. `mcpConfigNoticesMember` is the shared omit-when-empty spread.
- `uninstall.ts`: one hoisted list holds the primary cascade's notices, then each pruned member's (`PrunedMember.mcpConfigNotices`, set in both arms of `removeDependencyMember`). The standalone success arm calls `notifyMcpConfigNotices` after its rows. `emitCascadeFailure` does the same after the failed row, for the TR-03 partial failure and for a throw after the cascade, such as a failed save. In orchestrated mode, the `uninstalled` and `failed` outcomes carry the list.
- `prune.ts`: after `notifyCommitted` and the committed warning, one call with the swept members' notices in member order. A dry run, an empty sweep, an unreadable declarer and a rolled-back sweep send none.
- `remove.ts`: `cascadePluginsInPlace` collects each cascade's notices, from failed cascades too. Standalone removal calls the seam after its rows on full and partial removal. The orchestrated `removed` and `partial` outcomes carry the notices.

## Notification order (exact, from the tests)

- Uninstall, commented `mcp-adapter.json`: `○ hello v0.0.1 (uninstalled) {stale workflow command}` (warning), then `MCP config comments removed.` (warning).
- `uninstall --prune`: the primary's legacy `mcp.json` and the pruned dependency's `mcp-adapter.json` are both commented. The output is the two `(uninstalled)` rows, then ONE notice with the `mcp.json` line first and the `mcp-adapter.json` line second.
- Partial uninstall: `⊘ hello v0.0.1 (failed) {permission denied}` with its cause line (error), then the notice.
- Prune: `○ orphan v1.0.0 (uninstalled) {dependency pruned}`, then the notice. A dry run shows only the preview row, and the file keeps its bytes.
- Marketplace remove: `● commented [project] (removed)` with `○ alpha (uninstalled)`, then the notice. On a partial remove, the `(failed)` block comes first, then one notice: the adapter line from alpha's real cascade and the `mcp.json` line from beta's failed cascade.

## Task Commits

All three tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-3: report dropped comments when removing plugins** - `2b45d17a` (feat)

## Verification evidence

- Task 1 (`tmp/p2-06-t1-verify.log`): uninstall suite 110 pass, 0 fail. `^AFILE-04` uninstall pass 5. unstage and types 31 pass; marketplace shared 68 pass. Direct coverage 100%: `unstage.ts` (19/19, 6/6, 118/118), `marketplace/shared.ts` (108/108, 20/20, 855/855), `uninstall.ts` (136/136, 30/30, 1435/1435). Typecheck exit 0.
- Tracer gate after Task 1: interactive mode (`auto_advance: false`), `end-of-phase` human verify, automated-only verify passed, so expansion continued.
- Task 2 (`tmp/p2-06-t2-verify.log`): prune suite 33 pass; `^AFILE-04` pass 3; direct coverage `prune.ts` 72/72, 19/19, 352/352.
- Task 3 (`tmp/p2-06-t3-verify.log`): remove suite 32 pass; `^AFILE-04` pass 4; direct coverage `remove.ts` 105/105, 25/25, 910/910.
- `npm run lint:type-members` exit 0 with 7 recorded exceptions (`tmp/p2-06-typemembers.log`). ESLint over the 12 changed `.ts` files: 0 errors. The 3 warnings are pre-existing unused `no-await-in-loop` directives on untouched lines. `npm run fallow` exit 0.
- `fallow audit`: verdict `warn`, 0 complexity findings, 0 dead-code issues; the only introduced clone groups are the pre-existing `tests/architecture/catalog-uat/fixtures/plugin-info.ts` ones.
- `rg "D-02-" extensions tests` counts 11 lines, the baseline.
- Pre-commit over the 14 code paths plus this SUMMARY, STATE.md and ROADMAP.md: `PRECOMMIT_EXIT=0` (`tmp/p2-06-precommit.log`). The contracts.json and exceptions.json edits select the full `npm changed checks` scope, which passed. No hook rewrote a file.
- focused task verification passed; full phase/PR verification pending.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged; `id` and its `refines`/`filter` together):

- `orchestrators/marketplace/remove.ts` `:701:38`, `:701:55` (refines `:701:9`) -> `:732`
- `orchestrators/plugin/uninstall.ts` `:1371:38`, `:1371:55` (refines `:1371:11`) -> `:1410`
- `orchestrators/plugin/uninstall.ts` `:1382:38`, `:1382:55` (refines `:1382:11`) -> `:1421`
- `orchestrators/plugin/uninstall.ts` `:244:67` (filter `:244:28`) -> `:261`

`scripts/check-unused-type-members.exceptions.json` gains two rows, `uninstall.ts:156:7` and `uninstall.ts:164:7` (`UninstallPluginOutcome.mcpConfigNotices`, the `uninstalled` and `failed` arms). Its only orchestrated production caller, `reconcile/apply.ts applyOnePluginUninstall`, routes the notices in plan 02-08, which must drop both rows. The gate refuses a row that matches no finding.

## Decisions Made

See `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Factual] A rolled-back prune does not restore the MCP file bytes**

- **Found during:** Task 2
- **Issue:** the plan says a rolled-back sweep restores the snapshot bytes. `prune-rollback.ts restoreMetadata` never overwrites a metadata file that changed. It reports `[mcp adapter] (rollback failed)` with `occupied metadata path` and keeps the original in `prune-backup-*/` for a manual merge.
- **Fix:** the no-notice behavior stays, because the rollback-partial error row already names the file and the backup keeps the commented original. The comment in `prune.ts` states that. The test `AFILE-04: a rolled-back prune keeps the commented original in its backup and sends no notice` asserts the whole error row and the backup bytes.
- **Files modified:** `prune.ts`, `prune.test.ts`

**2. [Rule 2 - Missing critical functionality] Failure-path notices on uninstall and remove**

- **Found during:** Tasks 1 and 3
- **Issue:** a failed cascade, or a failed save after the cascade, can still have rewritten the MCP file. The prohibition forbids a silent comment loss.
- **Fix:** `emitCascadeFailure` reports the collected notices after the failed row (both call sites). `cascadePluginsInPlace` keeps a failed cascade's notices. Each has a standalone case and an orchestrated case.
- **Files modified:** `uninstall.ts`, `remove.ts`

**3. [Rule 3 - Blocking] Unused-type-member exceptions for the orchestrated uninstall outcome**

- **Found during:** Task 3 (`lint:type-members`)
- **Fix:** two recorded exceptions citing AFILE-04 / D-02-09 and plan 02-08 (see above).
- **Files modified:** `scripts/check-unused-type-members.exceptions.json` (not in `files_modified`)

**4. [Reuse] `mcpConfigNoticesMember` is exported from marketplace/shared.ts**

- uninstall.ts and remove.ts both need the omit-when-empty spread. Both may import marketplace/shared.ts (D-11), so the helper sits beside `UnstageOutcome`. install-flow.ts keeps its own private copy; this plan does not touch that file.

**5. [Test helper] `notificationBoundary` in remove.test.ts takes a notice count**

- The strict boundary expected exactly one `ctx.ui` read and one `notify`. The new optional `noticeCalls` adds one of each per notice notification, with no soft-dependency probe.

### Known limitation (not fixed, outside scope)

- A thrown `withLockedStateTransaction` in marketplace remove (for example a failed save after the cascades) propagates out of `removeMarketplace` before any row. The notices collected up to that point go with it. That throw path renders no row of its own today. Plan 02-08's reconcile routing, or a later review, owns it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 9100 (chars/4 over the added lines of the code diff from `4f87cf84`: 36526 chars) against the 115000 estimate (8%). Tasks 3 of 3. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plan 02-07 routes `UnstageOutcome.mcpConfigNotices` for `disable` and the install/enable cascade undos. Plan 02-08 reads `UninstallPluginOutcome.mcpConfigNotices` and `RemoveMarketplaceOutcome.mcpConfigNotices` in `reconcile/apply.ts`, drops the two new exception rows, and completes AFILE-04.

## Self-Check: PASSED

- All 14 modified paths are in code commit `2b45d17a` on `features/mcp-4`; `git rev-list --count 4f87cf84..2b45d17a` is 1.
- `rg "mcpResult\.notices"` hits marketplace/shared.ts; `rg "notifyMcpConfigNotices\("` hits uninstall.ts (2), prune.ts (1) and remove.ts (2).
