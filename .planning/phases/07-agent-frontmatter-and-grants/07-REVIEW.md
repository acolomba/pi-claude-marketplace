---
phase: 07-agent-frontmatter-and-grants
reviewed: 2026-11-14T20:15:20Z
depth: deep
iteration: 1
files_reviewed: 30
files_reviewed_list:
  - README.es.md
  - README.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/discover.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/shared/frontmatter-repair.ts
  - features/agent/frontmatter.feature
  - features/agent/invocation.feature
  - features/lib/upstream/subagents.ts
  - features/mcp-server/agent-grants.feature
  - features/step_definitions/agent/runs.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/discover.test.ts
  - test/bridges/agents/frontmatter.test.ts
  - test/bridges/agents/grant-forms.test.ts
  - test/bridges/skills/frontmatter-degrade.test.ts
  - test/bridges/skills/frontmatter-scan.test.ts
  - test/integration/agents-builtin-grant-conformance.test.ts
  - test/integration/pi-subagents-child-launch-conformance.test.ts
  - test/integration/provenance-invisibility.test.ts
  - test/shared/frontmatter-repair.test.ts
findings:
  critical: 3
  warning: 2
  info: 7
  total: 12
  necessity: 0
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-14T20:15:20Z
**Depth:** deep
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Scope: `git diff deaa35c4..719d2fb7` without `.planning/`. I read the phase CONTEXT, RESEARCH, and the plan summaries for intent. I traced the generated agent file into both of its readers: pi-subagents 0.88.1 (`src/agents/frontmatter.js`, `src/runs/shared/child-tool-plan.js`) and the workflow engine `@quintinshaw/pi-dynamic-workflows` 3.15.0 (`src/agent-registry.ts`, `src/workflow.ts`, `src/agent.ts`). The engine reads the same agents folder with Pi's YAML `parseFrontmatter`. I replayed the YAML edge cases with bun 1.4.4, as the research did for its upstream evidence. The owner unit tests pass (421 of 421: `test/shared/frontmatter-repair.test.ts`, `test/bridges/agents/{frontmatter,discover,convert}.test.ts`, `test/bridges/skills/frontmatter-{degrade,scan}.test.ts`).

What holds up:

- The skills bridge behaves as before. The moved helpers are the same code, the skills caller passes `colonRepairTrigger` (the old `value.includes(":")` rule), and the moved test tables keep their cases.
- The `|-` description writer is injection-safe under pi-subagents' line reader. Every non-empty line gets a two-space indent, a line that is `---` or `key: value` stays content, and CR, LF, CRLF, U+2028, and U+2029 all split. `descriptionLines` receives a trimmed value, so pi-subagents' first-line indent detection cannot strip the wrong prefix.
- `TOOL_MAP` `Agent`/`Task` -> `subagent`, the `allowNestedSubagents` versus `excludeTools: subagent` split, and `excludeTools` beside `tools` all match pi-subagents' `resolvePiLaunchToolPlan`. The removed warnings have no remaining callers in source.

Key concerns:

1. The generated file now breaks the workflow engine, its second reader. `model: inherit` makes every `agent({agentType})` step for such an agent fail with `MODEL_NOT_FOUND`. A quoted source description that holds `: ` (or ` #`, or a leading indicator) loses its quotes, so the generated block stops being YAML, and the engine no longer finds the agent by name.
2. A key written twice now makes the whole agent unparseable, so it loads with every tool and nested delegation. Bun 1.4.4 keeps the last value. The docs state the opposite as an unchecked assumption.

## Critical Issues

