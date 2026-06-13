---
phase: 55-load-time-reconcile-apply-notification-wiring
plan: 03
subsystem: integration-tests
tags: [integration, recon-06, pitfall-52-2, pitfall-52-4, lock-coverage]

# Dependency graph
requires:
  - phase: 52
    provides: "migrateFirstRunConfig + buildConfigFromState + the D-13 ORDERING RAIL legacy-autoupdate preservation seam"
  - phase: 55-02
    provides: "applyReconcile public surface (ApplyReconcileOptions: ctx/pi/cwd/scope?/gitOps?) + per-scope read pass under withStateGuard"
provides:
  - "tests/integration/load-reconcile-race.test.ts -- RECON-06 + Pitfall 52-2 + Pitfall 52-4 lock-coverage proof (3 scenarios)"
  - "tests/integration/load-reconcile-race-child.ts -- forkable child entry point calling applyReconcile via stub ctx + stub pi over IPC"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall 10 race-stability discipline applied: state-consistency assertions (exactly-one mp record, exactly-one plugin record, no orphan staging dirs) instead of the brittle 'exactly one winner' shape (the read pass is microseconds-scale; both processes may report success against a converged plan)."
    - "Lock-held outcome accepted as NFR-2 soft-fail: a non-ok child must carry the StateLockHeldError marker substring; any other thrown shape is a test failure."
    - "Path-source marketplace fixture seeded inline (no git, no clone, no fixture copy) -- mirrors the seedMarketplace pattern from concurrent-install.test.ts but builds a full plugin tree (marketplace.json + plugin.json + SKILL.md) so the install pass can succeed network-free per NFR-5."

key-files:
  created:
    - tests/integration/load-reconcile-race.test.ts
    - tests/integration/load-reconcile-race-child.ts
  modified: []

key-decisions:
  - "Rule 1 (test stability fix): Scenario A's ok=true assertion relaxed to 'at least one ok=true; non-ok must carry STATE_LOCK_HELD_PREFIX'. Initial strict shape was test-internal (the plan's must-haves truth #4 explicitly allows the lock-held soft-fail). Without this relaxation the test flakes when the lock-loser's withStateGuard call throws StateLockHeldError -- the child's try/catch catches it (NFR-2 boundary preserved) but reports ok=false. The plan's `Both children exit code 0 (NFR-2 -- ...either succeed OR soft-fail-and-continue)` assertion criterion #5 is the authoritative shape; #1-#4 are the state-consistency assertions Pitfall 10 requires."
  - "Inline path-source fixture vs. fixtureMarketplaceDir reuse: the tests/orchestrators/marketplace/_fixtures/valid-marketplace fixture declares one plugin but ships NO plugin directory tree (only marketplace.json), so installPlugin would fail against it. Inline seeding (mirroring concurrent-install.test.ts seedMarketplace) builds the full plugin tree the install pass requires."
  - "seedStateRaw bypasses saveState's schema validator: STATE_SCHEMA (post-SPLIT-01) no longer declares the `autoupdate` field, so seeding the legacy field for Scenarios B/C requires writing state.json directly. The D-13 ORDERING RAIL in loadState (state-io.ts:200) preserves the field on the first load when existsSync(claude-plugins.json) is false -- migrateFirstRunConfig captures it before the next loadState's scrub fires."

patterns-established:
  - "Race-stability discipline: when the cross-process critical section is a fast read pass, assertions are state-consistency oriented (exact key counts + ownership invariants), NOT outcome-arbitration oriented. The 'exactly one winner' shape is reserved for cases where the lock arbitrates a long-running mutate (e.g. concurrent-install.test.ts) -- not for the microsecond-scale migrate-load-plan window in applyReconcile."

requirements-completed: [RECON-06]

# Metrics
duration: ~45m
completed: 2026-06-10
---

# Phase 55 Plan 03: Load-Reconcile Race Integration Coverage Summary

**Closes RECON-06 (two-process simultaneous-start race converges without double-apply or interleaved write) and discharges the Phase 52 deferred Pitfall 52-2 (concurrent first-load) + Pitfall 52-4 (D-13 gate race) obligation flagged at `tests/persistence/migrate-config.test.ts:29-39`. Zero new source surface in the extension -- pure integration coverage on the applyReconcile public surface that landed in Plan 02.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 1/1
- **Files created:** 2 (both new integration test files)

## Accomplishments

