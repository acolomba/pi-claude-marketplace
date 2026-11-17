# Phase 8: Workflow Agents and Run Paths - Research

**Researched:** 2026-11-14
**Domain:** workflow engine agent types, install notes, cucumber run-path coverage, pi-subagents children, the `Workflow` tool grant
**Confidence:** HIGH for PG-WF-02, PG-WF-07, and the engine and upstream facts of PG-WF-04. HIGH that the premise of PG-WF-05 is wrong upstream. MEDIUM for the predicted S5 outcomes, which only the spike can measure.

<user_constraints>

## User Constraints (from CONTEXT.md)

Every D-PG8 decision below is pending maintainer review. The text is copied from `08-CONTEXT.md`. Research findings that change a decision are in "Summary" and in "Amendments proposed".

### Locked Decisions

### Spike S5 (gates PG-WF-05 and the adapter half of PG-WF-04)

- **D-PG8-01:** S5 is task 1 of plan 01, before any WF-05 or WF-04 adapter
  work. It answers two questions with the companions at the versions the
  integration suite installs (`test/integration/optional-peer-suite-versions.json`;
  pi-subagents 0.88.1, engine 3.15.0, pi-mcp-adapter 7.0.1), a loopback
  scripted provider, and a hermetic home:
  (a) In a real pi-subagents background child that loads the parent's
  extensions, does the workflow engine load, register its `workflow` tool, and
  run a saved plugin workflow that the child's model starts with
  `workflow({name: "demo:scan"})`, with the run's result reaching the child?
  (b) With `"providerMiddlewareExtensions": ["pi-mcp-adapter"]` in the
  engine's settings, does a workflow subagent get the adapter's plugin MCP
  tool and call it?
  The spike reuses the Phase 3 real-child harness
  (`features/plugin/subagent-child.feature`,
  `test/integration/pi-subagents-child-identity.test.ts`). The record goes to
  `08-SPIKE-S5.md` in the phase directory, with the exact command, fixture,
  versions, exit status and deciding output, and to the S5 "Result" cell of
  section 9 in `docs/prd/parity-gaps-prd.md`. Probe code that does not become
  a committed proof is not committed.
- **D-PG8-02 (product: sequencing):** The ROADMAP says that if the engine does
  not work in a child, the question goes to the maintainer before any plan is
  written for PG-WF-05. This run writes the WF-05 plan now, as a conditional
  plan: its first task reads `08-SPIKE-S5.md`, and when S5(a) is negative it
  stops at a `checkpoint:decision` for the maintainer and changes no code. In
  that case PG-WF-05 is not met by this project (a capability gap of the
  engine or pi-subagents), and only the compatibility text records the gap.
  When S5(b) is negative, PG-WF-04's page states the adapter setting as not
  working, with the measured error, instead of "unmeasured".

### Agent type binding and the missing-agent note (PG-WF-02)

Upstream evidence: Claude Code 2.1.323 binary, grepped 2026-11-14:
`throw Error(\`agent({agentType}): agent type '${y}' not found. Available
agents: ...\`)`. High confidence.

- **D-PG8-03:** Part (a) is proved by a scenario in
  `features/workflow/agent-steps.feature` (or a sibling) with the scripted
  model: a plugin agent `helper` with a distinctive body, a workflow step
  `agent("...", {agentType: "demo:helper"})`, and a model call whose text holds
  the helper's body. This is a guard scenario: no code changes for (a). The
  fixture agent declares no `tools` restriction, so the SEC-01 note of Phase 4
  does not appear, and the scenario title claims the binding only, not the
  tool restriction. The existing Phase 7 scenarios in that file already show a
  body reaching the model; the new scenario exists so that PG-WF-02(a) has its
  own named proof.
- **D-PG8-04:** Part (b) trigger: a literal `agentType` value of an admitted
  (`named`) script that is in the plugin's own namespace (starts with
  `<plugin>:`) and equals no declared name `<plugin>:[<folder>:]<source>` of an
  agent that the plugin installs. Agent names are not elided
  (`declaredAgentName`), so the comparison is exact. Research decides whether
  "installs" can mean the agents the bridge will actually stage (an agent
  whose conversion is refused is not installed, and the engine runs a default
  agent for it) or only the discovered agents; if discovery cannot know the
  staged set, compare with the discovered set and record the residual. A name
  outside the plugin's namespace (another plugin's agent, a bare name such as
  `general-purpose`) gives no note: the engine may resolve it from another
  install, and a missing note is never a false one. A non-literal `agentType`
  gives no note (same residual as D-PG4-11). The note does not depend on which
  companions are present.
- **D-PG8-05 (product: wording and granularity):** One note per distinct
  (script, agent type) pair, in the workflow-script note family of D-PG4-12,
  carried as a discovery warning through the same join
  (`orchestrators/plugin/discover-names.ts`, `workflowAgentRestrictionNotes`
  is the model) so install, update, reinstall, apply, and `info` share one
  path. Never refuses, never changes the outcome, never persisted (D-PG4-13).
  Proposed install wording: `workflow script "scan.js" in "workflows" runs
  agent type "demo:ghost", which this plugin does not install; the workflow
  engine runs a default agent in its place, where Claude Code stops the run`.
  `info` uses the info-tense form of the existing notes. Each span of plugin
  text goes through `forMessage`.
- **D-PG8-06:** Part (c): correct the `agentType` row of
  `docs/workflows-compatibility.md` (line 126 today). Claude Code 2.1.323
  stops the step with `agent type '<x>' not found`; the engine logs one line
  and runs a default agent with default tools and model. The divergence is
  licensed by a Pi-side gap: the engine, not this extension, resolves agent
  types. The row names the note and its scenario. `docs/output-catalog.md`
  gets the note's row.

### Run-path scenarios (PG-WF-07)

- **D-PG8-07:** Five guard scenarios with the scripted model and the engine
  companion, each pinning today's behavior. No code changes. Where Pi differs
  from Claude Code the scenario title says so, as the existing workflow
  scenarios do:
  1. The model starts a plugin workflow by name with object `args`
     (`workflow({name: "demo:x", args: {...}})`), and the script receives the
     object and returns a field of it.
  2. `agent({schema})`: the step's structured output comes back as the
     object the script returns.
  3. `isolation: 'worktree'`: the step runs in a git worktree of the session's
     project. The engine keeps the worktree and its branch, where Claude Code
     removes an unchanged one; the title states it.
  4. `workflow()` nesting to a sibling: a script calls its sibling by the
     installed name and returns the sibling's result. The fixture's names do
     not start with `<plugin>-`, so the elision (decision 14) does not change
     the name.
  5. Two scripts with one `meta.name`: research reads today's behavior
     (WNAM-05, `domain/workflow-script.ts`) and upstream's (2.1.323 binary);
     the scenario pins today's behavior, and when it differs from Claude Code
     the title names the difference. Decision 14 is not answered here.
  Because no behavior changes, AGENTS.md's "fails without the change" rule is
  met by a recorded mutation per scenario in the plan SUMMARY (an edit that
  makes the scenario fail, then reverted). No mutation is committed. Feature
  file placement and profile tags follow the existing `features/workflow/`
  convention; the planner picks a file (`run.feature` or a new
  `run-paths.feature`).

### What a workflow subagent can reach (PG-WF-04)

- **D-PG8-08:** A new section "What a workflow subagent can reach" in
  `docs/workflows-compatibility.md`, docs only. It covers: Pi's `read`, `bash`,
  `edit`, `write` (engine 3.13.1 and later create children through Pi's
  `createAgentSession`), with a pointer to the D-PG4-14 restriction row; no
  MCP tools by default; `"providerMiddlewareExtensions": ["pi-mcp-adapter"]`
  in `<workflow home>/settings.json` loads the adapter in each child, graded
  as S5 measured it; Pi's built-in MCP cannot load in a child; plugin hooks
  and plugin skills do not reach a child, except skills an agent preloads,
  which its body inlines; the model is the engine's tier or default unless
  `"inheritMainModel": true`. The upstream column says what a Claude Code
  workflow subagent gets (session model, session MCP tools; research grades
  hooks and skills from the binary or docs). Each claim carries its evidence
  grade, as the page's other rows do.
- **D-PG8-09:** This extension writes no engine setting. The engine's settings
  file is the user's configuration, outside what NFR-10 lets this extension
  write; the page tells the user what to set.
- **D-PG8-10:** Correct the paragraph that says Claude Code's failure behavior
  of `parallel()` is unknown (line 164 in the PRD's count; the paragraph that
  begins "What Claude Code does on a failure of that kind" today). Claude Code
  2.1.323 runs `parallel()` through `Promise.allSettled`, and its tool text
  says a thunk that throws "resolves to `null` in the result array -- the call
  itself never rejects" (binary grep, 2026-11-14, high confidence). Research
  confirms `pipeline()` from the same binary. The engine rejects on its
  non-recoverable class; the divergence is the engine's, and PRD section 8.4
  lists the request.

### `Workflow` grant (PG-WF-05; only if S5(a) passes)

Upstream evidence: 2.1.323 binary: the tool is named `Workflow`
(`var Bd="Workflow"`); `Workflow(<name>)` is a permission rule whose
`ruleContent` is a workflow name, used to pre-approve that workflow
(`addRules [{toolName: Bd, ruleContent: <workflowName>}]`). Medium confidence
on how a specifier inside an agent's `tools` acts; research settles it.
`claude-security/agents/claude-security.md` grants `Workflow,
Workflow(claude-security:scan)`.

