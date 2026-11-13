# Requirements: pi-claude-marketplace

**Defined:** 2026-11-11
**Milestone:** parity-gaps -- Claude Code Parity Gaps and Defects
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Source:** [docs/prd/parity-gaps-prd.md](../docs/prd/parity-gaps-prd.md), version 1.2. Each requirement is one P0 or P1 row of that document, and its ID is the PRD's ID with a `PG-` prefix: `PG-HOOK-01` is the PRD's `HOOK-01`. The prefix keeps the IDs apart from the bare `HOOK-01`, `SKILL-01`, `CMD-01`, `AGENT-01`, and similar IDs that earlier milestones own. The PRD's section 7 holds the full form of each requirement (Upstream, Today, Enabler, Acceptance, Notes), and the six reports under `docs/research/parity-gaps/` hold the evidence. Where this file and the PRD disagree, the PRD is right. Planning re-reads each requirement against its report.

**Baseline:** Claude Code 2.1.322, Pi 1.5.2, pi-mcp-adapter 7.0.1, pi-subagents 0.88.0, pi-dynamic-workflows 3.15.1.

**Rules for every requirement:**

- A requirement that changes behavior a user can see ships with a cucumber scenario that fails without the change. The PRD's Acceptance field is written for that purpose.
- A requirement marked "decision N" waits for that decision of the PRD's section 5. The maintainer answers it in the discuss step of the requirement's phase. The answer is recorded in `PROJECT.md` with its premise and the version it was checked against. A "no" moves the requirement to Out of Scope.
- A requirement marked "spike Sn" waits for that spike of the PRD's section 9, which runs in the requirement's phase.
- A requirement that renames or removes an artifact of an installed plugin says in its design how the artifact changes at the next `update` or `reinstall`: PG-CORE-01, PG-AGENT-01, PG-AGENT-05, PG-MCP-01, PG-MCP-06.
- A correction in the PRD's section 10 that names a requirement lands in the same change as that requirement.

## v1 Requirements

### Hooks

- [ ] **PG-HOOK-01**: For the tools in the hook table, a hook receives a Claude-shaped `tool_input` (`file_path`, `old_string`, `new_string`), and a Claude-shaped `updatedInput` changes the call as the hook intended. No pair of a multi-pair `edit` escapes a hook that matches `Edit`. `updatedMCPToolOutput` is honored as `updatedToolOutput` is. (P0)
  - Design resolution accepted 2026-11-12 (D-PG2-01..09): include available-field result translation and reverse result rewriting; document missing fields and carry full execution wrappers as HOOKRESULT-01. Unsupported input rewrites run the original call with a notice; explicit denials and conflicting multi-edit file targets still block.
- [ ] **PG-HOOK-03**: A hook matcher follows Claude Code's rules: (a) an exact list with commas or spaces matches each listed tool; (b) a matcher on `UserPromptSubmit` or `Stop` is ignored, and the group runs; (c) any other matcher is an unanchored regular expression tested against the Claude-form tool name, a pattern that does not compile drops the group, and `info` reports a regular expression group as supported. (P0; decisions 6 and 24 answered)
- [ ] **PG-HOOK-13**: A `Stop` hook can block eight times in a row before the limit applies, and a run that called a tool starts the count again. (P0)
- [ ] **PG-HOOK-07a**: In a pi-subagents child, the plugin's `SessionStart`, `UserPromptSubmit`, `Stop`, and `SessionEnd` hooks do not run, and tool hook payloads carry `agent_type`, and `agent_id` when the child can know it. Lands with PG-AGENT-01. (P0)
- [ ] **PG-HOOK-02**: A `Stop` hook that blocks continues the same run, on Pi's `agent_before_settle` event. Listeners of `agent_settled` see one event for a run, however many times a `Stop` hook blocked. (P1; spike S1 ran in print mode only)
- [ ] **PG-HOOK-04**: A hook receives `tool_use_id` on the three tool events, `duration_ms` on `PostToolUse` and `PostToolUseFailure`, `mcp_server` for MCP tools, `custom_instructions` on `PreCompact`, `model` and `session_title` on `SessionStart`, and `effort` when Pi's level is one of Claude's levels. (P1; decisions 9 and 25)
- [ ] **PG-HOOK-06**: When a typed line names a prompt template or a skill, `UserPromptExpansion` hooks run before the expansion with Claude Code's fields, and a block stops the expansion and shows the reason. Depends on PG-HOOK-03 (c). (P1)
- [ ] **PG-HOOK-23**: A hook that exits with code 2 because its script file is missing does not block. (P1)
- [ ] **PG-HOOK-14**: Each hook that fails without blocking shows one notice with the first line of its stderr; a hook's `stopReason` is shown to the user; context beyond 10,000 characters does not reach the model. (P1)
- [ ] **PG-HOOK-21**: A plain `async` hook runs until it ends, or until a reload or the session end, with no timeout. (P1)
- [ ] **PG-HOOK-11**: A `SessionStart` hook receives `resume` in a session started with `--continue` or `--resume`. (P1; spike S7)

