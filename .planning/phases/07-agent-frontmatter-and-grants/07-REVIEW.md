---
phase: 07-agent-frontmatter-and-grants
reviewed: 2026-11-14T21:38:47Z
depth: deep
iteration: 2
files_reviewed: 22
files_reviewed_list:
  - README.es.md
  - README.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - docs/research/parity-gaps/subagents.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/shared/frontmatter-repair.ts
  - features/agent/frontmatter.feature
  - features/lib/workflow-files.ts
  - features/step_definitions/agent/listing.steps.ts
  - features/step_definitions/workflow/runs.steps.ts
  - features/workflow/agent-steps.feature
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/discover.test.ts
  - test/bridges/agents/frontmatter.test.ts
  - test/integration/pi-subagents-child-launch-conformance.test.ts
  - test/integration/provenance-invisibility.test.ts
  - test/integration/workflow-engine-agent-registry.test.ts
  - test/shared/frontmatter-repair.test.ts
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
  necessity: 0
status: issues_found
---

# Phase 7: Code Review Report (iteration 2)

**Reviewed:** 2026-11-14T21:38:47Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Scope: `git diff 11e32b27..HEAD` without `.planning/`, the fix commits for the iteration-1 findings. I read `07-REVIEW.md` (iteration 1) and `07-REVIEW-FIX.md`. I traced the generated file into its readers in the installed peers: pi-subagents 0.88.1 (`src/agents/frontmatter.js`, `src/agents/agents.js`, `src/runs/shared/model-resolution.js`, `src/agents/agent-management.js`, `src/runs/shared/claude-code-adapter.js`) and pi-dynamic-workflows 3.15.0 (`src/agent-registry.ts`). I replayed the edge cases against the branch code with node 26 and Pi's `parseFrontmatter`, and against `Bun.YAML.parse` with bun 1.4.4. Probes ran with a scratch `HOME` and `PI_CODING_AGENT_DIR`. The owner unit tests pass: 401 of 401 (`test/shared/frontmatter-repair.test.ts`, `test/bridges/agents/{frontmatter,discover,convert}.test.ts`).

What holds up:

- **CR-01 (`model: ""`).** Every consumer I traced reads it as "no model", and `subagents.defaultModel` never wins. pi-subagents' line reader gives `model: ""` (the empty value takes the deferred-block path, and `flushBlockLines([])` returns `""`). `applySubagentDefaultModel` replaces only `model === undefined`. `resolveSubagentModelOverride` maps an empty trimmed model to the parent model. `agentPinnedModel` (external runners) and `isUnavailableSubagentModel` both treat `""` as unset, and `subagent models` reports "inherits current session model". The engine reads `fm.model.trim() || undefined`. No code in this extension reads a generated file's `model` back. Only the display is affected (IN2-03).
- **CR-03 (one line or `|-`).** I found no one-line input that gives invalid YAML or a key under either reader. `readsAsPlainYamlText` does not throw on C0 controls, NUL, DEL, NEL, or BOM, all of which `yaml` accepts in a plain scalar. Numbers, `.inf`, `0o17`, booleans, null, `--- x`, `a #b`, `a\t#b`, and a trailing colon all take the block. Plain `2026-01-01`, `a,b`, `key:value`, and `... x` round-trip under both readers.
- **CR-02 (`blankEarlierDuplicateKeys`).** Keys inside an indented block scalar are not matched. Nested keys are not touched. Only the agents bridge calls the function, and the skills callers keep `repairSingleLineScalars` unchanged.
- **WR-02, IN-02, IN-07, and A-1** are correct for the cases they name. `isMapping` adds the note for text and list blocks, and an empty block or a comment-only block adds none.
- **IN-03.** No fixture, test plugin, or surveyed form in `07-RESEARCH.md` uses a quoted `background` or a quoted item in an unbracketed tool string. YAML 1.2 turns `True`/`TRUE` into the boolean, which `fieldValue` writes as `true`, so parity with Bun holds for the unquoted spellings too.

Key concerns:

1. D-PG7-19 says it keeps the last copy of a repeated key "as Bun does". The new function misses the earlier copy when that copy is a block list in a CRLF file, or a zero-indented list. Bun keeps the last value in both cases. Here the block stays unparseable, so the agent loses its tool restriction (CR2-01).
2. The provenance mapping is still not YAML-safe for the engine. Since IN-03, a stray quote in a tool string goes into `droppedTools` unchanged. Then the engine refuses the whole frontmatter: the CR-03 failure, through a different field (WR2-01).

