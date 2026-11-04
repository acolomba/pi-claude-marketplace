# Phase 1: Frozen files and interfaces as built

This is the authoritative frozen record for the parallel child sessions of the
mcp-builtin milestone (Phases 2 to 5). It lists what ROADMAP's "Frozen after
Phase 1" and "Frozen cross-phase interfaces" sections ask for, as the code
stands at the gate commit `f3ab832f52a3c98c43b56c5e3def436aba24f556`, with the
code review fixes of `01-REVIEW-FIX.md` applied (CR-01, CR-02, WR-01 to
WR-05, IN-05). Where the build differs from the ROADMAP text, this file wins,
and the entry names the dubious choice (`P1-DC-NN` in `DUBIOUS-CHOICES.md`)
or the review finding that explains it.

A child phase never edits a file listed here. When a child needs a change to
one, it writes the change under "Parent lines" in its last plan's SUMMARY.md,
and the parent applies it at merge or in Phase 6. Product paths below are
relative to the repository root.

## 1. Frozen files

Each file path was confirmed with `git ls-files --error-unmatch`, and each
glob matched at least one tracked file, at the gate commit.

**Build and CI**

- `package.json`, `package-lock.json`
- `.github/workflows/ci.yml`
- `cucumber.json`
- `scripts/check-features.mjs` (it also holds the four implementation-tag
  rules, P1-DC-19)
- `scripts/install-test-peers.mjs`
- `.fallowrc.json`
- `rule-packs/architecture.json`
- `eslint.config.js`

**Harness**

- `test/e2e/_rpc.ts` (`--no-mcp` in `piArguments`)
- `features/support/**`: `git-repository.ts`, `https-git-host.ts`,
  `mcp-implementation.ts` (new in Phase 1), `npm-registry.ts`,
  `pi-process.ts`, `source-kind.ts`, `world.ts`
- `features/lib/pi-process.ts`, `features/lib/pi-commands.ts`,
  `features/lib/companions.ts`, `features/lib/run-tokens.ts`,
  `features/lib/published-marketplace.ts`, `features/lib/mcp-stub-server.ts`,
  `features/lib/mcp-server-files.ts`, `features/lib/mcp-configuration.ts`,
  `features/lib/hook-recorder.ts`
- `features/lib/scripted-model/**` (`extension.ts`, `script.ts`)
- `features/lib/pi-registry-probe/**` (`extension.ts`, `snapshot.ts`)
- New in Phase 1: `features/lib/mcp-implementation.ts`,
  `features/lib/builtin-mcp-stand-in/**` (`extension.ts`, `servers.ts`)
- The shared step modules, under `features/step_definitions/`:
  `command.steps.ts`, `session.steps.ts`, `config.steps.ts`,
  `companion.steps.ts`, `model.steps.ts`, `mcp-configuration.steps.ts`,
  `plugin/publishing.steps.ts`, `marketplace/publishing.steps.ts`,
  `mcp-server/listing.steps.ts`, `mcp-server/status.steps.ts`, and the new
  shared "MCP implementation" module `mcp-implementation.steps.ts`
