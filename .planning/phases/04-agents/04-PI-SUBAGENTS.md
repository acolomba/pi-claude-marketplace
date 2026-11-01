# pi-subagents 0.84.0: how it handles agent files

Research for pi-claude-marketplace, whose agents bridge writes each Claude plugin agent as a pi-subagents agent file. No repository file was edited.

## Sources and method

- **pi-subagents 0.84.0** at `node_modules/.cache/optional-peers/node_modules/pi-subagents/` (written `PS/` below). Pi loads `PS/bundle/index.js` (`PS/package.json` `pi.extensions`). I read `PS/src/` (the unbundled JS the bundle is built from) and spot-checked that the bundle carries the same code: `bundle/chunk-235AWJUQ.js` holds the `discoverAgentsAll` wiring, and `bundle/chunk-LNRJCP2Y.js` holds the frontmatter, memory and thinking code.
- **Bridge:** `extensions/pi-claude-marketplace/bridges/agents/{convert,frontmatter,discover,stage,types,marker}.ts`, `persistence/locations.ts`, `domain/name.ts`, `docs/prd/pi-claude-marketplace-prd.md` §5.7.
- **Harness:** `features/agent/*.feature`, `features/lib/scripted-model/*`, `features/support/world.ts`, `test/e2e/_rpc.ts`, `features/step_definitions/session.steps.ts`.
- **Pi 1.4.0** host code where it decides behavior (`node_modules/@earendil-works/pi-coding-agent/dist/`).
- **Empirical probes** (in this folder): `experiment.mjs`, `experiment2.mjs` and `experiment3.mjs`, with captured output in `experiment-output.txt` and `experiment2-output.txt`. They run the real bridge `convertAgent` and then pi-subagents' own `discoverAgents`/`discoverAgentsAll`/`handleList`/`resolveSkills`/`buildDoctorReport`/model resolution in a sandbox shaped like the cucumber one (sibling `home/`, `agent/`, `project/`). I ran no live Pi child (foreground or background). Claims about the runner process come from reading the code.

What the bridge emits today, as the probe produced it for a source agent with `tools: Read, Grep, Glob, Skill`, `skills: helper`, `effort: max`, `background: true`, `memory: user`, `color: blue`:

```yaml
---
name: demo:reviewer
description: Reviews the files it is given.
aliases: pi-claude-marketplace-demo-reviewer
tools: read,grep,find
skills: demo-helper
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  ...
  droppedFields:
    - background
    - memory
    - color
  warnings:
    - unknown effort value "max" -- omitted from generated frontmatter
---
```

---

## Q1. Frontmatter parser: keys, value domains, lists, unknown and invalid values

### Parser mechanics (`PS/src/agents/frontmatter.js`)

- Line-based. A key line must match `^([\w-]+):\s*(.*)$` at column 0 (`frontmatter.js:115`). `name: demo:reviewer` therefore gives key `name` and value `demo:reviewer`.
- A single pair of surrounding quotes is stripped (`:121-126`). For the name-list keys (`tools`, `excludeTools`, `mutationTools`, `extensions`, `subagentOnlyExtensions`), a quoted list such as `"read", "bash"` keeps its per-item quotes for the splitter (`:122-124`).
- An empty value, or `|`, `|-`, `>`, `>-`, opens a block (`:129-136`). Indented and blank lines that follow become the key's multi-line string value (`:101-104`), and the common indentation is stripped (`:149-166`). Comment lines are skipped outside `|`/`>` blocks (`:98-99`).
- **Lists** (`parseFrontmatterList`, `:45-58`): comma-separated values, `- item` block lines, or both, each item trimmed. `parseUnquotedList` (`:66-68`) also strips per-item quotes. A YAML flow array `[read, bash]` is **not** parsed: the probe produced `["[read","bash]"]` (`experiment2-output.txt`). The bridge never passes that form through, because it emits comma lists.
- Only `runner`, `acceptance` and `permission(s)` go through a real YAML parser (`agents.js:1786-1878`, `:2043-2049`). `toolBudget` and `outputSchema` go through `JSON.parse` (`:2051-2063`).

### Keys read (`PS/src/agents/agents.js:1907-2135`, list in `PS/src/agents/agent-serializer.js:3-47`)

