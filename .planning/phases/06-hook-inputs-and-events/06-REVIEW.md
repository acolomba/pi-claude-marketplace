---
phase: 06-hook-inputs-and-events
iteration: 2
reviewed: 2026-11-15T00:00:00Z
depth: standard
diff_base: efdec879
diff_head: 4a4f3a82
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  - docs/hooks-compatibility.md
  - features/hook/mcp-tool-names.feature
  - test/architecture/hooks-lifecycle.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/index.test.ts
  - test/bridges/hooks/mcp-server-table.test.ts
  - test/index.test.ts
  - test/integration/hooks-additionalcontext-end-to-end.test.ts
  - test/integration/hooks-cross-scope-reconcile.test.ts
  - test/integration/hooks-dispatch-end-to-end.test.ts
  - test/integration/hooks-spawn-end-to-end.test.ts
  - test/orchestrators/mcp/recorded-servers.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 6: Code Review Report (iteration 2)

**Reviewed:** 2026-11-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16 (the changes of cf060a19, 4120ffa0, ca48cac1, aa4b5b6e; `git diff efdec879..4a4f3a82 -- extensions features test docs`)
**Status:** issues_found (Info only)

## Iteration 1 status

- WR-01 (table not refreshed after the load's autoapply): resolved. `refreshMcpServers` runs after `loadReconcile` in `prepareResources` (`index.ts:207-211`) in its own try/catch.
- WR-02 (legacy records never get `mcp_server`): resolved. The table reads through the injected `recordedMcpServerNames` (`index.ts:113-117`), so containment (UF-1) and re-resolution (MREC-02) apply.
- WR-03 (follow-up expansion context dropped): accepted as a documented Pi gap (`docs/hooks-compatibility.md:219,442`). Nothing changed in code.
- IN-01..03: out of the fix scope and not re-reviewed.

## Summary

I checked each concern from the dispatch against the code:

- **Hydration vs. the server table.** `hydrateScopeFromState` (`event-router.ts:793-815`) now sets the table after the hooks loop, behind a generation check after the async read. When the generation goes stale partway, the hooks and the servers are both skipped. The project table is still emptied first (`event-router.ts:998`), so an untrusted project, or a project state that fails to load, keeps an empty table.
- **Generation guard.** `refreshMcpServers` captures the generation once (`event-router.ts:1685-1689`). It reads both scopes, then sets both tables only if the generation is still current (`event-router.ts:1046-1066`), so a refresh never leaves one scope written and the other not. The tests prove the hydrate guard and the refresh guard (`event-router.test.ts`, "advances the generation" cases).
- **NFR-2.** The new load stage has its own try/catch and debug log (`index.ts:204-211`). The stages after it still run, and `test/index.test.ts` "still answers when the hooks' MCP server refresh fails" proves this.
- **Containment of the legacy reader.** `mcpServerEntries` passes only records of `locations.scope` (`mcp-server-table.ts:62-63`). So `owningRoot`'s scope-match check passes for every legit record, and `isPluginRootContained` runs before any stored or re-resolved read (`recorded-servers.ts:120-128`, `305-308`). Every failure of `recordedMcpServers` is caught and becomes `[]`. The read imports no git surface (BLOCK F) and writes nothing.
- **Fallow zones.** `bridges/hooks/mcp-server-table.ts` imports only `domain/` and `persistence/` (a type-only import of `locations.ts`). `event-router.ts` imports no orchestrator. The port is a structural type, and only the entry zone (`index.ts`) imports `orchestrators/mcp/recorded-servers.ts`. The `.fallowrc.json` rules allow this (`entry -> orchestrators`, `bridges-hooks -> domain|persistence|shared|platform`).

The fixes add no blocker and no warning. Two Info items follow.

## Info

### IN2-01: The server-name port says it never throws, but the factory-time hydrate does not check this

**File:** `extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts:42-75`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:809`
**Issue:** `mcpServerEntries` awaits `Promise.all` over `readNames` and does not catch. Only a doc comment on `McpServerNamesReader` says the reader never throws. Before the fix, this step was synchronous and could not throw. The other awaits in `hydrateCacheFromDisk` are guarded (the `loadState` try/catch, and `tryHydrateOnePlugin` for each plugin). This new await is not, and it runs inside the factory's `registerHooksBridge`, which `index.ts:165` awaits with no try/catch. The production reader holds the contract today, because `recordedMcpServers` catches every error and `legacyServersSourceFor` only gets listed plugins. But a later reader that throws would fail the extension load instead of naming no server.
**Fix:** In `mcpServerEntries`, treat a rejected read as no names, as the hooks loop already does for each plugin:
```ts
const names = await readNames(locations, marketplace, plugin).catch(() => [] as const);
```
You can also leave the code as is and keep the contract in the port's type doc. Today's code is correct, so this is a judgment call.

### IN2-02: The docs row names only some of the cases with no `mcp_server`, and the remedy does not fit all of them

**File:** `docs/hooks-compatibility.md:394` (`mcp_server` row)
**Issue:** The row says `mcp_server` is left out for an uncontained plugin root, or for a legacy plugin "whose files no longer give its recorded version". The legacy reader also refuses with `not-in-manifest` (the marketplace no longer lists the plugin), `unavailable` (the re-resolution is unavailable), and `root-mismatch` (`recorded-servers.ts:310-322`). For `not-in-manifest`, the remedy in the row (`/claude:plugin reinstall <plugin>`) cannot work, because reinstall resolves from the same manifest.
**Fix:** Word the case as "a plugin installed before the extension recorded its servers, whose servers the extension can no longer read from its marketplace and files". Say that reinstall applies only while the marketplace still lists the plugin.

---

_Reviewed: 2026-11-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
