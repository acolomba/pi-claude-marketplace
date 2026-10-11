---
phase: 05-automatic-migration-on-reload
reviewed: 2026-10-09T16:10:20Z
depth: standard
iteration: 3
files_reviewed: 41
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
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
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
  - tests/transaction/with-state-guard.test.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
status: clean
---

# Phase 5: Code Review Report (iteration 3)

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 41
**Status:** clean (no blocker, no warning; eight advisory Info items)

## Summary

This pass re-reviewed the phase scope (diff base `67195e9d`). It focused on the
iteration-2 fix commits `7a7d9783..c65b16f8`: c26007be, 822f4809 and c65b16f8.
`npm run typecheck` is clean. These suites pass under a temporary `HOME` and
`PI_CODING_AGENT_DIR`: mcp-migration, stage, legacy, notification-dispatch,
with-state-guard, and the two architecture notice locks (534 tests). The three
MCP integration suites also pass (18 tests). Nothing touched the real
`~/.pi/agent`.

The operator-accepted decisions are not findings: the lockless project stub
write, the remedy-per-cause split that replaces D-05-02's blanket reinstall
remedy, and the D-05-08/D-05-10 narrowing of project stubs to the reload
move's user pass. The prior IN-07 (the CONTEXT record for the narrowing) is
dropped for that reason.

Status of the prior warnings:

- **WR-01 (reinstall remedy for causes a reinstall cannot clear): resolved.**
  `offlineCloneRead` (`mcp-migration.ts:259-281`) marks the clone unread only
  when the presence probe returns `not-cached` or throws. `resolveOffline`
  (`:293-322`) keeps `source-unreadable` (the reinstall row) for that case.
  It sends every other failure to the new `marketplace-unreadable` row:
  a manifest that throws on load, a resolve that throws, or an `unavailable`
  resolve that is not a clone miss. That row suggests a marketplace update or
  an uninstall (`notification-dispatch.ts:772`). A missing or unparseable
  manifest now gets the marketplace-update remedy. The catalog sentence is
  corrected and the byte lock includes the row. A git record without
  `resolvedSha` still gets the reinstall row. Git sources and `resolvedSha`
  both arrived in 0.9.0 (051914b3), so no such record exists in practice.
  Two narrow residuals on this seam are listed as IN-07 and IN-08.
- **WR-02 (panel copies kept by the live-server filter): resolved.**
  `prepareStageMcpServers` (`stage.ts:461-473`) now filters only the override
  stubs (`panelCopies: false`) through `namesWithNoLiveServer`. Panel copies
  always fall through to `leftovers`, so the two-scope project-first path and
  the cwd-dependent path both remove the copy. The filter expression
  `!stubs.includes(name) || deadStubs.includes(name)` is correct: a stub
  survives only when it is live, and a non-stub leftover always goes. The
  WR-04 stub regression test still passes, and the new panel-copy test pins
  the fix.
- **WR-03 (project-stub step took a full project state transaction):
  resolved.** `withExistingScopeLock` (`with-state-guard.ts:124-170`) is the
  lock lifecycle with no `mkdir` and no state I/O. `withScopeLock` is now
  `mkdir` plus that function, so the existing callers behave as before.
  `clearProjectStubs` (`mcp-migration.ts:633-650`) takes the lock only when
  `<cwd>/.pi/pi-claude-marketplace/` exists. Otherwise it writes the file
  without the lock, which the operator accepted. A corrupt project
  `state.json` no longer blocks the step, and the new test pins that. The
  `unfinished` row carries `file`, and the stub failure renders
  `project-scope mcp-adapter.json`. `sentenceBody`
  (`notification-dispatch.ts:756`) strips one final period, so the
  `StateLockHeldError` detail no longer renders `completes..`. No new defect
  was found on the lock seam. The lock order (user, then project) is
  unchanged, both locks are taken with `retries: 0`, and the release-error
  chaining is preserved.

No new blocker or warning was found. The Info items below are advisory.

## Info

### IN-01: Toggle buckets refreshed after dependency installs can strand a skipped owner for one reload with no row (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:184-192`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:825` (`refreshTogglePlan`), `:1250`
**Issue:** Unchanged. `plannedRemoval` skips an owner that is in round 1's `pluginsToDependencyDisable`. `refreshTogglePlan` can then drop that owner, and its legacy entries stay for one reload with no row.
**Fix:** Document the one-reload lag next to the AMIG-04 note, or skip only the uninstall, remove and enable buckets.

### IN-02: A notice list with no rows is dropped silently (carried forward)

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:868-870`
**Issue:** Unchanged. `notifyMcpMigration` returns when `rows.length === 0`, even when `notices` holds a notice for a file the step rewrote. In the current flows every notice-producing write is followed by a row, so this is latent.
**Fix:** Return only when both lists are empty, or send `notices` through `notifyMcpConfigNotices`.

### IN-03: The re-read inside the lock reports an unparseable `mcp.json` as a stopped row (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:722`
**Issue:** Unchanged. `migrateLocked` calls `readLegacyMcpOwners` directly. So an `McpConfigFileError` there, from a file changed between the unlocked read and the lock, becomes a generic scope `stopped` row instead of the D-05-19 `file-unreadable` row.
**Fix:** Reuse `readOwnersOrReport(input, locations)` inside the lock.