| Key | Domain / parsing | Invalid value |
|---|---|---|
| `name`, `description` | Required strings | Either one missing: **silently skipped, with no diagnostic** (`agents.js:1916-1918`; probe: `nodesc present: false`) |
| `package` | Sanitized identifier. Runtime name becomes `<package>.<name>` (`identity.js:8-21`) | Diagnostic; agent rejected |
| `aliases` (or `alias`) | List. The canonical name is removed from it (`agents.js:439-443`, `:1946`) | n/a. Alias collisions between distinct agents fail resolution as "Ambiguous agent alias" (`agents.js:473-480`) |
| `tools` | List. `mcp:` entries are split into `mcpDirectTools` (`agents.js:484-498`). Path-like entries become extension paths. An empty value means no tools | `+name`/`-name` entries are rejected at launch (`runs/shared/child-tool-plan.js:118`). A name that is not registered fails the child before its first turn (docs/agents.md:597) |
| `excludeTools` | List (`agents.js:1942`). This is the deny-list key; `disallowedTools` is not read | Unknown names are ignored |
| `model` | Raw string, resolved at launch (Q6) (`agents.js:2092`) | Fails at launch, not at load |
| `thinking` | Raw string. `false` means off (`agents.js:2094`). Known levels are `off,minimal,low,medium,high,xhigh,max` (`shared/model-info.js:1`). **`max` is accepted** | **Not validated at load.** The probe kept `thinking: ultra` as is. At launch the value is appended as a `:<level>` suffix to the model or to the inherited parent model (`child-tool-plan.js:48-57`). CHANGELOG 0.83.0 (line 64) added validation only for settings overrides and the `create`/`update` actions, not for files |
| `skills` (or `skill`) | List. `skill` wins via `\|\|` (`agents.js:1950-1951`) | Missing skills do not fail the run (Q4) |
| `skillPath` | List of files or dirs, relative to the agent file's directory (`agents.js:1952`, `skills.js:604`) | Unresolved: falls back to normal discovery |
| `inheritSkills` | `"true"`/`"false"`; default `false` (`agents.js:1966-1970`, `:40-42`) | Anything else: silently the default |
| `inheritProjectContext` | Default `false`, except builtin `delegate` (`agents.js:1959-1963`, `:37-39`) | Silently the default |
| `inheritGlobalContext` | `true` only when the value is exactly `"true"` | Silently `false` |
| `systemPromptMode` | `replace` (default) or `append`. Builtin `delegate` defaults to append (`agents.js:1955-1958`, `:34-36`) | Silently the default (probe: `bogus` became `replace`) |
| `async` | Strictly `true`/`false` (`agents.js:1977-1984`) | **Diagnostic; agent rejected** (probe: `Agent 'bad' has invalid async frontmatter; expected true or false.`) |
| `memory` | `{scope: user\|project, path: <relative>}` as an indented block or inline `{...}` (`agent-memory.js:33-62`) | **Silently ignored** (probe: `memory: user` gave `undefined`) |
| `maxSubagentDepth` | Non-negative integer (`agents.js:2042`, `:2064-2066`). Tightens nested delegation for this agent's children | **Silently dropped** (probe: `abc`) |
| `toolBudget` | JSON object (`agents.js:2051-2056`), validated again at launch | Bad JSON: **diagnostic; agent rejected** (probe) |
| `advertise`, `fast`, `allowNestedSubagents` | Strict booleans | Diagnostic; agent rejected |
| `timeoutMs`, `toolTimeoutMs` | Positive integers | Diagnostic; agent rejected |
| `outputMode` (`inline`\|`file-only`), `acceptanceRole` (`read-only`\|`writer`), `acceptance`, `outputSchema`, `runner`, `permission`/`permissions`, `machine`, `launcher` | Enums, YAML or JSON as listed | Diagnostic; agent rejected |
| `defaultContext` (`fresh`\|`fork`), `defaultReads`, `defaultProgress`, `interactive`, `output`, `extensions`, `subagentOnlyExtensions`, `mutationTools`, `allowedAgents`, `inheritGlobalContext` | As documented in `PS/docs/agents.md:394-478` | Lenient |
| `fallbackModels` | Removed field | Throws; agent rejected (`agents.js:1953-1954`) |
| Any other key | Stored in `agent.extraFields` with no warning (`agents.js:2037-2041`). Re-emitted by `serializeAgent` on an `update` action (`agent-serializer.js:185-198`) | n/a |

**How a diagnostic surfaces:** in the `list` output under `Invalid agent definitions:` (`agent-management.js:897-901`), and in the doctor report as `- invalid agent <name> (<source>): <error>` (`extension/doctor.js:104-107`). A run of that name fails with `Agent '<name>' has invalid configuration: <error>` when the bad file is the highest-priority definition of the name (`agents.js:64-80`, `runs/foreground/subagent-executor.js:2209-2219`).

### What the bridge emits compared with what pi-subagents does with it

| Bridge emits (frontmatter.ts:488-578) | pi-subagents |
|---|---|
| `name: <plugin>:<agent>` (`domain/name.ts:575-581`) | Used as the canonical and local name. The colon is fine (Q2) |
| `description` (with a fallback, convert.ts:629-633) | Required. The fallback prevents a silent skip |
| `aliases: pi-claude-marketplace-<plugin>-<agent>` | Resolves to the agent (probe: `alias resolves to: demo:reviewer`) |
| `model` (only with `--map-model`) | Must resolve in Pi's registry (Q6) |
| `tools: a,b` **or** `excludeTools: a,b`, never both (`GeneratedToolsFields`, frontmatter.ts:422-424) | Both are honored, **and they can be combined** (see mismatch 2) |
| `thinking` from `THINKING_VALUES` | Honored |
| `skills` + `skillPath: ../pi-claude-marketplace/resources/skills` | Resolved through skillPath relative to the agent file (probe resolved `<agentDir>/pi-claude-marketplace/resources/skills/demo-helper/SKILL.md`) |
| `systemPromptMode: replace`, `inheritProjectContext: true`, `inheritSkills: <bool>` | Honored |
| `provenance:` + indented lines | Absorbed as one block value into `extraFields.provenance` (probe). Never reaches the prompt |

