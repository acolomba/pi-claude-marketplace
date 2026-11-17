---
phase: 04-skill-and-workflow-install-defects
plan: "05"
subsystem: domain/workflow-script, orchestrators/plugin (discover-names, install ledger, update runner), cucumber (workflow vertical)
status: complete
tags: [workflows, agents, security-note, cucumber, PG-SEC-01]
requirements: [PG-SEC-01]
requirements-completed: [PG-SEC-01]
requires: []
provides:
  - "NamedWorkflow.agentTypes: the distinct string-literal agentType values of an admitted script, absent when there are none"
  - "DiscoveredGeneratedNames.workflowAgentRestrictionNotes: one note per (script, restricted agent type) pair"
  - "the module-private join workflowAgentRestrictionNotes in orchestrators/plugin/discover-names.ts, which plan 04-06 exports for info"
  - "features/workflow/agent-restrictions.feature: install and update scenarios"
affects:
  - orchestrators/plugin/info.ts (plan 04-06 consumes the join)
  - docs/workflows-compatibility.md (plan 04-06 states the residual)
tech-stack:
  added: []
  patterns: ["contained AST walk with a node-depth budget whose breach costs a note, never an install"]
key-files:
  created:
    - features/workflow/agent-restrictions.feature
  modified:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - test/domain/workflow-script.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
    - test/orchestrators/plugin/discover-names.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/update-swap.test.ts
key-decisions:
  - "The note names the script folder by its base name in the join, because redactAbsolutePaths redacts a quoted absolute path to the end of the line when more quotes follow it"
  - "The agentType walk budget is 1,000 nodes deep; arrays do not count as a level"
decisions:
  - "D-PG4-11/12/13 implemented: literal-only agentType matching against the plugin's own agents with a non-blank tools or disallowedTools; one note per pair; recomputed, never persisted"
metrics:
  duration: "~75 min"
  completed: 2026-11-13
estimate:
  tokens: 80000
  tasks: 3
actuals:
  tokens: 12708
  tasks: 3
  commits: 3
plan_head_before: e6b6a84507764c8819381f1418a1fcb88787b058
plan_head_after: 4f74f5b446799e6e8b30c10047f30532b8449c3d
---

# Phase 04 Plan 05: Workflow agent restriction note Summary

An install or an update of a plugin whose workflow script runs one of the plugin's tool-restricted agents now prints one note: the workflow engine does not keep the agent's `tools` or `disallowedTools`, so the agent can use read, bash, edit, and write. The plugin still installs. Nothing is stored.

## What changed

- `extensions/pi-claude-marketplace/domain/workflow-script.ts`: `NamedWorkflow` has a new optional member, `agentTypes`. `admitWorkflowScript` reads it after both refusal arms, beside the gate reading, from the tree `parseScript` already built. The analyzer still has one parse call site. `readAgentTypes` walks every own value of every node. It takes each non-computed `Property` whose key `metaPropertyKey` reads as `agentType`, and keeps the value `literalString` returns (a string literal or a template with no substitution, decoded). The walk follows no binding and evaluates nothing. It is contained in its own `try`, like `readEngineGate`. Its depth budget is `AGENT_TYPE_WALK_MAX_DEPTH = 1_000` nodes, and a breach yields no agent types for that script. `namedVerdict` adds the member only when the list is not empty.
- `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`: the new pure join `workflowAgentRestrictionNotes`, and a new required member `workflowAgentRestrictionNotes` on `DiscoveredGeneratedNames`. `discoverGeneratedNames` fills it from the two discoveries it already runs, with no added file read. The module header and the function comment say why the notes are built here.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`: one spread element in the ledger context's `discoveryWarnings`, after the shadowed-folder warnings.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`: one spread element in `stagingWarnings` of `swapPluginUpdate`, after the shadowed-folder warnings and before the bridges' warnings. No branch was added. The failure outcome keeps the bridges' warnings alone.
- `features/workflow/agent-restrictions.feature` (new, untagged, so it runs under the adapter profile). Both scenarios use existing steps only.

