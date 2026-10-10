# Phase 8: Clear milestone debt - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** 24 primary new/modified files (plus the OWNKEY sweep's ~32 read-site files and the doc/ledger records)
**Analogs found:** 23 / 24

Paths without a prefix are under `extensions/pi-claude-marketplace/`. All analogs below are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/own-key.ts` (NEW) | utility (leaf) | transform | `orchestrators/reconcile/mcp-migration.ts:159-162` (`ownValue`) + `bridges/mcp/safe-set.ts` (`safeSet`) | exact |
| `tests/shared/own-key.test.ts` (NEW) | test | — | `tests/bridges/mcp/safe-set.test.ts` | exact |
| `orchestrators/reconcile/mcp-migration.ts` (drop local `ownValue`; IN-07 miss; IN-01/03/06; env) | orchestrator | batch / file-I/O | itself | — |
| `domain/name.ts` (+ `isReservedRecordKey`, `__proto__` only per D-08-07) | utility | validation | `domain/name.ts::assertSafeName` | role-match |
| OWNKEY read/write sweep (~32 files, e.g. `orchestrators/plugin/shared.ts`, `info.ts`, `scope-fanout.ts`) | orchestrator | CRUD reads | `mcp-migration.ts` `ownValue` call sites | exact |
| `bridges/mcp/adapter-entry.ts` (`CARRIED_FIELDS` + `openUi`, `trace`) | bridge helper | transform | itself `:41-51` | — |
| `bridges/mcp/adapter-doc.ts` (`serverChoices` capture; IN-05 empty drop) | bridge composer | file-I/O (doc compose) | `withPluginServers`/`survivingEntry`/`keptOverridesOf` same file | exact |
| `bridges/mcp/marker.ts` (store reader/helpers, `isPlainObject` export IN-03) | bridge helper | transform | `readMarker`/`keptOverrideOf` `:50-137` | exact |
| `bridges/mcp/stage.ts` (consume store; required `env`) | bridge | file-I/O | `prepareStageMcpServers` `:470-500` | exact |
| `bridges/mcp/unstage.ts` (capture for adapter target only) | bridge | file-I/O | same file `override-restored` path `:123-128` | exact |
| `bridges/mcp/types.ts` (`StageMcpInput.env` required) | types | — | `:39-43` | — |
| `domain/mcp-server-features.ts` (`auth: "oauth"`; IN-03 `URL.canParse`) | domain table | transform | `remoteOptions` `:151-153`, `oauthField` | exact |
| `orchestrators/plugin/install-outcome.ts`, `update-swap.ts`, `reinstall-replace.ts`, `operations.ts` (D-08-06 env threading) | orchestrator / composition root | request-response | `orchestrators/plugin/info.ts:3202-3207` + `operations.ts:61-92` | role-match |
| `orchestrators/plugin/reinstall-clone-probe.ts` (IN-08 fallback) | orchestrator | file-I/O / network seam | itself `:45-75` | — |
| `orchestrators/plugin/git-source-probe.ts` (`probeMirror` fall-through) | orchestrator | file-I/O | same shape as reinstall-clone-probe | role-match |
| `shared/notification-dispatch.ts` (new left-row kind naming `update`; IN-02; IN-05 `printable`) | shared renderer | event (notify) | `McpMigrationMarketplaceUnreadableRow` `:534-545`, `leftRowLine` `:762-781`, `leftRowKeys` `:681-695` | exact |
| `docs/output-catalog.md` (left-in-place block, ~line 4400) | doc (byte-locked) | — | the `mcp-migration-left-in-place` block | exact |
| `tests/architecture/mcp-migration-notice.test.ts` (states table ~`:105`) | test (arch) | — | the `marketplace-unreadable` state row `:104-110` | exact |
| conformance case: adapter ignores `_piClaudeMarketplace.serverChoices` (NEW case/file under `tests/integration/`) | test (integration, optional peer) | file-I/O | `tests/integration/mcp-status-conformance.test.ts` + `tests/integration/pi-mcp-adapter-peer.ts` | exact |
| `tests/integration/mcp-override-lifecycle.test.ts` (disable→enable, uninstall→reinstall cases) | test | — | itself | — |
| `tests/architecture/catalog-uat/fixtures/plugin-info.ts` (hoist `COMMIT_COMMANDS_INSTALLED`) | test fixture | — | RESEARCH Code Examples (verified hoist) | exact |
| `tests/live-uat/{stop-canary,manifest-absence-canary}.mjs` (marker + justification) | tooling | — | `fallow-ignore-next-line code-duplication` markers in `bridges/agents/stage.ts:382`, `bridges/commands/stage.ts:462` | exact |
| `.planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md` (NEW) | record | — | `.planning/phases/0[1-6]-*/0N-REVIEW-DISPOSITION.md` (frontmatter `findings:` + table) | exact |
| `shared/session-env.ts` IN-06 | shared | env | its marker-skip arm (`Reflect.deleteProperty`) | exact |

## Pattern Assignments

### `shared/own-key.ts` (utility, leaf) — NEW

**Analog A:** `orchestrators/reconcile/mcp-migration.ts:159-162` (move this, then import it back):
```typescript
/** The value under an own key only, so a marker string such as `constructor` names no record. */
function ownValue<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}
```

**Analog B (write side):** `bridges/mcp/safe-set.ts` (whole file, 24 lines) — file header comment explaining the `__proto__` setter hazard, then:
```typescript
export function safeSet(out: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "__proto__") {
    Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
  } else {
    out[key] = value;
  }
}
```
`setOwn<T>` copies this shape, typed generically. Must live in `shared/` (only zone every zone may import; `bridges-mcp` cannot be imported by `persistence/`). Header comment cites D-08-07 / OWNKEY-01, no phase refs. Explicit return types required (`explicit-module-boundary-types`).

### `tests/shared/own-key.test.ts` (test) — NEW

**Analog:** `tests/bridges/mcp/safe-set.test.ts:1-30`:
```typescript
import assert from "node:assert/strict";
import { test } from "node:test";

