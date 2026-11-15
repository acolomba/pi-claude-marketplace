---
phase: 08-workflow-agents-and-run-paths
iteration: 1
reviewed: 2026-11-15T05:32:14Z
depth: deep
diff_base: d0898ebd
diff_head: f7360834
files_reviewed: 22
files_reviewed_list:
  - README.es.md
  - README.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - docs/prd/parity-gaps-prd.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/agent/frontmatter.feature
  - features/step_definitions/project.steps.ts
  - features/workflow/agent-steps.feature
  - features/workflow/agent-types.feature
  - features/workflow/collisions.feature
  - features/workflow/run.feature
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixtures/plugin-info.ts
  - test/orchestrators/plugin/discover-names.test.ts
  - test/orchestrators/plugin/info.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-11-15T05:32:14Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Scope: `git diff --name-only d0898ebd..f7360834`, with `.planning/` left out. The intent comes from 08-CONTEXT.md (and its research amendments), 08-SPIKE-S5.md, and the plan SUMMARYs. I checked the docs claims against the installed engine 3.15.0 source (`node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src`) and the Claude Code 2.1.323 binary.

The code change is small and sound in its main path. Install, update (and so reinstall and apply), and `info` all reach `workflowAgentNotes` through one join. The 5/128 limits hold. The restriction note and the missing note cannot both fire for one type. The tests that were renamed still compile, and `test/orchestrators/plugin/discover-names.test.ts` passes (46/46, run in a temporary HOME). The git step and the five guard scenarios are hermetic: `runGit` and the harness Pi both set `GIT_CONFIG_NOSYSTEM=1` and a sandbox `GIT_CONFIG_GLOBAL`, and the engine writes its worktree under `<project>/.pi/worktrees/`, which the next reset clears.

Problems found:
- One false security claim in the new "What a workflow subagent can reach" section.
- The count line reads wrong when no note is printed.
- The note overstates what Claude Code does.
- The restriction join still keys on the generated flat name, which this phase showed the engine never resolves.
- The model-precedence row has the wrong order.

Necessity rubric read. No necessity findings: the one candidate is the containment re-check in `previewWorkflowAgentNotes`. It is code from before this phase, and it guards a filesystem trust boundary.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Docs say the engine applies Pi project trust to the in-repo workflow settings file; engine 3.15.0 reads it unconditionally

**File:** `docs/workflows-compatibility.md:242`
**Issue:** The page says "A project can carry the second file ... The engine applies Pi's project trust to that file. In the words of its README, 'project resources still require Pi project trust'." Engine 3.15.0 does not check trust here:
- `src/workflow-settings.ts:122-133` (`loadWorkflowSettings`) merges `<cwd>/.pi/workflows/settings.json` with no trust check.
- Its callers (`src/pi-extension.ts:95`, `src/workflow-tool.ts:488`, and others) pass only `{ cwd }`.
- The README sentence quoted (README.md:253) is about project-scoped *extension resources* in the allowlist match. It is not about the settings file.

So any repository a user opens can set `providerMiddlewareExtensions`, which loads any enabled user extension into every workflow subagent, and `inheritMainModel`. Pi trust does not stop it. The page states the opposite. This is a false claim about a trust boundary, in a doc that this phase ships as the PG-WF-04 deliverable. Users will rely on it.
**Fix:** Replace the two sentences with the measured behavior, graded "source-read at 3.15.0, `src/workflow-settings.ts`". For example: "The engine reads this file whether or not the project is trusted, so a repository can opt its workflow subagents into any extension that the user's Pi settings enable. Pi project trust applies only to extensions that the project's own settings declare." If the page should warn about this, add one line that tells users to check `.pi/workflows/settings.json` in a repository they did not write.

## Warnings

### WR-01: The count line says "N more" when no note came before it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:175-179, 207-220`
**Issue:** `missingAgentCountLine` always says "runs N more agent type(s) that this plugin does not install". A type longer than 128 characters is counted but never shown (line 211). Take a script whose only missing types are all over 128 characters: `shown === 0` and `missing > 0`, so the user sees only `workflow script "scan.js" in "workflows" runs 1 more agent type that this plugin does not install`. "More" than what? The line also gives no reason the type was not named, and it drops the consequence clause ("the workflow engine runs a default agent in its place..."). So the only line the user gets does not say why it matters. The owner tests (`discover-names.test.ts:740-790`) cover only cases where at least one note was shown.
**Fix:** Branch the wording on `shown`. When `shown === 0`, print for example `runs N agent type(s) that this plugin does not install; the workflow engine runs a default agent in place of each, where Claude Code fails the step`. Add an owner case with one 129-character type and nothing else.