### CR-01: `model: inherit` makes bridged workflow steps fail with MODEL_NOT_FOUND

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:335-337` (also `README.md:379`, `README.es.md:379`, `docs/mcp-compatibility.md:397`)
**Issue:** `mapModel` now writes `model: inherit` with or without `--map-model` (D-PG7-11). The generated file has two readers, and the change only fits pi-subagents. The workflow engine (pi-dynamic-workflows 3.15.0) loads `<agentDir>/agents/*.md` through Pi's YAML `parseFrontmatter` (`src/agent-registry.ts:84-110`). It takes `def.model` as an explicit model: `const explicitModel = agentOptions.model ?? agentDef?.model` (`src/workflow.ts:1127`). Then `resolveModelSpecWithThinking("inherit", …)` resolves nothing. Because the request is explicit, `WorkflowAgent` throws `WorkflowError(MODEL_NOT_FOUND, { recoverable: false })` (`src/agent.ts:1336-1349`). I reproduced this. `parseAgentDefinition` on the emitted file gives `model: "inherit"`, and the resolver returns `Model "inherit" not found. Use /workflows-models to choose an available model.` Before this change, no `model:` line was written without `--map-model`, and these steps ran on the session's model. The PRD counts 16 of 29 surveyed `model` lines as `inherit`, so every bridged workflow that names such an agent through `agentType` (`features/workflow/agent-restrictions.feature` uses this path) now fails. The same happens with `--map-model`, which before also wrote no line for `inherit`. No decision covers this divergence, and no scenario runs a workflow step on an `inherit` agent.
**Fix:** Pick a form that both readers accept and record the decision. Options: (a) leave `model:` out for `inherit` again, and record the pi-subagents `subagents.defaultModel` ranking as a capability gap; (b) keep the line and add a workflows-bridge scenario that runs `agent({agentType})` on an `inherit` agent, which needs the engine to treat `inherit` as "no model" (an upstream engine change, so file it and keep option (a) until it ships). Option (a) restores the old behavior:
```ts
if (value.toLowerCase() === "inherit") {
  // pi-dynamic-workflows reads `model` as an explicit spec and fails on `inherit`.
  return { emit: undefined, originalModel: raw, warning: undefined };
}
```

### CR-02: A key written twice makes the agent load with every tool, where Claude Code keeps the last value

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:151-161`, `docs/mcp-compatibility.md:407-410`
**Issue:** Pi's `yaml` 2.9.1 throws `Map keys must be unique` on a repeated key. The repair does not touch that defect, so `readAgentFrontmatter` returns `raw: {}` with a `parseError`. The agent then loads with no `tools` (every tool), `allowNestedSubagents: true`, and `inheritSkills: true`. Probe: `---\nname: a\ntools: Read\ntools: Read, Grep\n---` gives `{"raw":{},"parseError":"Map keys must be unique at line 3, …"}`. The upstream parser does not do this: `Bun.YAML.parse("name: a\ntools: Read\ntools: Bash\n")` with bun 1.4.4 (the replay version 07-CONTEXT.md cites) returns `{"name":"a","tools":"Bash"}`. So Claude Code keeps a restricted agent, and this bridge widens it to every tool plus nested delegation. The old line reader also kept one value. The docs list "a key written twice" as a form YAML refuses and say, unchecked, that Claude Code refuses it too. That is the claim the probe disproves. D-PG7-04 accepts every tool only for a file that upstream also cannot parse, so this case has no decision behind it.
**Fix:** When the first parse fails, also drop earlier copies of a repeated column-0 key (keep the last, as Bun does) before the second parse. A line-level pass in `shared/frontmatter-repair.ts` can do this, behind an agents-only trigger, so skills stay the same. Add a unit case and a scenario: `tools: Read` repeated as `tools: Read, Grep` lists `tools read, grep`. Correct `docs/mcp-compatibility.md:407-410`.
```ts
// keep only the last occurrence of each top-level key, as Bun.YAML.parse does
function dropEarlierDuplicateKeys(lines: string[], blockEnd: number): string[] { /* uses keyValueEnd for spans */ }
```

### CR-03: A quoted description with `: ` is now written as a block that is not YAML, so the workflow engine loses the agent

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:57-67`, `:84-91`
**Issue:** The YAML reader now removes source quotes (D-PG7-01). `emitYamlScalar` still re-quotes only for pi-subagents' needs (a value that starts and ends with the same quote, or a bare block header). So `description: "Reviews: code."` is now written as `description: Reviews: code.`. Pi's YAML refuses that line. The workflow engine catches the error and treats the file as having no frontmatter (`src/agent-registry.ts:90-95`). The agent registers under its file name, `pi-claude-marketplace-demo-reader`, with no tools, model, or description. A script's `agent(…, {agentType: "demo:reader"})` then logs `unknown agentType` and runs with the default tools and model, and without that agent's definition (`src/workflow.ts:1119-1121`). I reproduced this: the emitted file for `description: "Reviews: code."` gives engine name `pi-claude-marketplace-demo-reader`, `tools` undefined. The old reader kept the quotes and wrote `description: '"Reviews: code."'`, which is valid YAML, and the engine found `demo:reader`. The same applies to a quoted value with ` #` (the engine reads `"a #b"` as `a`) or one that starts with `-`, `?`, `[`, `{`, `*`, `&`, `!`, `%`, `@`, a backtick, or a quote. The research counts 4 of 40 agents with a quoted description, the form authors pick for exactly these characters. The scenario "Quoted frontmatter values are listed without their quote marks" checks only pi-subagents.
**Fix:** Write a one-line description that is not a safe YAML plain scalar in a form both readers accept. The `|-` block already is one: pi-subagents reads it literally, YAML reads it as text, and no escape is involved. For example:
```ts
const YAML_UNSAFE_PLAIN = /: |\s#|^[-?:,[\]{}#&*!|>'"%@`]/u;
function descriptionLines(value: string): string[] {
  const parts = value.split(DESCRIPTION_LINE_BREAK);
  if (parts.length === 1 && !YAML_UNSAFE_PLAIN.test(value)) {
    return [`description: ${emitYamlScalar(value)}`];
  }
  return ["description: |-", ...parts.map((part) => (part === "" ? "" : `  ${part}`))];
}
```
Add a test that parses the emitted block with Pi's `parseFrontmatter`, next to the pi-subagents check in `test/integration/provenance-invisibility.test.ts`.

## Warnings

### WR-01: The moved repair doc says Claude Code strict-parses to empty metadata, which the phase's own upstream evidence contradicts

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:162-163`
**Issue:** The doc comment of `repairSingleLineScalars` says: "This is deliberately MORE lenient than Claude Code, which strict-parses these same bytes to empty metadata." 07-CONTEXT.md (Specifics 1) and `docs/mcp-compatibility.md` ("### Agents") record that Claude Code 2.1.323's `md()` retries once after `xu` quotes values with `: ` and more indicators, for skills, commands, and agents. The repair is narrower than upstream, not more lenient. The file is new, so it follows the comment rules completely. The comment now also covers the agents caller, which is documented as narrower than upstream (D-PG7-02).
**Fix:** Restate it as a present-tense fact: "Claude Code's retry quotes a wider set of values; the trigger decides which of them this repair quotes (D-PG7-02)."

