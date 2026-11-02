---
phase: 04-agents
plan: 02
subsystem: agents-bridge
tags: [agents, pi-subagents, cucumber, frontmatter, conversion]
status: complete

requires:
  - phase: 04-agents
    provides: "plan 04-01: shared agent steps (`has these agents:`, builtins hidden), advertise line"
provides:
  - "features/agent/frontmatter.feature: AGT-03 conversion scenarios (A)-(H) and the AGT-02 `--map-model` run"
  - "`async: true|false` on every bridged agent outside the MCP exception (D-CF4-05)"
  - "The 5.x `--map-model` alias table, `[1m]`, full `claude-` IDs (D-CF4-07 as amended)"
  - "Normalized effort with `max` and `med` (D-CF4-06 as amended)"
  - "Claude Code's tool-list splitting, `Tool(spec)`, and `*` (D-CF4-08 as amended)"
  - "Guided warnings for initialPrompt, observer, observerMessage, observeSubagents (D-CF4-05)"
affects: [04-05, 04-06]

actuals:
  tokens: 25700
  tasks: 3
  commits: 3
plan_head_before: 51ad1d7cf709171670f07c8fa02ff7f7d6ce8241
plan_head_after: 44df1454461f3a7927bc440c2903cf471b3638cb

tech-stack:
  added: []
  patterns:
    - "Depth-tracking splitter (`topLevelParts`) that splits on commas and whitespace outside parentheses"
    - "`ReadonlyMap` alias table, so a lookup cannot hit an `Object.prototype` key"

key-files:
  created:
    - features/agent/frontmatter.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/stage.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/edge/handlers/plugin/install.test.ts
    - test/edge/handlers/plugin/update.test.ts

key-decisions:
  - "D-CF4-05: `background` of `true`, `\"true\"`, or `'true'` writes `async: true`; any other value or none writes `async: false`; an agent that runs MCP tools (an `mcp:` entry, or an omitted list in a plugin that writes MCP servers) gets no `async` line"
  - "D-CF4-07 as amended: `sonnet`/`opusplan` -> claude-sonnet-5-5, `opus` -> claude-opus-5-5, `haiku` -> claude-haiku-5-5, `fable`/`best` -> claude-fable-5-1; case-insensitive; one trailing `[1m]` stripped; a `claude-` ID with no whitespace and no `:` passes through"
  - "D-CF4-06 as amended: effort trimmed and lower-cased, `med` -> `medium`, `max` added; `thinking` stays exact"
  - "D-CF4-08 as amended: tool lists split on commas and whitespace outside parentheses; `Tool(spec)` maps by name; `*` converts as an omitted list"

requirements-completed: [AGT-02, AGT-03]

metrics:
  started: 2026-11-01T16:16:06Z
  completed: 2026-11-01T16:50:06Z
  duration: 34m
---

# Phase 4 Plan 02: Agent frontmatter Summary

A bridged agent's frontmatter now converts the way Claude Code 2.1.316 reads a plugin agent, as far as pi-subagents 0.84 can run it. Agents run in the foreground unless the source sets `background: true`. `--map-model` maps Claude Code's current aliases. Effort accepts `max`, `med`, and any case. Tool lists split on spaces as well as commas. The four observer and `initialPrompt` fields get the plugin-ignored warning. pi-subagents' own `list`, `get`, and run results prove each change.

## Tasks

| Task | Name | Commit | Kind |
| ---- | ---- | ------ | ---- |
| 1 | Run a bridged agent in the foreground unless it asks for the background (tracer) | d4e8805 | fix |
| 2 | Convert effort and model as Claude Code names them, and pin the mapped-model run | 007eb0f | feat |
| 3 | Split tool lists as Claude Code does and report the plugin agent fields it ignores | 44df145 | fix |

Tracer gate: after Task 1, the full `<verify>` chain passed again (unit tests, direct coverage, `npx cucumber-js features/agent`, `check:static`), and expansion continued.

## Red proofs

Every scenario ran before its product change. The quoted text is what pi-subagents or the command actually returned.

**Task 1 (D-CF4-05).**

- (A) "An agent runs in the foreground unless its source asks for the background" failed. No `get` result has an `Async:` line, for example: `subagent returned: Agent: demo:background (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-background.md\nDescription: Runs in the background.\nAliases: pi-claude-marketplace-demo-background\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\n\nSystem Prompt:\nWork in the back.`
- (B) "A call that leaves the launch mode open runs a bridged agent in the foreground" ran alone and failed with a background launch: `subagent returned: Run fan-out: 1/64 used, 63 remaining\nAsync: demo:reviewer [{uuid}]\n\nDetached. Return control now: native completion wakes you, so do not sleep, poll, or call bg_wait for it.\nOne-shot check: subagent({ action: "status", id: "..." }).\nMission: {uuid} (active)`. No child call 2 happened. No detached runner was left after the run (checked with `ps`).

