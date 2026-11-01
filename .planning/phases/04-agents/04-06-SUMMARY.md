---
phase: 04-agents
plan: 06
subsystem: agents-bridge
tags: [agents, pi-subagents, gate, decisions, parent-lines]
status: complete

requires:
  - phase: 04-agents
    provides: "plans 04-01..04-05: the agents bridge changes, the six agent features, and their SUMMARYs' parent lines and residuals"
provides:
  - "The Phase 4 gate evidence on the combined tree"
  - "The pi-subagents report (drafted, not filed) and two gap notes"
  - "The AGT-04 closing record (D-CF4-10)"
  - "Fourteen ready-to-paste Key Decisions rows, D-CF4-01..14"
  - "The parent lines for every file a component phase may not edit"
affects: [parent merge, phase 6]

actuals:
  tokens: 11200
  tasks: 3
  commits: 2
plan_head_before: b18b16a9fd5585192a518214dec714332b8bf803
plan_head_after: b64f9e3f95ed453e5085fbb6b40220ff0ce42e46

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/04-agents/04-06-SUMMARY.md
  modified: []

key-decisions:
  - "The gate passed on the combined tree with no fix, so no source file changed"

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07, XK-01]

metrics:
  started: 2026-11-01T17:50:00Z
  completed: 2026-11-01T18:20:00Z
  duration: 30m
---

# Phase 4 Plan 06: Agents phase gate and records Summary

The combined Phase 4 tree at `b18b16a` passes `npm run check`, the whole unit suite, and the cucumber suite twice in random order (1255 of 1255 scenarios each time). No fix was needed.

## Gate evidence

