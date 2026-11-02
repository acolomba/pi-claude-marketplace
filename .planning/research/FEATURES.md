# Feature Research

**Domain:** Behavioral (cucumber) coverage of the six bridged Claude plugin component kinds -- skills, commands, agents, hooks, MCP servers, workflows -- observed through Pi and its companions after a real `/claude:plugin install`, with Claude Code as the reference and Pi's faux model in place of an authenticated LLM (milestone `component-features`).
**Researched:** 2026-10-31
**Confidence:** MEDIUM-HIGH overall. HIGH where the 2.1.316 binary was grepped and the extension code was read; MEDIUM where only the docs state the upstream behavior; each row carries its own level.

## How to read this file

**Evidence tags.** `[bin]` = grep of `/opt/claude-code/bin/claude`, `claude --version` = **2.1.316**, run 2026-10-31. `[doc:<page>]` = https://code.claude.com/docs/en/<page>, retrieved 2026-10-31. `[pi]` = Pi 1.3.0 source and docs in `node_modules/@earendil-works/pi-coding-agent` (1.4.0 checked where named). `[repo]` = a path in this repository. Decision and requirement IDs (SK-2, D-07, ANAME-01, ...) are recorded licenses.

**Disposition codes.**

| Code | Meaning |
|------|---------|
| MATCH | The extension does what Claude Code does |
| DIV(id) | Recorded divergence; `id` is the license |
| PIGAP | Pi capability gap licenses it (recorded or obvious) |
| **GAP** | UNRECORDED gap: upstream behavior with no license -- needs a user decision |
| **CONTRA** | A recorded decision or doc contradicts current upstream evidence |
| **EDGE** | Unrecorded edge case or doc drift worth a decision or a scenario |
| **BUG** | Unlicensed divergence the bug policy says to fix in the phase |

**Observation tiers.** `MF` = model-free: RPC `get_commands`, the probe extension (`pi.getAllTools()`, `pi.getCommands()`), companion slash commands, a hook recorder file, the stub MCP server log, the workflow engine's `.events.jsonl`, `/claude:plugin` output. `FX` = needs a faux-model turn (spike 028 `faux-extension.ts`). `RM` = needs a real model; out of scope this milestone. `TUI` = only the interactive TUI shows it (the `features/lib/pi-tui.ts` PTY driver).

---

## Decisions Needed (gaps, contradictions, edge cases)

These have no recorded license. Each one blocks or shapes at least one scenario. The kind sections below give the evidence. Suggested owner = the component phase whose discuss step should settle it.

