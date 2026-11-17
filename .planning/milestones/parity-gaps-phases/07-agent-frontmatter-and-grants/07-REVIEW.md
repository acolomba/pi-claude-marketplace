---
phase: 07-agent-frontmatter-and-grants
reviewed: 2026-11-14T22:38:11Z
depth: deep
iteration: 3
files_reviewed: 15
files_reviewed_list:
  - docs/mcp-compatibility.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/shared/frontmatter-repair.ts
  - features/agent/frontmatter.feature
  - features/mcp-server/agent-grants.feature
  - features/workflow/agent-steps.feature
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/frontmatter.test.ts
  - test/bridges/agents/grant-forms.test.ts
  - test/bridges/agents/stage.test.ts
  - test/integration/provenance-invisibility.test.ts
  - test/integration/workflow-engine-agent-registry.test.ts
  - test/shared/frontmatter-repair.test.ts
  - extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
  necessity: 0
status: issues_found
---

# Phase 7: Code Review Report (iteration 3)

**Reviewed:** 2026-11-14T22:38:11Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Scope: `git diff 0fdbc054..HEAD` without `.planning/`, the fix commits for the iteration-2 findings (60c64098, 32db7e90, f8fab792, b38bd8a2, 9546095d). I read the iteration-2 `07-REVIEW.md` and the "Iteration 2" section of `07-REVIEW-FIX.md`. I traced the changed writers into their readers and into the session-start grant rewrite (`grant-rewrite.ts`, `legacy-grant-form.ts`, `mcp-async-warning.ts`, `persistence/agents-index-io.ts`). I also traced them into the installed peers: pi-subagents' line reader (`src/agents/frontmatter.js`) and the engine's `dist/agent-registry.js` (pi-dynamic-workflows). I replayed edge cases against the branch code with node 26, Pi's `parseFrontmatter`, the engine's `loadAgentRegistry`, and `Bun.YAML.parse` (bun 1.4.4). A fuzz ran 39,304 three-character provenance values through the emitter and Pi's reader. Every probe ran with a scratch `HOME` and `PI_CODING_AGENT_DIR`. The owner tests pass: 509 of 509 (`test/shared/frontmatter-repair.test.ts` and `test/bridges/agents/{frontmatter,convert,grant-forms,stage,legacy-grant-form,grant-rewrite,mcp-async-warning}.test.ts`), plus 617 of 617 in `test/orchestrators/plugin/{update-swap,install-outcome,reinstall-flow}.test.ts` and `test/orchestrators/mcp/agent-grants-step.test.ts`.

What holds up:

- **CR2-01 and IN2-01.** The widened key pattern does not blank a line that is not an earlier duplicate in any block that Pi's YAML reader could otherwise read. A column-0 continuation of a quoted scalar or a flow collection is already refused by Pi (`Missing closing "quote`, `Flow sequence in block collection must be sufficiently indented`). The repair runs only after that refusal, and the old pattern matched those lines too. Block-scalar headers (`|`, `>-`, `|  # c`) are not open values, so they keep the `keyValueEnd` span. A nested key is indented, and a column-0 `- ` item never matches the key pattern. So no key is found inside a span. A key repeated inside `hooks:` is left alone, as the docs say. `keyValueEnd` and `repairSingleLineScalars` are unchanged. Only `bridges/agents/frontmatter.ts` calls `blankEarlierDuplicateKeys`, so skills are not affected. CRLF, compact lists, quoted keys, and `tools :` all give the same result as Bun.
- **WR2-01 for the three routed writers.** No three-character value that starts with a non-blank character is misread or throws. That covers `sourcePath`, `originalModel`, and the list items.
- **Stored warnings from earlier releases.** Both stored-form generations still swap: the swap is a byte-for-byte `startsWith` match on the stored block, and old rows store the old, unquoted block. Legacy files written before the index stored forms carry unquoted `    - ` items, so `translateLine` still rewrites the async warning, and `isLegacyCandidate` reads `row.warnings`, which stay unquoted text. Ownership checks use the marker and not the bytes, so the new quoting does not make an earlier release's file look edited.

Key concerns:

1. `provenanceScalar` now runs Pi's YAML parser on every provenance value, and the parser throws on some of them. `--map-model` with a source model such as `" - x"` fails the whole install with a raw `YAMLParseError` (WR3-01). This is a regression from the WR2-01 fix.
2. WR2-01 left two of the five provenance writers bare. A source agent named `'reader` or `@reader` still makes the engine lose the agent (WR3-02).
3. A column-0 comment inside the earlier copy of a list still leaves the agent with every tool, where Claude Code keeps the later restriction (WR3-03).

## Warnings

