---
phase: 04-prune
reviewed: 2026-11-22T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - test/orchestrators/plugin/prune-rollback.test.ts
  - features/step_definitions/plugin/prune.steps.ts
  - features/plugin/prune.feature
  - test/integration/standalone-prune.test.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
  necessity: 0
status: issues_found
---

# Phase 04: Code Review Report (iteration 2)

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found (Info only)

## Summary

Scope: the five listed files. I read the iteration-1 fix commits `6d229d1..640c9e1` closely and read the whole phase diff since `ee04e7e` again for anything iteration 1 missed.

**Every iteration-1 finding in scope is fixed, and each fix's check fails without the fix.**

- **WR-01 (fixed, `6d229d1`).** The snapshot catch at `prune-rollback.ts:478-488` now wraps `removeBackupRoot` in its own `try`, debug-logs a cleanup failure as `discard` does, and rethrows the snapshot error. The new case `a refused snapshot whose backup cleanup fails rethrows the refusal` (`prune-rollback.test.ts:1863-1884`) uses a `removeBackup` that rejects. Before the fix, that rejection replaced the `PathContainmentError`, so `assert.ok(error instanceof PathContainmentError)` failed. This matches the recorded red proof. The `try` also covers rejections from `lstat`, `chmod`, and `readdir` in the walk, because they run inside `removeBackupRoot`.
- **WR-02 (fixed, `f513a93`).** The case `discard changes no mode behind a backup symlink or in the live tree` (`:1744-1775`) links a 0o555 directory outside the scope from the skill directory. Because `snapshotPath` copies with `verbatimSymlinks: true`, the backup holds that link. If the walk used `stat`, it would follow the link and `chmod` the outside directory to `0o555 | 0o700 = 0o755` (493), which is the recorded red value. The whole-value assertion also pins the live read-only directory at 0o555.
- **WR-03 (fixed, `709a36b`).** N02 now starts from `Given the project scope to prune exists and holds no files` (`prune.steps.ts:57-64`). The step creates `{project dir}/.pi` and asserts `readdir` returns `[]`, so the whole-scope remember and compare steps catch any file, directory, or lock a preview creates. The step is in the verb module because `scope-state.steps.ts` is frozen (layout.md, "Frozen after Phase 1"). It follows the steps rules: it uses `function` with `this`, and its `Given` asserts its own setup.
- **IN-01 (fixed, `4e94d6f`).** The `removeBackupRoot` comment now names the two kept-backup paths and the widened modes. IN-04 below covers one remaining gap in it.
- **IN-03 (fixed, `640c9e1`).** I checked the premise in `prune.ts:281-289`: after the dry-run branch returns, an actual prune always enters `withLockedStateTransaction`, even with nothing left to remove. So a leaked lock turns the second prune into the lock-held failure, as the recorded red proof shows.

I ran the seven read-only, refusal, and cleanup cases on this tree with a focused `node --test` run, and all seven pass.

**No regressions found.** The new `try` cannot hide the primary error: `hookDebugLog` and `errorMessage` do not throw on an `Error`. A sibling rejection in `grantBackupWrites`'s `Promise.all` is absorbed by `Promise.all`, so the swallowed path leaves no unhandled rejection. The empty 0o555 `outside-dir` in the WR-02 case can still be removed by the hermetic cleanup, because removing an empty directory needs write permission on its parent, not on the directory.

The necessity rubric was read and applied. No finding is a necessity finding: the cleanup `try` guards filesystem failures, and the filesystem is a trust boundary.

Not reported, as decided: `fallow audit` weakened-tests on the trim, the K2 survivor, and the second `When` in `prune.feature:15`. Two iteration-1 items stay open by decision and are carried as Info without escalation: iteration-1 IN-02 is now IN-01, and iteration-1 IN-04 is now IN-02. IN-03 and IN-04 are new and minor.

## Info

### IN-01: Between `lstat` and `chmod`, a directory swapped for a symlink would be followed (carried, iteration-1 IN-02, open by decision)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:372-381`
**Issue:** `chmod(root, ...)` follows symlinks. If a backup directory were replaced by a symlink between the `lstat` and the `chmod`, the mode change would land on the link's target. This needs a concurrent writer inside `<scopeRoot>/pi-claude-marketplace/` while the state lock is held, so the risk is low. The WR-02 case pins the non-racy property only.
**Fix:** Optional. Open the directory with `O_RDONLY | O_DIRECTORY | O_NOFOLLOW`, `fstat` the handle, and call `handle.chmod(...)`.

### IN-02: In U01 both scopes read the same broken manifest, so "the other scope is unchanged" proves little about scope isolation (carried, iteration-1 IN-04, open by decision)

**File:** `features/plugin/prune.feature` (Outline "Pruning refuses while the manifest of an installed plugin cannot be read and changes no file of either scope (D-05-07)")
**Issue:** A dir-source marketplace is used in place, so both scopes' `app` records read the same `plugin.json`. A prune that wrongly also ran on the other scope would be refused there as well and leave it unchanged anyway. P01 and "Pruning without a scope prunes the user scope alone" still cover scope isolation.
**Fix:** None required. To make the Outline prove isolation too, give the other scope a second marketplace whose declarer stays readable.

### IN-03: The integration header says the cases prove prune "makes no git call", but they check only clone and fetch

**File:** `test/integration/standalone-prune.test.ts:5-8`, `:195-196`, `:229-230`
**Issue:** The header, rewritten in this phase's trim (`17ee478`), says that "a git double records every clone and fetch, so the actual prune and the `--dry-run` preview each prove that prune runs neither seam and makes no git call." `createGitOpsFake` records seven call kinds: `clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, and `resolveRemoteRef` (`test/platform/git-ops-fake.ts:119-127`). Both cases assert only `clone` and `fetch`. `resolveRemoteRef` is a network call. It throws on an unplanned remote, but a probe that catches the error and degrades, the way the D-03-03 tag probes degrade, would still pass. The risk is low, because these cases' plugins are path sources with no remote. But these two cases exist only to prove call absence (ITSCOPE-01), so the comment claims more than the assertions check.
**Fix:** Compare the whole calls record in both cases:
```ts
assert.deepStrictEqual(gitCalls, {
  clone: [],
  fetch: [],
  forceUpdateRef: [],
  checkout: [],
  resolveRef: [],
  currentBranch: [],
  resolveRemoteRef: [],
});
```
Or reword the header to "makes no clone or fetch".

### IN-04: The corrected comment says a failed removal "keeps the backup", but a partway `rm` keeps only part of it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:388-393`
**Issue:** The IN-01 fix says that a removal that fails after the permission walk "also keeps the backup". The walk now makes every directory writable, so the forced `rm` can delete some entries before it fails. What remains can lack entries, and `manifest.json` may be gone. On the `rollback` path, `prune.ts:334` then throws `PruneRollbackError`, whose message tells the user to "Inspect <backup>/manifest.json". Every restore succeeded on that path, so nothing needs recovery. But the comment's "keeps the backup" and the user-facing pointer can both describe a file that no longer exists. The comment also does not say that a walk which fails partway leaves only the directories it reached widened. "Each directory the walk reached" covers that case only by implication.
**Fix:** Change the comment to "keeps whatever the removal did not reach, which may lack `manifest.json`." If the message should stay accurate, the `prune.ts` row for a rollback whose only failure is `backup cleanup` could name the leaked directory without pointing at its manifest. That change is outside this file set.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
