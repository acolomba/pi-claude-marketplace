---
spike: 028
idea: component-behavior-without-llm
name: model-free-harness
type: standard
validates: "Given a plugin that ships every bridged component kind, installed through /claude:plugin in a headless RPC Pi with its companions loaded, when the host and each companion are asked through their own public surfaces, then each component kind can be observed working without an authenticated LLM"
verdict: VALIDATED
related: [023, 027]
tags: [cucumber, rpc, faux-model, skills, commands, agents, hooks, mcp, workflows, companions]
---

# Spike 028: Model-free component verification

## What This Validates

Given a plugin `kit@fixtures` that ships a skill, two commands, an agent,
four hooks, an MCP server, and a workflow, when it is installed through
`/claude:plugin` in a headless RPC Pi with pi-subagents, pi-mcp-adapter, and
pi-dynamic-workflows loaded, then can each component kind be checked through
what Pi or the companion reports, with no authenticated LLM?

## Research

Pi gives two ways to observe without a real model:

| Approach | What it is | Reaches | Cost |
| --- | --- | --- | --- |
| Host surfaces | RPC `get_commands`, companion slash commands, an extension that reads `pi.getAllTools()` and `pi.getCommands()` | listing, naming, descriptions, MCP connect and tool listing, hooks on session and prompt events, saved-workflow runs | none |
| Faux model | `@earendil-works/pi-ai/providers/faux` registered through `pi.registerProvider`, then RPC `set_model faux/faux-1` | everything a model turn reaches: expanded prompt templates and skills, tool calls, tool-use hooks, MCP tool calls, agent runs | one small extension |

The faux provider is part of Pi itself: `fauxProvider()`, `fauxToolCall()`,
`fauxAssistantMessage()`. A response step can be a function of the context,
so the scripted model can also record exactly what Pi sent it.

**Chosen:** both. Host surfaces for anything that does not need a turn. The
faux model for anything that does.

## How to Run

```bash
node scripts/install-test-peers.mjs
npm install --prefix <scratch> @quintinshaw/pi-dynamic-workflows@3.15.0
export SPIKE_ENGINE=<scratch>/node_modules/@quintinshaw/pi-dynamic-workflows/dist/pi-extension.js
node .planning/spikes/028-model-free-harness/run.ts          # install, reload, list
node .planning/spikes/028-model-free-harness/faux.ts <base> out.json script-all.json \
  "/kit:greet Ada" "/skill:kit-hello" "use the mcp" "use agents"
node .planning/spikes/028-model-free-harness/faux.ts <base> out.json script-agent.json "use agents"
node .planning/spikes/028-model-free-harness/faux.ts <base> out.json script-wf.json "/kit:demo hello who=Ada"
```

`<base>` is the sandbox directory `run.ts` prints. The engine needs symlinks
from `<scratch>/node_modules/@earendil-works/*` to the repository's copies only
when its modules are imported outside Pi.

## Files

| File | Role |
| --- | --- |
| `driver.ts` | one RPC Pi, one request at a time, every stdout record kept; reuses `test/e2e/_rpc.ts` argv and allowlist environment |
| `fixture.ts` | path-source marketplace with `kit`, which ships every component kind |
| `stub-mcp.mjs` | stdio MCP server with one `echo` tool; logs each request to `$HOME/mcp-stub.log` |
| `probe-extension.ts` | `/spike-probe` appends `getAllTools()`, `getActiveTools()`, `getCommands()` as a custom entry |
| `faux-extension.ts` | registers the faux provider, plays `$SPIKE_FAUX_SCRIPT`, logs each model call to `$HOME/faux-calls.log` |
| `run.ts`, `probe2.ts`, `faux.ts` | the three drivers |
| `late-*.ts`, `count-ext.ts` | controls for the workflow-registration and duplicate-SessionStart questions |

## Results

**Verdict: VALIDATED.** All six kinds can be checked against the Claude Code
contract without an authenticated LLM. Each kind has at least one check that
needs no model at all. The faux model covers the rest,
including tool-use hooks and agent runs, which the original plan expected to
need a real LLM.

