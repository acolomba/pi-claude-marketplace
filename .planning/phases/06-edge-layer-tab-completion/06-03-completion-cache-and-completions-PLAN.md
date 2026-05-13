---
phase: 06-edge-layer-tab-completion
plan: 03
type: execute
wave: 2
depends_on:
  - 06-02
files_modified:
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - tests/shared/completion-cache.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/completions/data.test.ts
autonomous: true
requirements:
  - TC-1
  - TC-3
  - TC-4
  - TC-5
  - TC-6
  - TC-8
  - TC-9
must_haves:
  truths:
    - "`getMarketplaceNames(cachePath, scope, rebuild)` returns cached names on warm hit and never invokes rebuild()"
    - "`getMarketplaceNames` on ENOENT calls rebuild() then atomicWriteJson the result"
    - "`getMarketplaceNames` on schemaVersion mismatch drops the cache file content and rebuilds"
    - "`getPluginIndex` returns memory hit before the injected `now` advances past 10 minutes; advances re-read from file"
    - "TC-8: rebuild throwing a manifest error caches `{ schemaVersion: 1, lastRefreshedAt, plugins: [], _loadError }` and returns []"
    - "TC-9: rebuild throwing a state.json error propagates from both `getMarketplaceNames` and `getPluginIndex`"
    - "`getArgumentCompletions(prefix, { cwd })` returns AutocompleteItem[] for TC-1..TC-6 cases per the dispatcher branches"
    - "Plugin-ref completion in install mode INCLUDES status === \"unavailable\" rows (D-03 corollary)"
    - "Plugin-ref completion in uninstall/update mode shows only status === \"installed\" rows"
    - "Dispatcher returns `null` (not `[]`) when no completion makes sense at the cursor position"
    - "Unique plugin token completes to `name@mp ` (trailing space); multi-marketplace to `name@` (no trailing space)"
    - "All previously-skipped TC-1..TC-9 + cache primitives tests are unskipped and green"
  artifacts:
    - path: extensions/pi-claude-marketplace/shared/completion-cache.ts
      provides: "Two-tier (memory + file) cache; D-03 invalidation API; TC-8/TC-9 semantics"
      exports: ["getMarketplaceNames", "getPluginIndex", "invalidateMarketplaceNames", "invalidateMarketplaceCache", "dropMarketplaceCache", "PluginIndexRow", "MARKETPLACE_NAMES_CACHE_SCHEMA", "PLUGIN_INDEX_CACHE_SCHEMA"]
    - path: extensions/pi-claude-marketplace/edge/completions/data.ts
      provides: "Cache-backed read-through helpers; pure helpers (buildItem, splitCompletionInput, extractPositionals); status-aware getPluginToMarketplacesMap (D-03)"
      exports: ["getMarketplaceNamesAcrossScopes", "getPluginToMarketplacesMap", "buildItem", "splitCompletionInput", "extractPositionals", "getScopeCompletions", "getMarketplaceCompletions", "getPluginRefCompletions"]
    - path: extensions/pi-claude-marketplace/edge/completions/provider.ts
      provides: "getArgumentCompletions dispatcher (TC-1..TC-6)"
      exports: ["getArgumentCompletions", "TOP_LEVEL_SUBCOMMANDS", "MARKETPLACE_SUBCOMMANDS"]
  key_links:
    - from: extensions/pi-claude-marketplace/edge/completions/data.ts
      to: extensions/pi-claude-marketplace/shared/completion-cache.ts
      via: "import { getMarketplaceNames, getPluginIndex } from \"../../shared/completion-cache.ts\""
      pattern: "from \".*shared/completion-cache"
    - from: extensions/pi-claude-marketplace/edge/completions/data.ts
      to: extensions/pi-claude-marketplace/persistence/locations.ts
      via: "ESLint BLOCK C forbids edge -> persistence; data.ts uses locations indirectly via the callback chain -- locations must be passed in by register.ts. Verify: data.ts MUST NOT import from persistence."
      pattern: "(no import) from \".*persistence"
    - from: extensions/pi-claude-marketplace/shared/completion-cache.ts
      to: extensions/pi-claude-marketplace/shared/atomic-json.ts
      via: "import { atomicWriteJson } from \"./atomic-json.ts\""
      pattern: "atomicWriteJson"
