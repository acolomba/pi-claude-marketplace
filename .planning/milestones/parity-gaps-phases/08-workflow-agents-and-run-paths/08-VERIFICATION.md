---
phase: 08-workflow-agents-and-run-paths
verified: 2026-11-17T03:49:14Z
status: passed
score: 48/48 must-haves verified (44 VERIFIED, 4 PASSED (override))
covered_files: [".planning/phases/08-workflow-agents-and-run-paths/08-01-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-01-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-02-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-02-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-03-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-03-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-04-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-04-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-05-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-05-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-06-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-06-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-07-PLAN.md",".planning/phases/08-workflow-agents-and-run-paths/08-07-SUMMARY.md",".planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md","CHANGELOG.md","README.es.md","README.md","docs/mcp-compatibility.md","docs/output-catalog.md","docs/prd/parity-gaps-prd.md","docs/workflows-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/workflows/discover.ts","extensions/pi-claude-marketplace/domain/name.ts","extensions/pi-claude-marketplace/domain/workflow-script.ts","extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","features/agent/frontmatter.feature","features/lib/hermetic-git.ts","features/step_definitions/project.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-steps.feature","features/workflow/agent-types.feature","features/workflow/collisions.feature","features/workflow/run.feature","test/architecture/catalog-uat/catalog-contract.test.ts","test/architecture/catalog-uat/catalog-parser.test.ts","test/architecture/catalog-uat/catalog-wire.test.ts","test/architecture/catalog-uat/fixtures/plugin-info.ts","test/bridges/workflows/discover.test.ts","test/domain/workflow-script.test.ts","test/integration/optional-peer-suite-versions.json","test/orchestrators/plugin/discover-names.test.ts","test/orchestrators/plugin/info.test.ts"]
covered_digest: "v4:sha256:c0b9ae1e009ed2f771315ca866e2a413dd038a4f4a7ea54b3ea57db66529bf2a"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "08-02 truth: installing a plugin whose workflow script names demo:ghost and demo:phantom prints one note for each name, `... the workflow engine runs a default agent in its place, where Claude Code stops the run`, and the plugin still installs"
    reason: "Changed in phase by the review fix WR-02 (08-REVIEW-FIX.md, commit 06d6013d), which the maintainer review of 2026-11-16 confirmed: the note now ends `where Claude Code fails the step` (missingAgentNote, orchestrators/plugin/discover-names.ts:170, and the count line at :193), because Claude Code 2.1.323 fails the one step (`agent()` throws `agent type '<x>' not found`) and its parallel() and pipeline() turn that throw into null, so the run does not always stop (docs/workflows-compatibility.md:129; D-PG8-04/05/06, PROJECT.md:2421, locked). Everything else in the truth holds as written: one note per name, the shared lead, and the plugin installs (features/workflow/agent-types.feature:18, two note lines and status installed). The scenario tables, the catalog state and the owner tests assert the new bytes, and the CHANGELOG entry now says Claude Code stops that step, not the run (594ea843). Not a regression."
    accepted_by: "in-phase review fix WR-02 (08-REVIEW-FIX.md); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:32:47Z"
  - must_have: "08-05 truth: the maintainer chose between option A and option B at a checkpoint that is not conditional on the spike; the choice, the decision ID, and the verdicts are in 08-05-SUMMARY.md"
    reason: "At the checkpoint the orchestrator of the autonomous run answered, not the maintainer: 08-05-SUMMARY.md:37 records `Answered by the orchestrator for the autonomous run, pending the maintainer's review`, which was the state when the summary was written. The maintainer review of 2026-11-16 then confirmed option A, and D-PG8-11..15 is locked (PROJECT.md:2424). The rest of the truth holds: the summary records option A, the decision ID (D-PG8-11 as amended), the four S5(a) verdict lines (08-SPIKE-S5.md:103-106), and the upstream evidence it was shown. Only the clause about who chose at the checkpoint differs from the truth as written."
    accepted_by: "project decision D-PG8-11 (PROJECT.md decision log, option A); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T07:32:47Z"
  - must_have: "08-07 truth: each pinned count of the catalog tests grows by exactly one state: 325 states in the contract test and in the parser test, and 325 emitted keys and 338 presented sources in the wire test; the section count and the module count stay at 22"
    reason: "Superseded by two Phase 10 decisions that added catalog states after this phase. D-PG10-06 (unset required options; commits 1618576f, 00a9f9c8 and the gaps-mcp merge 17d7bae4) added three states, and D-PG10-25 (as reversed by the maintainer review of 2026-11-16: unreadable recorded options fail closed with `{unreadable}`; commit 6d9a3cdd) added `reconcile-plugin-options-unreadable` (docs/output-catalog.md:4201). The pins now read 329 states and 55,844 bytes (catalog-contract.test.ts:21-22), 329 parsed tuples (catalog-parser.test.ts:73, :81), and 342 presented sources and 329 emitted keys (catalog-wire.test.ts:542, :752). The phase's own +1 state is intact (docs/output-catalog.md:3188, fixture plugin-info.ts:221), and the section and module counts are still 22 (catalog-contract.test.ts:19-20). The named contract test passes at 329 in this pass. The maintainer review of 2026-11-16 confirmed D-PG10-06 (PROJECT.md:2435) and reversed D-PG10-25 to fail closed (PROJECT.md:2441); both rows are settled, and the reversed D-PG10-25 is the one that adds the state."
    accepted_by: "project decisions D-PG10-06 and D-PG10-25 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-17T02:16:00Z"
  - must_have: "08-03 truth: two scripts of one plugin with one `meta.name` fail the whole install and leave no installed plugin and no declaration; the title says that Claude Code keeps the last script that parses (D-PG8-07 as measured)"
    reason: "Superseded by D-PG8-07 as changed by the maintainer review of 2026-11-16 (E5, commit b35b86d1): of two admitted scripts with one generated name, discovery keeps the last one in discovery order and drops the earlier one with no notice, as Claude Code 2.1.323 does, and WorkflowNameCollisionError is removed (no reference left in extensions/, features/ or test/). D-PG8-18 (maintainer decision 2026-11-16, commit 3488bf29, amends WNAM-06) adds that two different meta.names which the prefix elision would merge both install. The guard scenario still exists for this run path and now pins the new behavior: features/workflow/collisions.feature:53 `Of two workflow scripts with one name, a new session offers the last one, as in Claude Code` (a.js and b.js both `scan`; pi offers `/demo:scan | Scans second.`), and :81 pins D-PG8-18 (`/demo:demo-scan` and `/demo:scan`). Both ran green in Gate G. Roadmap criterion 3 asks only that a scenario passes for this path, so it holds as written. The 08-03 artifact pattern `Claude Code keeps` is gone from the feature for the same reason. Not a regression: a deliberate change to upstream parity."
    accepted_by: "project decision D-PG8-07 as changed for E5, with D-PG8-18 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-17T02:16:00Z"