### Subagents

- [ ] **PG-AGENT-01**: A bridged agent runs in the launch mode that pi-subagents chooses, unless the source sets `background: true` or the agent has plugin MCP tools; those two run in the background. The warning for agents with MCP tools no longer says that Claude Code runs them in the foreground. Lands with PG-HOOK-07a. (P0; decision 1 answered)
- [x] **PG-AGENT-02**: The declared pi-subagents floor is 0.87.0 in `package.json`, the README, and `scripts/install-test-peers.mjs`, and the documentation no longer describes the two fixed pi-subagents bugs as open. Lands with PG-AGENT-07b. (P0; decision 2 answered)
- [x] **PG-AGENT-07b**: A model ID that `--map-model` writes has no provider prefix, so the agent runs on the session's provider when that provider has the model. (P0)
- [ ] **PG-AGENT-07a**: A source agent with `model: inherit` runs on the parent's model, with or without `--map-model`. (P1)
- [ ] **PG-AGENT-05**: Agent frontmatter is read as YAML with the leniency that skill frontmatter has: a quoted value loses its quotes, a comment is not a value, a multi-line description keeps its lines, and an unquoted description with a colon still loads. (P1)
- [ ] **PG-AGENT-03**: A bridged agent whose source grants `Agent` or `Task`, with or without a type list, can start subagents. So can an agent with no `tools` field, unless `disallowedTools` names `Agent` or `Task`. (P1)
- [ ] **PG-AGENT-09**: A source agent with both `tools` and `disallowedTools` is restricted by both, and the two warnings that state limits of pi-subagents versions below the floor are gone. (P1)

### Workflows

- [ ] **PG-WF-01**: A reference to a plugin workflow that the source wrote with no leading slash names the installed workflow with no leading slash, so `Workflow({ name: "plugin:wf" })` in a command body starts the workflow. A reference written with a leading slash keeps it. (P0)
- [ ] **PG-WF-02**: (a) A workflow's `agent("...", {agentType: "<plugin>:<agent>"})` runs the plugin's bridged agent, and a scenario proves it. (b) The install of a plugin whose script names an `agentType` that the plugin does not install prints one note for each such name and still installs. (c) The compatibility page no longer says an unresolved `agentType` is not an error in Claude Code. Lands with or after PG-SEC-01. (P1)
- [ ] **PG-WF-04**: The workflow compatibility page says what a workflow subagent can reach, names the engine settings `inheritMainModel` and `providerMiddlewareExtensions`, and says that Pi's built-in MCP cannot load in a subagent and that plugin hooks do not run there. (P1; spike S5 for the adapter setting)
- [ ] **PG-WF-05**: A bridged agent whose source grants `Workflow` or `Workflow(<name>)` can start the plugin's workflow when the plugin stages one, and such an agent runs in the background. (P1; spike S5; confidence Low)
- [ ] **PG-WF-07**: Scenarios cover a run the model starts by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts with one `meta.name`. (P1)

### MCP Servers

