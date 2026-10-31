# Project Research Summary

**Project:** pi-claude-marketplace -- milestone `component-features` (Component Behavioral Tests)
**Domain:** Cucumber behavioral coverage of six bridged Claude plugin component kinds (skills, commands, agents, hooks, MCP servers, workflows) on a model-free headless Pi, plus a raise of Pi and its three companions to their latest releases
**Researched:** 2026-10-31
**Confidence:** MEDIUM-HIGH (stack and architecture HIGH; features MEDIUM-HIGH; a few runtime behaviors documented but not yet run)

## Executive Summary

This milestone adds no new product capability. It proves, through cucumber scenarios, that each bridged component kind looks to Pi and its companions the way Claude Code defines it after a real `/claude:plugin install`. Spike 028 showed this works without a real model. Pi's own faux provider (`@earendil-works/pi-ai/providers/faux`) scripts the model. A probe extension and RPC `get_commands` show what Pi registered. A hook recorder and a stub stdio MCP server log what the bridges launched. The workflow engine's `.events.jsonl` holds run results. Experts build this as a shared harness first, then independent per-kind suites. The harness must observe host-side stand-ins and never read back the script it wrote, or scenarios become tautological.

The recommended approach is one prerequisite phase (harness plus version raise), then six parallel component phases, each in its own worktree. Phase 1 owns every file that two component phases could both want. It lands each shared step together with one real seed scenario in the feature file of the phase that needs it, because `npm run check:features` fails on any step no scenario uses. Scenarios choose their Pi through a `Given` that starts a per-scenario "profile" Pi (scripted model, optional companions). The run's shared Pi stays as it is, with no model and no companions, so the existing 1,154 scenarios are untouched. Component phases never edit the shared prose files (`CHANGELOG.md`, README, PROJECT.md decisions, BACKLOG). Each phase writes its lines into its own SUMMARY.md, and the parent applies them at merge.

The main risks are three.

1. **The version raise.** pi-mcp-adapter 7.0.0 expands `${NAME:-default}` itself. Text the bridge writes as a literal, such as `${ANTHROPIC_API_KEY:-}` in an `oauth` value, therefore turns into the secret. `bridges/mcp/adapter-escape.ts` and the 462,790-value conformance property must be fixed and re-proved in Phase 1.
2. **Harness hazards.** RPC records are dropped outside a request. The faux queue is process-global. Resets leak. pi-subagents writes `/tmp/pi-subagents-*`. Project trust hides project-scope MCP servers and agents.
3. **Open parity decisions.** 33 decisions (FG-01..FG-33) must reach the user before the phases that pin those behaviors.

Mitigate by settling cross-kind decisions in a pre-fan-out gate, giving each remaining decision to its owning phase's discuss step, and never pinning a GAP behavior before it is licensed.

## Key Findings

### Recommended Stack

No new tool or framework. `@cucumber/cucumber` 13.3.0 is already latest. The only manifest addition beyond the floor raise is an exact devDependency on `@earendil-works/pi-ai` `1.4.0`. The harness imports `providers/faux` directly, and Pi's extension loader does not alias that subpath. Pi 1.3.0 to 1.4.0 breaks nothing this extension uses: the extension API types, RPC, skills, prompt templates and the faux `.d.ts` are byte-identical. Pi issue earendil-works/pi#10470 (duplicate `session_start` on RPC session switches) is still open, so keep SSDEDUP-01.

**Core technologies and floors (user decision: raise all in Phase 1):**

- `@earendil-works/pi-coding-agent` 1.4.0: dev `^1.4.0`, peer `>=1.4.0`. pi-subagents >=0.80 needs Pi >=1.2.0, and the suite proves only 1.4.0. `@earendil-works/pi-tui` dev `^1.4.0`.
- `@earendil-works/pi-ai` 1.4.0, exact devDependency (not `^`): the faux provider. The exact pin avoids a second top-level copy beside Pi's exact pin.
- `pi-mcp-adapter` `>=7.0.0 <8`: keep the major cap. 7.0.0 shows a major can change the interpolation passes the AVAR-03 escape depends on.
- `pi-subagents` `>=0.84.0`: fixes the background-agent blocker (chord and `pi-agent-core/node` are no longer required). It ships a `bundle/`, and `pi.extensions` is `./bundle/index.js`.
- `@quintinshaw/pi-dynamic-workflows` `>=3.15.0 <4`, new optional peer (`peerDependenciesMeta.optional`): the storage rule is byte-identical. It adds Pi-reserved-name refusal that bridged `plugin:name` names never hit.
- Companions stay out of `dependencies`, `devDependencies` and the lockfile (PIFL-02/03). `scripts/install-test-peers.mjs` gains the engine in `peerNames`, and its `--before` cutoff moves to 2026-10-29T05:33Z.

**Must-know breaking changes the raise absorbs:**