- New in Phase 1: `features/mcp-server/implementation-profiles.feature` (the
  six seeds that prove each profile's Pi and the restart steps)
- `.agents/skills/cucumber/**` (`SKILL.md`, `rules/features.md`,
  `rules/layout.md`, `rules/steps.md`, `rules/world-and-stand-ins.md`)
- The architecture tests Phase 1 adds or extends:
  `test/architecture/no-factory-time-probe.test.ts` (new) and
  `test/architecture/behavioral-shard-coverage.test.ts` (extended for the
  profile axis; it reads the frozen `ci.yml`). The profile-tag rule is in
  `scripts/check-features.mjs`, not in a `test/architecture` file (P1-DC-19).

**Product**

- `extensions/pi-claude-marketplace/platform/pi-api.ts`
- `extensions/pi-claude-marketplace/domain/mcp-implementation.ts`
- `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`
- `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts`
- The MCP functions in `extensions/pi-claude-marketplace/domain/name.ts`
  (`mcpServerDisplayName`, the private `claudeMcpServerName`,
  `generatedMcpServerKey`, `builtinMcpServerName`, `foldedMcpServerKey`)
- `extensions/pi-claude-marketplace/persistence/state-io.ts`
- `extensions/pi-claude-marketplace/orchestrators/mcp/session-materialize.ts`
- `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`
- `extensions/pi-claude-marketplace/index.ts`
- `extensions/pi-claude-marketplace/edge/register.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts`

**Closed sets (frozen except for append-only additions)**

- `extensions/pi-claude-marketplace/shared/notification-types.ts`
- `extensions/pi-claude-marketplace/shared/notification-wire.ts`
- The reason table in `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
- `test/architecture/notify-closed-set-locks.test.ts`
- `docs/json-output.md`
- The catalog counters: `docs/output-catalog.md` and `EXPECTED_STATE_COUNT`
  (324) and `EXPECTED_UTF8_BYTES` (54652) in
  `test/architecture/catalog-uat/catalog-contract.test.ts`. Phase 1 changed
  neither file.

**Files Phase 1 created that a later phase owns (not frozen)**

- `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`
  (Phase 2), `orchestrators/mcp/agent-grants-step.ts` (Phase 4), and
  `platform/mcp-builtin-status.ts` (Phase 2): no-op seeds whose signatures
  are frozen (interfaces 5 and 7), but whose bodies the owner fills.
- `features/mcp-server/verdict-markers.feature` (Phase 3) and
  `features/mcp-server/agent-grants.feature` with
  `features/step_definitions/mcp-server/agent-grants.steps.ts`, renamed from
  `invocation.steps.ts` (Phase 4, P1-DC-22). Phase 2 recreates the
  `mcp-server/invocation` step module if it needs one.

## 2. Frozen cross-phase interfaces as built

Product paths are relative to `extensions/pi-claude-marketplace/`.

### 1. Implementation profiles and effective compatibility

File `domain/mcp-implementation.ts`. Exports and signatures:

```ts
export type { ActiveMcpImplementation, McpImplementationId } from "../platform/pi-api.ts";
// in platform/pi-api.ts:
export type McpImplementationId = "adapter" | "builtin";
export type ActiveMcpImplementation = McpImplementationId | "none";

export interface McpImplementationProfile {
  readonly id: McpImplementationId;
  readonly classify: (config: unknown) => McpServerVerdict;
  readonly serverName: (plugin: string, server: string) => string;
  readonly toolNamePrefix: (plugin: string, server: string) => string | undefined;
  readonly toolName: (plugin: string, server: string, tool: string) => string;
  readonly grantSelector: (plugin: string, server: string) => string;
}
export function profileFor(id: McpImplementationId): McpImplementationProfile;

export interface RecordedMcpServer { readonly name: string; readonly config: unknown }
export type RecordedMcpServers =
  | { readonly kind: "recorded" | "re-resolved";
      readonly servers: readonly RecordedMcpServer[];
      readonly bundle: boolean }
  | { readonly kind: "unreadable" };
export interface StoredMcpCompatibility {
  readonly compatibility: {
    readonly installable: boolean;
    readonly notes: readonly string[];
    readonly unsupported: readonly string[];
  };
  readonly compatibilityBasis?: "neutral";
}
export interface EffectiveMcpCompatibility {
  readonly installable: boolean;
  readonly unsupported: readonly string[];
  readonly blocked: readonly DroppedMcpServer[];
}
export function effectiveMcpCompatibility(
  stored: StoredMcpCompatibility,
  recorded: RecordedMcpServers,
  active: ActiveMcpImplementation,
): EffectiveMcpCompatibility;
```

Differences from the ROADMAP text:

- The two id types live in `platform/pi-api.ts` and `mcp-implementation.ts`
  re-exports them, because `platform/` may not import `domain/` (P1-DC-20,
  P1-DC-22).
- The profile adds `toolName(plugin, server, tool)`, the full tool name with
  Pi's long-name cut for built-in (P1-DC-22).
- `toolNamePrefix` returns `string | undefined` (CR-02). It promises only a
  text that every tool name of the server starts with. The adapter profile
  always returns one. The built-in profile returns `undefined` when its
  namespace is longer than the 55 characters Pi keeps of a cut tool name
  (plugin and server names of 41 or more characters together). A caller
  without a prefix matches the full names from `toolName` instead, as the
  harness listing wait does.
- The adapter `toolName` matches pi-mcp-adapter 7.0.0 `formatToolName` (`.`
  folds to `_`, and a name that already carries the prefix is not prefixed
  again; P1-DC-28).
- `recorded` is a discriminated union with an `unreadable` arm and a `bundle`
  flag, so a `.mcpb` or `.dxt` block survives the read (P1-DC-18).
- A stored compatibility without `compatibilityBasis` is read as the
  adapter's verdict (P1-DC-02). A malformed recorded config falls back to the
  stored verdict (P1-DC-22).
- The built-in `grantSelector` (`mcp:<registered name>`) is not yet checked
  against pi-subagents' grant syntax; Phase 4 uses it (P1-DC-28).

### 2. The run snapshot's active implementation

File `platform/pi-api.ts`:

```ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean; // equals mcpImplementation === "adapter"
  mcpImplementation: ActiveMcpImplementation;
  workflowEngineLoaded: boolean;
}
export function softDepStatus(pi: PiInventory): SoftDepStatus;
function hasLoadedBuiltinMcp(commands: readonly CommandInventoryItem[]): boolean; // module-private
```

Differences: `hasLoadedBuiltinMcp` is module-private, not exported; a child
reads the result through `softDepStatus(pi).mcpImplementation`. It counts only
an extension command `mcp` whose `sourceInfo.path` is exactly `builtin:mcp`;
another `/mcp` provider reads as `none` (P1-DC-09). A throwing `getCommands()`
reads as an empty list (P1-DC-29). The snapshot keeps today's probe order and
counts: one `getCommands()` and three `getAllTools()` calls. `session_start`
opens its own notification run for the session steps (P1-DC-23). Nothing
probes before `session_start`: `test/architecture/no-factory-time-probe.test.ts`
enforces it.

### 3. The record field and its only reader

File `persistence/state-io.ts` (record schema, all optional and additive, no
schema bump):

```ts
mcpServerConfigs?: Array<{ name: string; config: unknown }>;
mcpBundle?: true;
compatibilityBasis?: "neutral";
export function mcpServerConfigsOf(
  declared: Readonly<Record<string, unknown>>,
): NonNullable<PluginInstallRecord["mcpServerConfigs"]>;
export function replaceCompatibility(
  record: Pick<PluginInstallRecord, "compatibility" | "compatibilityBasis">,
  compatibility: PluginInstallRecord["compatibility"],
): void;
```

File `orchestrators/mcp/recorded-servers.ts`:

```ts
export interface LegacyServers { readonly servers: readonly RecordedMcpServer[]; readonly bundle: boolean }
export type LegacyServersReader = (record: PluginInstallRecord) => Promise<LegacyServers>;
export async function recordedMcpServers(
  record: PluginInstallRecord,
  reader: LegacyServersReader,
): Promise<RecordedMcpServers>;
export interface LegacyServersSource {
  readonly marketplaceName: string;
  readonly marketplace: Pick<ExtensionState["marketplaces"][string], "manifestPath" | "marketplaceRoot" | "source">;
  readonly pluginName: string;
}
export type LegacyServersUnreadableReason =
  | "not-in-manifest" | "unavailable" | "root-mismatch" | "version-mismatch";
