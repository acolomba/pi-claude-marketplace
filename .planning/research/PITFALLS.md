# Pitfalls Research

**Domain:** Brownfield Pi extension. Milestone `component-features`: cucumber scenarios for every bridged Claude component kind (skills, commands, agents, hooks, MCP servers, workflows), observed through Pi's and the companions' own surfaces in a headless RPC Pi scripted by Pi's faux model. The milestone also raises Pi to 1.4.0, pi-mcp-adapter to 7.0.0, and pi-subagents to 0.84.0, adds `@quintinshaw/pi-dynamic-workflows` 3.15 as an optional peer, and fixes SessionStart/SessionEnd parity.
**Researched:** 2026-10-31
**Confidence:** HIGH overall. Most findings come from this tree's source (`features/lib/pi-process.ts`, `features/support/pi-process.ts`, `features/lib/pi-commands.ts`, `test/e2e/_rpc.ts`, `scripts/install-test-peers.mjs`, `scripts/check-features.mjs`, `eslint.config.js`, `.github/workflows/ci.yml`, `extensions/pi-claude-marketplace/{platform/pi-api.ts,bridges/hooks/event-router.ts,domain/components/hook-events.ts}`) and from the published tarballs of `pi-mcp-adapter@7.0.0`, `pi-subagents@0.84.0`, `@quintinshaw/pi-dynamic-workflows@3.15.0`, `@earendil-works/pi-coding-agent@1.4.0`, and `@earendil-works/pi-ai@1.4.0`, read from `npm pack` in a scratch directory. Pi 1.3.0 docs (`node_modules/@earendil-works/pi-coding-agent/docs/security.md`, `rpc.md`) are HIGH. Upstream Claude Code facts come from the spike-028 binary grep of 2.1.316 (HIGH) and from code.claude.com/docs/en/hooks (WebFetch, which the confidence seam rates LOW when unverified; it agrees with the binary grep on every value checked, so MEDIUM). The claim that Claude Code starts plugin MCP servers without a project-approval prompt is MEDIUM and needs `claude-code-compat-research`.

## Phase vocabulary

The roadmap does not exist yet. The pitfalls below name phases by concern:

| Tag | Concern |
| --- | --- |
| **HARNESS** | Phase 1, first half: the companion Pi, the faux model, the probe extension, the stub MCP server, the hook recorder, fixture builders, shared steps, the reset, and the CI job |
| **VERSIONS** | Phase 1, second half: Pi 1.4.0, pi-mcp-adapter 7.x, pi-subagents 0.84, pi-dynamic-workflows 3.15, and every test, doc, and lockfile that pins the old floors |
| **SKILLS**, **COMMANDS**, **AGENTS**, **HOOKS**, **MCP**, **WORKFLOWS** | The six parallel component phases. HOOKS also owns the SessionStart/SessionEnd parity fix |
| **CLOSE** | Merge order, combined-tree gates, re-verification, milestone audit |

---

## Critical Pitfalls

### Pitfall 1: Putting the faux model or the companions on the run's shared Pi breaks existing scenarios in random order

**What goes wrong:**
Today each worker has one long-lived Pi with no model and no companions (`features/support/pi-process.ts`). Three existing contracts depend on that:

1. `sendMessage()` in `features/lib/pi-commands.ts:206-214` asserts that Pi refuses a plain prompt (`{ command: "prompt", success: false }`) "because the sandbox Pi has no model". `features/marketplace/background-update.feature` uses it in 8 places. With a model set, Pi runs a turn instead, and the step fails.
2. The `Before()` reset asserts `skills: []` and `payloads: []` after `new_session`. pi-subagents and the workflow engine ship skills and prompts (`"pi": { "skills": [...] }` in both package manifests), and the adapter can contribute skill paths through `resources_discover`. Any of these makes the reset fail.
3. Lifecycle-coverage scenarios prove that a missing optional peer degrades an install (`{requires pi-subagents}`, `{requires pi-mcp-adapter}`). With the companions loaded, those rows change.

The worst part is the order dependence. RPC `set_model` changes the session model in memory. The reset empties the agent directory and starts a new session, but nothing unsets the model. With `order: random` and `parallel: 8`, a worker that ran one faux scenario then fails an unrelated background-update scenario. The failure moves between runs.

**Why it happens:**
The run's Pi is the one piece of module state the cucumber rules allow (`.agents/skills/cucumber/rules/world-and-stand-ins.md`), so the easy move is to add `--extension` flags to `startRpcPi`.

**How to avoid:**
- Start a second long-lived Pi per worker, the companion Pi. It loads the faux extension, the probe extension, and the three companions. Give it its own `BeforeAll()`/`Before()`/`AfterAll()` in its own support module, named after it, under the same slow-process exception. Keep the run's Pi exactly as it is.
- Start the companion Pi lazily, on the first scenario that needs it, so the workers that never run a component scenario do not pay for it.
- Give the companion Pi its own reset baseline. Its `Before()` states the exact set of companion-owned commands, tools, and skills that an empty sandbox shows, and asserts that set, not an empty list.
- Set the faux model in the companion Pi's start-up (or in each reset) and never on the run's Pi.

**Warning signs:**
A background-update scenario fails only in some runs. The reset fails with a non-empty `skills` list. A `{requires pi-subagents}` row fails.

**Phase to address:** HARNESS.

---

### Pitfall 2: The RPC driver drops every record that arrives outside an in-flight request

**What goes wrong:**
`PiProcess.handleLine()` (`features/lib/pi-process.ts`) returns at once when `this.pending === undefined`. A `prompt` that starts a model turn gets its `response` first, with `data.disposition` (Pi docs `rpc.md:67`), and the turn's events come after it. So the current driver throws away `agent_end`, `agent_settled`, `tool_execution_*`, and every custom entry appended later. That includes the `pi-dynamic-workflows:progress` entries, which spike 028 named as the only workflow result that reaches RPC. The `idle` getter also ignores a running turn: a scenario that ends while the faux model is still mid-turn leaves Pi "idle". The next scenario's `new_session` then races the old turn, and the old turn's late output lands in the new scenario.

Spike 028 hit this as "a prompt sent while the previous turn still runs is queued as a follow-up". It worked around it with fixed sleeps (`setTimeout(r, 1500)` after start and after each turn in `faux.ts`), and the spike waited for the first `agent_end`, which its own README says is wrong.

**Why it happens:**
The driver was built for extension commands. Pi runs an extension command to completion before it answers, so every entry arrives before the response. Model turns do not work that way.

