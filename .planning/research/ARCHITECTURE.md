# Architecture Research

**Domain:** Behavioral (cucumber) tests for every bridged Claude plugin component kind (skills, commands, agents, hooks, MCP servers, workflows), observed through Pi's and the companion extensions' own surfaces, with Pi's faux model provider standing in for an LLM
**Milestone:** component-features
**Researched:** 2026-10-31
**Confidence:** HIGH for the file layout, the gates, and the ownership hazards (read from this branch's code and the two earlier parallel milestones). HIGH for the measured startup, memory, and suite timings below (run on this branch, 4 cores). MEDIUM for the CI time estimate of the new scenarios (an extrapolation from spike 028 and the measurements). LOW for anything pi-mcp-adapter 7.0.0 changes, which this file did not research (STACK.md owns it).

## Answer in one paragraph

Phase 1 owns every file that two component phases could both want, and it lands
each shared step together with one real seed scenario. The seed goes in the
feature file of the component phase that needs the step, because
`npm run check:features` fails on any step that no scenario uses
(`scripts/check-features.mjs` `unusedFindings`, lines 135-145). Each component
phase then only adds files under its own `features/<kind>/`,
`features/step_definitions/<kind>/`, and `features/lib/<kind>-*.ts`, plus the
product files of its own bridge. Scenarios pick a Pi through a `Given` step that
starts a per-scenario "profile" Pi. The run's shared Pi stays as it is: it has no
companions and no model (`features/support/pi-process.ts`). Shared prose files
(`CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md` Key
Decisions, `.planning/BACKLOG.md`) are never edited by a component phase. Each
phase writes its lines into its own SUMMARY.md, and the parent session applies
them at merge, as plugin-lifecycle did. The version raise belongs in phase 1
because it changes single shared files: `package.json`, `package-lock.json`,
`scripts/install-test-peers.mjs`, `platform/pi-api.ts`, and the integration
conformance tests. The harness seeds must also pass on the final versions.

## Standard Architecture

### System Overview

```
cucumber worker (cucumber.json: parallel 8, order random)
┌──────────────────────────────────────────────────────────────────────────────┐
│ step_definitions/                                                              │
│  shared, phase-1-owned: command  session  config  git-host  mcp-configuration  │
│                         model (new)  companion (new)  plugin/publishing        │
│  per kind, handed over: skill/  slash-command/  agent/  hook/  mcp-server/     │
│                         workflow/                                              │
│        │ this.pi  this.lastTurn  this.results   (ScenarioWorld)                │
├────────┼─────────────────────────────────────────────────────────────────────┤
│ support/world.ts  usePiWithProfile(profile, env) -> scenario Pi (released)    │
│ support/pi-process.ts  BeforeAll/Before/AfterAll for the run's default Pi      │
├────────┼─────────────────────────────────────────────────────────────────────┤
│ lib/pi-process.ts (+ prompt-until-settled)   lib/pi-commands.ts                │
│ lib/scripted-model/{extension,script,calls}.ts  lib/pi-registry-probe/*.ts     │
│ lib/hook-recorder.ts  lib/mcp-stub-server.ts  lib/companions.ts                │
│ lib/<kind>-*.ts (per-kind fixture writers and readers)                         │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │ JSONL over stdio (test/e2e/_rpc.ts: piArguments, rpcChildEnvironment)
         ▼
┌──────────────────────────────┐   ┌───────────────────────────────────────────┐
│ run's Pi (default profile)    │   │ scenario Pi (scripted or companions)       │
│  real extension only          │   │  real extension + scripted model + probe    │
│  1 per worker, reset per      │   │  [+ pi-subagents, pi-mcp-adapter,           │
│  scenario (unchanged)         │   │     pi-dynamic-workflows from the peer      │
│                               │   │     cache]; started by a Given, stopped     │
│                               │   │     by the world's release                  │
└──────────────────────────────┘   └───────────────────────────────────────────┘
         both run in the same worker sandbox: {home} {agent dir} {project dir}
```

### Component Responsibilities

| Component | Responsibility | Lives in | Owner |
|---|---|---|---|
| Run's Pi | One RPC Pi per worker, reset before every scenario. Keeps the existing 1,154 scenarios as they are. Stays without companions and without a model. | `features/support/pi-process.ts`, `features/lib/pi-process.ts` | Phase 1 (no change expected beyond the driver API) |
| Profile Pi | A second Pi that one scenario starts through a `Given`, with extra `--extension` entries and an extra environment. It becomes `this.pi` for the rest of the scenario. The world stops it, killing its process group, which also kills MCP stub children and background workflow runs. | `features/support/world.ts` (`usePiWithProfile`), `test/e2e/_rpc.ts` (`startRpcPi` gains extra extensions) | Phase 1 |
| Scripted model | A Pi extension that registers `fauxProvider()` from `@earendil-works/pi-ai/providers/faux`. It plays the scenario's script, one step per model call, and logs every call (messages, tools, system prompt). | `features/lib/scripted-model/extension.ts` (loaded by Pi, never by cucumber); `script.ts` and `calls.ts` (the step-side writer and reader) | Phase 1 |
| Registry probe | A Pi extension that registers a probe command. The command appends `getAllTools()`, `getActiveTools()`, and `getCommands()` as a custom entry, so it reaches the driver through `entry_appended`. | `features/lib/pi-registry-probe/extension.ts` and its reader | Phase 1 |
| Hook recorder | A script that a fixture hook command runs. It appends the event, its Claude-shaped stdin, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PROJECT_DIR` to a JSONL log in the sandbox. | `features/lib/hook-recorder.ts` | Phase 1 (generalizes the inline script in `features/step_definitions/plugin/session-start-hooks.steps.ts`) |
| MCP stub server | A stdio MCP server with one `echo` tool that logs every request it receives. | `features/lib/mcp-stub-server.ts` (must be `.ts`: `isAllowedFile` in `scripts/check-features.mjs` admits only `.ts` under `lib/`, plus the one `.py`) | Phase 1 |
| Companion set | Resolves the entry files of pi-subagents, pi-mcp-adapter, and pi-dynamic-workflows from `node_modules/.cache/optional-peers` and fails clearly when they are not installed. | `features/lib/companions.ts`, `scripts/install-test-peers.mjs` (gains the engine) | Phase 1 |
| Per-kind fixture writer | Writes one kind's files into a published plugin through the existing `writePublishedPluginFiles` (`features/lib/published-marketplace.ts:719`). | `features/lib/<kind>-files.ts` | Phase 1 creates a minimal one for each seed. The kind's phase owns it afterwards. |
| Per-kind steps | Then steps that project one kind's surface (commands of source `prompt`, `subagent` list rows, recorder rows, `mcp__plugin_*` tools, workflow events). | `features/step_definitions/<kind>/*.steps.ts` | Phase 1 creates the topic module with the seed steps. The kind's phase owns it afterwards. |

## Recommended Project Structure

```
features/
├── marketplace/                     # unchanged
├── plugin/                          # unchanged, except session-start-hooks.feature -> owned by the hooks phase
├── skill/                           # phase 2   (seed from phase 1: invocation.feature)
├── slash-command/                   # phase 3   (seed: listing.feature)   "command" is taken, see below
├── agent/                           # phase 4   (seed: invocation.feature)
├── hook/                            # phase 5   (seed: tool-use.feature)
├── mcp-server/                      # phase 6   (seed: invocation.feature)
├── workflow/                        # phase 7   (seed: run.feature)
├── step_definitions/
│   ├── command.steps.ts  session.steps.ts  config.steps.ts  ...   # phase 1 only
│   ├── model.steps.ts               # NEW phase 1: the scripted model's script and calls
│   ├── companion.steps.ts           # NEW phase 1: "pi runs with ..." profile Givens
│   ├── plugin/publishing.steps.ts   # phase 1: + generic "has the file ... with this text:" docstring step
│   ├── skill/          <topic>.steps.ts   # created by phase 1 with seed steps, then phase 2's
│   ├── slash-command/  <topic>.steps.ts   # then phase 3's
│   ├── agent/          <topic>.steps.ts   # then phase 4's
│   ├── hook/           <topic>.steps.ts   # then phase 5's
│   ├── mcp-server/     <topic>.steps.ts   # then phase 6's
│   └── workflow/       <topic>.steps.ts   # then phase 7's
├── support/
│   ├── world.ts                     # phase 1: profile Pi, lastTurn record, uncompared-turn marker
│   ├── pi-process.ts                # phase 1
│   └── <kind>-<thing>.ts            # a kind phase may add one, with a kind-prefixed parameter type name
└── lib/
    ├── pi-process.ts  pi-commands.ts  run-tokens.ts  published-marketplace.ts   # phase 1
    ├── scripted-model/{extension,script,calls}.ts                             # phase 1
    ├── pi-registry-probe/{extension,read}.ts                                  # phase 1
    ├── hook-recorder.ts  mcp-stub-server.ts  companions.ts                    # phase 1
    └── skill-files.ts  slash-command-files.ts  agent-files.ts  hook-files.ts
        mcp-server-files.ts  workflow-files.ts                                 # phase 1 minimal, then per kind
```

### Structure Rationale

- **One function directory per kind.** `layout.md` requires
  `features/<function>/<capability>.feature` and step modules named after the
  function. The check `titleFindings` (`scripts/check-features.mjs`) requires
  the title `<Function> <capability>`. A directory per kind gives each phase a
  disjoint tree, and no gate change is needed: `isAllowedFile` admits any
  depth-2 `.feature` file.
- **`slash-command`, not `command`.** `features/step_definitions/command.steps.ts`
  already owns "run a `/claude:plugin` command and read its result", and
  `layout.md` names a step module after its function. A `command/` function
  directory would read as that function. `plugin-command` would read as
  `/claude:plugin`. `slash-command` names what the user types (`/kit:greet`).
  Phase 1 picks the final name and records it, because every later scenario
  title depends on it.
- **`mcp-server`, not `mcp`.** `mcp-configuration.steps.ts` (phase-1 owned)
  already covers `mcp-adapter.json` notices. The kind phase covers servers as
  the adapter runs them.
- **Pi extensions go under `lib/`, never `support/`.** `cucumber.json` imports
  `features/support/**/*.ts` into the cucumber process. A faux-provider or probe
  extension there would load `@earendil-works/pi-ai` into every worker. Under
  `lib/` it runs only when Pi loads it with `--extension`. The `lib/` lint block
  (`eslint.config.js:476`) keeps it from registering cucumber hooks.
- **Pre-created per-kind lib and step modules.** Ownership passes from phase 1 to
  the kind phase at phase 1's merge. That is the lifecycle-coverage seed rule
  (`.planning/milestones/lifecycle-coverage-ROADMAP.md`, "Seeds"). Phase 2-7
  sessions then edit files no other running session touches.

## Architectural Patterns

### Pattern 1: Seed-scenario hand-off (the unused-step gate)

**What:** Every shared step that phase 1 lands is used by one real scenario in
the feature file of the phase that needs it. `npm run check:features` dry-runs
every scenario with the tag expression cleared and reports each step definition
whose id no test step references as `unused step definition ...`
(`scripts/check-features.mjs:104-145`). `check:static` runs it, so the
pre-commit hook fails too. Phase 1 therefore cannot land a step "for later":
either it seeds the step, or the component phase adds the step itself.
**When to use:** Any step, parameter type, or token that two or more component
phases need. Any harness capability a component phase must not edit.
**Trade-offs:** Phase 1 writes 6-10 real scenarios across six directories. The
seed must be a full-value scenario (whole-result comparison, a `Given` that
asserts its setup), not a placeholder (lifecycle-coverage 01-CONTEXT
"Seed scenarios").

### Pattern 2: Profile Pi chosen by a `Given`, not by a tag

**What:** `Given pi runs with the scripted model` and
`Given pi runs with its companion extensions` (optionally a table of which
companions). This mirrors `pi runs with the github base address "<value>"`
(`world.ts` `usePiWithGitHubBaseUrl`, `usePiWith`). The step starts
`PiProcess.start(sandbox, env, extraExtensions)`, registers its stop with
`onRelease`, and the world's `pi` getter returns it.
**When to use:** Every scenario that needs a model turn, a probe, or a
companion. "Companion missing" scenarios use the scripted profile without
companions, or the default Pi when only a `/claude:plugin` result is checked.
**Why not tags:** `check-features.mjs` rejects any tag that is not on an
`Examples:` block, and any Examples tag other than `@url` or `@github`
(`misplacedTagFindings`, `examplesTagFindings`). A `@companions` tag would need
a gate change and a skill-rule change, and excluding it would silently drop
rows.
**Why not a second long-lived Pi per worker:** measured, a warm companion Pi
starts in 1.6-1.7 s (3.8 s on a cold module cache), and a scripted Pi in about
0.65 s, the same as the default Pi. A per-scenario process gets a free, total
reset: stopping the process group kills MCP stub children, background workflow
runs, and async agents. A pooled companion Pi would need a reset proof for each
companion's in-process state. That proof is the one place a cross-kind leak
would hide, and it only shows up once all six phases' scenarios interleave in
random order. Start per-scenario. Pool later only if CI time requires it (see
Scaling).
**Trade-offs:** About 1 s of extra start-up per companion scenario. Each step
that writes a config or installs runs after the profile `Given`, as the
GitHub-base precedent requires (`world-and-stand-ins.md`: "its startup load
reads the configs").

### Pattern 3: Per-scenario script, no in-process counters

**What:** The scripted-model extension holds no per-scenario state in the Pi
process. It reads the script from a fixed file under the sandbox HOME, and it
gets the step index from the number of lines in the call log, which also lives
under HOME. `Before()` empties HOME, so the script and the counter reset with
the sandbox. This is not optional even with per-scenario Pis: spike 028 found
that "the faux script is one queue per process", and an in-process child agent
takes the next step. A file-backed script makes the parent's and child's steps
one visible ordered list.
**Gherkin form (readable without the step code):**

```gherkin
Scenario: Running a plugin command sends its text with the arguments to the model
  Given pi runs with the scripted model
  Given the marketplace "tools" is published as a dir source
  Given the marketplace "tools" offers these plugins:
    | name | version |
    | kit  | 1.0.0   |
  Given the published plugin "kit" of the marketplace "tools" has the file "commands/greet.md" with this text:
    """
    ---
    description: Greet someone by name.
    ---

    Greet $ARGUMENTS warmly.
    """
  Given the marketplace "tools" is added to the user scope
  Given the user has run "/claude:plugin install kit@tools --scope user"
  Given the user has started a new pi session
  Given the model answers each request in turn:
    | reply   | tool | arguments |
    | greeted |      |           |
  When the user prompts "/kit:greet Ada"
  Then the model receives these requests:
    | request | last user message |
    | 1       | Greet Ada warmly. |
```

- **The generic file step** (`has the file "<path>" with this text:`) puts the
  real `SKILL.md`, `hooks.json`, or `.mcp.json` text in the scenario. A reader
  sees the input, and no per-kind publishing step is needed. Run tokens supply
  the stand-in paths: `{mcp stub server}` and `{hook recorder}` follow
  `features.md` "Run tokens", defined once in `lib/run-tokens.ts`.
- **The script table** has one row per model call, in call order. A row has
  either `reply` or `tool` with `arguments` (JSON). The table must list every
  call, including a child agent's (spike gotcha).
- **The prompt step needs its own text.**
  `When the user sends the message {string}` (`session.steps.ts:53`) asserts that
  Pi *refuses* the message for want of a model (`lib/pi-commands.ts`
  `sendMessage`). A model turn needs a different `When` that waits for
  `agent_settled`, not the first `agent_end` (spike gotcha). Phase 1 chooses the
  wording, for example `the user prompts`.
- **Calls compare whole.** A `Then` on model requests lists every call, as the
  row rule requires. The world gets an `uncomparedTurn` marker that the `After`
  hook checks, as it already does for rows, notices, and completions
  (`world.ts` `After`).

### Pattern 4: A turn record on the world, so kind phases never touch `world.ts`

**What:** The model-turn `When` stores one `lastTurn` record on the world: the
custom entries, extension errors, `tool_execution_*` events, and slices of the
scripted-model call log, the hook-recorder log, the MCP stub log, and the probe
snapshot, each cut at the `When` (the `requestWindow` pattern in
`support/https-git-host.ts`). Kind phases read `this.lastTurn` through their
own lib projections.
**Why:** `features/support/world.ts` is 597 lines and the single most
conflict-prone harness file. Any per-kind field a component phase adds there is
a certain three-way conflict. If phase 1 captures everything a turn can leave,
no kind phase needs new world state.

## Data Flow

### Model-turn flow (the new path)

```
Given pi runs with <profile>            -> world.usePiWithProfile -> startRpcPi(sandbox, env, [scripted-model, probe, companions...])
Given ... has the file ... with this text -> writePublishedPluginFiles (path or git publication)
Given the user has run "/claude:plugin install ..."   (existing command driver, unchanged)
Given the user has started a new pi session           (resources reload, spike step 1)
Given the model answers each request in turn:         -> lib/scripted-model/script.ts writes $HOME/<script file>
When the user prompts "<text>"          -> PiProcess.prompt(): send `prompt`, collect records until `agent_settled`
                                           -> world.lastTurn = { entries, toolEvents, modelCalls, hookRuns, mcpRequests }
Then <kind projection of lastTurn>      -> deepStrictEqual against table.raw(); marks the turn compared
After                                   -> releases (stop the profile Pi's process group), uncompared checks
```

### Host-surface flow (no model)

`get_commands` (RPC) and the probe command's custom entry
(`getAllTools`/`getCommands`) give listing, naming, descriptions, MCP tool
names, `/kit:demo` registration, and `/mcp` presence. Each kind phase writes
its own projection step, such as "pi offers these prompt commands:" (source
`prompt`) or "pi offers these MCP tools:" (`mcp__plugin_*`), and compares the
whole projected set.

### Key Data Flows

1. **Hook evidence:** a fixture hook command runs `node {hook recorder} <event>`.
   The recorder appends `{event, stdin, pluginRoot, projectDir}` to a sandbox
   log, and the turn record slices that log. The `new` to `clear` parity fix
   changes `features/plugin/session-start-hooks.feature`, the only feature with
   a `| new |` source row (checked by grep), so the hooks phase owns that file.
2. **MCP evidence:** the adapter spawns `node {mcp stub server}` as the fixture
   `.mcp.json` declares, and the stub logs spawn args, env, and each method. The
   faux model calls the adapter's `mcp` proxy tool. The direct tool is inactive
   under `directTools: "search"` (spike step 5).
3. **Workflow evidence:** the engine does not deliver results over RPC (spike
   gotcha). Evidence comes from the run's `.events.jsonl` under the sandbox, or
   from the `pi-dynamic-workflows:progress` custom entries, which the driver
   already collects.

## Phase Graph

```text
W0  Phase 1  Harness and version raise          (the only prerequisite)
W1  Phase 2 Skills | Phase 3 Slash commands | Phase 4 Agents | Phase 5 Hooks | Phase 6 MCP servers | Phase 7 Workflows
    (each depends on Phase 1 only; own session, own worktree, branched from the milestone branch after Phase 1 merges)
W2  (optional) Phase 8  Suite close: apply SUMMARY-collected CHANGELOG/README/README.es/PROJECT/BACKLOG lines
    if the parent did not apply them at each merge; promote any step two phases each defined into a topic module;
    tune CI sharding on the measured combined run; file the user-invocable gap with Pi
```

Dependencies, stated explicitly:

- Phase 1 depends on nothing.
- Phases 2-7 each depend on Phase 1 only. No component phase depends on another.
  A cross-kind scenario (for example a PreToolUse hook on an MCP tool, or an
  agent that preloads a skill) is assigned to exactly one phase, the kind whose
  behavior it proves. It uses phase-1 stand-ins, never another phase's lib file.
- Phase 8 depends on every one of 2-7 having merged. If the parent session
  applies the collected lines at each merge (the plugin-lifecycle rule), Phase 8
  is only needed for step promotion and CI tuning, and it can be dropped.

### Phase 1 internal waves (plans in one wave own disjoint files)

| Wave | Plan | Owns | Seed |
|---|---|---|---|
| 1 | 01-01 Version raise | `package.json` (peer floors: Pi `>=1.4.0`, pi-mcp-adapter `>=7`, pi-subagents `>=0.84.0`, pi-dynamic-workflows `>=3.15.0` optional peer with `peerDependenciesMeta`; devDeps `^1.4.0`, and `@earendil-works/pi-ai` as a devDependency for the faux import), `package-lock.json`, `scripts/install-test-peers.mjs` (`peerNames` gains the engine), `test/e2e/pi-peer-floor/**`, every product fix that keeps `npm run check` green on the new versions (`platform/pi-api.ts`, `platform/mcp-status.ts`, `bridges/mcp/adapter-doc.ts`, `platform/workflow-home.ts`, `shared/concerns/soft-dep.ts` as needed), `test/integration/**` (the 5.2.0-pinned MCP conformance tests), the README and README.es requirement lines, the docs `*-compatibility.md` version lines, `CHANGELOG.md` | none (gates only) |
| 1 | 01-02 Ownership rules | `.agents/skills/cucumber/rules/layout.md` "Parallel work" (this milestone's table, reserved kind module names), `world-and-stand-ins.md` (profile Pi, scripted model, recorder, and stub rules) | none |
| 2 | 01-03 Tracer: profile Pi + scripted model | `test/e2e/_rpc.ts` (`startRpcPi` extra extensions, a typed extra environment), `test/architecture/hermetic-git-environment.test.ts` (pins the allowlist), `features/lib/pi-process.ts` (prompt until `agent_settled`), `features/lib/scripted-model/*`, `features/lib/companions.ts`, `features/lib/run-tokens.ts` (every new token: `{mcp stub server}`, `{hook recorder}`), `features/support/world.ts` (profile Pi, `lastTurn`, uncompared-turn marker), `features/step_definitions/{model,companion}.steps.ts`, `features/step_definitions/plugin/publishing.steps.ts` (generic file step), `features/step_definitions/session.steps.ts` (the prompt `When`), `.github/workflows/ci.yml` (behavioral job runs `install-test-peers`, timeout) | `features/skill/invocation.feature`: the `/skill:` body reaches the model |
| 3 | 01-04 Probe | `lib/pi-registry-probe/*`, `lib/slash-command-files.ts`, `step_definitions/slash-command/listing.steps.ts` | `features/slash-command/listing.feature` |
| 3 | 01-05 Hook recorder | `lib/hook-recorder.ts`, `lib/hook-files.ts`, `step_definitions/hook/runs.steps.ts` | `features/hook/tool-use.feature`: a scripted `bash` call fires PreToolUse |
| 3 | 01-06 MCP stub | `lib/mcp-stub-server.ts`, `lib/mcp-server-files.ts`, `step_definitions/mcp-server/calls.steps.ts` | `features/mcp-server/invocation.feature`: `echo:ping` via the `mcp` proxy |
| 3 | 01-07 Agents | `lib/agent-files.ts`, `step_definitions/agent/runs.steps.ts` | `features/agent/invocation.feature`: `subagent {agent, async:false}` runs the body as the child's system prompt |
| 3 | 01-08 Workflows | `lib/workflow-files.ts`, `step_definitions/workflow/runs.steps.ts` | `features/workflow/run.feature`: `/kit:demo hello who=Ada` completes |
| 4 | 01-09 Phase gate | measure the combined cucumber time, set the CI shard and timeouts, `npm run check` | none |

Wave 3 works only because wave 2 put every shared registration in place first:
the world fields, the run tokens, the profile machinery, and the generic file
step. Each wave-3 plan then adds only lib files, one step module, and one
feature file. 01-01 must finish before 01-03, because the faux import needs
`@earendil-works/pi-ai` listed in `package.json`, and the companion profile
needs the engine in the peer cache.

### Component phase internal waves (the template for phases 2-7)

| Wave | Plan | Feature file | Step module | Product files it may change |
|---|---|---|---|---|
| 1 | Tracer: listing and naming | `features/<kind>/listing.feature` (extends the seed file when the seed is listing) | `step_definitions/<kind>/<topic>.steps.ts` (the topic module from phase 1, extended with shared kind steps here only) | bridge `discover.ts`, the naming code |
| 2 | Frontmatter and field variants | `features/<kind>/frontmatter.feature` | `<kind>/frontmatter.steps.ts` | bridge `frontmatter*`/`convert.ts`/`substitute.ts` |
| 2 | Invocation through the scripted model | `features/<kind>/invocation.feature` | `<kind>/invocation.steps.ts` | runtime-side files (hooks `payloads/*`, MCP adapter entry) |
| 2 | Companion missing (agents, MCP, workflows) or collisions (skills, commands) | `features/<kind>/companion-missing.feature` or `collisions.feature` | `<kind>/companion-missing.steps.ts` | `shared/concerns/soft-dep.ts` only if it is the one plan touching it |
| 2 | Removal and replacement (uninstall, disable, update) | `features/<kind>/lifecycle.feature` | `<kind>/lifecycle.steps.ts` | bridge `stage.ts`/`unstage.ts` |
| 3 | Decisions, docs, SUMMARY lines, phase gate | none | none | `docs/<kind>-compatibility.md` |

A step that two wave-2 plans of one phase both need moves into the kind's topic
module in wave 1, or into a follow-up commit (layout D-08). A plan never edits a
sibling plan's step module. The planner assigns product files per plan from the
table. If a fix needs a file that another plan in the same wave owns, the
second fix moves to the next wave.

Per-kind specifics:

- **Phase 2 Skills:** listing (`get_commands` `/skill:<plugin>-<name>`,
  description, path), frontmatter (`name`, `description`,
  `disable-model-invocation`, BOM, malformed), the `user-invocable: false`
  divergence (record the ID, the Pi capability-gap license, and the report to
  Pi), invocation (`<skill>` block), collisions, lifecycle. Product:
  `bridges/skills/*`.
- **Phase 3 Slash commands:** listing (source `prompt`, a first-line
  description fallback), frontmatter (`argument-hint`, `description`),
  `$ARGUMENTS` and positional arguments, subdirectory namespacing, lifecycle.
  Product: `bridges/commands/*`.
- **Phase 4 Agents:** `subagent {action:"list"}` rows, frontmatter (`tools`
  mapping, `model` with and without `--map-model`, color, skill preloads), a
  foreground run, pi-subagents missing, lifecycle (`agents-index.json`
  through the user surface only). Product: `bridges/agents/*`,
  `persistence/agents-index-*`.
- **Phase 5 Hooks:** wave 1 is the parity fixes: `new` sent as `clear` in
  SessionStart and SessionEnd, `compact` from `session_compact`, and `clear`,
  `compact`, and `fork` matchers. They touch `bridges/hooks/payloads/session-start.ts`,
  `session-end.ts`, `event-router.ts`, and `domain/components/hook-events.ts:262`,
  and they rewrite `features/plugin/session-start-hooks.feature` and
  `step_definitions/plugin/session-start-hooks.steps.ts` (both reassigned to
  this phase). Wave 2 covers tool-use hooks (matchers, `if`), prompt and stop
  hooks, and the env and exit-code contract. All of those may need
  `event-router.ts`, so the planner gives that file to one plan per wave.
- **Phase 6 MCP servers:** listing (`mcp__plugin_<plugin>_<server>__<tool>`,
  `/mcp`), config variants (`${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}`, args,
  env; this needs the profile's extra environment from phase 1), invocation
  through the `mcp` proxy, the adapter missing, lifecycle (an uninstall drops
  the entry and keeps the user's entries). Product: `bridges/mcp/*`,
  `platform/mcp-status.ts`, `domain/mcp-resolution.ts`. It continues from
  01-01's 7.x fixes.
- **Phase 7 Workflows:** registration as `/<plugin>:<name>`, `args` parsing,
  the run result through events, the engine missing, lifecycle. Product:
  `bridges/workflows/*`, `platform/workflow-home.ts`, `domain/workflow-script.ts`.
  Runs whose scripts call agents are out of scope.

## File-Ownership Map

### Shared files that every component phase would otherwise touch, and how they are pre-partitioned

| File | Hazard | Phase-1 action that makes later edits unnecessary |
|---|---|---|
| `features/support/world.ts` | Every new piece of state is a world field. One file, 597 lines. | Add the profile Pi, `lastTurn`, and the uncompared-turn marker once (Pattern 4). Kind phases read `lastTurn` and add no fields. |
| `features/support/pi-process.ts` | The reset assertions grow per kind. | Not needed with per-scenario profile Pis: the run's Pi never loads companions. Leave as is. |
| `features/lib/pi-process.ts`, `test/e2e/_rpc.ts` | The driver gains prompt-until-settled, extra extensions, and env. | Phase 1, complete. A kind phase that needs a new env variable for its profile passes it through the typed `extraEnvironment` that phase 1 adds, without editing the allowlist. |
| `features/lib/run-tokens.ts` | Each stand-in path is a token. | Phase 1 defines `{mcp stub server}` and `{hook recorder}`, and any token a seed needs. |
| `features/support/<thing>.ts` parameter types | Two phases defining the same parameter-type name fails at load. | Phase 1 defines `{pi profile}` if it uses one. A kind phase prefixes any type it adds with its kind. |
| `features/step_definitions/{command,session,config,git-host,mcp-configuration}.steps.ts`, `plugin/publishing.steps.ts`, `marketplace/publishing.steps.ts` | Shared steps. | Phase 1 only (the existing lifecycle-coverage rule in `layout.md` "Parallel work"). The generic file step goes into `plugin/publishing.steps.ts` in 01-03. |
| `cucumber.json`, `scripts/check-features.mjs`, `.agents/skills/cucumber/**` | Gate and rules. | Phase 1 only. No new tags (Pattern 2), so the gate needs no change. |
| `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs` | Floors, devDeps, npm scripts (a cucumber shard script). | Phase 1 only (01-01, plus 01-09 for scripts). |
| `.github/workflows/ci.yml` | The behavioral job lacks the peer install and has a 10-minute timeout. | Phase 1 (01-03, 01-09). |
| `extensions/.../platform/pi-api.ts` | Pi 1.4 types; hooks need `session_compact` and the `new`/`fork` reasons. | 01-01 widens every Pi event and API type any kind needs, so phase 5 does not edit it. |
| `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md` (Key Decisions), `.planning/BACKLOG.md` | Every phase has a line. `README.es.md` must stay in sync with `README.md` (readme skill). | No component phase edits them. Each phase writes its CHANGELOG bullet, decision rows, backlog dispositions, and README sentences into its own SUMMARY.md. The parent applies them at merge (the plugin-lifecycle rule in `plugin-lifecycle-ROADMAP.md` "Parallelism"). |
| `.planning/ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `WINDOWS.md` | GSD progress writes, and `gsd-tools windows append` adds lines at the end of the file. | Tool-written. Concurrent end-of-file appends conflict mechanically: keep both sides. Prefix descriptions with `[component-features]` (AGENTS.md). |

### Product files that can collide between component phases

| File | Who might touch it | Mitigation |
|---|---|---|
| `shared/notification-types.ts` `Reason` union, `shared/notification-wire.ts` `REASONS`, `shared/notify-reasons.ts`, `schema/claude-plugin.schema.json`, `test/architecture/notify-closed-set-locks.test.ts` ("closed 78-entry reason set", line 219), `test/architecture/compat-01-no-expansion.test.ts`, `docs/json-output.md` | Any phase that adds a reason | A conflict on append-only lists is certain if two phases add reasons (plugin-lifecycle `09-RESEARCH.md` §7). Prefer existing reasons. A new reason lands as its own commit, and the later merge keeps both entries and fixes the count. |
| `docs/output-catalog.md` + `test/architecture/catalog-uat/catalog-contract.test.ts` (`EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_615`) | Any phase that adds a catalog state | Same as above; the counters conflict (plugin-lifecycle `07-RESEARCH.md`). Edit prose outside the example blocks where possible. |
| `shared/concerns/soft-dep.ts` | Agents, MCP, and workflows (companion missing) | Each phase edits only its own companion's arm. |
| `bridges/skills/{stage,discover,unstage}.ts` and `bridges/commands/{...}`, plus `bridges/agents/stage.ts` and `bridges/commands/stage.ts` | Skills, commands, and agents | These are reviewed clone pairs carrying `fallow-ignore-next-line code-duplication` markers in both copies (CONVENTIONS.md "Suppressions"). Changing one side can break the other side's marker, and that only shows in the combined tree. The later merge reruns `npx fallow dupes` and moves the markers. |
| `domain/name.ts` | Skills, commands, agents, and workflows (generated names) | Edit only the kind's own function. Flag in each phase's research. |
| `orchestrators/plugin/install-outcome.ts` (7-phase ledger), `bridges/hooks/event-router.ts` | Rare outside hooks | Keep each change in its own function. |
| `features/` clones across phases | Two phases write near-identical step or lib code (JSONL readers, table projections) | `fallow dupes` runs over `features/` (production mode is off for dupes) and fails on any clone group, and it is first seen at the second merge. Phase 1 ships the shared readers (JSONL log slicing, table projection) in lib, so phases have no reason to copy them. |

### Ownership table for the roadmap

| Phase | Feature files | Step modules (`features/step_definitions/`) | Lib | Product (primary) | Docs |
|---|---|---|---|---|---|
| 1 | seeds: `skill/invocation`, `slash-command/listing`, `hook/tool-use`, `mcp-server/invocation`, `agent/invocation`, `workflow/run` | `model`, `companion`, `plugin/publishing`, `session`, and the first topic module of each kind | `scripted-model/*`, `pi-registry-probe/*`, `hook-recorder`, `mcp-stub-server`, `companions`, `run-tokens`, `pi-process`, first `<kind>-files` | version-raise fixes, `platform/pi-api.ts` | cucumber skill rules, the `*-compatibility.md` version lines |
| 2 | `features/skill/**` | `skill/**` | `skill-files.ts` | `bridges/skills/**` | `docs/skills-compatibility.md` (new, if wanted) |
| 3 | `features/slash-command/**` | `slash-command/**` | `slash-command-files.ts` | `bridges/commands/**` | `docs/commands-compatibility.md` (new, if wanted) |
| 4 | `features/agent/**` | `agent/**` | `agent-files.ts` | `bridges/agents/**`, `persistence/agents-index-*` | `docs/agents-compatibility.md` (new, if wanted) |
| 5 | `features/hook/**`, `features/plugin/session-start-hooks.feature` | `hook/**`, `plugin/session-start-hooks.steps.ts` | `hook-files.ts` | `bridges/hooks/**`, `domain/components/hook-*.ts`, `domain/components/hooks*` | `docs/hooks-compatibility.md` |
| 6 | `features/mcp-server/**` | `mcp-server/**` | `mcp-server-files.ts` | `bridges/mcp/**`, `platform/mcp-status.ts`, `domain/mcp-resolution.ts`, `domain/components/mcp.ts` | `docs/mcp-compatibility.md` |
| 7 | `features/workflow/**` | `workflow/**` | `workflow-files.ts` | `bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts` | `docs/workflows-compatibility.md` |

Each phase also owns its kind's unit tests (`test/bridges/<kind>/**`) and
integration tests (`test/integration/<kind>-*`). The kind-specific
architecture tests go with their kind, for example
`test/architecture/hooks-*.test.ts` with phase 5.

## Version Raise: Phase 1, Not the Owning Component Phase

Put the whole raise in phase 1. The reasons:

1. **The edits land in single shared files.** Each companion's floor is a line
   in `package.json` `peerDependencies` and `peerDependenciesMeta`. The Pi raise
   also rewrites `package-lock.json` and `test/e2e/pi-peer-floor/**`. If three
   parallel phases each raised one companion, all three would edit
   `package.json`, `scripts/install-test-peers.mjs` (`peerNames`), the README
   requirement lines, and the README.es lines.
2. **The companions depend on the host version.** pi-subagents 0.84.0 declares
   `@earendil-works/pi-ai >=1.2.0`, and its background runs need host packages
   that Pi 1.3 lacks (spike gotcha). pi-mcp-adapter 7.0.0 admits
   `@earendil-works/pi-ai ^1.0.0`. pi-dynamic-workflows 3.15.0 needs
   `pi-coding-agent >=0.80.8`. The harness seeds must pass on the set the
   component phases will use (versions from `npm view`, 2026-10-31).
3. **The integration tests pin the old floors.** `scripts/install-test-peers.mjs`
   installs exactly the floor (`minVersion`), and
   `test/integration/mcp-override-lifecycle.test.ts` and the `mcp-*-conformance`
   tests encode pi-mcp-adapter 5.2.0 behavior. A raise without their fixes
   leaves `npm run check` red. That would break every component phase's merge
   gate at once.
4. **It causes no ownership conflict.** Phase 1 finishes before phase 6 starts,
   so phase 1's edits to `bridges/mcp/*` for 7.x are simply history to the MCP
   phase. Phase 1 fixes what breaks the existing gates. New parity gaps the new
   versions open on a kind's surface stay with that kind's phase, under the bug
   policy.

The one risk is size: if adapter 7.x needs a large `bridges/mcp` rework,
01-01 grows. Mitigation: split 01-01 into a wave-1 raise that edits every
package and metadata file and fixes the typecheck, with the unit and
integration fixes for each companion in file-disjoint plans of the same
wave-group. Every plan must leave `npm run check` green at the wave gate, and
the pre-commit hook checks only static checks and staged pairs.

## Scaling Considerations (run time and CI)

Measured on this branch (4 cores, Node 24, the peer floors currently installed):

| Measure | Value |
|---|---|
| Full suite today, `cucumber-js --parallel 4` | 1,154 scenarios, 11,883 steps, **2 min 0 s wall** (6 min 5 s summed step time, about 0.32 s per scenario) |
| Default Pi start (spawn to first `get_commands`) | 0.64-0.71 s, RSS 149 MB |
| Scripted profile (+ faux + probe) start | 0.64-0.68 s, RSS 170 MB |
| Companion profile (+ pi-subagents 0.74 + pi-mcp-adapter 5.2) start | 1.6-1.7 s warm, 3.8 s on a cold module cache, RSS 309 MB |
| `new_session` reset | 25-40 ms default, 50-70 ms with companions |
| CI `behavioral` job | `timeout-minutes: 10`, `npm ci --ignore-scripts`, **no `install-test-peers`** (`.github/workflows/ci.yml:125-145`) |
| `npm run check` | includes `test:cucumber` (`package.json` `check`), so every merge gate pays the full suite |

Estimate for the new scenarios: about 300-400 scenarios (6 kinds × 5 feature
files × about 10-15 scenarios). Each companion scenario pays about 1.7 s to
start Pi, and each scripted one about 0.7 s. A model turn costs a few hundred
ms plus whatever settle window the driver uses, and each hook run spawns a
`node` process of about 50 ms. That is roughly 2-4 s per scenario, or
600-1,600 summed seconds. On a 4-vCPU runner that adds about 3-7 minutes of
wall time to the 2 minutes of today. The existing 10-minute timeout does not
hold that safely.

### Scaling Priorities

1. **First bottleneck: the CI behavioral job timeout.** In 01-09, split the job
   into a matrix of two path shards, with no tags: lifecycle
   (`cucumber-js features/marketplace features/plugin`) and components
   (`cucumber-js features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`).
   Each shard gets a 15-minute timeout. Only the components shard runs
   `node scripts/install-test-peers.mjs`. Cucumber takes feature paths as
   arguments. `check:features` still dry-runs every scenario, so the shards
   cannot hide an unused step.
2. **Second bottleneck: local merge gates.** `npm run check` runs the full suite,
   about 4-9 minutes once the components land. That is acceptable for each
   wave's post-merge gate. A component phase iterates with
   `npx cucumber-js features/<kind>` and runs the full `npm run check` only at
   the gates (`.agents/skills/local-verification/SKILL.md`).
3. **Third, only if needed: pool the companion Pi per worker** behind the
   slow-process exception (`world-and-stand-ins.md`). This needs a reset proof
   for each companion: no MCP child, no running workflow, no async agent. Do not
   start here (Pattern 2).

Memory is not a constraint. Eight workers, each with a default Pi and one
companion Pi, use about 3.7 GB. The GitHub-hosted runner has 16 GB.

## Anti-Patterns

### Anti-Pattern 1: Landing "future" steps in phase 1 without a seed

**What people do:** Add every step a kind will need to a shared module so later phases "only write features".
**Why it's wrong:** `check:features` fails on each unused definition, and so does the pre-commit hook (via `check:static`).
**Do this instead:** Seed each shared step in the kind's feature file. Leave kind-only steps to the kind phase.

### Anti-Pattern 2: Loading the faux provider or companions into the run's shared Pi

**What people do:** Add the extensions to the BeforeAll Pi to save start-up time.
**Why it's wrong:** `sendMessage` (`lib/pi-commands.ts`) and the background-update scenarios assert that Pi *refuses* a plain message for want of a model, and a registered model provider can change that. Companions would leak MCP children, workflow runs, and registry state across the 1,154 existing scenarios. The adapter also prints a `builtin:mcp` `/mcp` override warning on stderr (seen in the measurement).
**Do this instead:** Use a profile Pi per scenario (Pattern 2), and keep the default Pi exactly as today.

### Anti-Pattern 3: Choosing the Pi by tag

**What people do:** Use `@companions` or `@model` on a scenario.
**Why it's wrong:** The gate rejects tags outside `Examples:` blocks and any tag other than `@url` or `@github`. Excluding a tag would drop rows without anyone seeing it.
**Do this instead:** Use a profile `Given`, and shard CI by directory.

### Anti-Pattern 4: A component phase editing a phase-1 file "just a little"

**What people do:** Add a world field, a token, or a parameter type, or append to `session.steps.ts`.
**Why it's wrong:** Six parallel sessions editing one file is the conflict this milestone is designed to avoid. Ambiguous steps and duplicate parameter-type names only fail after the second merge.
**Do this instead:** Define a phase-local step with the kind's noun in its text (D-08). Record the need in the SUMMARY so Phase 8 (or the parent) can promote it.

### Anti-Pattern 5: Asserting bridge output files

**What people do:** Read `<agentDir>/agents/*.md` or `mcp-adapter.json` in a `Then`.
**Why it's wrong:** The milestone says "every scenario checks what Pi or a companion reports, never the files the bridge wrote" (PROJECT.md Key context).
**Do this instead:** Use the probe, `get_commands`, the companion's own commands and tools, the recorder and stub logs, and the model's call log.

### Anti-Pattern 6: Waiting on the first `agent_end` or fixed sleeps

**What people do:** Copy the spike's `setTimeout(1500)` waits.
**Why it's wrong:** A prompt sent mid-turn is queued as a follow-up (spike gotcha), and fixed sleeps are flaky on a loaded 4-vCPU runner running 8 workers.
**Do this instead:** Wait for `agent_settled` in `PiProcess.prompt()`. Read logs only after it.

## Integration Points

### External Services (all stand-ins)

| Service | Integration pattern | Notes |
|---|---|---|
| LLM provider | Pi's own `fauxProvider()` via `pi.registerProvider`, then RPC `set_model faux/faux-1` | `@earendil-works/pi-ai` must become a devDependency (it is only transitive now: `package.json` lists `pi-coding-agent` and `pi-tui`) |
| MCP server | The stdio stub spawned by pi-mcp-adapter | The `.ts` file runs under Node's type stripping. fallow may report a lib file that only Pi or the adapter loads; the lifecycle-coverage precedent (`state-lock-holder.ts`) is that the step side imports the module too |
| pi-subagents, pi-mcp-adapter, pi-dynamic-workflows | Loaded by path from `node_modules/.cache/optional-peers/node_modules/...` | PIFL-03 keeps them out of the lockfile. The engine is new to `install-test-peers.mjs`. The CI behavioral job must run it. |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `features/**` to `test/e2e/_rpc.ts` | Direct import (the sanctioned process-harness reuse, `layout.md` "Boundaries") | Phase 1 extends `startRpcPi`. `test/architecture/hermetic-git-environment.test.ts` pins `rpcChildEnvironment` |
| Cucumber process to the Pi-side extensions | Files under the sandbox HOME (script, call log, recorder log, stub log) plus custom entries | No IPC. `Before()` emptying HOME is the reset |
| Kind phase to the harness | Reads `this.lastTurn` and `this.pi` through phase-1 lib readers | No world edits after phase 1 |

## Sources

- `.agents/skills/cucumber/SKILL.md`, `rules/layout.md` ("Parallel work", "Boundaries"), `rules/steps.md`, `rules/features.md`, `rules/world-and-stand-ins.md`. HIGH (repo).
- `scripts/check-features.mjs` (`unusedFindings` 135-145, `isAllowedFile`, `titleFindings`, `misplacedTagFindings`, `examplesTagFindings`). HIGH (repo).
- `features/support/world.ts`, `features/support/pi-process.ts`, `features/lib/pi-process.ts`, `features/lib/pi-commands.ts` (`sendMessage`), `features/lib/published-marketplace.ts` (`writePublishedPluginFiles`), `features/step_definitions/plugin/session-start-hooks.steps.ts`. HIGH (repo).
- `test/e2e/_rpc.ts` (`piArguments`, `rpcChildEnvironment`, `startRpcPi`), `cucumber.json`, `package.json`, `.github/workflows/ci.yml`, `scripts/install-test-peers.mjs`, `eslint.config.js` (features blocks), `.fallowrc.json`. HIGH (repo).
- `.planning/spikes/028-model-free-harness/` (README, driver.ts, faux-extension.ts, probe-extension.ts, fixture.ts, stub-mcp.mjs, faux.ts, run.ts, scripts). HIGH (repo spike, VALIDATED).
- `.planning/milestones/lifecycle-coverage-ROADMAP.md` ("Parallelism", "File ownership", seed rule), `lifecycle-coverage-phases/01-suite-foundation/01-CONTEXT.md`, `lifecycle-coverage-phases/15-.../15-VERIFICATION.md` (a production-file merge conflict across parallel phases). HIGH (repo).
- `.planning/milestones/plugin-lifecycle-ROADMAP.md` ("Parallelism": the SUMMARY-collected CHANGELOG, decisions, and backlog lines), `plugin-lifecycle-phases/09-.../09-RESEARCH.md` §7 and `07-.../07-RESEARCH.md` (closed-set and catalog-counter conflicts), `01-.../01-RESEARCH.md` (cross-phase conflict list). HIGH (repo).
- `.planning/RETROSPECTIVE.md` (lifecycle-coverage: "Phases 2-15 in parallel after a shared-steps phase 1"; plugin-lifecycle: stale verification after later merges). HIGH (repo).
- Measurements on this branch, 2026-10-31: full cucumber run and Pi start, reset, and RSS per profile (scratch script built on `test/e2e/_rpc.ts`). HIGH for this machine; MEDIUM as a CI forecast.
- `npm view` on 2026-10-31: pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, @quintinshaw/pi-dynamic-workflows 3.15.0, @earendil-works/pi-coding-agent 1.4.0, with their peer ranges. MEDIUM (registry metadata; breaking changes not researched here).

---
*Architecture research for: component-features (component behavioral tests)*
*Researched: 2026-10-31*
