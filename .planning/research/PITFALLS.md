# Pitfalls Research

**Domain:** Brownfield Pi extension. Milestone `mcp-builtin`: add Pi 1.5.0's built-in MCP (`pi.registerMcpServer`) as a second, equal MCP implementation next to pi-mcp-adapter 7.x. The active implementation is chosen at `session_start`. Install records keep every declared server, and verdicts are computed when read. Generated agents and hook names follow the active implementation. The adapter's leftover `-builtin:mcp` setting is cleaned up. Every MCP cucumber scenario runs under both implementations.
**Researched:** 2026-11-04
**Confidence:** HIGH overall. Most findings come from primary sources read for this report: the published tarballs of `@earendil-works/pi-coding-agent@1.5.0` (`docs/mcp.md`, `docs/extensions.md`, `docs/settings.md`, `docs/sdk.md`, `CHANGELOG.md`, `dist/core/mcp-servers.d.ts`, `dist/core/resolve-config-value.js`, `dist/core/settings-manager.js`, `dist/core/extensions/runner.js`, `dist/extensions/mcp/index.js`), `pi-mcp-adapter@7.0.0` (`index.ts`, `pi-builtin-mcp.ts`, `onboarding-state.ts`) and `pi-subagents@0.84.0` (`docs/agents.md`). Each was fetched with `npm pack` into the session scratchpad. The rest comes from this tree's source. Items marked MEDIUM rest on documentation that has not been run here. Items marked LOW are inferences. The claude-code-compat-research skill has not been run for any Claude Code claim in this file. The `classify-confidence` seam rates web tools LOW. The tarball reads are primary sources, so they are rated as the previous milestone rated them.

Proposed phase labels, used below. The roadmapper may renumber them.

| Label | Scope |
| --- | --- |
| **P-Foundation** | Pi 1.5.0 bump; the `McpImplementation` contract; detection; new closed-set vocabulary; the dual-profile cucumber harness; every frozen shared file |
| **P-Records** | Install records keep every declared server; state migration; verdicts computed at read time for `list`, `info`, partial state, and markers |
| **P-Builtin** | Built-in materialization: registration, naming, trust, variable encoding, collisions, status reader |
| **P-Adapter** | The adapter path moved onto the contract; `mcp-adapter.json` reconcile on load and apply |
| **P-Agents-Hooks** | Agent grants re-materialized per implementation; hook matchers and names |
| **P-Settings** | The `-builtin:mcp` cleanup (decision 1) |
| **P-Close** | `docs/mcp-compatibility.md` built-in column, CHANGELOG, README, milestone audit |

---

## Critical Pitfalls

### Pitfall 1: The adapter's onboarding state cannot show that the adapter wrote `-builtin:mcp`

**What goes wrong:**
Decision 1 removes `-builtin:mcp` only when the adapter is absent and its onboarding state shows that the adapter wrote the entry. `piBuiltinMcpHandledVersion` cannot show that. `pi-mcp-adapter@7.0.0/onboarding-state.ts` documents the field as "Adapter version that last turned off, **or found configured**, Pi's built-in MCP". `turnOffPiBuiltinMcp()` records the version in both cases: when it appends `-builtin:mcp`, and when it finds any `builtin:mcp` entry already there (`+`, `-`, or `!` prefix, or none). Suppose a user set `-builtin:mcp` before they installed the adapter. The marker then looks the same as one the adapter wrote, and the cleanup deletes the user's own entry. Decision 1 forbids that.

**Why it happens:**
The marker name suggests "the adapter did it". The source says "the adapter has handled this version".

**How to avoid:**
- Do not treat `piBuiltinMcpHandledVersion` alone as proof. Collect our own evidence while the adapter is loaded. At each `session_start` where the adapter is active, record whether `settings.json` held a `builtin:mcp` entry and which version the onboarding file held. The adapter's write runs asynchronously after its own `session_start` (`void import("./pi-builtin-mcp.ts").then(...)`), so our handler can usually see the state before the write. Two observations prove the adapter wrote the entry: "no entry, version unhandled", then "entry `-builtin:mcp`, version handled".
- An install that has no such evidence (the adapter was installed before this milestone shipped) is ambiguous. Take that case to the user as a question. Do not guess. Options: (a) remove the entry when it is exactly `-builtin:mcp`, is the last element, and the marker is set, and accept the rare false positive; (b) leave it and notify the user once; (c) a time heuristic on the mtimes of `mcp-onboarding.json` and `settings.json` (fragile).
- Remove only the exact string `-builtin:mcp`. Never remove `+builtin:mcp`, `!builtin:mcp`, or `builtin:mcp`.

**Warning signs:** A design doc that says "the marker shows the adapter wrote it". No unit case for "the user set `-builtin:mcp` first, then installed the adapter".

**Phase to address:** P-Settings. The question goes to the user before the phase is planned. Record the outcome as an amendment to decision 1. **Confidence:** HIGH (source read).

---

### Pitfall 2: The first Pi runtime after the adapter is removed has no MCP at all

**What goes wrong:**
Pi reads `extensions` from settings before it loads extensions. When the adapter is gone and `-builtin:mcp` is still set, `builtin:mcp` is not loaded in that runtime. Our `session_start` sees "neither implementation" and removes the line, but built-in MCP stays off until the next `/reload` or start. `/reload` re-reads settings: `agent-session.js` calls `settingsManager.reload()` before `_resourceLoader.reload()`. Two cases:
- The user ran `pi remove pi-mcp-adapter` and then started Pi. The first session has no plugin MCP.
- The user ran `pi remove` mid-session and then `/reload`. That reload still has no MCP, and a second `/reload` is needed.

The brief requires that "a switch must never require action from the user", and this breaks that requirement.

**Why it happens:**
Decision 1 removes the line only after the adapter is gone. By then the decision to skip built-in MCP for this runtime is already made. An extension cannot load `builtin:mcp` itself (only `-e builtin:mcp` or the settings can), and `ctx.reload()` exists only on command contexts.

**How to avoid:**
- State the gap in the requirements. Do not let a phase discover it.
- Ask the user whether to amend decision 1. The adapter registers `/mcp`, and Pi's built-in MCP extension is `replaceable`: `docs/sdk.md` says it "is left out when another extension registers a tool, command, or flag with a name it registers during loading", and `docs/mcp.md` says the adapter "replaces the built-in MCP support". So removing the line while the adapter is loaded would close the gap. The cost: built-in MCP then runs next to an adapter that is set not to register `/mcp`, which the adapter's line was written to prevent.
- If decision 1 stays, show one notice in the runtime that cleaned up: "Built-in MCP was turned back on; run /reload to start plugin MCP servers". Treat it as a Pi capability gap with its own decision ID, and give it a cucumber scenario.