re_verification:
  previous_status: passed
  previous_score: "48/48 (44 VERIFIED, 4 PASSED (override))"
  reason: "staleness: after the previous report (79f3c194, 2026-11-17T02:16:00Z), commit 421863f6 (docs: align decision wording with the maintainer review) changed two covered files, docs/mcp-compatibility.md and docs/prd/parity-gaps-prd.md. In docs/mcp-compatibility.md it dropped the `waits for maintainer review` and `pending maintainer review` wording of D-PG9-01 and D-PG9-16 (lines 142, 766-767, outside the phase) and rewrote the last sentence of the D-PG8-14 bullet (:833), which now ends `whether the converter should also exclude the two tools is tracked in BACKLOG AGTWORKFLOWAMBIENT-01` and names D-PG8-11..15. In docs/prd/parity-gaps-prd.md it rewrote the decision-14 sentence of WF-07 (:688) to say that of two scripts with one name the last one is installed and the install no longer fails (D-PG8-07). ebcce31e then changed one sentence of docs/mcp-compatibility.md:435 (the D-PG7-17 empty-model display, a Phase 7 passage). Every edit replaced lines in place, so no phase citation moved. No source, test, feature or other build input changed after 79f3c194."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_added: []
  overrides_updated:
    - "08-07 pinned catalog counts: the reason now says that the maintainer review confirmed D-PG10-06 and reversed D-PG10-25 to fail closed, where it said that both were locked; accepted_by and the pinned counts are unchanged"
  overrides_removed: []
  info_resolved:
    - "docs/prd/parity-gaps-prd.md:688 no longer says that two scripts with one name fail the whole install (421863f6)"
    - "docs/mcp-compatibility.md:833 no longer calls the workflow tools of a no-tools child an open question for the maintainer; it points at BACKLOG AGTWORKFLOWAMBIENT-01 (421863f6)"
human_verification: []
---

# Phase 8: Workflow Agents and Run Paths Verification Report

**Phase Goal:** A plugin workflow runs the plugin's own agents, and an install says when a script names an agent the plugin does not have. An agent whose source grants `Workflow` gets no workflow tool, as no Claude Code subagent does (D-PG8-11 option A, amended with criterion 5). The run paths with no scenario today get one, and the compatibility page says what a workflow subagent can reach.

**Verified:** 2026-11-17T03:49:14Z
**Status:** passed. All five roadmap criteria hold as written on the current tree. Of the 43 counted plan truths, 39 hold as written and 4 pass by override. The overrides cover the note suffix changed by review fix WR-02, the option A choice answered by the autonomous run at the checkpoint, the catalog pins raised by D-PG10-06 and D-PG10-25, and the two-scripts truth that D-PG8-07 changed to keep the last script. The maintainer review of 2026-11-16 confirmed each decision behind the overrides. No item waits for the maintainer.
**Re-verification:** Yes. The previous report (passed, 48/48, four overrides, commit 79f3c194) became stale, because commit 421863f6 changed the wording of two covered docs. No source, test or feature file changed, and the score, the status and the four overrides are unchanged.

## Verification Basis

