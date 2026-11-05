# Phase 1: Foundation and Pi 1.5.0 - Research

**Researched:** 2026-11-04
**Domain:** Pi extension peer raise, D-05 run snapshot, pure MCP implementation profiles, additive install-record field, closed-set append, dual-profile cucumber harness
**Confidence:** HIGH for everything measured in this session (Pi 1.5.0 typecheck and suites, the shared-Pi-with-adapter experiment, fallow behavior); MEDIUM for wave sequencing and CI estimates

## Summary

The Pi 1.5.0 raise is mechanical in this tree. In a scratch worktree with the 1.5.0 trio installed, `tsc --noEmit` reports nothing, and the architecture tests, `npm run test:modules`, `npm run test:integration`, the whole pinned e2e suite (with `test/e2e/pi-peer-floor` moved to 1.5.0), and both cucumber shards (1177 + 380 scenarios) pass. The only failures are the two literal pins in `test/architecture/peer-floor.test.ts`. `createReadTool()`, the pi-ai TypeBox move, pi-schema validation text, and the `isProjectTrusted()` fix need no code change: no expectation quotes Pi's tool-validation text, and the untrusted harness profile writes no saved "Do not trust" decision, so no scenario flips.

The phase's real risks are in the harness. CONTEXT's "the shared Pi follows the profile" (P1-DC-03) was tried here: the shared Pi was loaded with pi-mcp-adapter 7.0.0. Without mitigation, 66 scenarios failed. 5 `Before()` resets timed out at 30 s. Several `EEXIST` errors came on `<agent dir>/settings.json`. Every MCP install step `..., which warned` broke, because the install is now `info`. The 9 lifecycle scenarios with `{requires pi-mcp-adapter}` rows broke too. The lifecycle shard ran 1m40s → 3m07s. The cause: the adapter writes `-builtin:mcp` and `mcp-onboarding.json` into the sandbox on every session start, after each reset. When `Before()` first seeds `<agent dir>/mcp-onboarding.json` with `piBuiltinMcpHandledVersion` equal to the adapter's version, the timeouts and `EEXIST` disappear. The lifecycle shard then takes 2m17s and the components shard 3m20s (vs 3m15s). What fails then is exactly the predictable set: 47 of the 49 `features/mcp-server/**` scenarios, `hook/tool-use.feature:322`, and the 9 marker rows. Phase 1 must rewrite their adapter-profile expectations.

Fallow is a second hard constraint. Every export Phase 1 adds to a frozen file but that only a later phase consumes (for example `profileFor`, `effectiveMcpCompatibility`, `recordedMcpServers`, `McpServerConfig`, `RegisteredMcpServer`) is an `unused-export` or `unused-type` error under `production.deadCode`. A source `fallow-ignore` marker would become a `stale-suppressions: "error"` failure on the child branch that starts using the export, and that branch cannot edit the frozen file. A per-file `ignoreExports` entry in `.fallowrc.json` covers both functions and types and is never reported stale (both measured). Use it.

**Primary recommendation:** Run waves W1 (raise, decisions, domain seam, closed set) → W2 (harness, snapshot) → W3 (record producer, wiring) → W4 (`recorded-servers.ts`, gate). Seed the adapter's onboarding state in the shared-Pi reset. Exempt not-yet-consumed frozen exports through `.fallowrc.json` `ignoreExports`, never through source markers. Implement `effectiveMcpCompatibility` completely in Phase 1, because no later phase may edit it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Decision IDs (MDEC-01)

- D-MB-01..D-MB-07 keep the IDs and the text REQUIREMENTS.md gives them. Each
  gets its own row in PROJECT.md Key Decisions, in the table's existing form.
- The parity defaults REQUIREMENTS.md lists get these IDs:
  - **D-MB-08 (hook matchers):** a plugin hook's matcher sees a built-in MCP
    tool with Claude's server segment, `plugin_<plugin>_<server>` with `-`
    kept, because the extension owns the plugin and server names. Only the
    tool segment's `-` to `_` fold is a divergence, licensed by a Pi capability
    gap: Pi's `getAllTools()` does not return the original tool name. Phase 5
    implements it.
  - **D-MB-09 (trust):** a project-scope plugin's built-in servers register
    only when `ctx.isProjectTrusted()` is true, checked per registration in
    every runtime, background children included. Trust comes from Pi alone
    (D-LOC-01). The known weakness, that Pi trusts a project whose `.pi/` holds
    none of Pi's protected entries, is accepted with D-LOC-01 and is not
    strengthened.
  - **D-MB-10 (registration timing):** built-in servers are registered at
    `session_start` and again after the load reconcile (`loadReconcile`),
    never at once on install, uninstall, enable, or disable (that is
    MCPV2-01). The reload hint stays the same for every component kind.
  - **D-MB-11 (OAuth client):** under built-in, a plugin server with OAuth
    gets `oauth.clientName: "Claude Code (plugin:<plugin>:<server>)"`, the
    name Claude Code 2.1.318 sends in dynamic client registration
    (`client_name:\`Claude Code (${this.serverName})\``, read from the binary
    on 2026-11-04). `clientRegistration` is never written, so Pi's 1.5.0
    default `"auto"` applies. That matches Claude Code 2.1.318, whose provider
    offers a CIMD `clientMetadataUrl` when the redirect is the loopback
    `/callback` and registers through DCR otherwise. Phase 2 implements it.
  - **D-MB-12 (background children):** a pi-subagents background child that
    loads the extension writes no file: no agent rewrite, no `state.json`, no
    config, no `mcp-adapter.json`. It may register built-in servers for its own
    session (registrations are session-only and write nothing), under the same
    trust gate. Phase 4 implements the child detection.
  - **D-MB-13 (built-in names):** the registered built-in server name is
    `plugin_<plugin>_<server>`, with every character outside `[A-Za-z0-9_-]`
    replaced by `_` (Claude Code's own normalization of
    `plugin:<plugin>:<server>`), and **`-` kept**. Pi accepts it: Pi 1.5.0's
    server-name rule is `/^[A-Za-z0-9_-]+$/` with no length limit
    (`dist/core/mcp-servers.js` `SERVER_NAME`). Pi folds `-` to `_` only in the
    namespace (`mcpNamespace`) and in tool names, and cuts a tool name over 64
    characters to 55 characters plus `_` plus the first 8 hex of
    `sha256("<server>\0<tool>")` (`dist/extensions/mcp/tools.js`
    `createMcpToolName`). Both are divergences licensed by Pi capability
    gaps. So "Pi's long-name rule" in frozen interface 8 lives in the profile's
    tool-name function (`toolNamePrefix` and whatever full-tool-name helper the
    planner adds), not in `builtinMcpServerName`. A collision hash that Pi adds
    only because two tools sanitize to one name (`isTaken`) cannot be
    predicted from the records, and is a recorded gap.
- PROJECT.md: the APL-D1 text gains D-MB-03 (a load may rewrite generated
  agent files whose MCP grants differ for the active implementation); the
  Current Milestone section names D-MB-01..D-MB-13; the Pi API constraint line
  names the 1.5.0 floor.

#### Pi 1.5.0 raise (PI15-01..03)

- Pins: `@earendil-works/pi-coding-agent` dev `^1.5.0` and peer `>=1.5.0`;
  `@earendil-works/pi-tui` dev `^1.5.0` (its peer stays `*`);
  `@earendil-works/pi-ai` dev exactly `1.5.0`; `package-lock.json`
  regenerated. No new dependency (research STACK.md).
- The floor tests (`test/architecture/peer-floor.test.ts`,
  `test/e2e/pi-peer-floor/**` with its own lock,
  `test/e2e/pi-json-output.test.ts`) prove 1.5.0.
- Fix what 1.5.0 breaks in the same wave: `createReadTool()`'s return type,
  pi-ai no longer re-exporting TypeBox, pi-schema validation (grep every
  expectation that quotes a TypeBox validation message), and the
  `isProjectTrusted()` fix (re-run every untrusted-profile scenario and record
  any flip). A flip is fixed in the harness or the scenario, never by
  weakening the product's trust handling. The `clientRegistration` `"auto"`
  default needs no Phase 1 code, because nothing emits built-in OAuth yet
  (D-MB-11 omits it in Phase 2).
- Version text: README, `README.es.md`, the compatibility docs, `AGENTS.md`,
  `.planning/codebase/STACK.md`, PROJECT.md's Pi API constraint, and one
  CHANGELOG line under Unreleased name Pi 1.5.0. This is the only CHANGELOG
  line Phase 1 writes.

#### Active implementation snapshot (MSEL-01)