---

<objective>
Land the two-tier completion cache (`shared/completion-cache.ts`) and the cache-backed completion data accessor + dispatcher (`edge/completions/data.ts` + `edge/completions/provider.ts`). These three modules collectively satisfy TC-1, TC-3, TC-4, TC-5, TC-6, TC-8, TC-9 and D-03.

Purpose: Once these land, tab completion works end-to-end (Pi just needs to call `getArgumentCompletions`). Plan 04 wires the LLM tools and the slash-command handlers; Plan 05 wires `register.ts` and the cache-invalidation call-sites in orchestrators.

Output:
- 3 new modules (cache + data + provider)
- 3 unskipped + green test files (cache + data + provider)
- TC-8 soft-fail semantics verified by an integration test that injects a manifest-load throw
- TC-9 propagation semantics verified by a state-load throw
- D-03 10-min TTL verified via injected `now` clock seam (Node 22 compatible)
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md
@.planning/phases/06-edge-layer-tab-completion/06-RESEARCH.md
@.planning/phases/06-edge-layer-tab-completion/06-PATTERNS.md
@.planning/phases/06-edge-layer-tab-completion/06-02-SUMMARY.md

<!-- Phase 1-2 deps -->
@extensions/pi-claude-marketplace/shared/atomic-json.ts
@extensions/pi-claude-marketplace/shared/path-safety.ts
@extensions/pi-claude-marketplace/shared/types.ts
@extensions/pi-claude-marketplace/shared/errors.ts
@extensions/pi-claude-marketplace/shared/fs-utils.ts
@extensions/pi-claude-marketplace/edge/completions/normalize.ts

<!-- Test scaffolding to mirror -->
@tests/shared/atomic-json.test.ts
@tests/orchestrators/plugin/install.test.ts

<interfaces>
<!-- Public surface (06-PATTERNS.md lines 754-782; 06-RESEARCH.md lines 380-410) -->

```typescript
// shared/completion-cache.ts

import { Compile } from "typebox/compile";
import Type from "typebox";
import { atomicWriteJson } from "./atomic-json.ts";
import { errorMessage } from "./errors.ts";
import type { Scope } from "./types.ts";
import { readFile, unlink } from "node:fs/promises";

export interface PluginIndexRow {
  readonly name: string;
  readonly status: "installed" | "available" | "unavailable";
  readonly version?: string;
}

// Cache schemas (D-03; planner-suggested, see 06-RESEARCH.md TypeBox patterns)
export const MARKETPLACE_NAMES_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  names: Type.Array(Type.String()),
});
const MARKETPLACE_NAMES_VALIDATOR = Compile(MARKETPLACE_NAMES_CACHE_SCHEMA);

export const PLUGIN_INDEX_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  lastRefreshedAt: Type.String(),
  manifestRef: Type.Optional(Type.String()),
  plugins: Type.Array(Type.Object({
    name: Type.String(),
    status: Type.Union([Type.Literal("installed"), Type.Literal("available"), Type.Literal("unavailable")]),
    version: Type.Optional(Type.String()),
  })),
  _loadError: Type.Optional(Type.String()),
});
const PLUGIN_INDEX_VALIDATOR = Compile(PLUGIN_INDEX_CACHE_SCHEMA);

// Module-level memory caches (single-threaded JS event loop = no locking needed).
const memMarketplaceNames = new Map<string /* scope */, string[]>();
const memPluginIndex = new Map<string /* `${scope}::${marketplace}` */, { rows: PluginIndexRow[]; loadedAt: number }>();
const PLUGIN_INDEX_TTL_MS = 10 * 60 * 1000;

// ----- Read API (consumed by edge/completions/data.ts) -----

export async function getMarketplaceNames(
  marketplaceNamesCachePath: string,
  scope: Scope,
  rebuild: () => Promise<string[]>,
): Promise<readonly string[]>;

export interface GetPluginIndexOptions {
  /** Clock injection seam for the 10-min TTL (default: Date.now). Keeps Node floor at 22 -- avoids requiring t.mock.timers (which requires Node 23+). */
  readonly now?: () => number;
}

export async function getPluginIndex(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
  rebuild: () => Promise<PluginIndexRow[]>,
  options?: GetPluginIndexOptions,
): Promise<readonly PluginIndexRow[]>;

// ----- Invalidation API (consumed by orchestrators, post-state-commit) -----
export function invalidateMarketplaceNames(scope: Scope): void;
export function invalidateMarketplaceCache(scope: Scope, marketplace: string): void;
export async function dropMarketplaceCache(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
): Promise<void>;

// ----- Test-only seam (NOT part of the public contract; for unit tests to clear in-memory state between cases). Mark with @internal. -----
export function __resetCacheForTests(): void;
```

