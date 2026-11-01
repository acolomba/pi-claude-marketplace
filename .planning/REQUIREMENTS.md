# Requirements: pi-claude-marketplace — component-features

**Defined:** 2026-10-31
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Milestone goal:** The cucumber suite checks every bridged component kind -- skills, commands, agents, hooks, MCP servers, workflows -- as Pi and its companion extensions see it after a real `/claude:plugin install`, with Claude Code's component behavior as the reference and no authenticated LLM.

Each behavior requirement is met by at least one scenario under `features/`
that fails without the behavior. A scenario observes what Pi or a companion
reports -- RPC `get_commands`, the registry probe, the hook recorder, the MCP
stub server's log, the scripted model's call log, a child agent's system
prompt, a workflow run's events -- and never the files the bridge wrote.
Expected values are whole values written as literals in the feature file. A
model turn runs on Pi's faux provider (the scripted model); behavior that
needs a real model is out of scope. Research: `.planning/research/SUMMARY.md`
and its four dimension files; open decisions are listed there by owning phase
(FG-01..FG-33).

**Upstream parity:** every expected behavior is Claude Code's (binary 2.1.316
and code.claude.com docs) unless a recorded decision with an ID or a Pi
capability gap licenses a divergence. A gap, contradiction, or edge case with
no license goes to the user before any scenario pins it.

**Bug policy:** a scenario that exposes a product bug fixes it in the same
phase, with Claude Code as the reference. A phase stops for the user only when
upstream behavior contradicts a recorded project principle and no precedent
settles it.

**Parallel work:** Phase 1 is the only prerequisite. Component phases add
files only; they never edit shared harness files, `package.json`, the
lockfile, `CHANGELOG.md`, the READMEs, PROJECT.md Key Decisions, or
BACKLOG.md. Each phase lists its lines for those files in its SUMMARY.md, and
the parent applies them at merge.

## v1 Requirements

### Versions

- [x] **VER-01**: `package.json` declares Pi `@earendil-works/pi-coding-agent` peer `>=1.4.0` and dev `^1.4.0`, `@earendil-works/pi-tui` dev `^1.4.0`, and `@earendil-works/pi-ai` dev at exactly `1.4.0`; the lockfile matches and `npm run check` passes
- [x] **VER-02**: The optional peer ranges are `pi-mcp-adapter >=7.0.0 <8` and `pi-subagents >=0.84.0`, and `@quintinshaw/pi-dynamic-workflows >=3.15.0 <4` is a new optional peer; none of them is a dependency, devDependency, or lockfile package (PIFL-03)
- [x] **VER-03**: `scripts/install-test-peers.mjs` installs all three companions at their declared floors, and the floor-pinning tests (`peer-floor.test.ts`, `test/e2e/pi-peer-floor`, the MCP conformance tests) prove the new floors
- [x] **VER-04**: An MCP value the bridge writes as a literal stays literal under pi-mcp-adapter 7.x, including the `${NAME:-default}` form the adapter now expands, so no environment secret reaches a server through a literal; the adapter-expansion conformance property is re-proved on 7.x
- [x] **VER-05**: The decision on `${NAME:-default}` (resolve at install versus leave to the adapter at connect time) and on the new adapter entry keys (`appendStructuredContent`, `roots`) is recorded with an ID
- [x] **VER-06**: README, `README.es.md`, the compatibility docs, `AGENTS.md`, and `.planning/codebase/STACK.md` name the new versions

### Harness