- `SoftDepStatus.mcpImplementation: ActiveMcpImplementation`, decided once per
  run snapshot (D-05) with the precedence adapter, then built-in, then none:
  the adapter when `/mcp-adapter` is loaded (today's `hasLoadedPiMcpAdapter`);
  built-in when Pi lists an `mcp` command whose `sourceInfo.path` is
  `builtin:mcp`; otherwise none. `piMcpAdapterLoaded` stays, equal to
  `mcpImplementation === "adapter"`, so every current reader keeps its bytes.
- A third extension that replaces `/mcp` (its `sourceInfo.path` is not
  `builtin:mcp`) reads as `none`: the extension can name neither
  implementation as active, and registering into an unknown connector would
  risk the extension error MSEL-03 forbids.
- Nothing probes before `session_start`. An architecture test fails on a probe
  reachable from the extension factory or from a handler that runs before
  every extension has loaded.
- In Phase 1 no reader changes its output: markers, severities, verdicts, and
  `requires:` still read `piMcpAdapterLoaded`. Phase 3 switches the readers.

#### Profiles and effective compatibility (frozen interfaces 1 and 4)

- `domain/mcp-implementation.ts` holds the frozen shapes from ROADMAP
  interface 1. `profileFor("adapter")` reproduces today's verdict table and
  naming byte for byte. `profileFor("builtin")` adds `sse` as blocked
  (`(unsupported sse)`, Pi rejects SSE), supports `bareElicitationCapability`
  (Pi announces no elicitation), and blocks the leading `~`, `headersHelper`,
  `ws`, the host-only types, and truthy `oauth.xaa` as the adapter does
  (research FEATURES.md three-column table). Malformed stays one Claude-shape
  check shared by both profiles.
- `mcp-server-features.ts` splits `classifyMcpServer` into that shared
  Claude-shape check and per-profile scanners; the adapter result is
  unchanged. `McpUnsupportedFeature` gains `"sse"`.
- `effectiveMcpCompatibility(stored, recorded, active)`:
  - A stored compatibility without a neutral mark carries the adapter's
    verdict. That covers every record written before Phase 3's producer
    change, including the records Phase 1 writes, because Phase 1 keeps the
    stored compatibility as it is today.
  - Phase 1 freezes how a record says its stored compatibility is neutral: an
    optional, additive field in `persistence/state-io.ts` with no schema bump
    (the `resolvedSha` precedent). The planner names it. Phase 3's producer
    writes it, so Phase 3 changes no frozen file.
  - Invariants: under the adapter, a legacy record's effective result equals
    its stored verdict exactly; under built-in or none, the MCP part is
    recomputed from the recorded servers with the active profile (none: a
    server is blocked only when every profile blocks it); a block that does
    not depend on the implementation (a `.mcpb` or `.dxt` bundle, which no
    recorded server represents) is never lost by the read; and when the
    recorded servers cannot be read, the stored verdict stands under every
    implementation.
- `resolved.declaredMcpServers` holds every non-malformed server in D-CF6-01
  merge order; `resolved.mcpServers` stays the adapter-supported subset the
  mcp phase stages into `mcp-adapter.json` under every implementation
  (MSEL-04).

#### Records (MREC-01, frozen interface 3)

- `mcpServerConfigs?: ReadonlyArray<{ readonly name: string; readonly config: unknown }>`,
  optional and additive, no schema bump. It holds every declared,
  non-malformed server in merge order, as the plugin declared it, before
  plugin-variable substitution (D-MB-04), including servers the adapter
  blocks. `state.json` holds no absolute path: a test pins that no recorded
  value contains the plugin root, the data directory, or the home directory.
- Absent means the record predates the field, never "no servers"; a present
  empty array means the plugin declares no non-malformed server. The field is
  read only through `recordedMcpServers(record, reader)` in
  `orchestrators/mcp/recorded-servers.ts`, whose legacy fallback re-resolves
  read-only from `record.resolvedSource` and writes nothing.
- Install, update, reinstall, enable, and import write it through the shared
  producer (`statePhase` and the update record write). List, info, and
  install output stays byte-identical.

#### Closed set, one commit (frozen interface 10)

- Reasons appended to `notification-types.ts`, the `REASONS` wire map,
  `notify-reasons.ts` (`UnsupportedReason` group), the lock test,
  `docs/json-output.md`, and the catalog counters: `requires mcp` and
  `requires builtin mcp` (D-MB-07's words, lowercase like every reason token,
  D-16-15). `requires pi-mcp-adapter` stays.
- Rendering rules that Phase 3 follows: the MCP marker takes the MCP slot of
  the soft-dependency order (agents, then mcp, then workflows); a row carries
  at most one MCP `requires` marker; it comes after the row's content reasons,
  so D-MB-07's example renders `{unsupported mcp, requires pi-mcp-adapter}`;
  its severity is the severity `requires pi-mcp-adapter` has today.
- The `requires:` line names come from the same commit: the `Companion` union
  (`shared/concerns/soft-dep.ts`, type only) and the wire's `COMPANIONS` map
  gain `mcp` and `builtin mcp`, so `info` can print `requires: mcp (missing)`
  and JSON can carry `{"companion":"mcp","missing":true}` without Phase 3
  touching a frozen file.
- MCP server status tokens appended to `McpServerStatus` and
  `MCP_SERVER_STATUS`: `overridden by mcp.json` (Claude Code's "overridden by"
  wording, as `overridden by project scope` already follows) and
  `project not trusted`.
- Phase 1 emits none of them. If a gate requires every closed-set entry to be
  emitted somewhere, the planner records the exception the same way earlier
  milestones did, and Phase 6 removes any entry the combined tree never emits.

#### Dual-profile cucumber harness (DUAL-01..03, frozen interface 9)

- `cucumber.json` gets the profiles `adapter` and `builtin`, each setting the
  world parameter `mcpImplementation`. A run with no `--profile` is the adapter
  profile, so `npx cucumber-js <file>` keeps working.
- What runs where: the adapter profile runs every scenario except
  `@builtin-only`; the builtin profile runs the `@mcp` and `@builtin-only`
  scenarios except `@adapter-only`. A scenario that chooses its own
  implementation (`none`, the switch) carries `@own-implementation` and runs
  once, in the adapter profile only. Non-MCP scenarios run once.
- The run's shared Pi follows the profile: under the adapter profile it loads
  pi-mcp-adapter, so install, list, and info through the shared Pi see the
  adapter; under the builtin profile it loads no companion and keeps Pi's
  built-in MCP. It still loads no model.
- Every Pi a profile starts, the shared Pi and each profile Pi, is checked at
  start against the extension's own detection rule (`/mcp-adapter` loaded;
  otherwise `/mcp` from `builtin:mcp`; otherwise none) through a harness-side
  probe, and the scenario fails when the Pi does not run the profile's
  implementation. This adds no product output (DUAL-02).
- One shared step loads "the MCP implementation": the adapter companion under
  the adapter profile, nothing under the builtin profile. No `@mcp` scenario
  names pi-mcp-adapter in a companion table; only an `@adapter-only` scenario
  may. An architecture test fails when an MCP scenario (one that uses an MCP
  step or installs a plugin with MCP servers) lacks `@mcp`, `@adapter-only`,
  `@builtin-only`, or `@own-implementation`, and when an `@mcp` scenario names
  the adapter literally.
- `@adapter-only` and `@builtin-only` scenarios name their reason in the
  scenario title or the feature description: a decision ID, or the owning
  phase while a phase still has to remove the tag.
- Restart steps (frozen, for the switch and `none` scenarios): restart Pi with
  the adapter added; restart Pi with the adapter removed (the sandbox settings
  keep whatever `-builtin:mcp` the adapter wrote, as a real removal does);
  turn Pi's built-in MCP on, which removes `-builtin:mcp` from the sandbox
  user settings as the user would (D-MB-01 forbids the extension, not the
  harness, from editing Pi settings); and restart Pi with no MCP through
  `--no-mcp` in `test/e2e/_rpc.ts` `piArguments`. Each restart keeps the
  sandbox, so the installed plugins survive.
- Built-in stand-in server: a harness Pi extension under `features/lib/`,
  loaded through `extraExtensions`, registers the stub MCP server with
  `pi.registerMcpServer` under `builtinMcpServerName(plugin, server)` only
  when Pi has no registration and no `mcp.json` server of that name. So it
  serves Phase 4 and Phase 5 built-in scenarios before Phase 2 lands, and
  after Phase 2 merges the extension's own registration serves them with no
  collision and no "overridden" report. It is never loaded under the adapter
  profile. Phase 2's own scenarios never use it.
- Isolation: under the builtin profile the shared Pi can start real stub
  processes. The reset asserts that no stand-in or stub process the shared Pi
  started outlives its scenario, as HAR-05 does for profile Pis.
- CI: the behavioral matrix gains a profile axis; the shard test checks
  `(profile, path)` pairs; every job timeout stays at least 1.5 times its
  measured run and never below 15 minutes (D-CF1-16). The phase measures both
  profiles and records the numbers.
- Phase 1 tags each MCP feature that fails under built-in `@adapter-only` with
  its owning phase, and moves every row whose MCP marker or state depends on
  the active implementation into a Phase 3 file, per the ROADMAP ownership
  table. `features/mcp-server/agent-grants.feature` takes the MCP-07 agent
  scenario out of `invocation.feature`.

#### Wiring (frozen interfaces 5-7)

- `orchestrators/mcp/session-materialize.ts` runs, at `session_start`, the
  built-in registration step and then the agent-grants step, each in its own
  try/catch and each a no-op seed in Phase 1. `index.ts` calls
  `resyncBuiltinRegistrations` again after `loadReconcile`. Neither seed
  writes or registers anything in Phase 1.
- `PiMcpRegistry`, `McpServerConfig`, and `RegisteredMcpServer` land in
  `platform/pi-api.ts` (the NFR-11 chokepoint). The extension never handles
  `mcp_servers_change` (it would mark the extension as the connector).
- `EdgeDeps.mcpStatus: { adapter; builtin }`; `info.ts` picks the reader by
  `run.softDeps.mcpImplementation`. Under none it uses the adapter reader, so
  every row reads `status unknown` exactly as today when the adapter is
  absent. `platform/mcp-builtin-status.ts` is a seed that Phase 2 fills.

### Claude's Discretion

- Plan split and waves follow the ROADMAP's suggested parallel structure; the
  planner may split further where plans in one wave own disjoint files.
- The neutral-compatibility field's name and shape, the full-tool-name helper
  in the profile, the harness probe that checks a Pi's implementation, the
  stand-in's step wording, and how the shared Pi's reset proves no stub
  survives.

### Deferred Ideas (OUT OF SCOPE)

- What `info`'s `requires:` line shows while an implementation is active and
  runs every server (for example `requires: builtin mcp`), and the load
  warning row for a plugin that becomes partial after a switch: Phase 3.
- Whether a built-in server's status can tell `not loaded` from
  `not connected`, and how the first built-in session reports a legacy
  `mcp.json` entry: Phase 2 research.
- Immediate register and unregister (MCPV2-01), deny rules to
  `toolExposure: "hidden"` (MCPV2-02), background agents under built-in
  (MCPV2-03): v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PI15-01 | peer `>=1.5.0`, dev `^1.5.0` (coding-agent, tui), pi-ai exactly `1.5.0`, lock matches, `npm run check` passes | §Pi 1.5.0 raise: measured clean typecheck and suites; lock diff summary; the two failing peer-floor literals |
