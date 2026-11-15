---
phase: "07"
slug: "agent-frontmatter-and-grants"
status: verified
threats_open: 0
threats_open_nonblocking: 0
threats_total: 21
threats_closed: 21
asvs_level: 1
block_on: high
created: "2026-11-14"
reaudited: "2026-11-15"
---

# Phase 07 — Security

All 21 declared threats are closed: 5 high, 10 medium and 6 low. Seventeen are mitigated in code and tests, and four (T-07-02, T-07-07, T-07-12, T-07-16) are accepted risks, logged below.

The first audit read the code at `719d2fb7`, before the three code-review fix rounds. This re-audit reads the shipped code at `24de427b` (the merge of `features/gaps-agents` into `features/gaps`) and covers every Phase 7 fix commit in `719d2fb7..d0898ebd`: 9b6c595c, a93013e1, dec0a899, 2995113d, 7baf71f8, c64c007f, ad3a73e1, 5d985107, 60c64098, 32db7e90, f8fab792, 005244aa, ad7eb28c, c0b5828b, 3ce79768, and the docs commits 18dcc905, a0de5b3f, 0f33521d, b38bd8a2, 9546095d, 6a1a7f5f. The merge changed no Phase 7 file except a Phase 8 rename in `orchestrators/plugin/update-swap.ts` (`workflowAgentRestrictionNotes` to `workflowAgentNotes`).

No fix commit weakened a mitigation. Six made one stronger (T-07-05, T-07-06, T-07-09, T-07-20, and indirectly T-07-01 and T-07-16). Three changed behavior that the register states (T-07-14, T-07-15, T-07-20); each is recorded in its row. Two new low findings outside the register (UF-07-02, UF-07-03) are logged below; neither counts toward `threats_open`.

The re-audit ran hermetic checks only (scratch `HOME` and `PI_CODING_AGENT_DIR`): the owner unit tests of the repair, `own-key`, `domain/name` and the agents bridge (870 passed), the four integration files of the register (42 of 42), the skills tests that use the shared repair (77 of 77), an emitter fuzz of about 180,000 names, descriptions and provenance values read back through Pi's YAML reader and pi-subagents 0.88.1's line reader (no throw, no injected key), 23 repeated-key files compared with Bun 1.4.4, and the `recheck` ReDoS tool on 22 expressions. It did not run `npm run check`.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Plugin frontmatter to the repair | The shared single-line repair rewrites third-party lines before Pi's YAML parser reads them; for agents it also blanks the earlier copies of a repeated key | Source frontmatter lines |
| Plugin agent file to the YAML reader | Third-party text goes through a full YAML parser, with keys, types, anchors and escapes the line reader never produced | `raw` keys and values |
| Reader output to names, paths and diagnostics | `raw.name` decides the generated name and target path; keys and the parser's message reach provenance and staging diagnostics | Agent names, `droppedFields`, the D-PG7-04 note |
| Generated agent file to the child's tools and prompt | pi-subagents reads the file line by line, and the workflow engine reads it through Pi's YAML reader; a column-0 key decides tools, model, extensions and nesting | `description` block, `tools`, `excludeTools`, `allowNestedSubagents`, `model`, provenance values |
| Source grants and denies to the child's tool set | `Agent`/`Task`, an omitted list, and a per-tool MCP deny decide fan-out and tool removal in the running child | `subagent`, exclude names |
| Stored text of earlier releases to the session-start rewrite | Old warnings in agent files and index rows are matched byte for byte | Warning literals |

## Threat Register