export class LegacyServersUnreadableError extends Error { /* reason, plugin, marketplace */ }
export function createLegacyServersReader(source: LegacyServersSource): LegacyServersReader;
```

Differences: `mcpBundle` and `compatibilityBasis` are new record fields
(P1-DC-18), and `compatibilityBasis` sits at the record's top level, not
inside `compatibility` (P1-DC-34). `mcpServerConfigsOf` is a new export in the
frozen file (P1-DC-34). The typed error lives in `recorded-servers.ts`
(P1-DC-35). A legacy record answers `re-resolved`, and every refusal answers
`unreadable`. Phase 1 also writes the field in the disabled-plugin update
write in `orchestrators/plugin/update-preflight.ts`, a Phase 3 file (P1-DC-17).

Review fixes:

- `compatibilityBasis` describes the `compatibility` beside it (WR-02). Every
  write that replaces or changes `compatibility` goes through
  `replaceCompatibility`, which clears the basis; a writer of the neutral
  verdict sets `compatibilityBasis = "neutral"` after that call. The update
  swap, the update intent mark, the disabled pin refresh, and the AMIG-01
  dropped-server write use it. An install writes a new record without the
  basis.
- The disabled pin refresh's field list is the exported `DISABLED_PIN_FIELDS`
  in `update-preflight.ts` (version, resolvedSource, resolvedSha,
  resolvedVersion, compatibility, compatibilityBasis, mcpServerConfigs,
  mcpBundle). `apply`'s pin restore after a failed deferred enable restores
  those fields and `updatedAt`, and removes each one the saved record lacked
  (CR-01).
- The legacy reader refuses with `version-mismatch` when the version install
  would record for the re-resolution (`install-outcome.ts`
  `deriveInstallVersion`, now exported) is not the record's `version`
  (WR-01). A record with `resolvedVersion` derives the version at its
  release tag.
- `recordedMcpServers` logs a reader failure to the `mcp` debug channel
  before it answers `unreadable` (WR-03).

### 4. The resolver's declared servers

Files `domain/mcp-resolution.ts`, `domain/resolver-types.ts`,
`domain/plugin-resolver.ts`:

```ts
declaredMcpServers: Record<string, unknown>; // every non-malformed server, merge order
mcpServers: Record<string, unknown>;         // the adapter-supported subset (MSEL-04)
mcpBundle?: true;
```

Difference: the resolver also carries `mcpBundle` (P1-DC-18). These files are
Phase 3's, but the producer (`declaredMcpServers` and the entry points that
`recorded-servers.ts` calls) stays as Phase 1 left it.

### 5. Session step contracts

Files under `orchestrators/mcp/`:

```ts
// builtin-registration-step.ts
export interface BuiltinRegistrationStepInput {
  readonly pi: PiMcpRegistry;
  readonly ctx: ExtensionContext;
  readonly snapshot: NotificationRun;
}
export function builtinRegistrationStep(_input: BuiltinRegistrationStepInput): Promise<void>;
export function resyncBuiltinRegistrations(_input: BuiltinRegistrationStepInput): Promise<void>;
// agent-grants-step.ts
export interface AgentGrantsStepInput {
  readonly pi: PiInventory;
  readonly ctx: ExtensionContext;
  readonly snapshot: NotificationRun;
}
export function agentGrantsStep(_input: AgentGrantsStepInput): Promise<void>;
// session-materialize.ts
export type McpSessionMaterializer = (pi: ExtensionAPI, ctx: ExtensionContext) => Promise<void>;
export function createMcpSessionMaterializer(steps: {
  readonly builtinRegistrationStep: (input: BuiltinRegistrationStepInput) => Promise<void>;
  readonly agentGrantsStep: (input: AgentGrantsStepInput) => Promise<void>;
}): McpSessionMaterializer;
```

Differences: `agentGrantsStep` takes `{ pi, ctx, snapshot }`, not
`{ ctx, snapshot }` (P1-DC-22). `index.ts` composes the materializer from
`createMcpSessionMaterializer` with the two step modules, instead of importing
a ready `materializeMcpSession` (P1-DC-30). The materializer runs the
registration step, then the grants step, each in its own try/catch. `index.ts`
calls `resyncBuiltinRegistrations({ pi, ctx, snapshot: run })` after
`loadReconcile`, behind a mode check in its own try/catch (P1-DC-30).

### 6. Pi's MCP registry and the status reader

File `platform/pi-api.ts`:

```ts
export type { McpServerConfig, RegisteredMcpServer } from "@earendil-works/pi-coding-agent";
export interface PiMcpRegistry {
  registerMcpServer(name: string, config: McpServerConfig): void;
  unregisterMcpServer(name: string): void;
  getMcpServers(): readonly RegisteredMcpServer[];
}
```

File `platform/mcp-status.ts` (the file is Phase 2's; this interface is
frozen):

```ts
export interface McpStatusReader {
  lookup(serverName: string): McpServerRuntimeStatus | "unrecognized" | "unlisted" | "no-snapshot";
}
```

### 7. The status readers and the status call in info

Files `platform/mcp-status.ts`, `edge/types.ts`, `orchestrators/plugin/info.ts`:

```ts
export interface McpStatusReaders { readonly adapter: McpStatusReader; readonly builtin: McpStatusReader }
export interface McpStatusLookup {
  readonly reader: McpStatusReader;
  readonly implementation: ActiveMcpImplementation;
  readonly projectTrusted: boolean;
  readonly cwd: string;
}
// EdgeDeps
readonly mcpStatus: McpStatusReaders;
// orchestrators/plugin/info.ts, function withServerStatus
const implementation = opts.run.softDeps.mcpImplementation;
const lookup: McpStatusLookup = {
  reader: implementation === "builtin" ? opts.mcpStatus.builtin : opts.mcpStatus.adapter,
  implementation,
  projectTrusted: opts.projectTrusted,
  cwd: opts.cwd,
};
return { ...built, block: withMcpServerStatus(built.block, record, lookup, projectRecord) };
// platform/mcp-builtin-status.ts (Phase 2 fills the body)
export function createBuiltinMcpStatusReader(
  _pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
): McpStatusReader;
```

Differences: `McpStatusLookup` carries `projectTrusted` and `cwd`, so Phase 2
needs no frozen-file edit for BLT-05 (P1-DC-19, P1-DC-22). The built-in
reader's parameter also exposes `getAllTools`, because whether a server's
tools are listed is the only connection signal Pi's built-in MCP gives
(WR-04). Building the reader and the seed's lookup still read nothing. The adapter reader
serves both `adapter` and `none` (P1-DC-20). Phase 2 owns the body of
`withMcpServerStatus` in `orchestrators/plugin/info-mcp-status.ts`.

### 8. The built-in server name and the tool-name rule

File `domain/name.ts`:

```ts
export function builtinMcpServerName(plugin: string, server: string): string; // plugin_<plugin>_<server>
```

The registered name is Claude Code's normalized name with `-` kept and no
trailing `_` (P1-DC-10). Pi's long-name rule is in the built-in profile, not in
the name: `toolNamePrefix` is `mcp__` plus the name with `-` folded to `_`,
plus `__`, or `undefined` when that text is longer than 55 characters
(CR-02); `toolName` replaces every character outside `[A-Za-z0-9_]` in
`mcp__<server>__<tool>` with `_`, and a name over 64 characters keeps its
first 55 characters, then `_` and the first 8 hex of
`sha256("<server>\0<tool>")` (Pi 1.5.0 `createMcpToolName`). Pi's extra hash
for two tools that sanitize to one name cannot be predicted (recorded gap).

### 9. The cucumber harness

- **Profiles** (`cucumber.json`): `default` and `adapter` set
  `"tags": "not @builtin-only"` and `worldParameters.mcpImplementation:
  "adapter"`; `builtin` sets
  `"tags": "(@mcp or @builtin-only) and not @adapter-only"` and
  `mcpImplementation: "builtin"`. Each runs `parallel: 8` in random order.
- **World parameter:** `mcpImplementation`, read by
  `parseMcpProfile(value): McpProfile` (`"adapter" | "builtin"`) in
  `features/lib/mcp-implementation.ts`.
- **Tags:** `@mcp`, `@adapter-only`, `@builtin-only`, and
  `@own-implementation` (the tag for scenarios that choose their own
  implementation, P1-DC-04). `@own-implementation` scenarios run once, under
  the adapter profile. The `Before({ tags: "@own-implementation" })` hook in
  `features/support/mcp-implementation.ts` sets `world.ownImplementation`.
- **Tag rules** (`scripts/check-features.mjs`, run by `npm run check:features`):
  the tags may sit on a Feature, Rule, scenario, or Examples block; an MCP
  scenario (the word `mcp` in a step's text, case-insensitive, or
  `mcpServers` or `.mcp.json` in a step's doc string or table, P1-DC-36)
  carries exactly one
  implementation tag; an `@mcp` scenario never names pi-mcp-adapter; an
  `@adapter-only` or `@builtin-only` scenario names a requirement or decision
  ID in its title or its feature description.
- **Frozen step texts** (`features/step_definitions/mcp-implementation.steps.ts`
  unless noted):
  - `a stand-in registers the stub mcp server {string} of the plugin {string} with pi's built-in mcp`
  - `pi runs with the scripted model and the mcp implementation`
  - `the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}`
  - `the user's pi settings turn off pi's built-in mcp`
  - `the user restarts pi without pi-mcp-adapter`
  - `the user restarts pi with pi-mcp-adapter`
  - `the user restarts pi with pi's built-in mcp turned on`
  - `the user restarts pi with no mcp`
  - `pi lists these registered mcp servers:`
  - `the user has run {string}, which did not fail` (`command.steps.ts`,
    P1-DC-33)
  - Every step that existed before Phase 1 in the shared step modules listed
    in section 1 keeps its text.