```typescript
// edge/completions/data.ts -- shape (per 06-PATTERNS.md lines 256-316)

import type { AutocompleteItem, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Scope } from "../../shared/types.ts";

// Pure helpers (V1 verbatim)
export function buildItem(argumentTextPrefix: string, itemText: string, appendSpace: boolean): AutocompleteItem;
export function splitCompletionInput(input: string): { tokens: string[]; current: string };
export function extractPositionals(tokens: readonly string[]): string[];

// V1 pure helpers (carry forward)
export function getScopeCompletions(current: string, argumentTextPrefix: string): AutocompleteItem[];
export function getMarketplaceCompletions(names: readonly string[], current: string, argumentTextPrefix: string): AutocompleteItem[];

// Cache-backed accessors -- replace V1 loaders.
// NOTE: data.ts MUST NOT import from persistence/. The path-construction
// happens at the caller boundary (register.ts in Plan 05). Data.ts accepts
// a `LocationsResolver` callback OR the paths directly.
export interface LocationsResolver {
  /** Given a scope, return the marketplace-names cache path. */
  marketplaceNamesCachePath(scope: Scope): string;
  /** Given (scope, marketplace), return the plugin cache path. */
  pluginCachePath(scope: Scope, marketplace: string): Promise<string>;
  /** Inject loadState for cache rebuild on miss. */
  loadStateForScope(scope: Scope): Promise<{ marketplaces: Record<string, { manifestPath?: string; plugins?: Record<string, unknown> }> }>;
  /** Inject loadMarketplaceManifest for plugin index rebuild. */
  loadManifestForMarketplace(scope: Scope, marketplace: string): Promise<{ plugins: { name: string; installable: boolean; version?: string }[] }>;
}

export async function getMarketplaceNamesAcrossScopes(resolver: LocationsResolver): Promise<readonly string[]>;

export async function getPluginToMarketplacesMap(
  mode: "install" | "uninstall" | "update",
  resolver: LocationsResolver,
): Promise<Map<string, string[]>>;

// Status-aware completion (D-03 corollary)
export async function getPluginRefCompletions(
  mode: "install" | "uninstall" | "update",
  current: string,
  argumentTextPrefix: string,
  resolver: LocationsResolver,
  opts: { allowMarketplaceOnly: boolean },
): Promise<AutocompleteItem[]>;
```

```typescript
// edge/completions/provider.ts -- dispatcher (per 06-PATTERNS.md lines 188-247, 06-RESEARCH.md lines 680-765)

export const TOP_LEVEL_SUBCOMMANDS = ["install", "uninstall", "update", "list", "marketplace"] as const;
export const MARKETPLACE_SUBCOMMANDS = ["add", "remove", "list", "update", "autoupdate", "noautoupdate"] as const;

import type { AutocompleteItem } from "@mariozechner/pi-coding-agent";
import type { LocationsResolver } from "./data.ts";

export async function getArgumentCompletions(
  prefix: string,
  resolver: LocationsResolver,
): Promise<AutocompleteItem[] | null>;
```

**Key invariant:** Return `null` (NOT `[]`) when no completion makes sense at the position (Pi-tui contract; 06-RESEARCH.md line 493).

**Crucial architecture note:** `edge/` MUST NOT import from `persistence/` (ESLint BLOCK C). The `LocationsResolver` interface is the seam -- `register.ts` (Plan 05) constructs the resolver from `persistence/locations.ts` and passes it through `getArgumentCompletions`. For Plan 03 the resolver is just an interface in `data.ts`; tests construct it inline.

