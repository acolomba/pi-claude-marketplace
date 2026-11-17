---
phase: 08-workflow-agents-and-run-paths
plan: "02"
subsystem: workflows
tags: [workflows, agents, notes, parity]
status: complete
requires: ["08-01"]
provides:
  - "workflowAgentNotes: one join and one member that carry the PG-SEC-01 note and the PG-WF-02 missing-agent note"
  - "features/workflow/agent-types.feature with seven scenarios"
  - "The corrected agentType row of docs/workflows-compatibility.md"
affects: ["08-07"]
tech-stack:
  added: []
  patterns: ["one shared note lead for every workflow agent note", "per-script note limit with a count line"]
key-files:
  created:
    - features/workflow/agent-types.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/orchestrators/plugin/discover-names.test.ts
    - test/orchestrators/plugin/info.test.ts
    - docs/workflows-compatibility.md
decisions:
  - "D-PG8-04 as resolved: a missing agent type is a string literal that starts with `<plugin>:` and equals no declaredAgentName of a discovered agent, by exact comparison."
  - "D-PG8-05 as refined: one tenseless text for install, update and info; at most 5 missing-agent notes per script, then one count line; an agent type longer than 128 characters is counted, not printed (planner's proposal, pending review)."
  - "D-PG8-06: the agentType row's Pi cell is now the partial mark; the divergence is licensed by a Pi-side gap."
metrics:
  duration: "about 70 minutes"
  completed: 2026-11-14
estimate:
  tokens: 76000
  tasks: 2
actuals:
  tokens: 29300
  tasks: 2
  commits: 2
plan_head_before: e652b1fa799285055a2eaefbfee53bccafa53040
plan_head_after: 0325a7ec819c190c8ca03d2ed90e0defd536675c
---

# Phase 8 Plan 02: Workflow agent types Summary

Install, update and `info` now print one note for each agent type that a workflow script names in the plugin's own namespace and the plugin does not install, at most five per script and then a count line. Both kinds of workflow agent note travel through the one renamed member `workflowAgentNotes`. Seven scenarios pin the note, its limits, the agent type binding, and the run of a missing type. The compatibility row now says that Claude Code 2.1.323 stops such a step.

`actuals.tokens` is chars/4 over the realized diff (117,168 bytes from `e652b1fa` to `0325a7ec`).

## Commits

- `b8ac6d91` feat(workflows): note a workflow agent type the plugin does not install
- `0325a7ec` test(workflows): prove workflow agent type binding and correct the row

Both commits passed the commit hook (`npm run check:commit` Passed), without `--no-verify`. Neither lists a path under `extensions/pi-claude-marketplace/persistence/`. The second lists no path under `extensions/` or `test/`.

## Final text (for plan 08-07)