| Kind | No model | With the faux model | Not reached |
| --- | --- | --- | --- |
| Skills | `get_commands` lists `/skill:kit-hello` with its description and path | `/skill:kit-hello` sends the model the skill body in a `<skill>` block | whether a real model picks the skill on its own |
| Commands | `get_commands` lists `kit:greet`, `kit:plain` as `prompt` with their descriptions | `/kit:greet Ada` sends the model `Greet Ada warmly.` (`$ARGUMENTS` expanded) | -- |
| Agents | `/subagents-doctor` counts 1 user agent | `subagent {action:"list"}` lists `kit:reviewer` with alias and description; `subagent {agent:"kit:reviewer", async:false}` runs a child whose system prompt holds the agent body, model `faux/faux-1`, exit 0 | background (`async`) runs, see Gotchas |
| Hooks | SessionStart (`startup`, `new`), SessionEnd (`new`, `quit`), UserPromptSubmit fire with Claude-shaped stdin, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_DIR` | a scripted `bash` call fires PreToolUse with `tool_name: "Bash"`, `tool_input` | -- |
| MCP | adapter spawns the stub (`--flag`, `STUB_TOKEN` default expanded), sends `initialize` and `tools/list`; `getAllTools()` holds `mcp__plugin_kit_stub__echo`; `/mcp` shows the server | `mcp {search:"echo"}` then `mcp {tool:..., args:{text:"ping"}}` returns `echo:ping`; the stub logs `tools/call` | -- |
| Workflows | `/kit:demo` is a registered command; `/kit:demo hello who=Ada` runs in the background and completes with `{"who":"Ada","_":"hello",...}` in the run's events file | -- | runs whose script calls agents; those need the faux model reachable from the engine's agents, not tried |

### What it can prove against the Claude Code contract

- Naming and namespacing: `kit:greet`, `skill:kit-hello`, `kit:reviewer`,
  `mcp__plugin_kit_stub__echo`, `kit:demo`.
- Descriptions, including the fallback to a command's first line.
- Argument substitution in commands; the skill body reaching the model.
- Hook event names, matchers, stdin fields, and environment variables.
- MCP variable expansion with `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}`, args.
- Agent body as the child system prompt, and the tools the agent file grants
  (`tools: read,grep` from Claude's `Read, Grep`). The fixture's `model:
  sonnet` did not reach the agent file without `--map-model`, and the child
  ran on the session model.
- A workflow's `args` parsing and its result.

## Investigation Trail

1. Installed with the companions, then compared `get_commands` before and
   after. Both RPC `new_session` and a fresh process reload the resources, so
   a scenario does not need to restart Pi.
2. `/kit:demo` was missing. Cause: engine 3.10.1 reads `~/.pi/workflows`, and
   the bridge follows the 3.14.0 rule (`<agent dir>/workflows` when
   `PI_CODING_AGENT_DIR` is set). With 3.15.0 the engine lists `kit:demo`.
   A control extension that registers a command in `session_start` confirmed
   late registration reaches `get_commands`.
3. The first `/kit:demo` run failed with `Unexpected token 'export'`. The
   engine takes a statement body with `return`, not `export default`. The
   fixture was wrong, not the bridge.
4. A plain prompt reaches `UserPromptSubmit` before Pi refuses it for lack of
   a key. RPC `bash` does not fire PreToolUse, because it is not a tool call.
   That led to the faux provider.
5. The faux model's `bash` call fired PreToolUse. The direct MCP tool was not
   active (`directTools: "search"`), so it returned `not found`. Going through
   the adapter's `mcp` proxy tool worked.
6. A background agent run failed: pi-subagents 0.74.0 asks the host for
   `@earendil-works/chord` and `pi-agent-core/node`, which this repository's
   Pi does not ship. `async: false` ran in the foreground and succeeded. The
   child shared the faux model, and its counter, so the run is in-process.

## Gotchas

- **Wait for `agent_settled`, not the first `agent_end`.** A prompt sent while
  the previous turn still runs is queued as a follow-up to the model, so a
  slash command can look unregistered.
- **The engine's floor matters.** Below 3.14.0 it ignores
  `PI_CODING_AGENT_DIR`, so every sandboxed workflow check fails.
- **Background agent runs need the host's full package set.** Use
  `async: false` until the peer floor and the Pi dev dependency agree.
- **The faux script is one queue per process.** An in-process child agent
  takes the next step, so a script lists the parent's and the child's steps
  in order.
- **Workflow results are not delivered over RPC.** The engine logs "no
  thenable send function". Read the run's `.events.jsonl` instead, or the
  `pi-dynamic-workflows:progress` custom entries, which do arrive.

## Side findings

Upstream evidence below was gathered on 2026-10-31 from the Claude Code
2.1.316 binary (`grep -a`) and from code.claude.com/docs/en/skills and
/docs/en/hooks.

### SessionStart fires twice on every RPC `new_session`

Pi binds extensions twice on RPC session replacement
([earendil-works/pi#10470](https://github.com/earendil-works/pi/issues/10470)).
**Fixed on main** by #294: the hooks bridge drops a repeated `session_start`
for the same session id and reason (SSDEDUP-01 in the backlog).

### `user-invocable: false` skills are offered as slash commands

- **Claude Code:** the skill is hidden from the `/` menu, and typing `/name`
  does not run it. Claude can still invoke it, and its description stays in
  context. Docs table: "You can invoke: No / Claude can invoke: Yes". The
  2.1.316 binary reads the field (`e["user-invocable"]===void 0?!0:...`) and
  describes a skill that is "not user-invocable" as one the session does not
  list as a slash command. Confidence: high.
- **Pi 1.x:** skill frontmatter has `disable-model-invocation` only. The
  `enableSkillCommands` setting hides every skill command at once, and a typed
  `/skill:name` still works. There is no per-skill way to hide a slash command.
- **Extension today:** does not read the field. The spike's `kit-hidden` is
  listed as `/skill:kit-hidden` and runs when typed. No recorded decision
  covers it.
- **Divergence license:** a Pi capability gap covers the menu listing. It
  does not obviously cover running on `/skill:name`, because an extension
  `input` handler can refuse that command. Needs a decision.

### SessionStart `source` values

- **Claude Code 2.1.316:** `source` is the closed enum `startup | resume |
  clear | compact | fork` (binary: `source:U(["startup","resume","clear",
  "compact","fork"])`, and the same list as the matcher values). Docs: `clear`
  is `/clear`; `compact` is auto or manual compaction; `fork` is a session
  forked from an existing one (`--fork-session`, `/fork`, `/branch`).
  Confidence: high.
- **Pi:** `SessionStartEvent.reason` is `startup | reload | new | resume |
  fork`. Compaction does not emit `session_start`; it emits `session_compact`.
- **Extension today (recorded):** D-60-04 passes Pi's `reason` through as
  `source` unchanged, so hooks see `new` and `reload`, which upstream never
  sends. D-58-06 admits only `startup` and `resume` as matchers and makes
  `clear` and `compact` matchers unavailable (TOOL-02).
- **Gaps:**
  1. `fork` was added upstream after D-58-06. Pi has the same value with the
     same meaning, but a `fork` matcher is refused. Neither license covers
     this; it is drift.
  2. Pi `new` (`/new`) does what Claude's `/clear` does: it ends the
     conversation and starts a new session in the same process. D-58-06
     records `clear` as having no Pi analog. That premise looks wrong.
  3. Claude fires SessionStart with `compact` after compaction. Pi's
     `session_compact` could carry it, but D-58-06 records no analog.
  4. Pi `reload` has no upstream source value. Upstream behavior for a
     reload is unknown.

### Decisions taken (2026-10-31)

- `user-invocable: false`: keep today's behavior and record it as a
  divergence licensed by the Pi capability gap (no per-skill way to hide a
  slash command). Report the gap to Pi.
- SessionStart `compact`: fire SessionStart with `source: "compact"` on Pi's
  `session_compact` and admit `compact` matchers. Supersedes that part of
  D-58-06.
- SessionStart `fork`: not yet decided. Parity default applies.
- Pi `new` as `clear`: open; the user asked why it matters.