**Warning signs:** A scenario that removes the adapter, reloads once, and expects plugin tools. If it passes, the harness is not reading settings the way Pi does.

**Phase to address:** P-Settings (behavior). The requirements step of P-Foundation records the gap. **Confidence:** HIGH (docs and source).

---

### Pitfall 3: Detection is read before `session_start`, or by a handler that runs ahead of the decision

**What goes wrong:**
`hasLoadedPiMcpAdapter` gives the right answer only after every extension has loaded. These readers can get it wrong:
- **Factory-time code.** `index.ts` calls `await hooksHydration.registerHooksBridge(pi, { cwd: homedir() })`, which hydrates user-scope hook routing during load. If hook matchers or MCP names become implementation-specific, this computes them before any companion is loaded. In the cucumber harness our extension is the first `--extension` (`test/e2e/_rpc.ts` `piArguments`), so the adapter is never loaded yet at that point.
- **Handler order inside our own extension.** Pi runs handlers "in extension load order, then registration order". The hooks bridge registers its `session_start` wrapper before `index.ts` registers its own handler. A choice made in the later handler is not ready when the hooks bridge hydrates.
- **Earlier probes.** `resources_discover` fires after `session_start` (`docs/extensions.md` lifecycle), so load reconcile and autoapply are safe only if they read the choice made at `session_start`. A second probe could disagree with the first.
- **`/reload` after a mid-session `pi install pi-mcp-adapter`.** The old runtime keeps built-in MCP until `/reload`. The new runtime gets a new `session_start`, which is correct, but anything cached at module level from the first runtime goes stale. W4 in the last milestone audit: Pi builds a new runtime and tool registry on every `session_start`.

**Why it happens:**
`softDepStatus` is called on demand per notification run (D-05), so the code has never had one owner for "which implementation is active".

**How to avoid:**
- Make one memoized per-runtime resolver, `activeMcpImplementation()`, read from the inventory on first access after load. Register its `session_start` handler first in the factory, before `registerHooksBridge`. Every reader (hooks, load reconcile, autoapply, `list`, `info`, agents, the background autoupdate) asks the resolver. None of them probes on its own.
- Ban factory-time reads with an architecture test or a fallow rule: no `softDepStatus` and no `activeMcpImplementation` call outside event or command handlers.
- Use three states: adapter, builtin, none. Built-in MCP counts as active only when `getCommands()` lists an `mcp` command whose source is `builtin` with path `builtin:mcp`. It is inactive under `--no-mcp`, `-ne`, `-builtin:mcp` in user or project settings (project settings override user settings, per `docs/settings.md`), in SDK sessions (which load no built-in extensions), and when a third extension has replaced it.

**Warning signs:** A unit test that builds the hooks bridge with a fake inventory and no `session_start`. A scenario whose result depends on `--extension` order.

**Phase to address:** P-Foundation (the resolver and the ban). P-Agents-Hooks consumes them. **Confidence:** HIGH.

---

### Pitfall 4: Both implementations end up serving the same server, or a registration becomes an extension error

**What goes wrong:**
- When the adapter is loaded it handles `mcp_servers_change`, which "marks the extension as the one that connects registered servers". Its `applyPiMcpServers` takes every Pi registration and starts it as a proxy-only runtime server. It strips `directTools`, so `alwaysLoad` is lost, and it warns "ignored settings ...". Any registration we make while the adapter is active is served twice: once from `mcp-adapter.json` and once as a runtime server. The adapter then reports "is overridden by the configured server of the same name".
- When neither implementation handles `mcp_servers_change`, `runner.js reportUnhandledMcpServers()` emits an extension error for each registration: "is registered, but no loaded extension connects MCP servers".
- `registerMcpServer` **throws** for invalid names, invalid configs, and names another extension registered. One bad server can abort a loop that registers every server.

**How to avoid:**
- Register only when the resolver says builtin. When it says adapter or none, register nothing.
- Register each server inside its own try/catch, report the failure through `notify()` with a closed-set reason, and keep going.
- Validate first with `validateMcpServerConfig` (exported by `mcp-servers.d.ts`), mirrored in `platform/pi-api.ts` (NFR-11 chokepoint), so a refusal becomes a verdict and not a throw.
- Cucumber: an adapter-profile scenario asserts that the adapter reports no "registered by" notice. A none-profile scenario asserts that there are no extension errors. `RpcExchange.extensionErrors` already collects them.

**Warning signs:** Adapter notices containing "registered by .../pi-claude-marketplace". Extension errors whose event is `register_mcp_server`.

**Phase to address:** P-Builtin. **Confidence:** HIGH.

---

### Pitfall 5: A user's `mcp.json` or a leftover legacy entry silently overrides our registration

**What goes wrong:**
In built-in MCP, `mcp.json` wins. `registeredServers()` in `dist/extensions/mcp/index.js` drops any registration whose `mcpNamespace` (the name with `-` folded to `_`) matches a configured entry. So `my-srv` and `my_srv` collide. Built-in MCP reads `~/.pi/agent/mcp.json` and the trusted project's `.pi/mcp.json`. This extension used to write plugin servers into exactly those files (the "legacy entries" NFR-10 still allows). AMIG-01 moves them to `mcp-adapter.json` during `resources_discover`. That is too late: built-in MCP has already loaded `mcp.json` at `session_start`. In the first built-in session, a stale adapter-format entry (with `_piClaudeMarketplace` marker, `directTools`, `toolPrefix`, adapter `$env:` encodings) wins over our fresh registration, or is rejected with a config warning. Under the adapter, ANAME-03 refuses a folded-name collision at install. Under built-in MCP, `mcp.json` can change between sessions, so install-time refusal cannot cover it.

**How to avoid:**
- At registration, read `getMcpServers()` and the built-in MCP's overridden list (if Pi exposes it; research it). Report "overridden by mcp.json" as a verdict in `info` and as a load warning. Never report "connected".
- Run the AMIG-01 legacy move at the start of P-Builtin's materialization pass, or before it. Add a scenario: a legacy `mcp.json` plugin entry and built-in MCP active, then the first session. Expect the moved entry or an explicit warning, never the stale server.

**Warning signs:** `info` says connected, but the tools that answer come from the user's server.

**Phase to address:** P-Builtin. The legacy-move ordering may need P-Adapter. **Confidence:** HIGH (source read); the legacy interaction is MEDIUM (not run).

---

### Pitfall 6: Variable encoding is written for the adapter, and built-in MCP reads `$` and `!` differently