### Mismatches to flag

1. **`THINKING_VALUES` lacks `max`** (`convert.ts:102-109`, PRD AG-7 "Allowlist `off,minimal,low,medium,high,xhigh`"). pi-subagents 0.84 accepts `max` (`shared/model-info.js:1`; CHANGELOG line 2107). A Claude `effort: max` or `thinking: max` is dropped with `unknown effort value "max" -- omitted from generated frontmatter` (probe). Caveat: pi-subagents offers `max` only for models whose metadata maps it (`getSupportedThinkingLevels`, `model-info.js:87-104`).
2. **`excludeTools` alongside `tools` works since 0.62.0, but the bridge says it does not.** `convert.ts:389-409` warns that "pi-subagents takes no excludeTools beside an explicit tools: list". In 0.84, `resolvePiLaunchToolPlan` filters both the declared builtin tools (`child-tool-plan.js:214-216`) and the resolved MCP selections (`:245`) by `excludeTools`. Also documented at `PS/docs/agents.md:451` and in CHANGELOG 0.62.0 (line 1082). A per-tool MCP disallow under a whole-server grant could therefore narrow the grant if the bridge emitted `excludeTools` with the resolved MCP tool name.
3. **The provenance comment describes the wrong mechanism** (`frontmatter.ts:464-468`, `:544-547`). Its indented lines are not skipped by the key regex. They become the block value of the unknown key `provenance` (`frontmatter.js:101-104`, `:129-136`). The effect is still safe: no stray keys and nothing in the prompt.
4. **`background` and `memory` are dropped** (`SUPPORTED_SOURCE_FIELDS`, `convert.ts:29-38`). pi-subagents has `async` and `memory`, but with different shapes (Q7).
5. **`advertise` is never emitted.** Bridged agents are therefore missing from the parent system prompt catalog (`agents/advertised-agent-prompt.js:35-64`; at most 16 agents and 12,288 bytes). The `subagent` tool description is static and lists no agents (`extension/tool-description.js:155-169`). The parent model learns about a bridged agent only through `{action:"list"}`, the `Available agents:` part of an unknown-agent error, or the user naming it. Whether Claude Code puts plugin agents in front of the model automatically is an upstream question; verify it with the compat-research skill.
6. **The PRD AG-5 text is stale.** It describes an HTML-comment provenance block after the closing `---`. The code emits a `provenance.generatedBy` frontmatter line (`marker.ts`, `frontmatter.ts:552-566`). This is documentation drift, not runtime behavior.

---

## Q2. Discovery: directories, recursion, collisions, keys, the colon

- **User dirs, lowest to highest priority:** `PI_SUBAGENT_EXTRA_AGENT_DIRS`, then settings `subagents.agentScanDirs`, then `<getAgentDir()>/agents` (= `$PI_CODING_AGENT_DIR/agents` or `~/.pi/agent/agents`), then **`~/.agents`** (`agents.js:2403-2404`, `:2419`). `getAgentDir` honors `PI_CODING_AGENT_DIR` (`shared/utils.js:83-91`). `~/.agents` is **after** the dir the bridge writes to, so it wins a tie. The probe confirmed `dup winner (user): from ~/.agents`.
- **Project dirs:** `<root>/.agents` (legacy), then `<root>/.pi/agents` (`agents.js:2183-2196`), after project `agentScanDirs` (`:2424`). `.pi/agents` wins. `<root>` is the nearest ancestor of cwd that has `.pi/` or `.agents/`, and the walk stops at HOME (`agents.js:582-605`, `:636-661`). An untrusted project contributes no dirs and no settings (`agents.js:2405-2412`).
- **Package agents:** come from `package.json` `pi-subagents.agents` or `pi.subagents.agents`. The first package to define a name wins (`agents.js:2566`).
- **Recursive:** yes. Every `*.md` file except `*.chain.md` and `.agents/skills/**` counts (`agents.js:1704-1766`, `:1760`). Pruned: dirs named `.git`, `node_modules`, `.pi`, `sync-backups`, any dir that contains `.git`, and nested dirs that contain `.pi/` or `.agents/` (`agents.js:1627-1637`). The probe found `nested/deep/n.md`. Entries are sorted with `localeCompare`, and within one directory **the later file wins** (probe: `same-dir winner: second file`).
- **Collision order:** `builtin < package < user < project`, with runtime-registered agents above all. Merging is a `Map.set` by name in that order (`agent-selection.js:1-22`, `agents.js:53-59`). A user agent named `reviewer` shadows the builtin (probe). Scope `user` merges builtin + package + user. Scope `project` merges builtin + package + project, with no user agents.
- **Key:** the frontmatter `name`, prefixed by `package` when set (`agents.js:1919-1927`). The file name does not matter. Resolution is an exact trimmed match on the canonical name, then on `localName`, then on aliases (`agents.js:453-483`).
- **Colon in a name:** allowed and works. Nothing validates the name of a file-defined agent. The existing scenario runs `demo:reviewer` and the child prompt starts `<active_agent name="demo:reviewer"/>` (`features/agent/invocation.feature:30`). Paths derived from agent names are sanitized (`shared/artifacts.js:185`, `child-tool-plan.js:45-46`). Three places do not accept `:`:
  - `subagent({action:"create"})` and the management lookup fallback strip names to `[a-z0-9-]` (`agent-management.js:83-85`).
  - `memory.path` segments reject `:` (`agent-memory.js:192-194`).
  - Package names are restricted (`identity.js:1`).