- **Commit:** `b18b16a9fd5585192a518214dec714332b8bf803` (the worktree base, which equals the combined tree after wave 3).
- **Node:** `v24.22.1`. npm scripts ran under `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, after `node scripts/install-test-peers.mjs` (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, `@quintinshaw/pi-dynamic-workflows` 3.15.0) and a lone `npm run lint` to warm ESLint.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | 0 | `check:static` passed: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features. Then `test:unpaired` and `test:integration` passed. `test:cucumber` passed with seed `745081`: 1255 scenarios (1255 passed), 13092 steps (13092 passed). `test:coverage:direct:all` passed and merged `coverage/direct.lcov` (319 records). The run took 17:56:50 to 18:05:00 UTC. |
| `npm run test:modules` | 0 | The quiet reporter printed no count line, so no test failed or was cancelled. The only stderr lines are the sanctioned IL-3 migration warnings that the tests trigger. |
| `npm run test:cucumber` (run 1) | 0 | Seed `325268`: 1255 scenarios (1255 passed), 13092 steps (13092 passed). |
| `npm run test:cucumber` (run 2) | 0 | Seed `324634`: 1255 scenarios (1255 passed), 13092 steps (13092 passed). |
| `npx fallow dupes --fail-on-issues --format human --quiet` | 0 | No clone group. |
| `npx cucumber-js features/agent --dry-run` | 0 | 39 scenarios in six features: `features/agent/companion-missing.feature`, `frontmatter.feature`, `invocation.feature`, `lifecycle.feature`, `listing.feature`, and `project-trust.feature`. |

**Reviewed clone pair.** The `code-duplication` marker at `extensions/pi-claude-marketplace/bridges/agents/stage.ts:462` still covers its group. With that one line removed, `fallow dupes` exited 1 and reported one group, `dup:3a2416f3`, 38 lines, `bridges/agents/stage.ts:462-499` with `bridges/commands/stage.ts:343-365`. The file was then restored from a backup (`cmp` matched, `git status` clean), and `fallow dupes` exited 0 again. The two markers in `bridges/commands/stage.ts` (lines 160 and 276) cover the commands and skills pairs and are unchanged.

**Gate fixes.** None. Every command passed on its first run.

**Parent-owned files.** `git diff --quiet faa94a2..b18b16a -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json` exits 0. `faa94a2` is the base of plan 04-01, the phase's `PLAN_HEAD_BEFORE`.

## pi-subagents report (D-CF4-09, D-CF4-10; drafted, not filed)

This phase did not file the report. It holds no credential for pi-subagents' issue tracker, and a public post is the user's call. The text below is ready to paste as one issue, or as two issues and two notes.

### Title

Untrusted projects: `list` shows agents a run refuses, and background runs cannot load `@earendil-works/pi-ai` subpaths

### Summary

We found two defects and two gaps in pi-subagents 0.84.0 on Pi 1.4.0. They came up while we bridged Claude Code plugin agents into pi-subagents agent files. First, in a project that Pi does not trust, the `list` action shows the project's agents, but a run of the same agent fails. Second, a background run cannot load a child extension that imports `@earendil-works/pi-ai/providers/faux`, because the runner's alias table rewrites that import to a path inside `compat.js`. The two gaps are smaller. No hook can add text to a child's first user message. Also, `--extension` paths never reach a background child.

### 1. `list`, the doctor, and `/run` completions ignore project trust

**What happens.** In an untrusted project, `subagent({action:"list"})` shows the project agents under `Project agents`. A run of one of them fails. With the default scope, the run fails with `Unknown agent: <name>`. With `agentScope:"project"`, the run fails with the trust error. The doctor and the `/run` completions also offer these agents.

**Cause.** `src/extension/index.js:511` wires `discoverAgentsAll: (cwd, provider) => discoverAgentsAll(cwd, provider, { globalNpmRoot: globalRoot })` with no `projectTrusted`. `withSessionProjectTrust` wraps only `discoverAgents`. `discoverCatalog` in `agent-management.js` calls `discoverAgentsAll` with two arguments, and `discoverAgentSnapshot` then defaults `projectTrusted` to `true`. `projectScopeTrustError` returns `undefined` for every action except `resume`, `validate`, and `append-step`, so `{action:"list", agentScope:"project"}` also lists untrusted agents. `doctor.js:95` and `slash/slash-commands.js:84-107` call the same discovery.

**Minimal repro** (pi-subagents 0.84.0, Pi 1.4.0):

1. Make a project with `.pi/settings.json` and `.pi/agents/reviewer.md` (`name: reviewer`, `description: Reviews the files it is given.`). Do not trust the project in Pi.
2. Set `subagents.disableBuiltins: true` in `~/.pi/agent/settings.json`, and start `pi` in the project.
3. Ask the model to call `subagent({action:"list"})`. The result lists `reviewer` under `Project agents`.
4. Ask the model to call `subagent({agent:"reviewer", task:"Review the README.", async:false})`. The result starts with `Unknown agent: reviewer` and lists the consulted folders. No project folder is among them.

We measured these texts with a bridged agent named `demo:reviewer` (alias `pi-claude-marketplace-demo-reviewer`). The list read:

```text
Executable agents:
Project agents
- demo:reviewer (project, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.
```

The run read `Unknown agent: demo:reviewer`, then `Effective cwd: <project>`, then `Consulted agent-definition directories:` with only the builtin folder and the two user folders, then `Available agents:`.

**Expected.** The list shows what a run in this session can find. In an untrusted project, the list leaves the project agents out, or it marks them as needing trust. The `Unknown agent` error says that a project agent of that name exists and needs trust.

**Proposed fix.** Pass the session's trust to `discoverAgentsAll` in the same way that `withSessionProjectTrust` passes it to `discoverAgents`, and use it in `discoverCatalog`, the doctor, and the `/run` completions. In `formatUnknownAgentError`, name the skipped project agents when trust is the reason.

### 2. The background runner's `JITI_ALIAS` breaks deep `@earendil-works/pi-ai` imports

**What happens.** A child extension that imports `@earendil-works/pi-ai/providers/faux` cannot load in a background run. As a required child extension, the error is `Required child extension failed to load: <path>/extension.ts: Failed to load extension: Cannot find module '<pi package>/node_modules/@earendil-works/pi-ai/dist/compat.js/providers/faux'`. As a default child extension, the run fails later with `Background task failed: **<agent>** ... Model "faux/faux-1" not found.`

**Cause.** `src/runs/background/runner-aliases.js` builds `JITI_ALIAS` from `HOST_PEER_ALIASES`. The table maps the bare specifier `@earendil-works/pi-ai` to `{ pkg: "@earendil-works/pi-ai", subpath: "./compat" }`. It also lists `/compat`, `/oauth`, and `/providers/all`, but not `/providers/faux`. jiti matches an alias as a prefix, so `@earendil-works/pi-ai/providers/faux` becomes `<compat.js>/providers/faux`. Every other subpath that the table does not list has the same problem. Foreground runs are not affected, because they run in the parent process.

**Minimal repro** (pi-subagents 0.84.0, Pi 1.4.0):

1. Write `faux-child.ts`, a Pi extension that has `import { createFauxCore } from "@earendil-works/pi-ai/providers/faux";` and registers a faux model.
2. On `session_start`, call `registerRequiredChildExtensions({ sessionId, extensions: [{ id: "faux-child", path: "<abs>/faux-child.ts" }] })` from `pi-subagents/required-child-extensions`.
3. Start a background run, for example `subagent({agent:"worker", task:"Say hi.", async:true})`.
4. The completion notice reports the `Cannot find module '.../dist/compat.js/providers/faux'` error above.

**Expected.** A child extension in a background run resolves every export subpath of `@earendil-works/pi-ai` that the parent resolves.

**Proposed fix.** Map the bare `@earendil-works/pi-ai` specifier only when it matches exactly, so that a deeper subpath falls through to normal resolution. If jiti's aliases can only match by prefix, add an alias for each export subpath of the host's `pi-ai` package instead. The code already reads export targets from the host's `exports` map, so it can list those subpaths.

### Gap notes (not defects)

**3. No hook on a child's first user message (D-CF4-04).** Claude Code puts a preloaded skill's content in the subagent's first user message, after the task. pi-subagents passes only the skill's name, description, and path (`<available_skills>`), and no extension hook can add text to the child's first user message. So pi-claude-marketplace writes the skill's content after the agent body, in the child's system prompt. A hook such as `before_child_prompt`, or an agent field for text sent before the task, would let a bridge match Claude Code.

**4. CLI `--extension` paths never reach a background child (D-CF4-10).** Pi passes `--extension` paths only to the parent's resource loader (`pi-coding-agent/dist/main.js:631-633`), and pi-subagents does not forward them. A foreground child still gets the parent's model providers, because it inherits them. A background child gets neither the extension nor its providers. A setting or launch option that forwards the parent's CLI extensions to background children would close this gap. `registerRequiredChildExtensions` covers part of it, apart from item 2.

## AGT-04 closing record (D-CF4-10)

AGT-04 is satisfied by the recorded gap, as the requirement allows. No scenario launches an `async: true` run (`features/agent/invocation.feature` holds no `"async":true` call), and the AGT-04 prohibition "MUST NOT ship a scenario that launches a background agent run" holds.

- **Measured cause** (`04-05-SUMMARY.md`, "AGT-04 recorded gap"). The detached runner loads child extensions through jiti with the `JITI_ALIAS` map built from `HOST_PEER_ALIASES` (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/background/runner-aliases.js`). The bare `@earendil-works/pi-ai` specifier maps to `./compat`, and the alias matches by prefix. So the frozen scripted model's `import ... from "@earendil-works/pi-ai/providers/faux"` (`features/lib/scripted-model/extension.ts:24` and `:32`) resolves under `compat.js`. As a default child extension, the wake notice read `Background task failed: **demo:bg** ... Model "faux/faux-1" not found.` As a required child extension, the error read `Required child extension failed to load: .../features/lib/scripted-model/extension.ts: Failed to load extension: Cannot find module '.../node_modules/@earendil-works/pi-ai/dist/compat.js/providers/faux'`.
- **Call-order race.** With the import fixed, the parent and the detached child would still read one script and append to one call log. No barrier orders their model calls, so a scenario could not number them reliably. The research (`04-PI-SUBAGENTS.md` Q5) names two ways around it: the parent ends its turn right after the launch, or it calls a blocking `bg_wait`.
- **Fix locations.** One of: the frozen `features/lib/scripted-model/extension.ts` imports the faux provider through a specifier the alias table maps (a parent line below), or pi-subagents fixes its alias table (report item 2). Either one also needs a step that waits for the second `agent_settled`, the wake turn.
- **The pinned remainder.** `features/agent/frontmatter.feature` scenario "An agent runs in the foreground unless its source asks for the background" shows pi-subagents' `get` result `Async: true` for `background: true` and `background: "true"`, and `Async: false` for an agent without it. Scenario "A call that leaves the launch mode open runs a bridged agent in the foreground" shows the foreground run when a call omits `async`.

