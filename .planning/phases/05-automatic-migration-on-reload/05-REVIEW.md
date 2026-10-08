---
phase: 05-automatic-migration-on-reload
reviewed: 2026-10-08T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/index.ts
  - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/mcp-migration-notice.test.ts
  - tests/bridges/mcp/index.test.ts
  - tests/bridges/mcp/legacy.test.ts
  - tests/bridges/mcp/marker.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/types.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/integration/mcp-legacy-sweep.test.ts
  - tests/integration/mcp-migration.test.ts
  - tests/integration/mcp-plugin-seed.ts
  - tests/integration/mcp-tool-rules.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/git-source-probe.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/mcp-migration.test.ts
  - tests/orchestrators/reconcile/types.test.ts
  - tests/shared/notification-dispatch.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-08
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

The review covered the reload migration step (`mcp-migration.ts`), the legacy
`mcp.json` helpers (`legacy.ts`), the stage and replace changes in `stage.ts`
(leftover removal, the project-file rewrite, the multi-file byte rollback), the
D-05-08 legacy sweep in install, reinstall and update, the D-05-05 change to
tool permission rules, and the migration notice in `notification-dispatch.ts`.
The diff base was `67195e9d`.

The core write order holds: `mcp-adapter.json`, then `state.json`, then
`mcp.json`. The trigger stays until the last write. The rerun converges. A
per-owner failure stays inside its own row. NFR-2 isolation in `apply.ts` is
correct. The offline probe never clones. No blocker was found.

The four warnings are about edge behavior. A remedy line suggests a command
that cannot work. Two migration notices are sent at `info` severity even when
they carry warning-class facts. A user-scope stage writes the project file
without the project lock. The project disable-stub removal can delete a stub
that still applies to a live server.

The test suite is broad. It covers write order, fault injection for each of
the three writes, the half-done state, collisions per source, and the byte
locks for all five catalog blocks. No test-reliability defect was found.

## Warnings

### WR-01: "Source not available offline" row suggests a reinstall that cannot succeed when the manifest no longer lists the plugin

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:249-251` (with `:297-300`), `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:730-731`, `docs/output-catalog.md` (mcp-migration-left-in-place prose)
**Issue:** `resolveOffline` returns `undefined` in two cases. One is when `lookupDeclaredPlugin` reports `absent`, meaning the marketplace manifest no longer lists the plugin. The other is when `PLUGIN_ENTRY_VALIDATOR.Check` rejects the entry. `ownerAction` turns both into a `source-unreadable` row, and that row tells the user to `Run /claude:plugin reinstall <plugin>@<marketplace> to move it.` The catalog says the same thing ("a plugin the manifest no longer lists. A reinstall fetches the source and moves the entries"). That is false. Reinstall resolves from the same manifest, so it fails for an absent or invalid entry. Nothing is damped (COMPAT-01), so the user gets this warning on every reload, and the only remedy it offers cannot clear it. This breaks the project rule that a remedy must match the failure axis.
**Fix:** Split the result. Return a discriminant from `resolveOffline` (`"not-listed" | "unreadable"`). For `not-listed`, and for an invalid entry, push a separate row kind whose remedy is `/claude:plugin uninstall <plugin>@<marketplace>` or "remove it from mcp.json". Keep the reinstall remedy only for a cold clone cache or an unreadable checkout. Amend the catalog block and its byte lock to match.

### WR-02: The migration notice is `info` while its body carries warning-class lines (tool rules not enforced, credentials withheld, variables missing)

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:777-784` (`mcpMigrationSeverity`)
**Issue:** Severity escalates only for a left row, an unsupported or malformed removal, or a `leftover-removed` notice. `tool-rules-unenforced`, `credentials-blanked` and `variables-missing` lines are folded into the body (`mcpMigrationLines`), but the notification still goes out at `info`. On every other staging path, `notifyMcpConfigNotices` sends these same facts as `warning`. D-05-05 says a server with permission rules is "installed with a warning" and that this applies to "the migration alike, so a fresh install and a migrated one match". With the current code, a fresh install says `Warning:` and a migrated install of the same plugin says nothing at warning level. A `credentials-blanked` server will usually fail to authenticate, and the user hears about it only at `info`.
**Fix:** In `mcpMigrationSeverity`, also escalate when `notices` holds a `tool-rules-unenforced`, `credentials-blanked` or `variables-missing` notice. A simpler rule is any notice kind that `notifyMcpConfigNotices` renders at `warning`, except `comments-dropped`, if the operator wants that one to stay quiet. Update the `mcp-migration-moved` severity prose, because its example carries a `variables-missing` line.