- pi-mcp-adapter 7.0.0 `${VAR:-default}` expansion (security). Widen the `TRIGGER` regex in `adapter-escape.ts` to `\$(?=\{\w+(?:\}|:-))`. Re-prove the AVAR-05 partial-trigger analysis with `:-` tokens. Update the conformance needle and recompute `EXPECTED_CHECKED_VALUES`.
- `ServerEntry` gains `appendStructuredContent` and `roots`. Decide whether they join `CARRIED_FIELDS`.
- 6.0.0 registers every cached MCP tool as a deferred `mcp__<server>__<tool>`. Assert exact names, never counts. Nested `mcp({tool,args})` calls now fire Pi `tool_call` hooks under the real tool name, so a match-all PreToolUse hook fires twice per proxy call.
- Four tests pin old floors and must move: `test/integration/adapter-expansion-conformance.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `test/architecture/peer-floor.test.ts`, and `test/e2e/pi-json-output.test.ts` plus `test/e2e/pi-peer-floor/**`.
- Docs, README (and `README.es.md`), `AGENTS.md` and `.planning/codebase/STACK.md` carry version text.
- The CI `behavioral` job never runs `install-test-peers.mjs` and must.
- Load companions through their manifest `pi.extensions` entry, never a hard-coded path.

### Expected Features

Observation tiers:

- MF: model-free (`get_commands`, probe, recorder, stub log, events file).
- FX: needs a faux-model turn.
- RM: needs a real model, out of scope.
- TUI: only the interactive TUI shows it.

FEATURES.md has per-kind contract tables (S, C, A, H, M, W rows). They give upstream behavior, extension behavior and disposition (MATCH, DIV(id), PIGAP, GAP, CONTRA, EDGE, BUG).

**Must have (table stakes, every component phase):**

- Listing and naming per kind, model-free.
- Frontmatter and field variants per kind (pin each MATCH and each DIV).
- Invocation through the faux model: what reaches the model matches upstream.
- Companion-missing degradation for agents, MCP and workflows: `{requires ...}`, and recovery by loading the companion then `/reload`, with no reinstall.
- Removal and replacement through uninstall, disable, enable and update, observed on a new session.
- Hook parity fixes (`new` to `clear`, `compact`, `fork`) and the FG-19 exec-form `${CLAUDE_PLUGIN_ROOT}` BUG fix.

**Should have (differentiators):**

- Tool-use hooks driven by scripted faux tool calls (PreToolUse/PostToolUse exit codes and JSON decisions).
- Agent runs with the child's system prompt recorded (`async: false`).
- MCP calls through the adapter `mcp` proxy, logged by the stub.
- Workflow runs read from `.events.jsonl`.
- Cross-kind scenarios: a hook on a plugin MCP tool, an agent granted a plugin MCP tool, an agent preloading a skill. Each is assigned to exactly one phase and built from Phase 1 stand-ins.

**Defer (later milestone with a real provider):**

- Model auto-selection of skills and agents, commands through the Skill tool (FG-11 proof), and workflows whose scripts call `agent()`.
- Async (`async: true`) agent runs until proven on 0.84 in the harness.
- Remote MCP OAuth end to end.
- StopFailure, if the faux provider cannot end a turn in error.

**Anti-features:** asserting files the bridge wrote; pinning a GAP behavior before the user decides; loading the faux provider or companions into the run's shared Pi.

### Architecture Approach

A profile Pi is chosen by a `Given`, not a tag (the feature gate rejects new tags). It runs the real extension plus a scripted-model extension, a probe extension, and optionally the three companions. The scripted model reads its script from a sandbox file. It derives the step index from its own call-log length, so the script, counter and logs reset with the sandbox. A model-turn `When` waits for `agent_settled` (not the first `agent_end`). It stores one `lastTurn` record on the world: custom entries, tool events, model calls, the hook-recorder slice, the MCP stub slice and the probe snapshot. Kind phases therefore never touch `features/support/world.ts` (597 lines, the most conflict-prone file). Pi extensions live under `features/lib/`, never `support/`, because cucumber imports `support/**` into every worker.

**Major components (all Phase 1):**

1. Profile Pi (`world.usePiWithProfile`, `startRpcPi` extra extensions and typed extra env): a per-scenario second Pi. Stopping its process group kills MCP stubs, workflow runs and async agents.
2. Scripted model (`features/lib/scripted-model/{extension,script,calls}.ts`): faux provider with a whole-value call log.
3. Registry probe (`features/lib/pi-registry-probe/*`): `getAllTools`, `getActiveTools` and `getCommands` as a custom entry.
4. Hook recorder, MCP stub server (`.ts`, dependency-free stdio JSON-RPC), companion resolver (`features/lib/companions.ts`), run tokens (`{mcp stub server}`, `{hook recorder}`), and a generic `has the file "<path>" with this text:` step.
5. Per-kind fixture writers and first topic step modules, each carrying one seed scenario.

### Critical Pitfalls

1. **Faux model or companions on the run's shared Pi.** This breaks `sendMessage` refusal checks, the reset's empty-skills assertion and `{requires ...}` rows, in random order. Use a profile Pi, and never `set_model` on the shared Pi.
2. **The RPC driver drops records outside an in-flight request.** `handleLine` returns when `pending` is undefined. That loses `agent_settled`, tool events and `pi-dynamic-workflows:progress` entries, and `idle` ignores a running turn. Keep an always-on per-scenario record log, read the `prompt` `disposition`, wait for `agent_settled` with `aborted: false`, and use no fixed sleeps.
3. **The faux queue is one per process, and the spike's "done" fallback hides short scripts.** Use no fallback. Arm the script per scenario. Assert `getPendingResponseCount() === 0`. Write a child agent's steps into the same ordered table.
4. **Tautological faux scenarios.** Every `Then` reads a host-side stand-in (recorder, stub log, model call log, probe) and compares whole values. Expected names are literals in the feature file, and each kind has at least one negative control. Record red proofs before product fixes.
5. **Reset leaks, hermeticity, project trust.** Set `TMPDIR` under the run root, because pi-subagents writes `/tmp/pi-subagents-*`. Use per-scenario recorder directories and clean-state assertions in the profile reset. Use a stdio-`node` stub only (no `npx`/`http`). Make an explicit trust decision (`projectServers: "allow"`, Pi project trust) and add an untrusted-project scenario beside it. The adapter and pi-subagents skip unapproved project resources in RPC.
6. **Version-raise pins live in many places (Pitfall 9 table).** Pitfall 12 adds that the hooks `new` to `clear` change breaks `features/plugin/session-start-hooks.feature` and the unit tests. SSDEDUP-01's `<sessionId>\0<reason>` key also drops the second compaction.
7. **Parallel collisions on shared product files.** The shared files are the reason unions, the catalog counters, `soft-dep.ts`, `domain/name.ts`, and the reviewed clone pairs that carry `fallow-ignore-next-line code-duplication` markers. Prefer existing reasons. Edit only your own arm. Rerun `npx fallow dupes` after the second merge.

## Implications for Roadmap

### Recommended phase graph

```text
Pre-fan-out gate (inside Phase 1 discuss): cross-kind user decisions
        |
Phase 1  Harness and version raise  -- the ONLY prerequisite
        |  merges to the milestone branch
        +--> Phase 2 Skills        -+
        +--> Phase 3 Commands       |
        +--> Phase 4 Agents         |  six independent sessions/worktrees,
        +--> Phase 5 Hooks          |  branched from the milestone branch after Phase 1
        +--> Phase 6 MCP servers    |  each split into parallel executor waves
        +--> Phase 7 Workflows     -+
                 |
        (optional) Phase 8 Suite close -- only if the parent does not apply collected lines at each merge
```

Phases 2-7 depend on Phase 1 only, and no component phase depends on another. A cross-kind scenario is owned by exactly one phase. It is built from Phase 1 stand-ins and never from another phase's lib file.

### Phase 1: Harness and version raise

**Rationale:** Every component phase needs the faux model, the profile Pi, companions at the new floors and the shared steps. The version raise edits single shared files and must be proven by the harness seeds.

**Delivers:**

- The floors raised and the adapter 7.x escape fix.
- The profile Pi, scripted model, probe, hook recorder, MCP stub, companion resolver, run tokens, generic file step, model-turn `When` and `lastTurn` on the world.
- One seed scenario per kind.
- CI changes (`install-test-peers`, shard, timeouts) and updated cucumber skill rules.

**Addresses:** table-stakes infrastructure for all kinds.
**Avoids:** Pitfalls 1-6, 8, 9, 10, 14.

Internal waves (plans within a wave own disjoint files):

| Wave | Plan | Owns | Seed |
|------|------|------|------|
| 1 | 01-01 Version raise | `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs`, `scripts/pi.sh`, `test/e2e/pi-peer-floor/**`, pinned `test/integration/**` tests, `test/architecture/peer-floor.test.ts`, `bridges/mcp/adapter-escape.ts` and `adapter-entry.ts` (+ comment anchors in `adapter-doc.ts`, `platform/mcp-status.ts`, `platform/workflow-home.ts`), `platform/pi-api.ts` (widen every Pi event and API type any kind needs: `session_compact`, `new`/`fork` reasons), README and `README.es.md` version lines, `*-compatibility.md` version lines, `AGENTS.md`, `.planning/codebase/STACK.md`, `CHANGELOG.md` | none |
| 1 | 01-02 Ownership rules | `.agents/skills/cucumber/rules/layout.md` ("Parallel work": this milestone's table and reserved module names), `world-and-stand-ins.md` (profile Pi, scripted model, recorder, stub rules) | none |
| 2 | 01-03 Tracer | `test/e2e/_rpc.ts` (`startRpcPi` extra extensions, typed extra env, `TMPDIR`), `test/architecture/hermetic-git-environment.test.ts`, `features/lib/pi-process.ts` (always-on record log, `agent_settled`, `idle`), `features/lib/scripted-model/*`, `features/lib/companions.ts`, `features/lib/run-tokens.ts`, `features/support/world.ts`, `step_definitions/{model,companion}.steps.ts`, `plugin/publishing.steps.ts` (generic file step), `session.steps.ts` (prompt `When`), `.github/workflows/ci.yml` (peer install, timeout) | `features/skill/invocation.feature` |
| 3 | 01-04 Probe | `lib/pi-registry-probe/*`, `lib/slash-command-files.ts`, `step_definitions/slash-command/listing.steps.ts` | `features/slash-command/listing.feature` |
| 3 | 01-05 Hook recorder | `lib/hook-recorder.ts`, `lib/hook-files.ts`, `step_definitions/hook/runs.steps.ts` | `features/hook/tool-use.feature` |
| 3 | 01-06 MCP stub | `lib/mcp-stub-server.ts`, `lib/mcp-server-files.ts`, `step_definitions/mcp-server/calls.steps.ts` | `features/mcp-server/invocation.feature` |
| 3 | 01-07 Agents | `lib/agent-files.ts`, `step_definitions/agent/runs.steps.ts` | `features/agent/invocation.feature` |
| 3 | 01-08 Workflows | `lib/workflow-files.ts`, `step_definitions/workflow/runs.steps.ts` | `features/workflow/run.feature` |
| 4 | 01-09 Phase gate | measure combined cucumber time, set CI shard and timeouts, `npm run check`, run the e2e floor test locally once | none |

01-01 must finish before 01-03. The faux import needs `pi-ai` in `package.json`, and the companion profile needs the engine in the peer cache. Wave 3 works only because wave 2 put every shared registration in place. If 01-01 grows because adapter 7.x needs larger `bridges/mcp` work, split it into a wave-1 raise plus file-disjoint per-companion fix plans.

### What Phase 1 must pre-create so component phases only add files

- **Shared, frozen after Phase 1 (component phases never edit):**
  - `features/support/world.ts` (profile Pi, `lastTurn`, uncompared-turn marker) and `features/support/pi-process.ts`.
  - `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace}.ts`.
  - `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs` and `.agents/skills/cucumber/**`.
  - The shared step modules: `command`, `session`, `config`, `git-host`, `mcp-configuration`, `model`, `companion`, `plugin/publishing`, `marketplace/publishing`.
  - `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs`, `.github/workflows/ci.yml` and `platform/pi-api.ts`.
- **Directories and modules created with a seed, then handed over:**
  - `features/{skill,slash-command,agent,hook,mcp-server,workflow}/`.
  - `features/step_definitions/<kind>/<topic>.steps.ts` for each kind.
  - `features/lib/<kind>-files.ts` for each kind.
  - `lib/scripted-model/*`, `lib/pi-registry-probe/*`, `lib/hook-recorder.ts`, `lib/mcp-stub-server.ts` and `lib/companions.ts`.
- **Function directory names fixed in Phase 1** (every later scenario title depends on them): `skill`, `slash-command` (not `command`, which `command.steps.ts` already means), `agent`, `hook`, `mcp-server` (not `mcp`), `workflow`. Any phase that adds a parameter type prefixes its name with its kind.
- **Generic readers** (JSONL log slicing, table projection) in lib, so phases never copy them. `fallow dupes` fails on any clone group across `features/`.
- **Widened Pi types** for every event any kind needs, so Phase 5 does not edit `platform/pi-api.ts`.
- **A reset contract** for the profile Pi:
  - Wait for the settled turn, then stop any runs.
  - Assert the baseline commands, tools and skills.
  - Assert an empty faux queue and no live stub process.
  - Assert an empty recorder directory and no new `/tmp/pi-subagents-*`.
- **Decisions recorded** (see Open decisions, Phase 1): trust setup, directory names, and IDs for the four 2026-10-31 decisions.

### Phase 2: Skills

**Rationale:** Independent; touches `bridges/skills/*` only.
**Delivers:** listing and naming, frontmatter, invocation (`<skill>` block, path variables, same-plugin rewrite), collisions and lifecycle. It records `user-invocable: false` as a Pi-gap divergence and reports it to Pi. The `/plugin:skill` alias is tested via the TUI driver.
**Addresses:** S1-S17.
**Avoids:** Pitfalls 4, 13.
**Owns:** `features/skill/**`, `step_definitions/skill/**`, `lib/skill-files.ts`, `bridges/skills/**`, `edge/skill-aliases.ts`, and the unit and integration tests for skills.

### Phase 3: Slash commands

**Rationale:** Independent; touches `bridges/commands/*`.
**Delivers:** listing (source `prompt`), nested namespacing, arguments (`$ARGUMENTS`, positional, quoting), content (variables, rewrites) and lifecycle.
**Addresses:** C1-C17. The largest real-plugin impact is FG-01..FG-05.
**Avoids:** Pitfall 13 (pinning a GAP before the user decides).
**Owns:** `features/slash-command/**`, `step_definitions/slash-command/**`, `lib/slash-command-files.ts`, `bridges/commands/**`.

### Phase 4: Agents

**Rationale:** Independent; needs pi-subagents 0.84 from Phase 1.

**Delivers:**

- `subagent {action:"list"}` rows.
- Conversion: tools, `excludeTools`, model with and without `--map-model`, effort, dropped fields.
- Foreground runs (`async: false`) proving the child's system prompt and tool list.
- Skill preload, companion-missing and lifecycle scenarios.

**Avoids:** Pitfalls 3, 6, 7 (project agent trust).
**Owns:** `features/agent/**`, `step_definitions/agent/**`, `lib/agent-files.ts`, `bridges/agents/**`, `persistence/agents-index-*`.

### Phase 5: Hooks

**Rationale:** Independent but the heaviest product change. Wave 1 is the parity fixes. Wave 2 covers tool-use, prompt, stop, process and configuration.

**Delivers:**

- `new` sent as `clear` in SessionStart and SessionEnd.
- SessionStart `compact` on `session_compact`.
- `clear`, `compact` and `fork` matchers admitted.
- The FG-19 exec-form substitution fix and the two-compaction dedupe fix.
- A migrated `features/plugin/session-start-hooks.feature`.

**Avoids:** Pitfall 12.
**Owns:** `features/hook/**`, `features/plugin/session-start-hooks.feature`, `step_definitions/hook/**`, `step_definitions/plugin/session-start-hooks.steps.ts`, `lib/hook-files.ts`, `bridges/hooks/**` (one plan per wave owns `event-router.ts`), `domain/components/hook-*.ts` and `hooks*`, `test/architecture/hooks-*.test.ts`, `docs/hooks-compatibility.md`.

### Phase 6: MCP servers

**Rationale:** Independent; continues from Phase 1's 7.x escape fix.

**Delivers:**

- Connection and naming (`mcp__plugin_<p>_<s>__<tool>`, stub log `initialize`/`tools/list`).
- Tool calls through the `mcp` proxy.
- Remote servers (loopback only) and configuration variants.
- Companion-missing, project scope under the harness trust setting, and lifecycle.

**Avoids:** Pitfalls 7, 8.
**Owns:** `features/mcp-server/**`, `step_definitions/mcp-server/**`, `lib/mcp-server-files.ts`, `bridges/mcp/**`, `platform/mcp-status.ts`, `domain/mcp-resolution.ts`, `domain/components/mcp.ts`, `docs/mcp-compatibility.md`.

### Phase 7: Workflows

**Rationale:** Independent; standard after spike 028.

**Delivers:**

- `/<plugin>:<meta.name>` registration and refusals.
- Runs read from `.events.jsonl` (`{_, _raw, k=v}`).
- Engine-missing at warning and info severities.
- Lifecycle, including the WLIF-06 lingering-command notice.

Scripts that call `agent()` are out of scope.

**Owns:** `features/workflow/**`, `step_definitions/workflow/**`, `lib/workflow-files.ts`, `bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts`, `docs/workflows-compatibility.md`.

### Phase 8 (optional): Suite close

Only needed if the parent does not apply the collected CHANGELOG/README/README.es/PROJECT/BACKLOG lines at each merge. Otherwise limit it to:

- Promoting any step two phases each defined into a topic module.
- Tuning CI shards on the measured combined run.
- Re-verifying every phase a later merge touched, and the milestone audit.

I recommend the parent applies lines at each merge and Phase 8 stays a thin close-out.

### Component phase wave template (phases 2-7)

| Wave | Plan | Feature file | Step module |
|------|------|--------------|-------------|
| 1 | Tracer: listing and naming | `features/<kind>/listing.feature` | `<kind>/<topic>.steps.ts` (shared kind steps defined here only) |
| 2 | Frontmatter and field variants | `frontmatter.feature` | `<kind>/frontmatter.steps.ts` |
| 2 | Invocation through the scripted model | `invocation.feature` | `<kind>/invocation.steps.ts` |
| 2 | Companion-missing (agents/MCP/workflows) or collisions (skills/commands) | `companion-missing.feature` / `collisions.feature` | `<kind>/companion-missing.steps.ts` |
| 2 | Removal and replacement | `lifecycle.feature` | `<kind>/lifecycle.steps.ts` |
| 3 | Decisions, docs, SUMMARY lines, phase gate | none | none |

A step that two wave-2 plans both need moves to wave 1 or to a follow-up commit. A plan never edits a sibling plan's step module. If a fix needs a file that a same-wave plan owns, the second fix moves to the next wave. Iterate with `npx cucumber-js features/<kind>` and run `npm run check` only at gates.

### File ownership at a glance

| Phase | Feature files | Step modules | Lib | Product |
|-------|---------------|--------------|-----|---------|
| 1 | six seeds | shared + first topic module per kind | harness libs | version-raise fixes, `platform/pi-api.ts` |
| 2 | `features/skill/**` | `skill/**` | `skill-files.ts` | `bridges/skills/**` |
| 3 | `features/slash-command/**` | `slash-command/**` | `slash-command-files.ts` | `bridges/commands/**` |
| 4 | `features/agent/**` | `agent/**` | `agent-files.ts` | `bridges/agents/**`, `persistence/agents-index-*` |
| 5 | `features/hook/**`, `features/plugin/session-start-hooks.feature` | `hook/**`, `plugin/session-start-hooks.steps.ts` | `hook-files.ts` | `bridges/hooks/**`, `domain/components/hook*` |
| 6 | `features/mcp-server/**` | `mcp-server/**` | `mcp-server-files.ts` | `bridges/mcp/**`, `platform/mcp-status.ts`, `domain/mcp-resolution.ts` |
| 7 | `features/workflow/**` | `workflow/**` | `workflow-files.ts` | `bridges/workflows/**`, `platform/workflow-home.ts` |

Each phase also owns its kind's unit tests (`test/bridges/<kind>/**`) and integration tests (`test/integration/<kind>-*`).

### Collision rules for the parallel fan-out

- **Never edited by a component phase:** `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md` Key Decisions, `.planning/BACKLOG.md`. Each phase lists its lines in its SUMMARY.md and the parent applies them at merge. ROADMAP, STATE, REQUIREMENTS and WINDOWS are tool-written. For end-of-file append conflicts, keep both sides, and prefix WINDOWS descriptions with `[component-features]`.
- **Append-only closed sets:**
  - `shared/notification-types.ts` `Reason` union, `notification-wire.ts` `REASONS`, `notify-reasons.ts`, `schema/claude-plugin.schema.json`.
  - `notify-closed-set-locks.test.ts` (78-entry count), `compat-01-no-expansion.test.ts`, `docs/json-output.md`.
  - Catalog counters: `docs/output-catalog.md`, `EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_615`.

  Prefer existing reasons. A new reason lands as its own commit, and the later merge keeps both entries and fixes the count.
- **`shared/concerns/soft-dep.ts`:** each phase edits only its own companion's arm.
- **Reviewed clone pairs** across `bridges/{skills,commands,agents}/stage.ts` and their siblings carry `fallow-ignore-next-line code-duplication` in both copies. Changing one side can break the other's marker, and that shows only in the combined tree. Rerun `npx fallow dupes` after the second merge.
- **`domain/name.ts`:** edit only the kind's own function.
- **Orchestrators** (`uninstall.ts`, `enable-disable.ts`, `update-flow.ts`, `install-outcome.ts`, `*.messaging.ts`): a phase that finds a bug there keeps the fix minimal and inside its own function. Earlier milestones produced stale verifications after exactly these merges, so re-verify a phase after any merge that touches its files.
- **Suggested merge order, lowest conflict first:** 7 Workflows, 6 MCP, 4 Agents, 2 Skills, 3 Commands, 5 Hooks. Hooks goes last because it rewrites an existing plugin-function feature and touches the router.

### Phase Ordering Rationale

- Phase 1 comes first because the version raise edits single shared files and the companions depend on the host version. The 5.2-pinned integration tests would also turn `npm run check` red at every later merge gate.
- The six kinds run in parallel because the bridges are separate fallow zones. Phase 1's seed-and-hand-over rule gives each kind a disjoint tree.
- Cross-kind decisions (argument syntax, injection, replace-vs-union, description fallback) are settled before fan-out, so Skills and Commands, and Commands, Agents and Workflows, cannot diverge.
- CI is sharded by path (lifecycle shard, components shard), not by tag, because the gate rejects tags outside `Examples:` blocks. About 300-400 new scenarios add roughly 3-7 minutes of wall time to today's 2-minute suite. The current 10-minute `behavioral` timeout does not hold that safely.

### Research Flags

Phases needing `/gsd-plan-phase --research-phase`:

- **Phase 1:**
  - The adapter 7.x `:-` design: keep the default resolved at install, or leave it to the adapter at connect time.
  - The nested `mcp` proxy double-fire.
  - Whether a pi-subagents background child loads an extension passed by `--extension` (MEDIUM, undocumented).
  - The CI timing measurement.
- **Phase 4 (Agents):** the pi-subagents 0.84 parser against the bridge's emitted frontmatter, project-agent trust, and any `async: true` proof.
- **Phase 5 (Hooks):** a binary check of the PostCompact versus SessionStart `compact` order and the SessionEnd reason set, plus user answers (FG-20, FG-21).
- **Phase 6 (MCP):** `claude-code-compat-research` on plugin MCP servers versus project approval and on `${VAR:-default}`, and a re-measure of every MCP doc row on adapter 7.x (FG-30).

Standard patterns (skip research):

- **Phase 2 (Skills) and Phase 3 (Commands):** well covered by FEATURES.md. Decisions, not research, are the work.
- **Phase 7 (Workflows):** standard after spike 028. Confirm the progress-entry shape against the 3.15 source.

## Open decisions (deduplicated, grouped by owning phase)

Each phase's discuss step settles its own list. Items marked **pre-fan-out** span more than one parallel phase. They should be settled once, during Phase 1's discuss step, so parallel sessions cannot diverge. Unlicensed gaps go to the user, and no scenario may pin one until it is decided. Upstream evidence for each is in FEATURES.md (ID, evidence tag, confidence).

### Already decided (carry forward, no further question)

- Raise to Pi 1.4.0, pi-mcp-adapter `>=7 <8`, pi-subagents `>=0.84`, `@quintinshaw/pi-dynamic-workflows >=3.15` (new optional peer) and `@earendil-works/pi-ai` as a dev dependency. The Pi peer floor is `>=1.4.0`.
- Hooks: Pi `new` becomes `clear` in SessionStart and SessionEnd. `compact` fires SessionStart on `session_compact`. `clear`, `compact` and `fork` matchers are admitted. `user-invocable: false` is recorded as a Pi-gap divergence.
- Out of scope: anything needing a real model.

### Pre-fan-out gate (settle in Phase 1 discuss; cross-phase)

- **FG-33 (all):** assign IDs to the four 2026-10-31 decisions (`user-invocable`, `compact`, `fork`, `new`->`clear`). Skills and Commands cite them.
- **FG-01 (commands; same pattern in skills):** positional arguments are 0-based upstream (`$0` is first) and 1-based in Pi. Rewrite placeholders at install time, or record a Pi-gap divergence?
- **FG-02 (commands, skills):** append `ARGUMENTS: $ARGUMENTS` at install to bodies with no placeholder, or record a divergence?
- **FG-03 (commands, skills):** which other forms to translate. The forms are `$ARGUMENTS[N]`, named `$name`, `\$`, `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}`. Pi-only `${1:-x}`, `$@` and `${@:N}` expand under Pi but stay literal upstream. Record the rest as divergences.
- **FG-04 (skills):** transform `/skill:` arguments in the existing `input` handler (`edge/skill-aliases.ts`), or record a Pi gap?
- **FG-05 (skills, commands):** `` !`cmd` `` and fenced `!` blocks never run. Implement them (an input transform plus a spawn chokepoint, with a security review), or record a Pi gap? This has the highest real-plugin impact.
- **FG-06 (skills, commands):** the description fallback contradicts upstream, which uses the first non-empty line with hashes stripped and a cut at 100. Re-align skills. Synthesize a command `description` at install so Pi's 60-char rule never applies?
- **FG-10 (skills, commands):** frontmatter fields are dropped silently: `allowed-tools`, `disallowed-tools`, `model`, `effort`, `agent`, `background`, `hooks`, `paths`, `shell`, `arguments`, `context: fork`. License them with one divergence ID tied to the Pi gap. Should install warn per field as agents do?
- **FG-14 (commands, agents, workflows):** upstream replaces the default directory for `commands`, `agents` and `workflows`, and adds for `skills`. D-07 unions all of them, and the PROJECT.md "Out of Scope" bullet contradicts D-07. Confirm D-07, fix the PROJECT.md bullet, and pin the union.
- **Project trust setup (agents, MCP; FG-29 + Pitfall 7):** how the profile Pi trusts its project (`--approve`, a sandbox `trust.json`, or `defaultProjectTrust: "always"`), plus `settings.projectServers: "allow"`. It applies to the profile Pi only, with an untrusted-project scenario beside it.
- **Function directory names:** confirm `skill`, `slash-command`, `agent`, `hook`, `mcp-server`, `workflow`.

### Phase 1 (harness and version raise)

- **Adapter 7.x `${VAR:-default}`:** keep resolving defaults at install and escape the `:-` form in literals, or leave `${NAME:-default}` as a runtime reference for the adapter? The second matches Claude's connect-time resolution. Deny-listed names stay decided at install (AVAR-05). Either way it needs a recorded decision.
- **New adapter keys:** whether `appendStructuredContent` and `roots` join `CARRIED_FIELDS`. They are user choices with no Claude field, and carrying them matches AFILE-06.
- **Profile Pi shape:** per scenario (architecture, measured 1.6-1.7 s warm) or a lazily started long-lived companion Pi per worker (pitfalls). This synthesis recommends per scenario, and pooling later only if CI time requires it.
- **CI shape:** a path-sharded `behavioral` matrix (lifecycle and components) with 15-minute timeouts, the peer install step, and whether to serialize companion scenarios.
- **Harness mechanics:**
  - The hook recorder and stub are `.ts` files under `features/lib/`.
  - Script file under sandbox HOME versus `setResponses()` arming.
  - No fallback reply.

### Phase 2 (skills)

- **FG-07:** derive the generated name from frontmatter `name` when present (upstream, MEDIUM). Verify first with `claude plugin details`.
- **FG-08:** a skill and a command clash on one qualified name. Upstream says the skill wins, but SK-6 gives the command priority. Probe upstream with one plugin, then decide.
- **FG-09:** the `/plugin:skill` alias works only in interactive input. Accept that and test it through the TUI, or extend it to RPC?
- Name and record the `user-invocable: false` divergence ID, and report the gap to Pi.

### Phase 3 (commands)

- **FG-11:** commands are model-invocable upstream (merged into skills), while Pi prompt templates are user-only. Record a Pi gap, or also stage commands as skills?
- **FG-12:** extend the `user-invocable: false` divergence ID to commands.
- **FG-13:** the object-map `commands` form makes the plugin unavailable today. Support it (`content` needs a synthesized file), or record an unsupported form?
- The pre-fan-out items FG-01..FG-06, FG-10 and FG-14 apply here too.

### Phase 4 (agents)

- **FG-15:** nested `agents/x/y.md` is ignored, and upstream names it `plugin:x:y`. Recurse and colon-join, as CM-4 does for commands?
- **FG-16:** preloading a `disable-model-invocation` skill. Upstream refuses it. Skip it and warn?
- **FG-17:** map `background`->`async` and `memory`->`memory` (pi-subagents near-analogs). Record the rest: `maxTurns`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow`, `initialPrompt`.
- **FG-18:** refresh the `--map-model` table: add `fable`, pass full `claude-*` IDs, retarget the aliases?
- **Async runs:** whether any `async: true` scenario ships. It needs proof that a background child loads the faux provider extension. Otherwise record it as a gap.
- **Same-name priority:** cross-plugin and user-agent same-name priority is not modeled (A15 EDGE).

### Phase 5 (hooks)

- **FG-20:** SessionEnd reason mapping beyond `new`->`clear`. The upstream closed set is `clear`, `resume`, `logout`, `prompt_input_exit`, `other`. Map `quit`->`prompt_input_exit` and `reload`/`fork`->`other`? Which SessionEnd matchers to admit (the closed set is empty today)?
- **FG-21:** SessionStart on Pi `reload`: send `startup`, suppress it, or keep `reload` as a Pi-gap divergence?
- **FG-22:** implement `once: true` and `onFailure: "continue"|"block"`, or record them?
- **FG-23:** record `DirectoryAdded`. Correct either PROJECT.md ("silently dropped, debug-logged only") or the code (everything non-admitted is `{unsupported hooks}`).
- **FG-24:** the manifest `hooks` field (path, array, inline object) is never installed. Implement the merge, or classify it unsupported so it is not silent?
- **FG-26:** surface hook `systemMessage` through the notify chokepoint, or keep dropping it?
- **Compaction order:** PostCompact versus SessionStart `compact` on one `session_compact`. Check the 2.1.316 binary.
- **Dedupe key:** change SSDEDUP-01 so only the duplicate bind of one Pi event (pi#10470) drops. Two compactions in one session must give two records.
- **Install outcomes:** a plugin that needed `--partial` for a `clear`, `compact` or `fork` matcher now installs whole, while existing installs keep the dropped hook. Report this in `pending`/`apply`? Record it in the CHANGELOG.
- **Proxy double fire:** a match-all PreToolUse hook fires twice on `mcp` proxy calls (the outer `mcp` event plus the nested real name). Decide what to do with the outer event.
- **Fixes with no question:**
  - FG-19: exec-form `${CLAUDE_PLUGIN_ROOT}` substitution (BUG).
  - FG-25: docs drift in `docs/hooks-compatibility.md` and the `hook-events.ts` header, fixed and pinned by a scenario.
  - H7: `additionalContext` on every event is a divergence with no ID. Record one.

### Phase 6 (MCP servers)

- **FG-27:** MC-1 picks the first source (entry > manifest > `.mcp.json`). Upstream merges, and later declarations replace earlier ones. Re-decide for parity, or record it with an ID.
- **FG-28:** one malformed server makes the whole plugin `(unavailable) {malformed mcp}`, while upstream skips only that server. Confirm the license ID, or align.
- **FG-29 / Pitfall 7:** project-scope plugin MCP servers are treated by the adapter as unapproved project servers (skipped in RPC, a prompt in the TUI). Upstream starts plugin servers without approval (MEDIUM, verify). Is this a divergence with a Pi or companion-gap license, or a product fix?
- **FG-30:** re-measure every MCP doc row (measured on 5.0/5.2) on adapter 7.x, and fix any break in-phase.
- Fixtures avoid `protocolVersion: "auto"`, `npx`, and `http` without a loopback stand-in.

### Phase 7 (workflows)

- **FG-31:** record "no run approval" (upstream asks before running a plugin workflow) as a Pi-gap divergence with an ID.
- **FG-32:** accept the engine's `{_, _raw, key=value}` argument shape (no upstream position) and pin it.
- Fixture workflows must not be named after Pi reserved commands (`new`, `compact`, ...). Scripts use a statement body ending in `return`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, dates and every breaking change were read from published tarballs and a probe against the bridge's own `serializeLiteral`. MEDIUM only for nested MCP tool calls firing Pi `tool_call` and for which extensions a pi-subagents background child loads (documented, not run). The pi#10470 state is LOW from WebFetch but confirmed by the unchanged `rpc-mode.js` in 1.4.0. |
| Features | MEDIUM-HIGH | HIGH where the 2.1.316 binary was grepped and extension code read. MEDIUM where only docs state upstream behavior (FG-07, FG-08, FG-15..FG-18, FG-28, FG-32). The 33 open decisions bound how much of each kind is pinnable. |
| Architecture | HIGH | Layout, gates (`check-features.mjs`) and ownership hazards were read from this branch and two prior parallel milestones. Timings were measured on 4 cores. The CI time estimate for 300-400 new scenarios is MEDIUM (extrapolation). |
| Pitfalls | HIGH | Mostly this tree's source and companion tarballs. The claim that Claude Code starts plugin MCP servers without a project-approval prompt is MEDIUM. Hook doc facts agree with the binary grep. |

**Overall confidence:** MEDIUM-HIGH.

### Gaps to Address

- **Research disagreement:** ARCHITECTURE.md recommends a per-scenario profile Pi and PITFALLS.md recommends a lazily started long-lived companion Pi per worker. This summary resolves it in favor of per-scenario (free total reset, measured 1.6-1.7 s), keeping PITFALLS.md's reset assertions as the reset contract. Confirm in Phase 1 discuss.
- **Background child and the faux provider:** does an extension given by `--extension` count as ambient for a detached pi-subagents runner? Test it in Phase 1 research, or keep `async: false` and record the gap.
- **Proxy double fire:** whether the nested `mcp` proxy double-fire needs a hooks decision (Phase 5) and a harness assertion rule (Phase 1).
- **Unknown upstream behavior:** SessionStart on reload, SessionEnd for `quit`/`reload`/`fork`, and PostCompact order. Check the binary. The answers go to the user as one batch.
- **CI baseline:** no wall-clock baseline exists. Phase 1 measures it and sets shard and timeouts.
- **Stale installed hooks:** existing installs keep dropped `clear`/`compact`/`fork` hooks until update or reinstall (Phase 5).
- **Live upstream probes:** the skill-versus-command clash and frontmatter `name` need a live upstream probe before deciding (Phase 2).

## Sources

### Primary (HIGH confidence)

- npm registry (`npm view`, 2026-10-31) and unpacked tarballs of `pi-mcp-adapter` 5.2.0/6.0.0/7.0.0, `pi-subagents` 0.74.0/0.84.0, `@quintinshaw/pi-dynamic-workflows` 3.14.0/3.15.0, `@earendil-works/pi-coding-agent` 1.3.0/1.4.0 and `@earendil-works/pi-ai` 1.4.0. These gave changelogs, types, loaders, runners and the faux provider.
- Claude Code 2.1.316 binary (`/opt/claude-code/bin/claude`) grep: skill and agent schemas, argument substitution, description fallback, hook event tuple, SessionStart/SessionEnd enums and MCP server schemas.
- Repo: `.agents/skills/cucumber/**`, `scripts/check-features.mjs`, `features/**`, `test/e2e/_rpc.ts`, `.github/workflows/ci.yml`, `scripts/install-test-peers.mjs`, `eslint.config.js`, `.fallowrc.json`, bridge/platform/domain sources, `docs/*-compatibility.md`, `.planning/spikes/028-model-free-harness/`.
- Prior milestones: lifecycle-coverage and plugin-lifecycle ROADMAP, RESEARCH, VERIFICATION and RETROSPECTIVE (parallel-phase collision evidence and the seed rule).

### Secondary (MEDIUM confidence)

- code.claude.com docs for skills, sub-agents, plugins-reference, workflows and hooks (retrieved 2026-10-31). They agree with the binary on every checked value.
- Measurements on this branch: full cucumber run 2 min 0 s, and Pi start and RSS per profile.

### Tertiary (LOW confidence, needs validation)

- earendil-works/pi#10470 GitHub state (WebFetch), independently supported by the unchanged Pi 1.4.0 `rpc-mode.js`.
- Claude Code's handling of plugin MCP servers versus project approval (verify with `claude-code-compat-research`).

---

*Research completed: 2026-10-31*
*Ready for roadmap: yes*
