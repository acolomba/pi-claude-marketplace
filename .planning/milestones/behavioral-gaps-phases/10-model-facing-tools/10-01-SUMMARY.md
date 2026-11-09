---
phase: 10-model-facing-tools
plan: 01
subsystem: edge/handlers (model-facing tools)
tags: [tools, llm-tools, scope, filters, tool-errors, tdd]
status: complete
requires: []
provides:
  - pi_claude_marketplace_list takes an optional scope (D-BG-1002), still counting installed plugins (D-BG-1005)
  - pi_claude_marketplace_plugin_list returns an isError result for a marketplace no asked scope records (D-BG-1001, D-BG-1003)
  - the unavailable filter returns disabled installed plugins; reworded installed/unavailable descriptions (D-BG-1004)
  - every plugin-list block that keeps no rows reads "(no plugins)" (D-BG-1008)
affects:
  - 10-02 (TOOL-01..03 cucumber scenarios pin these behaviors through the scripted model)
tech-stack:
  added: []
  patterns:
    - conditional-spread forwarding of an optional TypeBox union parameter to the loader
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - test/edge/handlers/tools.test.ts
decisions:
  - The empty-block rule moved after the row loop, so one `kept.length === 0` check covers an unreadable manifest, a manifest with no plugin, and rows the filters dropped (D-BG-1008).
  - The unavailable bucket forwards `installed: true` only inside the narrowed spread; the passive (no-filter) path still forwards no flag (D-BG-1004).
metrics:
  duration: 26m
  completed: 2026-11-08
  tasks: 3
  files: 2
estimate:
  tokens: 70000
  tasks: 3
actuals:
  tokens: 5028
  tasks: 3
  commits: 3
plan_head_before: df430934a1eddfba71daa9a3e60977445fe084db
plan_head_after: f1bd73e9bfbf0e9b95707ddb9f33a9550af67f94
---

# Phase 10 Plan 01: Model-facing tool fixes Summary

The marketplace list tool takes an optional `scope`, the plugin list tool reports an unknown marketplace as a redacted `isError` result, its `unavailable` filter returns disabled plugins, and every empty block reads `(no plugins)`. Each fix landed test-first in `test/edge/handlers/tools.test.ts`, which keeps 100% direct coverage of `tools.ts`.

## Commits

| Task | Commit | Title | Hook (`npm run check:commit`) |
|------|--------|-------|-------------------------------|
| 1 | f136e248 | feat(tools): let the marketplace list tool take a scope | Passed |
| 2 | 7e8ac38e | fix(tools): report an unknown marketplace as a tool error | Passed |
| 3 | f1bd73e9 | fix(tools): return disabled plugins under the unavailable filter | Passed |

`actuals.tokens` is chars/4 over the realized diff (`git diff df430934..HEAD`, 20,112 chars). The estimate of 70,000 was a budget for the whole execution, so the two numbers are on different scales; the diff-only figure is recorded as measured.

## TDD record per task

### Task 1: scope on the marketplace list tool (D-BG-1002, D-BG-1005)

- RED (owner test, 46 tests, 4 failed against the pre-fix `tools.ts`):
  - `registers pi_claude_marketplace_list with its scope parameter` (schema was `{}`)
  - `narrows the list to the project scope when the scope parameter is set`
  - `narrows the list to the user scope when the scope parameter is set`
  - `reports no marketplaces configured when the named scope holds no record` (the tool ignored `scope` and listed the project record)
- GREEN: 46 tests, 46 passed, 0 failed.
- Direct coverage (`npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts`): exit 0 (100% line, function, branch).
- Cucumber `npx cucumber-js features/plugin/model-tools.feature`: `2 scenarios (2 passed)`, `20 steps (20 passed)`. Pi loads and validates the new schema.
- Tracer gate: the end-to-end verify (owner test, coverage, cucumber) passed before Task 2 started.

### Task 2: unknown marketplace as a tool error (D-BG-1001, D-BG-1003)

- RED (46 tests, 3 failed):
  - `looks for the named marketplace in the named scope alone`
  - `reports a marketplace that no scope declares as a not-found tool error`
  - `redacts a credential in the marketplace name it reports as not found`
- GREEN: 46 passed, 0 failed. Direct coverage: exit 0.

### Task 3: disabled plugins under the unavailable filter, one empty-block body (D-BG-1004, D-BG-1008)

- RED (46 tests, 4 failed), exactly the plan's prediction:
  - `registers pi_claude_marketplace_plugin_list with its filter parameters` (descriptions)
  - `narrows to the unavailable bucket when only unavailable is set`
  - `unions the available and unavailable buckets when both are set`
  - `renders the no-plugins body for a marketplace whose rows the filter empties`
  - `renders every bucket when no filter is set` passed before the change too, because no filter already shows a disabled plugin.
- GREEN: 46 passed, 0 failed. Direct coverage: exit 0.

## Grep gates

All the plan's acceptance greps hold at HEAD: `Scope whose marketplaces to list` present; `empty params` 0; `with an empty parameter schema` 0; `Set on the load-failure result only` 0; `D-BG-1001`/`D-BG-1003`/`D-BG-1004`/`D-BG-1008` present; `isError: true` in the test file 7; `buckets.i || buckets.u` present; `mp.plugins.length === 0` 0; `kept.length === 0` present; `renders the header alone` 0; `foxtrot` present; `buildMarketplaceListResult(pi, params, ctx)` present.

## tools.ts provenance for 10-02's natural red proofs

- Base `tools.ts` at commit `cdcc22df` has sha256 `61128bcda8545a880d177f62be373105c494d0581ddc12f874b9f52ee2182563`. The worktree file had the same hash when this plan started (HEAD `df430934`).
- `git log cdcc22df..HEAD -- extensions/pi-claude-marketplace/edge/handlers/tools.ts` lists only this plan's three commits (f136e248, 7e8ac38e, f1bd73e9). Nothing else changed `tools.ts`.
- `tools.ts` at HEAD `f1bd73e9` has sha256 `2cc360f9586dbc44f595dbf08194b70af554c40e6b289454d1bea0e57a15c1d1`.

## Deviations from Plan

None - plan executed exactly as written.

Notes that are not deviations:

- The doc comment of `installNetworkCounter` in the test file still says "28 of this suite's 53". The suite had 43 cases at the start and has 46 now, so that count was stale before this plan. It was left as is, as the plan says.
- Pre-commit and `git commit` ran as plain `git -C <worktree> ...` commands, because the session's shell guard refuses a `cd ... && git ...` chain.
- STATE.md and ROADMAP.md were not edited or committed: the orchestrator owns them. `.planning/STATE.md` carries the orchestrator's uncommitted edit, which this plan left untouched.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-10-01 (redaction of the not-found name) and T-10-02 (no throw) are pinned by the unit cases above. Every case still counts zero `https.request` calls (NFR-5).

## Dubious Choices

- Low: the empty-block rule now builds `{ ...mp, plugins: kept }` for a payload block that had no rows to start with, where the old code pushed `mp` itself. The two are equal for every field, but the block is now a copy.
- Low: `actuals.tokens` (5,028) measures the diff only, while the estimate (70,000) budgeted the whole run, so the ratio says little about the estimate's accuracy.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/handlers/tools.ts
- FOUND: test/edge/handlers/tools.test.ts
- FOUND: f136e248, 7e8ac38e, f1bd73e9 (ancestors of HEAD)
