---
phase: 07-agent-frontmatter-and-grants
plan: "04"
subsystem: bridges-agents
tags: [agents, tools, subagent, model, parity]
status: complete
requires:
  - the YAML frontmatter reader and splitToolList of plans 07-01 to 07-03
provides:
  - "`Agent` and `Task` in TOOL_MAP, both mapped to pi-subagents' `subagent` (D-PG7-08, D-PG7-14, PG-AGENT-03)"
  - "`mapModel(raw, mapModelFlag)`, which writes `model: inherit` for a source inherit whatever the flag is (D-PG7-11, PG-AGENT-07a)"
  - "a capabilities projection (features/lib/upstream/subagents.ts) that keeps a written `inherit`"
  - "`convertedLine(raw, key)` in test/integration/pi-subagents-child-launch-conformance.test.ts, and `config.fanoutChild` in its ChildLaunchModule type"
affects:
  - every producer of a generated agent file (install, update, reinstall, enable, apply, grants rewrite)
tech-stack:
  added: []
  patterns: ["table entry plus owner proof that the existing split, deny, and AG-11 paths need no change"]
key-files:
  created:
    - .planning/phases/07-agent-frontmatter-and-grants/07-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - test/bridges/agents/convert.test.ts
    - test/integration/pi-subagents-child-launch-conformance.test.ts
    - features/agent/frontmatter.feature
    - features/agent/invocation.feature
    - features/lib/upstream/subagents.ts
    - docs/mcp-compatibility.md
    - README.md
    - README.es.md
decisions:
  - "`Agent` and `Task` map to `subagent`; the type list is never written and no `allowedAgents` or `allowNestedSubagents` key is written (D-PG7-08)"
  - "A source `inherit` (trimmed, any case) writes the literal `inherit` and records the source value as the original model, with and without `--map-model`, so the two files are byte-identical (D-PG7-11)"
metrics:
  completed: 2026-11-14
  tasks: 3
actuals:
  tokens: 12600
  tasks: 3
  commits: 3
plan_head_before: 8e188faf399b698961c8797ca86d6212cb7b1dc2
plan_head_after: f6c43709000ebd753baa7ff901102a8b1885e99d
---

# Phase 07 Plan 04: Agent and Task grants and the kept inherit Summary

An agent whose `tools` grants `Agent` or `Task`, with or without a type list, now gets pi-subagents' `subagent` tool and can start a second agent, and a source `model: inherit` is written as `model: inherit` with and without `--map-model`.

## Commits

| Task | Commit | Title |
|---|---|---|
| 07-04-01 | bf883f09 | feat(agents): map Agent and Task grants to the subagent tool |
| 07-04-02 | cf73c02a | feat(agents): keep a source model of inherit |
| 07-04-03 | f6c43709 | docs(agents): record Agent and Task grants and the kept inherit |

Each commit passed the hook without `--no-verify`. The `npm run check:commit` hook ran and passed for bf883f09 and cf73c02a; f6c43709 stages no build input, so the hook skipped it.

## Task 07-04-01: Agent and Task grants

Change: two entries in `TOOL_MAP` (`["Agent", "subagent"]`, `["Task", "subagent"]`) and a rewritten table doc comment citing D-PG7-08 and PG-AGENT-03. No other mapping code changed. The owner cases show why: `toolNameOf` reads `Agent(...)` as `Agent`, the explicit arm filters a deny by Pi name, the omitted arm puts a denied table name into `excludeTools`, and AG-11 no longer fires for `tools: Agent`.

Red run, on the tree plan 07-03 left (8e188faf), `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/invocation.feature`: exit 1, 34 scenarios (28 passed, 6 failed).

- The four Outline examples showed `tools read` with no `subagent`.
- The nested-call scenario: the lead child was not offered `subagent`, no model call of the helper appeared, and the parent got `subagent returned: The README has no problems.`, which is the lead's own reply.
- The denial scenario also failed in that run, but only because its expected table was still a placeholder. The measured output was already `tools read` for both agents, so it acts as a guard, as the plan expected.

Green run, after the change: `npm run test:cucumber:profile -- --profile adapter features/agent features/workflow/agent-restrictions.feature`, exit 0, 61 scenarios (61 passed), 877 steps (877 passed). `npm run check:features` exit 0.

Measured calls table of "A child of an agent that grants Agent starts a second agent and gets its reply" (plan 07-05 reuses it). The script rows are:

```text
| reply                         | tool     | arguments                                                         |
|                               | subagent | {"agent":"demo:lead","task":"Review the README.","async":false}   |
|                               | subagent | {"agent":"demo:helper","task":"Review the README.","async":false} |
| The README has no problems.   |          |                                                                   |
| The helper found no problems. |          |                                                                   |
| The lead found no problems.   |          |                                                                   |
```

The calls these rows produce:

```text
| 1 | user        | Ask the lead to check the README. |                                                     (parent, row 1)
| 2 | user        | task Review the README. |                                                               (lead, row 2)
| 3 | user        | task Review the README. |                                                               (helper, row 3)
| 4 | user        | task Review the README. |                                                               (lead, row 4)
| 4 | assistant   | tool call subagent {"agent":"demo:helper","task":"Review the README.","async":false} |
| 4 | tool result | subagent returned: The README has no problems. |
| 5 | user        | Ask the lead to check the README. |                                                     (parent, row 5)
| 5 | assistant   | tool call subagent {"agent":"demo:lead","task":"Review the README.","async":false} |
| 5 | tool result | subagent returned: The helper found no problems. |
```

The fixture plugin holds no MCP server. The lead's tools are `Read, Agent(demo:helper)` and the helper's are `Read`.