import { safeSet } from "../../../extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts";

test("copies an ordinary key as an own data property without changing the prototype", () => {
  // arrange
  const accumulator: Record<string, unknown> = {};
  ...
  // act
  safeSet(accumulator, "server", server);

  // assert
  assert.deepStrictEqual(accumulator, expectedAccumulator);
  assert.deepStrictEqual(Object.getOwnPropertyDescriptor(accumulator, "server"), expectedDescriptor);
  assert.strictEqual(Object.getPrototypeOf(accumulator), Object.prototype);
});
```
Path depth is `../../extensions/...` for `tests/shared/`. Data-drive the reads over `Object.getOwnPropertyNames(Object.prototype)`; assert descriptor + prototype intact for `setOwn(map, "__proto__", v)`. 100% direct coverage of the pair.

### OWNKEY sweep sites (orchestrators/persistence/edge)

Replace `state.marketplaces[name]` / `record.plugins[name]` with `ownValue(state.marketplaces, name)` and bracket writes with `setOwn(...)`. Import as `import { ownValue, setOwn } from "../../shared/own-key.ts";` (sibling-depth per file). Keys of form `` `${p}@${mp}` `` cannot be prototype names; convert only for uniformity.
**Fallow hazard:** `orchestrators/plugin/shared.ts:293-311 / 953-970` and `:311-327 / 970-982` (r11/r14) turn introduced when edited — extract a `present(state)`-parameterized scope-resolution helper in the same plan, or place one `// fallow-ignore-next-line code-duplication -- <reason>` above a line inside one instance per group.

### `domain/name.ts` reserved key rule

**Analog:** `assertSafeName` (`domain/name.ts:28-58`) throws plain `Error` with a `prefix` label. Do NOT add the rule there (it validates skill/command/agent names too). Add a separate exported predicate (only `__proto__` per D-08-07 operator ruling) and call it at `domain/plugin-resolver.ts:515` (next to `assertSafeName(entry.name)`, surfacing an existing malformed/unavailable reason) and `orchestrators/marketplace/add.ts` (`derivedName`).

### `bridges/mcp/adapter-entry.ts` — D-08-01