- **World methods** (`features/support/world.ts`): `get mcpProfile():
  McpProfile`, `usePiWithProfile(profile: PiProfile): Promise<void>`,
  `turnOffBuiltinMcpBeforeStart(): Promise<void>`,
  `restartPi(restart: PiRestart): Promise<SessionReport>` with
  `PiRestart = "without-adapter" | "with-adapter" | "builtin-on" | "no-mcp"`,
  `get profilePiStarted(): boolean` (P1-DC-32), `profileHarness(): string`,
  and the field `registrySnapshot: RegistrySnapshot | undefined`.
- **Launch:** `mcpImplementationLaunch(profile: McpProfile):
  McpImplementationLaunch`, with
  `McpImplementationLaunch { companions: readonly CompanionName[]; extraExtensions: readonly string[] }`:
  pi-mcp-adapter under `adapter`; no companion plus the built-in stand-in,
  loaded last, under `builtin`.
- **Built-in stand-in:** `features/lib/builtin-mcp-stand-in/extension.ts`
  registers each listed stub at `session_start` with `pi.registerMcpServer`
  under `builtinMcpServerName(plugin, server)`, deferred, and steps aside when
  Pi already has the folded name or an `mcp.json` server of that name
  (P1-DC-05). The list lives at `<home>/builtin-mcp-stand-in.json` (P1-DC-32).
