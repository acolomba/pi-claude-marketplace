# Phase 6: MCP Servers - Research

**Researched:** 2026-11-01
**Domain:** Claude plugin MCP servers bridged to pi-mcp-adapter 7.0.0 on Pi 1.4.0; cucumber behavioral coverage with a scripted model and stand-ins
**Confidence:** HIGH for upstream source merge, malformed handling, adapter trust, tool naming, and lifecycle (all measured this session). MEDIUM for the MCP-07 root cause and two FG-30 rows that need a runtime re-measure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Server sources and malformed servers (FG-27, FG-28)

- **D-CF6-01 (source merge; FG-27):** Follow upstream. A plugin's MCP servers
  are the union of its sources: the plugin root `.mcp.json` first, then each
  declared `mcpServers` value (plugin manifest, and the marketplace entry where
  upstream reads it), and a server name declared by a later source replaces
  the earlier one. Evidence: the 2.1.316 binary describes manifest
  `mcpServers` as "MCP servers to include in the plugin (in addition to those
  in the .mcp.json file, if it exists)", and the plugins reference documents
  the merge [FEATURES.md FG-27]. Supersedes PRD MC-1's "first match wins, no
  merge". The researcher pins the exact order across the marketplace entry,
  the manifest, and `.mcp.json`, and the array form, from the binary; if the
  binary contradicts the docs, the binary wins. `.mcpb` bundles stay
  unsupported unless the bridge already handles them; that residual is
  recorded under this ID with the Pi-gap reason (no adapter bundle runner).
  The `strict: false` conflict rule (MM-7) is kept unless the binary shows a
  merge there too.
- **D-CF6-02 (one malformed server; FG-28):** Follow upstream. A server whose
  config Claude's schema rejects is skipped with an install warning, and the
  plugin's other servers and components install. Today's whole-plugin
  `(unavailable) {malformed mcp}` cites ANAME-07, which covers unsupported
  transport features, not malformed servers, so no recorded decision licenses
  the divergence. A failure that upstream also treats as fatal for the whole
  MCP source (the researcher measures an unparseable `.mcp.json` and an
  unreadable string reference) keeps today's handling only if upstream
  matches it; otherwise it follows upstream. Prefer an existing warning
  reason over a new closed-set entry. The AMIG-01 migration follows the same
  per-server rule if it shares the resolver; otherwise its own wording stays.

### Project scope (FG-29)

- **D-CF6-03 (project-scope plugin servers; FG-29):** Keep adapter-owned
  project trust as a licensed divergence. pi-mcp-adapter 7.0.0 keeps each
  approval in `<agent dir>/mcp-project-approvals.json`, keyed by project root,
  server name, and definition hash, and offers no API for another extension
  to pre-approve a server. Writing that file is outside the NFR-10 write set,
  and the docs already record that this extension never writes the adapter's
  approval files. Licensed by the Pi capability gap plus NFR-10. Pinned
  behavior: in a trusted project with the user-global
  `settings.projectServers: "allow"` the server connects and answers a call
  (Phase 1 scenario, moved to `project-scope.feature`); in a trusted project
  without it, a headless (RPC) session leaves the server blocked; in an
  untrusted project the server is blocked even with the setting. A blocked
  server never starts (empty stub log), and the scenario pins what the model
  sees from the `mcp` proxy and what `/claude:plugin info` shows (`pending
  approval`), as whole literal values.

### Adapter 7.x re-measure (FG-30)

- **D-CF6-04 (doc rows on 7.0.0; FG-30):** Re-measure every row and
  run-time statement of `docs/mcp-compatibility.md` on pi-mcp-adapter 7.0.0
  and Pi 1.4.0 (the header still names 5.2.0 on Pi 1.0.0): `toolPrefix`,
  `directTools`, `auth: "oauth"`, `mcp-adapter.json`,
  `pi-mcp-adapter/status/v1`, `lifecycle: lazy`, project trust, the three
  adapter settings, and the variable rows. A row that holds is rewritten to
  name 7.0.0; a break is fixed in-phase in the owned product files, with a
  scenario where it is user-visible. New 7.x features that touch plugin
  servers (the adapter's own `claudePlugins` loader, `projectServers`
  policy) get a row or a note. `test/live-uat/mcp-adapter-canary.mjs` still
  pins 5.2.0; raising it is a parent line, not a Phase 6 edit.

### Harness and observation

- **D-CF6-05 (tool names, MCP-01):** The listing scenario observes the tool
  name through what the adapter returns to the model (a scripted `mcp`
  search or server listing, compared whole), and the connection through the
  stub log. The registry probe is used only if the researcher shows the
  deferred tools appear in it after an activating search.
- **D-CF6-06 (new stand-ins):** The frozen stdio stub
  (`features/lib/mcp-stub-server.ts`) is not edited. Where a scenario must
  see a server's argv, its environment, or HTTP headers that the frozen stub
  cannot report, Phase 6 adds its own stand-in under
  `features/lib/mcp-server-*.ts` (a Phase 6-owned name), such as a loopback
  Streamable HTTP MCP server that the step starts in the worker and stops in
  the scenario's release, logging each request's method, params, and headers.
  Prefer reflecting values through the frozen stub (its `STUB_TAG` echo and
  its logged plugin and server names) when that suffices.
