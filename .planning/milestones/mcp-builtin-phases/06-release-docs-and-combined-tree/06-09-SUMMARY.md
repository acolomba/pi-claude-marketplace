---
phase: 06-release-docs-and-combined-tree
plan: "09"
subsystem: platform
tags: [soft-deps, mcp, snapshot, pi-api]

requires:
  - phase: 03-mcp-selection
    provides: every production reader moved from the adapter-loaded boolean to `mcpImplementation`
provides:
  - "`SoftDepStatus { piSubagentsLoaded; mcpImplementation; workflowEngineLoaded }`: the run snapshot's only MCP fact is the active implementation"
affects: [01-FROZEN.md frozen interface 2 (plan 06-13 records the change), codebase maps]

actuals:
  tokens: 18044
  tasks: 2
  commits: 1
plan_head_before: f8d1141bde8373586cc67e0e22ef24c04c4d6208
plan_head_after: aeb9c7e8aec3fcfb7a62f92863107ad51b3f799e

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - test/platform/pi-api.test.ts
    - test/shared/concerns/soft-dep.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/shared/notification-run-seeds.ts
    - test/orchestrators/plugin/install-flow-fixture.ts

key-decisions:
  - "D-P6-09 applied: `SoftDepStatus.piMcpAdapterLoaded` removed; no production reader existed, so no repointing was needed"

patterns-established: []

requirements-completed: [MSEL-01]

coverage:
  - id: D1
    description: "`SoftDepStatus` no longer carries the derived adapter-loaded boolean, and no file under extensions/, test/, features/, or scripts/ names it"
    requirement: MSEL-01
    verification:
      - kind: other
        ref: "git grep -c piMcpAdapterLoaded -- extensions test features scripts (exit 1, empty)"
        status: pass
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false
  - id: D2
    description: "Behavior unchanged: softDepStatus reads getCommands() once and getAllTools() three times in the same order"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/index.test.ts"
        status: pass
      - kind: unit
        ref: "test/edge/register.test.ts"
        status: pass
      - kind: unit
        ref: "test/shared/notification-run.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/no-factory-time-probe.test.ts"
        status: pass
      - kind: unit
        ref: "test/platform/pi-api.test.ts#MSEL-01 decides both MCP arms from one getCommands() read and three getAllTools() reads"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 09: Drop the Derived Adapter Flag from the Run Snapshot Summary

**`SoftDepStatus` now carries `piSubagentsLoaded`, `mcpImplementation`, and `workflowEngineLoaded` only; the derived `piMcpAdapterLoaded` boolean and its 254 test literal lines are gone, with the probe order unchanged (D-P6-09).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-05T02:01:13Z
- **Completed:** 2026-11-05T02:15:25Z
- **Tasks:** 2 (Task 2 is read-only verification)
- **Files modified:** 34 (1 production, 33 test)

## Accomplishments

