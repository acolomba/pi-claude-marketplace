---
phase: 03-background-subagents
plan: "07"
subsystem: agents
tags: [agents, pi-subagents, launch-mode, mcp, cucumber]
requires:
  - phase: 03-background-subagents
    provides: Corrected fresh MCP background warning (03-04) and the real pi-subagents child driver (03-06)
provides:
  - Converter that emits `async: true` only for an accepted `background: true` source or an effective plugin MCP grant, and no `async` key otherwise
  - Complete current-output expectations for conversion, grant forms, staging, install, update and reinstall
  - Real-companion acceptance of the default mode, a configured foreground default, and retained source and MCP forcing
affects: [03-08]
actuals:
  tokens: 14823
  tasks: 2
  commits: 2
plan_head_before: 81b7995d794ce38b5c5836751d3fb342c7e9c0c6
plan_head_after: 9ed5faf9154601a3033b4406e22818f5a736bae2
commits: 2
tech-stack:
  added: []
  patterns:
    - Generated launch preference is optional and true-only; pi-subagents and its user configuration own the ordinary default.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/grant-forms.test.ts
    - test/bridges/agents/stage.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - features/agent/frontmatter.feature
    - features/agent/invocation.feature
    - features/mcp-server/agent-grants.feature
    - features/step_definitions/plugin/subagent-hooks.steps.ts
key-decisions:
  - The default-mode scenario writes no pi-subagents configuration (`unset`), so it proves the companion's own default rather than an explicit `asyncByDefault: true`.
  - The configured-foreground proof lives in the forcing scenario as its ordinary-agent control, because a foreground child records no hook runs and the hook-runs step needs child rows.
  - Agents in the real-child scenarios keep an explicit non-MCP `tools:` list, because the driver's plugin writes a stub MCP server and an omitted list is MCP-forced to the background (D-CF6-10).
requirements-completed: ["PG-AGENT-01"]
coverage:
  - id: D1
    description: Ordinary absent, false and parser-rejected background values emit no async key, including an empty body; accepted true and quoted true emit async true; MCP grants force async true over background false and in either grant order with an unchanged warning; staged and installed files match.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/convert.test.ts test/bridges/agents/grant-forms.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Fresh update and reinstall output and pi-subagents' get results omit the generated false line; a real ordinary child runs in the companion's default background mode, runs in the foreground under a configured foreground default, and explicit background and MCP-granted children stay in the background.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/invocation.feature features/mcp-server/agent-grants.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/agent/frontmatter.feature features/agent/invocation.feature features/mcp-server/agent-grants.feature
        status: pass
    human_judgment: false
duration: "about 80 min from the base commit"
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 07: Delegated Launch Mode Summary

**A bridged agent now carries `async: true` only when its source asks for the background or it runs plugin MCP tools; every other agent leaves its launch mode to pi-subagents and the user's configuration.**

## Performance

- Base commit `81b7995d` (2026-11-13). Task commits at 2026-11-13T21:55:44Z and 22:14:47Z.
- Tasks: 2. Commits: 2.
- Files modified: 12. Measured patch: 59,291 characters / 4 = 14,823 estimate-scale tokens.

## Accomplishments

- `convert.ts` builds the frontmatter with `...((backgroundForMcp || isTrueBackground(raw.background)) && { async: true })`. The background parser and the MCP rule are unchanged. The doc comment now records D-PG3-01 amending D-CF4-05.
- `convert.test.ts`: the background table covers `true`, both quoted trues, `false`, `yes`, `TRUE`, mismatched quotes, empty and absent. The last six produce no `async` line. There is a new empty-body case, and an order case for each implementation: both grant orders give `async: true` and the same single warning. All 29 fresh expectations drop `async: false`.
- `grant-forms.test.ts`: the hand-written frontmatter builder takes an optional `async: true`. Both implementation forms stay complete.
- `stage.test.ts`: a new staging case writes a `background: false` agent with no launch key next to a `background: true` agent with `async: true`, comparing complete bytes. Eleven existing staged-byte expectations were updated. `install-flow-ledger.test.ts`, `update-swap.test.ts` and `reinstall-flow.test.ts` drop the false line from freshly written files. No historical fixture contained `async: false`, so none changed.
- `frontmatter.feature`:
  - "An ordinary bridged agent leaves its launch mode to pi-subagents" compares the full get results, which no longer contain `async false` for `demo:plain`, and the whole generated file.
  - "A call with no launch override runs the ordinary agent in the companion's default mode" (`@mcp`) has real pi-subagents run `demo:plain` as a detached background child with its configuration unset.
  - "Explicit background and MCP grants keep a child in the background" (`@mcp`) sets `asyncByDefault: false` and runs four agents. `runner` (`background: true`, Bash and Read), `granted` (MCP tool) and `forced` (MCP tool plus `background: false`) stay in the background. The ordinary `plain` agent runs in the foreground.
