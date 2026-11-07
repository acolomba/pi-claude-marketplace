# Phase 1: Foundation and Pi 1.5.0 - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 is the serial foundation of the mcp-builtin milestone. It raises Pi to
1.5.0 and fixes what the raise breaks; gives every command run, load, hook run,
and tool run one active MCP implementation (`adapter`, `builtin`, or `none`)
in its D-05 run snapshot; creates the two pure implementation profiles and the
effective-compatibility read; makes install, update, reinstall, enable, and
import record every declared, non-malformed MCP server in its Claude form;
builds the dual-profile cucumber harness; appends this milestone's closed-set
entries in one commit; wires the session steps as no-op seeds; and records the
milestone decisions with IDs in PROJECT.md.

It changes no user-visible output. Every file and interface the ROADMAP lists
under "Frozen after Phase 1" and "Frozen cross-phase interfaces" exists at the
end of this phase, so Phases 2-5 can run in parallel child sessions without a
shared edit. Requirements: PI15-01, PI15-02, PI15-03, MSEL-01, MREC-01,
DUAL-01, DUAL-02, DUAL-03, MDEC-01.

The user's standing instruction for this run: decide by this project's
conventions and by Claude Code upstream parity (binary 2.1.318), never stop to
ask, and log every questionable choice. Phase 1's log is
`DUBIOUS-CHOICES.md` in this directory (IDs `P1-DC-NN`).

</domain>

<decisions>
## Implementation Decisions

### Decision IDs (MDEC-01)

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

### Pi 1.5.0 raise (PI15-01..03)

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

### Active implementation snapshot (MSEL-01)

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

### Profiles and effective compatibility (frozen interfaces 1 and 4)

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

### Records (MREC-01, frozen interface 3)

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

### Closed set, one commit (frozen interface 10)

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

### Dual-profile cucumber harness (DUAL-01..03, frozen interface 9)

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

### Wiring (frozen interfaces 5-7)

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


### Amendments after research (2026-11-04)

`01-RESEARCH.md` measured facts that change the decisions above. Where they
conflict, these amendments win.

- **D-MB-11 (amended, reversed in part):** Pi 1.5.0 turns CIMD off whenever
  `oauth.clientName` is set (`dist/extensions/mcp/oauth.js`
  `offersClientMetadataDocument`), so the extension writes neither
  `clientName` nor `clientRegistration`. Pi then does what Claude Code
  2.1.318 does with the protocol: CIMD when the server supports it, else
  DCR. Only the name differs: Pi's CIMD document and its DCR `client_name`
  name pi, not "Claude Code (<server>)". That is a divergence licensed by a
  Pi capability gap (Pi cannot send a custom name and keep CIMD). Phase 2
  implements it.
- **The implementation probe checks each Pi against its own launch
  configuration**, not against the profile. That equals the profile for the
  shared Pi and for every Pi started through the "MCP implementation" step;
  a Pi started with a fixed companion list, or by a restart step, is checked
  against what its launch implies.
- **The adapter-profile shared Pi needs seeded onboarding state.** Each reset
  writes `<agent dir>/mcp-onboarding.json` with `piBuiltinMcpHandledVersion`
  set to the cached adapter's version, so pi-mcp-adapter does not rewrite the
  sandbox settings on every session (measured: without it, 66 scenarios fail,
  with `EEXIST` and reset timeouts). An `@own-implementation` scenario that
  needs the adapter's real first-run write removes the seed before its Pi
  starts.
- **Record producer scope:** Phase 1 also edits the disabled-plugin update
  write in `orchestrators/plugin/update-preflight.ts` (`refreshDisabledRecord`
  and its projection), the one record-write site the ROADMAP missed. Phase 3
  keeps every other function of that file.