| ID | Kind | Finding | Upstream (evidence) | Extension today (evidence) | Suggested question to the user | Conf |
|----|------|---------|--------------------|---------------------------|--------------------------------|------|
| FG-01 | commands | **CONTRA/GAP: positional arguments are 0-based upstream, 1-based in Pi.** A Claude command written `$1` gets the *second* argument upstream and the *first* under Pi. | `$N` = `$ARGUMENTS[N]`, 0-based; `$0` is the first argument; a missing index stays literal [bin: `T2e`, `/\$(\d+)(?!\w)/` -> `G(N)`; doc:skills "String substitutions"] | Commands pass through byte-identical; Pi `substituteArgs` uses `args[N-1]`, and a missing index becomes `""` [pi: `dist/core/prompt-templates.js`; repo: `bridges/commands/stage.ts`] | Rewrite placeholders at install time (`$0`->`$1`, `$N`->`$(N+1)`, `$ARGUMENTS[N]`->`$(N+1)`), or record a Pi-gap divergence? | HIGH |
| FG-02 | commands | **GAP: arguments are dropped when the body has no placeholder.** | Appends `\n\nARGUMENTS: <args>` when nothing was substituted [bin: `T2e` tail `!Se&&r&&n`; doc:skills] | Pi substitutes only; it adds nothing, so `/plugin:cmd foo` loses `foo` [pi: `substituteArgs`] | Append `ARGUMENTS: $ARGUMENTS` at install time to bodies with no placeholder? | HIGH |
| FG-03 | commands, skills | **GAP: other substitution forms.** `$ARGUMENTS[N]`, named `$name` from `arguments:`, `\$` escape, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`. Pi-only `${1:-x}`, `$@`, `${@:N}` expand under Pi but stay literal upstream. | [bin: `T2e`; `ARGUMENTS: ... ${CLAUDE_SESSION_ID} ... ${CLAUDE_EFFORT}` strings; doc:skills] | None substituted; Pi turns `$ARGUMENTS[0]` into all arguments plus a literal `[0]` [pi] | Which forms to translate at install; record the rest as divergences | HIGH |
| FG-04 | skills | **GAP: skill arguments are not substituted.** | Same substitution as commands, with `ARGUMENTS:` appended when no placeholder [doc:skills] | Pi appends the raw text after the `<skill>` block and substitutes nothing [pi 1.4.0 `agent-session.js` "Expand skill commands"] | Transform `/skill:` input in the existing `input` handler (`edge/skill-aliases.ts`), or record a Pi gap? | HIGH |
| FG-05 | skills, commands | **GAP: dynamic context injection `` !`cmd` `` and ` ```! ` blocks never run.** Common in real plugins, for example `!`git status``. | Runs the shell command before the content reaches the model; a failure aborts the invocation; `shell:` selects bash or powershell [doc:skills "Dynamic context injection"; bin: `e.includes("!`")`] | Literal text reaches the model; no code handles it [repo: no match outside `bridges/mcp/adapter-escape.ts`] | Implement (input transform plus a spawn chokepoint), or record a Pi gap? Needs a security review either way | HIGH |
| FG-06 | skills, commands | **CONTRA: description fallback.** D-86-06 (SKILL-02) followed the older "first paragraph" docs. | First non-empty line; a `#` heading yields its text without the hashes; cut at 100 chars (97 + `...`) [bin: `A2e(content,"Plugin skill"/"Plugin command")`; doc:skills "first non-empty line"] | Skills: first prose paragraph, headings skipped, no length cut [repo: `bridges/skills/frontmatter-degrade.ts::firstBodyParagraph`]. Commands: Pi's own fallback, first non-empty line cut at 60 chars, `#` kept [pi] | Re-align skills to `A2e`? Synthesize a command `description` at install so the 60-char Pi rule never applies? | HIGH |
| FG-07 | skills | **GAP: frontmatter `name` is ignored for the generated name.** | In a plugin, frontmatter `name` replaces the directory name: `skills/review/SKILL.md` with `name: fancy` gives `/my-plugin:fancy` [doc:skills "Namespacing"] | The name comes from the directory basename, and SK-3 rewrites `name` [repo: `bridges/skills/discover.ts:119`] | Derive from frontmatter `name` when present? (Verify first with `claude plugin details`) | MEDIUM |
| FG-08 | skills | **CONTRA: skill/command clash on one qualified name.** SK-6 gives the command or prompt template priority. | A skill wins over a command of the same name [doc:skills "Namespacing and precedence"; stated for `.claude/`, not verified for one plugin] | `edge/skill-aliases.ts:91-94`: a non-skill command with the name wins | Probe upstream with one plugin that has `skills/x` and `commands/x.md`, then decide | MEDIUM |
| FG-09 | skills | **EDGE: the `/plugin:skill` alias works only in interactive input.** RPC and print `/plugin:skill` falls through to Pi. | `/plugin:skill` is the only name [doc:skills] | `event.source !== "interactive"` returns `continue` [repo: `edge/skill-aliases.ts:82`] | Accept (and test through the TUI) or extend to RPC? | HIGH |
| FG-10 | skills, commands | **GAP: frontmatter fields dropped silently.** v1.15 recorded only `allowed-tools`, `disallowed-tools`, `model`, `context: fork` as out of scope, without a decision ID. Also unrecorded: `effort`, `agent`, `background`, skill-scoped `hooks`, `paths`, `shell`, `arguments`. Agents warn about dropped fields; skills and commands say nothing. | All are honored [bin: skill schema `PEo`/`MEo` describe strings; doc:skills table] | Passed through byte-identical; Pi reads only `name`, `description`, `argument-hint`, `disable-model-invocation` [pi 1.4.0] | One divergence ID licensed by the Pi gap; should install warn per field as agents do? | HIGH |
| FG-11 | commands | **GAP: commands are model-invocable upstream.** | Commands were merged into skills; the model may run them through the Skill tool unless `disable-model-invocation` [doc:skills "Commands have been merged into skills"; bin: plugin commands load through the same skill loader `XK`] | Pi prompt templates are user-only | Record a Pi gap, or also stage commands as skills? | HIGH |
| FG-12 | commands | **GAP: `user-invocable: false` on commands.** The 2026-10-31 decision covers skills only. | Hidden from `/` and refused on `/name` [doc:skills invocation table] | Listed and runnable | Extend the skills divergence ID to commands | HIGH |
| FG-13 | commands | **GAP: the object-map `commands` form makes the plugin unavailable.** | `commands` may be `{name: {source|content, description, argumentHint, model, allowedTools}}` [doc:plugins-reference "commands"] | Non-string element -> `component path ... is not a string` note [repo: `domain/component-paths.ts:62-73`] | Support the map (`content` needs a synthesized file), or record an unsupported form? | HIGH (code), HIGH (doc) |
| FG-14 | commands, agents, workflows | **CONTRA/EDGE: replace vs union.** Upstream replaces the default dir for `commands`, `agents`, `workflows` and adds for `skills`. D-07 unions all of them. PROJECT.md "Out of Scope" says "explicit declaration replaces the default", which contradicts D-07. | [doc:plugins-reference "How each key combines with its default location"] | Union [repo: `docs/workflows-compatibility.md`; D-07 / COMP-01] | Confirm D-07 still stands, fix the PROJECT.md bullet, pin the union in a scenario | HIGH |
| FG-15 | agents | **GAP: nested agent files are ignored.** | `agents/review/security.md` registers as `my-plugin:review:security` [doc:sub-agents "Plugin naming"; doc:plugins-reference "Subfolders are part of the agent name"] | Flat, non-recursive [repo: `bridges/agents/discover.ts:3`] | Recurse and colon-join, as CM-4 does for commands? | MEDIUM-HIGH |
| FG-16 | agents | **EDGE: preloading a `disable-model-invocation` skill.** | Not preloaded: "skills can't be preloaded" [doc:sub-agents "Skills preloading"] | No check in `bridges/agents/` | Skip and warn? | MEDIUM |
| FG-17 | agents | **GAP: fields with a pi-subagents near-analog are dropped.** `background` (pi-subagents `async`), `memory` (pi-subagents `memory`), `maxTurns`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow`, `initialPrompt` (upstream ignores it for plugins). | [bin: agent schema list `...maxTurns,autoCompactWindow,skills,initialPrompt,memory,background,omitClaudeMd,isolation`; doc:sub-agents] | Recorded in `droppedFields` with a warning [repo: `bridges/agents/convert.ts` `SUPPORTED_SOURCE_FIELDS`]; pi-subagents 0.84 reads `async`, `memory`, `maxSubagentDepth`, `toolBudget` | Map `background`->`async`, `memory`->`memory`? Record the rest | MEDIUM |
| FG-18 | agents | **EDGE: the `--map-model` table is stale.** No `fable` alias; full model IDs are not passed through; targets `claude-opus-4-7`/`claude-sonnet-4-6`. | Aliases `sonnet`, `opus`, `haiku`, `fable`, full IDs, `inherit` [doc:sub-agents "Model field"] | `MODEL_MAP` [repo: `bridges/agents/convert.ts:43-47`] | Refresh the table and pass full `claude-*` IDs through? | MEDIUM |
| FG-19 | hooks | **BUG: exec-form `${CLAUDE_PLUGIN_ROOT}` is not substituted.** A hook `{"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/x.js"]}` receives the literal string. | "Path placeholders like ${CLAUDE_PLUGIN_ROOT} are substituted per-element" [bin: hook `args` describe string]; "Anywhere in `command` and `args`" [doc:plugins-reference "Where each variable resolves"] | `planSpawn` copies `args` and `command` verbatim; no `substituteClaudeVars` in `bridges/hooks/` [repo: `bridges/hooks/spawn-helpers.ts:33-42`] | None needed: fix in the hooks phase under the bug policy | HIGH |
| FG-20 | hooks | **GAP: the SessionEnd `reason` mapping beyond `new`->`clear`.** | Closed set `clear`, `resume`, `logout`, `prompt_input_exit`, `other` [bin: `_xi=[...]`] | D-60-04 passes Pi `quit`/`reload`/`new`/`resume`/`fork` through; matcher closed set empty [repo: `domain/components/hook-events.ts:262-265`] | Map `quit`->`prompt_input_exit`? `reload`/`fork`->`other`? Admit which matchers? | HIGH |
| FG-21 | hooks | **GAP: SessionStart on Pi `reload`.** | No `reload` value; enum `startup`/`resume`/`clear`/`compact`/`fork` [bin: `source:U([...])`] | Sends `source: "reload"` [repo: `bridges/hooks/payloads/session-start.ts:34`] | Send `startup`, suppress, or keep `reload` as a Pi-gap divergence? | HIGH (facts), upstream behavior for a reload unknown |
| FG-22 | hooks | **GAP: new handler fields.** `once: true` (run once, then remove) and `onFailure: "continue"|"block"` (`block` turns a crash, timeout, or other exit code into exit 2). | [bin: command-hook schema `once`, `onFailure` describe strings] | `once` is tolerated in the schema and not implemented; `onFailure` is not modeled [repo: `domain/components/hooks/schema.ts:44-45`] | Implement both (small), or record them? | HIGH |
| FG-23 | hooks | **EDGE: new events and a doc contradiction.** `DirectoryAdded`, `PreModelSwitch`, `PostModelSwitch` exist (HKMS-01 covers the model-switch pair). PROJECT.md says the inapplicable events are "silently dropped ... debug-logged only", but the partition drops every non-admitted event as `{unsupported hooks}`. | [bin: hook event tuple] | `domain/components/hooks/partition.ts` (`kind: "event"`) | Record `DirectoryAdded`; correct PROJECT.md or the code | MEDIUM |
| FG-24 | hooks | **GAP: the manifest `hooks` field is never installed.** A path, an array, or an inline object is read only to detect a hooks module; only `hooks/hooks.json` installs. The rest is dropped silently. | Merges with `hooks/hooks.json`; also inline objects and the marketplace-entry form [doc:plugins-reference "hooks"] | [repo: `domain/hooks-resolution.ts:65-75,140-152`] | Implement the merge, or classify it unsupported so it is not silent? | HIGH |
| FG-25 | hooks | **EDGE: doc drift.** `docs/hooks-compatibility.md` and the `hook-events.ts` header say Pi compact events "carry no trigger field" and that only match-all is supported. The code admits `manual`/`auto` (PDEF-08). Pi 1.3/1.4 carry `reason: manual|threshold|overflow`. | -- | `NON_TOOL_EVENT_CLOSED_SETS.PreCompact` | None: fix the docs; pin it with a scenario | HIGH |
| FG-26 | hooks | **EDGE: `systemMessage` is dropped as "no Pi surface".** Pi has `ctx.ui.notify`. | Shown to the user [doc:hooks] | Silent drop [repo: `docs/hooks-compatibility.md`] | Surface it through the notify chokepoint? | MEDIUM |
| FG-27 | mcp | **CONTRA: `mcpServers` sources merge upstream; MC-1 picks the first.** | `.mcp.json` loads first, then each declared shape; a server name declared later replaces an earlier one; arrays and `.mcpb` bundles are accepted [doc:plugins-reference "mcpServers"] | MC-1: entry > manifest > `.mcp.json`, first match wins, no merge [repo: `docs/prd` MC-1] | Re-decide MC-1 for parity, or record it with an ID | HIGH |
| FG-28 | mcp | **EDGE: one malformed server.** Upstream skips that server only; the extension makes the whole plugin `(unavailable) {malformed mcp}`. | [doc:mcp; `docs/mcp-compatibility.md` "Invalid server configs"] | Documented, but no decision ID found | Confirm the license ID, or align | MEDIUM |
| FG-29 | mcp | **PIGAP to note for the harness: project-scope servers in headless sessions.** pi-mcp-adapter skips an unapproved project server unless user-global `settings.projectServers: "allow"`; upstream never asks for plugin servers. | [`docs/mcp-compatibility.md` "Project-scope servers"] | Adapter-owned trust | The harness must configure the adapter, or project-scope MCP scenarios cannot connect | HIGH |
| FG-30 | mcp | **EDGE: adapter 7.x.** Every MCP doc row was measured on 5.0/5.2 (`toolPrefix`, `directTools`, `auth: "oauth"`, `mcp-adapter.json`, `pi-mcp-adapter/status/v1`). The milestone raises the floor to 7.x. | -- | -- | Re-measure in the harness phase; a break is fixed there | MEDIUM |
| FG-31 | workflows | **PIGAP to record: no run approval.** Upstream asks before running a plugin workflow by name (manual mode) or relies on permission rules (`-p`); the engine runs at once. | [doc:workflows "Approve the plan before it runs"] | Engine-owned | Record it as a Pi gap with an ID | HIGH |
| FG-32 | workflows | **EDGE: typed arguments.** Upstream: the model passes `args` as structured data; there is no stated rule for text typed after `/plugin:name`. The engine gives `{_, _raw, key=value}`. | [doc:workflows "Pass input to a saved workflow"] | `docs/workflows-compatibility.md` "Script semantics" | Accept the engine's shape (no upstream position) and pin it | MEDIUM |
| FG-33 | all | **EDGE: the user-invocable decision has no ID yet.** Spike 028 took the decision on 2026-10-31, but it has no ID in PROJECT.md. | -- | -- | Assign IDs to the four 2026-10-31 decisions (user-invocable, compact, fork, new->clear) | HIGH |

Existing scenario impact: `features/plugin/session-start-hooks.feature` expects `source new`. The recorded `new`->`clear` change makes both scenarios fail. The hooks phase must update them as the scenario that fails without the change.

---

## Feature Landscape

### Table Stakes (each component phase must cover these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Listing and naming per kind, model-free | A Claude user knows `/plugin:name`, `plugin:agent`, `mcp__plugin_p_s__tool` | LOW | `get_commands`, the probe extension, companion surfaces (spike 028) |
| Frontmatter and field variants per kind | These are the upstream contract fields a plugin author relies on | MEDIUM | Pin each MATCH and each DIV; a GAP waits for its decision |
| Invocation through the faux model | Shows that what reaches the model matches upstream | MEDIUM | Faux records the system prompt, the user message, and tool calls |
| Companion-missing degradation (agents, MCP, workflows) | Core Value: degradation never blocks the install | LOW | `{requires pi-subagents}` / `{requires pi-mcp-adapter}` / `{requires pi-dynamic-workflows}`; recovery = load the companion, then `/reload`, with no reinstall |
| Removal and replacement through uninstall, disable, enable, update | Lifecycle parity | MEDIUM | Observe through the host after `new_session` (spike: it reloads resources) |
| Hook parity fixes (`new`->`clear`, `compact`, `fork`) | Recorded milestone target | MEDIUM | Each needs a scenario that fails without the change |
| FG-19 exec-form placeholder fix | Bug policy | LOW | One hooks scenario |

### Differentiators (where this suite goes beyond earlier milestones)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tool-use hooks driven by scripted faux tool calls | Proves PreToolUse/PostToolUse exit codes and JSON decisions end-to-end without a key | MEDIUM | Spike: RPC `bash` does not fire PreToolUse; only a model tool call does |
| Agent runs with the child prompt recorded | Proves body conversion, `${CLAUDE_*}` substitution, preloads, tools | MEDIUM | `async: false` only (spike gotcha) until the 0.84 floor is proven |
| MCP calls through the adapter, logged by the stub | Proves naming, variable expansion, env, arguments end-to-end | MEDIUM | Spike: go through the `mcp` proxy; direct tools are not active by default (`directTools: "search"`) |
| Workflow runs read from `.events.jsonl` | Proves `meta.name`, args parsing, result | LOW | Results are not delivered over RPC (spike gotcha) |
| Cross-kind: hook on a plugin MCP tool, agent granted a plugin MCP tool | The kinds work together as upstream promises | MEDIUM | Needs both fixtures from the harness phase |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Asserting on files the bridge wrote | Easy to check | Milestone rule: observe through Pi or a companion only. It also duplicates the unit tests | Probe extension, `get_commands`, companion surfaces |
| Testing model auto-selection of skills or agents | Upstream headline behavior | Needs a real model (RM) | Assert the description reaches the model's system prompt (FX) |
| Workflows whose scripts call `agent()` | Real workflows do | Needs the faux model reachable from the engine's agents; not tried (spike) | Defer to a real-provider milestone |
| Background (`async: true`) agent runs | Upstream default for some agents | pi-subagents 0.74 failed on host packages; unproven at 0.84 | Use `async: false`; add one async scenario only if the harness phase proves it |
| Pinning a GAP behavior before the user decides | Keeps phases moving | Locks in an unlicensed divergence | The discuss step of each phase settles the FG items first |

## Per-Kind Contracts

### 1. Skills

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| S1 | Plugin skills are invoked as `/plugin:skill` | doc:skills, HIGH | `/skill:<plugin>-<skill>` (SK-1/SK-2); `/plugin:skill` alias in interactive input only (SK-6) | DIV(SK-2, Pi name validator `a-z0-9-`) + **FG-09** | MF (`get_commands`), TUI (alias) |
| S2 | `<plugin>-` prefix | upstream: no elision | Elided (SK-2) | DIV(SK-2/RN-1) | MF |
| S3 | Name from frontmatter `name` | doc:skills, MEDIUM | Directory basename | **FG-07** | MF |
| S4 | `description` fallback | bin `A2e`, HIGH | First paragraph | **FG-06** | MF |
| S5 | `when_to_use` appended; 1,536-char cut | doc:skills, HIGH | WTU-01/02 | MATCH | MF (description in `get_commands`) |
| S6 | Unparseable frontmatter | upstream: skill loads, debug-only message | SKILL-01: placeholder, `disable-model-invocation: true`, install warning (WARN-01) | DIV(SKILL-01/WARN-01) | MF |
| S7 | `disable-model-invocation: true` hides the skill from the model; `/name` still works | doc:skills, HIGH | Pi-native, passed through | MATCH | FX (absent from the system prompt), MF (listed) |
| S8 | `user-invocable: false` hides it from `/` and refuses `/name` | bin + doc, HIGH | Listed and runnable | DIV(2026-10-31 Pi-gap decision; **FG-33** ID) | MF |
| S9 | `$ARGUMENTS`, `$N`, `ARGUMENTS:` append | bin `T2e`, HIGH | Raw append by Pi | **FG-04** | FX |
| S10 | `` !`cmd` `` injection | doc:skills, HIGH | Literal | **FG-05** | FX |
| S11 | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}` | doc:skills, plugins-reference, HIGH | Install-time substitution; PROJECT_DIR at project scope only (SK-4, SUB-01/02) | MATCH / DIV(SUB-02 at user scope) | FX |
| S12 | `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}` | bin, HIGH | Literal | **FG-03** | FX |
| S13 | `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context: fork`, `agent`, `background`, `hooks`, `paths`, `shell`, `arguments` | bin schema, HIGH | Ignored silently | Partly recorded (v1.15 Out of Scope, no ID) + **FG-10** | n/a (pin "still invocable") |
| S14 | `skills` manifest key adds to `skills/` | doc:plugins-reference, HIGH | Union (D-07) | MATCH | MF |
| S15 | Same-plugin references | -- | Rewritten to Pi invocations (SK-7, D-142) | Pi-name necessity | FX (body as the model sees it) |
| S16 | Skill vs command clash | doc, MEDIUM | Command wins | **FG-08** | TUI |
| S17 | Enable/disable/uninstall take effect | upstream: `/reload-plugins` | After `/reload` (NFR-2) | DIV(NFR-2) | MF |

