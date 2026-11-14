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
---

# Phase 07 — Security

All 21 declared threats are closed: 5 high, 10 medium and 6 low. Seventeen are mitigated in code and tests, and four (T-07-02, T-07-07, T-07-12, T-07-16) are accepted risks, logged below. The auditor read current source and tests at `719d2fb7` (range `deaa35c4..719d2fb7`) and ran four small hermetic probes; it ran no test suite. The passing combined-tree gates are recorded in `07-VALIDATION.md`, waves 1 to 6.

One finding outside the register (UF-07-01) is reported for routing. It does not count toward `threats_open`. It is the same defect as review finding CR-03 and is routed to the code-review fix pass.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Plugin frontmatter to the repair | The shared single-line repair rewrites third-party lines before Pi's YAML parser reads them | Source frontmatter lines |
| Plugin agent file to the YAML reader | Third-party text goes through a full YAML parser, with keys, types, anchors and escapes the line reader never produced | `raw` keys and values |
| Reader output to names, paths and diagnostics | `raw.name` decides the generated name and target path; keys and the parser's message reach provenance and staging diagnostics | Agent names, `droppedFields`, the D-PG7-04 note |
| Generated agent file to the child's tools and prompt | pi-subagents reads the file line by line; a column-0 key decides tools, model, extensions and nesting | `description` block, `tools`, `excludeTools`, `allowNestedSubagents`, `model` |
| Source grants and denies to the child's tool set | `Agent`/`Task`, an omitted list, and a per-tool MCP deny decide fan-out and tool removal in the running child | `subagent`, exclude names |
| Stored text of earlier releases to the session-start rewrite | Old warnings in agent files and index rows are matched byte for byte | Warning literals |

## Threat Register