**What goes wrong:**
`bridges/mcp/substitute.ts` and `adapter-escape.ts` write Claude's variables in the adapter's encoding and leave `${NAME}` and `${NAME:-default}` for the adapter to expand at connect time (D-CF1-13). Pi's `resolve-config-value.js` behaves differently:
- It expands **only** `env` values, `headers` values, and `oauth.clientSecret`. It does not expand `command`, `args`, or `url`, which Claude does expand.
- It expands `$NAME` as well as `${NAME}`. A literal `$FOO` in a Claude value becomes an expansion.
- It has no `:-default`. `${NAME:-x}` is not a valid name, so it stays literal text.
- An unset variable makes the whole value undefined, and `resolveConfigValueOrThrow` makes the server fail to connect. Claude keeps the literal text and reports it as missing (AVAR-02).
- A value that **starts with `!`** runs as a shell command (cached, 10 s timeout). A plugin whose remote header value is literally `!...` gets local command execution under built-in MCP. Under Claude Code and the adapter it is a string.
- Escapes: `$$` becomes `$`, and `$!` becomes `!`.

**How to avoid:**
- Give each implementation its own encoder in the contract. The built-in encoder resolves every Claude reference at registration time, at `session_start`, from the current environment. This keeps connect-time semantics, because registration happens on every load. It applies the AVAR-05 deny-list itself, then escapes the result: every `$` to `$$`, and a leading `!` to `$!`.
- Resolved values exist only in memory. Never persist them (see Pitfall 8).
- Unit-test the encoder against the copied Pi resolver behavior: `$`, `${`, a leading `!`, an unset variable, and a default containing `$`.

**Warning signs:** Built-in scenarios pass only with variables that are set. A header test with no `$` in it.

**Phase to address:** P-Builtin. **Confidence:** HIGH (source read).

---

### Pitfall 7: Built-in MCP server and tool names differ from the adapter's, and hooks, agents, and expectations embed them

**What goes wrong:**
- **Trailing `_`.** `generatedMcpServerKey` returns `plugin_<p>_<s>_` with a trailing `_`, because the adapter names tools `<toolPrefix>__<key>_<tool>`. Reused for built-in MCP, that key gives `mcp__plugin_p_s___tool` (three underscores). The built-in server name must be `plugin_<p>_<s>`.
- **`-` becomes `_` in both parts.** Built-in MCP replaces every character outside `[A-Za-z0-9_]` with `_` in the server name and in the tool name: `get-issue` becomes `get_issue`. Claude Code and the adapter keep `-`. Hook matchers (`mcp__plugin_x_my-srv__.*`), `tool_name` in hook stdin, agent `tools:` grants, and cucumber expectations all carry the Claude form.
- **Hash suffixes.** "Tools of a server whose names then collide all get a hash suffix": `get-x` and `get_x` in one server get names nobody can predict.
- **Collisions between plugins.** Plugin `a-b` with server `c` gives `plugin_a-b_c`. Plugin `a` with server `b-c` gives `plugin_a_b-c`. Both fold to `plugin_a_b_c`. "A second one is rejected", so which plugin wins depends on registration order.
- **The same plugin in both scopes.** Both registrations come from our extension, and "registering the same name again replaces the extension's earlier registration". The last scope registered wins with no message.

**How to avoid:**
- Naming belongs to the contract. Each implementation provides `serverName(plugin, server)`, `toolName(server, tool)`, `agentGrant(...)`, and `foldKey(...)`. Keep the shared `mcpServerDisplayName` (`plugin:<p>:<s>`) as the one source.
- Detect folded collisions at read time across both scopes, in a fixed order (project over user, as `mcp.json` does). Report the losing server as a verdict. Do not let registration order decide.
- Hooks: match a Claude matcher against the Claude-form name rebuilt from our registration table, as well as the Pi name. Pass the Claude form in hook stdin when it can be rebuilt. Record the remaining divergence, where `-` vs `_` in a tool name cannot be recovered without the server's raw tool name, under its own decision ID as a Pi capability gap. The brief already names it.
- Cucumber: an implementation-specific scenario per divergence, with the decision ID in its title (the layout rule from P6-DC-12).

**Warning signs:** A shared step expectation with a literal `mcp__plugin_...` in it. Any use of `generatedMcpServerKey` in built-in code.

**Phase to address:** P-Builtin (names, collisions). P-Agents-Hooks (matchers, stdin, grants). P-Foundation (naming in the contract). **Confidence:** HIGH (Pi docs and repo source); hook name recovery is MEDIUM.

---

### Pitfall 8: Reshaping install records puts absolute paths and possible secrets in `state.json`, and cannot recover what earlier installs dropped

**What goes wrong:**
- The brief says to record each server "after plugin-variable substitution". Substitution writes absolute `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` paths, and `${CLAUDE_PROJECT_DIR}` at project scope. `state-io.ts` states that "state.json never holds absolute paths". Projects get moved or renamed, and `PI_CODING_AGENT_DIR` can change. Under D-LOC-01, project plugin data sits inside the repository. Literal tokens inside plugin `headers` would also be copied into `state.json`.
- Existing records hold only `resources.mcpServers`, the adapter keys that were written. Servers the adapter blocked were dropped, and their configs exist nowhere in the state. Re-reading them from the plugin root is not the same revision. A path-source plugin's root is inside the marketplace clone, and `marketplace update` moves that clone without updating the plugin. A git-source plugin can be pinned through `resolvedSha`.
- The persisted `compatibility` block (`installable`, `supported`, `unsupported`) was computed against the adapter and goes stale the moment verdicts are computed at read time.
- APL-D1 says a load changes no installation state. A backfill at load breaks that unless it is classified as a schema migration (the `ensurePluginResources` precedent in `persistence/migrate.ts`).

**How to avoid:**
- Record the pre-substitution, Claude-shaped server map after merging (`.mcp.json` with declared `mcpServers`, D-CF6-01). Substitute at materialization, for both implementations.
- Add the new field as optional and additive, with no `schemaVersion` bump (the `resolvedSha` and `hookEntries` precedent). Absence means "this record predates the key".
- Backfill in this order: (1) re-resolve from the record's own revision when it is exact (git sources with `resolvedSha`, or a path source whose recorded `version` hash still matches the on-disk root); (2) otherwise leave the record without the field, mark it "needs refresh", and let `apply` re-materialize it. That keeps NFR-2: `apply`, then `/reload`. An absent field must never mean "no servers".
- Stop reading persisted `compatibility` for MCP. Derive the MCP part at read time. Keep the stored block for the other kinds.

**Warning signs:** A record fixture with `/home/` in it. A migration that reads the plugin root without checking the version. `info` output that differs before and after `apply` with no code change.

**Phase to address:** P-Records. **Confidence:** HIGH (source); the backfill strategy is MEDIUM.

---