- [x] **HAR-01**: A scenario can start a per-scenario profile Pi through a `Given`: the real extension plus the scripted model, the registry probe, and optionally the three companions loaded from their manifest `pi.extensions` entries; the run's shared Pi keeps no model and no companions, and every existing scenario still passes
- [x] **HAR-02**: The scripted model plays a per-scenario script of replies and tool calls written in the feature file, records every model call (messages, tools, system prompt), refuses to run past its script, and fails the scenario when steps are left unused
- [x] **HAR-03**: A model-turn `When` waits for the turn to settle (`agent_settled`, not aborted) and keeps every record the turn produced (tool events, custom entries, notifies), with no fixed sleeps
- [x] **HAR-04**: The registry probe reports Pi's tools (all and active) and commands; the hook recorder captures each hook process's event, stdin, arguments, and `CLAUDE_*` environment; the MCP stub server is a dependency-free stdio server that logs every request
- [x] **HAR-05**: Profile Pis are hermetic: `TMPDIR` and every companion write stay inside the scenario sandbox, nothing reaches the network or the real home directory, and the reset asserts a clean baseline (no queued model steps, no live stub process, no leftover runs or recorder output)
- [x] **HAR-06**: The profile Pi trusts its project and approves project MCP servers as the pre-fan-out decision specifies, and a scenario shows the untrusted behavior beside it
- [x] **HAR-07**: Phase 1 creates the six function directories (`features/{skill,slash-command,agent,hook,mcp-server,workflow}/`), one fixture writer and one step module per kind, and the shared steps, each used by a seed scenario, so component phases add files only and `npm run check:features` stays green
- [x] **HAR-08**: The cucumber skill rules describe the profile Pi, the scripted model, the stand-ins, and this milestone's file-ownership table

### Pre-fan-out decisions

- [x] **DEC-01**: Before the component phases start, the user's decisions on positional argument numbering (FG-01), the `ARGUMENTS:` append (FG-02), other substitution forms (FG-03), skill arguments (FG-04), `` !`cmd` `` injection (FG-05), the description fallback (FG-06), dropped skill and command frontmatter fields (FG-10), custom component directories (FG-14), and project trust are recorded with IDs
- [x] **DEC-02**: The 2026-10-31 hook and skill decisions (`user-invocable: false` divergence, `new` sent as `clear`, `compact` on compaction, `fork` matchers) carry IDs, and the PROJECT.md bullet that contradicts D-07 is corrected

### CI

- [x] **CI-01**: The CI behavioral job installs the companions and runs as path shards (lifecycle and components) whose timeouts hold the measured combined run with margin

### Skills

- [ ] **SKL-01**: A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the upstream description fallback as decided
- [ ] **SKL-02**: Skill frontmatter variants behave as upstream or as a recorded divergence: `disable-model-invocation`, `user-invocable: false` (Pi-gap divergence), frontmatter `name` (FG-07), and each field FG-10 covers
- [ ] **SKL-03**: Invoking a skill sends the model its body in a `<skill>` block, with path variables expanded and arguments handled as decided
- [ ] **SKL-04**: A skill and a command (or another skill) with the same qualified name resolve as decided under FG-08
- [ ] **SKL-05**: The interactive `/plugin:skill` alias works as decided under FG-09, tested through the TUI driver
- [ ] **SKL-06**: Disable, uninstall, and update remove or replace the skill in a new session, and enable restores it

### Commands

- [ ] **CMD-01**: A new session lists each bridged command as a prompt template `/<plugin>:<name>` (nested directories colon-joined) with its description
- [ ] **CMD-02**: Invoking a command sends the model its body with `$ARGUMENTS`, positional arguments, and the appended-arguments rule handled as decided under FG-01..FG-03
- [ ] **CMD-03**: Command frontmatter and content variants behave as upstream or as a recorded divergence: `argument-hint`, `description`, path variables, injection (FG-05), model invocation (FG-11), `user-invocable` (FG-12)
- [ ] **CMD-04**: The object-map `commands` manifest form (FG-13) and custom command directories (FG-14) behave as decided
- [ ] **CMD-05**: Disable, uninstall, and update remove or replace the command in a new session, and enable restores it

### Agents

- [ ] **AGT-01**: With pi-subagents loaded, its agent list shows each bridged agent as `<plugin>:<name>` with its alias and description, including nested agent files as decided under FG-15
- [ ] **AGT-02**: A foreground agent run starts a child whose system prompt is the agent body and whose tools and model follow the conversion rules, with and without `--map-model` (FG-18)
- [ ] **AGT-03**: Agent frontmatter variants behave as upstream or as a recorded divergence: `tools`, `disallowedTools`, `model`, `effort`, skill preloads (FG-16), and the fields FG-17 covers
- [ ] **AGT-04**: A background (`async: true`) agent run completes on pi-subagents 0.84 with the scripted model, or the gap is recorded with an ID
- [ ] **AGT-05**: Without pi-subagents, the install shows `{requires pi-subagents}` and loading the companion then reloading makes the agents available with no reinstall
- [ ] **AGT-06**: Project-scope agents behave as upstream in a trusted project, and the untrusted behavior is pinned
- [ ] **AGT-07**: Disable, uninstall, and update remove or replace the agent, and enable restores it