Paths without a prefix are relative to `extensions/pi-claude-marketplace/bridges/agents/`; `shared/`, `domain/` and `orchestrators/` are relative to `extensions/pi-claude-marketplace/`. Test, feature, doc and peer paths are repository-relative. Line numbers are at `24de427b`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-07-01 | Tampering | shared repair and safe-scalar emitter | medium | mitigate | The emitter is unchanged (shared/frontmatter-repair.ts:87-91). The empty-value and opener checks run before the trigger (120), and only single-line nodes are rewritten (199, write at 203). The new `blankEarlierDuplicateKeys` (288-321) writes only `""` (317), and only frontmatter.ts:168 calls it; the skills bridge calls only `repairSingleLineScalars` (bridges/skills/stage.ts:82) and has no diff since `719d2fb7`. A span holds only indented, `- `, blank or `#` lines (219, 262), so no key line is blanked as part of another key's span. Proven by test/shared/frontmatter-repair.test.ts:296-361 and 390-497. Changed by 2995113d, 60c64098, 32db7e90, c0b5828b; blanking can remove text but cannot add any. | closed |
| T-07-02 | Denial of service | regular expressions over plugin text | low | accept | The fix commits added `YAML_UNSAFE_PLAIN` (frontmatter.ts:57), `/["\\]/` (133), `TOP_LEVEL_KEY_NAME` (shared/frontmatter-repair.ts:216), `OPEN_VALUE_LINE` (219) and `/^["']/` (237). `recheck` rates all 22 phase expressions safe. Every expression is anchored, quantifier-free, or a single class, and none has a nested quantifier. Logged as AR-07-01. | closed |
| T-07-03 | Tampering | YAML keys copied into `raw` | high | mitigate | `setOwn`, an `Object.defineProperty` write (shared/own-key.ts:17-19), is still the only write (frontmatter.ts:232-239, call at 235), behind the new `isMapping` guard (224-226). Proven by test/bridges/agents/frontmatter.test.ts:203-215. A probe with `__proto__` written twice blanks the earlier copy and leaves the prototype unchanged. 7baf71f8 restructured `rawFields` without weakening it. | closed |
| T-07-04 | Tampering | YAML `name` with a separator, `..` or a control character | high | mitigate | `assertSafeName` (domain/name.ts:35-65) checks the source name in discovery (discover.ts:162) before `generatedAgentName` (163), and again inside `generatedAgentName` (domain/name.ts:551-565) and `declaredAgentName` (594-608), before any path is built (stage.ts:221-229). `nameScalar` (frontmatter.ts:132-134, used at 419 and 426, ad7eb28c) only formats the written `name:` and `aliases:` bytes. Proven by test/bridges/agents/discover.test.ts:785-809. | closed |
| T-07-05 | Spoofing | YAML key with a line break in `droppedFields` and diagnostics | medium | mitigate | Keys are cleaned at frontmatter.ts:107 and 235. Every provenance value now goes through `provenanceScalar` (119-122, used at 482-487 and 512): a CRLF pair, every `\p{Cc}`, U+2028 and U+2029 become a space, and a value that is not plain YAML text is double-quoted (70). Proven by test/bridges/agents/frontmatter.test.ts:95-99, 461-462, 537 and test/integration/workflow-engine-agent-registry.test.ts:107-160. Stronger since dec0a899 (closes A-1), f8fab792, 005244aa and ad7eb28c. | closed |
| T-07-06 | Elevation of privilege | unparseable frontmatter drops the tool restriction | medium | mitigate | The note names the agent and says its tools, model and description settings are not applied (discover.ts:84-97, pushed at 171-173). It is a discovery warning (stage.ts:173), which standalone verbs render (shared/staging-warnings.ts:1-11). Since 7baf71f8 it also covers a block that parses to text or a list (frontmatter.ts:222, 259-263); since ad3a73e1 it names the defect the repair left. Proven by test/bridges/agents/discover.test.ts:823-897 and features/agent/frontmatter.feature:809, 834, 857. The dropped restriction itself is the D-PG7-04 parity residual, logged with T-07-16 as AR-07-04, pending maintainer review. | closed |
| T-07-07 | Denial of service | alias expansion or deep nesting in a frontmatter block | low | accept | Pi 1.5.0 still calls `parse(yamlString)` with no options (node_modules/@earendil-works/pi-coding-agent/dist/utils/frontmatter.js:23), and no extension file imports `yaml`. The new per-value parses in `readsAsPlainYamlText` (frontmatter.ts:72) refuse `&` and `*` openers first (57), so no alias reaches them. Logged as AR-07-02. | closed |
| T-07-08 | Information disclosure | parser message and paths in the note | low | mitigate | The note keeps the first line of the message and names the agent by `declaredAgentName`, never by path (discover.ts:84-97). The message may now come from the repaired block (frontmatter.ts:192-196); it is still Pi's YAML message, first line only. Proven by test/bridges/agents/discover.test.ts:847-848. | closed |
| T-07-09 | Elevation of privilege | crafted description that injects `tools`, `model` or `extensions`, or closes the frontmatter | high | mitigate | `descriptionLines` (frontmatter.ts:93-100) keeps a value on the key line only when it has no line break (81, 94) and `readsAsPlainYamlText` passes (68-74), which refuses a block header, a quote opener, the other YAML indicators at the start (57), a colon before a space or at the end, and a `#` after a space. Every other value is a `\|-` block with two spaces before each non-empty line (99). Proven by test/bridges/agents/frontmatter.test.ts:322-407, test/integration/provenance-invisibility.test.ts:159-251 and test/integration/workflow-engine-agent-registry.test.ts:89-105; the fuzz found no injected key in either reader. Stronger since a93013e1, which removed `emitYamlScalar` and closed UF-07-01. | closed |
| T-07-10 | Denial of service | lone CR, U+2028 or U+2029 in a description | low | mitigate | `DESCRIPTION_LINE_BREAK` splits on CRLF, CR, LF, U+2028 and U+2029 (frontmatter.ts:81, split at 94). Proven by test/bridges/agents/frontmatter.test.ts:386-395. | closed |
| T-07-11 | Tampering | target path of a renamed agent | medium | mitigate | No new write path: each staged and target file is checked with `assertPathInside` (stage.ts:221-229), and a target that no replaced index row names is refused before any removal (`assertAgentCommitTargets`, stage.ts:358-375, called at 445 and orchestrators/plugin/update-swap.ts:1593). Proven by features/agent/frontmatter.feature:1000 (update) and 1121 (reinstall), and test/bridges/agents/stage.test.ts:1515, 2457, 2601. stage.ts is unchanged since `719d2fb7`. | closed |
| T-07-12 | Elevation of privilege | an agent limited to `Read` and `Agent` delegates to an agent with more tools | medium | accept | Upstream parity (D-PG7-08): the type list is not written and no `allowedAgents` key is emitted (test/bridges/agents/convert.test.ts:2795-2805). Stated at docs/mcp-compatibility.md:384; depth stays pi-subagents' default (docs/mcp-compatibility.md:759). Logged as AR-07-03. | closed |
| T-07-13 | Tampering | text inside `Agent(...)` or `Task(...)` | medium | mitigate | `toolNameOf` keeps the tool name only (convert.ts:276-279), and the written token is the fixed `TOOL_MAP` value `subagent` (92-102, 445-453). Since 5d985107, `splitToolList` (228-244) removes item quotes only in the bracket form, so a quoted token is dropped into provenance (quoted there) and never reaches `tools:`. Proven by test/bridges/agents/convert.test.ts:2806-2823. | closed |
| T-07-14 | Tampering | source `model` written without mapping | low | mitigate | Without `--map-model`, only the fixed literal `INHERIT_MODEL_VALUE = '""'` is written (convert.ts:82, used at 346); 9b6c595c changed it from `inherit`. Every other value still needs the alias table or a `claude-` ID without whitespace or `:` (349-385). Both readers take `""` as inherit: pi-subagents applies `defaultModel` only to `undefined`, and the workflow engine reads `fm.model.trim() \|\| undefined`. The next written line is always a column-0 key, so pi-subagents' line reader absorbs nothing into the empty value. Proven by test/bridges/agents/convert.test.ts:708-792, test/integration/pi-subagents-child-launch-conformance.test.ts:409-445, features/agent/frontmatter.feature:1363, 1393 and features/workflow/agent-steps.feature:17. | closed |
| T-07-15 | Elevation of privilege | every agent with no tools list gains nested delegation | medium | mitigate | Parity (D-PG7-09). `omittedToolMapping` writes `allowNestedSubagents` only when `subagent` is not excluded (convert.ts:614-655, at 648; spread at 1196). The explicit arm's type sets `allowNestedSubagents?: never` (frontmatter.ts:294-304). Proven by the `@ts-expect-error` proof at test/bridges/agents/frontmatter.test.ts:1025-1038, test/bridges/agents/convert.test.ts:2892-2990, features/agent/frontmatter.feature:1329 and features/agent/invocation.feature:375. Behavior change from 5d985107: `disallowedTools: Read, "Agent"` no longer denies `Agent`, which matches Claude Code 2.1.323's splitter (it never removes quotes); the omitted arm warns, the explicit arm does not (REVIEW-FIX IN-03, pending maintainer review). The generated file has one `tools:` line, so pi-subagents and the engine cannot read a different list than the converter wrote; the repeated-key fixes change only the converter's input. | closed |
| T-07-16 | Elevation of privilege | an unparseable agent also gains nested delegation | medium | accept | Consequence of D-PG7-04 and D-PG7-09. The note (discover.ts:84-97) prints on every staging verb; the effect is stated at docs/mcp-compatibility.md:433-437 and 760. Fewer agents reach this arm since the D-PG7-19 repeated-key fixes, and a non-mapping block now prints the note. Logged as AR-07-04, pending maintainer review. | closed |
| T-07-17 | Tampering | a key name or value pi-subagents reads differently | medium | mitigate | pi-subagents' launch code authorizes fan-out with the written key and keeps ambient MCP tools, and authorizes none with the written exclude entry (test/integration/pi-subagents-child-launch-conformance.test.ts:350-407). pi-subagents' frontmatter reader reads the key at node_modules/.cache/optional-peers/node_modules/pi-subagents/src/agents/agents.js:2052-2059 and 2113 (the first audit cited 926-927, which is the builtin-override reader). Proven end to end in features/agent/invocation.feature:340, 375. | closed |
| T-07-18 | Elevation of privilege | per-tool MCP deny whose `excludeTools` name misses the registered tool | high | mitigate | The name comes from the implementation profile's `toolName` (`excludeNameFor`, convert.ts:134-140, used at 404, 534 and 563-566). Conformance under both implementations: test/integration/pi-subagents-child-launch-conformance.test.ts:246-301 and test/integration/agents-builtin-grant-conformance.test.ts:212. Scenarios features/mcp-server/agent-grants.feature:43, 95; unit rows test/bridges/agents/convert.test.ts:2226-2340 and 3397-3530. Residual AGTLONGNAME-01 is recorded at docs/mcp-compatibility.md:695: such an agent cannot launch, so it fails closed. | closed |
| T-07-19 | Repudiation | a removed warning hid a restriction that still weakens | medium | mitigate | The removed literals (`cec10c42`, `54de7a6e`) appear in no code that writes warnings; only the legacy recognizer keeps the cannot-narrow lead (legacy-grant-form.ts:50). The floor is `>=0.87.0` (package.json:67). The warning for a deny with no exact Pi name stays (convert.ts:637-643), with owner case test/bridges/agents/convert.test.ts:3028 and features/agent/frontmatter.feature:588. | closed |
| T-07-20 | Tampering | old warning text the session-start rewrite no longer recognizes | low | mitigate | 3ce79768 edited the stored-text modules, so the first audit's "no diff" evidence no longer holds. Current evidence: the warning strings in mcp-async-warning.ts are byte-identical (only the comment at 24-26 changed) and grant-rewrite.ts is unchanged. In legacy-grant-form.ts, `translateItem` (112-120) sends a bare item through the old `translateWarning` path unchanged; a quoted item matches only when `emitSafeDoubleQuotedScalar(inner) === item` and is written back in the current writer's form. Proven by test/bridges/agents/legacy-grant-form.test.ts:198-241 (both generations and a mismatched quote). Stronger since 3ce79768, which closed IN3-01. | closed |
| T-07-SC | Tampering | npm/pip/cargo installs | high | mitigate | `git diff --stat 719d2fb7..24de427b` is empty for package.json, package-lock.json, scripts/install-test-peers.mjs and test/integration/optional-peer-suite-versions.json. `yaml` is Pi's own dependency and no extension file imports it. | closed |

