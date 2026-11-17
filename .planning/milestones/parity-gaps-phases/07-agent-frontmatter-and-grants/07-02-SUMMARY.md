---
phase: 07-agent-frontmatter-and-grants
plan: "02"
subsystem: bridges-agents
tags: [frontmatter, yaml, agents, parity]
status: complete
requires:
  - shared/frontmatter-repair.ts (plan 07-01)
provides:
  - readAgentFrontmatter (bridges/agents/frontmatter.ts), the one reader of a source agent
  - the D-PG7-04 discovery note for an unparseable agent (bridges/agents/discover.ts)
affects:
  - extensions/pi-claude-marketplace/bridges/agents/*
  - every staging verb (through discovery warnings)
tech-stack:
  added: []
  patterns: ["parse, repair once, parse again (skills analog)", "value normalization once in the reader so raw stays string-typed"]
key-files:
  created:
    - .planning/phases/07-agent-frontmatter-and-grants/07-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/discover.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - test/bridges/agents/frontmatter.test.ts
    - test/bridges/agents/discover.test.ts
    - test/bridges/agents/convert.test.ts
    - features/agent/frontmatter.feature
    - docs/mcp-compatibility.md
    - docs/output-catalog.md
decisions:
  - "readAgentFrontmatter(rawText: string): ParsedFrontmatter; ParsedFrontmatter gains optional parseError (D-PG7-01, D-PG7-04)"
  - "Agents repair trigger = colonRepairTrigger OR /^[*&!%@`]/, module-private (D-PG7-02 as amended)"
  - "The D-PG7-04 note is a discovery warning built beside duplicateWarning; the converter adds none"
metrics:
  completed: 2026-11-14
  tasks: 3
actuals:
  tokens: 20100
  tasks: 3
  commits: 3
plan_head_before: 856ab5959427d601e0d9399162b5095a36370f1b
plan_head_after: f736b53742df5b7b6a770cea19abdd0f79353008
---

# Phase 07 Plan 02: Agent frontmatter read as YAML Summary

A source agent's frontmatter is now read with Pi's YAML `parseFrontmatter`, repaired once with the shared single-line repair when the first parse throws, and loaded with no fields plus one install note when the repaired block still fails. The line reader and its helpers are gone.

## Interface for plan 07-03

```typescript
export interface ParsedFrontmatter {
  readonly raw: RawAgentFrontmatter;
  readonly body: string;
  /** D-PG7-04: the message of Pi's first parse, present only when the block did not parse after the repair. */
  readonly parseError?: string;
}
export function readAgentFrontmatter(rawText: string): ParsedFrontmatter;
```

Module-private in `bridges/agents/frontmatter.ts`: `agentRepairTrigger`, `parseRepaired`, `parseSource`, `fieldValue`, `rawFields`, `UNSAFE_KEY_CHARACTER = /[\p{Cc}\u2028\u2029]/gu`. The output side (`emitYamlScalar`, `sanitizeProvenanceValue`, `GeneratedToolsFields`, both emitters, the AG-8 text) is unchanged. Imports: `platform/pi-api.ts` (`parseFrontmatter`), `shared/bom.ts`, `shared/errors.ts`, `shared/frontmatter-repair.ts`, `shared/own-key.ts`; no `yaml` import.

Value rules: string kept; boolean, number, bigint as `String`; null as `""`; sequence as items (same rule) joined with `,`; mapping as `""`. A document that is not a mapping gives `{}` and no `parseError`. Keys have control characters and U+2028/U+2029 replaced by a space and are stored with `setOwn`.

## Final note text (for maintainer review)

```text
agent "<plugin>:<namespace...>:<name>": its source frontmatter could not be parsed (<first line of the parser message, trailing colon removed>); the agent is loaded with no frontmatter fields, so its tools, model, and description settings are not applied.
```

Pinned instance (scenario and catalog): `agent "demo:broken": its source frontmatter could not be parsed (Missing closing "quote at line 3, column 12); the agent is loaded with no frontmatter fields, so its tools, model, and description settings are not applied.`

## Commits

| Task | Commit | Title | Hook |
|------|--------|-------|------|
| 07-02-01 | 6d46e104 | feat(agents): read agent frontmatter as YAML (8 files) | check:commit Passed, gitlint Passed |
| 07-02-02 | e01fd18e | feat(agents): report an agent whose frontmatter cannot be parsed (3 files) | check:commit Passed, gitlint Passed |
| 07-02-03 | f736b537 | docs(agents): record how agent frontmatter is read (2 files) | check:commit Passed, gitlint Passed |

No commit used `--no-verify`, `--amend`, `git stash`, or `git add -A`. `07-VALIDATION.md` stayed unstaged in every commit.

## Red and green runs

Node v26.13.1 locally (CI pins 24).

Task 07-02-01, on the unchanged tree (HEAD 856ab595), adapter profile, the two new scenarios: exit 1, 2 scenarios (2 failed).
- "Quoted frontmatter values ...": actual `agent demo:"x", aliases pi-claude-marketplace-demo-"x"`, `demo:colon ...: "Reviews: code."` with quote marks, and `demo:mixed ...: Reviews: code and tests` with no model.
- "A comment after a frontmatter value ...": actual `demo:hidden ...; tools read, bash` (the staged-file step was skipped).

Task 07-02-01 green, after the change:
- `npm run test:cucumber:profile -- --profile adapter features/agent features/mcp-server/agent-grants.feature features/plugin/staging-warnings.feature features/workflow/agent-restrictions.feature`: first run 87 scenarios (86 passed, 1 failed). The failure was my own new scenario's expected staged text (`inheritSkills: true`; an explicit `tools: Read` list writes `inheritSkills: false`). I corrected that new expectation; the two new scenarios then passed (2 scenarios, 29 steps). No existing scenario's text changed, and the `starred` row of "Tool lists split on commas and spaces as Claude Code splits them" stayed green.
- `npm run test:cucumber:profile -- --profile builtin features/agent/frontmatter.feature features/mcp-server/agent-grants.feature`: 14 scenarios (14 passed), 192 steps.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts" test/orchestrators/plugin/discover-names.test.ts test/orchestrators/plugin/info.test.ts`: 757 tests, 757 pass.
- `npm run test:coverage:direct -- bridges/agents/frontmatter.ts bridges/agents/discover.ts`: exit 0.
- `npm run check:features`: exit 0. `npm run check:static`: typecheck, fallow, format:check, test:corresponding, check:features passed; lint failed on three literal U+FEFF characters that my shell write put into the test file. I replaced them with `\uFEFF` escapes, and ESLint over the changed files then passed.

Task 07-02-02, run after 07-02-01 with `discover.ts` at its 07-02-01 version:
- "Installing an agent whose frontmatter cannot be parsed reports the agent": red, only the cascade row and no diagnostic.
- "An agent whose frontmatter cannot be parsed is listed under its file name ...": green, as a guard. (A first draft used the setup step `, which warned`, which was red too, because the install with pi-subagents loaded is `info` apart from the diagnostic. The final step is `, which did not fail`.)
- Green after the change: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/agent/listing.feature features/plugin/staging-warnings.feature`: 43 scenarios (43 passed), 579 steps. `node ... --test test/bridges/agents/discover.test.ts test/bridges/agents/stage.test.ts`: 73 pass. `npm run test:coverage:direct -- bridges/agents/discover.ts`: exit 0. `npm run check:features`: exit 0. ESLint: the first draft used `/\n[\s\S]*$/`, which `sonarjs/super-linear-regex` refused; it now cuts at `` `${parseError}\n`.indexOf("\n") ``.

Task 07-02-03:
- `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md docs/output-catalog.md`: exit 0, no file rewritten.
- `node ... --test "test/architecture/catalog-uat/*.test.ts"`: 78 pass. `EXPECTED_STATE_COUNT` (324) and `EXPECTED_UTF8_BYTES` (54_553) are unchanged. `grep -c catalog-state docs/output-catalog.md` = 349.
- `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature`: 16 scenarios (16 passed), 224 steps.

The full `npm run check` wave gate was not run here. The orchestrator owns it.

## Changed owner-test expectations

`test/bridges/agents/frontmatter.test.ts`: the `parseFrontmatter` block is replaced by `describe("readAgentFrontmatter")`. These are the replaced expectations:
- Bodies: Pi trims the body after a closed block, so `"\nReview the change.\nKeep the final newline.\n"`, `"Body.\n"`, and `"Review the change.\n"` become the trimmed text. The CRLF case no longer keeps `"Body.\r\n"`: Pi's body is LF-only and trimmed. The four no-fence rows keep their bytes.
- `description: "Review: source changes"` no longer keeps its quote marks (D-PG7-01).
- `inheritSkills: false` and `escaped: line\nnot-a-newline` scalar rows: replaced by the boolean and number text rows.
- Removed, because they pinned line-reader leniency that YAML does not have: dash items under a one-line value (YAML refuses the block), the malformed-lines row (`colonless`, `: empty-key`, orphan dash), an indented key with no key before it, an indented stray line between dash items, and the inherited-setter row (`setOwn` makes it moot; the `__proto__` row covers T-07-03).
- Block scalars: YAML keeps its final line feed (`|` gives `"First line.\nSecond line.\n"`, `>` gives `"First line. Second line.\n"`). The eight block-header rows, the fold-separator row, and the empty block-header row are replaced by one `|` row and one `>` row.
- `description: ">"` now reads as `>`. A mapping under a key (`provenance:` with indented keys) is `""`, not the indented text.
- New rows: comments, flow and block sequences, column-0 dash items, null and empty, mapping values, a key with a line break, documents that are not mappings, the repair (colon, `*`, `@`, backtick), unterminated quote, failed repair (first message), CRLF, BOM repair, `__proto__`.

`test/bridges/agents/discover.test.ts`: the body values of 13 cases are now Pi's trimmed body. A no-frontmatter CRLF file gives `"Plain body\n"`, and the parametrized duplicate case gets a per-row `body`. The folded description gains YAML's final `\n`; the converter trims it. New cases: five D-PG7-05 name rules, two T-07-04 refusals with exact messages, and four D-PG7-04 note cases.

`test/bridges/agents/convert.test.ts`: the inlined-skill case compares `agent.frontmatter` with `plain.frontmatter` and the whole `fileContent` text, and no longer imports the reader.

## Deviations from Plan

**1. [Rule 1 - Bug] Wrong expectation in my own new scenario.** The staged file of `tools: Read # note` writes `inheritSkills: false`. I corrected the new scenario's text in commit 6d46e104. No existing scenario changed.

**2. [Rule 3 - Blocking] The listing scenario's setup step.** With pi-subagents loaded, the install's cascade is `info` and the note is a `warning` diagnostic, so the step is `, which did not fail`. Plan intent kept: the guard passes before and after the change.

**3. Added proof beyond the plan.** The listing scenario also states the staged file of the unparseable agent. Its `warnings:` list holds only the converter's existing `source description was missing or empty -- using fallback` line, not the note. This proves that the note has one producer.

**4. Note reason trimmed.** The parser's first line ends with `:`, and the note drops that one trailing colon so the parenthesis reads cleanly.

## Flagged assumptions (carried from the plan)

- A7: a mapping under a key that the converter reads counts as an empty value (`tools:` with a mapping keeps the AG-11 refusal).
- A1: YAML null under `tools` becomes `""` (AG-11 refusal). Not checked against upstream.
- A2: a block that is not a mapping gives no fields and no note.
- A3: Claude Code refuses a repeated key and a tab-indented block. The compatibility text states this as an assumption.
- D-PG7-04 vs "fail closed on corrupt data": still pending maintainer review. An unparseable agent gets every tool, and the note is the mitigation.
- Body bytes for unusual sources (Pitfall 5): Pi's body is trimmed and LF-only, and pi-subagents trims the body itself.
- `\p{Cc}` in the key rule also replaces C1 controls (U+0080 to U+009F), which is a little wider than "ASCII control characters plus line terminators".

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-03 (`__proto__` row), T-07-04 (two refusal rows), T-07-05 (line-break key row), T-07-06 (note on every staging verb, scenario), and T-07-08 (one-line, path-free note row) are mitigated as planned. T-07-07 is accepted: no option is passed to Pi's parser.

## Parent lines

- PROJECT.md decision row: D-PG7-01 (agent frontmatter read as YAML through Pi's parser, repair once, then no fields). Mark D-PG7-02 (narrow repair set plus the agents openers `*&!%@` and the backtick) and D-PG7-04 (an unparseable agent loads with no fields and every tool, with a note) as accepted without maintainer review. The final note text is above.
- BACKLOG entry: widen the agents repair to Claude Code's full retry set (any of ``{}[]*&#!|>%@` `` anywhere, leading tabs to spaces), as the D-PG7-02 residual. It needs a split trigger so that skills are not affected.
- CHANGELOG line: "Plugin agent frontmatter is read as YAML, as Claude Code reads it: quoted values lose their quote marks, comments are ignored, and an agent whose frontmatter cannot be parsed installs with no fields and a note."
- `.planning/codebase/STACK.md` (Languages, Secondary, YAML): it says `bridges/agents/frontmatter.ts` reads frontmatter line by line. Now only the skills degrade path is line-based. Agents read through Pi's `parseFrontmatter` (yaml), with the shared line-based repair.
- 07-VALIDATION.md / STATE.md: plan 07-02 is complete, and PG-AGENT-05 is delivered by the reader, the note, and the docs. The wave 2 gate (`npm run check`, 2400 s) still has to run on the tree at f736b537 or later.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts (`export function readAgentFrontmatter`; no `export function parseFrontmatter`, no `foldDashItem`)
- FOUND: features/agent/frontmatter.feature (four new scenarios)
- FOUND: 6d46e104, e01fd18e, f736b537 (ancestors of HEAD)