**Crucial architecture note 2:** `shared/` MUST NOT import from `persistence/`/`domain/` either. `shared/completion-cache.ts` accepts the rebuild callback as a parameter -- the rebuild closure (which calls `loadState` + `loadMarketplaceManifest`) is constructed by the caller. The cache module does pure file I/O via `node:fs/promises` and atomic writes via `shared/atomic-json.ts`.

**Crucial architecture note 3:** `getArgumentCompletions` must accept the resolver as a parameter -- NOT reach for `process.cwd()` itself. `register.ts` will pass the resolver constructed from `{ cwd: process.cwd() }` (Pitfall 3 carry-forward; the one acceptable `process.cwd()` site).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement shared/completion-cache.ts with TC-8/TC-9 semantics and 10-min TTL clock seam</name>
  <files>extensions/pi-claude-marketplace/shared/completion-cache.ts, tests/shared/completion-cache.test.ts</files>
  <behavior>
- ENOENT or schema mismatch on read -> call `rebuild()`, atomicWriteJson the result, return it.
- Memory hit returns instantly (no file read, no rebuild).
- Memory miss + file hit returns file content (no rebuild) for marketplace-names; for plugin-index, returns file content unless `now() - loadedAt > 10*60*1000` (TTL).
- TTL expiry: re-read file (cheap); no rebuild unless file is also stale or missing.
- TC-8: if `rebuild()` for a plugin-index throws a "manifest-load" Error (signaled by error class or message tag), cache `{ schemaVersion: 1, lastRefreshedAt: <iso>, plugins: [], _loadError: errorMessage(err) }` and return `[]`. Subsequent reads return [] without re-throwing.
- TC-9: if `rebuild()` for marketplace-names throws (or for plugin-index throws a "state-load" Error), the throw propagates to the caller. `getMarketplaceNames` MUST NOT swallow state.json errors.
- `invalidateMarketplaceNames(scope)` drops the in-memory entry for that scope.
- `invalidateMarketplaceCache(scope, mp)` drops the in-memory plugin-index entry.
- `dropMarketplaceCache(path, scope, mp)` drops memory entry AND unlinks the file. ENOENT on the file is silent (no throw).
- `__resetCacheForTests()` clears both memory maps (test-only seam).
- Schema constants `MARKETPLACE_NAMES_CACHE_SCHEMA` and `PLUGIN_INDEX_CACHE_SCHEMA` are exported so tests can snapshot `schemaVersion === 1`.
  </behavior>
  <action>
1. Implement `extensions/pi-claude-marketplace/shared/completion-cache.ts` per the public surface above.

2. **TC-8 vs TC-9 disambiguation:** The cache can't tell from the throw alone whether it's a state-load (propagate) or manifest-load (swallow). The cleanest contract: define two named error classes in the cache module OR rely on a typed rebuild result:

   **Recommended approach:** The `rebuild` callback for `getPluginIndex` MAY return either `PluginIndexRow[]` OR throw with a specific marker. Use a typed envelope to avoid magic strings:

   ```typescript
   // Caller-side helper (resolver constructor in Plan 05 will use this):
   // - State.json throw: rethrow synchronously from the rebuild closure.
   // - Manifest throw: catch inside the closure, return `__TC8_MANIFEST_FAILURE__` sentinel via a thrown Error with a stable name.

   export class ManifestSoftFailError extends Error {
     constructor(public readonly cause: unknown) {
       super(`Manifest load failure: ${errorMessage(cause)}`);
       this.name = "ManifestSoftFailError";
     }
   }
   ```

   Then in `getPluginIndex`:
   ```typescript
   try {
     const rows = await rebuild();
     await atomicWriteJson(pluginCachePath, { schemaVersion: 1, lastRefreshedAt: new Date().toISOString(), plugins: rows });
     memPluginIndex.set(key, { rows, loadedAt: now() });
     return rows;
   } catch (err) {
     if (err instanceof ManifestSoftFailError) {
       const poisoned = { schemaVersion: 1 as const, lastRefreshedAt: new Date().toISOString(), plugins: [], _loadError: errorMessage(err.cause) };
       await atomicWriteJson(pluginCachePath, poisoned);
       memPluginIndex.set(key, { rows: [], loadedAt: now() });
       return [];
     }
     throw err; // TC-9 (or any other unexpected error)
   }
   ```

   `getMarketplaceNames` does NOT catch -- state.json errors propagate directly (TC-9).

