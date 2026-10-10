---
phase: 08-clear-milestone-debt
fixed_at: 2026-10-10T08:12:35Z
review_path: .planning/phases/08-clear-milestone-debt/08-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-10-10T08:12:35Z
**Source review:** .planning/phases/08-clear-milestone-debt/08-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (fix scope `all`: 4 warnings, 3 info)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-01: `restoredOverrideNames` no longer agrees with the write-back it describes

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `tests/bridges/mcp/adapter-doc.test.ts`, `tests/bridges/mcp/unstage.test.ts`, `tests/bridges/mcp/stage.test.ts`
**Commit:** 5f85466a
**Applied fix:** `restoredOverrideNames` now tests `writtenBackOverride(entry) !== undefined`, which is the same test the write-back uses. The doc comment now says that a kept override emptied by the entry's carried fields is neither written back nor named. New cases:

- a `restoredOverrideNames` unit case with an emptied `{disabled:true}` kept override and a kept `{}` stub. Only the stub is named.
- an unstage case that removes the emptied entry. It reports no notice and writes `{"mcpServers":{}}`.
- a stage case where an update drops a server with an emptied kept override. It reports no `override-restored` notice and writes only the new entry.

The existing ordering case gave its `first` and `last` entries live carried values. Without them, those kept overrides were emptied, so the new contract correctly excluded them. The case still tests ordering and dedup.

### WR-02: Stored server choices match by plugin name only; docs claim per-plugin isolation

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `docs/mcp-compatibility.md`, `docs/output-catalog.md`, `tests/bridges/mcp/adapter-doc.test.ts`, `tests/bridges/mcp/stage.test.ts`, `tests/bridges/mcp/unstage.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts`, `tests/integration/mcp-adapter-entry-conformance.test.ts`
**Commit:** 28a1bf0c
**Applied fix:** I took the first option, the orchestrator's binding choice.

- A store entry is now `{ plugin, marketplace, fields }`.
- `storedChoiceOf` requires a string `marketplace`. A new `ownedChoiceOf` returns an entry only when both the plugin and the marketplace match.
- `storedChoicesFor(config, pluginName, marketplaceName, keys)` and the `consumed` filter of `withPluginServersKeepingChoices` both use `ownedChoiceOf`. `capturedChoices` records the marketplace.
- `stage.ts` passes `marketplaceName`, which it already had.
- The move is still part of the same single document, so it stays in one `atomicWriteJson` write (NFR-1).
- An entry without `marketplace` never matches. It is kept untouched, like a foreign entry. No migration was added because the branch is unreleased.

Docs:

- `docs/mcp-compatibility.md` (User overrides) gives the new entry shape and says that a same-named plugin from another marketplace never gets the choice.
- The `docs/output-catalog.md` override-restored prose now names the plugin and its marketplace.

Tests:

- The unit cases cover a same-named plugin from another marketplace and a marketplace-less entry. Each is neither returned nor consumed.
- A stage case has two rows: another plugin, and the same-named plugin of another marketplace. In both, the stored choice is neither applied nor removed.
- The `mcp-override-lifecycle.test.ts` integration test gets the same two rows through a real install. The test seeds the entry that a `hello@elsewhere` uninstall would write, then installs `hello@mp`, which does not inherit it.

### WR-03: `override-kept` notice prints file-derived field names without escaping

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `tests/shared/notification-dispatch.test.ts`
**Commit:** 38bfcdab
**Applied fix:** `mcpOverrideKeptLine` now joins `notice.fields.map(printable)`. A new dispatch case has a field name with ESC, a newline, U+2028 and U+202E. Each one renders as a `\u` escape. The catalog byte form is unchanged for plain names.

### WR-04: `source-outdated` row names an update remedy that cannot clear an `escapes` miss, and can describe the wrong commit

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `docs/output-catalog.md`, `docs/mcp-compatibility.md`, `tests/orchestrators/reconcile/mcp-migration.test.ts`, `tests/shared/notification-dispatch.test.ts`
**Commit:** 9003e476
**Applied fix:** `offlineCloneRead` now sets `missing` only for `missing-subdir`. An `escapes` result therefore goes to `missKind`'s `marketplace-unreadable` arm.

Why that row: a lexically escaping declared path is a defect in what the marketplace copy declares, and it escapes in every commit. An update re-resolves the same path, so it cannot clear the miss. The marketplace-copy row's two remedies can: a marketplace update fixes the declared path once the marketplace corrects it, and an uninstall removes the plugin and its old entries. No other row's remedy fits. Reinstall reads the same copy, and the not-listed row describes a manifest problem, not a path problem.

The `source-outdated` row now says "The cached source of P has no plugin at its declared path". It no longer says "The installed commit". For an unpinned source with a present mirror, the probe reads the mirror HEAD, not the recorded commit.

These texts were updated to match:

- the module header and the `resolveOffline` and `OfflineCloneRead` comments
- the doc comments of both row interfaces
- the `mcp-migration-left-in-place` catalog block row and its prose
- the compatibility table in `docs/mcp-compatibility.md`

`tests/architecture/mcp-migration-notice.test.ts` reads the block from the catalog, so the block and the source moved together. The test's report data needed no change.

A new migration case seeds a `git-subdir` path `../escape` under a warm recorded-sha clone and expects one `marketplace-unreadable` row and no write. I checked that this case fails with the old `|| result.kind === "escapes"` line.

