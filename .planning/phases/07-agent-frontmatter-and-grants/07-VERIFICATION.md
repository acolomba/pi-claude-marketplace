---
phase: 07-agent-frontmatter-and-grants
verified: 2026-11-16T07:22:50Z
status: passed
score: 40/40 must-haves verified (35 VERIFIED, 5 PASSED (override))
covered_files: [".planning/phases/07-agent-frontmatter-and-grants/07-01-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-01-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-02-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-02-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-03-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-03-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-04-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-04-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-05-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-05-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-06-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-06-SUMMARY.md","README.es.md","README.md","docs/mcp-compatibility.md","docs/output-catalog.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/parity-gaps/subagents.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/discover.ts","extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts","extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts","extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts","extensions/pi-claude-marketplace/bridges/agents/stage.ts","extensions/pi-claude-marketplace/bridges/agents/types.ts","extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts","extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts","extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/shared/frontmatter-repair.ts","features/agent/frontmatter.feature","features/agent/invocation.feature","features/lib/agent-files.ts","features/lib/upstream/subagents.ts","features/lib/workflow-files.ts","features/mcp-server/agent-grants.feature","features/step_definitions/agent/listing.steps.ts","features/step_definitions/agent/runs.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-steps.feature","test/bridges/agents/convert.test.ts","test/bridges/agents/discover.test.ts","test/bridges/agents/frontmatter.test.ts","test/bridges/agents/grant-forms.test.ts","test/bridges/agents/grant-rewrite.test.ts","test/bridges/agents/legacy-grant-form.test.ts","test/bridges/agents/stage.test.ts","test/bridges/skills/frontmatter-degrade.test.ts","test/bridges/skills/frontmatter-scan.test.ts","test/integration/agents-builtin-grant-conformance.test.ts","test/integration/pi-subagents-child-launch-conformance.test.ts","test/integration/provenance-invisibility.test.ts","test/integration/workflow-engine-agent-registry.test.ts","test/shared/frontmatter-repair.test.ts"]
covered_digest: "v4:sha256:419990e0d9a610ab8258a1871e98148cfd005d34bc37452a8f47b16e7a1d42c0"
behavior_unverified: 0
overrides_applied: 5
overrides:
  - must_have: "subagent get lists subagent among the tools of an agent with no tools field (criterion 3, PG-AGENT-03)"
    reason: "Pi capability gap, re-checked 2026-11-16, unchanged. pi-subagents 0.88.1 `formatAgentDetail` (src/agents/agent-management.js:951-976) prints Model, Tools and Excluded tools lines but no line for allowNestedSubagents, so an agent with no tools list cannot show `subagent` in `subagent get` without an explicit tools list, which would take away its default and ambient tools. The intent (the agent can start subagents) is proven by behavior: the staged file holds `allowNestedSubagents: true` (features/agent/frontmatter.feature:127, :958, :1135, :1246; convert.ts:615-652, :1207-1213; frontmatter.ts:441-443), the scripted child of an agent with no tools list calls subagent({agent: \"demo:helper\"}) and gets the reply (features/agent/invocation.feature:340), the child is offered the session's nameable tools, `subagent` included (invocation.feature:246; features/step_definitions/agent/runs.steps.ts:34), the deny case shows `excluded tools subagent` (frontmatter.feature:1367) and cannot nest (invocation.feature:375), and pi-subagents' own child-tool-plan authorizes fan-out for the written key (src/runs/shared/child-tool-plan.js:216-218; named test `PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools`, passed this pass). Recorded as the override candidate in 07-05-PLAN truth 4 and D-PG7-15."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T23:29:00Z"
  - must_have: "subagent get shows model inherit for a source agent with model: inherit, with and without --map-model (criterion 4, PG-AGENT-07a)"
    reason: "Alternative implementation, now recorded as decision D-PG7-17 (PROJECT.md:2416, pending maintainer review; the row says it amends ROADMAP Phase 7 criterion 4, passed by override). Writing `model: inherit` made workflow-engine 3.15.0 steps fail with MODEL_NOT_FOUND. The bridge writes `model: \"\"` for a source inherit in any case and before the flag check (convert.ts:84, :341-348), which pi-subagents 0.88.1 reads as the session's model and which keeps `subagents.defaultModel` off the agent. The requirement's outcome (REQUIREMENTS.md:41, the child runs on the parent's model with or without --map-model) holds: features/agent/frontmatter.feature:1401 and :1431 (defaultModel claude-haiku-5-5, child still answers), features/workflow/agent-steps.feature:17, named tests `PG-AGENT-07a / D-PG7-17: the model written for a source inherit runs the child on the parent's model over subagents.defaultModel` and `D-PG7-17: the engine reads no model for an agent whose source model is inherit` (both passed this pass). The file is the same with and without the flag (named test `D-PG7-11: a source model of inherit gives the same file with and without --map-model`, passed). Visible cost: pi-subagents prints no Model line for an empty model (`if (agent.model)`, agent-management.js:966), and `subagent list` shows an empty `Model:`, stated at docs/mcp-compatibility.md:435. Also carries the 07-04 truth that restates criterion 4."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T23:29:00Z"
  - must_have: "07-04 truth: the literal the bridge writes for a source inherit is pi-subagents 0.88.1's own inherit sentinel, and pi-subagents authorizes fan-out for an explicit list that holds subagent"
    reason: "Superseded in its first clause by decision D-PG7-17 (PROJECT.md:2416, in-phase review fix CR-01, pending maintainer review): the written literal is `\"\"` (convert.ts:77-84), not pi-subagents' `inherit` sentinel, because the workflow engine reads `inherit` as a model ID. The outcome the clause stood for (the child runs on the parent's model, over subagents.defaultModel) holds; see the criterion 4 override. The second clause holds as written: named test `PG-AGENT-03: the tools written for an Agent grant authorize fan-out` (passed this pass), pi-subagents child-tool-plan.js:216. The previous report listed this as Info only."
    accepted_by: "project decision D-PG7-17 (PROJECT.md decision log, pending maintainer review)"
    accepted_at: "2026-11-16T07:22:50Z"
  - must_have: "07-03 truth: a one-line description is written with the bytes it has today, except that a description that is only |, |-, > or >- is quoted"
    reason: "Superseded by decision D-PG7-18 (PROJECT.md:2419, in-phase review fix CR-03, pending maintainer review): a one-line description stays on the key line only when YAML reads it as its own text (frontmatter.ts:51-74, `YAML_UNSAFE_PLAIN` plus a parseFrontmatter round trip); any other one-line description, the four block headers included, is written as the `|-` block (frontmatter.ts:93-100), because the workflow engine reads the file with Pi's YAML reader and refused the frontmatter otherwise. A description YAML reads as its text keeps its bytes (frontmatter.test.ts:325-330 and `D-PG7-18: a colon and a hash that YAML reads as text unchanged`). Evidence: named tests `emits a description with the block header | alone as a literal block` and `emits a description with D-PG7-18: a colon before a space as a literal block` (both passed this pass), `D-PG7-06: a description that is only | reads as text under pi-subagents' own reader` (passed), test/integration/workflow-engine-agent-registry.test.ts:96, scenario features/workflow/agent-steps.feature:39, docs/mcp-compatibility.md:474. The previous report did not note this change of a plan truth."
    accepted_by: "project decision D-PG7-18 (PROJECT.md decision log, pending maintainer review)"
    accepted_at: "2026-11-16T07:22:50Z"
  - must_have: "07-04 truth: the compatibility page and both READMEs say that Agent and Task grants let an agent start subagents, that the type list is not applied, and that model: inherit is always kept"
    reason: "Met for the compatibility page (docs/mcp-compatibility.md:413 for the grants and the unapplied type list, :435 for inherit). The READMEs carry only the model sentence (README.md:379, README.es.md:379); neither names `Agent` or `Task`. This is what the plan's own task asked of the READMEs (07-04-PLAN.md:278, acceptance at :290-292), and decision D-PG7-16 (PROJECT.md:2418, Good) scopes the phase's documentation to the agents section of the compatibility page and docs/output-catalog.md. The literal README clause of the truth is unmet and has never been met; it is not a regression. The previous report did not check plan truths one by one."
    accepted_by: "project decision D-PG7-16 (PROJECT.md decision log, Good); README clause pending maintainer review"
    accepted_at: "2026-11-16T07:22:50Z"
