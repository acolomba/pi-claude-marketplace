# Phase 68 Deferred Items

Out-of-scope discoveries logged during execution. Do NOT fix in this phase.

## Pre-existing flaky test (concurrency cleanup race)

- **Test:** `tests/orchestrators/marketplace/autoupdate.test.ts:674` --
  "D-UPD: setMarketplaceAutoupdate leaves a disabled plugin record untouched".
- **Symptom:** Intermittent `ENOTEMPTY: directory not empty, rmdir ...` under the
  full concurrent suite (`npm run check`). Passes in isolation and under
  `TEST_CONCURRENCY=1` (full serial run: 2438 pass, 0 fail).
- **Root cause:** The test's tmpdir cleanup `rm` races a fire-and-forget
  `persistMigratedState` write, the same race the `state-io.test.ts` harness
  already guards against with a retry loop (state-io.test.ts:39-53). This test
  file lacks that retry-cleanup.
- **Not caused by 68-01:** The optional-field + normalization threading added
  here does not change persist frequency (the `mutated` gate is untouched), and
  SPLIT-02 stays green (no new state.json writer).
- **Suggested fix (future):** Port the ENOTEMPTY retry-cleanup pattern from
  `state-io.test.ts` into the autoupdate test harness teardown.