### Final note text (D-PG4-12)

```text
workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write
```

`forMessage` escapes the file name, the folder, and the agent type where each enters the string.

### Join signature (for plan 04-06)

```typescript
function workflowAgentRestrictionNotes(
  pluginName: string,
  agents: readonly RestrictionAgent[],
  workflows: readonly RestrictionWorkflow[],
): readonly string[];

interface RestrictionAgent {
  readonly sourceName: string;
  readonly generatedName: string;
  readonly namespace?: readonly string[];
  readonly raw: { readonly tools?: string; readonly disallowedTools?: string };
}
interface RestrictionWorkflow {
  readonly verdict: WorkflowVerdict;
  readonly scriptFile: string;
}
```

The join and both interfaces are module-private. `DiscoveredAgent` and `DiscoveredWorkflow` satisfy the interfaces structurally, so `info` can pass the results of `discoverPluginAgents` and `discoverPluginWorkflows` directly. Agents match by `declaredAgentName(plugin, sourceName, namespace)` and by `generatedName`, with exact string equality. An agent restricts its tools when `raw.tools` or `raw.disallowedTools` is a string that is not blank. Each note's folder is `path.basename(path.dirname(scriptFile))`, so it needs no redaction. A later `redactAbsolutePaths` pass leaves it as it is.

### Rows the scenarios state

Install, `/claude:plugin install demo@fixtures --scope user`:

| kind       | severity | needs reload | header                                                           | lines         |
| ---------- | -------- | ------------ | ---------------------------------------------------------------- | ------------- |
| cascade    | info     | true         |                                                                  |               |
| diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | the note text |

The workflow install diagnostic reports one line, the note text. The plugin row is `fixtures | user | demo@fixtures | demo | installed | (no reasons) | user | 1.0.0`.

Update, `/claude:plugin update demo@fixtures --scope user`, from 1.0.0 (no workflow) to 1.1.0:

| kind       | severity | needs reload | header                                                         | lines         |
| ---------- | -------- | ------------ | -------------------------------------------------------------- | ------------- |
| cascade    | info     | true         |                                                                |               |
| diagnostic | warning  | false        | Plugin "demo" [user] updated; 1 declared component has a note. | the note text |

The plugin row is `fixtures | user | demo@fixtures | demo | updated | (no reasons) | user | 1.0.0 | 1.1.0`.

The Background loads pi-subagents and pi-dynamic-workflows together, and both load. The fallback was not needed.

## Red and green evidence

All runs used Node v26.13.1 on `features/gaps`.

