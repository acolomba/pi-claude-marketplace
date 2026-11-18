---
phase: 07-agent-frontmatter-and-grants
plan: "06"
subsystem: bridges-agents
tags: [agents, tools, excludeTools, mcp, parity]
status: complete
requires:
  - "`GeneratedToolsFields` with the omitted arm's `allowNestedSubagents` (plan 07-05)"
provides:
  - "`excludeTools` beside an explicit `tools` list for a per-tool MCP deny under a kept whole-server grant (D-PG7-12)"
  - "`ExplicitToolMapping.excludeTools` and `explicitExcludeTools` in convert.ts; `explicitMcpWarnings` removed"
  - "No version-floor warning from the omitted arm (D-PG7-13)"
affects:
  - every producer of a generated agent file (install, update, reinstall, enable, apply, grants rewrite)
tech-stack:
  added: []
  patterns: ["exclude names come from the implementation profile's toolName through the grant's excludeName"]
key-files:
  created:
    - .planning/phases/07-agent-frontmatter-and-grants/07-06-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/grant-forms.test.ts
    - features/mcp-server/agent-grants.feature
    - features/agent/frontmatter.feature
    - test/integration/pi-subagents-child-launch-conformance.test.ts
    - test/integration/agents-builtin-grant-conformance.test.ts
    - docs/mcp-compatibility.md
decisions:
  - "D-PG7-12: with explicit `tools` and `disallowedTools` the deny applies first; exact names leave `tools`, and a per-tool MCP deny under a kept whole-server grant is written to `excludeTools` beside `tools` in the form's registered name (D-PG1-10)"
  - "D-PG7-13: both warnings removed rather than reworded; `legacy-grant-form.ts` keeps its own copy of the old cannot-narrow text"
metrics:
  completed: 2026-11-14
  tasks: 4
actuals:
  tokens: 30000
  tasks: 4
  commits: 4
plan_head_before: 61f504e1e0a327472d1234bc5fc8ead30b656fa1
plan_head_after: 2c8d1711
---

# Phase 07 Plan 06: Both tool lists restrict an agent Summary

A source with both `tools` and `disallowedTools` now writes `excludeTools` beside `tools` for a per-tool MCP deny under a whole-server grant, in the name the form's MCP implementation registers. The cannot-narrow warning and the `excludeTools` version-floor warning are gone. This closes BACKLOG AGTEXCL-01.

## Commits

| Task | Commit | Title |
|---|---|---|
| 07-06-01 | 54de7a6e | feat(agents): exclude one tool of a granted MCP server |
| 07-06-02 | cec10c42 | fix(agents): drop the excludeTools version warning |
| 07-06-03 | e5037629 | test(agents): prove the exclude names against pi-subagents |
| 07-06-04 | 2c8d1711 | docs(agents): record that both tool lists restrict an agent |

No commit used `--no-verify`. The `npm run check:commit` hook ran and passed for 54de7a6e, cec10c42, and e5037629. 2c8d1711 stages no build input. Local Node is v26.13.1. pi-subagents in the optional-peer cache is 0.88.1.

## Task 07-06-01

Code: each `ExplicitDisallow.perTool` entry now carries `{ server, excludeName }`, where `excludeName` is `match.excludeName(match.tool)`, the profile's `toolName` (D-PG1-10). `explicitExcludeTools(kept, disallow)` returns the names of the per-tool denies whose selector survives in `kept`, once each, in deny order. `mapTools` returns them as `ExplicitToolMapping.excludeTools` and `warnings: []`. `toolsFields` writes `excludeTools` on both arms through a small `excludeToolsField` helper. `explicitMcpWarnings` and its doc comment are deleted. In frontmatter.ts the explicit arm of `GeneratedToolsFields` takes `excludeTools?: readonly [string, ...string[]]` and still refuses `allowNestedSubagents` (the `@ts-expect-error` case still compiles). The doc comments of the type, of `GeneratedFrontmatterFields`, and of the emitter's field order were rewritten.

