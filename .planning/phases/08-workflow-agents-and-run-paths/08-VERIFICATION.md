---
phase: 08-workflow-agents-and-run-paths
verified: 2026-11-15T12:00:00Z
status: passed
score: 5/5 must-haves verified (4 verified, 1 passed by override pending maintainer review)
covered_files:
  - ".planning/phases/08-workflow-agents-and-run-paths/08-01-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-01-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-02-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-02-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-03-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-03-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-04-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-04-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-05-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-05-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-06-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-06-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-07-PLAN.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-07-SUMMARY.md"
  - ".planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md"
  - "README.es.md"
  - "README.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "docs/prd/parity-gaps-prd.md"
  - "docs/workflows-compatibility.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "features/agent/frontmatter.feature"
  - "features/step_definitions/project.steps.ts"
  - "features/workflow/agent-steps.feature"
  - "features/workflow/agent-types.feature"
  - "features/workflow/collisions.feature"
  - "features/workflow/run.feature"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/catalog-parser.test.ts"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-info.ts"
  - "test/orchestrators/plugin/discover-names.test.ts"
  - "test/orchestrators/plugin/info.test.ts"
covered_digest: "v4:sha256:2ed5a6d3ee5b46f61cd3f81368a2ec096253e4e44211b4f31e12a9ff7bd6b417"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "For a bridged agent whose source grants Workflow or Workflow(<name>), in a plugin that stages a workflow, subagent get shows the engine's workflow tool and the background launch mode; in a live run with a real pi-subagents child, the lead agent of a fixture plugin starts the plugin's workflow (criterion 5, PG-WF-05)"
    reason: "Upstream parity, option A of D-PG8-11 as amended (08-CONTEXT.md amendments, 08-05-SUMMARY.md). Claude Code gives the Workflow tool to no subagent: its sub-agents page lists Workflow among the tools removed from every subagent even when listed in the tools field, the 2.1.323 binary puts it in the always-denied set for every Agent-tool subagent, and claude-security's agent runs only as a session's main agent. Pi has no main-session agent mode, so granting it would be an unlicensed divergence; PG-WF-05 is not a gap and plan 08-06 (option B) is N/A (08-06-SUMMARY.md status skipped). Spike S5(a) showed the engine does work in a real pi-subagents background child (08-SPIKE-S5.md), so option B stays available if the maintainer licenses it. Delivered instead: the guard scenario 'An agent that grants Workflow gets no workflow tool, as Claude Code gives the tool to no subagent' (features/agent/frontmatter.feature:1300, subagent get shows `tools read` only, passed in this verification), the dropped-grant passage at docs/mcp-compatibility.md:386-391, and the README.md:27 / README.es.md sentence."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-15T12:00:00Z"
human_verification:
  - test: "Maintainer review of the criterion 5 override (option A of D-PG8-11 as amended: the Workflow grant of a bridged agent stays dropped; plan 08-06 not run)."
    expected: "Accept option A and amend ROADMAP criterion 5 and PG-WF-05 to the delivered wording, or choose option B with a divergence ID, which reopens plan 08-06."
    why_human: "Product decision accepted by the autonomous orchestrator, not the maintainer; every D-PG8 decision is recorded as pending maintainer review in 08-CONTEXT.md."
  - test: "Maintainer acceptance of T-08-13 (medium, open, nonblocking): engine 3.15.0 reads <project>/.pi/workflows/settings.json with no Pi project trust check, so a cloned repository can set providerMiddlewareExtensions and inheritMainModel (08-SECURITY.md:48, :68; docs/workflows-compatibility.md:242)."
    expected: "Accepted as an engine-owned residual, and the BACKLOG carrier line from 08-SECURITY.md:68 written at merge."
    why_human: "Risk acceptance belongs to the maintainer; below block_on high, so it does not block this phase."
  - test: "Maintainer review of the pending product decisions D-PG8-02, D-PG8-05 (missing-agent note wording and granularity), and D-PG8-14 as amended (ambient workflow/workflow_control tools of a background child of an agent with no tools list, a recorded residual)."
    expected: "Each confirmed or reopened."
    why_human: "Recorded as pending maintainer review in 08-CONTEXT.md."
---