## Decision records

Ready-to-paste rows for the PROJECT.md Key Decisions table (Decision | Rationale | Outcome). Upstream means Claude Code 2.1.316. Binary offsets point into `/opt/claude-code/bin/claude`, as recorded in `04-UPSTREAM-AGENTS.md`. pi-subagents means 0.84.0, as recorded in `04-PI-SUBAGENTS.md`. The DUBIOUS-CHOICES references are this phase's `P4-DC-NN` entries. The parent renumbers them when it merges the log.

| Decision | Rationale | Outcome |
| --- | --- | --- |
| **D-CF4-01 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): plugin agent files in subfolders are named with their folders**. The agents bridge walks each agents folder recursively. It stops at 32 namespace segments, skips symlinked entries, includes dotfiles and dot-folders, matches `.md` in any case, and cuts only a lower-case `.md` from the name. `agents/review/security.md` lists as `<plugin>:review:security`, and frontmatter `name` replaces only the last segment. The file name and alias join the segments with `-`, so the AG-12 first-wins warning reports a nested name that flattens onto a flat one. Each segment passes `assertSafeName`. A declared agent file keeps its bare name. | Upstream parity: `xz` (binary 283986718) walks `agents/` recursively, and `Van` (285500915) builds `[plugin, ...namespace, name].join(":")`. Probe p1 listed `agentprobe:review:security`, dotfiles, and `UPPER.MD`, and skipped symlinks. Residuals: a declared folder is walked, where upstream refuses the plugin. A declared symlinked file is refused (T-03-27), where upstream follows it. `info` still lists agents flat and case-sensitively. | -- Locked |
| **D-CF4-02 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03): two plugins that each ship agent `x` list as `p1:x` and `p2:x`, and both run**. | Upstream: the override order is built-in < plugin < user < project < `--agents` < managed, and a non-plugin name may not contain `:` (`fWt`, binary 285549112), so plugin agents never collide. Pinned by the listing scenario "Agents of the same name in two plugins are listed under their own plugin names". Residual (Pi gap): pi-subagents allows `:` in user agent names, so a user's own agent named like a bridged one is not modeled. | -- Locked |
| **D-CF4-03 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03): a plugin agent without a description lists with Claude Code's fallback**. The bridge uses `description`, then `when_to_use`, then `when-to-use`, then `Agent from <plugin> plugin`, each trimmed. The fallback warning fires whenever `description` itself is missing or blank. | Upstream: `zie(description) ?? zie(when_to_use) ?? zie(when-to-use) ?? "Agent from <plugin> plugin"` (binary 285501395). Probe: `no-desc.md` listed as `Agent from agentprobe plugin`. Residuals: the warning also fires when `when_to_use` supplies the text, and a present description is now trimmed, so a re-stage can change a file's bytes. | -- Locked |
| **D-CF4-04 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05, P4-DC-09): a bridged agent gets the content of each plugin skill it preloads**. After the agent body, the bridge writes `Base directory for this skill: <staged skill folder>`, a blank line, and the source `SKILL.md` body with references rewritten and plugin variables substituted. The inlined skill leaves `skills:`. A skill with `disable-model-invocation: true`, with no non-blank `description` or `when_to_use`, or with frontmatter that does not parse, is not preloaded, and a staging warning says why. Install and update pass the skills phase's rows (`skillSources`) to the agents stage. | Upstream: `tu` (binary 291353616) resolves the entry, the pool holds only model-invocable skills, and `XK` (284853965) builds `Base directory for this skill: <dir>` plus the body, sent in the first user message after the task. Pi gap: pi-subagents passes only the name and path (`<available_skills>`), and no hook reaches the child's first user message, so the content sits in the system prompt. Residuals: `$ARGUMENTS` and inline `!` commands stay literal. No cross-plugin fallback and no frontmatter-name lookup. A colon-repaired source is skipped. The source can differ from the staged copy. `when-to-use` does not qualify a skill. | -- Locked |
| **D-CF4-05 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): bridged agents run in the foreground unless the source sets `background: true`**. `background` of `true`, `"true"`, or `'true'` writes `async: true`. Any other value or none writes `async: false`. An agent that runs MCP tools (an `mcp:` entry, or no `tools` list in a plugin that writes MCP servers) gets no `async` line. `initialPrompt`, `observer`, `observerMessage`, and `observeSubagents` get the plugin-ignored warning. `memory`, `maxTurns`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow`, and `experimental` keep the generic dropped-field warning. | Upstream: the default is foreground, and `background: true` forces a background launch even when the call asks for the foreground (probe p3). The seven ignored fields are warned for plugin agents. pi-subagents defaults `asyncByDefault` to true, and a frontmatter `async` sets the default when a call omits it. Residuals: a call can still ask for the background, which upstream's `background: true` cannot be talked out of. Users who relied on pi-subagents' async default now get foreground runs. `memory` has no `local` scope and needs a path in pi-subagents. `maxTurns` has no pi-subagents field. | -- Locked |
| **D-CF4-06 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): `effort` converts as Claude Code reads it**. The value is trimmed and lower-cased, `med` becomes `medium`, and `max` joins the thinking levels. An integer effort is dropped with the unknown-effort warning. `thinking` stays an exact match. | Upstream: `rK` (binary 278280289) lowercases, maps `med` to `medium`, and accepts `low, medium, high, xhigh, max` (274207364) or any integer. pi-subagents accepts the levels `off, minimal, low, medium, high, xhigh, max` and no integer. Residual: the `--map-model` thinking fallback warning quotes the raw value (`"MED"`) while the file holds the normalized level. | -- Locked |
| **D-CF4-07 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): `--map-model` maps Claude Code's current model aliases**. `sonnet` and `opusplan` map to `anthropic/claude-sonnet-5-5`, `opus` to `anthropic/claude-opus-5-5`, `haiku` to `anthropic/claude-haiku-5-5`, and `fable` and `best` to `anthropic/claude-fable-5-1`. The match ignores case and strips one trailing `[1m]`. A `claude-` ID with no whitespace and no `:` passes through as `anthropic/<id>`. `inherit` omits the field. Without `--map-model` the field stays omitted (AG-7). | Upstream: `Ut`/`fG` (binary 276972243) map the aliases case-insensitively, the first-party table names the 5.x IDs, and any other string passes through. A frontmatter `opusplan` runs on sonnet, because agents have no plan mode. Residuals: `[1m]` is stripped from every alias, where upstream lists it for sonnet, opus, and fable. The pass-through refuses `:` and whitespace. The aliases are account-dependent upstream. Pi's registry does not know the mapped IDs in the harness, so the pinned run reports `Unknown subagent model`. | -- Locked |
| **D-CF4-08 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): `tools`, `disallowedTools`, and `skills` split as Claude Code splits them**. The bridge splits on commas and whitespace outside parentheses. A `Tool(spec)` entry maps by its tool name. `*` converts as an omitted `tools` list. AG-11 stays: an explicit list that maps to nothing refuses the install. | Upstream: `qu` (binary 273585549) splits on `,` and spaces outside `(...)`, and `*` or an omitted list means all tools. Residuals: `Tool(spec)` loses its spec, so `Bash(git log *)` grants all of Bash and a `Bash(rm *)` disallow removes all of Bash. A quoted item with a space splits inside the quotes. Deferred to Phase 6: pi-subagents applies `excludeTools` beside `tools` since 0.62.0, so the ANAME-02 "cannot narrow" warning is stale. | -- Locked |
| **D-CF4-09 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05): an untrusted project does not run its project-scope plugin agents, and still runs user-scope ones**. `project-trust.feature` pins the explicit `agentScope:"project"` pair, a trusted default-scope run, and an untrusted user-scope run. pi-subagents' trust-blind `list` is reported upstream as a defect and is not pinned as wanted behavior. | Pi gap: upstream runs plugin agents in untrusted folders (plugin agents count as a trusted origin). pi-subagents reads the bridge's project-scope files as project agents and refuses them without Pi's trust. Writing them to the user scope would break scope separation (SC-1). Residuals: the untrusted default-scope run (`Unknown agent: ...`) is not pinned, because its text names repository paths that no frozen run token covers. The list shows agents that the run refuses. | -- Locked |
| **D-CF4-10 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05, P4-DC-09): AGT-04 closes on a recorded gap, not on a background-run scenario**. | Measured: the detached runner's `JITI_ALIAS` maps the bare `@earendil-works/pi-ai` to `./compat` by prefix, so the scripted model's `@earendil-works/pi-ai/providers/faux` import fails in a background child. The parent and the child would also race on one script and one call log. A fix needs the frozen scripted model or pi-subagents (report item 2). Pinned remainder: the `get` result shows `Async: true` for `background: true`. | -- Locked |
| **D-CF4-11 (component-features, Phase 4): an install without pi-subagents installs the agent and names `requires pi-subagents`**. The install reports `warning` with `A plugin operation needs attention.` (SEV-01 `companionSeverity`). A Pi started later with pi-subagents lists the agent with no reinstall. | Today's behavior, pinned as the decision says (AGT-05 prohibition: a missing companion never blocks an install). Residual: `reinstall` reports the same missing companion at `info` (`features/plugin/reinstall.feature:191-197`), so install and reinstall disagree. That is a question for the parent. | -- Locked |
| **D-CF4-12 (component-features, Phase 4): disable, uninstall, and update change what pi-subagents lists, and enable restores it**. Each change is observed in a new session after the command. Disabling one plugin keeps another plugin's agents. | pi-subagents re-reads agent files on every list and run, and a new session rebuilds the parent catalog of D-CF4-14. `features/agent/lifecycle.feature` pins the four verbs and a negative control. | -- Locked |
| **D-CF4-13 (component-features, Phase 4): agent scenarios observe pi-subagents' own `list` result, compared whole**. A `Given` can hide the builtins (`subagents.disableBuiltins`) or one builtin, so the expected list holds only bridged agents. One scenario keeps the builtins as a control. | The `subagent {action:"list"}` text is what a user and the model see, and it is independent of the bridge's file bytes. Residual: the control scenario pins the 12 builtin lines of pi-subagents 0.84.0, so a pi-subagents upgrade that rewords a builtin breaks it on purpose. | -- Locked |
| **D-CF4-14 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03): every bridged agent carries `advertise: true`**. pi-subagents then lists the agent in the parent model's system prompt. | Upstream lists every available agent type, plugin agents included, to the model (`Available agent types for the Agent tool:`, binary 151868376). pi-subagents puts `advertise: true` agents in the parent prompt catalog, rebuilt at `session_start`. Residuals: pi-subagents caps the catalog at 16 agents and 12,288 bytes. Every parent system prompt with pi-subagents loaded and a bridged agent installed changes, so sibling phases must re-verify whole-prompt comparisons at merge. | -- Locked |

## Parent lines

Each line below is for the parent to apply at merge. A component phase may not edit these files. The lines collect the parent lines of plans 04-01 to 04-05 and the items the orchestrator collected during the phase.

### `CHANGELOG.md`

Sub-bullets for the milestone's entry under `## [Unreleased]`, per the changelog skill (one change per sub-bullet, two-space indent, the PR number on the top line only):