- `invocation.feature` (two get results) and `agent-grants.feature` (the plain-helper row) drop the generated false line. Every explicit `"async":false` call control and the D-PG1-03 foreground MCP cases are unchanged.

## Task Commits

1. **Task 1: Install one ordinary agent with delegated preference and preserve forced background cases**: `b9e82f914707475f9f830e49566404b9e77748db` (`feat(agents): leave an ordinary agent's launch mode to pi-subagents`)
2. **Task 2: Keep all current-output owners green and prove companion-selected default mode**: `9ed5faf9154601a3033b4406e22818f5a736bae2` (`test(agents): accept companion-chosen launch mode for ordinary agents`)

Both commits ran the normal hook, and `npm run check:commit` passed. Neither used `--no-verify` or `--amend`. Task 1's first commit attempt failed the hook's typecheck: the test table inferred `boolean | undefined` against the helper's optional `true`. No commit was made then. The fix was `as const` on the table and `true | undefined` in the helper, and the second attempt passed.

## Validation

All runs on Node v26.13.1, with pi-subagents 0.88.1 and pi-mcp-adapter 7.0.1 from `node_modules/.cache/optional-peers`. The final tree is `9ed5faf9`.

| Scope | Command / condition | Result |
|---|---|---|
| Task 1 RED | Owner set with updated expectations, before the producer change | Exit 1; 76 of 536 fail, each on a `+ 'async: false\n'` line. This includes the new staging case and "AGENT-01: fresh install preserves prefixed and unprefixed agent identities". `/tmp/pg3-07-task1-red.log` (per-file: `/tmp/pg3-07-task1-convert-red.log` 62 fail, `/tmp/pg3-07-task1-grant-forms-red.log` 3, `/tmp/pg3-07-task1-stage-red.log` 9) |
| Task 1 GREEN | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/convert.test.ts test/bridges/agents/grant-forms.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts` | Exit 0; 536 pass, 0 fail, cancelled or skipped. `/tmp/pg3-07-final-task1-owners.log` |
| Task 1 coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` | Exit 0 (100% direct gate). `/tmp/pg3-07-final-coverage.log` |
| Tracer gate | Task 1 verify run again after commit `b9e82f91` | Exit 0 both. `/tmp/pg3-07-task1-green.log`, `/tmp/pg3-07-task1-coverage.log` |
| Task 2 owners RED | update-swap and reinstall-flow with old expectations on the new producer, and again with the producer neutralized after the update | Exit 1; 6 of 497 fail on the generated false line. `/tmp/pg3-07-task2-owners-red.log`, `/tmp/pg3-07-task2-owners-red-neutralized.log` |
| Task 2 cucumber RED | Converter put back to `async: backgroundForMcp \|\| isTrueBackground(...)` in the working tree only, adapter, three features | Exit 1; 6 of 39 fail. The ordinary-agent scenario fails on `async false` in the get result. The default-mode scenario fails at "pi-subagents ran the real children like this" with `foreground / / none /` against `background / complete / recorded / first`. Four get-result scenarios fail on the false line. `/tmp/pg3-07-task2-cucumber-adapter-red-neutralized.log`; restored with `git checkout -- convert.ts` |
| Forcing scenario RED | MCP rule dropped (`isTrueBackground` only), working tree only | Exit 1; `demo:granted` is reported `foreground` instead of `background`. `/tmp/pg3-07-task2-cucumber-forcing-red.log`; restored |
| Task 2 owners GREEN | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Exit 0; 497 pass, 0 fail, cancelled or skipped. `/tmp/pg3-07-final-task2-owners.log` |
| Adapter behavior | `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/invocation.feature features/mcp-server/agent-grants.feature` | Exit 0; 39 scenarios, 547 steps passed (seed 386729). `/tmp/pg3-07-final-cucumber-adapter.log` |
| Builtin behavior | `npm run test:cucumber:profile -- --profile builtin` (same three features) | Exit 0; 14 scenarios, 192 steps passed (seed 934345). `/tmp/pg3-07-final-cucumber-builtin.log` |
| Regression sweep | Adapter: `features/agent`, `plugin/{reinstall,staging-warnings,component-directories,subagent-child}`, `skill/invocation`, `mcp-server/verdict-markers`, `marketplace/add` | Exit 0; 187 scenarios, 2369 steps passed. `/tmp/pg3-07-sweep-adapter.log` |
| Audit | `npx --no fallow audit --base 81b7995d` | Exit 0; no issues in 12 changed files |
| Wave gate | `npm run check` on the combined tree | Not run here; the orchestrator owns it. |