# Phase 8: Workflow Agents and Run Paths Verification Report

**Phase Goal:** A plugin workflow runs the plugin's own agents, and an install says when a script names an agent the plugin does not have. An agent whose source lets it start a workflow can start it. The run paths with no scenario today get one, and the compatibility page says what a workflow subagent can reach.
**Verified:** 2026-11-15T12:00:00Z
**Status:** passed (one orchestrator override and the items under Human Verification await maintainer review, as in Phase 7)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | `agent("...", {agentType: "demo:helper"})` runs the plugin's agent `helper`; the run's agent shows the plugin agent's instructions (PG-WF-02a) | VERIFIED | Scenario "A workflow step that names an agent of its plugin runs on that agent's instructions" (`features/workflow/agent-types.feature`): model call 1 text is `Speak as the helper of demo.\n\nTask label: agent 1\n\nAnswer the task.`; companion scenario shows a missing type runs as `Act as workflow subagent type: demo:ghost`. Passed in this verification's run. |
| 2 | A plugin whose script names `demo:ghost` installs and prints one note per such name; the compatibility page no longer says an unresolved `agentType` is not an error in Claude Code (PG-WF-02b, c) | VERIFIED | `workflowAgentNotes` / `missingAgentNote` in `orchestrators/plugin/discover-names.ts:169-344`, wired into install (`install-outcome.ts:1256`), update/reinstall/apply (`update-swap.ts:1714`), and info (`info.ts` `previewWorkflowAgentNotes`). Scenarios in `agent-types.feature` cover install (2 notes, status installed), update, info, no note for own/foreign/generated-file names, the five-plus-count cap, and the 128-char count. `grep "not an error" docs/workflows-compatibility.md` = 0; row at line 129 states Claude Code 2.1.323 fails the step. Catalog state at `docs/output-catalog.md:3157`. |
| 3 | A scenario passes for each run path: model-started run by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, two scripts with one `meta.name` (PG-WF-07) | VERIFIED | `run.feature:66` (args object, result `who=Ada n=2`), `agent-steps.feature:128` (schema, `verdict=pass type=object`), `agent-steps.feature:96` (worktree: `linked worktree`, then `worktrees 2 branches 2`, title names the divergence), `run.feature:89` (sibling, `outer: inner got hi`), `collisions.feature:52` (one name fails the install, title names Claude Code's last-parse behavior). All passed in this verification's run. |
| 4 | The compatibility page says what a workflow subagent can reach, names `inheritMainModel` and `providerMiddlewareExtensions`, says Pi's built-in MCP cannot load in a subagent and plugin hooks do not run there, and states the adapter setting as S5 measured it (PG-WF-04) | VERIFIED | `docs/workflows-compatibility.md:210` section "What a workflow subagent can reach"; line 219 adapter row "The setting works (measured by spike S5 on 2026-11-14 ...)"; line 221 built-in MCP cannot load; line 222 plugin hooks do not run; line 224 model order with `inheritMainModel`; lines 237-246 settings example, D-PG8-09 (extension writes no engine setting), and the untrusted-settings warning. Fan-out paragraph corrected at line 168 (D-PG8-10). |
| 5 | A bridged agent granting `Workflow` / `Workflow(<name>)` gets the `workflow` tool and background launch; a real child's lead agent starts the plugin's workflow (PG-WF-05) | PASSED (override) | Override: option A of D-PG8-11 as amended; Claude Code gives Workflow to no subagent, Pi has no main-session agent mode, so the grant stays dropped and PG-WF-05 is not a gap; plan 08-06 N/A. Accepted by orchestrator (autonomous run, pending maintainer review) on 2026-11-15. Guard scenario `features/agent/frontmatter.feature:1300` pins `tools read` for `Read, Workflow, Workflow(demo:scan)`; passed in this run. |

**Score:** 5/5 truths verified (4 verified, 1 passed by override; 0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md` | S5 record | VERIFIED | Present; PRD section 9 S5 cell filled (`docs/prd/parity-gaps-prd.md:954`) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` | missing-agent note join | VERIFIED | Substantive (+208 lines), exported `workflowAgentNotes`, consumed by install, update-swap, info |
| `features/workflow/agent-types.feature` | PG-WF-02 scenarios | VERIFIED | 9 scenarios, all pass |
| `features/workflow/{run,agent-steps,collisions}.feature` | PG-WF-07 guard scenarios | VERIFIED | 5 new scenarios, all pass |
| `features/step_definitions/project.steps.ts` | git-repository step | VERIFIED | Used by the worktree scenario |
| `docs/workflows-compatibility.md` | agentType row, reach section, fan-out paragraph | VERIFIED | See truths 2 and 4 |
| `docs/output-catalog.md` + catalog-uat fixtures/tests | info-state row | VERIFIED | Row at line 3157; catalog tests pass |
| `features/agent/frontmatter.feature`, `docs/mcp-compatibility.md`, READMEs | option-A record | VERIFIED | Guard scenario and passage present |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `discover-names.ts` `discoverGeneratedNames` | `install-outcome.ts` discoveryWarnings | `generatedNames.workflowAgentNotes.map(discoveryWarning)` | WIRED |
| `discover-names.ts` | `update-swap.ts` stagingWarnings | same field | WIRED |
| `discover-names.ts` `workflowAgentNotes` | `info.ts` `previewWorkflowAgentNotes` | direct call, redacted | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| install/update diagnostic note lines | `workflowAgentNotes` | discovered agents x admitted scripts' literal `agentTypes` | Yes (scenarios show per-name lines) | FLOWING |
| info `plugin notes` | `previewWorkflowAgentNotes` | same join, recomputed per run | Yes (info scenario) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 8 scenarios (agent-types, run, agent-steps, collisions features, frontmatter:1300), adapter profile | `HOME=<scratch> node scripts/cucumber.mjs --profile adapter <files>` | 25 scenarios, 337 steps passed, exit 0 | PASS |
| Phase 8 unit and catalog tests | `HOME=<scratch> node --import $PWD/test/platform/isolated-pi-home.ts --test discover-names, info, catalog-uat contract/parser/wire` | 417 tests passed, exit 0 | PASS |
| Phase gate | recorded in 08-VALIDATION.md Gate Runs (`npm run check` at a78def62, exit 0, 1974/185 scenarios); `git diff --stat a78def62..HEAD` touches only 08-REVIEW.md and 08-VALIDATION.md | not re-run, per instructions | PASS (recorded) |

### Probe Execution

No probe scripts are declared by the phase. Spike S5 was a recorded, uncommitted probe (D-PG8-01); its record is the evidence.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| PG-WF-02 | 08-02, 08-07 | SATISFIED | Truths 1 and 2 |
| PG-WF-04 | 08-01, 08-04 | SATISFIED | Truth 4 |
| PG-WF-05 | 08-01, 08-05, 08-06 | SATISFIED by override | Truth 5; not a gap under option A (D-PG8-11) |
| PG-WF-07 | 08-03 | SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps exactly these four IDs to Phase 8. The traceability rows still read Pending; phase completion updates them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| changed source and step files | -- | TBD/FIXME/XXX/TODO/HACK | none found | -- |
| `docs/prd/parity-gaps-prd.md` | 676, 682 | WF-04/WF-05 requirement prose still says the adapter setting is unmeasured and engine-in-child unknown | Info | Historical requirement text; the S5 result cell (line 954) and the compatibility page carry the measured state |

08-REVIEW.md iteration 3: 0 critical, 0 warning, 2 info (documentation). T-08-13 is open and nonblocking (medium, below block_on high), pending maintainer acceptance: noted, not a gap.

### Human Verification Required

1. **Criterion 5 override (option A)** -- maintainer accepts or picks option B. See frontmatter.
2. **T-08-13 acceptance** -- untrusted project workflow settings, engine-owned residual.
3. **Pending D-PG8 product decisions** -- D-PG8-02, D-PG8-05, D-PG8-14 as amended.

These are maintainer reviews of recorded decisions, not open behavior checks. As in Phase 7, the status stays `passed` because every criterion holds or passes by override.

### Gaps Summary

None. Criteria 1 to 4 hold in code, scenarios, and docs, and their scenarios pass in this verification. Criterion 5 passes by an orchestrator override citing D-PG8-11 (option A, upstream parity), pending maintainer review.

---

_Verified: 2026-11-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