## Accepted Risks Log

| Risk ID | Threat | Rationale | Evidence | Review |
| --- | --- | --- | --- | --- |
| AR-07-01 | T-07-02 | Every expression is anchored, quantifier-free, or a single character class, and none holds a nested quantifier; `recheck` rates all 22 safe. `YAML_UNSAFE_PLAIN` is not anchored but has no quantifier, so it is linear | shared/frontmatter-repair.ts:25-100, 216, 219, 237; frontmatter.ts:57, 81, 107, 133 | none needed |
| AR-07-02 | T-07-07 | Pi's `yaml` bounds alias expansion by default and this code passes no option; the new per-value parses refuse alias openers first; a refused document takes the no-fields arm with the note | pi-coding-agent dist/utils/frontmatter.js:23; frontmatter.ts:57, 72 | none needed |
| AR-07-03 | T-07-12 | Upstream parity (D-PG7-08): Claude Code does not apply the agent-type list inside a subagent. `allowedAgents` is not written because it would remove other agents' ambient MCP tools. pi-subagents' default depth of 2 allows one more layer, and the user installed both agents | docs/mcp-compatibility.md:384, 759 | none needed |
| AR-07-04 | T-07-16, and the dropped restriction behind T-07-06 | Upstream parity (D-PG7-04): Claude Code 2.1.323 loads an unparseable plugin agent with no fields, so it gets every tool; D-PG7-09 adds nested delegation; in a plugin with MCP servers the agent also runs in the background with ambient MCP tools. The note names the agent on every staging verb. | discover.ts:84-97; docs/mcp-compatibility.md:433-437, 760 | **Pending maintainer review.** This conflicts with the maintainer's "fail closed on corrupt data" preference (07-CONTEXT.md:317-320) |

