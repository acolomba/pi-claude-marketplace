---
phase: 16-git-plugin-copies-and-version-rule
review: 16-REVIEW.md
status: all_fixed_or_deferred
fixed: [CR-01, WR-01, WR-02, WR-03, WR-05, IN-02, IN-03, IN-05]
deferred: [WR-04, IN-01, IN-04]
---

# Phase 16 Review Fix

## Fixed

- **CR-01** `clone-cache.ts` `copyMirrorAtCommit`: copies only the mirror's
  `.git` (symlinks verbatim), drops the copied index, and checks the commit
  out into the empty work tree. The copy holds exactly the commit's tree:
  relative symlinks stay relative and no untracked or edited mirror file
  rides along. A real isomorphic-git test proves both.
- **WR-01**: only `NotFoundError` / `CommitNotFetchedError` fall back to a
  clone; any other checkout failure propagates with the staging leak (MA-9).
- **WR-02** `update-preflight.ts` `isSameRevision`: unchanged only when the
  version and the sha (or the absence of one) both match, so a switch between
  a git and a path source at the same version is an update.
- **WR-03** `update-swap.ts` ST-9: also refuses when the recorded commit moved
  since preflight.
- **WR-05** `enable-disable.ts`: both enable paths pass the recorded sha as
  `sourcePinOverride`, so enable restores the recorded commit instead of the
  mirror's HEAD.
- **IN-02**: stale tier comments in `readDeclaredPluginVersion` updated.
- **IN-03**: redundant default in `list-candidate-row.ts` removed.
- **IN-05**: the unit test that asserted an untracked mirror file reached the
  copy now asserts the opposite; flow-test fakes gained
  `test/orchestrators/plugin/mirror-checkout.ts`, a checkout that writes the
  mirror's tree into a `.git`-only work tree.

## Deferred (For the user)

- **WR-04**: `fetch` / `info --fetch` refresh the mirror without the state
  lock while an install may copy from it. The copy now reads only `.git`
  objects and refs, so the risk is a checkout error, not a half-updated tree,
  but the refresh is still unserialized.
- **IN-01**: a record made before this phase whose `update` is `unchanged`
  stays on the mirror until a real update or reinstall.
- **IN-04**: the `.git`-copy-and-checkout logic is close to
  `materializeMarketplaceTagClone`; a shared helper is left for later.
