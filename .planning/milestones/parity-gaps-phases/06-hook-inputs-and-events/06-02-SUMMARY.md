---
phase: 06-hook-inputs-and-events
plan: "02"
subsystem: hooks
status: complete
tags: [hooks, tool_use_id, cucumber, placeholders]
requires: []
provides:
  - "`tool_use_id` on the PreToolUse, PostToolUse, and PostToolUseFailure stdin"
  - "`editPairToolUseId` (bridges/hooks/tool-batch.ts)"
  - "features/lib/hook-run-tokens.ts: `hookRunTokens`, `HookRunTokenOf`, the `{tool use <n>}` and `{tool use <n>}#<m>` tokens"
affects: [06-04, 06-05]
tech-stack:
  added: []
  patterns:
    - "Whole-payload steps ask features/lib/hook-run-tokens.ts for a token per stdin member before the generic cell"
key-files:
  created:
    - features/lib/hook-run-tokens.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - features/step_definitions/hook/runs.steps.ts
    - features/step_definitions/hook/tool-use.steps.ts
    - 13 feature files (see the sweep section)
decisions:
  - "The pair suffix is `#<n>`, counted from 1; a one-pair edit keeps the bare toolCallId (D-PG6-05)"
  - "The token library answers by stdin key, so a later field changes only features/lib/hook-run-tokens.ts (D-PG6-12)"
metrics:
  duration: "~90 min"
  completed: 2026-11-14
estimate:
  tokens: 122000
actuals:
  tokens: 83625
  tasks: 2
  commits: 2
plan_head_before: a1f5461408e1e96445efecb5975bce6b3bed5b1b
plan_head_after: 7e357fd6454f5cb199e577b375d73848767ca2cb
---

# Phase 6 Plan 02: tool_use_id for the tool event hooks Summary

The three tool event hooks now get `tool_use_id`, Pi's `toolCallId` as Pi gives it, directly after `tool_input`. Each pair of a multi-pair native edit gets `<toolCallId>#<n>`. The scenarios state the id through a `{tool use <n>}` token that a new harness library builds.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-02-01 (tracer) | `b8ae60a7` | feat(hooks): send tool_use_id to the tool event hooks (26 files, +672/-304) |
| 06-02-02 | `7e357fd6` | feat(hooks): give each pair of a native edit its own tool_use_id (9 files) |

`git rev-list --count a1f54614..HEAD` = 2. Both commits passed the commit hook (`npm run check:commit ... Passed`). Each commit needed one retry: a hook lint failure stopped the first attempt, so no commit was made. The first failure was `import-x/order` in tool-use.steps.ts, and the second was `padding-line-between-statements` in dispatch.test.ts. I fixed the line, restaged it, and committed again. I never used `--amend` or `--no-verify`.

## Task 06-02-01: one id from a call's PreToolUse to its result hook

- Translators: `readonly tool_use_id: string` and `tool_use_id: event.toolCallId`, directly after `tool_input`, in all three. The header of post-tool-use-failure.ts now reads "`tool_use_id` is the call's own id, as on PreToolUse and PostToolUse; `duration_ms` is not sent (D-PG6-04)." No translator comment still says that the id is not sent. pre-tool-use.ts and post-tool-use.ts each gained one header sentence that cites D-PG6-04 and D-PG6-05. No translator takes a third parameter.
- `REQUIRED_EVENT_FIELDS`: `"toolCallId"` added to the PreToolUse, PostToolUse, and PostToolUseFailure lists.
- Payload owner cases (`deepStrictEqual` of the whole payload): ids `call-1` and `call-1/2` on each of the three translators. Each case also checks the key order (`tool_use_id` directly after `tool_input`) and that `Object.hasOwn` is false for `permission_mode`, `duration_ms`, and `mcp_server`. A child case on each translator checks with `Object.entries` that `agent_type` and `agent_id` still follow the new member. Every existing whole-payload expectation gained the id.
- Exec probe: in `TRANSLATOR_CASES` of dispatch-exec.test.ts, `toolCallId` is now a diagnosed omission on the three tool events. The case asserts the debug line `buildPayload: <event> event missing required field "toolCallId"` and that the translator still reaches the process. The benign control moved to `type`.
- Updated pins: test/bridges/hooks/dispatch-exec.test.ts (portable, stale-identity, and the three real-process cases), test/bridges/hooks/async-rewake/registry.test.ts (read-rewake, shared-owner, identity-absent, `IDENTITY_TOOL_EVENTS`, lifecycle `expectedStdin`), and test/integration/hooks-dispatch-end-to-end.test.ts (the child payload case).
- New scenario in features/hook/tool-use.feature: "A hook sees one tool use id before and after a call, and another on the next call". It uses existing steps only.

