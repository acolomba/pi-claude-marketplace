---
phase: 08-clear-milestone-debt
plan: 01
subsystem: info
tags: [fallow-audit, catalog-fixtures, adet-01, astat-02, mcp]

requires: []
provides:
  - "Fallow audit verdict `pass` with zero introduced clone groups (plugin-info fixtures share one hoisted row)"
  - "`/claude:plugin info` names pi-mcp-adapter on `requires:` only when the install writes at least one MCP server"
  - "`statusToken` reads `RUNTIME_STATUS_TOKENS[answer]` directly; the snapshot reader stays the only status guard"
affects: [08-21 ledger plan, fallow-audit Lint job]

actuals:
  tokens: 2660
  tasks: 3
  commits: 3
plan_head_before: a3576cfe1da1313cbcb7e5e74a1d762c9ccf1e08
plan_head_after: 10d7cb260afd90b8d7ded440fba435e325ab93ef

tech-stack:
  added: []
  patterns:
    - "Hoist a fixture row repeated across catalog states into a module-private `as const` constant and spread it"

key-files:
  created: []
  modified:
    - tests/architecture/catalog-uat/fixtures/plugin-info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
    - tests/orchestrators/plugin/info-mcp-status.test.ts
    - extensions/pi-claude-marketplace/platform/mcp-status.ts

key-decisions:
  - "The plugin-info clone groups were removed by refactoring, not suppressed: no ignoredClones key, no fallow-ignore marker (D-08-08)"
  - "The requires line counts only MCP entries with no unsupportedFeature, i.e. the servers the install writes (ADET-01)"

patterns-established:
  - "Fixture hoist: shared catalog rows live in one constant spread into each state"

requirements-completed: []

coverage:
  - id: D1
    description: "Audit lists no introduced clone group; verdict pass"
    requirement: "DEBT-01"
    verification:
      - kind: other
        ref: "npx fallow audit --base $(git merge-base origin/main HEAD) --format json"
        status: pass
    human_judgment: false
  - id: D2
    description: "requires line omits pi-mcp-adapter when every MCP server is left out, keeps it when one is written"
    requirement: "DEBT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#ADET-01: info names no pi-mcp-adapter when the install leaves out every MCP server"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#ADET-01: info still names pi-mcp-adapter when the install writes one of the plugin's MCP servers"
        status: pass
    human_judgment: false
  - id: D3
    description: "statusToken reads the token table directly; reader comment matches the loop"
    requirement: "DEBT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-mcp-status.test.ts + tests/platform/mcp-status.test.ts (69 pass) and direct coverage 100%"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-09
status: complete
---

# Phase 08 Plan 01: Fallow audit pass and info findings Summary

**The fallow audit now reads `pass` with zero introduced clone groups. The `requires:` line names pi-mcp-adapter only for MCP servers the install writes. `statusToken` drops a fallback that no answer could reach.**

## Performance

- **Duration:** about 13 min
- **Started:** 2026-10-09
- **Tasks:** 3/3
- **Files modified:** 6

## Findings closed

| Finding  | Disposition | Commit   |
| -------- | ----------- | -------- |
| P3 WR-05 | fixed       | 3735e30a |
| P3 IN-04 | fixed       | 9a8cf3a1 |
| P6 IN-01 | fixed       | 10d7cb26 |
| P6 IN-02 | fixed       | 10d7cb26 |

## Fallow audit verdict

- **Before** (`tmp/p8-01-audit-before.json`, base `369eaec3`): `verdict warn`, `duplication_introduced 2`. Introduced groups: `plugin-info.ts:8-26 / 31-49 / 55-73` and `plugin-info.ts:31-50 / 55-80`. These match the plan's interfaces block exactly.
- **After Task 1:** `verdict pass introduced 0 introduced-here 0`.
- **After Task 2 (with the two new tests):** `verdict pass introduced 0`.
- **Final, on HEAD 10d7cb26:** `verdict pass introduced 0 introduced-here 0` (exit 0).
- `.fallowrc.json` has no `ignoredClones` key (check exits 0). `rg fallow-ignore` on plugin-info.ts finds nothing.

## Task Commits

1. **Task 1: Hoist the shared commit-commands row** - `3735e30a` (test). Hook: pre-commit `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed; gitlint Passed.
2. **Task 2: The requires line names pi-mcp-adapter only for written MCP servers** - `9a8cf3a1` (fix). Hook: `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed; gitlint Passed.
3. **Task 3: Drop the unreachable status fallback and correct the comment** - `10d7cb26` (refactor). Hook: `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed; gitlint Passed.

## Verify results (final lines)

- Task 1: `npm run typecheck` printed no `error TS`. `catalog-contract.test.ts`: `ℹ tests 4 / ℹ pass 4 / ℹ fail 0`. Audit check: `verdict pass introduced 0 introduced-here 0`.
- Task 2: `info.test.ts` + `catalog-contract.test.ts`: `ℹ tests 217 / ℹ pass 217 / ℹ fail 0`. `npm run test:coverage:direct -- …/info.ts` exited 0, so info.ts has 100% direct coverage.
- Task 3: `info-mcp-status.test.ts` + `platform/mcp-status.test.ts`: `ℹ tests 69 / ℹ pass 69 / ℹ fail 0`. `npm run test:coverage:direct -- …/info-mcp-status.ts …/platform/mcp-status.ts` exited 0.

## TDD evidence (Task 2)

- `grep -c ADET-01 tests/orchestrators/plugin/info.test.ts`: 7 before, 9 after.
- RED: I ran the new cases against the old `(plugin.components.mcp?.length ?? 0) > 0` test. The all-`ws` case failed: the actual message had an extra `    requires: pi-mcp-adapter (missing)` line.
- GREEN: both cases pass after the `.some((server) => server.unsupportedFeature === undefined)` change.
- The mixed `ws` + stdio case cannot fail against the old code, because the old code also names the adapter there. It guards against an overly broad fix instead. I checked this with a local mutation: when every server had to be written (`.every(...)`), this case failed and the all-`ws` case passed. I then restored the file.

## Deviations from Plan

**1. [Rule 1 - plan wording] The second ADET-01 case does not fail against the old length test**
- **Found during:** Task 2
- **Issue:** The acceptance criterion says that each new case fails against the old length test. The second behavior (one written server still names the adapter) is what the old code already did, so the second case cannot fail against it.
- **Resolution:** I kept the case as the plan's behavior block specifies, recorded the RED failure for the first case, and showed with the `.every` mutation that the second case discriminates.

**2. Comment line break chosen for the acceptance grep**
- **Found during:** Task 3
- **Issue:** Wrapped at 80 columns, the phrase `read once after the check` fell across two lines, so the plan's grep found nothing.
- **Fix:** I reflowed the comment so the phrase sits on one line. The wording is unchanged.

**3. Unused import removed**
- Deleting the cast-only test block left `McpServerRuntimeStatus` unused in `info-mcp-status.test.ts`, so I removed that import.

**4. Requirements not marked complete**
- DEBT-01 and DEBT-02 cover the whole phase. The 08-21 ledger plan gates the overall DEBT-01 verdict on the final tree. This plan adds to both requirements but does not close either, so I did not run `requirements.mark-complete`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-08-01 is mitigated by the two ADET-01 cases. T-08-02 is accepted: `readSnapshot` in `platform/mcp-status.ts` still rejects any status outside the closed set before a lookup.

## Self-Check: PASSED

- All six modified files exist, and commits 3735e30a, 9a8cf3a1 and 10d7cb26 are ancestors of HEAD.
