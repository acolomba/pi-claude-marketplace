---
phase: 04-prune
reviewed: 2026-11-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - test/orchestrators/plugin/prune-rollback.test.ts
  - features/step_definitions/plugin/prune.steps.ts
  - features/plugin/prune.feature
  - test/integration/standalone-prune.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
  necessity: 0
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Scope: the diff since `ee04e7e` in the five listed files. That covers the prune backup-leak fix (`grantBackupWrites` and `removeBackupRoot`, `d24f937`), its four unit cases, the new prune step module, the twelve new scenarios, and the trim of `standalone-prune.test.ts` to its two call-absence carriers.

**The fix works.** The walk uses `lstat` and skips symlinks. It runs only on the backup root that `createBackupRoot` returned. It runs top-down, so the code changes a directory's mode before it reads that directory. The absent-root guard keeps a `lstat` ENOENT from hiding the snapshot refusal. A rollback with restore failures never calls the walk.

I traced each new unit case against the pre-fix code, where `rm` threw EACCES on the backup copy of the 0o555 directory:
- The discard case fails, because the backup stays.
- The rollback case fails, because the failures include a `backup cleanup` phase.
- The refusal case fails, because the error is EACCES and not `PathContainmentError`.
- The absent-root case fails on the guard's removal, because `lstat` throws ENOENT.

Scenario F03 ("Pruning leaves no backup in the scope when it could not remove a member") reaches the `discard` path: `free` is saved, so `discard()` runs. Without the fix the backup leaks there. The four new unit cases pass in a focused run.

What is still wrong:
- **WR-01:** the snapshot failure path can still hide the original prune error.
- **WR-02:** no case pins the symlink property that the doc comment promises.
- **WR-03:** in the trim, scenario N02 changed its precondition: it now writes a config, so it no longer catches a preview that creates a missing config. The deleted test caught that.

Every other user-visible case of the deleted integration tests has a scenario that fails on the same bug. Some coverage narrowed less (lock release, scope isolation in U01); those points are under Info.

The decided items are not reported: `fallow audit` weakened-tests, the K2 survivor, the mtime pins, and the D-04-03 change of the legacy preview. The necessity rubric was read and applied. The absent-root guard is not a necessity finding, because the filesystem is a trust boundary.

## Warnings

### WR-01: A failure in the cleanup of a refused snapshot still replaces the original error

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:473-476` (and the doc comment at `:383-389`)
**Issue:** The catch runs `await removeBackupRoot(ops, backupRoot); throw error;`. If `removeBackupRoot` rejects, the snapshot error (for example the `PathContainmentError` refusal) is lost. The user then sees the cleanup error, and the backup leaks. The doc comment says the absent-root guard means "the snapshot failure path rethrows its own error", but the guard covers only an absent root.

The fix adds three new throw sources before the forced `rm`: `lstat`, `chmod`, and `readdir` on every directory of the backup. Any of them can reject. A child entry removed between `readdir` and its `lstat` gives ENOENT. EPERM or EROFS can come from `chmod`. The forced `rm` itself can still reject. The fix makes this path safer than the pre-fix code, which hid the error on every read-only directory, but it does not keep the guarantee the comment states.
**Fix:** Keep the primary error and log the cleanup failure, as `discard` does:
```ts
} catch (error: unknown) {
  try {
    await removeBackupRoot(ops, backupRoot);
  } catch (cleanupError: unknown) {
    hookDebugLog(`prune: backup cleanup failed: ${errorMessage(cleanupError)}`);
  }

  throw error;
}
```
Add a unit case whose `removeBackup` rejects during a refused snapshot, and assert that the rejection is still the `PathContainmentError` with its `child`.

### WR-02: No case proves that the permission walk does not follow symlinks or touch the live tree

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:372-381`; `test/orchestrators/plugin/prune-rollback.test.ts:1721-1828`
**Issue:** The doc comment promises that "the walk uses `lstat` and never follows a symlink". That property is what keeps the walk inside the backup root. `snapshotPath` copies symlinks verbatim (`verbatimSymlinks: true`), so a backup can hold a symlink to any directory. If a later edit uses `stat` instead of `lstat`, or `readdir(..., { withFileTypes })` with a followed `stat`, the walk would `chmod u+rwx` and recurse through every directory behind that link, such as a skill that links to `~` or `/`. Every current case would still pass:
- The four new cases hold no symlink.
- The one existing nested-symlink case (`:748`) links to a file. A `stat`-based walk returns early on a file, and that case checks only the file's bytes, not its mode.
- No case asserts that the live read-only directory still has mode 0o555 after `discard()` or `rollback()`. So a walk that also widened the live targets would pass too.
**Fix:** Add a case beside the read-only cases:
1. Seed the skill.
2. Create an outside directory with mode 0o555, and link to it from the skill directory (`symlink(outsideDir, path.join(path.dirname(fixture.skill), "linked"))`).
3. Prepare, then call `discard()`.
4. Assert `{ outside: (await lstat(outsideDir)).mode & 0o777, live: (await lstat(readOnly)).mode & 0o777, backups: [...] }` deep-equals `{ outside: 0o555, live: 0o555, backups: [] }`.