Append to `CARRIED_FIELDS` (`:41-51`) `"openUi"`, `"trace"`. Pin tests: `tests/bridges/mcp/adapter-entry.test.ts` `CARRIED_KEYS` (`:73-83`), exact-JSON carried expectation (`:1042`).

### `bridges/mcp/adapter-doc.ts` — D-08-02 store capture + P2 IN-05

**Analog (same file):** the per-entry composer that decides what an owned entry leaves behind:
```typescript
function survivingEntry(name, entry, owner, replaced): unknown {
  const restaged = Object.hasOwn(replaced, name);
  if (isOwnedBy(entry, owner.pluginName, owner.marketplaceName)) {
    const kept = restaged ? undefined : restorableOverride(entry);
    return kept === undefined ? undefined : restoredOverride(kept, entry);
  }
  return restaged && isOverlay(entry) ? undefined : entry;
}
```
and the top-level compose in `withPluginServers` (`:~360-400`): `const next = { ...config.doc };` — every top-level key keeps its position; the store member is another top-level key on `next`. Accumulate keyed maps with `safeSet` (see `keptOverridesOf` `:229-244`):
```typescript
const keptOverrides: Record<string, unknown> = {};
...
safeSet(keptOverrides, name, override);
```
Rules from RESEARCH: capture = `CARRIED_FIELDS` minus marker `pluginSetFields` minus fields the written-back `keptOverride` stub holds; write nothing when empty; adapter target only (never into legacy `mcp.json` — `unstage.ts` runs the same composer for `PI_MCP_SERVER_KEYS`, so capture is an explicit opt-in parameter). IN-05: drop a restored override with no own keys when the kept override had ≥1. Put capture in a separate pure helper (`capturedChoices`) to stay under cognitive 15 on both gates.

### `bridges/mcp/marker.ts` — store member reader

**Analog:** `readMarker` / `keptOverrideOf` (`:50-137`): `CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace"` (`:18`); own-key reads via `Object.hasOwn(obj, "keptOverride") ? obj.keptOverride : undefined` then `isPlainObject(...)` gate (`:81-86`). A top-level `serverChoices` reader uses the same hasOwn + isPlainObject discipline. IN-03: export the one `isPlainObject` from here; delete private copies in `substitute.ts:67`, `adapter-doc.ts:84`, `adapter-entry.ts:73`, `stage.ts:221`, `legacy.ts:148`.

### `bridges/mcp/stage.ts` / `types.ts` — consume store + D-08-06

Current (`stage.ts:479-485`):
```typescript
const substitution: McpSubstitutionContext = {
  pluginRoot, pluginData,
  projectDir: locations.scope === "project" ? cwd : undefined,
  env: input.env ?? process.env,
};
```
D-08-06: make `StageMcpInput.env` required (`types.ts:39-43` doc comment "Absent means Pi's `process.env`" goes) and drop `?? process.env`. Store consume: feed `store[key]` into `stampServers` as lowest-precedence `previous` (store < ours < overlay); delete consumed keys in the same `_nextDoc` write.

### D-08-06 env threading (install-outcome, update-swap, reinstall-replace, mcp-migration)

**Analog:** `orchestrators/plugin/info.ts:3197-3207`:
```typescript
/**
 * ... `env` is the environment the MCP server variable lists are
 * computed from (AVAR-04, AVAR-05); production passes Pi's process
 * environment.
 */
export function createGetPluginInfo(
  reader: PluginInfoReader,
  env: ClaudeEnv = process.env,
): (opts: GetPluginInfoOptions) => Promise<void> {
  return (opts) => getPluginInfoWithReader(reader, env, opts);
}
```
Per the unit-testing skill, bind `process.env` explicitly in the composition module rather than defaulting: `orchestrators/plugin/operations.ts:61-92` (`const INSTALL_TRANSACTION: InstallTransaction = {...}`, `createInstallPlugin(INSTALL_TRANSACTION, hooksRouting, completionCache)`), and the reconcile/migration wiring. Add required `env: ClaudeEnv` to `InstallLedgerOptions`, update-swap and reinstall-replace staging inputs, and `McpMigrationInput`; let `tsc` enumerate call sites. Re-audit fallow r8 (`install-flow.ts:1681-1715 / 2411-2441`).