```markdown
  - Agents in subfolders now install under their folder names, such as `demo:review:security`. Hidden agent files, `.MD` files, and agent files a plugin declares now install too.
  - An agent with no description gets Claude Code's text, `Agent from <plugin> plugin`, or its `when_to_use` text.
  - Plugin agents now run in the foreground unless they set `background: true`, as in Claude Code.
  - The main model now sees every plugin agent in its system prompt, as in Claude Code.
  - Agent `effort` now accepts `max`, `med`, and any case.
  - `--map-model` now maps `sonnet`, `opus`, `haiku`, `fable`, `best`, and `opusplan`, with or without `[1m]`, to the current Claude models. It keeps full `claude-` model IDs.
  - Agent tool lists now split on spaces as well as commas, accept `Tool(spec)` entries, and treat `*` as every tool.
  - Install now warns that Claude Code also ignores `initialPrompt`, `observer`, `observerMessage`, and `observeSubagents` in plugin agents.
  - An agent now gets the content of the plugin skills it preloads. A skill that the model cannot invoke is skipped with a warning.
  - Agents installed before this release keep their old files until their plugin is installed, updated, reinstalled, or enabled again. Run `/claude:plugin reinstall` to update them now.
```

Two notes for the wording. The second sentence of the first and the `--map-model` sub-bullets fails the "one sentence" rule. Join or cut them if the entry runs long. The foreground default changes behavior for users who relied on pi-subagents' background default (D-CF4-05, orchestrator item e), so keep the word "now" in that sub-bullet. The `TOOL_MAP` fix of plan 04-05 (an agent tool named `constructor` or `toString` is dropped like any unknown tool) is too small for its own sub-bullet.