Upstream contrast to verify: Claude Code ranks plugin agents lowest. Bridged agents sit in pi-subagents' user and project tiers, so they would beat a builtin or package agent with the same name. The `<plugin>:<agent>` names make such a collision unlikely.

---

## Q3. The `subagent` tool: list format, run path, scopes, trust

### `{action:"list"}` (`agent-management.js:1020-1060`)

Exact output for the probe agent (`experiment-output.txt`):

```
Executable agents:
User agents
- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.

Builtin agents
- claude-code (builtin, external-cli:claude): Read-only Claude Code CLI analysis; ...
- ... (13 builtins: claude-code, claude-code-writer, codex-exec, codex-exec-writer, cursor-agent,
       cursor-agent-writer, delegate, evidence-auditor, oracle (context: fork, aliases: advisor),
       researcher, reviewer, scout, worker (context: fresh, aliases: developer, coder, implementer, develop))
```

- The line format is `- <name> (<metadata>): <description>` (`:765-767`). Metadata holds the source (a package agent shows `<pkg>@<version>`), a runner badge, `context: <defaultContext>` and `aliases: a, b` (`:756-764`). The full description is shown.
- Sections come in a fixed order, Package, User, Project, Runtime, Builtin, and each is sorted by name (`:915-935`).
- Agents are deduplicated by name with project > user > package > builtin (`:92-98`). Disabled agents are hidden.
- After the sections, the output can add `Restricted agents (...)` (capability ceiling), `Invalid agent definitions:`, and proactive skill suggestions (enabled by default, `proactive-skills.js:14-31`).
- `capabilities: true` changes the heading to `Executable agents (capabilities):` and the lines to `Description: ...; Tools: ...; Model: ...; Thinking: ...` (`:768-792`).
- The text is the whole tool result. Error results are thrown so that Pi reports them as tool errors (`extension/tool-result.js:8-16`).
- Settings `subagents.disableBuiltins: true` hides the builtins, which gives a scenario a shorter list (`agents.js:1352-1381`).

### Run path for `{agent, task, async:false}`

`executePublic` (`subagent-executor.js:7723`), then `executeWithSingleDispatchGuard` (`:7703-7722`, one foreground run at a time), then `executeRequest`:

1. `projectScopeTrustError` (`:4823`, defined at `:297-305`).
2. `withSessionProjectTrust` (`:4826`, defined at `:292-296`).
3. `deps.discoverAgents(effectiveCwd, scope, …)` (`:7139`).
4. `canonicalizeExecutionParams`, then `applySingleAgentLaunchDefaults`, which applies the agent's `async` default (`:2584-2606`).
5. `requestedAsync = params.async ?? asyncByDefault` (`:7249`).
6. Foreground: `runSinglePath` calls `runSync` (`:3789`). The child is an in-process Pi SDK session (`runs/shared/child-session.js:385-520`).

The result text looks like `Run fan-out: 1/64 used, 63 remaining\n<child output>\nMission: <uuid> (completed)` (`invocation.feature:114`).

**`agentScope`:** `user`, `project` or `both`. The default is `both`, and any other value runs as `both` (`agents/agent-scope.js:1-5`). For list, an unknown value also becomes `both` (`agent-management.js:76-82`).

### Trust (Phase 1 finding confirmed)

