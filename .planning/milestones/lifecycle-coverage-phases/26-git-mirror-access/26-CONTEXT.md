# Phase 26: Git Mirror Access - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous; every recommended answer was taken without a prompt.

<domain>
## Phase Boundary

The git download cache (the URL-keyed mirror) is refreshed safely and fetched
once. Requirements: GIT-03, GIT-04, GIT-05; deferred item IN-06 (unused
`RemovalOps.rename`). Phase 25 runs in parallel and owns the update and
reinstall rows, the shared preflight messaging, `update-constraint-gate.ts`,
`dependency-verdict.ts`, and the list row, so `update-preflight.ts` edits stay
inside `probeUnpinned`.

</domain>

<decisions>
## Implementation Decisions

- **D-01 (GIT-03):** `fetch` and `info --fetch` run their clone-cache step
  under the scope's state lock (`withExistingScopeLock`, lock only, no state
  write). Install already runs its mirror step and copy under the lock; update
  and reinstall run theirs in `probeUnpinned`, which now takes the lock too
  (the preflight runs before the swap takes it, so the lock never nests). That
  covers the offline mirror read reinstall makes with `refresh: false`.
- **D-02 (GIT-03):** with the lock held, `fetch` reports the row `failed
  {lock held}` with its cause chain at error severity, as every other command
  does (FLR-02). `info --fetch` reports the plugin `failed {lock held}` at
  error severity. Its rows carry no cause chain, and a rethrow would surface
  as `internal-error`. A transport failure still degrades as D-81-04 decided;
  a held lock is not a transport failure. Claude Code has no state lock, so
  the project's lock rule decides.
- **D-03 (GIT-04):** one helper, `checkoutGitDirCopy`, copies a git directory
  (symlinks verbatim), drops its index, and checks the ref out into an empty
  tree. The per-commit copy and the marketplace tag clone both use it. The tag
  clone drops `force: true`, which refused a directory that holds only a
  symlink.
- **D-04 (GIT-04):** `materializeUnpinnedSource` (mirror step, then the
  per-commit copy, then the subdir anchor) is the one unpinned path for
  install (`probeInstallClone`) and update or reinstall (`probeUnpinned`). It
  takes the two steps as a parameter, so the existing seams stay unchanged.
- **D-05 (GIT-05):** a cold `info --fetch` of an unpinned source already makes
  one request round (fixed in phase 10). A scenario now pins it.
- **D-06 (IN-06):** `rename` leaves the `RemovalOps` port, its fake, and its
  contract.

</decisions>

<deferred>
## Deferred Ideas

- `createDelegatingRemovalOps` in `test/platform/removal-ops-fake.ts` has no
  consumer.

</deferred>