### `README.md` and `README.es.md`

Apply both in the same commit, per the readme skill.

- `README.md` line 27, after `- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).`, add: `Agents in subfolders get their folder names, as in Claude Code, for example \`demo:review:security\`. Agents run in the foreground unless they set \`background: true\`. An agent gets the content of the skills it preloads.`
- `README.es.md` line 27, after `- Agentes. Requiere [pi-subagents](https://pi.dev/packages/pi-subagents).`, add: `Los agentes en subcarpetas reciben los nombres de sus carpetas, como en Claude Code, por ejemplo \`demo:review:security\`. Los agentes se ejecutan en primer plano, salvo que indiquen \`background: true\`. Un agente recibe el contenido de las habilidades que precarga.`
- `README.md` line 376, the `--map-model` note, append: `It maps \`sonnet\`, \`opus\`, \`haiku\`, \`fable\`, \`best\`, and \`opusplan\`, with or without \`[1m]\`, to the current Claude models, for example \`anthropic/claude-sonnet-5-5\`. It keeps full \`claude-\` model IDs.`
- `README.es.md` line 365, the same note, append: `Mapea \`sonnet\`, \`opus\`, \`haiku\`, \`fable\`, \`best\` y \`opusplan\`, con o sin \`[1m]\`, a los modelos actuales de Claude, por ejemplo \`anthropic/claude-sonnet-5-5\`. Conserva los ID de modelo completos que empiezan por \`claude-\`.`

