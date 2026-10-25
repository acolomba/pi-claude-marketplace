---
phase: 26-git-mirror-access
review: 26-REVIEW.md
status: all_fixed_or_deferred
fixed: [CR-01, WR-01, WR-02, WR-04, IN-01, IN-02, IN-04]
deferred: [WR-03, WR-05, WR-06, IN-03]
---

# Phase 26 Review Fix

## Fixed

- **CR-01** `update-preflight.ts` `resolveUpdateCandidate`: a `StateLockHeldError`
  from `probeUnpinned` is rethrown beside `rethrowInvalidGitHubBaseUrl`, so
  update and reinstall report `failed {lock held}` instead of `skipped {no
  longer installable}`. This is one edit outside `probeUnpinned`, in the
  catch that wraps it. New scenarios: `git-source-update.feature` lock-held
  Outline for update and reinstall; unit test in `update-preflight.test.ts`
  (IN-04).
- **WR-01**: `info --fetch` and `fetch` take the lock only for the unpinned
  (mirror) arm; a pinned clone is immutable and never touches the mirror.
- **WR-02**: `info.ts` `lockHeldRow` uses `componentsResolved: true,
  components: {}` like every other failed info row.
- **WR-04**: `seedOnePluginMirror` seeds a pinned per-commit copy through
  `checkoutGitDirCopy`, and the unpinned mirror seed copies symlinks verbatim.
- **IN-01**: `platform/git.ts` `force` doc now points at the drop-the-index
  step.
- **IN-02**: the `RemovalOps` doc no longer credits D-08-13 with the
  one-member shape; the long line is wrapped; `.planning/codebase/TESTING.md`
  no longer says "rename".

## Deferred (For the user)

- **WR-03**: clone GC runs after the guard is released (uninstall, update
  swap, `marketplace remove`, disabled-pin refresh); it can delete a mirror a
  locked fetch, info, or install is using, or a fresh copy between update's
  preflight and its swap. This is older than this phase; the fix is to run GC
  under the lock.
- **WR-05**: update's path-pin tag clone copies the marketplace `.git` with no
  lock.
- **WR-06**: `fetch` and `info --fetch` read the mirror tree for their row
  after the lock is released; display only.
- **IN-03**: more commands now hold the lock across a network refresh and the
  Device Flow; `proper-lockfile`'s default `onCompromised` throws from a timer.