- **The list path ignores trust.** The extension wires `discoverAgentsAll: (cwd, provider) => discoverAgentsAll(cwd, provider, { globalNpmRoot: globalRoot })` with no `projectTrusted` (`extension/index.js:511`). The executor passes it into the management context unchanged (`subagent-executor.js:7099`). `withSessionProjectTrust` wraps **only** `discoverAgents` (`:292-296`). `discoverCatalog` calls it with two arguments (`agent-management.js:20-22`), and `discoverAgentSnapshot` defaults `projectTrusted` to `true` (`agents.js:2677-2681`). `projectScopeTrustError` returns `undefined` for every action except `resume`, `validate` and `append-step` (`:300-303`), so even `{action:"list", agentScope:"project"}` lists untrusted project agents. The doctor (`doctor.js:95`) and the `/run` completions (`slash/slash-commands.js:84-107`) have the same gap. Probe (`experiment2-output.txt`): the list showed `Project agents / - dup (project)`, while trust-aware discovery in the same sandbox picked `user:from ~/.agents` with scope `user`.
- **Runs follow trust.** An untrusted session wraps discovery with `projectTrusted: false` (`:295`). `trustedDiscoveryScope` turns `both` into `user` and throws for an explicit `project` (`agents.js:2686-2692`).
- **Error for an untrusted project agent with the default scope:** the project agent is not discovered, so the run fails with `formatUnknownAgentError` (`agents.js:109-127`, reached via `subagent-executor.js:2218`). The probe's text:

  ```
  Unknown agent: demo:reviewer
  Effective cwd: <cwd>
  Consulted agent-definition directories:
  - builtin: <PS>/agents (13 candidates)
  - user: <agentDir>/agents (absent | present but empty | N candidate(s))
  - user: <home>/.agents (absent)
  Available agents:
  - claude-code (builtin) — Read-only Claude Code CLI analysis; requires local authentication and trusted u…
  ... (one line per agent, description cut at 80 chars, at most 30 lines, `agents.js:90-104`)
  ```

  No `Did you mean` follows, because `reviewer` is too far from `demo:reviewer` in edit distance (`shared/edit-distance.js:26-31`). The model sees this text after `subagent failed: `. The explicit-scope error is the one `features/agent/project-trust.feature:177` already asserts (`agent-scope.js:6-8`).

---

## Q4. Skills

- **What reaches the child.** `skills:` names are resolved per run, foreground and background alike (`runs/foreground/execution.js:1774`, `runs/background/async-execution.js:1672`). `buildEffectiveSystemPrompt` appends a catalog to the agent body (`runs/shared/effective-system-prompt.js:14-23`): an `<available_skills>` block with name, description and absolute `location`, plus "Use the read tool to load a skill's file when the task matches" (`skills.js:646-670`, output in `experiment-output.txt`). **The SKILL.md body is not inlined.** When skills resolve, `read` is added to an explicit `tools` allowlist (`child-tool-plan.js:204-211`; `requireReadTool`, `execution.js:287`). Claude Code instead preloads the full skill content (upstream, to verify). That gap comes from pi-subagents' design.
- **How names are resolved.** A skill's name is the **directory basename of its `SKILL.md`**, or the stem of a `.md` file at a skillPath root. The frontmatter `name` is not used (`skills.js:446-455`, `:490-536`). Order:
  1. Agent-local `skillPath` entries, resolved against the agent file's directory (`skills.js:597-608`).
  2. Global discovery: `<cwd>/.pi/skills`, `<cwd>/.agents/skills`, `<agentDir>/skills`, `~/.agents/skills`, packages' `pi.skills`, and settings `skills`/`packages` (`skills.js:301-322`). This is cached for 5 s (`:14`, `:541-556`).

  The bridge stages `<scopeRoot>/pi-claude-marketplace/resources/skills/<generatedName>/SKILL.md` (`persistence/locations.ts:223`), so `demo-helper` resolves through `skillPath` (probe). A missing skill does not fail the run. It is reported only as `skillsWarning`, which only the TUI renders (`execution.js:1903`, `tui/render.js:3502`), so it does not appear in the model-facing tool text. The name `pi-subagents` is always treated as missing (`skills.js:616-619`).
- **`disable-model-invocation: true`.** Only the YAML boolean `true` counts (`skills.js:374-394`). Such a skill **resolves** and is not reported missing, but `buildSkillInjection` drops it from the child prompt with no warning (`skills.js:646-651`; probe: `demo-hidden` resolved with `hidden=true` and was absent from the block). The bridge passes the flag through and also synthesizes it for unparseable skills (`bridges/skills/frontmatter-degrade.ts:43-53`). So an agent that preloads such a skill gets nothing, without notice. Check this against Claude Code's rule for preloading hidden skills.
- **`inheritSkills: true`.** It controls whether the child keeps Pi's own discovered skills catalog (`child-launch.js:230`, `child-session.js:440-442`, `subagent-prompt-runtime.js:221`). It does not trigger any pi-subagents injection.
  - **Foreground children load no ambient extensions** (`child-launch.js:199`). pi-claude-marketplace exposes its staged skills only through its `resources_discover` handler (`orchestrators/discover.ts`). In a foreground child, that catalog therefore lacks the plugin's skills, and only the explicit `skills:` reach the child.
  - Background children do load ambient extensions, so the plugin skills appear there **only if** pi-claude-marketplace is installed as a Pi package that the runner can discover (Q5).

---

## Q5. Async: process model, result delivery, cucumber feasibility

- **Foreground** runs in-process: a Pi SDK session inside the parent (`README.md:43`, `child-session.js:385-520`).
  - No ambient extensions are loaded (`noExtensions: !launch.ambientExtensions`, `:439`). The extension list holds pi-subagents runtime extensions, the agent's `extensions`/`subagentOnlyExtensions`, settings defaults, and host-required extensions (`:446`, `child-tool-plan.js:290-318`).
  - Model providers come from the parent (`parentProviderRegistry`, `inheritParentProviders`, `child-session.js:46-76`, `:498`). This is why the scripted faux model already works for foreground children.