### WR-03: A user-scope stage rewrites the project `mcp-adapter.json` without holding the project scope lock

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:257-280` (`projectLeftovers`) and `:625-633` (`writeStagedDocs`)
**Issue:** For a user-scope stage with legacy names, `projectLeftovers` reads the project `mcp-adapter.json`, and `writeStagedDocs` / `replacePreparedMcp` write it back. The only lock held is the user-scope `withLockedStateTransaction` (migration, install, reinstall, enable), or none at all on the update path. A project-scope install, update or uninstall in another Pi process holds only the project lock while it does its own read-modify-write of that same file. The two writers can interleave, and then one update is lost: either the project plugin's new entries or the stub removal is silently undone. The rollback in `restoreFiles` makes this worse. It restores the project file to bytes captured before the replace, so a rollback can overwrite a concurrent project-scope write. Before this phase, no user-scope operation wrote a project-scope file, so the per-scope lock model was enough.
**Fix:** Pick one of three options. (a) Take the project scope lock around the project-file read and write, acquiring user then project in a fixed order to avoid deadlock. (b) Re-read the project file right before writing, and skip the write if its bytes changed since the prepare. (c) Defer project-file stub cleanup to the project-scope migration pass, which already holds the project lock. With (c), the project pass would need the user scope's moved names. If none of these is adopted, document the race next to D-05-10.

### WR-04: The project disable stub is removed even when the old name still names a live server in the project scope

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:257-280`, `extensions/pi-claude-marketplace/bridges/mcp/legacy.ts:156-168`
**Issue:** `projectLeftovers` drops every marker-less override stub in the project `mcp-adapter.json` whose name equals one of the user-scope plugin's legacy names (`newKeys: []`). Take a user-scope legacy entry `github` while the project scope also serves a `github`, for example a project-scope legacy entry of another plugin, a project `.mcp.json` server, or a project `mcp.json` user server. A `{ "disabled": true }` stub under `github` in the project file then applies just as much to that project server. Moving the user-scope plugin deletes the stub, and the server the user turned off starts running again on the next reload. The notice line claims the stub "no longer applies", which is false in this case. D-05-10 calls the matching rule "the only guard", and here the guard does not check that the old name has actually gone away.
**Fix:** Before treating a project stub as a leftover, check whether any other source still defines the old name in full after the move. Use the same nine-source walk (`walkMcpSources`), excluding the plugin's own legacy entry. If one does, keep the stub. Add a test with a project `.mcp.json` `github` beside a user-scope legacy `github`.

## Info

### IN-01: Toggle buckets refreshed after dependency installs can strand a skipped owner for one reload with no row

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:166-194`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1249-1251`
**Issue:** The migration reads the round-1 plan. If an enabled owner is in `pluginsToDependencyDisable`, the migration skips it silently. Then `refreshTogglePlan` may drop that owner after `applyDependencyInstalls` satisfies its dependency, so the disable never runs. The owner's legacy entries stay, and no migration row explains why. The next reload moves them, so the system converges, but the notice says nothing in between. The reverse case also exists: a disabled owner can be removed with cause `disabled` and then enabled in the same reload.
**Fix:** Either document this one-reload lag next to the AMIG-04 note, or skip only for the uninstall, remove and enable buckets and let a dependency-disabled owner move, because the disable unstages from `mcp-adapter.json` anyway.

### IN-02: A notice list with no rows is dropped silently

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:809-812`
**Issue:** `notifyMcpMigration` returns when `rows` is empty, even if `notices` is not. This can happen when a stage committed and wrote `mcp-adapter.json` (leftover removal, or a `comments-dropped` notice) but the later removal found nothing, for example after an unlocked hand edit of `mcp.json` between the reads. In that case a file the step rewrote goes unreported.
**Fix:** Return only when both `rows` and `notices` are empty, or send `notices` through `notifyMcpConfigNotices` when there are no rows.

### IN-03: The re-read inside the lock reports an unparseable `mcp.json` as a stopped row, not a `file-unreadable` row

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:596`
**Issue:** `migrateLocked` calls `readLegacyMcpOwners` directly. If the file became invalid after the pre-lock `readOwnersOrReport`, the `McpConfigFileError` escapes to `migrateScopeIsolated` and becomes a generic `stopped` row, where the D-05-19 `file-unreadable` row was expected.
**Fix:** Reuse `readOwnersOrReport(input, locations)` inside `migrateLocked` and return when it gives `undefined`.

### IN-04: `commitPreparedMcp` does not undo the scope-file write when the project-file write fails

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:642-649`
**Issue:** The migration uses `commitPreparedMcp`, which passes a throwaway `written` array. If the scope `mcp-adapter.json` write succeeds and the project write then throws, the scope file keeps the new entries and the legacy ones stay in `mcp.json`. Both run for the session. The resulting `stopped` row says only "the next /reload tries again", not that both files hold the servers, which is what the `unfinished` row says for the same state. `replacePreparedMcp` restores in this case.
**Fix:** Restore through `restoreFiles(written)` on failure, as `replacePreparedMcp` does, or report an `unfinished`-style row when the stage threw after a write.

### IN-05: `printable` leaves Unicode line and bidi controls unescaped

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:612-621`
**Issue:** The doc comment says a file-derived name "cannot move the cursor or end a line", but only C0, DEL and C1 are escaped. U+2028 and U+2029 (line and paragraph separators) and the bidi overrides U+202A-U+202E and U+2066-U+2069 pass through. The bidi overrides can reorder how a server or plugin name from a hand-edited `mcp.json` is shown (Trojan Source style spoofing).
**Fix:** Also escape U+2028, U+2029, U+200E, U+200F, U+202A-U+202E and U+2066-U+2069, or narrow the doc comment to say what is actually escaped.

---

_Reviewed: 2026-10-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