Documented residuals outside the register:

- D-PG7-10: nesting depth stays pi-subagents' default (2) where Claude Code's is 3. This is narrower than upstream (docs/mcp-compatibility.md:759).
- AGTLONGNAME-01: an adapter exclude name over 64 characters beside a whole-server grant does not match pi-subagents' uncut name, and such an agent cannot launch (docs/mcp-compatibility.md:695).
- D-PG7-02 retry, pending maintainer review: when another line makes YAML refuse the block, a `tools:` line whose comment holds a colon is quoted whole, so `tools: Read # ,Bash ,x:y` with `description: a: b` gives `tools: read,bash`. This is documented as Claude Code parity at docs/mcp-compatibility.md:410.
- D-PG7-19 residuals: repeated-key forms that Bun 1.4.4 accepts and the repair does not find (explicit keys, nested repeats, escaped quoted keys, an anchor-only or tag-only earlier copy) stay unparseable and take the AR-07-04 arm (docs/mcp-compatibility.md:412-419).

## Unregistered Findings

All six SUMMARY `## Threat Flags` sections say None.

**UF-07-01 (first audit):** generated one-line descriptions were not valid YAML for the workflow engine's agent registry. Closed by a93013e1 (`fix(agents): write a non-YAML one-line description as a block`); re-verified under T-07-09.

