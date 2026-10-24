---
phase: 21-marketplace-add-no-op-and-token-parity
plan: 01
subsystem: marketplace-add, marketplace-update, bootstrap, edge-router
tags: [marketplace, notifications, upstream-parity]
requires: [MPA-01, MPA-02, MPA-03]
provides:
  - same-source marketplace add no-op (skipped {already added})
  - manifest-fault token parity on add/update
  - marketplace help flag rejection
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/router.ts
key-decisions:
  - D-01..D-09 in 21-CONTEXT.md
requirements-completed: [MPA-01, MPA-02, MPA-03]
---

# Phase 21 Plan 01: Marketplace Add No-Op and Token Parity Summary

## What changed

- **MPA-01.** `redeclareRecordedSource` (the LAYER-01 pre-clone source match)
  now returns `{ name, alreadyAdded }`. When the target layer already declares
  the matched record's name with a source that plans the same, the add writes
  nothing and the standalone add emits `● <name> [<scope>] (skipped) {already
  added}` (info, no reload, no settle). A layer that declares the name with
  another source still throws `MarketplaceDuplicateNameError`. Bootstrap no
  longer swallows `duplicate name`: a re-run shows the add's skipped row and
  then the autoupdate row; a different source under the official name fails
  `(failed) {duplicate name}` and skips the autoupdate step.
- **MPA-02.** `classifyAddError` maps `InvalidMarketplaceManifestError`
  through `narrowProbeError` (`unparseable` for a JSON syntax cause). A
  manifest read refused with EACCES/EPERM is typed as a local
  `ManifestReadDeniedError` and reads `permission denied` (previously an
  unclassified raw throw); other refused writes keep their raw error.
  `marketplace update`'s `reasonsFromCascadeError` maps the manifest error the
  same way. `install-outcome.ts` reuses `classifyAddError`, so a project-scope
  install that adds a user-scope marketplace reads the same tokens.
- **MPA-03.** The router's `marketplace help` arm names the first `--` token
  as `Unknown flag: "<flag>".` before the "takes no arguments" check.
- Catalog: `docs/output-catalog.md` gains `already-added` under
  `marketplace add` and rewrites `already-bootstrapped`; fixtures and the
  295-state / byte / wire-inventory pins follow.

## Tests

- Unit: `test/orchestrators/marketplace/add.test.ts` (skipped re-adds, layer
  source mismatch, unreadable manifest, unparseable rows),
  `update.test.ts`, `test/orchestrators/plugin/bootstrap.test.ts` (re-run
  rows, different-source refusal), `test/edge/router.test.ts`.
- Cucumber: `features/marketplace/add.feature` (same-source outline over
  dir/file/url/github, `--local` re-add, permission-denied outline,
  unparseable rows), `failed-add.feature`, `update.feature`, `help.feature`,
  `features/plugin/bootstrap.feature`.

## Deviations

- Code review (21-REVIEW.md WR-01) narrowed the first EACCES/EPERM arm, which
  classified any refused write, to the manifest read only.
- `docs/output-catalog.md` text for the invalid-manifest states now names the
  `unparseable` variant.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