- **Listing wait:** `waitForStubListing` under `builtin` waits for a tool in
  the server's built-in namespace, or, when `toolNamePrefix` returns
  `undefined`, for a tool whose name is the `toolName` of one of the stub's
  tools. `features/lib/mcp-stub-server.ts` exports those tool names as
  `STUB_TOOL_NAMES` (CR-02). `stubPidsIn` reads a pid file that vanished after
  the listing as an exited stub (WR-05).
- **Shared Pi:** it follows the profile (pi-mcp-adapter under `adapter`, no
  companion under `builtin`, P1-DC-03), with a seeded
  `mcp-onboarding.json` under `adapter` (P1-DC-13). Each Pi is checked against
  the implementation its launch implies (P1-DC-14).

### 10. Closed-set entries

See section 4.

## 3. Fallow entries that Phase 6 removes

Phase 1 exempts frozen modules and exports that only a later phase consumes
with a fallow `entry` plus a per-file `ignoreExports` entry in `.fallowrc.json`,
never with a source marker in a frozen file (P1-DC-19, P1-DC-22). Phase 6
removes each entry whose exports have a consumer on the combined tree.

- `entry`: `extensions/pi-claude-marketplace/domain/mcp-implementation.ts` and
  `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`
  (beside the original `extensions/pi-claude-marketplace/index.ts`, which
  stays).
