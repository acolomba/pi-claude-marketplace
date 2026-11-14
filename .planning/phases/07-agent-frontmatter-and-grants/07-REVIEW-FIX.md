---
phase: 07-agent-frontmatter-and-grants
fixed_at: 2026-11-15T01:30:00Z
review_path: .planning/phases/07-agent-frontmatter-and-grants/07-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-11-14T23:30:00Z
**Source review:** .planning/phases/07-agent-frontmatter-and-grants/07-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (3 critical, 2 warning, 7 info; scope `all`)
- Fixed: 10 (CR-01, CR-02, CR-03, WR-02, IN-02, and IN-03 are logic fixes: fixed, requires human verification)
- Skipped: 2 (IN-01 and IN-04 have no code change; both are recorded as gaps in the docs, commit 0f33521d)
- Also fixed: security advisory A-1 of 07-SECURITY.md (UF-07-01 is CR-03)

Where verification ran: every check ran in the main checkout of the worktree
`/home/acolomba/src/pi-claude-marketplace-gaps-agents` (branch
`features/gaps-agents`, `workflow.use_worktrees` not used: no review-fix
worktree was created). `npm run check` was not run; the orchestrator runs it.
Each commit passed the commit hook (`npm run check:commit`: static checks,
unpaired tests, and direct coverage for the staged pairs).

## Fixed Issues

