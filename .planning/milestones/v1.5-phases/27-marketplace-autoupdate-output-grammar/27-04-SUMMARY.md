---
phase: 27-marketplace-autoupdate-output-grammar
plan: 04
subsystem: ui
tags: [notify, output-grammar, marketplace, update, change-detection, catalog-uat, UXG-05]

# Dependency graph
requires:
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-01)
    provides: "synced catalog-uat FIXTURES key (loadCatalogExamples sectionRe coupling) for the marketplace update section"
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-02)
    provides: "list-surface renderMpHeader baseline (UXG-01) -- the byte-baseline the update-surface change must not touch"
  - phase: 27-marketplace-autoupdate-output-grammar (plan 27-03)
    provides: "shared mp-level skipped renderMpHeader arm (UXG-04) reused verbatim by UXG-05's (skipped) {up-to-date} no-op"
provides:
  - "marketplace update no-op renders (skipped) {up-to-date} instead of (updated), mirroring the plugin-level up-to-date no-op"
  - "manifest-content change detector (manifestContentKey) threaded through RefreshSnapshot.changed -- source-kind-uniform (path + github)"
  - "RefreshSnapshot.changed boolean distinguishing 'refreshed, no change' from 'changed' on the autoupdate-OFF path"
  - "Phase 27 GREEN gate + nyquist sign-off (nyquist_compliant: true)"