### WR-02: A frontmatter block that parses to a non-mapping silently loads the agent with every tool

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:189-193`, `extensions/pi-claude-marketplace/bridges/agents/discover.ts:171-173`
**Issue:** `rawFields` returns `{}` for a document that is a scalar or a sequence, and no `parseError` is set. So discovery adds no D-PG7-04 note. Probes: `---\ntools Read\n---` (a missing colon) and `---\n- tools: Read\n---` both give `{"raw":{},"body":"body"}`. The agent installs with no `tools` (every tool), `allowNestedSubagents: true`, and the fallback description, and nothing tells the user. D-PG7-04 adds the note so that losing the tool restriction is never silent. This outcome is the same one, so it should carry the same note.
**Fix:** Return a `parseError` (for example `the frontmatter is not a mapping of keys`) when the parsed frontmatter is not a plain object and the block is not empty, so `discoverPluginAgents` emits the same note. Add a discover test case.

## Info

### IN-01: Pi's YAML library writes `YAMLWarning` to stderr for plugin-authored tags

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:155`
**Issue:** A source value with an unknown tag, such as `tools: !Read`, parses without throwing. `yaml` then reports `[TAG_RESOLVE_FAILED] YAMLWarning: Unresolved tag` through `process.emitWarning`, which Node prints to stderr (seen in the probe output). Agents now go through this parser, so plugin content can put text on stderr during install. That bypasses the one output channel (IL-2). The skills path already has the same exposure.
**Fix:** Record it as a known gap, or check Pi for a parse entry point that accepts `logLevel: "error"`. Pi's `parseFrontmatter` passes no options.