### Red and green of the new scenario

Red, on the unchanged production tree (the token library and the two step changes in place, no translator change):

```
npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature --name 'A hook sees one tool use id'
               + expected - actual
                    "tool name"
               +    "tool use id"
                    "tool input"
               ...
                    "Bash"
               +    "{tool use 1}"
               ...
                    "Bash"
               +    "{tool use 2}"
1 scenario (1 failed)
14 steps (12 passed, 1 skipped, 1 failed)
```

The actual table had no `tool use id` column, and every other cell matched. Green: the same scenario passed in the full adapter run below (188 passed).

### The sweep

The sweep script (`p0602-sweep.py` in the session scratchpad, not committed) adds the column after `tool name` and pads only the new column. Each tool row reads `{tool use 1}`, and every other row has an empty cell. It changed 101 tables, and the new scenario makes 102. To get the tokens of tables with several calls from the runs, I added a dump to `runsTable` behind an environment variable. The dump stayed in the working copy only: before each commit I restored runs.steps.ts from a saved copy and checked that no `p0602` text remained. Tables whose token is not `{tool use 1}` in every row:

| Table | Tokens |
|---|---|
| features/hook/configuration.feature:185 | 1, 2 |
| features/hook/matchers.feature:45 | 1, 2, 3, 4 |
| features/plugin/subagent-child.feature:227, 328, 427 (Outline), 462, 525 | 1, 1, 2, 2 (tool rows) |
| features/plugin/subagent-child.feature:492 | 1, 1, 2, 2, 3, 3 |
| features/hook/tool-use.feature:1242, 1272 (`@builtin-only`) | 1, 2, 2, 2 (tool_search is call 1) |
| features/hook/tool-use.feature (new scenario) | 1, 1, 2, 2 |

Tables per file: tool-use 55 (54 + new), tool-failure 12, mcp-tool-names 7, async 2, configuration 3, failures 1, lifecycle 2, matchers 5, messages 2, project-locality 1, project-trust 1, subagent-child 10, model-reads 1. The three complete-inputs tables (two in tool-use, one in tool-failure, six profile records) gained `,"tool_use_id":"{tool use 1}"` after `tool_input`.

Column-removal check (`p0602-check.sh`). It removes the `tool use id` column and the complete-inputs member, unpads every runs-table cell, and compares the result with the same projection of `a1f54614`:

```
DIFFER features/hook/tool-use.feature: 37 changed lines   (863a864,900 = the new scenario only)
EQUAL  features/hook/tool-failure.feature
EQUAL  features/hook/mcp-tool-names.feature
EQUAL  features/hook/async.feature
EQUAL  features/hook/configuration.feature
EQUAL  features/hook/failures.feature
EQUAL  features/hook/lifecycle.feature
EQUAL  features/hook/matchers.feature
EQUAL  features/hook/messages.feature
EQUAL  features/plugin/project-locality.feature
EQUAL  features/plugin/project-trust.feature
EQUAL  features/plugin/subagent-child.feature
EQUAL  features/skill/model-reads.feature
```

### Verification (task 1)

