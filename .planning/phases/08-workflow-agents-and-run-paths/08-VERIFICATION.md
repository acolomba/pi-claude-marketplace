---
phase: 08-workflow-agents-and-run-paths
verified: 2026-11-16T07:32:47Z
status: passed
score: 48/48 must-haves verified (45 VERIFIED, 3 PASSED (override))
covered_files: [".planning/phases/08-workflow-agents-and-run-paths/08-01-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-01-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-02-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-02-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-03-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-03-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-04-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-04-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-05-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-05-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-06-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-06-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-07-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-07-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md","README.es.md","README.md","docs/mcp-compatibility.md","docs/output-catalog.md","docs/prd/parity-gaps-prd.md","docs/workflows-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/domain/workflow-script.ts","extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","features/agent/frontmatter.feature","features/lib/hermetic-git.ts","features/step_definitions/project.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-steps.feature","features/workflow/agent-types.feature","features/workflow/collisions.feature","features/workflow/run.feature","test/architecture/catalog-uat/catalog-contract.test.ts","test/architecture/catalog-uat/catalog-parser.test.ts","test/architecture/catalog-uat/catalog-wire.test.ts","test/architecture/catalog-uat/fixtures/plugin-info.ts","test/integration/optional-peer-suite-versions.json","test/orchestrators/plugin/discover-names.test.ts","test/orchestrators/plugin/info.test.ts"]
covered_digest: "v4:sha256:3dffad23128345147be75e45c26a620a1709c823c5077912aadfe8921c26fc0a"
behavior_unverified: 0
overrides_applied: 3
overrides:
  - must_have: "08-02 truth: installing a plugin whose workflow script names demo:ghost and demo:phantom prints one note for each name, `... the workflow engine runs a default agent in its place, where Claude Code stops the run`, and the plugin still installs"
    reason: "Changed in phase by the review fix WR-02 (08-REVIEW-FIX.md, commit 06d6013d, confirmed by the maintainer review 2026-11-16): the note now ends `where Claude Code fails the step` (missingAgentNote, orchestrators/plugin/discover-names.ts:169-171), because Claude Code 2.1.323 fails the one step (`agent()` throws `agent type '<x>' not found`) and its parallel() and pipeline() turn that throw into null, so the run does not always stop (docs/workflows-compatibility.md:129; the D-PG8-04/05/06 evidence column at PROJECT.md:2421 says Claude Code stops the step). Everything else in the truth holds as written: one note per name, the shared lead, and the plugin installs (features/workflow/agent-types.feature:18, two note lines and status installed). The scenario tables, the catalog state, and the owner tests all assert the new bytes. Not a regression: the clause held before 06d6013d and the change predates the previous report."
    accepted_by: "in-phase review fix WR-02 (08-REVIEW-FIX.md); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:32:47Z"
  - must_have: "08-05 truth: the maintainer chose between option A and option B at a checkpoint that is not conditional on the spike; the choice, the decision ID, and the verdicts are in 08-05-SUMMARY.md"
    reason: "The choice was made by the orchestrator of the autonomous run, not by the maintainer: 08-05-SUMMARY.md says `Answered by the orchestrator for the autonomous run, pending the maintainer's review`. The rest of the truth holds: the summary records option A, the decision ID (D-PG8-11 as amended, PROJECT.md:2424, status Pending maintainer review), the four S5(a) verdict lines (08-SPIKE-S5.md:103-106), and the upstream evidence it was shown. This is a maintainer-pending item, listed under Maintainer Review."
    accepted_by: "project decision D-PG8-11 (PROJECT.md decision log, option A); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:32:47Z"
  - must_have: "08-07 truth: each pinned count of the catalog tests grows by exactly one state: 325 states in the contract test and in the parser test, and 325 emitted keys and 338 presented sources in the wire test; the section count and the module count stay at 22"
    reason: "Superseded by Phase 10 decision D-PG10-06 (unset required options), whose commits 1618576f and 00a9f9c8 and the gaps-mcp merge 17d7bae4 added three more catalog states (partially-installed-inventory-options, failure-options-not-set, partially-available-with-unset-options). The pins now read 328 states and 55,557 bytes (catalog-contract.test.ts:21-22), 328 parsed tuples (catalog-parser.test.ts:73, :81), and 341 presented sources and 328 emitted keys (catalog-wire.test.ts:542, :752). The phase's own +1 state is intact (docs/output-catalog.md:3188, fixture plugin-info.ts:221), and the section and module counts are still 22 (catalog-contract.test.ts:19-20). The named contract and parser tests pass at 328 in this pass."
    accepted_by: "project decision D-PG10-06 (PROJECT.md decision log)"
    accepted_at: "2026-11-16T07:32:47Z"
