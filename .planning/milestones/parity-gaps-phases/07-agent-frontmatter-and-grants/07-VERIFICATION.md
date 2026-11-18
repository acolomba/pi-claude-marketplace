---
phase: 07-agent-frontmatter-and-grants
verified: 2026-11-17T03:45:31Z
status: passed
score: 40/40 must-haves verified (36 VERIFIED, 4 PASSED (override))
covered_files: [".planning/phases/07-agent-frontmatter-and-grants/07-01-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-01-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-02-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-02-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-03-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-03-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-04-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-04-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-05-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-05-SUMMARY.md",".planning/phases/07-agent-frontmatter-and-grants/07-06-PLAN.md",".planning/phases/07-agent-frontmatter-and-grants/07-06-SUMMARY.md","README.es.md","README.md","docs/mcp-compatibility.md","docs/output-catalog.md","docs/prd/pi-claude-marketplace-prd.md","docs/research/parity-gaps/subagents.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/discover.ts","extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts","extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts","extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts","extensions/pi-claude-marketplace/bridges/agents/stage.ts","extensions/pi-claude-marketplace/bridges/agents/types.ts","extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts","extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts","extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts","extensions/pi-claude-marketplace/bridges/skills/skill-names.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/shared/frontmatter-repair.ts","features/agent/frontmatter.feature","features/agent/invocation.feature","features/lib/agent-files.ts","features/lib/upstream/subagents.ts","features/lib/workflow-files.ts","features/mcp-server/agent-grants.feature","features/step_definitions/agent/listing.steps.ts","features/step_definitions/agent/runs.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-steps.feature","test/bridges/agents/convert.test.ts","test/bridges/agents/discover.test.ts","test/bridges/agents/frontmatter.test.ts","test/bridges/agents/grant-forms.test.ts","test/bridges/agents/grant-rewrite.test.ts","test/bridges/agents/legacy-grant-form.test.ts","test/bridges/agents/stage.test.ts","test/bridges/skills/frontmatter-degrade.test.ts","test/bridges/skills/frontmatter-scan.test.ts","test/integration/agents-builtin-grant-conformance.test.ts","test/integration/pi-subagents-child-launch-conformance.test.ts","test/integration/provenance-invisibility.test.ts","test/integration/workflow-engine-agent-registry.test.ts","test/shared/frontmatter-repair.test.ts"]
covered_digest: "v4:sha256:63863b2b460b2ff3f3058bed8d0ddb7c67d9bf34a954273508a031924cc63d22"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "subagent get lists subagent among the tools of an agent with no tools field (criterion 3, PG-AGENT-03)"
    reason: "Pi capability gap, re-checked 2026-11-17, unchanged. pi-subagents 0.88.1 `formatAgentDetail` (src/agents/agent-management.js:951-976) prints Model, Tools and Excluded tools lines but no line for allowNestedSubagents, so an agent with no tools list cannot show `subagent` in `subagent get` without an explicit tools list, which would take away its default and ambient tools. The intent (the agent can start subagents) is proven by behavior: the staged file holds `allowNestedSubagents: true` (features/agent/frontmatter.feature:127, :958, :1135, :1246; convert.ts:615-652, :1207-1213; frontmatter.ts:441-443), the scripted child of an agent with no tools list calls subagent({agent: \"demo:helper\"}) and gets the reply (features/agent/invocation.feature:340), the child is offered the session's nameable tools, `subagent` included (invocation.feature:246; features/step_definitions/agent/runs.steps.ts:34), the deny case shows `excluded tools subagent` (frontmatter.feature:1367) and cannot nest (invocation.feature:375), and pi-subagents' own child-tool-plan authorizes fan-out for the written key (src/runs/shared/child-tool-plan.js:216-218; named test `PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools`, passed this pass). Recorded as the override candidate in 07-05-PLAN truth 4 and D-PG7-15."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T23:29:00Z"
  - must_have: "subagent get shows model inherit for a source agent with model: inherit, with and without --map-model (criterion 4, PG-AGENT-07a)"
    reason: "Alternative implementation, recorded as decision D-PG7-17 (PROJECT.md:2416, locked by the maintainer review 2026-11-16; the row says it amends ROADMAP Phase 7 criterion 4, passed by override). Writing `model: inherit` made workflow-engine 3.15.0 steps fail with MODEL_NOT_FOUND. The bridge writes `model: \"\"` for a source inherit in any case and before the flag check (convert.ts:84, :341-348), which pi-subagents 0.88.1 reads as the session's model and which keeps `subagents.defaultModel` off the agent. The requirement's outcome (REQUIREMENTS.md:41, the child runs on the parent's model with or without --map-model) holds: features/agent/frontmatter.feature:1401 and :1431 (defaultModel claude-haiku-5-5, child still answers), features/workflow/agent-steps.feature:17, named tests `PG-AGENT-07a / D-PG7-17: the model written for a source inherit runs the child on the parent's model over subagents.defaultModel` and `D-PG7-17: the engine reads no model for an agent whose source model is inherit` (both passed this pass). The file is the same with and without the flag (named test `D-PG7-11: a source model of inherit gives the same file with and without --map-model`, passed this pass). Visible cost: pi-subagents prints no Model line for an empty model (`if (agent.model)`, agent-management.js:966), and `subagent list` shows an empty `Model:`, stated at docs/mcp-compatibility.md:435. Also carries the 07-04 truth that restates criterion 4."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T23:29:00Z"
  - must_have: "07-04 truth: the literal the bridge writes for a source inherit is pi-subagents 0.88.1's own inherit sentinel, and pi-subagents authorizes fan-out for an explicit list that holds subagent"
    reason: "Superseded in its first clause by decision D-PG7-17 (PROJECT.md:2416, in-phase review fix CR-01, confirmed by the maintainer review 2026-11-16): the written literal is `\"\"` (convert.ts:77-84), not pi-subagents' `inherit` sentinel, because the workflow engine reads `inherit` as a model ID. The outcome the clause stood for (the child runs on the parent's model, over subagents.defaultModel) holds; see the criterion 4 override. The second clause holds as written: named test `PG-AGENT-03: the tools written for an Agent grant authorize fan-out` (passed in the previous pass; the file is unchanged since), pi-subagents child-tool-plan.js:216."
    accepted_by: "project decision D-PG7-17 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:22:50Z"
  - must_have: "07-03 truth: a one-line description is written with the bytes it has today, except that a description that is only |, |-, > or >- is quoted"
    reason: "Superseded by decision D-PG7-18 (PROJECT.md:2419, in-phase review fix CR-03, confirmed by the maintainer review 2026-11-16): a one-line description stays on the key line only when YAML reads it as its own text (frontmatter.ts:51-74, `YAML_UNSAFE_PLAIN` plus a parseFrontmatter round trip); any other one-line description, the four block headers included, is written as the `|-` block (frontmatter.ts:93-100), because the workflow engine reads the file with Pi's YAML reader and refused the frontmatter otherwise. A description YAML reads as its text keeps its bytes (frontmatter.test.ts:325-330 and `D-PG7-18: a colon and a hash that YAML reads as text unchanged`). Evidence: named test `emits a description with the block header | alone as a literal block` (passed this pass), `emits a description with D-PG7-18: a colon before a space as a literal block` and `D-PG7-06: a description that is only | reads as text under pi-subagents' own reader` (passed in the previous pass; files unchanged since), test/integration/workflow-engine-agent-registry.test.ts:96, scenario features/workflow/agent-steps.feature:39, docs/mcp-compatibility.md:474."
    accepted_by: "project decision D-PG7-18 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:22:50Z"