- **D-CF6-07 (agent fixture for MCP-07):** The agent that is granted the
  plugin MCP tool is written by a Phase 6 helper in
  `features/lib/mcp-server-files.ts` through the frozen
  `writePublishedPluginFile`, never through `features/lib/agent-files.ts`
  (Phase 4 owns it). The run uses Phase 1 stand-ins only: the scripted model
  (whose script the child agent's Pi also reads, D-CF1-17), the MCP stub, and
  pi-subagents 0.84.0. If pi-subagents cannot give a child agent the plugin
  MCP tool, the gap is recorded under a decision ID with the observed
  behavior pinned, not left untested.
- **D-CF6-08 (companion-missing, MCP-06):** Without pi-mcp-adapter the
  install and `info` keep `{requires pi-mcp-adapter}` / `(missing)` (MC-8,
  D-01-01); then a profile Pi with the adapter, after `/reload`, reaches the
  server with no reinstall. Any fix stays in the pi-mcp-adapter arm of
  `shared/concerns/soft-dep.ts`.
- **D-CF6-09 (lifecycle, MCP-08):** Disable, uninstall, and update are
  observed through a Pi started after the change (or after `/reload`): the
  `mcp` proxy no longer reaches the server, or reaches the replaced one (a
  changed `STUB_TAG` or tool shows the new version). User overrides kept
  across update and disable (D-08-01/02, AFILE-06) are observed through what
  the adapter does with them, not the file.

### Claude's Discretion

- The plan split and wave placement inside the ROADMAP template (wave 1
  tracer, wave 2 parallel topics, wave 3 docs and gate), module names of new
  stand-ins, and parameter type names (prefixed `mcp-server`).
- Warning wording for the D-CF6-02 skip, in the style of the existing
  staging warnings, preferring an existing reason.
- Whether the Phase 1 project-scope scenario moves to `project-scope.feature`
  or stays in `invocation.feature` (recommended: move).

### Deferred Ideas (OUT OF SCOPE)

- Raising `test/live-uat/mcp-adapter-canary.mjs` from 5.2.0 to 7.0.0 (parent
  line).
- An interactive (TUI) project-server approval scenario: the dialog is the
  adapter's own, and headless behavior is what this phase pins.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-01 | Bridged stdio server connects (stub logs `initialize`, `tools/list`) and tools register as `mcp__plugin_<plugin>_<server>__<tool>` | Probe P1: search result text, per-call tool list, registry probe `allTools`/`activeTools` (sections "MCP-01 observation", Code Examples) |
| MCP-02 | Scripted `mcp` proxy call reaches the stub with its arguments and returns the result | Seed scenario already proves it; nested-call record shape from cucumber skill; P1 direct call after activation |
| MCP-03 | args, env, `${VAR}`, `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, loopback remote with headers reach the server as upstream; doc rows re-measured (FG-30) | Frozen-stub reflection plan, measured plugin-root and data paths, MCP SDK 2.3.1 Streamable HTTP contract, FG-30 checklist |
| MCP-04 | Multiple sources and a malformed server behave per FG-27, FG-28 | Claude 2.1.316 probes cc1/cc2/cc3 and binary function `Vbt`/`mit`/`KKn`; resolver change map |
| MCP-05 | Project-scope servers start as FG-29 decides; untrusted pinned | Probes P2/P3: exact `mcp` proxy texts and `info` `pending approval` |
| MCP-06 | Without the adapter, install shows `{requires pi-mcp-adapter}`; loading the adapter then reloading makes the servers available, no reinstall | soft-dep arm read; seed scenario shape; harness has no RPC `/reload` (gap note) |
| MCP-07 | Agent granted a plugin MCP tool calls it in a foreground run | Probes P4/P5: foreground launch refused; pi-subagents docs say MCP tools need background children; Pi/companion gap |
| MCP-08 | Disable, uninstall, update remove or replace the entries the adapter sees | Probes P6/P7: exact texts after disable; update reaches the stub again |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; commit only to `features/component-features-phase-6`; Conventional Commits titles without phase/plan IDs; never `--no-verify`, `--amend`, rebase, or force-push. The orchestrator commits this file.
- Read a file before editing it; trace callers before changing a function.
- Upstream parity is the default. Only a recorded decision ID or a Pi capability gap licenses a divergence.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (record the red proof).
- `npm run check` (typecheck, ESLint, fallow, Prettier, pairing, unit, integration, behavioral, 100% direct coverage per pair) is the gate at every GSD gate. Run the whole unit suite (`npm run test:modules`) and `npm run test:cucumber` at the phase gate.
- NFR-1 atomic writes, NFR-5 network policy, NFR-10 containment (write set: `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, `<scopeRoot>/mcp.json`). This extension never writes adapter approval files.
- IL-2: all user output through `shared/notification-dispatch.ts`. No `console.*` in the extension except the two sanctioned sites.
- Append-only closed sets: `Reason`, `REASONS`, `notify-reasons.ts`, `schema/claude-plugin.schema.json`, lock tests, `docs/json-output.md`, catalog counters. Prefer an existing reason; a new one lands as its own commit.
- Frozen after Phase 1 (do not edit): `features/support/world.ts`, `features/support/pi-process.ts`, the shared step modules, `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions,turn-records,pi-launch-environment,mcp-configuration,mcp-stub-server,hook-recorder}.ts`, `features/lib/scripted-model/*`, `features/lib/pi-registry-probe/*`, `cucumber.json`, `scripts/check-features.mjs`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `platform/pi-api.ts`, `.agents/skills/cucumber/**`, `.fallowrc.json`, the six invocation cores.
- Never edit `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `BACKLOG.md`, root `.planning/DUBIOUS-CHOICES.md`.
- Comments and test titles cite durable IDs (D-CF6-NN, ANAME-NN), never Phase/Plan/Wave.
- Every plan SUMMARY carries `## Threat Flags`.
- Environment: run every npm script with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/5aec957e-dc04-5dcd-ad24-f2ccbabeb40f/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; wrap a direct cucumber run in that `nondac-sh -c '...'`.

## Summary

Claude Code 2.1.316 merges a plugin's MCP sources in a fixed order: the plugin-root `.mcp.json` first, then the manifest `mcpServers` (object, string path, `.mcpb`/`.dxt` bundle, or an array of any of these, read in array order). A later server name replaces an earlier one. The marketplace entry's `mcpServers` counts only when the plugin has no `plugin.json`: the entry then **is** the manifest, whatever `strict` says. When `plugin.json` exists, the entry's `mcpServers` is ignored (strict true or false; it is not in the `strict: false` conflict list). Malformed handling depends on where a server comes from. A file source (`.mcp.json`, or a file the manifest names) drops a server its schema rejects; it drops a whole file that does not parse, is missing, or cannot be read. Each drop is silent: it goes to the debug log only, the plugin installs, and the other sources load. An inline source (a manifest or entry object, or an array element) is validated as part of the manifest, so one bad server refuses the whole plugin install. A path that is absolute, escapes the plugin root, or lacks the `./` prefix also makes the manifest invalid. All of this was probed in a throwaway HOME and config dir with `claude plugin validate`, `plugin install`, and `mcp list`.

So the extension's resolver (`domain/mcp-resolution.ts`, wholly owned) must change. Today it picks entry, then manifest, then `.mcp.json` (first match wins). It wants a wrapped referenced file and makes every file defect fatal. The fix stays inside owned files: `plugin-resolver.ts` passes the entry and the manifest only, and the AMIG-01 migration reuses `resolveStrict`. But several unowned tests pin the old behavior, and so do the `docs/output-catalog.md` prose and PRD MC-1 (see the change map). One important correction to D-CF6-02: upstream shows no install or load warning for a skipped file-source server. `claude plugin validate` says "The plugin loader silently drops this server at load." A user-visible warning would be a new divergence. The cheapest parity-true implementation is a silent skip.

On pi-mcp-adapter 7.0.0, the names, the lazy lifecycle, the status channel, and project trust all hold, and the probes give their exact model-visible texts. Two FG-30 doc statements break on 7.0. First, since 6.0 the adapter runs a proxy call as a nested Pi tool call under the real tool name, so hooks now see it. Second, the pi-subagents foreground text changed. Two rows need a runtime re-measure (`MCP_DIRECT_TOOLS`; `--no-extensions` with `tool_search`). MCP-07 cannot pass as written: pi-subagents 0.84.0 never gives a foreground child ambient MCP tools. A foreground agent with `tools: mcp__plugin_demo_stub__echo` gets this tool result: "Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. …". Record that as a Pi/companion gap and pin the text.

**Primary recommendation:** Rewrite `resolveStrictMcp` as an ordered merge: `.mcp.json`, then the manifest value, or the entry value when there is no `plugin.json`. A defect in a file source skips silently. A defect in an inline source refuses the plugin (`{malformed mcp}`). A `.mcpb`/`.dxt` source makes the plugin `{unsupported mcp}`. Pin the adapter-visible behavior with whole-literal scenarios built from the frozen stub, the scripted model's call log, and a new loopback HTTP stand-in.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MCP source merge and malformed classification (FG-27/28) | domain (`domain/mcp-resolution.ts`, `domain/components/mcp.ts`) | domain (`domain/mcp-server-features.ts` classifier, read-only unless needed) | Pure, network-free resolution of the plugin's declared shape; `plugin-resolver.ts` only calls `resolveStrictMcp` |
| Writing adapter entries (names, translation, variables, overrides) | bridges (`bridges/mcp/**`) | persistence (locations) | Existing stage/commit/unstage triplet; no change expected except FG-30 breaks |
| Server status in `info` | platform (`platform/mcp-status.ts`) | orchestrators (`info.ts`, read-only) | Reads `pi-mcp-adapter/status/v1`; already 7.0-correct |
| Project trust | pi-mcp-adapter (external) | — | Licensed divergence D-CF6-03; the extension writes nothing |
| Agent MCP grants | bridges/agents (Phase 4, read-only) | pi-subagents (external) | Conversion is Phase 4's; MCP-07 only observes |
| Behavioral observation | features/ (step modules, `features/lib/mcp-server-*.ts`) | frozen harness libs | Scenarios observe the stub log, the scripted-model log, the probe, and command results |

## Standard Stack