### CR-01: `model: inherit` makes bridged workflow steps fail with MODEL_NOT_FOUND

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`, `extensions/pi-claude-marketplace/bridges/agents/types.ts`, `test/bridges/agents/convert.test.ts`, `test/integration/pi-subagents-child-launch-conformance.test.ts`, `test/integration/workflow-engine-agent-registry.test.ts` (new), `features/agent/frontmatter.feature`, `features/workflow/agent-steps.feature` (new), `features/lib/workflow-files.ts`, `features/step_definitions/workflow/runs.steps.ts`, `features/step_definitions/agent/listing.steps.ts`, `README.md`, `README.es.md`, `docs/mcp-compatibility.md`
**Commit:** 9b6c595c
**Applied fix:** A source `inherit` now writes `model: ""`. Both readers were traced in the installed peers. pi-subagents 0.88.1 reads `""` as an empty model: `applySubagentDefaultModel` applies `subagents.defaultModel` only to `model === undefined`, and `resolveSubagentModelOverride` treats an empty model as "inherit the parent's model". The workflow engine 3.15.0 reads `fm.model.trim() || undefined`, so the step runs as for an agent with no `model:` line. No single-line or block form gives pi-subagents `inherit` and the engine a non-string. Omitting the line, the review's option (a), would let `subagents.defaultModel` win, which loses PG-AGENT-07a's ranking. New steps: `the user runs the workflow command {string}, whose agent steps the model answers` and `pi-subagents runs subagents on the model {string} by default`.
**Tests:** new scenario "A workflow step on a plugin agent whose source model is inherit runs on the session's model" through the real engine. The two `subagent get` scenarios became "A source model of inherit runs the child on the session's model over pi-subagents' default model" (without and with `--map-model`): they set `subagents.defaultModel` to an unknown model and run the child. New integration cases: pi-subagents discovery plus `resolveEffectiveSubagentModel` gives the parent model, and the engine's `loadAgentRegistry` gives no model.
**Negative control:** with `"inherit"` the workflow scenario fails with `Model "inherit" not found` and the engine integration case fails. With the line omitted, both run scenarios fail with `error naming claude-haiku-5-5`, and the pi-subagents integration case returns `anthropic/claude-haiku-5-5`.
**Pending maintainer review:** proposed decision **D-PG7-17**: write `model: ""` for a source `inherit`. It amends D-PG7-11 and ROADMAP criterion 4 (`subagent get` shows `model inherit`): `subagent get` now shows no model line, and `subagent list` capabilities shows an empty `Model:`. That criterion's wording is an override candidate. The form depends on pi-subagents' empty-model handling, which the integration case pins. `docs/research/parity-gaps/subagents.md` and `docs/prd/parity-gaps-prd.md` still describe the proposal to write `model: inherit`; they are research records and were left as they are.

### CR-03: A quoted description with `: ` is written as a block that is not YAML

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/bridges/agents/frontmatter.test.ts`, `test/integration/provenance-invisibility.test.ts`, `test/integration/workflow-engine-agent-registry.test.ts`, `features/workflow/agent-steps.feature`, `docs/mcp-compatibility.md`
**Commit:** a93013e1
**Applied fix:** A one-line description stays on the key line only when YAML reads it as its own text. That means no leading indicator (``-?:,[]{}#&*!|>'"%@` ``), no colon before a space or at the end, no `#` after a space, and a parse with Pi's `parseFrontmatter` that gives the same string, which rules out numbers, booleans, and null. Any other description becomes the existing `|-` block, which both readers take literally. `emitYamlScalar` and its quote flips are gone, because a value that starts with a quote mark or is a block header now takes the block. The indicator check runs before the parse, so no tag reaches the YAML reader. This also fixes the pre-phase AG-6 case, an unquoted `Reviews: code`, which also broke the engine. The security audit's UF-07-01 is the same defect: the engine registry test covers a leading `@`.
**Tests:** emitter table cases (colon, trailing colon, ` #`, `@`, `-`, `[`, `123`, `true`, `null`, quote marks, block headers, a colon and hash that stay plain); pi-subagents reader cases in `provenance-invisibility.test.ts`; engine registry cases that find `demo:reader` with its description and `["read"]`; and the scenario "A workflow step on a plugin agent whose quoted description holds a colon runs on the agent's body". It checks that the engine child receives the agent body, not `Act as workflow subagent type: demo:reader`.
**Negative control:** with the old emitter, 3 of 4 engine cases, 18 emitter unit cases, and the scenario fail. The scenario's child receives `Act as workflow subagent type: demo:reader`.
**Pending maintainer review:** proposed decision **D-PG7-18**: a one-line description that YAML does not read as its own text is written as the `|-` block.

### CR-02: A key written twice makes the agent load with every tool

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts`, `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/shared/frontmatter-repair.test.ts`, `test/bridges/agents/frontmatter.test.ts`, `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`
**Commit:** 2995113d
**Applied fix:** New `blankEarlierDuplicateKeys` in the shared module. It finds each column-0 key's span with `keyValueEnd` and turns every line of an earlier copy into an empty line, so the line count stays. Only the agents bridge calls it, before the colon repair, on the second parse. Bun 1.4.4 was replayed (`Bun.YAML.parse`): it keeps the last value of a repeated key, also when the earlier copy is a block list, and it refuses tab indentation. The docs claim at the old lines 407-410 was corrected. A shared `fencedBlock` helper removes the fence prologue that the new function would have duplicated with `repairSingleLineScalars`. That is a pure refactor, and the skills tests pass unchanged.
**Tests:** 8 shared unit cases (blank one copy, a multi-line copy, three copies, no repeat, an indented key, a key after the fence, no fences); 2 `readAgentFrontmatter` cases; the scenario "A key written twice keeps its last value, as Claude Code keeps it" (`tools read, grep`).
**Negative control:** without the call, the scenario and 2 unit cases fail.
**Pending maintainer review:** proposed decision **D-PG7-19**: for agents only, keep the last copy of a repeated top-level key, as Bun does. Skills keep refusing it (residual). The Bun inside Claude Code may differ from 1.4.4.

### WR-02: A frontmatter block that parses to a non-mapping silently loads the agent with every tool

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/bridges/agents/frontmatter.test.ts`, `test/bridges/agents/discover.test.ts`, `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`, `docs/output-catalog.md`
**Commit:** 7baf71f8
**Applied fix:** `readAgentFrontmatter` returns `parseError: "the frontmatter is not a mapping of keys"` when the parsed block is text or a list, so discovery adds the D-PG7-04 note. An empty block or a block that holds only a comment still parses to `{}` and adds no note.
**Tests:** the two D-PG7-05 non-mapping cases now expect the reason; a discover case checks the note; the scenario "Installing an agent whose frontmatter holds no keys reports the agent".
**Negative control:** without the reason, the scenario fails.
**Pending maintainer review:** the note reason wording (D-PG7-04 wording is already pending).

### WR-01: The moved repair doc says Claude Code strict-parses to empty metadata

**Files modified:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts`
**Commit:** 18dcc905
**Applied fix:** The comment now says: "Claude Code's retry quotes a wider set of values; the trigger decides which of them this repair quotes (D-PG7-02)."
**Tests:** none (comment only). **Negative control:** not applicable.

### IN-02: The unparseable note can name a defect the repair already fixed

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/bridges/agents/frontmatter.test.ts`, `features/agent/frontmatter.feature`, `docs/output-catalog.md`
**Commit:** ad3a73e1
**Applied fix:** When the repair changed the block and the repaired block fails too, the note gives the repaired block's message. The repair and the duplicate-key blanking change lines in place, so that message names the source block's line. The line numbers still count from the line after the opening `---`, because they are YAML's numbers. Making them file line numbers would depend on the form of the opening fence: Pi slices four characters, so `--- x` puts text on block line 1. That half was not changed; the note wording is already pending review under D-PG7-04.
**Tests:** the D-PG7-04 repaired-block case now expects the remaining defect; a new case checks the line number after a blanked repeated key; the scenario "Installing an agent whose frontmatter still fails after the repair reports the defect the repair left".
**Negative control:** with the first-parse message, the scenario and both unit cases fail.

### IN-03: Leftover quote stripping unquotes YAML values a second time

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`, `test/bridges/agents/convert.test.ts`, `features/agent/frontmatter.feature`
**Commit:** 5d985107
**Applied fix:** `isTrueBackground` accepts only the text `true`. YAML already turns `true` and `"true"` into that text. `splitToolList` removes item quotes only inside the bracket form in a string, `tools: "[Read, 'Bash']"`. So `tools: Read, "Bash"` drops `"Bash"`, as Claude Code reads it.
**Tests:** background table cases `'"true"'` and `"'true'"` now give no `async`; tool edge cases now drop quoted items, plus a bracket-form case; the scenario "A background value that keeps its own quote marks leaves the launch mode to pi-subagents, as Claude Code reads it".
**Negative control:** with the old helpers, the scenario and 5 unit cases fail.
**Pending maintainer review:** this changes behavior that the line reader had: a quoted item in an unbracketed tool string is now dropped (upstream parity).

### IN-05: The docs say `apply` renames a quoted-name agent, but no scenario shows it

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** a0de5b3f
**Applied fix:** The docs now name `update` and `reinstall` and say that an `apply` move runs the same update code, but no scenario shows the rename for it yet.

### IN-06: The PRD still describes the removed floor warning

**Files modified:** `docs/prd/pi-claude-marketplace-prd.md`, `docs/research/parity-gaps/subagents.md`
**Commit:** a0de5b3f
**Applied fix:** The PRD's `disallowedTools:` bullet now says `excludeTools` sits beside `tools` for a per-tool MCP deny (D-PG7-12), with no floor warning (D-PG7-13). The research record gets a "Status: done" line, and its "Current" text is kept as history.

### IN-07: The `bigint` branch in `fieldValue` cannot run

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`
**Commit:** c64c007f
**Applied fix:** Removed `typeof value === "bigint"`. Owner tests pass, and direct coverage of the file stays at 100%.

### A-1 (security advisory): provenance values keep a lone CR

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/bridges/agents/frontmatter.test.ts`, `test/integration/workflow-engine-agent-registry.test.ts`, `.planning/phases/07-agent-frontmatter-and-grants/07-SECURITY.md` (closing line)
**Commit:** dec0a899
**Applied fix:** `sanitizeProvenanceValue` turns a CRLF pair, then every `\p{Cc}`, U+2028, and U+2029 character, into one space each. It reuses the T-07-05 `UNSAFE_KEY_CHARACTER` pattern, which moved above it. Tabs in provenance values also become spaces.
**Tests:** an emitter case for a lone CR, U+2028, U+2029, a tab, and NUL; an engine registry case where a `thinking: "deep\rname: other"` warning no longer breaks the registry.
**Negative control:** with the old `\r?\n` replacement, both cases fail.
**Scenario:** none. A lone CR cannot be written through the feature-file doc strings, and the integration case reads the file through the engine's own registry.

## Skipped Issues

### IN-01: Pi's YAML library writes `YAMLWarning` to stderr for plugin-authored tags

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:155`
**Reason:** Pi's `parseFrontmatter` calls `parse(yamlString)` with no options, so no `logLevel` can be passed, and the skills bridge has the same exposure. A code fix needs a Pi API change. Recorded as a Pi capability gap in `docs/mcp-compatibility.md` (commit 0f33521d). The new description check (CR-03) refuses every indicator before it parses, so it adds no new warning path.
**Original issue:** A tag such as `tools: !Read` makes `yaml` print a `YAMLWarning` on stderr during install, which bypasses IL-2.

### IN-04: A lone-CR source skips the repair

**File:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts`
**Reason:** The behavior is shared with skills, and the rule for this pass was to fix both or neither. The skills bridge stages the bytes that the repair returns, and PARSE-02 re-parses them byte for byte. A lone-CR fix there changes skills' staged bytes, which needs its own decision. An agents-only fix would make the two bridges differ. Recorded as a D-PG7-02 residual in `docs/mcp-compatibility.md` (commit 0f33521d).
**Original issue:** `repairSingleLineScalars` splits on `\n`, so a lone-CR agent file with a colon description loads with no fields.

## Verification

- Unit: `test/bridges/**`, `test/shared/**`, `test/orchestrators/**`: 11996 of 11996 passed in the main checkout of the worktree.
- Integration: `agents-*`, `pi-subagents-*`, `provenance-invisibility`, `workflow-engine-agent-registry`, `skill-path-resolution`, `workflow-kind-inversion`: 42 of 42 passed (pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0).
- Cucumber over `features/agent`, `features/workflow`, `features/skill`, and `features/mcp-server/agent-grants.feature`: adapter profile 238 of 238 passed, builtin profile 16 of 16 passed, after the last code commit.
- Every commit passed `npm run check:commit`. `npm run check` was not run.

---

_Fixed: 2026-11-14T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2

**Fixed at:** 2026-11-15T01:30:00Z
**Source review:** .planning/phases/07-agent-frontmatter-and-grants/07-REVIEW.md (iteration 2, commit 0fdbc054)
**Iteration:** 2

The frontmatter above counts this iteration. Iteration 1 counted 12 findings in scope, 10 fixed and 2 skipped.

**Summary:**

- Findings in scope: 5 (1 critical, 1 warning, 3 info; scope `all`)
- Fixed: 5 (CR2-01, IN2-01, and WR2-01 are logic fixes: fixed, requires human verification; IN2-02 and IN2-03 are docs)
- Skipped: 0

Where verification ran: every check ran in the main checkout of the worktree `/home/acolomba/src/pi-claude-marketplace-gaps-agents` (branch `features/gaps-agents`). No review-fix worktree was created. `npm run check` was not run; the orchestrator runs it. Each commit passed the commit hook (`npm run check:commit`), except the docs-only commits, which the hook skips. Probes and Bun replays ran with a scratch `HOME` and `PI_CODING_AGENT_DIR`.

### CR2-01: A repeated `tools` list in a CRLF file or written as a zero-indented list still loads the agent with every tool

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts`, `test/shared/frontmatter-repair.test.ts`, `test/bridges/agents/frontmatter.test.ts`, `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`
**Commit:** 60c64098
**Applied fix:** In `blankEarlierDuplicateKeys` only, so the shared `keyValueEnd` that the skills bridge uses is unchanged. The key pattern takes any whitespace after the colon (`(?=\s|$)`), so a CRLF `tools:\r` line matches. A new `topLevelKey` reports whether the key's value is empty on its line, or holds only a comment. For such a key, the new `duplicateKeySpanEnd` also spans the column-0 `- ` items and indented lines that follow, so the items of an earlier compact list are blanked with its key. A key with a value on its line keeps the `keyValueEnd` span. The comment that claimed a span holds only indented lines now names the column-0 items too. Bun 1.4.4 was replayed for every form (`crlfBlockEarlier`, `crlfBlockLast`, `zeroIndent`, `zeroIndentLast`, and a comment after the key): it keeps the last value in each, and the reader now gives the same fields. The reviewer's probe4 gives `{"name":"a","tools":"Grep"}` for all five CRLF and LF cases.
**Tests:** 5 shared unit cases (earlier and last CRLF copy as a list, an earlier column-0 list with a blank line between items, a column-0 list after a comment on the key line, a last column-0 list that stays); 3 `readAgentFrontmatter` cases (CRLF earlier list, CRLF last list, column-0 earlier list); the new Scenario Outline "An earlier copy of a key that lists its items at column 0 gives way to the last copy", rows `tools:` and `tools: # the earlier list`. A lone CR or CRLF cannot be written in a feature-file doc string, so CRLF has unit and reader cases only.
**Negative control:** with the previous `frontmatter-repair.ts`, 4 shared cases and 3 reader cases fail, and both Outline rows fail at install with the D-PG7-04 note (`A block sequence may not be used as an implicit map key at line 3, column 1`). The old scenario "A key written twice keeps its last value" still passes, as it should.

### IN2-01: The duplicate-key blanking leaves several Bun-accepted forms unparseable, and the docs state it without limits

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts`, `test/shared/frontmatter-repair.test.ts`, `test/bridges/agents/frontmatter.test.ts`, `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`
**Commit:** 32db7e90
**Applied fix:** The key pattern also matches a double- or single-quoted key with no escape inside, and blanks between the key and the colon. `topLevelKey` removes the quote marks, so `tools`, `"tools"`, `'tools'`, and `tools :` are one key. A plain key no longer starts with a quote mark. The docs at `docs/mcp-compatibility.md` (the paragraph at the old line 401) now name the forms the pass handles (the key spellings, a list value, column-0 items, CRLF) and list the D-PG7-19 residuals that Bun 1.4.4 reads with the last value kept but this extension leaves unparseable: an explicit key (`? tools` / `: Read`), a key repeated inside a nested mapping such as `hooks:` or `mcpServers:`, and a quoted key with an escape (`"to\x6fls"`). They also note that an anchor defined only on an earlier copy is removed with it, so a later `*t` reads as the text `*t`, where Bun reads the anchored value. Each residual was replayed against Bun and the reader.
**Tests:** 3 shared unit cases (a double-quoted, a single-quoted, and a plain copy as one key; blanks before the colon; an explicit key beside a plain copy stays unchanged); 2 `readAgentFrontmatter` cases (quoted and plain, blank before the colon); the Outline rows `"tools":`, `'tools':`, and `tools :`.
**Negative control:** with the CR2-01 source (commit 60c64098), 2 shared cases, 2 reader cases, and the 3 new Outline rows fail.

### WR2-01: Provenance values are written as bare YAML scalars, so a stray quote or indicator in a dropped tool makes the engine lose the agent

**Status:** fixed: requires human verification

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`, `test/bridges/agents/frontmatter.test.ts`, `test/bridges/agents/convert.test.ts`, `test/bridges/agents/grant-forms.test.ts`, `test/bridges/agents/stage.test.ts`, `test/integration/workflow-engine-agent-registry.test.ts`, `test/integration/provenance-invisibility.test.ts`, `features/workflow/agent-steps.feature`, `features/mcp-server/agent-grants.feature`
**Commit:** f8fab792
**Applied fix:** `sanitizeProvenanceValue` became `provenanceScalar`. It still turns a CRLF pair and every other unsafe character into a space, and then writes the value bare only when `readsAsPlainYamlText` (the D-PG7-18 check) says YAML reads it as its own text. Any other value goes through `emitSafeDoubleQuotedScalar`. This covers every provenance list item (dropped fields, dropped tools, warnings) and `sourcePath` and `originalModel`. The doc now says what the function does and why. The fix widens beyond the probes: the MCP background warning holds `` (`async: true`) ``, which YAML read as a one-key mapping (no throw), so it is now written double-quoted too. Every MCP agent file changes in that line, and the test file builders in `convert.test.ts`, `grant-forms.test.ts`, and `stage.test.ts` now take each item as the file writes it (`MCP_ASYNC_WARNING_ITEM`). An empty value is written `""`, where it was written as a YAML null before. pi-subagents 0.88.1 was traced: its line reader collects the indented lines under `provenance:` into one string and reads no key from them, so the quotes do not reach it; `provenance-invisibility.test.ts` now runs a quoted field and a quoted warning through that reader. The reviewer's probe2 and probe3 cases all parse with Pi's YAML reader now.
**Tests:** the `convert.test.ts` tool-token table (the reviewer's `:3200` case) now also pins the written dropped-tool lines, such as `    - "'"` and `    - "\"Bash\""`; emitter cases for a two-`: ` value, a backslash with a quote mark, and a number; a round-trip case where Pi's `parseFrontmatter` reads back `'Bash`, `*`, `@x`, `` `x ``, `%x`, `[x`, `x: y: z`, `"Bash"`, a backslash, the empty string, `true`, `@agents/...`, and `[sonnet` as written; 8 engine-registry cases that find `demo:reader` with `["read"]` for `tools: Read, 'Bash`, `@Grep`, `*Grep`, `` `x ``, `%x`, `[x`, `thinking: "x: y: z"` (a two-`: ` warning), and a dropped field `x: y: z`. A bare `*` grants every tool (D-CF4-08), so it never reaches `droppedTools` through the converter: the engine case uses `*Grep`, and the round-trip case writes `*` directly. New scenario "A workflow step on a plugin agent whose tools list holds a stray quote runs on the agent's body". The three `agent-grants.feature` file expectations now show the quoted warning.
**Negative control:** with the previous `frontmatter.ts`, all 8 new engine-registry cases fail, and the scenario fails: the engine child receives `Act as workflow subagent type: demo:reader` instead of the agent's body. The `agent-grants.feature` file expectations fail too.

### IN2-02: Two texts still describe the old `inherit` output

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`
**Commit:** b38bd8a2
**Applied fix:** The `ConvertAgentInput.mapModel` doc now says a source `inherit` is written as `model: ""` (D-PG7-11, D-PG7-17), as `types.ts` says. The PRD bullet in `docs/prd/pi-claude-marketplace-prd.md:461` ("`inherit` → omit + record `originalModel`") was left as it is: the PRD is a research record. It contradicts D-PG7-11 and D-PG7-17, so the maintainer may want to update it during the D-PG7-17 review.
**Tests:** none (comment only). **Negative control:** not applicable.

### IN2-03: `subagent list` shows an empty model for an `inherit` agent

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 9546095d
**Applied fix:** No code change. The `inherit` paragraph of `docs/mcp-compatibility.md` now says that pi-subagents 0.88.1 shows the empty model as it is. The capabilities list of `subagent list` and the `/subagents` views print an empty `Model:` field, where an agent with no `model` line shows that it inherits the session's model. With `subagents.defaultProvider` set, `subagent list` prints `Model: anthropic/`. The child's model is not affected. The paragraph ties this display to the pending D-PG7-17 review. Verified in the installed peer: `src/agents/agent-management.js:785-791`, `src/slash/subagents-admin.js:175` and `:342`, and `applySubagentDefaultModel` in `src/agents/agents.js`.
**Pending maintainer review:** carry into D-PG7-17 that ROADMAP criterion 4 (`subagent get` shows `model inherit`) is no longer met as worded, and that `subagent list` and `/subagents` show an empty `Model:` (`anthropic/` with a default provider).
**Tests:** none (docs only). **Negative control:** not applicable.

### Verification (iteration 2)

- Unit: `test/{bridges,orchestrators,shared,edge,persistence,domain,platform,transaction}/**` and `test/index.test.ts`: 17432 of 17432 passed.
- Integration: `agents-adapter-grant-conformance`, `agents-builtin-grant-conformance`, `pi-subagents-child-identity`, `pi-subagents-child-launch-conformance`, `provenance-invisibility`, `skill-path-resolution`, `workflow-engine-agent-registry`, `workflow-kind-inversion`: 50 of 50 passed (pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0).
- Cucumber over `features/agent`, `features/workflow`, `features/skill`, `features/mcp-server/agent-grants.feature`, and `features/mcp-server/verdict-markers.feature`, after the last code commit: adapter profile 257 of 257 passed, builtin profile 28 of 28 passed.
- Every code commit passed `npm run check:commit`. `npm run check` was not run.

---

_Fixed: 2026-11-15T01:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
