---
phase: 08-clear-milestone-debt
plan: 08
subsystem: orchestrator tests (enable, import, install, reinstall), Pi inventory seeds
tags: [d-08-03, avar-04, avar-05, debt-04, debt-02, tests]

requires: []
provides:
  - "A pinned enable case: with pi-mcp-adapter loaded, enabling a plugin whose servers read an unset variable and a withheld credential renders the info `(installed)` row with no summary line or marker, then the two MCP notices as separate warnings (D-08-03)"
  - "A pinned import case with the same shape: `(installed)` row at info with no marker, `Import: 2 successes`, then the two warnings (D-08-03)"
  - "`toolInventoryItem(name)` in tests/platform/pi-inventory-seed.ts, used by the install-flow, enable-disable and reinstall-flow tests (P1 IN-05)"
affects: [08-14 catalog sentence for D-08-03, 08-21 ledger plan (MCPROW-01 ready to close; P1 IN-05 closed here)]

actuals:
  tokens: 3800
  tasks: 2
  commits: 2
plan_head_before: 16db6c739e037a86e3466d6198429d9527561c7f
plan_head_after: 6a85e0109325b5ae179ec3904e39f5fdee668907

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/platform/pi-inventory-seed.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts

key-decisions:
  - "The two import cases share one seed (`seedVariableNoticePlugin`) and one expected notice list (`variableNotices`), so the new case adds no clone group; the fallow audit stays `pass` with 0 introduced groups."

patterns-established: []

requirements-completed: []

duration: 14min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 08: Adapter-loaded enable and import shapes, and one tool-inventory seed Summary

**With pi-mcp-adapter loaded, enable and import of a plugin with an unset variable and a withheld credential now have pinned tests: an info `(installed)` row with no `{requires ...}` marker, then `MCP server variables not set.` and `MCP server credentials withheld.` as separate warnings. No renderer changed. One `toolInventoryItem` seed replaces three private `toolInfo` helpers.**

## Performance

- **Duration:** about 14 min (2026-10-10T04:06Z to 04:20Z)
- **Tasks:** 2/2
- **Files modified:** 5 (all under `tests/`)

## Observed shape (D-08-03 operator ruling check)

The current adapter-loaded output matched the ruling's description on the first run, so no blocker was raised and no renderer changed:

- Enable (user scope, plugin `foo`): `● mp [user]\n  ● foo v1.2.3 (installed)\n\n/reload to pick up changes` with no severity (info), then the two notices at `warning`.
- Import (project scope, plugin `hello`): `● fixture-mp [project] (added)\n  ● hello (installed)\n\nImport: 2 successes\n\n/reload to pick up changes` with no severity, then the two notices at `warning`.

The adapter-unloaded SEV-01 shapes are unchanged: the integration enable case in `tests/integration/mcp-variable-expansion.test.ts` and the existing import AVAR-04 case still pass with the `{requires pi-mcp-adapter}` marker.

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| MCPROW-01 (D-08-03, DEBT-04) | ready to close: the adapter-loaded enable and import shapes are pinned; SEV-01 is kept. Plan 08-21 closes it in BACKLOG.md and plan 08-14 adds the catalog sentence | f1a31171, 6a85e010 |
| P1 IN-05 (DEBT-02) | fixed: `toolInventoryItem(name: string): ToolInventoryItem` returns a fresh `{ name, sourceInfo: { source: "test" } }`; the three private `toolInfo` helpers and their now-unused `ToolInventoryItem` type imports are gone | 6a85e010 |

## Task Commits

1. **Task 1: Enable with pi-mcp-adapter loaded reports an info success row, then the notices as their own warnings.** Commit `f1a31171` (test). Pre-commit log: `PRECOMMIT_EXIT=0`. First `git commit` attempt: hook failed on ESLint `@typescript-eslint/no-dynamic-delete` (a `delete process.env[name]` in the env-restore loop), so no commit happened. Rewrote the restore as two explicit branches, restaged, and committed. Hook: `npm run check:commit` Passed (51 s).
2. **Task 2: Pin the adapter-loaded import shape and share one tool-inventory seed.** Commit `6a85e010` (test). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed, all pairs (shared test support staged), 119 s.

## Verify results (final lines)

- Task 1: `TMPDIR=/var/tmp/mcp4-p8-08 node --test tests/orchestrators/plugin/enable-disable.test.ts tests/integration/mcp-variable-expansion.test.ts` gave `ℹ tests 137`, `ℹ pass 137`, `ℹ fail 0`, exit 0.
- Task 2: `TMPDIR=/var/tmp/mcp4-p8-08 node --test tests/orchestrators/import/execute.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` gave `ℹ tests 592`, `ℹ pass 592`, `ℹ fail 0`, exit 0. `npm run typecheck` exit 0, 0 `error TS` lines.
- Acceptance: `grep -n "D-08-03"` prints enable-disable.test.ts:7238 and execute.test.ts:2034. `rg -n "function toolInfo\(name: string\): ToolInventoryItem" tests` prints nothing. `grep -n "export function toolInventoryItem" tests/platform/pi-inventory-seed.ts` prints line 32. `git show --name-only --format= f1a31171` lists only `tests/orchestrators/plugin/enable-disable.test.ts`.
- Audit: `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` gave verdict `pass`, `duplication_introduced: 0`, 10 inherited clone groups.
- No file under `extensions/` or `docs/` changed.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Mutation record

- Enable case: changed its expected row to `A plugin operation needs attention.` + the row at `"warning"`. The case failed (`ℹ pass 0`, `ℹ fail 1`). Restored the file from a backup; the case passed again.
- Import case: added ` {requires pi-mcp-adapter}` to its expected row. The case failed (`ℹ fail 1`). Restored; it passed again.

## Deviations from Plan

**1. [Rule 3 - Blocking] ESLint rejected the dynamic `delete` in the enable case's env restore**
- **Found during:** Task 1 commit hook
- **Fix:** two explicit `if` branches for `PI_CM_AVAR_SITE` and `ANTHROPIC_API_KEY`.
- **Commit:** f1a31171

**2. [Rule 2 - Duplication] Shared seed for the two import cases**
- **Found during:** Task 2
- **Issue:** the new import case would have repeated the existing AVAR-04 import case's 40-line seed and its notice literals.
- **Fix:** extracted `seedVariableNoticePlugin(t)` and `variableNotices()` in execute.test.ts. The existing case keeps all its assertions, including the sentinel-leak check. Its arrange comment moved to the seed's doc comment.
- **Commit:** 6a85e010

**3. Requirements not marked complete**
- DEBT-02 and DEBT-04 cover the whole phase. Plan 08-21 owns them.

**Total deviations:** 2 (lint fix, seed extraction). **Impact:** none on behavior; test-only.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-19: the two pinned cases fix the adapter-loaded enable and import shapes, and the unchanged integration case fixes the SEV-01 shape.

## Notes for later plans

- 08-14: the catalog sentence for D-08-03 can cite the two cases above.
- 08-21: MCPROW-01 is ready to close with commits f1a31171 and 6a85e010.
- `tests/platform/pi-inventory-seed.ts` now has both `toolInfo` (a full Pi `ToolInfo`) and `toolInventoryItem` (the probe's minimal view).

## Next

Ready for 08-09.

## Self-Check: PASSED

- All five modified files exist.
- Commits f1a31171 and 6a85e010 are ancestors of HEAD.