re_verification:
  previous_status: passed
  previous_score: "5/5 (3 verified, 2 passed by override)"
  reason: "staleness: Phases 8-11, the gaps-agents/gaps-mcp merges and later fixes changed 18 of the 41 covered non-planning files after the previous report (362ce73a, 2026-11-14T23:29:00Z); 4 of them are phase source files (bridges/agents/convert.ts, bridges/agents/types.ts, bridges/skills/stage.ts, bridges/skills/skill-names.ts)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "The previous score counted the five roadmap criteria only. This pass also checks all 42 plan truths; the 7 that restate a criterion are folded into it, so the denominator is 5 + 35 = 40."
  status_correction: "The previous frontmatter set `passed` with three human_verification items, and its body said the status was `human_needed`. All three are maintainer decisions recorded in PROJECT.md:2411-2419 as pending maintainer review (D-PG7-02, -04, -07, -10, -17, -18, -19) and the two orchestrator overrides, not tests a human must run. Following the precedent of the Phase 4 and Phase 6 re-verifications (cb5ee48c, 2b1ced72), this report lists them under Maintainer Review and keeps human_verification empty."
  overrides_added:
    - "07-04 inherit-sentinel clause (D-PG7-17)"
    - "07-03 one-line description bytes (D-PG7-18)"
    - "07-04 README clause (D-PG7-16)"
  overrides_removed: []
decision_coverage:
  honored: 19
  total: 19
  not_honored: []
  amended_by_record:
    - "D-PG7-17: a source inherit is written as model: \"\" (PROJECT.md:2416; amends criterion 4)"
    - "D-PG7-18: a one-line description YAML misreads is written as a |- block (PROJECT.md:2419)"
    - "D-PG7-19: agents keep the last copy of a repeated top-level key; skills still refuse it (PROJECT.md:2419)"