3. **File read path:** On every memory miss, attempt `readFile(path, "utf8")` → `JSON.parse` → `*_VALIDATOR.Check(...)`. On ENOENT, JSON parse error, or schema mismatch, fall through to `rebuild()`. For plugin-index with `_loadError` field present: treat as a valid cached soft-fail; return `[]` and load into memory as `{ rows: [], loadedAt: now() }` so subsequent reads serve from memory.

4. **In-memory map keys:** `getMarketplaceNames` key = `${scope}`. `getPluginIndex` key = `${scope}::${marketplace}`.

5. **TTL implementation:** `getPluginIndex` reads `options?.now ?? Date.now` once at the top. Compare `now() - entry.loadedAt > PLUGIN_INDEX_TTL_MS`. On expiry, drop memory entry, re-read file (NOT rebuild).

6. **`dropMarketplaceCache` ENOENT handling:**
   ```typescript
   try {
     await unlink(pluginCachePath);
   } catch (err) {
     if ((err as NodeJS.ErrnoException).code === "ENOENT") return; // silent
     throw err;
   }
   ```

7. **Now implement the test file:** Unskip every test in `tests/shared/completion-cache.test.ts` (~19 cases from Plan 01). Use the `withHermeticHome` + `mkdtemp` pattern from `tests/shared/atomic-json.test.ts`. For each test:
   - `__resetCacheForTests()` at top of every `test()` body (cheap; clears memory between cases).
   - For TC-8: inject a `rebuild` that throws `new ManifestSoftFailError(new Error("missing manifest"))`. Assert the returned array is empty, the cache file content has `_loadError`, and a second read returns [] without re-invoking rebuild.
   - For TC-9: inject a `rebuild` that throws a plain `new Error("ENOENT: state.json")`. Assert the throw propagates.
   - For D-03-TTL: pass `options: { now: () => clock }` and advance `clock` past 10 min between reads. Assert the second read re-reads the file (use a spy on `readFile` if helpful; OR observe behavior by mutating the file between reads).

8. **ESLint check:** `shared/completion-cache.ts` MUST NOT import from `persistence/` or `domain/` (BLOCK C / shared-is-leaf rule). Verify with `grep`.
  </action>
  <verify>
    <automated>node --test tests/shared/completion-cache.test.ts &amp;&amp; grep -v '^#' extensions/pi-claude-marketplace/shared/completion-cache.ts | grep -c "from \".*\\(persistence\\|domain\\|orchestrators\\|edge\\|bridges\\|presentation\\|transaction\\|platform\\)/" | grep -qx 0 &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/shared/completion-cache.ts tests/shared/completion-cache.test.ts</automated>
  </verify>
  <done>shared/completion-cache.ts exists, is shared-leaf-clean (zero imports from other extension folders -- self-invariant grep gate passes), all skipped tests are unskipped + green, TC-8 caches `_loadError` and returns [], TC-9 propagates, 10-min TTL re-reads via injected clock.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement edge/completions/data.ts and unskip data.test.ts</name>
  <files>extensions/pi-claude-marketplace/edge/completions/data.ts, tests/edge/completions/data.test.ts</files>
  <behavior>
- Pure helpers `buildItem`, `splitCompletionInput`, `extractPositionals`, `getScopeCompletions`, `getMarketplaceCompletions` ported verbatim from V1.
- `getMarketplaceNamesAcrossScopes(resolver)` returns union of names from user + project scopes (dedupes).
- `getPluginToMarketplacesMap(mode, resolver)` for each scope's marketplace, walks `getPluginIndex` and filters by status per D-03 (install: status !== "installed"; uninstall/update: status === "installed").
- `getPluginRefCompletions(mode, current, prefix, resolver, { allowMarketplaceOnly })` ports V1's branching on `current.indexOf("@")`:
  - no `@` -> complete plugin half; unique plugin -> `name@mp` (trailing space); multi-marketplace plugin -> `name@` (no trailing space).
  - leading `@` -> complete marketplace names only; gated by `allowMarketplaceOnly`.
  - `name@partial` -> complete marketplaces that carry `name`.