### Hooks

- [ ] **HOOK-01**: SessionStart sends `source: "clear"` for Pi `new`, fires with `source: "compact"` after a compaction, and admits `clear`, `compact`, and `fork` matchers; `features/plugin/session-start-hooks.feature` is migrated
- [ ] **HOOK-02**: SessionEnd sends `reason: "clear"` for Pi `new`, and its other reasons and matchers, and SessionStart on Pi `reload`, behave as decided under FG-20 and FG-21
- [ ] **HOOK-03**: Two compactions in one session give two SessionStart `compact` runs, while Pi's duplicate session bind (pi#10470) still gives one
- [ ] **HOOK-04**: Tool-use hooks (PreToolUse, PostToolUse, PostToolUseFailure) fire on scripted tool calls with Claude's tool names and stdin, matchers select them, and exit codes and JSON decisions block or allow as upstream
- [ ] **HOOK-05**: UserPromptSubmit, Stop, and the other admitted events fire with Claude's stdin, and their outputs (`additionalContext`, block, `systemMessage` per FG-26) behave as upstream or a recorded divergence
- [ ] **HOOK-06**: Exec-form hooks substitute `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in `command` and each `args` element (FG-19 fix), and the hook environment matches upstream
- [ ] **HOOK-07**: `if` conditions, `once`, `onFailure`, the manifest `hooks` field, and unsupported events behave as decided under FG-22..FG-24, never silently
- [ ] **HOOK-08**: A hook on a plugin MCP tool fires once per call under the real tool name, with the `mcp` proxy's outer event handled as decided
- [ ] **HOOK-09**: Disable, uninstall, and update stop or replace the hooks, and `docs/hooks-compatibility.md` matches the tested behavior (FG-25)

### MCP servers

- [ ] **MCP-01**: With pi-mcp-adapter 7.x loaded, a bridged stdio server connects (the stub logs `initialize` and `tools/list`) and its tools register as `mcp__plugin_<plugin>_<server>__<tool>`
- [ ] **MCP-02**: A scripted call through the adapter's `mcp` proxy reaches the stub with the given arguments and returns its result to the model
- [ ] **MCP-03**: Server configuration variants reach the server as upstream: args, env, `${VAR}` and `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`, and loopback remote servers with headers; the documented rows are re-measured on 7.x (FG-30)
- [ ] **MCP-04**: Multiple server sources and a malformed server behave as decided under FG-27 and FG-28
- [ ] **MCP-05**: Project-scope plugin servers start as decided under FG-29 in a trusted project, and the untrusted behavior is pinned
- [ ] **MCP-06**: Without pi-mcp-adapter, the install shows `{requires pi-mcp-adapter}` and loading the adapter then reloading makes the servers available with no reinstall
- [ ] **MCP-07**: An agent granted a plugin MCP tool can call it in a foreground run
- [ ] **MCP-08**: Disable, uninstall, and update remove or replace the server entries the adapter sees

### Workflows

- [ ] **WFL-01**: With the workflow engine loaded, each bridged workflow is the command `/<plugin>:<meta.name>` with its description
- [ ] **WFL-02**: Running the command completes, and its run records the arguments in the engine's shape (FG-32) and the script's result
- [ ] **WFL-03**: Scripts the engine refuses (meta shape, determinism, reserved names) are reported as upstream or a recorded divergence, and the missing run approval is recorded (FG-31)
- [ ] **WFL-04**: Without the engine, the install shows `{requires pi-dynamic-workflows}` at the decided severity and loading the engine then reloading makes the workflows available with no reinstall
- [ ] **WFL-05**: Disable, uninstall, and update remove or replace the workflow, including the lingering-command notice (WLIF-06)

### Cross-kind

- [ ] **XK-01**: An agent that preloads a plugin skill gets that skill's content in its child session

## v2 Requirements

Deferred to a milestone with a real model provider.

- **RM-01**: A real model chooses a plugin skill or agent on its own from its description
- **RM-02**: A command reaches the model through the Skill tool (FG-11 proof)
- **RM-03**: A workflow whose script calls `agent()` runs its agents
- **RM-04**: Remote MCP OAuth completes end to end
- **RM-05**: StopFailure fires on a model error, if the faux provider cannot end a turn in error

## Out of Scope

| Feature | Reason |
|---------|--------|
| Checks that read the files the bridge wrote | Unit tests cover them; behavioral tests observe Pi and the companions |
| Faux model or companions on the run's shared Pi | Breaks existing scenarios that expect a model-less, companion-free Pi |
| Pinning an unlicensed gap before the user decides | Upstream parity rule |
| Bridging the component kinds the project does not support (`lspServers`, `monitors`, `themes`, `outputStyles`, ...) | Unchanged scope; `domain/unsupported-components.ts` |
| Network MCP servers other than loopback stand-ins | Hermetic suite |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VER-01 | Phase 1 | Complete |
| VER-02 | Phase 1 | Complete |
| VER-03 | Phase 1 | Complete |
| VER-04 | Phase 1 | Complete |
| VER-05 | Phase 1 | Complete |
| VER-06 | Phase 1 | Complete |
| HAR-01 | Phase 1 | Complete |
| HAR-02 | Phase 1 | Complete |
| HAR-03 | Phase 1 | Complete |
| HAR-04 | Phase 1 | Complete |
| HAR-05 | Phase 1 | Complete |
| HAR-06 | Phase 1 | Complete |
| HAR-07 | Phase 1 | Complete |
| HAR-08 | Phase 1 | Complete |
| DEC-01 | Phase 1 | Complete |
| DEC-02 | Phase 1 | Complete |
| CI-01 | Phase 1 | Complete |
| SKL-01 | Phase 2 | Pending |
| SKL-02 | Phase 2 | Pending |
| SKL-03 | Phase 2 | Pending |
| SKL-04 | Phase 2 | Pending |
| SKL-05 | Phase 2 | Pending |
| SKL-06 | Phase 2 | Pending |
| CMD-01 | Phase 3 | Pending |
| CMD-02 | Phase 3 | Pending |
| CMD-03 | Phase 3 | Pending |
| CMD-04 | Phase 3 | Pending |
| CMD-05 | Phase 3 | Pending |
| AGT-01 | Phase 4 | Pending |
| AGT-02 | Phase 4 | Pending |
| AGT-03 | Phase 4 | Pending |
| AGT-04 | Phase 4 | Pending |
| AGT-05 | Phase 4 | Pending |
| AGT-06 | Phase 4 | Pending |
| AGT-07 | Phase 4 | Pending |
| HOOK-01 | Phase 5 | Pending |
| HOOK-02 | Phase 5 | Pending |
| HOOK-03 | Phase 5 | Pending |
| HOOK-04 | Phase 5 | Pending |
| HOOK-05 | Phase 5 | Pending |
| HOOK-06 | Phase 5 | Pending |
| HOOK-07 | Phase 5 | Pending |
| HOOK-08 | Phase 5 | Pending |
| HOOK-09 | Phase 5 | Pending |
| MCP-01 | Phase 6 | Pending |
| MCP-02 | Phase 6 | Pending |
| MCP-03 | Phase 6 | Pending |
| MCP-04 | Phase 6 | Pending |
| MCP-05 | Phase 6 | Pending |
| MCP-06 | Phase 6 | Pending |
| MCP-07 | Phase 6 | Pending |
| MCP-08 | Phase 6 | Pending |
| WFL-01 | Phase 7 | Pending |
| WFL-02 | Phase 7 | Pending |
| WFL-03 | Phase 7 | Pending |
| WFL-04 | Phase 7 | Pending |
| WFL-05 | Phase 7 | Pending |
| XK-01 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0

---

*Requirements defined: 2026-10-31*
*Last updated: 2026-10-31 after roadmap creation (7 phases)*