Paths without a prefix are relative to `extensions/pi-claude-marketplace/bridges/agents/`; `shared/`, `domain/` and `orchestrators/` are relative to `extensions/pi-claude-marketplace/`. Test, feature, doc and peer paths are repository-relative.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-07-01 | Tampering | shared repair and safe-scalar emitter | medium | mitigate | The emitter moved byte-identically (`bridges/skills/frontmatter-degrade.ts:89-93` at `deaa35c4`, now shared/frontmatter-repair.ts:87-91: flattens `\r?\n`, escapes `\` before `"`). The empty-value and opener tests run before the trigger (shared/frontmatter-repair.ts:120), and only single-line nodes are rewritten (186). Proven by test/shared/frontmatter-repair.test.ts:308-360 and 413-431. | closed |
| T-07-02 | Denial of service | regular expressions over plugin text | low | accept | Every expression is anchored or a single character class, with no nested quantifier (shared/frontmatter-repair.ts:25, 28, 94, 97, 100; frontmatter.ts:74, 114, 164). Logged as AR-07-01. | closed |
| T-07-03 | Tampering | YAML keys copied into `raw` | high | mitigate | Each key is copied with `setOwn`, an `Object.defineProperty` write (shared/own-key.ts:17-19), onto a plain object (frontmatter.ts:189-200, write at 196). Proven by test/bridges/agents/frontmatter.test.ts:144-156. | closed |
| T-07-04 | Tampering | YAML `name` with a separator, `..` or a control character | high | mitigate | `assertSafeName` (domain/name.ts:35-65) checks the source name in discovery (discover.ts:162) and again inside `generatedAgentName` (domain/name.ts:556-563) and `declaredAgentName` (599-606), before any path is built. Proven by test/bridges/agents/discover.test.ts:785-810. | closed |
| T-07-05 | Spoofing | YAML key with a line break in `droppedFields` and diagnostics | medium | mitigate | Every `\p{Cc}`, U+2028 and U+2029 in a key becomes a space (frontmatter.ts:163-164, 196). Proven by test/bridges/agents/frontmatter.test.ts:93-97. | closed |
| T-07-06 | Elevation of privilege | unparseable frontmatter drops the tool restriction | medium | mitigate | The note names the agent and says its tools, model and description settings are not applied (discover.ts:84-97, pushed at 171-173). It is a discovery warning (stage.ts:173), which standalone verbs render (shared/staging-warnings.ts:1-11). Proven by test/bridges/agents/discover.test.ts:823-911 and features/agent/frontmatter.feature:693-717. The dropped restriction itself is the D-PG7-04 parity residual, logged with T-07-16 as AR-07-04, pending maintainer review. | closed |
| T-07-07 | Denial of service | alias expansion or deep nesting in a frontmatter block | low | accept | Pi 1.5.0 calls `parse(yamlString)` with no options (node_modules/@earendil-works/pi-coding-agent/dist/utils/frontmatter.js:23), so `yaml` 2.9.1 keeps its default alias limit; the extension never imports `yaml`. A refused document takes the no-fields arm with the note (frontmatter.ts:151-161, 208-216). Logged as AR-07-02. | closed |
| T-07-08 | Information disclosure | parser message and paths in the note | low | mitigate | The note keeps the first line of the message and names the agent by `declaredAgentName`, never by path (discover.ts:84-97). Proven by test/bridges/agents/discover.test.ts:847-848. | closed |
| T-07-09 | Elevation of privilege | crafted description that injects `tools`, `model` or `extensions`, or closes the frontmatter | high | mitigate | A multi-line description is a `\|-` block with two spaces before every non-empty line (frontmatter.ts:84-91); a one-line value that is a block header is double-quoted (46, 57-67). Proven by test/bridges/agents/frontmatter.test.ts:292-311 and, against pi-subagents 0.88.1's own reader, test/integration/provenance-invisibility.test.ts:155-213. | closed |
| T-07-10 | Denial of service | lone CR, U+2028 or U+2029 in a description | low | mitigate | `DESCRIPTION_LINE_BREAK` splits on CRLF, CR, LF, U+2028 and U+2029 (frontmatter.ts:74). Proven by test/bridges/agents/frontmatter.test.ts:297-306. | closed |
| T-07-11 | Tampering | target path of a renamed agent | medium | mitigate | No new write path: the name passed T-07-04, each staged and target file is checked with `assertPathInside` (stage.ts:221-229), and a target that no replaced index row names is refused before any removal (`assertAgentCommitTargets`, stage.ts:358-375, called at 445 and orchestrators/plugin/update-swap.ts:1593). Proven by features/agent/frontmatter.feature:837-956 (update) and 958 (reinstall), and the `AgentTargetOccupiedError` cases in test/bridges/agents/stage.test.ts:1512, 2454, 2598. | closed |
| T-07-12 | Elevation of privilege | an agent limited to `Read` and `Agent` delegates to an agent with more tools | medium | accept | Upstream parity (D-PG7-08): the type list is not written and no `allowedAgents` key is emitted (test/bridges/agents/convert.test.ts:2751-2760). Stated at docs/mcp-compatibility.md:384; depth stays pi-subagents' default (docs/mcp-compatibility.md:734). Logged as AR-07-03. | closed |
| T-07-13 | Tampering | text inside `Agent(...)` or `Task(...)` | medium | mitigate | `toolNameOf` keeps the tool name only (convert.ts:266-269), and the written token is the fixed `TOOL_MAP` value `subagent` (82-92, 435-443). Proven by test/bridges/agents/convert.test.ts:2762-2779. | closed |
| T-07-14 | Tampering | source `model` written without mapping | low | mitigate | Without `--map-model`, only the literal `inherit` is written, for a value equal to it after trim and lower-case (convert.ts:329-341). Every other value still needs the alias table or the `claude-` pass-through, which refuses whitespace and `:` (343-375). Proven by test/bridges/agents/convert.test.ts:702-787. | closed |
| T-07-15 | Elevation of privilege | every agent with no tools list gains nested delegation | medium | mitigate | Parity (D-PG7-09). A deny of `Agent` or `Task`, bare or with a list, writes `excludeTools: subagent` and withholds the key (convert.ts:615, 638, 1181-1190). The explicit arm's type sets `allowNestedSubagents?: never` (frontmatter.ts:249-259). Proven by test/bridges/agents/convert.test.ts:2881-2963, the `@ts-expect-error` proof at test/bridges/agents/frontmatter.test.ts:795-808, features/agent/frontmatter.feature:1137 and features/agent/invocation.feature:375. | closed |
| T-07-16 | Elevation of privilege | an unparseable agent also gains nested delegation | medium | accept | Consequence of D-PG7-04 and D-PG7-09. The note (discover.ts:84-97) prints on every staging verb; the effect is stated at docs/mcp-compatibility.md:386, 412, 735. Logged as AR-07-04, pending maintainer review. | closed |
| T-07-17 | Tampering | a key name or value pi-subagents reads differently | medium | mitigate | pi-subagents' launch code authorizes fan-out with the written key and keeps ambient MCP tools, and authorizes none with the written exclude entry (test/integration/pi-subagents-child-launch-conformance.test.ts:342-383). The key name is read by pi-subagents' loader (node_modules/.cache/optional-peers/node_modules/pi-subagents/src/agents/agents.js:926-927) and proven end to end in features/agent/invocation.feature:340, 375. | closed |
| T-07-18 | Elevation of privilege | per-tool MCP deny whose `excludeTools` name misses the registered tool | high | mitigate | The name comes from the implementation profile's `toolName` (`excludeNameFor`, convert.ts:124-131, used at 545 and 581). Conformance under both implementations: test/integration/pi-subagents-child-launch-conformance.test.ts:222-277 and test/integration/agents-builtin-grant-conformance.test.ts:212-237. Scenarios features/mcp-server/agent-grants.feature:43, 95; unit rows test/bridges/agents/convert.test.ts:2185-2300. Residual AGTLONGNAME-01 is recorded at docs/mcp-compatibility.md:670: such an agent cannot launch, so it fails closed. | closed |
| T-07-19 | Repudiation | a removed warning hid a restriction that still weakens | medium | mitigate | Removed literals (`cec10c42`, `54de7a6e`): "`excludeTools` requires pi-subagents >= 0.62.0", below the `>=0.87.0` floor (package.json:67), and "cannot narrow the whole-server grant", now enforced by `excludeTools` beside `tools` (convert.ts:502-512, 564-571). The warning for a deny with no exact Pi name stays (convert.ts:623-629), with owner case test/bridges/agents/convert.test.ts:2984-2996 and features/agent/frontmatter.feature:588. | closed |
| T-07-20 | Tampering | old warning text the session-start rewrite no longer recognizes | low | mitigate | `git diff --stat deaa35c4..719d2fb7` is empty for legacy-grant-form.ts, grant-rewrite.ts, mcp-async-warning.ts and their three test files; their owner tests ran in every wave gate (07-VALIDATION.md). | closed |
| T-07-SC | Tampering | npm/pip/cargo installs | high | mitigate | `git diff --stat deaa35c4..719d2fb7` is empty for package.json, package-lock.json, scripts/install-test-peers.mjs and test/integration/optional-peer-suite-versions.json. `yaml` is Pi's own dependency and no extension file imports it. | closed |

## Accepted Risks Log

| Risk ID | Threat | Rationale | Evidence | Review |
| --- | --- | --- | --- | --- |
| AR-07-01 | T-07-02 | The repair's expressions are anchored and hold no nested quantifier, as in the skills bridge before the move | shared/frontmatter-repair.ts:25-100; frontmatter.ts:74, 114, 164 | none needed |
| AR-07-02 | T-07-07 | Pi's `yaml` bounds alias expansion by default and this code passes no option; a refused document takes the no-fields arm with the note | pi-coding-agent dist/utils/frontmatter.js:23; frontmatter.ts:151-161 | none needed |
| AR-07-03 | T-07-12 | Upstream parity (D-PG7-08): Claude Code does not apply the agent-type list inside a subagent. `allowedAgents` is not written because it would remove other agents' ambient MCP tools. pi-subagents' default depth of 2 allows one more layer, and the user installed both agents | docs/mcp-compatibility.md:384, 734 | none needed |
| AR-07-04 | T-07-16, and the dropped restriction behind T-07-06 | Upstream parity (D-PG7-04): Claude Code 2.1.323 loads an unparseable plugin agent with no fields, so it gets every tool; D-PG7-09 adds nested delegation; in a plugin with MCP servers the agent also runs in the background with ambient MCP tools. The note names the agent on every staging verb. | discover.ts:84-97; docs/mcp-compatibility.md:386, 412, 735 | **Pending maintainer review.** This conflicts with the maintainer's "fail closed on corrupt data" preference (07-CONTEXT.md:317-320) |

Documented residuals outside the register:

- D-PG7-10: nesting depth stays pi-subagents' default (2) where Claude Code's is 3. This is narrower than upstream (docs/mcp-compatibility.md:734).
- AGTLONGNAME-01: an adapter exclude name over 64 characters beside a whole-server grant does not match pi-subagents' uncut name, and such an agent cannot launch (docs/mcp-compatibility.md:670).
- D-PG7-02 retry, pending maintainer review: when another line makes YAML refuse the block, a `tools:` line whose comment holds a colon is quoted whole, so `tools: Read # ,Bash ,x:y` with `description: a: b` gives `tools: read,bash`. This is documented as Claude Code parity at docs/mcp-compatibility.md:401.

## Unregistered Findings

All six SUMMARY `## Threat Flags` sections say None. The auditor found the following outside the register.

**UF-07-01 (warning, suggested severity medium; elevation of privilege and denial of service): generated one-line descriptions are not valid YAML for the workflow engine's agent registry.** D-PG7-01 removes the quote marks of a quoted source description. `emitYamlScalar` (frontmatter.ts:57-67) writes a one-line value unquoted unless it starts and ends with a matching quote or is a block header. Before this phase, `description: "Use this agent when: reviewing"` was written back quoted, which is valid YAML; now it is written as `description: Use this agent when: reviewing`, which Pi's YAML parser refuses. `@quintinshaw/pi-dynamic-workflows` 3.15.0 reads `<scopeRoot>/agents/*.md` through Pi's `parseFrontmatter` (src/agent-registry.ts:89-95). When the parse throws, the engine registers the agent under its file name with no `tools`, `model` or prompt, so a bridged workflow's `agent({ agentType: "<plugin>:<agent>" })` runs with the engine's default tools and model (src/workflow.ts:1074, 1119-1121), and the author's tool restriction is not applied. Auditor probe on current code: `description: "Use this agent when: reviewing"` with `tools: Read` gives registry `{ name: "pi-claude-marketplace-demo-helper", tools: undefined }`; the earlier form gives `{ name: "demo:helper", tools: ["read"] }`. A quoted description that starts with `@` gives the same failure. Routed to the code-review fix pass as CR-03 of 07-REVIEW.md. Closed by commit a93013e1 (`fix(agents): write a non-YAML one-line description as a block`), with engine registry cases for a colon before a space, a `#` after a space, a leading `@`, and quote marks in `test/integration/workflow-engine-agent-registry.test.ts`.

Advisories (low, non-blocking):

- A-1: provenance values keep a lone CR. `sanitizeProvenanceValue` collapses only `\r?\n` (frontmatter.ts:99-101). A lone CR can sit in an unknown `thinking`, `effort` or `model` value, or inside the parentheses of a dropped tool or skill token, and it stays in a provenance line. pi-subagents is unaffected, but Pi's `parseFrontmatter` turns a lone CR into LF, so under the workflow engine's registry such a value adds a column-0 key or a duplicate key that fails the parse. Only the author's own agent is affected. Reusing the T-07-05 key cleanup for provenance values would close it.
  - Closed by commit dec0a899 (`fix(agents): clean every line break out of provenance values`): `sanitizeProvenanceValue` now turns a CRLF pair and every control character, U+2028, and U+2029 into a space; the workflow engine registry case in `test/integration/workflow-engine-agent-registry.test.ts` covers it.
- A-2: Unicode line separators in names. `assertSafeName` refuses only ASCII control characters (domain/name.ts:56-64), so U+2028, U+2029 and C1 controls pass. pi-subagents then drops that agent's `name:` line. No line split, path separator or containment escape follows (stage.ts:221-229). Literal bytes could already do this before the phase.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 21 | 21 | 0 | 0 | gsd-security-auditor: current-source read at 719d2fb7; four hermetic probes; one unregistered finding (UF-07-01) |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence.
- [x] Accepted risks logged; the D-PG7-04 residual is marked pending maintainer review.
- [x] No blocking or nonblocking threat remains open.
- [x] One unregistered finding (UF-07-01) reported for routing; it is outside the register and not counted in `threats_open`.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-14 at 719d2fb7. The auditor reran no test suite; the parent owns the combined-tree gate.