No new packages. Everything runs on what Phase 1 installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pi-mcp-adapter (optional peer, test cache) | 7.0.0 [VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json] | Runs plugin servers | Declared peer `>=7.0.0 <8` |
| pi-subagents (optional peer, test cache) | 0.84.0 [VERIFIED: its package.json] | MCP-07 child runs | Declared floor |
| @earendil-works/pi-coding-agent | 1.4.0 [VERIFIED: package.json] | Host | Project peer |
| @modelcontextprotocol/client (adapter's dependency) | 2.3.1 [VERIFIED: pi-mcp-adapter/node_modules/@modelcontextprotocol/client/package.json] | HTTP client the loopback stand-in must satisfy | Transitively fixed by the adapter |
| @cucumber/cucumber | 13.3.0 [VERIFIED: node_modules/@cucumber/cucumber/package.json] | Behavioral tests | Project harness |
| typebox | ^1.1.38 | `MCP_SERVERS_SCHEMA` | Project standard |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed in this phase. The loopback HTTP stand-in uses `node:http` only.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Upstream evidence records (claude-code-compat-research)

Every probe ran `/opt/claude-code/bin/claude` (`2.1.316 (Claude Code)`) through `env -i HOME=$T/home CLAUDE_CONFIG_DIR=$T/config PATH=... timeout 120 claude ...` in a fresh `$T`. Each used a local marketplace and a logging stdio stub, `scratchpad/research/scripts/stub.mjs`. The transcripts are in `scratchpad/research/cc1-mcp-list.txt`, `cc2-mcp-list.txt`, and the `cc*/stub.log` files.

### FG-27: source merge (HIGH)

- **Claude Code behavior:** The binary loader `Vbt(e, …)`, at byte offset ~286996640 of the second JS copy, reads `.mcp.json` first: `Ee=Se?null:await mit(e,".mcp.json",r,{confine:Z});if(Ee)G={...G,...Ee}`. Then `e.manifest.mcpServers` follows: a string is either an `.mcpb` bundle (`uH(e)` = `e.endsWith(".mcpb")||e.endsWith(".dxt")`) or a file read by `mit`. An array maps each element: a string becomes a file or a bundle, an object stays inline. The results merge in array order with `G={...G,...ze}`. A plain object merges as `G={...G,...Ie}`. Object spread: a later key replaces the value and keeps the first key's position. [VERIFIED: binary 2.1.316 strings]
- `mit` reads a file as `q=G.mcpServers||G`, so the wrapped and unwrapped forms are both accepted, for `.mcp.json` **and** for referenced files. [VERIFIED: binary; probe arr: unwrapped `b.json` `{"x":…}` loaded `x-fileb`]
- **Marketplace entry:** The plugin loader `KKn`, at ~287774254, uses the entry as the manifest only when there is no `plugin.json` (`if(!Ie){let We=U_e(e,"marketplace-entry",…);…we.manifest=We.manifest`). With `plugin.json` present, the merge `fKn` appends only `commands`, `agents`, `skills`, `outputStyles`, `themes`, and `hooks`. The `strict:false` conflict list is `e.commands||e.agents||e.skills||e.hooks||e.outputStyles||e.themes`, without `mcpServers`. [VERIFIED: binary] The docs say the same: "No `plugin.json`: the entry is the manifest, regardless of `strict` … `plugin.json` present, `strict` unset or `true`: Claude Code loads the manifest and appends the entry's `commands`, `agents`, `skills`, `outputStyles`, and `themes`" [CITED: code.claude.com/docs/en/plugins-reference "How entry fields combine with plugin.json"], and "Claude Code loads `.mcp.json` at the plugin root first, then each declared shape in order. A server name declared later replaces an earlier one." [CITED: same page, `mcpServers`]
- **Probe cc1** (`mcp list`, verbatim, paths shortened to `R`):
  ```
  plugin:demo:a: … stub.mjs a-manifest - ✔ Connected      # .mcp.json a, manifest a → manifest wins
  plugin:demo:c: … stub.mjs c-mcpjson - ✔ Connected
  plugin:demo:b: … stub.mjs b-manifest - ✔ Connected      # entry a, d (plugin.json present) ignored
  plugin:nomani:e: … stub.mjs e-entry - ✔ Connected       # no plugin.json: entry is the manifest, beats .mcp.json
  plugin:nomani:f: … stub.mjs f-mcpjson - ✔ Connected
  plugin:nomanifalse:g: … g-entry / g2: … g2-entry         # same with strict:false
  plugin:sfm:h: … stub.mjs h-mcpjson - ✔ Connected        # plugin.json + strict:false + entry mcpServers → entry ignored, no conflict
  plugin:arr:x: … stub.mjs x-fileb - ✔ Connected          # [ "./a.json", {y}, "./b.json" ] + .mcp.json {x,z}
  plugin:arr:z: … stub.mjs z-mcpjson - ✔ Connected
  plugin:arr:y: … stub.mjs y-inline - ✔ Connected
  ```
- **`.mcpb`/`.dxt`:** Claude extracts and runs the bundle (`EFn`, "Loading MCP servers from MCPB"). pi-mcp-adapter has no bundle runner, which is the Pi gap D-CF6-01 names. [VERIFIED: binary]
- **Conflict:** none between docs and binary.
- **Pi constraints:** none block parity. MM-7 stays as it is: upstream never conflicts on `mcpServers`, and `domain/manifest.ts:23-27` already resolves `strict: false` like an omitted flag.

### FG-28: malformed handling (HIGH)

| Case | Claude Code 2.1.316 | Evidence |
|------|---------------------|----------|
| One schema-invalid server in `.mcp.json` (`{"type":"bogus"}`, `timeout:-5`) | That server is dropped silently, the others load, and the plugin installs | `plugin validate`: "mcpServers.broken.type: unknown server type "bogus" … The plugin loader silently drops this server at load." `mcp list` shows `plugin:bad1:ok` only. `mit`: `if(we.success)Z[Se]=we.data;else t(…Invalid MCP server config…,{level:"error"})` (debug log) [VERIFIED] |
| Unparseable `.mcp.json` | That file loads no servers; other sources load; the plugin installs | validate: "Invalid JSON syntax … The plugin loader logs this at debug level and loads no servers from the file." `mcp list`: `plugin:bad3:ok … bad3-manifest` [VERIFIED] |
| Manifest `mcpServers: "./missing.json"` | Silently skipped; `.mcp.json` loads | validate: "Path not found: ./missing.json. The plugin loader skips a missing MCP servers file without reporting it" `mcp list`: `plugin:bad4:ok … bad4-mcpjson` [VERIFIED] |
| Manifest string to an unparseable file | That file is skipped; `.mcp.json` loads | `plugin:bad5:ok … bad5-mcpjson` [VERIFIED] |
| Unreadable file (EACCES) | Skipped: `catch(G){if(z(G))return null;t(…Failed to load MCP servers from…,{level:"error"});return null}` | binary source only; not probed (root container) [VERIFIED: binary] |
| Inline schema-invalid server in `plugin.json` | **Whole plugin install fails**: `Plugin … has an invalid manifest file at …/plugin.json. Validation errors: mcpServers: Invalid input` | probe bad2 [VERIFIED] |
| Inline invalid server in the entry (no plugin.json) | **Install fails**: `This plugin's marketplace entry is invalid: mcpServers: Invalid input` | probe bad6 [VERIFIED] |
| `mcpServers: "../outside.json"` or an absolute path | **Install fails**: `Validation errors: mcpServers: Invalid string: must start with "./"` | probe cc3 [VERIFIED] |

Claude shows no error for the silent cases in `install`, `plugin list`, or `mcp list`. Only `claude plugin validate` reports them. So "Claude Code skips only that server, shows an error" (`docs/mcp-compatibility.md:194`) is wrong about the error.

### FG-29: adapter project trust (HIGH)

`applyProjectServerTrust` in `pi-mcp-adapter/project-server-trust.ts:266-310` computes `interactive = ctx.hasUI && ctx.mode === "tui"` and `allowUnapproved = options.allowUnapproved === true || (!interactive && loaded.projectServerPolicy === "allow")`. A server passes only `if (projectTrusted && (approved || allowUnapproved))`. Otherwise the reason is `"untrusted"`, then `"approval-required"` when not interactive, and the server becomes `{ ...definition, disabled: true }`. `settings.projectServers` is read only from non-project sources; a project file logs "Ignoring settings.projectServers in project config …" [VERIFIED: config.ts:651-661]. 5.4.0 added `pi --mcp-project-servers allow` (process-only allow; untrusted projects stay blocked) [CITED: adapter CHANGELOG 5.4.0; flag registered at index.ts:1418].

**Measured this session** (probes P2, P3, run through the real cucumber harness with a scratch step module):

- Trusted project, no allow (P2). Proxy call result: `Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.` `mcp({})`: `MCP: 0/0 servers, 0 tools (1 blocked)\n\n⊘ plugin_demo_stub_ (blocked: project server approval required — approve it in a trusted interactive session or set user-global settings.projectServers to "allow")\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`. `mcp({search:"echo"})`: `No tools matching "echo"`. The stub log is empty. `info` gives `"mcp":[{"name":"plugin:demo:stub","status":"pending approval"}]`, and the probe `allTools` has no `mcp__plugin_*` tool.
- Untrusted project with allow (P3). The proxy call returns the same "not found" text. `mcp({})`: `MCP: 0/0 servers, 0 tools (1 blocked)\n\n⊘ plugin_demo_stub_ (blocked by project trust — trust the project to review and approve this server)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`. The stub log is empty, and info shows `pending approval`.
- Harness: `Given the project holds a pi settings file` plus `Given pi runs with the scripted model and these companions in an untrusted project:` (`features/step_definitions/companion.steps.ts:60-89`). Allow comes from `Given pi-mcp-adapter allows project mcp servers for the user` (mcp-configuration.steps.ts:49).

## Resolver change map (FG-27 / FG-28 → MCP-04)

**Today** [VERIFIED: extensions/pi-claude-marketplace/domain/mcp-resolution.ts:169] `const declaredMcp = input.entry.mcpServers ?? input.manifest?.mcpServers;`. A string goes to `readReferencedMcp`, which demands `"mcpServers" in parsed` (lines 140-145). `.mcp.json` is read only `declaredMcp === undefined ?` (line 182). Every defect pushes a note and returns `true` (dirty), so the whole plugin is `unavailable`. The validator is [VERIFIED: domain/components/mcp.ts:13] `export const MCP_SERVERS_SCHEMA = Type.Record(Type.String(), Type.Unknown());`.

**Target algorithm** (all inside `domain/mcp-resolution.ts`):

1. `fileServers(".mcp.json")`. Missing → nothing. Unparseable, unreadable, or not an object → nothing (silent). Otherwise `doc.mcpServers ?? doc` (a non-object `mcpServers` drops the file). For each server, `classifyMcpServer`: `supported` keeps it, `blocked` goes to `droppedMcpServers` (partial, as today), and `malformed` is skipped silently (an optional non-dirty note).
2. `declared = manifest !== null ? manifest.mcpServers : entry.mcpServers`. The entry is ignored whenever `plugin.json` exists. **Check how the extension represents "no plugin.json":** `manifest` is `null` when absent (`resolveStrictMcp` input type, line 160).
3. `declared` shapes:
   - **string:** an absolute path, an escape, or (upstream) no `./` prefix → fatal `malformed mcp reference` (keep MCPR-04; upstream refuses the manifest too). `.mcpb`/`.dxt` → `resolution.unsupported.push("mcpServers")` plus a note, giving the existing `{unsupported mcp}` partial arm with no new closed-set value (Pi gap, D-CF6-01). Otherwise use the file rules of step 1 (missing → silent skip).
   - **array:** each element in order: a string as above; a plain object as an inline map; anything else → fatal `malformed mcpServers` (keeps the test "PR-2(6) malformed mcpServers (array form) [1,2,3] -> notInstallable", whose expected outcome stays right).
   - **object:** an inline map. Any `malformed` server is **fatal** (upstream refuses the manifest), with today's note `malformed mcp server "<name>": …`.
4. Merge in order with a later key replacing (`Object.assign` into a null-prototype or `Object.fromEntries` accumulator, keeping `__proto__` as an own key, per the existing test "keeps a server named __proto__"). Drop a blocked server only after the merge, so a later valid redefinition wins, as upstream drops host-only types post-merge in `Vbt`.

**Decision points for the planner:**

- **Skip warning (D-CF6-02):** Upstream is silent, and the locked text says "skipped with an install warning". Recommended: follow upstream (silent). This needs no warning channel and no unowned file. If the warning is kept, use the existing discovery-warning diagnostic ("Plugin "demo" [scope] installed; 1 declared component has a note.", `shared/staging-warnings.ts`, D-PL1-02), copying how D-CF1-06 carries `shadowedFolders`. That route needs minimal edits in four unowned files: `domain/resolver-types.ts` (new optional field in the two materializable arms), `domain/plugin-resolver.ts` `materializableFields` (line 166 pattern), `orchestrators/plugin/install-outcome.ts:1199` and `orchestrators/plugin/update-swap.ts:488` (seed `discoveryWarnings`). Treat it as a dubious choice either way.
- **EACCES on an MCP file:** Upstream skips it. Today the error propagates as `{permission denied}` (test "WR-03 … propagates out of resolveStrict", `test/domain/plugin-resolver.test.ts`). D-CF6-02 says follow upstream, so skip. Flagged.
- **Reference without `./`:** Upstream refuses the manifest. The extension accepts `"x.mcp.json"` (the plugin-resolver tests use it). Recommended: keep accepting it. This is not FG-27/28 scope, and changing it would refuse plugins that load today. Flagged.

**AMIG-01 migration:** `orchestrators/reconcile/mcp-migration.ts:333` calls `resolveStrict`, and its `malformed` arm fires only on `resolved.state === "unavailable"` (line 386). So the per-server rule carries into the move with no migration edit. A file-source skip becomes a `move` that writes the valid servers. The doc "Migration" bullets (lines 362-363, 433) must be reworded to say that only an inline-invalid config removes every server.

**Tests that pin the old behavior and must change:**

- Owned: `test/domain/mcp-resolution.test.ts` (the pair): "prefers entry MCP and falls back to manifest MCP" (l.98), "classifies malformed JSON content in a standalone document" (l.403), "classifies a wrapped malformed map like an inline malformed map" (l.423), "ANAME-07: a malformed server adds a note and reports a structural defect" (l.599; still true for inline, false for file), and the l.222/262 parameterized cases. `test/integration/mcp-migration.test.ts:571` ("AMIG-01: a plugin whose MCP config is malformed has all its old entries removed"): its `declareServers` probably writes a file source, so check what it writes.
- **Not owned** (parent line or minimal edit, flagged): `test/domain/plugin-resolver.test.ts`: "MCPR-03 missing reference file -> unavailable" (l.1744), "MCPR-03 malformed-JSON reference file -> unavailable" (l.1762), "MCPR-03 wrapper-less reference file (bare map) -> unavailable" (l.1784, which cites D-04 "a string reference MUST be wrapped"; upstream accepts unwrapped), "WR-03 unreadable reference …" (l.1809), "MCPR malformed standalone .mcp.json … -> unavailable" (l.1947), "MCPR-01 backstop: string entry.mcpServers shadows an object manifest.mcpServers (entry wins)" (l.2050), and "MM-5 entry.mcpServers …" (l.3729/3752). `test/orchestrators/plugin/install-flow-ledger.test.ts:3661` stays correct only if `seedPathMarketplaceWithPlugin({ mcpServers })` puts the servers inline; verify it. Run all of `npm run test:modules` after the change to find the rest.
- Docs not owned: `docs/output-catalog.md:148,736,3395` prose ("a broken `mcpServers` string reference -- missing file / malformed JSON / wrapper-less") and PRD MC-1/MC-3 (`docs/prd/pi-claude-marketplace-prd.md:477-479`). These are parent lines (the catalog is a closed-set file; check `EXPECTED_UTF8_BYTES` only counts examples, `test/architecture/catalog-uat/catalog-contract.test.ts:22`).

## Architecture Patterns

### System flow

```text
plugin files (.mcp.json, plugin.json mcpServers, entry mcpServers)
   │  resolveStrictMcp: ordered merge, per-source validity (domain)
   ▼
resolved.mcpServers ──► bridges/mcp prepareStageMcpServers ──► <scope>/mcp-adapter.json
                                                                  │ (adapter reads at session start / /reload)
                                                                  ▼
                       pi-mcp-adapter 7.0.0: config sources ─► project trust gate ─► lazy startup listing
                                                                  │                         │
                                         mcp-cache.json ◄─────────┘   stdio stub / HTTP stand-in (logs)
                                                                  ▼
                 Pi tools: `mcp` proxy (active) + `mcp__plugin_<p>_<s>__<tool>` (deferred, search-mode)
                                                                  │ scripted model calls
                                                                  ▼
                 model-calls.jsonl (messages + tools per call)  ◄── observed by Then steps
                 pi-mcp-adapter/status/v1 ──► platform/mcp-status.ts ──► /claude:plugin info
```

### Pattern 1: install in the shared Pi, then start the profile Pi

**What:** Every MCP scenario installs, disables, uninstalls, or updates through the run's shared Pi (no companions, so the install warns `{requires pi-mcp-adapter}`). Only then does `Given pi runs with the scripted model and these companions:` start the profile Pi, and the scenario waits on `Given pi-mcp-adapter has listed the tools of the stub mcp server … of the plugin …`.
**Why:** The cucumber skill: "A new RPC session binds the extension twice … So an MCP scenario installs through the run's shared Pi before the profile Pi starts". Also, a scenario cannot place a Given after a When (`scripts/check-features.mjs:412-425`), and "One scenario starts at most one profile Pi" (world.ts:540-543).
**Consequence for MCP-06 and MCP-08:** "Loading the adapter then `/reload`" is represented by a fresh profile Pi. Pi's `/reload` is an interactive built-in, and over RPC it is only reachable from an extension command context (`rpc-mode.js:252` `reload: async () => session.reload()`); no shared step drives it. The adapter re-reads its config at every `session_start` (`index.ts:1672-1810`, `loadMcpConfig` / `getDeferredSessionSnapshot(ctx.cwd)`), and Pi's `/reload` re-runs extension factories, so the two are equivalent for config reads [ASSUMED: Pi `/reload` re-imports extensions as a new process does]. Note this as a harness gap in the feature description.

### Pattern 2: observe through the frozen stub (D-CF6-06)

- The stub logs `plugin` = `argv[2]` and `server` = `argv[3]` (`features/lib/mcp-stub-server.ts:155-163, 200-207`), and its echo is `<STUB_TAG>:echo:<text>` when `STUB_TAG` is non-empty (lines 120-127).
- So `args: [STUB, "${CLAUDE_PLUGIN_ROOT}", "stub"]` logs the expanded root as `plugin`, and `env: { STUB_TAG: "${CLAUDE_PLUGIN_DATA}" }` puts the data dir in the model-visible result.
- Measured paths (probe P4 `mcp-adapter.json`): `CLAUDE_PLUGIN_ROOT` = `<home>/marketplaces/fixtures/plugins/demo`, which projects to `{home}/marketplaces/fixtures/plugins/demo`; `CLAUDE_PLUGIN_DATA` = `<agent dir>/pi-claude-marketplace/data/fixtures/demo`, which projects to `{agent dir}/pi-claude-marketplace/data/fixtures/demo` (user scope). Both tokens exist in `features/lib/run-tokens.ts` (`{home}`, `{agent dir}`, `{project dir}`). Upstream injects the same two variables into stdio env (cc1 stub log: `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` present; its data dir is `<config>/plugins/data/demo-mk`, a layout difference already accepted).
- `${VAR}` reaches the adapter unchanged and is expanded from Pi's environment, which `Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}` (calls.steps.ts:101-118) sets. `${VAR:-default}` is the seed scenario.
- The existing wait step matches `request.plugin === plugin` literally (calls.steps.ts:78-84). A stub started with an expanded path needs its own wait step that projects tokens.

### Pattern 3: loopback Streamable HTTP stand-in (`features/lib/mcp-server-http.ts`, new, owned)

The MCP SDK 2.3.1 client contract, read in `pi-mcp-adapter/node_modules/@modelcontextprotocol/client/dist/index.mjs:5705-5850` [VERIFIED]:

- **POST** to the URL, with `content-type: application/json` and `accept: application/json, text/event-stream`. Answer requests `200` with `content-type: application/json` and the JSON-RPC response body. A notification gets `202` and no body (after `notifications/initialized` the client then tries a GET).
- On a handshake response the client reads `mcp-session-id` (optional); later requests send it back.
- **GET** (standalone SSE): answer `405`, which the SDK accepts (`if (response.status === 405) { … return; }`).
- **DELETE** on close: answer `405` or `200`.
- Do **not** answer 404/405/406/415 to a POST: the adapter then falls back to SSE (`server-manager.ts:155-158` `shouldFallbackToSse`, `[404, 405, 406, 415]`). A 401 triggers OAuth.
- Requests: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`. Answer `initialize` with `{ protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo }`, as the frozen stub does.
- Lifecycle: start it in the Given (`127.0.0.1:0`) **before** writing the plugin's `.mcp.json` (the URL goes into `mcp-adapter.json` at install). Register `this.onRelease(() => close + closeAllConnections())`. Log lazily on each request to `<harnessDirectory(home)>/mcp-server-http-requests.jsonl`. Do **not** create the harness dir earlier: `usePiWithProfile` runs `await mkdir(harness)` without `recursive` (world.ts:548) and fails if it exists. The turn then picks the log up automatically (turn-records reads every `*.jsonl`). Keep no module-level state. Project the port inside the Phase 6 step (as `{tool call n}` is projected step-locally), because `run-tokens.ts` is frozen.
- Headers: log every header and compare the columns the step names (the declared plugin headers, `mcp-protocol-version`). `user-agent` and other runtime-varying headers should not be compared whole [ASSUMED: header set not measured].
- OAuth beside headers: a non-`Authorization` header makes the extension write `auth: "oauth"` (D-08-04). `supportsOAuth` then returns true (`mcp-auth-flow.ts:1252-1266`). With no 401 from the stand-in, no OAuth flow runs [ASSUMED: not measured]. The tracer can use an `Authorization` header (no `auth` written) first.

### Pattern 4: what the model sees (MCP-01/02), measured on 7.0.0 (probe P1)

- Call 1 tools (no search yet): `read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp`. The plugin tool is deferred.
- `mcp({search:"echo"})` returns, verbatim: `Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; }`
- From call 2 on, the tools list also holds `mcp__plugin_demo_stub__echo`.
- `mcp({server:"plugin_demo_stub_"})` returns: `plugin_demo_stub_ (1 tools (lazy: tools from cache, not connected yet — mcp({ connect: "plugin_demo_stub_" }) to connect)):\n\n- mcp__plugin_demo_stub__echo(text) - Echoes the text it is given.` A `Description:` line appears only when the plugin or entry has a description.
- `mcp({})` returns: `MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_stub_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`
- A direct call `mcp__plugin_demo_stub__echo {"text":"direct"}` after activation returns `echo:direct`, and the stub logs a second connection plus `tools/call`.
- **Registry probe:** `allTools` includes `mcp__plugin_demo_stub__echo` **before** any search (a Pi deferred tool, registered from the cache), and `activeTools` includes it **after** the activating search. So D-CF6-05's condition holds and the probe may be used. Its frozen When (`the user lists the slash commands pi offers`) names slash commands, so a Phase 6 When/Then (`the user lists the tools pi offers` / `pi offers these mcp tools:`) built on the frozen `readRegistrySnapshot` reads better.
- Naming mechanics: the adapter's canonical name is `formatToolName` with `toolPrefix: "mcp"` → `mcp__${sanitize(key)}_${tool}` (types.ts:944-972). Search-mode tools register under that name (`registerDirectTool(spec, …, name = spec.prefixedName)`, index.ts:560). Only tools with **no** direct or search-mode registration get the 6.0 deferred name `mcp__<formatServerNamespace(key)>__<tool>`, which would be `mcp__plugin_demo_stub___echo` (three underscores) for our key (deferred-tool-surface.ts:31-33).

### Pattern 5: MCP-07, an agent with a plugin MCP tool (probes P4/P5)

- The agents bridge maps `tools: mcp__plugin_demo_stub__echo` to `mcp:plugin_demo_stub_/echo` (`bridges/agents/convert.ts:248-268`). It warns `MCP_ASYNC_WARNING` and never injects `async: true` (lines 391-404).
- In a foreground run (`{"agent":"demo:runner","task":"say ping","async":false}`), the parent's `subagent` tool result is, verbatim: `Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.` The child never runs, and the stub log shows only the startup listing. The adapter cache did hold the server (`mcp-cache.json` `plugin_demo_stub_` with `configHash` and `cachedAt`), so the selector failed on something else: possibly a cache-identity mismatch between pi-subagents 0.84.0 `computeMcpServerHash` (`bundle/chunk-V2BZYLEP.js:766-791`) and adapter 7.0.0 `computeServerHash` (`metadata-cache.ts:143-178`) [ASSUMED: root cause not isolated].
- Even if the selector resolved, pi-subagents states: "Agents that need MCP tools from an ambient adapter such as pi-mcp-adapter … must therefore run as background children (`async: true`). A foreground launch of such an agent fails with a diagnostic that says exactly that." [CITED: pi-subagents 0.84.0 docs/agents.md:553]. Its foreground diagnostic text is at `bundle/chunk-XDQORLZ5.js:78-87`.
- An agent with no `tools:` (P5) runs in the foreground with child tools `read, bash, edit, write, bg_wait, contact_supervisor`: no `mcp` and no plugin tool.
- Background children cannot be used in the harness: they never load extensions passed with `--extension` (Phase 1 RESEARCH Q8, `child-session.js:436-446`), so they get neither the adapter nor the scripted model.
- **Recommendation:** Record a decision (for example D-CF6-10: MCP-07 is a pi-subagents gap: a foreground child never gets ambient MCP tools). Pin P4 whole: the model receives the `subagent returned/failed: Unresolved MCP …` row and the stub receives only the startup listing. That is a negative pin rather than a call; MCP-07 cannot be met as worded.

### Pattern 6: lifecycle (MCP-08), measured (P6/P7)

- After `/claude:plugin disable demo@fixtures --scope user` in the shared Pi, a profile Pi gets `Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.` for the proxy call and `MCP: 0/0 servers, 0 tools` from `mcp({})`. The stub log is empty. Uninstall removes the entry the same way [ASSUMED: same output as disable, not probed separately].
- After an update (v1.0.0 → v1.1.0), the profile Pi reconnects and the call returns. A dir-source plugin is read in place (root `{home}/marketplaces/fixtures/plugins/demo`). To prove replacement, change the published `.mcp.json` (a new `STUB_TAG` literal) before `update`. The negative control is the same edit with no update: the old entry keeps the old tag.
- User overrides observed through the adapter: a Phase 6 Given writes a marker-less override (for example `disabled: true`) into `mcp-adapter.json`, a file the user owns. After update or disable then enable, `mcp({})` shows the server as disabled. Its exact text comes from `disabledServerReason`: `Server "<key>" is disabled. Run /mcp-adapter enable <key> and /reload to enable it.` (project-server-trust.ts:51-54) [ASSUMED: listing line not measured].

### Recommended layout (all owned)

```
features/mcp-server/
  listing.feature            # wave 1, MCP-01
  invocation.feature         # Phase 1 seed (user-scope call, :- default) + MCP-02 + MCP-07 gap pin
  configuration.feature      # MCP-03, MCP-04
  project-scope.feature      # MCP-05 (Phase 1 allowed scenario moves here)
  companion-missing.feature  # MCP-06
  lifecycle.feature          # MCP-08