### `.planning/PROJECT.md`

- Key Decisions: add the fourteen rows of "Decision records" above, D-CF4-01 through D-CF4-14, in order, after the last D-CF1 row (or after the rows of the phases merged before this one).

### `.planning/BACKLOG.md`

- Emit `excludeTools` beside an explicit `tools:` list for per-tool MCP disallows, and reword the stale ANAME-02 "cannot narrow" warning. pi-subagents 0.62 and later apply `excludeTools` beside `tools` (D-CF4-08; for Phase 6, MCP-07).
- Map an agent's `memory` onto pi-subagents' `memory`. It needs a per-agent path and a `local` scope that pi-subagents lacks (D-CF4-05).
- The cross-plugin skill preload fallback: Claude Code's third lookup, the first skill whose name ends in `:<entry>` (D-CF4-04 residual).
- A `PI_SUBAGENT_CHILD` guard for the load-time reconcile, so that a background child does not run it when pi-claude-marketplace is installed as a Pi package (and `apply` when `autoapply` is on) (`04-PI-SUBAGENTS.md` Q5).
- An `async: true` agent scenario, once the scripted model's import or pi-subagents' alias table is fixed (D-CF4-10, AGT-04).
- A recursive, case-insensitive agents listing in `info` (D-CF4-01 residual).
- A `{pi-subagents dir}` run token, to pin the untrusted default-scope run text (D-CF4-09).
- User agents whose names hold `:` and equal a bridged name (D-CF4-02 residual).
- Install and reinstall disagree on the severity of the same missing companion: install warns (SEV-01 `companionSeverity`), and reinstall reports `info` (`features/plugin/reinstall.feature:191-197`). Decide whether reinstall also warns (plan 04-03, orchestrator item a).

### `docs/prd/pi-claude-marketplace-prd.md`

- AG-1 (line 441): the `<agent>` part of `pi-claude-marketplace-<plugin>-<agent>.md` joins the agent's folder segments and its name with `-`, so `agents/review/security.md` stages as `pi-claude-marketplace-<plugin>-review-security.md` and lists as `<plugin>:review:security`. Discovery walks each agents folder recursively, up to 32 segments, skips symlinks, includes dotfiles, and matches `.md` in any case. A declared agent file keeps its bare name (D-CF4-01).
- AG-5 (line 445): the provenance block is a `provenance:` mapping inside the frontmatter, and the marker is its line `generatedBy: pi-claude-marketplace` (`bridges/agents/marker.ts`). The legacy HTML comment with `generated by pi-claude-marketplace` is still accepted on old files. The row still describes the HTML comment.
- AG-7 detail (lines 456-471):
  - `model:` with `--map-model`: the D-CF4-07 table (`sonnet` and `opusplan` to `anthropic/claude-sonnet-5-5`, `opus` to `anthropic/claude-opus-5-5`, `haiku` to `anthropic/claude-haiku-5-5`, `fable` and `best` to `anthropic/claude-fable-5-1`, any case, one `[1m]` stripped, `claude-` IDs passed through).
  - `thinking:` / `effort:`: the allowlist gains `max`. `effort` is trimmed and lower-cased, and `med` maps to `medium` (D-CF4-06).
  - New `async:` line: `async: true` for `background: true`, and `async: false` otherwise, except no line for an agent that runs MCP tools (D-CF4-05).
  - New `advertise: true` line on every generated agent (D-CF4-14).
  - `tools:` / `disallowedTools:` / `skills:`: split on commas and whitespace outside parentheses, `Tool(spec)` maps by tool name (D-CF4-08).
  - `skills:`: a preloaded skill's content is written after the body, and that skill leaves `skills:`. A skill the model cannot invoke is skipped with a warning (D-CF4-04).
  - `description:` (line 471): the fallback is `when_to_use`, then `when-to-use`, then `Agent from <plugin> plugin` (D-CF4-03; plan 04-01).
  - The guided dropped fields gain `initialPrompt`, `observer`, `observerMessage`, and `observeSubagents` (D-CF4-05).
- AG-11 (line 451): `tools: *` grants what an omitted `tools:` grants, so it does not throw (D-CF4-08).

### `docs/env-vars.md`

- "Agents content" (line 80): change "Agent content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped)." to say that the agent body does not resolve it, but the content of a skill that an agent preloads does. In that content, `${CLAUDE_SKILL_DIR}` is the staged skill folder, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are filled at install, and `${CLAUDE_PROJECT_DIR}` follows SUB-02 (project-scope installs only) (D-CF4-04).
- The summary table's `Agents` column (line 22, `CLAUDE_SKILL_DIR`): `--` becomes `S` with a footnote for preloaded skill content.