**Task 2 (D-CF4-06, D-CF4-07).**

- (C) "Effort levels are listed as the thinking levels pi-subagents runs" failed. All four agents listed `Thinking: default`, including `max`, `med`, and `HIGH`.
- (D) "With --map-model Claude Code's model names are listed as the models they select" failed. `sonnet` listed `Model: anthropic/claude-sonnet-4-6`, `opus` `anthropic/claude-opus-4-7`, and `haiku` `anthropic/claude-haiku-4-5`. `fable`, `best`, `opusplan`, `sonnet[1m]`, and `claude-opus-4-7` all listed `Model: inherits current session`.
- (F) "A run of an agent whose model --map-model mapped reports the model pi does not know" failed with `subagent failed: Unknown subagent model 'anthropic/claude-sonnet-4-6' in the active Pi model registry.`
- (E) "Without --map-model every agent inherits the session's model" **passed** before the change. It is the control.

**Task 3 (D-CF4-08, D-CF4-05 guided fields).**

- (G) "Tool lists split on commas and spaces as Claude Code splits them" failed at the install. AG-11 refused it with `Cannot convert agent "narrowed" in plugin "demo": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: Read Grep Edit; disallowedTools: Edit Write.`
- (H) "Apply reports each plugin agent field Claude Code also ignores" failed. The diagnostic read `Plugin "demo" [project] updated; 1 staging warning.` with the single line `[helper] dropped fields: initialPrompt, observer, observerMessage, observeSubagents, memory, maxTurns`.

After each change, the scenarios passed. The final run of `npx cucumber-js features/agent features/plugin/staging-warnings.feature` passed 43 scenarios.

## Non-owned files changed (expected values only)

- `test/orchestrators/plugin/update-swap.test.ts`: the two expected agent texts gained `async: false\n` after `advertise: true\n`. Numstat is 2/2.
- `test/orchestrators/plugin/reinstall-flow.test.ts`: the expected text near line 677 gained `async: false\n`. The `const oldBytes =` fixture is unchanged. Numstat is 1/1.
- `test/orchestrators/plugin/install-flow-ledger.test.ts`: the expected text near line 1286 gained `async: false\n`. Numstat is 1/1.
- `test/edge/handlers/plugin/install.test.ts` and `update.test.ts`: only the `MAPPED_MODEL` line changed, to `anthropic/claude-sonnet-5-5`. Numstat is 1/1 each.

## Verification

- `node --test` passed on every touched test module. Direct coverage of `convert.ts` and `frontmatter.ts` is 100% (`npm run test:coverage:direct` exit 0).
- `npm run test:modules` (the whole unit suite) and `npm run test:integration` passed after Task 3.
- `npx cucumber-js features/agent` passed: the frontmatter scenarios (A)-(H), the listing scenarios, and the seeds.
- `npm run check:static` passed before each commit.
- Acceptance greps hold: `splitCsv` 0, `claude-sonnet-4-6` 0 in all three files, `claude-fable-5-1` and `"max"` present, `survives the filter, and it warns` 0, the MCP-07 warning text present once, `observeSubagents` present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `stage.test.ts` carried two 4.x model lines**
- **Found during:** Task 2
- **Issue:** Task 2's file list leaves out `test/bridges/agents/stage.test.ts`, but two of its expected agent texts convert with `--map-model` and pinned `model: anthropic/claude-sonnet-4-6`.
- **Fix:** Both lines now read `model: anthropic/claude-sonnet-5-5`. The file is in the plan's `files_modified`.
- **Commit:** 007eb0f

**2. [Rule 1 - Bug] A unit case pinned the comma-only splitting that D-CF4-08 replaces**
- **Found during:** Task 3
- **Issue:** "warn-drops malformed skill metadata and ignores malformed body tokens" expected `spec-tree:a\tb` to stay one malformed reference. Under D-CF4-08, whitespace separates references.
- **Fix:** The case keeps its arrange. Its expected warnings now name the two references `spec-tree:a` and `b` as unknown, with a comment that cites D-CF4-08.
- **Commit:** 44df145

**3. [Rule 3 - Blocking] The project-scope install in (H) warns**
- **Found during:** Task 3
- **Issue:** The seed agent makes the 1.0.0 install report `requires pi-subagents` at warning severity, so `Given the user has run "..."` (which requires info) failed.
- **Fix:** (H) uses the frozen `Given the user has run "...", which warned` instead.
- **Commit:** 44df145

**4. [Rule 2 - Correctness] The alias table is a `Map`**
- **Found during:** Task 2
- **Issue:** A lookup in a frozen object literal also finds `Object.prototype` keys, so a `model: constructor` source would have emitted a function's text.
- **Fix:** `MODEL_MAP` is a `ReadonlyMap`, read with `.get`.
- **Commit:** 007eb0f