re_verification:
  previous_status: passed
  previous_score: "5/5 (4 verified, 1 passed by override pending maintainer review)"
  reason: "staleness: Phases 9-11, the gaps-agents/gaps-mcp merges and later fixes changed 14 of the 22 covered non-planning files after the previous report (3a5eca92, 2026-11-15); 3 of them are phase source files (orchestrators/plugin/info.ts, install-outcome.ts, update-swap.ts), all by the additive plugin-options work of D-PG10-06/-13/-15/-21/-23. No phase 8 planning artifact changed."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "The previous score counted the five roadmap criteria only. This pass also checks the 55 plan truths. Nine are conditional on option B, which was not chosen (08-05 truth 7, 08-06 truths 2-9), and are not counted. Three restate a criterion and are folded into it (08-02 truth 7 into criterion 1, 08-03 truth 1 into criterion 3, 08-05 truth 2 into criterion 5). So the denominator is 5 + 43 = 48."
  status_correction: "The previous frontmatter set `passed` with three human_verification items. All three are maintainer decisions (the criterion 5 choice, T-08-13 acceptance, and the pending D-PG8 decisions), not tests a human must run. Following the precedent of the Phase 4, 6 and 7 re-verifications (cb5ee48c, 2b1ced72, 616af3c2), this report lists them under Maintainer Review and keeps human_verification empty."
  overrides_added:
    - "08-02 note text clause (review fix WR-02, confirmed by the maintainer review 2026-11-16)"
    - "08-05 maintainer-chose clause (D-PG8-11, confirmed by the maintainer review 2026-11-16)"
    - "08-07 pinned catalog counts (D-PG10-06)"
  overrides_removed:
    - "Criterion 5 (PG-WF-05). ROADMAP.md now states criterion 5 in the delivered wording (amended in ace8c3e3: `subagent get` shows no `workflow` tool and no forced launch mode, and docs/mcp-compatibility.md says why, PG-WF-05 closed as not a gap under D-PG8-11 option A). The current tree meets that wording as written, so the criterion is VERIFIED. The amendment itself stays a maintainer review item."
human_verification: []
---

# Phase 8: Workflow Agents and Run Paths Verification Report

**Phase Goal:** A plugin workflow runs the plugin's own agents, and an install says when a script names an agent the plugin does not have. An agent whose source lets it start a workflow can start it. The run paths with no scenario today get one, and the compatibility page says what a workflow subagent can reach.