Red runs, on the tree 07-05 left, with the scenario's real `subagent list` step. I replaced convert.ts and frontmatter.ts with their HEAD text in the working tree and restored my edits afterwards (`git diff --quiet HEAD -- extensions` exited 0 before the run).
- `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature --name "PG-AGENT-09"`: exit 1, 1 scenario (1 failed). The list read `...; tools read, mcp:plugin_demo_stub_`, with no excluded tool.
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature --name "PG-AGENT-09"`: exit 1, 1 scenario (1 failed). The list read `...; tools read, mcp:plugin_demo_stub`, with no excluded tool.
- The staged-file step came after the failed step, so cucumber skipped it. The cannot-narrow line in `warnings:` on that tree is pinned by the two old owner cases at 61f504e1 ("ANAME-02: a per-tool disallow cannot narrow a whole-server grant and warns" and "MGRT-01: the cannot-narrow warning of a built-in whole-server grant names the built-in selector"). This task turned those two cases into the first two behavior rows.

Measured values, read back from the green runs:

| Implementation | `tools:` line | `excludeTools:` line | `subagent list` |
|---|---|---|---|
| pi-mcp-adapter | `mcp:plugin_demo_stub_,read` | `mcp__plugin_demo_stub__echo` | `tools read, mcp:plugin_demo_stub_; excluded tools mcp__plugin_demo_stub__echo` |
| Pi's built-in MCP | `mcp:plugin_demo_stub,read` | `mcp__plugin_demo_stub__echo` | `tools read, mcp:plugin_demo_stub; excluded tools mcp__plugin_demo_stub__echo` |

The staged file's `warnings:` holds only the MCP background warning of each implementation.

Green runs:
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts" test/orchestrators/mcp/agent-grants-step.test.ts`: exit 0, 511 tests, 511 passed. This includes legacy-grant-form.test.ts and grant-rewrite.test.ts, unedited.
- `npm run test:coverage:direct -- .../convert.ts .../frontmatter.ts .../grant-forms.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/agent/frontmatter.feature`: exit 0, 48 scenarios (48 passed), 709 steps.
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature features/agent/frontmatter.feature`: exit 0, 15 scenarios (15 passed), 207 steps.
- `npm run check:features`: exit 0.
- `git diff --quiet HEAD -- <legacy-grant-form, grant-rewrite, mcp-async-warning and their tests>`: exit 0.

New and changed owner cases:
- convert.test.ts:
  - The adapter and built-in cannot-narrow cases are now the D-PG7-12 adapter and built-in rows. The built-in row uses server `my-db`, so the selector `mcp:plugin_acme_my-db` and the exclude name `mcp__plugin_acme_my_db__query` differ in form.
  - New rows: two per-tool denies (`b, a, b` writes `b,a`); a per-tool deny of a per-tool grant (no `excludeTools`); a per-tool deny under a whole-server deny (no `excludeTools`); `Bash` and `Bash(rm:*)` beside `tools: Read, Bash` (`tools: read`, no `excludeTools`); and an adapter long name beside `tools` (`..._05ea19f1`).
- frontmatter.test.ts: "D-PG7-12: writes the tools line, then the excludeTools line".
- grant-forms.test.ts: "D-PG7-12: a whole-server grant with a per-tool deny records each form with its own selector and exclude name". Adapter: `mcp:plugin_acme_my-db_` and `mcp__plugin_acme_my-db__a_b`. Built-in: `mcp:plugin_acme_my-db` and `mcp__plugin_acme_my_db__a_b`.

## Task 07-06-02

Red run, on the tree 54de7a6e left. Command: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature --name "reports no staging warning"`. Result: exit 1, 1 scenario (1 failed). An extra row was reported: `diagnostic | warning | Plugin "demo" [project] updated; 1 staging warning. | [helper] \`excludeTools\` requires pi-subagents >= 0.62.0 -- earlier versions ignore it and keep the default tool set`.

Code: `omittedToolMapping` no longer pushes the version-floor warning. Its doc comment now cites D-PG7-13 and D-PG7-14 and names no version. The unmapped-entries warning stays.

Tests: the constant `EXCLUDE_TOOLS_FLOOR_WARNING` is removed, and so is every expectation of it: 6 text pins and 9 array or assertion uses. Each lost exactly that entry. In three template pins it was the only item, so `warnings:` plus the item became `warnings: []`, which is the YAML the emitter writes for an empty list. A new describe "D-PG7-13 disallowedTools without a tools list" has three cases:
- `Bash` returns `[]`;
- a per-tool MCP deny returns `[MCP_ASYNC_WARNING]`;
- "D-PG7-14: denies with no exact Pi name keep the cannot-narrow warning" asserts the unmapped warning for `WebFetch, mcp__*, mcp__plugin_acme_db`, with its text unedited, and nothing about a version.

Green:
- `node --import ... --test "test/bridges/agents/*.test.ts"`: exit 0, 503 tests, 503 passed.
- `npm run test:coverage:direct -- .../convert.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/invocation.feature features/mcp-server/agent-grants.feature`: exit 0, 61 scenarios (61 passed), 891 steps.
- `npm run check:features`: exit 0.

## Task 07-06-03

New cases:
- "PG-AGENT-09: the exclude name written beside a whole-server grant removes that adapter tool from the child", in test/integration/pi-subagents-child-launch-conformance.test.ts. It writes the adapter config and a cache with the tools `echo` and `drop` into the hermetic agent directory. Then it takes the `tools:` and `excludeTools:` lines from `convertAgent` output in the adapter form. `convertedLine` gained an optional `mcpServerNames` argument. The case splits the `mcp:` entries into `mcpDirectTools` and hands everything to `buildInProcessChildLaunch`. The session tools are `["read", "mcp__plugin_demo_stub__echo"]`.
- "PG-AGENT-09: the built-in exclude name is the name pi-subagents resolves for the denied tool of a whole-server grant", in test/integration/agents-builtin-grant-conformance.test.ts. It converts the same source in the built-in form and resolves the selector `plugin_demo_stub` with pi-subagents' resolver on a host stand-in that lists `echo` and `drop` under Pi's names. The case asserts both selections, and it asserts that the file's `excludeTools` equals `[piToolName("plugin_demo_stub", "drop")]`, which is `mcp__plugin_demo_stub__drop`.

