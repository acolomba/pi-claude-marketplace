# Phase 6: Edge Layer & Tab Completion - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pi user drives `/claude:plugin` end-to-end: subcommand routing with `Usage:` blocks on empty/unknown input, quoted-argument tokenization, `--scope` validation at any position, fish-style space normalization scoped to this slash command, and tab completion at every cursor position (subcommand, marketplace name, `<plugin>@<marketplace>` token, `--scope` value, flag names). Per-marketplace manifest-load failures soft-fail to empty completion sets (TC-8); top-level `state.json` errors propagate (TC-9). LLM tool surface ships two read-only inspectors. Phase 6 also lands a two-tier completion cache (file-backed marketplace-name and per-marketplace plugin indices, plus an in-memory layer) that makes completion suggestions status-aware (install hides already-installed plugins; uninstall/update show only installed).

Phase 6 owns 13 v1 REQ-IDs (AP-1..4, TC-1..9). Spec is otherwise mostly locked by PRD §6.6 (argument parsing), §6.7 (tab completion), and PROJECT.md (LLM tools listing-only, no mutating LLM surface).

Phase 6 produces:

- `edge/router.ts` -- top-level + nested `marketplace` subcommand dispatch with `Usage:` blocks (AP-3)
- `edge/args.ts` -- tokenizer with single/double-quote support (AP-1), `--scope` extraction at any position (AP-2, AP-4); ports V1 verbatim
- `edge/args-schema.ts` -- `parseCommandArgs(args, schema, notifyError)` schema-driven validator (V1 `_args.ts` pattern; gives per-handler typed positionals)
- `edge/completions/provider.ts` -- the single `getArgumentCompletions(prefix)` entry point that tokenizes, dispatches per cursor position, and applies fish-style whitespace normalization
- `edge/completions/data.ts` -- read-through accessors that go through the cache (`getMarketplaceNames(scope)`, `getPluginIndex(scope, marketplace)`, `getPluginToMarketplacesMap(mode, filter)`)
- `edge/completions/normalize.ts` -- `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` (TC-7); ported from V1
- `edge/handlers/plugin/{install,uninstall,update,list}.ts` -- thin shims: parse args + delegate to `orchestrators/plugin/<verb>` (mirrors orchestrators 1:1)
- `edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts` -- thin shims: parse args + delegate to `orchestrators/marketplace/<verb>` (note: `marketplace autoupdate` and `marketplace noautoupdate` route to the same handler with a flag, matching Phase 4 D-01)
- `edge/handlers/tools.ts` -- `registerListMarketplacesTool(pi)` + `registerListPluginsTool(pi)` (LLM tools)
- `edge/types.ts` -- `EdgeDeps` interface (`gitOps`, `pluginUpdate`) and `SubcommandHandlers` map type
- `edge/register.ts` -- `registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)` (Phase 7's `index.ts` calls these two)
- `shared/completion-cache.ts` -- two-tier (file + in-memory) cache with read API for `edge/` and invalidation API for `orchestrators/`
- `persistence/locations.ts` extension -- new helpers `cacheDir(loc)`, `marketplaceNamesCacheFile(loc)`, `pluginCacheFile(loc, marketplace)` returning paths under `<scopeRoot>/claude-marketplace/cache/`
- Cache-invalidation call-sites added to Phase 4/5 orchestrators (post-state-commit): `marketplace add/remove/update`, `plugin install/uninstall/update`

This phase ends with `npm run check` green, the `/claude:plugin` surface callable in tests via `routeClaudePlugin(args, deps, ctx)` (no Pi process needed), and a unit-test corpus exercising (a) AP-1 tokenizer quote cases; (b) AP-2/AP-4 `--scope` validation and any-position; (c) AP-3 Usage blocks on empty/unknown subcommand; (d) TC-1..9 completion at every position including manifest soft-fail (TC-8) and state.json propagation (TC-9); (e) status-aware filtering across install/uninstall/update; (f) cache invalidation propagation from each mutating orchestrator; (g) cache 10-min TTL behavior on plugin index and forever semantics on marketplace names; (h) both LLM tools (params validation, output shape, error handling).

</domain>

<decisions>
## Implementation Decisions

### Handler Layout (D-01)

- **D-01 (Mirror orchestrator layout 1:1):** `edge/handlers/plugin/{install,uninstall,update,list}.ts` + `edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts` + `edge/handlers/tools.ts`. Same grep semantics as `orchestrators/`. Each handler is a thin shim: (1) call `parseCommandArgs(args, schema, notifyError)`; (2) if undefined, early-return (Usage already emitted); (3) call the corresponding orchestrator with the parsed positionals + `ctx` + `deps`. Test files at `tests/edge/handlers/<domain>/<verb>.test.ts`. `marketplace.autoupdate` and `marketplace.noautoupdate` both route through `handlers/marketplace/autoupdate.ts` (one file, boolean parameter -- same dual-form precedent as Phase 4 D-01 `autoupdate.ts`).
- **D-01 corollary (router stays in `edge/router.ts`, NOT inside `register.ts`):** `routeClaudePlugin(args, handlers, ctx)` and `routeMarketplace(args, handlers, ctx)` live in `edge/router.ts` -- pure functions of `(args, handlers, ctx)`. Testable without Pi. `register.ts` builds the `SubcommandHandlers` record from `EdgeDeps` and passes it to `routeClaudePlugin`. Router stays unaware of `pi.registerCommand` or `pi.registerTool`.

### LLM Tool Surface (D-02)

- **D-02 (V1's two read-only tools, with `claude_marketplace_plugin_list` extended):**
  - `claude_marketplace_list` -- V1 verbatim. Parameters: `Type.Object({})`. Returns one line per marketplace with `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`. `details: { marketplaces }`.
  - `claude_marketplace_plugin_list` -- V1 baseline + filter parameters. Parameters: `Type.Object({ marketplace?: string, scope?: "user"|"project", installed?: boolean, available?: boolean, unavailable?: boolean })`. When `marketplace` is omitted: enumerate across all marketplaces (V1 already does this). When any of `installed/available/unavailable` is set: PL-1 union semantics (no flag = all three; one or more flags = union of the named buckets). Status assignment matches PRD §5.3.1 PL-4 (`installed` from state.json `plugin.installed === true`; `available` from manifest entry where the plugin is installable and not installed; `unavailable` from manifest entry where the resolver says not-installable). Returns the same line-format and `details: { plugins: [...] }` shape as V1, refined to include filter-applied subset.
- **D-02 corollary (no mutating LLM tools):** PROJECT.md "Out of Scope" forbids `claude_install`, `claude_uninstall`, `claude_update`, `claude_marketplace_add`, etc. The two tools above are the entire Phase 6 LLM surface.
- **D-02 corollary (registration in `edge/handlers/tools.ts`; called from `edge/register.ts`):** Tool definitions and `execute` handlers live in `handlers/tools.ts`. `register.ts` exports `registerClaudeMarketplaceTools(pi)` which calls both `pi.registerTool` invocations. Phase 7's `index.ts` calls `registerClaudeMarketplaceTools(pi)` alongside `registerClaudePluginCommand(pi, deps)`.

### Two-Tier Completion Cache (D-03)

- **D-03 (File-backed cache + in-memory layer; status-aware completion filtering):** Tab completion fires on every keystroke and must surface meaningful suggestions WITHOUT re-parsing `state.json` and every marketplace's `marketplace.json` per keystroke. Phase 6 introduces a two-tier cache:
  - **File-backed layer** (persistence; one file per cache):
    - `<scopeRoot>/claude-marketplace/cache/marketplace-names.json` -- per scope. Schema: `{ schemaVersion: 1, names: string[] }`. Holds the union of marketplace names visible in that scope.
    - `<scopeRoot>/claude-marketplace/cache/plugins/<marketplace>.json` -- per (scope, marketplace). Schema: `{ schemaVersion: 1, lastRefreshedAt: <iso>, manifestRef?: <sha-or-version>, plugins: [{ name, status: "installed" | "available" | "unavailable", version? }] }`. Holds the plugin index for completion.
  - **In-memory layer** (lives in `shared/completion-cache.ts`):
    - Marketplace-name index: lazy loaded on first read; cached forever (no TTL safety net). Invalidated explicitly by `invalidateMarketplaceNames(scope)`. "Forever" semantics rely on every mutator going through an orchestrator; concurrent-process changes are not auto-detected (acceptable -- marketplaces add/remove rarely).
    - Plugin index per (scope, marketplace): lazy loaded; 10-minute TTL safety net on top of explicit invalidation. After 10 minutes the next read re-reads the file (catches changes from a sibling Pi process). Invalidated explicitly by `invalidateMarketplaceCache(scope, marketplace)` (re-read from state + manifest on next call) and `dropMarketplaceCache(scope, marketplace)` (drop file + memory; on `marketplace remove`).
  - **Read API (consumed by edge):** `getMarketplaceNames(scope) -> Promise<string[]>`, `getPluginIndex(scope, marketplace) -> Promise<PluginIndexRow[]>`. Both check in-memory first, then file, then rebuild from authoritative sources (`loadState` + `loadMarketplaceManifest`) on cache miss / TTL expiry / explicit invalidation.
  - **Invalidation API (consumed by orchestrators):** `invalidateMarketplaceNames(scope)`, `invalidateMarketplaceCache(scope, mp)`, `dropMarketplaceCache(scope, mp)`. Called post-state-commit by the mutating orchestrator. Cross-scope invalidation NOT needed (Phase 2 D-10 per-scope independence).
- **D-03 corollary (status-aware completion filtering; refines TC-6 additively):** The `getPluginRefCompletions(mode, ...)` helper consults `getPluginIndex` and filters by status:
  - `mode = "install"` -- show only plugins where `status !== "installed"`. **Includes `status === "unavailable"`** because a future `--force` flag (PRD §11 deferred) will install the available components of an unavailable plugin.
  - `mode = "uninstall"` -- show only plugins where `status === "installed"`.
  - `mode = "update"` -- show only plugins where `status === "installed"`.
  V1 currently mixes statuses for install completion (suggests already-installed plugins); Phase 6 is a refinement, not a regression. PRD §6.7 TC-6 says "complete to `<plugin>@<marketplace>` form per PRD §6.6 detail rules" -- D-03 selects a subset of those completions but does not change the token shape.
- **D-03 corollary (cache module location bridges import boundary):** `shared/completion-cache.ts` lives in `shared/` (which BOTH `edge/` and `orchestrators/` may import) -- this is the only architecturally legal placement, because `edge/` may not import `persistence/` (Phase 1 D-11 / `edge/README.md`) but the cache must be reachable from `edge/` for reads and from `orchestrators/` for invalidations. The cache module is self-contained: it does its own atomic JSON I/O (via `shared/atomic-json.ts`) and its own path containment (via `shared/path-safety.ts`). New `persistence/locations.ts` helpers (`cacheDir(loc)`, `marketplaceNamesCacheFile(loc)`, `pluginCacheFile(loc, marketplace)`) return the paths; `shared/completion-cache.ts` consumes them via its public API (`getMarketplaceNames(locations, scope)` etc.) -- there is no `shared/ → persistence/` import (which would violate Phase 1 D-11). Instead, the cache module accepts paths as parameters from its callers; orchestrators pass `locations.cacheDir`-derived paths, edge does likewise.
- **D-03 corollary (rebuild semantics on miss):** On in-memory miss → check file; on file miss/corruption → rebuild from authoritative source; on TTL expiry → re-read file (cheap) without rebuild unless mtime newer. Authoritative-source rebuild uses `persistence/state-io.loadState` + `domain/manifest.loadMarketplaceManifest` (matches V1's completion data path). Rebuild writes atomically via `shared/atomic-json.atomicWriteJson`. Rebuild failures are surfaced per TC-8/TC-9:
  - **TC-8 (per-marketplace manifest load failure):** cache the plugin index as `{ plugins: [], _loadError: "<reason>" }` and return empty plugin list for completion. The error is NOT thrown to the completion caller; it is logged via `notify.warning` only when surfaced by the orchestrator path (not the completion path).
  - **TC-9 (state.json error):** propagate. `getMarketplaceNames` and `getPluginIndex` both throw on `loadState` failure. Pi's autocomplete consumer surfaces the error to the user. No silent hide.
- **D-03 corollary (cache file is OPTIMIZATION, not authoritative):** state.json and marketplace.json remain the authoritative sources. If a cache file is corrupted, missing, or deleted, completion still works (rebuild on miss). External tools/users can safely delete `<scopeRoot>/claude-marketplace/cache/` -- it will be reconstructed lazily. This eliminates the migration / repair surface and keeps the cache schema versioning lightweight (schemaVersion 1; drop+rebuild on mismatch).
- **D-03 corollary (invalidation call-sites in Phase 4/5 orchestrators):** Phase 6 EXTENDS existing orchestrators with one cache-invalidation call each. These are additive -- no behavior change to the mutating flow; the invalidation runs AFTER the state-guard closes successfully (post-state-commit, before reload-hint emission, same boundary as the post-commit data-dir mkdir in Phase 5 D-08). Specifically:
  - `orchestrators/marketplace/add.ts` → `invalidateMarketplaceNames(scope)` + `invalidateMarketplaceCache(scope, name)` (new marketplace; build the cache eagerly)
  - `orchestrators/marketplace/remove.ts` → `invalidateMarketplaceNames(scope)` + `dropMarketplaceCache(scope, name)`
  - `orchestrators/marketplace/update.ts` → `invalidateMarketplaceCache(scope, name)` (manifest changed; plugin set may have changed)
  - `orchestrators/plugin/install.ts` → `invalidateMarketplaceCache(scope, marketplace)` (plugin moved from `available` → `installed`)
  - `orchestrators/plugin/uninstall.ts` → `invalidateMarketplaceCache(scope, marketplace)` (plugin moved from `installed` → `available`)
  - `orchestrators/plugin/update.ts` → no cache mutation needed (install status unchanged; version field is not in the plugin name cache). If the version field IS added to the cache later, this call-site is added.
  Failure mode: if cache invalidation throws, the orchestrator's primary operation has ALREADY succeeded (state-committed). Cache invalidation errors are logged via `notify.warning` only -- they do not roll back the operation or surface as orchestrator errors. The 10-min TTL safety net catches stale entries the next time the user opens completion.
- **D-03 escalation:** if perf measurement shows the file layer is unnecessary overhead (e.g., everything fits comfortably in memory and the safety net never fires), the file layer can be dropped -- leaves the in-memory layer as the only cache. Conversely, if the 10-min TTL on plugin index proves too long (users see stale completions for ~10 min after an external process change), shorten it. Both knobs are local to `shared/completion-cache.ts` constants.

### Phase 6 / Phase 7 Boundary (D-04)

- **D-04 (Phase 6 ships `registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)`; Phase 7's `index.ts` just calls them):** `edge/register.ts` exports two registration helpers:
  - `registerClaudePluginCommand(pi: ExtensionAPI, deps: EdgeDeps): void` -- internally builds the `SubcommandHandlers` record from `deps`, calls `pi.registerCommand("claude:plugin", { description, handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx), getArgumentCompletions: ... })`, and also calls `pi.on("session_start", ...)` to install the fish-style whitespace normalization autocomplete wrapper (TC-7).
  - `registerClaudeMarketplaceTools(pi: ExtensionAPI): void` -- calls `pi.registerTool` for the two LLM tools defined in `edge/handlers/tools.ts`.
  Phase 7's `index.ts` is then ~3 lines for the slash-command/tools surface plus the existing `pi.on("resources_discover", ...)` block (NOT a Phase 6 concern -- `resources_discover` is wired in Phase 7 per ROADMAP Phase 7 SC1).
- **D-04 (`EdgeDeps` interface lives in `edge/types.ts`):** `EdgeDeps` captures the orchestrator-side injection points Phase 7 wires up:
  ```typescript
  export interface EdgeDeps {
    readonly gitOps: GitOps;                    // for marketplace add/update (orchestrators inject this)
    readonly pluginUpdate: PluginUpdateFn;      // for marketplace update's autoupdate cascade
  }
  ```
  `GitOps` already lives in `orchestrators/marketplace/shared.ts` (Phase 4 D-12); `PluginUpdateFn` already lives in `orchestrators/types.ts` (Phase 4 D-06). `edge/types.ts` imports both -- allowed by Phase 1 D-11 (edge → orchestrators). No new abstraction needed.
- **D-04 corollary (router and handlers stay pure):** `routeClaudePlugin(args, handlers, ctx)` and each `edge/handlers/<domain>/<verb>.ts` handler stay pure functions of their parameters -- no `pi.*` calls inside. This keeps every handler unit-testable without an `ExtensionAPI` mock. Tests instantiate handlers directly with mocked `ctx` and call the orchestrators they wrap (or mock the orchestrator). Only `register.ts` knows about `pi.*`.

### Carry-Forward From V1 (Locked, Not Discussed)

- **Tokenizer behavior (AP-1):** V1's `tokenize()` carries forward verbatim -- supports single (`'...'`) and double (`"..."`) quotes for spaced arguments; NO backslash escapes; NO quote nesting; NO mixed-quote escape. PRD §6.6 AP-1 says "honors single and double quotes" without specifying escapes -- V1's strict behavior is the locked baseline.
- **`--scope` validation (AP-2, AP-4):** `--scope user` and `--scope project` are the only legal values; missing or invalid value throws with a clear message. `--scope` is accepted at any position (before, between, or after positionals). Both behaviors carry forward from V1's `parseArgs`.
- **`Usage:` blocks (AP-3):** V1's `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` multi-line strings carry forward verbatim. PRD §6.6 AP-3 specifies "Usage:" block emission, not content. V1's text is stable, tested, and matches the existing user contract.
- **Fish-style whitespace normalization (TC-7):** V1's `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` regex (`/^\/claude:plugin(?::\d+)?(?:\s|$)/`) carry forward verbatim, including the collision-suffix tolerance (`:\d+`). Installed via `pi.on("session_start", ...)` from `register.ts`.
- **Argument-text reconstruction in completions:** V1's `buildItem(argumentTextPrefix, itemText, appendSpace)` pattern carries forward -- every completion value reconstructs the entire argumentText (already-typed tokens + chosen text + optional trailing space). This is Pi-tui's contract, not negotiable.
- **`<plugin>@<marketplace>` token completion shape (TC-6):** V1's `getPluginRefCompletions` carries forward, REFINED per D-03 corollary to filter by status. The `mode: "available" | "installed"` parameter becomes `mode: "install" | "uninstall" | "update"` (status-aware). Plugin tokens that exist in exactly one matching marketplace produce fully-qualified `name@mp` suggestions (with trailing space); plugins in multiple matching marketplaces produce `name@` (no trailing space) so the user picks one. `update` accepts the bare `@<marketplace>` form per V1.
- **LLM tool registration ordering:** Phase 7 calls `registerClaudePluginCommand(pi, deps)` BEFORE `registerClaudeMarketplaceTools(pi)`. Order is not load-bearing but stays stable per V1's `index.ts` pattern.

### Claude's Discretion

- **D-03 cache schema versioning:** Single `schemaVersion: 1` field per cache file. On mismatch: drop + rebuild (no migration code in V1). The cache is optimization-only (D-03 corollary) so a hard reset is safe.
- **D-03 cache file naming:** `<scopeRoot>/claude-marketplace/cache/marketplace-names.json` (singular path) and `<scopeRoot>/claude-marketplace/cache/plugins/<marketplace>.json` (one per marketplace). The user did not specify exact paths; Claude chose these to match Phase 5 D-08's `data/` sibling pattern (`cache/` is a sibling of `data/`, `state.json`, `sources/`, etc. under `claude-marketplace/`). Path containment goes through `assertPathInside` against `<scopeRoot>/claude-marketplace/` (NFR-10 / Phase 1 D-14..17).
- **D-03 in-memory map keys:** Module-level `Map<key, Entry>` keyed on `${scope}::${marketplace}` for plugin index, `${scope}` for marketplace names. Simple string keys; no struct keys. Atomic reads and writes via the JS event loop's single-threadedness (no locking needed for in-memory).
- **D-03 atomic-JSON contract for cache writes:** Use `shared/atomic-json.atomicWriteJson` (Phase 1 D-03). Concurrent writes from two processes serialize via the same `write-file-atomic@^8` queue Phase 1 adopted; the loser overwrites the winner's content but both produce a valid JSON state. No special concurrent-cache reasoning needed.
- **D-03 plugin status disambiguation:** When the same plugin name appears in multiple marketplaces, each (marketplace, plugin) row in the plugin cache has its own status -- there is no "global plugin status." `getPluginIndex(scope, marketplace)` returns rows for that marketplace only. Cross-marketplace deduplication for `<plugin>@<marketplace>` completion happens at the consumer level (`getPluginRefCompletions`), as in V1's `loadPluginToMarketplacesMap`.
- **D-04 register file granularity:** Single `edge/register.ts` with both helpers. Alternative was two files (`edge/register-command.ts` + `edge/register-tools.ts`); deferred until a third helper emerges.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §6.6 -- AP-1..4 argument parsing rules (tokenizer quote semantics, `--scope` validation, Usage block, any-position flags)
- `docs/prd/pi-claude-marketplace-prd.md` §6.7 -- TC-1..9 tab completion rules (positional surfaces, `--scope` value list, plugin token form, manifest soft-fail, state error propagation, trailing space, whitespace normalization)
- `docs/prd/pi-claude-marketplace-prd.md` §5.1 / §5.2 / §5.3 -- subcommand semantics consumed by handlers (handlers must pass correct positional shapes to the orchestrators)
- `docs/prd/pi-claude-marketplace-prd.md` §6.2 -- SC-1 two-scope model; AP-2 `--scope user|project` exhaustive enumeration
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-1..5 error surfaces; AP-3 Usage block at `error` severity; IL-2 single notify channel (no `process.stdout`)
- `docs/prd/pi-claude-marketplace-prd.md` §10 -- NFR-5 network policy (completion data path MUST NOT touch network -- pure local file reads)
- `docs/prd/pi-claude-marketplace-prd.md` §11 -- V1 deferrals; `--force` install referenced by D-03 corollary (keep `unavailable` in install completions)

### Project planning

- `.planning/PROJECT.md` -- Key Decisions table; IL-2/IL-4 output channel + no-telemetry constraints; "Out of Scope" forbids mutating LLM tools
- `.planning/REQUIREMENTS.md` -- Phase 6 owns 13 REQ-IDs (TC-1..9, AP-1..4); lines 202-217 contain the canonical bullets
- `.planning/ROADMAP.md` lines 143-152 -- Phase 6 goal + 5 success criteria
- `.planning/STATE.md` -- Current state; Phase 5 complete (592 tests, all D-01..D-09 shipped)

### Phase 1 carry-forward (consumed by Phase 6)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-03 (`write-file-atomic@^8`), D-06/D-07 (notify wrappers + ESLint output discipline -- every Phase 6 user-visible message routes through `notify*`), D-08 (markers -- Usage strings are NOT in `markers.ts`; they're plain consts in `router.ts` per "stable but not contract-bound" semantics), D-11 (import boundaries: `edge/` may import from `orchestrators/`, `presentation/`, `shared/` only; `shared/completion-cache.ts` placement honors this), D-14..17 (`assertPathInside` -- every cache file path goes through it), D-22 (LLM tool surface deferred to Phase 6 -- D-02 implements with two read-only tools)
- `extensions/claude-marketplace/shared/notify.ts` -- `notifySuccess/Warning/Error/UsageError`. Phase 6's `notifyUsageError` is the AP-3 Usage emission path
- `extensions/claude-marketplace/shared/atomic-json.ts` -- `atomicWriteJson`. Phase 6's `shared/completion-cache.ts` writes go through this
- `extensions/claude-marketplace/shared/path-safety.ts` -- `assertPathInside`. Every cache file path containment check
- `extensions/claude-marketplace/shared/fs-utils.ts` -- `pathExists` (cache-miss detection without throwing)
- `extensions/claude-marketplace/shared/errors.ts` -- `errorMessage(e)` (used by tokenizer to format `--scope` validation errors)

### Phase 2 carry-forward (consumed by Phase 6)

- `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md` -- D-04 (`resolveStrict`/`resolveLoose` -- the status assignment for the plugin cache calls these to compute `installable` for available/unavailable bucketing), D-07 (TypeBox JIT at module load -- Phase 6's cache schemas follow this pattern), D-09 (state shape with `marketplaces[mp].plugins[plugin].installed`), D-10 (per-scope independence -- D-03 cache is per scope)
- `extensions/claude-marketplace/domain/source.ts` -- consumed indirectly via marketplace records' `source` field rendering in `claude_marketplace_list` tool output
- `extensions/claude-marketplace/domain/manifest.ts` -- `loadMarketplaceManifest`. Phase 6's cache rebuild path consumes; per-marketplace manifest read failure soft-fails (TC-8)
- `extensions/claude-marketplace/domain/resolver.ts` -- `resolveStrict`/`resolveLoose`. Plugin cache builds use these to compute the `unavailable` bucket (resolver returns `installable: false` for components/dependencies that can't be satisfied)
- `extensions/claude-marketplace/persistence/locations.ts` -- `ScopedLocations` brand. Phase 6 ADDS helpers: `cacheDir(loc)`, `marketplaceNamesCacheFile(loc)`, `pluginCacheFile(loc, marketplace)` -- all returning paths under `<scopeRoot>/claude-marketplace/cache/` with `assertPathInside` containment
- `extensions/claude-marketplace/persistence/state-io.ts` -- `loadState`. TC-9 propagation surface; Phase 6's `getMarketplaceNames`/`getPluginIndex` rebuild paths consume

### Phase 3 carry-forward (consumed by Phase 6)

- `.planning/phases/03-resource-bridges/03-CONTEXT.md` -- D-10 (resources_discover helper-only in Phase 3 -- Phase 6 does NOT touch this; Phase 7 wires the event handler)
- (Phase 3 bridges are not directly consumed by Phase 6; orchestrators handle bridge composition)

### Phase 4 carry-forward (consumed by Phase 6)

- `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` -- D-01 (subcommand 1:1 file mapping -- Phase 6 mirrors with `edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts`), D-05/D-06 (`PluginUpdateFn` lives in `orchestrators/types.ts`; Phase 6's `EdgeDeps` imports it), D-12 (`GitOps` in `orchestrators/marketplace/shared.ts`; Phase 6's `EdgeDeps` imports it)
- `extensions/claude-marketplace/orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts` -- Phase 6 handlers wrap each one. Cache-invalidation calls ADDED post-state-commit per D-03 corollary
- `extensions/claude-marketplace/orchestrators/marketplace/shared.ts` -- `GitOps`, `DEFAULT_GIT_OPS`. `EdgeDeps.gitOps` defaults to `DEFAULT_GIT_OPS` if Phase 7 doesn't override (Phase 7 will override with the live isomorphic-git wrapper)
- `extensions/claude-marketplace/orchestrators/types.ts` -- `PluginUpdateFn`, `PluginUpdateOutcome`. `EdgeDeps.pluginUpdate` is typed by `PluginUpdateFn`
- `extensions/claude-marketplace/presentation/{reload-hint,soft-dep,marketplace-list,plugin-list}.ts` -- pure renderers. Handlers do NOT consume these directly -- orchestrators do. Phase 6 just passes through to orchestrators

### Phase 5 carry-forward (consumed by Phase 6)

- `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` -- D-01 (5-phase install ledger -- Phase 6's install handler does not see this; the orchestrator owns it), D-06 (orchestrator+presentation split for `list` -- Phase 6's `handlers/plugin/list.ts` wraps `orchestrators/plugin/list.ts`), D-08 (per-plugin data dir -- Phase 6 cache invalidation runs in the same post-state-commit window)
- `extensions/claude-marketplace/orchestrators/plugin/{install,uninstall,update,list,shared}.ts` -- Phase 6 plugin handlers wrap each. Cache-invalidation calls ADDED post-state-commit per D-03 corollary
- `extensions/claude-marketplace/orchestrators/plugin/index.ts` -- barrel; Phase 6 may import directly from per-verb files for clarity

### V1 reference (read selectively when implementing the same concern)

- `git show features/initial:extensions/claude-marketplace/index.ts` -- V1 entrypoint; the registration shape Phase 6's `register.ts` replicates inside `registerClaudePluginCommand` (slash command + `session_start` autocomplete wrapper)
- `git show features/initial:extensions/claude-marketplace/commands/router.ts` -- V1 router (`routeClaudePlugin` + `routeMarketplace`); Phase 6 ports verbatim with the new handler-shape signature
- `git show features/initial:extensions/claude-marketplace/args.ts` -- V1 tokenizer + `parseArgs`; Phase 6 ports verbatim to `edge/args.ts` (AP-1, AP-2, AP-4)
- `git show features/initial:extensions/claude-marketplace/commands/_args.ts` -- V1 `parseCommandArgs` schema validator; Phase 6 ports verbatim to `edge/args-schema.ts`
- `git show features/initial:extensions/claude-marketplace/completions.ts` -- V1 completions; Phase 6 ports the helper functions (`buildItem`, `splitCompletionInput`, `extractPositionals`, `getPluginRefCompletions`, `normalizeCompletionWhitespace`, `isClaudePluginCommandLine`) and the `getArgumentCompletions` dispatcher logic. The data-loading functions (`loadKnownMarketplaceNames`, `loadAvailablePluginNames`, `loadInstalledPluginNames`, `loadPluginToMarketplacesMap`) are REPLACED by the cache layer (D-03)
- `git show features/initial:extensions/claude-marketplace/commands/list-marketplaces.ts` -- V1 LLM tool registrations (`registerListMarketplacesTool`, `registerListPluginsTool`); Phase 6 ports verbatim to `edge/handlers/tools.ts` with the extended `claude_marketplace_plugin_list` parameter schema (D-02)
- `git show features/initial:extensions/claude-marketplace/commands/{install-plugin,uninstall-plugin,update,update-marketplace,marketplace-autoupdate,list,add-marketplace,remove-marketplace}.ts` -- V1 handler files; Phase 6 ports each as a thin shim per D-01 (handler signature changes from V1's monolithic to Phase 4/5 orchestrator delegation)

### Research foundation (already produced)

- `.planning/research/ARCHITECTURE.md` -- 9-folder layout (edge sits above orchestrators); pure-function handlers
- `.planning/research/PITFALLS.md` -- Pitfall 15 (notify discipline -- every Phase 6 message via `shared/notify.ts`); Pitfall 13 (completion data staleness -- D-03 cache TTL mitigates)
- `.planning/research/STACK.md` -- TypeBox 1.x for LLM tool parameter schemas; `write-file-atomic@^8` for cache files
- `.planning/research/SUMMARY.md` -- Phase 6 sits between Phase 5 (plugin orchestrators) and Phase 7 (Pi wiring)

### Library docs (planner should pull current versions)

- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionAPI.registerCommand`, `ExtensionAPI.registerTool`, `ExtensionCommandContext.ui.notify`, `ExtensionCommandContext.ui.addAutocompleteProvider`. Phase 6's `register.ts` consumes all four
- `@mariozechner/pi-tui` -- `AutocompleteItem` shape (`label`, `value`, `description?`). Phase 6's `getArgumentCompletions` returns `AutocompleteItem[]`
- `typebox` 1.1.38+ -- LLM tool parameter schemas (`Type.Object`, `Type.Optional`, `Type.Union`, `Type.Literal`, `Type.Boolean`)
- `node:fs/promises` -- consumed indirectly via `shared/atomic-json` for cache writes and via `loadMarketplaceManifest`/`loadState` for cache rebuilds
- `write-file-atomic` 8+ -- consumed indirectly via `shared/atomic-json.ts` for cache file writes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1-5 outputs)

- **`extensions/claude-marketplace/shared/notify.ts`** -- All Phase 6 user-visible messages: `notifyUsageError(ctx, usage)` for AP-3 Usage emission; `notifyError(ctx, msg, cause?)` for tokenizer/validation errors; `notifyWarning(ctx, msg)` for cache-invalidation failures (D-03 corollary)
- **`extensions/claude-marketplace/shared/atomic-json.ts`** -- `atomicWriteJson(path, value)` for cache file writes
- **`extensions/claude-marketplace/shared/path-safety.ts`** -- `assertPathInside(parent, child)` for cache path containment
- **`extensions/claude-marketplace/shared/markers.ts`** -- Phase 6 does NOT add new markers. Usage strings are plain consts in `edge/router.ts` (stable but not contract-bound -- they can drift without breaking the user contract)
- **`extensions/claude-marketplace/persistence/locations.ts`** -- Phase 6 ADDS `cacheDir(loc: ScopedLocations): string`, `marketplaceNamesCacheFile(loc: ScopedLocations): string`, `pluginCacheFile(loc: ScopedLocations, marketplace: string): string`. Each routes through `assertPathInside` against `<scopeRoot>/claude-marketplace/`
- **`extensions/claude-marketplace/persistence/state-io.ts`** -- `loadState(extensionRoot)`. Cache rebuild path; TC-9 propagation
- **`extensions/claude-marketplace/domain/manifest.ts`** -- `loadMarketplaceManifest(source, options)`. Cache rebuild path; TC-8 soft-fail
- **`extensions/claude-marketplace/domain/resolver.ts`** -- `resolveStrict(...)`. Used by cache build to compute plugin `status: "available" | "unavailable"`
- **`extensions/claude-marketplace/orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts`** -- Phase 6 handlers wrap each. Cache-invalidation calls ADDED at the end of each mutating orchestrator (post-state-commit) per D-03 corollary
- **`extensions/claude-marketplace/orchestrators/marketplace/shared.ts`** -- `GitOps`, `DEFAULT_GIT_OPS`; `EdgeDeps.gitOps` defaults here
- **`extensions/claude-marketplace/orchestrators/plugin/{install,uninstall,update,list}.ts`** -- Phase 6 handlers wrap each. Cache-invalidation calls ADDED to install/uninstall (update is a no-op for the current cache schema)
- **`extensions/claude-marketplace/orchestrators/types.ts`** -- `PluginUpdateFn`, `PluginUpdateOutcome`; `EdgeDeps.pluginUpdate` is typed by `PluginUpdateFn`
- **`extensions/claude-marketplace/presentation/{reload-hint,soft-dep,marketplace-list,plugin-list}.ts`** -- Phase 6 does NOT touch directly; orchestrators consume

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- All Phase 6 modules follow
- **Import boundaries** -- `edge/` may import from `orchestrators/`, `presentation/`, `shared/`. NOT from `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/`. Enforced by `import-x/no-restricted-paths` in `eslint.config.js`. D-03's `shared/completion-cache.ts` placement honors this -- `edge/` imports `shared/`, `orchestrators/` imports `shared/`, neither imports the other for the cache concern
- **TypeBox JIT compile at module load** -- LLM tool parameter schemas defined with TypeBox at top of `handlers/tools.ts`
- **`npm run check` pipeline** -- typecheck + ESLint + Prettier + `node --test "tests/**/*.test.ts"` must stay green per NFR-6
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts` MAY be used for Usage block stability (optional -- Usage text is not a hard user contract, but a snapshot guards against accidental drift)
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2 (.claude/ excluded; .planning/ excluded from large-file check). Avoid em-dashes in commit titles
- **`buildItem(argumentTextPrefix, itemText, appendSpace)` reconstruction** -- every completion's `value` field reconstructs the entire argumentText from the prefix tokens plus the chosen text; Pi-tui contract
- **`splitCompletionInput(input)` token boundary** -- trailing space means cursor is at a new empty token; no trailing space means the last token is the partial-under-cursor

### Integration Points

- **Phase 7 `index.ts` (slash command + tools wiring):** Phase 7 calls `registerClaudePluginCommand(pi, deps)` and `registerClaudeMarketplaceTools(pi)` from `edge/register.ts`. Phase 7 builds `deps: EdgeDeps` by importing `DEFAULT_GIT_OPS` from `orchestrators/marketplace/shared.ts` and `updateSinglePlugin` from `orchestrators/plugin/update.ts`. Phase 7 also handles `pi.on("resources_discover", ...)` -- NOT a Phase 6 concern
- **Phase 4/5 orchestrators (cache invalidation):** Phase 6 EXTENDS the post-state-commit window of every mutating orchestrator with one cache-invalidation call. These are additive -- the existing orchestrator tests stay green; new tests assert the invalidation call fires once per successful state commit. Cache-invalidation failure does NOT roll back the operation (D-03 corollary)
- **Tab completion provider lifecycle:** `pi.registerCommand` `getArgumentCompletions` is invoked synchronously-or-async per keystroke. `pi.on("session_start", ctx => ctx.ui.addAutocompleteProvider(...))` installs the fish-style whitespace normalization wrapper at session start; the wrapper is scoped to lines matching `isClaudePluginCommandLine` (TC-7)
- **LLM tool invocation:** `claude_marketplace_list` and `claude_marketplace_plugin_list` are invoked by the Pi LLM agent; they return `{ content: [{type: "text", text}], details: {...} }`. The agent sees the `text` field; the `details` field is for programmatic consumers (e.g., a future agent UI that renders structured data)
- **State recording:** Phase 6 does NOT directly mutate `state.json`. All state writes go through orchestrators. Cache files (`<scopeRoot>/claude-marketplace/cache/`) are derived state -- they can be rebuilt from `state.json` + `marketplace.json` at any time

</code_context>

<specifics>
## Specific Ideas

- **`edge/router.ts` test taxonomy** -- `tests/edge/router.test.ts` covers (a) AP-3 empty input → `TOP_LEVEL_USAGE` at `error` severity; (b) AP-3 unknown subcommand → `Unknown subcommand: "X"` + Usage at `error` severity; (c) each happy-path dispatch route (install/uninstall/update/list/marketplace + marketplace add/remove/rm/list/update/autoupdate/noautoupdate); (d) `marketplace` with empty rest → `MARKETPLACE_USAGE` at `error` severity; (e) `marketplace rm` aliases to `marketplace remove` (TC-2 surface; alias accepted but not surfaced in completions).
- **`edge/args.ts` test taxonomy** -- `tests/edge/args.test.ts` covers (a) AP-1 quote cases: bare string, single-quoted with spaces, double-quoted with spaces, mixed; (b) AP-2 `--scope user` and `--scope project` valid; (c) AP-2 `--scope` missing value throws `--scope requires a value: "user" or "project".`; (d) AP-2 `--scope foo` throws `Invalid --scope value: "foo".`; (e) AP-4 `--scope` at position 0 / middle / end all parse identically; (f) unicode + non-ASCII positionals tokenize correctly.
- **`edge/args-schema.ts` test taxonomy** -- `tests/edge/args-schema.test.ts` covers schema-driven positional validation: (a) required positional missing → `notifyError(usage)` called once with the schema's `usage` string + return undefined; (b) optional positional missing → returns parsed with that property `undefined`; (c) typed return shape (compile-time check via `@ts-expect-error` on mismatched access).
- **`edge/completions/provider.ts` test taxonomy** -- `tests/edge/completions/provider.test.ts` covers (a) TC-1 first positional → top-level keywords; (b) TC-2 after `marketplace` → nested keywords (rm NOT surfaced); (c) TC-3 `-` prefix → `--scope` + list-only flags; (d) TC-4 after `--scope` → `user` / `project`; (e) TC-5 `list <here>` and `marketplace <verb> <here>` → marketplace names; (f) TC-6 `install <here>` / `uninstall <here>` / `update <here>` → `<plugin>@<marketplace>` form with status filtering (D-03); (g) TC-7 trailing space on terminals + whitespace-normalizer round-trip; (h) TC-8 per-marketplace manifest error → soft-fail empty set; (i) TC-9 state.json error → throw propagates.
- **`shared/completion-cache.ts` test taxonomy** -- `tests/shared/completion-cache.test.ts` covers (a) marketplace-names: lazy load on first call, cache hit on second, file persistence across module re-imports; (b) plugin-index: lazy load, 10-min TTL re-read from file (mock clock); (c) invalidate-then-read rebuilds from authoritative source; (d) drop-then-read finds no file → rebuilds; (e) cache-write atomicity via mock `atomicWriteJson` spy; (f) cache file corruption → drop + rebuild; (g) schema mismatch → drop + rebuild; (h) TC-8 manifest soft-fail caches `{ plugins: [], _loadError: ... }`; (i) TC-9 state.json error propagates from `getMarketplaceNames` and `getPluginIndex`.
- **Cache invalidation propagation tests** -- Each mutating orchestrator's test suite gains a case asserting the cache invalidation call fires post-state-commit on success and is logged (not thrown) on failure. Specifically: `tests/orchestrators/marketplace/{add,remove,update}.test.ts` and `tests/orchestrators/plugin/{install,uninstall}.test.ts` each gain one "cache invalidated" assertion. `update.ts` (plugin) does NOT need cache invalidation in the current schema (status doesn't change).
- **LLM tool test taxonomy** -- `tests/edge/handlers/tools.test.ts` covers both tools: (a) `claude_marketplace_list` with empty state → "No marketplaces configured." + `details: { marketplaces: [] }`; (b) `claude_marketplace_list` populated → one line per marketplace with `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`; (c) `claude_marketplace_plugin_list` with `marketplace` set, marketplace exists → plugins from that marketplace; (d) marketplace doesn't exist → `Marketplace "<name>" not found.` + empty `details.plugins`; (e) `marketplace` omitted → enumerate across all marketplaces; (f) filters `installed: true` → only installed bucket; (g) `available: true, unavailable: true` → both buckets unioned; (h) no filters → all three buckets (PL-1 semantics).
- **`register.ts` integration test** -- `tests/edge/register.test.ts` builds a mock `pi: ExtensionAPI` and verifies (a) `registerClaudePluginCommand(pi, deps)` registers the `claude:plugin` command with a working handler + `getArgumentCompletions`; (b) `pi.on("session_start", ...)` is called once; (c) the session_start hook installs the autocomplete wrapper via `ctx.ui.addAutocompleteProvider`; (d) `registerClaudeMarketplaceTools(pi)` calls `pi.registerTool` exactly twice with the expected tool names.
- **TC-7 normalization fixture** -- `tests/edge/completions/normalize.test.ts` covers `normalizeCompletionWhitespace` with (a) trailing-space-before-text → collapse run to single; (b) no leading space → no-op; (c) end-of-line trailing space → no-op; (d) multiple runs → only the one at cursor collapsed.
- **`isClaudePluginCommandLine` regex** -- `tests/edge/completions/normalize.test.ts` asserts the regex matches `/claude:plugin`, `/claude:plugin install`, `/claude:plugin:42 install` (collision suffix), and does NOT match `/other-extension`, `claude:plugin` (no leading slash), `/claude:plugin-extra`.
- **Schema versioning sanity check** -- `tests/shared/completion-cache.test.ts` includes a snapshot test asserting the cache file schema's `schemaVersion === 1`. If a future change bumps to 2, this test fails and forces a conscious update.

</specifics>

<deferred>
## Deferred Ideas

- **`--force` install flag** -- PRD §11 deferral. Phase 6's D-03 corollary keeps `status: "unavailable"` plugins in install completions because a future `--force` will install their available components. The flag itself is post-V1.
- **Tokenizer escape support (`\"`, `\\`, `\n`)** -- V1's tokenizer carries forward without escapes. A future need (e.g., a path containing a literal quote) would add escape support to `edge/args.ts`. Not Phase 6.
- **Top-level `claude_plugin_list` LLM tool (cross-marketplace native form)** -- Subsumed by D-02's extension to `claude_marketplace_plugin_list` (which now supports omitted-marketplace + filter booleans). A future split into a dedicated `claude_plugin_list` tool with richer ergonomics is post-V1.
- **`claude_marketplace_info`, `claude_plugin_info` tools** -- PRD §11 deferral (info subcommand). LLM-tool analogue is post-V1.
- **mtime-based cache invalidation safety net** -- D-03 uses explicit invalidation + 10-min TTL for plugin index, no TTL for marketplace names. If concurrent-process changes become a real concern, add `stat()` mtime checks. Not Phase 6.
- **NFR-8 manifest-mtime caching layer** -- BACKLOG. D-03's completion cache is a DIFFERENT concern (it caches DERIVED plugin status, not raw manifest content). NFR-8 layer would sit between `loadMarketplaceManifest` and its callers, including the cache rebuild path. Independent.
- **i18n / locale negotiation for Usage strings + tool descriptions** -- IL-1 defers i18n to post-V1. Usage strings and tool descriptions stay English.
- **Rich interactive selectors in completions** -- PRD §11 deferral. No "Did you mean ...?" disambiguation in Phase 6.
- **Cache UI / inspection command** -- A future `/claude:plugin cache list` or `/claude:plugin cache invalidate` would be useful for diagnosing stale completions. Not Phase 6; users can manually delete `<scopeRoot>/claude-marketplace/cache/` (cache is optimization-only per D-03 corollary).
- **JSON output / dry-run modes** -- PRD §11 deferral. Edge handlers could emit `--json` output by serializing the orchestrator return shapes (which are already JSON-shaped); deferred until measured demand.
- **`claude_marketplace_plugin_list` returning structured `version` for available plugins** -- V1 currently returns `version` only for installed plugins (it's the install record's locked version). Available-plugin entries don't carry version in the current state shape. A future enhancement reads manifest declarations to surface the marketplace's offered version. Not Phase 6.
- **Telemetry on completion latency** -- IL-4 forbids telemetry V1. If perf becomes a concern, this is the layer where instrumentation lands.
- **`marketplace info <name>`** -- PRD §11 deferral.
- **Argument parser supporting `--scope=user` form (equals separator)** -- V1 only supports space-separated. PRD §6.6 AP-2 doesn't specify. Equals form is a future ergonomic add.

</deferred>

---

*Phase: 6-Edge Layer & Tab Completion*
*Context gathered: 2026-05-11*