- `ignoreExports` for `domain/mcp-implementation.ts`: `ActiveMcpImplementation`,
  `EffectiveMcpCompatibility`, `StoredMcpCompatibility`,
  `effectiveMcpCompatibility`.
- `ignoreExports` for `orchestrators/mcp/recorded-servers.ts`: `LegacyServers`,
  `LegacyServersReader`, `LegacyServersSource`,
  `LegacyServersUnreadableError`, `LegacyServersUnreadableReason`,
  `createLegacyServersReader`, `recordedMcpServers`.

The review fix for IN-05 removed the entries that `fallow dead-code` no
longer needs: `McpImplementationId`, `McpImplementationProfile`,
`RecordedMcpServer`, `RecordedMcpServers`, and `profileFor` from the
`mcp-implementation.ts` entry, and the whole entries for `platform/pi-api.ts`
(`McpServerConfig`, `PiMcpRegistry`, `RegisteredMcpServer`) and
`features/lib/mcp-implementation.ts` (`stubPidsIn`, `waitUntilProcessesExit`,
`writeAdapterOnboardingSeed`, P1-DC-33). Each now has a consumer.

The one source marker Phase 1 added,
`// fallow-ignore-next-line unused-export` on the default export of
`features/lib/builtin-mcp-stand-in/extension.ts`, stays: Pi's `--extension`
loader reads that default, as it does for the registry probe (P1-DC-20).

