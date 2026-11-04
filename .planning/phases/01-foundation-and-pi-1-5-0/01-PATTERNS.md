# Phase 1: Foundation and Pi 1.5.0 - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 34 (new and modified; version-text docs grouped as one row)
**Analogs found:** 32 / 34

All paths below are git-tracked source. Line numbers are from the tree on 2026-11-04.
CONTEXT.md "Amendments after research" win over earlier sections and were applied here.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/mcp-implementation.ts` (new) | domain model + pure function | transform | `domain/mcp-server-features.ts` | role-match |
| `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts` (new, optional split) | domain scanner | transform | `domain/mcp-server-features.ts` `classifyMcpServer` | exact |
| `domain/mcp-server-features.ts` (modify: shared Claude-shape check, `"sse"`) | domain | transform | itself | n/a |
| `domain/resolver-types.ts` (modify: `DroppedMcpServerSchema` + `"sse"`; `declaredMcpServers`, `mcpBundle?`) | domain types | typebox schema + drift check | itself lines 98-128 | n/a |
| `domain/mcp-resolution.ts` (modify: `declaredMcpServers`, `mcpBundle`) | domain | transform | `recordMergedServers` lines 338-359 | n/a |
| `domain/name.ts` (modify: `builtinMcpServerName` via shared private helper) | utility | transform | `generatedMcpServerKey` lines 630-641 | exact |
| `platform/pi-api.ts` (modify: `SoftDepStatus.mcpImplementation`, `sourceInfo.path`, `PiMcpRegistry`, `McpServerConfig`, `RegisteredMcpServer`) | platform adapter | request-response (probe) | itself lines 140-273 | n/a |
| `platform/mcp-builtin-status.ts` (new seed) | platform reader | request-response | `platform/mcp-status.ts` | exact |
| `persistence/state-io.ts` (modify: `mcpServerConfigs?`, `mcpBundle?`, `compatibilityBasis?`) | persistence schema | CRUD | `resolvedSha`/`hookEntries`/`dependencyDisabled` lines 99-142 | exact |
| `orchestrators/mcp/session-materialize.ts` (new) | orchestrator step runner | event-driven | `index.ts` `prepareResources` lines 136-182 | role-match |
| `orchestrators/mcp/builtin-registration-step.ts` (new seed) | orchestrator step | event-driven | `index.ts` `applyMcpAdapterEnvFrom` lines 46-59 | partial |
| `orchestrators/mcp/agent-grants-step.ts` (new seed) | orchestrator step | event-driven | same | partial |
| `orchestrators/mcp/recorded-servers.ts` (new) | orchestrator read | file-I/O read-only | `domain/manifest.ts` `loadMarketplaceManifest` + `plugin-resolver.ts` `resolveStrict` | role-match |
| `orchestrators/plugin/install-outcome.ts` (modify `statePhase`) | ledger phase | CRUD | itself lines 1590-1612 | n/a |
| `orchestrators/plugin/update-swap.ts` (modify `applyAllSuccessRecordFields`) | record write | CRUD | itself lines 877-905 | n/a |
| `orchestrators/plugin/update-preflight.ts` (modify `disabledPinProjection` 725, `nextDisabledPin` 744, `refreshDisabledRecord` 781) | record write | CRUD | `update-swap.ts` lines 877-905 | exact |
| `orchestrators/plugin/info-mcp-status.ts` + `info.ts` (modify signature to `{ reader, implementation }`) | orchestrator | request-response | `withMcpServerStatus` line 107 | n/a |
| `orchestrators/edge-deps.ts` / `edge/types.ts` / `edge/register.ts` (`mcpStatus: { adapter; builtin }`) | wiring | config | existing `mcpStatus` member | n/a |
| `index.ts` (session_start async + `resyncBuiltinRegistrations` after `loadReconcile`) | entry | event-driven | itself lines 136-182, 226-243 | n/a |
| Closed set: `shared/notification-types.ts`, `shared/notification-wire.ts`, `shared/notify-reasons.ts`, `shared/concerns/soft-dep.ts`, `schema/claude-plugin.schema.json`, `docs/json-output.md` | closed vocabulary | config | `"requires pi-mcp-adapter"` / `"already added"` entries | exact |
| `test/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts` | lock test | n/a | themselves (lines 55, 120; `EXPECTED_REASONS`; record `IsExact` 655-674) | n/a |
| `test/architecture/<factory-probe-ban>.test.ts` (new, unpaired) | architecture test | runtime check | `test/architecture/no-probe-in-workflows-bridge.test.ts` + `test/edge/notification-boundary.ts` `expectSoftDepProbes` | role-match |
| `test/architecture/behavioral-shard-coverage.test.ts` (modify: `(profile, path)`) | architecture test | file scan | itself `behavioralShards` line 54 | n/a |
| `test/architecture/peer-floor.test.ts`, `test/e2e/pi-peer-floor/**` | floor test | n/a | themselves (literal bump) | n/a |
| `test/<path>.test.ts` per new source | unit test | n/a | `test/platform/*.test.ts`, `test/edge/notification-boundary.ts` | role-match |
| `cucumber.json` (profiles) | config | n/a | current `default` | exact |
| `features/support/pi-process.ts` (profile-aware shared Pi, onboarding seed, probe, stub-pid check) | harness hook | event-driven | itself `BeforeAll` 71-116, `Before` 118-150 | n/a |
| `features/support/world.ts` (restart methods, launch-implied probe) | harness world | request-response | `usePiWithProfile` 537-580 | n/a |
| `features/lib/<builtin-stand-in>/extension.ts` (new) | harness Pi extension | event-driven | `features/lib/pi-registry-probe/extension.ts` | exact |
| `features/step_definitions/mcp-implementation.steps.ts` (new) | step defs | request-response | `features/step_definitions/companion.steps.ts` | exact |
| `features/mcp-server/agent-grants.feature`, `features/mcp-server/verdict-*.feature` (new) and tagged existing features | scenario | n/a | `features/mcp-server/invocation.feature` | exact |
| `scripts/check-features.mjs` (tag rules) | lint script | batch | `misplacedTagFindings` 332, `examplesTagFindings` 338 | n/a |
| `test/e2e/_rpc.ts` (`--no-mcp` option) | harness | n/a | `piArguments` 242-254 | n/a |
| `.fallowrc.json` (`ignoreExports`), `package.json`, `.github/workflows/ci.yml`, PROJECT.md, README/AGENTS/STACK/CHANGELOG text | config/docs | n/a | — (see Shared Patterns) | n/a |

## Pattern Assignments

### `domain/mcp-implementation.ts` and `domain/mcp-builtin-features.ts` (domain, transform)

**Analog:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`

Header + imports (lines 1-15): file-path header comment, then typebox only.
```ts
// domain/mcp-server-features.ts
//
// The closed Claude Code 2.1.291 MCP server table ...
import Type from "typebox";
import { Compile } from "typebox/compile";
```

Closed union + verdict union (lines 25-46) — copy shape; append `| "sse"` here:
```ts
export type McpUnsupportedFeature =
  | "ws" | "sse-ide" | "ws-ide" | "sdk" | "claudeai-proxy"
  | "headersHelper" | "oauth.xaa" | "command ~" | "args ~"
  | "bareElicitationCapability";

export type McpServerVerdict =
  | { readonly kind: "supported" }
  | { readonly kind: "blocked"; readonly feature: McpUnsupportedFeature }
  | { readonly kind: "malformed"; readonly detail: string };
```
Keep the scan order `ws`, `headersHelper`, `oauth.xaa`, `command ~`, `args ~`, `bareElicitationCapability`; host-only types blocked without validation in both profiles (RESEARCH Pattern 2). Profiles are data (`profileFor(id)` returns a readonly object); `ActiveMcpImplementation`/`McpImplementationId` are defined in `platform/pi-api.ts` (or `shared/`) and re-exported from domain, never the reverse (platform imports shared only).

Exhaustiveness on closed sets: use the `as const satisfies Record<Union, true>` map form (see Closed-set below) and `assertNever` in switches.

**Same-commit coupling (Pitfall 4):** `domain/resolver-types.ts` lines 98-128 mirror the union as TypeBox literals with a two-way drift check:
```ts
type DroppedMcpServerSchema = Type.TObject<{
  server: Type.TString;
  feature: Type.TUnion<[ Type.TLiteral<"ws">, ... , Type.TLiteral<"bareElicitationCapability"> ]>;
}>;
type DroppedMcpServerDriftCheck = AssertTrue<
  DroppedMcpServer extends Type.Static<DroppedMcpServerSchema>
    ? Type.Static<DroppedMcpServerSchema> extends DroppedMcpServer ? true : false
    : false
>;
```
Add `Type.TLiteral<"sse">` in the same commit.

### `domain/name.ts` `builtinMcpServerName` (utility, transform)

**Analog:** `generatedMcpServerKey` (lines 630-641). Its doc says "This is the only copy of the pattern", so extract a private helper and call it from both:
```ts
export function generatedMcpServerKey(plugin: string, server: string): string {
  assertSafeName(plugin);
  const claudeServerName = mcpServerDisplayName(plugin, server);
  return `${claudeServerName.replaceAll(/[^A-Za-z0-9_-]/g, "_")}_`;
}
```
`builtinMcpServerName` = same without the trailing `_`. The full-tool-name helper copies Pi's `createMcpToolName` verbatim (RESEARCH lines 481-491) with `node:crypto` sha256.

### `domain/mcp-resolution.ts` (domain, transform)

**Analog:** `recordMergedServers` (lines 338-359):
```ts
  // `Object.fromEntries` defines own properties, so a server named
  // `__proto__` stays a server.
  merge.resolution.mcpServers = Object.fromEntries(supported);
  if (dropped.length > 0 || merge.bundle) {
    merge.resolution.unsupported.push("mcpServers");
  }
```
Add a parallel `declared` array (every non-malformed server, merge order) → `merge.resolution.declaredMcpServers = Object.fromEntries(declared)`; set `mcpBundle: true` when `merge.bundle`.

### `platform/pi-api.ts` snapshot (platform, probe)

**Analog:** itself. Current shapes (lines 140-144, 164-168) and composer (lines 266-273):
```ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
  workflowEngineLoaded: boolean;
}
export interface CommandInventoryItem {
  readonly name?: unknown;
  readonly source?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };   // add: readonly path?: unknown
}
export function softDepStatus(pi: PiInventory): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
    workflowEngineLoaded: hasLoadedWorkflowEngine(pi),
  };
}
```
Guarded arm pattern (lines 241-264) — keep one `getCommands()` per snapshot and pass the array to both the adapter arm and a new `isBuiltinMcpCommand` arm:
```ts
function probeArm(arm: () => boolean): boolean {
  try { return arm(); } catch { return false; }
}
function hasLoadedPiMcpAdapter(pi: PiInventory): boolean {
  const viaCommands = probeArm(() => pi.getCommands().some((command) => isAdapterCommand(command)));
  const viaTools = probeArm(() =>
    pi.getAllTools().some((tool) => isAdapterSource(tool.sourceInfo?.source)),
  );
  return viaCommands || viaTools;
}
```
Precedence adapter > builtin > none written as `if` statements (`sonarjs/no-nested-conditional`). Doc comments cite IDs (ADET-02 style → MSEL-01).

**Probe-count pin:** `test/edge/notification-boundary.ts` lines 70-84 `expectSoftDepProbes` = `getAllTools` ×3 and `getCommands` ×1 per probe with strict `times()`; must stay unchanged.

**Test builders:** every `SoftDepStatus` literal in tests gains `mcpImplementation`; keep `piMcpAdapterLoaded === (mcpImplementation === "adapter")`. Seven test files overlap with the record plan (RESEARCH line 568) — different waves.

### `platform/mcp-builtin-status.ts` (platform reader seed)

**Analog:** `extensions/pi-claude-marketplace/platform/mcp-status.ts` lines 1-60: file header naming the requirement and why it lives in `platform/`; imports only `typebox` and `./pi-api.ts` types; exports a factory returning the `McpStatusReader` interface. Seed `lookup` returns `"no-snapshot"` and touches no `pi` at construction (built at factory time in `index.ts`). Consume `RegisteredMcpServer[]` type so the export is really used.

### `persistence/state-io.ts` record fields (persistence, CRUD)

**Analog:** lines 99-142, the optional-additive precedent:
```ts
  // D-100-01 / ENBL-10: the supported hook entries the install materialized.
  // OPTIONAL and additive -- NO schemaVersion bump (the resolvedSha
  // precedent), so a legacy record without it loads unchanged and absence
  // needs no migrate fill.
  //
  // ABSENCE MEANS "this record predates the key": ... DIFFERENT fact from a
  // present empty array, which means "this plugin declares no supported hooks"
  hookEntries: Type.Optional(Type.Array(PERSISTED_HOOK_ENTRY_SCHEMA)),
```
New: `mcpServerConfigs: Type.Optional(Type.Array(Type.Object({ name: Type.String(), config: Type.Unknown() })))` with the same comment shape (MREC-01, D-MB-04 "before substitution"); `mcpBundle: Type.Optional(Type.Literal(true))`; `compatibilityBasis: Type.Optional(Type.Literal("neutral"))`. Update `test/architecture/compat-01-no-expansion.test.ts` lines 655-674 `IsExact` key set (different wave from the closed-set commit).

### Record producers (CRUD)

**`install-outcome.ts` `statePhase`** (lines 1590-1612), conditional-spread style:
```ts
        ...(installCtx.resolvedSha !== undefined && { resolvedSha: installCtx.resolvedSha }),
        ...(installCtx.hookEntries !== undefined && { hookEntries: [...installCtx.hookEntries] }),
        compatibility: {
          installable: installCtx.resolved.state === "installable",
          notes: [...installCtx.resolved.notes],
```
Add `mcpServerConfigs: Object.entries(installCtx.resolved.declaredMcpServers).map(([name, config]) => ({ name, config }))` (always present, from the resolver, never from staged/substituted entries).

**`update-swap.ts` `applyAllSuccessRecordFields`** (lines 877-905), in-place set-or-delete style:
```ts
  if (preflight.resolvedVersion === undefined) {
    delete sRecord.resolvedVersion;
  } else {
    sRecord.resolvedVersion = preflight.resolvedVersion;
  }
```
Write `mcpServerConfigs` (and `mcpBundle` set/delete) beside `compatibility`.

**`update-preflight.ts`** `disabledPinProjection` (725), `nextDisabledPin` (744), `refreshDisabledRecord` (781): copy the same set/delete pattern and add the field to the projection so a declaration-only change writes (Amendment; log as ROADMAP-table deviation).

### `orchestrators/mcp/session-materialize.ts` + seeds (event-driven, never throws)

**Analog:** `index.ts` `prepareResources` (lines 136-182) — each step in its own try/catch, debug-log on failure, never rethrow (NFR-2):
```ts
    requireNotificationMode(ctx.mode);
    try {
      const pathResult = await recomputePluginPath(event.cwd);
      ...
    } catch (err) {
      hookDebugLog(`plugin PATH recompute skipped: ${errorMessage(err)}`, "env");
    }
```
and the small helper form `applyMcpAdapterEnvFrom` (lines 46-59). Seeds: `builtinRegistrationStep({ pi, ctx, snapshot })` / `agentGrantsStep({ ctx, snapshot })` return `Promise<void>` and do nothing; parameter typed `PiMcpRegistry` (real consumer). `session-materialize` opens `openNotificationSnapshot(pi)` once.

**`index.ts` wiring:** make the existing `pi.on("session_start", …)` (lines 236-243) async and append the call inside it (do not add a fourth handler; `test/index.test.ts` consumes registrations in order and needs `expectSoftDepProbes(pi, 1)`). Insert `resyncBuiltinRegistrations({ pi, ctx, snapshot: run })` after the `loadReconcile` try/catch (line 167) in its own try/catch.

### `orchestrators/mcp/recorded-servers.ts` (read-only file I/O)

**Analog:** the cached-manifest read path `domain/manifest.ts` `loadMarketplaceManifest` + `domain/manifest-lookup.ts` `lookupDeclaredPlugin` + `resolveStrict`. Reader is injected (`reader(record.resolvedSource)`), per CONVENTIONS "dependency injection over test-only seams". Any throw maps to `{ kind: "unreadable" }`; returns the closed union from RESEARCH lines 507-510. Not in `NETWORK_SEAMS`: must not import `platform/git`.

### `orchestrators/plugin/info-mcp-status.ts` / `info.ts`

`withMcpServerStatus` (line 107) currently keys with `generatedMcpServerKey`. Change signature to take `{ reader, implementation }`; both `info.ts` call sites (~3258, ~3298) pick `mcpStatus.builtin` only when `run.softDeps.mcpImplementation === "builtin"`, else `mcpStatus.adapter`.

### Closed set, one commit (config)

**Analog:** the existing `requires pi-mcp-adapter` enrollment in every file:
- `shared/notification-types.ts:27` union and tail `| "already added";` (line 293) — append the two reasons after it; `McpServerStatus` (~1145-1155) append two tokens.
- `shared/notification-wire.ts:98/163` `REASONS`, and the satisfies-map form (lines 195-203):
```ts
const COMPANIONS = {
  "pi-dynamic-workflows": true,
  "pi-mcp-adapter": true,
  "pi-subagents": true,
} as const satisfies Record<Companion, true>;
```
- `shared/notify-reasons.ts:113` `UnsupportedReason` group; `:46` list.
- `shared/concerns/soft-dep.ts:37` `export type Companion = ...` (type only).
- `test/architecture/notify-closed-set-locks.test.ts:55,120` enrollment maps and counts; `compat-01-no-expansion.test.ts` `EXPECTED_REASONS`.
- `npm run schema:generate` for `schema/claude-plugin.schema.json`; hand-edit `docs/json-output.md` lists (~949-953). Catalog counters stay (nothing emitted).

### `test/architecture/<factory-probe-ban>.test.ts` (unpaired architecture test)

**Analog:** `test/architecture/no-probe-in-workflows-bridge.test.ts` lines 1-40: imports `node:assert/strict`, `node:test`; long header block stating the invariant, its requirement ID, and the cost of losing it. Use a runtime check (RESEARCH line 658): run `claudeMarketplaceExtension(fakePi)` with `getCommands`/`getAllTools`/`getMcpServers` recording calls and assert none happened before a `session_start` is fired. Do not commit a negative control (CONVENTIONS).

### `features/lib/<builtin-stand-in>/extension.ts` (harness Pi extension)

**Analog:** `features/lib/pi-registry-probe/extension.ts`:
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function registryProbe(pi: ExtensionAPI): void {
  pi.registerCommand(REGISTRY_PROBE_COMMAND, { ... });
}
```
Register inside `pi.on("session_start", …)`, not at factory time; skip when `pi.getMcpServers()` or `<agent dir>/mcp.json` / `.pi/mcp.json` already name it (`-`/`_` folded). Note: this adds a 41st `fallow-ignore` marker; update the count in CONVENTIONS.md.

### `features/support/pi-process.ts` and `world.ts` (harness)

- `BeforeAll` (pi-process.ts 71-116): read `this.parameters.mcpImplementation`; under adapter pass `resolveCompanion("pi-mcp-adapter").entry` to `PiProcess.start`.
- `Before` (118-150): after emptying sandbox dirs and before `startSession`, write `<agentDir>/mcp-onboarding.json` (adapter profile only); read stub pid files before emptying, poll after.
- `world.ts` `usePiWithProfile` (537-580): restart methods reuse its start body but skip the "already started" guard; register `onRelease` with `pi.stop()` + `assertStandInsStopped(harness)` exactly as lines 571-575.
- `PiProfile` (lines 90-98) is the shape to extend (e.g. `noMcp?: true`).
- `test/e2e/_rpc.ts` `piArguments` (242-254): add an options param producing `"--no-mcp"`; never `--no-extensions`.

### `features/step_definitions/mcp-implementation.steps.ts`

**Analog:** `features/step_definitions/companion.steps.ts` (imports `{ type DataTable, Given } from "@cucumber/cucumber"`, `function (this: ScenarioWorld)` bodies). Under adapter the step calls `usePiWithProfile({ companions: ["pi-mcp-adapter"] })`; under builtin `companions: []`.

### `scripts/check-features.mjs` (tag rules)

**Analog:** lines 332-346:
```js
function misplacedTagFindings(uri, node) {
  return node.tags.map((tag) =>
    gherkinFinding(uri, tag, `tag ${tag.name} is not on an Examples block`),
  );
}
function examplesTagFindings(uri, examples) {
  return examples.tags
    .filter((tag) => !sourceTags.has(tag.name))
    .map((tag) => gherkinFinding(uri, tag, `tag ${tag.name} on an Examples block is not @url or @github`));
}
```
Add an `implementationTags` Set beside `sourceTags`, filter it out of `misplacedTagFindings`, and add a pickle-level finding pass in the `runFindings` (line 200) family using the dry-run collection (`dryRun()` line 104 clears `tagExpression`). Update `.agents/skills/cucumber/rules/features.md` line ~63.

### `cucumber.json`

Current single `default` profile (import/format/order/parallel). Repeat those four keys in `adapter` and `builtin`; keep `default` = adapter; no `paths` in profiles.

### `test/architecture/behavioral-shard-coverage.test.ts`

`behavioralShards` (line 54) parses `- shard: (\S+)`; add a sibling `- profile:` parse and check coverage per `(profile, path)`.

## Shared Patterns

### Never-throw boundary (NFR-2)
**Source:** `index.ts` lines 46-59, 136-182. **Apply to:** session-materialize, both seeds, resync call, stand-in handler. Each step in its own try/catch, `hookDebugLog(\`... skipped: ${errorMessage(err)}\`, "<category>")`.

### Optional additive record fields
**Source:** `persistence/state-io.ts` 99-142. **Apply to:** `mcpServerConfigs`, `mcpBundle`, `compatibilityBasis`. Comment states ID, "NO schemaVersion bump", and what absence means.

### Closed-set maps
**Source:** `shared/notification-wire.ts` 195-203 (`as const satisfies Record<U, true>`) + `Object.hasOwn` guard (`platform/mcp-status.ts` `isRuntimeStatus`). **Apply to:** every new closed union.

### Frozen exports
**Source:** `.fallowrc.json` (`"stale-suppressions": "error"` at line 157). **Apply to:** every Phase-1 export consumed only later — per-file `ignoreExports` entries, never source markers. One plan per wave edits `.fallowrc.json`.

### Source-test pairing
Every new source under `extensions/` gets `test/<same path>.test.ts` with 100% direct coverage; imports with explicit `.ts`; `import type` grouped last. Architecture tests are unpaired.

### Comments
Cite durable IDs (MSEL-01, MREC-01, D-MB-NN), never "Phase N" (also in tag reasons).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `domain/mcp-implementation.ts` `effectiveMcpCompatibility` | pure function | transform | No existing implementation-dependent verdict read; use RESEARCH Pattern 3 decision table (lines 513-522) |
| CI profile matrix in `.github/workflows/ci.yml` | config | n/a | No existing multi-axis matrix; follow RESEARCH "CI (DUAL-03)" |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,platform,persistence,orchestrators,shared}`, `index.ts`, `features/{lib,support,step_definitions}`, `scripts/check-features.mjs`, `test/architecture`, `test/edge`, `test/e2e/_rpc.ts`, `cucumber.json`, `.fallowrc.json`
**Files scanned:** ~30
**Pattern extraction date:** 2026-11-04