- [x] **PG-MCP-01**: A tool call of a plugin MCP server that declares no `timeout` may be silent for 30 minutes on a stdio server and 5 minutes on a remote server, under both implementations. Under the adapter, a timeout the user wrote on the entry still wins. (P0; decision 4 answered)
- [ ] **PG-MCP-02**: The declared pi-mcp-adapter floor is 7.0.1. Under the adapter, a plugin tool whose Claude Code name is longer than 64 characters works everywhere the project names it: a hook matcher written with the Claude Code name matches it, the hook receives the Claude Code name, and an agent's disallowed-tool entry removes it. (P0; decision 3 answered)
  - On 2026-11-13, published pi-subagents 0.88.1 passed the installed-release launch checks and all three real-child controls, including long-name exclusion with a working permitted short tool. The general peer floor remains `>=0.87.0`. Final PG-MCP-02 acceptance waits for the parent's combined-tree `npm run check` after merge; see the [quick-task summary](quick/261113-8yn-adopt-pi-subagents-0-88-1-ambient-mcp-fi/261113-8yn-SUMMARY.md).
- [ ] **PG-MCP-06**: Under the adapter, a stdio plugin server that has started stays running for the session (`lifecycle: "lazy-keep-alive"`), unless the user set a lifecycle on the entry. Remote servers stay `lazy`. (P1; decision 5)
- [ ] **PG-MCP-08**: The MCP compatibility page states, for each implementation, whether a plugin server can use resources, prompts, elicitation, sampling, roots, and output limits, and that `@server:uri` mentions do not exist on Pi. One scenario for each implementation reads a resource of a plugin server. (P1)
- [ ] **PG-MCP-09**: Under the adapter, a value the user wrote in `protocolVersion`, `tasks`, `exposeResources`, or `caFile` on a plugin entry survives an update or reinstall. (P1)

### Plugin Container

