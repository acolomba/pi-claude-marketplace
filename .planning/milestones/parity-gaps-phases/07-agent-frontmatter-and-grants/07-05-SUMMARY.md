---
phase: 07-agent-frontmatter-and-grants
plan: "05"
subsystem: bridges-agents
tags: [agents, tools, subagent, nesting, parity]
status: complete
requires:
  - "`Agent` and `Task` mapped to `subagent` in TOOL_MAP (plan 07-04)"
provides:
  - "`allowNestedSubagents?: true` on the omitted arm of `GeneratedToolsFields`, refused (`?: never`) on the explicit arm, and its emitted line after `excludeTools` (D-PG7-09)"
  - "`OmittedToolMapping.allowNestedSubagents`: true unless excludeTools holds `subagent`"
  - "`subagent` in AGENT_NAMEABLE_TOOLS of features/step_definitions/agent/runs.steps.ts"
affects:
  - every producer of a generated agent file with no tools list (install, update, reinstall, enable, apply, grants rewrite)
tech-stack:
  added: []
  patterns: ["a type arm that refuses a key with `?: never`, proved by a `@ts-expect-error` case"]
key-files:
  created:
    - .planning/phases/07-agent-frontmatter-and-grants/07-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/grant-forms.test.ts
    - features/step_definitions/agent/runs.steps.ts
    - features/agent/frontmatter.feature
    - features/agent/invocation.feature
    - test/integration/pi-subagents-child-launch-conformance.test.ts
    - docs/mcp-compatibility.md
decisions:
  - "D-PG7-09: an agent with no `tools`, or `tools: *`, gets `allowNestedSubagents: true` unless `disallowedTools` names Agent or Task (bare or with a type list), which writes `excludeTools: subagent` and no key"
  - "D-PG7-10: no depth key; pi-subagents' default depth of 2 stays"
metrics:
  completed: 2026-11-14
  tasks: 3
actuals:
  tokens: 27000
  tasks: 3
  commits: 3
plan_head_before: 21ae6201e101bdbb10c8d2f6694b1dd3052f5dc2
plan_head_after: 5082c4f7b168ca8dac77f6f7648df42de8f15469
---

# Phase 07 Plan 05: Nested delegation for an agent with no tools list Summary

An agent whose source has no `tools` field, or `tools: *`, now gets `allowNestedSubagents: true` in its generated file, so its child is offered pi-subagents' `subagent` tool and can start a second agent. A denied `Agent` or `Task` writes `excludeTools: subagent` and no key.

## Commits

| Task | Commit | Title |
|---|---|---|
| 07-05-01 | 30634616 | feat(agents): let an agent with no tools list start subagents |
| 07-05-02 | 1ac0738b | test(agents): prove the Agent deny and the nesting key |
| 07-05-03 | 5082c4f7 | docs(agents): record nested delegation and the depth difference |

None of the commits used `--no-verify`. The `npm run check:commit` hook ran and passed for 30634616 and 1ac0738b. 5082c4f7 stages no build input. Local Node is v26.13.1.

## Final shape of `GeneratedToolsFields` (plan 07-06 reads it)

```typescript
export type GeneratedToolsFields =
  | {
      readonly tools: readonly [string, ...string[]];
      readonly excludeTools?: never;
      readonly allowNestedSubagents?: never;
    }
  | {
      readonly tools?: never;
      readonly excludeTools?: readonly [string, ...string[]];
      readonly allowNestedSubagents?: true;
    };
```

The emitter writes `allowNestedSubagents: true` after `excludeTools` (or after `model`/`aliases` when nothing is excluded) and before `thinking`. In convert.ts, `OmittedToolMapping` has `allowNestedSubagents: boolean = !excludeTools.includes("subagent")`. `toolsFields` spreads `excludeTools` and the key into the omitted arm.

## Task 07-05-01

Red run, on the tree plan 07-04 left (21ae6201), with `subagent` already added to AGENT_NAMEABLE_TOOLS and the new scenario added. Command: `npm run test:cucumber:profile -- --profile adapter features/agent/invocation.feature`. Result: exit 1, 11 scenarios (9 passed, 2 failed).
- "A run of an agent without a tools list offers the child the tools the session has" (not edited) failed. The child was offered `read, bash, edit, write` and the session was offered `read, bash, edit, write, subagent`.
- "A child of an agent without a tools list starts a second agent and gets its reply" failed. No model call of the helper appeared, and the parent got the lead's own reply.