**UF-07-02 (new, low; elevation of privilege; parity residual, open for maintainer review).** The D-PG7-19 blanking removes an earlier copy of a key together with an anchor that only that copy defines. Probe: `disallowedTools: &d Bash`, `tools: Read, Bash`, `x: *d`, `disallowedTools: *d`. Bun 1.4.4 reads `disallowedTools: "Bash"`, so Claude Code denies Bash. This extension reads `disallowedTools: "*d"`; the explicit arm ignores the unknown deny and writes `tools: read,bash`, with no warning and no note. A repeated `<<` merge key behaves the same way. The anchor case is documented (docs/mcp-compatibility.md:419), and before the fix rounds the same file loaded with every tool plus the D-PG7-04 note, so the result is not wider than before; it is now silent, which goes against D-PG7-14. Two small fixes are possible, and the choice is a design decision: do not blank an earlier copy that defines an anchor (the block then fails closed into the note), or warn on an unmapped deny in the explicit arm.

**UF-07-03 (new, low; denial of service; no fix needed).** `readsAsPlainYamlText` runs Pi's YAML parser once per value (f8fab792, a93013e1), about 60 µs per value; 100,000 dropped tool tokens took 6.1 s for one rendered form. The cost is linear, not ReDoS, and it slows only the install of the plugin that ships such an agent.

Advisories (low, non-blocking):

- A-1: provenance values kept a lone CR. Closed by dec0a899; re-verified under T-07-05.
- A-2, unchanged: `assertSafeName` (domain/name.ts:56-65) refuses only ASCII control characters, so U+2028, U+2029 and C1 controls pass. pi-subagents then drops that agent's `name:` and `aliases:` lines; Pi's YAML reader reads them back. No key is injected and no path is affected.
- A-3 (predates the fix rounds, for routing): a single `<<: {disallowedTools: Grep}` is read as an ignored key, where Bun merges it, so Claude Code denies Grep and this extension does not.
- A-4 (predates the fix rounds, for routing): a generated name that starts and ends with `"` (plugin `"evil`, agent `x"`) is written bare; both readers strip the quotes, so it reads as `evil:x`.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 21 | 21 | 0 | 0 | gsd-security-auditor: current-source read at 719d2fb7; four hermetic probes; one unregistered finding (UF-07-01) |
| 2026-11-15 | 21 | 21 | 0 | 0 | gsd-security-auditor: re-audit of the shipped code at 24de427b over the fix rounds 719d2fb7..d0898ebd; hermetic owner tests, integration files, fuzz, Bun comparison and ReDoS check; two new unregistered findings (UF-07-02, UF-07-03) |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence at 24de427b.
- [x] Accepted risks logged; the D-PG7-04 residual is marked pending maintainer review.
- [x] No blocking or nonblocking threat remains open.
- [x] Unregistered findings UF-07-02 and UF-07-03 are reported for routing; they are outside the register and not counted in `threats_open`.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-15 at 24de427b. The re-audit ran no full gate; no build input changed.