- **Background** (`async: true`, **and the default when a call omits `async`**, see Q7) runs a **detached Node process**.
  - Launch: `spawn(node, [--import runner-peer-preload?, PS/src/runs/background/subagent-runner-bootstrap.js, <cfg.json>])` with `detached: true` (`async-execution.js:425-426`, `:510-541`, `runs/shared/background-process-options.js:1-5`). The standalone Pi binary host passes `--no-extensions --no-skills --no-prompt-templates --no-session --mode rpc --extension <bootstrap>` instead.
  - Output goes to `<asyncDir>/runner.{stdout,stderr}.log`.
  - Environment: the parent's `process.env` (minus git-routing and extension-binding variables) plus `PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT`, `PI_PACKAGE_DIR`, `JITI_ALIAS`, `PI_ASYNC_NATIVE_RUNNER` and `PI_SUBAGENT_PARENT_SESSION` (`:517-531`). The runner sets `PI_SUBAGENT_CHILD=1`, which makes a nested pi-subagents register nothing (`subagent-runner.js:89`, `index.js:3-7`).
  - The runner hosts the child session in-process with `ambientExtensions: true` (`child-launch.js:199`), so Pi's own discovery runs: settings packages, `<agentDir>/extensions`, and a trusted project's `.pi/extensions`.
- **`--extension` paths do not reach any child.** Pi passes CLI `--extension` paths only to the parent's resource loader (`pi-coding-agent/dist/main.js:631-633`), and nothing in pi-subagents forwards them. A foreground child still gets the scripted model's provider by inheritance. **A background child gets neither the scripted model nor pi-claude-marketplace**, so the inherited parent model `faux/faux-1` will not resolve in the runner.
- **How the result comes back:** the runner writes a result file under `$TMPDIR/pi-subagents-<scope>/async-subagent-results/` (`shared/types.js:108-121`). The parent's result watcher picks it up through `fs.watch`, or by polling every 3 s as a fallback (`result-watcher.js:15`, `:762`). The notifier then calls `pi.sendMessage({customType:"subagent-notify", content, display, details:{runs}}, {triggerTurn:true})` (`notify.js:473-497`). An idle parent starts a **new turn** for it; a busy parent gets it as a steering message (`PS/docs/extension-api.md:647`).
  - Content: `Background task completed: **demo:reviewer**`, a result preview and session lines (`notify.js:216-241`), then `Parent action: Read the saved results above and resume …` (`shared/parent-wake.js:2`). Pi passes custom messages to the model as `user` messages (`pi-coding-agent/dist/core/messages.js:89-96`).
  - Polling alternatives: `subagent({action:"status", id})` and blocking `bg_wait({id})` (`PS/docs/configuration.md:410`).
  - A headless host (`!ctx.hasUI`) auto-drains at `agent_end` (`extension/index.js:756-757`). **RPC mode has a UI context** (`pi-coding-agent/dist/modes/rpc/rpc-mode.js:231`, `core/extensions/runner.js:404-406`), so the profile Pi gets no drain.
  - The launch tool result reads `Async: demo:reviewer [<uuid>]` + `\n\nDetached. Return control now: native completion wakes you, so do not sleep, poll, or call bg_wait for it.\nOne-shot check: subagent({ action: "status", id: "..." }).` (`async-execution.js:150-161`, `:2144`). With `interactive = ctx.hasUI` (`subagent-executor.js:1026`), it is probably prefixed by the `Run fan-out:` line (`:370`), which I did not verify for async runs.
- **Could a scenario observe completion deterministically?** Yes, with harness work:
  1. **Load the scripted model in the runner.** Either:
     - (a) A harness extension calls `registerRequiredChildExtensions({ sessionId, extensions:[{ id:"scripted-model", path:<abs extension.ts> }] })` from `pi-subagents/required-child-extensions` on `session_start`, and disposes it on `session_shutdown`. This is a documented host API that survives `extensions: []` and detached runs (`PS/docs/agents.md:479-485`; the registry is process-global in `shared/required-child-extensions.js:44-78`; recommended in `runs/shared/model-resolution-diagnostic.js:60`).
     - (b) The sandbox's `<agentDir>/settings.json` gets `{"subagents":{"defaultSubagentOnlyExtensions":["<abs scripted-model/extension.ts>"]}}` (`agents.js:1015-1022`, `:1177-1194`). This applies because the bridge emits no `subagentOnlyExtensions`.

     Both also load the model into foreground children. That should not change behavior, because a child that registers the provider itself is skipped for inheritance (`child-session.js:57`), and the script state lives in files.
  2. The runner inherits the profile Pi's `HOME`, `PI_CODING_AGENT_DIR`, `TMPDIR` and `PI_OFFLINE` (`test/e2e/_rpc.ts:213-240`), so it shares the harness's script and call log (`features/lib/scripted-model/extension.ts:6-15`).
  3. A new step must wait for the **second** `agent_settled`, the one from the completion wake. The current prompt step stops at the first one (`features/step_definitions/session.steps.ts:96-101`). The wake call's last user message is the `subagent-notify` text, which holds run ids and paths, so it needs `{uuid}`-style tokens.
  4. **The race.** Right after the launch, the parent's follow-up model call competes with the child's first call. No barrier orders them; in practice, runner start-up (spawning Node and loading the SDK and extensions) makes the parent go first. This conflicts with the scripted model's "no concurrent calls" rule. Two ways to avoid it:
     - Script the parent to end its turn with a reply right after the launch, then wait for the wake.
     - Have the parent call a blocking `bg_wait`. The notice then arrives as a steering message during the busy turn.
  5. The scripted reply to the wake must be non-empty. A silent reply makes pi-subagents inject a `subagent-completion-unanswered` reminder and continue the turn, which takes another model call (`notify.js:866-878`).

  Side risk, not run: if pi-claude-marketplace is installed as a Pi package rather than with `--extension`, every background child's runner would load it ambiently. Its `resources_discover` load reconcile, and `apply` when `autoapply` is on, would then run inside each child. The extension has no `PI_SUBAGENT_CHILD` guard (grep found none).