Green runs after the change:
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts" test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts test/orchestrators/mcp/agent-grants-step.test.ts`: 1301 passed, 0 failed (before the new cases). With the new owner cases, `test/bridges/agents/*.test.ts` also passed.
- `npm run test:coverage:direct -- .../frontmatter.ts .../convert.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/agent features/mcp-server/agent-grants.feature`: exit 0, 80 scenarios (80 passed), 1163 steps.
- `npm run test:cucumber:profile -- --profile builtin features/agent/frontmatter.feature features/mcp-server/agent-grants.feature`: exit 0, 14 scenarios (14 passed), 192 steps.
- `node scripts/install-test-peers.mjs && node --import ... --test test/integration/pi-subagents-child-identity.test.ts test/integration/subagent-hook-ownership.test.ts test/integration/provenance-invisibility.test.ts`: 14 passed.
- `npm run check:features`: exit 0.

The offered-tools step was not made order-free. The session and the child list `subagent` in the same place, so A5 held.

Compile-time proof: `D-PG7-09: refuses allowNestedSubagents beside an explicit tools list` in test/bridges/agents/frontmatter.test.ts has a `@ts-expect-error` over `{ tools: ["read"], allowNestedSubagents: true }`. When I removed the key in the working tree, `tsc` reported `TS2578: Unused '@ts-expect-error'`, so the directive catches exactly this key. I restored the file.

New owner cases: three in frontmatter.test.ts (order after excludeTools, order after aliases/model, and the type proof). There are eleven in convert.test.ts, under `D-PG7-09 nested delegation of an agent with no tools list`: no tools, `*`, deny Bash, deny Agent, Task, Agent(x), and Task(a, b), explicit `Read` and `Read, Agent`, and no tools with an MCP server (both the key and `async: true`).

Pins changed. Each gained exactly the one line `allowNestedSubagents: true`, and no text with a `tools:` line changed:
- test/bridges/agents/convert.test.ts: 17 blocks. 10 template pins gained the line. 7 `expectedMcpAgentFile` pins changed `toolsField: "excludeTools: X"` to `"excludeTools: X\nallowNestedSubagents: true"`.
- test/bridges/agents/grant-forms.test.ts: 1 case (2 `expectedFrontmatter` calls gained `toolsLine: "allowNestedSubagents: true"`). This file is outside files_modified.
- features/agent/frontmatter.feature: 8 doc strings, at the old lines 50, 152, 185, 277, 310, 722, 898, and 1008. That is the five the plan named, plus the unparseable-agent output (722) and the two rename outputs (898, 1008). The earlier-release input texts did not change.
- test/bridges/agents/stage.test.ts: not red, not changed.

## Task 07-05-02

- Conformance cases, in test/integration/pi-subagents-child-launch-conformance.test.ts. `ChildLaunchInput` gained `allowNestedSubagents?: boolean`.
  - "PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools" reads the `allowNestedSubagents` line from `convertAgent` output. It passes the line to `buildInProcessChildLaunch` as `value === "true"`. Measured: `tools: undefined`, `fanoutChild: true`, `MCP_DIRECT_TOOLS` an own key with no value.
  - "PG-AGENT-03: the exclude list written for a denied Agent authorizes no fan-out" reads `excludeTools` from `convertAgent` output. Measured: `fanoutChild: false`.
  - The file has 10 tests and all 10 pass, on pi-subagents 0.88.1.
- Red check of the first case: I passed the key as `allowNestedSubagent` in the working tree. The run had 9 passed and 1 failed, with `fanoutChild: false` against `true`. I restored the file, and it then had 10 passed.
- Scenarios:
  - "An agent without a tools list that disallows Agent or Task shows the subagent tool as excluded" is in frontmatter.feature. It has agents with `disallowedTools: Agent` and `Task(helper)`. Both show `excluded tools subagent` and `inherit skills true`.
  - "A child of an agent that disallows Agent cannot start a second agent" is in invocation.feature.