- TC-6 + D-03: install mode INCLUDES status `unavailable` rows (future --force).
  </behavior>
  <action>
1. Port V1 pure helpers from `git show features/initial:extensions/pi-claude-marketplace/completions.ts` (the `buildItem`, `splitCompletionInput`, `extractPositionals`, `getScopeCompletions`, `getMarketplaceCompletions`, `getPluginCompletions` functions). They go in `data.ts` (per 06-PATTERNS.md, planner choice).

2. Define `LocationsResolver` interface per the `<interfaces>` block above. Document with a JSDoc that says "constructed by edge/register.ts from persistence/locations.ts; passed through getArgumentCompletions to keep edge/ -> persistence/ import boundary clean".

3. Implement `getMarketplaceNamesAcrossScopes(resolver)`:
   ```typescript
   const [user, project] = await Promise.all([
     getMarketplaceNames(resolver.marketplaceNamesCachePath("user"), "user", () => rebuildNamesForScope(resolver, "user")),
     getMarketplaceNames(resolver.marketplaceNamesCachePath("project"), "project", () => rebuildNamesForScope(resolver, "project")),
   ]);
   return Array.from(new Set([...user, ...project]));
   ```

   Helper `rebuildNamesForScope(resolver, scope)`:
   ```typescript
   const state = await resolver.loadStateForScope(scope);
   return Object.keys(state.marketplaces);
   ```

4. Implement `getPluginToMarketplacesMap(mode, resolver)`:
   ```typescript
   // For each scope: getMarketplaceNames -> for each mp: getPluginIndex -> filter by status -> build Map<pluginName, marketplaceNames[]>.
   const result = new Map<string, string[]>();
   for (const scope of ["user", "project"] as const) {
     const names = await getMarketplaceNames(resolver.marketplaceNamesCachePath(scope), scope, () => rebuildNamesForScope(resolver, scope));
     for (const mp of names) {
       const path = await resolver.pluginCachePath(scope, mp);
       const rows = await getPluginIndex(path, scope, mp, () => rebuildPluginIndex(resolver, scope, mp));
       for (const row of rows) {
         const keep =
           (mode === "install" && row.status !== "installed") ||
           (mode === "uninstall" && row.status === "installed") ||
           (mode === "update" && row.status === "installed");
         if (!keep) continue;
         const existing = result.get(row.name) ?? [];
         if (!existing.includes(mp)) existing.push(mp);
         result.set(row.name, existing);
       }
     }
   }
   return result;
   ```

   The `rebuildPluginIndex(resolver, scope, mp)` closure must wrap manifest-load failures in `ManifestSoftFailError` (TC-8) and propagate state-load failures bare (TC-9).

5. Port `getPluginRefCompletions` from V1 with the `mode: "install" | "uninstall" | "update"` signature. Drive it from `getPluginToMarketplacesMap`. The `allowMarketplaceOnly` parameter gates the leading-`@` branch (true only for `update`).

6. Unskip every test in `tests/edge/completions/data.test.ts` (~9 cases from Plan 01). Use a mock `LocationsResolver` constructed inline:
   ```typescript
   function makeResolver(state: Record<Scope, Record<string, string[]>>, manifests: Record<string, { plugins: { name: string; installable: boolean }[] }>): LocationsResolver { /* ... */ }
   ```

