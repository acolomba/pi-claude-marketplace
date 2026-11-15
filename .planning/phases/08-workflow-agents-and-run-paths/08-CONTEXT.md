# Phase 8: Workflow Agents and Run Paths - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`, non-interactive run). Every gray area
took the reversible upstream-parity default or the recommended answer. **Every
D-PG8 decision below is pending maintainer review.** The ones marked
**product** change what a user sees or how this phase is sequenced, and need
the maintainer's eye first.

<domain>
## Phase Boundary

Deliver PG-WF-02, PG-WF-07, PG-WF-04, and PG-WF-05:

- A workflow's `agent("...", {agentType: "demo:helper"})` runs the plugin's
  bridged agent, and a scenario proves it. An install of a plugin whose script
  names an agent type the plugin does not install prints one note for each
  such name and still installs. The compatibility page stops saying that an
  unresolved `agentType` is not an error in Claude Code (PG-WF-02).
- Scenarios cover five run paths that no scenario covers today: a run the
  model starts by name with object `args`, `agent({schema})`,
  `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts
  with one `meta.name` (PG-WF-07).
- The workflow compatibility page says what a workflow subagent can reach,
  names the engine settings `inheritMainModel` and
  `providerMiddlewareExtensions`, and says that Pi's built-in MCP cannot load
  in a subagent and that plugin hooks do not run there. The adapter setting is
  stated as spike S5 measured it (PG-WF-04).
- A bridged agent whose source grants `Workflow` or `Workflow(<name>)` gets the
  engine's `workflow` tool and the background launch mode, and in a live run
  with a real pi-subagents child the lead agent of a fixture plugin starts the
  plugin's workflow (PG-WF-05). Gated by spike S5.

Spike S5 is the first task of the first plan. Out of scope: PG-WF-03 and
PG-WF-06 (P2), decision 14 (the `<plugin>-` elision, two scripts with one
name failing the whole install, symbolic links), engine changes (the
companion owns them), and the hook tool-name table (`Workflow` in a hook
matcher).

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` "Phase 8: Workflow Agents and Run Paths" — goal, spike, notes, success criteria
- `.planning/REQUIREMENTS.md` — PG-WF-02, PG-WF-04, PG-WF-05, PG-WF-07
- `docs/prd/parity-gaps-prd.md` §7.4 (WF-02, WF-04, WF-05, WF-07, SEC-01), §8.4 (engine requests), §9 (spikes S4, S5), §10 (doc corrections for `docs/workflows-compatibility.md:126` and `:164`)
- `docs/research/parity-gaps/workflows.md` — engine capability table (E1-E18), "Do subagents of a translated workflow get what upstream gives them?", WF-02/04/05/07
- `docs/research/parity-gaps/subagents.md` — pi-subagents launch modes and extension loading in children

### Prior decisions this phase builds on
- `.planning/phases/07-agent-frontmatter-and-grants/07-CONTEXT.md` — D-PG7-08 (`Agent`/`Task` → `subagent`, type list not applied), D-PG7-09, D-PG7-12/13/14 (deny precedence, stored warning text), D-PG7-17 (`model: ""` for a source `inherit`)
- `.planning/phases/04-skill-and-workflow-install-defects/04-CONTEXT.md` — D-PG4-11..15 (SEC-01 note, its join, its wording, the engine request draft)
- `.planning/phases/03-background-subagents/` — the real pi-subagents child harness and the launch-mode rules (D-PG3-01..03)
- `.planning/PROJECT.md` — D-CF4-05, D-CF6-10 (MCP-granted agents launch with `async: true`), D-CF7-01..05 (workflow divergences)
- `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` — the drafted SEC-01 engine request