---

## Q6. Model

- Resolution happens at launch against `ctx.modelRegistry.getAvailable()` (`subagent-executor.js:3585-3598`, `execution.js:1787`, `runs/shared/model-resolution.js:101-218`). The order:
  1. Exact `provider/id`.
  2. Bare id, preferring the parent's provider, otherwise a unique match.
  3. Fuzzy match on case, `._` separators and date stamps.
  4. A `:level` suffix is split off and kept.
- **Model omitted, or `model: inherit`:** the child gets the parent session's in-memory model `provider/id` (`model-resolution.js:313-321`), not the settings default. Settings `subagents.defaultModel` or `agentOverrides.<name>.model` take precedence when set (`agents.js:1106-1130`). The probe confirmed `undefined` and `"inherit"` both gave `faux/faux-1`.
- **`model: sonnet` does not work.** The probe threw `Unknown subagent model 'sonnet' in the active Pi model registry.`, the format at `model-resolution.js:266`, which can add `Did you mean …?` and `Closest registry models: …`. `claude-sonnet-4-6`, `anthropic/claude-sonnet-4-6` and `Claude_Sonnet_4.6` all resolved. An unknown configured model fails the launch (`resolveModelSelection`, `:365-383`) instead of falling back.
- The bridge's `--map-model` targets exist in the pi-ai 1.4.0 catalog (`claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5`). The catalog also holds newer ids (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`), so the map pins older versions than an "alias" would suggest. That is an observation, not a pi-subagents issue.
- `thinking` is appended to the selected model as `:<level>` (`execution.js:1793`, `async-execution.js:1754`), within the optional `subagents.maxThinking` ceiling (`shared/thinking-ceiling.js:24-37`).

---

## Q7. `memory` and `async` semantics, and whether the Claude mappings make sense

- **`async`** sets the default mode of a single-agent launch when the call omits `async`. An explicit call value and `forceTopLevelAsync` win (`subagent-executor.js:2596`, `:7249`; `PS/docs/agents.md:468`). **The config default is `asyncByDefault: true`** (`extension/config.js:265-267`). So with no frontmatter `async`, a call that omits `async` already runs in the **background**.
  - Mapping Claude `background: true` to `async: true` is accurate but makes **no difference under the default config**. It matters only when a user sets `asyncByDefault: false`. Even then, a model's explicit `async:false` still wins, so it is not Claude's "always background".
  - The larger parity question goes the other way. Claude Code subagents run in the foreground unless `background: true` (upstream, to verify), while pi-subagents runs bridged agents in the background by default. Emitting `async: false` for agents without `background: true` would restore Claude's default. That is a user-visible decision, so it is a question for the user.
  - Agents with `mcp:` tools need a background launch (`convert.ts:96-99`). Emitting `async: true` for them would make that the default even when `asyncByDefault` is false.
- **`memory`** must be a mapping `{scope: user|project, path}` (`agent-memory.js:33-62`).
  - Location: `<agentDir>/agent-memory/<path>/MEMORY.md` for user scope, `<projectRoot>/.pi/agent-memory/<path>/MEMORY.md` for project scope; a linked worktree resolves to the main checkout (`:289-302`, `:149-169`).
  - Each run injects the first 200 lines (16 KiB at most) with read/write instructions (`:21`, `:234-349`). Agents without write tools get a read-only block, and only when the file exists. Having no `tools` allowlist counts as having write tools (`:64-70`).
  - Paths are relative, and `.`, `..` and any segment with `:` are rejected (`:176-227`). Invalid input disables memory silently.
  - This closely matches Claude Code's agent memory as I recall it: `memory: user|project|local`, the first 200 lines of `MEMORY.md`, and Read/Write/Edit auto-enabled. **Verify upstream.** The mapping is meaningful:
    - `user` maps to `{scope: user, path: <colon-free id>}`, and `project` to `{scope: project, path: …}`. `path` must not be the declared `demo:reviewer`; `demo/reviewer` (nested segments) or the generated basename works.
    - `local` has **no** pi-subagents scope. Dropping it with a warning, or mapping it to `project`, is a judgment call, and SC-1 already excludes Claude's `local` scope for installs.
    - pi-subagents does **not** add write tools for memory. An agent with an explicit read-only `tools:` list would get read-only memory, unlike Claude.