- Red check of both scenarios: the omitted arm skipped any disallow token whose TOOL_MAP name is `subagent`, in the working tree only (one line in convert.ts). Result: exit 1, 2 scenarios (2 failed). The `subagent get` table lost `excluded tools subagent`. In the child scenario, the helper ran, and the model was called past the end of its script (call 5). I restored the file with `git checkout -- extensions/.../convert.ts`. `git diff --quiet HEAD -- extensions` then exited 0.
- Green: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/invocation.feature`: exit 0, 39 scenarios (39 passed), 568 steps. `npm run check:features`: exit 0.

## Task 07-05-03

docs/mcp-compatibility.md:
- The first conversion rule now gives the remeasured foreground list and names the key.
- A new paragraph before the inherit passage covers D-PG7-09: the deny, `subagent get`, and the next update or reinstall. It cites the four scenario titles, and each title exists in its file.
- "Divergences and documented absences / Agents" has two new items: the depth (D-PG7-10) and the unparseable agent (D-PG7-04, D-PG7-09).

`SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md` passed and rewrote nothing. `npm run test:cucumber:profile -- --profile adapter features/agent/invocation.feature` passed: 12 scenarios (12 passed).

How I measured the foreground tool list: for a throwaway run, I added a `process.stderr.write` of every tool name of the child call to the offered-tools step. I also added that step to "A foreground agent without a tools list runs without the plugin's MCP tools (D-CF6-10)" in features/mcp-server/agent-grants.feature, under the adapter profile. Then I ran `git checkout` on both files, and none of it was committed. The run passed (1 scenario). On pi-subagents 0.88.1 and pi-mcp-adapter 7.0.1, the child was offered `read, bash, edit, write, bg_wait, subagent, contact_supervisor, subagent_supervisor`.

## Deviations from Plan

1. **[Rule 3] More pins than planned.** The plan expected five doc strings in frontmatter.feature. Eight needed the line, because the unparseable agent and the two rename outputs also have no tools list. test/bridges/agents/grant-forms.test.ts, outside files_modified, also pinned such a file. The plan's "another owner test that the verify block shows red" clause covers it.
2. **The guard scenario's calls table shows no refused call.** The lead child's call 2 plays the `subagent` row. That tool is not offered to it, and the scenario's offered-tools step shows `read, bash, edit, write`. The lead's next model call (call 3) holds only the task message, with no tool call or "not found" result. The model call log does not record the refusal, so the scenario proves it in three ways:
   - the child's offered tools have no `subagent`;
   - call 3 runs on the lead's body (the body step);
   - no helper call appears, and the parent gets `subagent returned: The README has no problems.`
3. **The guard scenario drops the last script row** of the nested script (`The lead found no problems.`). With the deny, the run uses one model call less, and the harness fails on a script row that no call uses.
4. A new `describe` block in convert.test.ts holds the cases, not the existing D-PG7-08 block.

## Override candidate for criterion 3

pi-subagents 0.88.1 prints no line for `allowNestedSubagents` in `subagent get`. So for an agent with no `tools` field, criterion 3's `subagent get` wording cannot be met as written. The proof is the nested call, the offered-tools scenario, and the staged file text. The verifier reads this clause as an override candidate, not as a gap. For a denied agent, `subagent get` does show `excluded tools subagent`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-15: the deny goes through `excludeTools: subagent`, and the type refuses the key beside an explicit list (owner cases, guard scenarios, `@ts-expect-error`). T-07-16 is stated on the compatibility page. T-07-17 is covered by the two conformance cases against pi-subagents' own launch code.

## Parent lines

For the orchestrator (not edited here):

- PROJECT.md decision rows:
  - D-PG7-09: an agent whose source omits `tools`, or lists `*`, gets `allowNestedSubagents: true`, unless `disallowedTools` names `Agent` or `Task` (bare or with a type list), which writes `excludeTools: subagent` and no key. The key is never written beside an explicit list. Upstream parity: such an agent has every tool, `Agent` included, in Claude Code.
  - D-PG7-10: no per-agent depth key. pi-subagents' default depth (2) stays, where Claude Code's default is 3. Accepted without review.
- CHANGELOG line: a plugin agent with no `tools` list can now start subagents, as in Claude Code, unless it disallows `Agent` or `Task`. Run `/claude:plugin reinstall` once for an installed plugin.
- Full gate still owed: the wave 5 `npm run check` on the worktree tree at 5082c4f7.

## Self-Check: PASSED

- FOUND: 30634616, 1ac0738b, 5082c4f7 (ancestors of HEAD)
- FOUND: every file in key-files.modified changed in 21ae6201..5082c4f7