Other checks:

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts" test/orchestrators/plugin/discover-names.test.ts`: 492 tests, 492 passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts`: exit 0.
- `node scripts/install-test-peers.mjs && node --import ... --test test/integration/pi-subagents-child-launch-conformance.test.ts`: 7 tests, 7 passed, on pi-subagents 0.88.1. The new case "PG-AGENT-03: the tools written for an Agent grant authorize fan-out" gives session tools `["read","subagent"]` and `config.fanoutChild: true`. The case takes the tools line from `convertAgent` output, so it fails if the table maps `Agent` to another name.

## Task 07-04-02: kept inherit

Change: `mapModel(raw, mapModelFlag)`. A blank or absent value writes nothing. A value that is `inherit` after trimming and lower-casing writes `inherit` and records the source value, whatever the flag is. Any other value without the flag writes and records nothing, and with the flag it maps as before. `convertAgentOrEmpty` calls it once. `MODEL_MAP` is unchanged. The doc comments of `mapModel`, `ConvertAgentInput.mapModel`, the model step, and `StageAgentsInput.mapModel` (types.ts) name the exception and cite D-PG7-11 and PG-AGENT-07a. In features/lib/upstream/subagents.ts, `UNSET_PATTERN` is `/\b(?:default|ambient|inherits)\b/iu`, so a written `inherit` counts as a value.

Red run, on the tree after bf883f09, `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature`: exit 1, 26 scenarios (23 passed, 3 failed). Neither `subagent get` showed a `model` line, and the `--map-model` list row of `demo:inherit` had no `; model inherit`.

Green run: `npm run test:cucumber:profile -- --profile adapter features/agent`, exit 0, 59 scenarios (59 passed), 855 steps (855 passed). The scenario "Without --map-model every agent inherits the session's model" passed with its expected text unedited. `npm run check:features` exit 0. Both new scenarios show `model inherit` in `subagent get`.

Other checks:

- `node --import ... --test "test/bridges/agents/*.test.ts" test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts`: 1290 tests, 1290 passed.
- Direct coverage of convert.ts: exit 0.
- Conformance file: 8 tests, 8 passed. "PG-AGENT-07a: the model written for a source inherit is pi-subagents' inherit sentinel" checks that the written value equals `INHERIT_MODEL` from `src/runs/shared/model-resolution.js`.
- Owner cases: the `--map-model` table now expects `model: inherit` for `inherit`, `Inherit`, and ` INHERIT `, and nothing for `   `. A new table without the flag covers absent, empty, blank, the three inherit spellings, `sonnet`, `claude-opus-4-7`, and `gpt-5`. The byte-identity case compares the whole `fileContent` with and without the flag.

## Task 07-04-03: docs

docs/mcp-compatibility.md, "Customizing generated agents", has two new passages. The first covers Agent and Task grants, the deny, the type list that is not applied, and its effect (D-PG7-08). The second covers the kept inherit and the precedence (D-PG7-11). Each passage cites its scenario titles. Both READMEs gained one translated sentence in the note on models. `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md README.md README.es.md` passed, with no file rewritten. The cited scenarios passed in the green run of task 07-04-02 (no code changed after it).

## Deviations from Plan

**1. [Rule 3 - Blocking] Did not reformat the existing frontmatter table.** The `--map-model` list scenario's calls table was already out of alignment before this plan (its last row is shorter than its header). I added `; model inherit` to that one cell and left the alignment as it was. Cucumber and `check:features` accept it.

**2. The denial scenario's red run** failed only because its expected table was a placeholder. The measured output on the old tree was already the green output (`tools read`), as the plan predicted.

No other deviations.

## Flagged assumptions (from the plan)

- The original model is recorded for `inherit` without the flag, so the file is the same with and without `--map-model`. Nothing reads the record; it is provenance only.
- `excludeTools: subagent` for an agent with no `tools` that denies `Agent` or `Task`. The owner case pins it, and the conversion still returns the `excludeTools` floor warning until plan 07-06.
- A5 is not exercised here. The tools an agent can name do not gain `subagent` (plan 07-05).
- The `inherit` proof is `subagent get` plus the sentinel conformance. No scenario runs a child under a changed `subagents.defaultModel`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-13 is covered by the owner case with a comma, a space, and a line break inside `Agent(...)`. T-07-14 is covered by the model owner cases: only the fixed literal `inherit` is written without the flag.

## Parent lines

For the orchestrator (not edited here):

- PROJECT.md decision rows:
  - D-PG7-08: a `tools` entry `Agent` or `Task`, with or without a type list, maps to pi-subagents' `subagent`. The type list is not applied, and neither `allowedAgents` nor `allowNestedSubagents` is written beside an explicit list. Upstream parity: Claude Code does not apply the list inside a subagent.
  - D-PG7-11: a source `model: inherit` (trimmed, any case) is always written as `model: inherit`, with or without `--map-model`. Every other model still needs `--map-model`.
- CHANGELOG lines:
  - Agents whose `tools` grant `Agent` or `Task` can now start subagents through pi-subagents' `subagent` tool. Run `/claude:plugin reinstall` once for an installed plugin.
  - A plugin agent's `model: inherit` is now kept, so the agent runs on the session's model instead of `subagents.defaultModel`. Run `/claude:plugin reinstall` once for an installed plugin.
- Full gate still owed: the wave 4 `npm run check` on the worktree tree at f6c43709 (Node v26.13.1 locally).

## Self-Check: PASSED

- FOUND: bf883f09, cf73c02a, f6c43709 (ancestors of HEAD)
- FOUND: every file in key-files.modified changed in 8e188faf..f6c43709