- Note: `workflow script "<file>" in "<folder>" runs agent type "<type>", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run`
- Count line: `workflow script "<file>" in "<folder>" runs <n> more agent types that this plugin does not install`, and `runs 1 more agent type that this plugin does not install` for one.
- Limits: `MISSING_AGENT_NOTE_LIMIT = 5` notes for one script; `AGENT_TYPE_DISPLAY_LIMIT = 128` characters (UTF-16 code units, `String.length`) for one printed agent type. A missing type past either limit is counted in the count line. Restriction notes are never counted and never left out.
- Order in one script: restriction notes and missing-agent notes in the order the script names the types, then the count line. Scripts keep their discovery order.
- `<file>`, `<folder>` (base name of the script's folder) and `<type>` each pass through `forMessage`.

## Renamed symbols

| Before | After |
| --- | --- |
| `workflowAgentRestrictionNotes` (exported function and `DiscoveredGeneratedNames` member) | `workflowAgentNotes` |
| `RestrictionAgent` | `WorkflowNoteAgent` |
| `RestrictionWorkflow` | `WorkflowNoteScript` |
| `previewAgentRestrictionNotes` (private, info.ts) | `previewWorkflowAgentNotes` |

New private helpers in discover-names.ts: `scriptLead` (the folder rule and its comment), `agentTypeLead` (lead up to the quoted type, called by both note builders), `restrictionNote`, `missingAgentNote`, `missingAgentCountLine`, `scriptAgentNotes` (one script's combined list), and the interface `AgentNoteJoin`.

## Commands and results

Task 1 (all run in the worktree, hermetic):

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/discover-names.test.ts test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/info.messaging.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts test/orchestrators/plugin/install-flow.test.ts`: 1090 tests, 1090 pass, 0 fail, 0 cancelled. (The owner file alone: 46 tests, 46 pass.)
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: exit 0 (100% direct coverage for all four). `info.ts` was run again after the info.test.ts edit: exit 0.
- `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/plugin-layer-verbs.test.ts test/integration/workflow-kind-inversion.test.ts`: 20 tests, 20 pass.
- `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature features/workflow/agent-restrictions.feature`: 7 scenarios (7 passed), 87 steps (87 passed). At that point agent-types.feature held its three task-1 scenarios and agent-restrictions.feature its four.
- `npm run check:static`: exit 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed).

Task 2:

- `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature`: 7 scenarios (7 passed), 91 steps (91 passed).
- `npm run check:features`: exit 0.
- `git diff --quiet HEAD -- extensions test`: exit 0 before the commit (every mutation was restored).
- `SKIP=npm-check pre-commit run --files docs/workflows-compatibility.md features/workflow/agent-types.feature`: the first run had mdformat re-pad the table (files modified); the second run was clean.

`npm run check` was not run; it is the orchestrator's wave gate.

## Red and green of the three note scenarios

Red, on the tree at `e652b1fa` with only the new feature file (`npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature`): exit 1, `3 scenarios (3 failed)`, `37 steps (31 passed, 3 skipped, 3 failed)`.

1. Install, `features/workflow/agent-types.feature:18`, fails at `Then the command reports these results:`. The actual results are only the `cascade | info | true` row, with no `header` and `lines` columns and no diagnostic row.
2. Update, `:50`, fails at the same step. The actual results are again only the cascade row, with no `diagnostic | warning | false | Plugin "demo" [user] updated; 1 declared component has a note. | ...` row.
3. Info, `:71`, fails at `Then the result has these fields:`. The `plugin notes` field is missing from the actual fields.

Green, after the change: the run above with agent-restrictions.feature (7 of 7), then the full feature in task 2 (7 of 7).

## Rows the scenarios state (read once from the actual output)

- Install (agents `helper`; script names `demo:helper`, `demo:ghost`, `demo:phantom`): diagnostic header `Plugin "demo" [user] installed; 2 declared components have notes.`. The `lines` cell is the two notes joined by `, `. The workflow install diagnostic lines are the two whole notes for `demo:ghost` and `demo:phantom`, each `in "workflows"`. The plugin row is `fixtures | user | demo@fixtures | demo | installed | | user | 1.0.0`.
- Update (1.0.0 with no workflow, then 1.1.0 whose script names `demo:ghost`): header `Plugin "demo" [user] updated; 1 declared component has a note.`, one note, row `updated | | user | 1.0.0 | 1.1.0`.
- Info: the agent-restrictions info field table, with `plugin components agents` set to `helper` and `plugin notes` set to the `demo:ghost` note.
- No note: only the `cascade | info | true` row and the installed plugin row.
- Seven missing types (`demo:one` to `demo:seven`): header `Plugin "demo" [user] installed; 6 declared components have notes.`. The diagnostic lines are five notes (`demo:one` to `demo:five`) and `workflow script "scan.js" in "workflows" runs 2 more agent types that this plugin does not install`.
- Binding: the run ends `completed` with `The answer.`. The calls table is `| 1 | user | Speak as the helper of demo.\n\nTask label: agent 1\n\nAnswer the task. |`.
- Step that still runs: the run ends `completed` with `The answer.`. The notices table is `| started /demo:ask |`.

## Guard mutations (working tree only, each restored; none committed)

1. **No-note scenario** ("Installing a plugin whose workflow names only agents it installs and agents outside its namespace gives no note"). Mutation: in `discover-names.ts` `scriptAgentNotes`, `} else if (agentType.startsWith(join.ownPrefix) && !join.installed.has(agentType)) {` became `} else if (!join.installed.has(agentType)) {`. Run: `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature --name "gives no note"` exited 1, `12 steps (10 passed, 1 skipped, 1 failed)`. The step `Then the command reports these results:` failed: the actual results held a diagnostic `Plugin "demo" [user] installed; 2 declared components have notes.` with notes for `"general-purpose"` and `"other:reviewer"`. Restoration: the file was copied back from a scratch backup, `git diff --quiet HEAD -- extensions test` exited 0, and the green run is the task-2 run above.
2. **Limit scenario** ("... notes five and counts the rest"). Mutation: `const MISSING_AGENT_NOTE_LIMIT = 5;` became `= 10;`. Run with `--name "notes five and counts the rest"`: exit 1, `12 steps (9 passed, 2 skipped, 1 failed)`. The step `Then the command reports these results:` failed: the actual header was `Plugin "demo" [user] installed; 7 declared components have notes.` against the expected `6 declared components have notes.`, and the lines held seven notes and no count line. Restoration as in item 1.
3. **Binding scenario** ("A workflow step that names an agent of its plugin runs on that agent's instructions"). Mutation 3a changed the script's `{agentType:"demo:helper"}` to `{agentType:"demo:nobody"}`. It failed earlier than intended, at `Given the user has run "/claude:plugin install demo@fixtures --scope user"`: the install now prints the new note for `demo:nobody`, and that step requires no diagnostic. Mutation 3b applied the same change and also switched the setup step to `..., which did not fail`. Run with `--name "runs on that agent's instructions"`: exit 1, `15 steps (14 passed, 1 failed)`. The step `Then the model receives these calls:` failed with the actual row `Act as workflow subagent type: demo:nobody\n\nTask label: agent 1\n\nAnswer the task.` against the expected `Speak as the helper of demo.\n\nTask label: agent 1\n\nAnswer the task.`. Restoration: the feature file was copied back from a scratch backup, `grep -c demo:nobody` printed 0, and the green run is the task-2 run above.
4. **Step that still runs** ("A workflow step that names an agent type the plugin does not install still runs, where Claude Code stops the step"). No mutation in this repository: the scenario pins the engine's behavior. It fails on the day the engine stops a step whose agent type it cannot find, which is the request of PRD section 8.4. The note's wording and the page row must then change. The scenario states the run's result and the engine's notice, not the engine's wording for the unbound type.

## Deviations from Plan

1. **[Rule 1 - Bug] One existing info.test.ts expectation gained the new note.** The case "NFR-10 / PG-SEC-01: an agents path that is absolute or escapes the plugin root is not read for notes" names `foo:spy`, whose only agent files lie outside the plugin root. Containment drops them before any read, so the plugin installs no `spy`, and `info` now correctly shows the missing-agent note. The plan said to add no case to the consumer tests. This is not a new case: the existing expectation gained one note line, and its comment now says why. The containment proof (`outsideReads.count() === 0`) is unchanged. Commit `b8ac6d91`.
2. **[Rule 1 - Bug] One PG-SEC-01 no-note row in discover-names.test.ts gained an expected missing-agent note.** In the row "an agent type that differs only by case" (`acme:Reader`), the restriction expectation is still none. But under D-PG8-04 a name that differs only by case is a missing agent type, so the combined member now holds its note. The table gained an optional `otherNotes` field, which is empty for every other row. No restriction note expected by a PG-SEC-01 case was edited. Commit `b8ac6d91`.
3. **The info debug-log text changed** from `info: agent restriction notes skipped ...` to `info: workflow agent notes skipped ...`, so that it names both kinds. No test reads it.
4. **The bidi hook flagged literal U+202E and U+200B** in the new escape case, because the tool call that wrote the file turned `\u` escapes into the characters. They were replaced with `\u202e` and `\u200b` escapes before the commit.
5. **Mutation 3 needed a second form** (3a and 3b above), because the new note itself fails the strict install setup step first.
6. **The task-2 commit type is `test`,** although it also changes `docs/workflows-compatibility.md`. The behavior proof is most of the commit.

## Flagged assumptions (from the plan, unchanged)

- The limits and the count line are the planner's proposal (D-PG8-05 as refined, pending review): five notes for one script, 128 characters for one agent type, and the wording `runs <n> more agent types that this plugin does not install`.
- The rename: `WorkflowNoteAgent`, `WorkflowNoteScript`, and `previewWorkflowAgentNotes` are the planner's names.
- Seven files, with the catalog state of the note left to plan 08-07 (the planner's reading of D-PG8-16, pending review).
- The Pi cell of the row is now the partial mark `⚠`.
- A seventh scenario pins the step that still runs.
- The R2 residuals are recorded on the page and not coded: a user-written agent file with a name in the plugin's namespace, an agent file whose `name` the user changed, and an agent type that is not a string literal.
- A quote mark inside an agent type is not escaped by `forMessage`, as for every workflow-script note.
- No new case in the three consumer tests. See deviation 1 for the one changed expectation.

## Parent lines (for the orchestrator; not applied here)

- PROJECT.md decision row D-PG8-04 (pending the maintainer's review): "A workflow script's agent type is noted as missing when it is a string literal that starts with `<plugin>:` and equals no declared name `<plugin>:[<folder>:]<source>` of an agent that discovery found, by exact comparison. The discovered agents are the installed ones (AG-11, AG-12). A bare name, a name of another plugin, a generated flat name, and a non-literal give no note. The note never refuses an install, is recomputed at every install, update, reinstall, apply and `info`, and is never stored."
- PROJECT.md decision row D-PG8-05 (pending the maintainer's review; the limits and the count line are the planner's proposal): "One tenseless note for each distinct pair of a script and a missing agent type: `workflow script \"<file>\" in \"<folder>\" runs agent type \"<type>\", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run`. At most 5 such notes for one script, then `workflow script \"<file>\" in \"<folder>\" runs <n> more agent types that this plugin does not install` (`1 more agent type`). An agent type longer than 128 characters is counted, not printed. Both kinds of workflow agent note travel through one member, `workflowAgentNotes`."
- PROJECT.md decision row D-PG8-06 (pending the maintainer's review): "Claude Code 2.1.323 stops a workflow step whose `agentType` names no agent (`agent type '<x>' not found`). The workflow engine 3.15.0 logs one line and runs a default agent with default tools and model. This is a divergence licensed by a Pi-side gap: the engine resolves agent types. The `agentType` row of docs/workflows-compatibility.md says so, cites features/workflow/agent-types.feature, and its Pi cell is the partial mark."
- CHANGELOG line: "An install, an update, and `info` now note a workflow agent type that the plugin does not install, because the workflow engine runs a default agent in its place where Claude Code stops the run."
- Engine request (PRD section 8.4, D-PG8-17), listed for the maintainer and not drafted: an `agent()` call whose `agentType` names no agent should throw, as Claude Code does. The scenario "A workflow step that names an agent type the plugin does not install still runs, where Claude Code stops the step" fails on the day the engine does this.
- Codebase maps: `grep -rn workflowAgentRestrictionNotes .planning/codebase docs` finds no line, so there is nothing to change.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-04: `forMessage` escapes the file name, the folder and the agent type in the one shared lead (`scriptLead` and `agentTypeLead`). Owner cases cover U+202E in a file name, and a line break and U+200B in an agent type. T-08-05: the two limits have owner cases for six and seven types and for a 129-character type, and a scenario for seven. T-08-06: the namespace rule has a guard scenario and the mutation above. T-08-07: every scenario line shows `in "workflows"`, and `info` still maps notes through `redactAbsolutePaths`. T-08-08: `previewWorkflowAgentNotes` keeps its early return, its containment check and its `try` unchanged, and the info.test.ts containment and throw cases pass. T-08-SC: no package was installed or changed. Every test ran under `test/platform/isolated-pi-home.ts` or in the cucumber sandbox, and no command read the real `~/.pi/agent`.

## Self-Check: PASSED

- FOUND: features/workflow/agent-types.feature (7 scenarios)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts (`export function workflowAgentNotes`, `which this plugin does not install`, `PG-WF-02`, `D-PG8-05`)
- FOUND: `workflowAgentNotes` in install-outcome.ts, update-swap.ts, info.ts
- FOUND: docs/workflows-compatibility.md (`D-PG8-06`, `agent-types.feature`, 2 lines with `read from the 2.1.323 binary`, `D-PG4-14` row unchanged, 0 lines with `is not an error on either side`)
- FOUND: b8ac6d91, 0325a7ec (ancestors of HEAD)