### `.agents/skills/cucumber/**` (frozen)

- `rules/layout.md` line 73, the Agents row: the shared step module is now `features/step_definitions/agent/listing.steps.ts` (the agent Givens, the settings Givens, and the advertised-agents Then). Run steps live in `features/step_definitions/agent/runs.steps.ts`. The seed features column now names all six: `listing`, `frontmatter`, `invocation`, `companion-missing`, `project-trust`, and `lifecycle`.
- `rules/world-and-stand-ins.md`: add the two pi-subagents settings Givens, `pi-subagents hides its builtin agents` and `pi-subagents hides the builtin agent {string}`. Each merges one key into `{agent dir}/settings.json` and restores the old bytes on release.
- `rules/world-and-stand-ins.md`: the `fix-unicode-dashes` and `fix-smartquotes` pre-commit hooks rewrite feature files. So a companion text that holds an em dash or a smart quote, such as pi-subagents' `Available agents:` lines, cannot be pinned literally.
- `rules/world-and-stand-ins.md` line 44 or a new line: an agent feature starts the profile Pi with pi-subagents before its install. Without the companion, the install warns (`requires pi-subagents`), and `Given the user has run` accepts only info (plan 04-04).

### Frozen harness files

- `features/lib/run-tokens.ts`: a `{pi-subagents dir}` token would let a scenario pin pi-subagents texts that name its folder (the untrusted default-scope run, D-CF4-09). The cucumber skill's token list would gain it too.
- `features/lib/scripted-model/extension.ts` (lines 24 and 32): import the faux provider through a specifier that the background runner's alias table maps, to make an `async: true` scenario possible (D-CF4-10, orchestrator item c). The other route is the pi-subagents report, item 2. The shared call log would still need a way to order parent and child calls.

### `orchestrators/plugin/info.ts` (no phase owns it)

- When `info` reads a plugin's components from its source (`composeResolvedComponents`, then `discoverComponentNames` and `nameFromEntry`), it lists agents flat and case-sensitively. A nested agent, an `.MD` agent, and a declared agent file (`ENOTDIR` gives an empty list) are missing from that list, although they install. Recursion, an any-case `.md` match, and a file branch would match D-CF4-01. The state-only view (`composeStateOnlyComponents`) reads the recorded names and is not affected.

### Other non-owned files (found by plan 04-01)

- `extensions/pi-claude-marketplace/shared/fs-utils.ts`: the `isPlainMarkdownFile` doc comment still says it is "Shared by the agents and commands bridges" and that the agents bridge "depends on the `lstat`". The agents bridge no longer calls it, so the comment names the commands bridge only.

### Sibling phases

- D-CF4-14 (orchestrator item d): `advertise: true` changes every parent system prompt that has pi-subagents loaded and a bridged agent installed. Re-verify every whole parent-prompt comparison of a sibling phase at merge.
- D-CF4-05 (orchestrator item e): bridged agents without MCP tools now write `async: false`. An agent with no `tools` list in a plugin with MCP servers, and an agent with an `mcp:` entry, write no `async` line (Phase 6). The CHANGELOG sub-bullet must say that the foreground is the new default.
- D-CF4-08 (orchestrator item b): the ANAME-02 / MCP-07 per-tool warning `... pi-subagents takes no excludeTools beside an explicit tools: list, so the agent keeps every tool of that server` is stale, because pi-subagents 0.62 and later apply `excludeTools` beside `tools`. The text is unchanged here, because it belongs to MCP-07 (Phase 6).
- Phase 6's MCP-07 uses `PluginAgent`, `agentFileText`, and `publishAgentFile` from `features/lib/agent-files.ts`. They are byte-identical to the Phase 1 versions. The file adds `AgentFileRow`, `readAgentFileRows`, `agentRowText`, and `publishAgentFiles`.
- Plan 04-04: a later agent feature starts the profile Pi with pi-subagents before its install, because an install without the companion warns.

### Non-owned files the phase changed

- `extensions/pi-claude-marketplace/domain/name.ts`: only `generatedAgentName` and `declaredAgentName` and their doc comments. Each takes `namespace: readonly string[] = []`.
- `test/domain/name.test.ts`: only the `generatedAgentName` and `declaredAgentName` describes.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`: four one-line additions (the `stagedSkillRecords` field, its initializer, its assignment in the skills phase, and `skillSources: c.stagedSkillRecords,` in the agents phase).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`: one line, `skillSources: handles.skills.result.recorded,`.
- Expected values only: `test/orchestrators/plugin/update-swap.test.ts`, `reinstall-flow.test.ts`, `install-flow-ledger.test.ts`, and `update-flow.test.ts` (the skill-preload cases), and `test/edge/handlers/plugin/install.test.ts` and `update.test.ts` (the `MAPPED_MODEL` line).
- No frozen file, no `.fallowrc.json`, and no file under `docs/`, `.agents/`, `features/support/`, `features/lib/run-tokens.ts`, or `features/lib/scripted-model/` changed (`git diff --stat faa94a2..b18b16a` over those paths is empty).

### Commit trailer (orchestrator item f)

