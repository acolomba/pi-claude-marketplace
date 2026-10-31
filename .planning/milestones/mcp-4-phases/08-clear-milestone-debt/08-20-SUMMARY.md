---
phase: 08-clear-milestone-debt
plan: 20
subsystem: bridges-mcp
tags: [debt-02, mcp, refactor, is-plain-object]

requires:
  - "08-03: adapter-doc.ts store helpers, stage.ts `previous` build"
  - "08-10: adapter-entry.ts OAuth cleanliness check"
  - "08-13: stage.ts required env, collision walk, override-restored notices"
provides:
  - "`export function isPlainObject(value: unknown): value is Record<string, unknown>` in bridges/mcp/marker.ts, the MCP bridge's only definition"
  - "`readMarker` narrows with `isPlainObject` and holds no `as` cast"
affects: [08-21 (DEBT-02 ledger, records the declined ENOTDIR part)]

actuals:
  tokens: 1822
  tasks: 2
  commits: 2
plan_head_before: eb2304af4188a1dcbf1dc521987c9c1abe582f8a
plan_head_after: d45f5b5db18af278bc7617d7287789cbbd572db8

tech-stack:
  added: []
  patterns:
    - "One exported type guard per bridge, owned by the leaf module that has no sibling imports (marker.ts), so every bridge module can import it without a cycle"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts

key-decisions:
  - "The shared check stays in marker.ts, as the plan says. marker.ts imports nothing, so substitute.ts, stage.ts and legacy.ts can import it without forming a cycle. All six modules are in the bridges-mcp fallow zone."
  - "`readMarker` merges its first two guards into one `if`. The outcome is the same: a non-object or an object with no own marker key returns null."
  - "The optional third part of the finding (treat `ENOTDIR` as absent in stage.ts `readOptionalBytes`) is declined. A stage whose adapter path fails with `ENOTDIR` throws before it records a prior file. Treating `ENOTDIR` as absent would add a restore attempt on a path that cannot hold a file. 08-21 records this reason in the ledger."

patterns-established: []

requirements-completed: []

duration: 10min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 20: One shared isPlainObject in the MCP bridge Summary

**The MCP bridge now has one `isPlainObject`, exported from `bridges/mcp/marker.ts`. adapter-entry.ts, adapter-doc.ts, substitute.ts, stage.ts and legacy.ts import it and hold no private copy. `readMarker` uses it for both of its object checks, so its two `as` casts are gone. Behavior does not change. The six bridge suites pass unchanged, and direct coverage stays at 100% for all six pairs.**

## Performance

- **Duration:** about 10 min
- **Tasks:** 2/2
- **Files:** 6 modified (source only, no test change needed)

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P2 IN-03 part 1 (six private `isPlainObject` copies) | fixed: one export in marker.ts | 8578407a, d45f5b5d |
| P2 IN-03 part 2 (`readMarker` inline checks with `as` casts) | fixed: `isPlainObject` narrows, no casts | 8578407a |
| P2 IN-03 part 3 (`ENOTDIR` as absent in `readOptionalBytes`) | declined, reason in key-decisions; 08-21 records it | none |

## Task Commits

1. **Task 1 (tracer): one exported isPlainObject, used by readMarker and the entry and doc composers.** Commit `8578407a` (`refactor(mcp): share one plain-object check in the bridge`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed. Tracer gate: the verify block is automated only. It passed before the commit, and the fallow audit stayed `pass`.
2. **Task 2: the remaining bridge modules import the shared check.** Commit `d45f5b5d` (`refactor(mcp): import the shared plain-object check`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.

## Verification

- Task 1: `node --test` on the marker, adapter-entry and adapter-doc tests: `ℹ tests 175`, `ℹ pass 175`, `ℹ fail 0`. `npm run test:coverage:direct` for the three sources exited 0 with no shortfall.
- Task 1 acceptance: `grep -n "export function isPlainObject" .../marker.ts` prints line 41. The `awk` check for ` as ` in `readMarker` prints `0`.
- Task 2: `node --test` on the substitute, stage and legacy tests: `ℹ tests 228`, `ℹ pass 228`, `ℹ fail 0`. `npm run test:coverage:direct` for the three sources exited 0. `rg -n "function isPlainObject" extensions/pi-claude-marketplace/bridges/mcp` prints one line: `marker.ts:41:export function isPlainObject(...)`. The verify chain exited 0.
- `npx fallow audit --base "$(git merge-base origin/main HEAD)"` before each commit: verdict `pass`, 0 introduced, 8 duplication groups inherited, 0 dead code.

## Deviations from Plan

**1. Commit trailers missing on the Task 1 commit.** Commit `8578407a` has no `Co-Authored-By` or `Claude-Session` trailer. I left them out of the message by mistake. The project rules forbid `--amend` and history rewrites, so the commit stays as it is. The Task 2 commit and the SUMMARY commit carry both trailers.

No code deviations. The plan executed as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/mcp/marker.ts (exports `isPlainObject`)
- FOUND: 8578407a, d45f5b5d (both ancestors of HEAD)