### Docs to change
- `docs/workflows-compatibility.md` — `agentType` row (line 126), the `agent()` failure paragraph (line 164 in the PRD's count), new "What a workflow subagent can reach" section
- `docs/output-catalog.md` — the WF-02(b) note row
- the agents section of the compatibility docs and both READMEs where Phase 7 listed `Agent`/`Task` grants — the `Workflow` grant (if S5 passes)

### Project rules
- `AGENTS.md` (project) — behavioral-test rule, upstream-parity rule, NFR-10
- `.agents/skills/cucumber/SKILL.md`, `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/local-verification/SKILL.md`, `.agents/skills/claude-code-compat-research/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `domain/workflow-script.ts` `readAgentTypes` / `agentTypeLiteral`: the literal `agentType` values of an admitted script (on `NamedWorkflow.agentTypes`).
- `orchestrators/plugin/discover-names.ts` `workflowAgentRestrictionNotes`, `restrictionNote`, `RestrictionAgent`, `RestrictionWorkflow`, `discoverGeneratedNames`: the SEC-01 join that the WF-02(b) note mirrors; `info.ts` `previewAgentRestrictionNotes` is its `info` consumer.
- `domain/name.ts` `declaredAgentName` (no elision) and `generatedWorkflowName` (elides `<plugin>-`).
- `shared/staging-warnings.ts` `discoveryWarning`; `orchestrators/plugin/staging-diagnostics.ts` `surfaceDiscoveryWarnings`.
- `bridges/agents/convert.ts` `TOOL_MAP` (`Agent`/`Task` precedent), the MCP launch-mode rule (`async: true`), `explicitDisallow`; `bridges/agents/grant-forms.ts`, `legacy-grant-form.ts`, `grant-rewrite.ts` for stored text.

### Established Patterns
Notes never refuse and are recomputed, never stored; one output channel;
fallow zones forbid bridge-to-bridge imports, so the join lives in
`orchestrators/`; pure conversion with owner unit tests; guard scenarios pin
behavior the project does not change.

### Integration Points
- `features/workflow/agent-steps.feature`, `run.feature`, `references.feature`, `collisions.feature`, `agent-restrictions.feature`; step `When the user runs the workflow command ..., whose agent steps the model answers`; `Then the model receives these calls:`.
- `features/agent/frontmatter.feature`, `features/agent/invocation.feature`, `features/plugin/subagent-child.feature`; `subagent get` steps.
- `test/integration/pi-subagents-child-identity.test.ts`, `test/integration/pi-subagents-child-launch-conformance.test.ts`.
- Companion sources after `node scripts/install-test-peers.mjs`: `node_modules/.cache/optional-peers/node_modules/{@quintinshaw/pi-dynamic-workflows,pi-subagents,pi-mcp-adapter}/`.

</code_context>

<specifics>
## Specific Ideas

Upstream evidence records (Claude Code 2.1.323,
`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`,
grepped 2026-11-14 with `LC_ALL=C /usr/bin/grep -ao`):

1. **Unknown agent type.** `agent({agentType}): agent type '<x>' not found.
   Available agents: ...` is thrown; a denied tool pool gives `workflow
   agent(): agent type unavailable, tool pool denied`. High. Pi side: the
   engine runs a default agent (research E7). License: Pi-side gap (engine).
2. **`parallel()`.** `Promise.allSettled` over the thunks; the tool text says
   a throwing thunk resolves to `null` and "the call itself never rejects".
   High. `pipeline()` not yet read (research).
3. **`Workflow` tool and specifier.** Tool name `Workflow`; `Workflow(<name>)`
   is an allow rule for one workflow name. Medium for its meaning inside an
   agent's `tools`. Open: is `Workflow` in a subagent's tool pool when `tools`
   is omitted?
4. **Workflow subagents upstream** run on the session model and reach session
   MCP tools (research report, VERIFIED from tool prose); hooks and skills not
   yet graded.

Use counts (PRD): `agentType` in 7 of 7 official scripts (about 20 call
sites), all naming agents that exist; `Workflow` grant in 1 agent
(`claude-security`); 6 of 7 scripts use `.filter(Boolean)`.

Companions in the test cache today: engine 3.15.0, pi-subagents 0.88.1,
pi-mcp-adapter 7.0.1 (the PRD's S4 ran engine 3.15.1).

</specifics>

<deferred>
## Deferred Ideas

- PG-WF-03 (notes for `disallowedTools`, `bashCommandClamp`, `effort`, `stallMs` in `agent()`), PG-WF-06 and decision 14.
- A note for a `--map-model` agent type whose model the user lacks (`MODEL_NOT_FOUND`, research report WF-02 open question).
- New engine requests (D-PG8-17).
- `Workflow` in the hook tool-name table.

</deferred>

## Parent lines for the orchestrator

This phase edits only its directory and the ROADMAP Phase 8 plan list. The
workflow wanted these shared-file edits; the parent decides.

1. PROJECT.md Key Decisions: D-PG8-04/05 (missing agent type note), D-PG8-11..13
   (`Workflow` grant, background launch) if S5 passes, D-PG8-09 (no engine
   settings written). All pending maintainer review.
2. BACKLOG: mark WOUT-01 stale (workflow subagents get `read`, `bash`, `edit`,
   `write` since engine 3.13.1); WFLENGINE-01 gains the PRD §8.4 requests of
   D-PG8-17 if not already listed.
3. CHANGELOG: an install notes a workflow agent type the plugin does not
   install; agents granted `Workflow` can start workflows (if S5 passes; run
   `reinstall` once for installed plugins); the workflow page says what a
   workflow subagent can reach.
4. STATE.md: record the Phase 8 context and planning sessions.
</content>
</invoke>

## Amendments after research (2026-11-14)

Research (`08-RESEARCH.md`, "Amendments proposed") refined these decisions.
These amendments win over the text above. All stay pending maintainer review.

- **D-PG8-11..15 amended (product, blocking for PG-WF-05):** Claude Code gives
  `Workflow` to no subagent: the sub-agents page lists it among the tools
  removed from every subagent "even when listed in the `tools` field", the
  2.1.323 binary puts it in the always-denied agent set for every Agent-tool
  subagent (only a main-thread agent keeps it), and `claude-security`'s own
  agent says it must run only as the main agent. Pi has no main-session agent
  mode, so the upstream-parity default is **option A: keep dropping the grant,
  say why in the compatibility text, and treat PG-WF-05 as not a gap.** Option
  B (grant `workflow` as a recorded divergence licensed by "no main-session
  agent mode") needs a maintainer decision with an ID. The WF-05 plan's first
  task is therefore an unconditional `checkpoint:decision` that presents A
  (recommended) and B with the S5(a) record. Under A the plan is one docs
  task; under B it follows RESEARCH R6.
- **D-PG8-12 amended:** under option B, map the grant only when the plugin
  stages a workflow (`referenceNames.workflows`): pi-subagents 0.88.1 refuses
  a child whose `tools` names an unregistered tool, so "map whenever granted"
  would break the agent for a user without the engine. The "keep the drop
  warning without the engine" half is not built (it would need a probe in the
  pure converter).
- **D-PG8-01 refined:** S5(a) calls `workflow` with `background: false` for
  the verdict (the script holds at least one `agent()` call), and records the
  default background call separately; it also measures the no-`tools` arm
  (today a background child of such an agent gets `workflow` and
  `workflow_control` as ambient tools, which Claude Code never gives). S5(b)
  lists the adapter in the fixture's Pi `settings.json` and writes the engine
  settings at `{agent dir}/workflows/settings.json`, with a control run that
  has no settings file.
- **D-PG8-04 resolved:** "installs" is exactly the discovered set: a
  conversion refusal fails the whole install (AG-11), duplicates are dropped in
  discovery (AG-12), and agent files are written with pi-subagents absent. The
  engine resolves only the frontmatter `name`, never an alias.
- **D-PG8-05 refined:** one tenseless text serves install and `info`, as the
  PG-SEC-01 note does; no info-tense form. The notes of one script are capped
  (output-flood threat: a literal needs only the `<plugin>:` prefix); the cap
  value and its summary wording are the planner's proposal, pending review.
- **D-PG8-06 refined:** `docs/output-catalog.md` gets one state for the new
  note with a catalog-uat fixture; the PG-SEC-01 note still has no state
  (recorded, not fixed here).
- **D-PG8-07 measured:** all five run paths pass today (RESEARCH R4). One new
  `Given` step makes the project a git repository; worktree names carry the
  run id, so the scenario prints stable text. Two scripts with one
  `meta.name` fail the whole install today, where Claude Code keeps the last
  script that parses; the scenario title says so.
- **D-PG8-08 graded:** upstream workflow subagents run on the session model
  and reach session MCP tools (high), and run hooks and reach plugin skills
  (medium). On Pi a workflow subagent loads the user's own Pi skills, prompt
  templates and `AGENTS.md`, not plugin skills; `builtin:mcp` in
  `providerMiddlewareExtensions` fails every `agent()` call.
- **D-PG8-10 refined:** the paragraph is on line 165 today; `pipeline()` and
  `parallel()` both use `Promise.allSettled` upstream and never reject.
- **Residual for the maintainer:** whether a bridged agent with no `tools`
  list should get `excludeTools: workflow, workflow_control` (Claude Code
  gives a subagent neither). Not part of this phase.
