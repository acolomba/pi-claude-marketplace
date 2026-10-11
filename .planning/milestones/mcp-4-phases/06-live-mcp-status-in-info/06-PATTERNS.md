# Phase 6: Live MCP status in info - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** 17 (3 new production/test, 14 modified)
**Analogs found:** 16 / 17

All paths below are relative to `extensions/pi-claude-marketplace/` unless they start with `tests/` or `docs/`. All are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `platform/mcp-status.ts` (NEW) | service (factory-owned state) | event-driven | `shared/completion-cache.ts` `createCompletionCache` (ownership) + `persistence/agents-index-schema.ts` (typebox) | role-match |
| `platform/pi-api.ts` (mod) | config / type views | n/a | its own `PiInventory` / `NotificationContext` views (lines 133-163) | exact |
| `index.ts` (mod) | entry/factory | wiring | `completionCache` creation (line 73) and threading (lines 147, 236) | exact |
| `edge/types.ts` (mod) | type | wiring | `EdgeDeps.completionCache` (line 25) | exact |
| `edge/register.ts` (mod) | route wiring | request-response | `makeInstallHandler(pi, hooksRouting, deps.completionCache)` (line 94) | exact |
| `edge/handlers/plugin/info.ts` (mod) | controller | request-response | itself, `makePluginInfoHandler(pi)` (lines 29-31) | exact |
| `orchestrators/plugin/info.ts` (mod) | orchestrator | transform | `withCompanionRequirements` post-pass (lines 2950-2973, 3030, 3057, 3094) | exact |
| `orchestrators/plugin/info-mcp-status.ts` (NEW, recommended) | orchestrator leaf | transform | `withCompanionRequirements` + `composeMcpEntries` (info.ts 1790-1809) | role-match |
| `shared/notification-types.ts` (mod) | model (closed union) | n/a | `McpServerSummaryEntry` (lines 878-883) | exact |
| `shared/notification-grammar.ts` (mod) | renderer | transform | `mcpEntryText` (lines 1396-1410) | exact |
| `docs/output-catalog.md` (mod) | docs contract | n/a | ADET-01 amendment, commit `2502cbf3`; AVAR-04/05 commit `b645d820` | exact |
| `tests/platform/mcp-status.test.ts` (NEW) | test | event-driven | `tests/shared/completion-cache.test.ts` | role-match |
| `tests/orchestrators/plugin/info-mcp-status.test.ts` (NEW, if leaf) | test | transform | `tests/orchestrators/plugin/info.test.ts` | role-match |
| `tests/integration/mcp-status-conformance.test.ts` (NEW) | integration test | event-driven | `tests/integration/adapter-expansion-conformance.test.ts` + `pi-mcp-adapter-peer.ts` | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` (mod) | arch test | n/a | `REASON_ENROLLMENT` / `STATUS_TOKEN_ENROLLMENT` (lines 41, 110) | exact |
| `tests/architecture/catalog-uat/{fixtures/plugin-info.ts,catalog-contract.test.ts,catalog-parser.test.ts}` (mod) | arch test | n/a | commits `2502cbf3`, `b645d820` | exact |
| `tests/index.test.ts`, `tests/edge/{register,types}.test.ts`, `tests/edge/handlers/plugin/info.test.ts`, `tests/edge/notification-boundary.ts`, `tests/platform/pi-api.test.ts`, `tests/shared/notification-grammar.test.ts`, `tests/orchestrators/plugin/info.test.ts` (mod) | tests | n/a | existing cases in same files | exact |

## Pattern Assignments

### `platform/mcp-status.ts` (NEW)

**Ownership analog:** `shared/completion-cache.ts:379-391`, a factory closing over private state, no module global:
```ts
export function createCompletionCache(): CompletionCache {
  const memPluginIndex = new Map<string, PluginIndexMemoryEntry>();
  return {
    getPluginIndex: (pluginCachePath, scope, marketplace, rebuild, options) =>
      getPluginIndexWithMemory(memPluginIndex, ...),
    ...
  };
}
```
Also copy its file-header style (lines 1-40): `// platform/mcp-status.ts` path line, then a "why here" paragraph and the read API.

**Validation analog:** `persistence/agents-index-schema.ts:1-16`, compiled once at module load:
```ts
import Type from "typebox";
import { Compile } from "typebox/compile";
```
Schema to use: RESEARCH.md Q7 (`version: Type.Literal(1)`, `servers: Type.Array(Type.Object({ name: Type.String(), status: Type.String() }))`). Shape of tracker: RESEARCH.md Pattern 1. The handler must be total (no throw: Pi prints handler throws to stderr). Empty `servers` means no usable snapshot. Imports allowed: `typebox`, `./pi-api.ts` (type-only), `shared/` only (fallow `platform` zone).

