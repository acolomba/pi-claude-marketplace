---
phase: 08-clear-milestone-debt
plan: 05
subsystem: shared, orchestrators
tags: [session-env, prune-rollback, avar-01, avar-03, d-02-19, nfr-2, nfr-3]

requires: []
provides:
  - "`applyMcpAdapterEnv` removes `CLAUDE_PROJECT_DIR` before it rethrows a failed cwd read; the reserved empty variable is still set first (AVAR-01, AVAR-03)"
  - "The partial-tail skip comments in `shared/session-env.ts` name the legacy `mcp.json` entries they guard"
  - "`holdsBytes` is one guarded lstat and read: `ENOENT`, `ENOTDIR` and `EISDIR` read as not this prune's write, so the D-02-19 refusal stands; other errors propagate"
  - "`PruneRestoreOps.readMetadata` (optional) injects the live read of the last byte check"
affects: [08-14 docs plan (P4 IN-07 docs half), 08-21 ledger plan (P4 IN-06, P4 IN-07 code half, P2 IN-08, P2 IN-09 closed here)]

actuals:
  tokens: 2878
  tasks: 2
  commits: 2
plan_head_before: 9c4678b2ce3be5024ab7ec6a2e6350c4f541361d
plan_head_after: b86ad6d318f5a411f772ed73bc0b66d3c7570738

tech-stack:
  added: []
  patterns:
    - "A failed cwd read clears the exported project before it propagates, the same as the marker skip."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - tests/shared/session-env.test.ts
    - tests/index.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - tests/orchestrators/plugin/prune-rollback.test.ts

key-decisions:
  - "`holdsBytes` takes its read through an optional `readMetadata` restore op. The race between `lstat` and the read, and a non-absence errno, cannot be reached through the real filesystem without it, and the rethrow branch needs a case for 100% direct coverage."

patterns-established: []

requirements-completed: []

duration: 7min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 05: Rare-path env and prune-rollback fixes Summary

**A cwd read that throws at session start now removes any earlier `CLAUDE_PROJECT_DIR` from Pi's process before the error propagates, so no MCP server reads a stale or inherited project (AVAR-01, NFR-2). A prune rollback whose adapter file vanishes or turns into a directory while it is read now gives the D-02-19 occupied-path refusal and no raw errno (NFR-3).**

## Performance

- **Duration:** about 7 min (2026-10-10T03:46Z to 03:53Z)
- **Tasks:** 2/2
- **Files modified:** 5

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P4 IN-06 | fixed: `applyMcpAdapterEnv` removes `CLAUDE_PROJECT_DIR` before it rethrows; both pinned cases now expect `undefined` | 34fdb040 |
| P4 IN-07 (code half) | fixed: the comment on `PARTIAL_MARKER_TAIL` and the JSDoc name the legacy `mcp.json` entries the skip guards. The docs half is plan 08-14 | 34fdb040 |
| P2 IN-08 | fixed: `holdsBytes` is one guarded `lstat` and read; `ENOENT`/`ENOTDIR`/`EISDIR` return false, other errors propagate | b86ad6d3 |
| P2 IN-09 | fixed: the failed-write case no longer defines the unused `link` override | b86ad6d3 |

## Task Commits

1. **Task 1: A throwing cwd read clears the project directory before it propagates.** Commit `34fdb040` (fix). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: The occupied-path refusal survives a race in holdsBytes, and the dead link stub goes.** Commit `b86ad6d3` (fix). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1: `node --test tests/shared/session-env.test.ts tests/index.test.ts`: `ℹ pass 57 / ℹ fail 0`. `npm run test:coverage:direct -- …/shared/session-env.ts …/index.ts` exited 0. The tracer gate re-ran the same `node --test` after the commit: `ℹ pass 57 / ℹ fail 0`.
- Task 2: `node --test tests/orchestrators/plugin/prune-rollback.test.ts tests/orchestrators/plugin/prune.test.ts`: `ℹ pass 82 / ℹ fail 0`. `npm run test:coverage:direct -- …/prune-rollback.ts` exited 0.
- Acceptance: `Reflect.deleteProperty` count in `applyMcpAdapterEnv` went from 1 to 2. `grep "/work/previous"` still shows the seeded values in both files. The `holdsBytes` body has no `pathExists` and has the `EISDIR` line. `sed -n 1280,1330p tests/orchestrators/plugin/prune-rollback.test.ts | grep "link:"` prints nothing. I used 1280-1330 because the failed-write case starts at line 1281 and ends past 1320.
- `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` after Task 2: verdict `pass`, 0 introduced, 12 inherited clone groups. The one demoted group is the pre-existing `tests/live-uat` canary clone (`no-added-lines`).
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## TDD evidence

The hook measures direct coverage for the staged pairs, so each task has one commit. I observed RED locally.

- Task 1 RED: with the flipped expectations and the old code, `ℹ pass 55 / ℹ fail 2`. Both flipped cases failed on `CLAUDE_PROJECT_DIR: "/work/previous"`.
- Task 2 RED: the old `holdsBytes` races only between its three calls, which no test can reach. As a mutation check I removed `EISDIR` from the caught codes: the new directory case failed (`ℹ pass 45 / ℹ fail 1`). I then restored the code.

## Coverage of the catch in holdsBytes

- `ENOENT`: the existing case "an adapter removed after the rollback reads the recorded unstage write stays absent with its backup" (the `lstat` throws).
- `ENOTDIR`/`EISDIR` operands: the new case "D-02-19: an adapter replaced by a directory during the last byte check is refused without a raw EISDIR". Its `readMetadata` removes the file, creates a directory and reads it, so the real filesystem raises `EISDIR`.
- Rethrow: the new case "NFR-3: a read error other than a vanished or replaced adapter propagates from the last byte check" (`EACCES` from `readMetadata`).

## Deviations from Plan

**1. [Rule 3 - Blocking] The existing "adapter removed" case did not give 100% direct coverage**
- **Found during:** Task 2
- **Issue:** With only the existing case, direct coverage of `prune-rollback.ts` was `branches 120/123, lines 457/460`. The `ENOTDIR` and `EISDIR` operands and the rethrow were not reached. The triage said the existing case would cover the catch. It covers only the `ENOENT` path.
- **Fix:** I added an optional `readMetadata` member to `PruneRestoreOps`. It sits beside `link`, `inspectBackup` and `writeMetadata`, and only `holdsBytes` reads it. Production passes `readFile`. Two cases use it: the directory race that the plan's behavior names, and the rethrow. A chmod-based `EACCES` would also block the state restore in the same scope and does not fail as root, so I did not use it.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, tests/orchestrators/plugin/prune-rollback.test.ts
- **Commit:** b86ad6d3

**2. Requirements not marked complete**
- DEBT-02 covers the whole phase. Plan 08-21 owns the phase-wide verdicts.

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** one optional, internal restore op. No new export, file or user-visible change.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-13: `applyMcpAdapterEnv` removes `CLAUDE_PROJECT_DIR` before the rethrow. The flipped cases in `tests/shared/session-env.test.ts` and `tests/index.test.ts` pin it.
- T-08-14: the vanished and directory cases both give the occupied-path refusal, and the rollback writes nothing. The `write-file-atomic` restore is unchanged.

## Next

Ready for 08-06.

## Self-Check: PASSED

- All five modified files exist.
- Commits 34fdb040 and b86ad6d3 are ancestors of HEAD.