re_verification:
  previous_status: passed
  previous_score: "40/40 (36 verified, 4 passed by override)"
  reason: "staleness after two docs-only commits changed docs/mcp-compatibility.md, a covered file, after the previous basis 5ead1acf: 421863f6 (docs: align decision wording with the maintainer review) dropped pending-review wording after D-PG9 decision IDs at :143, :145, :147, :383 and :767-770 and pointed the workflow-tools item at BACKLOG AGTWORKFLOWAMBIENT-01, and ebcce31e changed the D-PG7-17 sentence at :435 to say that the maintainer review of 2026-11-16 confirmed it. Each hunk replaces lines one for one, so no cited line moved. No source, test or feature file changed, and no other covered file changed."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "None. The denominator stays 5 roadmap criteria + 35 separate plan truths = 40."
  status_correction: "None. The report already recorded every D-PG7 decision as locked by the maintainer review of 2026-11-16 (PROJECT.md:2411-2419), and no text in it called a locked decision pending. The doc sentence at docs/mcp-compatibility.md:435 that override 2 cites now agrees with that."
  overrides_added: []
  overrides_removed: []
decision_coverage:
  honored: 19
  total: 19
  not_honored: []
  amended_by_record:
    - "D-PG7-17: a source inherit is written as model: \"\" (PROJECT.md:2416; amends criterion 4; locked 2026-11-16)"
    - "D-PG7-18: a one-line description YAML misreads is written as a |- block (PROJECT.md:2419; locked 2026-11-16)"
    - "D-PG7-19: agents keep the last copy of a repeated top-level key; skills still refuse it (PROJECT.md:2419; locked 2026-11-16)"
human_verification: []
---

# Phase 7: Agent Frontmatter and Grants Verification Report

**Phase Goal:** A bridged agent gets the name, description, model, and tool grants that its source declares. The agents bridge reads frontmatter as YAML, maps `Agent` and `Task` grants to nested subagents, passes `model: inherit` on, and writes both tool lists.