### Pitfall 9: The partial state changes between sessions, and the `--partial` consent gates read the old verdict

**What goes wrong:**
With verdicts computed at read time, the same plugin can be fully supported under the adapter (SSE, `headersHelper`, prompts) and partial under built-in MCP, or the reverse (`cwd`, which the adapter drops). Installing or removing the adapter flips it with no user action. Several flows gate on partial consent: install's `--partial`, and `convergeScope` / APL-02 ("a move that needs `--partial` consent is reported and not run"). Gated on the read-time verdict, an `update` or `apply` of a plugin the user installed without `--partial` stops after a switch. Gated on the install-time verdict, the plugin runs partially without consent.

**How to avoid:**
- Decide the rule and give it an ID before P-Records. Recommended: consent is required only for components the plugin declares that are unsupported by **every** implementation (the static part). Implementation-dependent MCP gaps are reported at read time (a marker, plus a load warning on the first session after a switch) and never block update or apply.
- Show the flip once per switch. Keep the last-seen implementation per scope (in memory, or in a small non-installation file) so the load can say "plugin X is now partially available under built-in MCP: server Y needs SSE".

**Warning signs:** `apply` reports "needs --partial" right after the adapter is uninstalled.

**Phase to address:** P-Records. **Confidence:** MEDIUM (design inference from the reconcile code and the APL-02 docs).

---

### Pitfall 10: Rewriting generated agents on `/reload` races pi-subagents' snapshot, the state lock, and background runners

**What goes wrong:**
- Grants differ by implementation: `mcp:plugin_x_s_` under the adapter, `mcp:plugin_x_s` under built-in MCP. pi-subagents docs say the server part may use the `-`→`_` form.
- pi-subagents' "file catalog snapshot refreshes at session start/reload ... External file or settings edits require `/reload`." If pi-subagents loads before our extension, its `session_start` reads the old files, and our rewrite lands one runtime late. Whether launches re-read files or use the snapshot is not documented.
- Background children run our extension in the runner process ("Servers that an extension adds with `pi.registerMcpServer()` work in background children, because the registering extension loads there too"). Each child's `session_start` would also try the rewrite. The state lock is `proper-lockfile` with `retries: 0`, so concurrent starts get `StateLockHeldError`.
- A rewrite is an installation-state change at load (APL-D1 again).
- A write that fails partway leaves mixed grants across agent files and `agents-index.json`.
- W2 from DC-44 stops holding. Its proof was that "every way a declared server can go unwritten throws in the mcp stage". Under built-in MCP a server can fail at `session_start` registration (a collision, an invalid name, an `mcp.json` override) after the agent was granted it.

**How to avoid:**
- First research whether launches read the agent files fresh. If they do, rewriting at `session_start` is enough. If they do not, show the "reload once" gap the same way as Pitfall 2.
- Rewrite only when the bytes differ. Skip quietly on `StateLockHeldError`, because another process will write the same bytes. Skip in untrusted projects.
- Stage every agent file and the index for a scope, then commit them with renames under the scope's lock (the existing agents stage/commit/unstage triplet). On failure, keep the old set whole.
- Compute grants from the servers that actually registered (the result of the P-Builtin pass), not from the resolver's server set.
- Leave the `async: true` rule (D-CF6-10) as it is. It still applies: registered servers fail in foreground children too. Change the warning text, which names pi-mcp-adapter, to name the implementation.

**Warning signs:** A scenario that switches implementation and launches an agent with no `/reload`. A `StateLockHeldError` notice at session start.

**Phase to address:** P-Agents-Hooks. Decision IDs: an APL-D1 amendment for the rewrite at load. **Confidence:** MEDIUM (pi-subagents docs only; not run).

---

### Pitfall 11: The settings.json cleanup breaks atomicity, a symlinked dotfiles link, Pi's lock, or a Pi write that comes later

**What goes wrong:**
- Pi's `SettingsManager.withLock` uses `proper-lockfile.lockSync(path, { realpath: false })` (lock directory `settings.json.lock`, 10 retries of 20 ms). It re-reads the file and merges only the top-level fields it changed, then writes with `JSON.stringify(merged, null, 2)` through a plain `writeFileSync` (not atomic, no trailing newline). The adapter writes through the same code.
- A write without that lock can interleave with Pi's or the adapter's read-modify-write.
- `write-file-atomic` replaces a **symlinked** `settings.json` (`~/.pi` linked into a dotfiles repository; Pi 1.5.0's changelog mentions this setup) with a plain file.
- A running Pi keeps its `extensions` array in memory. If the user changes any extension setting later in that session (`pi config`, `/settings`), Pi writes the whole `extensions` field from its stale snapshot. That puts `-builtin:mcp` back.
- Background runners and parallel Pi processes all run the cleanup at the same moment.
- Only the user file is the adapter's: `turnOffPiBuiltinMcp` uses `getGlobalSettings()`. A project `.pi/settings.json` entry is always the user's own.

**How to avoid:**
- Amend NFR-10 by adding exactly one path, `<getAgentDir()>/settings.json`. Never touch `.pi/settings.json`.
- Take Pi's lock on the same path string, with `realpath: false` and a few short retries. Inside the lock: resolve `realpath` for the write target; check again that the adapter is absent, the marker is set, and the exact entry is present; parse after stripping a BOM; if parsing fails, do not write and report it; remove only the one exact element; keep key order and every other field; write `JSON.stringify(x, null, 2)` (Pi's own format, so the diff is that one element) atomically to the real path. Keep the file mode.
- This needs rule-pack exemptions (`proper-lockfile-chokepoint`, possibly `write-file-atomic-chokepoint`) or a new platform module. `rule-packs/architecture.json` is a shared file; change it in P-Foundation.
- Do not use Pi's `SettingsManager` through `platform/pi-api.ts`. It is not atomic (NFR-1), and the adapter's call to it creates a full manager. If the user prefers Pi's merge semantics anyway, that is a recorded tradeoff.
- Tests that need an unreadable or locked file must run under the `nondac-sh` wrapper (Pitfall 18).

**Warning signs:** A plain file where a symlink was. A trailing-newline-only diff in a user's settings. A cleanup test that passes as root without the wrapper.

**Phase to address:** P-Settings (rule-pack change in P-Foundation). **Confidence:** HIGH (source read).

---

### Pitfall 12: The dual-profile cucumber harness silently runs MCP scenarios under one implementation only