---

## Q8. Commands and actions that can observe the agent count

- `subagent({action:"list"})`: the deduplicated per-section list (Q3). This is the most stable observation through the model call log. `agentScope` narrows it; `capabilities:true` gives compact rows plus `details.agentCapabilities`.
- `subagent({action:"get", agent})`: the detail view (`Agent: <name> (<source>)`, `Path:`, `Description:`, `Aliases:`, `Tools:`, `Skills:`, `Skill paths:`, `System prompt mode:`, the `Inherit …` flags, `Thinking:`, `Memory:`, the system prompt) (`agent-management.js:945-1018`, `:1173-1195`). It holds the absolute path, so it needs a path token.
- `/subagents-doctor` or `subagent({action:"doctor"})` (`slash/slash-commands.js:657-662`, `subagent-executor.js:6692-6740`):
  - It prints `- agents: total N (builtin X, package Y, user Z, project W)` and `- invalid agent …` lines (`doctor.js:92-116`). The probe printed `- agents: total 27 (builtin 13, package 0, user 13, project 1)`.
  - The counts are raw: user agents are **not** deduplicated, while project agents are. They include disabled builtins and untrusted project agents.
  - The slash command posts its report as a `subagent-slash-result` custom message (`slash-commands.js:481-530`), not through `ctx.ui.notify`. The tool action returns it as tool text, which also contains environment-specific paths and session ids.
- The `/subagents` admin panel is TUI-only and uses `discoverAgentsAll` (`slash/subagents-admin.js:22-30`). The `/run <agent>` completions also list agents (`slash-commands.js:101-107`). The `Available agents:` part of any unknown-agent error lists up to 30 agents.

---

## Q9. Re-reading and caching; `/reload` and new sessions

- **Discovery re-checks every call.** `getAgentDiscoverySources` keeps a process-wide cache keyed by cwd, provider, trust and env (`agents.js:2311`, `:2368-2383`). On **every** `discoverAgents`/`discoverAgentsAll` call it recomputes a fingerprint over the watched paths: directory listings, and the `size:mtime` of each file and settings file (`:2337-2367`, `:2502`). The watched paths include absent agent dirs and the ancestor `.pi`/`.agents`/`.git` dirs of a trusted project.
- So **a newly written or changed agent file shows up on the next `list` or run, with no `/reload`.** The probe saw 14 agents before the write and 15 after, in the same process. Explicit-scope runs on a trusted project bypass the cache entirely (`agents.js:2751-2758`).
- Skills: skillPath candidates are re-scanned per run, and file contents are re-read when the mtime changes (`skills.js:558-596`, `:597-608`). The global skill scan is cached for 5 s.
- **What needs `/reload`:** only the **advertised catalog** (`advertise: true` agents in the parent prompt). It is rebuilt at `session_start` (which `/reload` and new sessions fire), with `clearAgentDiscoveryCache()`, and after management actions (`extension/index.js:365-389`, `:1203`; `PS/docs/agents.md:372`). The bridge emits no `advertise`, so this does not affect bridged agents today.
- `/reload` cannot replace pi-subagents' own modules. A version change needs a Pi restart (`PS/index.js:9-12`). A new session or `/reload` starts a new advertisement generation and clears the discovery cache. Discovery stays file-driven.

---

## Dubious Choices

- I answered from `PS/src/` rather than the minified `bundle/` that Pi actually loads. I only spot-checked equivalence with three string searches (two bundle chunks).
- The background-runner findings come from reading the code, not from a live async run: no `--extension` forwarding, ambient discovery in the runner, the exact async-start text and its `Run fan-out` prefix, and the delivery timing. Treat the cucumber-feasibility steps and the "parent call usually wins the race" claim as unverified until a scenario runs.
- The Claude Code upstream facts are from memory and were not researched with the `claude-code-compat-research` skill: the foreground default, `background: true`, the `memory: user|project|local` semantics and directories, full-content skill preloading, the hidden-skill preload rule, plugin agents having the lowest precedence, and whether agents are listed to the model. They should be verified before anyone acts on them.
- My probe sandbox imitated the bridge's layout and called library functions directly. `handleList` got a hand-built `ctx` whose `discoverAgentsAll` copies `extension/index.js:511`. It was not the real tool invocation path, so list text as a model actually sees it could carry extra wrapper lines. The foreground scenario suggests management results are unwrapped.
- Mismatch 2 (combining `excludeTools` and `tools`) rests on code reading. Whether a per-tool MCP exclusion matches `selection.name` for pi-mcp-adapter-resolved tools was not exercised.
- "Unknown keys are kept with no warning" and "missing description is skipped silently" are based on the loader and the probe. I did not check whether some other path, such as the TUI, renders a notice for them.