### `platform/pi-api.ts` (mod)

Add `PiEventSource` beside the consumer-owned views at lines 133-163, same doc-comment style:
```ts
/**
 * Consumer-owned view of the Pi API used only to inspect registered tools and
 * slash commands.
 */
export interface PiInventory {
  getAllTools(): readonly ToolInventoryItem[];
  getCommands(): readonly CommandInventoryItem[];
}
```
Type evidence goes in `tests/platform/pi-api.test.ts` beside the existing `void (true satisfies Same<...>)` lines (84-95).

### `index.ts` + `edge/types.ts` + `edge/register.ts`

Copy the `completionCache` route exactly:
- `index.ts:18` import; `:73` `const completionCache = createCompletionCache();`; `:147` and `:236` pass it into deps. Add `const mcpStatus = createMcpStatusTracker(pi.events);` next to line 73. No `session_shutdown` handler (RESEARCH Q2).
- `edge/types.ts:24-25`:
```ts
export interface EdgeDeps {
  readonly completionCache: CompletionCache;
```
  Add `readonly mcpStatus: McpStatusReader;` (required, not optional).
- `edge/register.ts:94-97`:
```ts
  const install = makeInstallHandler(pi, hooksRouting, deps.completionCache);
  ...
  const pluginInfo = makePluginInfoHandler(pi);
```
  Becomes `makePluginInfoHandler(pi, deps.mcpStatus)`.

### `edge/handlers/plugin/info.ts` (mod)

Lines 29-31: add a second parameter and forward it into `getPluginInfo({...})`:
```ts
export function makePluginInfoHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
```
Update the factory JSDoc (lines 23-28) to name the tracker.

### `orchestrators/plugin/info.ts` (mod)

**Options field:** `GetPluginInfoOptions` (lines 123-135); copy the `pi` field's doc-comment style citing the ID:
```ts
  /**
   * ADET-01: info reads one `softDepStatus` snapshot to stamp the `requires:`
   * entries on every resolved row. ...
   */
  readonly pi: PiInventory;
```
Add `readonly mcpStatus: McpStatusReader;` (required) with an ASTAT-01 comment.

**Post-pass pattern** (lines 2950-2973), the model for `withMcpServerStatus`:
```ts
function withCompanionRequirements(built: InfoBlock, probe: SoftDepStatus): InfoBlock {
  const plugin = built.block.plugin;
  if (!plugin.componentsResolved) {
    return built;
  }
  const requires = companionRequirements(...);
  return {
    ...built,
    block: { ...built.block, plugin: { ...plugin, ...(requires.length > 0 && { requires }) } },
  };
}
```
**Call sites:** line 3057 (`const built = withCompanionRequirements(soleBlock, probe);`) and line 3094 (`scopeBlocks.map((b) => withCompanionRequirements(b, probe))`). Chain the status post-pass after each. The record for each block comes from `found[i].record.plugins[opts.plugin]`; the project record for D-06-09 under `--scope user` via `loadState(locationsFor("project", cwd).extensionRoot)` wrapped in try/catch -> not shadowed.

**Entry naming** (lines 1794-1809, `composeMcpEntries`): written entries have `name: mcpServerDisplayName(pluginName, server)`; left-out entries carry `unsupportedFeature` and get no status. Match record servers by `mcpServerDisplayName(plugin, s) === entry.name`, look up by `generatedMcpServerKey(plugin, s)` (`domain/name.ts:227-252`). Disabled check: `isRecordedButDisabled` (`persistence/state-io.ts:293-295`).

### `orchestrators/plugin/info-mcp-status.ts` (NEW, recommended leaf)

Pure transform; same shape as `withCompanionRequirements`. Holds the total map (RESEARCH Pattern 2, `as const satisfies Record<McpServerRuntimeStatus, McpServerStatus>`) and the precedence: no usable snapshot -> `status unknown`; user row shadowed -> `overridden by project scope`; key absent -> `not loaded`; else mapped word. BLOCK F applies: no git surface. Only stamp rows with status `installed`/`partially-installed` and `componentsResolved`.

### `shared/notification-types.ts` (mod)

Lines 878-883:
```ts
export interface McpServerSummaryEntry {
  readonly name: string;
  readonly unsupportedFeature?: string;
  readonly unsetVariables?: readonly string[];
  readonly withheldVariables?: readonly string[];
}
```
Add `readonly status?: McpServerStatus;` and the 10-member `McpServerStatus` union with a doc comment citing ASTAT-01, D-06-01/02/06/09.