human_verification: []
---

# Phase 7: Agent Frontmatter and Grants Verification Report

**Phase Goal:** A bridged agent gets the name, description, model, and tool grants that its source declares. The agents bridge reads frontmatter as YAML, maps `Agent` and `Task` grants to nested subagents, passes `model: inherit` on, and writes both tool lists.

**Verified:** 2026-11-16T07:22:50Z
**Status:** passed. All five roadmap criteria and all 35 separate plan truths hold on the current tree, three criteria and 32 truths as written. Five pass by override: the two earlier orchestrator overrides (criterion 3 no-tools `subagent get` wording, criterion 4 `model: ""`), and three new decision overrides (D-PG7-17, D-PG7-18, D-PG7-16). All five wait for maintainer review, as do the product decisions listed under Maintainer Review.
**Re-verification:** Yes. The previous report (passed, 5/5, two overrides, 2026-11-14T23:29:00Z) became stale, because later work changed 18 of its 41 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `2b1ced72`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations are current line numbers. **A/** means `extensions/pi-claude-marketplace/bridges/agents/`, and **F/** means `features/agent/frontmatter.feature`.

Since the previous report, these phase source files changed: A/convert.ts, A/types.ts and A/stage.ts (D-PG10-13 plugin options written into agent bodies and preloaded skills; +2 lines at the top of convert.ts, so its citations moved by 2), `bridges/skills/stage.ts` (the same options, D-PG10-13), and `bridges/skills/skill-names.ts` (`declaresFrontmatterName`, D-PG11-01). A/frontmatter.ts, A/discover.ts, A/legacy-grant-form.ts, A/mcp-async-warning.ts, `shared/frontmatter-repair.ts`, and the skills `frontmatter-degrade.ts`, `frontmatter-scan.ts` and `rewrite-frontmatter.ts` did not change (`git diff --stat 362ce73a HEAD` is empty for them), so their citations were re-read and confirmed in place. Additions to F/ (a project-variable scenario at :107 and a Workflow-grant guard at :1338) moved every later scenario by 38 lines.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). Then the unpaired and integration tests passed, with pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The real-child probes in the log record `piSubagents: 0.88.1` and children in mode `background`, state `complete`. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387), which covers the `@builtin-only` scenario at features/mcp-server/agent-grants.feature:95. Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD, including every phase feature (`agent/frontmatter`, `agent/invocation`, `mcp-server/agent-grants`, `workflow/agent-steps`). The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 22 named single tests, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each reported `tests 1, pass 1, fail 0, skipped 0`. `query verify.artifacts` gives 26/26 and `query verify.key-links` 19/19 across the six plans (exit 0 for each). The pi-subagents 0.88.1 sources the overrides depend on were read in `node_modules/.cache/optional-peers` (agent-management.js:951-976, child-tool-plan.js:213-218).

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 7 must-haves |
| --- | --- | --- |
| D-PG7-17 (in-phase review fix CR-01, now PROJECT.md:2416, pending maintainer review) | A source `inherit` is written as `model: ""` (A/convert.ts:77-84, :341-348). | Criterion 4's `subagent get` shows `model inherit` wording and the 07-04 "own inherit sentinel" clause no longer hold literally. Both are carried by overrides; the outcome (the child runs on the parent's model, with or without `--map-model`) holds. |
| D-PG7-18 (in-phase review fix CR-03, PROJECT.md:2419, pending maintainer review) | A one-line description that YAML does not read as its own text is written as the `|-` block (A/frontmatter.ts:51-100). | The 07-03 truth "a one-line description keeps its bytes, except the four headers are quoted" no longer holds: the headers and every YAML-unsafe value become a block. New override. Criterion 1 still lists `Reviews: code.` (F/:685). |
| D-PG7-19 (in-phase review fix CR-02, PROJECT.md:2419, pending maintainer review) | Before the second parse, an earlier copy of a repeated top-level key is blanked for agents only (A/frontmatter.ts:167-169; `blankEarlierDuplicateKeys`, shared/frontmatter-repair.ts:288). Skills do not call it. | Additive to the 07-02 parse-first truth: the repair still runs only after the first parse throws (A/frontmatter.ts:180-199). Scenarios F/:765, :800. |
| D-PG10-13 (Phase 10) | Agent bodies and preloaded skills are filled with `${user_config.KEY}` through `substituteClaudeContent` (A/convert.ts:1056-1066, A/skill-preload.ts, A/stage.ts:90,118,144, A/types.ts:136-142); skills likewise (`bridges/skills/stage.ts`). | Additive. The frontmatter reader and emitter are untouched; the generated frontmatter of every phase scenario is unchanged apart from the plugin-option scenarios (25caef67). |
| Workflow grant dropped (a179ee04, Phase 8 era) | A `Workflow` entry is not in `TOOL_MAP` (A/convert.ts:94-104) and is dropped, as Claude Code gives the tool to no subagent. | Additive; guard scenario F/:1338, README.md:27. `Agent`/`Task` mapping unchanged. |
| D-PG6-01 (Phase 6) | A child's tool hook rows name the launching session. | Not a Phase 7 must-have; F/:410 and :423 now assert `session main`. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| 1 | `description: "Reviews: code."` lists as `Reviews: code.`; `name: "x"` lists as `demo:x`; unquoted `Reviews: code and tests` plus `model: "sonnet"` both right (PG-AGENT-05) | ✓ VERIFIED | Reader: Pi's `parseFrontmatter` first, repair and reparse only on a throw (A/frontmatter.ts:180-199, :249-267); the name is trimmed, an empty one falls back to the file name (A/discover.ts:157-162). Scenario F/:685 (`--map-model`): `subagent list` returns `demo:colon ... Reviews: code.`, `demo:mixed ... Reviews: code and tests; model claude-sonnet-5-5`, and `demo:x`. Folds 07-02 truth 1. In Gate G. |
| 2 | `tools: Read # note` grants `read` alone; a `description: |` block keeps its lines (PG-AGENT-05) | ✓ VERIFIED | F/:714: `Read # note` and `Read # Bash` both list `tools read`, staged `tools: read`, `droppedTools: []`. F/:977: `subagent get` shows both lines; staged `description: |-` with two-space indent (A/frontmatter.ts:93-100). Folds 07-02 truth 2 and 07-03 truth 1. In Gate G. |
| 3 | `subagent get` lists `subagent` for `Agent`/`Task` with or without a type list, and for an agent with no `tools` field, but not when `disallowedTools` names `Agent`/`Task`; a scripted child calls `subagent({agent: "demo:helper"})` and gets the reply (PG-AGENT-03) | PASSED (override) | Explicit half as written: `TOOL_MAP` maps `Agent` and `Task` to `subagent` (A/convert.ts:94-104), `toolNameOf` drops the type list (:278-281), the deny applies first (:514-526). F/:1270 outline (Agent, Agent(demo:helper), Task, Task(a, b)) shows `tools read, subagent`; F/:1304 (deny in a list) shows `tools read`; F/:1367 (deny, no list) shows `excluded tools subagent`; nested call `features/agent/invocation.feature:305` and :340. Only the no-tools `subagent get` wording is unmet, a pi-subagents display gap (agent-management.js:966-971); see override 1. Folds 07-04 truths 1 and 2. |
| 4 | `subagent get` shows `model inherit` for a source `model: inherit`, with and without `--map-model` (PG-AGENT-07a) | PASSED (override) | A/convert.ts:341-348 writes `INHERIT_MODEL_VALUE` (`""`, :84) before the flag check. F/:1401, :1431 and `features/workflow/agent-steps.feature:17` show the child runs on the session's model over `subagents.defaultModel`. The literal wording is replaced by recorded D-PG7-17 (PROJECT.md:2416); see override 2. Folds 07-04 truth 5 (its byte-identity clause verified by named test). |
| 5 | `subagent list` shows tools and excluded tools for `tools` + `disallowedTools`, and install prints neither pi-subagents-floor warning (PG-AGENT-09) | ✓ VERIFIED | `explicitExcludeTools` writes a per-tool MCP deny under a kept whole-server grant to `excludeTools` beside `tools` (A/convert.ts:571-582, :524; emitter A/frontmatter.ts:433-439). `features/mcp-server/agent-grants.feature:43` (adapter) and :95 (builtin): `tools read, mcp:plugin_demo_stub_; excluded tools mcp__plugin_demo_stub__echo` (`mcp:plugin_demo_stub` under builtin), staged `warnings:` without either text. The floor text (`requires pi-subagents >= 0.62.0`) occurs nowhere under `extensions/` or `features/`; the cannot-narrow text only in the legacy recognizer A/legacy-grant-form.ts:50 (D-PG7-13). Folds 07-06 truth 1. In Gate G. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truth (short) | Status | Current evidence |
|---|---|---|---|
| 07-01 | Helpers live in `shared/frontmatter-repair.ts`, a module with no import, used by both bridges (D-PG7-03) | ✓ VERIFIED | The module has no `import` line; exports at :14, :53, :87, :147, :183, :288, :336. Agents import it (A/frontmatter.ts:37-43, A/legacy-grant-form.ts:37); skills import it (`bridges/skills/stage.ts:32-34`, `frontmatter-degrade.ts:20-22`, `frontmatter-scan.ts:12`, `rewrite-frontmatter.ts:11`, `skill-names.ts:29`). |
| 07-01 | `repairSingleLineScalars` takes a required trigger; skills pass the colon rule (D-PG7-02) | ✓ VERIFIED | Signature at shared/frontmatter-repair.ts:183; `bridges/skills/stage.ts:82` passes `colonRepairTrigger`; skills never call `blankEarlierDuplicateKeys` (D-PG7-19 is agents only). |
| 07-01 | A skill with an unquoted colon installs with its fields; an unfixable one degrades to the same block | ✓ VERIFIED | `bridges/skills/stage.ts:82`, :237 (`synthesizeUnparseableSkill(extractBodyAfterFrontmatter(...))`); owner tests in `test/bridges/skills/stage.test.ts`, in Gate G. |
| 07-01 | An always-true trigger cannot rewrite an empty, quoted, flow, block-header or multi-line value | ✓ VERIFIED | test/shared/frontmatter-repair.test.ts:351 (`D-PG7-02 an always-true trigger returns ... byte-for-byte`), :363, :376 (two run this pass). |
| 07-01 | Moved cases keep their inputs and expected values; skills owner tests pass unedited | ✓ VERIFIED | Cases of `frontmatterBlockEnd`, `keyValueEnd`, `repairSingleLineScalars` in test/shared/frontmatter-repair.test.ts; in Gate G (test:corresponding and direct coverage). |
| 07-01 | No second copy in the skills bridge; skills modules keep 100% direct coverage | ✓ VERIFIED | No definition of any moved helper outside `shared/frontmatter-repair.ts` (grep over `extensions/`); direct coverage in Gate G. |
| 07-02 | Parsed with Pi's YAML first; repair only after failure, parsed once more; the line reader is gone (D-PG7-01) | ✓ VERIFIED | A/frontmatter.ts:180-199; A/frontmatter.ts exports only `readAgentFrontmatter`, `emitGeneratedAgentFile`, `emitGeneratedAgentFrontmatter`, `GeneratedToolsFields`; the old `parseFrontmatter` export of the bridge no longer exists. D-PG7-19 adds the duplicate-key blanking to the second parse only. |
| 07-02 | `tools: *` still loads as every tool: the agents trigger quotes values starting with `*&!%@`` ` `` (D-PG7-02) | ✓ VERIFIED | `AGENT_REPAIR_OPENER` and `agentRepairTrigger` (A/frontmatter.ts:147-157); `tokens.includes("*")` takes the omitted arm (A/convert.ts:500-504). |
| 07-02 | Every value reaches the converter as a string; null is `""`; a sequence is joined; a non-mapping gives no fields; `background` counts only `true`/`"true"` (D-PG7-05) | ✓ VERIFIED | `fieldValue` (A/frontmatter.ts:206-216), `isMapping`/`NOT_A_MAPPING` (:222-227, :265-267), `isTrueBackground` (A/convert.ts:1137-1139); test/bridges/agents/discover.test.ts:757 (`D-PG7-05 resolves ...`). |
| 07-02 | `__proto__` stays data; a name with a path separator or control character is refused; an empty name falls back to the file name | ✓ VERIFIED | `setOwn` (A/frontmatter.ts:232-239); named test `T-07-03: keeps a __proto__ key as data that sets no other field` (passed); `assertSafeName` (A/discover.ts:162); fallback :160-161. |
| 07-02 | An unparseable agent installs under its file name with `Agent from <plugin> plugin`, no `tools`, one note; not refused (D-PG7-04) | ✓ VERIFIED | A/frontmatter.ts:250-256; note A/discover.ts:80-97, pushed :171-173; stage tags it `discoveryWarning` (A/stage.ts:177). Scenarios F/:847, :872, :895, :919. Named tests `D-PG7-04 keeps an unparseable agent under its file name with one note` and `D-PG7-04 adds no note for a file that parses through the repair` (passed). |
| 07-02 | The compatibility page says how frontmatter is read, which values the repair quotes, Claude Code's wider retry, the unparseable rule; the catalog shows the note (D-PG7-16) | ✓ VERIFIED | docs/mcp-compatibility.md:437, :439, :458, :462, :819; docs/output-catalog.md:5528. |
| 07-03 | No description line becomes a key, closes the frontmatter, or reaches the prompt under pi-subagents' own reader (AG-8) | ✓ VERIFIED | Named test `D-PG7-06: no line of a description block becomes a key under pi-subagents' own reader` (passed); frontmatter.test.ts case "key, comment, and fence lines indented inside the block (AG-8)". |
| 07-03 | A lone CR, U+2028 or U+2029 is written as a block | ✓ VERIFIED | `DESCRIPTION_LINE_BREAK` (A/frontmatter.ts:81); frontmatter.test.ts cases for CRLF, lone CR, U+2028, U+2029. |
| 07-03 | A one-line description keeps its bytes, except the four block headers are quoted | PASSED (override) | Superseded by D-PG7-18; see override 4. |
| 07-03 | After update and after reinstall, a quoted-name agent has one file `pi-claude-marketplace-demo-x.md`, one index row, one record name; nothing changes at load (D-PG7-07) | ✓ VERIFIED | F/:1038 (update) and :1159 (reinstall) assert the directory's file names, the staged file, the agents-index rows and the record's agents (Thens in features/step_definitions/plugin/installation.steps.ts, `holds these agents of`). |
| 07-03 | The page says a block keeps its lines, and when and how a quoted name renames, with the three uncovered cases | ✓ VERIFIED | docs/mcp-compatibility.md:472, :476. |
| 07-04 | The type list is written nowhere: one token `subagent`, no `allowedAgents` (D-PG7-08) | ✓ VERIFIED | No `allowedAgents` under `extensions/`; named test `an Agent grant with a type list writes neither an allowedAgents key nor the list` (passed); convert.test.ts:2813, :2843. |
| 07-04 | A deny by either name removes the grant, with or without a specifier (D-PG7-14) | ✓ VERIFIED | F/:1304 (`Read, Agent` with `Task` denied, and the reverse, both show `tools read`); convert.test.ts:2898. |
| 07-04 | Every other source model without `--map-model` writes no `model` line, no original-model record, no warning; with the flag the alias table and `claude-` pass-through are unchanged (D-PG1-04, D-PG1-06) | ✓ VERIFIED | A/convert.ts:351-353, :355-360; convert.test.ts:741; F/:477, :513. |
| 07-04 | The literal for a source `inherit` is pi-subagents' own sentinel; fan-out authorized for an explicit list with `subagent` | PASSED (override) | First clause superseded by D-PG7-17; second clause verified by named test. See override 3. |
| 07-04 | The page and both READMEs state the grants, the unapplied type list, and the kept inherit (D-PG7-16) | PASSED (override) | Page: docs/mcp-compatibility.md:413, :435. READMEs: model sentence only (README.md:379, README.es.md:379). See override 5. |
| 07-05 | No `tools` or `tools: *` gets `allowNestedSubagents: true`, unless a deny of `Agent`/`Task`, which writes `excludeTools: subagent` and no key (D-PG7-09) | ✓ VERIFIED | A/convert.ts:615-652, :1207-1213; convert.test.ts:2967, :3001 (`a disallowed ${deny} writes excludeTools: subagent and no allowNestedSubagents`); named test `a disallowed Bash writes excludeTools, then allowNestedSubagents` (passed). |
| 07-05 | A child of an agent with no `tools` calls `demo:helper` and gets the reply; it is offered the `subagent` tool as the session is | ✓ VERIFIED | invocation.feature:340; :246 compares the child's nameable tools with the session's, and the nameable list includes `subagent` (features/step_definitions/agent/runs.steps.ts:34). In Gate G. |
| 07-05 | A child of an agent with no `tools` that disallows `Agent` cannot nest; `subagent get` shows `excluded tools subagent` | ✓ VERIFIED | invocation.feature:375 (offered `read, bash, edit, write` only); F/:1367. |
| 07-05 | Override candidate: pi-subagents 0.88.1 prints no line for `allowNestedSubagents` in `subagent get` | ✓ VERIFIED | The fact holds: `formatAgentDetail` (agent-management.js:951-976) has no such line. The criterion clause it describes is carried by override 1. |
| 07-05 | The key is never written beside an explicit list; no explicit list for an omitted `tools` | ✓ VERIFIED | `GeneratedToolsFields` forbids it by type (A/frontmatter.ts:294-304); named test `D-PG7-09: refuses allowNestedSubagents beside an explicit tools list` (passed); convert.test.ts:3019. |
| 07-05 | pi-subagents authorizes fan-out for the key and keeps ambient MCP tools; `excludeTools: subagent` authorizes none | ✓ VERIFIED | Named tests `PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools` and `PG-AGENT-03: the exclude list written for a denied Agent authorizes no fan-out` (both passed); child-tool-plan.js:216-218. |
| 07-05 | Depth stays pi-subagents' 2, Claude Code's 3; the page states it (D-PG7-10) | ✓ VERIFIED | docs/mcp-compatibility.md:820; no depth key written (no such key in A/frontmatter.ts:407-470). |
| 07-06 | The deny applies first; an exact name in both lists stays out; `Bash(rm:*)` removes the whole tool (D-PG7-12, D-PG7-14) | ✓ VERIFIED | A/convert.ts:514-526, `toolNameOf` :278-281; convert.test.ts:2335. |
| 07-06 | No conversion returns either removed warning; an apply that restages an agent with `disallowedTools` and no `tools` reports no staging warning (D-PG7-13) | ✓ VERIFIED | Neither text in production code (see criterion 5); F/:660: `reconcile-applied-cascade`, tally warnings 0. |
| 07-06 | The `excludeTools` name is the name the form's implementation registers, and pi-subagents removes the tool under both | ✓ VERIFIED | `excludeNameFor` over `profileFor(id).toolName` (A/convert.ts:136-143); named tests `PG-AGENT-09: the exclude name written beside a whole-server grant removes that adapter tool from the child` and `PG-AGENT-09: the built-in exclude name is the name pi-subagents resolves for the denied tool of a whole-server grant` (both passed). |
| 07-06 | Files and index rows an earlier release wrote still translate; `legacy-grant-form.ts` keeps its own copy; its tests and the grant-rewrite tests pass unedited (D-PG7-13) | ✓ VERIFIED | `NARROW_GRANT_LEAD` (A/legacy-grant-form.ts:50). Since the plan, the only change to the file and its test is the in-phase fix 3ce79768 (before the previous report), which added cases and edited none; grant-rewrite.test.ts is unchanged since `7ed47afc`. In Gate G. |
| 07-06 | A deny with no exact Pi name (`mcp__*`, a whole server beside no `tools`) keeps its warning (D-PG7-14) | ✓ VERIFIED | A/convert.ts:636-641; named test `D-PG7-14: denies with no exact Pi name keep the cannot-narrow warning` (passed). |
| 07-06 | The page says both lists restrict, how each deny is written, which two warnings are gone (D-PG7-16) | ✓ VERIFIED | docs/mcp-compatibility.md:426-433. |

**Score:** 40/40 (35 VERIFIED, 5 PASSED (override); 0 present, behavior-unverified)

## Required Artifacts

`query verify.artifacts`: 07-01 2/2, 07-02 5/5, 07-03 5/5, 07-04 4/4, 07-05 5/5, 07-06 5/5 (26/26, every exit 0).

| Artifact | Status | Details |
|----------|--------|---------|
| `shared/frontmatter-repair.ts` | ✓ VERIFIED | Imported by both bridges (see 07-01). |
| A/frontmatter.ts | ✓ VERIFIED | `readAgentFrontmatter` used by A/discover.ts:157; emitter used by A/convert.ts:21. |
| A/convert.ts | ✓ VERIFIED | `TOOL_MAP`, `mapModel`, `mapTools`, `omittedToolMapping`, `explicitExcludeTools`, `toolsFields`. |
| A/discover.ts | ✓ VERIFIED | Unparseable note :80-97, pushed :171-173. |
| A/legacy-grant-form.ts | ✓ VERIFIED | Old text for stored rows, :50. |
| Feature files and conformance tests | ✓ VERIFIED | As cited above; all in Gate G. |

## Key Link Verification

`query verify.key-links`: 3/3, 4/4, 3/3, 3/3, 3/3, 3/3 (19/19). Manual: `collectAgentFile -> readAgentFrontmatter -> parseFrontmatter` (A/discover.ts:157, A/frontmatter.ts:34, :184, :193); `convertAgent -> mapTools/mapModel -> toolsFields -> emitGeneratedAgentFrontmatter` (A/convert.ts:341, :493, :1207, A/frontmatter.ts:407); the keys `allowNestedSubagents`, `excludeTools`, `model` are read by pi-subagents 0.88.1 `child-tool-plan.js:213-218` and `agent-management.js:966-971`.

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Generated agent file | name, description, tools, excludeTools, allowNestedSubagents, model | Source agent file read at A/discover.ts:156-157, converted in A/convert.ts, emitted by A/frontmatter.ts | Yes; scenarios assert the staged bytes and pi-subagents' own reading | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0 / skipped 0`.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| N1 | PG-AGENT-03: the tools written for an Agent grant authorize fan-out | test/integration/pi-subagents-child-launch-conformance.test.ts | PASS |
| N2 | PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools | same | PASS |
| N3 | PG-AGENT-03: the exclude list written for a denied Agent authorizes no fan-out | same | PASS |
| N4 | PG-AGENT-07a / D-PG7-17: the model written for a source inherit runs the child on the parent's model over subagents.defaultModel | same | PASS |
| N5 | PG-AGENT-09: the exclude name written beside a whole-server grant removes that adapter tool from the child | same | PASS |
| N6 | PG-AGENT-09: the built-in exclude name is the name pi-subagents resolves for the denied tool of a whole-server grant | test/integration/agents-builtin-grant-conformance.test.ts | PASS |
| N7 | D-PG7-17: the engine reads no model for an agent whose source model is inherit | test/integration/workflow-engine-agent-registry.test.ts | PASS |
| N8 | D-PG7-06: no line of a description block becomes a key under pi-subagents' own reader | test/integration/provenance-invisibility.test.ts | PASS |
| N9 | D-PG7-06: a description that is only \| reads as text under pi-subagents' own reader | same | PASS |
| N10 | D-PG7-11: a source model of inherit gives the same file with and without --map-model | test/bridges/agents/convert.test.ts | PASS |
| N11 | D-PG7-12: a per-tool disallow under a whole-server grant writes the adapter's tool name to excludeTools beside tools | same | PASS |
| N12 | D-PG7-14: denies with no exact Pi name keep the cannot-narrow warning | same | PASS |
| N13 | an Agent grant with a type list writes neither an allowedAgents key nor the list | same | PASS |
| N14 | a disallowed Bash writes excludeTools, then allowNestedSubagents | same | PASS |
| N15 | D-PG7-04 keeps an unparseable agent under its file name with one note | test/bridges/agents/discover.test.ts | PASS |
| N16 | D-PG7-04 adds no note for a file that parses through the repair | same | PASS |
| N17 | D-PG7-02 quotes a value the trigger accepts | test/shared/frontmatter-repair.test.ts | PASS |
| N18 | D-PG7-02 leaves a line the trigger refuses byte-for-byte | same | PASS |
| N19 | T-07-03: keeps a __proto__ key as data that sets no other field | test/bridges/agents/frontmatter.test.ts | PASS |
| N20 | D-PG7-09: refuses allowNestedSubagents beside an explicit tools list | same | PASS |
| N21 | emits a description with the block header \| alone as a literal block | same | PASS |
| N22 | emits a description with D-PG7-18: a colon before a space as a literal block | same | PASS |
| G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and this is not a migration phase.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| PG-AGENT-05 | 07-01, 07-02, 07-03 | ✓ SATISFIED | Criteria 1, 2. REQUIREMENTS.md:42 `[x]`, trace :190 Complete |
| PG-AGENT-03 | 07-04, 07-05 | ✓ SATISFIED (override on the no-tools `subagent get` wording) | Criterion 3. REQUIREMENTS.md:43 `[x]`, trace :191 Complete |
| PG-AGENT-07a | 07-04 | ✓ SATISFIED (the requirement text, "runs on the parent's model", is met; the roadmap wording is amended by D-PG7-17) | Criterion 4. REQUIREMENTS.md:41 `[x]`, trace :189 Complete |
| PG-AGENT-09 | 07-06 | ✓ SATISFIED | Criterion 5. REQUIREMENTS.md:44 `[x]`, trace :192 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 7, and each appears in plan frontmatter. BACKLOG AGTEXCL-01 is closed (BACKLOG.md:4636); AGTREPAIRSET-01 (:5455) stays open as the D-PG7-02 residual.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| Phase source files under `extensions/` and the four phase features | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | None | No match |
| The phase features | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- The previous report's Info items are resolved: AGTEXCL-01 is closed (BACKLOG.md:4636), the D-PG7 decision rows exist (PROJECT.md:2411-2419), the traceability rows read Complete, and 07-SECURITY.md was re-audited on the shipped code (`reaudited: 2026-11-15`, 21/21 closed, 3a59a8fd).
- D-PG7-07 names `apply` convergence as a third rename path; no scenario shows it, as docs/mcp-compatibility.md:476 states. The 07-03 truth names only update and reinstall, which are covered.
- Residuals IN-01 (YAML tag warning on stderr, Pi gap) and IN-04 (a lone-CR file skips the repair, docs/mcp-compatibility.md:458) stay documented.
- The previous report cited F/:622, :647, :676, :809, :834, :857, :881, :939, :1000, :1121, :1208, :1232, :1266, :1300, :1334, :1364, agent-steps.feature:16, convert.ts:81, :92-102, :276-279, :340-347, :513-526, :569-582, :648, conformance :409 and docs/mcp-compatibility.md:397, :424, :749-751. Later additions moved them to the lines above; the content is the same in substance.

## Human Verification Required

None. The items the previous report listed here are maintainer decisions and orchestrator overrides, not tests; they are listed under Maintainer Review.

## Maintainer Review

These items wait for the maintainer. None is a gap:

1. **D-PG7-04** (PROJECT.md:2412): an agent whose frontmatter does not parse after the repair loads with every tool, nested delegation included (docs/mcp-compatibility.md:821), and one install note (Claude Code 2.1.323 parity). This conflicts with the recorded fail-closed-on-corrupt-data preference. Decide which holds.
2. **Override 1** (criterion 3, no-tools `subagent get` wording, pi-subagents display gap) and **override 2** (criterion 4, `model: ""`, D-PG7-17, PROJECT.md:2416, whose row says it amends the criterion): accept, amend ROADMAP criteria 3 and 4 to the delivered wording, or reject. If D-PG7-17 is rejected, criterion 4 needs a form both pi-subagents and the workflow engine accept, which 07-REVIEW-FIX.md CR-01 reports does not exist.
3. **New overrides 3-5:** D-PG7-17 for the 07-04 sentinel clause, D-PG7-18 (PROJECT.md:2419) for the 07-03 one-line-bytes truth, and D-PG7-16 for the 07-04 README clause (the READMEs do not mention `Agent`/`Task` grants; add a sentence or accept the narrower scope).
4. **Pending decisions:** D-PG7-02 (narrower repair trigger, AGTREPAIRSET-01), D-PG7-07 (rename at the next update or reinstall), D-PG7-10 (depth 2, Claude Code 3), D-PG7-18 and D-PG7-19 (agents keep the last copy of a repeated key; skills still refuse it).

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and all 35 separate plan truths of Phase 7 hold, and every citation points at a current line. Later work touched the phase in two places, and neither breaks a must-have:

- Phase 10 (D-PG10-13) fills plugin options into agent bodies and preloaded skills. The frontmatter reader, the emitter and the tool and model mapping did not change.
- Phase 11 (D-PG11-01) added `declaresFrontmatterName` to `skill-names.ts`. The skills repair path that 07-01 moved is unchanged.

Checking plan truths one by one found three that do not hold as written, none a regression. Two were changed by in-phase review fixes now recorded as D-PG7-17 and D-PG7-18. The third is a README clause that the plan's own task never asked for. Each now passes by a decision override. The status stays `passed`. The score moves from 5/5 to 40/40, because this pass also counts the plan truths.

---

_Verified: 2026-11-16T07:22:50Z_
_Verifier: Claude (gsd-verifier)_