Mutation: in the working tree only, `perTool.push({ server: match.server, excludeName: match.tool })` replaced the registered name with the raw tool name. Run: `node --import ... --test` on the two files gave exit 1, 14 tests, 12 passed and 2 failed. Built-in: `excludeTools` was `['drop']`, not `['mcp__plugin_demo_stub__drop']`. Adapter: the session tools also held `mcp__plugin_demo_stub__drop`. Restored with `git checkout -- extensions/.../convert.ts`. Then `git diff --quiet HEAD -- extensions` exited 0.

Green: `node scripts/install-test-peers.mjs && node --import ... --test <the three files>` gave exit 0, 15 tests, 15 passed, on pi-subagents 0.88.1. The commit lists no path under `extensions/`.

## Task 07-06-04

docs/mcp-compatibility.md:
- "Customizing generated agents" has a list of four deny rules and a paragraph on the two removed warnings. That paragraph covers the old `warnings:` text, which stays until the next update or reinstall, and the implementation switch. It cites the three scenario titles and the two conformance test paths. Each title exists verbatim, and each path exists.
- "Divergences / Naming": the AGTLONGNAME-01 item now covers a per-tool deny of a shortened adapter tool beside a whole-server grant.

`SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md` gave exit 0 and rewrote nothing. `grep -c 0.62.0` prints 0. The adapter cucumber run of both cited features is the 61-scenario green run of task 07-06-02. Commit 2c8d1711 changes only the markdown page, so I did not run it again.

## Deviations from Plan

1. **[Rule 3] Red evidence for the staged file of 07-06-01.** In the red run, cucumber skipped the file step, because the list step before it failed. The old owner cases at 61f504e1 carry the cannot-narrow line in `warnings:`, and those are the cases this task changed.
2. **Three template pins became `warnings: []`** (07-06-02). In those pins the removed line was the only warnings item. The plan said each expectation "changes in no other way". The empty YAML list is the only valid form.
3. **Extra owner cases** (07-06-02): `mcp__*` and a whole server had no case on the no-tools path. The new D-PG7-13 describe states both rows directly.

## Flagged assumptions (from the plan, unchanged)

- A standalone `install` never printed either warning. The failing proofs are the `subagent list` line plus the staged file in the two MCP scenarios, and the `apply` scenario.
- Criterion 5 is shown with a whole-server grant and a per-tool deny. `tools: Read, Bash` with `disallowedTools: Bash` writes `tools: read` and no excluded tool.
- AGTLONGNAME-01 stays open and is recorded on the page.
- `docs/prd/pi-claude-marketplace-prd.md` was not edited. Its AG-7 detail still describes the version-floor warning, so it is left for the maintainer. `docs/research/parity-gaps/subagents.md` still quotes both texts, and as a research record it stays.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-18: the exclude name comes from the grant's `excludeName` (the profile `toolName`), and the two conformance cases fail on a mismatch under both implementations (mutation run above). T-07-19: the removed warnings stated limits that cannot occur at the floor, and the unmapped-entries warning keeps an owner case. T-07-20: the stored-text modules and their tests are unedited, and their tests pass.

## Parent lines

For the orchestrator, for the whole phase (not edited here):

- PROJECT.md decision row: D-PG7-12. With explicit `tools` and `disallowedTools`, the deny applies first, as in Claude Code. Exact names leave `tools`. A per-tool MCP deny under a whole-server grant is written to `excludeTools` beside `tools`, in the name the form's MCP implementation registers (D-PG1-10). `GeneratedToolsFields` allows both keys.
- BACKLOG AGTEXCL-01: closed. The phase removed the warning instead of rewording it, because pi-subagents 0.87.0 and later apply `excludeTools` beside an explicit list.
- CHANGELOG line: a plugin agent with both `tools` and `disallowedTools` is restricted by both lists, as in Claude Code, and the two warnings about pi-subagents limits are gone. Run `/claude:plugin reinstall` once to apply this phase to installed plugins.
- Codebase maps:
  - STACK.md's YAML bullet says the agents bridge reads frontmatter line by line through `bridges/agents/frontmatter.ts`. It now reads YAML (D-PG7-01).
  - Any map line that says `tools` and `excludeTools` never render together is out of date. ARCHITECTURE.md and CONVENTIONS.md hold none that I found. Check the agents bridge description when the maps are refreshed.
- Full gate still owed: the wave 6 and phase `npm run check` on the worktree tree at 2c8d1711.

## Self-Check: PASSED

- FOUND: 54de7a6e, cec10c42, e5037629, 2c8d1711 (ancestors of HEAD)
- FOUND: every file in key-files.modified changed in 61f504e1..2c8d1711
