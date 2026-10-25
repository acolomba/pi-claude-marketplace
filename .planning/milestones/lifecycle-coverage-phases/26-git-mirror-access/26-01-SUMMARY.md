---
phase: 26-git-mirror-access
plan: 01
requirements-completed: [GIT-03, GIT-04, GIT-05]
status: complete
---

# 26-01 Summary: git mirror access

- **GIT-03:** `fetch` (`fetchOne`) and `info --fetch` (`makeFetchProbe`) run
  their clone-cache step under `withExistingScopeLock`. Update and reinstall
  take the lock in `probeUnpinned`, which also covers reinstall's offline
  mirror read (`refresh: false`). A held lock reports `fetch` as `failed
  {lock held}` with its cause chain, and `info --fetch` as `failed {lock
  held}`, both at error severity.
- **GIT-04:** `checkoutGitDirCopy` is the one copy-and-checkout step for the
  per-commit copy and the marketplace tag clone. The tag clone no longer
  forces its checkout, so a directory that holds only a symlink checks out.
  `materializeUnpinnedSource` is the one unpinned path for `probeInstallClone`
  and `probeUnpinned`.
- **GIT-05:** a scenario pins one GET and one POST for a cold `info --fetch`
  (the behavior was already fixed in phase 10).
- **IN-06:** `rename` removed from `RemovalOps`, its fake, its contract, and
  their tests.

## Verification

- `npm run check`: exit 0, 747/747 scenarios, direct coverage merged.
- New tests: fetch and info lock held (unit and cucumber), a real
  isomorphic-git tag clone of a symlink-only directory, and the
  `materializeUnpinnedSource` composition.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