**What goes wrong:**
- **The shared Pi is already "builtin".** It loads only the real extension, never passes `--no-extensions` (to keep `builtin:mcp`, `_rpc.ts`), and loads no adapter. Once this milestone lands, every lifecycle scenario in `features/plugin` and `features/marketplace` that installs an MCP plugin under the shared Pi switches from "requires pi-mcp-adapter" to builtin. Its markers, partial states, and notices change in many feature files that MCP phases do not own.
- **Companion lists are hard-coded.** `companion.steps.ts` ("pi runs with the scripted model and these companions:") and `listing.steps.ts` (`companions: ["pi-mcp-adapter"]`) name the adapter directly, so such a scenario runs under the adapter in both profiles.
- **"None" cannot be reached.** The harness can pass only `--extension`. Reaching "none" needs `--no-mcp` or `-builtin:mcp` in the sandbox settings, and both `world.ts` and `_rpc.ts` were frozen shared files last milestone.
- **`features/mcp-server/companion-missing.feature` changes meaning.** The adapter missing now means builtin, not "requires".
- **Registrations leak across scenarios.** The shared Pi keeps one runtime across scenarios until the next `session_start`. Built-in MCP spawns real stub processes, and HAR-05's `assertStandInsStopped` runs only for profile Pis.
- **Asymmetric speed.** The adapter profile always needs a profile Pi (13 to 27 s cold start, `PROFILE_PI_START_TIMEOUT_MS = 90_000`). Built-in MCP can reuse the shared Pi.

**How to avoid:**
- Select the implementation through a world parameter (`cucumber.json` profiles `adapter` and `builtin`, `worldParameters.mcp`). Steps decide whether to add `pi-mcp-adapter` from that parameter. A scenario never names the adapter in a companion table unless it is tagged as an adapter-only divergence scenario.
- After any profile Pi starts, assert that the active implementation the extension reports equals the profile. Expose it through an existing read-only surface, such as `info`'s status line or a debug entry, so a misrouted scenario fails instead of passing.
- Add an architecture test like `behavioral-shard-coverage.test.ts`. Every feature file that installs an MCP plugin must be tagged `@mcp` (runs under both). Divergence scenarios are tagged `@adapter-only` or `@builtin-only` and carry a decision ID. No `@mcp` scenario names the adapter as a literal.
- Make built-in MCP scenarios use a profile Pi as well, for isolation (its stand-ins stop with HAR-05), or reset the shared Pi with a new session and assert stand-ins stopped.
- Land the harness changes in P-Foundation, before any fan-out.

**Warning signs:** The builtin profile's scenario count equals the adapter profile's minus nothing, so tags are not filtering. Scenarios pass under both profiles with identical tool names.

**Phase to address:** P-Foundation. **Confidence:** HIGH.

---

### Pitfall 13: CI time and shard bookkeeping when MCP scenarios run twice

**What goes wrong:**
- `npm run check` includes `test:cucumber` (`package.json`), so a second profile adds a full second cucumber start and peer check locally too.
- The `behavioral` job shards by path. Adding the same paths under a second profile entry makes `test/architecture/behavioral-shard-coverage.test.ts` fail ("one inside two shards runs twice").
- Every timeout must stay at 1.5 times or more of the measured hosted run, and never below 15 minutes (D-CF1-16 note in `ci.yml`). The components shard was 215 scenarios in 2 min 26 s locally (DC-32 item 7). The hosted run was never re-measured.
- Under built-in MCP, servers connect in the background ("the first prompt waits up to 10 seconds only for servers with direct tools"). A status or listing step that reads right after start races the connection. P6-DC-11's 250 ms quiet window already flipped once under 8 workers.

**How to avoid:**
- Add a profile axis to the matrix (for example `components-adapter` and `components-builtin`), and teach the shard test that the pair `(profile, path)` must be unique, not the path alone. `ci.yml` and the shard test are both shared files for P-Foundation.
- Make `npm run check` run both profiles in one `cucumber-js` call if the cucumber version can do that, or as two sequential runs, and say so in `local-verification`.
- Wait on a readiness signal. For built-in MCP, `tool_search` "waits for all" servers, and `getAllTools()` lists `mcp__<server>__*` once connected. Poll with a deadline (the P6-DC-15 pattern) instead of a fixed quiet window.
- Measure the hosted run after the first dual-profile merge and set timeouts from it.

**Warning signs:** The shard test fails on the first matrix edit. A builtin listing scenario that fails about one run in twenty.

**Phase to address:** P-Foundation (matrix, shard test); every MCP phase (waits). **Confidence:** HIGH (repo); timing MEDIUM.

---

### Pitfall 14: Project trust is gated in the parent only, or read once and trusted forever

**What goes wrong:**
Registered servers bypass Pi's project trust gate (brief, verified in `docs/mcp.md`: only `mcp.json` reading is trust-gated). If project-scope servers register when `ctx.isProjectTrusted()` is false, an untrusted repository's plugin starts processes. Background runners load our extension too and must check trust themselves. Trust is resolved at startup and again on `/resume` into a new working directory. Registration must use `ctx.cwd` at `session_start`, not `homedir()`, `process.cwd()`, or the factory's `cwd`.