This pass re-checked the roadmap criteria and plan must-haves that cite the changed docs against the current tree, `features/gaps` at `bb08f312`, and re-ran three named tests. The other verdicts rest on files that did not change after 79f3c194 (`git diff --name-only 79f3c194 HEAD` lists only planning Markdown and four docs). The earlier pass at `ed3193e7` re-checked every verdict. Summaries were not taken as evidence. For each truth that the changed files touch, the implementing code, its callers, and the scenario or test that exercises it were read again. Citations are current line numbers. **N/** means `extensions/pi-claude-marketplace/orchestrators/plugin/`, **T/** means `features/workflow/agent-types.feature`, and **W/** means `docs/workflows-compatibility.md`.

What changed since the previous report (79f3c194):

- 421863f6 rewrote the last sentence of the D-PG8-14 bullet at docs/mcp-compatibility.md:833. It used to end with "an open question for the maintainer". It now says that this extension does not remove the two tools, that a `Workflow` grant stays dropped (D-PG8-11..15), and that whether the converter should also exclude them is tracked in BACKLOG AGTWORKFLOWAMBIENT-01 (BACKLOG.md:5465). The measured facts of the 08-05 truth are unchanged: a no-tools background child is offered `workflow` and `workflow_control`, `disallowedTools: Workflow` does not remove them (D-PG8-14), and the bullet says it was measured by spike S5 on 2026-11-14 with Pi 1.5.0, pi-subagents 0.88.1 and engine 3.15.0. This matches D-PG8-11..15 as locked (PROJECT.md:2424).
- 421863f6 rewrote the decision-14 sentence at docs/prd/parity-gaps-prd.md:688. It now says that since 2026-11-16 the last of two scripts with one name is installed, as in Claude Code, and the install no longer fails (D-PG8-07), and that all symbolic links are still refused (D-14). This agrees with D-PG8-07 as changed for E5 (PROJECT.md:2422), with the decision row at :178, and with override 4. Lines :677, :683 and :955 did not change.
- 421863f6 also dropped the pending wording of D-PG9-01 and D-PG9-16 in docs/mcp-compatibility.md (:142, :766-767), and ebcce31e changed the D-PG7-17 sentence at :435. Neither passage is a Phase 8 citation. The D-PG8-11 passage at :415-422 is unchanged.
- 421863f6 changed ROADMAP.md only in the Phase 10 closeout line. Phase 8's goal and criteria did not change.

What the previous pass (at `ed3193e7`) recorded as changed since 328266f5:

- `domain/workflow-script.ts` lost `assertNoWorkflowNameCollisions` and gained `unelideClashingWorkflowNames` (:254) and `keepLastWorkflowPerName` (:327). `bridges/workflows/discover.ts:446` applies both to the discovered scripts, so install, update, reinstall, apply and `info` (through `discoverPluginWorkflows`, N/info.ts:1266) see the same kept scripts. `WorkflowNameCollisionError` is gone from `shared/errors.ts`, and no file under `extensions/`, `features/` or `test/` names it.
- `features/workflow/collisions.feature`: the scenario at :53 now pins keep-last, and the scenario at :81 pins D-PG8-18.
- W/ gained two rows of the naming table (:195-196) and the paragraph at :204, so the reach section moved down by four lines (:210 to :214).
- N/info.ts gained one import line for D-PG10-25, so its workflow-note sites moved down by one (:1159 to :1160, :1297 to :1298, :1317 to :1318). N/discover-names.ts, N/install-outcome.ts, N/update-swap.ts, `bridges/agents/convert.ts`, T/, `run.feature`, `agent-steps.feature`, `features/agent/frontmatter.feature` and the step files did not change.
- docs/mcp-compatibility.md gained a D-PG10-25 subsection at :632, so the D-PG8-14 bullet moved from :822 to :833. The D-PG8-11 passage at :415-422 did not move. README.md:27 and README.es.md:27 did not change; the README change of 594ea843 is at :379, outside the phase.
- docs/prd/parity-gaps-prd.md: WF-05 gained an amendment line (:677), and the WF-04 acceptance cell now says S5 measured the adapter setting (:683).
- CHANGELOG.md:39 now says that Claude Code stops that step, not the run (594ea843). :41-42 record the keep-last rule and D-PG8-18.

**Gate G (reused, not re-run):** `npm run check` exited 0 at `421863f6` (log `/tmp/pg-final2.log`, which the verifier read). The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 115283). This covers every phase scenario: the four workflow features, both collision scenarios, and the untagged guard scenario at features/agent/frontmatter.feature:1338. The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 836824). Direct coverage merged 376 LCOV records, and the log ends with `exit=0`. `git diff --name-only 421863f6 HEAD` lists seven phase VERIFICATION.md files and docs/mcp-compatibility.md (ebcce31e, one sentence at :435). Docs are not build inputs, so G covers every executable input of HEAD. The suite was not repeated. The previous gate, at `333784b7` (`/tmp/pg-final.log`, seeds 478645 and 413244), also passed.

**Independent checks (this pass):** three named tests, the `^PG-WF-02` set of discover-names.test.ts (23/23), the catalog contract test at 329 states (1/1), and the keep-last test of workflow-script.test.ts (1/1), run as below. All passed. **Independent checks (previous pass, ed3193e7):** 34 named tests, run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '<name>' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. All passed (see Behavioral Spot-Checks). `query verify.artifacts` gives 08-01 2/2, 08-02 3/3, 08-03 3/4, 08-04 1/1, 08-05 3/3, and 08-07 2/3. The 08-03 miss is the pattern `Claude Code keeps` in collisions.feature (override 4). The 08-07 miss is the pattern `EXPECTED_STATE_COUNT = 325` (override 3). 08-06 gives 0/4, which is expected, because every 08-06 artifact exists only under option B. `query verify.key-links` gives 2/2, 5/5, 3/3, 3/3, 3/3 and 3/3 for 08-01 to 08-05 and 08-07. 08-06 gives 3/4, and its one missing link is option-B only.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 8 must-haves |
| --- | --- | --- |
| Review fix WR-02 (06d6013d, 08-REVIEW-FIX.md, confirmed by the maintainer review 2026-11-16) | The missing-agent note ends `where Claude Code fails the step` (N/discover-names.ts:170). | The 08-02 truth that quotes `where Claude Code stops the run` does not hold literally. Override 1. Criterion 2 does not quote the suffix and holds as written. |
| Review fix WR-01 (9976a646, confirmed by the maintainer review 2026-11-16) | A count line with no note before it says the agent types were too long and what the engine does (N/discover-names.ts:179-195). | Additive to the 08-02 limit truth. Scenario T/:192. |
| Review fix WR-03 (f9ebd499, confirmed by the maintainer review 2026-11-16) | The restriction join keys only on the frontmatter `name`; the generated flat name gets no note of either kind. | Matches the 08-02 truth that the generated flat name gives no note. Scenario T/:135. |
| D-PG8-11 option A, ROADMAP amendment ace8c3e3 (confirmed by the maintainer review 2026-11-16) | Criterion 5, the goal sentence, and PG-WF-05 state the delivered behavior: the `Workflow` grant stays dropped. | Criterion 5 is VERIFIED as amended. The 08-06 truths (option B) are not counted. |
| D-PG8-07, changed for E5 by the maintainer review 2026-11-16 (b35b86d1) | Two scripts with one name keep the last one, with no notice; the whole-install failure and `WorkflowNameCollisionError` are gone. | The 08-03 truth that the install fails does not hold. Override 4. Criterion 3 still has its scenario (collisions.feature:53). |
| D-PG8-18 (maintainer decision 2026-11-16, 3488bf29, amends WNAM-06) | Two different `meta.name`s that the elision would merge both install; the prefixed script keeps its full name. | Additive. Scenario collisions.feature:81. |
| D-PG10-06 and D-PG10-25 (Phase 10) | Four more catalog states (three for unset required options, one for unreadable recorded options). | The 08-07 pins read 329/55,844/342/329. Override 3. The phase's own state is intact. |
| D-PG10-13/-15/-21/-23/-25 (Phase 10) | Plugin options passed to staging, and the info row gains the unset-option line after the workflow notes (N/info.ts:1182, :1194). | Additive. The note join, its wiring sites and its scenarios are unchanged. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| 1 | `agent("...", {agentType: "demo:helper"})` runs the plugin's agent `helper`: the run's agent shows the plugin agent's instructions (PG-WF-02) | ✓ VERIFIED | Scenario T/:208: model call 1 is the agent's body (`Speak as the helper of demo.`), not the step text alone. The bridge declares `<plugin>:<agent>` as the frontmatter name the engine's registry resolves (W/:129). 08-02-SUMMARY.md records the red mutation (`demo:nobody`). Folds 08-02 truth 7. In Gate G. |
| 2 | A plugin whose script names `demo:ghost`, with no such agent, installs and prints one note for each such name; the compatibility page no longer says an unresolved `agentType` is not an error in Claude Code (PG-WF-02) | ✓ VERIFIED | Join `workflowAgentNotes` (N/discover-names.ts:272-290), built once per discovery (:344) and spread at one site each in install (N/install-outcome.ts:1257) and update/reinstall/apply (N/update-swap.ts:1735). T/:18: two note lines (`demo:ghost`, `demo:phantom`), header `2 declared components have notes`, status `installed`. `grep -c "not an error" W/` = 0; the `agentType` row (W/:129) says Claude Code 2.1.323 fails the step. In Gate G. |
| 3 | A scenario passes for each run path: a model-started run by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts with one `meta.name` (PG-WF-07) | ✓ VERIFIED | `features/workflow/run.feature:66` (result `who=Ada n=2`), `features/workflow/agent-steps.feature:128` (`verdict=pass type=object`), `agent-steps.feature:96` (`linked worktree`, then `worktrees 2 branches 2`), `run.feature:89` (`outer: inner got hi`), `features/workflow/collisions.feature:53` (two scripts named `scan`; a new session offers `/demo:scan` with the second script's description, D-PG8-07 as changed). Folds 08-03 truth 1. All in Gate G. |
| 4 | The workflow compatibility page says what a workflow subagent can reach, names `inheritMainModel` and `providerMiddlewareExtensions`, says Pi's built-in MCP cannot load in a subagent and plugin hooks do not run there, and states the adapter setting as spike S5 measured it (PG-WF-04) | ✓ VERIFIED | Section W/:214; built-in MCP W/:225; plugin hooks W/:226; adapter setting `The setting works (measured by spike S5 on 2026-11-14, with Pi 1.5.0, engine 3.15.0, and pi-mcp-adapter 7.0.1)` W/:223; both settings named at W/:228 and :241-242. |
| 5 | For a bridged agent whose source grants `Workflow` or `Workflow(<name>)`, in a plugin that stages a workflow, `subagent get` shows no `workflow` tool and no forced launch mode, as Claude Code gives the Workflow tool to no subagent, and docs/mcp-compatibility.md says why (PG-WF-05, closed as not a gap under D-PG8-11 option A) | ✓ VERIFIED | Scenario features/agent/frontmatter.feature:1338: plugin `demo` stages the workflow `scan`, the agent `lead` lists `Read, Workflow, Workflow(demo:scan)`, and `subagent get` shows `tools read` and no launch-mode line. `TOOL_MAP` has no `Workflow` entry (`bridges/agents/convert.ts:94-104`). docs/mcp-compatibility.md:415-422 says why. 08-05-SUMMARY.md records the red mutation (a `Workflow` entry in `TOOL_MAP` shows `tools read, workflow`). Folds 08-05 truth 2. In Gate G. |

### Plan Truths (those that restate a criterion are folded into it; option-B truths are not counted)

| Plan | Truth (short) | Status | Current evidence |
|---|---|---|---|
| 08-01 | The record holds rows a1-a6 and b1-b5 with command, fixture, versions, exit status, deciding output, measured outcome (D-PG8-01) | ✓ VERIFIED | 08-SPIKE-S5.md (108 lines, unchanged): Environment :5-15, Fixture :17, Command :47-56, rows a1-a6 :64-74, b1-b5 :95-99, each with an outcome and the driver exit. |
| 08-01 | S5(a) in a real pi-subagents 0.88.1 background child with engine 3.15.0; verdict row is `background: false`; default call and no-tools agent are rows of their own | ✓ VERIFIED | Rows a4 (:70-71), a5 (:72-73), ambient and listed arms in every row; verdict lines :103-105. |
| 08-01 | The control launches the listed agent with `async: false` and records whether pi-subagents refuses and names `workflow` (D-PG8-13) | ✓ VERIFIED | Row a6 (:74) and verdict :106: refused, the text names `workflow`. |
| 08-01 | S5(b) with pi-mcp-adapter 7.0.1 in Pi `settings.json` and `providerMiddlewareExtensions` at `{agent dir}/workflows/settings.json`, beside a control with no settings file | ✓ VERIFIED | 08-SPIKE-S5.md:86, rows b1-b4 (:95-98), control b5 (:99), verdicts :107-108. |
| 08-01 | The record ends with verdict lines that 08-04 and 08-05 read (D-PG8-02) | ✓ VERIFIED | Verdicts :101-108; read by W/:223 (S5(b)) and docs/mcp-compatibility.md:833 (S5(a) no-tools). |
| 08-01 | The S5 Result cell of PRD section 9 holds the short form, date and versions | ✓ VERIFIED | docs/prd/parity-gaps-prd.md:955 (run 2026-11-14, engine 3.15.0, pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, Pi 1.5.0). |
| 08-01 | No source, test, feature, harness or script file changes; the probe ran outside the worktree in a hermetic fixture (D-PG8-16) | ✓ VERIFIED | `git log --name-only 0920efcb..507577f3`: only 08-SPIKE-S5.md and docs/prd/parity-gaps-prd.md. Fixture and HOME: 08-SPIKE-S5.md:19, :52-56. |
| 08-02 | Installing a plugin naming `demo:ghost` and `demo:phantom` prints one note per name with the quoted text, and the plugin installs | PASSED (override) | Text suffix changed by WR-02; see override 1. The rest holds (T/:18). |
| 08-02 | An update prints the same note, and `info` shows it, through the same join; the text has no tense (D-PG8-05) | ✓ VERIFIED | T/:50 (update, `updated; 1 declared component has a note`), T/:71 (`plugin notes` field, same bytes). `info` calls the exported join at N/info.ts:1318 through `previewWorkflowAgentNotes` (:1298-1325), called at :1160. |
| 08-02 | A note needs a `<plugin>:` string literal that equals no declared name of a discovered agent; a bare name, another plugin's name, the flat name, an existing nested name, an installed agent, a non-literal, and a skipped or refused script give none (D-PG8-04) | ✓ VERIFIED | `scriptAgentNotes` (N/discover-names.ts:211), `verdict.outcome === "named"` gate (:286). The 23 `^PG-WF-02` tests passed. T/:108 (no note for own, bare, and foreign names). |
| 08-02 | At most five notes per script, then a count line; a type over 128 characters is counted; every span goes through `forMessage` (D-PG8-05) | ✓ VERIFIED | `MISSING_AGENT_NOTE_LIMIT = 5`, `AGENT_TYPE_DISPLAY_LIMIT = 128` (N/discover-names.ts:135-136); `forMessage` at :152, :156. T/:161 (five and `2 more`), T/:192 (too long). |
| 08-02 | Recomputed at every install, update, reinstall, apply and `info`; never stored; never refuses; independent of loaded companions (D-PG8-04) | ✓ VERIFIED | `discoverGeneratedNames` (N/discover-names.ts:319) runs per call (N/install-outcome.ts:982, :1181; N/update-swap.ts:1527; reinstall and apply converge through `materialize-latest.ts`, which calls `swapPluginUpdate`). The join is pure and takes no soft-dependency input; the notes are mapped to `discoveryWarning` only. |
| 08-02 | Both kinds of workflow agent note travel through one member `workflowAgentNotes`; the PG-SEC-01 note keeps its text | ✓ VERIFIED | Both come out of `scriptAgentNotes` into `DiscoveredGeneratedNames.workflowAgentNotes` (:54). Named test `PG-WF-02: keeps both kinds of note of one script in the order the script names the types` (passed in the `^PG-WF-02` run). |
| 08-02 | A step naming a type the plugin does not install still runs to its end on the engine; a scenario pins it (D-PG8-06) | ✓ VERIFIED | T/:236: the run ends `completed` with the model's answer, and the model call holds `Act as workflow subagent type: demo:ghost`. In Gate G. |
| 08-02 | The `agentType` row says Claude Code 2.1.323 stops the step, the engine runs a default agent, the divergence is licensed by a Pi-side gap, names the note and its scenarios, and no longer says it is no error (D-PG8-06) | ✓ VERIFIED | W/:129: `D-PG8-06, a divergence licensed by a Pi-side gap`; Claude Code `fails the step: agent() throws ... not found`; the engine `runs a default agent`; cites `features/workflow/agent-types.feature` by scenario name. |
| 08-02 | The compatibility row lands in this plan, and every test and scenario runs in a hermetic home (D-PG8-16) | ✓ VERIFIED | `git log --name-only e652b1fa..0325a7ec` includes docs/workflows-compatibility.md; the cucumber world and `isolated-pi-home.ts` give each run a temporary home (Gate G). |
| 08-03 | The model's `workflow({name, args: {...}})` reaches the script as the object; the result uses two fields | ✓ VERIFIED | run.feature:66-87 (`who=Ada n=2`); step `the user prompts {string} and the model starts a workflow run` at features/step_definitions/workflow/runs.steps.ts:179. |
| 08-03 | A step with a `schema` returns an object: the result holds a field and the type `object` | ✓ VERIFIED | agent-steps.feature:128-145 (`verdict=pass type=object`). |
| 08-03 | `isolation: 'worktree'` runs in a linked worktree; a later step still finds it and its branch; the title names the divergence (D-PG8-07) | ✓ VERIFIED | agent-steps.feature:96 (title names Claude Code removing an unchanged worktree; E7 stays as recorded in D-PG8-07), tool results `linked worktree` and `worktrees 2 branches 2`. |
| 08-03 | A sibling call by the installed name returns the sibling's result; the names do not start with `<plugin>-` | ✓ VERIFIED | run.feature:89-110 (`inner`, `outer`; `outer: inner got hi`). |
| 08-03 | Two scripts with one `meta.name` fail the whole install, leave no plugin and no declaration; the title names Claude Code's last-parse behavior (D-PG8-07) | PASSED (override) | D-PG8-07 changed for E5: the last script is installed (collisions.feature:53), and D-PG8-18 keeps both elided names (:81). See override 4. |
| 08-03 | No production code changes; each scenario is a guard with a recorded mutation; none committed | ✓ VERIFIED | `git log --name-only d483f433..707e3527`: one step file and three feature files. Mutations at 08-03-SUMMARY.md:92, :98, :104, :110, :116. The rewritten collision scenario carries its own red check in the D-PG8-07 evidence (PROJECT.md:2422: it fails on the earlier code with the collision error). |
| 08-03 | The new step makes the project a git repository with one commit through the hermetic git and asserts it | ✓ VERIFIED | features/step_definitions/project.steps.ts:22-28: `runGit` (imported from `../lib/hermetic-git.ts`, :18) with the scenario home, then `rev-list --count HEAD` equals `1`. |
| 08-04 | The section says a workflow subagent has `read`, `bash`, `edit`, `write`, no MCP tools by default, no plugin hooks, no plugin skills except preloaded ones, and runs on the engine's tier or default model (D-PG8-08) | ✓ VERIFIED | W/:220 (four tools), :222 (no MCP by default), :226 (hooks), :227 (skills), :228 (model order). |
| 08-04 | It names both settings, the three files, the workflow home, and says built-in MCP cannot load (`builtin:mcp` fails every `agent()` call) | ✓ VERIFIED | W/:231-235 (three files), :237 (workflow home), :241-242 (both keys), :225 (`builtin:mcp`). |
| 08-04 | The adapter setting is stated as S5 measured it, with date and versions (D-PG8-02) | ✓ VERIFIED | W/:223. Key link to 08-SPIKE-S5.md:107 verified. |
| 08-04 | Each claim carries its evidence grade; the Claude Code column says session model and session MCP tools, and that hooks and plugin skills are documented for subagents (D-PG8-08) | ✓ VERIFIED | Grade legend W/:18 and the grades in each row of W/:220-229; Claude Code cells at :222, :226, :227, :228. |
| 08-04 | The page says the extension writes no engine setting, tells the user what to set, and says not to list this extension in `providerMiddlewareExtensions` (D-PG8-09) | ✓ VERIFIED | W/:248, :250. |
| 08-04 | The fan-out paragraph says `parallel()`/`pipeline()` never reject in 2.1.323 and the engine rejects on its non-recoverable class (D-PG8-10) | ✓ VERIFIED | W/:168. |
| 08-04 | No new engine request drafted; the summary lists the three PRD 8.4 requests (D-PG8-17) | ✓ VERIFIED | `git log --name-only e56d9386..a75956d6`: only W/. 08-04-SUMMARY.md:101 lists them; carrier BACKLOG.md:4583 (WFLENGINE-01). |
| 08-05 | The maintainer chose option A or B at a checkpoint; the summary records the choice, decision ID and S5(a) verdicts | PASSED (override) | The autonomous run's orchestrator answered at the checkpoint, and the maintainer review of 2026-11-16 confirmed option A; see override 2. |
| 08-05 | Option A: the agents text says the grant is dropped, Claude Code removes `Workflow` from every subagent, Pi has no main-session agent mode, commands and skills start workflows from the main session, and `tools: Workflow` alone still fails the install (AG-11) | ✓ VERIFIED | docs/mcp-compatibility.md:415-420 (one bullet each, AG-11 at :420); link to W/ `#what-a-workflow-subagent-can-reach` (:419). |
| 08-05 | Option A: the text states, as S5 measured it, that a background child of an agent with no `tools` list is offered `workflow`, and that `disallowedTools: Workflow` does not remove it (D-PG8-14) | ✓ VERIFIED | docs/mcp-compatibility.md:833 (`measured by spike S5 on 2026-11-14`; D-PG8-14). Re-read after 421863f6: the measured sentences are unchanged, and the residual now points at BACKLOG AGTWORKFLOWAMBIENT-01. |
| 08-05 | Option A: README.md and README.es.md say in one sentence each that the grant is dropped, and the sentences agree | ✓ VERIFIED | README.md:27, README.es.md:27. |
| 08-05 | Override candidate under option A: PG-WF-05 closes as not a gap; the orchestrator records the closure in REQUIREMENTS.md and ROADMAP.md | ✓ VERIFIED | REQUIREMENTS.md:51 and trace :196 (`Complete (not a gap, D-PG8-11)`); ROADMAP criterion 5 and the goal sentence amended (ace8c3e3). |
| 08-05 | Every scenario runs in the harness sandbox, and the docs land with the behavior (D-PG8-16) | ✓ VERIFIED | `git log --name-only 9871a256..a179ee04`: the scenario, the passage and both READMEs in one commit. |
| 08-06 | Applies only under option B; under option A it changes no file, and the summary says so | ✓ VERIFIED | 08-06-SUMMARY.md: `status: skipped`, `commits: 0`. `TOOL_MAP` holds no `Workflow` (convert.ts:94-104); no `D-PG8-12`/`D-PG8-13` in convert.ts. |
| 08-07 | docs/output-catalog.md holds one state `installed-with-workflow-missing-agent-note`, backed by a fixture whose bytes equal the documented bytes (D-PG8-06) | ✓ VERIFIED | docs/output-catalog.md:3188-3198; fixture test/architecture/catalog-uat/fixtures/plugin-info.ts:221; named test `catalog contract matches all 22 fixture modules to 329 exact documented states` (passed). |
| 08-07 | The note line holds, after the agent type, the text of the note scenarios; tenseless, and not called future tense (D-PG8-05) | ✓ VERIFIED | output-catalog.md:3197 equals the T/ suffix byte for byte (`..., where Claude Code fails the step`); `grep -c "future tense" docs/output-catalog.md` = 0. |
| 08-07 | The section says one `note:` line per pair, same text as install, folder as name only, the five-note limit and count line, severity `info` | ✓ VERIFIED | output-catalog.md:3186. |
| 08-07 | Each pinned count grows by exactly one: 325 / 325 / 338; section and module counts 22 | PASSED (override) | Raised to 329/342 by D-PG10-06 and D-PG10-25; see override 3. |
| 08-07 | The PG-SEC-01 note still has no catalog state | ✓ VERIFIED | No `catalog-state` for the restriction note in docs/output-catalog.md; 08-07-SUMMARY.md:95. |
| 08-07 | No production code or feature file changes; tests run in a hermetic home (D-PG8-16) | ✓ VERIFIED | `git log --name-only feeee98c..1eb23974`: the catalog and four catalog-uat files only. |

Not counted (option B not chosen, D-PG8-11): 08-05 truth 7 and 08-06 truths 2-9 (the conditional mapping, `Workflow(NAME)` handling, forced background launch, deny rule, live child run, stored forms, and option-B docs). None was built, as the option A record requires.

**Score:** 48/48 (44 VERIFIED, 4 PASSED (override); 0 present, behavior-unverified)

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `.planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md` | ✓ VERIFIED | 108 lines; rows and verdicts as above; versions match `test/integration/optional-peer-suite-versions.json` (`pi-subagents` 0.88.1). |
| `docs/prd/parity-gaps-prd.md` | ✓ VERIFIED | S5 cell :955; WF-05 amendment :677; decision-14 sentence :688 agrees with D-PG8-07 (421863f6). |
| N/discover-names.ts | ✓ VERIFIED | `workflowAgentNotes` exported (:272), consumed by install, update-swap and info. |
| `features/workflow/agent-types.feature` | ✓ VERIFIED | 9 scenarios (T/:18-236). |
| `features/workflow/{run,agent-steps}.feature`, `features/step_definitions/project.steps.ts` | ✓ VERIFIED | Four guard scenarios and the git step. |
| `features/workflow/collisions.feature` | ✓ VERIFIED (pattern by override 4) | Keep-last guard :53 and D-PG8-18 scenario :81; the 08-03 pattern `Claude Code keeps` is gone with the whole-install failure. |
| `docs/workflows-compatibility.md` | ✓ VERIFIED | `agentType` row :129, fan-out :168, naming rows :195-196 and paragraph :204, reach section :214-250. |
| `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`, READMEs | ✓ VERIFIED | Option-A guard :1338, passage :415-422 and :833, README.md:27, README.es.md:27. |
| `docs/output-catalog.md`, catalog-uat fixture and tests | ✓ VERIFIED (pins by override 3) | State :3188; contract pin `EXPECTED_STATE_COUNT = 329`. |
| 08-06 option-B artifacts | N/A | Option A chosen; absent by design. |

## Key Link Verification

`query verify.key-links`: 2/2, 5/5, 3/3, 3/3, 3/3, 3/3 (08-01 to 08-05, 08-07); 08-06 3/4 (option-B link only). Manual trace: `discoverGeneratedNames` (N/discover-names.ts:319) -> `workflowAgentNotes` (:344) -> `generatedNames.workflowAgentNotes.map(discoveryWarning)` at N/install-outcome.ts:1257 and N/update-swap.ts:1735; `previewWorkflowAgentNotes` (N/info.ts:1298) -> `workflowAgentNotes` (:1318) -> `redactAbsolutePaths` -> `notes` (:1176-1183). The join reads `verdict.agentTypes` of a named verdict only (:286) and escapes with `forMessage` imported from `domain/workflow-script.ts` (:32). Workflow discovery: `discoverPluginWorkflows` -> `keepLastWorkflowPerName(unelideClashingWorkflowNames(...))` (bridges/workflows/discover.ts:446), so the note join and every caller see the kept scripts only.

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| install/update diagnostic note lines | `workflowAgentNotes` | discovered agents x the kept scripts' literal `agentTypes` | Yes; T/:18, :50, :161 assert the lines | ✓ FLOWING |
| `info` `plugin notes` | `previewWorkflowAgentNotes` | the same join over the previewed agents and workflows | Yes; T/:71 and the catalog state | ✓ FLOWING |
| offered workflow commands | kept scripts after the D-PG8-18 and keep-last pass | `discoverPluginWorkflows` | Yes; collisions.feature:53, :81 list the offered commands in a new session | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each reported `fail 0`. N1, N3 and the first N5 test were run again in this pass, at `bb08f312`; the others are from the pass at `ed3193e7`, and their inputs have not changed since.

| ID | Named test (pattern) | File | Result |
| --- | --- | --- | --- |
| N1 | `^PG-WF-02` (every note, no-note, limit, escape, order and both-kinds case) | test/orchestrators/plugin/discover-names.test.ts | PASS (23/23) |
| N2 | NFR-10 / PG-SEC-01: an agents path that is absolute or escapes the plugin root is not read for notes | test/orchestrators/plugin/info.test.ts | PASS (1/1) |
| N3 | catalog contract matches all 22 fixture modules to 329 exact documented states | test/architecture/catalog-uat/catalog-contract.test.ts | PASS (1/1) |
| N4 | loadCatalogExamples parses all 329 independent catalog tuples | test/architecture/catalog-uat/catalog-parser.test.ts | PASS (1/1) |
| N5 | keeps only the last of two scripts that share one generated name; keeps the last claimant of each name and the order of the records it keeps | test/domain/workflow-script.test.ts | PASS (2/2) |
| N6 | the four `unelideClashingWorkflowNames` cases (full name on clash, repeat until no clash, identical meta names left to keep-last, full name over the cap) | test/domain/workflow-script.test.ts | PASS (4/4) |
| N7 | keeps the last script in file order when two files generate the same workflow name; keeps the full name of a prefixed script whose elided name another script declares (D-PG8-18) | test/bridges/workflows/discover.test.ts | PASS (2/2) |
| G | `npm run check` at `421863f6` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

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
| N/discover-names.ts, `domain/workflow-script.ts`, `bridges/workflows/discover.ts`, the four workflow features | TBD / FIXME / XXX / TODO / HACK | None | No match |
| The workflow features | `@skip` / `@wip` | None | No match |
| `extensions/`, `features/`, `test/` | `WorkflowNameCollision`, `assertNoWorkflowNameCollisions` | None | No match; the removed collision path left no orphan |

### Info (non-blocking)

- Resolved by 421863f6: `docs/prd/parity-gaps-prd.md:688` now says that the last of two scripts with one name is installed and the install no longer fails (D-PG8-07), in line with the decision table row 14 (:178).
- `.planning/BACKLOG.md:4583` (WFLENGINE-01) names the scenario "... still runs, where Claude Code stops the step". The scenario title is "... where Claude Code fails the step" (T/:236).
- Resolved by 421863f6: `docs/mcp-compatibility.md:833` no longer calls the workflow tools of a no-tools child an open question for the maintainer. It points at BACKLOG AGTWORKFLOWAMBIENT-01 (BACKLOG.md:5465), a backlog item, not a pending phase decision: D-PG8-11..15 is locked (PROJECT.md:2424).
- 08-03-SUMMARY.md (:112-:145) and 08-05-SUMMARY.md (:37, :102, :109) are records of their plans. They describe the collision scenario as it was and the decisions as pending, which was true when they were written. PROJECT.md now holds the locked decisions.
- The previous report noted that the goal sentence about starting a workflow was not amended. ROADMAP.md now states the goal in the delivered wording, so that item is resolved.

## Human Verification Required

None.

## Maintainer Review

Nothing waits for the maintainer. The maintainer review of 2026-11-16 settled every item that the previous report listed here:

1. **D-PG8-11..15, option A**: confirmed and locked (PROJECT.md:2424). Override 2 rests on it.
2. **Review fixes WR-01, WR-02 and WR-03**: confirmed. Override 1 rests on WR-02.
3. **T-08-13**: closed as accepted by the maintainer, with no engine request (08-SECURITY.md: `threats_open: 0`, `threats_open_nonblocking: 0`).
4. **D-PG8-04/05/06, D-PG8-08/09/10**: confirmed and locked (PROJECT.md:2421, :2423). **D-PG8-07**: locked with E5 changed to keep the last script (PROJECT.md:2422), and the maintainer added D-PG8-18 (PROJECT.md:2426). Override 4 rests on both.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria and all 43 counted plan truths of Phase 8 hold, and every citation points at a current line. Commit 421863f6 changed only wording in two covered docs. It aligned them with the locked decisions D-PG8-07 and D-PG8-11..15 and closed two of the Info items of the previous report.

The previous pass found that the maintainer review fixes touched the phase in three ways, and none breaks a criterion:

- D-PG8-07 now keeps the last of two scripts with one name, as Claude Code does, and D-PG8-18 keeps both names that the prefix elision would merge. Criterion 3 still has a passing scenario for this run path, which now pins the new behavior. The 08-03 truth that described the old whole-install failure passes by override 4.
- D-PG10-25 added one more catalog state, which raised the pinned catalog counts again. Override 3 now names both D-PG10-06 and D-PG10-25. The phase's own catalog state is unchanged.
- The CHANGELOG now says that Claude Code stops that step, not the run, which agrees with the note text of override 1.

The status stays `passed`, with 48/48: 44 VERIFIED and 4 PASSED (override).

---

_Verified: 2026-11-17T03:49:14Z_
_Verifier: Claude (gsd-verifier)_