### WR-02: The note says "where Claude Code stops the run". Upstream throws from `agent()`, and the fan-out helpers turn the throw into `null`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:171-173` (also `docs/output-catalog.md:3170`, `features/workflow/agent-types.feature` note rows)
**Issue:** In the 2.1.323 binary, `agent({agentType})` throws `agent type '<x>' not found` inside `agent()`. This phase's own doc paragraph (`docs/workflows-compatibility.md`, the D-PG8-10 text) records that Claude Code's `parallel()` and `pipeline()` run through `Promise.allSettled` and turn a thrown thunk into `null`: "the call itself never rejects". The PRD counts 6 of 7 official scripts as fanning out with `.filter(Boolean)`. For those scripts, Claude Code drops the step and the run goes on. The note's "stops the run" is false for the common case. It also disagrees with the `agentType` row (`docs/workflows-compatibility.md:129`, "stops the step") and with the scenario title (`agent-types.feature:194`, "where Claude Code stops the step"). Upstream parity is the reference, so the note must not overstate it.
**Fix:** Change the clause to "where Claude Code fails the step", and update the catalog state, the catalog-uat fixture, the scenario tables, and the owner-test helper together. The text has no tense, so one constant covers install and `info`.

### WR-03: The restriction join still keys on the generated flat name, which the engine never resolves, so a flat-name step gets a false restriction note

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:104-126` (`restrictedAgentTools`), `:200-216`
**Issue:**
- This phase established, in D-PG8-04 (resolved) and in the `agentType` row of the docs, that "the engine resolves only that `name`, never an alias".
- Engine 3.15.0 `src/agent-registry.ts` builds the key from frontmatter `name` and uses the file name only when `name` is absent. The bridge always writes `name: <plugin>:<agent>`.
- Yet `restrictedAgentTools` still maps `agent.generatedName` (`pi-claude-marketplace-<plugin>-<agent>`), and its comment says the engine resolves that name.

So a script that calls `agent(..., {agentType: "pi-claude-marketplace-demo-reader"})` gets a PG-SEC-01 note saying it "runs agent type ... which restricts its tools ... the agent may use bash, edit, and write". In fact the engine logs `unknown agentType` and runs a default agent (`src/workflow.ts:1119-1120`). The missing-agent join then skips the flat name on purpose (the doc comment at lines 240-248 and the test "the generated flat name of an agent"). The user gets a wrong note, or no note when the agent declares no restriction. Claude Code would fail this step: the flat name is not an agent type there either.
**Fix:** Drop the `[agent.generatedName, unkept]` entry from `restrictedAgentTools` and fix its doc comment. Then decide, with a test, whether an exact generated flat name of one of the plugin's own agents (`generatedAgentName(plugin, ...)` membership) gets the missing-agent note. It is in the plugin's namespace in substance, and the engine runs a default agent for it. At minimum, record the residual in the `agentType` row.

### WR-04: The model-precedence row has the wrong order and leaves out `meta.model`

**File:** `docs/workflows-compatibility.md:224`
**Issue:** The row says the engine takes "a `model` that the call, the agent type, or the phase names; the step's `tier`; the session's main model ...; the engine's `medium` tier; Pi's default model". Engine 3.15.0 does it differently:
- A phase model comes after `tier`. `src/workflow.ts:1123-1127` says "explicit agentOptions.model > agentType.model > tier > phase model", and when a tier is set it passes `undefined` so the tier decides.
- `src/workflow-capability-contract.ts:330` puts a metadata (`meta.model`) model between the phase model and the inherited main model.
- The `medium` tier applies only when a model-tiers config exists (`src/agent.ts:232-237, 259-262`).

A script author who reads the row would expect `phase("x", {model})` to beat `tier`. It does not.
**Fix:** List the engine's order: call `model` or agent-type `model` > `tier` > phase model > `meta.model` > the inherited main model (with `inheritMainModel`) > the `medium` tier (only with a model-tiers config) > the session default. Cite `src/workflow.ts` and `src/workflow-capability-contract.ts`.

## Info

### IN-01: The install header counts the count line as one "declared component"

**File:** `features/workflow/agent-types.feature` (the seven-type scenario); counting in `orchestrators/plugin/staging-diagnostics.ts`
**Issue:** Seven missing agent types in one script give the header "6 declared components have notes": five notes plus one count line. The counting rule was there before this phase, but the aggregate line makes the number match neither the script count (1) nor the type count (7).
**Fix:** Count notes per script for the header, or leave the count line out of the tally. If the current rule is kept on purpose, record it in the catalog.

### IN-02: The "still runs" scenario never shows that a default agent ran

**File:** `features/workflow/agent-types.feature:194-220`
**Issue:** The scenario installs `helper.md` with the distinctive body "Speak as the helper of demo." and then checks only the run status, the result, and the started notice. Nothing asserts that the model call for the `demo:ghost` step lacks the helper's body or any agent body. So the scenario would also pass if the engine bound the ghost to some other definition.
**Fix:** Add `Then the model receives these calls:` with call 1 `Task label: agent 1\n\nAnswer the task.`, which has no agent body. That pins the default-agent claim the doc row cites.

### IN-03: An upstream claim with no evidence grade

**File:** `docs/mcp-compatibility.md:391`
**Issue:** "Claude Code fails such an agent when it launches" (an agent whose `tools` holds only `Workflow` entries) has no evidence grade. Every other upstream claim on these pages carries one.
**Fix:** Grade it (binary read or docs), or remove the sentence.

---

_Reviewed: 2026-11-15T05:32:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