- [ ] **PG-CORE-01**: For a marketplace entry whose source is the marketplace root and which lists `skills`, only the listed skill folders are installed. No file or record of a skill that an update removes stays behind. (P0)
- [ ] **PG-CORE-03**: `userConfig` defaults and export (step 1 of the PRD's CORE-03): each option resolves to its `default`; hooks receive `CLAUDE_PLUGIN_OPTION_<KEY>`; `${user_config.KEY}` is filled in exec-form hook commands and arguments, in the five MCP fields that take variables, and in skill and agent content for values that are not sensitive. A plugin whose options all have a default installs without `--partial`. A plugin with a required option that has no default stays partially available. (P1; decision 17)
- [ ] **PG-CORE-05**: A user-scope skill or command that names `${CLAUDE_PROJECT_DIR}` gets the session directory when the user invokes it, when the model reads it, and through the `run_plugin_command` tool. Agent bodies stay as they are. (P1; decision 10)
- [ ] **PG-CORE-06**: In a project that Pi does not trust, a project-scope plugin's `bin` directory is not on `PATH`. (P1; decision 23)
- [ ] **PG-CORE-07**: A plugin with no `bin` directory adds nothing to `PATH`. (P1)

### Skills and Commands

- [ ] **PG-SKILL-04**: In a staged `SKILL.md` and its supporting Markdown, a relative link to a sibling skill of the same plugin resolves to that sibling's staged folder. (P0)
- [ ] **PG-SKILL-01**: A typed bridged command or skill attaches each `@path` reference that its author wrote and that names an existing regular text file. A `@path` that arrives through an argument or through the output of an injected `!` command is not attached, and neither is one inside fenced code or a code span. Covers the PRD's CMD-01. (P1; spike S8)
- [ ] **PG-CMD-09**: A bridged command also answers to Claude Code's own name for it, `/<plugin>:<path>:<file>`, whenever that name differs from its Pi name. (P1; decision 13)
- [ ] **PG-SKILL-11**: Each alias suggestion shows the description of its target and, for a skill, its `argument-hint`. Covers the PRD's CMD-10. (P1)

### Security

- [ ] **PG-SEC-01**: The install of a plugin whose workflow script names an agent with a `tools` or `disallowedTools` field prints a note that the workflow does not keep the restriction, `info` shows it, and the workflow compatibility page says so. The request to pi-dynamic-workflows of the PRD's section 8.4 is drafted under `.planning/upstream/` for the maintainer to file. (P0)
- [ ] **PG-SEC-02**: The maintainer confirms or reopens the accepted project trust gap of D-LOC-01, and the decision is recorded with its premise and the Pi version it was checked against. (P1; decision 23)
- [ ] **PG-SEC-03**: Under the adapter, a plugin server either gets the fields that withhold the `sampling` capability and the MCP UI extension, or the divergence is recorded as a decision. (P1; decision 20)

### Documentation

- [ ] **PG-DOC-01**: A page `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, the `run_plugin_command` tool, the skill-read fill, and the name mapping, and each row of its status table cites the scenario that proves it. (P1)
- [ ] **PG-DOC-02**: The eight statements that the PRD's section 10 marks "none" are corrected: the event count and the first-party claim in `docs/research/claude-hooks-vs-pi-events.md`; the `tool_search` claim, the bundle reason, and the Pi 1.5.0 proof paths in `docs/mcp-compatibility.md` and the code comments that repeat them; the `PATH` row of `docs/env-vars.md`; BACKLOG `TOOLSEARCHOFF-01`, `WOUT-01`, and `UAT-02`; and the "Component" entry in section 3 of `docs/prd/pi-claude-marketplace-prd.md`. A claim that only a spike can settle is marked unmeasured. (added at milestone start)

## v2 Requirements

The P2 rows of the PRD's section 6.3. None is scheduled. Promote one when a plugin that needs it is found. The PRD holds each row's text, decision, and spike.

### Hooks

- **HOOK-05**: Merge manifest and marketplace-entry `hooks` (decision 8)
- **HOOK-07b**: `SubagentStart` and `SubagentStop`
- **HOOK-08**: `PostToolBatch` on `turn_end`
- **HOOK-09**: `PostModelSwitch` on `model_select`
- **HOOK-10**: Apply `CLAUDE_ENV_FILE` before each bash command
- **HOOK-12**: Apply `sessionTitle`
- **HOOK-15**: Export `CLAUDE_EFFORT`
- **HOOK-16**: Map `Agent`, `Task`, and `ToolSearch` tool names
- **HOOK-17**: Show `statusMessage`
- **HOOK-19**: Report skill frontmatter `hooks`
- **HOOK-22**: `InstructionsLoaded` for each context file

### Subagents

- **AGENT-04**: Map `memory`
- **AGENT-06**: Update the model alias table to 2.1.322
- **AGENT-07c**: Family virtual models in place of `--map-model` (spike S10)
- **AGENT-08**: Context inheritance: `omitClaudeMd` and the global file (decision 22)
- **AGENT-10**: An agent with no usable tool does not fail the install (decision 15)
- **AGENT-11**: Four small items

### MCP Servers

- **MCP-03**: Enforce tool permission rules (spike S8)
- **MCP-04**: `headersHelper` under the adapter (decision 27, spike S6)
- **MCP-05**: Suppress a plugin server that duplicates a user's server
- **MCP-10**: Choose built-in when both implementations are loaded

### Workflows

- **WF-03**: An install note for tool-narrowing options the engine ignores
- **WF-06**: Claude Code workflow names (decision 14)

### Skills and Commands

- **SKILL-03 / CMD-03**: Read `yes`, `on`, and `1` as true
- **SKILL-05**: Follow a symbolic link that stays inside the marketplace (decision 16)
- **SKILL-06**: A `SKILL.md` at the plugin root is a skill (spike S8)
- **SKILL-07 / CMD-04**: Honor `effort` (decision 11)
- **SKILL-09 / CMD-06**: Honor `disallowed-tools` (decision 11)
- **SKILL-10 / CMD-07**: Honor `context: fork` (decisions 11 and 28)
- **CMD-08**: Refuse a typed call of a `user-invocable: false` command (decision 12)

### Plugin Container

- **CORE-02**: Namespace components under the manifest `name` (decision 18)
- **CORE-03 steps 2 and 3**: Set `userConfig` values without a dialog, then with one (decision 30)
- **CORE-04**: An inert `settings.json` does not block an install
- **CORE-08**: An installed path-source plugin does not change on `marketplace update` (decision 19, spike S11)
- **CORE-09**: Read `strict` from the marketplace entry
- **CORE-10**: Show `displayName`
- **PI-01**: Reload after a mutating command (decision 21, spike S9)

### Backlog items the PRD re-checked

- **CMDSKILLMD-01**, **SKILLCLASH-01**, **CMDINFO-01**: still open in `BACKLOG.md`; not part of this milestone.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| SKILL-08 / CMD-05: honor `model` for the turn | P3: changes cost and model without a prompt; 0 uses |
| SKILL-12: run skill frontmatter `hooks` | P3: a new source of hooks with its own lifetime and trust rules; 0 uses |
| HOOK-18: `FileChanged` and `watchPaths` | P3: close to rebuilding a subsystem; 0 uses |
| HOOK-20: `prompt` and `mcp_tool` handler types | P3: 0 official plugins use them |
| CORE-11: a `validate` verb | P3: no plugin needs it; a tool for plugin authors |
| PI-02: the plugin `settings.json` `agent` key | P3: changes every session without a prompt; 0 uses in 76 plugins |
| PI-04: `--plugin-dir` for one session | P3: adds a third install origin, against SC-1 |
| Marketplace add, remove, and update mechanics, install scopes, version resolution | Outside the PRD's scope (section 3) |
| The component kinds the project does not bridge (`lspServers`, `monitors`, `themes`, `outputStyles`, `channels`, `syntaxHighlighting`, the hooks module, `binaries`) | Outside the PRD's scope (section 3) |
| A rebuild of a Claude Code subsystem: the permission system, agent teams, task tools, the session-as-agent mode, channels | The project is not a Claude Code emulator |
| Changes inside Pi, pi-mcp-adapter, pi-subagents, or pi-dynamic-workflows (the PRD's section 8) | Another project owns each; this milestone only drafts the request that PG-SEC-01 names |
| Reading `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, `MCP_TOOL_TIMEOUT`, and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | The PRD keeps each as a separate small addition, not part of PG-HOOK-13 or PG-MCP-01 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement  | Phase    | Status  |
| ------------ | -------- | ------- |
| PG-HOOK-01   | Phase 2  | Pending |
| PG-HOOK-03   | Phase 2  | Pending |
| PG-HOOK-13   | Phase 2  | Pending |
| PG-HOOK-07a  | Phase 3  | Pending |
| PG-HOOK-02   | Phase 5  | Pending |
| PG-HOOK-04   | Phase 6  | Pending |
| PG-HOOK-06   | Phase 6  | Pending |
| PG-HOOK-23   | Phase 5  | Pending |
| PG-HOOK-14   | Phase 5  | Pending |
| PG-HOOK-21   | Phase 5  | Pending |
| PG-HOOK-11   | Phase 6  | Pending |
| PG-AGENT-01  | Phase 3  | Pending |
| PG-AGENT-02  | Phase 1  | Complete |
| PG-AGENT-07b | Phase 1  | Complete |
| PG-AGENT-07a | Phase 7  | Pending |
| PG-AGENT-05  | Phase 7  | Pending |
| PG-AGENT-03  | Phase 7  | Pending |
| PG-AGENT-09  | Phase 7  | Pending |
| PG-WF-01     | Phase 4  | Pending |
| PG-WF-02     | Phase 8  | Pending |
| PG-WF-04     | Phase 8  | Pending |
| PG-WF-05     | Phase 8  | Pending |
| PG-WF-07     | Phase 8  | Pending |
| PG-MCP-01    | Phase 1  | Complete |
| PG-MCP-02    | Phase 1  | Partial — 0.88.1 runtime proof passed; combined-tree gate pending |
| PG-MCP-06    | Phase 9  | Pending |
| PG-MCP-08    | Phase 9  | Pending |
| PG-MCP-09    | Phase 9  | Pending |
| PG-CORE-01   | Phase 4  | Pending |
| PG-CORE-03   | Phase 10 | Pending |
| PG-CORE-05   | Phase 10 | Pending |
| PG-CORE-06   | Phase 10 | Pending |
| PG-CORE-07   | Phase 10 | Pending |
| PG-SKILL-04  | Phase 4  | Pending |
| PG-SKILL-01  | Phase 11 | Pending |
| PG-CMD-09    | Phase 11 | Pending |
| PG-SKILL-11  | Phase 11 | Pending |
| PG-SEC-01    | Phase 4  | Pending |
| PG-SEC-02    | Phase 10 | Pending |
| PG-SEC-03    | Phase 9  | Pending |
| PG-DOC-01    | Phase 11 | Pending |
| PG-DOC-02    | Phase 11 | Pending |

**Coverage:**

- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

______________________________________________________________________

*Requirements defined: 2026-11-11*
*Last updated: 2026-11-11 after roadmap creation (traceability filled)*