| Command | Result |
|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test` the three payload tests, dispatch-exec, async-rewake/registry, architecture/hooks-translators | 277 pass, 0 fail |
| `npm run test:coverage:direct --` the four sources | exit 0 (100%) |
| `node scripts/install-test-peers.mjs && node --import ... --test test/integration/hooks-dispatch-end-to-end.test.ts test/integration/hooks-spawn-end-to-end.test.ts` | 7 pass, 0 fail |
| adapter profile, the 13 features (first run, before the token fixes) | 188 scenarios, 15 failed: 12 multi-call token rows and the 3 complete-inputs tables |
| adapter profile, the 13 features | 188 scenarios (188 passed), 2732 steps passed |
| builtin profile, tool-use, tool-failure, mcp-tool-names, subagent-child | first run 2 failed (the two `@builtin-only` tool_search tables), then 27 scenarios (27 passed) |
| `npm run check:features` | exit 0 |

Acceptance greps: `tool_use_id` appears 3, 3, and 3 times in pre, post, and failure. `tool use id` appears 56 times in tool-use.feature and 12 in tool-failure.feature. `{tool use 2}` appears 8 times in tool-use.feature, and `Scenario` 65 times. No file under features/support/ is in either commit.

## Task 06-02-02: an id per pair of a multi-pair edit

- `editPairToolUseId(toolCallId, pairIndex, pairCount)` in tool-batch.ts returns the bare id for a one-pair edit, else `<id>#<pairIndex + 1>`. Its doc comment cites D-PG6-05. dispatch.ts calls it in `runEditPreflight` (from `nativeEvent.toolCallId`, `pair.index`, and `batch.pairs.length`) and in `runEditResultPairs` (from `event.toolCallId`, the map index, and `pairs.length`). The rule lives only in tool-batch.ts, and dispatch.ts has no `#` literal for it. The comment above `runEditPreflight` now says that each pair carries its own tool use id. The native event is not changed.
- Readers of a pair event's id: CodeGraph (`codegraph explore "toolCallId pairEvent runEditPreflight runEditResultPairs authorizeEditPairs adaptToolCallResult"`) finds only the two writers. `grep toolCallId extensions/` finds only the three translators (the new member) and an unrelated `_toolCallId` parameter in edge/handlers/tools.ts. `authorizeEditPairs` and `adaptToolCallResult` take the pair event but never read its id. No reader depends on the native id.
- Owner cases: tool-batch.test.ts covers `("call-1",0,1)` → `call-1`, `("call-1",0,2)` → `call-1#1`, `("call-1",1,2)` → `call-1#2`, and `("call-1/3",1,3)` → `call-1/3#2`. In dispatch.test.ts, the preflight case expects `dispatch-call#1` and `dispatch-call#2` in pair order and asserts that `event.toolCallId` is still `dispatch-call`. The result case expects `#1, #1, #2, #2` for two plugins on two pairs. A new case checks that a one-pair edit sends `dispatch-call` on both the preflight and the result.
- Token library: an id that ends in `#` and digits reads as the token of the id before the `#`, followed by the same suffix. First appearance is counted on the call id.
- Tables changed (token cells only): tool-use.feature 8 (627, 658, 690, 720, 744, 767, 791, and 819, an Outline with three examples), tool-failure.feature 2 (29, 59), async.feature 1 (30), failures.feature 1 (203), matchers.feature 0 (its edit has one pair). That is 12 of the 13 Edit tables, and I added no rows. features/hook/async.feature:30 states the pre runs and the result runs of one two-pair edit: `#1`/`#2` on the two PreToolUse rows and on the four PostToolUse rows.
- Red before the tables changed (adapter, the five features): 118 scenarios, 14 failed. The async table was one of them:

```
  9) Background edit hooks receive every translated pair # features/hook/async.feature:9
       Then the hooks record these runs in any order:
                 'Edit',
           +     '{tool use 1}#1',
           -     '{tool use 1}',
           ...
           +     '{tool use 1}#2',
           -     '{tool use 1}',
```

- Diff check: the same column-removal projection against `b8ae60a7` returns EQUAL for all five files.

### Verification (task 2)

| Command | Result |
|---|---|
| `node --import ... --test test/bridges/hooks/tool-batch.test.ts test/bridges/hooks/dispatch.test.ts` | 278 pass, 0 fail |
| `npm run test:coverage:direct --` tool-batch.ts dispatch.ts | exit 0 (100%) |
| adapter profile, tool-use, tool-failure, async, failures, matchers | 118 scenarios (118 passed), 1771 steps passed |
| builtin profile, tool-use, tool-failure (extra) | 10 scenarios (10 passed) |
| `npm run check:features` | exit 0 |