### `domain/mcp-server-features.ts` — D-08-04

Current (`:151-153`):
```typescript
function remoteOptions(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...oauthField(server.oauth), ...remoteTimeoutField(server) };
}
```
Add an `authField(server)` spread returning `{ auth: "oauth" }` only when `headers` is a plain object with ≥1 key, no key whose `toLowerCase() === "authorization"`, and every value clean (no unset `${VAR}`, no `""`, no `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` — operator ruling). Key order is pinned by `JSON.stringify` tests (`tests/domain/mcp-server-features.test.ts:283-294`; `tests/bridges/mcp/adapter-entry.test.ts:796-851`). Note: header-value cleanliness depends on substitution output — confirm whether the check belongs in the domain table or after `bridges/mcp/substitute.ts`.

### `orchestrators/plugin/reinstall-clone-probe.ts` — IN-08

Current (`:51-75`): mirror branch `const mirrorSha = await readMirrorHeadSha(mirrorRoot);` throws on garbled HEAD; fall-through path already exists below it (`seam.materializePluginClone({ locations, cloneUrl, networkUrl, pin: recordedSha, auth })`). Wrap the read in try/catch and fall through to the seam on throw. Mirror the same throw→`probeShaClone` fall-through in `git-source-probe.ts` `probeMirror` (`:195-215`). No git identifiers named here (BLOCK F safe).

### `orchestrators/reconcile/mcp-migration.ts` — IN-07 miss

Current (`:253`, `:262-283`):
```typescript
type OfflineMiss = "not-listed" | "source-unreadable" | "marketplace-unreadable";
...
resolve: async (source) => {
  unread = true;
  const result: GitPluginRootResult =
    probe === undefined ? { kind: "not-cached" } : await probe(source);
  unread = result.kind === "not-cached";
  return result;
},
```
Track `missing-subdir`/`escapes` as a fourth miss, mapped to a new row kind in `resolveOffline` (`:318-322`).

### `shared/notification-dispatch.ts` — new left-row kind

**Row type analog** (`:534-545`):
```typescript
/**
 * AMIG-01: an installed plugin whose source the cached marketplace copy
 * cannot give: ... A reinstall reads the same copy, so the remedy is a marketplace update or an uninstall.
 */
export interface McpMigrationMarketplaceUnreadableRow {
  readonly kind: "marketplace-unreadable";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}
```
Add the new kind to the `McpMigrationLeftRow` union, to `leftRowKeys` (`:681-695`, the multi-`case` arm returning `[row.plugin, row.servers.slice(0, 1).join("")]`), and to `leftRowLine` (`:762-781`), copying:
```typescript
case "marketplace-unreadable":
  return `${ownerRowPrefix(row)} The ${printable(row.marketplace)} marketplace copy cannot give the source of ${printable(row.plugin)}. Run /claude:plugin marketplace update ${printable(row.marketplace)}, or /claude:plugin uninstall ${printable(row.plugin)}@${printable(row.marketplace)} to remove it.`;
```
New text names `/claude:plugin update ${printable(row.plugin)}@${printable(row.marketplace)}`. `printable` on every interpolated name. Also update the doc list at `:850-851`. Exhaustive switch: missing arm fails TS7030.

### `docs/output-catalog.md` + `tests/architecture/mcp-migration-notice.test.ts`

Catalog block `<!-- catalog-state: mcp-migration-left-in-place -->` (~line 4415): one ```text``` block with rows like `  tool (legacy) [user] The official marketplace copy cannot give the source of legacy. Run ...`, then a prose paragraph describing every cause and ending "Severity: `warning`. The byte form is locked by `tests/architecture/mcp-migration-notice.test.ts`." Add the new row in sorted position and a cause sentence. Test states table entry to copy (`:104-110`):
```typescript
{
  kind: "marketplace-unreadable",
  scope: "user",
  plugin: "legacy",
  marketplace: "official",
  servers: ["tool"],
},
```
Amend D-05-02 in `05-CONTEXT.md:56-68` alongside.

### Adapter conformance case for the store member (NEW)