features/step_definitions/mcp-server/
  calls.steps.ts             # seed module; becomes shared (wave 1 only)
  listing.steps.ts           # wave 1 shared steps
  configuration.steps.ts / invocation.steps.ts / project-scope.steps.ts / companion-missing.steps.ts / lifecycle.steps.ts
features/lib/mcp-server-files.ts   # wave 1 adds every fixture writer wave 2 needs
features/lib/mcp-server-http.ts    # configuration plan: loopback HTTP stand-in
```

### Anti-patterns to avoid

- Reading `mcp-adapter.json` in a Then. Observe the adapter instead (milestone rule). Writing it in a Given as a user override is fine.
- Comparing part of a tool result. Use a docstring Then for multi-line `mcp` results, or Gherkin `\n` escapes in `the model receives these calls:` cells.
- Starting a second profile Pi, or placing a Given after a When.
- Using `protocolVersion: "auto"`, `npx`, or non-loopback `http` in fixtures (ROADMAP).
- Filtering or deduplicating stand-in records (the cucumber skill: the nested proxy call appears as its own event with id `<mcp id>/1`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading Pi's tool registry | a new probe extension | frozen `features/lib/pi-registry-probe/snapshot.ts` (`REGISTRY_PROBE_COMMAND`, `readRegistrySnapshot`) | Already loaded in every profile Pi |
| Per-call tool lists | parsing RPC events | `modelCallsOf(turn.logs)[i].tools` (`features/lib/scripted-model/script.ts:194`) | The scripted model records each call whole |
| Setting Pi env | world edits | `writeLaunchEnvironment` + `PI_LAUNCH_ENVIRONMENT_EXTENSION` (frozen lib) | Used by calls.steps.ts:101-118 |
| Plugin files | direct fs writes | `writePublishedPluginFile` (frozen) and the generic file Given | Fixture-writer convention |
| HTTP MCP framing | an SSE server | plain JSON responses + 202/405 per the SDK contract | Simplest form the SDK accepts |
| Project approval | writing `mcp-project-approvals.json` | the existing allow Given | NFR-10, D-CF6-03 |

## Common Pitfalls

### Pitfall 1: the harness dir already exists
**What goes wrong:** a stand-in creates `{home}/harness` before the profile Pi starts, and `usePiWithProfile` fails on `mkdir`.
**How to avoid:** log lazily on the first request, or keep logs in a step-closure buffer flushed only after the profile start.

### Pitfall 2: two startup connections
The seed's expected log shows two `initialize`/`tools/list` rounds for a call scenario: the startup listing, then the lazy reconnect for the call. A search-only listing shows one round. A blocked server shows none.

### Pitfall 3: the "not found" text hides two causes
A blocked project server and an uninstalled server give the same proxy-call text. A scenario must also compare `mcp({})`, which tells them apart (`(1 blocked)` + reason vs `0/0 servers`).

### Pitfall 4: the merge order of keys
Upstream keeps the first-seen position on replace (`a, c, b`). Use object-spread semantics, not "delete then add".

### Pitfall 5: entry `mcpServers` with a `plugin.json`
Upstream ignores it. Existing fixtures and tests that put servers in the entry while also shipping `plugin.json` lose those servers. Check `seedPathMarketplaceWithPlugin` and the `features/` fixtures (the dir marketplace "demo" plugin has a skill and maybe a `plugin.json`).

### Pitfall 6: concurrent scripted-model calls
A background child beside its parent can race on the shared call log (Phase 1 01-03-PLAN HAR-02 note). Avoid async runs.

### Pitfall 7: `MCP_DIRECT_TOOLS` and the deferred surface
With the env override, unnamed servers' cached tools become 6.0 deferred tools under the triple-underscore name, not Claude's name (deferred-tool-surface.ts) [ASSUMED: runtime not measured]. Re-measure before writing that doc row.

## FG-30 re-measure checklist (`docs/mcp-compatibility.md` on adapter 7.0.0 / Pi 1.4.0)

| Doc row / statement | 7.0.0 evidence | Verdict | Action |
|---|---|---|---|
| Header l.7 "pi-mcp-adapter 5.2.0 on Pi 1.0.0", measurements 5.0/5.2 | — | text | Name 7.0.0 / Pi 1.4.0 and the cucumber probes of this phase |
| l.11 peer `7.0.0 or later 7.x`, SDK 2.3.1 | client 2.3.1 | holds | keep |
| Names l.15-29 (`plugin_<p>_<s>_` + `toolPrefix:"mcp"` → `mcp__plugin_<p>_<s>__<tool>`) | probe P1; types.ts:944-972 | holds | text only |
| `-`/`_` fold refusal (ANAME-03) | `formatServerNamespace` replaces `-` with `_` (types.ts:555-567) | holds | text; comments in `bridges/mcp/collision-slots.ts` say "pi-mcp-adapter 5's" (owned; optional text fix) |
| Collision source list (9 sources) | config.ts:835-980 same order; Pi `mcp.json` only when `piSupportsMcp` (index.ts:263) | holds | text |
| Tool search: `directTools:"search"` keeps tools out of the first request; search activates them | P1 per-call tools | holds | text |
| `alwaysLoad` → `directTools: true` | `directTools?: boolean \| string[] \| "search"` (types.ts:481) | holds | text |
| `_meta["anthropic/alwaysLoad"]` ignored | not changed | holds [ASSUMED] | text |
| Pi `tool_search` off by default | probe `allTools` has `tool_search`, `activeTools` lacks it | holds | **add note:** since 6.0 plugin tools are Pi deferred tools that `tool_search` and `codemode` can reach (CHANGELOG 6.0.0) |
| `--no-extensions` / `-e builtin:tool-search` (measured Pi 1.0) | not re-measured | re-measure | probe or mark measured on 1.0 |
| Name length: no limit in Pi/adapter | adapter registers the prefixed name with no cap; only Pi built-in MCP caps 64 (`dist/extensions/mcp/tools.js:29`) | holds (source) | text |
| "pi-mcp-adapter turns built-in MCP off" | index.ts:1722-1735 (not with `--mcp-config`) | holds | add the `--mcp-config` exception |
| Lifecycle: default `lazy`, startup listing then stop | `definition.lifecycle ?? "lazy"` (index.ts:488); stub logs | holds | add new value `lazy-keep-alive` to the user-choice mention |
| Project trust bullets l.83-92 | P2/P3; project-server-trust.ts | holds | add `pi --mcp-project-servers allow` (5.4.0) |
| `PI_MCP_CONFIG_MODE=exclusive` | config.ts:841-851, 1046-1048 | holds | text |
| `--mcp-config <file>` | flag index.ts:1414; replaces the user path only | holds | text |
| `MCP_DIRECT_TOOLS` "a server it does not name gets no tools … no tools from a search" | 6.0 deferred surface registers unnamed servers' cached tools as deferred (`deferredRegistryLive = deferSearchTools && envRaw !== "__none__"`, index.ts:444) | **likely breaks** | re-measure; rewrite (possibly a Pi-gap note on the triple-underscore name) |
| Translated fields (`httpTransport:"sse"`, `requestTimeoutMs`, `oauth.*`, `description`) | types.ts:464-519 | holds | text |
| `type:"http"` → default transport | `kind = definition.httpTransport ?? "streamable-http"`, SSE fallback on 404/405/406/415 (server-manager.ts:1875-1926) | holds | **add** the fallback note |
| `auth:"oauth"` beside headers (D-08-04) | `supportsOAuth` (mcp-auth-flow.ts:1252-1266); integration test `mcp-adapter-entry-conformance.test.ts:136,157` | holds | text |
| Dropped fields list | new adapter-only fields: `protocolVersion`, `roots`, `appendStructuredContent`, `openUi`, `trace` | holds | list `protocolVersion` among dropped plugin fields |
| User overrides list l.198 | `CARRIED_FIELDS` includes `appendStructuredContent`, `roots` (adapter-entry.ts:47-61, D-CF1-14) | **stale** | add both fields |
| Invalid server configs l.192-194 and divergence l.405 | FG-28 probes | **breaks** (product fix) | rewrite per FG-28 |
| Hooks l.210-212 "a call through `mcp` … reaches hooks as tool `mcp` … matchers do not fire" and Loading divergence l.404 | since 6.0 a proxy call runs as a nested Pi tool call under the real name (CHANGELOG 6.0.0; `createProxyHandOff`, index.ts:968-1010; cucumber skill "nested call's id … `/1`") | **breaks (stale)** | rewrite to the adapter fact; hooks matcher behavior belongs to Phase 5 (`docs/hooks-compatibility.md`), so add a parent line to reconcile |
| Agents l.222/238 "foreground launch fails … and so does a launch before … cached" | P4: fails with "Unresolved MCP direct-tool selectors …" even after caching | **changed text** | rewrite; record the MCP-07 gap |
| Variables section (D-CF1-13, `${VAR:-default}`) | already 7.0 (Phase 1); conformance tests | holds | keep |
| `literalEnv` not set (AVAR-03) | field exists (types.ts:511) | holds | keep |
| Status in info / `pi-mcp-adapter/status/v1` | `MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1"` (types.ts:18); statuses in mcp-status.ts:37-55; P1 `connected`, P2 `pending approval` | holds | text |
| Upgrading (AMIG) | migration code unchanged; malformed bullets change with FG-28 | partly | reword lines 362-363, 433 |
| Further reading l.445 canary "5.2.0" | canary pinned at 5.2.0 | text | parent line (Deferred) |
| **New:** `claudePlugins` loader | opt-in: reads only `claudePlugins[].path` that the user lists, with `mcp: true` (claude-plugin-loader.ts:15-78); names servers by their own names | note | **add note:** no double load by default; a user `claudePlugins` entry pointing at a plugin this extension installed runs its servers a second time under the plugin's own names (MC-4 marks `claudePlugins` out of contract) |