**This narrows D-08-05's naming of `escapes`.** D-08-05 named both `missing-subdir` and `escapes` for `source-outdated`. Only `missing-subdir` maps there now. As the orchestrator instructed, I did not edit 08-CONTEXT.md.

### IN-01: Local `ownValue` in adapter-doc.ts duplicates and shadows `shared/own-key.ts`

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`
**Commit:** 55874a5e
**Applied fix:** adapter-doc.ts now imports `ownValue` from `../../shared/own-key.ts` and the private copy is deleted. The call sites needed no change: the shared signature accepts a wider map, and the `T` inference gives `unknown` for the raw maps and `StoredChoice | undefined` for `captured`. The bridges-mcp zone may import shared, and fallow passes.

### IN-02: The migration probe swallows every mirror error; reinstall swallows only the HEAD read

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts`, `tests/orchestrators/plugin/git-source-probe.test.ts`
**Commit:** 494e58c5
**Applied fix:** I narrowed the catch. I did not just correct the comment. `probeMirror` now takes a `readHead` function:

- `makePresenceProbe` passes `readMirrorHeadSha`, so a HEAD failure still throws, as before.
- `makeRecordedShaPresenceProbe` passes a local `readUsableMirrorSha`, which catches only the HEAD read and returns undefined, as reinstall's helper does.
- `pluginCloneDir` (NFR-10 containment), `pathExists` and `anchorSubdir` now propagate in the migration probe, as they do in reinstall.

The narrowing keeps the documented NFR-3 / D-08-05 behavior, "a mirror whose HEAD cannot be read falls through to the clone". That behavior was only ever about the HEAD read. The doc comment now also says that every other mirror failure propagates.

In the migration, a propagated throw lands in `resolveOffline`'s catch with `cloneUnread()` true, so it gives a `source-unreadable` row. Before, it silently read the recorded-sha clone.

A new probe case symlinks the mirror directory outside the clone root while a warm recorded-sha clone exists. It expects a `PathContainmentError` whose parent is the clone root and whose child is the mirror path. I checked that this case fails on the old code. Direct coverage is 100% (branches 57/57).

### IN-03: The `marketplace-unreadable` row still offers `marketplace update` for a missing checkout

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `tests/shared/notification-dispatch.test.ts`, `docs/output-catalog.md`, `docs/mcp-compatibility.md`
**Commit:** 49345f38
**Applied fix:** The row is now "The M marketplace copy cannot give the source of P. Run /claude:plugin uninstall P@M to remove it, or /claude:plugin marketplace update M when the copy is out of date."

Uninstall comes first because it clears every cause of this row: a missing checkout, a stale or missing manifest, a missing plugin directory, and, after WR-04, an escaping declared path. 08-TRIAGE confirms that `marketplace update` fails on a missing checkout, because `refreshGitHubClone` fetches into the missing directory. `marketplace remove` cascades an uninstall of its plugins. So "remove the marketplace and add it again" also removes the plugin, and it is not a better first remedy.

The `not-listed` row is unchanged and keeps marketplace update first. That cause cannot arise when the checkout is missing, because the manifest load throws first.

These now agree with the row:

- the catalog block and its prose
- the row-interface comment
- the compatibility table. The marketplace-copy row and the not-listed row are now separate, and the missing-checkout row leads with uninstall and says that the removal uninstalls the plugin too.

## Verification

All edits, commits and checks ran in the **main checkout** at `/home/acolomba/src/pi-claude-marketplace-mcp-4` (branch `features/mcp-4`), not in an isolated worktree. The orchestrator's binding instructions pin the root to this checkout (`rootpin.sh`) and declare this fixer the only agent editing it. A hand-rolled worktree also has no `node_modules`, so the commit hook could not run there. Results are reproducible from this tree. Node v26.11.1, `TMPDIR=/var/tmp/mcp4-p8-fix`.

- Every commit passed `SKIP=npm-check pre-commit run --files <files>`. The `git commit` hook (`npm run check:commit`) passed for each of the 7 commits, and the working tree is clean.
- Direct coverage (`npm run test:coverage:direct -- <src>`) is 100% for every touched pair:
  - `bridges/mcp/adapter-doc.ts`: 150/150 branches
  - `bridges/mcp/stage.ts`: 130/130
  - `bridges/mcp/unstage.ts`: 35/35
  - `shared/notification-dispatch.ts`: 164/164
  - `orchestrators/reconcile/mcp-migration.ts`: 172/172
  - `orchestrators/plugin/git-source-probe.ts`: 57/57
- `npm run test:unpaired` (architecture, catalog-uat and catalog-lock suites, and the fake contracts) exited 0.
- `tests/architecture/mcp-migration-notice.test.ts` and `tests/shared/notification-dispatch.test.ts` passed 287/287 after the last commit.
- `tests/integration/mcp-override-lifecycle.test.ts` and `tests/integration/mcp-adapter-entry-conformance.test.ts` passed 15/15, 0 skipped, with `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`.
- `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` gave verdict `pass`: 0 introduced findings of any kind, and 8 inherited clone groups.
- The full `npm run check` did not run. It is the orchestrator's gate.

---

_Fixed: 2026-10-10T08:12:35Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