### IN-04: `commitPreparedMcp` passes a throwaway `written` array (carried forward, latent)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:601-609`
**Issue:** Unchanged. The function writes one file, so it cannot leave a partial state today. If a second write is ever added, the `[]` passed to `writeStagedDoc` means nothing restores the first write.
**Fix:** None needed now. Keep the function single-write, or route it through `restoreFiles` if that changes.

### IN-05: `printable` leaves Unicode line and bidi controls unescaped (carried forward)

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:639-653`
**Issue:** Unchanged. `isControlCodeUnit` covers only C0, DEL and C1. U+2028/U+2029 and the bidi overrides U+202A-U+202E and U+2066-U+2069 pass through. The doc comment says a file-derived name "cannot move the cursor or end a line".
**Fix:** Escape these code points too, or narrow the comment to C0/C1.

### IN-06: A failed stub probe stops the whole scope after the adapter and state writes (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:622-627`
**Issue:** Unchanged by c65b16f8. `projectDisableStubNames` still runs before the `try` in `clearProjectStubs`. A non-`McpConfigFileError` read error from the project adapter file or from any `walkMcpSources` source (EACCES, EISDIR) escapes `migrateLocked` after `mcp-adapter.json` and `state.json` were written. `migrateScopeIsolated` then turns it into one scope-level `stopped` row instead of per-owner `unfinished` rows. The rerun still converges.
**Fix:** Move the probe inside the `try`, so a probe failure reaches `pushRemovalFailureRow` with `file: "project-scope mcp-adapter.json"`. Or document that a probe failure stops the whole scope.

### IN-07: Two causes routed to `marketplace-unreadable` are not cleared by its first remedy

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:312-321`, `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:99-114, 203-213`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:241-252`
**Issue:** The new row says `The <mp> marketplace copy cannot give the source of <p>. Run /claude:plugin marketplace update <mp>, or /claude:plugin uninstall <p>@<mp> to remove it.` The uninstall alternative clears every cause. The marketplace update does not clear these two:
1. **A git-subdir plugin whose path moved in the manifest after the install.** The record holds sha A. A marketplace update now lists sha B and a new `path`. The probe keys on the recorded sha A (`probeShaClone`), finds the warm clone, and `anchorSubdir` returns `missing-subdir` for the new path. The resolve is `unavailable` and `cloneUnread()` is false, so the row is `marketplace-unreadable`. The marketplace copy is already current, so `marketplace update` changes nothing. A reinstall also uses sha A with the new path, so it fails the same way. `/claude:plugin update <p>@<mp>` would clear it: it moves to sha B, writes `mcp-adapter.json`, and the D-05-08 sweep removes the legacy entries. The row does not name that command.
2. **A git marketplace whose checkout directory is missing.** `loadMarketplaceManifest` throws, so the row is `marketplace-unreadable`. `marketplace update` calls `refreshGitHubClone`, which runs `gitOps.fetch` in the missing directory and fails.

Neither is a regression: before 822f4809, both got the reinstall row, which also could not clear them. Both need an uncommon precondition, and the uninstall alternative works. So this is advisory.
**Fix:** For case 1, when the probe returned `missing-subdir` or `escapes` from a warm recorded-sha clone, either name `/claude:plugin update <p>@<mp>` or narrow the catalog sentence. For case 2, accept the uninstall alternative as the remedy, or note in the catalog that a missing checkout needs the marketplace removed and added again.

### IN-08: A mirror whose HEAD cannot be read keeps the reinstall row, and reinstall fails on the same read

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:272-278`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts:51-60`, `tests/orchestrators/reconcile/mcp-migration.test.ts:1218-1221`
**Issue:** An unpinned git source has a mirror directory with an unreadable `.git/HEAD`. `readMirrorHeadSha` throws inside the presence probe, `unread` stays true, and the row is `source-unreadable` with `Run /claude:plugin reinstall <p>@<mp> to move it.` Reinstall's `probeReinstallClone` takes the same mirror-first branch (`pathExists(mirrorRoot)`, then `readMirrorHeadSha`) and throws on the same read. So the remedy cannot clear the row, which repeats on every reload. The fix report already flagged this case as unverified. The test at `:1218-1221` pins the current row. A corrupt mirror is rare, so this is advisory.
**Fix:** Treat a probe throw as `marketplace-unreadable`, with uninstall as the working remedy. Or give it a remedy that removes or refreshes the mirror. Then update the pinned test case.

---

_Reviewed: 2026-10-09T16:10:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