Pi 1.5.0 changed `ctx.isProjectTrusted()`: a saved "Do not trust" now wins over auto-trust for folders without trust-requiring resources (CHANGELOG, #10947). Untrusted-profile scenarios may flip after the bump.

The adapter path keeps the adapter's own approval for project servers (P6-DC-03). Built-in MCP has no approval step, so the two implementations differ in what a user sees for project servers. Claude Code parity favors no prompt (the P6 claim, MEDIUM).

**How to avoid:**
Gate per registration on `ctx.isProjectTrusted()` in every runtime. Add a builtin-only scenario for an untrusted project: the servers do not start, and the stub log stays empty. Run the full untrusted-profile set after the Pi bump, and record any flip. Record the approval difference as an implementation-specific scenario with a decision ID.

**Warning signs:** A stub log entry in an untrusted builtin scenario.

**Phase to address:** P-Builtin; the bump re-run in P-Foundation. **Confidence:** HIGH.

---

## Moderate Pitfalls

### Pitfall 15: Built-in MCP field semantics differ from Claude Code's

- `timeout`: Claude uses milliseconds (`mcp-server-features.ts`: minimum 1000 ms, capped, `request_timeout_ms` as a fallback). Built-in MCP uses **seconds**. Convert in the built-in translation table. Never copy the value.
- `cwd`: built-in MCP resolves a relative `cwd` against the session directory and expands a leading `~/` in `command`, `args`, and `cwd`. What Claude Code resolves it against is not verified; run claude-code-compat-research.
- Exposure: built-in MCP defaults to `codemode`. Decision 2 needs an explicit `exposure: "deferred"`, or `"direct"` for `alwaysLoad`. `deferred` needs `tool_search`. With `-builtin:tool-search`, or a `tool_search` replacement that declares no `reachesTools`, deferred tools cannot be reached. Detect that and pick a verdict or a fallback with a decision ID.
- Each `alwaysLoad` (`direct`) server makes the first prompt wait up to 10 s. A broken one delays every session's first prompt.
- Built-in MCP has no SSE (rejected), no `headersHelper`, no elicitation, no sampling, and no prompts. These belong in the built-in verdict table as blocked, never sent to `registerMcpServer`.
- `/mcp` changes to exposure or enabled state for registered servers last only for the current session. A user cannot keep one plugin server disabled across sessions the way `/mcp-adapter disable` does. Document it; do not emulate it.

**Phase:** P-Builtin. **Confidence:** HIGH (Pi docs); the Claude `cwd` rule is LOW.

### Pitfall 16: There is no built-in status channel, so `info` cannot tell connecting from failed

`platform/mcp-status.ts` reads the adapter's `pi-mcp-adapter/status/v1`. Built-in MCP exposes `getMcpServers()` (registrations only) and `getAllTools()` (tools once connected). A server that failed and one still connecting both show "no tools". Research whether Pi exposes connection state to extensions. If it does not, `info` shows "registered" and "tools: N" only. Do not invent "failed". Scenarios poll until tools appear.

**Phase:** P-Builtin. **Confidence:** MEDIUM.

### Pitfall 17: The registration side effect sits outside the install ledger

If `install` or `enable` registers immediately under built-in MCP ("later registrations connect at once"), and `uninstall` or `disable` unregisters, the 7-phase ledger's `mcp` phase must undo the registration on rollback. That breaks the rule that bridges only touch disk. The alternative is to register only at `session_start` and keep the `/reload` hint, as under the adapter. Either is defensible, and the two lead to different scenarios and reload hints for each implementation. Decide and record it. Recommended: register only at `session_start`, for parity and so the ledger stays as it is.

**Phase:** P-Builtin. **Confidence:** MEDIUM.

### Pitfall 18: Root-container DAC, worktree hooks, and other environment facts

Taken from `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md` "ENVIRONMENT FACTS". Every executor must get them:
- About 167 chmod-based cases fail as root. Run every npm script and hooked commit with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. The settings cleanup's "unreadable or locked settings.json" cases depend on this.
- Warm ESLint with a lone `npm run lint` first, because a cold run can run out of memory.
- In `.claude/worktrees/...` the commit hook may check nothing. Run `check:static` and the tests by hand before committing.
- Use `env -u GH_TOKEN -u GITHUB_TOKEN` when zizmor fails with 401.
- Give each executor its own scratchpad subfolder.
- Declare deletions in `files_deleted`.
- `check evaluation-scope` reporting 0 commits is expected.

**Phase:** All. Put them in the fan-out brief. **Confidence:** HIGH.

### Pitfall 19: 100% direct coverage, the complexity limits, and duplication gates on two parallel implementations

- `fallow dupes --fail-on-issues` fails on **every** clone group (fallow 3.32 and later). `features/` and `test/` are analyzed (only `.pi/**` and `.planning/**` are ignored). "Some duplication is expected" therefore still has to be paid for. Factor shared steps and shared verdict-table machinery. Where two implementations truly mirror each other, use an inline `fallow-ignore-next-line code-duplication -- <reason>` marker, which goes stale silently when the span changes (CONVENTIONS).
- Fallow and ESLint each cap cognitive complexity at 15, computed differently. Write verdict and translation tables as data (`ReadonlyMap` of field to rule), not as if-chains for each implementation.
- Direct coverage: each new source file needs a paired test that covers it alone. Built-in code calling `pi.registerMcpServer` gets the Pi surface by injection (a `PiMcpRegistry` port in `platform/pi-api.ts`), not through a `_setForTest` seam.
- Boundary zones: the agents and hooks bridges may not import `bridges-mcp`. Put the contract and the naming in `domain/` (pure) or `shared/`. Implementations live where their effects are (built-in registration needs the Pi peer, so `platform/` plus an orchestrator; the adapter writer stays in `bridges/mcp`). Agents and hooks get naming by injection.

**Phase:** P-Foundation (contract placement); all phases (gates). **Confidence:** HIGH.

### Pitfall 20: Parallel child sessions conflict in frozen shared files and closed sets

Lessons from component-features (child brief, DC-27, DC-32 merge notes):
- **Land shared files before fan-out.** These go in P-Foundation, then freeze: `package.json`, `package-lock.json` (Pi 1.5.0, `@earendil-works/pi-ai` exact `1.5.0` for the faux provider, `pi-tui`, the peer floor `>=1.5.0`), `platform/pi-api.ts` (registration mirror, detection), `features/support/world.ts`, `features/lib/companions.ts`, `test/e2e/_rpc.ts`, `cucumber.json`, `.github/workflows/ci.yml`, `.fallowrc.json`, `rule-packs/architecture.json`, and the `McpImplementation` contract itself. Without a frozen contract, two sessions (adapter refactor and built-in) shape it two different ways.
- **Closed sets.** Every new reason or marker (for example "requires MCP support", "overridden by mcp.json", "server not registered", "built-in MCP re-enabled, run /reload") goes into `shared/notification-types.ts` and `docs/output-catalog.md` in P-Foundation, each as its own commit. Name them per `docs/messaging-style-guide.md`.
- **Parent lines.** Child sessions never edit `CHANGELOG.md`, the READMEs, `.planning/PROJECT.md` Key Decisions or Constraints (NFR-10 and the decision-1 amendment), or `.planning/BACKLOG.md`. They list them as "Parent lines".
- **Shared docs.** `docs/mcp-compatibility.md` gets one owner (P-Close) and one column per implementation. Phases send it rows as parent lines.
- Merge by merging, never rebase. ROADMAP and STATE conflicts stay in the tracking tables (DC-32).

**Phase:** P-Foundation (freeze); parent session (merges). **Confidence:** HIGH.

### Pitfall 21: Pi 1.5.0 bump regressions

- Tool argument validation now runs on pi-schema. The extension uses no `Type.Refine`, `BigInt`, `Undefined`, or codecs (verified by grep). Two things still change: messages the model sees for invalid arguments, and coercion (numeric strings to numbers, a single value wrapped into an array). A scenario that expected our tools to reject a numeric string now gets it accepted. No current feature matches Pi's validation text; the `must be boolean` hits are our own config validator.
- `@earendil-works/pi-ai` is pinned exactly at `1.4.0` for the faux provider. Raise it with the agent, or the scripted model loads a mismatched pi-ai.
- The e2e job's "Install exact Pi peer-floor fixture" must move to 1.5.0.
- The trust change (Pitfall 14).
- "Tightened system prompt": no known assertion depends on it; check scripted-model scripts that match prompt text.
- Extension-update changelog notices appear on a fresh launch after a package update. They should not appear for `-e` companions, but the harness compares notices as complete sets, so watch for new notice records.
- `PROJECT.md` Constraints still says the peer is `>=1.0.0`, while `package.json` says `>=1.4.0`. Fix both lines in the bump.

**Phase:** P-Foundation. **Confidence:** HIGH (CHANGELOG); the notice effect is LOW.

---

## Minor Pitfalls

- **Every built-in session starts every server.** "Pi connects every enabled server in the background when a session starts." The adapter can start servers lazily. With many plugins, each session and each background runner starts every plugin's stdio server. This is a Pi capability gap; note it in `docs/mcp-compatibility.md`.
- **Tool-name length.** `mcp__plugin_<plugin>_<server>__<tool>` can exceed provider tool-name limits. Claude Code has the same problem. Check what Pi does (LOW).
- **Codemode bypasses hooks.** If a user switches a plugin server to `codemode` in `/mcp`, calls from codemode scripts probably fire no `tool_call` events, so PreToolUse hooks do not run (LOW, not verified). Document it with exposure.
- **A third MCP extension.** One that replaces `/mcp` and handles `mcp_servers_change` would serve registrations, but detection says none. Accept it and document it.
- **`isMcpProxyCall` (D-CF5-12)** applies only under the adapter. Built-in names always contain `__<tool>`, so it cannot misfire. Keep it behind the adapter implementation so a later Pi tool named `mcp__x` cannot be swallowed.
- **Adapter tool-metadata cache.** After switching to the adapter, "restart Pi before relying on direct tools" (pi-subagents docs). An `alwaysLoad` grant may fail in the first adapter session. This is an adapter capability gap to document.
- **Do not skip the adapter's write.** The adapter writes `-builtin:mcp` again for each new adapter version. A later uninstall then needs the cleanup again; the cleanup must stay idempotent and never fight the adapter while it is loaded.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
| --- | --- | --- | --- |
| Reuse `generatedMcpServerKey` for built-in names | No new naming code | Triple-underscore tool names; every hook and grant is wrong | Never |
| Probe `softDepStatus` wherever it is needed | No resolver plumbing | Readers disagree; factory-time reads are wrong (Pitfall 3) | Never |
| Store post-substitution configs in `state.json` | Read-time verdicts with no substitution step | Absolute paths, a stale `CLAUDE_PROJECT_DIR`, copied tokens | Never |
| Back-fill old records from the current plugin root at load | No `apply` needed after upgrade | Registers a revision the user never installed | Only when the recorded version still matches the root |
| One shared step file with `if (profile === "builtin")` branches | Fewer files | Cognitive-15 failures; scenarios that silently run under one profile | Never; split into implementation scenarios |
| `fallow-ignore` markers on mirrored implementation code | Gate green fast | Markers go stale silently when spans change | Only on reviewed pairs, with a `--` reason |
| Pi's `SettingsManager` for the cleanup | Pi's own lock and merge | Not atomic (NFR-1); full-manager side effects | Only if the user accepts it with a decision ID |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
| --- | --- | --- |
| `pi.registerMcpServer` | Registering while the adapter is loaded; a throw aborts the loop | Register only under builtin; validate first; try/catch per server |
| Built-in MCP and `mcp.json` | Assuming our registration wins | `mcp.json` wins after the `-`/`_` fold; report "overridden" |
| Pi config-value resolver | Writing adapter-encoded `${NAME:-x}` and `$` | Resolve at registration; escape `$` to `$$` and a leading `!` to `$!` |
| pi-mcp-adapter `applyPiMcpServers` | Expecting it to keep `alwaysLoad` | It drops `directTools`; never feed it registrations |
| Adapter onboarding state | Reading `piBuiltinMcpHandledVersion` as "the adapter wrote it" | It is also set when the entry was found; collect our own evidence |
| Pi settings lock | Writing `settings.json` without `settings.json.lock` | Take the same `proper-lockfile` lock (`realpath: false`) |
| pi-subagents | Assuming grants are read at launch | The catalog snapshot refreshes only at `session_start` and `/reload`; verify launch behavior |
| pi-subagents background runner | Forgetting our extension runs there | Trust gate, lock tolerance, and no duplicate cleanup in every runtime |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
| --- | --- | --- | --- |
| Built-in MCP starts every enabled server at each session start | Process count grows with plugins and with background children | Do not register disabled plugins' servers; document the gap | Roughly 10 or more MCP plugins, or frequent subagents |
| `alwaysLoad` (`direct`) servers delay the first prompt | 10 s first-prompt stalls | Use `direct` only for `alwaysLoad`; show broken servers in `info` | Any broken `alwaysLoad` server |
| Profile Pi per MCP scenario under both profiles | Components shard nears its 15 min timeout | Profile matrix axis; measure hosted; 1.5x rule | About 2x the current MCP scenario count |
| Rewriting agents on every `session_start` | Lock contention; disk churn | Write only when bytes differ | Many agents, many background children |

## Security Mistakes

| Mistake | Risk | Prevention |
| --- | --- | --- |
| Registering project servers without `ctx.isProjectTrusted()` | An untrusted repository starts processes or connects remote servers | Gate per runtime, background runners included |
| Passing a leading `!` through to built-in `env` or `headers` | A plugin that declares only a remote server gets local shell execution | Escape `$!`; test it |
| Expanding deny-listed variables for built-in MCP | Credentials reach remote sinks (AVAR-05) | Apply the deny-list in the built-in encoder before escaping |
| Persisting resolved configs | Secrets and absolute paths in `state.json` | Persist the pre-substitution form; resolve in memory only |
| Removing a user's own `-builtin:mcp` | Turns MCP on against the user's choice | Exact-entry match plus our own evidence (Pitfall 1) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
| --- | --- | --- |
| A silent partial flip after the adapter is removed | Tools disappear with no reason | One load warning per switch that names each server and its reason |
| The marker still says "requires pi-mcp-adapter" | Wrong advice under builtin | Markers per implementation; "requires MCP support" only for none |
| "Run /reload" twice after uninstalling the adapter | Feels broken | Pitfall 2: amend decision 1, or one clear notice |
| `/mcp` disable for a plugin server does not persist | The server comes back next session | Document it; point to `/claude:plugin disable` |
| Hook matchers with `-` silently stop matching | Hooks do not fire | A load warning for MCP matchers containing `-` under builtin, plus a decision ID |

## "Looks Done But Isn't" Checklist

- [ ] **Detection:** a scenario starts the adapter after our extension in load order and still gets the adapter; one runs with `-builtin:mcp` in project settings and gets none.
- [ ] **Registration:** a none-profile scenario has zero extension errors; an adapter-profile scenario has no "registered by" adapter notice.
- [ ] **Naming:** no built-in tool name contains `___`; a folded collision between two plugins is reported the same way in both registration orders.
- [ ] **Variables:** built-in scenarios cover a set variable, an unset one, `:-default`, a literal `$`, and a leading `!`.
- [ ] **Records:** an old `state.json` fixture without the new field gives "needs refresh" (never "no servers"), and `apply` then `/reload` fixes it.
- [ ] **Agents:** a switch, then an agent launch in the same runtime, has a measured outcome; mixed grants never appear after an injected write failure.
- [ ] **Settings:** a symlinked `settings.json` stays a symlink; a user-set `-builtin:mcp` survives; `.pi/settings.json` is never written; a held `settings.json.lock` makes us skip, not fail.
- [ ] **Harness:** every `@mcp` scenario runs in both profiles; the profile assertion passes; the shard test knows the profile axis.
- [ ] **Bump:** `pi-ai` exact pin, e2e floor fixture, and the PROJECT.md peer line all say 1.5.0.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
| --- | --- | --- |
| A user's `-builtin:mcp` removed by mistake | LOW for the user, HIGH for trust | The notice names the change; the user re-adds the line in `pi config`; ship an evidence fix |
| Records lacking the server map | LOW | `/claude:plugin apply`, then `/reload` (NFR-2) |
| Stale agent grants | LOW | `/reload`, or `apply` re-materializes agents |
| A stale legacy `mcp.json` entry overrides a registration | LOW | `/reload` after the AMIG-01 move; or remove the entry by hand |
| A settings write that clobbered a concurrent Pi write | MEDIUM | Re-set the lost setting; fix the lock handling |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
| --- | --- | --- |
| 1 Onboarding marker ambiguity | P-Settings (user question first) | Unit case "user set it first"; scenario keeps a user entry |
| 2 One-runtime MCP gap after adapter removal | P-Settings (requirements step in P-Foundation) | Scenario: remove adapter, reload once, then observe |
| 3 Detection timing and handler order | P-Foundation | Factory-read ban test; load-order scenario |
| 4 Double serving and extension errors | P-Builtin | Zero `register_mcp_server` errors; no adapter "registered by" notice |
| 5 `mcp.json` and legacy override | P-Builtin (P-Adapter for AMIG ordering) | Scenario with a legacy entry in the first builtin session |
| 6 Variable encoding | P-Builtin | Encoder unit table; header and env scenarios |
| 7 Names, collisions, scopes | P-Builtin, P-Agents-Hooks | Collision scenario in both orders; hook matcher scenario |
| 8 Record reshape and migration | P-Records | Old-fixture migration tests; no absolute path in state |
| 9 Partial state and consent | P-Records | `apply` after a switch reports and never blocks |
| 10 Agent rewrite races | P-Agents-Hooks | Switch-then-launch scenario; lock-held unit case |
| 11 Settings write safety | P-Settings (rule pack in P-Foundation) | Symlink, BOM, held lock, and malformed-file unit cases under `nondac-sh` |
| 12 Profiles that run one implementation | P-Foundation | Profile assertion; tag architecture test |
| 13 CI time and shards | P-Foundation | Shard test with profile axis; hosted measurement |
| 14 Trust | P-Builtin; bump re-run in P-Foundation | Untrusted builtin scenario with an empty stub log |
| 15 Field semantics | P-Builtin | Translation-table unit tests (timeout unit, exposure) |
| 16 Status reader | P-Builtin | `info` scenario polls; no invented "failed" |
| 17 Ledger side effect | P-Builtin | Decision ID; rollback test if registration is immediate |
| 18 Environment facts | All | Fan-out brief carries them |
| 19 Coverage, complexity, and duplication gates | All (contract placement in P-Foundation) | `npm run check` green on the combined tree |
| 20 Parallel conflicts | P-Foundation freeze; parent | No child diff touches frozen files |
| 21 Pi 1.5.0 regressions | P-Foundation | Full suite plus untrusted set re-run after the bump |

## Sources

- `@earendil-works/pi-coding-agent@1.5.0` tarball: `docs/mcp.md` (configuration rules, precedence, replacement, `--no-mcp`); `docs/extensions.md` (lifecycle ordering, `mcp_servers_change`, MCP Servers section, `ctx.reload()`); `docs/settings.md` (built-in extension names, project override); `docs/sdk.md` (replaceable built-ins); `CHANGELOG.md` 1.5.0; `dist/core/mcp-servers.d.ts`; `dist/core/resolve-config-value.js` (`$`, `$$`, `$!`, `!cmd`, unset handling); `dist/core/settings-manager.js` (lock and merge write); `dist/core/extensions/runner.js` (`reportUnhandledMcpServers`); `dist/extensions/mcp/index.js` (`registeredServers` override by `mcpNamespace`); `dist/core/agent-session.js` (`settingsManager.reload()` on reload). HIGH.
- `pi-mcp-adapter@7.0.0` tarball: `pi-builtin-mcp.ts`, `onboarding-state.ts` (handled-version semantics), `index.ts` (`applyPiMcpServers`, `registerAdapterServer`, `session_start`). HIGH.
- `pi-subagents@0.84.0` tarball: `docs/agents.md` (built-in `mcp:` resolution, background-child registration, catalog snapshot timing). MEDIUM (docs, not run).
- This tree: `extensions/pi-claude-marketplace/index.ts`, `platform/pi-api.ts`, `shared/notification-run.ts`, `domain/name.ts`, `domain/claude-mcp-variables.ts`, `domain/mcp-server-features.ts`, `bridges/mcp/{substitute,legacy,stage}.ts`, `bridges/agents/convert.ts`, `bridges/hooks/dispatch.ts`, `persistence/state-io.ts`, `features/support/{world,pi-process}.ts`, `features/lib/{companions,pi-process}.ts`, `test/e2e/_rpc.ts`, `test/architecture/behavioral-shard-coverage.test.ts`, `.github/workflows/ci.yml`, `cucumber.json`, `.fallowrc.json`, `scripts/install-test-peers.mjs`, `package.json`. HIGH.
- `.planning/inputs/mcp-builtin/BRIEF.md`, `.planning/PROJECT.md` Constraints, `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md`, `.planning/milestones/component-features-MILESTONE-AUDIT.md` (W2 and W4, the gate), `.planning/milestones/component-features-DUBIOUS-CHOICES.md` (DC-08, DC-09, DC-27, DC-32, DC-44, P6-DC-03/11/12/15).

---
*Pitfalls research for: Pi built-in MCP as an equal alternative to pi-mcp-adapter (milestone mcp-builtin)*
*Researched: 2026-11-04*