**Verified:** 2026-11-17T03:45:31Z
**Status:** passed. All five roadmap criteria and all 35 separate plan truths hold on the current tree, three criteria and 33 truths as written. Four pass by override: the two orchestrator overrides (criterion 3 no-tools `subagent get` wording, criterion 4 `model: ""`) and two decision overrides (D-PG7-17, D-PG7-18). The maintainer review of 2026-11-16 accepted all four and locked every phase decision it was asked about, so nothing in this phase is open.
**Re-verification:** Yes. The previous report (passed, 40/40, four overrides, 2026-11-17T02:44:19Z, commit 5ead1acf) became stale when the docs-only commits 421863f6 and ebcce31e changed `docs/mcp-compatibility.md`, one of its covered files.

## Verification Basis

This pass re-checked the roadmap criteria and plan must-haves against `features/gaps` at `c5bf5737`. Summaries were not taken as evidence. **A/** means `extensions/pi-claude-marketplace/bridges/agents/`, and **F/** means `features/agent/frontmatter.feature`.

Changes since the previous basis (`5ead1acf`), by `git diff --stat 5ead1acf HEAD` over the 56 covered files: only `docs/mcp-compatibility.md`, 10 lines changed, 10 added and 10 removed, each hunk one line for one line.

- 421863f6 (docs: align decision wording with the maintainer review) removed the pending-review wording after the D-PG9 decision IDs at :143 and :767 (D-PG9-01), :145 (D-PG9-15), :147 and :768 (D-PG9-16), :383 (D-PG9-14), :769 (D-PG9-08) and :770 (D-PG9-07), and rewrote the end of :833 to say that a `Workflow` grant stays dropped (D-PG8-11..15), with a pointer with a pointer to BACKLOG AGTWORKFLOWAMBIENT-01 (BACKLOG.md:5465) for the question of whether the converter should also exclude the engine's two workflow tools, which the line had called an open question for the maintainer. The rest of that commit changed files outside this phase's covered list: `docs/env-vars.md`, `docs/hooks-compatibility.md`, `docs/prd/parity-gaps-prd.md`, the Phase 10 closeout line in `.planning/ROADMAP.md` (:497), and planning files of Phases 10 and 11.
- ebcce31e (docs: drop the pending note on the empty model display) changed one sentence of :435 from "This display is part of the pending review of D-PG7-17." to "This display comes with D-PG7-17, which the maintainer review of 2026-11-16 confirmed." Override 2 cites :435 for the empty `Model:` display, and the line still states that display.

The Phase 7 citations in this report (:403, :413, :426-433, :435, :437, :439, :458, :462, :472, :474, :476, :830-832) did not move, and their content is unchanged apart from the :435 sentence above. `git diff --name-only 5ead1acf HEAD -- extensions features test` is empty, so every source, feature and test citation of the previous report stands. A spot read confirmed A/convert.ts:84 (`INHERIT_MODEL_VALUE = '""'`). No `TBD`, `FIXME` or `XXX` occurs in the agents bridge or `shared/frontmatter-repair.ts`.

The decision log was re-read. `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` and `.planning/BACKLOG.md` did not change since `5ead1acf`. PROJECT.md:2411, :2412, :2414, :2415, :2416 and :2419 (D-PG7-01/02/03, -04, -07, -08/09/10, -11/17, -18/19) read `Locked (maintainer review 2026-11-16, confirmed)`, with "parity kept" on D-PG7-04 and "depth 2 kept" on D-PG7-08/09/10. :2413, :2417 and :2418 (D-PG7-05/06, -12/13/14, -15/16) read `Good`. D-PG10-25 (PROJECT.md:2441) reads as reversed by the maintainer review to fail closed, as the superseded-mechanisms table below states. ROADMAP Phase 7 (criteria 1-5) did not change; the one ROADMAP edit of 421863f6 is the Phase 10 closeout line.

**Gate G (reused, not re-run):** `npm run check` exited 0 at `421863f6`, log `/tmp/pg-final2.log`, which the verifier read. The cucumber adapter profile passed 2100/2100 scenarios, and the builtin profile passed 204/204 scenarios and 2762/2762 steps. Direct coverage merged 376 LCOV records. The log ends with `exit=0`. `git diff --name-only 421863f6 HEAD` names `docs/mcp-compatibility.md` (ebcce31e, one sentence; docs are not build inputs) and six `NN-VERIFICATION.md` files of Phases 1-6, so G covers every executable input of HEAD, including the four phase features.

**Independent checks (this pass):** four named single tests ran with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>`. Each run had a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad, on Node v26.13.1. Each reported `tests 1, pass 1, fail 0, skipped 0`. The other named tests of the previous passes were not repeated, because their files and the code they test have not changed since, and Gate G ran them again. The previous pass's `query verify.artifacts` (26/26) and `query verify.key-links` (19/19) stand, because no plan and no artifact file changed.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 7 must-haves |
| --- | --- | --- |
| D-PG7-17 (in-phase review fix CR-01, PROJECT.md:2416, locked by the maintainer review 2026-11-16) | A source `inherit` is written as `model: ""` (A/convert.ts:77-84, :341-348). | Criterion 4's `subagent get` shows `model inherit` wording and the 07-04 "own inherit sentinel" clause no longer hold literally. Both are carried by accepted overrides; the outcome (the child runs on the parent's model, with or without `--map-model`) holds. |
| D-PG7-18 (in-phase review fix CR-03, PROJECT.md:2419, locked by the maintainer review 2026-11-16) | A one-line description that YAML does not read as its own text is written as the `|-` block (A/frontmatter.ts:51-100). | The 07-03 truth "a one-line description keeps its bytes, except the four headers are quoted" no longer holds: the headers and every YAML-unsafe value become a block. Carried by an accepted override. Criterion 1 still lists `Reviews: code.` (F/:685). |
| D-PG7-19 (in-phase review fix CR-02, PROJECT.md:2419, locked by the maintainer review 2026-11-16) | Before the second parse, an earlier copy of a repeated top-level key is blanked for agents only (A/frontmatter.ts:167-169; `blankEarlierDuplicateKeys`, shared/frontmatter-repair.ts:288). Skills do not call it. | Additive to the 07-02 parse-first truth: the repair still runs only after the first parse throws (A/frontmatter.ts:180-199). Scenarios F/:765, :800. |
| D-PG10-13 (Phase 10) | Agent bodies and preloaded skills are filled with `${user_config.KEY}` through `substituteClaudeContent` (A/convert.ts:1056-1066, A/skill-preload.ts, A/stage.ts:90,118,144, A/types.ts:136-142); skills likewise (`bridges/skills/stage.ts`). | Additive. The frontmatter reader and emitter are untouched. |
| D-PG10-25 (maintainer review 2026-11-16) | A record whose `userConfig` does not parse fails closed with `{unreadable}`. New doc and catalog sections and one Given step. | Not a Phase 7 must-have. It only moved later citations in the two docs. |
| Workflow grant dropped (a179ee04; ROADMAP Phase 8 goal restated in b5692689) | A `Workflow` entry is not in `TOOL_MAP` (A/convert.ts:94-104) and is dropped, as Claude Code gives the tool to no subagent. | Additive; guard scenario F/:1338, README.md:27. `Agent`/`Task` mapping unchanged. |
| D-PG6-01 (Phase 6) | A child's tool hook rows name the launching session. | Not a Phase 7 must-have; F/:410 and :423 assert `session main`. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| 1 | `description: "Reviews: code."` lists as `Reviews: code.`; `name: "x"` lists as `demo:x`; unquoted `Reviews: code and tests` plus `model: "sonnet"` both right (PG-AGENT-05) | ✓ VERIFIED | Reader: Pi's `parseFrontmatter` first, repair and reparse only on a throw (A/frontmatter.ts:180-199, :249-267); the name is trimmed, an empty one falls back to the file name (A/discover.ts:157-162). Scenario F/:685 (`--map-model`): `subagent list` returns `demo:colon ... Reviews: code.`, `demo:mixed ... Reviews: code and tests; model claude-sonnet-5-5`, and `demo:x`. Folds 07-02 truth 1. In Gate G. |
| 2 | `tools: Read # note` grants `read` alone; a `description: |` block keeps its lines (PG-AGENT-05) | ✓ VERIFIED | F/:714: `Read # note` and `Read # Bash` both list `tools read`, staged `tools: read`, `droppedTools: []`. F/:977: `subagent get` shows both lines; staged `description: |-` with two-space indent (A/frontmatter.ts:93-100). Folds 07-02 truth 2 and 07-03 truth 1. In Gate G. |
| 3 | `subagent get` lists `subagent` for `Agent`/`Task` with or without a type list, and for an agent with no `tools` field, but not when `disallowedTools` names `Agent`/`Task`; a scripted child calls `subagent({agent: "demo:helper"})` and gets the reply (PG-AGENT-03) | PASSED (override) | Explicit half as written: `TOOL_MAP` maps `Agent` and `Task` to `subagent` (A/convert.ts:94-104), `toolNameOf` drops the type list (:278-281), the deny applies first (:514-526). F/:1270 outline (Agent, Agent(demo:helper), Task, Task(a, b)) shows `tools read, subagent`; F/:1304 (deny in a list) shows `tools read`; F/:1367 (deny, no list) shows `excluded tools subagent`; nested call `features/agent/invocation.feature:305` and :340. Only the no-tools `subagent get` wording is unmet, a pi-subagents display gap (agent-management.js:951-976, re-read this pass); see override 1, accepted by the maintainer review 2026-11-16. Folds 07-04 truths 1 and 2. |
| 4 | `subagent get` shows `model inherit` for a source `model: inherit`, with and without `--map-model` (PG-AGENT-07a) | PASSED (override) | A/convert.ts:341-348 writes `INHERIT_MODEL_VALUE` (`""`, :84) before the flag check. F/:1401, :1431 and `features/workflow/agent-steps.feature:17` show the child runs on the session's model over `subagents.defaultModel`; named tests N4, N7 and N10 passed this pass. The literal wording is replaced by locked D-PG7-17 (PROJECT.md:2416); see override 2, accepted by the maintainer review 2026-11-16. Folds 07-04 truth 5. |
| 5 | `subagent list` shows tools and excluded tools for `tools` + `disallowedTools`, and install prints neither pi-subagents-floor warning (PG-AGENT-09) | ✓ VERIFIED | `explicitExcludeTools` writes a per-tool MCP deny under a kept whole-server grant to `excludeTools` beside `tools` (A/convert.ts:571-582, :524; emitter A/frontmatter.ts:433-439). `features/mcp-server/agent-grants.feature:43` (adapter) and :95 (builtin): `tools read, mcp:plugin_demo_stub_; excluded tools mcp__plugin_demo_stub__echo` (`mcp:plugin_demo_stub` under builtin), staged `warnings:` without either text. The floor text occurs nowhere under `extensions/` or `features/`; the cannot-narrow text only in the legacy recognizer A/legacy-grant-form.ts:50 (D-PG7-13). Named test N6 passed this pass. Folds 07-06 truth 1. In Gate G. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truth (short) | Status | Current evidence |
|---|---|---|---|
| 07-01 | Helpers live in `shared/frontmatter-repair.ts`, a module with no import, used by both bridges (D-PG7-03) | ✓ VERIFIED | The module has no `import` line; exports at :14, :53, :87, :147, :183, :288, :336. Agents import it (A/frontmatter.ts:37-43, A/legacy-grant-form.ts:37); skills import it (`bridges/skills/stage.ts:32-34`, `frontmatter-degrade.ts:20-22`, `frontmatter-scan.ts:12`, `rewrite-frontmatter.ts:11`, `skill-names.ts:29`). Unchanged since the previous pass. |
| 07-01 | `repairSingleLineScalars` takes a required trigger; skills pass the colon rule (D-PG7-02) | ✓ VERIFIED | Signature at shared/frontmatter-repair.ts:183; `bridges/skills/stage.ts:82` passes `colonRepairTrigger`; skills never call `blankEarlierDuplicateKeys`. |
| 07-01 | A skill with an unquoted colon installs with its fields; an unfixable one degrades to the same block | ✓ VERIFIED | `bridges/skills/stage.ts:82`, :237; owner tests in `test/bridges/skills/stage.test.ts`, in Gate G. |
| 07-01 | An always-true trigger cannot rewrite an empty, quoted, flow, block-header or multi-line value | ✓ VERIFIED | test/shared/frontmatter-repair.test.ts:351, :363, :376; named test N18 passed this pass. |
| 07-01 | Moved cases keep their inputs and expected values; skills owner tests pass unedited | ✓ VERIFIED | Cases in test/shared/frontmatter-repair.test.ts; in Gate G. |
| 07-01 | No second copy in the skills bridge; skills modules keep 100% direct coverage | ✓ VERIFIED | No definition of a moved helper outside `shared/frontmatter-repair.ts`; direct coverage in Gate G (376 records). |
| 07-02 | Parsed with Pi's YAML first; repair only after failure, parsed once more; the line reader is gone (D-PG7-01) | ✓ VERIFIED | A/frontmatter.ts:180-199, re-read this pass; the bridge exports only `readAgentFrontmatter`, `emitGeneratedAgentFile`, `emitGeneratedAgentFrontmatter`, `GeneratedToolsFields`. |
| 07-02 | `tools: *` still loads as every tool: the agents trigger quotes values starting with `*&!%@`` ` `` (D-PG7-02) | ✓ VERIFIED | `AGENT_REPAIR_OPENER` and `agentRepairTrigger` (A/frontmatter.ts:147-157); `tokens.includes("*")` takes the omitted arm (A/convert.ts:500-504). |
| 07-02 | Every value reaches the converter as a string; null is `""`; a sequence is joined; a non-mapping gives no fields; `background` counts only `true`/`"true"` (D-PG7-05) | ✓ VERIFIED | `fieldValue` (A/frontmatter.ts:206-216), `isMapping`/`NOT_A_MAPPING` (:222-227, :265-267), `isTrueBackground` (A/convert.ts:1137-1139); test/bridges/agents/discover.test.ts:757. |
| 07-02 | `__proto__` stays data; a name with a path separator or control character is refused; an empty name falls back to the file name | ✓ VERIFIED | `setOwn` (A/frontmatter.ts:232-239); named test N19 (previous pass, file unchanged); `assertSafeName` (A/discover.ts:162); fallback :160-161. |
| 07-02 | An unparseable agent installs under its file name with `Agent from <plugin> plugin`, no `tools`, one note; not refused (D-PG7-04, locked with parity kept) | ✓ VERIFIED | A/frontmatter.ts:250-256; note A/discover.ts:80-97, pushed :171-173; stage tags it `discoveryWarning` (A/stage.ts:177). Scenarios F/:847, :872, :895, :919. Named test N15 passed this pass. |
| 07-02 | The compatibility page says how frontmatter is read, which values the repair quotes, Claude Code's wider retry, the unparseable rule; the catalog shows the note (D-PG7-16) | ✓ VERIFIED | docs/mcp-compatibility.md:437, :439, :458, :462, :830 (moved from :819); docs/output-catalog.md:5544 (moved from :5528). |
| 07-03 | No description line becomes a key, closes the frontmatter, or reaches the prompt under pi-subagents' own reader (AG-8) | ✓ VERIFIED | Named test N8 passed this pass; frontmatter.test.ts case "key, comment, and fence lines indented inside the block (AG-8)". |
| 07-03 | A lone CR, U+2028 or U+2029 is written as a block | ✓ VERIFIED | `DESCRIPTION_LINE_BREAK` (A/frontmatter.ts:81); frontmatter.test.ts cases for CRLF, lone CR, U+2028, U+2029. |
| 07-03 | A one-line description keeps its bytes, except the four block headers are quoted | PASSED (override) | Superseded by locked D-PG7-18; see override 4. Named test N21 passed this pass. |
| 07-03 | After update and after reinstall, a quoted-name agent has one file `pi-claude-marketplace-demo-x.md`, one index row, one record name; nothing changes at load (D-PG7-07, locked) | ✓ VERIFIED | F/:1038 (update) and :1159 (reinstall) assert the directory's file names, the staged file, the agents-index rows and the record's agents (`holds these agents of` in features/step_definitions/plugin/installation.steps.ts, unchanged by 78011db4). In Gate G. |
| 07-03 | The page says a block keeps its lines, and when and how a quoted name renames, with the three uncovered cases | ✓ VERIFIED | docs/mcp-compatibility.md:472, :476. |
| 07-04 | The type list is written nowhere: one token `subagent`, no `allowedAgents` (D-PG7-08) | ✓ VERIFIED | No `allowedAgents` under `extensions/`; named test N13 (previous pass, file unchanged); convert.test.ts:2813, :2843. |
| 07-04 | A deny by either name removes the grant, with or without a specifier (D-PG7-14) | ✓ VERIFIED | F/:1304; convert.test.ts:2898. |
| 07-04 | Every other source model without `--map-model` writes no `model` line, no original-model record, no warning; with the flag the alias table and `claude-` pass-through are unchanged (D-PG1-04, D-PG1-06) | ✓ VERIFIED | A/convert.ts:351-353, :355-360; convert.test.ts:741; F/:477, :513. |
| 07-04 | The literal for a source `inherit` is pi-subagents' own sentinel; fan-out authorized for an explicit list with `subagent` | PASSED (override) | First clause superseded by locked D-PG7-17; second clause verified (child-tool-plan.js:216, re-read this pass). See override 3. |
| 07-04 | The page and both READMEs state the grants, the unapplied type list, and the kept inherit (D-PG7-16) | ✓ VERIFIED | Page: docs/mcp-compatibility.md:413, :435. READMEs: README.md:379 and README.es.md:379 hold the `model: ""` sentence, then the 594ea843 sentence that an `Agent` or `Task` entry lets an agent start any subagent, even when the entry names agent types, with a link to the page's `#customizing-generated-agents` heading (:403). |
| 07-05 | No `tools` or `tools: *` gets `allowNestedSubagents: true`, unless a deny of `Agent`/`Task`, which writes `excludeTools: subagent` and no key (D-PG7-09) | ✓ VERIFIED | A/convert.ts:615-652, :1207-1213 (re-read this pass); convert.test.ts:2967, :3001; named test N14 (previous pass, file unchanged). |
| 07-05 | A child of an agent with no `tools` calls `demo:helper` and gets the reply; it is offered the `subagent` tool as the session is | ✓ VERIFIED | invocation.feature:340; :246 compares the child's nameable tools with the session's (features/step_definitions/agent/runs.steps.ts:34). In Gate G. |
| 07-05 | A child of an agent with no `tools` that disallows `Agent` cannot nest; `subagent get` shows `excluded tools subagent` | ✓ VERIFIED | invocation.feature:375; F/:1367. |
| 07-05 | Override candidate: pi-subagents 0.88.1 prints no line for `allowNestedSubagents` in `subagent get` | ✓ VERIFIED | `formatAgentDetail` (agent-management.js:951-976, re-read this pass) has no such line. The criterion clause it describes is carried by override 1. |
| 07-05 | The key is never written beside an explicit list; no explicit list for an omitted `tools` | ✓ VERIFIED | `GeneratedToolsFields` forbids it by type (A/frontmatter.ts:294-304); named test N20 passed this pass; convert.test.ts:3019. |
| 07-05 | pi-subagents authorizes fan-out for the key and keeps ambient MCP tools; `excludeTools: subagent` authorizes none | ✓ VERIFIED | Named tests N2 and N3 passed this pass; child-tool-plan.js:216-218. |
| 07-05 | Depth stays pi-subagents' 2, Claude Code's 3; the page states it (D-PG7-10, locked) | ✓ VERIFIED | docs/mcp-compatibility.md:831 (moved from :820); no depth key written (A/frontmatter.ts:407-470). |
| 07-06 | The deny applies first; an exact name in both lists stays out; `Bash(rm:*)` removes the whole tool (D-PG7-12, D-PG7-14) | ✓ VERIFIED | A/convert.ts:514-526, `toolNameOf` :278-281; convert.test.ts:2335. |
| 07-06 | No conversion returns either removed warning; an apply that restages an agent with `disallowedTools` and no `tools` reports no staging warning (D-PG7-13) | ✓ VERIFIED | Neither text in production code (see criterion 5); F/:660: `reconcile-applied-cascade`, tally warnings 0. |
| 07-06 | The `excludeTools` name is the name the form's implementation registers, and pi-subagents removes the tool under both | ✓ VERIFIED | `excludeNameFor` over `profileFor(id).toolName` (A/convert.ts:136-143); named test N6 passed this pass, N5 in the previous pass (file unchanged). |
| 07-06 | Files and index rows an earlier release wrote still translate; `legacy-grant-form.ts` keeps its own copy; its tests and the grant-rewrite tests pass unedited (D-PG7-13) | ✓ VERIFIED | `NARROW_GRANT_LEAD` (A/legacy-grant-form.ts:50). The file and its tests are unchanged since the previous pass. In Gate G. |
| 07-06 | A deny with no exact Pi name (`mcp__*`, a whole server beside no `tools`) keeps its warning (D-PG7-14) | ✓ VERIFIED | A/convert.ts:636-641; named test N12 passed this pass. |
| 07-06 | The page says both lists restrict, how each deny is written, which two warnings are gone (D-PG7-16) | ✓ VERIFIED | docs/mcp-compatibility.md:426-433. |

**Score:** 40/40 (36 VERIFIED, 4 PASSED (override); 0 present, behavior-unverified)

## Required Artifacts

`query verify.artifacts`: 07-01 2/2, 07-02 5/5, 07-03 5/5, 07-04 4/4, 07-05 5/5, 07-06 5/5 (26/26, every exit 0).

| Artifact | Status | Details |
|----------|--------|---------|
| `shared/frontmatter-repair.ts` | ✓ VERIFIED | Imported by both bridges (see 07-01). |
| A/frontmatter.ts | ✓ VERIFIED | `readAgentFrontmatter` used by A/discover.ts:157; emitter used by A/convert.ts:21. |
| A/convert.ts | ✓ VERIFIED | `TOOL_MAP`, `mapModel`, `mapTools`, `omittedToolMapping`, `explicitExcludeTools`, `toolsFields`. |
| A/discover.ts | ✓ VERIFIED | Unparseable note :80-97, pushed :171-173. |
| A/legacy-grant-form.ts | ✓ VERIFIED | Old text for stored rows, :50. |
| README.md, README.es.md | ✓ VERIFIED | Line 379 of each states the `Agent`/`Task` grant and the unapplied type list (594ea843). |
| Feature files and conformance tests | ✓ VERIFIED | As cited above; all in Gate G. |

## Key Link Verification

`query verify.key-links`: 3/3, 4/4, 3/3, 3/3, 3/3, 3/3 (19/19, every exit 0). Manual: `collectAgentFile -> readAgentFrontmatter -> parseFrontmatter` (A/discover.ts:157, A/frontmatter.ts:34, :184, :193); `convertAgent -> mapTools/mapModel -> toolsFields -> emitGeneratedAgentFrontmatter` (A/convert.ts:341, :493, :1207, A/frontmatter.ts:407). pi-subagents 0.88.1 reads the keys `allowNestedSubagents`, `excludeTools`, and `model` at `child-tool-plan.js:213-218` and `agent-management.js:966-971`. The README links point at `docs/mcp-compatibility.md#customizing-generated-agents`, a heading that exists at :403.

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Generated agent file | name, description, tools, excludeTools, allowNestedSubagents, model | Source agent file read at A/discover.ts:156-157, converted in A/convert.ts, emitted by A/frontmatter.ts | Yes; scenarios assert the staged bytes and pi-subagents' own reading | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR` and no services. Each gave `tests 1 / pass 1 / fail 0 / skipped 0`. IDs keep the numbering of the earlier reports.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| N4 | PG-AGENT-07a / D-PG7-17: the model written for a source inherit runs the child on the parent's model over subagents.defaultModel | test/integration/pi-subagents-child-launch-conformance.test.ts | PASS (this pass) |
| N10 | D-PG7-11: a source model of inherit gives the same file with and without --map-model | test/bridges/agents/convert.test.ts | PASS (this pass) |
| N15 | D-PG7-04 keeps an unparseable agent under its file name with one note | test/bridges/agents/discover.test.ts | PASS (this pass) |
| N21 | emits a description with the block header \| alone as a literal block | test/bridges/agents/frontmatter.test.ts | PASS (this pass) |
| G | `npm run check` at `421863f6` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

N2, N3, N6, N7, N8, N12, N18 and N20 passed in the previous pass (2026-11-17T02:44:19Z), and N1, N5, N9, N11, N13, N14, N16, N17, N19 and N22 in the pass before it. Their test files and the code they test did not change, and Gate G ran them again.

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and this is not a migration phase.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| PG-AGENT-05 | 07-01, 07-02, 07-03 | ✓ SATISFIED | Criteria 1, 2. REQUIREMENTS.md:42 `[x]`, trace :190 Complete |
| PG-AGENT-03 | 07-04, 07-05 | ✓ SATISFIED (accepted override on the no-tools `subagent get` wording) | Criterion 3. REQUIREMENTS.md:43 `[x]`, trace :191 Complete |
| PG-AGENT-07a | 07-04 | ✓ SATISFIED (the requirement text, "runs on the parent's model", is met; the roadmap wording is amended by locked D-PG7-17) | Criterion 4. REQUIREMENTS.md:41 `[x]`, trace :189 Complete |
| PG-AGENT-09 | 07-06 | ✓ SATISFIED | Criterion 5. REQUIREMENTS.md:44 `[x]`, trace :192 Complete |

No requirement is orphaned. REQUIREMENTS.md maps exactly these four IDs to Phase 7, and each appears in plan frontmatter. BACKLOG AGTEXCL-01 is closed (BACKLOG.md:4636). AGTREPAIRSET-01 (BACKLOG.md:5461) stays open as the tracked residual of the locked D-PG7-02 narrower trigger.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| Phase source files under `extensions/` and the four phase features | TBD / FIXME / XXX | None | No match (grep this pass) |
| The phase features | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- D-PG7-07 names `apply` convergence as a third rename path. No scenario shows it, as docs/mcp-compatibility.md:476 states. The 07-03 truth names only update and reinstall, which are covered.
- Residuals IN-01 (YAML tag warning on stderr, a Pi gap) and IN-04 (a lone-CR file skips the repair, docs/mcp-compatibility.md:458) stay documented.
- No citation moved since the previous report. The one cited line whose text changed is docs/mcp-compatibility.md:435 (ebcce31e), and it still states the empty `Model:` display that override 2 names.
- docs/mcp-compatibility.md:833 (outside this phase's must-haves) now points the workflow-tools question at BACKLOG AGTWORKFLOWAMBIENT-01 (BACKLOG.md:5465). That item concerns the D-PG8 `Workflow` grant, not a Phase 7 truth.

## Human Verification Required

None.

## Maintainer Review (resolved 2026-11-16)

The maintainer review of 2026-11-16 answered every item the previous report had listed here. No item stays open:

1. **D-PG7-04** (PROJECT.md:2412) is locked with parity kept. An agent whose frontmatter does not parse after the repair loads with every tool and one install note, as in Claude Code 2.1.323. The decision row records the conflict with the fail-closed preference as a settled trade-off.
2. **Overrides 1 and 2** (criterion 3 no-tools `subagent get` wording; criterion 4 `model: ""`) are accepted, and their `accepted_by` says so (567585d3). D-PG7-17 (PROJECT.md:2416) is locked and states that it amends criterion 4.
3. **Overrides 3 and 4** (D-PG7-17 for the 07-04 sentinel clause, D-PG7-18 for the 07-03 one-line-bytes truth) rest on decisions the review confirmed. The D-PG7-16 README override stays removed, because the READMEs state the grants (594ea843).
4. **D-PG7-02, D-PG7-07, D-PG7-10, D-PG7-18, and D-PG7-19** are confirmed and locked (PROJECT.md:2411, :2414, :2415, :2419).

## Gaps Summary

This pass found no gaps and no regressions. On the current tree, all five roadmap criteria and all 35 separate plan truths of Phase 7 hold. Since the previous report, only `docs/mcp-compatibility.md` changed among the covered files, through two docs-only commits (421863f6, ebcce31e) that removed pending-review wording and left every Phase 7 citation in place. No phase source file, feature or test changed, and Gate G at `421863f6` covers the executable inputs of HEAD. The four overrides stay as written and accepted by the maintainer review of 2026-11-16: override 1 rests on a pi-subagents display gap recorded in D-PG7-15, and overrides 2-4 on the locked decisions D-PG7-17 and D-PG7-18. The status stays `passed` at 40/40.

---

_Verified: 2026-11-17T03:45:31Z_
_Verifier: Claude (gsd-verifier)_