- **RECON-06 (Scenario A)**: two-process simultaneous-start race against a config declaring one path-source `mp-a` + `plugin-a@mp-a`; state empty. Both forked children call `applyReconcile`. State-consistency assertions per RESEARCH Pitfall 10: exactly one mp-a record, exactly one plugin-a record, no orphan `agents-staging` entries. Both children exit 0; at least one reports ok=true; any non-ok must carry the `STATE_LOCK_HELD_PREFIX` substring (NFR-2 soft-fail).
- **Pitfall 52-2 (Scenario B)**: two-process race against state pre-seeded with legacy `autoupdate: true` + ENOENT `claude-plugins.json`. After both children exit: config exists, parses cleanly, contains exactly one marketplace entry, `autoupdate` captured byte-stably (one process wrote it via the locked migrate; the other observed `valid` and short-circuited per migrate-config.ts's trichotomy). State still records the marketplace.
- **Pitfall 52-4 (Scenario C)**: single-process integration cover for the D-13 ORDERING RAIL. State pre-seeded with legacy `autoupdate: false` + ENOENT config; `applyReconcile` observes the gate at `loadState` time (before withStateGuard's closure runs), preserves the legacy field, captures it via migrate inside the locked closure, writes the config. Resulting `claude-plugins.json` carries `autoupdate: false`.
- **Forkable child harness (`load-reconcile-race-child.ts`)**: IPC `ready` signal on spawn; IPC `{ cwd }` payload as `go` signal; stub `ctx` accumulates `notify` args into an in-memory array; stub `pi` returns `getAllTools(): []`; calls `applyReconcile({ ctx, pi, cwd, scope: "project" })`; reports `{ ok, notifyArgs, message? }` over IPC; exits 0 in all cases (NFR-2 boundary preservation).
- **No-flake verification**: ran `tests/integration/load-reconcile-race.test.ts` 5 times back-to-back locally -- GREEN every time. The state-consistency assertion shape (Pitfall 10) is structurally race-stable; the lock-held soft-fail acceptance closes the timing window the original `ok=true` strict shape exposed.

## Task Commits

1. **Task 1: RECON-06 two-process race + Phase 52 deferred Pitfall 52-2/52-4 lock-coverage proof** -- `a5991a8` (test)

## Files Created/Modified

### Created (2)

- `tests/integration/load-reconcile-race.test.ts` -- 3 scenarios covering RECON-06 (Scenario A) + Phase 52 Pitfall 52-2 (Scenario B) + Phase 52 Pitfall 52-4 (Scenario C). 313 lines. Mirrors the fork + IPC + ready-sync harness in `tests/integration/concurrent-install.test.ts`; adapts assertions per RESEARCH Pitfall 10 (state-consistency oriented, not outcome-arbitration oriented).
- `tests/integration/load-reconcile-race-child.ts` -- forkable child entry point invoking `applyReconcile` via stub `ctx` + stub `pi` over IPC. 102 lines. Top-level `try/catch` ensures the child always exits 0 with a reported result message.

### Modified (0)

None -- pure test coverage, zero source surface change.

## Decisions Made

### Plan-Driven (not a deviation)

- **Path-source fixture for network-freeness**: per plan, the test uses a path-source marketplace (NOT github) so the test is fully network-free per NFR-5 and deterministic. The marketplace is seeded inline at the project cwd's `mp-src/` subdirectory.

### Rule 1 (Bug fix / test stability)

- **Relaxed Scenario A's `ok=true` assertion**: initial strict shape (`assert.equal(outcome.first.ok, true)`) failed on a lock-loser whose `withStateGuard` call threw `StateLockHeldError`. The child's `try/catch` catches it (NFR-2 boundary preserved) and reports `ok=false`. Updated the assertion to: at least one child must report `ok=true` AND any non-ok child must carry the `STATE_LOCK_HELD_PREFIX` substring. This matches the plan's authoritative criterion #5 -- "Both children exit code 0 (NFR-2 — neither process throws past its handler boundary; both either succeed OR soft-fail-and-continue)" -- and stays within the plan's "zero new source surface" constraint (the alternative would be adding a `StateLockHeldError` catch arm to `apply.ts`, which is out of scope for this plan).

### Rule 2 / Rule 3 / Rule 4

- None -- no missing critical functionality, no blocking-issue fixes, no architectural changes needed.

## Test Design Notes

### Why state-consistency assertions instead of "exactly one winner" (Pitfall 10)

The cross-process scope lock (`proper-lockfile` via `withStateGuard`) serializes only the read pass (migrate-then-load-then-plan). That read pass is microseconds-scale -- by the time the lock-loser acquires the lock and re-reads, the winner may have already completed its full apply pass, so the loser's plan is empty and its apply pass is a no-op. The loser reports success against a converged plan; asserting "exactly one winner" would flake.

The state-consistency assertions (exactly one mp record, exactly one plugin record, no orphan staging dirs) are race-stable: regardless of which process wins which lock acquisition, the final on-disk state is uniquely determined by the config declarations.

### Why Scenario C is single-process (not a race)

The D-13 gate race (Pitfall 52-4) is structurally closed by `withStateGuard`'s internal `loadState`: the `existsSync(configJsonPath)` probe happens inside `loadState` BEFORE the gated scrub fires; the closure then sees the in-memory state with `autoupdate` preserved. Two processes both calling `applyReconcile` either: (a) one wins the lock, captures+writes; the other observes `valid` and short-circuits (Scenario B's exact shape) -- the D-13 gate already CLOSED for the loser's probe; OR (b) one wins, but the loser's separate `loadState` probe still fires the gate-CLOSED arm (config absent at that moment) and preserves the field in-memory. Either way the single-process happy path (Scenario C) is the integration-level shape that proves the gate observation matches the data the same process operates on.

## Verification

- `tests/integration/load-reconcile-race.test.ts` -- 3/3 GREEN (RECON-06 + Pitfall 52-2 + Pitfall 52-4)
- 5/5 GREEN back-to-back local runs (no-flake verification)
- `tests/architecture/no-orchestrator-network.test.ts` -- GREEN unchanged (apply.ts intentionally absent from FORBIDDEN_TARGETS per the plan; not extended by this plan)
- `tests/architecture/config-state-write-seams.test.ts` -- GREEN unchanged (apply.ts intentionally absent from ALLOWED_CONFIG_JSON_WRITERS per the plan; not extended by this plan)
- `npm run check` -- GREEN end-to-end (1703 unit tests + 10 integration tests, 0 failures). Baseline was 1703 unit + 7 integration per Plan 02 SUMMARY; this plan adds 3 integration tests, takes integration count to 10.

## Threat Model Disposition

- **T-55-03-01 (Tampering / concurrent double-apply)**: MITIGATED. Scenario A asserts the post-condition state.json contains exactly one mp-a record + exactly one plugin-a record. The mitigation is structural (withStateGuard + proper-lockfile in apply.ts's read pass; per-orchestrator `withLockedStateTransaction` in the apply pass); the test empirically validates the convergence.
- **T-55-03-02 (Tampering / concurrent first-load overwrite)**: MITIGATED. Scenario B asserts the lock-covered migrate trichotomy: exactly one process writes the config; the other observes `valid` per Pitfall 52-5 and short-circuits. The autoupdate field is captured byte-stably (no double-merge, no field-loss).
- **T-55-03-03 (Denial-of-service / test flakiness from microsecond read-pass race)**: MITIGATED. Per RESEARCH Pitfall 10: state-consistency assertions instead of "exactly one winner"; the lock-held soft-fail outcome is accepted (with the marker-substring check) instead of asserted-against. 5/5 back-to-back local runs GREEN.
- **T-55-03-04 (Information disclosure / tmp leak between scenarios)**: MITIGATED. Each scenario uses its own `mkdtemp` tmp root with `rm({ recursive: true, force: true })` cleanup in the `finally` block. Mirrors the concurrent-install.test.ts fixture pattern.
- **T-55-03-SC (Tampering / package legitimacy)**: N/A. No new package installs; only existing peer/dev deps used.

## Threat Flags

None -- pure test coverage; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Known Stubs

None -- both test files are wired end-to-end and exercised by `npm run check`.

## Phase 55 Closure

This plan is the final wave of Phase 55:

- **Plan 01 (DONE)**: orchestrated-mode foundation across addMarketplace / removeMarketplace / uninstallPlugin / setPluginEnabled.
- **Plan 02 (DONE)**: atomic apply.ts + index.ts wiring + ReconcileAppliedCascadeMessage variant + catalog amendment + RECON-01/02/03/04/05 coverage.
- **Plan 03 (this plan)**: RECON-06 + Phase 52 Pitfall 52-2/52-4 lock-coverage proof.

All Phase 55 requirements (RECON-01..06) are now CLOSED. The Phase 52 deferred obligation (`tests/persistence/migrate-config.test.ts:29-39` hand-off to Phase 55) is DISCHARGED. Phase 55 is ready for `/gsd-verify-work` per the VALIDATION.md sign-off rubric.

## Self-Check: PASSED

Verified files exist:

- tests/integration/load-reconcile-race.test.ts -- FOUND
- tests/integration/load-reconcile-race-child.ts -- FOUND

Verified commit exists:

- a5991a8 (Task 1) -- FOUND
