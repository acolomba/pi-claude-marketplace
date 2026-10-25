---
phase: 21-marketplace-add-no-op-and-token-parity
status: all_fixed
findings_in_scope: 9
fixed: 7
skipped: 2
---

# Phase 21 Review Fix

- **CR-01 (fixed):** the same-source outline and the `--local` re-add scenario
  in `features/marketplace/add.feature` assert `the git host receives no
  request` (meaningful for the url and github rows) next to the unchanged
  config.
- **WR-01 (fixed):** the generic EACCES/EPERM arm is gone. `newMarketplaceName`
  reads through `readManifestDocument`, which types a refused manifest read as
  `ManifestReadDeniedError` -> `permission denied`. A refused config or state
  write keeps its raw error; the LAYER-01 test is back to its original
  `rejects EACCES` form, and the EPERM-clone test was dropped.
- **WR-02 (fixed):** `rethrowPreconditionErrors` doc, the rethrow comment in
  `runAddOutcome`, and the `InvalidMarketplaceManifestError` doc in
  `shared/errors.ts` now describe the current behaviour.
- **WR-03 (fixed):** `docs/output-catalog.md` precondition list and the
  `add-invalid-manifest` / `update-path-invalid-manifest` prose name the
  `unparseable` variant.
- **WR-04 (fixed):** the catalog doc was rebuilt from HEAD so only this
  phase's edits remain; the `___` separators are back.
- **WR-05 (fixed):** the `AddMarketplaceOutcome` and `handleAddFailure` docs
  say `unparseable` also names a malformed manifest.
- **IN-01 (fixed):** stale test comments in `add.test.ts` and `update.test.ts`.
- **WR-06 (skipped):** extra tests for the completion cache on the skip path,
  the install-path tokens, and update's raw cascade arm. Direct coverage is
  100% without them; the cucumber suite covers the user-visible rows. Listed
  for the user.
- **IN-02 (skipped):** the standalone-only `status: "added"` outcome on the
  skip path is documented at the return; `already added` is reported without
  checking the clone exists, as the old `duplicate name` did. Listed for the
  user.