### WR-03: N02 now writes a project config first, so it no longer catches a preview that creates a missing config

**File:** `features/plugin/prune.feature` (scenario "Previewing a prune of a project scope that holds no installation record changes no file of either scope")
**Issue:** The deleted case `standalone-prune.test.ts:670-700` created only the project scope root. After two previews it asserted ENOENT on four paths: `project.extensionRoot`, `stateJsonPath`, `baseConfigJsonPath`, and `stateLockFile`. N02 first writes a base config `{ "schemaVersion": 1, "marketplaces": {}, "plugins": {} }`, because the whole-scope step needs `.pi` to exist (RESEARCH line 216). With a config already in place, the whole-tree comparison can no longer catch a preview that writes a default or migrated `claude-plugins.json` when none exists.

This is the narrow "changes nothing" check that the Phase 2 and 3 reviews warned about: the scenario's title says "a project scope that holds no installation record", but its setup is not the absent-config state that the deleted test protected. K14, the measured break, creates only the extension root, so the red proof did not test this gap.
**Fix:** Keep `.pi` present without a config. Options:
- Add a `Given` in `prune.steps.ts`, such as `the project scope exists and holds no files`. It makes the scope root, asserts that `readdir` returns `[]`, and lets the whole-scope remember and compare steps run.
- Or add a `Then` stating that the project scope holds no config files. Its text must say exactly that, so a reader does not need to open the step.

## Info

### IN-01: The doc comment says a kept backup never has its modes changed, but two paths do keep one

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:383-396`, `:521-527`, `:531-537`
**Issue:** "The permission walk never changes a kept backup" is true only for a rollback whose restores failed. Two other paths keep a backup after the walk widened every directory to `u+rwx`, because `ops.removeBackup` rejected after `grantBackupWrites` succeeded (or `rm` stopped partway):
- `rollback()` reports a `backup cleanup` failure, and `prune.ts:334` throws `PruneRollbackError`, which tells the user to "Inspect <backup>/manifest.json ... before retrying".
- `discard()` debug-logs the failure.

A manual restore from either backup gives directories that are writable instead of the plugin's original read-only modes.
**Fix:** Correct the comment so it names these two paths, or note in the recovery manifest that the cleanup may have widened directory modes.

### IN-02: Between `lstat` and `chmod`, a directory swapped for a symlink would be followed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:373-378`
**Issue:** `chmod(root, ...)` follows symlinks. If a directory in the backup were replaced by a symlink between the `lstat` and the `chmod`, the mode change would land on the link's target. This needs a concurrent writer inside `<scopeRoot>/pi-claude-marketplace/` while the state lock is held, so the risk is low.
**Fix:** Optional: open the directory with `O_RDONLY | O_DIRECTORY | O_NOFOLLOW`, `fstat` it, and call `handle.chmod(...)` through the handle.

### IN-03: No remaining check confirms that a successful prune releases the state lock

**File:** `test/integration/standalone-prune.test.ts` (trimmed cases `:483`, `:579`, `:617` of `ee04e7e`); `features/plugin/prune.feature`
**Issue:** Three deleted cases asserted that `stateLockFile` is ENOENT after an actual prune: the alternating graph, the failed member, and the retry.
- Among the new scenarios, only F02 would catch a leaked lock, and only after a prune that warned, because its second prune would report `lock held`.
- No scenario runs a command after a clean actual prune, and the kept actual-prune integration case does not check the lock.

Prune does not manage the lock itself; `withLockedStateTransaction` does, and other suites cover that helper. So a leak specific to prune is unlikely.
**Fix:** Optional: in the kept integration case `prune removes an orphan dependency through the registered command`, add `await assert.rejects(stat(locations.stateLockFile), { code: "ENOENT" })`.

### IN-04: In U01 both scopes read the same broken manifest, so "the other scope is unchanged" proves little about scope isolation

**File:** `features/plugin/prune.feature` (Outline "Pruning refuses while the manifest of an installed plugin cannot be read and changes no file of either scope (D-05-07)")
**Issue:** A dir-source marketplace is used in place (`orchestrators/marketplace/add.ts:1897`), so both scopes' `app` records read `{home}/marketplaces/tools/plugins/app/.claude-plugin/plugin.json`. The deleted case broke the manifest of the user scope only, and asserted that the intact project scope was unchanged. In U01, a prune that wrongly also ran on the other scope would be refused there too, and that scope would stay unchanged anyway. Scope isolation is still covered by P01 and by "Pruning without a scope prunes the user scope alone", so this adds no regression risk.
**Fix:** None required. If the Outline should also prove isolation, use a second marketplace for the other scope so that its declarer stays readable.

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
