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
affects: [parent merge, phase 6]

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
  completed: 2026-11-01T18:40:00Z
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