- **Neutral mark and bundle flag:** the stored compatibility gains the
  optional `compatibilityBasis?: "neutral"` (Phase 3's producer writes it),
  and the resolver and record gain `mcpBundle?: true` so a `.mcpb`/`.dxt`
  bundle block survives the read. The "no absolute path" test covers the
  values of `mcpServerConfigs` (`resolvedSource` already holds the plugin
  root by design).
- **Frozen exports a later phase uses** are listed per file under
  `ignoreExports` in `.fallowrc.json` (never reported stale), not marked in
  source; Phase 6 removes the entries. `effectiveMcpCompatibility` is
  complete and fully tested in Phase 1, since its file is frozen.
- **Tag rules live in `scripts/check-features.mjs`**, which already parses
  every scenario's tags and steps; `.agents/skills/cucumber/rules/features.md`
  is updated to allow the four tags. Tag reasons cite requirement or decision
  IDs, never phase numbers (project comment rules).
- **Implementation-dependent rows:** `features/mcp-server/companion-missing.feature`
  runs `@builtin-only` in Phase 1 (it passes only where the shared Pi has no
  adapter) until Phase 3 rewrites it; the 9 rows that show
  `{requires pi-mcp-adapter}` move into one new Phase 3 feature file as
  `@adapter-only`/`@builtin-only` pairs.
- **Waves:** W1 raise, decisions, domain seam, closed set; W2 harness and
  snapshot; W3 record producer and wiring; W4 `recorded-servers.ts` and the
  phase gate. CI runs one cucumber profile per job through a single-profile
  script, because `npm run test:cucumber -- <paths>` passes the paths only to
  the last command of a chain.
- **Pi 1.5.0 needs no code fix** (measured: typecheck, modules, integration,
  e2e, both shards pass); only the version pins, the floor fixture, the
  `peer-floor.test.ts` literals, and the version text change.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `platform/pi-api.ts` `hasLoadedPiMcpAdapter` and the D-05 `SoftDepStatus`
  snapshot (three booleans today) are the detection seam to extend.
- `domain/mcp-server-features.ts` (`classifyMcpServer`, `translateMcpServer`,
  `McpUnsupportedFeature`, `McpServerVerdict`) is the adapter table the
  adapter profile wraps unchanged.
- `domain/mcp-resolution.ts` `recordMergedServers` and `resolveStrictMcp`
  already compute the merge order and the dropped servers; the producer adds
  the full non-malformed list beside the supported subset.
- `shared/concerns/soft-dep.ts` owns the `Companion` union, the marker
  literals, `softDepMarkers`, and `companionRequirements`;
  `shared/notify-reasons.ts` owns `companionSeverity` and the reason groups;
  `shared/notification-wire.ts` owns `REASONS`, `COMPANIONS`, and
  `MCP_SERVER_STATUS`.
- `orchestrators/plugin/info-mcp-status.ts` maps adapter statuses to
  `McpServerStatus`; `platform/mcp-status.ts` holds the `McpStatusReader`
  interface.
- Harness: `features/support/world.ts` (`usePiWithProfile`, the shared Pi,
  `PROFILE_PI_START_TIMEOUT_MS`), `features/lib/companions.ts` (load order,
  peer cache), `features/lib/pi-registry-probe/` (commands with source paths,
  the natural base for the implementation probe), `features/lib/mcp-stub-server.ts`,
  `test/e2e/_rpc.ts` (`piArguments`), `scripts/check-features.mjs`,
  `test/architecture/behavioral-shard-coverage.test.ts`.

### Established Patterns

- Optional additive record fields with no schema bump (`resolvedSha`,
  `hookEntries`, `dependencyDisabled`), with absence documented as "predates
  the field".
- Closed sets change in one commit with the lock test and the catalog
  counters (`EXPECTED_STATE_COUNT`, `EXPECTED_UTF8_BYTES` in
  `test/architecture/catalog-uat/catalog-contract.test.ts`).
- The run snapshot is computed once per command run and threaded through
  every row render (D-05, D-12, D-16-14); readers never probe.
- Every user-visible output goes through `shared/notification-dispatch.ts`.

### Integration Points

- `index.ts` `session_start` and the `resources_discover` path that runs
  `loadReconcile`; `edge/register.ts` and `edge/types.ts` build `EdgeDeps`.
- `orchestrators/plugin/install-outcome.ts` `statePhase` and
  `orchestrators/plugin/update-swap.ts` (record write) are the producer sites.
- `cucumber.json`, `package.json` `test:cucumber`, `.github/workflows/ci.yml`
  behavioral matrix.

</code_context>

<specifics>
## Specific Ideas

- Upstream evidence read on 2026-11-04 from `/opt/claude-code/bin/claude`
  (2.1.318): `get clientMetadata(){let e={client_name:\`Claude Code (${this.serverName})\`, …}` and
  `get clientMetadataUrl(){if(!Me(this.redirectUri)){… registering via DCR`;return}…}`.
- Pi 1.5.0 evidence read from `npm pack @earendil-works/pi-coding-agent@1.5.0`:
  `SERVER_NAME = /^[A-Za-z0-9_-]+$/`, `mcpNamespace(server) = "mcp__" + server.replace(/-/g, "_")`,
  `createMcpToolName` with `MAX_TOOL_NAME_LENGTH = 64` and the 8-hex sha256
  suffix of `"<server>\0<tool>"`.
- The harness environment facts in `.planning/milestones/mcp-builtin-CHILD-SESSION-BRIEF.md` (root
  DAC wrapper `nondac-sh`, warm ESLint first, the worktree hook caveat, zizmor
  without `GH_TOKEN`, per-executor scratch folders, `files_deleted`) apply to
  every executor of this phase.

</specifics>

<deferred>
## Deferred Ideas

- What `info`'s `requires:` line shows while an implementation is active and
  runs every server (for example `requires: builtin mcp`), and the load
  warning row for a plugin that becomes partial after a switch: Phase 3.
- Whether a built-in server's status can tell `not loaded` from
  `not connected`, and how the first built-in session reports a legacy
  `mcp.json` entry: Phase 2 research.
- Immediate register and unregister (MCPV2-01), deny rules to
  `toolExposure: "hidden"` (MCPV2-02), background agents under built-in
  (MCPV2-03): v2.

</deferred>

---

*Phase: 01-foundation-and-pi-1-5-0*
*Context gathered: 2026-11-04*