- Every commit of this phase's executors ends with `Claude-Session: https://claude.ai/code/session_01EDUMG75mZrbnf4k1GJQjc9`, the session URL of this child session. The brief's parent URL (`session_01EDUMG5ARYqF6oZYKmj6oB3`) is not used (P4-DC-01).

## Flagged assumptions for the verifier

From `COVERAGE.md` and the plans. Each is accounted for as a flagged assumption, not as an explicit truth:

| Requirement | Assumption | Where |
| --- | --- | --- |
| AGT-02 | A child's tools hold pi-subagents' runtime tools (`contact_supervisor`, and `bg_wait` only with the default set). The `--map-model` run can only show pi's `Unknown subagent model` error, because the harness registry has no Anthropic model. | 04-02, 04-05 |
| AGT-03 | `[1m]` is stripped from every alias. The full-ID pass-through refuses `:` and whitespace. `thinking` is matched exactly. An integer effort is dropped. `Tool(spec)` loses its spec. | 04-02 |
| AGT-04 | Closes on the recorded D-CF4-10 gap. No scenario launches a background run. | 04-05, this SUMMARY |
| AGT-05 | A new profile Pi with the companion stands in for loading pi-subagents and running `/reload` (research A6). | 04-03 |
| AGT-06 | The untrusted default-scope run is not pinned. The trust-blind list is reported as a pi-subagents defect, not pinned. | 04-03, this SUMMARY |
| XK-01 | `$ARGUMENTS` and inline `!` commands stay literal. No cross-plugin fallback and no frontmatter-name lookup. A colon-repaired source is skipped. The preloaded source can differ from the staged copy. | 04-05 |

The three backstop rows (AGT-01 concurrency, AGT-07 idempotency and concurrency) and the four explicit-truth rows hold through their plans' scenarios and unit tests, which passed in this gate.

## Deviations from Plan

None. The plan ran as written. The gate needed no fix, so no source file changed.

**Plan ledger note.** The worktree guard refuses writes to the shared `.git` folder, so the plan ledger is `b18b16a`, the worktree base, as recorded in the frontmatter. `commits: 2` is `git rev-list --count b18b16a..b64f9e3`, measured before the Task 3 commit that carries this text. With that commit, the plan has three commits, one per task. Each commit changes only this SUMMARY.

`STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` were not touched. The orchestrator owns them.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-17 is mitigated: the pi-subagents report is drafted in this SUMMARY and not filed, and the user decides whether to post it. T-04-18 is mitigated: the gate passed with no fix, so no test changed. T-04-SC is accepted: this plan installs no package (`scripts/install-test-peers.mjs` refreshed the optional-peer cache that the lockfile and the declared floors already pin).

## Self-Check: PASSED

- FOUND: `.planning/phases/04-agents/04-06-SUMMARY.md`
- FOUND commits: `337a292` (Task 1) and `b64f9e3` (Task 2), both ancestors of HEAD. The Task 3 commit carries this section.
- The plan's automated checks hold: `grep -c 'D-CF4-14'` and `grep -c 'drafted, not filed'` print counts above 0, `grep -c '^## Threat Flags'` prints 1, `grep -c 'Parent lines'` prints a count above 0, and `git diff --quiet faa94a2..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json` exits 0.

## Dubious Choices

The phase log is `.planning/phases/04-agents/04-DUBIOUS-CHOICES.md` (orchestrator-owned, not edited here). The choices below are this plan's.

- **The gate ran once, on the worktree base `b18b16a`.** That base equals the combined tree, and the orchestrator's wave 3 gate ran on `59c62d2`, which has the same inputs apart from planning Markdown. The phase gate here is a fresh run, not reused evidence.
- **The start time is approximate.** `metrics.started` is about 17:50 UTC. The plan's start was not recorded before the first command.
- **The report draft gives a generic repro for item 1** (a plain project agent `reviewer`), and its expected list line is described, not quoted. The measured texts are those of the bridged `demo:reviewer`, quoted below the repro. The repro for item 2 names `createFauxCore`, the export that the scripted model imports. The research measured the failure with the scripted model itself, not with a new minimal extension.
- **The proposed fix for item 2 names two options** and does not claim that jiti supports an exact-match alias. That jiti behavior was not checked.
- **The CHANGELOG sub-bullets break the one-sentence rule twice** (the first sub-bullet and the `--map-model` sub-bullet). The parent can join or cut them. The last sub-bullet names `install`, `update`, `reinstall`, and `enable`, not `apply`, because `apply` stages again only when it installs, updates, or enables. The plan's text also named `apply`.
- **The `info.ts` parent line is narrower than the plan's wording.** Only the view that reads the plugin source lists agents flat. The state-only view of an installed plugin reads the recorded names and is complete.
- **The decision rows cite this phase's `P4-DC-NN` IDs.** The parent renumbers them when it merges the log into the root `DUBIOUS-CHOICES.md`, so it must rewrite those references.
- **D-CF4-11, D-CF4-12, and D-CF4-13 carry no "settled autonomously" tag**, because `04-CONTEXT.md` does not mark them so.
- **The sibling-phase and CHANGELOG lines repeat the orchestrator-collected items (a) to (f)** in the groups where the parent applies them, not as a separate list. The commit trailer item (f) is a note, not an action.