[VERIFIED: platform/mcp-status.ts:41-42] `export type McpServerRuntimeStatus = "connected" | "cached" | "failed" | "needs-auth" | "not-connected" | "blocked" | "disabled";` matches the adapter's status values (mcp-status.ts:37-55: `"not-connected"`, `"blocked"`, `"disabled"`, `"connected"`, `"needs-auth"`, `"failed"`, `"cached"`).

## Code Examples

Probe step pattern (scratchpad only; it shows how a Phase 6 Then can read the call log and the registry):

```ts
// Source: scratchpad/research/probe/probe.steps.ts (this session)
const calls = modelCallsOf(this.requireTurn().logs);          // frozen lib
const toolsOfCall2 = calls[1]?.tools.map((tool) => tool.name); // per-call tool list
const exchange = await this.pi.request({ type: "prompt", message: `/${REGISTRY_PROBE_COMMAND}` });
const snapshot = readRegistrySnapshot(exchange.entries);       // allTools / activeTools
```

Upstream merge, as a resolver sketch (names are the planner's):

```ts
// Order: .mcp.json, then declared (manifest, or the entry when no plugin.json).
// File-source defects skip; inline defects are fatal; later keys replace.
const merged: Record<string, unknown> = Object.create(null);
for (const source of [dotMcpJson, ...declaredSources]) {
  for (const [name, config] of Object.entries(source.servers)) merged[name] = config;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A proxy call ran inside `mcp` only | Nested Pi tool call under the real tool name | adapter 6.0.0 | Hooks and permission extensions see the real tool |
| Search-mode tools held inactive by the adapter | Pi deferred tools; Pi owns activation | adapter 6.0.0 on Pi ≥0.99 | Registry `allTools` lists plugin tools before any search |
| RPC headless dialogs could hang | RPC counts as non-interactive; `projectServers:"allow"` admits | adapter 5.3.0 | Pinned by P2/P3 |
| `${VAR:-default}` left literal | Adapter expands `:-` | adapter 7.0.0 | D-CF1-13 already applied |
| `pi --mcp-project-servers allow` | — | adapter 5.4.0 | New doc row |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi `/reload` re-imports extensions as a fresh profile Pi does | Pattern 1 | MCP-06 scenario proves "new process" rather than "/reload" |
| A2 | The MCP-07 unresolved-selector failure is a cache-identity mismatch | Pattern 5 | A background workaround in the docs may also fail; the doc text changes |
| A3 | The HTTP stand-in passes OAuth mode with no 401 | Pattern 3 | The `auth:"oauth"` header scenario needs a different fixture |
| A4 | Uninstall gives the same adapter view as disable | Pattern 6 | One more literal to measure |
| A5 | The disabled-override listing text | Pattern 6 | Measure in the lifecycle plan |
| A6 | `MCP_DIRECT_TOOLS` behavior changed with 6.0 | FG-30 | Doc row wording |
| A7 | Header set of SDK requests not measured | Pattern 3 | Step must compare named columns only |
| A8 | `_meta alwaysLoad` row still holds | FG-30 | Doc row only |

## Open Questions

1. **Skip warning vs silent skip (D-CF6-02).** Upstream is silent, and the locked text says warn. Recommendation: silent, recorded as P6-DC. If the warning stays, use the discovery diagnostic with the four minimal unowned edits listed above.
2. **EACCES on an MCP file.** Upstream skips it; today it is `{permission denied}`. Recommendation: follow upstream and update the WR-03 tests (unowned).
3. **`.mcpb`.** Recommendation: `unsupported.push("mcpServers")`, giving `{unsupported mcp}` partial, no new closed-set literal, and a doc row in "Partially available plugins".
4. **MCP-07.** It cannot be met. Recommendation: a decision ID plus a negative pin, and report it to the parent/user as a requirement that is impossible on 0.84.0.
5. **`domain/mcp-server-features.ts` ownership.** No phase owns it. Edit it only if FG-28 needs the classifier to change (probably not), and record it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | v24.22.1 | — |
| Claude Code binary | upstream probes | ✓ | 2.1.316 | — |
| Optional peer cache | cucumber | ✓ | adapter 7.0.0, subagents 0.84.0, workflows 3.15.0 | `node scripts/install-test-peers.mjs` |
| nondac-sh wrapper | root container | ✓ | — | — |
| Cucumber MCP seed | baseline | ✓ | 3 scenarios pass in 29 s (seed 886400) | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (unit, integration); @cucumber/cucumber 13.3.0 (behavioral) |
| Config file | `cucumber.json` (frozen); `tsconfig.json` |
| Quick run command | `/tmp/claude-0/-home-user-pi-claude-marketplace/5aec957e-dc04-5dcd-ad24-f2ccbabeb40f/scratchpad/nondac-sh -c 'NODE_OPTIONS=--max-old-space-size=6144 npx cucumber-js features/mcp-server'`; `node --test test/domain/mcp-resolution.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-resolution.ts` (with the nondac env) |
| Full suite command | `npm run check`; at the phase gate also `npm run test:modules` and `npm run test:cucumber` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | Search returns `mcp__plugin_demo_stub__echo`; call 2 offers it; stub logs one listing round; negative control: call 1 lacks it | cucumber | `npx cucumber-js features/mcp-server/listing.feature` | ❌ wave 1 |
| MCP-02 | Proxy call args reach the stub; result returned | cucumber | `npx cucumber-js features/mcp-server/invocation.feature` | ✅ seed |
| MCP-03 | `${CLAUDE_PLUGIN_ROOT}` in args, `${CLAUDE_PLUGIN_DATA}` and `${VAR}` in `STUB_TAG`, HTTP with headers | cucumber + `test/bridges/mcp/*` | `npx cucumber-js features/mcp-server/configuration.feature` | ❌ wave 2 |
| MCP-04 | Merge order (.mcp.json then manifest; entry only without plugin.json; array order); file-source malformed skipped; inline malformed `{malformed mcp}`; `.mcpb` `{unsupported mcp}` | cucumber (red proof before the fix) + unit | `node --test test/domain/mcp-resolution.test.ts` | ❌ wave 2 |
| MCP-05 | P2/P3 literals; allowed call | cucumber | `npx cucumber-js features/mcp-server/project-scope.feature` | ❌ (moved seed) |
| MCP-06 | Install row `{requires pi-mcp-adapter}`, info `missing: true`; later adapter reaches the server | cucumber | `npx cucumber-js features/mcp-server/companion-missing.feature` | ❌ |
| MCP-07 | Foreground agent: pinned refusal, stub without `tools/call` | cucumber | invocation.feature | ❌ |
| MCP-08 | Disable/uninstall → "not found" + `0/0 servers`; update → new tag; override survives | cucumber | `npx cucumber-js features/mcp-server/lifecycle.feature` | ❌ |
| FG-30 | Conformance where measurable | integration | `node --test test/integration/mcp-*.test.ts` | ✅ partly |

Red proofs: MCP-04 (merge, skip, unwrapped reference) must fail on today's resolver before the fix. Each other scenario pins existing behavior, and its negative control is the paired scenario (enabled vs disabled, trusted+allow vs blocked).

### Sampling Rate
- **Per task commit:** the touched feature file + the pair test + `npm run check:features`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check`, `npm run test:modules`, `npm run test:cucumber` (record seeds)

### Wave 0 Gaps
None: the harness exists. Wave 1 must add the shared steps and every `mcp-server-files.ts` writer before wave 2.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | TypeBox and `classifyMcpServer` over untrusted plugin JSON; a malformed inline config is refused |
| V12 Files and Resources | yes | `resolveContainedComponentPath` keeps refusing absolute or escaping references (upstream refuses too) |
| V14 Configuration | yes | Never write adapter approval files (NFR-10); plugin cannot set `auth`/`approveTools` (ANAME-07) |
| V2/V3/V4/V6 | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A plugin's file reference reads outside its root | Information disclosure | keep the fatal containment refusal |
| A malformed file silently drops a server the user expects | Repudiation (low) | Upstream parity; `claude plugin validate`-style diagnostics are out of scope |
| A project plugin server runs without approval | Elevation | adapter trust (D-CF6-03), pinned by P2/P3 |
| The HTTP stand-in reachable off-host | Tampering | bind `127.0.0.1` only |

## Suggested plan split (ROADMAP wave template)

- **Wave 1, 06-01 (tracer, MCP-01):** `features/mcp-server/listing.feature`, `features/step_definitions/mcp-server/listing.steps.ts` (shared steps: per-call tools Then, docstring tool-result Then, `pi offers these mcp tools:`, generalized stub-variant Givens, a token-projecting listing wait), `features/lib/mcp-server-files.ts` (every writer wave 2 needs: stub with custom args/env, manifest and entry `mcpServers` writers in all shapes, an agent file writer per D-CF6-07, an override writer). Leave `calls.steps.ts` frozen for wave 2.
- **Wave 2 (parallel, disjoint files):**
  - 06-02 configuration (MCP-03, MCP-04): `configuration.feature`, `configuration.steps.ts`, `features/lib/mcp-server-http.ts`, product `domain/mcp-resolution.ts`, `domain/components/mcp.ts`, `test/domain/mcp-resolution.test.ts`, `test/integration/mcp-migration.test.ts`. Out of ownership: `test/domain/plugin-resolver.test.ts` (and the ledger test if it breaks). Raise these as a parent line or make a minimal edit recorded as P6-DC.
  - 06-03 invocation (MCP-02, MCP-07): `invocation.feature` (seed kept), `invocation.steps.ts`.
  - 06-04 companion-missing + project scope (MCP-05, MCP-06): `companion-missing.feature`, `project-scope.feature` (move the Phase 1 allowed scenario out of `invocation.feature`; that touches 06-03's file, so do the move in wave 1 or give both to one plan), the step modules, and only if needed the pi-mcp-adapter arm of `shared/concerns/soft-dep.ts`.
  - 06-05 lifecycle (MCP-08): `lifecycle.feature`, `lifecycle.steps.ts`; product `bridges/mcp/**` only if a break appears (none measured).
- **Wave 3, 06-06:** `docs/mcp-compatibility.md` per the FG-30 checklist; decision IDs (D-CF6-10 MCP-07 gap); SUMMARY parent lines (CHANGELOG; PRD MC-1/MC-3; `docs/output-catalog.md` prose; the canary raise; the hooks-compatibility reconcile with Phase 5; BACKLOG MCP-07 background-child harness); the phase gate.

## Sources

### Primary (HIGH confidence)
- Claude Code 2.1.316 binary strings (`Vbt`, `mit`, `KKn`, `fKn`, `vfe`, `uH`, manifest schema `Hl`) and sandboxed probes cc1, cc2, cc3 (this session)
- pi-mcp-adapter 7.0.0 source: `project-server-trust.ts`, `config.ts`, `index.ts`, `proxy-modes.ts`, `deferred-tool-surface.ts`, `types.ts`, `server-manager.ts`, `mcp-status.ts`, `claude-plugin-loader.ts`, `mcp-auth-flow.ts`, CHANGELOG 5.2.0-7.0.0
- MCP SDK client 2.3.1 `dist/index.mjs`
- pi-subagents 0.84.0 `docs/agents.md`, bundle chunks `V2BZYLEP`, `XDQORLZ5`, `LNRJCP2Y`
- Cucumber harness probes P1-P7 (scratch step module + scratch features, run against the real harness)

### Secondary (MEDIUM)
- code.claude.com/docs/en/plugins-reference (mcpServers, entry/manifest combination); code.claude.com/docs/en/plugin-marketplaces

## Metadata

**Confidence breakdown:**
- Upstream merge/malformed: HIGH (binary + probes + docs agree)
- Adapter behavior/texts: HIGH (measured)
- MCP-07 cause, `MCP_DIRECT_TOOLS`: MEDIUM/LOW

**Research date:** 2026-11-01
**Valid until:** 2026-12-01 (pins exact versions)