### WR3-01: `provenanceScalar` throws a raw YAMLParseError for a value with leading whitespace before an indicator, which fails the plugin's install

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:57`, `:66-71`, `:116-119`; `extensions/pi-claude-marketplace/bridges/agents/convert.ts:356`
**Issue:** The `readsAsPlainYamlText` doc says "the unsafe forms are the ones that make YAML throw, so the parse does not throw". That holds only for a value with no leading whitespace. `YAML_UNSAFE_PLAIN` tests the indicator at `^`, but YAML skips the blanks after `description: `. So for ` - x`, ` ? x`, or `\t,x`, the regex passes, and then `parseFrontmatter` throws:
- `Unexpected block-seq-ind on same line with key at line 1, column 15`
- `Nested mappings are not allowed in compact mappings`
- `Plain value cannot start with flow indicator character ,`

Before this iteration, `descriptionLines` was the only caller, and it gets a trimmed value (`nonBlank`). Commit f8fab792 added `provenanceScalar`, which gets values that are not trimmed. `mapModel` records `originalModel: raw`, the source value before the trim. End-to-end through `readAgentFrontmatter` → `convertAgent` with `mapModel: true`:
- `model: " - x"` → `THROW YAMLParseError Unexpected block-seq-ind on same line with key at line 1, column 15`
- `model: " ? x"` → `THROW YAMLParseError Nested mappings are not allowed in compact mappings …`
- `model: "\t,x"` → `THROW YAMLParseError Plain value cannot start with flow indicator character , …`

The same source without `--map-model` converts. `convertAgent`'s throw fails the agents staging, so `install … --map-model` (or `update … --map-model`) fails the whole plugin. The message names line 1, column 15 of a document the user never wrote. In the fuzz, all 1,728 failing values out of 39,304 start with a blank or a control character, and all 1,728 throw. Claude Code treats such a model as unknown and installs.
**Fix:** A plain scalar never keeps leading or trailing blanks, so such a value is never "plain YAML text". Refuse it before the regex and the parse, so the value is quoted and nothing is parsed:
```ts
function readsAsPlainYamlText(value: string): boolean {
  return (
    value === value.trim() &&
    !YAML_UNSAFE_PLAIN.test(value) &&
    parseFrontmatter(`---\ndescription: ${value}\n---\n`).frontmatter.description === value
  );
}
```
Add ` - x`, ` ? x`, and `\t,x` to the T-07-05 round-trip case in `test/bridges/agents/frontmatter.test.ts`. Add a `convertAgent` case with `mapModel: true` and `model: " - x"` that expects the file and an `originalModel` that reads back as `" - x"`.

### WR3-02: `sourceAgent` and `sourcePlugin` are still written bare, so a source agent named `'reader` or `@reader` makes the engine lose the agent

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:467-468` (also `:404`, `:411`)
**Issue:** The WR2-01 fix routes `sourcePath`, `originalModel`, and the three lists through `provenanceScalar`. The comment at `:462-463` and the `GeneratedProvenanceFields` doc say that free-text values are quoted when YAML would not read them as their text. But `  sourcePlugin: ${provenance.pluginName}` and `  sourceAgent: ${provenance.sourceName}` are still written bare. Both are free text. `sourceName` is the trimmed frontmatter `name:`, or the file stem, and `assertSafeName` checks only for empty, `.`/`..`, separators, and C0/DEL. Plugin names are `Type.String()` plus the same check. Emitter probe with Pi's reader, `sourceAgent:` line:
- `'reader` → `Missing closing 'quote`
- `@x`, `` `x ``, `%x` → reserved or directive character
- `*x` → `Unresolved alias`
- `[x`, `{x`, `"x`, `- x`, `? x`, `|x`, `>x` → throw
- `!x` → reads `""` with a tag warning
- `true`, `1`, `null`, `~` → read as non-strings

End-to-end through `convertAgent` and the engine's `loadAgentRegistry`: source names `@reader` and `'reader` register as `pi-claude-marketplace-demo-@reader` / `…-'reader` with `tools=undefined desc=undefined`, where `reader` registers as `demo:reader tools=["read"]`. This is the WR2-01 outcome: `agent(…, {agentType: "demo:@reader"})` runs without the agent's body. A name with `: ` (`name: "Reviewer: code"`) also breaks the top-level `name: demo:Reviewer: code` line (`:404`). The `aliases:` line (`:411`) breaks in the same way. Those two lines were not touched in this diff, but they belong to the same class. pi-subagents reads them, and it strips one pair of quotes without unescaping.
**Fix:** Route both provenance lines through `provenanceScalar`. pi-subagents skips indented lines, so quoting them is free:
```ts
`  sourcePlugin: ${provenanceScalar(provenance.pluginName)}`,
`  sourceAgent: ${provenanceScalar(provenance.sourceName)}`,
```
Add engine-registry cases for source names `'reader` and `@reader`. Record a decision for the top-level `name:`/`aliases:` lines. One option is to double-quote them when `readsAsPlainYamlText` fails and the value holds no `"` or `\`, because pi-subagents unquotes without unescaping. The other is to refuse such names at discovery.

### WR3-03: A column-0 comment line inside the earlier copy of a list still leaves the agent with every tool

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:258-271`; `docs/mcp-compatibility.md:401`
**Issue:** `duplicateKeySpanEnd` ends an open value's span at the first line that is neither blank nor `OPEN_VALUE_LINE`. A column-0 comment is neither, but YAML (and pi-subagents' reader, `frontmatter.js:93-96`) reads a comment line as nothing, and the list goes on after it. The items after the comment are left orphaned, the second parse fails, and the agent installs with no `tools` (every tool), `allowNestedSubagents: true`, and the D-PG7-04 note. Probes through `readAgentFrontmatter`:
- `tools:\n- Read\n# c\n- Bash\ntools: Grep` → `raw: {}`, `A block sequence may not be used as an implicit map key at line 2, column 1`
- `tools:\n  - Read\n# c\n  - Bash\ntools: Grep` (indented items; the open-value path handles them as well) → `raw: {}`, same error

