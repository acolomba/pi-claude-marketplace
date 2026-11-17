---
phase: 06-hook-inputs-and-events
fixed_at: 2026-11-15T00:00:00Z
review_path: .planning/phases/06-hook-inputs-and-events/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-11-15T00:00:00Z
**Source review:** .planning/phases/06-hook-inputs-and-events/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (WR-01, WR-02, WR-03; fix_scope `critical_warning`, IN-01..03 left in REVIEW.md)
- Fixed: 3 (WR-01 and WR-02 in code, WR-03 documented as a Pi gap)
- Skipped: 0

WR-02 was applied before WR-01 because the WR-01 refresh reuses the reader that WR-02 injects.

## Fixed Issues

### WR-02: Records without `mcpServerConfigs` never get `mcp_server`

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`, `extensions/pi-claude-marketplace/index.ts`, `features/hook/mcp-tool-names.feature`, `docs/hooks-compatibility.md`, plus the tests of those pairs and the hydration readers in `test/bridges/hooks/{event-router,index}.test.ts`, `test/architecture/hooks-lifecycle.test.ts`, `test/index.test.ts`, `test/integration/hooks-{additionalcontext,dispatch,spawn}-end-to-end.test.ts`, `test/integration/hooks-cross-scope-reconcile.test.ts`
**Commits:** cf060a19 (code), ca48cac1 (docs)
**Applied fix:** `HooksHydrationDeps` gained a required `readMcpServerNames` port (`McpServerNamesReader`). `mcpServerEntries` is async and asks the port for each enabled record of the scope. `index.ts` injects the new `recordedMcpServerNames` (`orchestrators/mcp/recorded-servers.ts`), which goes through `recordedMcpServers` and `readLegacyServers`. A legacy record is re-resolved, and an uncontained record names no server (UF-1, NFR-10). The bridges zone imports no orchestrator. The server table is now set after the plugin hooks hydrate, behind a generation check. The `mcp_server` docs row names the plugins whose servers cannot be read and the `reinstall` remedy.
**Status:** fixed: requires human verification. An uncontained record that has stored servers no longer gets `mcp_server`. Before this change it got the field.

### WR-01: `mcp_server` table is not refreshed after the load's autoapply

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/index.ts`, `features/hook/mcp-tool-names.feature`, `test/bridges/hooks/event-router.test.ts`, `test/index.test.ts`
**Commit:** 4120ffa0
**Applied fix:** `HooksHydration.refreshMcpServers(cwd, projectTrusted)` re-reads both scopes' state and replaces each server table. An untrusted project, and a state that fails to load, name no server. A stale generation changes nothing. `prepareResources` runs it as its own stage after `loadReconcile`, in a try/catch (NFR-2). It writes no state and reaches no network. The NFR-2 cwd-read ordinals in `test/index.test.ts` moved, because the stage reads `event.cwd` once.
**Status:** fixed: requires human verification (a new load stage).

### WR-03: A queued follow-up expansion's `additionalContext` is dropped

**Files modified:** `docs/hooks-compatibility.md`
**Commit:** aa4b5b6e
**Applied fix:** Documented, not fixed in code. Sending the context at once, as a steer does, would put it on the next model call of the running task, before the follow-up. That changes where the context lands, and it is not a small, safe change. The UserPromptExpansion section now lists the loss as a Pi gap. The Additional context paragraph says that a follow-up always loses its `UserPromptExpansion` and `UserPromptSubmit` context.
**Status:** fixed (documented gap)

## Verification

All checks ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` (`workflow.use_worktrees` is on, but the dispatch rules forbid worktrees), so the results can be reproduced from this tree.

- Owner tests passed: `test/bridges/hooks/{mcp-server-table,event-router,index}.test.ts`, `test/orchestrators/mcp/recorded-servers.test.ts`, `test/index.test.ts`, `test/architecture/hooks-lifecycle.test.ts`, and the 4 hooks integration files (10 tests).
- Direct coverage is 100% for `event-router.ts`, `mcp-server-table.ts`, `recorded-servers.ts`, and `index.ts`. The commit hook's `check:commit` passed on both code commits.
- Red/green: new guard tests went red without the guard. The scenario "...plugin that an earlier release installed..." (@mcp) was red under both profiles with a stored-only reader, and green after the fix. The scenario "...plugin that autoapply installs during the load... (D-PG6-07, D-MB-10)" (@builtin-only) was red without the refresh, and green after it.
- Regression runs: `features/hook/mcp-tool-names.feature` and `features/mcp-server/implementation-switch.feature` passed under adapter (13) and builtin (8). `features/plugin/autoapply.feature` passed under adapter (35), and the lifecycle autoapply scenario passed under builtin. `npm run check:features` passed.

---

_Fixed: 2026-11-15T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