### IN-02: The unparseable note can name a defect the repair already fixed, and its line numbers count from the block

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:156-159`, `extensions/pi-claude-marketplace/bridges/agents/discover.ts:84-97`
**Issue:** `parseSource` always reports the first parse's error. When the repair fixes that defect and a second one remains, the note points at the fixed line. Probe: a colon description plus a repeated key reports `Nested mappings are not allowed…` at the description. Also, `yaml` counts lines from the start of the block after `---`, so "line N" is file line N+1.
**Fix:** Report the error of the second parse when the repair changed the text, or say that the line count starts after the opening `---`.

### IN-03: Leftover quote stripping unquotes YAML values a second time

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:218-232` (`splitToolList` -> `withoutMatchingQuotes`), `:1111-1113` (`isTrueBackground`)
**Issue:** Values now arrive already unquoted by YAML, but these helpers strip one more pair of quotes. `background: '"true"'` (the value is `"true"` with its quote marks) gives `async: true`, while D-PG7-05 says upstream accepts only `true` or `"true"`. `tools: ['"Read"']` grants `read`, while upstream sees an unknown tool named `"Read"`. These are minor divergences, kept from the line reader.
**Fix:** Drop `withoutMatchingQuotes` from `isTrueBackground`, and keep it in `splitToolList` only for the bracket-inside-a-string form, or record the leniency.

### IN-04: A lone-CR source skips the repair

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:176-181`
**Issue:** `repairSingleLineScalars` splits on `\n`, while Pi changes a lone `\r` to `\n` before it parses. So a lone-CR agent file with a colon description gets no repair and loads with no fields (probe `lonecr`). The skills path has the same behavior, and changing it would change skills.
**Fix:** Record it with the D-PG7-02 residuals, or normalize lone CR in the agents caller before the repair.

### IN-05: The docs say `apply` renames a quoted-name agent, but no scenario shows it

**File:** `docs/mcp-compatibility.md:422`
**Issue:** The docs list "an `apply` that moves the plugin" among the commands that remove the old `demo:"x"` file. The evidence covers only `update` and `reinstall` (the two "renames an agent…" scenarios).
**Fix:** Add an `apply` convergence scenario, or limit the sentence to what the scenarios show.

### IN-06: The PRD still describes the removed floor warning

**File:** `docs/prd/pi-claude-marketplace-prd.md:470`
**Issue:** The PRD still says "pi-subagents >= 0.62.0 -- older versions ignore the key, and the conversion warns about the floor". D-PG7-13 removed that warning. `docs/research/parity-gaps/subagents.md:239` also describes the old warnings as current.
**Fix:** Update the PRD line to say that `excludeTools` applies at the declared floor with no warning, and add `excludeTools` beside `tools` (D-PG7-12).

### IN-07: The `bigint` branch in `fieldValue` cannot run

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:177`
**Issue:** Pi's `parseFrontmatter` calls `parse(yamlString)` with no options (`node_modules/@earendil-works/pi-coding-agent/dist/utils/frontmatter.js`), so `intAsBigInt` is off and `yaml` never returns a `bigint`. The branch is dead, and no type forces it.
**Fix:** Remove `typeof value === "bigint"`.

---

_Reviewed: 2026-11-14T20:15:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