- **D-PG8-11:** `TOOL_MAP` maps `Workflow` to the engine's `workflow` tool,
  and `Workflow(<name>)` maps the same way, as `Agent(...)` does (D-PG7-08).
  The specifier is not applied: upstream reads it as a pre-approval, and Pi
  asks no approval before a workflow runs (D-CF7-01). If research finds that
  upstream restricts the agent to the named workflows, that is a recorded
  capability gap (the engine's tool takes no name list), and the compatibility
  text says so.
- **D-PG8-12 (product):** Map the grant whenever the source grants it, not
  only when the plugin stages a workflow: Claude Code gives the tool whatever
  the plugin ships, and the agent may run any saved workflow. Research
  confirms how pi-subagents 0.88.1 treats a named tool whose provider is not
  loaded (the engine is absent). If it refuses the launch, the grant is mapped
  only when the plugin stages a workflow, and the agent with no engine keeps
  today's drop warning, reworded to be true.
- **D-PG8-13:** An agent granted `workflow` launches in the background:
  `async: true`, as an agent granted plugin MCP tools does (D-CF6-10,
  D-CF4-05), also with `background: false`. A foreground child cannot reach an
  extension tool the way a background child that loads the parent's
  extensions can; research confirms this for 0.88.1.
- **D-PG8-14:** A deny wins: `disallowedTools: Workflow`, with or without a
  specifier, removes the grant (D-PG7-12, D-PG7-14). An agent with no `tools`
  field keeps Phase 7's behavior; this phase forces no launch mode on it and
  research records whether it reaches `workflow` in a background child
  (residual, not a requirement).
- **D-PG8-15:** Proof: owner cases in `test/bridges/agents/convert.test.ts`; a
  scenario in `features/agent/frontmatter.feature` where `subagent get` shows
  the `workflow` tool and the background launch mode for `Workflow` and
  `Workflow(demo:scan)`, failing without the change; and the live run of
  criterion 5 (a real pi-subagents background child whose lead agent starts the
  plugin's workflow and gets its result), as a cucumber scenario if the Phase 3
  real-child harness can load the engine in the child, else as an integration
  test against the installed companions, with the scenario pinning
  `subagent get`. Stored warning text that names a dropped `Workflow` token is
  checked wherever stored text is compared (grant forms, legacy grant form,
  grant rewrite), as D-PG7-13 did. Installed agents change at their next
  `update` or `reinstall`.

### Proof and records

- **D-PG8-16:** Every user-visible change (the WF-02(b) note, the WF-05 grant)
  ships a cucumber scenario that fails without it (AGENTS.md "Behavioral
  tests"); WF-02(a) and WF-07 are guard scenarios (D-PG8-03, D-PG8-07). Docs
  change in the same plan as the behavior they describe. Every test, scenario,
  spike, and probe runs in a hermetic home and never reads, lists, stats, or
  writes the real `~/.pi/agent`.
- **D-PG8-17:** No new engine request is drafted in this phase. The parent
  lines list the PRD section 8.4 requests this phase depends on (an unknown
  `agentType` throws; `parallel()` returns `null`; `builtin:mcp` in
  subagents) for the maintainer.

### Claude's Discretion

Plan split and waves; internal type and helper names; the exact feature file
for each scenario; whether the WF-02(b) join shares a helper with the SEC-01
join; exact note wording within the messaging style guide. No exception to
plan size, security, coverage, or verification gates.

### Deferred Ideas (OUT OF SCOPE)

- PG-WF-03 (notes for `disallowedTools`, `bashCommandClamp`, `effort`, `stallMs` in `agent()`), PG-WF-06 and decision 14.
- A note for a `--map-model` agent type whose model the user lacks (`MODEL_NOT_FOUND`, research report WF-02 open question).
- New engine requests (D-PG8-17).
- `Workflow` in the hook tool-name table.

</user_constraints>

## Summary

Three of the four requirements need no spike and no new machinery. PG-WF-02(b) is one pure join beside the PG-SEC-01 join. PG-WF-02(a) and all five PG-WF-07 run paths pass today with steps that exist: six hermetic cucumber probes ran them in this session (see "Probes run in this research"). PG-WF-04 is documentation, and every engine and upstream fact it needs was re-read at engine 3.15.0 and Claude Code 2.1.323.

PG-WF-05 is different. Its premise is wrong. Claude Code removes the `Workflow` tool from every subagent, also when the agent's `tools` field lists it. The documentation says so, and the 2.1.323 binary does it. The one official agent that grants `Workflow` says in its own description that it works only as the main agent of a session and must never be dispatched as a subagent. Every bridged agent on Pi is a pi-subagents child, so Claude Code parity is to keep dropping the grant. Mapping it would give a Pi subagent a capability that Claude Code withholds. That needs a maintainer decision with an ID before any PG-WF-05 code is planned, whatever spike S5 measures.

**Primary recommendation:** Plan PG-WF-02, PG-WF-07, and PG-WF-04 as written. Run S5 as task 1 of plan 01, but make the first task of the PG-WF-05 plan an unconditional `checkpoint:decision` that shows the maintainer the upstream evidence of "Amendments proposed" item 1. Recommend closing PG-WF-05 as "not a gap" and stating it in the compatibility text.

### Amendments proposed

Each item changes or refines a CONTEXT decision. Items 1 and 2 are product questions for the maintainer.

1. **D-PG8-11, -12, -13, -15 (blocking, product): Claude Code gives `Workflow` to no subagent.** The sub-agents page lists `Workflow` among the tools the first filter removes from every subagent "even when listed in the `tools` field" [CITED: https://code.claude.com/docs/en/sub-agents.md, "Available tools", read 2026-11-14]. The 2.1.323 binary puts the tool name in the always-denied agent set of the external build and applies that set to every Agent-tool subagent, but not to the main-thread agent [VERIFIED: binary grep, evidence record E3]. `claude-security/agents/claude-security.md` says: "for use only as the main agent of a session (claude --agent claude-security:claude-security) ... Never dispatch it as a subagent: it cannot scan from there" [VERIFIED: github.com/anthropics/claude-plugins-official, fetched 2026-11-14]. Pi has no main-session agent mode, so the parity answer is: no grant. The plugin's own skill path already works on Pi: the main session's model calls `workflow({name: "claude-security:scan"})` (D-PG4-08). Options for the maintainer: (A, recommended) close PG-WF-05 as not a gap, keep the drop, and say why in the compatibility text; (B) grant the tool as a recorded divergence, licensed by the Pi gap "no main-session agent mode", under the narrow condition of item 2.
2. **D-PG8-12: the fallback clause applies, and its second half cannot be built.** pi-subagents 0.88.1 refuses a child whose `tools` list names a tool that is not registered: the child's `agent_start` handler throws `Agent '<name>' requested unavailable child tools: workflow.` [VERIFIED: pi-subagents `src/runs/shared/subagent-prompt-runtime.js:689-696`, `tool-availability.js:7-29`, `child-tool-plan.js:265-273`]. So "map whenever granted" breaks every launch of such an agent for a user without the engine, where today the agent runs. If option B is chosen, map only when the plugin stages a workflow. The converter already receives that fact: `referenceNames.workflows` [VERIFIED: `bridges/agents/convert.ts:874,963`; `orchestrators/plugin/install-outcome.ts:1360-1369`; `update-swap.ts:430`]. Then the plugin row always carries `{requires pi-dynamic-workflows}` when an agent needs the engine. "The agent with no engine keeps today's drop warning" would need a soft-dependency probe inside a pure converter, or a third stored grant form swapped at session start. Do not build either.
3. **D-PG8-01: the spike must call the tool with `background: false`, and measure the default too.** The engine's `workflow` tool starts a run in the background by default and returns a "started" text at once [VERIFIED: engine `src/workflow-tool.ts:323-340`]. The result is then sent to the session later. A pi-subagents child ends when its model stops, and the engine pauses its runs on `session_shutdown` with reason `quit` [VERIFIED: pi-subagents `child-session.js:480-498`; engine `src/pi-extension.ts:216-256`]. So "the run's result reaching the child" is only reliable with `background: false`. That path needs a script with at least one `agent()` call [VERIFIED: `workflow-tool.ts:413-417`]. A real model calls with the default, so S5 records both. See R1.
4. **D-PG8-01: S5(b) needs the adapter in Pi's settings, not only on the command line.** The engine finds middleware extensions through Pi's package manager, which lists configured extensions [VERIFIED: engine `src/agent.ts:954-966`]. The standard cucumber world loads companions with `--extension` only. The real-child fixture already writes the adapter into `settings.json` [VERIFIED: `features/lib/real-subagent-child.ts:504-522,683-686`]. The engine's settings file in a harness home is `{agent dir}/workflows/settings.json`, because the harness sets `PI_CODING_AGENT_DIR` [VERIFIED: `test/e2e/_rpc.ts:241-242`; engine `src/workflow-paths.ts:30-34`; `src/workflow-settings.ts:96-98`].
5. **D-PG8-04: "installs" means the discovered agents, and that is exact.** An explicit `tools` list that maps to nothing throws and fails the whole install (AG-11) [VERIFIED: `bridges/agents/stage.ts:123-143`; `convert.ts:928-934`]. A duplicate generated name is dropped inside discovery (AG-12) [VERIFIED: `bridges/agents/discover.ts:164-169`]. So on every install that succeeds, the agent files written are the discovered agents. Agent files are written whether or not pi-subagents is loaded [VERIFIED: `features/agent/companion-missing.feature:7-25`]. Two residuals are recorded in R2.
6. **D-PG8-05: one text serves install and `info`.** The PG-SEC-01 note has no tense and prints the same bytes in the install diagnostic and in `info`'s `plugin notes` [VERIFIED: `features/workflow/agent-restrictions.feature:35-42,99-110`]. The proposed PG-WF-02 wording has no tense either. Do not write an "info-tense form".
7. **D-PG8-05: cap the notes of one script.** A PG-SEC-01 note needs an agent of the plugin, so the plugin's agents bound the count. A PG-WF-02 note needs only a literal that starts with `<plugin>:`. A 524,288-byte script can hold tens of thousands of distinct literals, and each would print a line. See "Security Domain". [ASSUMED: the cap value and its wording are the planner's proposal]
8. **D-PG8-06: `docs/output-catalog.md` holds no state for the PG-SEC-01 note.** The catalog pairs each state with a fixture under `test/architecture/catalog-uat/`. Adding a state for the new note needs a fixture and a map entry. See R8.
9. **D-PG8-07: all five run paths pass today.** The exact rows are in R4. The worktree branch and folder names hold the run ID, which is not a UUID, so the scenario must print stable text. Scenario 5 fails the whole install today; Claude Code keeps the last script that parses [VERIFIED: evidence record E5].
10. **D-PG8-08: upstream grades.** A workflow subagent in Claude Code runs on the session model [CITED: workflows.md], reaches session MCP tools [VERIFIED: binary prose], runs the user's and plugins' hooks [CITED: sub-agents.md], and can invoke plugin skills through the Skill tool [CITED: sub-agents.md]. On Pi, a workflow subagent does load the user's own Pi skills, prompt templates, and `AGENTS.md` [CITED: engine `README.md:379`]. It does not get plugin skills, because those reach Pi through this extension's `resources_discover` handler, and the extension is not loaded in the child.
11. **D-PG8-10: the paragraph is on line 165 of today's file,** not 164. `pipeline()` is confirmed: both functions use `Promise.allSettled` and map every rejection to `null` [VERIFIED: evidence record E2].
12. **D-PG8-14: confirmed, with a residual to record.** In Claude Code a `disallowedTools` entry with a specifier removes the whole tool [VERIFIED: evidence record E8]. Residual: today a background child of an agent with no `tools` list loads the engine as an ambient extension, and the engine activates `workflow` and `workflow_control` in it when no tool search is active [VERIFIED: engine `src/pi-extension.ts:337-347`; pi-subagents `child-launch.js:206`, `child-session.js:456-476`]. Claude Code gives neither to a subagent. S5(a) measures this arm. Whether the bridge should write `excludeTools` for it is a new question for the maintainer, not part of this phase.

## Architectural Responsibility Map

The tiers are the project's own layers. [VERIFIED: `.planning/codebase/ARCHITECTURE.md`]

| Capability | Primary tier | Secondary tier | Rationale |
| --- | --- | --- | --- |
| Literal `agentType` values of a script | `domain/workflow-script.ts` (`readAgentTypes`, exists) | none | Pure AST read; already on `NamedWorkflow.agentTypes`. |
| Join of scripts with the plugin's agents, and the note text | `orchestrators/plugin/discover-names.ts` | `orchestrators/plugin/info.ts` (preview consumer) | Fallow zones forbid a bridge importing a sibling bridge; this module already holds both discoveries. |
| Printing the note | `install-outcome.ts`, `update-swap.ts` (discovery warnings), `info.ts` (`notes`) | `shared/staging-warnings.ts` | The three existing sites of the PG-SEC-01 notes. |
| Binding `agentType` to an agent file | The workflow engine (companion) | `bridges/agents/convert.ts` writes `name: <plugin>:<agent>` | The engine owns its registry; the bridge owns the name it declares. |
| Run-path behavior (args, schema, worktree, nesting) | The workflow engine | none | Guard scenarios only. |
| Two scripts with one name | `bridges/workflows/stage.ts` calls `assertNoWorkflowNameCollisions` (exists) | `shared/errors.ts` | No change; guard scenario. |
| What a workflow subagent can reach | Engine settings (user-owned) | `docs/workflows-compatibility.md` | D-PG8-09: this extension writes no engine setting. |
| `Workflow` grant (only under option B) | `bridges/agents/convert.ts` (`TOOL_MAP`, launch mode) | pi-subagents and the engine enforce it | Pure conversion with owner tests. |
| Real-child live run | `features/lib/real-subagent-child.ts` | `features/step_definitions/plugin/subagent-hooks.steps.ts`, `test/integration/` | The only harness that runs a real detached child. |

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| PG-WF-02 | (a) A workflow's `agent("...", {agentType: "<plugin>:<agent>"})` runs the plugin's bridged agent, and a scenario proves it. (b) The install of a plugin whose script names an `agentType` that the plugin does not install prints one note for each such name and still installs. (c) The compatibility page no longer says an unresolved `agentType` is not an error in Claude Code. Lands with or after PG-SEC-01. (P1) | R2 (join, set of installed agents, engine registry), R3 (probe P6 shows both texts), R8 (line 126), evidence record E1. |
| PG-WF-07 | Scenarios cover a run the model starts by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts with one `meta.name`. (P1) | R4: measured rows of probes P1-P5b, the missing step, the profile. Evidence records E5, E7. |
| PG-WF-04 | The workflow compatibility page says what a workflow subagent can reach, names the engine settings `inheritMainModel` and `providerMiddlewareExtensions`, and says that Pi's built-in MCP cannot load in a subagent and that plugin hooks do not run there. (P1; spike S5 for the adapter setting) | R5 (engine 3.15.0 lines), R1 (S5(b) design), R8 (lines to change), evidence records E2, E6. |
| PG-WF-05 | A bridged agent whose source grants `Workflow` or `Workflow(<name>)` can start the plugin's workflow when the plugin stages one, and such an agent runs in the background. (P1; spike S5; confidence Low) | R6: the premise is wrong upstream (E3, E4). R1 (S5(a) design). The mechanics for option B are in R6. |

Requirement text is quoted from `.planning/REQUIREMENTS.md:49-52`. [VERIFIED: file read this session]

</phase_requirements>

## Project Constraints (from AGENTS.md)

These directives bind the plans. [VERIFIED: AGENTS.md of the worktree and the four named skills, read this session]

- Read a file before editing it, and trace a function's callers before changing it. Use CodeGraph (`npx --no codegraph explore "<symbols>"`) before grep. Keep changes surgical.
- Work on `features/gaps-agents` inside the GSD workflow. Never commit to `main`, never rebase, never use `--no-verify`. Follow `.agents/skills/committing/SKILL.md`.
- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. "Our way is simpler" and "upstream looks wrong" go to the user as a question. This rule decides PG-WF-05 (Amendment 1).
- A user-visible change to `/claude:plugin` behavior ships a cucumber scenario that fails without it. Unit tests and direct coverage do not replace it. The PG-WF-02(b) note is such a change. PG-WF-02(a) and PG-WF-07 change no behavior, so each scenario records one mutation in the plan SUMMARY (D-PG8-07).
- Every production source has exactly one owner test at the mirrored path, with 100% line, function, and branch coverage when the pair runs alone. Do not test a source from another module's test.
- Use `node:test`, `node:assert/strict`, and `strong-mock` only.
- Two complexity gates apply to every function: ESLint `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15 with `maxCyclomatic` 20. `fallow dupes` fails on every clone group.
- One output channel: `notify()` through `shared/notification-dispatch.ts`. No `console.*` or stdio in the extension.
- NFR-10 containment: this extension writes nothing under the engine's settings (D-PG8-09). NFR-5: this phase adds no network use. APL-D1: nothing new runs at load.
- Comments and test titles cite decision and requirement IDs (D-PG8-NN, PG-WF-02), never phase, plan, or wave numbers. No comment on trivial code.
- Gates: the commit hook runs `npm run check:commit`; each wave merge, the phase gate, and the handoff run `npm run check` on the combined tree. A passing hook is not a gate.
- Each plan `SUMMARY.md` includes `## Threat Flags`. Prefix each `gsd-tools windows append --description` with `[parity-gaps]`.
- Tests, probes, and the spike use a hermetic home only. Never read, list, stat, or write the real `~/.pi/agent`. Say so in every executor dispatch.
- Compatibility records follow `.agents/skills/claude-code-compat-research/SKILL.md`. README changes follow the `readme` skill: `README.es.md` stays in sync.
- This phase edits only its directory and the ROADMAP Phase 8 plan list; shared planning files are the parent's (CONTEXT "Parent lines").

## Standard Stack

No package is added, removed, or upgraded. [VERIFIED: versions read from the installed tree this session]

| Component | Version in the tree | Use in this phase |
| --- | --- | --- |
| `@earendil-works/pi-coding-agent` | 1.5.0 | Host of every scenario; `createAgentSession` for engine and pi-subagents children. |
| `@quintinshaw/pi-dynamic-workflows` | 3.15.0 in `node_modules/.cache/optional-peers` (declared floor `>=3.15.0 <4`) | Runs the scripts; owns the `workflow` tool, the agent type registry, and its settings file. |
| `pi-subagents` | 0.88.1 (suite version, `test/integration/optional-peer-suite-versions.json`); declared floor `>=0.87.0` | Runs bridged agents; the S5(a) child. |
| `pi-mcp-adapter` | 7.0.1 (declared floor) | S5(b); adapter-profile scenarios. |
| `@cucumber/cucumber` | `^13.3.0` | Scenarios. |
| `git` | 2.56.0 on this machine | The worktree scenario and the engine's `git worktree add`. |

**Installation:** none. `node scripts/install-test-peers.mjs` fills the optional-peer cache; the npm test scripts run it first.

## Package Legitimacy Audit

This phase installs no external package. No audit is needed.

## Architecture Patterns

### System data flow

```text
plugin source (untrusted)
  workflows/*.js ──> [bridges/workflows/discover.ts] ──> verdicts (named | skipped | refused)
                          named: fileName, generatedName, agentTypes (literal agentType values)
  agents/**/*.md ──> [bridges/agents/discover.ts]   ──> discovered agents (AG-12 dedupe)
                                   |
                                   v
            [orchestrators/plugin/discover-names.ts]  pure join, recomputed, never stored
              PG-SEC-01: type names a restricted agent of the plugin  -> note (exists)
              PG-WF-02:  type starts "<plugin>:" and names no agent   -> note (new)
                                   |
        +--------------------------+---------------------------+
        v                          v                           v
 install-outcome.ts         update-swap.ts                  info.ts
 discoveryWarnings          stagingWarnings                 notes (redacted)
 (install, enable,          (update, reinstall,
  import, apply)             apply moves)
        |
        v
 install diagnostic: Plugin "demo" [user] installed; N declared components have notes.

run time (engine-owned, guard scenarios only)
 /demo:scan or workflow({name, args}) ──> engine loads <saved dir>/demo:scan.json
   agent(prompt, {agentType}) ──> registry: <cwd>/.pi/agents, <agent dir>/agents, ~/.pi/agents
        found   ──> agent body is put before the task text
        missing ──> "Act as workflow subagent type: <name>" and default tools and model
   child session: noExtensions, read/bash/edit/write, structured_output when a schema is set
```

### R1. Spike S5: design, harness, predictions

The spike is task 1 of plan 01 and was not run in this research.

**How a real background child loads extensions** [VERIFIED: pi-subagents 0.88.1 source, read this session]

- The detached runner sets `PI_SUBAGENT_CHILD=1` for itself (`src/runs/background/subagent-runner.js:92`). The runner inherits the parent's environment, minus git routing variables and extension bindings (`src/runs/background/async-execution.js:543-561`), so `PI_CODING_AGENT_DIR` and `HOME` reach the child.
- A child of the runner loads ambient extensions unless the agent sets `extensions` or a capability ceiling denies them: `const ambientExtensions = input.host === "runner" && !toolPlan.disableAmbientExtensions;` (`src/runs/shared/child-launch.js:206`). The session's resource loader gets `noExtensions: !launch.ambientExtensions` (`src/runs/shared/child-session.js:460`). So Pi's own discovery loads every extension the user's `settings.json` names, the engine included.
- A foreground child is built in the parent process with `host: "parent"`, so it loads no ambient extension. This confirms D-PG8-13. Its missing-tool error is: "ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable" (`src/runs/shared/tool-availability.js:9-18`).
- pi-subagents registers nothing in such a process (`index.js:3-7`), so the engine and this extension are the extensions that act there.
- The child session gets `tools: launch.tools` when the agent has an explicit list (`child-session.js:554`), and Pi then allows and activates only those names (`node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.js:153-160`).
- With an explicit list, every listed built-in name is a required tool. At `agent_start`, a missing one throws (`src/runs/shared/child-tool-plan.js:265-273`, `subagent-prompt-runtime.js:689-696`).

**What the engine does when it loads** [VERIFIED: engine 3.15.0 source]

- It has no child check. Its factory registers both tools at once: `pi.registerTool({ ...workflowTool, ...DEFERRED_EXPOSURE });` and the same for `workflowControlTool` (`src/pi-extension.ts:184-186`).
- On `session_start` it registers the saved workflows as commands (`registerAllSavedWorkflows`, `:324`) and, when no `tool_search` tool is active, activates `workflow` and `workflow_control` (`:337-347`). An SDK session loads no built-in tool search, so in a child with no `tools` list both tools become active. With an explicit list, Pi keeps only allowed names in the registry (`agent-session.js:2893-2901`), so `workflow_control` stays out unless listed.
- The `workflow` tool resolves `name` through `storage.load(name)` and then the built-ins (`src/builtin-workflows.ts:145-155`). The storage reads `<workflow home>/projects/<key>/saved/`, `<cwd>/.pi/workflows/saved/`, and `<workflow home>/saved/` (`src/workflow-saved.ts:280-320`), where the home is `$PI_CODING_AGENT_DIR/workflows` or `~/.pi/workflows` (`src/workflow-paths.ts:30-34`). `platform/workflow-home.ts:33-41` computes the same root, so a child finds the envelopes this extension wrote.
- Default mode is background: "the tool returns immediately with a run ID ... and the result is delivered back into the conversation when it finishes" (`src/workflow-tool.ts:93-97,323-340`). `background: false` blocks and returns the result in the same turn (`:342-420`), and requires at least one `agent()` call (`:413-417`).
- Result delivery uses a captured `AgentSession.sendCustomMessage` with `{ triggerTurn: true, deliverAs: "followUp" }` (`src/task-panel.ts:821-870`). When the session shuts down for a reason that is not a replacement, the engine pauses its live runs: `pauseStrandedWorkflowRuntime(runtime)` (`src/pi-extension.ts:251`). pi-subagents shuts a finished child down with `reason: "quit"` (`child-session.js:488`).
- A workflow's own subagents never get `workflow`: `export const DEFAULT_EXCLUDED_SUBAGENT_TOOLS = ["workflow", "workflow_control"];` (`src/agent.ts:783`).

**What the Phase 3 real-child harness can do today** [VERIFIED: `features/lib/real-subagent-child.ts`, read in full]

| Capability | State | Where |
| --- | --- | --- |
| Hermetic fixture under the OS temp folder: HOME, agent dir, trusted project, local marketplace with plugin `demo` | Yes | `createFixture`, `:444-500` |
| Loopback OpenAI-compatible scripted provider, dummy key, `PI_OFFLINE` | Yes | `startProvider`, `:380-421`; scripts are keyed by a bracketed marker in the last user text |
| Records each request's last user text, model, and **declared tool names** | Yes | `ProviderRequest`, `:272-276,391-395` |
| Real main Pi in RPC mode that installs the plugin with `/claude:plugin` | Yes | `withMainRun`, `installPlugin` |
| Real detached children, launched by the main Pi's model through `subagent`, with no launch mode in the call | Yes | `launchChild`, `detachedChild` read `status.json` and the child's session file |
| Ambient extensions in children: this extension and the adapter, through `settings.json` `extensions` | Yes | `writePiConfiguration`, `:504-522` |
| The engine as a companion in the main Pi and in children | **No** | `resolveCompanion("pi-dynamic-workflows")` exists (`features/lib/companions.ts:21,58`); the fixture does not use it |
| A workflow in the fixture plugin | **No** | The fixture writes agents, hooks, and a stub MCP server only |
| A scripted `workflow` call | **No** | `NAMED_CALLS` (`:996-1000`) holds `bash`, `failing read`, `stub mcp tool` |
| The text of a tool result the child received | **No** in the provider log; **yes** in the child's session file, whose path `status.json` records (`:798-805`) |
| Cucumber steps over it | Yes | `features/step_definitions/plugin/subagent-hooks.steps.ts:379-403,513-556`; the step text names "a plugin with a stub mcp server", so a workflow fixture needs a new step text |

The standard cucumber world cannot run a background child: such a child loads neither the world's `--extension` companions nor the scripted model [VERIFIED: `.planning/BACKLOG.md:4586`].

**S5(a): what to run**

Build the probe as a scratch copy of the real-child fixture (not committed unless it becomes the proof of criterion 5), with these additions:

1. Add the engine's entry to the main Pi's `extensions` and to the `ambient` list of `writePiConfiguration`.
2. Add `workflows/scan.js` to the plugin `demo`:

   ```js
   export const meta = {name:"scan",description:"Scans the project."};

   return "scan: " + (await agent("[pg8-step] Say the word."));
   ```

   The provider has no script for `[pg8-step]`, so it answers `Done.`, and the run returns `scan: Done.`.
3. Two agents. `ambient`: `background: true`, no `tools`. `listed`: `background: true`, `tools: Read`; after the install, replace `tools: read` with `tools: read, workflow` in its generated file `pi-claude-marketplace-demo-listed.md`. That is the form option B would write, and it is the arm with the required-tool check.
4. Three scripted child calls, each in a run of its own: `workflow {"name":"demo:scan","background":false}`; `workflow {"name":"demo:scan"}` (the default a real model sends); and for `listed`, the first call again from a main-session launch with `"async": false` as the negative control.

**S5(a): deciding observations**

| # | Observation | Passes when | A failure means |
| --- | --- | --- | --- |
| a1 | The declared tool names of the child's provider request (last user text holds the task marker) | The list holds `workflow`, for `ambient` and for `listed` | The engine did not load in the child, or Pi does not declare a deferred tool there. S5(a) is negative. |
| a2 | `status.json` of the run | `state` is `complete` | For `listed`, a `failed` state with "requested unavailable child tools: workflow" means the engine does not register its tool in a runner. |
| a3 | A provider request whose last user text holds `[pg8-step]` | It arrives | The engine could not create its own subagent inside the runner process. |
| a4 | The `workflow` tool result in the child's session file, for the `background: false` call | The text holds `scan: Done.` | The result did not reach the child. S5(a) is negative for the requirement. |
| a5 | For the default call: the tool result, then the engine's run record under `{agent dir}/workflows/projects/<key>/runs/` after the runner exits, and whether a later provider request to the child carries the result | Recorded, not judged | This row decides what the compatibility text can promise for a real model. |
| a6 | The `"async": false` control | The `subagent` call fails and names `workflow` | A pass here would contradict D-PG8-13. |

**S5(a): prediction** [ASSUMED: derived from the source lines above; only the run decides]

- a1 to a4 pass. Confidence MEDIUM. Nothing in the engine checks for a child, and the extension loads through Pi's normal discovery. Risks: the engine's entry file imports the host SDK with a top-level `await import("@earendil-works/pi-coding-agent")` (`extensions/workflow.ts`) and patches `AgentSession` (`installHostSessionCapture`), both inside pi-subagents' runner, which loads Pi through its own peer loader; the engine keeps a process-wide runtime slot (`claimWorkflowRuntime`, `src/pi-extension.ts:129`), which matters when one runner hosts several children.
- a5: the tool returns the "started" text, the child's model ends its turn, the runner shuts the session down, and the engine pauses the run. The result does not reach the child. Confidence MEDIUM. If this holds, option B would also need the agent's model to pass `background: false`, which no plugin text asks for.

**S5(b): how the setting is matched** [VERIFIED: engine `src/agent.ts:269-332,940-1000`]

- The engine reads `providerMiddlewareExtensions` from its settings, in this order (later wins): `<workflow home>/settings.json`, `<cwd>/.pi/workflows/settings.json`, `<workflow home>/projects/<key>/settings.json` (`src/workflow-settings.ts:96-135`).
- For a non-builtin name it asks Pi's `DefaultPackageManager` for the configured, enabled extensions and keeps the ones `isProviderMiddlewareExtensionPath` admits. A path is admitted by one of three identities, compared in lower case: the file name without its suffix, the package name after the last `node_modules` segment, or the name of the package source (`npm:<name>`, or the last path segment of a local or git source).
- The adapter's entry is `index.ts` [VERIFIED: its `package.json` `pi.extensions`], so the file identity is `index`. The identity that matches `pi-mcp-adapter` is the package name or the `npm:` source. Both hold for a normal `pi install npm:pi-mcp-adapter`, and the package-name identity holds for the peer cache path.
- Any path with a segment named `pi-dynamic-workflows`, `workflow`, or `pi-subagents` is refused, also when listed: `const RECURSIVE_SUBAGENT_EXTENSION_NAMES = new Set(["pi-dynamic-workflows", "workflow", "pi-subagents"]);` (`:271`). A user whose home path holds a folder named `workflow` cannot opt in. Say so on the page only if S5 or a reader report shows it.
- Each child then gets a loader of its own with `noExtensions: true` and the admitted paths as `additionalExtensionPaths` (`:988-997`). The README says: "Opted-in factories and runtimes are isolated per child session and receive `session_shutdown` before disposal" [CITED: engine `README.md:256`].

**S5(b): what to run**

Use the same fixture in the adapter profile, in the main session (no pi-subagents child is needed):

1. Write `{agent dir}/workflows/settings.json` with `{"providerMiddlewareExtensions":["pi-mcp-adapter"]}`.
2. Keep the adapter in `settings.json` `extensions` (the fixture already does) and seed its tool cache as the real-child fixture and the step "pi-mcp-adapter has listed the tools of the stub mcp server" do.
3. Run a workflow command whose `agent()` step's scripted model calls the stub tool. This extension writes `directTools: "search"` for a plugin server [VERIFIED: `domain/mcp-server-features.ts:245`], so the adapter keeps the plugin tool out of the first request and offers it through its `mcp` tool. Script both forms: a call of the adapter's `mcp` tool for the stub tool, and a direct call of `mcp__plugin_demo_stub__echo`.

**S5(b): deciding observations**

| # | Observation | Passes when |
| --- | --- | --- |
| b1 | The declared tool names of the workflow subagent's provider request | The list holds the adapter's `mcp` tool (and the plugin tool, if the adapter declares it) |
| b2 | The tool result, and the stub server's message log | The log holds a `tools/call`, and the result holds the echoed text |
| b3 | The run's last progress entry, and Pi's records | `completed`; no `extension_error` |
| b4 | A plugin tool call from the main session after the run | It still works, so the second adapter instance did not disturb the first |
| b5 | Control: the same run with no settings file | The request declares no adapter tool |

**S5(b): prediction** [ASSUMED] b1 passes for the `mcp` tool. b2 is uncertain: adapter 7.0.1 creates its runtime per instance (`createMcpRuntimeOwner`, `runtime-owner.ts:12-50`), which favors a pass, but a second instance in the parent's process, with its own stdio server per child, was never run. Confidence LOW to MEDIUM. A direct call of the plugin tool is likely refused, because a search-mode tool is not declared before a search.

**Records.** `08-SPIKE-S5.md` holds the exact command, fixture, versions (`RealChildVersions` already reports Node, pi-subagents, and the adapter; add the engine), exit status, and the deciding output of each row. The S5 "Result" cell of PRD section 9 gets the short form. Pin the versions the suite installs: pi-subagents 0.88.1, engine 3.15.0, adapter 7.0.1.

### R2. PG-WF-02(b): the join

**The model.** `workflowAgentRestrictionNotes` (`orchestrators/plugin/discover-names.ts:168-185`) takes the plugin name, the discovered agents, and the discovered workflows, and returns one note per pair of an admitted script and a restricted agent type. Three sites consume it [VERIFIED: grep this session]:

| Site | Line | Verbs |
| --- | --- | --- |
| `orchestrators/plugin/install-outcome.ts` | `:1254` `...generatedNames.workflowAgentRestrictionNotes.map(discoveryWarning),` | install, enable, import, apply installs |
| `orchestrators/plugin/update-swap.ts` | `:1713` (same expression) | update, reinstall, apply moves |
| `orchestrators/plugin/info.ts` | `:1270-1298` `previewAgentRestrictionNotes`, into `notes` at `:1154-1175` | `info` |

**What discovery knows.** The set of agents the bridge will write equals the discovered set on every install that succeeds (Amendment 5). So compare with the discovered agents. The comparison name is `declaredAgentName(pluginName, agent.sourceName, agent.namespace)`, which joins the plugin, the folders, and the source name with `:` and elides nothing (`domain/name.ts:594-606`). It is the `name:` the bridge writes (`convert.ts:980`, "AG-1a").

**How the engine resolves an agent type** [VERIFIED: engine `src/agent-registry.ts:148-194`, `src/workflow.ts:1074,1119-1120,2840-2843`; probe P6]

- It reads `*.md` files of `<cwd>/.pi/agents/`, then `<agent dir>/agents/`, then `~/.pi/agents/`, and keeps the first definition of each name.
- The key is the frontmatter `name`, trimmed, or the file name without `.md` when there is none. It reads frontmatter with Pi's `parseFrontmatter`.
- The lookup is `registry.get(name)`: exact, with no alias. So the `aliases` entry of a bridged agent (the flat name `pi-claude-marketplace-<plugin>-<agent>`) does not resolve in the engine. The PG-SEC-01 join also maps the generated name; PG-WF-02 does not need it, because a generated name does not start with `<plugin>:`.
- A name with no definition is logged and replaced by a prose hint: `unknown agentType "${agentOptions.agentType}"; using default tools/model`, and the task text starts with `Act as workflow subagent type: <name>`. Probe P6 measured it: the model received `Act as workflow subagent type: demo:ghost\n\nTask label: agent 2\n\nAnswer again.`, and the run completed.
- The registry reads any file in those folders, whoever wrote it, and it works with pi-subagents absent.

**Residuals to record, not to code.**

1. A file the user wrote in an agents folder with `name: demo:ghost` binds in the engine, and the note would then be wrong. The name must imitate the plugin's namespace by hand. Accepted: the note states what the plugin installs.
2. An agent file of the plugin that the user edited keeps its old bytes at update (AG-5, `bridges/agents/stage.ts:195-211`). If the user changed its `name:`, the engine no longer binds the plugin's name, and no note says so.
3. A non-literal `agentType` gives no note (the D-PG4-11 residual).

**Recommended change.**

- Add one pure function beside the existing one. It keeps the literals that start with `${pluginName}:` and are not in the set of declared names, and returns one note per distinct pair. `NamedWorkflow.agentTypes` is already distinct per script and in first-seen order (`domain/workflow-script.ts:886-896`).
- Return both kinds of note through one field, so no consumer can forget the new kind. Rename the field and the function for what they hold (for example `workflowAgentNotes`), and keep the two builders private. Order: per script, in the order the script names the types. The three sites then need only the rename.
- Build the note with the shared lead of `restrictionNote` (`discover-names.ts:136-145`): the script file name, the base name of its folder, and the agent type, each through `forMessage`. Share that lead in one helper; a second copy of it would be a clone group for `fallow dupes`.
- `info` already skips the agent read when no admitted script names an agent type (`info.ts:1276-1281`) and already swallows a throw of the agent read (`:1294-1297`). Both stay right for the new note.
- Text (D-PG8-05): `workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run`. Probe P6 backs "runs a default agent"; evidence record E1 backs "stops the run".

**Zones.** `orchestrators/` may import the bridge barrels and `domain/` [VERIFIED: `.fallowrc.json` boundaries, as `discover-names.ts:25-30` already does]. The new code names no git surface, so ESLint BLOCK F does not apply. No new module is needed.

### R3. PG-WF-02(a): the binding proof

The step `Then the model receives these calls:` is enough. A workflow subagent's first user message is the agent body, a blank line, `Task label: agent <n>`, a blank line, and the task [VERIFIED: probe P6; `features/workflow/agent-steps.feature:60-62`]. For a type the engine cannot bind, the message starts with `Act as workflow subagent type: <name>` instead. So a scenario whose row holds the helper's body fails when the binding breaks.

Probe P6 measured both rows in one run:

```text
| 1 | user | You are the helper of demo.\n\nTask label: agent 1\n\nAnswer the task.                    |
| 2 | user | Act as workflow subagent type: demo:ghost\n\nTask label: agent 2\n\nAnswer again.         |
```

Use an agent with no `tools` field (D-PG8-03), so no PG-SEC-01 note appears. The mutation for the SUMMARY: change the script's `agentType` to a name the plugin does not hold; the row then shows the hint line.

Two scenarios of `agent-steps.feature` already show a body in the call (`:36-62`, `:64-91`). The new one is the named proof of PG-WF-02(a), and the PG-WF-02(b) scenario can reuse its fixture with `demo:ghost`.

### R4. PG-WF-07: the five run paths, measured

All probes ran in the adapter profile with the companions `pi-subagents` and `pi-dynamic-workflows`, in the sandbox home. Workflow features carry no tag, so they run under the `adapter` profile only; the `builtin` profile runs `(@mcp or @builtin-only) and not @adapter-only` [VERIFIED: `cucumber.json`; no tag in `features/workflow/`]. That is right for these scenarios: none depends on the MCP implementation.

| # | Path | Fixture and steps (all exist) | Measured result | New step needed |
| --- | --- | --- | --- | --- |
| 1 | Model starts by name with object `args` | Script `return "who=" + args.who + " n=" + args.items.length;`. Scripted steps: `workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}}`, then a reply. `When the user prompts "..." and the model starts a workflow run` | `completed`, result `who=Ada n=2`. Call 2 holds `tool call workflow {...}` and `workflow returned: started the workflow echo` | None |
| 2 | `agent({schema})` | Script calls `agent("Judge the change.", {schema:{type:"object",properties:{verdict:{type:"string"}},required:["verdict"]}})` and returns `"verdict=" + verdict.verdict + " type=" + typeof verdict`. One scripted step: `structured_output {"verdict":"pass"}` | `completed`, result `verdict=pass type=object`. One model call, whose user text ends with the engine's "Final output contract" lines | None |
| 3 | `isolation: 'worktree'` | Three `agent()` steps; the second has `{isolation:"worktree"}`. The scripted model runs `bash` in each | `completed`. Step 2 ran on branch `pi/wf/iso-<run id>-1-agent-2-<uuid>` in `{project dir}/.pi/worktrees/<same name>`; its user text starts with `Requested isolation: worktree`. Step 3, after step 2 ended, still listed the branch and the worktree | A `Given` that makes the project a git repository with one commit (see below) |
| 4 | `workflow()` to a sibling | `outer.js`: `const answer = await workflow("demo:inner", {word:"hi"}); return "outer: " + answer;`. `inner.js`: `return "inner got " + args.word;`. `When the user runs the workflow command "/demo:outer"` | `completed`, result `outer: inner got hi`, notice `started /demo:outer` | None |
| 5 | Two scripts with one `meta.name` | `a.js` and `b.js`, both `name:"scan"`. `When the user runs "/claude:plugin install demo@fixtures --scope user"` | Result fields: `kind` `cascade`, `severity` `error`, `needs reload` `false`, `summary` `A plugin operation has failed.` Plugin row: `status` `failed`, `cause chain` `Generated workflow name collision detected. Rename the meta.name of one of the source scripts:\n  "demo:scan" <- ["a.js", "b.js"]`, `cause truncated` `false` | None |

Notes for the writer:

- **Scenario 1** differs from "The model starts a workflow by the name a command gave it" (`features/workflow/references.feature:66-87`) only by the `args` object. It belongs in `references.feature` or `run.feature`.
- **Scenario 2**: the terminating tool ends the child, so the script needs no reply step after it.
- **Scenario 3**: the names hold the engine's run ID (`createWorktree(baseCwd, \`${runId}-${callIndex}-${label}\`)`, engine `src/workflow.ts:1283`). The harness projects UUIDs as `{uuid}` (`features/step_definitions/model.steps.ts:33-46`), not run IDs. Make the `bash` commands print stable text, for example `git rev-parse --abbrev-ref HEAD | cut -c1-6` (gives `pi/wf/`) and, in the later step, `git worktree list | wc -l` (gives `2`) and `git branch --list 'pi/wf/*' | wc -l` (gives `1`). The later step is what shows that the engine keeps the worktree and its branch.
- **The git repository.** No step makes the session's project a git repository. The probe had the script's first `agent()` step run `git init` and an empty commit. A scenario should use a `Given` instead, built on `runGit` of `features/lib/hermetic-git.ts:36-43`, in a step module of the project or session function (not in `workflow/`, because the step names the project). An engine step in a folder that is not a repository fails as non-recoverable: `worktree isolation failed for "<label>": <reason>` (engine `src/workflow.ts:1283-1290`).
- **Scenario 5** belongs in `features/workflow/collisions.feature`. Add the two "nothing was written" steps that `features/plugin/install-rollback.feature:9-27` uses. The title names the difference: Claude Code keeps the last script that parses (E5). The check runs in the workflows phase of the ledger (`bridges/workflows/stage.ts:192`), so the install rolls back.
- **Mutations** (D-PG8-07), one per scenario, each a fixture or script edit: read `args.missing`; drop the `schema` option; drop the `isolation` option; call a name that no script declares; give `b.js` another name.
- A `Scenario Outline` is for three or more variants of one behavior [VERIFIED: `.agents/skills/cucumber/rules/features.md:34`]. These five are five behaviors; write five scenarios.

### R5. PG-WF-04: what a workflow subagent can reach

**Engine 3.15.0 facts, with lines** [VERIFIED: source read this session]

| Fact | Evidence |
| --- | --- |
| A child session is created through the host's `createAgentSession`, with the engine's coding tools as custom tools | `extensions/workflow.ts` (`installHostCreateAgentSession(host.createAgentSession, host)`); `src/agent.ts:864,1207-1234,1417` |
| A child loads no host extension by default | `src/agent.ts:269` `DEFAULT_PROVIDER_MIDDLEWARE_EXTENSIONS ... Object.freeze([])`; `:992` `noExtensions: true` |
| What still loads: "Skills, prompts, and `AGENTS.md` context still load" | [CITED: engine `README.md:379`]; comment at `src/agent.ts:894-895` |
| What is lost: "host-extension-registered tools -- MCP bridges, browser tools" | [CITED: engine `README.md:379`] |
| Opt-in per extension through `providerMiddlewareExtensions`, by file name, npm package identity, or package source name | `src/agent.ts:277-314`; [CITED: `README.md:251-253`] |
| `pi-dynamic-workflows`, `workflow`, `pi-subagents` never load in a child | `src/agent.ts:271,292,312` |
| The only builtin allowed is `builtin:codemode` | `src/agent.ts:283-285` |
| Any other `builtin:` name, `builtin:mcp` included, fails every `agent()` call as non-recoverable: `throw builtinExtensionError(name, "unsupported builtin on this host");` | `src/agent.ts:945-949`, message built at `:803-809` |
| A child never gets `workflow` or `workflow_control` | `src/agent.ts:783` |
| Model order: explicit `model` (an agent type's or a phase's model counts) > `tier` > the session's main model when `inheritMainModel` is on > the configured `medium` tier > Pi's settings default | `src/agent.ts:242-266`; [CITED: `README.md:245`] |
| The inherited model is "the model in effect when the run starts"; one that is unavailable "degrades to the settings default with a run-visible warning" | [CITED: `README.md:245`]; `src/workflow-settings.ts:44-54` |
| Settings files, later wins: `<workflow home>/settings.json`, `<cwd>/.pi/workflows/settings.json`, `<workflow home>/projects/<key>/settings.json` | `src/workflow-settings.ts:96-135` |
| The workflow home is `$PI_CODING_AGENT_DIR/workflows`, or `~/.pi/workflows` | `src/workflow-paths.ts:30-34` |

Research report rows E9 and E12 hold at 3.15.0 with these line numbers. Row N4 holds: `builtin:mcp` is refused in a child.

**Why plugin hooks and plugin skills do not reach a child.** This extension registers the hooks and passes the staged skill folders to Pi from its `resources_discover` handler. A child loads no extension, so neither happens there. Listing this extension in `providerMiddlewareExtensions` is not a remedy to document: a load takes the state lock and runs the load reconcile, and the extension's child check reads only pi-subagents' `PI_SUBAGENT_CHILD` [VERIFIED: `.planning/codebase/ARCHITECTURE.md`; `docs/research/parity-gaps/workflows.md` row N4]. A skill that an agent preloads is inlined in the agent body, so it reaches a child that runs that agent type (D-CF4-04).

**Upstream column** (evidence record E6): session model; session MCP tools through tool search; the user's, the managed, and the plugins' hooks; plugin skills through the Skill tool; the same `CLAUDE.md` files as the session.

**`parallel()` and `pipeline()`** (D-PG8-10, evidence record E2). The engine: `parallel()` and `pipeline()` return `null` for a recoverable failure and rethrow a non-recoverable one, which ends the run (`src/workflow.ts:1597-1612,1643-1660`). Claude Code maps every rejection to `null` in both. The paragraph to correct also speaks of a bare `agent()` call. For that call Claude Code returns `null` "if the user skips the agent mid-run or the subagent dies on a terminal API error after retries" and throws for an unknown agent type or an invalid schema [VERIFIED: binary prose and code, E1, E2]. So the correction is: inside `parallel()` and `pipeline()` Claude Code never rejects and the engine does; for a bare `agent()` both sides can throw, on different conditions.

### R6. PG-WF-05: the `Workflow` grant

**Upstream** (evidence records E3, E4, E8).

- A subagent never has the `Workflow` tool, whether its `tools` field is omitted or lists it. Only an agent that runs as the main thread (`claude --agent <name>` or the `agent` setting) keeps it.
- In that main-thread case, a `tools` entry `Workflow(<name>)` resolves to the whole `Workflow` tool. The resolver does not narrow the tool by the name. As a permission rule, `Workflow(<name>)` approves one saved workflow [CITED: workflows.md "Approve the plan before it runs"]. Pi asks no approval (D-CF7-01).
- A `disallowedTools` entry removes the tool with or without a specifier.

**What the bridge does today** [VERIFIED: `bridges/agents/convert.ts`]

- `TOOL_MAP` (`:92-102`) holds `["Read", "read"]`, `["Bash", "bash"]`, `["Edit", "edit"]`, `["Write", "write"]`, `["Grep", "grep"]`, `["Glob", "find"]`, `["LS", "ls"]`, `["Agent", "subagent"]`, `["Task", "subagent"]`. `Workflow` is not in it, so the token lands in `dropped` (`mapToolTokens`, `:466-489`).
- The staging reports it as a hygiene warning: `[<source>] dropped tools: Workflow, Workflow(demo:scan)` (`bridges/agents/stage.ts:305-307`). A standalone `install` does not print hygiene warnings; `apply`, `marketplace update`, and the autoupdate cascades do, and the generated file's provenance holds the list.
- `tools: Workflow` alone maps to nothing, so the install fails (AG-11). That matches Claude Code, where an agent whose `tools` resolves to nothing "usually fails to launch" [CITED: sub-agents.md, `tools` row], but there it fails at launch, not at install.
- The agent body is retargeted with `rewriteMarkdownReferences` (`:1054-1058`), so `Workflow({ name: "demo:scan" })` in a body already names the saved workflow (D-PG4-08).
- Nothing else reads the agent tool table. `listedToolNames` (the only export, used by the PG-SEC-01 join) returns Claude names. The hooks bridge has its own tool-name table. `legacy-grant-form.ts` translates only `mcp:` entries of a `tools:` line (`:68-73`), and `grant-rewrite.ts` swaps stored blocks byte for byte. [VERIFIED: grep for `TOOL_MAP`, `listedToolNames`, and `Workflow` over `extensions/`]

**Under option A (recommended): no code change to the grant.** Record in the agents section of `docs/mcp-compatibility.md` ("Customizing generated agents", near `:384`) that `Workflow` is dropped, as Claude Code removes it from every subagent, and that a plugin's commands and skills start its workflows from the main session. Optionally add `Workflow` to the deny side only, so `disallowedTools: Workflow` on an agent with no `tools` writes `excludeTools: workflow`; that touches the residual of Amendment 12 and is a maintainer question.

**Under option B: the mechanics.**

- Map `Workflow` to `workflow` only when `referenceNames.workflows` is not empty. `toolNameOf` (`convert.ts:276`) already reads `Workflow(demo:scan)` as `Workflow`, and `mapToolName` (`:445-453`) looks that name up, and `dedupePreservingOrder` keeps one `workflow` for `Workflow, Workflow(x)`.
- The deny side needs no new code: `explicitDisallow` filters by Pi name in an explicit list, and the omitted arm writes the Pi name to `excludeTools` (`:603-650`).
- Launch mode: add the grant to the condition that writes `async: true` (`:1075`), beside `backgroundForMcp`. `runsMcpTools` (`:1128-1137`) is the model. Add one warning in the style of `mcpAsyncWarning`; no code compares its text, because `grant-rewrite.ts:131` and `legacy-grant-form.ts` match only the MCP async warning's known generations.
- What `subagent get` shows: `tools read, workflow` and `async true` [VERIFIED: `features/lib/upstream/subagents.ts:79-93`; the outline at `features/agent/frontmatter.feature:1232-1264` is the model for the scenario].
- With the engine absent, pi-subagents refuses the launch (Amendment 2). `subagent get` still shows the tool.
- Installed agents change at their next `update` or `reinstall`. For an agent in a plugin with MCP servers, both stored grant forms hold the new `tools` line; old rows keep `droppedTools` with the `Workflow` tokens until then.
- Live run: extend the real-child fixture as S5(a) does, add a step text for a plugin with a workflow, and read the tool result from the child's session file.
- Security cost: see "Security Domain" (a `Read`-only agent that may start a workflow starts subagents that hold `bash`, `edit`, and `write`).

### R7. Owner tests and callers of likely-touched sources

[VERIFIED: file listings this session]

| Source | Owner test | Caller tests and integration tests to run |
| --- | --- | --- |
| `orchestrators/plugin/discover-names.ts` | `test/orchestrators/plugin/discover-names.test.ts` | `test/orchestrators/plugin/install-outcome.test.ts`, `update-swap.test.ts`, `info.test.ts` (consumers of the notes field) |
| `orchestrators/plugin/install-outcome.ts` (rename only) | `test/orchestrators/plugin/install-outcome.test.ts` | `test/orchestrators/plugin/install-flow-ledger.test.ts`, `install-flow.test.ts` |
| `orchestrators/plugin/update-swap.ts` (rename only) | `test/orchestrators/plugin/update-swap.test.ts` | `test/integration/plugin-layer-verbs.test.ts` |
| `orchestrators/plugin/info.ts` | `test/orchestrators/plugin/info.test.ts` | `test/orchestrators/plugin/info.messaging.test.ts` |
| `domain/workflow-script.ts` (no change expected) | `test/domain/workflow-script.test.ts` | `test/bridges/workflows/stage.test.ts` |
| `bridges/agents/convert.ts` (option B only) | `test/bridges/agents/convert.test.ts` | `test/bridges/agents/grant-forms.test.ts`, `legacy-grant-form.test.ts`, `grant-rewrite.test.ts`, `stage.test.ts`; `test/integration/pi-subagents-child-launch-conformance.test.ts`, `workflow-engine-agent-registry.test.ts`, `agents-adapter-grant-conformance.test.ts`, `agents-builtin-grant-conformance.test.ts` |
| `features/lib/real-subagent-child.ts` (option B, or a committed S5 proof) | none (harness) | `test/integration/pi-subagents-child-identity.test.ts`; `features/plugin/subagent-child.feature`; `features/agent/frontmatter.feature:372-408` |
| A new git-repository step | none (harness) | `npm run check:features` |

Architecture tests that read these areas: `test/architecture/no-probe-in-workflows-bridge.test.ts` (no soft-dependency probe in the workflows bridge), `test/architecture/catalog-uat/catalog-contract.test.ts` (catalog bytes), `test/architecture/behavioral-shard-coverage.test.ts` (feature folders in CI shards; a new file in `features/workflow/` or `features/agent/` needs no change).

### R8. Documentation that changes

[VERIFIED: `docs/workflows-compatibility.md` read this session]

- **Line 126, the `agentType` row.** Remove "An unresolved `agentType` is not an error on either side". Say: Claude Code 2.1.323 stops the step with `agent type '<x>' not found`; the engine logs one line and runs a default agent with default tools and model (scenario-measured at 3.15.0); the divergence is licensed by a Pi-side gap, because the engine resolves agent types; install, update, and `info` print the note; name the scenario. Keep the sentence about `aliases`, and add that the engine resolves only the `name`.
- **Line 165, the paragraph "Claude Code and the chosen engine therefore agree on the ordinary failure".** Its last two sentences say the non-recoverable case "has been neither read out of the binary nor measured". Replace them with the finding of R5. Line 177 already lists the `parallel()` residual; make the two agree.
- **New section "What a workflow subagent can reach"**, after "Script semantics" or before "Host engine requirements". Rows: tools; MCP tools; the two settings with their file paths; `builtin:mcp`; plugin hooks; plugin skills, the user's own skills, and preloaded skills; the model. Each row carries its grade ("source-read at 3.15.0", "scenario-measured at 3.15.0", "measured by spike S5 on ..."), as the page's other rows do. Point to the D-PG4-14 row at line 127 for the tool restriction.
- **`docs/output-catalog.md`.** It documents the `note:` line through two states, `installed-with-workflow-preview-note` and `installed-with-workflow-gate-note` (`:3125-3155`), each with a fixture. It has no state for the PG-SEC-01 note. A state for the new note needs a fixture under `test/architecture/catalog-uat/fixtures/` and an entry in `fixture-maps.ts`. Recommended: add one `info` state for the new note in the PG-WF-02 plan, as D-PG8-06 asks, and say in the SUMMARY that the PG-SEC-01 note still has none.
- **`docs/mcp-compatibility.md`, "Customizing generated agents" (`:374-453`)** and the READMEs: the `Workflow` sentence of R6, under either option.
- **`docs/prd/parity-gaps-prd.md` section 9**, the S5 "Result" cell (D-PG8-01).
- `.planning/BACKLOG.md` WOUT-01 and WFLENGINE-01, PROJECT.md, and CHANGELOG are the parent's edits.

### Suggested plan slices

`docs/workflows-compatibility.md` is edited by two slices, and `features/workflow/` by two, so run the slices in sequence.

1. **Spike S5** (plan 01, task 1): the scratch fixture of R1, `08-SPIKE-S5.md`, the PRD cell. No source change.
2. **PG-WF-02**: the join, its owner tests, the note in the three sites, the binding scenario, the note scenarios (install, update, `info`, and "no note" cases after `agent-restrictions.feature`), line 126, the catalog state.
3. **PG-WF-07**: the git-repository step and the five guard scenarios, with the recorded mutations.
4. **PG-WF-04**: the new section and line 165, graded by `08-SPIKE-S5.md`.
5. **PG-WF-05**: first task `checkpoint:decision` with Amendment 1 and the S5(a) record. Under option A, one docs task. Under option B, the tasks of R6.

### Anti-Patterns to Avoid

- **Planning PG-WF-05 code before the maintainer answers Amendment 1.** A pass of S5(a) shows that the grant can work, not that Claude Code parity wants it.
- **Mapping `Workflow` whenever it is granted.** The agent then cannot launch without the engine (Amendment 2).
- **A soft-dependency probe in the converter, or a third stored grant form.** The converter is pure, and the stored forms are matched byte for byte.
- **Writing the engine's settings file from this extension** (D-PG8-09, NFR-10).
- **Telling users to list this extension in `providerMiddlewareExtensions`.** Its load is not safe in a workflow child (R5).
- **A second copy of the note lead.** Share one helper; `fallow dupes` fails on every clone group.
- **A new field for the new notes beside the old one.** A consumer that forgets it compiles clean. Return one list.
- **Stating run-specific names in a scenario.** The worktree names hold the run ID.
- **Running the spike or a probe against the real home.** Every Pi of the fixture gets `HOME` and `PI_CODING_AGENT_DIR` inside the fixture.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
| --- | --- | --- | --- |
| Reading `agentType` values from a script | A second AST walk or a regular expression | `NamedWorkflow.agentTypes` (`domain/workflow-script.ts:101`) | Bounded, contained, and already tested |
| The name an agent declares | String joins in the join | `declaredAgentName` (`domain/name.ts:594`) | The same function writes the `name:` the engine keys on |
| Escaping plugin text in a note | A new sanitizer | `forMessage` (`domain/workflow-script.ts:1163`) | Covers control and format characters, bidi overrides included |
| Carrying a note to every verb | A new warning channel | `discoveryWarning` and the three existing sites | Install, update, reinstall, apply, and `info` already share them |
| A real detached child | A stand-in child | `features/lib/real-subagent-child.ts` | It launches what the installed companion launches (D-PG3-09) |
| A scripted workflow subagent | A new model stand-in | `the scripted model plays these steps:` | A child session of the engine reads the same script |
| Git in a scenario | `child_process` calls in a step | `runGit` (`features/lib/hermetic-git.ts`) | Scratch HOME, no system or global config |
| Reading the engine's run result | Parsing engine prose | `the workflow run ends with the status ... and the result ...` | Reads the progress entries tolerantly |

**Key insight:** this phase adds one pure function and scenarios. Everything else is the engine's or pi-subagents' behavior, which the scenarios pin and the page describes.

## Runtime State Inventory

Only option B of PG-WF-05 changes stored data. PG-WF-02 notes are recomputed and never stored (D-PG4-13).

| Category | Items found | Action required |
| --- | --- | --- |
| Stored data | Under option B: generated agent files and agents-index rows of installed agents that grant `Workflow` keep the old `tools` line and `droppedTools` | None at load (APL-D1). They change at the next `update` or `reinstall`; say so in the CHANGELOG line |
| Live service config | The engine's settings files are the user's; this extension never writes them | None |
| OS-registered state | None -- nothing in this phase registers with the OS | None |
| Secrets and env vars | None -- no new variable is read. The spike relies on `PI_CODING_AGENT_DIR` reaching the runner, which it does (R1) | None |
| Build artifacts | None -- no package or generated artifact changes | None |

## Common Pitfalls

### Pitfall 1: the spike calls `workflow` with its default mode

**What goes wrong:** the tool returns "started", the child ends, and the result never arrives. The spike then reads as "the engine does not work in a child".
**How to avoid:** call with `background: false` for the main verdict, and record the default call as a row of its own (R1, a4 and a5).

### Pitfall 2: a synchronous run of a script with no `agent()` call

**What goes wrong:** `workflow scripts must call agent() at least once` fails the tool call. The existing fixture helper `workflowScriptText` writes such a script.
**How to avoid:** the spike's script calls `agent()` once.

### Pitfall 3: S5(b) with the adapter on the command line only

**What goes wrong:** the engine's package manager does not list the adapter, the allowlist matches nothing, and the result reads as "the setting does not work".
**How to avoid:** list the adapter in the fixture's `settings.json` and run the control with no settings file (R1, b5).

### Pitfall 4: the wrong settings path

**What goes wrong:** the spike writes `~/.pi/workflows/settings.json` under the fixture HOME, but the harness sets `PI_CODING_AGENT_DIR`, so the engine reads `{agent dir}/workflows/settings.json`.
**How to avoid:** compute the path as `platform/workflow-home.ts` does. On the page, give both paths.

### Pitfall 5: an explicit tools list hides the grant problem in the spike

**What goes wrong:** an agent with no `tools` gets `workflow` as an ambient tool, and the spike passes without ever testing the required-tool check.
**How to avoid:** run both arms of R1.

### Pitfall 6: a note for a name another install provides

**What goes wrong:** a note fires for `general-purpose` or `other:agent`.
**How to avoid:** the trigger is the `<plugin>:` prefix (D-PG8-04). Unit cases: bare name, another plugin's name, the generated flat name, a nested name `demo:review:security`, the plugin name alone with a colon.

### Pitfall 7: a duplicate that discovery dropped

**What goes wrong:** the join reads the plugin's files itself and counts an agent that AG-12 dropped.
**How to avoid:** take `agentsDiscovery.discovered` as it is. A script that names the dropped duplicate gets the note, which is right.

### Pitfall 8: the `info` preview throws

**What goes wrong:** an unsafe agent name makes `discoverPluginAgents` throw, and the row fails.
**How to avoid:** keep the new note inside the existing `try` of `previewAgentRestrictionNotes` (`info.ts:1283-1297`): a note may cost itself and never the row.

### Pitfall 9: complexity and clone gates

**What goes wrong:** a combined join function passes one cognitive-complexity gate and fails the other, or the two note builders form a clone group.
**How to avoid:** one small function per note kind, one shared lead helper. Run `npm run check:static` after each task.

### Pitfall 10: profile and tag assumptions

**What goes wrong:** a new workflow scenario is expected to run under `builtin`, or a real-child scenario is written without `@mcp`.
**How to avoid:** untagged scenarios run under `adapter` only. The real-child scenarios of `features/agent/frontmatter.feature:384` carry `@mcp` because their fixture has an MCP server. `npm run check:features` checks the tags.

### Pitfall 11: a scenario that passes for the wrong reason

**What goes wrong:** the note scenario checks only that the install succeeded, or the binding scenario checks only the result text, which the scripted model supplies.
**How to avoid:** state the whole diagnostic line and the whole call table. The call text is what the engine built; the result text is what the script replayed.

### Pitfall 12: stale line numbers

**What goes wrong:** the PRD names line 164; the paragraph is on line 165 today, and an earlier plan may move it.
**How to avoid:** find the paragraph by its first words, not by number.

## Code Examples

Skeletons only. Names are the planner's. Each literal is quoted from a source read this session: `"named"`, `agentTypes`, `fileName`, and `scriptFile` (`discover-names.ts:175-181`; `domain/workflow-script.ts:82-101`), `sourceName` and `namespace` (`discover-names.ts:54-59`), the note lead (`discover-names.ts:144`).

### The join (D-PG8-04)

```ts
// orchestrators/plugin/discover-names.ts
function missingAgentTypeNotes(
  pluginName: string,
  agents: readonly RestrictionAgent[],
  workflows: readonly RestrictionWorkflow[],
): readonly string[] {
  const ownPrefix = `${pluginName}:`;
  const installed = new Set(
    agents.map((agent) => declaredAgentName(pluginName, agent.sourceName, agent.namespace)),
  );

  return workflows.flatMap(({ verdict, scriptFile }) =>
    verdict.outcome === "named"
      ? (verdict.agentTypes ?? [])
          .filter((agentType) => agentType.startsWith(ownPrefix) && !installed.has(agentType))
          .map((agentType) => missingAgentTypeNote(verdict.fileName, scriptFile, agentType))
      : [],
  );
}
```

### The scenario shape for the note (after `features/workflow/agent-restrictions.feature:19-45`)

```gherkin
When the user runs "/claude:plugin install demo@fixtures --scope user"
Then the command reports these results:
  | kind       | severity | needs reload | header                                                           | lines                |
  | cascade    | info     | true         |                                                                  |                      |
  | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | <the whole note text> |
Then the workflow install diagnostic reports these lines:
  | line                  |
  | <the whole note text> |
```

### The model-started run with `args` (probe P1)

```gherkin
Given the scripted model plays these steps:
  | reply        | tool     | arguments                                                    |
  |              | workflow | {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}} |
  | Run started. |          |                                                              |
When the user prompts "Start the echo." and the model starts a workflow run
Then the workflow run ends with the status "completed" and the result "who=Ada n=2"
```

## State of the Art

| Old statement | Current fact | Source | Impact |
| --- | --- | --- | --- |
| "An unresolved `agentType` is not an error on either side" (`docs/workflows-compatibility.md:126`) | Claude Code throws; the engine runs a default agent | E1; probe P6 | Line 126; the note |
| Claude Code's non-recoverable failure "neither read out of the binary nor measured" (`:165`) | `parallel()` and `pipeline()` map every rejection to `null` | E2 | Line 165 |
| "A bridged agent whose source grants `Workflow` can start the plugin's workflow" (PG-WF-05, PRD WF-05) | Claude Code gives `Workflow` to no subagent | E3 | Amendment 1 |
| "Workflow subagents get no tools" (BACKLOG WOUT-01) | They get `read`, `bash`, `edit`, `write` since engine 3.13.1; probe P3 ran `bash` in three of them at 3.15.0 | Probe P3 | Parent's BACKLOG edit |
| Research report: no MCP, hooks, or skills in a workflow subagent | True for extension tools, plugin hooks, and plugin skills; the user's own Pi skills and `AGENTS.md` do load | Engine `README.md:379` | The new section |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
| --- | --- | --- | --- |
| A1 | S5(a) passes with `background: false`: the engine loads in a real background child, declares `workflow`, runs a saved workflow, and returns the result in the same turn | R1 | Option B is not feasible; the page records an engine or pi-subagents gap |
| A2 | With the default background mode the result does not reach the child, because the runner shuts the session down and the engine pauses the run | R1, Amendment 3 | If the child does get the result, option B needs no `background: false` caveat |
| A3 | S5(b): the adapter loads in an engine child and its `mcp` tool can call a plugin server | R1 | The page states the setting as not working, with the measured error (D-PG8-02) |
| A4 | A user-written agent file whose `name:` imitates a plugin's namespace is rare enough to accept a wrong note | R2 | A wrong note in that case; a hedge in the wording would fix it |
| A5 | A cap on notes per script is wanted, and its wording is the planner's to propose | Amendment 7, Security | Without a cap, a hostile script floods the install output |
| A6 | `docs/output-catalog.md` should gain a state for the new note although the PG-SEC-01 note has none | R8 | An unwanted or missing catalog state; review decides |
| A7 | Workflow subagents in Claude Code run plugin hooks and can use plugin skills. The docs state both for subagents, and the workflows page calls workflow agents subagents; no workflow-specific sentence was found | R5, E6 | The upstream column of the new section would overstate; grade it "documented for subagents" |
| A8 | A main-thread agent's `tools` entry `Workflow(<name>)` acts as a pre-approval of that workflow. The resolver read shows only that it does not narrow the tool | R6, E4 | None on Pi: Pi asks no approval either way |

## Open Questions

1. **Does the maintainer want PG-WF-05 at all (Amendment 1)?**
   - What we know: Claude Code gives the tool to no subagent; the official agent that lists it is main-session only; the plugin's skill path works on Pi.
   - What is unclear: whether "Pi has no main-session agent mode" should license a grant to a child.
   - Recommendation: option A. Put the question at the first task of the PG-WF-05 plan, with E3 and the S5(a) record.

2. **Should a bridged agent with no `tools` list keep the engine's `workflow` tool in a background child (Amendment 12)?**
   - What we know: source says it gets `workflow` and `workflow_control` when the engine is installed; Claude Code removes `Workflow` from every subagent.
   - What is unclear: whether S5(a) confirms it, and whether parity is worth an `excludeTools` line on every such agent.
   - Recommendation: record the S5(a) observation, state the difference on the page, and carry the question to the maintainer as a BACKLOG candidate. No code in this phase.

3. **How many notes may one script print (Amendment 7)?**
   - Recommendation: the first few names of a script, then one line with the count of the rest. The planner proposes the number; the maintainer reviews the wording with D-PG8-05.

4. **Does the missing-agent note cover the mapped-model case?** Deferred by CONTEXT (`MODEL_NOT_FOUND` for a `--map-model` agent type). Not researched further.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node, npm | Everything | Yes | v26.13.1 | None needed |
| Optional-peer cache | Scenarios, spike, integration tests | Yes | engine 3.15.0, pi-subagents 0.88.1, adapter 7.0.1 | `node scripts/install-test-peers.mjs` |
| Cucumber harness with scripted model | PG-WF-02, PG-WF-07 scenarios | Yes | Seven probes ran, 28 s for six scenarios in parallel | None needed |
| `git` on `PATH` of the profile Pi | Worktree scenario; engine `git worktree add` | Yes | 2.56.0; probe P3 ran it inside the sandbox | None; the scenario fails without git |
| Linux `/proc` | The real-child fixture finds its processes there (`real-subagent-child.ts:579-591`) | Yes | Fedora 44 | None on other systems |
| Claude Code binary | Evidence only | Yes | 2.1.323 at the Homebrew cask path | Docs pages |
| GSD tooling in the worktree | Planning records | Yes | `.claude/gsd-core/bin/gsd-tools.cjs` | None needed |
| Network | Nothing in the phase. Research fetched two docs pages and one public GitHub file | Not needed | none | none |

**Missing dependencies with no fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` and `workflow.test_command` is `npm run check`. [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
| --- | --- |
| Framework | `node:test` owner tests; Cucumber 13.3.0 scenarios under the `adapter` and `builtin` profiles |
| Config file | `cucumber.json`; no runner config for `node:test` |
| Owner test | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| One named unit test | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test --test-name-pattern '<title>' <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` |
| Integration file | `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test/integration/file>` |
| One scenario | `npx cucumber-js --profile <adapter\|builtin> --name '<scenario title>'` |
| Feature paths | `npm run test:cucumber:profile -- --profile adapter features/workflow` |
| Static gate | `npm run check:static` (type check, ESLint, fallow, Prettier, pairing, `check:features`) |
| Full gate | `npm run check` |

### Phase Requirements → Test Map

"Fails without the change" is the direction each check must have. For a guard scenario it is the recorded mutation.

| Req ID | Behavior | Type | Owner (file) | Automated command | Fails without the change, or under the mutation, because | File exists? |
| --- | --- | --- | --- | --- | --- | --- |
| PG-WF-02 | Join: own-namespace literal with no agent gives a note; bare name, other plugin, generated flat name, nested name that exists, non-literal, skipped or refused script give none; one note per distinct pair; order; the cap | unit | `test/orchestrators/plugin/discover-names.test.ts` | owner test and pair coverage | No such note exists | Yes, extend |
| PG-WF-02 | The note text escapes control and bidi characters of the script name, folder, and agent type | unit | same | owner test | A raw newline or override would reach the line | Yes, extend |
| PG-WF-02 | Consumers print the combined notes once | unit | `test/orchestrators/plugin/install-outcome.test.ts`, `update-swap.test.ts`, `info.test.ts` | owner tests | A renamed field that a site does not read fails to compile; a site that drops the notes fails its case | Yes, adjust |
| PG-WF-02 | (a) `agentType: "demo:helper"` runs the helper: the model call holds the agent body | cucumber | `features/workflow/agent-steps.feature` | one-scenario command, `adapter` | Mutation: a name the plugin lacks gives `Act as workflow subagent type: ...` | Feature exists; scenario new |
| PG-WF-02 | (b) install of a plugin whose script names `demo:ghost` prints one note per name and installs | cucumber | `features/workflow/agent-steps.feature` or a new `features/workflow/missing-agents.feature` | one-scenario command | The diagnostic row is absent | Scenario new; steps exist |
| PG-WF-02 | (b) the same note on `update` and in `info`; no note for a name outside the plugin or an agent that exists | cucumber | same file | one-scenario command | No note, or a false one | Scenarios new; steps exist |
| PG-WF-02 | (c) page and catalog | docs, architecture | `docs/workflows-compatibility.md`, `docs/output-catalog.md`, `test/architecture/catalog-uat/` | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/catalog-uat/catalog-contract.test.ts` | A catalog state with no fixture fails the contract test | Yes |
| PG-WF-07 | Model-started run with object `args` | cucumber | `features/workflow/references.feature` or `run.feature` | one-scenario command | Mutation: the script reads a key the call does not pass | Scenario new; steps exist |
| PG-WF-07 | `agent({schema})` returns the object | cucumber | `features/workflow/agent-steps.feature` | one-scenario command | Mutation: no `schema`; the result is not an object | Scenario new; steps exist |
| PG-WF-07 | `isolation: 'worktree'` runs in a worktree, which the engine keeps | cucumber | `features/workflow/agent-steps.feature` | one-scenario command | Mutation: no `isolation`; the branch prefix is not `pi/wf/` | Scenario new; **one step new** |
| PG-WF-07 | `workflow()` to a sibling returns its result | cucumber | `features/workflow/run.feature` | one-scenario command | Mutation: an unknown name fails the run | Scenario new; steps exist |
| PG-WF-07 | Two scripts with one `meta.name` fail the install and leave nothing | cucumber | `features/workflow/collisions.feature` | one-scenario command | Mutation: distinct names install | Scenario new; steps exist |
| PG-WF-04 | The section, the two settings, `builtin:mcp`, hooks; the S5 grade | docs | `docs/workflows-compatibility.md` | `pre-commit run --files docs/workflows-compatibility.md` | Review; the verifier greps for `inheritMainModel`, `providerMiddlewareExtensions`, `builtin:mcp` | Yes |
| PG-WF-04, -05 | Spike S5 | spike | `08-SPIKE-S5.md` (record); scratch fixture | the command the record states | The record holds the deciding output of R1's rows | New |
| PG-WF-05 (option A) | The agents text says why `Workflow` is dropped | docs | `docs/mcp-compatibility.md`, READMEs | `pre-commit run --files <files>` | Review | Yes |
| PG-WF-05 (option B) | `Workflow`, `Workflow(x)` map to `workflow` only with a staged workflow; deny by either form; `async: true`; warning; AG-11 for `tools: Workflow` in a plugin with no workflow | unit | `test/bridges/agents/convert.test.ts`, `grant-forms.test.ts` | owner tests and pair coverage | The tokens land in `droppedTools` | Yes, extend |
| PG-WF-05 (option B) | Stored text still translates and swaps | unit | `test/bridges/agents/legacy-grant-form.test.ts`, `grant-rewrite.test.ts` | owner tests | Must stay green unchanged | Yes, no edit expected |
| PG-WF-05 (option B) | `subagent get` shows `tools read, workflow` and `async true` | cucumber | `features/agent/frontmatter.feature` | one-scenario command | `tools read`, no `async` line | Scenario new; steps exist |
| PG-WF-05 (option B) | A real background child starts the plugin's workflow and gets its result | cucumber or integration | `features/agent/frontmatter.feature` with the real-child steps, or `test/integration/` | one-scenario command, or the integration file command | The child has no `workflow` tool | New; harness change |

### Sampling Rate

- **Per task commit:** the owner tests and pair coverage of the files the task changes, and the task's scenarios. The commit hook adds `npm run check:commit`.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; record the command, exit status, commit, Node version, and the scenario counts of both profiles.

### Wave 0 Gaps

- [ ] The S5 scratch fixture: the engine in the main Pi and in `settings.json`, a workflow in the plugin, the scripted `workflow` call, the session-file read, the engine settings file (R1). Not committed unless it becomes the proof of criterion 5.
- [ ] A `Given` step that makes the session's project a git repository with one commit, on `runGit` (R4).
- [ ] A catalog fixture and map entry, if the catalog state is added (R8).
- [ ] Under option B only: fixture options and a step text for a plugin with a workflow in `features/lib/real-subagent-child.ts` and `features/step_definitions/plugin/subagent-hooks.steps.ts`.
- [ ] No new step for the notes, the binding, the `args` run, the schema, the nesting, or the collision. No framework install.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is enabled. This is a local extension that processes untrusted plugin content. It has no authentication, session, or cryptography surface.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
| --- | --- | --- |
| V2 Authentication | No | none |
| V3 Session Management | No | none |
| V4 Access Control | Yes, as tool grants and tool reach | The converter maps only table names; pi-subagents and the engine enforce the lists. The page states what the engine does not enforce. |
| V5 Input Validation | Yes | `forMessage` on every span of plugin text in a note; the bounded AST walk; exact string comparison of names. |
| V6 Cryptography | No | none |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard mitigation |
| --- | --- | --- |
| An `agentType` literal with a newline, an escape sequence, or a bidi override forges or reorders a line of the install output | Spoofing, Tampering | `forMessage` on the agent type, the file name, and the folder, where each enters the string (`domain/workflow-script.ts:1163`). Unit cases with `\n` and U+202E. |
| A script names thousands of distinct `<plugin>:` literals, and each prints a note | Denial of service | A cap per script with a count line (Amendment 7). The script size cap of 524,288 bytes bounds the input, not the output. |
| A deeply nested script exhausts the walk | Denial of service | Already bounded: `AGENT_TYPE_WALK_MAX_DEPTH = 1_000`, and a breach costs the script its notes (`domain/workflow-script.ts:866-896`). No new code. |
| A note is trusted as a guarantee that the engine will bind the agent | Repudiation | The page states the residuals of R2. The note says what the plugin installs. |
| Option B: an agent limited to `Read` plus `Workflow` starts a workflow whose subagents hold `bash`, `edit`, and `write` | Elevation of privilege | The engine does not keep an agent type's tool list (PG-SEC-01), and a default workflow subagent has all four tools. Claude Code avoids the case by giving `Workflow` to no subagent. This is a reason for option A; under option B the generated file's warning and the page must say it. |
| Option B: a child with `workflow` starts background runs that outlive it or spend the user's quota | Denial of service | The engine pauses a child's runs at shutdown (predicted, R1 a5). Record what S5 measures. |
| Option B: an agent in a plugin with a workflow cannot launch without the engine | Denial of service (self-inflicted) | Map only when the plugin stages a workflow, so the row carries the `requires pi-dynamic-workflows` marker; state the launch refusal on the page. |
| The page tells users to opt the adapter into workflow children; every child then holds every adapter tool, whatever the agent type restricts | Elevation of privilege | Say so next to the setting, with the pointer to the D-PG4-14 row. The engine's own text: "the allowlist enables whole extensions, not a hook-only or operating-system sandbox" [CITED: engine `README.md:255`]. |
| A repository ships `<cwd>/.pi/workflows/settings.json` and so opts workflow children into an extension the user installed | Tampering | Engine behavior, not this extension's. The engine considers only enabled resources, and "project resources still require Pi project trust" [CITED: engine `README.md:253`]. Name the repository-local file on the page. |
| The spike or a probe reads or writes the real home | Information disclosure, Tampering | The fixture sets `HOME` and `PI_CODING_AGENT_DIR` under the OS temp folder, uses a loopback provider with a dummy key and `PI_OFFLINE`, and kills its processes and removes its tree in a `finally` (`real-subagent-child.ts:666-677`). |

## Evidence Records

Claude Code 2.1.323, `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`, read offline on 2026-11-14 with `LC_ALL=C /usr/bin/grep -ao` and `-obUa` plus `dd` at byte offsets. Never run. Docs pages fetched on 2026-11-14.

### E1. What does an unknown `agentType` do?

- **Claude Code:** the step throws. `throw Error(\`agent({agentType}): agent type '${y}' not found. Available agents: ${X.map((St)=>St.agentType).join(", ")}\`)`. A type that a permission rule denies throws `'${y}' is denied by permission rule ...`, and one whose tool pool is denied throws with the reason `workflow agent(): agent type unavailable, tool pool denied`. A found type's `tools` and `disallowedTools` go to the workflow subagent.
- **Evidence:** binary offset 324045026 (function `Ws`).
- **Confidence:** high; the code path was read.
- **Unresolved:** none.
- **Pi constraints:** the engine resolves agent types and runs a default agent for an unknown one (engine `src/workflow.ts:1119-1120,2843`; probe P6).
- **Divergence and license:** the run goes on with a default agent. Pi capability gap (the engine owns the registry). The install note makes it visible.

### E2. Do `parallel()` and `pipeline()` reject?

- **Claude Code:** no. `parallel()` awaits `Promise.allSettled` and maps each rejection to `null` with a log line `parallel[${et}] failed: ...`. `pipeline()` does the same per item: `let we=await Promise.allSettled(Ae.map((We,he)=>D.inSlot(he,async()=>{let be=await ue(We);for(let ct of xe){if(be.v===null)break;be=await ue(re(ct,be.v,We,he))}return be})))`, then `pipeline[${he}] failed: ...` and `null`. A `null` stage result skips the later stages. Both throw a `TypeError` for wrong argument types. The tool text says: "A thunk that throws (or whose agent errors) resolves to `null` in the result array -- the call itself never rejects" and "A stage that throws drops that item to `null` and skips its remaining stages." A bare `agent()` "Returns null if the user skips the agent mid-run or the subagent dies on a terminal API error after retries".
- **Evidence:** binary offsets 324078578 (code) and 334843204 (tool text).
- **Confidence:** high.
- **Pi constraints:** the engine returns `null` for a recoverable failure and rethrows a non-recoverable one (engine `src/workflow.ts:1597-1612,1643-1660`).
- **Divergence and license:** the engine's. PRD section 8.4 lists the request.

### E3. Does a subagent get the `Workflow` tool?

- **Claude Code:** no. The docs: "The first filter removes these tools, even when listed in the `tools` field: ... `Workflow`". The binary: `function Y(e){return new Set([ul,ww,...Xoa,ho,Wxe,$pe,E6,mon,R1,w$,...e!=="ant"?[Bd]:[],$l,mS, ...])}var p$t=Y("external")` with `var Bd="Workflow"`, and the pool filter `Dp` returns false for a tool in `p$t`. The resolver `jM` applies `Dp` unless its fourth argument is true. The Agent tool calls `jM(e, ..., M==="background", !1, ...)`. The main-thread agent is resolved with `jM(Ge, ..., !1, !0)`, so it keeps the tool. The set of built-in tools a background subagent may keep, `X("external")`, also leaves `Workflow` out.
- **Evidence:** https://code.claude.com/docs/en/sub-agents.md, "Available tools" (fetched 2026-11-14); binary offsets 308105745 (sets), 318015643 (`Dp`), 318020777 (`jM`), and the two call sites found by grep. Artifact: `plugins/claude-security/agents/claude-security.md` in `anthropics/claude-plugins-official` (fetched 2026-11-14), whose description says the agent is "for use only as the main agent of a session" and "Never dispatch it as a subagent: it cannot scan from there."
- **Confidence:** high. Documentation, binary, and the official artifact agree.
- **Unresolved:** none for the question. The artifact shows one plugin's intent, not a guarantee.
- **Pi constraints:** every bridged agent runs as a pi-subagents child. Pi has no main-session agent mode. The engine never gives `workflow` to its own subagents, but a pi-subagents background child that loads the engine can get it.
- **Divergence and license:** none proposed. Option B of Amendment 1 would be a divergence and needs a recorded decision.

### E4. What does `Workflow(<name>)` mean in an agent's `tools`?

- **Claude Code:** the entry is parsed into a tool name and rule content. For the main-thread agent it resolves to the whole `Workflow` tool: `function jo(e,n){return n===void 0||lOe(e)===void 0&&!(Ds?.(e)??!1)}` admits a tool with rule content unless the tool belongs to a tool family or stands in for the artifact tool. The resolver collects rule content only for the Agent tool, as allowed agent types. As a permission rule, `Workflow(<name>)` approves one saved workflow: "add `Workflow` to your allow rules to approve every workflow, or `Workflow(<name>)` to approve one saved workflow by name".
- **Evidence:** binary offsets 318016598 (`jo`) and 318020777 (`jM`); https://code.claude.com/docs/en/workflows.md, "Approve the plan before it runs".
- **Confidence:** high that the entry does not narrow the tool in the resolver; medium that an agent's entry also acts as a pre-approval (the rule-adding site was not read).
- **Pi constraints:** Pi asks no approval before a run (D-CF7-01), and the engine's tool takes no name list.
- **Divergence and license:** none needed under option A. Under option B the specifier is not applied, as D-PG8-11 says.

### E5. What happens to two scripts of one plugin with one `meta.name`?

- **Claude Code:** the last one loaded wins, unless its whole script fails to parse; then the earlier one stays with a warning. `function D(o){let a=new Map;for(let s of o){if(!y(s,a.get(s.name)))continue;a.set(s.name,s)}return[...a.values()]}` and `function y(o,a){if(!a||tCi(o.script))return!0;return t(\`Workflow ${o.filePath??o.name} (${o.source}) would override ${o.name} but does not parse — keeping the ${a.source} copy\`,{level:"warn"}),!1}`. The scripts of a folder are loaded in `readdir` order, so which one is "last" depends on the file system.
- **Evidence:** binary offset 323989613 and the loader functions before it.
- **Confidence:** high for the rule; medium for the order a user sees.
- **Pi constraints:** this bridge fails the whole install and names both files (WNAM-05; probe P5b).
- **Divergence and license:** recorded project rule WNAM-05. Decision 14 is open and out of scope (PG-WF-06). The scenario pins today's behavior.

### E6. What can a workflow subagent reach in Claude Code?

- **Model:** "When nothing else assigns one, the agent runs on your session's model" (workflows.md, cost section); the tool text: "the agent inherits the main-loop model (the resolved session model)". High.
- **MCP tools:** "Workflow agents can reach all session-connected MCP tools via ToolSearch -- schemas load on demand per agent" (binary offset 334846185). High.
- **Hooks:** "Hooks from settings files, managed policy settings, and plugins all apply inside subagents" (sub-agents.md, hooks section). The workflows page calls the agents a workflow starts subagents and says they "use your permission rules". Medium for workflow subagents: documented for subagents, not stated for workflows by name.
- **Skills:** "Subagents can still invoke unlisted project, user, and plugin skills through the Skill tool" (sub-agents.md, `skills` row). The default workflow subagent has every tool but a few orchestration tools. Medium, for the same reason.
- **Context files:** "Subagents get the same CLAUDE.md files injected at start that you did" (binary tool text). High.
- **Pi constraints:** R5.
- **Divergence and license:** Pi capability gap (the engine creates the child and loads no extension). Two engine settings restore the model and, if S5(b) passes, adapter tools.

### E7. Is an isolation worktree kept?

- **Claude Code:** "opts.isolation: 'worktree' runs the agent in a fresh git worktree ... the worktree is auto-removed if unchanged" (binary tool text, offset 334843204 region). High.
- **Pi constraints:** the engine keeps the worktree and its branch unless the call passes `keepWorktree: false` (engine `src/workflow.ts:1565-1567`; probe P3 listed both after the step ended).
- **Divergence and license:** the engine's (research report N9). The scenario title states it.

### E8. Does a `disallowedTools` entry with a specifier remove the tool?

- **Claude Code:** yes. `oft` adds the tool name of every entry to the disallowed set, and adds it to the "bare" set only when the entry has no rule content. `isToolDisallowed` tests the first set.
- **Evidence:** binary, function `oft` after offset 318016598.
- **Confidence:** high.
- **Pi constraints:** `explicitDisallow` and the omitted arm already work on the tool name (`toolNameOf`).
- **Divergence and license:** none.

## Probes run in this research

Every probe used the cucumber harness's sandbox home. None touched `~/.pi/agent`, and none changed the repository (`git status --short` was empty afterwards). Spike S5 was not run. Scratch files are under `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/probe8/` (`runpaths.feature`, `dup.feature`, and their `.out` files).

Command, from the worktree: `npx cucumber-js --profile adapter --parallel 6 --format progress <scratch>/runpaths.feature` (exit 1 by design: each scenario ends with one deliberately wrong table, so the report prints the actual rows; 76 of 82 steps passed, and the six failures are those tables).

| Probe | What ran | Deciding output |
| --- | --- | --- |
| P1 | The model calls `workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}}` | Run `completed`, result `who=Ada n=2`; tool result `workflow returned: started the workflow echo` |
| P2 | `agent("Judge the change.", {schema})`, scripted `structured_output {"verdict":"pass"}` | Run `completed`, result `verdict=pass type=object`; one model call |
| P3 | Three `agent()` steps, the second with `{isolation:"worktree"}`, each running `bash` | Step 2: `pi/wf/iso-<run id>-1-agent-2-{uuid}` and `{project dir}/.pi/worktrees/<same>`; step 3 still lists the branch and both worktrees |
| P4 | `outer.js` calls `workflow("demo:inner", {word:"hi"})` | Run `completed`, result `outer: inner got hi`; notice `started /demo:outer` |
| P5, P5b | Install of a plugin with `a.js` and `b.js`, both `name:"scan"` | `cascade`, `error`, `needs reload` `false`, `A plugin operation has failed.`; row `failed` with the collision text as its cause chain |
| P6 | One step with `agentType:"demo:helper"`, one with `agentType:"demo:ghost"` | Call 1: `You are the helper of demo.\n\nTask label: agent 1\n\nAnswer the task.`; call 2: `Act as workflow subagent type: demo:ghost\n\nTask label: agent 2\n\nAnswer again.`; run `completed` |
| Binary | Eight questions, by `grep -ao` and `dd` | The quotes of E1-E8 |
| Docs | `sub-agents.md`, `workflows.md`, and the official `claude-security.md` | The quotes of E3, E4, E6 |

## Sources

### Primary (HIGH confidence)

- Repository source, read this session with the line citations above: `orchestrators/plugin/{discover-names,install-outcome,update-swap,info}.ts`, `domain/{workflow-script,name}.ts`, `bridges/agents/{convert,discover,stage,grant-forms,legacy-grant-form,mcp-async-warning}.ts`, `bridges/mcp/adapter-entry.ts`, `domain/mcp-server-features.ts`, `platform/workflow-home.ts`, `shared/errors.ts`, `cucumber.json`, `package.json`, and the features, steps, and harness libraries named above.
- `@quintinshaw/pi-dynamic-workflows` 3.15.0 in the optional-peer cache: `extensions/workflow.ts`, `src/{pi-extension,workflow-tool,workflow,agent,agent-registry,worktree,workflow-paths,workflow-settings,workflow-saved,builtin-workflows,task-panel}.ts`, `README.md`.
- pi-subagents 0.88.1 in the cache: `index.js`, `src/runs/shared/{child-launch,child-tool-plan,child-session,child-runtime-config,subagent-prompt-runtime,tool-availability}.js`, `src/runs/background/{subagent-runner,async-execution}.js`, `docs/agents.md`.
- pi-mcp-adapter 7.0.1 in the cache: `package.json`, `index.ts` (registration and environment reads), `runtime-owner.ts`.
- Pi 1.5.0: `dist/core/sdk.js`, `dist/core/agent-session.js`.
- Claude Code 2.1.323 binary (offsets in the evidence records).
- https://code.claude.com/docs/en/sub-agents.md and https://code.claude.com/docs/en/workflows.md, fetched 2026-11-14.
- Probes P1-P6.

### Secondary (MEDIUM confidence)

- `plugins/claude-security/agents/claude-security.md`, `anthropics/claude-plugins-official` on GitHub, fetched 2026-11-14 (an upstream artifact: it shows what that plugin intends).
- `docs/prd/parity-gaps-prd.md` sections 7.4, 8.4, 9, 10 and `docs/research/parity-gaps/{workflows,subagents}.md` for use counts and the earlier reading of engine 3.15.1.
- `07-RESEARCH.md` and `07-CONTEXT.md` for the Phase 7 state of the agents bridge.

### Tertiary (LOW confidence)

- The S5 predictions (assumptions A1-A3). Only the spike decides.

The research-plan seam was not used: graphify is disabled (`gsd-tools graphify status`), and every question was answerable from the repository, the installed packages, the binary, and three fetched pages.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. No change; versions read from the installed tree.
- PG-WF-02 join and engine registry (R2, R3): HIGH. Source read and probed.
- PG-WF-07 run paths (R4): HIGH. All five ran.
- PG-WF-04 engine facts (R5): HIGH at 3.15.0; upstream hooks and skills MEDIUM (A7).
- PG-WF-05 upstream (R6, E3): HIGH. Option B mechanics: HIGH for the code sites, MEDIUM for feasibility until S5(a).
- S5 predictions (R1): MEDIUM for (a), LOW to MEDIUM for (b).
- Pitfalls: HIGH; each is tied to a read line or a probe.

**Research date:** 2026-11-14
**Valid until:** 2026-12-14 for the code sites. Re-check the engine lines when the cache moves from 3.15.0, the pi-subagents lines when the suite version moves from 0.88.1, and E3 when Claude Code's subagent tool filter changes.
**Scope of this research:** only this file was written in the repository. No source, test, feature, plan, or state file was changed, and nothing was committed.