### 2. Commands

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| C1 | `/plugin:cmd`; nested dirs colon-joined | bin (path join in `XK` caller), doc, HIGH | CM-1/CM-4 | MATCH | MF |
| C2 | No prefix elision | bin, HIGH | `<plugin>-` elided | DIV(CM-2, D-141-01/02) | MF |
| C3 | Dotfile entries registered | measured 2.1.228 | Skipped | DIV(CM-4) | MF |
| C4 | Description fallback | bin `A2e`, HIGH | Pi rule (60 chars, `#` kept) | **FG-06** | MF |
| C5 | `argument-hint` | doc, HIGH | Pi-native | MATCH | TUI or probe (`get_commands` omits it) |
| C6 | `$ARGUMENTS` | bin, HIGH | Pi-native | MATCH | FX |
| C7 | `$N` 0-based; missing index stays literal | bin, HIGH | 1-based; missing becomes empty | **FG-01** | FX |
| C8 | `ARGUMENTS:` append with no placeholder | bin, HIGH | Dropped | **FG-02** | FX |
| C9 | `$ARGUMENTS[N]`, `$name`, `\$` | bin, HIGH | Not supported | **FG-03** | FX |
| C10 | Shell-quoted arguments (`"a b"` = one) | bin `Ck` shell-quote, doc, HIGH | Pi `parseCommandArgs` quotes | MATCH (verify escapes) | FX |
| C11 | Model-invocable through the Skill tool | doc, HIGH | User-only | **FG-11** | RM to prove upstream; pin a negative FX |
| C12 | `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context`, `agent` | doc, HIGH | Ignored | **FG-10/FG-12** | MF |
| C13 | Malformed frontmatter | upstream loads | CMD-01 neutralizes plus warning | MATCH + DIV(WARN-01) | MF |
| C14 | `${CLAUDE_*}` in the body | doc, HIGH | CM-3, SUB-02 | MATCH | FX |
| C15 | `commands` object map | doc, HIGH | Plugin unavailable | **FG-13** | MF |
| C16 | `commands` key replaces `commands/` | doc, HIGH | Union | DIV(D-07) + **FG-14** | MF |
| C17 | `!`cmd`` | doc, HIGH | Literal | **FG-05** | FX |