Bun 1.4.4 gives `{"name":"a","tools":"Grep"}` for both. So does a comment right after the key line (`tools:\n# the list\n- Read`). The docs now say that an earlier copy "is removed with its value, also when the value is a list". The residual list does not name this form. This is the CR2-01 outcome. A comment between list items is less common than CRLF or a compact list, so this is a warning and not a blocker.
**Fix:** An open value is a collection or null, never a block scalar, so a column-0 comment cannot end it. In `duplicateKeySpanEnd`'s open-value loop, skip comment lines as blank lines are skipped. `end` moves only on value lines, so a comment after the last item stays:
```ts
if (line.trim() === "" || line.startsWith("#")) {
  continue;
}
```
Leave `keyValueEnd` alone: a column-0 `#` does end a block scalar. Add shared and reader cases for both probes, and an Outline row with a comment between the column-0 items.

## Info

### IN3-01: The legacy translation does not recognize the newly quoted warning item, so a current file translated as legacy keeps the adapter warning text

**File:** `extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts:122-124`; `extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts:24-25`
**Issue:** `translateLine` passes `line.slice(LIST_ITEM.length)` to `rewriteMcpAsyncWarning`, which compares exact text. A file written by this release holds `    - "tools include … (`async: true`); a launch before pi-mcp-adapter has cached …"`, quotes included, so the comparison fails and the line is copied unchanged. The legacy path reaches such a file whenever `loadAgentsIndex` drops a row's stored pair as malformed (AGENTIDXFORM-01, `agents-index-io.ts:126-150`). The row then has no `mcpImplementation`, and `isLegacyCandidate` is true under built-in. Probe: `deriveLegacyGrantForms` on an emitted adapter file gives a built-in block with `tools: mcp:plugin_demo_srv` but the pi-mcp-adapter warning line (`file has builtin text: false, file has adapter text: true`), while `builtin.warnings` holds the built-in text. The file's provenance and the index disagree. Grants are correct and the text is informational only. The `mcp-async-warning.ts` comment says that both modules recognize the warnings "by this exact text", which no longer holds for file lines.
**Fix:** In `translateLine`, also match the quoted form. For example, compare the item with `emitSafeDoubleQuotedScalar(form)` for each generation and emit the rewritten text quoted the same way. Add a `legacy-grant-form.test.ts` case with a quoted current-form item.

### IN3-02: Other repeated-key forms that Bun accepts are still unparseable, and the docs do not list them

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:238`; `docs/mcp-compatibility.md:403-409`
**Issue:** A key line whose value is only an anchor or a tag, followed by column-0 items (`tools: &t\n- Read` or `tools: !!seq\n- Read`, then `tools: Grep`), is not an open value. It gets the `keyValueEnd` span, which leaves `- Read` orphaned: `raw: {}`, `A block sequence may not be used as an implicit map key`. Bun gives `{"name":"a","tools":"Grep"}`. These forms are rare. The D-PG7-19 residual list names an explicit key, a nested repeat, and an escaped quoted key, but not this one.
**Fix:** Either add the form to the residual list, or treat a value of only `&anchor` and/or `!tag` (and an optional comment) as an open value.

### IN3-03: The PRD still contradicts D-PG7-11/D-PG7-17, and the reason for leaving it does not hold

**File:** `docs/prd/pi-claude-marketplace-prd.md:461`
**Issue:** IN2-02 is marked fixed, but the PRD's `model:` bullet still says that without the flag the file "MUST OMIT `model:` entirely regardless of the source value". With the flag it says "`inherit` → omit + record `originalModel`". The code writes `model: ""` for `inherit` in both cases. The fix report says that the PRD "is a research record". This phase's own commit a0de5b3f ("match the agent docs to what the code and tests show") edited that same PRD to match the code. So the PRD is maintained as current behavior.
**Fix:** Change the bullet to say that a source `inherit` is always written as `model: ""` (D-PG7-11, D-PG7-17), with or without `--map-model`.

---

_Reviewed: 2026-11-14T22:38:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