**Plan ledger note:** the worktree guard refuses writes into the shared `.git` folder, so the plan ledger is the scratchpad file `exec-04-02/plan-head-before`, value `51ad1d7`. `commits: 3` is `git rev-list --count 51ad1d7..44df145`.

## Deferred Issues

- `TOOL_MAP` is still a frozen object literal. `TOOL_MAP[toolNameOf(token)]` finds `Object.prototype` keys, so `tools: constructor` maps to a function and the generated `tools:` line prints the function's source. The bug existed before this plan, and this plan did not cause it. The fix is the same `Map` change as `MODEL_MAP`. See Parent lines.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-06 is mitigated: `async` is emitted only as the literal `true` or `false`. A model is emitted only from the closed alias table, or as `anthropic/<value>` for a `claude-` value with no whitespace and no `:`. Unit rows cover `claude-x:high`, `claude opus`, and `Claude-Opus-4-7`. T-04-07 is mitigated: parenthesized specs stay one token, and `*` grants only what an omitted list grants. An explicit list that maps to nothing still refuses (unit row for `WebFetch NotebookEdit`), and a `Tool(spec)` disallow removes the whole tool (unit row for `Bash(rm *)`). T-04-08 is accepted as planned.

## Parent lines

- **D-CF4-08 (for Phase 6 and the parent):** the per-tool MCP warning `... pi-subagents takes no excludeTools beside an explicit tools: list, so the agent keeps every tool of that server` is stale. pi-subagents 0.62 and later apply `excludeTools` beside an explicit `tools:` list. The text is byte-identical here because it belongs to the MCP-07 surface. The doc comment above `explicitMcpWarnings` now says so. Phase 6 should reword the warning, or emit `excludeTools` beside `tools:` for the per-tool disallow.
- `CHANGELOG.md`: one bullet for this plan. Bridged agents now run in the foreground unless their source sets `background: true`. `--map-model` maps `sonnet`, `opusplan`, `opus`, `haiku`, `fable`, and `best` (any case, `[1m]` allowed) to the current Claude models, and passes full `claude-` IDs through. Effort accepts `max`, `med`, and any case. `tools`, `disallowedTools`, and `skills` split on spaces as well as commas, accept `Tool(spec)` entries, and treat `*` as every tool. `initialPrompt` and the three observer fields are reported as ignored for plugin agents (D-CF4-05..08).
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` (a later owner): make `TOOL_MAP` a `ReadonlyMap` so `tools: constructor` cannot map to `Object` (Deferred Issues).
- `docs/prd/pi-claude-marketplace-prd.md` (not owned): the AG-7 model table, if it lists the 4.x IDs, should list the D-CF4-07 table.

## Self-Check: PASSED

- FOUND: features/agent/frontmatter.feature, .planning/phases/04-agents/04-02-SUMMARY.md
- FOUND commits: d4e8805, 007eb0f, 44df145 (all ancestors of HEAD)

## Dubious Choices

- **`'true'` counts as true for `background`.** Claude Code accepts `true` or `"true"`. A YAML single-quoted `'true'` is the same string to Claude Code's YAML parser, and the plan lists it. Scenario (A) pins `true` and `"true"`, and a unit row pins `'true'`.
- **An MCP-tool agent gets no `async` line even with `background: true`.** pi-subagents' own background default then applies, which matches `background: true` anyway. The amended D-CF4-05 keeps the line off for every MCP-tool agent.
- **`originalModel` keeps the untrimmed source value**, and the unknown-model warning quotes it. The line-based parser already trims values, so this only differs for a value a caller hands in untrimmed.
- **The `--map-model` thinking fallback warning quotes the raw effort** (`using effort "MED" as fallback`), while the emitted level is normalized (`thinking: medium`).
- **A quoted item with a space outside parentheses splits inside the quotes.** For example, `["Read Grep"]` gives `"Read` and `Grep"`, and the quote stripping then misses both. Claude Code's YAML parse would give `Read Grep` and split it to two tools. No agent found in the wild writes this, and the plan specifies per-item quote stripping after the split.
- **Scenario (G) writes `tools: *` unquoted**, as the plan says. Claude Code's YAML parser may read a bare `*` as an alias token. The bridge's line parser takes it verbatim.
- **The expected `excludes:` text** in (G), `Tools: default/ambient; excludes: bash, edit`, was taken from the research's description of pi-subagents' format and confirmed by the passing run, not from pi-subagents' source.
- **The guided-warning helper `pluginIgnoredFieldWarning`** builds the four new warnings. The older `permissionMode` entry keeps its literal, so its bytes cannot move.