7. ESLint check: `edge/completions/data.ts` MUST NOT import from `persistence/`, `domain/`, `bridges/`, `transaction/`, `platform/`. ALLOWED: `shared/`, `orchestrators/` (but data.ts shouldn't need orchestrators either). Verify with grep.
  </action>
  <verify>
    <automated>node --test tests/edge/completions/data.test.ts &amp;&amp; grep -v '^#' extensions/pi-claude-marketplace/edge/completions/data.ts | grep -c "from \".*\\(persistence\\|domain\\|bridges\\|transaction\\|platform\\)/" | grep -qx 0 &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/edge/completions/data.ts tests/edge/completions/data.test.ts</automated>
  </verify>
  <done>data.ts exists with cache-backed accessors + V1 pure helpers; data.test.ts is fully unskipped and green; status filtering matches D-03 (install includes unavailable; uninstall/update show only installed); import-boundary grep gate passes (self-invariant excludes comment lines).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement edge/completions/provider.ts dispatcher and unskip provider.test.ts (TC-1..TC-6, TC-8, TC-9 integration)</name>
  <files>extensions/pi-claude-marketplace/edge/completions/provider.ts, tests/edge/completions/provider.test.ts</files>
  <behavior>
- `getArgumentCompletions(prefix, resolver)` returns:
  - TC-1: top-level keywords on first positional (`install/uninstall/update/list/marketplace`).
  - TC-2: nested keywords after `marketplace` (`add/remove/list/update/autoupdate/noautoupdate`; rm excluded).
  - TC-3: `--scope` + list-specific flags on `-` prefix.
  - TC-4: `user` / `project` after `--scope`.
  - TC-5: marketplace name union for `list <here>` and `marketplace <verb> <here>`.
  - TC-6: status-aware `<plugin>@<marketplace>` for install/uninstall/update via `getPluginRefCompletions`.
  - `null` when no completion makes sense.
- TC-7: every terminal completion includes trailing space; non-terminal (e.g. `name@`) does NOT include trailing space.
- TC-8: per-marketplace manifest soft-fail -> empty plugin set (handled by cache).
- TC-9: state.json error propagates from this function (handled by cache).
  </behavior>
  <action>
1. Create `extensions/pi-claude-marketplace/edge/completions/provider.ts` implementing the dispatcher per 06-PATTERNS.md lines 188-247 and 06-RESEARCH.md lines 680-765:

   - Exported constants `TOP_LEVEL_SUBCOMMANDS` and `MARKETPLACE_SUBCOMMANDS`.
   - `getArgumentCompletions(prefix, resolver)`:
     - Branch 1 (TC-1): `tokens.length === 0` -> top-level keywords filtered by `current` prefix, each with trailing space.
     - Branch 2a (TC-4): `prevToken === "--scope"` -> `["user", "project"]` filtered by `current`.
     - Branch 2b (TC-3): `current.startsWith("-")` -> `--scope` always; `--installed/--available/--unavailable` when `head === "list"`.
     - Branch 3 (TC-2): `head === "marketplace" && tokens.length === 1` -> `MARKETPLACE_SUBCOMMANDS` filtered.
     - Branch 4 (TC-6): `head === "install"/"uninstall"/"update" && tokens.length === 1` -> `getPluginRefCompletions(mode, current, argumentTextPrefix, resolver, { allowMarketplaceOnly: head === "update" })`.
     - Branch 5 (TC-5): `(head === "list" && tokens.length === 1) || (head === "marketplace" && tokens.length === 2 && ["remove","rm","update","autoupdate","noautoupdate"].includes(tokens[1]))` -> `getMarketplaceCompletions(await getMarketplaceNamesAcrossScopes(resolver), current, argumentTextPrefix)`.
     - Default: return `null`.

2. **CRITICAL:** Return `null` (not `[]`) at the dispatcher's terminal `return` -- Pi-tui contract.

3. Unskip every test in `tests/edge/completions/provider.test.ts` (~24 cases from Plan 01).

   For tests that exercise live state (TC-5, TC-6, TC-8, TC-9), build a `LocationsResolver` mock against a hermetic temp dir + a stubbed `loadState` / `loadManifest`. Use the `withHermeticHome` pattern from `tests/orchestrators/plugin/install.test.ts`.

   For TC-8: the resolver's `loadManifestForMarketplace` throws; assert the cache writes a `_loadError` row and the completion call returns an empty list for that marketplace's plugins.

   For TC-9: the resolver's `loadStateForScope` throws; assert `getArgumentCompletions` rethrows.

4. Verify the import-boundary grep gate on `provider.ts`:
   - ALLOWED: `shared/`, `./data.ts`, `./normalize.ts`, type imports from `@mariozechner/pi-coding-agent`.
   - FORBIDDEN: `persistence/`, `domain/`, `bridges/`, `transaction/`, `platform/`.
  </action>
  <verify>
    <automated>node --test tests/edge/completions/provider.test.ts &amp;&amp; grep -v '^#' extensions/pi-claude-marketplace/edge/completions/provider.ts | grep -c "from \".*\\(persistence\\|domain\\|bridges\\|transaction\\|platform\\)/" | grep -qx 0 &amp;&amp; grep -n 'return null' extensions/pi-claude-marketplace/edge/completions/provider.ts | head -1 | grep -q 'return null' &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/edge/completions/provider.ts tests/edge/completions/provider.test.ts</automated>
  </verify>
  <done>provider.ts exists with the 5-branch dispatcher; explicit `return null` for no-match (grep-verified); all skipped provider tests unskipped + green; TC-8 yields empty plugin list, TC-9 propagates state.json error; import-boundary gate passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cache file content -> `*_VALIDATOR.Check` | Cache file is on local disk and could be tampered (e.g. attacker writes a 1M-entry names array). Mitigated by schema validation drop+rebuild and by the cache being optimization-only. |
| Marketplace manifest -> `loadManifestForMarketplace` rebuild closure | Manifest content is supplied by user-configured marketplace; mitigated by Phase 2's MARKETPLACE_VALIDATOR schema check (already in place). |
| state.json -> `loadStateForScope` rebuild closure | State.json is project-owned; tampering propagates per TC-9; Phase 2 STATE_VALIDATOR catches malformed schema. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EDGE-1 | Tampering | Tab completion provider reads marketplace.json from disk -- prototype-pollution via untrusted JSON | mitigate | TypeBox JIT-compiled MARKETPLACE_VALIDATOR (Phase 2 D-04 carry-forward) runs inside the rebuild closure. Cache file itself validated via PLUGIN_INDEX_VALIDATOR / MARKETPLACE_NAMES_VALIDATOR. Validation failure drops + rebuilds (D-03 corollary). |
| T-EDGE-3 | Tampering | Cache file tampering | mitigate | Cache is optimization-only (D-03 corollary). Schema validation drops + rebuilds on mismatch. Tampering produces stale completions for at most 10 minutes (TTL) or until next mutation triggers invalidation. |
| T-EDGE-4 | Denial-of-Service | Giant marketplace.json could stall completion | accept | This is an existing-marketplace bug, not Phase 6's responsibility. Deferred to NFR-8 (manifest-mtime caching layer). Document and move on. |

All threats LOW or MEDIUM; none reach `high`. No blocking issues. The validator drop-and-rebuild semantics implement T-EDGE-1/3 mitigations inline.
</threat_model>

<verification>
- 3 new modules exist (`shared/completion-cache.ts`, `edge/completions/data.ts`, `edge/completions/provider.ts`).
- 3 test files have all stubs unskipped and passing (>= 52 newly-green tests).
- TC-8 verified: rebuild that throws `ManifestSoftFailError` caches `_loadError` and returns [].
- TC-9 verified: rebuild that throws a state.json error propagates from both `getMarketplaceNames` and `getPluginIndex`.
- TC-1..TC-6 dispatch branches return the expected AutocompleteItem[] shape and trailing-space conventions.
- `return null` present in `provider.ts` (no-match sentinel).
- Import-boundary self-invariants pass: `shared/completion-cache.ts` is leaf-clean; `edge/completions/data.ts` and `edge/completions/provider.ts` honor BLOCK C.
- `npm run check` exits 0.
</verification>

<success_criteria>
- Tab completion is functionally complete end-to-end (Pi just needs to invoke `getArgumentCompletions`).
- TC-8 soft-fail semantics observable in disk state (`_loadError` field in cache file) and runtime behavior (empty completion list, no throw).
- TC-9 propagation observable: state.json error escapes the dispatcher.
- D-03 10-min TTL provable via injected clock (Node 22 compatible -- no `t.mock.timers`).
- Cache is optimization-only: deleting the cache directory and re-running completion produces the same result (rebuild on miss).
</success_criteria>

<output>
After completion, create `.planning/phases/06-edge-layer-tab-completion/06-03-SUMMARY.md` noting:
- The `ManifestSoftFailError` discriminator pattern for TC-8 vs TC-9.
- The `LocationsResolver` interface as the shared/-->edge/ seam that avoids edge/ -> persistence/ imports.
- The clock-injection seam (`now: () => number`) keeping the Node floor at 22.
- D-03 corollary: install mode INCLUDES `unavailable` rows; uninstall/update show only `installed`.
- Cache schema versioning (snapshot test at `schemaVersion === 1`).
</output>