A probe before Task 2 (a scratch integration file, deleted afterward; `/tmp/pg3-07-probe.log`, `/tmp/pg3-07-probe2.log`) found two things. With its configuration unset, pi-subagents 0.88.1 detaches an ordinary agent. With `asyncByDefault: false`, it runs that agent in the foreground, inside the parent process, and records no child hook runs.

## Decisions Made

- The default-mode proof writes no configuration, so it shows pi-subagents' own default, not an explicit `asyncByDefault: true`.
- The foreground-default control is the fourth agent of the forcing scenario. A foreground child records no hook runs, so a scenario of its own would leave the hook-runs table empty, and the cucumber rules forbid a header-only table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale comment] `frontmatter.ts` said the converter always sets `async`**
- **Found during:** Task 1
- **Issue:** The emitter's field-order comment said "the converter always sets it, D-CF4-05". After this change that is false.
- **Fix:** It now says the converter sets only `true` (D-PG3-01, D-CF6-10). Comment only.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` (outside the plan's file list)
- **Commit:** `b9e82f91`

**2. [Rule 3 - Blocking] The real-child step accepted only `true` or `false`**
- **Found during:** Task 2
- **Issue:** The plan asks for the companion's default mode. The 03-06 step always wrote `asyncByDefault`, so it could not leave the configuration unset.
- **Fix:** The step also accepts `unset`, which writes no pi-subagents configuration. The existing `false` scenario is unchanged.
- **Files modified:** `features/step_definitions/plugin/subagent-hooks.steps.ts` (outside the plan's file list)
- **Commit:** `9ed5faf9`

### Other deviations and interpretations

- **Agent naming in the real-child scenarios:** I first named the MCP-plus-false agent `granted-false`. The 03-06 driver picks a launch script by substring, and `pg3-launch-demo:granted` is a prefix of `pg3-launch-demo:granted-false`, so the driver launched `demo:granted` twice. The agent is now named `forced`. The driver bug is not fixed here (scope boundary): its "ran the real children" agent column shows the driver's label, not what pi-subagents observed. A later change to the driver should match markers exactly.
- **Feature table alignment:** Each shortened get-result cell keeps its padding, so column alignment does not change. The one table where the removed text was the widest cell (the Skill pattern scenario) was realigned.
- **Historical fixtures:** None of the owned test files held a historical `async: false` fixture, so the migration fixtures were not touched. 03-08 owns the dedicated update and reinstall migration scenarios.

## Issues Encountered

- See the first Task 1 commit attempt above: the hook caught a type error, and no commit was made.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-17 is covered by the true-only emission, the parser table, the grant-order case and the configured-companion control. No package was installed and no dependency floor changed (T-03-SC).

## Self-Check: PASSED

- Commits `b9e82f914707475f9f830e49566404b9e77748db` and `9ed5faf9154601a3033b4406e22818f5a736bae2` are ancestors of HEAD (`git rev-parse` checked).
- Every modified file exists. Every plan verify command passed on the final tree. Each new acceptance check failed for its intended reason with production neutralized in the working tree, and the working tree was restored.

## Next Phase Readiness

Ready for the wave-5 combined-tree `npm run check`. 03-08 can add the update and reinstall migration scenarios for stored `async: false` files.
