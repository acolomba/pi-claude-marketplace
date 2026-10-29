---
phase: 11-cleanup-split-and-docs
plan: "11"
subsystem: orchestrator-test-support
tags: [typescript, state-locks, tests, cleanup]
requires:
  - phase: 11-cleanup-split-and-docs
    plan: "03"
    provides: release-safe state-lock fixture for lifecycle owner tests
provides:
  - Ordinary plugin lifecycle held-lock tests use one release-safe fixture
  - Specialized lock observation and forced-unlock tests remain explicit
affects: [plugin-update, plugin-fetch, plugin-info, plugin-reinstall]
actuals:
  tokens: 3009
  tasks: 2
  commits: 2
plan_head_before: 6353d0e6a5c0d8710a17d272286dc3a060658264
plan_head_after: cdace01943ab566cad1396f57fb5dae2c5a8f3a3
tech-stack:
  added: []
  patterns:
    - Ordinary held-lock setup uses the action-scoped fixture; tests that inspect or break a lock use proper-lockfile directly.
key-files:
  created: []
  modified:
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
key-decisions:
  - Keep lock observation and forced-unlock coverage local because those cases exercise proper-lockfile internals rather than ordinary held-lock setup.
  - Use the concern-local test/orchestrators/state-lock.ts fixture created by Plan 11-03 instead of the obsolete test/helpers path in the plan context.
patterns-established:
  - Lifecycle owner tests use whileStateLockHeld when the only required behavior is holding the scoped state lock for an action.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: Update and fetch ordinary held-lock cases share the release-safe fixture without changing their assertions.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: node --test test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/fetch.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Info and reinstall ordinary held-lock cases share the release-safe fixture while lock-observation coverage remains explicit.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: node --test test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/reinstall-flow.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Static checks accept all four migrated owner modules.
    requirement: CLN-01
    verification:
      - kind: other
        ref: npm run check:static
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-10-28
status: complete
---

# Phase 11 Plan 11: Remaining State-Lock Test Migration Summary

**Plugin update, fetch, info, and reinstall tests now share one release-safe lock fixture for ordinary held-lock setup while retaining explicit specialized lock semantics.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-28T01:17:31Z
- **Completed:** 2026-10-28T01:25:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced five ordinary update lock holders and the fetch held-lock fixture with `whileStateLockHeld`.
- Replaced both ordinary info lock holders and the reinstall held-lock fixture with the same release-safe helper.
- Preserved the fetch lock-state and forced-unlock cases and the info lock-observing reader as explicit `proper-lockfile` coverage.
- Left production source and Phase 10-owned install-flow files unchanged.

## Task Commits

1. **Task 1: Migrate update and fetch held-lock cases** - `71d1eac6` (`refactor`)
2. **Task 2: Migrate info and reinstall held-lock cases** - `cdace019` (`refactor`)

## Files Created/Modified

- `test/orchestrators/plugin/update-flow.test.ts` - Uses the shared action-scoped fixture for all five ordinary held-lock windows.
- `test/orchestrators/plugin/fetch.test.ts` - Uses the shared fixture for lock contention and keeps lock observation and forced unlock explicit.
- `test/orchestrators/plugin/info.test.ts` - Uses the shared fixture for two contention cases and keeps the lock-observing reader explicit.
- `test/orchestrators/plugin/reinstall-flow.test.ts` - Uses the shared fixture and returns the refused outcome from the held-lock action.

## Decisions Made

- Kept fetch's `lockfile.check` and `lockfile.unlock` cases local. They verify when a production lock is held and how a compromised lock is reported, so routing them through a held-lock fixture would hide the behavior under test.
- Kept info's `lockObservingReader` local because it records the lock state at each real plugin file read.
- Imported the fixture from `test/orchestrators/state-lock.ts`, matching the Plan 11-03 project-policy adjustment.

## Deviations from Plan

None - the plan's stale `test/helpers/state-lock.ts` context was resolved through its required Plan 11-03 summary, which identifies the policy-compliant helper path.

## Issues Encountered

- CodeGraph could not open its database in this worktree, so narrow `rg` searches and targeted file reads supplied the lock-call trace before edits.
- The first sandboxed reinstall owner run failed because its existing FIFO fixture could not invoke `mkfifo`. The approved unrestricted rerun passed all 402 selected info and reinstall tests.
- The assigned worktree is outside the session's default writable root, so hooks, staging, commits, and the FIFO test rerun required approved worktree access.

## Verification

- Update and fetch owner modules: passed.
- Info and reinstall owner modules: 402 tests passed, 0 failed.
- `npm run check:static`: passed typecheck, lint, workflow lint, Fallow, formatting, source-test pairing, and feature checks.
- `fallow audit --base 6353d0e6a5c0d8710a17d272286dc3a060658264`: no issues in the four changed files.
- Repository commit hooks, including `npm run check:commit`: passed for both task commits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Every migrated case uses an existing hermetic scoped location and releases the held lock through the shared helper's `finally` path.

## User Setup Required

None - all lock paths come from existing hermetic test fixtures.

## Next Phase Readiness

The remaining ordinary plugin lifecycle lock setup is consolidated. Specialized lock-internal coverage remains explicit, and no production or install-flow dependency is introduced.

## Self-Check: PASSED

- Task commits `71d1eac6` and `cdace019` are ancestors of the plan head.
- All four modified owner-test modules exist.
- Both owner-suite selections, the static gate, the changed-file audit, and repository commit hooks passed.

---

*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-28*