- Install scenario, red, on the tree after `d159d3fe` (before the install wiring): `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-restrictions.feature` exited 1. `Then the command reports these results:` received one result, `cascade | info | true`, and no diagnostic. 1 scenario failed, 13 steps (10 passed, 2 skipped, 1 failed).
- Install scenario, green, after the wiring: the same command exited 0. 1 scenario passed, 13 steps passed.
- Update scenario, red, on the tree after `c98589fa` (before the update wiring): the same command exited 1. The update scenario received one result, `cascade | info | true`, and no diagnostic. 2 scenarios ran (1 passed, 1 failed), 27 steps (25 passed, 1 skipped, 1 failed).
- Update scenario, green: `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-restrictions.feature features/plugin/staging-warnings.feature` exited 0. 19 scenarios passed (the 2 agent-restrictions scenarios and the 17 staging-warnings scenarios, which are unchanged), 243 steps passed.
- Owner tests: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/workflow-script.test.ts test/orchestrators/plugin/discover-names.test.ts test/architecture/workflows-single-parse.test.ts` gave 151 passed and 0 failed (the one-parse and containment gates included). `test/orchestrators/plugin/install-outcome.test.ts` gave 101 passed. `test/orchestrators/plugin/update-swap.test.ts` gave 334 passed.
- Direct coverage: `npm run test:coverage:direct --` on `workflow-script.ts`, `discover-names.ts`, `install-outcome.ts`, and `update-swap.ts` exited 0 for each source, at 100%. No coverage exception was added.
- `npm run check:features` exited 0. `npx fallow dupes --fail-on-issues` exited 0. Each commit's hook ran `npm run check:commit` and passed.
- The real official scripts (read only, from the local Claude Code marketplace copy) give the agent types the research predicted. code-modernization's six scripts name 7 pairs. claude-security's `scan.js` names `claude-security:scan-inventory` and `claude-security:scan-verifier`. No script reaches the walk budget.
- The full `npm run check` was not run. The orchestrator runs it after the wave.

## Commits

- `d159d3fe` feat(workflows): find workflows that run a tool-restricted plugin agent
- `c98589fa` feat(workflows): note at install that a workflow drops an agent's tools
- `4f74f5b4` feat(workflows): note at update that a workflow drops an agent's tools

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The note's absolute folder was redacted to the end of the line**
- **Found during:** Task 04-05-02, on the first green run of the install scenario.
- **Issue:** The plan gave the join the absolute folder and left the reduction to the surfacing sites. `redactQuotedAbsolutePaths` (`shared/redact-absolute-paths.ts`) replaces a quoted absolute path with `[redacted path]` up to the end of the text when the same quote character appears again after the path. The note quotes the agent type after the folder, so the diagnostic read `workflow script "scan.js" in "[redacted path]`, and the rest of the sentence was lost.
- **Fix:** The join now writes the folder's base name, `path.basename(path.dirname(scriptFile))`. That is the text the workflows bridge's notes show after redaction. The D-PG4-12 wording and the `in "workflows"` text did not change. No absolute path reaches the note, so T-04-11 is stronger. `shared/redact-absolute-paths.ts` was not changed.
- **Files modified:** `orchestrators/plugin/discover-names.ts` and its owner test, committed with task 04-05-02 in `c98589fa`.

### Other adjustments

- **Update scenario steps.** The update scenario states every result through `Then the command reports these results:`, and the `lines` cell holds the one diagnostic line in full. It does not use `Then the workflow install diagnostic reports these lines:`, because that step's text says "install". The install scenario uses both steps.
- **"Agent not staged" owner case.** The install ledger stages agents whatever the companion state is: `runWithNothingLoaded()` changes only the notification markers. The owner case therefore proves that the note is there with no companion loaded and with every companion loaded. The note comes from discovery, never from staging, so it does not depend on whether the agent was staged (D-PG4-11).
- **Empty `agentType` literal.** The domain reader keeps `""` like any other literal. It gives no note because no agent has an empty name. The join's owner case for this row passes.

## Residual and assumption

- **Accepted residual (D-PG4-11):** an `agentType` that is not a string literal gives no note. `claude-security`'s `scan.js` passes two agent types through the minified constants `Ut` and `zt`, so its read-only `scan-loader` agent (`tools: Read`) and `scan-researcher` get no note. Plan 04-06 states this in the compatibility row.
- **A4:** the scenarios' only note is the restriction note. The owner cases fix its position: after the shadowed-folder warnings at install, and between the shadowed-folder warnings and the bridges' warnings at update. The order among other workflow notes in a diagnostic was not traced.
- A reinstall and an apply move go through the same `swapPluginUpdate` site. The plan named that site as their shared path. This plan adds no scenario for those two verbs.

## Parent lines (for the orchestrator)

- BACKLOG: the constant-bound `agentType` residual of D-PG4-11 (claude-security `scan-loader`, `scan-researcher`) gives a missing note by design. Plan 04-06 lists it with the compatibility row.
- PROJECT.md: none from this plan.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-08 (depth budget and containment, owner cases for both sides of the budget), T-04-09 (`forMessage` on every span, a case with format characters), T-04-10 (no-note cases), and T-04-11 (the base name only, and both scenarios show `in "workflows"`) are mitigated as planned.

## Self-Check: PASSED

The three commits are ancestors of HEAD, `features/workflow/agent-restrictions.feature` exists, and `git rev-list --count e6b6a845..4f74f5b4` is 3.