## Critical Issues

### CR2-01: A repeated `tools` list in a CRLF file or written as a zero-indented list still loads the agent with every tool

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:211`, `:222-254` (span from `keyValueEnd`, `:53-78`)
**Issue:** `blankEarlierDuplicateKeys` misses two common YAML forms that Bun 1.4.4 reads with the last value kept:

1. **CRLF block list.** `TOP_LEVEL_KEY_NAME` is `/^([^\s:#]+):(?:[ \t]|$)/` with no `m` flag, and the function splits on `\n`. So a CRLF line `tools:\r` does not match: `\r` is neither `[ \t]` nor the end of the string. The earlier copy is not found, or the inline copy is taken for the last one. Probes against the branch code:
   - `---\r\nname: a\r\ntools:\r\n  - Read\r\n  - Bash\r\ntools: Grep\r\n---` gives `{"raw":{},"parseError":"Map keys must be unique at line 5…"}`.
   - `---\r\nname: a\r\ntools: Read\r\ntools:\r\n  - Grep\r\n---` gives `{"raw":{},"parseError":"Map keys must be unique at line 3…"}`.
   - The same files with LF give `{"name":"a","tools":"Grep"}`.
   - Bun: `Bun.YAML.parse("name: a\r\ntools:\r\n  - Read\r\ntools: Grep\r\n")` gives `{"name":"a","tools":"Grep"}`.
2. **Zero-indented list.** `keyValueEnd` stops at the first column-0 line. A compact list `tools:\n- Read\n- Bash` is valid YAML with its items at column 0, so only the `tools:` line is blanked. The orphaned `- Read`/`- Bash` lines then fail the second parse: `---\nname: a\ntools:\n- Read\n- Bash\ntools: Grep\n---` gives `{"raw":{},"parseError":"A block sequence may not be used as an implicit map key at line 2, column 1…"}`. Bun gives `{"name":"a","tools":"Grep"}`. With the IN-02 change, the note now names this defect, which the repair created, at the `name:` line. It is not a defect the author wrote.

In both cases the agent installs with no `tools` (every tool), `allowNestedSubagents: true`, and `inheritSkills: true`, where Claude Code keeps the restricted list. This is the outcome CR-02 was meant to remove. D-PG7-04 accepts every tool only for a file upstream also cannot parse. The comment at `:232-233` ("A line a key's value spans is indented or is the `:` line of an explicit key") does not hold for a zero-indented list. The unit table and the scenario cover only LF and indented lists.
**Fix:** Match a key followed by any whitespace or the end of the line, and extend an empty-valued key's span over the column-0 `- ` items that follow it. Do this in this function, so the shared `keyValueEnd` (which the skills bridge uses) stays unchanged:
```ts
const TOP_LEVEL_KEY_NAME = /^([^\s:#]+):(?:\s|$)/;
const COMPACT_SEQUENCE_ITEM = /^-(?:\s|$)/;

function spanEnd(lines: readonly string[], start: number, blockEnd: number): number {
  let end = keyValueEnd(lines, start, blockEnd);
  if (/^[^\s:#]+:\s*$/.test(lines[start] ?? "")) {
    while (end + 1 < blockEnd && (COMPACT_SEQUENCE_ITEM.test(lines[end + 1] ?? "") || /^\s/.test(lines[end + 1] ?? ""))) {
      end += 1;
    }
  }
  return end;
}
```
Add unit cases for CRLF (earlier and last copy as a block list) and for a zero-indented earlier copy. Extend the "A key written twice keeps its last value" scenario with a zero-indented list. Correct the comment at `:232`.

## Warnings

### WR2-01: Provenance values are written as bare YAML scalars, so a stray quote or indicator in a dropped tool makes the engine lose the agent

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:110-112`, `:456-470`, `:481-491`; `extensions/pi-claude-marketplace/bridges/agents/convert.ts:228-244`
**Issue:** `pushProvenanceList` writes each item as `    - <value>`, and `sourcePath`/`originalModel` as `  key: <value>`. `sanitizeProvenanceValue` now removes line breaks and control characters, and its doc says this protects "the workflow engine's YAML reader". It does not make the value a valid YAML plain scalar. The engine parses the whole block with Pi's YAML reader (`src/agent-registry.ts:88-95`). On a throw, it registers the agent under its file name with no tools, model, or description. Then `agent(…, {agentType: "demo:reader"})` runs with the engine's default tools and without the agent's body: the CR-03 outcome. End-to-end probes through `readAgentFrontmatter` → `convertAgent` → Pi `parseFrontmatter` on `fileContent`:
- `tools: Read, 'Bash` gives `droppedTools ["'Bash"]`, then `Missing closing 'quote`.
- `tools: Read, @Grep` gives `droppedTools ["@Grep"]`, then `Plain value cannot start with reserved character @`.
- `thinking: "x: y: z"` gives a warning with two `: `, then `Nested mappings are not allowed in compact mappings`.
- Emitter level: dropped tokens that start with `*`, `` ` ``, `%`, or `[`, and a `droppedFields` key such as `x: y: z`, fail the same way.

The IN-03 fix widened this path. Item quotes are now kept, so `tools: Read, '` (a case in `test/bridges/agents/convert.test.ts:3200`, which asserts `droppedTools: ["'"]`) now writes `    - '`, which is invalid YAML. Before IN-03 the token was stripped to nothing. pi-subagents is unaffected, because it skips indented lines. All of these inputs are malformed tool names or odd values, so this is not a blocker. Still, the file this bridge writes must be YAML for its second reader, and the T-07-05 engine test covers only line breaks.
**Fix:** Write every free-text provenance value with the existing `emitSafeDoubleQuotedScalar` (`shared/frontmatter-repair.ts:87`). pi-subagents never reads these lines, so the escapes do not matter to it, and the engine reads them as plain strings:
```ts
lines.push(`    - ${emitSafeDoubleQuotedScalar(sanitizeProvenanceValue(value))}`);
// and likewise for sourcePath / originalModel
```
Add engine-registry cases for `tools: Read, 'Bash` and `tools: Read, @Grep` that expect `demo:reader` with `tools: ["read"]`. Correct the `sanitizeProvenanceValue` doc.

## Info

### IN2-01: The duplicate-key blanking leaves several Bun-accepted forms unparseable, and the docs state it without limits

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts:211`, `docs/mcp-compatibility.md:401`
**Issue:** These forms still make the block unparseable, so the agent gets every tool and the note. Bun 1.4.4 keeps the last value for each:
- a quoted key (`tools: Read` then `"tools": Grep`)
- a space before the colon (`tools : Read`)
- an explicit key (`? tools` / `: Read`)
- a nested repeat, such as a key written twice inside `hooks:` or `mcpServers:` (Bun gives `{"hooks":{"x":2},…}`)

The docs say, without limits, that the extension "keeps only the last copy of a key that the block writes twice". These forms are rare and fall under the pending D-PG7-19.
**Fix:** Either list them as D-PG7-19 residuals in `docs/mcp-compatibility.md`, or normalize the quoted and spaced key forms in `TOP_LEVEL_KEY_NAME`.

### IN2-02: Two texts still describe the old `inherit` output

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:878-886`, `docs/prd/pi-claude-marketplace-prd.md:461`
**Issue:** The `ConvertAgentInput.mapModel` doc still says a source `inherit` "is always written as `model: inherit`". `types.ts` and `mapModel` were updated to `model: ""` (D-PG7-17). The PRD's `model:` bullet still says "`inherit` → omit + record `originalModel`", which contradicts both D-PG7-11 and D-PG7-17.
**Fix:** Say `model: ""` (D-PG7-11, D-PG7-17) in both places.

### IN2-03: `subagent list` shows an empty model for an `inherit` agent, where an agent without a model shows "inherits current session"

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:82`
**Issue:** pi-subagents' list line (`src/agents/agent-management.js:785-791`) prints `agent.model` whenever it is not `undefined`, so `model: ""` shows `Model: ;`. With `subagents.defaultProvider` set, `applySubagentDefaultModel` adds a `modelProvider`, and the line shows `Model: anthropic/`. Note that `inherit` showed `anthropic/inherit` in the same case. `/subagents` admin views print `Model: ` (`src/slash/subagents-admin.js:175`, `:342`), because `""` is not nullish. Runtime selection is correct. ROADMAP criterion 4 (`subagent get` shows `model inherit`) is no longer met. The fix report already flags this under the pending D-PG7-17.
**Fix:** None needed in code. Carry the criterion wording and the empty `Model:` display into the D-PG7-17 review.

---

_Reviewed: 2026-11-14T21:38:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