## 4. Closed-set entries added and not yet emitted

One commit (`7992ccf`, plan 01-04) appended these entries. No product code
emits any of them yet. Phase 6 removes an entry that the combined tree never
emits.

- Reasons (`Reason`, `REASONS`, `UnsupportedReason`): `requires mcp` and
  `requires builtin mcp` (D-MB-07). `requires pi-mcp-adapter` stays.
- MCP server statuses (`McpServerStatus`, `MCP_SERVER_STATUSES`):
  `overridden by mcp.json` and `project not trusted` (BLT-05).
- Companions (`Companion` in `shared/concerns/soft-dep.ts`, `COMPANIONS`):
  `mcp` and `builtin mcp`, for `requires: mcp (missing)` and the JSON
  `{"companion":"mcp","missing":true}` (P1-DC-07).
- Lock counts: Reason 80, McpServerStatus 12. The catalog counters are
  unchanged (324 states, 54652 UTF-8 bytes), because no entry is emitted.

## CI timings

Measured by the parent session on 2026-11-04, CI run
[41812979607](https://github.com/acolomba/pi-claude-marketplace/actions/runs/41812979607),
head `8d03f4efe86dff6b2ad24c044debb4ecd1ba67a8`. Every job concluded `success`.

| Leg | Job | Cucumber step | Scenarios |
| --- | --- | --- | --- |
| `behavioral tests, adapter lifecycle (Node 24)` | 3 min 24 s | 3 min 2 s | 1168 |
| `behavioral tests, adapter components (Node 24)` | 4 min 8 s | 3 min 47 s | 390 |
| `behavioral tests, builtin all (Node 24)` | 1 min 19 s | 55 s | 39 |

The slowest leg takes 4 min 8 s, under 10 minutes, so `timeout-minutes` stays
at 15 (D-CF1-16).

Earlier attempts at heads 797fb43 (run 41803929872, two attempts) and 863d8f3
(run 41807247663) each lost one terminal-UI scenario in the adapter components
leg to the TUI readiness wait. The cause was a cold jiti cache: the
adapter-profile shared Pi had its own TMPDIR and no longer warmed `/tmp/jiti`,
which TMPDIR-less terminal Pis use. Commit 8d03f4e links the shared Pi's
`jiti` directory to `/tmp/jiti` and keeps the 15-second wait (P1-DC-40).