### 3. Agents (pi-subagents)

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| A1 | Named `plugin:agent` | doc:sub-agents, plugins-reference, HIGH | Frontmatter name `plugin:agent` (AG-1a), file `pi-claude-marketplace-<plugin>-<agent>.md` (AG-1/AG-5), flat alias | MATCH | FX (`subagent {action:"list"}`), MF (`/subagents-doctor` count) |
| A2 | Nested `agents/x/y.md` -> `plugin:x:y` | doc, MEDIUM-HIGH | Not discovered | **FG-15** | FX |
| A3 | `description` required | doc, HIGH | Fallback text plus warning (AG-7) | DIV(AG-7) | FX + MF warning |
| A4 | `tools` omitted inherits all | doc, HIGH | No allowlist -> pi-subagents defaults (#179) | MATCH | FX (child tool list) |
| A5 | Tool names | -- | `Read/Bash/Edit/Write/Grep/LS` 1:1, `Glob`->`find`; others silently dropped (AG-7) | DIV(AG-7) | FX |
| A6 | Zero resolvable tools: refuse the launch | doc, HIGH | Install throws (AG-11) | DIV(AG-11: install-time instead of launch-time) | MF |
| A7 | `disallowedTools` | doc, HIGH | Filtered, or emitted as `excludeTools` when `tools` is omitted | MATCH | FX |
| A8 | MCP tools in `tools` | doc, HIGH | `mcp:plugin_<p>_<s>_[/<tool>]` (ANAME-02) | MATCH | FX (needs the MCP stub) |
| A9 | `model` (aliases, `inherit`, full ID) | doc, HIGH | Omitted by default; `--map-model` maps 3 aliases | DIV(AG-7) + **FG-18** | FX (child model), MF (info) |
| A10 | `skills` preload: full content injected | doc, HIGH | Resolved to `<plugin>-<skill>`; unknown dropped with a warning | MATCH + **FG-16** | FX (child prompt holds the skill) |
| A11 | `hooks`, `mcpServers`, `permissionMode` ignored for plugin agents | doc, HIGH | Dropped with guidance (#179) | MATCH | MF (install warning) |
| A12 | `effort` | doc, HIGH | Mapped to `thinking` through an allowlist | MATCH (approx.) | FX |
| A13 | `maxTurns`, `memory`, `background`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow` | bin, HIGH | `droppedFields` warning | **FG-17** | MF |
| A14 | Body = system prompt; `${CLAUDE_*}` substituted | doc, HIGH | PI-10 | MATCH | FX |
| A15 | Lower priority than user/project agents | doc, HIGH | Cross-plugin ownership refusal (AG-9); pi-subagents order | EDGE (user agent with the same name: not modeled) | FX |
| A16 | `SubagentStart`/`SubagentStop` hooks | doc, HIGH | Not supported | DIV(recorded deferral, hooks-compatibility) | -- |
| A17 | pi-subagents absent | -- | `{requires pi-subagents}`; info `(missing)`; recovery by `/reload` | DIV(soft-degrade decision) | MF |

### 4. Hooks

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| H1 | SessionStart `source` | bin, HIGH | Milestone decision: `new`->`clear`, `session_compact`->`compact`, admit the `clear`/`compact`/`fork` matchers | Target; **FG-21** (reload) | MF (startup, new, resume, fork); FX (compact) |
| H2 | SessionEnd `reason` | bin, HIGH | Pass-through; empty matcher set | **FG-20** | MF |
| H3 | UserPromptSubmit fires; exit 2 blocks the prompt; no matcher | doc, HIGH | Matched; matcher refused | MATCH | MF (fires), FX (block keeps the prompt from the model) |
| H4 | PreToolUse/PostToolUse/PostToolUseFailure tool matchers, pipe-OR | doc, HIGH | Tool map; regex -> partial | MATCH / DIV(Out of Scope: regex) | FX |
| H5 | Exit 2 blocks with stderr to the model; other codes non-blocking | doc, HIGH | Matched | MATCH | FX |
| H6 | JSON `permissionDecision`, `updatedInput`, `updatedToolOutput`, `continue:false`, `suppressOutput` | doc, HIGH | Corrected 2026-11-02: before component-features Phase 5 a deny needed exit 0, `updatedInput` merged instead of replacing, `continue: false` did not end a PreToolUse turn, and `updatedToolOutput` never reached the model. D-CF5-11 fixed all four; `defer` stays ignored (Pi gap) | MATCH | FX |
| H7 | `additionalContext` on every event | doc, HIGH | SessionStart and Stop only | DIV(hooks-compat, no ID) **EDGE** | FX |
| H8 | `systemMessage` | doc, HIGH | Dropped | **FG-26** | MF |
| H9 | `if` field | doc, HIGH | Compiler with fall-open | MATCH | FX |
| H10 | Stop/StopFailure, block re-entry, `stop_hook_active`, 8-block cap | doc, HIGH | v1.16 | MATCH (extra turn boundary, not observable by the hook) | FX |
| H11 | PreCompact/PostCompact `trigger` and matchers | bin, HIGH | `manual`/`auto` admitted (PDEF-08) | MATCH + **FG-25** docs | FX (`/compact` summarization uses the model) |
| H12 | Exec-form `${CLAUDE_PLUGIN_ROOT}` | bin, HIGH | Literal | **FG-19 BUG** | MF (SessionStart exec-form hook) |
| H13 | Env: `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_ENV_FILE` (read back) | doc, HIGH | All set; `CLAUDE_ENV_FILE` not sourced back | MATCH / DIV(env-vars.md) | MF |
| H14 | `timeout` seconds, defaults | doc, HIGH | Matched, SessionEnd per-hook budget (HKTO-01 backlog) | MATCH / recorded backlog | MF |
| H15 | `async`, `asyncRewake` | doc, HIGH | Matched (not on Stop) | MATCH | MF |
| H16 | `once`, `onFailure` | bin, HIGH | Not implemented | **FG-22** | MF |
| H17 | Handler types `http`, `prompt`, `agent`, `mcp_tool` | doc, HIGH | Partial drop `{unsupported hooks}` | DIV(hooks-compat) | MF (install output) |
| H18 | Unsupported events | bin, HIGH | Partial drop | DIV + **FG-23** | MF |
| H19 | Manifest `hooks` field merge | doc, HIGH | Ignored | **FG-24** | MF |
| H20 | Hooks on plugin MCP tools by Claude name; the proxy `mcp({tool})` reaches hooks as `mcp` | doc, HIGH | ANAME-02. Corrected 2026-11-02: before D-CF5-12 the proxy fired match-all hooks twice (as `mcp` and under the real name). Since D-CF5-12 the outer proxy call runs no hook and the nested call fires once under the real name | MATCH / PIGAP | FX |
| H21 | `${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*` | doc, HIGH | Not supported | DIV(USRCFG-01 backlog) | -- |
| H22 | Duplicate `session_start` on RPC `new_session` | -- | Deduplicated (#294, SSDEDUP-01) | MATCH | MF |

### 5. MCP servers (pi-mcp-adapter)

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| M1 | Tool names `mcp__plugin_<p>_<s>__<tool>` | bin/doc, HIGH | Key `plugin_<p>_<s>_` + `toolPrefix: "mcp"` (ANAME-01) | MATCH | MF (`getAllTools()` after an activating search -- FX -- or with `alwaysLoad`) |
| M2 | Tools deferred behind tool search; `alwaysLoad` keeps them in the prompt | doc, HIGH | `directTools: "search"` / `true` (ANAME-04); per-tool `_meta` ignored | MATCH / DIV(doc) | FX (faux records the request's tool list) |
| M3 | Connects at session start, stays connected | doc, HIGH | Adapter `lazy` lifecycle (ANAME-05) | DIV(ANAME-05) | MF (stub log: initialize, tools/list) |
| M4 | stdio `command`/`args`/`env`; `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` | doc, HIGH | AVAR-01..05 | MATCH | MF (stub argv/env log) |
| M5 | `${VAR:-default}`; plain `${VAR}` | doc, HIGH | Default resolved at install; plain left for the adapter | MATCH (install-time snapshot) | MF |
| M6 | Credential deny-list | doc, HIGH | Withheld plus warning | MATCH | MF |
| M7 | `http`/`sse` with `url`, `headers` | doc, HIGH | `httpTransport: "sse"` for sse | MATCH | MF (loopback HTTP stub) |
| M8 | OAuth unless an `Authorization` header | doc, HIGH | `auth: "oauth"` rule (D-08-04) | MATCH | MF (entry effect visible only on connect; a full OAuth flow is out of scope) |
| M9 | `timeout`, `request_timeout_ms` | doc, HIGH | `requestTimeoutMs` | DIV(doc: progress resets) | MF |
| M10 | `ws`, `headersHelper`, `oauth.xaa`, leading `~` | bin, HIGH | `(partially-available) {unsupported mcp}` | DIV(doc) | MF |
| M11 | One malformed server is skipped | doc, HIGH | Whole plugin unavailable | **FG-28** | MF |
| M12 | Sources merge | doc, HIGH | First match | **FG-27** | MF |
| M13 | Collisions (same key, `-`/`_` fold) | -- | Refused, rolled back (ANAME-03) | DIV(ANAME-03) | MF |
| M14 | Plugin servers need no approval | doc, HIGH | Adapter project trust | PIGAP **FG-29** | MF |
| M15 | Tool permission fields | bin, HIGH | Not enforced plus warning (ANAME-07) | DIV(ANAME-07) | MF |
| M16 | User overrides survive | -- | D-08-01/02, AFILE-06 | Pi-only feature | MF (adapter `/mcp` view or probe) |
| M17 | Adapter absent | -- | `{requires pi-mcp-adapter}`, info `(missing)` (MC-8, D-01-01) | DIV(soft-degrade) | MF |
| M18 | `info` status | -- | `pi-mcp-adapter/status/v1` events (MC-11) | Pi-only | MF |

### 6. Workflows (pi-dynamic-workflows)

| # | Upstream behavior | Evidence / conf | Extension | Disposition | Tier |
|---|-------------------|-----------------|-----------|-------------|------|
| W1 | `/plugin:<meta.name>` | doc:workflows, bin 2.1.267, HIGH | WNAM-01/06 | MATCH | MF (`get_commands` source extension) |
| W2 | No prefix elision | doc, HIGH | Elided | DIV(WNAM-06/RN-1) | MF |
| W3 | Non-literal `meta.name`, no `meta` -> skipped | doc, HIGH | Skipped with a warning | MATCH | MF |
| W4 | `meta` not first, non-`const`, no description | doc, HIGH | Installed with a caveat; the engine refuses at run | DIV(admit-vs-run, documented) | MF (run fails in the events file) |
| W5 | Determinism blocklist | doc, HIGH | Per-file refusal | MATCH | MF |
| W6 | Syntax error | doc: reported at run | Refused at install | DIV(documented) | MF |
| W7 | Size cap 524,288 | bin 2.1.267 | Per-file skip | MATCH | MF |
| W8 | Dotfiles, symlinks | upstream admits | Refused (D-14) | DIV(D-14) | MF |
| W9 | `workflows` key replaces `workflows/` | doc, HIGH | Union (D-07) | DIV + **FG-14** | MF |
| W10 | Run approval | doc, HIGH | None | **FG-31** | -- |
| W11 | `args` | doc, MEDIUM | `{_, _raw, k=v}` | **FG-32** | MF (events file) |
| W12 | Engine absent | -- | Envelope written; `{requires pi-dynamic-workflows}`; warning severity on standalone install, manual update, standalone enable (WDEP-02) | DIV(WDEP-02) | MF |
| W13 | Uninstalled command lingers until `/reload` | -- | Notice (WLIF-06) | PIGAP(no `unregisterCommand`) | MF |
| W14 | `agent()` inside scripts | doc | Engine | RM / out of scope | RM |

---

## Feature Dependencies

```
Harness phase (faux provider, companion Pi, MCP stub, hook recorder, probe extension, fixture builders, shared steps, version raise)
    └──required by──> every kind phase below

Decision gate per kind (FG items) ──blocks──> scenarios that pin the gap behavior

Skills fixture builder ──enhances──> Agents (A10 skills preload)
MCP stub ──required by──> Agents (A8 MCP grants), Hooks (H20 MCP tool matcher)
Faux tool-call scripting ──required by──> Hooks tool-use, MCP tool calls, Agent runs
pi-subagents 0.84 floor ──required by──> any async agent scenario (anti-feature until proven)
pi-mcp-adapter 7.x re-measure (FG-30) ──required by──> MCP phase
Workflow engine >= 3.15 (honors PI_CODING_AGENT_DIR) ──required by──> Workflows phase
```

### Dependency Notes

- **The harness phase owns every shared file** (`features/support/**`, `features/lib/**`, the shared step modules) under `.agents/skills/cucumber/rules/layout.md` "Parallel work". Kind phases add only their own feature files and verb step modules.
- **Cross-kind scenarios (H20, A8, A10)** use the stub and fixtures that the harness provides. Each one lives in the consuming kind's phase, so no stream edits another stream's file.
- **`features/plugin/session-start-hooks.feature`** belongs to the `plugin` function. The hooks stream needs to change its expected `new` to `clear`. Either the harness phase moves the file to `features/hook/` first, or the hooks phase edits it with explicit ownership.

## Scenario Plan (feature files that can be written independently)

Paths follow `features/<function>/<capability>.feature`, titled `Feature: <Function> <capability>`. Functions use the singular, as `plugin` and `marketplace` do. Within a kind, each file is independent of the others, so a phase can give one file to each executor in a wave. `[G]` marks a scenario whose expected outcome waits for the FG decision named.

### features/skill/ (skills phase)

- **listing.feature** (MF): listed as `/skill:<plugin>-<skill>` with its description; `<plugin>-` elided, and a name equal to the plugin gives `/skill:<plugin>`; `when_to_use` folded and cut at 1,536; missing description [G FG-06]; frontmatter `name` differs from the directory [G FG-07]; unparseable frontmatter still listed with an install warning; two directories eliding to one name keep the first with a warning; a declared `skills` path loads beside `skills/`; `user-invocable: false` still listed (DIV); skills of both scopes.
- **invocation.feature** (FX): `/skill:x` sends the body in a `<skill>` block; `${CLAUDE_PLUGIN_ROOT}`/`DATA`/`SKILL_DIR` replaced; `${CLAUDE_PROJECT_DIR}` replaced at project scope and literal at user scope; same-plugin reference rewritten to `/skill:`; arguments after the command [G FG-04]; `` !`cmd` `` [G FG-05]; a model-invocable skill appears in the system-prompt skill list; a `disable-model-invocation` skill does not appear and still runs on `/skill:`.
- **qualified-name.feature** (TUI): `/plugin:skill` runs the skill interactively; autocomplete offers it; a command with the same qualified name [G FG-08]; RPC behavior [G FG-09].
- **lifecycle.feature** (MF): uninstall, disable, enable, update (renamed or removed skill), reinstall -- each observed on a new session.

### features/command/ (commands phase)

- **listing.feature** (MF): `/<plugin>:<cmd>` with source `prompt`; nested `build/web.md` -> `plugin:build:web`; `acme-lint` -> `acme:lint`; dotfile skipped; malformed frontmatter neutralized with a warning; description fallback [G FG-06]; `user-invocable: false` [G FG-12]; object-map `commands` [G FG-13]; declared path plus `commands/` union (D-07) [G FG-14].
- **arguments.feature** (FX): `$ARGUMENTS`; quoted argument stays one; `$1` [G FG-01]; no placeholder [G FG-02]; `$ARGUMENTS[0]`, `$name`, `\$1` [G FG-03]; `${1:-x}` Pi-only form [G FG-03]; `argument-hint` via the probe or TUI.
- **content.feature** (FX): plugin path variables substituted; same-plugin reference rewriting; `` !`cmd` `` [G FG-05].
- **lifecycle.feature** (MF): as for skills.

### features/agent/ (agents phase)

- **listing.feature** (FX list call + MF doctor): `plugin:agent` listed with description and alias; missing description fallback with a warning; duplicate source names keep the first; agent owned by another plugin refused at install (MF); nested agent [G FG-15].
- **conversion.feature** (FX child run + MF warnings): `Read, Grep` -> `read,grep`; `Glob` -> `find`; unmapped tool dropped; omitted `tools` -> default tools; `disallowedTools` -> `excludeTools`; empty mapped `tools` refused at install; `hooks`/`mcpServers`/`permissionMode` dropped with guidance; `model: sonnet` omitted without `--map-model` (child on the session model); with `--map-model` mapped [G FG-18]; `effort` -> `thinking`; other fields [G FG-17].
- **invocation.feature** (FX, `async: false`): child system prompt holds the converted body with path variables substituted; skill preload content present [G FG-16 for a `disable-model-invocation` skill]; plugin MCP tool grant reaches the child (MCP stub).
- **companion.feature** (MF): pi-subagents absent -> `{requires pi-subagents}` row and info `(missing)`; companion loaded later plus `/reload` lists the agent with no reinstall.
- **lifecycle.feature** (FX list): uninstall, disable, update remove or replace the agent.

### features/hook/ (hooks phase)

- **session-start.feature** (MF; compact FX): startup; `/new` sends `clear` (changed); resume; fork; compaction fires `compact`; matchers `startup`/`resume`/`clear`/`compact`/`fork` each run only on their source; reload [G FG-21]; one run per RPC `new_session`; `additionalContext` reaches the model (FX). Migrates the two existing scenarios.
- **session-end.feature** (MF): `/new` sends `clear`; quit/reload/fork reasons [G FG-20]; non-empty matcher [G FG-20]; 1.5 s default budget.
- **user-prompt-submit.feature** (MF + FX): fires with a Claude-shaped stdin; exit 2 keeps the prompt from the model; matcher refused at install.
- **tool-use.feature** (FX): PreToolUse on a faux `bash` call with `tool_name: "Bash"`; `Edit|Write` matcher; an unmapped alternative dropped while the rest fire; exit 2 blocks with stderr reaching the model; `permissionDecision: deny`; `updatedInput`; PostToolUse `tool_response`; PostToolUseFailure; `if: "Bash(git *)"` filters; MCP tool matcher on a direct call fires, through the `mcp` proxy it does not (PIGAP).
- **stop.feature** (FX): Stop fires once per settle; `decision: block` re-enters with the reason; `stop_hook_active`; 8-block cap; StopFailure on an error ending (if the faux provider can end in error).
- **compact.feature** (FX): PreCompact/PostCompact with `trigger: manual`; `manual` and `auto` matchers.
- **process.feature** (MF): env variables; shell form; exec-form `${CLAUDE_PLUGIN_ROOT}` (BUG FG-19); timeout kills; `async` does not block; `once`/`onFailure` [G FG-22].
- **configuration.feature** (MF install/info): unsupported event, regex matcher, `http` handler -> partial with `--partial`; malformed `hooks.json` -> unavailable; manifest `hooks` field [G FG-24]; `DirectoryAdded` [G FG-23].
- **lifecycle.feature** (MF): uninstall and disable stop the hook; update replaces it.

### features/mcp-server/ (MCP phase)

- **connection.feature** (MF): stub spawned with `${CLAUDE_PLUGIN_ROOT}`-expanded args and the default-expanded env; `CLAUDE_PLUGIN_ROOT`/`DATA` in its env; tools named `mcp__plugin_<p>_<s>__<tool>`; `/mcp` lists the server; `info` shows a status.
- **tool-calls.feature** (FX): `mcp` search then call returns the stub reply; `alwaysLoad: true` sends the tool directly in the first request; default deferral.
- **remote.feature** (MF, loopback HTTP stub): `http` connects with expanded `url` and `headers`; `sse`; `ws` partial.
- **configuration.feature** (MF): wrapped and unwrapped `.mcp.json`; source precedence [G FG-27]; one malformed server [G FG-28]; key collision refused and rolled back; withheld credential warning; unset variable warning; tool permission rules warning; user override kept across update and disable.
- **companion.feature** (MF): adapter absent -> `{requires pi-mcp-adapter}` and `(missing)`; adapter loaded plus `/reload` connects with no reinstall.
- **project-scope.feature** (MF): a project-scope server in a headless session under the harness's adapter setting (FG-29).
- **lifecycle.feature** (MF): uninstall removes the tools after reload; disable keeps the user choice in `serverChoices`; update replaces the entry.

### features/workflow/ (workflows phase)

- **listing.feature** (MF): `/<plugin>:<meta.name>` registered; the filename plays no part; prefix elided (DIV); missing `meta` skipped; non-literal name skipped; determinism refusal; syntax refusal; size cap; dotfile and symlink skipped; declared path union [G FG-14].
- **runs.feature** (MF, events file): `/kit:demo hello who=Ada` completes with `{"_":"hello","who":"Ada",...}` [G FG-32]; a script installed with a caveat fails at the engine with its refusal.
- **companion.feature** (MF): engine absent -> `{requires pi-dynamic-workflows}` at warning severity on install, info severity on `list`; engine loaded plus `/reload` registers the command with no reinstall.
- **lifecycle.feature** (MF): uninstall reports the lingering command (WLIF-06) and it is gone after `/reload`; disable and enable; update runs the new script.

## MVP Definition

### Launch With (this milestone)

- [ ] Harness phase: the faux model, companions at the raised floors, the stub, the recorder, the probe -- prerequisite for everything
- [ ] Per kind: listing, invocation (FX), companion degradation, lifecycle files -- the milestone goal
- [ ] Hook parity fixes (`clear`, `compact`, `fork`) and the FG-19 bug fix -- recorded target and the bug policy
- [ ] Decisions on FG-01..FG-05 (arguments and `` !`cmd` ``), the largest real-plugin impact
- [ ] Every FG item either decided or explicitly deferred, with an ID

### Add After Validation

- [ ] Async agent runs -- once pi-subagents 0.84 is proven in the harness
- [ ] Remote MCP OAuth flow end-to-end -- needs an OAuth stand-in
- [ ] StopFailure scenarios -- if the faux provider cannot end a turn in error, add a provider stub

### Future Consideration

- [ ] Real-provider milestone: model auto-selection of skills and agents, commands through the Skill tool (FG-11), workflows calling `agent()`

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Command argument parity (FG-01/02) | HIGH | LOW (install-time rewrite) | P1 |
| `` !`cmd` `` injection (FG-05) | HIGH | HIGH (runtime spawn, security) | P1 decision, implementation P2 |
| Exec-form hook placeholders (FG-19) | HIGH | LOW | P1 |
| Hook `clear`/`compact`/`fork` | MEDIUM | LOW | P1 (recorded) |
| Manifest `hooks` merge (FG-24) | MEDIUM | MEDIUM | P2 |
| MCP source merge (FG-27) | MEDIUM | MEDIUM | P2 |
| Nested agents (FG-15) | MEDIUM | LOW | P2 |
| Object-map `commands` (FG-13) | LOW-MEDIUM | MEDIUM | P2 |
| Description fallback (FG-06) | LOW | LOW | P2 |
| Agent field near-analogs (FG-17), `--map-model` refresh (FG-18) | LOW | LOW | P3 |

## Competitor Feature Analysis

| Feature | Claude Code 2.1.316 | Pi native | Our approach |
|---------|---------------------|-----------|--------------|
| Plugin skill name | `/plugin:skill` | `/skill:name` | `/skill:<plugin>-<skill>` plus an interactive alias |
| Command arguments | `$ARGUMENTS`, 0-based `$N`, `ARGUMENTS:` append | `$ARGUMENTS`, 1-based `$N`, `${N:-d}` | Today pass-through (FG-01..03) |
| Agents | Native subagents | pi-subagents | Converted files plus an index |
| MCP | Native client | pi-mcp-adapter | Translated `mcp-adapter.json` entries |
| Workflows | Native runtime | pi-dynamic-workflows | Saved envelopes |

## Sources

- Claude Code 2.1.316 binary `/opt/claude-code/bin/claude`, grepped 2026-10-31: skill frontmatter schema (`PEo`/`MEo`), argument substitution `T2e`, description fallback `A2e`, agent field list, hook event tuple, `source`/SessionEnd reason enums, hook `args`/`once`/`onFailure` describe strings, MCP server schemas. HIGH.
- https://code.claude.com/docs/en/skills (retrieved 2026-10-31) -- frontmatter, substitutions, invocation control, namespacing, `` !`cmd` ``, `context: fork`. HIGH.
- https://code.claude.com/docs/en/sub-agents (2026-10-31) -- fields, plugin restrictions, naming, model, tools, preload. HIGH.
- https://code.claude.com/docs/en/plugins-reference (2026-10-31) -- replace/add/merge per key, `commands` map, `hooks`/`mcpServers` merge, variables per component. HIGH.
- https://code.claude.com/docs/en/workflows (2026-10-31) -- naming, approval, `args`, `meta` rules. HIGH.
- Pi 1.3.0 `node_modules/@earendil-works/pi-coding-agent` (`docs/prompt-templates.md`, `docs/skills.md`, `docs/rpc-commands.md`, `substituteArgs`) and Pi 1.4.0 (`dist/core/extensions/types.d.ts`, `agent-session.js`); pi-subagents 0.84.0 `src/agents/agents.js`. HIGH.
- Repo: `docs/hooks-compatibility.md`, `docs/mcp-compatibility.md`, `docs/workflows-compatibility.md`, `docs/prd/pi-claude-marketplace-prd.md` (SK/CM/AG/MC), `.planning/milestones/v1.15-REQUIREMENTS.md`, `.planning/milestones/ws-workflows-2026-09-27/milestones/workflows-REQUIREMENTS.md`, `.planning/spikes/028-model-free-harness/README.md`, and the bridge sources cited per row.

---
*Feature research for: component-features (component behavioral tests)*
*Researched: 2026-10-31*