affects: [phase-28, notification-output-polish, marketplace-update, UXG-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manifest-content change detection: compare the parsed/typebox-validated MarketplaceManifest pre/post refresh via JSON.stringify of the validated parse (stable key order); no field-by-field diff, no git SHA, no lastUpdatedAt"
    - "Reuse the existing shared mp-level skipped renderMpHeader arm: orchestrator-only change (new payload variant) -- the renderer needs zero change because (skipped) {up-to-date} already composes from up-to-date (a REASONS member)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - .planning/phases/27-marketplace-autoupdate-output-grammar/27-VALIDATION.md

key-decisions:
  - "Change detection uses MANIFEST CONTENT-COMPARE (not git SHA, not lastUpdatedAt). Content-compare is source-kind-uniform: path sources never advance a git SHA and are always no-ops unless the local marketplace.json changed, and github sources whose clone advanced but yielded byte-identical manifest content also compare equal. record.lastUpdatedAt is the WRONG signal (Pitfall 4) -- it is stamped to now on every refresh regardless of content; it is kept (used elsewhere) but is explicitly NOT the change decision."
  - "Compare ONLY post-validation parsed content (T-27-05 / T-27-06 mitigation): manifestContentKey loads via loadMarketplaceManifest (typebox MARKETPLACE_VALIDATOR runs BEFORE the value is consumed). A tampered manifest that fails validation throws and routes to the existing (failed) path, never to the no-op (skipped) decision. JSON.stringify of the validated parse is used (typebox .Parse yields stable key order) -- no node:crypto SHA needed; no field-by-field diff (Don't-Hand-Roll)."
  - "Severity stays warning for the benign skip. status:skipped routes warning via computeSeverity; this is intentional for Phase 27. The benign-skip -> info softening is UXG-02 (Phase 28) and is deliberately NOT pre-empted here."
  - "The no-op emits NO /reload trailer (plugins:[] => shouldEmitReloadHint false). UXG-05 is orthogonal to the reload-hint discipline (SNM-33)."
  - "The renderer needs NO change. The existing shared mp-level skipped arm (notify.ts:646) renders (skipped) {<reason>} and up-to-date is already a REASONS member (notify.ts:64). Only the orchestrator decision + the catalog states are new."
  - "Catalog Open Question 3 resolved: the single autoupdate-off-manifest-refresh state was split into TWO states (update-no-op-skipped + manifest-refresh-changed), a net +1 that keeps examples.length >= 30 satisfied."

patterns-established:
  - "RefreshSnapshot.changed: thread a content-derived change boolean out of the state-guarded refresh so the post-guard emission can branch no-op vs changed without re-reading the manifest."

requirements-completed: [UXG-05]

# Metrics
duration: 18min
completed: 2026-05-30
---

# Phase 27 Plan 04: Marketplace Update No-Op Grammar (UXG-05) Summary

`marketplace update <name>` on the autoupdate-OFF (manifest-only refresh) path now renders the no-change case as `● <mp> [<scope>] (skipped) {up-to-date}` (warning, no `/reload` trailer) instead of the always-emitted `(updated)`, mirroring the plugin-level up-to-date no-op; change detection uses a source-kind-uniform manifest-content compare. This is the last plan in Phase 27 and carries the phase GREEN gate + nyquist sign-off.

## What Was Built

### Task 1 -- Manifest-content change detector (orchestrator)

`extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`:

- Added `manifestContentKey(record)`: loads the persisted, typebox-validated `MarketplaceManifest` via `loadMarketplaceManifest(record.manifestPath)` and returns `JSON.stringify(parsed)` as a stable comparison key (returns `undefined` on read/validation failure, which reads as "changed" -- the safe default).
- `refreshRecord` now captures the PRE-refresh content key (before `validateManifestAtRoot` re-validates and `record.lastUpdatedAt` is re-stamped) and the POST-refresh key (after re-validation), returning a `changed: boolean` from `preKey !== postKey`. `lastUpdatedAt` is still stamped on every refresh (used elsewhere) but is NOT the change signal (Pitfall 4).
- Threaded `readonly changed: boolean` through the `RefreshSnapshot` interface and set it in `snapshotAfterRefresh`.
- Branched the autoupdate-OFF emission (`!snapshot.autoupdate || pluginUpdate === undefined`): `snapshot.changed === false` emits `{ status: "skipped", reasons: ["up-to-date"], plugins: [] }`; otherwise the existing `{ status: "updated", plugins: [] }`. The autoupdate-ON cascade branch is byte-unchanged.
- Updated the CMC-32 / header comment blocks to reflect the no-op vs changed split.

### Task 2 -- Catalog states + byte/orchestrator tests (same atomic commit)

- `docs/output-catalog.md`: split the single `autoupdate-off-manifest-refresh` state into `update-no-op-skipped` (`● local-mp [user] (skipped) {up-to-date}`, warning, no trailer) and `manifest-refresh-changed` (`● local-mp [user] (updated)`); updated the section preamble. Prose notes the `warning` routing is current-ladder and is the surface UXG-02 (Phase 28) will soften -- not pre-empted here.
- `tests/architecture/catalog-uat.test.ts`: replaced the single fixture with the two new keyed fixtures (net +1 keeps `examples.length >= 30`).
- `tests/shared/notify-v2.test.ts`: added a UXG-05 byte test asserting `● local-mp [user] (skipped) {up-to-date}`, `"warning"` severity arg, and NO `/reload to pick up changes` substring.
- `tests/orchestrators/marketplace/update.test.ts`: repurposed the MU-4 github-source test (a natural no-op -- the mock git ops advance the ref but do not change file content) to assert the no-op byte form; added a github-source CHANGED test (wraps the mock `checkout` to write a content-differing validated manifest) asserting `(updated)`; added a path-source no-op test. Covers both source kinds, both outcomes.

### Task 3 -- GREEN gate + nyquist sign-off

- `npm run check` GREEN (1146/1146, exit 0); `npm run test:integration` GREEN (4/4); `PI_CM_E2E_REF=pinned npm run test:e2e` GREEN (14/14).
- Flipped `nyquist_compliant: false -> true`, `status: draft -> complete`, `wave_0_complete: false -> true` in `27-VALIDATION.md`; checked off the Sign-Off list and recorded the approval narrative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing github-source test (MU-4) flipped to the no-op form**

- **Found during:** Task 2 (running the orchestrator test surface).
- **Issue:** The plan anticipated extending orchestrator tests for the no-op case but did not call out that the existing `MU-4 + D-14` test would itself become a no-op under the new detector. Because `seedGithubMarketplace` pre-seeds the clone dir with the `valid-marketplace` fixture and the mock git ops do not mutate file content, the refresh re-validates byte-identical manifest content -> `changed === false`, so MU-4's `assert.equal(first.message, "● official [project] (updated)")` failed.
- **Fix:** Repurposed MU-4's byte/severity assertions to the no-op form (`(skipped) {up-to-date}`, warning, no trailer) while keeping its D-14 fetch/forceUpdateRef/checkout sequence assertions intact. This turned the existing test into the github-source no-op coverage the plan asked for. Added a separate github CHANGED test (manifest content differs via a `checkout` wrapper) and a path-source no-op test.
- **Files modified:** `tests/orchestrators/marketplace/update.test.ts`
- **Commit:** `52f53b9`

**2. [Rule 1 - Bug] Stale header/CMC-32 comments still described the old always-`(updated)` behavior**

- **Found during:** Task 1 (post-edit review).
- **Issue:** The module header comment block and the autoupdate-OFF inline comment still asserted `status: "updated"` for the no-op and referenced the retired `autoupdate-off-manifest-refresh` catalog fixture.
- **Fix:** Rewrote both to describe the content-compare detector and the `update-no-op-skipped` / `manifest-refresh-changed` split. Comment-only.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
- **Commit:** `52f53b9`

Note: the pre-commit `prettier` and `@stylistic/padding-line-between-statements` hooks reformatted/flagged two files (auto-fixed by prettier; one manual blank-line insertion before the second `notify`); restaged and re-ran until clean before committing per CLAUDE.md policy.

## Threat Model Outcome

- **T-27-05 (Tampering, manifest content read for the diff):** mitigated as designed -- `manifestContentKey` consumes only post-validation parsed content; a schema-invalid manifest throws inside `loadMarketplaceManifest` and routes to `(failed)`, never to the no-op `(skipped)` decision.
- **T-27-06 (Cryptography misuse, optional SHA):** avoided -- chose `JSON.stringify` of the validated parse over a `node:crypto` SHA, so no crypto primitive is used for change detection at all.
- **T-27-SC (package installs):** n/a -- no package installs; no new dependencies.

No new security surface introduced.

## Verification

- `npm run typecheck` exit 0 (Task 1 gate).
- `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts tests/orchestrators/marketplace/update.test.ts` exit 0 -- 83/83 (Task 2 gate).
- `npm run check` exit 0 -- 1146/1146 (Task 3 / phase gate).
- `npm run test:integration` exit 0 -- 4/4 (the deferred `fold-adoption.test.ts` phase-1 failure did NOT recur).
- `PI_CM_E2E_REF=pinned npm run test:e2e` exit 0 -- 14/14.
- `grep lastUpdatedAt update.ts` confirms `lastUpdatedAt` is still stamped (`= new Date().toISOString()`) and is NOT in the change decision.

## Commits

- `52f53b9` feat(27-04): render marketplace-update no-op as (skipped) {up-to-date}  (Tasks 1 + 2, UXG-05 atomic change)
- `ded3633` docs(27-04): flip nyquist_compliant + phase GREEN gate sign-off  (Task 3)

## Self-Check: PASSED

All 6 modified/created files present on disk; both task commits (`52f53b9`, `ded3633`) found in git history.