**Analog:** `tests/integration/mcp-status-conformance.test.ts:1-60` + `tests/integration/pi-mcp-adapter-peer.ts`.
- Header explains the requirement IDs and that the peer is optional, found only via `PI_MCP_ADAPTER_ROOT`; cases skip only when unset (`const NOT_INSTALLED = "PI_MCP_ADAPTER_ROOT is not set";`).
- Imports: `findPiMcpAdapterPackage`, `loadPiMcpAdapterModule`, `readPiMcpAdapterDist` from `./pi-mcp-adapter-peer.ts`; `withHermeticEnvironment` from `../platform/hermetic-environment.ts`.
- Peer helper exports typed interfaces per `dist/*.js` module (`PiMcpAdapterUtils`, `PiMcpAdapterTypes`); add a `PiMcpAdapterConfig` interface for `dist/config.js` `loadMcpConfig` (imported by absolute file URL, as the header explains for non-exported modules).
- Assert: a doc with `_piClaudeMarketplace.serverChoices` loads with the effective `mcpServers` unchanged and no extra server. Hermetic HOME / `PI_CODING_AGENT_DIR` mandatory.

### `tests/architecture/catalog-uat/fixtures/plugin-info.ts` — DEBT-01

Hoist per RESEARCH (verified to flip audit to `pass`):
```typescript
const COMMIT_COMMANDS_INSTALLED = { status: "installed", name: "commit-commands", version: "1.2.0", ... } as const;
// each fixture: plugin: { ...COMMIT_COMMANDS_INSTALLED, dependencies: [...] }
```

## Shared Patterns

### Own-key discipline
**Source:** `shared/own-key.ts` (new) / precedent `mcp-migration.ts:159-162`, `bridges/mcp/marker.ts:61-81`
**Apply to:** every name-indexed read of `marketplaces`/`plugins` maps and every keyed write; MCP bridge keeps `safeSet`.

### Fallow clone suppression
**Source:** existing markers, e.g. `bridges/agents/stage.ts:382`, `bridges/commands/stage.ts:462`, `orchestrators/plugin/enable-disable.messaging.ts:91`
**Apply to:** r3 canary pair, r6 agents/skills stage, any inherited group a plan edits (r8, r9, r11, r14)
```typescript
// fallow-ignore-next-line code-duplication -- <reviewed reason>
```
One marker per group, on a line whose next line is inside one instance. Update the marker count in `.planning/codebase/CONVENTIONS.md` (currently 20 total / 8 code-duplication) and remove the stale `ignoredClones` claim there and in `STACK.md`. Re-run `npx fallow audit --base $(git merge-base origin/main HEAD)` after every plan touching a listed file.

### Composition-root binding of live boundaries
**Source:** `orchestrators/plugin/operations.ts:61-92` (module-private `INSTALL_TRANSACTION`, `REAL_*_TRANSACTION` constants)
**Apply to:** D-08-06 `env`; prefer explicit binding over `= process.env` defaults deep in logic.

### Notification chokepoint
**Source:** `shared/notification-dispatch.ts` (sole `ctx.ui.notify` site; `printable` for file-derived names)
**Apply to:** the IN-07 row, IN-02 notices-without-rows path. Catalog + architecture test + dispatch test change in lockstep.

### Atomic single-document write
**Source:** `bridges/mcp/adapter-doc.ts::withPluginServers` → stage `_nextDoc` / unstage write
**Apply to:** D-08-02 store capture/consume — never a second file write.

### Test hygiene
AAA comments, `node:test` + `node:assert/strict`, explicit `.ts` import extensions, hermetic home (`withHermeticEnvironment`), never touch real `~/.pi/agent`. Peer tests need `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| top-level `_piClaudeMarketplace.serverChoices` member in `mcp-adapter.json` | data contract | file-I/O | No existing top-level extension member; per-entry marker (`marker.ts`) and `keptOverridesOf` are the nearest shapes. Follow RESEARCH §D-08-02 mechanics. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges/mcp,shared,domain,orchestrators/plugin,orchestrators/reconcile}`, `tests/{integration,architecture,bridges/mcp,shared}`, `docs/output-catalog.md`
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-09