### `shared/notification-grammar.ts` (mod)

Lines 1396-1406, current:
```ts
function mcpEntryText(entry: McpServerSummaryEntry): string {
  if (entry.unsupportedFeature !== undefined) {
    return `${entry.name} (unsupported ${entry.unsupportedFeature})`;
  }

  const parts = [
    ...variablePart("unset", entry.unsetVariables),
    ...variablePart("withheld", entry.withheldVariables),
  ];
  return parts.length === 0 ? entry.name : `${entry.name} (${parts.join("; ")})`;
}
```
Prepend `...(entry.status === undefined ? [] : [entry.status])` to `parts` (RESEARCH Code Examples). No glyph change.

### `docs/output-catalog.md` + catalog-uat tests

Follow commits `2502cbf3` (ADET-01) and `b645d820` (AVAR-04/05): `git show --stat <sha>` lists the exact file set. Prose paragraph beside "Companion line (ADET-01, closed-catalog amendment)" (~line 2590); edit states `installed-with-missing-companion` (~2702), `installed-with-every-companion` (~2717), `installed-with-mcp-variables` (~2970); add new states; bump `EXPECTED_STATE_COUNT`/`EXPECTED_UTF8_BYTES` (`catalog-contract.test.ts:38-40, 337-342`) and the parser count (`catalog-parser.test.ts:69-74`).

### `tests/architecture/notify-closed-set-locks.test.ts` (mod)

Copy the enrollment idiom (header lines 1-25; maps at lines 41 and 110):
```ts
const REASON_ENROLLMENT: Record<Reason, true> = { ... };
```
Add `MCP_SERVER_STATUS_ENROLLMENT: Record<McpServerStatus, true>` (10 keys, hand-written) and an exact-length test.

### `tests/platform/mcp-status.test.ts` (NEW)

Analog `tests/shared/completion-cache.test.ts` for a factory-owned state module. Use a plain stub `{ on(channel, handler) { captured.push(...); return () => {}; } } satisfies PiEventSource`; drive payloads: valid, extra fields, `version: 2`, empty servers, `null`, non-string name, unknown status string, replacement by invalid payload. 100% direct coverage alone.

### `tests/integration/mcp-status-conformance.test.ts` (NEW)

Analog `tests/integration/adapter-expansion-conformance.test.ts` (skip when unset at lines 14, 76, 166) and `tests/integration/pi-mcp-adapter-peer.ts:60-80`:
```ts
export async function findPiMcpAdapterPackage(): Promise<OptionalPeer | undefined> {
  const root = process.env.PI_MCP_ADAPTER_ROOT;
  if (!root) {
    return undefined;
  }
  ...
}
```
Add a `dist/types.js` loader there; publish with the adapter's `MCP_STATUS_EVENT` and `MCP_STATUS_SNAPSHOT_VERSION` on the peer's `createEventBus()`.

### Existing test edits

- `tests/orchestrators/plugin/info.test.ts`: local wrapper defaulting `mcpStatus` to a no-snapshot tracker; `(status unknown)` at lines 2103, 2148, 2646, 4228, 7157; new D-06-09 cases with hermetic HOME.
- `tests/index.test.ts` + `tests/edge/notification-boundary.ts:118-126`: strict mock needs `when(() => pi.events).thenReturn(bus)`.
- `tests/edge/handlers/plugin/info.test.ts`: 7 `makePluginInfoHandler(pi)` sites gain the tracker; `tests/edge/register.test.ts`, `tests/edge/types.test.ts` get `mcpStatus` in deps.

## Shared Patterns

- **Factory-owned state via EdgeDeps:** `index.ts:73` -> `edge/types.ts:25` -> `edge/register.ts:94`. Required field, never optional (optional-field silent-omission class).
- **Post-pass stamping in orchestrator, dumb renderer:** `withCompanionRequirements` (info.ts 2950-2973); renderer only formats closed tokens.
- **Typebox compile-once:** `persistence/agents-index-schema.ts:15-16`.
- **Closed-set amendment:** union in `notification-types.ts` + enrollment map in `notify-closed-set-locks.test.ts` + catalog blocks + count pins, all in one change.
- **Comments:** cite ASTAT-01 / D-06-xx, never phase numbers.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `platform/mcp-status.ts` (subscription half) | service | event-driven | No existing `pi.events` subscriber in the codebase; use RESEARCH.md Pattern 1 and Q1/Q2. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{index.ts,edge,orchestrators/plugin,platform,shared,persistence}`, `tests/{architecture,integration,shared}`
**Files scanned:** ~14
**Pattern extraction date:** 2026-10-09
