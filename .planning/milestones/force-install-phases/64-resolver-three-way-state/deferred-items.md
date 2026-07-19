# Phase 64 - Deferred Items

Out-of-scope discoveries logged during execution. Not fixed in this phase.

## Flaky test: marketplace autoupdate hermetic-isolation race

- **Test:** `tests/orchestrators/marketplace/autoupdate.test.ts:674` -- "D-UPD:
  setMarketplaceAutoupdate leaves a disabled plugin record untouched (state-side
  resources stay empty)".
- **Symptom:** Intermittently fails ONLY under the full `npm test` suite
  (observed ~1 in 3 runs); passes deterministically in isolation (`node --test
  tests/orchestrators/marketplace/autoupdate.test.ts` -> 20/20). Verified clean
  at the parent commit because the added (fast, in-memory) resolver tests in
  Plan 64-01 perturbed concurrent test timing enough to surface a pre-existing
  latent race.
- **Root cause (suspected):** `withHermeticHome` temp-dir / global-state
  isolation under `node --test` concurrency, not a logic defect. The test uses
  NO resolver code -- it exercises `setMarketplaceAutoupdate` against a seeded
  `state.json` (`compatibility.installable` persisted boolean, out of Phase 64
  scope) -- so the three-way resolver refactor cannot have changed its
  behavior.
- **Disposition:** Out of scope for Phase 64 (resolver refactor). Belongs to the
  marketplace/test-infra owners. Fix likely needs per-test unique hermetic temp
  roots or reduced cross-file shared state.