Node v26.13.1. I did not run `npm run check`, because the orchestrator owns the wave gate.

## Exported names of features/lib/hook-run-tokens.ts

- `hookRunTokens(runs: readonly HookRun[]): HookRunTokenOf` reads the turn's runs and returns the lookup.
- `type HookRunTokenOf = (key: string, value: unknown) => string | undefined` returns the token of one stdin member, or `undefined` when the member has none. Plan 06-04 adds the `duration_ms` key inside `hookRunTokens`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The wrong-shape dispatch-exec case needed a `toolCallId`**
- **Found during:** Task 1. The case `contains a wrong-shape payload whose required property throws as a runner failure` asserts that no "missing required field" line appears. With `toolCallId` now required, its event without an id would log that line.
- **Fix:** Added `toolCallId: "wrong-shape-call"` to that event, and moved the benign control of the three tool `TRANSLATOR_CASES` from `toolCallId` to `type`.
- **Files:** test/bridges/hooks/dispatch-exec.test.ts. **Commit:** b8ae60a7.

**2. [Rule 3 - Blocking] The plan commit ledger was not written**
- The git dir of this checkout is /home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-gaps, which is under a path the dispatch forbids. I wrote no ledger file there. I recorded the base `a1f54614` in the scratchpad and measured the commits from it.

### Other notes

- TDD order in task 2: I wrote the `editPairToolUseId` owner cases and the function in one step, so the tool-batch cases were not seen red on their own. The red came from the existing dispatch preflight case, which failed on the new ids before I updated it, and from the scenario run above.
- The payload cases add key-order assertions and `hasOwn` checks for `duration_ms` and `mcp_server` beyond the plan's `permission_mode`. The plan's behavior list asks for them.
- The fix script found that `features/hook/tool-use.feature:1302`, `1213`, `1136` and `tool-failure.feature:354` were already right. They are any-order tables with one call.
- No `gsd-tools windows append` was made, because no stubs, skipped tests, or unrun verifies remain.

## Flagged assumptions (repeated from the plan)

- PG-HOOK-04 / unclassified edge (unresolved). The edge probe proposed no edge. The edges covered by decision are listed in the plan, and the verifier reviews the list against D-PG6-04 to D-PG6-12.
- The pair suffix `#<n>`, counted from 1, is the planner's choice, because D-PG6-05 leaves the form open. An upstream id that ends in `#` and digits would read as a pair id in the test projection only. The product sends it unchanged.
- Key order: `tool_use_id` follows `tool_input`. I did not read Claude Code's order.
- Between the two commits, the pairs of an edit shared the call's id. No wave ends in that state.
- Size: the estimate was 122,000 tokens. The actual diff is 83,625 tokens (chars/4).
- The scenarios run on Linux only.

## Records for the orchestrator (parent-owned lines, not applied)

- `.agents/skills/cucumber/rules/features.md`, section "Run tokens". Add after the session-ordinal bullet:
  `- In the hooks runs step and the complete mcp inputs step, a tool use id reads as {tool use <n>}: the n-th distinct tool_use_id of the turn's runs, counted from 1 by first appearance. A pair of a native edit reads as {tool use <n>}#<m>, where m counts the pair from 1 (D-PG6-05, D-PG6-12). It differs from {tool call <n>}, which only the stub MCP server's messages step projects. A command never expands it.`
- `.agents/skills/cucumber/rules/layout.md`, the hook harness lists. Add `features/lib/hook-run-tokens.ts` (the tool use id token shared by the runs step and the complete mcp inputs step).
- PROJECT.md Key Decisions: add D-PG6-04 (send the fields; Claude Code 2.1.323, Pi 1.5.0), D-PG6-05, and D-PG6-12, each pending maintainer review. Append "Superseded by D-PG6-04" to the D-CF5-28 and D-BG-403 rows.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/lib/hook-run-tokens.ts
- FOUND: b8ae60a7 (ancestor of HEAD)
- FOUND: 7e357fd6 (HEAD)
- Working tree: only the untracked 06-01-SUMMARY.md and 06-S7-SPIKE.md of plan 06-01, which I did not touch, and this SUMMARY.