| PI15-02 | floor tests prove 1.5.0; README, README.es.md, compat docs, AGENTS.md, STACK.md, PROJECT.md name it | §Version-text inventory with exact lines; e2e floor fixture measured passing on 1.5.0 |
| PI15-03 | what 1.5.0 breaks is fixed; unit, integration, cucumber pass on 1.5.0 | §What 1.5.0 breaks here: nothing in code; trust fix flips no scenario; pi-schema text quoted nowhere |
| MSEL-01 | one active implementation per run; nothing reads it before every extension loaded | §Snapshot: one `getCommands()` read, precedence, call-count preservation, factory-probe ban as a runtime architecture test |
| MREC-01 | records hold every declared non-malformed server, pre-substitution, no absolute paths | §Record producer: three producer sites (incl. the disabled-update refresh in `update-preflight.ts`), compat-01 key pin, absolute-path test scope |
| DUAL-01 | adapter and builtin profiles; shared steps; tagged implementation-specific scenarios | §Harness: cucumber.json profiles, world parameters in `BeforeAll`, tag rules in `check-features.mjs`, inventory |
| DUAL-02 | each profile's Pi proves its implementation; tag architecture test | §Harness probe via RPC `get_commands`; launch-config expectation; tag rule on pickles |
| DUAL-03 | CI runs both profiles within timeouts | §CI: measured local and hosted times, three-leg matrix, `test:cucumber` script split |
| MDEC-01 | D-MB-01..13 in PROJECT.md Key Decisions; APL-D1 and Current Milestone updated | §PROJECT.md edits, including the stale `>=1.0.0` line and the "after substitution" sentence |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Never commit to `main`; commit on `features/mcp-builtin`; never rebase, amend, or `--no-verify`; titles per `.agents/skills/committing/SKILL.md` with no milestone, phase, plan, wave, or task identifier.
- Read a file before editing it; trace callers before changing a function.
- `npm run check` (typecheck, ESLint, fallow, Prettier, pairing, unpaired tests, integration, cucumber, 100% direct coverage per source-test pair) is the gate for every wave, the phase gate, and the merge gate. A passing commit hook is not a gate.
- A user-visible `/claude:plugin` behavior change ships a cucumber scenario. Phase 1 changes no user-visible output, so it adds no red-proof scenario, but it must keep every scenario green under both profiles.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap.
- NFR-1 atomic writes; NFR-2 no Pi restart, and no throw past `session_start` or `resources_discover`; NFR-5 network rules (BLOCK F); NFR-10 containment; NFR-11 the Pi peer is imported only in `platform/pi-api.ts` (rule `pi-peer-chokepoint`).
- Output only through `shared/notification-dispatch.ts`; no console or stdio in extension code (fallow rule pack).
- Every plan SUMMARY.md has `## Threat Flags`. Prefix `gsd-tools windows append --description` with `[mcp-builtin]`.
- Typed errors, named exports, explicit return types, cognitive complexity ≤ 15 in both ESLint and fallow, no `_setXForTest` seams (dependency injection).
- Comments and test titles cite durable IDs (D-…, NFR-…, requirement IDs), never `Phase NN` or plan IDs.
- Environment (CHILD-SESSION-BRIEF.md): run npm scripts with `npm_config_script_shell=<scratch>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; warm ESLint with a lone `npm run lint`; in `.claude/worktrees/...` run `npm run check:static` and tests by hand before committing; use `env -u GH_TOKEN -u GITHUB_TOKEN` if zizmor returns 401; declare deletions in `files_deleted`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-implementation detection | `platform/pi-api.ts` (`softDepStatus`) | `shared/notification-run.ts` (snapshot owner) | Only `platform` may read the Pi inventory (NFR-11); D-05 takes one snapshot per run |
| `McpImplementationId`/`ActiveMcpImplementation` types | `platform/pi-api.ts` | re-exported by `domain/mcp-implementation.ts` | `platform` may import only `shared` (`.fallowrc.json` rules), so the snapshot's field type cannot live in `domain` |
| Profiles, verdict tables, naming, effective compatibility | `domain/` (pure) | — | Pure functions both bridges and orchestrators may import; agents and hooks bridges cannot import `bridges-mcp` |
| Record field and schema | `persistence/state-io.ts` | `domain/resolver-types.ts` (producer type) | Persistence owns the schema; resolver owns `declaredMcpServers` |
| Record writes | `orchestrators/plugin/{install-outcome,update-swap,update-preflight}.ts` | — | The three places a record's version or compatibility changes |
| Session steps (seeds) | `orchestrators/mcp/` | `index.ts` (calls) | Entry may import orchestrators; steps get `pi` by injection |
| Status readers | `platform/mcp-status.ts`, `platform/mcp-builtin-status.ts` | `orchestrators/plugin/info*.ts` | Readers read Pi; info composes |
| Harness profile selection and probes | `features/support/**`, `features/lib/**`, `test/e2e/_rpc.ts` | `cucumber.json`, `scripts/check-features.mjs` | Test-side only; adds no product output |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | dev `^1.5.0`, peer `>=1.5.0` | Pi host API and the built-in MCP | Milestone target; `latest` dist-tag is `1.5.0` [VERIFIED: npm registry `npm view` 2026-11-04] |
| `@earendil-works/pi-ai` | exact `1.5.0` | Faux provider for the scripted model | pca@1.5.0 depends on it exactly, so npm dedupes to one instance [CITED: .planning/research/STACK.md] |
| `@earendil-works/pi-tui` | dev `^1.5.0` (peer stays `*`) | TUI types | Additive release [CITED: .planning/research/STACK.md] |

No new dependency. The regenerated lock adds `@earendil-works/pi-schema` 1.5.0 (transitive), a nested `minimatch` 11.0.3 under pi-coding-agent, and `@isaacs/nonrecursive-glob-match` 1.0.3, drops the nested `typebox` 1.3.27 copies under pi-ai and pi-agent-core, and moves `undici` 8.10.2 → 8.12.3 (transitive) [VERIFIED: scratch-worktree `git diff package-lock.json`]. `brace-expansion` stays 5.0.12.

**Installation:**
```bash
npm install --no-audit --no-fund   # after editing package.json pins; regenerates package-lock.json
cd test/e2e/pi-peer-floor && npm install --ignore-scripts --no-audit --no-fund   # after pinning "1.5.0"
```
Note: the first scratch install was interrupted and left truncated files (`undici-types/websocket.d.ts`). After any interrupted install, run `rm -rf node_modules && npm ci`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@earendil-works/pi-coding-agent@1.5.0` | npm | 2 days (published 2026-11-02) | unknown (seam saw none) | github.com/earendil-works/pi | [SUS] (`too-new`, `unknown-downloads`) | Approved with checkpoint: the existing peer, bumped; tarball read in this session; no postinstall |
| `@earendil-works/pi-ai@1.5.0` | npm | 2 days | unknown | github.com/earendil-works/pi | [SUS] (same reasons) | Approved with checkpoint |
| `@earendil-works/pi-tui@1.5.0` | npm | 2 days | unknown | github.com/earendil-works/pi | [SUS] (same reasons) | Approved with checkpoint |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** all three, only because the release is two days old and the seam had no download data through the proxy. They are existing dependencies at a new version that the user's brief requires. `npm view ... scripts.postinstall` printed nothing [VERIFIED: npm registry]. The planner should satisfy the `checkpoint:human-verify` from this evidence. The user ordered "never stop to ask", so this is logged as a dubious choice, not a stop.

## What Pi 1.5.0 breaks in this tree (measured)

| Area | Expectation in CONTEXT | Measured result | Action |
|------|-----------------------|-----------------|--------|
| `createReadTool()` return type (`platform/pi-api.ts:296-307`) | maybe breaks | `tsc --noEmit` clean | none |
| pi-ai no longer re-exports TypeBox | maybe breaks | repo imports no TypeBox from pi-ai; typecheck clean | none |
| pi-schema validation messages | grep expectations | No feature or test quotes Pi tool-validation text. The `must be boolean` / `must have required properties` hits are the extension's own typebox (`persistence/*`, `autoapply.feature`) | none |
| `isProjectTrusted()` saved-"no" fix | re-run untrusted scenarios | The untrusted profile starts with **no** `trust.json` entry and a `.pi/settings.json` (`companion.steps.ts:58-82`, `model.steps.ts:66-78`). The fix changes only the saved-"Do not trust" case, and the full lifecycle and components shards pass | none; record "no flip" |
| `clientRegistration: "auto"` | no Phase 1 code | correct | none (see Dubious Choices on D-MB-11) |
| Floor literals | — | only `test/architecture/peer-floor.test.ts` fails (2 cases: lines 38-47 and 74-90) | update literals and titles |

Measured on the scratch worktree with the 1.5.0 trio installed: `npm run test:architecture` (818 tests, 2 fail as above), `npm run test:modules` (exit 0), `npm run test:integration` (exit 0), `npm run test:e2e` with the fixture pinned to 1.5.0 (exit 0; `pi-json-output` reports "peer floor: Pi 1.5.0"), `npm run test:cucumber` lifecycle shard (1177/1177, 1m42s) and components shard (380/380, 3m17s) [VERIFIED: scratch runs, logs in the session scratchpad].

### Version-text inventory (PI15-02)

| File | Line | Change |
|------|------|--------|
| `package.json` | devDependencies 19-21, peerDependencies 62 | pins |
| `test/architecture/peer-floor.test.ts` | 38, 47, 74, 88-90 | literals and titles |
| `test/e2e/pi-peer-floor/package.json` + its lock | 6 | `"1.5.0"`; regenerate lock |
| `test/e2e/pi-json-output.test.ts` | 39, 41 | `"1.5.0"` |
| `README.md` / `README.es.md` | 38 | "1.5.0 or newer" / "1.5.0 o posterior" (readme skill: keep both in sync) |
| `AGENTS.md` | 57 | `>=1.5.0` (dev `^1.5.0`) |
| `.planning/codebase/STACK.md` | 32-34 | pins |
| `.planning/PROJECT.md` | 1554 (still says `>=1.0.0`/`^1.0.0`) | `>=1.5.0` (dev `^1.5.0`): owned by the Decisions plan |
| `docs/workflows-compatibility.md` | 7, 13, 208, 213, 217 | floor statement (208, 213) and "scenario-measured … inside Pi 1.4.0" (7, 13, 217) → 1.5.0. This research re-ran those scenarios on 1.5.0 |
| `docs/mcp-compatibility.md` | 9, 78 | the scenario-basis statements → 1.5.0 (re-measured). Leave dated "A run of Pi 1.4.0 on 2026-11-01" sentences (80, 90, 139, 265) as dated history, or re-measure: they name the run, not the floor |
| `docs/hooks-compatibility.md` | 344 | "Pi 1.4.0 trusts, without asking, a project that holds none of Pi's own settings files" → 1.5.0, and add that 1.5.0 honors a saved "Do not trust" |
| `extensions/.../bridges/skills/frontmatter-scan.ts` | 17 | comment "Pi 1.4.0's `parseFrontmatter`" → 1.5.0 (utils/frontmatter.js identical per STACK.md) |
| `CHANGELOG.md` | under `## [Unreleased]` | one bullet (changelog skill: ≤ 40 words, simple-english and humanizer) |
| `.github/workflows/ci.yml`, `e2e-nightly.yml` | — | no change: they run `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts`, which reads the regenerated lock |

## Architecture Patterns

### System Architecture Diagram

```text
Pi loads extensions (factory runs: registers handlers, NO inventory read)
        │
        ▼
session_start ──► index.ts handler
        │            ├─ applyMcpAdapterEnv / applySessionEnv (today)
        │            └─ session-materialize(pi, ctx) ─► openNotificationSnapshot(pi) ─► softDepStatus(pi)
        │                    │                              (getCommands ×1, getAllTools ×3)
        │                    ├─ builtinRegistrationStep({pi, ctx, snapshot})   [seed: no-op]
        │                    └─ agentGrantsStep({ctx, snapshot})               [seed: no-op]
        ▼
reportUnhandledMcpServers (Pi)          ← registrations here would error under adapter/none
        ▼
resources_discover ──► prepareResources
                     ├─ openNotificationRun(pi,{kind:"load"})  (snapshot incl. mcpImplementation)
                     ├─ hydrate hooks, loadReconcile(...)
                     ├─ resyncBuiltinRegistrations({pi, ctx, snapshot: run})   [seed: no-op]
                     └─ recomputePluginPath, aggregateDiscoveredResources

/claude:plugin <cmd> ──► openNotificationRun (command) ─► run.softDeps.mcpImplementation
     install/update/... ─► resolveStrict ─► resolved.{mcpServers (adapter subset), declaredMcpServers (all non-malformed)}
                       ─► statePhase / applyAllSuccessRecordFields / refreshDisabledRecord ─► record.mcpServerConfigs
     info ─► withServerStatus(block, record, mcpStatus[impl], impl, projectRecord)
```

### Recommended Project Structure (new files)

```text
extensions/pi-claude-marketplace/
├── domain/mcp-implementation.ts       # profiles, profileFor, effectiveMcpCompatibility, re-exported ids
├── domain/mcp-builtin-features.ts     # built-in scanner (sse blocked, elicitation supported)
├── orchestrators/mcp/session-materialize.ts
├── orchestrators/mcp/recorded-servers.ts
├── orchestrators/mcp/builtin-registration-step.ts   # seed; Phase 2 fills
├── orchestrators/mcp/agent-grants-step.ts           # seed; Phase 4 fills
└── platform/mcp-builtin-status.ts                   # seed reader; Phase 2 fills
test/<same paths>.test.ts                            # one pair each, 100% direct coverage
test/architecture/<factory-probe-ban>.test.ts        # unpaired, frozen
features/lib/<builtin-stand-in>/extension.ts         # harness Pi extension (frozen)
features/step_definitions/mcp-implementation.steps.ts  # the shared "MCP implementation" module (frozen)
features/mcp-server/agent-grants.feature             # MCP-07 split
features/mcp-server/verdict-*.feature                # the moved marker rows (a Phase 3 file name)
```

### Pattern 1: Snapshot field without changing probe call counts

**What:** Add `mcpImplementation` to `SoftDepStatus`. Read `getCommands()` once and hand the array to both the adapter command arm and the built-in arm. Each arm stays guarded.
**Why:** `test/edge/notification-boundary.ts:70-84` `expectSoftDepProbes` pins exact counts: `getAllTools` ×3 and `getCommands` ×1 per probe (strong-mock `times`). A second `getCommands()` call would break every edge test that uses it. One read keeps those tests unchanged.

```typescript
// Current shapes [VERIFIED: extensions/pi-claude-marketplace/platform/pi-api.ts:140-144, 164-168]
// export interface SoftDepStatus {
//   piSubagentsLoaded: boolean;
//   piMcpAdapterLoaded: boolean;
//   workflowEngineLoaded: boolean;
// }
// export interface CommandInventoryItem {
//   readonly name?: unknown;
//   readonly source?: unknown;
//   readonly sourceInfo?: { readonly source?: unknown };
// }
// Sketch [ASSUMED: shape is the planner's]:
export type McpImplementationId = "adapter" | "builtin";
export type ActiveMcpImplementation = McpImplementationId | "none";
// CommandInventoryItem.sourceInfo gains `readonly path?: unknown`.
// SoftDepStatus gains `mcpImplementation: ActiveMcpImplementation`;
// piMcpAdapterLoaded === (mcpImplementation === "adapter").
```

Pi 1.5.0 lists a built-in extension command with `source: "extension"` and `sourceInfo.path` `"builtin:mcp"`: `getCommands()` maps each registered command to `{ name: command.invocationName, description, source: "extension", sourceInfo: command.sourceInfo }` [VERIFIED: pi150 `dist/core/agent-session.js:2761-2767`], and `BUILTIN_PATH_PREFIX = "builtin:"` [VERIFIED: pi150 `dist/core/source-info.js:9`]. An extension that registers `/mcp` makes Pi leave out the built-in (`omitReplacedExtensions`, `dist/core/resource-loader.js:85-115`), so no `builtin:mcp` command exists then. `--no-mcp` sets `disabledBuiltinExtensions: ["mcp"]` [VERIFIED: pi150 `dist/main.js:644`, `dist/cli/args.js:163-164`].

### Pattern 2: Profiles as data plus one shared Claude-shape check

**What:** Split `classifyMcpServer` into `checkClaudeShape(config) → { kind: "malformed"; detail } | { kind: "valid"; transport; server }` and per-profile `scan(validServer) → McpUnsupportedFeature | undefined`. Keep the adapter result byte for byte. Keep the existing quirks:
- host-only types (`sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy`) are **blocked without validation** in both profiles;
- a valid `ws` server is blocked as `"ws"`;
- the order is `ws`, `headersHelper`, `oauth.xaa`, then for stdio `command ~` and `args ~`, then `bareElicitationCapability`.

The current union is [VERIFIED: extensions/pi-claude-marketplace/domain/mcp-server-features.ts:25-35]:
`"ws" | "sse-ide" | "ws-ide" | "sdk" | "claudeai-proxy" | "headersHelper" | "oauth.xaa" | "command ~" | "args ~" | "bareElicitationCapability"`.

**Coupling the Domain-seam plan must own:** `domain/resolver-types.ts:98-128` holds a TypeBox literal union of the same features (`DroppedMcpServerSchema`). Its drift checks assert two-way equality with `DroppedMcpServer`. Adding `"sse"` to `McpUnsupportedFeature` therefore fails typecheck unless the same commit adds `Type.TLiteral<"sse">` there. `unsupportedFeature` on the wire is a plain `string` (`notification-types.ts:1174`, `notification-wire.ts:483`), so no closed-set change is needed for `"sse"`.

**Naming:** `builtinMcpServerName(plugin, server)` = `mcpServerDisplayName(plugin, server)` with `[^A-Za-z0-9_-]` → `_`, without the trailing `_` that `generatedMcpServerKey` adds (`domain/name.ts:637-641`). That function's doc says "This is the only copy of the pattern". So extract a private helper that both builders use, rather than copying the regex. The full tool name reproduces Pi's rule [VERIFIED: pi150 `dist/extensions/mcp/tools.js:29,45-50`]:

```javascript
// verbatim from Pi 1.5.0
const MAX_TOOL_NAME_LENGTH = 64;
export function createMcpToolName(server, tool, isTaken = () => false) {
    const name = `mcp__${server}__${tool}`.replace(/[^A-Za-z0-9_]/g, "_");
    if (name.length <= MAX_TOOL_NAME_LENGTH && !isTaken(name))
        return name;
    const hash = createHash("sha256").update(`${server}\0${tool}`).digest("hex").slice(0, 8);
    return `${name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
}
```
The hash input is the **registered** server name (with `-`) and the original tool name. `SERVER_NAME = /^[A-Za-z0-9_-]+$/`, `mcpNamespace(server) = "mcp__" + server.replace(/-/g, "_")` [VERIFIED: pi150 `dist/core/mcp-servers.js:58-62`]. `node:crypto` is allowed in `domain/` (no rule-pack or BLOCK F ban covers it) [ASSUMED: re-check `rule-packs/architecture.json` `no-network-modules` list at plan time].

The adapter profile reproduces today's names: `serverName = generatedMcpServerKey`, `grantSelector = "mcp:" + key` (`bridges/agents/convert.ts:364`), tool prefix `mcp__<key-with-trailing-_>_`. Because `domain/mcp-implementation.ts` is frozen after Phase 1, **its whole logic must be complete and unit-tested in Phase 1**: profiles, naming helpers, and `effectiveMcpCompatibility`. Phases 2-4 only consume it.

### Pattern 3: Neutral-compatibility marker and the effective read (proposal)

**Proposed field** (top level of `PLUGIN_INSTALL_RECORD_SCHEMA`, optional, no schema bump):
`compatibilityBasis: Type.Optional(Type.Literal("neutral"))`
- absent: `compatibility` carries the adapter's MCP verdict (every record before Phase 3's producer, the records Phase 1 writes included);
- `"neutral"`: `compatibility.unsupported` holds `"mcpServers"` only for an implementation-independent block (a `.mcpb`/`.dxt` bundle). Phase 3's producer writes it.

**Proposed resolver addition** (in the Record-producer plan, with `declaredMcpServers`): `mcpBundle: Type.Optional(Type.Literal(true))` on the materializable arms, set when `merge.bundle` is true (`domain/mcp-resolution.ts` `recordMergedServers`). Without it, the legacy fallback cannot tell a bundle from an adapter-blocked server, because today both put `"mcpServers"` in `unsupported` (bundle: `merge.bundle`; blocked: `droppedMcpServers`) [VERIFIED: extensions/pi-claude-marketplace/domain/mcp-resolution.ts `recordMergedServers`].

**Proposed `recorded` input** (returned by `recordedMcpServers`) [ASSUMED: names are the planner's]:
```typescript
type RecordedMcpServers =
  | { readonly kind: "recorded"; readonly servers: readonly { name: string; config: unknown }[] }       // record.mcpServerConfigs
  | { readonly kind: "re-resolved"; readonly servers: readonly { name: string; config: unknown }[]; readonly bundle: boolean } // legacy fallback
  | { readonly kind: "unreadable" };
```

**Decision table for `effectiveMcpCompatibility(stored, recorded, active)`:**

| Case | Result |
|------|--------|
| `recorded.kind === "unreadable"` | stored verdict, every implementation |
| `active === "adapter"` and no `compatibilityBasis` | stored verdict exactly |
| otherwise | `unsupported` = stored minus `"mcpServers"`, plus `"mcpServers"` when (independent block) or (a recorded server is blocked by the active profile; under `none`, blocked by every profile) |
| independent block | `"neutral"`: stored has `"mcpServers"`; `"re-resolved"`: `recorded.bundle`; `"recorded"` without basis (a dev-only Phase-1-era record): stored has `"mcpServers"` and the adapter profile blocks none of the recorded servers; if it blocks some, keep the block (never lose it) |
| `installable` | Never turn `false` into `true` when the stored `false` has another cause: the update intent mark (`installable: false` with the update-in-progress note, `update-swap.ts:661` `markUpdateInProgress`), or another unsupported kind. A legacy record keeps its stored verdict under the adapter. |
| `blocked` | `{ server, feature }` per blocked recorded server for the active profile; under `none`, the adapter's feature for servers both profiles block (deterministic choice) |

### Pattern 4: Seeds that write nothing and probe nothing extra

- `session-materialize.ts`: opens `openNotificationSnapshot(pi)` once at `session_start`, then calls `builtinRegistrationStep({ pi, ctx, snapshot })` and `agentGrantsStep({ ctx, snapshot })`, each in its own try/catch with `hookDebugLog` (NFR-2).
- Put the call inside the existing `session_start` handler (`index.ts:236`) and make that handler async, rather than adding a fourth `pi.on("session_start", …)`. `test/index.test.ts` consumes registrations in declaration order (its header comment explains why). Either way `test/index.test.ts` changes: the handler now reads the inventory, so its session-start cases need `expectSoftDepProbes(pi, 1)`.
- `resyncBuiltinRegistrations({ pi, ctx, snapshot: run })` goes in `prepareResources` (`index.ts:136-175`) after the `loadReconcile` try/catch, in its own try/catch.
- Pi emits `session_start`, then `reportUnhandledMcpServers()`, then `resources_discover`, on startup and on reload [VERIFIED: pi150 `dist/core/agent-session.js:2698-2700, 3046-3048`].

### Pattern 5: Status call frozen with the implementation

`withMcpServerStatus` builds the lookup key with `generatedMcpServerKey(plugin, server)` (`orchestrators/plugin/info-mcp-status.ts:89`). That key is adapter naming. Phase 2 owns the body, but Phase 1 freezes the call. So the call must carry what the body needs to pick the naming: pass `{ reader, implementation }` (reader = `mcpStatus.builtin` when `mcpImplementation === "builtin"`, else `mcpStatus.adapter`, `none` included). Change both `withServerStatus` call sites in `orchestrators/plugin/info.ts` (≈3258 and ≈3298) and the signature in `info-mcp-status.ts` in Phase 1. The built-in seed reader's `lookup` returns `"no-snapshot"`. It must not touch `pi` at construction, because `index.ts` builds it at factory time.

### Anti-Patterns to Avoid
- **Source `fallow-ignore` markers on frozen exports.** They go stale the moment a child consumes the export, and the child cannot remove them. Use `.fallowrc.json` `ignoreExports` (measured below).
- **A second `getCommands()` per snapshot.** It breaks every `expectSoftDepProbes` case.
- **Registering anything in a seed.** Under adapter or none, Pi reports each registration as an extension error after `session_start` (`runner.js:506-519`).
- **Writing `mcpServerConfigs` from substituted configs.** The resolver hands raw JSON. Substitution happens in `bridges/mcp/substitute.ts` at staging. Write from `resolved.declaredMcpServers`, never from the mcp phase's staged entries.
- **Defining `ActiveMcpImplementation` in `domain/` and importing it into `platform/pi-api.ts`.** That edge is forbidden (`platform` → `shared` only).

## Fallow constraint, measured (critical for every plan)

`.fallowrc.json` has `production.deadCode: true`, `includeEntryExports: true`, and `"stale-suppressions": "error"` [VERIFIED: .fallowrc.json read this session]. fallow 3.35.0 is installed.

Probe on the scratch worktree:
- Adding `export type { McpServerConfig, RegisteredMcpServer }`, `export interface PiMcpRegistry`, and an unconsumed exported function to `pi-api.ts` gives `● Unused exports (1)` and `● Unused type exports (3)`, so `fallow dead-code --fail-on-issues` fails.
- Adding `"ignoreExports": [{ "file": "extensions/pi-claude-marketplace/platform/pi-api.ts", "exports": [<the four names>] }]` gives `✓ No issues found`.
- After a production module imports one of them, the result is still `✓ No issues found` and `0 stale suppressions`.

[VERIFIED: scratch fallow runs]. So:
- Every Phase 1 export that only Phases 2-5 consume gets a per-file, per-name `ignoreExports` entry in `.fallowrc.json` (frozen, owned by Phase 1). Candidates: `profileFor`, `effectiveMcpCompatibility`, `McpImplementationProfile`, the re-exported id types, `builtinMcpServerName`, the tool-name helper, `recordedMcpServers` and its types, `McpServerConfig`, `RegisteredMcpServer`, and any `PiMcpRegistry` member type a seed does not reference. Phase 6 removes the entries.
- Prefer real consumption where it is free. The registration seed's parameter type `PiMcpRegistry`, and the built-in status seed reading `RegisteredMcpServer[]`, are real consumers.
- Only one plan per wave may edit `.fallowrc.json`.

## Record producer (MREC-01)

Producer sites [VERIFIED: grep for every in-place `.version =` / `.compatibility =` / record literal, then Read]:
1. `install-outcome.ts` `statePhase` (`:1551-1665`): the full record literal. Install, enable (`runInstallLedger`), import (install flow), and cascades all reach it. Add `mcpServerConfigs: Object.entries(installCtx.resolved.declaredMcpServers).map(([name, config]) => ({ name, config }))`.
2. `update-swap.ts` `applyAllSuccessRecordFields` (`:877-905`): the all-or-nothing arm with `version` and `compatibility`. Update, reinstall (`reinstall-flow.ts` → `materialize-latest.ts` → the update runner), and apply's convergence all reach it. Write the field here, beside `compatibility`, not in `applyPerBridgeResources`. It describes the declaration of `toVersion`.
3. **`update-preflight.ts` `refreshDisabledRecord` / `nextDisabledPin` / `disabledPinProjection` (`:722-855`)**: updating a **disabled** plugin rewrites `version` and `compatibility` without materializing. The ROADMAP ownership table omits it, and it is Phase 3's file. Phase 1 must edit these functions before the fan-out: write the field there and include it in the projection, so a declaration-only change writes. Log this as a deviation from the table.

Other notes:
- `toDisabledRecord` (`state-io.ts`) spreads the record, so the field survives disable. `atCatalogVersion` and `PLANNED_INSTALL_RECORD` (`reconcile/convergence.ts:210`) are planning-only shapes, and an absent optional field is fine there.
- `test/architecture/compat-01-no-expansion.test.ts:655-674` pins the record key set with `IsExact`. Add `"mcpServerConfigs"` and the basis field there. The same file's `EXPECTED_REASONS` changes in the closed-set commit, so the two plans must be in different waves.
- **Absolute paths.** `resolvedSource` is already the absolute plugin root (`install-outcome.ts:1585`). "state.json holds no absolute path" cannot be literally true today. Scope the pin: no `mcpServerConfigs` value contains the plugin root, the plugin data directory, or HOME, given a fixture whose servers use `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `~`-free values. Also assert that the mcp phase did not mutate the resolver's config objects in place.
- `declaredMcpServers` is a required `Record<string, unknown>` on the materializable arms (interface 4). Typecheck will name every literal fixture. About 32 `deepStrictEqual` sites in `test/domain/plugin-resolver.test.ts` and the `mcp-resolution` tests need the field. Built with `Object.fromEntries` in merge order: a `__proto__` server stays a server.
- **Test-file overlap with the Snapshot plan.** Seven test files hold both `SoftDepStatus` literals and resolved-plugin literals: `import/execute.test.ts`, `plugin/enable-disable.test.ts`, `install-flow-fixture.ts`, `install-flow-ledger.test.ts`, `install-flow-results.test.ts`, `reinstall-flow.test.ts`, `update-flow.test.ts`. Put the two plans in different waves.

`recordedMcpServers(record, reader)`: the reader is the injected read-only IO for the legacy fallback. Recommended: `reader(record.resolvedSource) → Promise<ResolvedPlugin-like declaration>`, built by the caller from `{ readFileText, statKind }` plus the marketplace entry, which it reads from the **cached** `marketplace.json` through `domain/manifest.ts` `loadMarketplaceManifest` and `manifest-lookup.ts` `lookupDeclaredPlugin`, with no network. The entry is needed when the plugin has no `plugin.json`, because then the entry's `mcpServers` counts (`resolveStrictMcp`). Any throw → `{ kind: "unreadable" }`. In Phase 1 the file has no production consumer, so it gets an `ignoreExports` entry.

## Closed set (one commit)

Files [VERIFIED: grep + Read this session]:
- `shared/notification-types.ts`: append `"requires mcp" | "requires builtin mcp"` after `"already added"` (`:293`, tail). Brace order is content reasons then soft-dep markers, never sorted (`notification-resolve.ts` `composeRowReasons`; `notification-grammar.ts:413-419` joins as given), so appending at the tail is safe. Append to `McpServerStatus` (`:1145-1155`): `"overridden by mcp.json" | "project not trusted"`.
- `shared/notification-wire.ts`: `REASONS` (`:84-178`), `MCP_SERVER_STATUSES` (`:186-197`), `COMPANIONS` (`:199-203`, currently `"pi-dynamic-workflows" | "pi-mcp-adapter" | "pi-subagents"`).
- `shared/concerns/soft-dep.ts:37` `Companion` union (type only).
- `shared/notify-reasons.ts:109` `UnsupportedReason`: the partition proof fails to compile until both reasons have a home there.
- `test/architecture/notify-closed-set-locks.test.ts`: `REASON_ENROLLMENT`, the `McpServerStatus` enrollment, and the counts.
- `test/architecture/compat-01-no-expansion.test.ts`: `EXPECTED_REASONS` (`:184-…`) is an ordered enumeration.
- `schema/claude-plugin.schema.json`: **regenerate with `npm run schema:generate`**. `test/architecture/wire-schema.test.ts` deep-equals the committed file against a fresh build, and the enums change.
- `docs/json-output.md:949, 951, 953`: the `Reason`, `McpServerStatus`, and `Companion` lists. No test reads these lists (`json-output-docs.test.ts` checks fields and requiredness only), so they are maintained by hand.
- `docs/output-catalog.md` / `EXPECTED_STATE_COUNT = 324` / `EXPECTED_UTF8_BYTES = 54_652` (`catalog-contract.test.ts:21-22`): these count catalog **states** and example bytes. With nothing emitted, no state is added and the counters stay unchanged. Optionally document the new status tokens in the token table at `:3056`, which is prose outside example fences.
- `test/architecture/closed-set-enrollment.test.ts` `EMITTABLE_SOFT_DEP_MARKERS` lists what `softDepMarkers` emits. Phase 1 changes no emission, so it stays.

**Gate on unemitted entries:** none found. No test requires each closed-set member to be emitted or catalogued, and earlier additions (`overridden by project scope`) came with their emitter in the same commit. Record the "added, not yet emitted" fact in the commit body and the plan SUMMARY, and Phase 6 removes what stays unemitted.

## Dual-profile harness

### Measured: the shared Pi with pi-mcp-adapter 7.0.0 (adapter profile)

| Run (4 CPUs, parallel 8) | Lifecycle shard | Components shard |
|--------------------------|-----------------|------------------|
| Baseline, Pi 1.5.0, shared Pi without companions | 1177/1177, 1m40s | 380/380, 3m15s |
| Shared Pi loads the adapter, no mitigation | 9 failed, 3m07s | 57 failed (5 `Before` timeouts at 30 s, `EEXIST` on `<agent dir>/settings.json`), 4m39s |
| Shared Pi loads the adapter, `Before()` seeds `mcp-onboarding.json` | 9 failed, 2m17s | 48 failed, 3m20s, 0 timeouts, 0 `EEXIST` |

[VERIFIED: scratch runs with a temporary `SHARED_ADAPTER`/`SEED_ONBOARDING` hack in `features/support/pi-process.ts`]

Mechanism: on every `session_start` the adapter dynamically imports `pi-builtin-mcp.ts`. Unless `<agent dir>/mcp-onboarding.json` has `piBuiltinMcpHandledVersion === ADAPTER_VERSION`, it adds `-builtin:mcp` to `<agent dir>/settings.json` through Pi's `SettingsManager`, records the version, and notifies "Turned off Pi's built-in MCP …" [VERIFIED: adapter `pi-builtin-mcp.ts:13-27`, `index.ts:1721-1731`, `onboarding-state.ts:5-24`]. `Before()` empties the agent dir each scenario, so the write repeats every scenario. It races `hook/session.steps.ts:166` (`writeFile(…, { flag: "wx" })`) and turns built-in MCP off for every later profile Pi in that scenario.

Seed contents: `{"version":1,"sharedConfigHintShown":false,"setupCompleted":false,"piBuiltinMcpHandledVersion":"<resolveCompanion('pi-mcp-adapter').version>"}`. Write it in `Before()` after emptying and before `startSession`, under the adapter profile only.

Remaining adapter-profile failures, all predictable:
- `features/mcp-server/**`: 47 of 49 scenarios. Their `..., which warned` MCP install is now `info`, and the companion-missing rows changed.
- `hook/tool-use.feature:322`: same cause.
- The 9 marker scenarios: `marketplace/update.feature:7,52`; `plugin/apply.feature:556`; `plugin/staging-warnings.feature:251,269,295,315,358`; `plugin/update.feature:28`.

### Inventory and disposition (planner tasks)

| Scenario(s) | MCP scenario? | Phase 1 disposition | Reason token (prefer a requirement or decision ID over "Phase N") |
|-------------|---------------|---------------------|------------------------------------------------------------------|
| `mcp-server/{listing,configuration,sources,lifecycle,invocation,project-scope}.feature` (all) | yes | feature-level `@adapter-only`; rewrite each `..., which warned` MCP-only install to `the user has run` (keep `warned` where pi-subagents is also missing) | Phase 2 (BLT-0x) |
| `mcp-server/invalid-configs.feature` | yes | `@adapter-only` + the same rewrites | Phase 3 (MREC-04) |
| `mcp-server/companion-missing.feature` | yes | `@builtin-only`, text unchanged. Under the builtin profile the shared Pi has no adapter, so the old rows hold, and the profile Pis that name the adapter still load it. All 4 pass there | Phase 3 (MREC-05) |
| `mcp-server/invocation.feature` MCP-07 scenario (≈:204, row `requires pi-subagents, requires pi-mcp-adapter`) | yes | move to new `mcp-server/agent-grants.feature`, `@adapter-only`; drop `requires pi-mcp-adapter` from the row | Phase 4 (MGRT-01) |
| `hook/tool-use.feature:322` | yes | `@adapter-only`; `which warned` → `has run` | Phase 5 (MHK-01) |
| the 9 marker scenarios above | yes | move into one new Phase 3 file (e.g. `features/mcp-server/verdict-lifecycle-rows.feature`) as `@adapter-only`/`@builtin-only` **pairs**: the adapter twin without the marker (severity `info` where the marker was the only warning), the builtin twin as today | Phase 3 (MREC-03/05) |
| `agent/lifecycle.feature:114`; `plugin/install-rollback.feature:8,27,38,60`; `plugin/apply.feature:16,324,344,370,399`; `plugin/staging-warnings.feature:113,125,141,187`; `plugin/import.feature:1039,1074,1111,1145`; `plugin/update.feature:682`; `plugin/update-rollback.feature` (Background → feature-level tag, 6 scenarios) | yes (an mcp-adapter.json step or a declared server; no implementation-dependent row) | `@mcp`: pass under the adapter (measured) and run unchanged under builtin (they pass with today's shared Pi) | none needed |
| `skill/invocation.feature:29` (companion table names the adapter, no MCP step) | no | untagged | — |

Re-run both profiles after tagging. The table comes from a text scan plus the measured failure lists. Treat the cucumber runs as the authority.

### Tag rules: implement in `scripts/check-features.mjs`

- The script already dry-runs every pickle with the profile's tag filter cleared (`dryRun()` sets `tagExpression = ""`). It has each pickle's inherited tags, step texts, and arguments. Today it forbids every tag outside `Examples:` (`misplacedTagFindings`, rule text `features.md:63`). Both must change.
- MCP scenario := a pickle with a step whose text matches `/\bmcp\b/i`. This covers `declares the mcp server`, `stub mcp server`, `http mcp server`, `mcp-adapter.json`, and future child-phase steps without editing the frozen script. Companion tables are arguments, not text, so `skill/invocation.feature:29` stays non-MCP.
- Rules: an MCP pickle carries exactly one of the four tags. A pickle tagged `@mcp` has no `pi-mcp-adapter` in step text, table cells, or docstrings. The four tags are allowed on Feature, Rule, Scenario, and Examples, never with `@url`/`@github` semantics changed. `@adapter-only`/`@builtin-only` name a reason (decision or requirement ID, or a phase) in the title or feature description.
- `loadConfiguration({}, …)` in the script loads the `default` profile, so `cucumber.json` must keep a `default` key.

### cucumber.json and scripts

- Profiles do not inherit, and `-p builtin` replaces `default` (`from_file.js`: `profiles = ['default']` only when none is given). Repeat `import`, `format`, `order`, and `parallel` in each profile. Never put `paths` in a profile: `paths` is additive with CLI paths (`merge_configurations.js` `ADDITIVE_ARRAYS`). `tags` from profile and CLI are and-joined.
- `default` = `adapter` = `{ tags: "not @builtin-only", worldParameters: { mcpImplementation: "adapter" } }`. `builtin` = `{ tags: "(@mcp or @builtin-only) and not @adapter-only", worldParameters: { mcpImplementation: "builtin" } }`. Where does `@own-implementation` run? It carries none of `@builtin-only`, `@mcp`, or `@adapter-only`, so it runs under the adapter profile only. ✓
- `BeforeAll` receives `this.parameters` (= `worldParameters`) [VERIFIED: node_modules/@cucumber/cucumber/lib/runtime/executor.js:61], so the shared Pi can follow the profile.
- **`npm run test:cucumber -- <paths>` appends arguments only to the last command of a `&&` chain.** If `test:cucumber` runs both profiles, CI must call a separate single-profile script, for example `test:cucumber:profile` = `node scripts/install-test-peers.mjs && cucumber-js`, with `--profile $PROFILE $SHARD_PATHS`. Keep `npm run test:cucumber` running both profiles for `npm run check`.

### Harness probe and restart steps

- **Probe:** RPC `{ type: "get_commands" }` returns the same `{name, description, source, sourceInfo}` objects as the extension's `getCommands()` [VERIFIED: pi150 `dist/modes/rpc/rpc-mode.js:540-566`], and `test/e2e/_rpc.ts` `listedCommands` already extracts `sourceInfo.path`. Classify: any extension command `/^mcp-adapter(?::\d+)?$/` → adapter; else command `mcp` with path `builtin:mcp` → builtin; else none. Check the shared Pi at `BeforeAll`, after each `Before()` reset (cheap), and every profile Pi at start.
- **What each Pi must match:** compare each Pi against the implementation its **launch configuration** implies: adapter in its extensions → adapter; `--no-mcp` → none; sandbox `settings.json` containing `-builtin:mcp` at launch → none; else builtin. The shared Pi and Pis started through the "MCP implementation" step then equal the profile. A literal "every Pi equals the profile" would fail today's non-MCP profile Pis (scripted model only) under the adapter profile, and the `@own-implementation` restarts.
- **`--no-mcp`:** add an option to `RpcProfile`/`piArguments` (`_rpc.ts:242-254`). Note: `--no-extensions` is never used, because it also drops `builtin:mcp` (`_rpc.ts:19`).
- **Restarts** need a world method that stops the scenario's profile Pi (running `assertStandInsStopped`) and starts another in the same sandbox, keeping the harness dir. `usePiWithProfile` refuses a second start (`world.ts`). "Adapter removed" must first **wait** until `settings.json` holds `-builtin:mcp`, because the adapter's write is asynchronous after its `session_start`. In `@own-implementation` scenarios the profile-Pi start must remove the harness onboarding seed, so the real first-run write happens. "Turn built-in MCP on" removes only the `-builtin:mcp` entry and keeps the onboarding file, as a user would.
- **Stand-in:** register in the stand-in's **`session_start`** handler, not at factory time. It loads after the real extension (`extraExtensions` last), so its handler runs after the extension's. After Phase 2 it sees the extension's registration in `pi.getMcpServers()` and steps aside. A factory-time registration would take the name first and make Phase 2's registration throw (`loader.js:386-395`). Compare names `-`/`_`-folded, and read both `<agent dir>/mcp.json` and `.pi/mcp.json`. Under the adapter profile the step is a no-op (the adapter serves the stub from `mcp-adapter.json`).
- **Shared-Pi stub check (builtin profile):** stubs write `mcp-stub-<pid>.pid` under `harnessDirectory(HOME)` (`mcp-stub-server.ts` header). The reset empties HOME, so read the pid list **before** emptying, empty, start the new session (which ends the old session's connections), then poll each pid with `process.kill(pid, 0)` until `ESRCH` or a bounded deadline. In Phase 1 the shared Pi starts no stub. The check is first exercised by Phase 2. Committing a negative control is forbidden (CONVENTIONS).

### CI (DUAL-03)

- Hosted (`gh run view`, CI run 41708500456, 2026-11-03): lifecycle job 4m21s, components 6m13s. Run 41705536663: 4m11s and 5m40s.
- Local ratios with the seed: lifecycle ×1.37, components ×1.03.
- Estimated hosted after Phase 1: adapter-lifecycle ≈ 5.5-6 min, adapter-components ≈ 6-6.5 min.
- A builtin leg over all feature paths: only ≈ 30 shared-Pi scenarios in Phase 1, so ≈ 1.5-2 min including setup. After Phases 2-5, ≈ 60-100 MCP scenarios, ≈ 3-4 min hosted.
- Every leg stays under 10 min, so `timeout-minutes: 15` holds the 1.5× margin [ASSUMED: extrapolated; re-measure on the first CI dispatch].
- Matrix: three `include` entries with a `profile` key: `{adapter, lifecycle}`, `{adapter, components}`, `{builtin, all}`. The shard test checks that each feature file is in exactly one shard **per profile**. Extend `behavioralShards()` to read `- profile:` beside `- shard:`.

## Factory-time probe ban (architecture test)

Pi emits no event before every extension has loaded. All events come after the load: `session_start`, then `resources_discover`, and so on. So the only "before load" code is the factory and module top level [VERIFIED: pi150 event list grep]. A static scan cannot follow indirect calls. Recommended runtime test: run `claudeMarketplaceExtension(fakePi)` where the fake `getCommands`/`getAllTools` (and `getMcpServers`) throw or record while a `loaded` flag is false, then assert no call happened. Module-level code has no `pi`, so a factory run covers every reachable path. `test/index.test.ts` already uses strict strong-mock expectations, which reject unexpected inventory calls at factory time. A dedicated unpaired test under `test/architecture/` states the rule explicitly and is the frozen artifact.

## PROJECT.md edits (MDEC-01)

- Key Decisions table (`:1565`, padded columns; mdformat keeps the table valid): one row each for D-MB-01..D-MB-13, in the table's form, with text from REQUIREMENTS.md and CONTEXT.md.
- APL-D1 row (`:1695`): gains D-MB-03.
- Current Milestone (`:24-…`): names D-MB-01..13. **It still says "Install records every declared server … after plugin-variable substitution", which contradicts D-MB-04.** Correct it to "before". Also align it with D-MB-01 (no settings edit).
- Pi API constraint (`:1554`): it says `>=1.0.0` (dev `^1.0.0`), which was already stale at 1.4.0. Change it to `>=1.5.0` (dev `^1.5.0`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting the implementation in tests | a registry-probe extension in the shared Pi | RPC `get_commands` + `listedCommands` | same data the extension reads; no extra load |
| Reaching `none` | writing `-builtin:mcp` by hand | `--no-mcp` | Pi's own flag; no settings file to clean up |
| Exempting future-consumed exports | `fallow-ignore` markers | `.fallowrc.json` `ignoreExports` | markers go stale in frozen files |
| Tool-name hashing | a new rule | Pi's `createMcpToolName`, reproduced verbatim | hooks and grants must predict Pi's names exactly |
| Profile tag filtering | custom pickle filters | cucumber `tags` + `worldParameters` | already supported in cucumber 13.3.0 |

## Common Pitfalls

### Pitfall 1: The adapter's onboarding write in the shared Pi
**What goes wrong:** 30 s `Before` timeouts, `EEXIST` on `settings.json`, built-in MCP off in later profile Pis, lifecycle shard +87%. **Avoid:** seed `mcp-onboarding.json` in `Before()`. **Warning sign:** `<agent dir>/settings.json` exists right after a reset.

### Pitfall 2: Stale fallow suppressions in frozen files
**What goes wrong:** a child imports a Phase 1 export, the marker becomes stale, `npm run fallow` fails, and the child cannot edit the file. **Avoid:** `ignoreExports`.

### Pitfall 3: Probe call counts
**What goes wrong:** a second `getCommands()` fails every `expectSoftDepProbes` user. **Avoid:** one read per snapshot.

### Pitfall 4: The `"sse"` feature and the resolver drift check
**What goes wrong:** typecheck fails in `resolver-types.ts`. **Avoid:** the Domain-seam plan edits `DroppedMcpServerSchema` in the same commit.

### Pitfall 5: The disabled-update producer site
**What goes wrong:** updating a disabled plugin leaves `mcpServerConfigs` describing the old version. Enable later fixes it, but list and info read stale servers meanwhile. **Avoid:** edit `refreshDisabledRecord` and `disabledPinProjection` in Phase 1.

### Pitfall 6: `npm run x -- args` with chained commands
**What goes wrong:** CI shard paths reach only the last profile. **Avoid:** a single-profile script for CI.

### Pitfall 7: Wave file overlap
`compat-01-no-expansion.test.ts` (closed set + record), `resolver-types.ts` (domain seam + record), 7 test files (snapshot + record), `.fallowrc.json` (several plans), and `package.json` (raise + harness scripts). Keep each pair in different waves.

### Pitfall 8: Absolute-path test scope
`resolvedSource` is absolute by design. A test that scans the whole `state.json` for absolute paths fails. Scope it to `mcpServerConfigs`.

### Pitfall 9: Phase-N references in durable text
Conventions forbid `Phase NN` in comments and test titles. For tag reasons, prefer requirement IDs (traceable through REQUIREMENTS.md). A "Phase N" in a temporary scenario title is tolerable only because the owning phase removes it.

## Code Examples

```typescript
// One inventory read per snapshot (sketch) [ASSUMED]
const ADAPTER_COMMAND_NAME = /^mcp-adapter(?::\d+)?$/; // existing, pi-api.ts:217
function readCommands(pi: PiInventory): readonly CommandInventoryItem[] | undefined {
  try { return pi.getCommands(); } catch { return undefined; }
}
function isBuiltinMcpCommand(c: CommandInventoryItem): boolean {
  return c.source === "extension" && c.name === "mcp" && c.sourceInfo?.path === "builtin:mcp";
}
export function softDepStatus(pi: PiInventory): SoftDepStatus {
  const commands = readCommands(pi);
  const adapter = adapterFromCommands(commands) || adapterFromTools(pi); // tools arm unchanged
  const builtin = commands?.some(isBuiltinMcpCommand) ?? false;
  const mcpImplementation = adapter ? "adapter" : builtin ? "builtin" : "none";
  return { piSubagentsLoaded: …, piMcpAdapterLoaded: adapter, mcpImplementation, workflowEngineLoaded: … };
}
```
(`sonarjs/no-nested-conditional` forbids the nested ternary. Write it as `if` statements.)

```jsonc
// .fallowrc.json addition (measured to work for functions and types)
"ignoreExports": [
  { "file": "extensions/pi-claude-marketplace/domain/mcp-implementation.ts",
    "exports": ["profileFor", "effectiveMcpCompatibility", "McpImplementationProfile"] }
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeBox tool-arg validation in Pi | pi-schema, with coercion | Pi 1.5.0 | none here (no expectation quotes it) |
| `clientRegistration` default `dcr` | `"auto"`: CIMD with **pi's** document unless `clientId`, `clientName`, a non-default `callbackUrl`, or a rebranded app, else DCR | Pi 1.5.0 | D-MB-11 risk (below) |
| Saved "Do not trust" ignored without protected resources | honored | Pi 1.5.0 | no harness flip |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hosted CI times after the change (≈5.5-6.5 min adapter legs, ≈1.5-4 min builtin) | CI | a leg above 10 min needs a higher timeout (parent line) |
| A2 | `node:crypto` is allowed in `domain/` | Pattern 2 | move the hash into `shared/` |
| A3 | The proposed names `compatibilityBasis`, `mcpBundle`, `RecordedMcpServers` | Pattern 3 | naming only; frozen after Phase 1 |
| A4 | Built-in MCP closes stub connections on `new_session` | Harness | the shared-Pi stub check fails in Phase 2; Phase 2 investigates |
| A5 | The legacy reader can rebuild a declaration from `resolvedSource` + cached `marketplace.json` for every source kind | Record producer | a git-source record whose clone is gone reads as `unreadable` (stored verdict stands, which is the safe arm) |

## Open Questions

1. **Does the shared-Pi stand-in rule hide a missing registration?** Known (P1-DC-05). Phase 2's own scenarios must not load it.
2. **`@builtin-only` scenarios that name the adapter** (companion-missing in Phase 1): CONTEXT's architecture test checks only `@mcp`, but its prose says "only an `@adapter-only` scenario may". Recommend checking `@mcp` only and logging it.
3. **D-MB-11** (see Dubious Choices): Phase 2 must decide whether to set `clientName` knowing it forces DCR.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | 24.22.1 | — |
| npm | lock regeneration | ✓ | 10.9.9 | — |
| npm registry (via proxy) | Pi 1.5.0, peer cache | ✓ | `latest` = 1.5.0 | — |
| optional peers (adapter 7.0.0, subagents 0.84.0, workflows 3.15.0) | cucumber, integration | ✓ (installed by `install-test-peers.mjs`) | floors | — |
| `gh` CLI | CI timing reads | ✓ | — | dispatch `ci.yml` manually |
| `setpriv` (nondac wrapper) | root DAC | ✓ | — | — |
| fallow | gate | ✓ | 3.35.0 | — |

No blocking gaps.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration, e2e); `@cucumber/cucumber` 13.3.0 (behavioral) |
| Config file | `package.json` scripts; `cucumber.json` |
| Quick run command | `node --test --test-reporter=./scripts/test-reporter.mjs <test files>`; `npx cucumber-js --profile <p> <feature>` |
| Full suite command | `npm run check` (with both cucumber profiles once `test:cucumber` runs both) plus `npm run test:modules` at the phase gate |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PI15-01 | pins and lock | architecture | `node --test test/architecture/peer-floor.test.ts` | ✅ (update) |
| PI15-02 | floor fixture 1.5.0 | e2e | `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts` | ✅ (update) |
| PI15-02 | version text | grep | `rg -n '1\.4\.0' README.md README.es.md AGENTS.md docs .planning/codebase/STACK.md` → only dated history lines | — |
| PI15-03 | suites on 1.5.0 | all | `npm run check`; `npm run test:e2e` | ✅ |
| MSEL-01 | precedence, call counts, `piMcpAdapterLoaded` equality | unit | `node --test test/platform/pi-api.test.ts test/shared/notification-run.test.ts` | ✅ (extend) |
| MSEL-01 | no factory-time probe | architecture | `node --test test/architecture/<probe-ban>.test.ts` | ❌ Wave 3 |
| MSEL-01 | session steps are no-ops, never throw | unit | `node --test test/orchestrators/mcp/*.test.ts test/index.test.ts` | ❌ Wave 3 |
| MREC-01 | field written on install, update, disabled update; pre-substitution; no root, data, or home paths | unit + integration | `node --test test/orchestrators/plugin/{install-outcome,update-swap,update-preflight}.test.ts test/persistence/state-io.test.ts`; a new `test/integration/<name>.test.ts` through the real install path | ❌ Wave 3 |
| MREC-01 | record keys pinned | architecture | `node --test test/architecture/compat-01-no-expansion.test.ts` | ✅ (update) |
| MREC-01 | output unchanged | behavioral | both cucumber profiles green | ✅ |
| DUAL-01 | profiles, tags | static + behavioral | `npm run check:features`; `npx cucumber-js --profile builtin`; `npx cucumber-js` | ✅ (extend) |
| DUAL-02 | implementation probe, tag rule | harness + static | the probe runs in `BeforeAll`/`Before`/profile start; `npm run check:features` | ❌ Wave 2 |
| DUAL-03 | matrix coverage | architecture | `node --test test/architecture/behavioral-shard-coverage.test.ts`; first CI dispatch timings | ✅ (extend) |
| MDEC-01 | decision rows | doc grep | `rg -c 'D-MB-(0[1-9]\|1[0-3])' .planning/PROJECT.md` | — |

### Sampling Rate
- **Per task commit:** the touched test pairs plus `npm run check:static`.
- **Per wave merge:** `npm run check` (both profiles) on the combined tree.
- **Phase gate:** `npm run check`, both profiles, `npm run test:modules`, `npm run test:e2e`, and a CI dispatch for timings.

### Wave 0 Gaps
- [ ] `test/domain/mcp-implementation.test.ts`, `test/domain/mcp-builtin-features.test.ts`: profiles, naming (≥ 64-char cut with hash), the effective-compatibility table
- [ ] `test/orchestrators/mcp/{session-materialize,recorded-servers,builtin-registration-step,agent-grants-step}.test.ts`, `test/platform/mcp-builtin-status.test.ts`
- [ ] `test/architecture/<factory-probe-ban>.test.ts`
- [ ] the integration test for the record producer

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (project trust) | Pi's `ctx.isProjectTrusted()` only (D-LOC-01, D-MB-09); Phase 1 registers nothing |
| V5 Input Validation | yes | typebox schema for `mcpServerConfigs` (`name: string`, `config: unknown`); the Claude-shape check before recording |
| V6 Cryptography | no (sha256 only reproduces a naming rule) | `node:crypto` |
| V8 Data Protection | yes | the record copies plugin-declared config, which may hold literal header tokens a plugin ships, into `state.json`. Same trust level as the plugin's own files. Never record substituted values (D-MB-04) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Substituted secrets or absolute paths persisted | Information disclosure | write from `declaredMcpServers`; scoped path test |
| `__proto__` server name | Tampering | `Object.fromEntries` / `Object.entries` keep own keys (existing convention) |
| Registration while no connector exists | Denial of service (extension errors) | seeds register nothing; the snapshot gates future registration |
| Harness settings write affecting a user profile | Tampering | the sandbox agent dir only; seed under the adapter profile only |

## Sources

### Primary (HIGH confidence)
- Scratch worktree runs on Pi 1.5.0: `tsc`, architecture, modules, integration, e2e, both cucumber shards; the shared-adapter experiments; the fallow `ignoreExports` probe.
- Pi 1.5.0 tarball: `CHANGELOG.md` 1.5.0, `dist/core/{agent-session,source-info,resource-loader,mcp-servers}.js`, `dist/extensions/mcp/{tools,oauth}.js`, `dist/modes/rpc/rpc-mode.js`, `dist/cli/args.js`, `dist/main.js`, `dist/index.d.ts`.
- pi-mcp-adapter 7.0.0: `pi-builtin-mcp.ts`, `onboarding-state.ts`, `index.ts:1700-1760`.
- This tree (Read): `platform/pi-api.ts`, `shared/{notification-run,notification-wire,notify-reasons,notification-types}.ts`, `shared/concerns/soft-dep.ts`, `domain/{mcp-server-features,mcp-resolution,resolver-types}.ts`, `persistence/state-io.ts`, `orchestrators/plugin/{install-outcome,update-swap,update-preflight,info,info-mcp-status}.ts`, `index.ts`, `features/support/pi-process.ts`, `features/lib/{companions,pi-process}.ts`, `test/e2e/_rpc.ts`, `scripts/check-features.mjs`, `test/architecture/{behavioral-shard-coverage,compat-01-no-expansion,notify-closed-set-locks,closed-set-enrollment,peer-floor}.test.ts`, `.fallowrc.json`, cucumber 13.3.0 `from_file.js`, `merge_configurations.js`, `executor.js`.
- `gh run view` hosted job timings.

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,STACK,PITFALLS}.md` (milestone research).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (measured).
- Architecture: HIGH for constraints (measured: fallow, zones, call counts); MEDIUM for proposed names and shapes.
- Pitfalls: HIGH (measured harness failures).
- CI estimates: MEDIUM.

**Research date:** 2026-11-04
**Valid until:** 2026-12-04 (Pi and adapter releases move fast. Re-check `latest` before the merge.)