**How to avoid:**
- Keep one always-on record log per scenario in the companion Pi's driver. A request opens a window on it. It does not own the only listener.
- Read `disposition` from the `prompt` response. When it is `"handled"`, no run started. Otherwise, wait for `agent_settled` (not `agent_end`) on the log, with a named timeout. Pi 1.4 adds `aborted` to `agent_settled`, so assert that it is `false`.
- Make `idle` false from `agent_start` until `agent_settled`. The reset replaces a Pi that is not idle, as it already does for a pending request.
- Never sleep for a fixed time. Wait on a record or a log line, with a deadline.

**Warning signs:**
A scenario passes alone and fails in the full run. A slash command looks unregistered. A step reads a workflow result that is `undefined`. The spike's `SPIKE_SETTLE_MS` idea reappears as a constant.

**Phase to address:** HARNESS.

---

### Pitfall 3: The faux script is one queue per process, and the spike's version hides a short or long script

**What goes wrong:**
The spike's `faux-extension.ts` reads `$SPIKE_FAUX_SCRIPT` once, when the extension loads. It queues 50 response factories for the whole process, and when the script runs out it answers `{ text: "done" }`. In a long-lived Pi that serves many scenarios:

- Scenario A's unused steps are played to scenario B.
- After 50 model calls in a worker, every later call fails, in whatever scenario happens to be the 51st.
- A script with too few steps still "passes", because the model says "done" and the turn ends cleanly.
- An in-process subagent child takes the next step from the same queue (spike gotcha), so a script that forgets the child's step plays the child's step to the parent.

**Why it happens:**
The spike ran one process per experiment, so a process-global queue was harmless there.

**How to avoid:**
- Arm the script per scenario through a command of the faux extension (or an RPC custom command) that calls `setResponses()`. Never read it from the environment.
- Do not add a fallback. pi-ai 1.4's faux core already fails with "No more faux responses queued" (`dist/providers/faux.js:361`). Let that error fail the scenario.
- At the end of each `When`, and again in the reset, assert `getPendingResponseCount() === 0`. A script must be used up exactly.
- Write a child agent's steps into the script in call order, and name in the step text which steps are the child's.

**Warning signs:**
The model's last message in a log is "done". Failures cluster after a fixed number of faux scenarios in one worker. A subagent scenario passes with the child doing nothing.

**Phase to address:** HARNESS. Every component phase follows the rule.

---

### Pitfall 4: Faux-model scenarios that assert what the script told the model to do

**What goes wrong:**
The cucumber review asks: "Would a plausible wrong implementation still pass the scenario?" (`.agents/skills/cucumber/SKILL.md`). A faux scenario is tautological when its `Then` reads back the script:

