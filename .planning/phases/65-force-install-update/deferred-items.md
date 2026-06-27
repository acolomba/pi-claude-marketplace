# Phase 65 - Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed here.

## Flaky test under full-suite parallel run (pre-existing, unrelated)

- **Discovered during:** 65-02 (install --force) verification, `npm test`.
- **Symptom:** `D-UPD: setMarketplaceAutoupdate leaves a disabled plugin
  record untouched (state-side resources stay empty)`
  (`tests/orchestrators/marketplace/autoupdate.test.ts`) fails
  non-deterministically under the full `npm test` run (observed 1 then 2
  total failures across consecutive runs).
- **Evidence it is NOT caused by 65-02:**
  - Passes 20/20 in isolation (`node --test
    tests/orchestrators/marketplace/autoupdate.test.ts`).
  - Passes 106/106 when run concurrently with this plan's own changed test
    files (`autoupdate.test.ts` + `tests/orchestrators/plugin/install.test.ts`
    + `tests/edge/handlers/plugin/install.test.ts`).
  - Failure count is non-deterministic (a code regression would be
    deterministic); the assertion concerns marketplace autoupdate logic that
    the install `--force` gate-selection change cannot influence.
- **Suspected root cause:** the suite runs test files in parallel and many
  tests mutate the process-global `process.env.HOME` via `withHermeticHome`;
  a concurrent file's HOME override can race the autoupdate test's
  hermetic-home assumption.
- **Disposition:** out of scope for Phase 65 (pre-existing test-harness
  concurrency race). Candidate fix: isolate HOME per worker or serialize the
  affected files. Tracked here for a future test-hardening pass.