**Verified:** 2026-11-16T07:32:47Z
**Status:** passed. All five roadmap criteria hold as written on the current tree. Of the 43 separate plan truths, 40 hold as written and 3 pass by override: the note suffix changed by review fix WR-02, the option A choice made by the autonomous run (D-PG8-11), and the catalog pins raised by D-PG10-06. The criterion 5 override of the previous report is removed, because ROADMAP.md now states that criterion in the delivered wording. The override items and the decisions under Maintainer Review wait for the maintainer.
**Re-verification:** Yes. The previous report (passed, 5/5, one override, commit 3a5eca92) became stale, because later work changed 14 of its 22 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `616af3c2`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its callers, and the scenario or test that exercises it were read again. Citations are current line numbers. **N/** means `extensions/pi-claude-marketplace/orchestrators/plugin/`, **T/** means `features/workflow/agent-types.feature`, and **W/** means `docs/workflows-compatibility.md`.

Since the previous report, three phase source files changed, each additively: N/install-outcome.ts, N/update-swap.ts (plugin options written into skill, command, agent and MCP staging, D-PG10-13/-15/-21/-23) and N/info.ts (the unset-option line, D-PG10-06). Each kept its one `workflowAgentNotes` site; the sites moved from :1256 to :1257 (install-outcome) and from :1714 to :1735 (update-swap). N/discover-names.ts, `domain/workflow-script.ts`, the four workflow feature files, `features/step_definitions/project.steps.ts` and W/ did not change (`git diff --stat 3a5eca92 HEAD`). The covered docs that changed (README.md, README.es.md, docs/mcp-compatibility.md, docs/output-catalog.md, docs/prd/parity-gaps-prd.md) gained text from later phases; the phase passages are intact and moved (mcp-compatibility.md :386-391 to :415-422; output-catalog.md :3157 to :3188; frontmatter.feature :1300 to :1338).

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). Then the unpaired and integration tests passed, with pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The real-child probes in the log record `piSubagents: 0.88.1` and children in mode `background`, state `complete`. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460), which covers every phase scenario (the four workflow features and the untagged guard scenario at features/agent/frontmatter.feature:1338). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387). Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 26 named tests, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '<name>' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. All passed (see Behavioral Spot-Checks). `query verify.artifacts` gives 08-01 2/2, 08-02 3/3, 08-03 4/4, 08-04 1/1, 08-05 3/3, 08-07 2/3 (the missing pattern `EXPECTED_STATE_COUNT = 325` is override 3); 08-06 0/4, which is expected, because every 08-06 artifact exists only under option B. `query verify.key-links` gives 2/2, 5/5, 3/3, 3/3, 3/3, 3/3 for 08-01 to 08-05 and 08-07, and 3/4 for 08-06 (its one missing link is option-B only). The per-plan commit ranges recorded in the summaries were listed with `git log --name-only` to check each plan's file scope.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 8 must-haves |
| --- | --- | --- |
| Review fix WR-02 (06d6013d, 08-REVIEW-FIX.md, confirmed by the maintainer review 2026-11-16) | The missing-agent note ends `where Claude Code fails the step` (N/discover-names.ts:169-171). | The 08-02 truth that quotes the note with `where Claude Code stops the run` no longer holds literally. New override 1. Criterion 2 is worded without the suffix and holds as written. |
| Review fix WR-01 (9976a646, confirmed by the maintainer review 2026-11-16) | A count line with no note before it says the agent types were too long and what the engine does (N/discover-names.ts:179-195). | Additive to the 08-02 limit truth. Scenario T/:192. |
| Review fix WR-03 (f9ebd499, confirmed by the maintainer review 2026-11-16) | The restriction join keys only on the frontmatter `name`; the generated flat name gets no note of either kind. | Matches the 08-02 truth that the generated flat name gives no note. Scenario T/:135; named test `gives no note for the generated flat name of an agent` (passed). |
| D-PG8-11 option A, ROADMAP amendment ace8c3e3 (pending maintainer review) | Criterion 5 and PG-WF-05 now state the delivered behavior: the `Workflow` grant stays dropped. | The previous criterion 5 override is removed; the criterion is VERIFIED as amended. The 08-06 truths (option B) are not counted. |
| D-PG10-06 (Phase 10) | Three more catalog states for unset required options. | The 08-07 pinned counts read 328/55,557/341/328. New override 3; the phase's own state is intact. |
| D-PG10-13/-15/-21/-23 (Phase 10) | Plugin options passed to staging in N/install-outcome.ts, N/update-swap.ts and `bridges/agents/convert.ts`; the info row gains the unset-option line after the workflow notes (N/info.ts:1181, :1193-1205). | Additive. The note join, its wiring sites and its scenarios are unchanged in substance. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| 1 | `agent("...", {agentType: "demo:helper"})` runs the plugin's agent `helper`: the run's agent shows the plugin agent's instructions (PG-WF-02) | ✓ VERIFIED | Scenario T/:208: model call 1 is `Speak as the helper of demo.\n\nTask label: agent 1\n\nAnswer the task.`; the agent's body, not the step text alone. The bridge declares `<plugin>:<agent>` as the frontmatter name the engine's registry resolves (W/:129). 08-02-SUMMARY.md records the red mutation (`demo:nobody`). Folds 08-02 truth 7. In Gate G. |
| 2 | A plugin whose script names `demo:ghost`, with no such agent, installs and prints one note for each such name; the compatibility page no longer says an unresolved `agentType` is not an error in Claude Code (PG-WF-02) | ✓ VERIFIED | Join `workflowAgentNotes` (N/discover-names.ts:272-290), built once per discovery (:344) and spread at one site each in install (N/install-outcome.ts:1257) and update/reinstall/apply (N/update-swap.ts:1735). T/:18: two note lines (`demo:ghost`, `demo:phantom`), header `2 declared components have notes`, status `installed`. `grep -c "not an error" W/` = 0; the `agentType` row (W/:129) says Claude Code 2.1.323 fails the step. In Gate G. |
| 3 | A scenario passes for each run path: a model-started run by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts with one `meta.name` (PG-WF-07) | ✓ VERIFIED | `features/workflow/run.feature:66` (result `who=Ada n=2`), `features/workflow/agent-steps.feature:128` (`verdict=pass type=object`), `agent-steps.feature:96` (`linked worktree`, then `worktrees 2 branches 2`), `run.feature:89` (`outer: inner got hi`), `features/workflow/collisions.feature:52` (install fails with the `"demo:scan" <- ["a.js", "b.js"]` collision). Folds 08-03 truth 1. All in Gate G. |
| 4 | The workflow compatibility page says what a workflow subagent can reach, names `inheritMainModel` and `providerMiddlewareExtensions`, says Pi's built-in MCP cannot load in a subagent and plugin hooks do not run there, and states the adapter setting as spike S5 measured it (PG-WF-04) | ✓ VERIFIED | Section W/:210; built-in MCP W/:221; plugin hooks W/:222; adapter setting `The setting works (measured by spike S5 on 2026-11-14, with Pi 1.5.0, engine 3.15.0, and pi-mcp-adapter 7.0.1)` W/:219; both settings named at W/:224, :237-238. |
| 5 | For a bridged agent whose source grants `Workflow` or `Workflow(<name>)`, in a plugin that stages a workflow, `subagent get` shows no `workflow` tool and no forced launch mode, as Claude Code gives the Workflow tool to no subagent, and docs/mcp-compatibility.md says why (PG-WF-05, closed as not a gap under D-PG8-11 option A) | ✓ VERIFIED | Scenario features/agent/frontmatter.feature:1338: plugin `demo` stages the workflow `scan` (:1348), the agent `lead` lists `Read, Workflow, Workflow(demo:scan)` (:1351), and `subagent get` shows `tools read` and no launch-mode line (:1365). `TOOL_MAP` has no `Workflow` entry (`bridges/agents/convert.ts:94-104`). docs/mcp-compatibility.md:415-422 says why. 08-05-SUMMARY.md records the red mutation (a `Workflow` entry in `TOOL_MAP` shows `tools read, workflow`). Folds 08-05 truth 2. In Gate G. Previous override removed (see frontmatter). |

### Plan Truths (those that restate a criterion are folded into it; option-B truths are not counted)

| Plan | Truth (short) | Status | Current evidence |
|---|---|---|---|
| 08-01 | The record holds rows a1-a6 and b1-b5 with command, fixture, versions, exit status, deciding output, measured outcome (D-PG8-01) | ✓ VERIFIED | 08-SPIKE-S5.md: Environment :5-15, Fixture :17, Command :47-56, rows a1-a6 :64-74, b1-b5 :95-99, each with an outcome and the driver exit. |
| 08-01 | S5(a) in a real pi-subagents 0.88.1 background child with engine 3.15.0; verdict row is `background: false`; default call and no-tools agent are rows of their own | ✓ VERIFIED | Rows a4 (blocking call, :70-71), a5 (default call, :72-73), ambient and listed arms in every row; verdict lines :103-105. |
| 08-01 | The control launches the listed agent with `async: false` and records whether pi-subagents refuses and names `workflow` (D-PG8-13) | ✓ VERIFIED | Row a6 (:74) and verdict :106: refused, the text names `workflow`. |
| 08-01 | S5(b) with pi-mcp-adapter 7.0.1 in Pi `settings.json` and `providerMiddlewareExtensions` at `{agent dir}/workflows/settings.json`, beside a control with no settings file | ✓ VERIFIED | 08-SPIKE-S5.md:86 (run b writes the file), rows b1-b4 (:95-98), control b5 (:99), verdicts :107-108. |
| 08-01 | The record ends with verdict lines that 08-04 and 08-05 read (D-PG8-02) | ✓ VERIFIED | Verdicts :101-108; read by W/:219 (S5(b)) and docs/mcp-compatibility.md:822 (S5(a) no-tools). S5(b) is positive, so the negative branch does not apply. |
| 08-01 | The S5 Result cell of PRD section 9 holds the short form, date and versions | ✓ VERIFIED | docs/prd/parity-gaps-prd.md:954 (run 2026-11-14, engine 3.15.0, pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, Pi 1.5.0; names the record's path). |
| 08-01 | No source, test, feature, harness or script file changes; the probe ran outside the worktree in a hermetic fixture (D-PG8-16) | ✓ VERIFIED | `git log --name-only 0920efcb..507577f3`: only 08-SPIKE-S5.md and docs/prd/parity-gaps-prd.md. Fixture and HOME: 08-SPIKE-S5.md:19, :52-56. |
| 08-02 | Installing a plugin naming `demo:ghost` and `demo:phantom` prints one note per name with the quoted text, and the plugin installs | PASSED (override) | Text suffix changed by WR-02; see override 1. The rest holds (T/:18). |
| 08-02 | An update prints the same note, and `info` shows it, through the same join; the text has no tense (D-PG8-05) | ✓ VERIFIED | T/:50 (update, `updated; 1 declared component has a note`), T/:71 (`plugin notes` field, same bytes). `info` calls the exported join at N/info.ts:1317 through `previewWorkflowAgentNotes` (:1297-1323), called at :1159. |
| 08-02 | A note needs a `<plugin>:` string literal that equals no declared name of a discovered agent; a bare name, another plugin's name, the flat name, an existing nested name, an installed agent, a non-literal, and a skipped or refused script give none (D-PG8-04) | ✓ VERIFIED | `scriptAgentNotes` (N/discover-names.ts:213-238), `verdict.outcome === "named"` gate (:286-288). Named tests `PG-WF-02 / D-PG8-04: gives no note for ...` (9 shapes) and `... notes ...` (4 shapes), all passed. T/:108 (no note for own, bare, and foreign names). |
| 08-02 | At most five notes per script, then a count line; a type over 128 characters is counted; every span goes through `forMessage` (D-PG8-05) | ✓ VERIFIED | `MISSING_AGENT_NOTE_LIMIT = 5`, `AGENT_TYPE_DISPLAY_LIMIT = 128` (N/discover-names.ts:135-136); `forMessage` at :152, :156. T/:161 (five and `2 more`), T/:192 (too long). Named tests for 6, 7, too-long, and escaping (passed). |
| 08-02 | Recomputed at every install, update, reinstall, apply and `info`; never stored; never refuses; independent of loaded companions (D-PG8-04) | ✓ VERIFIED | `discoverGeneratedNames` runs per call (N/install-outcome.ts:1181, N/update-swap.ts:1527; reinstall and apply converge through `materialize-latest.ts`, which calls `swapPluginUpdate`); the join is pure and takes no soft-dependency input (N/discover-names.ts:272-290); the notes are mapped to `discoveryWarning` only. |
| 08-02 | Both kinds of workflow agent note travel through one member `workflowAgentNotes`; the PG-SEC-01 note keeps its text | ✓ VERIFIED | `restrictionNote` and `missingAgentNote` both come out of `scriptAgentNotes` into `DiscoveredGeneratedNames.workflowAgentNotes` (:54). The PG-SEC-01 text was last changed in 91b0c917, before plan 08-02. Named test `PG-WF-02: keeps both kinds of note of one script in the order the script names the types` (passed). |
| 08-02 | A step naming a type the plugin does not install still runs to its end on the engine; a scenario pins it (D-PG8-06) | ✓ VERIFIED | T/:236: the run ends `completed` with the model's answer, and the model call holds `Act as workflow subagent type: demo:ghost` (review fix IN-02). In Gate G. |
| 08-02 | The `agentType` row says Claude Code 2.1.323 stops the step, the engine runs a default agent, the divergence is licensed by a Pi-side gap, names the note and its scenarios, and no longer says it is no error (D-PG8-06) | ✓ VERIFIED | W/:129: `D-PG8-06, a divergence licensed by a Pi-side gap`; Claude Code `fails the step: agent() throws ... not found`; the engine `runs a default agent`; cites `features/workflow/agent-types.feature` by scenario name. |
| 08-02 | The compatibility row lands in this plan, and every test and scenario runs in a hermetic home (D-PG8-16) | ✓ VERIFIED | `git log --name-only e652b1fa..0325a7ec` includes docs/workflows-compatibility.md; the cucumber world and `isolated-pi-home.ts` give each run a temporary home (Gate G). |
| 08-03 | The model's `workflow({name, args: {...}})` reaches the script as the object; the result uses two fields | ✓ VERIFIED | run.feature:66-87: `args.who` and `args.items.length` give `who=Ada n=2`; the step `the model starts a workflow run` is at features/step_definitions/workflow/runs.steps.ts:179. |
| 08-03 | A step with a `schema` returns an object: the result holds a field and the type `object` | ✓ VERIFIED | agent-steps.feature:128-145 (`verdict=pass type=object`). |
| 08-03 | `isolation: 'worktree'` runs in a linked worktree; a later step still finds it and its branch; the title names the divergence (D-PG8-07) | ✓ VERIFIED | agent-steps.feature:96 (title names Claude Code removing an unchanged worktree), tool results `linked worktree` and `worktrees 2 branches 2`. |
| 08-03 | A sibling call by the installed name returns the sibling's result; the names do not start with `<plugin>-` | ✓ VERIFIED | run.feature:89-110 (`inner`, `outer`; `outer: inner got hi`). |
| 08-03 | Two scripts with one `meta.name` fail the whole install, leave no plugin and no declaration; the title names Claude Code's last-parse behavior (D-PG8-07) | ✓ VERIFIED | collisions.feature:52-84: severity `error`, status `failed`, `declares no plugins`, `has no installed plugins`. |
| 08-03 | No production code changes; each scenario is a guard with a recorded mutation; none committed | ✓ VERIFIED | `git log --name-only d483f433..707e3527`: one step file and three feature files. Mutations at 08-03-SUMMARY.md:92, :98, :104, :110, :116. |
| 08-03 | The new step makes the project a git repository with one commit through the hermetic git and asserts it | ✓ VERIFIED | features/step_definitions/project.steps.ts:22-28: `runGit` (imported from `../lib/hermetic-git.ts`, :18) with `this.tokens.home`, then `rev-list --count HEAD` equals `1`. |
| 08-04 | The section says a workflow subagent has `read`, `bash`, `edit`, `write`, no MCP tools by default, no plugin hooks, no plugin skills except preloaded ones, and runs on the engine's tier or default model (D-PG8-08) | ✓ VERIFIED | W/:216 (four tools), :218 (no MCP by default), :222 (hooks), :223 (skills, preload D-CF4-04), :224 (model order). |
| 08-04 | It names both settings, the three files, the workflow home, and says built-in MCP cannot load (`builtin:mcp` fails every `agent()` call) | ✓ VERIFIED | W/:227-231 (three files), :233 (workflow home), :237-238 (both keys), :221 (`builtin:mcp` fails every `agent()` call). |
| 08-04 | The adapter setting is stated as S5 measured it, with date and versions (D-PG8-02) | ✓ VERIFIED | W/:219. Key link to 08-SPIKE-S5.md:107 verified. |
| 08-04 | Each claim carries its evidence grade; the Claude Code column says session model and session MCP tools, and that hooks and plugin skills are documented for subagents (D-PG8-08) | ✓ VERIFIED | Grade legend W/:18 and the grades in each row of W/:216-225; Claude Code cells at :218, :222, :223, :224. |
| 08-04 | The page says the extension writes no engine setting, tells the user what to set, and says not to list this extension in `providerMiddlewareExtensions` (D-PG8-09) | ✓ VERIFIED | W/:244, :246. |
| 08-04 | The fan-out paragraph says `parallel()`/`pipeline()` never reject in 2.1.323 and the engine rejects on its non-recoverable class (D-PG8-10) | ✓ VERIFIED | W/:168. |
| 08-04 | No new engine request drafted; the summary lists the three PRD 8.4 requests (D-PG8-17) | ✓ VERIFIED | `git log --name-only e56d9386..a75956d6`: only W/. 08-04-SUMMARY.md:101 lists them; carrier BACKLOG.md:4577 (WFLENGINE-01). |
| 08-05 | The maintainer chose option A or B at a checkpoint; the summary records the choice, decision ID and S5(a) verdicts | PASSED (override) | The autonomous run's orchestrator chose; see override 2. |
| 08-05 | Option A: the agents text says the grant is dropped, Claude Code removes `Workflow` from every subagent, Pi has no main-session agent mode, commands and skills start workflows from the main session, and `tools: Workflow` alone still fails the install (AG-11) | ✓ VERIFIED | docs/mcp-compatibility.md:415-420 (one bullet each, AG-11 at :420); links to W/ `#what-a-workflow-subagent-can-reach` (:419). |
| 08-05 | Option A: the text states, as S5 measured it, that a background child of an agent with no `tools` list is offered `workflow`, and that `disallowedTools: Workflow` does not remove it (D-PG8-14) | ✓ VERIFIED | docs/mcp-compatibility.md:822 (`measured by spike S5 on 2026-11-14`; D-PG8-14). |
| 08-05 | Option A: README.md and README.es.md say in one sentence each that the grant is dropped, and the sentences agree | ✓ VERIFIED | README.md:27, README.es.md:27. |
| 08-05 | Override candidate under option A: PG-WF-05 closes as not a gap; the orchestrator records the closure in REQUIREMENTS.md and ROADMAP.md | ✓ VERIFIED | REQUIREMENTS.md:51 (`closed as not a gap (D-PG8-11, option A)`), :196 (`Complete (not a gap, D-PG8-11)`); ROADMAP criterion 5 amended (ace8c3e3). |
| 08-05 | Every scenario runs in the harness sandbox, and the docs land with the behavior (D-PG8-16) | ✓ VERIFIED | `git log --name-only 9871a256..a179ee04`: the scenario, the passage and both READMEs in one commit. |
| 08-06 | Applies only under option B; under option A it changes no file, and the summary says so | ✓ VERIFIED | 08-06-SUMMARY.md: `status: skipped`, `commits: 0`, `No code, test or doc changed`. `TOOL_MAP` holds no `Workflow` (convert.ts:94-104); no `D-PG8-12`/`D-PG8-13` in convert.ts. |
| 08-07 | docs/output-catalog.md holds one state `installed-with-workflow-missing-agent-note`, backed by a fixture whose bytes equal the documented bytes (D-PG8-06) | ✓ VERIFIED | docs/output-catalog.md:3188-3198; fixture test/architecture/catalog-uat/fixtures/plugin-info.ts:221; named test `catalog contract matches all 22 fixture modules to 328 exact documented states` (passed). |
| 08-07 | The note line holds, after the agent type, the text of the note scenarios; tenseless, and not called future tense (D-PG8-05) | ✓ VERIFIED | output-catalog.md:3197 equals the T/ suffix byte for byte (`..., where Claude Code fails the step`); `grep -c "future tense" docs/output-catalog.md` = 0. |
| 08-07 | The section says one `note:` line per pair, same text as install, folder as name only, the five-note limit and count line, severity `info` | ✓ VERIFIED | output-catalog.md:3186. |
| 08-07 | Each pinned count grows by exactly one: 325 / 325 / 338; section and module counts 22 | PASSED (override) | Raised to 328/341 by D-PG10-06; see override 3. |
| 08-07 | The PG-SEC-01 note still has no catalog state | ✓ VERIFIED | No `catalog-state` for the restriction note in docs/output-catalog.md; 08-07-SUMMARY.md:95. |
| 08-07 | No production code or feature file changes; tests run in a hermetic home (D-PG8-16) | ✓ VERIFIED | `git log --name-only feeee98c..1eb23974`: the catalog and four catalog-uat files only. |

Not counted (option B not chosen, D-PG8-11): 08-05 truth 7 and 08-06 truths 2-9 (the conditional mapping, `Workflow(NAME)` handling, forced background launch, deny rule, live child run, stored forms, and option-B docs). None was built, as the option A record requires.

**Score:** 48/48 (45 VERIFIED, 3 PASSED (override); 0 present, behavior-unverified)

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `.planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md` | ✓ VERIFIED | 108 lines; rows and verdicts as above; versions match `test/integration/optional-peer-suite-versions.json` (`pi-subagents` 0.88.1). |
| `docs/prd/parity-gaps-prd.md` | ✓ VERIFIED | S5 cell :954. |
| N/discover-names.ts | ✓ VERIFIED | `workflowAgentNotes` exported (:272), consumed by install, update-swap and info. |
| `features/workflow/agent-types.feature` | ✓ VERIFIED | 9 scenarios (T/:18-236). |
| `features/workflow/{run,agent-steps,collisions}.feature`, `features/step_definitions/project.steps.ts` | ✓ VERIFIED | Five guard scenarios and the git step. |
| `docs/workflows-compatibility.md` | ✓ VERIFIED | `agentType` row :129, fan-out :168, reach section :210-246. |
| `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`, READMEs | ✓ VERIFIED | Option-A guard :1338, passage :415-422 and :822, README.md:27, README.es.md:27. |
| `docs/output-catalog.md`, catalog-uat fixture and tests | ✓ VERIFIED (pins by override 3) | State :3188; contract pin `EXPECTED_STATE_COUNT = 328` (D-PG10-06). |
| 08-06 option-B artifacts | N/A | Option A chosen; absent by design. |

## Key Link Verification

`query verify.key-links`: 2/2, 5/5, 3/3, 3/3, 3/3, 3/3 (08-01 to 08-05, 08-07); 08-06 3/4 (option-B link only). Manual trace: `discoverGeneratedNames` (N/discover-names.ts:319) -> `workflowAgentNotes` (:344) -> `generatedNames.workflowAgentNotes.map(discoveryWarning)` at N/install-outcome.ts:1257 and N/update-swap.ts:1735; `previewWorkflowAgentNotes` (N/info.ts:1297) -> `workflowAgentNotes` (:1317) -> `redactAbsolutePaths` -> `notes` (:1175-1182). The join reads `verdict.agentTypes` of a named verdict only (:286-288) and escapes with `forMessage` imported from `domain/workflow-script.ts` (:32).

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| install/update diagnostic note lines | `workflowAgentNotes` | discovered agents x admitted scripts' literal `agentTypes` | Yes; T/:18, :50, :161 assert the lines | ✓ FLOWING |
| `info` `plugin notes` | `previewWorkflowAgentNotes` | the same join over the previewed agents and workflows | Yes; T/:71 and the catalog state | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each reported `fail 0`.

| ID | Named test (pattern) | File | Result |
| --- | --- | --- | --- |
| N1 | PG-WF-02: notes a workflow script that runs an agent type the plugin does not install | test/orchestrators/plugin/discover-names.test.ts | PASS (1/1) |
| N2 | PG-WF-02 / D-PG8-05: counts an agent type longer than 128 characters instead of printing it | same | PASS (1/1) |
| N3 | PG-WF-02: keeps both kinds of note of one script in the order the script names the types | same | PASS (1/1) |
| N4 | PG-WF-02: escapes control and format characters in the file name and the agent type of a note | same | PASS (1/1) |
| N5 | PG-WF-02: gives one note per distinct script and missing agent type pair, in script order | same | PASS (1/1) |
| N6 | `^PG-WF-02 / D-PG8-0[45]: ` (4 note shapes, 9 no-note shapes, 5 limit cases) | same | PASS (18/18) |
| N7 | NFR-10 / PG-SEC-01: an agents path that is absolute or escapes the plugin root is not read for notes | test/orchestrators/plugin/info.test.ts | PASS (1/1) |
| N8 | catalog contract matches all 22 fixture modules to 328 exact documented states | test/architecture/catalog-uat/catalog-contract.test.ts | PASS (1/1) |
| N9 | loadCatalogExamples parses all 328 independent catalog tuples | test/architecture/catalog-uat/catalog-parser.test.ts | PASS (1/1) |
| G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and this is not a migration phase. Spike S5 was a recorded, uncommitted probe (D-PG8-01); its record is the evidence.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| PG-WF-02 | 08-02, 08-07 | ✓ SATISFIED | Criteria 1, 2. REQUIREMENTS.md:49 `[x]`, trace :194 Complete |
| PG-WF-04 | 08-01, 08-04 | ✓ SATISFIED | Criterion 4. REQUIREMENTS.md:50 `[x]`, trace :195 Complete |
| PG-WF-05 | 08-01, 08-05, 08-06 | ✓ SATISFIED (closed as not a gap, D-PG8-11) | Criterion 5. REQUIREMENTS.md:51 `[x]` with the closure note, trace :196 |
| PG-WF-07 | 08-03 | ✓ SATISFIED | Criterion 3. REQUIREMENTS.md:52 `[x]`, trace :197 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 8, and each appears in plan frontmatter.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| N/discover-names.ts, project.steps.ts, the four workflow features, W/ | TBD / FIXME / XXX / TODO / HACK | None | No match |
| The phase features and frontmatter.feature | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- **Goal text (advisory).** The phase goal's second sentence, "An agent whose source lets it start a workflow can start it", was not amended with criterion 5 (ace8c3e3). Under option A no bridged agent can start a workflow, as no Claude Code subagent can. The criterion is the contract and holds; the goal sentence should be amended with it or dropped when the maintainer settles D-PG8-11.
- `docs/prd/parity-gaps-prd.md:676` (WF-05 notes: engine-in-child unknown) and :682 (WF-04 acceptance: adapter setting unmeasured) are still the requirement prose from before S5. The S5 cell (:954) and the compatibility page carry the measured state. Unchanged from the previous report.
- The BACKLOG carrier for T-08-13 that the previous report asked to be written at merge now exists (BACKLOG.md:4584, under WFLENGINE-01). The ambient-tools residual of D-PG8-14 is AGTWORKFLOWAMBIENT-01 (BACKLOG.md:5459).
- The previous report cited N/install-outcome.ts:1256, N/update-swap.ts:1714, docs/mcp-compatibility.md:386-391, docs/output-catalog.md:3157 and features/agent/frontmatter.feature:1300. Later additions moved them to the lines above; the content is the same.

## Human Verification Required

None. The items the previous report listed here are maintainer decisions, not tests; they are listed under Maintainer Review.

## Maintainer Review

These items wait for the maintainer. None is a gap:

1. **D-PG8-11..15, option A** (PROJECT.md:2424): the autonomous run kept the `Workflow` grant dropped and amended criterion 5 and PG-WF-05 to match (ace8c3e3). Accept, or choose option B with a divergence ID, which reopens plan 08-06. Override 2 depends on this. If accepted, also amend the goal sentence noted under Info.
2. **Override 1, review fix WR-02**: the note suffix `where Claude Code fails the step`. WR-01 and WR-03 (count-line wording, flat-name keying) are pending too (08-REVIEW-FIX.md).
3. **T-08-13** (medium, open, nonblocking; 08-SECURITY.md:48, :68): engine 3.15.0 reads `<project>/.pi/workflows/settings.json` with no Pi project trust check. Accept as an engine-owned residual (carrier BACKLOG.md:4584).
4. **Pending decisions**: D-PG8-04/05/06 (note rule, limits, wording; PROJECT.md:2421), D-PG8-07 (guard scenarios; :2422), D-PG8-08/09/10 (reach section; :2423), and D-PG8-14 as amended (ambient `workflow`/`workflow_control` in a no-tools child, AGTWORKFLOWAMBIENT-01).

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and all 43 counted plan truths of Phase 8 hold, and every citation points at a current line. Later work touched the phase in two ways, and neither breaks a must-have:

- Phase 10 added plugin options to the install, update and info paths. Each path still adds the workflow agent notes at its one site, and the note join did not change.
- D-PG10-06 added three catalog states, which raised the pinned catalog counts. The phase's own catalog state is unchanged.

Checking plan truths one by one found three that do not hold as written, and none is a regression. The in-phase review fix WR-02 changed the note's last words. The autonomous run, not the maintainer, chose option A. D-PG10-06 raised the catalog pins. Each now passes by override. The criterion 5 override is removed, because ROADMAP.md now states the delivered behavior. The status stays `passed`. The score moves from 5/5 to 48/48, because this pass also counts the plan truths.

---

_Verified: 2026-11-16T07:32:47Z_
_Verifier: Claude (gsd-verifier)_