| Tautological `Then` | Wrong implementation that still passes | Discriminating `Then` |
| --- | --- | --- |
| "the model called `bash`" | Hooks bridge never registered PreToolUse | The hook recorder holds one PreToolUse record whose stdin has `tool_name: "Bash"`, the translated `tool_input`, `hook_event_name`, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PROJECT_DIR`. A second hook with a non-matching matcher has no record |
| "the model's reply was `echo:ping`" (the script wrote that text) | MCP server never spawned | The stub MCP log holds `initialize`, `tools/list`, and `tools/call` with `{"text":"ping"}`, and the tool result the model was shown is `echo:ping` |
| "the `subagent` tool returned exit 0" | Agent bridge wrote an empty body, or the wrong tools | The child's model call shows the agent body as its system prompt, and the child's tool list is exactly `read`, `grep` |
| "`/kit:greet Ada` ran" | `$ARGUMENTS` not expanded | The user message the faux model received is exactly `Greet Ada warmly.` |
| "the skill was offered" | Skill body truncated or frontmatter leaked | The model received the skill body in its `<skill>` block, compared whole |
| "`mcp__plugin_kit_stub__echo` is listed" | The tool came from the adapter's `mcp-cache.json`, and the server never connected | The stub log shows `initialize` and `tools/list` in this scenario's window |

Two more forms of the same mistake:

- **Expected values from production code.** A step that builds an expected name with the extension's own name helper (`domain/name.ts`) proves nothing. Write the expected name as a literal in the feature file: `kit:greet`, `skill:kit-hello`, `kit:reviewer`, `mcp__plugin_kit_stub__echo`, `kit:demo`.
- **Partial recorder reads.** The spike's faux log cuts `lastUser` to 2,000 characters and `system` to 6,000. A comparison against a cut value is a partial comparison. The steps rules require whole values (`rules/steps.md`: "comparing whole values ... No `assert.ok(x.includes(...))`"). Record whole values, and compare a named, whole field.

**Why it happens:**
The faux model makes a turn deterministic, so the turn's own transcript looks like evidence. It only shows that the script ran.

**How to avoid:**
- The HARNESS phase provides observation stand-ins that sit on the host side of each bridge: the hook recorder (stdin, environment, argv, exit), the stub MCP server's request log, the faux model's call log (whole messages, tools, system prompt, per call), and the probe extension (`getAllTools()`, `getActiveTools()`, `getCommands()`).
- Every component scenario names, in its title, the bridge behavior it proves. Its `Then` reads one of those stand-ins, never the script.
- Each component phase adds at least one negative control per kind: a matcher that must not fire, a disabled plugin whose command must not expand, an uninstalled agent that `subagent {action:"list"}` must not list.
- Record a red proof before each product fix, as marketplace-features did (`*-RED.json`): the scenario fails on the old code.

**Warning signs:**
A `Then` step's text repeats a value that appears in the faux script table of the same scenario. A scenario still passes after you stub out the bridge it names.

**Phase to address:** HARNESS (stand-ins and step vocabulary). SKILLS, COMMANDS, AGENTS, HOOKS, MCP, WORKFLOWS (each scenario).

---

### Pitfall 5: The reset leaves companion state that the next scenario can see

**What goes wrong:**
The `Before()` reset empties HOME, the agent directory, and the project, then starts a new session. With components installed, that order leaks:

- **Hooks.** The previous scenario's routing table still holds its plugin's hooks. On `new_session`, Pi's `session_shutdown` fires SessionEnd for the old plugin after its files are gone. The spawn fails or, worse, a recorder that is still on disk appends a record that the next scenario reads.
- **MCP.** The adapter stops its servers in `session_shutdown` (`pi-mcp-adapter/index.ts:1842`), but its initialization runs after `session_start` asynchronously. A stub that started late, or one in a `lazy-keep-alive` lifecycle, can outlive the reset and append to a log file that the reset just removed, so the file reappears.
- **Workflows.** `/kit:demo` runs in the background (spike 028). A run that is still going when the reset empties the agent directory recreates `<agentDir>/workflows/...` under the next scenario.
- **Agents.** A background (`async: true`) subagent runs as a separate process, and pi-subagents writes its run state to a temp directory (see Pitfall 6). A detached child with its own process group survives `killProcessGroup()`.
- **Adapter files.** `mcp-cache.json` and `mcp-last-seen-version.json` live in the agent directory (`metadata-cache.ts:42`, `upgrade-notice.ts:17`). They are removed with it, but the adapter's in-memory state is only rebuilt on the next `session_start`.

**Why it happens:**
The existing reset only proves facts about this extension: no plugin, marketplace, skill, payload, or git host traffic. The companions were never loaded.

**How to avoid:**
- In the companion Pi's `Before()`: wait until the previous turn has settled, stop any workflow or subagent run through the companion's own control surface, start the new session, and only then empty the sandbox. Or empty first and accept a failed spawn, but in that case put every recorder log in a per-scenario directory whose name the world chooses, so a late write from scenario A can never land in scenario B's file.
- Then assert the clean state through the stand-ins: the probe lists only the baseline commands and tools, the faux queue is empty, the stub MCP pid file shows no live process, the hook recorder directory holds no record, and the workflow engine reports no active run.
- Keep `order: random` (`rules/world-and-stand-ins.md`), so a reset that leaks fails.

**Warning signs:**
A recorder log holds a record whose session id belongs to no step of the scenario. `ps` after a run shows `node stub-mcp` processes. The sandbox root cannot be removed in `AfterAll()` (`ENOTEMPTY`) because something keeps writing into it.

**Phase to address:** HARNESS.

---

### Pitfall 6: Companions write outside the sandbox, or reach the network

**What goes wrong:**
The child environment is an allowlist: `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`, `PATH`, plus the git and trust variables (`test/e2e/_rpc.ts:189-211`). `TMPDIR` is not on it, so Node's `os.tmpdir()` in Pi resolves to `/tmp`:

- pi-subagents 0.84 writes `join(tmpdir(), \`pi-subagents-${resolveTempScopeId()}\`)` (the `/tmp/pi-subagents-uid-0` the milestone noted), plus `pi-subagent-session-*`, `pi-subagents-tracked-diff-*`, and `pi-worktree-index-*` (bundle grep). All 8 workers, every run, and the developer's own Pi share these directories. The cucumber skill calls a leak of this kind a BLOCKER.
- A fixture plugin that ships `package.json` with dependencies and a lockfile makes `install` run the plugin's package manager (D-PL9-10), which reaches the npm registry unless the scenario uses the npm registry stand-in.
- An MCP fixture whose `command` is `npx` goes through the adapter's `npx-resolver.ts`. An `http` or `sse` MCP fixture can start OAuth discovery, and the adapter depends on `open`, which starts a browser.
- Adapter 7.0 semantic search uses the model logins Pi has. With `PI_OFFLINE=1` and no credentials it falls back to word search, but a test that sets `settings.semanticSearch` would try a classifier.

The rest is already contained by `HOME`: the adapter's `~/.config/mcp/mcp.json`, `~/.claude.json` imports, and `~/.agents/mcp.json`; the engine's legacy `~/.pi/workflows`, which only engines below 3.14 read (spike 028); `<agentDir>/mcp.log` (adapter 5.4).

**Why it happens:**
The allowlist was written for this extension, which never uses a temp directory that it does not name itself.

**How to avoid:**
- Add `TMPDIR=<run root>/tmp` to the companion Pi's environment. Create that directory in `BeforeAll()` and empty it in the reset. `_rpc.ts:161-171` already refuses a temp directory inside the repository, so keep the run root outside it.
- Make the stub MCP server a dependency-free stdio JSON-RPC server, started as `node <absolute path>`, as the spike's `stub-mcp.mjs` is. No `npx`, and no `@modelcontextprotocol/sdk`.
- Fixture plugins ship no `package.json` dependencies, unless a scenario is about package installs and uses `features/lib/npm-registry.ts`.
- Add no `http` MCP fixture without a loopback stand-in for it.
- Add one hermeticity check to the reset: list `/tmp` entries that match `pi-subagents-*` before and after a scenario, and fail on a new one.

**Warning signs:**
`ls /tmp | grep pi-subagent` grows during a run. A scenario takes 30 seconds and then fails with a DNS or `ECONNREFUSED` cause.

**Phase to address:** HARNESS (environment and stand-ins). AGENTS and MCP (fixtures).

---

### Pitfall 7: Project trust silently hides project-scope MCP servers and agents in RPC

**What goes wrong:**
Spike 028 installed `kit@fixtures --scope user` only (`run.ts:54-55`). Project scope writes to `<cwd>/.pi/mcp-adapter.json` and `<cwd>/.pi/agents/` (`persistence/locations.ts:208-212`). In an RPC Pi:

- pi-mcp-adapter 7.0 `applyProjectServerTrust()` blocks every project server when Pi does not trust the project, and when the project is trusted but the server is not approved, because RPC is not interactive (`project-server-trust.ts:278`). The only RPC way in is a user-level `settings.projectServers: "allow"`. Adapter 5.3.0 is the release that made RPC skip unapproved project servers instead of hanging (CHANGELOG 5.3.0).
- pi-subagents ignores project agents in an untrusted project (0.84 CHANGELOG: "In a project you have not trusted, agent lookup ... already ignored what was in them").
- Pi's own trust: RPC cannot show the trust prompt, so with the default `defaultProjectTrust: "ask"` protected project resources are skipped (`docs/security.md:75-80`).

So a project-scope MCP or agent scenario sees "no server" or "no agent", and the cause looks like a bridge bug.

There is also a parity question. In Claude Code, an enabled plugin's MCP servers start without the project `.mcp.json` approval prompt (MEDIUM, verify). Here, the bridge writes a project-scope plugin's server into a file that the adapter treats as an unapproved project server, so it never starts in RPC and asks in the TUI. That may be a product gap, not a harness problem.

**Why it happens:**
The existing suite never needed trust: skills and prompts reach Pi through this extension's `resources_discover`, which trust does not gate.

**How to avoid:**
- The HARNESS phase decides how the companion Pi trusts its project (`--approve`, `trust.json` in the sandbox agent directory, or `defaultProjectTrust: "always"` in the sandbox settings) and writes the decision down. It applies to the companion Pi only, never to the run's Pi.
- The MCP phase researches the upstream contract for plugin MCP servers and project approval with `claude-code-compat-research` before writing project-scope scenarios. If the adapter's gate is a divergence, record it with an ID and its license (a Pi or companion capability gap), or take it to the user.
- Include an untrusted-project scenario per kind where trust matters, so the divergence is pinned and not hidden by the harness setting.

**Warning signs:**
`/mcp` shows the server as `blocked`. `subagent {action:"list"}` lists the user-scope agent but not the project-scope one. Scenarios pass at user scope and fail at project scope.

**Phase to address:** HARNESS (trust setup). MCP and AGENTS (parity research and scenarios).

---

### Pitfall 8: pi-mcp-adapter 7.0 changes behavior that the conformance tests pin to 5.2

**What goes wrong:**
The integration tests run this extension's written MCP values through the adapter's own functions at the declared floor (`test/integration/pi-mcp-adapter-peer.ts`). The functions they import still exist in 7.0 (`dist/utils.js`, `dist/mcp-auth-flow.js`, `dist/mcp-auth-fetch.js`, `dist/config.js`, `dist/types.js`, all checked), so the tests will load. What changes is the answer:

- **`${VAR:-default}` expansion.** 7.0's `interpolateEnvVars` expands `${NAME:-default}` (`dist/utils.js:122-128`; CHANGELOG 7.0.0 "Added", #878). 5.2 left it as written. `adapter-expansion-conformance.test.ts` checks 462,790 values, including `${A:-}` and `${A:-{env}` tokens, plus credential forms such as `${NAME:-fallback}`, against "what Claude Code would send". The bridge's substitution (`bridges/mcp/substitute.ts`) was designed against 5.2's literal handling. With 7.0, a value that the bridge writes for the adapter to expand may now be expanded twice, or differently, and the property test reports mismatches.
- **Pinned contracts.** `test/architecture/peer-floor.test.ts` asserts the exact ranges `>=0.74.0` and `>=5.2.0 <6`, and that the lock root mirrors them. `test/bridges/mcp/adapter-entry.test.ts` pins `ServerEntry` and `OAuthConfig` to `pi-mcp-adapter@5.2.0` with a `dist.shasum`. `bridges/mcp/adapter-doc.ts` documents 5.2.0's loader grammar. `test/live-uat/mcp-adapter-canary.mjs` pins `ADAPTER_VERSION = "5.2.0"`.
- **6.0 changes.** `mcpScript` is gone. Every cached tool the model can reach through `mcp` is also a Pi deferred tool named `mcp__<server>__<tool>`, the same naming Pi's `builtin:mcp` uses. Observed output shapes are saved to `mcp-cache.json` by every session.
- **7.0 changes.** MCP Tasks (`"protocolVersion": "auto"`) return a tool result later as a new message. Semantic search settings moved from `settings.jev` to `settings.semanticSearch`.

Verified unchanged: the status channel `pi-mcp-adapter/status/v1`, snapshot version `1`, and the seven-value `McpServerRuntimeStatus` union that `platform/mcp-status.ts` copies verbatim.

**Why it happens:**
The upper bound `<6` existed to keep untested majors out. Raising it to 7 imports two majors of changes at once.

**How to avoid:**
- In VERSIONS, read the 5.3.0 to 7.0.0 changelog entries against each pinned contract above before you change the range. List each one as kept, changed with a fix, or newly recorded as a divergence.
- Re-derive the expansion design for `:-` defaults with Claude Code as the reference: Claude Code expands `${VAR:-default}` in `.mcp.json`. Decide whether the bridge should now leave such a value for the adapter, and change `substitute.ts` and its unit tests together. Run the property test and read every reported mismatch. Do not raise a tolerance.
- Re-check ADET-02 (`platform/pi-api.ts:239-256`): it reads `sourceInfo.source` and the `mcp-adapter` command, so 6.0's deferred `mcp__*` tools do not confuse it, but add a unit case that has both the adapter's deferred tools and `builtin:mcp` tools.
- Keep MCP fixtures without `protocolVersion: "auto"`, so a tool call returns in the same turn.

**Warning signs:**
`adapter-expansion-conformance.test.ts` reports `REPORTED_MISMATCHES` lines after the floor raise. `peer-floor.test.ts` fails. An MCP scenario's header value differs from Claude Code's for a `:-` default.

**Phase to address:** VERSIONS.

---

### Pitfall 9: The version raise touches many pinned places, and missing one breaks a gate that runs only in CI

**What goes wrong:**
The floors appear in more places than `package.json`:

| Place | What pins it |
| --- | --- |
| `package.json` `peerDependencies`, `devDependencies` (`@earendil-works/pi-coding-agent ^1.0.0`, `pi-tui ^1.0.0`) and `package-lock.json` | Ranges and the installed dev Pi (1.3.0 today) |
| `scripts/install-test-peers.mjs` (`peerNames = ["pi-mcp-adapter", "pi-subagents"]`) and `test/integration/optional-peer.ts` | Which peers the cache holds; the workflow engine is missing |
| `--before=<cutoff>` in `install-test-peers.mjs` | The newest floor's publish time; a new peer moves it |
| `test/e2e/pi-peer-floor/package.json` and its lock | Pi `1.0.0` for the e2e floor test. `npm run check` does not run e2e, so only PR CI catches a stale fixture |
| `test/architecture/peer-floor.test.ts` | Exact range strings |
| `README.md` lines 38-41 and `README.es.md` | Documented floors; the `readme` skill requires the two to stay in sync |
| `AGENTS.md` and `PROJECT.md` constraints | "Pi API ... pinned to `>=1.0.0`" (NFR-11), "`pi-mcp-adapter` (optional peer dep `>=5.2.0 <6`)" in `.planning/codebase/STACK.md` |
| `test/live-uat/mcp-adapter-canary.mjs` | `ADAPTER_VERSION = "5.2.0"` |
| `.github/workflows/ci.yml` `behavioral` job | Runs `npm ci --ignore-scripts` then `npm run test:cucumber`, and never runs `install-test-peers.mjs`, so the companion Pi has no companions in CI |

Two more traps:

- The faux extension imports `@earendil-works/pi-ai/providers/faux`. `pi-ai` is not a declared dependency of this repository, so the import either relies on hoisting or on Pi's extension-loader aliases. Pi 1.4.0 fixed exactly this class of bug for `@earendil-works/pi-ai/models` ("exposing the subpath through the extension loader aliases"), which shows that a subpath can be missing. Declare `@earendil-works/pi-ai` as a dev dependency at the Pi version, and prove the import loads inside Pi in a harness scenario.
- pi-subagents 0.84 declares `@earendil-works/pi-ai >=1.2.0`. pi-mcp-adapter 7.0 declares `@earendil-works/pi-ai` up to `^1.0.0` and `zod`. The peer cache installs with `--omit=peer`, so these resolve from the repository's `node_modules`. If the dev Pi stays at 1.3 while the floor says 1.4, the harness tests a Pi that no user is told to run.

**Why it happens:**
Each pin was added by a different milestone for a good reason, and no list ties them together.

**How to avoid:**
- Do the whole raise in VERSIONS, in one plan, from the table above. No component phase edits `package.json`, `package-lock.json`, or a peer pin.
- Add `node scripts/install-test-peers.mjs` before `test:cucumber` in the npm script and in the `behavioral` CI job, as `test:integration` already does.
- Add the workflow engine to `peerNames` and to `optional-peer.ts`, and keep it out of `dependencies`, `devDependencies`, and the lockfile (PIFL-03).
- Load each companion through the entry its package manifest names (`pi-subagents`: `./bundle/index.js`; the engine: `extensions/workflow.ts`), not the paths the spike used (`index.js`, `dist/pi-extension.js`). Record that `--extension` loads the extension only, not the package's skills and prompts.
- Run the e2e floor test locally once (`npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && npm run test:e2e`) before the handoff.

**Warning signs:**
`behavioral` passes locally and fails in CI with "holds no pi-subagents". A Dependabot PR conflicts with the phase branch on `package-lock.json`. `peer-floor.test.ts` fails in a component phase's worktree.

**Phase to address:** VERSIONS. CLOSE re-checks the e2e job.

---

### Pitfall 10: Shared steps that land in the harness phase fail `check:features` until a component phase uses them

**What goes wrong:**
`npm run check:features`, part of `check:static` and the pre-commit hook, fails on an unused step. Plugin-lifecycle 09-02 hit it: "`npm run check:features` failed with `unused step definition \"the npm registry receives no request\"`. In Task 2 no scenario uses the step. Only Task 3's hook scenario does." Lifecycle-coverage 16-01: "The `declares no version` step was written here and moved to plan 02, which first uses it (the feature gate fails on an unused step)."

This milestone wants a harness phase that provides the shared steps, then six phases that use them. A harness that ships steps only the later phases use cannot commit.

Two more gate rules constrain the harness files:

- `scripts/check-features.mjs` `isAllowedFile()` admits only `.ts` files (at most three levels deep) under `features/{step_definitions,support,lib}`, `.feature` files one level deep, and the single `lib/pi-tui-pty.py`. The spike's `stub-mcp.mjs`, a shell hook recorder, or a JSON faux script file under `features/` fails the layout check.
- A feature lives in `features/<function>/<capability>.feature`. Six new function directories (or new files under `features/plugin/`) need names that the layout rules accept.

**Why it happens:**
The gate is designed so that every step has a user, and the foundation-first plan splits the step from its user.

**How to avoid:**
- Follow lifecycle-coverage's seed pattern (01-04 and 01-05: "the enable seed (Phase 2 owns the file after this phase)"). The HARNESS phase writes one seed scenario per component kind in the feature file that the kind's phase will own. Each seed uses the shared steps for its kind. Ownership of the file passes to that phase.
- Write the stub MCP server, the hook recorder, and the faux and probe extensions as `.ts` modules under `features/lib/`, or have a fixture builder write them into the sandbox at run time. Node runs `.ts` natively, and Pi loads a `.ts` extension.
- Extend the `## Parallel work` ownership table in `.agents/skills/cucumber/rules/layout.md` with the new shared modules and the six phases' module names before the component phases start.

**Warning signs:**
The harness phase's first commit fails the hook with "unused step definition". Someone proposes skipping the hook (`--no-verify` is forbidden by AGENTS.md).

**Phase to address:** HARNESS.

---

### Pitfall 11: Six parallel phases collide on shared product files and on the harness

**What goes wrong:**
Every component phase covers "removal and replacement through uninstall, disable, and update". Those paths live in a few shared files: `orchestrators/plugin/uninstall.ts`, `enable-disable.ts`, `update-flow.ts`, `install-outcome.ts`, the `*.messaging.ts` builders, `shared/notification-*.ts`, and `domain/plugin-resolver.ts`. The bug policy says a scenario that exposes a product bug fixes it in the same phase. Six phases that each fix a removal bug in the same file will conflict.

Evidence from earlier milestones:

- Lifecycle-coverage 15-VERIFICATION: "The merge conflicted in `update-flow.ts`, `install.messaging.ts` and `enable-disable.ts`", which made that phase's verification stale.
- Marketplace-features retrospective: "Phases 1-7 and 9 read `stale` at close because later phases touched shared fixtures and orchestrators; all 12 needed a re-verify pass."
- Plugin-lifecycle retrospective: "Later integration work made eight phase reports stale."
- Lifecycle-coverage 03-VERIFICATION: a fixed 50 ms wait in `test/edge/handlers/plugin/browse.test.ts:373` failed "under load average ~82", which is what a dozen parallel sessions running `npm run check` produce.

**Why it happens:**
The bridges are separate fallow zones (`bridges-skills`, `bridges-mcp`, and so on), so the phases look independent. The orchestrators and the notification code are shared.

**How to avoid:**
- In the roadmap, name an owner for each shared product file. A component phase that finds a bug in a file it does not own records it with a failing scenario tagged for the owner, or routes the fix through one designated phase, rather than editing the file.
- Freeze the harness files (`features/support/**`, `features/lib/**`, `cucumber.json`, `scripts/check-features.mjs`, the shared step modules) after HARNESS. A component phase that needs a shared step defines it in its own verb module with verb-named text (layout.md D-08), and the move to a topic module is a follow-up commit.
- Merge in a fixed order and re-verify each phase after the merge that touches its files, not at milestone close.
- Treat a test that uses a fixed wait as a bug when it fails under parallel load.

**Warning signs:**
Two phase branches both modify `uninstall.ts`. A phase's VERIFICATION.md goes stale after a sibling merge. A step text from one phase's module appears in another phase's module (an ambiguous step).

**Phase to address:** Roadmap (ownership). HARNESS (freeze). CLOSE (merge order and re-verification).

---

### Pitfall 12: The SessionStart/SessionEnd parity fix breaks existing tests and has unlicensed corners

**What goes wrong:**
The decisions of 2026-10-31 (spike 028 README): Pi `new` goes out as `clear` in SessionStart `source` and SessionEnd `reason`; SessionStart fires with `source: "compact"` on Pi's `session_compact`; `clear`, `compact`, and `fork` matchers are admitted. What that touches and what it leaves open:

- **Existing behavior tests assert `new`.** `features/plugin/session-start-hooks.feature` has two scenarios whose tables list `source | new`. Unit tests assert it too: `test/bridges/hooks/payloads/session-start.test.ts:110` (`source: "new"`), `session-end.test.ts:73-86`, and `event-router.test.ts:2599-2638`. These change in the same commit as the fix, and the feature file's owner must be the HOOKS phase.
- **The dedupe drops a second compaction.** SSDEDUP-01 (`event-router.ts:915-924`) keeps one key, `<sessionId>\0<reason>`, and drops a repeat of the last one. Two compactions in one session give the same key `<id>\0compact`, so the second SessionStart `compact` is dropped. Claude Code fires on every compaction.
- **SessionEnd matchers.** `NON_TOOL_EVENT_CLOSED_SETS.SessionEnd` is empty (`hook-events.ts:266`). The decision says "`clear` matchers are admitted" without naming SessionEnd. Upstream SessionEnd reasons are `clear | resume | logout | prompt_input_exit | other` (docs), plus `bypass_permissions_disabled` in the binary. Pi's `quit`, `reload`, and `fork` would still go out verbatim, and upstream never sends them. No decision licenses that. It goes to the user.
- **SessionStart `reload`.** Pi `reload` still goes out as `source: "reload"`. Spike 028 lists this as gap 4 with no decision.
- **Order with PostCompact.** Pi's `session_compact` would now drive both PostCompact (PDEF-08) and SessionStart `compact`. The docs do not state the upstream order. Check the 2.1.316 binary before choosing one.
- **The faux model must script the compaction.** RPC `compact` asks the model for a summary, so the script needs a summary step, and a session with too little content may refuse to compact.
- **Install outcomes change.** A plugin whose hooks used a `clear`, `compact`, or `fork` matcher installed with that hook dropped (TOOL-02) and needed `--partial`. After the fix it installs whole. An existing installation keeps the dropped hook until update or reinstall. Decide whether `pending`/`apply` should report that, and write it in the CHANGELOG.

**Why it happens:**
D-58-06 and D-60-04 were recorded before upstream added `fork` and before anyone compared Pi `new` with Claude `/clear`.

**How to avoid:**
- HOOKS owns `session-start-hooks.feature`, the payload modules, `hook-events.ts`, and the dedupe in one phase.
- Change the dedupe key so it drops only the duplicate bind of one Pi event (pi#10470), for example by tagging each Pi event once, and add a scenario with two compactions in one session.
- Before planning, put the SessionEnd mapping (`quit`, `reload`, `fork`), SessionEnd `clear` matcher admission, SessionStart `reload`, and the PostCompact order to the user as one batch, each with the binary evidence.

**Warning signs:**
A compaction scenario passes with one compaction and nobody tried two. A plan says "map the remaining reasons to `other`" without a decision ID.

**Phase to address:** HOOKS.

---

### Pitfall 13: Writing expected behavior from memory, or from what the companion does

**What goes wrong:**
Each component phase plans from "Claude Code's documented and observed behavior". Two failure modes:

- **Memory.** The plugin-system contract moves quickly: `fork` arrived after D-58-06, `${VAR:-default}` support in the adapter arrived in 7.0, and SessionStart output gained `initialUserMessage`, `watchPaths`, `sessionTitle`, and `reloadSkills` (docs). A plan written from memory pins old behavior.
- **The companion as the oracle.** A scenario that checks what pi-subagents does with an agent file is a check of pi-subagents, not of the bridge. Spike 028 found that `model: sonnet` "did not reach the agent file without `--map-model`, and the child ran on the session model". A scenario that asserts "the child ran on `faux/faux-1`" pins a fallback, not Claude Code's behavior, where the agent would run on Sonnet.

**Why it happens:**
The faux harness makes any observable value easy to assert, whether or not it is the contract.

**How to avoid:**
- Each phase runs `claude-code-compat-research` against the 2.1.316 binary and the docs for its kind before planning, and cites the evidence in CONTEXT.md, as lifecycle-coverage did (2.1.309).
- A scenario whose expected value comes from the companion and differs from Claude Code needs a divergence ID and its license (a recorded decision, or a Pi or companion capability gap), or goes to the user.
- Record the `user-invocable: false` divergence (Pi capability gap) with an ID, and report it to Pi, as the milestone states.

**Warning signs:**
A CONTEXT.md decision with no upstream citation. A scenario title that names a companion behavior ("pi-subagents falls back to the session model").

**Phase to address:** SKILLS, COMMANDS, AGENTS, HOOKS, MCP, WORKFLOWS.

---

### Pitfall 14: CI time and runner load

**What goes wrong:**
The `behavioral` job has `timeout-minutes: 10` and runs `parallel: 8` on a GitHub `ubuntu-latest` runner (4 vCPUs). The suite already has 1,151 scenarios with one Pi per worker. A companion Pi per worker adds 8 more Pi processes, each loading pi-subagents (about 1-2 s of load, per its changelog), the adapter (whose first initialization can take seconds on a cold metadata cache: "about 2.6 seconds later on the first session that has to fetch it" with 100 servers), and the engine. Each faux scenario adds model turns, in-process subagent child sessions, MCP stub spawns, and hook subprocesses. The default step timeout is 30 s (`features/support/world.ts:47`), which a subagent run plus an MCP connect can exceed on a loaded runner. This repository has no recorded wall-clock baseline for the cucumber job.

**Why it happens:**
Each phase adds a few scenarios, and no phase owns the total.

**How to avoid:**
- In HARNESS, measure the current `test:cucumber` wall clock locally and in CI, and set a time budget per component phase.
- Start the companion Pi lazily (Pitfall 1). Consider serializing the companion scenarios with `setParallelCanAssign` if runner CPU is the limit.
- Use named step timeouts with a comment that says why (`rules/world-and-stand-ins.md`), never a raised global default.
- If the job nears its limit, change `timeout-minutes` deliberately in the same PR, or split the job by path, rather than letting it time out.
- Keep background agent runs (`async: true`) out of scope, as spike 028 advised, until the host package set and the faux provider in a separate child process are proven.

**Warning signs:**
Step timeouts that appear only in CI. The `behavioral` job's duration grows by more than a minute per merged phase.

**Phase to address:** HARNESS (budget and measurement). CLOSE (final check).

---

## Moderate Pitfalls

### Listing comparisons drown in companion noise

The companion Pi lists commands, tools, and agents that are not the plugin's: the adapter's `mcp` tool and `mcp-adapter` command, the engine's `workflow`, `workflow_control`, `workflows`, `effort`, `ultracode`, `deep-research`, `code-review`, `adversarial-review`, `multi-perspective`, and `codebase-audit` commands, pi-subagents' built-in agents, and the harness's own faux and probe commands. A scenario that checks "the list includes `kit:greet`" is a partial check. A scenario that compares the whole list breaks whenever a companion adds a command. Filter by a criterion that the step text states and that comes from the plugin (for example, entries whose `sourceInfo.path` lies inside the installed plugin's root), then compare that filtered set whole. **Phase:** HARNESS (the step), all component phases.

### MCP tools listed before, or without, a connection

The adapter starts asynchronously after `session_start`, so a probe right after `new_session` can miss the tools. It can also list a tool from `mcp-cache.json` when the server never connected. With `directTools: "search"`, or as a 6.0 deferred tool, `mcp__plugin_kit_stub__echo` is registered but inactive, so a direct call fails with "not found" (spike 028 step 5). Wait on the stub log for `tools/list` rather than polling the tool list, call through the `mcp` proxy, and assert the stub log. **Phase:** MCP.

### Workflow results do not reach RPC

The engine logs "no thenable send function" over RPC (spike 028). The result is in the run's `.events.jsonl` and in `pi-dynamic-workflows:progress` custom entries, which the current driver drops (Pitfall 2). The script body uses `return`, not `export default` (spike step 3, a fixture mistake). Engine floors below 3.14 ignore `PI_CODING_AGENT_DIR`. Scripts that call agents need a model in the engine's child agents and are out of scope. **Phase:** WORKFLOWS.

### pi-subagents 0.84 reads agent frontmatter differently

0.84 reads a quoted tool name without its quotes and reads a block that has a blank line inside it in full (CHANGELOG). A misspelled `subagents.agentOverrides` field now fails loading. Re-check the frontmatter that `bridges/agents/frontmatter.ts` writes, which is line-based, against these rules with a scenario per field form. **Phase:** AGENTS.

### Pi binds extensions twice on RPC `new_session`

pi#10470 still applies to Pi 1.4.0 (its changelog does not mention it). This extension dedupes SessionStart (SSDEDUP-01), and the session driver keeps both reconcile payloads, which scenarios state. The companions are bound twice too. The adapter guards with `lifecycleGeneration`. Check that a hook recorder sees one SessionStart per session in the companion Pi, and state the count in each hooks scenario. **Phase:** HOOKS.

### Hook subprocess timing

Hooks run as child processes, and SessionEnd runs during shutdown. Have the recorder append one JSON line per run with a single `appendFileSync` call, and have the step wait until the expected number of records exists or a deadline passes. A sleep is not a wait. **Phase:** HARNESS (recorder), HOOKS.

### Pi extension modules under `features/lib/` break conventions

A Pi extension needs a default export, and this repository uses named exports and marks the two loader-read default exports with `fallow-ignore` (`.planning/codebase/CONVENTIONS.md`). Type-aware strict linting rejects the spike's `any` types. Write the faux, probe, and recorder extensions to the same lint bar as other `features/lib` code, typed against Pi's published types. **Phase:** HARNESS.

### A bug found in a companion is not this repository's bug

Spike 028 already found two (the chord peer on Pi 1.2, the workflow-dir rule below engine 3.14). When a scenario fails because of a companion, record it, report it upstream, and choose a floor or a recorded divergence. Do not change the bridge to work around another package's bug unless the user agrees. **Phase:** all component phases.

## Minor Pitfalls

- **Upgrade notice.** The adapter writes `mcp-last-seen-version.json` to the agent directory and shows a notice only when an older version was recorded before (`upgrade-notice.ts:15-47`). An empty sandbox shows nothing. A fixture that pre-seeds the agent directory from a real one would show it.
- **`mcp.log`.** The adapter appends server log messages to `<agentDir>/mcp.log` (5.4.0). Do not compare whole agent-directory listings.
- **Live UAT canaries.** `test/live-uat/*.mjs` pins adapter 5.2.0. They are operator-run and outside `npm run check`, so they will not fail; update the constants with the raise.
- **README translations.** `README.es.md` must change with `README.md` (the `readme` skill).
- **Status union.** Do not "update" `platform/mcp-status.ts` for 7.0: the union is unchanged.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Load the companions into the run's Pi | One process per worker | Order-dependent failures in existing scenarios (Pitfall 1) | Never |
| Fixed sleeps instead of `agent_settled` and log waits | Spike-speed harness | Flaky under CI load, slow everywhere | Never |
| Faux fallback reply when the script runs out | Scenarios "pass" | Short scripts hide missing behavior | Never |
| Compare a list with `includes` | Robust to companion changes | Partial check; the review rules make it a BLOCKER | Never; filter and compare whole |
| Grant project trust in the harness and test only trusted projects | Project-scope scenarios work | Hides a likely parity gap for plugin MCP servers (Pitfall 7) | Only with an untrusted-project scenario beside it |
| `async: false` for every agent run | Works today | Background agent behavior stays unchecked | This milestone, with the gap recorded |
| Raise the CI job timeout instead of measuring | Green CI | Hides scenario cost growth | Only with a measured baseline in the same PR |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Pi faux provider | Read the script from env once per process | Arm per scenario with `setResponses()`, assert `getPendingResponseCount() === 0` |
| Pi RPC `prompt` | Treat the response as the end of the turn | Read `disposition`; wait for `agent_settled` with `aborted: false` |
| Pi `set_model` | Set it on the shared Pi | Set it only on the companion Pi |
| pi-mcp-adapter | Expect project servers in RPC | Trust plus `projectServers: "allow"`, or record the divergence |
| pi-mcp-adapter | Assert tool names from a listing | Assert the stub log's `initialize`, `tools/list`, `tools/call` |
| pi-subagents | Background (`async: true`) children in scenarios | `async: false`; children share the faux queue in process |
| pi-subagents | Leave `TMPDIR` unset | `TMPDIR` inside the run root |
| Workflow engine | Wait for a result over RPC | Read progress entries from the always-on log or the run's `.events.jsonl` |
| Hooks bridge | One dedupe key per session and reason | Dedupe the duplicate bind only; allow repeated compactions |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager companion Pi in every worker | Slower start, more memory | Start it on first use | At 8 workers on a 4-vCPU runner |
| Cold adapter metadata cache per scenario | Seconds per MCP scenario | Keep stub tool lists tiny; one server per fixture | With many MCP scenarios |
| Subagent child sessions in process | Codemode worker queueing (Pi 1.4: two workers by default, 60 s wait) | No codemode in fixtures; one child per scenario | With parallel children |
| Fixed sleeps | Every scenario costs the sleep | Event waits | Immediately |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shared `/tmp/pi-subagents-*` | Cross-run and developer-session leaks | `TMPDIR` in the sandbox |
| `npx` or `http` MCP fixtures | Network, browser launch (`open`) | Stdio `node` stub only |
| Fixture `package.json` with dependencies | npm registry access (D-PL9-10) | No dependencies, or the npm registry stand-in |
| Inherited environment in a new Pi | Real credentials reach the companions | Keep `_rpc.ts`'s allowlist; add only named variables |

## "Looks Done But Isn't" Checklist

- [ ] **Faux scenario:** its `Then` reads a host-side stand-in, not the script, and a negative control exists for the kind.
- [ ] **Faux scenario:** the script is used up exactly (`getPendingResponseCount() === 0`).
- [ ] **Companion Pi reset:** asserts the baseline command, tool, and skill set, no live stub process, no active workflow run, and an empty recorder directory.
- [ ] **Hermeticity:** no new `/tmp/pi-subagents-*` entry after a full run.
- [ ] **Project scope:** each kind where trust matters has a trusted and an untrusted scenario, or a recorded decision says why not.
- [ ] **Version raise:** every row of the Pitfall 9 table is changed, the `behavioral` CI job installs the peers, and the e2e floor test passed once.
- [ ] **Adapter conformance:** the 462,790-value property test passes against 7.0 with zero mismatches.
- [ ] **Hooks parity:** `session-start-hooks.feature` says `clear`; two compactions give two SessionStart records; the SessionEnd and `reload` questions have user answers.
- [ ] **Each divergence:** has an ID and a license in PROJECT.md or the phase CONTEXT.md.
- [ ] **CI:** the `behavioral` job's duration is recorded and inside its timeout with margin.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Faux on the shared Pi (1) | MEDIUM | Move the extensions to a companion Pi module; rerun the full suite twice with different seeds |
| Dropped records (2) | MEDIUM | Add the always-on log; replace sleeps with waits; rerun the faux scenarios 10 times |
| Tautological scenarios (4) | HIGH | Re-review every component feature against the table in Pitfall 4; add stand-in assertions and negative controls |
| Reset leaks (5) | MEDIUM | Reorder the reset; add the clean-state assertions; run with `order: random` repeatedly |
| Conformance drift (8) | MEDIUM | Re-derive `substitute.ts` for `:-`; update unit tests and the property test |
| Parallel conflicts (11) | MEDIUM | Merge in order; re-verify each touched phase right after its merge |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Faux and companions on the shared Pi | HARNESS | Full suite green twice with different random seeds; background-update scenarios unchanged |
| 2 Dropped records, idle during a turn | HARNESS | A seed scenario reads `agent_settled` and a progress entry; no sleep in `features/` |
| 3 Faux queue per process | HARNESS | Reset asserts an empty queue; a too-short script fails |
| 4 Tautological scenarios | HARNESS, each component phase | Review question 1 of the cucumber skill answered per scenario; red proofs for fixes |
| 5 Reset leaks | HARNESS | Clean-state assertions in the companion `Before()` |
| 6 Hermeticity | HARNESS, AGENTS, MCP | No new `/tmp` entries; stub log shows no network fixture |
| 7 Project trust | HARNESS, MCP, AGENTS | Trusted and untrusted scenarios; parity evidence in CONTEXT.md |
| 8 Adapter 7.0 behavior | VERSIONS | Conformance and architecture tests green against the 7.0 floor |
| 9 Pinned floors and CI job | VERSIONS | Table rows all changed; PR CI `behavioral` and e2e jobs green |
| 10 Unused-step gate and file families | HARNESS | One seed scenario per kind; `check:features` green on the harness commit |
| 11 Parallel collisions | Roadmap, HARNESS, CLOSE | Ownership table; per-merge re-verification |
| 12 Hooks parity corners | HOOKS | Updated feature and unit tests; user answers recorded with IDs |
| 13 Memory or companion as oracle | All component phases | Upstream citations in each CONTEXT.md; divergence IDs |
| 14 CI time | HARNESS, CLOSE | Recorded baseline and final duration |

## Research Flags for Phases

- **MCP:** needs `claude-code-compat-research` on plugin MCP servers versus project approval, and on `${VAR:-default}` handling, before planning.
- **HOOKS:** needs the binary checked for the PostCompact/SessionStart order and the SessionEnd reason mapping; needs user answers (Pitfall 12).
- **AGENTS:** needs a check of pi-subagents 0.84's agent-file parser against the bridge's frontmatter output, and of project-agent trust.
- **WORKFLOWS:** standard after spike 028; confirm the progress-entry shape against 3.15's source.
- **SKILLS, COMMANDS:** standard patterns; low research need beyond the `user-invocable` divergence record.

## Sources

- Spike 028: `.planning/spikes/028-model-free-harness/README.md`, `faux-extension.ts`, `faux.ts`, `run.ts` (HIGH)
- Cucumber rules: `.agents/skills/cucumber/SKILL.md`, `rules/{layout,steps,world-and-stand-ins}.md`; `scripts/check-features.mjs:238-256`; `eslint.config.js:386-513` (HIGH)
- Harness code: `features/lib/pi-process.ts` (`handleLine`, `idle`), `features/support/pi-process.ts` (`Before()` reset), `features/lib/pi-commands.ts:162-214`, `features/support/world.ts:47`, `test/e2e/_rpc.ts:156-224` (HIGH)
- Peers and CI: `scripts/install-test-peers.mjs`, `test/integration/{optional-peer,pi-mcp-adapter-peer}.ts`, `test/architecture/peer-floor.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `test/integration/adapter-expansion-conformance.test.ts`, `test/e2e/pi-peer-floor/package.json`, `.github/workflows/ci.yml` (`behavioral`, 10 min), `README.md:38-41` (HIGH)
- Product code: `platform/pi-api.ts:178-256` (RH-3, WDEP-01, ADET-02), `bridges/hooks/event-router.ts:910-924` (SSDEDUP-01), `domain/components/hook-events.ts:212-279` (D-58-06), `persistence/locations.ts:208-212`, `platform/mcp-status.ts:40` (HIGH)
- `pi-mcp-adapter@7.0.0` tarball: `CHANGELOG.md` 5.3.0-7.0.0, `dist/utils.js:122-128`, `project-server-trust.ts:265-330`, `index.ts:1664-1873`, `upgrade-notice.ts`, `metadata-cache.ts:42`, `agent-dir.ts`, `types.ts:22-29` (HIGH)
- `pi-subagents@0.84.0` tarball: `package.json`, `CHANGELOG.md` 0.74-0.84, `bundle/` tmpdir and `runner-aliases.js` (HIGH)
- `@quintinshaw/pi-dynamic-workflows@3.15.0` tarball: `package.json` (`pi.extensions`), `dist/workflow-paths.js` (HIGH)
- `@earendil-works/pi-coding-agent@1.4.0` CHANGELOG (1.4.0, `agent_settled.aborted`, `session_compact` reason) and Pi 1.3.0 `docs/{security,rpc,cli}.md` (HIGH)
- `@earendil-works/pi-ai@1.4.0` `dist/providers/faux.{js,d.ts}` (HIGH)
- Past milestones: `.planning/RETROSPECTIVE.md` (plugin-lifecycle, lifecycle-coverage, marketplace-features); `lifecycle-coverage-phases/15-.../15-VERIFICATION.md:62`, `03-.../03-VERIFICATION.md:140`, `16-.../16-01-SUMMARY.md`, `01-suite-foundation/01-0{1,4,5}-SUMMARY.md`; `plugin-lifecycle-phases/09-.../09-02-SUMMARY.md:110`, `07-.../07-02-SUMMARY.md:147` (HIGH)
- Claude Code: 2.1.316 binary grep in spike 028 (HIGH); https://code.claude.com/docs/en/hooks for SessionStart matchers and SessionEnd reasons (MEDIUM, agrees with the binary)

---
*Pitfalls research for: component-features (component behavioral tests and companion version raise)*
*Researched: 2026-10-31*