- `platform/pi-api.ts`: deleted the `piMcpAdapterLoaded` member and its doc comment from `SoftDepStatus`, and the line in `softDepStatus` that produced it. `adapterLoaded = hasLoadedPiMcpAdapter(pi, commands)` stays, because `activeMcpImplementation` needs it, so the reads keep their count and order.
- Every test object literal that set the field lost that one line (sed on the `git grep -l` list at the base; the list matched the plan's 33 test files exactly, so no earlier wave added a file).
- Non-literal sites: the `McpImplementationRow` type member and the `for` destructure in `test/platform/pi-api.test.ts`, and the unused `adapterLoaded` row field in `test/orchestrators/reconcile/pending.test.ts` (see P6-DC-0901).
- T-06-20 mitigated: typecheck now rejects any reader of the old field, so no code can treat "adapter not loaded" as "no MCP".

## Cases deleted (old titles)

1. `test/platform/pi-api.test.ts`: the row loop `` MSEL-01 reports the adapter loaded exactly when it is the active implementation and ${situation} `` (11 generated cases, one per `mcpImplementationRows()` row; the file's count went from 81 to 70).
2. `test/shared/concerns/soft-dep.test.ts`: `D-P3-08: ignores the adapter-loaded flag and reads the active implementation`.
3. `test/shared/concerns/soft-dep.test.ts`: `D-MB-07: ignores the adapter-loaded flag and reads the active implementation` (the file's count went from 83 to 81).

Every other case keeps its assertion. The `MSEL-01 decides ${mcpImplementation} when ${situation}` rows and the strict mock case `MSEL-01 decides both MCP arms from one getCommands() read and three getAllTools() reads` now deep-compare the remaining three fields.

## Task Commits

1. **Task 1: The run snapshot names its MCP implementation and nothing else about MCP** - `aeb9c7e` (refactor)
2. **Task 2: Prove the removal changed no behavior** - no commit (read-only verification; results below)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/pi-api.ts` - `SoftDepStatus` without the derived flag
- `test/platform/pi-api.test.ts` - row type, destructure, 54 literal lines, deleted row loop
- `test/shared/concerns/soft-dep.test.ts` - 28 literal lines, two cases deleted
- `test/orchestrators/reconcile/pending.test.ts` - literal line and the `adapterLoaded` row field
- `test/shared/notification-run-seeds.ts`, `test/orchestrators/plugin/install-flow-fixture.ts` - shared seeds, one line each per literal
- Literal lines only: `test/architecture/{background-update-notice,closed-set-enrollment,cross-surface-reason-parity,mcp-migration-notice,workflows-marker-coverage}.test.ts`, `test/orchestrators/{auth-host,import/execute,marketplace/background-pass,mcp/agent-grants-step,mcp/builtin-registration-step}.test.ts`, `test/orchestrators/plugin/{enable-disable,install-cascade.messaging,install-cascade,install-flow-ledger,install-flow-results,install-outcome,list-flow,reinstall-flow,reinstall.messaging,update-cascade,update-flow,update-swap}.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `test/shared/{notification-dispatch,notification-resolve,notification-run,notification-summary,notify-reasons}.test.ts`

No file outside the plan's `files_modified` changed.

## Checks

Node v24.22.1. All on the working tree that became `aeb9c7e`, or on `aeb9c7e` itself.

| Command | Exit | Duration | Sha | Counts |
| --- | --- | --- | --- | --- |
| `git grep -c piMcpAdapterLoaded -- extensions test features scripts` | 1 (empty) | <1 s | aeb9c7e | 0 files (base: 34 files) |
| `npm run typecheck` (Task 1) | 0 | 42 s | pre-commit tree | - |
| `npm run lint` (warm-up) | 0 | 194 s | pre-commit tree | - |
| `npm run check:static` | 0 | 63 s | pre-commit tree | 7/7 steps passed |
| `node --test` on each of the 31 touched `.test.ts` files, one at a time | 0 each | 112 s total | pre-commit tree | 3,035 tests, 0 fail |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts` | 0 | 2 s | pre-commit tree | 100% |
| `npm run test:coverage:direct -- test/shared/concerns/soft-dep.test.ts` | 0 | 1 s | pre-commit tree | 100% |
| `pre-commit run --files <34 files>` (SKIP=npm-check,trufflehog) | 0 | - | pre-commit tree | all passed or skipped, no fixer changes |
| commit hook `npm run check:commit` (all pairs: shared support staged) | 0 | not timed | aeb9c7e | Passed |
| `npm run typecheck` (Task 2) | 0 | ~15 s | aeb9c7e | - |
| `node --test test/index.test.ts` | 0 | 3 s | aeb9c7e | 48/48 |
| `node --test test/edge/register.test.ts` | 0 | 4 s | aeb9c7e | 332/332 |
| `node --test test/shared/notification-run.test.ts` | 0 | 1 s | aeb9c7e | 20/20 |
| `node --test test/architecture/no-factory-time-probe.test.ts` | 0 | 1 s | aeb9c7e | 1/1 |
| the four probe-count files together with `--test-reporter=./scripts/test-reporter.mjs` | 0 | 5 s | aeb9c7e | - |

The probe-count suites ran unchanged (none of the four files is in the diff).

## Owned parent lines

- 01-14 SUMMARY "Phase 6, snapshot" (remove the field once nothing reads it, 01-05 SUMMARY): **done** in `aeb9c7e`. No production reader was left, so nothing needed repointing.

## Decisions Made

- D-P6-09 applied as removal, not as an optional field first, so no window exists where a reader could still trust the flag (T-06-20).

## Deviations from Plan

None - plan executed exactly as written. The `pending.test.ts` row-field removal is within Task 1's "drop the field from ... the destructure" intent and is recorded as P6-DC-0901.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-13 records the interface change in 01-FROZEN.md (not edited here).
- The parent's wave gate runs `npm run check` on the merged wave.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

- **P6-DC-0901** (Low). In `test/orchestrators/reconcile/pending.test.ts` I also removed the row field `adapterLoaded` and its destructure, whose only use was the deleted `piMcpAdapterLoaded: adapterLoaded` line. Alternatives: keep it unused (fails `noUnusedLocals` and ESLint), or prefix it `_adapterLoaded` (dead data in the rows). Removing it matches the plan's intent that a case keeps its assertion and loses only the field.
- **P6-DC-0902** (Low). The plan says "delete the case that reported it equal to the implementation"; that case was a `for` loop that generated 11 tests, one per `mcpImplementationRows()` row, and I deleted the whole loop. Alternative: none sensible, because every generated case asserted only the removed field.
- **P6-DC-0903** (Low). I did not run `npm run test:coverage:direct:all` by hand. The environment note asks for it only when the hook prints "(no files to check)"; here the commit hook's `npm run check:commit` did run and passed, with all pairs because shared test support was staged. I also ran single-pair direct coverage for the two pairs whose cases changed (`pi-api`, `soft-dep`). Its duration was not timed.
- **P6-DC-0904** (Low). I kept the `softDepStatus` doc comment ("in the order the snapshot read them before it named the MCP implementation") and the helper name `runWithMcpAdapterLoaded` in `enable-disable.test.ts`. Both stay accurate: the comment describes the read order, and the helper sets `mcpImplementation: "adapter"`. Alternative: reword them, which would widen the diff for no behavior.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/platform/pi-api.ts` contains `mcpImplementation: ActiveMcpImplementation` (count 1) and no `piMcpAdapterLoaded`.
- Commit `aeb9c7e` is an ancestor of HEAD; `git rev-list --count f8d1141..aeb9c7e` = 1.

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
