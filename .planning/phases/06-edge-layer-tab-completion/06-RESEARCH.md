# Phase 6: Edge Layer & Tab Completion - Research

**Researched:** 2026-05-11
**Domain:** Pi extension CLI surface (slash command routing, argument parsing, tab completion, LLM tools) + two-tier completion cache
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (Handler layout -- mirror orchestrators 1:1):** `edge/handlers/plugin/{install,uninstall,update,list}.ts` + `edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts` + `edge/handlers/tools.ts`. Each handler is a thin shim: (1) call `parseCommandArgs(args, schema, notifyError)`; (2) if undefined, early-return (Usage already emitted); (3) call the corresponding orchestrator with parsed positionals + `ctx` + `deps`. `marketplace.autoupdate` and `marketplace.noautoupdate` both route through `handlers/marketplace/autoupdate.ts` (one file, boolean parameter).

**D-01 corollary (Router stays in `edge/router.ts`, NOT inside `register.ts`):** `routeClaudePlugin(args, handlers, ctx)` and `routeMarketplace(args, handlers, ctx)` are pure functions of `(args, handlers, ctx)`. Testable without Pi. `register.ts` builds the `SubcommandHandlers` record from `EdgeDeps` and passes it to `routeClaudePlugin`. Router stays unaware of `pi.registerCommand` / `pi.registerTool`.

**D-02 (Two read-only LLM tools, with `pi_claude_marketplace_plugin_list` extended):**
- `pi_claude_marketplace_list` -- V1 verbatim. Parameters: `Type.Object({})`. Returns `[<scope>] <name> -- <N> plugin(s) -- <source.logical>` per line. `details: { marketplaces }`.
- `pi_claude_marketplace_plugin_list` -- V1 baseline + filter parameters: `Type.Object({ marketplace?: string, scope?: "user"|"project", installed?: boolean, available?: boolean, unavailable?: boolean })`. Omitting `marketplace` enumerates all marketplaces. No-filter = all three buckets. PL-1 union semantics when any filter is set. Status assignment: `installed` from state-record presence (D-09 schema has no `installed` boolean -- presence ≡ installed); `available` from manifest entry where resolver is installable and the plugin is not in state; `unavailable` from manifest entry where resolver returns not-installable.

**D-02 corollary (No mutating LLM tools):** Two tools above are the entire Phase 6 LLM surface. No `claude_install`, `claude_uninstall`, `claude_update`, `pi_claude_marketplace_add`.

**D-02 corollary (Registration in `edge/handlers/tools.ts`; called from `edge/register.ts`):** Tool definitions live in `handlers/tools.ts`. `register.ts` exports `registerClaudeMarketplaceTools(pi)` which calls both `pi.registerTool` invocations.

**D-03 (Two-tier file + in-memory cache; status-aware completion filtering):**
- File-backed layer:
  - `<scopeRoot>/pi-claude-marketplace/cache/marketplace-names.json` per scope. Schema: `{ schemaVersion: 1, names: string[] }`.
  - `<scopeRoot>/pi-claude-marketplace/cache/plugins/<marketplace>.json` per (scope, marketplace). Schema: `{ schemaVersion: 1, lastRefreshedAt: <iso>, manifestRef?: <sha-or-version>, plugins: [{ name, status: "installed" | "available" | "unavailable", version? }] }`.
- In-memory layer in `shared/completion-cache.ts`:
  - Marketplace-name index: lazy, no TTL, invalidated by `invalidateMarketplaceNames(scope)`.
  - Plugin index per (scope, marketplace): lazy, 10-min TTL safety net + explicit invalidation by `invalidateMarketplaceCache(scope, mp)` / `dropMarketplaceCache(scope, mp)`.
- Read API: `getMarketplaceNames(scope) -> Promise<string[]>`, `getPluginIndex(scope, marketplace) -> Promise<PluginIndexRow[]>`. Memory → file → rebuild from `loadState` + manifest read.
- Invalidation API used by orchestrators (post-state-commit, fire-and-warn-on-failure).
- Status-aware filtering for `getPluginRefCompletions(mode, ...)`:
  - `mode = "install"`: show only `status !== "installed"` (INCLUDES `unavailable` -- future `--force`).
  - `mode = "uninstall"`: only `status === "installed"`.
  - `mode = "update"`: only `status === "installed"`.

**D-03 corollary (Cache module location):** `shared/completion-cache.ts` lives in `shared/` because both `edge/` and `orchestrators/` may import from it. Cache module accepts paths as parameters (no `shared/ → persistence/` import); orchestrators and edge pass `locations.cacheDir`-derived paths.

**D-03 corollary (Rebuild semantics):** In-memory miss → file → rebuild from `loadState` + manifest. Rebuild writes atomically via `shared/atomic-json.atomicWriteJson`. TC-8 (manifest soft-fail): cache `{ plugins: [], _loadError: "<reason>" }`, return empty list to completion, no throw. TC-9 (state.json error): propagate -- `getMarketplaceNames` / `getPluginIndex` both throw.

**D-03 corollary (Cache is optimization, not authoritative):** Corrupt/missing cache → rebuild lazily. External tools may delete `<scopeRoot>/pi-claude-marketplace/cache/` safely. Schema mismatch → drop + rebuild.

**D-03 corollary (Invalidation call-sites in Phase 4/5 orchestrators):**
- `orchestrators/marketplace/add.ts` → `invalidateMarketplaceNames(scope)` + `invalidateMarketplaceCache(scope, name)`.
- `orchestrators/marketplace/remove.ts` → `invalidateMarketplaceNames(scope)` + `dropMarketplaceCache(scope, name)`.
- `orchestrators/marketplace/update.ts` → `invalidateMarketplaceCache(scope, name)`.
- `orchestrators/plugin/install.ts` → `invalidateMarketplaceCache(scope, marketplace)`.
- `orchestrators/plugin/uninstall.ts` → `invalidateMarketplaceCache(scope, marketplace)`.
- `orchestrators/plugin/update.ts` → **NO cache mutation** (status unchanged; version not in cache name surface).
- Failure mode: cache invalidation failure → `notify.warning` only; never roll back orchestrator's primary op.

**D-04 (Phase 6 ships `registerClaudePluginCommand(pi, deps)` + `registerClaudeMarketplaceTools(pi)`):** `edge/register.ts` exports both. The first registers the slash command and installs the `session_start` autocomplete wrapper for TC-7. Phase 7's `index.ts` becomes a few lines.

**D-04 (`EdgeDeps` lives in `edge/types.ts`):** `interface EdgeDeps { readonly gitOps: GitOps; readonly pluginUpdate: PluginUpdateFn; }`. Imports `GitOps` from `orchestrators/marketplace/shared.ts` (Phase 4 D-12), `PluginUpdateFn` from `orchestrators/types.ts` (Phase 4 D-05/D-06).

**D-04 corollary (Router and handlers stay pure):** No `pi.*` calls inside `routeClaudePlugin` or any `edge/handlers/<domain>/<verb>.ts`. Tests instantiate handlers with mocked `ctx` and call orchestrators (or stubs).

### Carry-Forward From V1 (Locked)
- **AP-1 tokenizer:** V1 `tokenize()` verbatim -- single `'…'` + double `"…"` quotes; NO escapes; NO nesting.
- **AP-2/AP-4 `--scope` validation:** `--scope user|project` only; any position; missing/invalid value throws clear error.
- **AP-3 Usage blocks:** V1 `TOP_LEVEL_USAGE` + `MARKETPLACE_USAGE` strings verbatim.
- **TC-7 normalization:** V1 `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` regex (`/^\/claude:plugin(?::\d+)?(?:\s|$)/`) verbatim, including `:\d+` collision-suffix tolerance.
- **`buildItem(argumentTextPrefix, itemText, appendSpace)` reconstruction pattern:** Every completion's `value` reconstructs the entire argumentText. Pi-tui contract.
- **TC-6 `<plugin>@<marketplace>` token completion:** V1 `getPluginRefCompletions` carries forward REFINED per D-03 to filter by status. `mode: "available" | "installed"` becomes `mode: "install" | "uninstall" | "update"`. `update` accepts bare `@<marketplace>` form.
- **LLM tool registration order:** Phase 7 calls `registerClaudePluginCommand` BEFORE `registerClaudeMarketplaceTools` (matches V1 `index.ts`).

### Claude's Discretion
- Cache schema versioning: single `schemaVersion: 1`; drop+rebuild on mismatch.
- Cache file naming: `<scopeRoot>/pi-claude-marketplace/cache/marketplace-names.json` + `<scopeRoot>/pi-claude-marketplace/cache/plugins/<marketplace>.json` (chosen to match Phase 5 D-08 `data/` sibling pattern).
- In-memory map keys: string keys `${scope}::${marketplace}` for plugin index, `${scope}` for marketplace names.
- Atomic-JSON for cache writes: `shared/atomic-json.atomicWriteJson` (Phase 1 D-03).
- Cross-marketplace plugin disambiguation: per-(marketplace, plugin) row in cache; consumer dedupes in `getPluginRefCompletions`.
- Single `edge/register.ts` (vs. two files); split later if a third helper emerges.

### Deferred Ideas (OUT OF SCOPE)
- `--force` install flag (PRD §11).
- Tokenizer escape support (`\"`, `\\`, `\n`).
- Top-level `claude_plugin_list` (subsumed by extended `pi_claude_marketplace_plugin_list`).
- `pi_claude_marketplace_info`, `claude_plugin_info` tools.
- mtime-based cache invalidation safety net.
- NFR-8 manifest-mtime caching layer (separate from D-03 completion cache).
- i18n / locale negotiation.
- Rich interactive selectors in completions.
- Cache inspection / invalidation slash command.
- JSON output / dry-run modes.
- `pi_claude_marketplace_plugin_list` returning `version` for available plugins.
- Telemetry on completion latency (IL-4).
- `marketplace info <name>`.
- `--scope=user` equals-separator form.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AP-1 | Tokenization honors single and double quotes for spaced arguments | V1 `tokenize()` in `args.ts` (carry forward; §V1 Source Extracts → args.ts) |
| AP-2 | `--scope` requires exactly `user` or `project`; missing/invalid raises clear error | V1 `parseArgs()` (carry forward; throw text quoted in V1 extract) |
| AP-3 | Subcommand routing surfaces `Usage:` block on empty/unknown input | V1 `routeClaudePlugin` / `routeMarketplace` + `TOP_LEVEL_USAGE` / `MARKETPLACE_USAGE` (carry forward) |
| AP-4 | `--scope` accepted at any position; positionals extracted in order | V1 `parseArgs` while-loop walks tokens, scope can appear anywhere |
| TC-1 | First positional after `/claude:plugin` surfaces `install / uninstall / update / list / marketplace` | V1 `TOP_LEVEL_SUBCOMMANDS` + completion dispatcher branch 1 |
| TC-2 | After `marketplace`, surfaces `add / remove / list / update / autoupdate / noautoupdate` (`rm` accepted but not surfaced) | V1 `MARKETPLACE_SUBCOMMANDS` (excludes `rm`) + completion branch 3; V1 router accepts `rm` as alias (branch 2b in router switch) |
| TC-3 | `-` prefix surfaces `--scope` plus list-specific flags; single and double dash behave identically | V1 completion branch 2b: `if (current.startsWith("-"))` |
| TC-4 | Token after `--scope` surfaces `user` and `project` only | V1 completion branch 2a: `if (prevToken === "--scope")` |
| TC-5 | `list <here>` and `marketplace <verb> <here>` complete with union of marketplace names from both scopes | V1 completion branch 5 + `getMarketplaceCompletions` |
| TC-6 | `install/uninstall/update <here>` emit `<plugin>@<marketplace>` tokens; `update` accepts `@<marketplace>` form | V1 `getPluginRefCompletions` (refined per D-03 to status-aware) |
| TC-7 | All terminal completions include trailing space; double-space collapse via fish-style normalization scoped to `/claude:plugin` | V1 `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` |
| TC-8 | Per-marketplace manifest-load failures during plugin completion soft-fail to empty set | D-03 corollary: cache row becomes `{ plugins: [], _loadError }`; completion returns empty list, no throw |
| TC-9 | Top-level `state.json` errors during completion propagate | D-03 corollary: `getMarketplaceNames` / `getPluginIndex` throw on `loadState` failure |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Node ≥22, TypeScript strict, ESM-only** (`"type": "module"`). `"engines": { "node": ">=22" }` in package.json.
- **`@mariozechner/pi-coding-agent`** peer dependency `>=0.70.6`; dev dependency pinned to `^0.73.1`.
- **typebox 1.x** dev/peer dependency (`^1.1.38` installed); JIT-compile at module load via `Compile()` from `typebox/compile`.
- **write-file-atomic@^8** for cache file writes (via `shared/atomic-json.ts`).
- **NFR-1:** All disk mutations atomic. Cache writes MUST use `atomicWriteJson`.
- **NFR-5 (network policy):** Completion paths MUST NOT touch network. Cache reads/rebuilds are pure local file I/O.
- **NFR-10 (containment):** All cache paths through `assertPathInside` against `<scopeRoot>/pi-claude-marketplace/`.
- **IL-2 (output channel):** Every user-visible message through `shared/notify.ts` wrappers. Direct `ctx.ui.notify` is forbidden everywhere except `shared/notify.ts` (`no-restricted-syntax` ESLint rule, BLOCK A in eslint.config.js).
- **IL-1 (English only V1):** No locale negotiation, no message catalog. Usage strings + tool descriptions stay English.
- **IL-3 (single sanctioned `console.warn`):** Only the load-time legacy migration save failure in `persistence/migrate.ts`. New Phase 6 code MAY NOT add `console.*` calls.
- **D-11 import boundaries (BLOCK C in eslint.config.js):** `edge/` may import from `orchestrators/`, `presentation/`, `shared/` only. NOT from `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/`. ALREADY in place -- see Pitfall section for the diff that may be needed.

## Summary

Phase 6 is a port-and-extend phase. The V1 source on `features/initial` already implements every AP-* and TC-* requirement; the work is (1) port V1 files into the 9-folder layout (`edge/` instead of root-level `commands/`/`completions.ts`/`args.ts`); (2) refactor V1's monolithic command handlers into thin shims that delegate to the Phase 4/5 orchestrators (signature changes -- orchestrators take `{ ctx, pi, scope, cwd, … }` opts bags); (3) replace V1's per-keystroke `loadState + loadMarketplaceManifest` reads with a new two-tier cache in `shared/completion-cache.ts`; (4) add one cache-invalidation call to each of 5 Phase 4/5 orchestrators (post-state-commit window). The Pi API surface used (`pi.registerCommand`, `pi.registerTool`, `pi.on("session_start", …)`, `ctx.ui.addAutocompleteProvider`) is unchanged from V1.

The single architectural decision that doesn't trivially carry forward is the cache module. V1 had no cache (it re-read state.json + every marketplace.json on every keystroke); D-03 introduces one. The cache module must live in `shared/` (because `edge/` cannot import from `persistence/` and `orchestrators/` cannot import from `edge/`), must accept paths as parameters (because `shared/` cannot import from `persistence/`), and must atomically rebuild from authoritative sources on miss while soft-failing per TC-8 and propagating per TC-9.

**Primary recommendation:** Treat Phase 6 as a port of V1 with three additive concerns -- (a) new shim layout per D-01; (b) new cache per D-03; (c) new LLM tool filters per D-02. Test coverage for the ports is the existing test patterns from Phase 5 (`withHermeticHome`, mock `ctx`/`pi`, in-memory state seeding). Test coverage for the cache is new in `tests/shared/completion-cache.test.ts` (clock injection for TTL, mock atomic-write spy, corruption fixtures). Test coverage for orchestrator invalidations is one new "cache invalidated" assertion per mutating orchestrator's existing test file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slash command dispatch (router) | edge | -- | Pure function; not orchestrator concern |
| Argument tokenization + `--scope` validation | edge | -- | Pure function; not orchestrator concern |
| Tab completion provider | edge | shared (cache reads) | Tab completion is a UI surface; cache reads cross from edge into shared |
| LLM tool registration + execute body | edge (handler) | orchestrators (delegate to listMarketplaces / listPlugins for parity; D-02 may inline or delegate -- see Open Questions) | LLM tools are read-only; the orchestrator's `listPlugins` already implements PL-1 union semantics |
| Cache read API (`getMarketplaceNames`, `getPluginIndex`) | shared | edge (consumer) | edge cannot import from persistence; shared/ is the only legal home |
| Cache write/invalidation API | shared | orchestrators (callers) | Orchestrators trigger invalidation post-state-commit |
| Cache rebuild from authoritative source | shared | -- | Reads `state.json` + `marketplace.json` via parameters passed by caller (no shared→persistence import) |
| Slash command + LLM tool registration on Pi | edge (`register.ts`) | Phase 7 `index.ts` (call site) | Phase 6 ships registration helpers; Phase 7 wires `index.ts` |
| Session-start autocomplete wrapper | edge (`register.ts`) | -- | `ctx.ui.addAutocompleteProvider` is a Pi UI primitive |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` | LLM tool parameter schemas, cache file schema validation | Carried forward from Phase 1 D-03; `ToolDefinition.parameters` is `TParams extends TSchema` (verified in `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`) |
| `@mariozechner/pi-coding-agent` | `^0.73.1` (peer `>=0.70.6`) | `ExtensionAPI`, `ExtensionCommandContext`, `ToolDefinition`, `AutocompleteItem` re-export | Required peer dep; carries every type Phase 6 consumes |

### Supporting (already shipped by Phase 1-5)
| Library | Purpose | Where |
|---------|---------|-------|
| `write-file-atomic@^8.0.0` | Cache file atomic writes | Via `shared/atomic-json.atomicWriteJson` (Phase 1 D-03) |
| `node:fs/promises` | Cache file reads, manifest reads, `lstat` for `pathExists` | Via `shared/fs-utils.pathExists` for cache-miss detection |
| `node:crypto` | Not used by Phase 6 -- cache schema versioning is a literal `1` | -- |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory `Map<string, Entry>` keyed by `${scope}::${marketplace}` | Two-level Map | Single string keys are simpler; no observable difference at this scale. Locked by D-03. |
| TypeBox JIT-compiled validator for cache file schemas | Inline runtime checks | TypeBox-compiled `.Check` is consistent with the state-io / manifest-validator pattern already in the codebase. RECOMMEND. |
| Inline LLM tool param schemas in `handlers/tools.ts` | Separate `handlers/tools-schemas.ts` | See Open Questions. |

## Architecture Patterns

### System Architecture Diagram

```text
Pi user types `/claude:plugin install foo@bar --scope user`
        │
        ▼  (Pi delivers args string + ExtensionCommandContext)
edge/register.ts:
   pi.registerCommand("claude:plugin", { handler, getArgumentCompletions })
        │
        ▼
edge/router.ts::routeClaudePlugin(args, handlers, ctx)
        │
        │── peel head token →
        │   ├─ "" → notifyUsageError(ctx, TOP_LEVEL_USAGE)
        │   ├─ unknown → notifyUsageError(ctx, `Unknown subcommand: "X"`, TOP_LEVEL_USAGE)
        │   ├─ "install" → handlers.install(rest, ctx)
        │   ├─ "uninstall" → handlers.uninstall(rest, ctx)
        │   ├─ "update" → handlers.update(rest, ctx)
        │   ├─ "list" → handlers.list(rest, ctx)
        │   └─ "marketplace" → routeMarketplace(rest, handlers, ctx)
        │                       └─ peel head token; "rm" → handlers.marketplaceRemove
        ▼
edge/handlers/plugin/install.ts (THIN SHIM)
   parsed = parseCommandArgs(args, INSTALL_SCHEMA, (msg) => notifyError(ctx, msg))
   if (parsed === undefined) return        // Usage already emitted
   await installPlugin({ ctx, pi: deps.pi, scope, cwd, marketplace, plugin })
        │
        ▼
orchestrators/plugin/install.ts::installPlugin
   ...withStateGuard...
   ↓ AFTER state commit, post-state-commit window:
   await invalidateMarketplaceCache(scope, marketplace)    ← NEW Phase 6 insertion
        │
        ▼
shared/completion-cache.ts::invalidateMarketplaceCache
   - drops in-memory entry
   - on next read, rebuild from loadState + manifest


Tab completion path (per keystroke):

Pi user types `/claude:plugin install fo<TAB>`
        │
        ▼  Pi calls getArgumentCompletions("install fo")
edge/completions/provider.ts::getArgumentCompletions(prefix)
   tokens, current = splitCompletionInput(prefix)   // tokens=["install"], current="fo"
   argumentTextPrefix = tokens.join(" ")            // "install"
   dispatch by (head, tokens.length, current):
   ├─ head="install", tokens.length=1, current has no "-" prefix →
   │   getPluginRefCompletions("install", current, argumentTextPrefix, { allowMarketplaceOnly: false })
        │
        ▼
edge/completions/data.ts::getPluginToMarketplacesMap("install", filter)
   ├─ for each scope: getMarketplaceNames(scope)
   ├─ for each (scope, mp): getPluginIndex(scope, mp)
   ├─ filter rows by status (install → status !== "installed")
   └─ build Map<pluginName, marketplaceNames[]>
        │
        ▼
shared/completion-cache.ts::getMarketplaceNames / getPluginIndex
   memory → file → rebuild
   TC-8: manifest soft-fail → cache `{plugins:[], _loadError}` → return []
   TC-9: state.json error → throw

Session-start autocomplete wrapper (TC-7):

Pi fires "session_start" event
        │
        ▼
edge/register.ts (callback set up by registerClaudePluginCommand)
   ctx.ui.addAutocompleteProvider((current) => ({
     getSuggestions: ..., shouldTriggerFileCompletion: ...,
     applyCompletion: (lines, line, col, item, prefix) => {
       result = current.applyCompletion(...)
       if (!isClaudePluginCommandLine(lines[line])) return result
       return normalizeCompletionWhitespace(result)
     }
   }))
```

### Recommended Project Structure
```
extensions/pi-claude-marketplace/
├── edge/
│   ├── README.md                         # already exists; Phase 6 updates Planned Contents
│   ├── index.ts                          # already exists; remains placeholder until barrel needed
│   ├── router.ts                         # NEW: routeClaudePlugin + routeMarketplace + USAGE consts
│   ├── args.ts                           # NEW: V1 args.ts ported verbatim (AP-1, AP-2, AP-4)
│   ├── args-schema.ts                    # NEW: V1 _args.ts ported (parseCommandArgs)
│   ├── types.ts                          # NEW: EdgeDeps interface + SubcommandHandlers type
│   ├── register.ts                       # NEW: registerClaudePluginCommand + registerClaudeMarketplaceTools
│   ├── completions/
│   │   ├── provider.ts                   # NEW: getArgumentCompletions dispatcher
│   │   ├── data.ts                       # NEW: read-through accessors via completion-cache
│   │   └── normalize.ts                  # NEW: normalizeCompletionWhitespace + isClaudePluginCommandLine
│   └── handlers/
│       ├── plugin/
│       │   ├── install.ts                # NEW: thin shim → orchestrators/plugin/install
│       │   ├── uninstall.ts              # NEW: thin shim → orchestrators/plugin/uninstall
│       │   ├── update.ts                 # NEW: thin shim → orchestrators/plugin/update
│       │   └── list.ts                   # NEW: thin shim → orchestrators/plugin/list
│       ├── marketplace/
│       │   ├── add.ts                    # NEW: thin shim → orchestrators/marketplace/add
│       │   ├── remove.ts                 # NEW: thin shim → orchestrators/marketplace/remove
│       │   ├── list.ts                   # NEW: thin shim → orchestrators/marketplace/list
│       │   ├── update.ts                 # NEW: thin shim → orchestrators/marketplace/update (single + bare)
│       │   └── autoupdate.ts             # NEW: thin shim → orchestrators/marketplace/autoupdate (both verbs)
│       └── tools.ts                      # NEW: registerListMarketplacesTool + registerListPluginsTool
├── shared/
│   ├── completion-cache.ts               # NEW: two-tier cache (file + in-memory)
│   └── (existing files unchanged)
├── persistence/
│   ├── locations.ts                      # MODIFY: add cacheDir(loc), marketplaceNamesCacheFile(loc),
│   │                                     #   pluginCacheFile(loc, marketplace)
│   └── (other files unchanged)
└── orchestrators/
    ├── marketplace/
    │   ├── add.ts                        # MODIFY: +1 invalidate call (post-state-commit)
    │   ├── remove.ts                     # MODIFY: +1 invalidate call (post-state-commit)
    │   ├── update.ts                     # MODIFY: +1 invalidate call (post-state-commit)
    │   └── (autoupdate.ts, list.ts unchanged)
    └── plugin/
        ├── install.ts                    # MODIFY: +1 invalidate call (post-state-commit)
        ├── uninstall.ts                  # MODIFY: +1 invalidate call (post-state-commit)
        └── (update.ts, list.ts unchanged per D-03 corollary)

tests/
├── edge/
│   ├── router.test.ts                    # NEW
│   ├── args.test.ts                      # NEW
│   ├── args-schema.test.ts               # NEW
│   ├── register.test.ts                  # NEW
│   ├── completions/
│   │   ├── provider.test.ts              # NEW
│   │   ├── data.test.ts                  # NEW
│   │   └── normalize.test.ts             # NEW
│   └── handlers/
│       ├── plugin/
│       │   ├── install.test.ts           # NEW (shim test)
│       │   ├── uninstall.test.ts         # NEW
│       │   ├── update.test.ts            # NEW
│       │   └── list.test.ts              # NEW
│       ├── marketplace/
│       │   ├── add.test.ts               # NEW
│       │   ├── remove.test.ts            # NEW
│       │   ├── list.test.ts              # NEW
│       │   ├── update.test.ts            # NEW
│       │   └── autoupdate.test.ts        # NEW (covers both verbs)
│       └── tools.test.ts                 # NEW (LLM tool execute bodies)
├── shared/
│   └── completion-cache.test.ts          # NEW
└── orchestrators/
    ├── marketplace/{add,remove,update}.test.ts   # MODIFY: +1 "cache invalidated" assertion
    └── plugin/{install,uninstall}.test.ts         # MODIFY: +1 "cache invalidated" assertion
```

### Pattern 1: Thin shim handler delegating to orchestrator

**What:** Each `edge/handlers/<domain>/<verb>.ts` is a 20-50 line function: parse args via `parseCommandArgs`; early-return on undefined; instantiate orchestrator opts bag; call orchestrator.

**When to use:** All 9 subcommand handlers in `edge/handlers/{plugin,marketplace}/`.

**Example shape (planner's reference):**
```typescript
// edge/handlers/plugin/install.ts
import { installPlugin } from "../../../orchestrators/plugin/install.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { notifyError } from "../../../shared/notify.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

const USAGE = "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project]";

export function makeInstallHandler(pi: ExtensionAPI) {
  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      { positional: [{ name: "ref" }] as const, usage: USAGE },
      (msg) => notifyError(ctx, msg),
    );
    if (parsed === undefined) return;

    const atIdx = parsed.ref.indexOf("@");
    if (atIdx === -1 || atIdx === 0 || atIdx === parsed.ref.length - 1) {
      notifyError(ctx, `Invalid plugin ref "${parsed.ref}". Use <plugin>@<marketplace>.\n\n${USAGE}`);
      return;
    }
    const plugin = parsed.ref.slice(0, atIdx);
    const marketplace = parsed.ref.slice(atIdx + 1);
    const scope = parsed.scope ?? "user";   // SC-5 default (Phase 1 / PRD §6.2)

    await installPlugin({
      ctx, pi, scope, cwd: ctx.cwd, marketplace, plugin,
    });
  };
}
```

The `pi` parameter is required because `installPlugin` takes `pi: ExtensionAPI` (Phase 5 contract; see `orchestrators/plugin/install.ts` line 89). Same pattern for `uninstall`, `update`, `marketplace/remove`, `marketplace/update`.

### Pattern 2: Two-tier completion cache

**What:** `shared/completion-cache.ts` exposes read API for `edge/`, invalidation API for `orchestrators/`. In-memory `Map` on top of atomic JSON files. Rebuild on miss/TTL/corruption.

**When to use:** Every tab completion read of marketplace names or plugin index goes through the cache; every mutating orchestrator's post-state-commit path calls one of the three invalidation functions.

**Cache module signature shape (planner's reference):**
```typescript
// shared/completion-cache.ts -- public surface only

export interface PluginIndexRow {
  readonly name: string;
  readonly status: "installed" | "available" | "unavailable";
  readonly version?: string;
}

// Read API (called from edge/completions/data.ts):
export async function getMarketplaceNames(
  marketplaceNamesCachePath: string,    // <scopeRoot>/pi-claude-marketplace/cache/marketplace-names.json
  scope: Scope,
  rebuild: () => Promise<string[]>,     // injected: invokes loadState
): Promise<string[]>;

export async function getPluginIndex(
  pluginCachePath: string,              // <scopeRoot>/.../cache/plugins/<marketplace>.json
  scope: Scope,
  marketplace: string,
  rebuild: () => Promise<PluginIndexRow[]>,  // injected: invokes loadState + manifest + resolveStrict
): Promise<readonly PluginIndexRow[]>;

// Invalidation API (called from orchestrators post-state-commit):
export function invalidateMarketplaceNames(scope: Scope): void;
export function invalidateMarketplaceCache(scope: Scope, marketplace: string): void;
export async function dropMarketplaceCache(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
): Promise<void>;
```

(Exact signature shape is the planner's call; the above is one viable shape -- `dropMarketplaceCache` needs the file path because it removes the cache file too, while the two `invalidate*` are memory-only.)

### Pattern 3: Pi `registerCommand` + `session_start` registration

**What:** `edge/register.ts::registerClaudePluginCommand(pi, deps)` performs three calls in sequence: (1) `pi.registerCommand("claude:plugin", { description, handler, getArgumentCompletions })`; (2) `pi.on("session_start", (event, ctx) => { ctx.ui.addAutocompleteProvider(provider) })`. The `handler` closes over the `SubcommandHandlers` record built from `deps`; the `getArgumentCompletions` closes over the cache read APIs from `shared/completion-cache.ts`.

**When to use:** Once per process load, via Phase 7's `index.ts`.

**Pi API contract (verified verbatim in `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`):**

```typescript
// types.d.ts line 781-816 -- verified extracts:

export interface RegisteredCommand {
  name: string;
  sourceInfo: SourceInfo;
  description?: string;
  getArgumentCompletions?: (argumentPrefix: string) =>
    AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>;
  handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

export interface ExtensionAPI {
  on(event: "resources_discover", handler: ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>): void;
  on(event: "session_start", handler: ExtensionHandler<SessionStartEvent>): void;
  // ...
  registerTool<TParams extends TSchema = TSchema, TDetails = unknown, TState = any>(
    tool: ToolDefinition<TParams, TDetails, TState>
  ): void;
  registerCommand(name: string, options: Omit<RegisteredCommand, "name" | "sourceInfo">): void;
  // ...
  getAllTools(): ToolInfo[];
}

export type ExtensionHandler<E, R = undefined> =
  (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;

export interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown, TState = any> {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: TParams;
  // ...
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
    ctx: ExtensionContext,
  ): Promise<AgentToolResult<TDetails>>;
}

// ExtensionUIContext (subset of ExtensionContext.ui):
notify(message: string, type?: "info" | "warning" | "error"): void;
addAutocompleteProvider(factory: AutocompleteProviderFactory): void;
// where:
export type AutocompleteProviderFactory =
  (current: AutocompleteProvider) => AutocompleteProvider;

// AutocompleteItem (re-exported from @mariozechner/pi-tui, verified in
// node_modules/@mariozechner/pi-tui/dist/autocomplete.d.ts):
export interface AutocompleteItem {
  value: string;
  label: string;
  description?: string;
}

export interface AutocompleteProvider {
  getSuggestions(lines: string[], cursorLine: number, cursorCol: number, options: {
    signal: AbortSignal; force?: boolean;
  }): Promise<AutocompleteSuggestions | null>;
  applyCompletion(lines: string[], cursorLine: number, cursorCol: number,
                  item: AutocompleteItem, prefix: string):
    { lines: string[]; cursorLine: number; cursorCol: number };
  shouldTriggerFileCompletion?(lines: string[], cursorLine: number, cursorCol: number): boolean;
}
```

**Critical:** `registerCommand`'s `getArgumentCompletions` returns `AutocompleteItem[] | null | Promise<...>`. The V1 dispatcher returns `null` when no completion makes sense (e.g., past the last positional). The new code should do the same -- `null` is the "no suggestions" sentinel, NOT `[]`.

### Anti-Patterns to Avoid
- **Calling `pi.*` inside the router or any handler:** Router and handlers must be pure functions of their parameters. Only `register.ts` knows about `pi.*`. Locked by D-04 corollary.
- **Direct `ctx.ui.notify` in any edge file:** ESLint BLOCK A `no-restricted-syntax` rule blocks this. Always go through `shared/notify.ts` wrappers (`notifyError`, `notifyWarning`, `notifySuccess`, `notifyUsageError`).
- **Importing from `domain/`/`persistence/`/`transaction/`/`bridges/`/`platform/` in `edge/`:** ESLint BLOCK C `import-x/no-restricted-paths` blocks this. If a `domain/`-defined type is needed in `edge/`, it must be re-exported from `shared/` (already done for `Scope` in `shared/types.ts`).
- **Hard-coding `cwd: process.cwd()` in handlers:** Use `ctx.cwd` (Pitfall 11 in `.planning/research/PITFALLS.md` and Pi's `ExtensionContext.cwd`). V1's `completions.ts` reads `process.cwd()` directly; the new cache reads `ctx.cwd` indirectly via the `locations.cacheDir`-derived paths the caller passes.
- **Caching `pi.getAllTools()` across commands:** `.planning/research/ARCHITECTURE.md` Anti-Pattern 2. Probe at call time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic JSON write (cache files) | Hand-rolled `writeFile(tmp) + rename(tmp, dest)` | `shared/atomic-json.atomicWriteJson` | Phase 1 D-03 standard; goes through `write-file-atomic@^8` with fsync + concurrent queue |
| Path containment for cache files | `path.resolve + startsWith` | `shared/path-safety.assertPathInside` | Symlink-aware (Pitfall 10); D-14..17 |
| Tokenizer | Hand-rolled state machine | V1 `tokenize()` ported verbatim | AP-1 carry-forward locked |
| Argument parser with `--scope` | Custom while loop | V1 `parseArgs()` ported verbatim | AP-2/AP-4 carry-forward locked |
| Schema-driven positional validation | Hand-rolled lookups | V1 `parseCommandArgs` ported verbatim | Existing typed `{name, required?}[]` shape -- battle-tested |
| Usage block strings | Per-handler text | V1 `TOP_LEVEL_USAGE` / `MARKETPLACE_USAGE` (multiline string consts in `router.ts`) | AP-3 carry-forward locked; Phase 1 D-08 places markers in `markers.ts`, but D-08 explicitly says Usage strings are NOT markers (they're stable but not contract-bound) |
| Completion-position dispatcher | Custom | V1 `getArgumentCompletions` dispatch ported into `edge/completions/provider.ts` with cache-backed data accessors | Existing structure is correct; refinement is only the cache layer |
| LLM tool registration boilerplate | Custom | V1 `registerListMarketplacesTool` / `registerListPluginsTool` ported with extended parameters | D-02 only adds filter booleans to the existing schema |
| Whitespace normalization | Custom | V1 `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` ported verbatim | TC-7 carry-forward locked, regex includes `:\d+` collision tolerance |
| `AutocompleteItem` shape | Custom interface | Import from `@mariozechner/pi-coding-agent` (re-exports pi-tui) | Type is `{ value: string; label: string; description?: string }` |

**Key insight:** Phase 6 is overwhelmingly a port-from-V1 phase. The discretionary surface is small (cache module structure + invalidation insertion points + LLM tool param schema layout). The architectural decisions are locked; the implementation is mostly mechanical translation.

## V1 Source Extracts (Line-Anchored)

Read each block with `git show features/initial:<path>`. Phase 6 should port verbatim except where annotations call out a refinement.

### `extensions/pi-claude-marketplace/args.ts` (V1)

**Whole file ports verbatim to `edge/args.ts`** -- only the import path for `Scope` changes (V1: `./types.ts`; new: `../shared/types.ts`).

```typescript
// V1 args.ts -- ports verbatim modulo import path
export interface ParsedArgs {
  positional: string[];
  scope?: Scope;
}

export function parseArgs(args: string): ParsedArgs {
  const tokens = tokenize(args);
  const positional: string[] = [];
  let scope: Scope | undefined;
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) { i++; continue; }
    if (token === "--scope") {
      i++;
      const val = tokens[i];
      if (val === "user" || val === "project") scope = val;
      else if (val === undefined) throw new Error(`--scope requires a value: "user" or "project".`);
      else throw new Error(`Invalid --scope value: "${val}". Must be "user" or "project".`);
    } else { positional.push(token); }
    i++;
  }
  if (scope !== undefined) return { positional, scope };
  return { positional };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false, inDouble = false;
  for (const ch of input) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) { tokens.push(current); current = ""; }
    } else { current += ch; }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}
```

Note: AP-2 throws -- caller (`parseCommandArgs`) catches and routes through `notifyError`.

### `extensions/pi-claude-marketplace/commands/_args.ts` (V1)

**Whole file ports verbatim to `edge/args-schema.ts`** -- imports change (`../args.ts → ./args.ts`, `../errors.ts → ../shared/errors.ts`, `../types.ts → ../shared/types.ts`).

The signature is:
```typescript
export function parseCommandArgs<const Spec extends readonly PositionalSpec[]>(
  args: string,
  schema: { positional: Spec; usage: string },
  notifyError: (message: string) => void,
): ParsedCommandArgs<Spec> | undefined;
```

Returns `undefined` on tokenizer throw or missing-required-positional; emits via the injected `notifyError` callback. Returned object has typed positional properties + `scope?: Scope`.

### `extensions/pi-claude-marketplace/commands/router.ts` (V1)

**Whole file ports verbatim to `edge/router.ts`** -- only the `SubcommandHandlers` type's import of `ExtensionCommandContext` is unchanged. The `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` consts are part of the user contract (AP-3) and copy verbatim.

Two important behaviors:
- `peelToken(args)` returns `[head, rest]`. V1 uses this for both `routeClaudePlugin` and `routeMarketplace`.
- `routeMarketplace` accepts `case "remove": case "rm":` -- TC-2 says `rm` is accepted but NOT surfaced in completions; the router fall-through carries that contract.
- On unknown subcommand, V1 calls `ctx.ui.notify(...)` directly. **Phase 6 port must route through `notifyUsageError(ctx, …)`** (BLOCK A ESLint rule). Use the form: `notifyUsageError(ctx, `Unknown subcommand: "${head}".`, TOP_LEVEL_USAGE)` -- this puts the message on line 1, blank line, then Usage. Matches V1 string structure modulo the blank line being explicit.

### `extensions/pi-claude-marketplace/completions.ts` (V1)

The 318-line V1 file decomposes into three Phase 6 files:

- **`edge/completions/provider.ts`** (the `getArgumentCompletions` dispatcher) -- the giant `getArgumentCompletions: async (prefix) => { … }` block in V1 `index.ts` (NOT in V1 `completions.ts`); see the next section.
- **`edge/completions/data.ts`** -- replaces V1's `loadKnownMarketplaceNames`, `loadInstalledPluginNames`, `loadAvailablePluginNames`, `loadPluginToMarketplacesMap` with cache-backed accessors. V1's `buildItem`, `splitCompletionInput`, `extractPositionals` are pure functions that port verbatim and could live in `edge/completions/provider.ts` or `data.ts`; planner picks. V1's `getMarketplaceCompletions`, `getPluginCompletions`, `getPluginRefCompletions`, `getScopeCompletions` are also pure (they take an already-loaded name list); they fit naturally in `provider.ts` as private helpers OR `data.ts`.
- **`edge/completions/normalize.ts`** -- V1's `normalizeCompletionWhitespace` + `isClaudePluginCommandLine` + `CLAUDE_PLUGIN_LINE` regex, verbatim.

**The most load-bearing V1 helpers (port verbatim):**

```typescript
// V1 buildItem (Pi-tui contract -- every completion value reconstructs
// the entire argumentText: already-typed prefix + chosen text + optional space):
function buildItem(argumentTextPrefix: string, itemText: string, appendSpace: boolean): AutocompleteItem {
  const head = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";
  const tail = appendSpace ? " " : "";
  return { label: itemText, value: head + itemText + tail };
}

// V1 splitCompletionInput:
function splitCompletionInput(input: string): { tokens: string[]; current: string } {
  if (input === "") return { tokens: [], current: "" };
  const trailingSpace = /\s$/.test(input);
  const allTokens = input.split(/\s+/).filter((t) => t !== "");
  if (trailingSpace) return { tokens: allTokens, current: "" };
  const current = allTokens[allTokens.length - 1] ?? "";
  return { tokens: allTokens.slice(0, -1), current };
}

// V1 extractPositionals (skips `--scope <value>` pairs to recover positionals):
function extractPositionals(tokens: readonly string[]): string[] {
  const positionals: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "--scope") { i += 2; continue; }
    if (t !== undefined) positionals.push(t);
    i++;
  }
  return positionals;
}

// V1 getPluginRefCompletions (the largest helper -- handles `<plugin>@<marketplace>` shape):
// Two parameters change for D-03 refinement:
//   - mode was "available" | "installed"; becomes "install" | "uninstall" | "update"
//   - data source becomes `getPluginIndex` (status-aware) instead of separate
//     installed/available data paths
//
// The structural logic stays the same:
//   - currentPrefix has no "@"  -> complete plugin half; unique plugin -> "name@mp" with space,
//     multi-marketplace -> "name@" without space (user picks next)
//   - currentPrefix is "@…"     -> complete marketplace only; gated by allowMarketplaceOnly
//                                  (true for "update", false for install/uninstall)
//   - currentPrefix is "name@…" -> complete marketplaces that carry "name"
//
// IMPORTANT: TC-6 + D-03 corollary: install mode INCLUDES status==="unavailable"
//            (future --force flag will install them). uninstall/update mode is
//            status==="installed" only.

// V1 normalizeCompletionWhitespace (TC-7 fish-style collapse):
function normalizeCompletionWhitespace(result: {
  readonly lines: readonly string[]; readonly cursorLine: number; readonly cursorCol: number;
}): { lines: string[]; cursorLine: number; cursorCol: number } {
  const lines = [...result.lines];
  const line = lines[result.cursorLine] ?? "";
  if (line[result.cursorCol - 1] !== " " || line[result.cursorCol] !== " ") {
    return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
  }
  let n = 1;
  while (line[result.cursorCol + n] === " ") n++;
  lines[result.cursorLine] = line.slice(0, result.cursorCol) + line.slice(result.cursorCol + n);
  return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
}

// V1 isClaudePluginCommandLine:
const CLAUDE_PLUGIN_LINE = /^\/claude:plugin(?::\d+)?(?:\s|$)/;
function isClaudePluginCommandLine(line: string): boolean {
  return CLAUDE_PLUGIN_LINE.test(line);
}
```

### `extensions/pi-claude-marketplace/index.ts` (V1 -- dispatcher logic)

The V1 dispatcher inside `pi.registerCommand("claude:plugin", { getArgumentCompletions: async (prefix) => { … } })` is THE port target for `edge/completions/provider.ts::getArgumentCompletions`. Structure:

```typescript
// edge/completions/provider.ts -- port of V1 index.ts dispatcher
export async function getArgumentCompletions(
  prefix: string,
  ctx: { cwd: string },  // explicit cwd parameter -- never read process.cwd() (Pitfall 11)
): Promise<AutocompleteItem[] | null> {
  const { current, tokens } = splitCompletionInput(prefix);
  const argumentTextPrefix = tokens.join(" ");

  // Branch 1: top-level subcommand keyword.
  if (tokens.length === 0) {
    return TOP_LEVEL_SUBCOMMANDS
      .filter((s) => s.startsWith(current))
      .map((label) => ({ label, value: label + " " }));
  }

  const head = tokens[0];
  const headPrefix = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";

  // Branch 2a: token after `--scope` → user / project.
  const prevToken = tokens[tokens.length - 1];
  if (prevToken === "--scope") {
    return ["user", "project"]
      .filter((v) => v.startsWith(current))
      .map((v) => ({ label: v, value: `${headPrefix}${v} ` }));
  }

  // Branch 2b: flag name completion (`-` or `--` prefix).
  if (current.startsWith("-")) {
    const flags: { name: string; description?: string }[] = [
      { name: "--scope", description: "Scope: user or project" },
    ];
    if (head === "list") {
      flags.push(
        { name: "--installed", description: "Show installed plugins" },
        { name: "--available", description: "Show available plugins" },
        { name: "--unavailable", description: "Show unavailable plugins" },
      );
    }
    return flags
      .filter((f) => f.name.startsWith(current))
      .map((f) => ({
        label: f.name,
        value: `${headPrefix}${f.name} `,
        ...(f.description !== undefined ? { description: f.description } : {}),
      }));
  }

  // Branch 3: nested marketplace subcommand keyword.
  if (head === "marketplace" && tokens.length === 1) {
    return MARKETPLACE_SUBCOMMANDS  // does NOT include "rm" (TC-2)
      .filter((s) => s.startsWith(current))
      .map((label) => ({ label, value: `marketplace ${label} ` }));
  }

  // Branch 4: <plugin>@<marketplace> for install / uninstall / update (TC-6, D-03 refined).
  if (head === "install" && tokens.length === 1) {
    return getPluginRefCompletions("install", current, argumentTextPrefix, ctx,
      { allowMarketplaceOnly: false });
  }
  if (head === "uninstall" && tokens.length === 1) {
    return getPluginRefCompletions("uninstall", current, argumentTextPrefix, ctx,
      { allowMarketplaceOnly: false });
  }
  if (head === "update" && tokens.length === 1) {
    return getPluginRefCompletions("update", current, argumentTextPrefix, ctx,
      { allowMarketplaceOnly: true });
  }

  // Branch 5: marketplace-name positional for `list <here>` and `marketplace <verb> <here>`.
  const wantsMarketplaceName =
    (head === "list" && tokens.length === 1) ||
    (head === "marketplace" && tokens.length === 2 && tokens[1] !== undefined &&
     ["remove", "rm", "update", "autoupdate", "noautoupdate"].includes(tokens[1]));
  if (wantsMarketplaceName) {
    return getMarketplaceCompletions(
      await getMarketplaceNamesAcrossScopes(ctx.cwd),
      current, argumentTextPrefix,
    );
  }

  return null;  // no completion makes sense at this position
}
```

Branches 4 and 5 source data via `edge/completions/data.ts` which goes through `shared/completion-cache.ts` (the only structural change from V1 -- V1 read `loadState` + `loadMarketplaceManifest` per keystroke).

**TOP_LEVEL_SUBCOMMANDS = `["install", "uninstall", "update", "list", "marketplace"]`** (V1 verbatim).
**MARKETPLACE_SUBCOMMANDS = `["add", "remove", "list", "update", "autoupdate", "noautoupdate"]`** (V1 verbatim -- `rm` excluded by design).

### V1 LLM tools -- `extensions/pi-claude-marketplace/commands/list-marketplaces.ts`

The full V1 file ports to `edge/handlers/tools.ts` with two changes:

1. **`pi_claude_marketplace_list` parameters unchanged** -- `Type.Object({})`. Body queries `loadState` for both scopes and renders one line per marketplace as `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`. In the new state schema, `mp.plugins` is a `Record<string, PluginInstallRecord>`; the count is `Object.keys(mp.plugins).length` (different from V1's `mp.plugins.filter(p => p.installed).length` -- V1 had a separate `installed: bool` field which no longer exists).

2. **`pi_claude_marketplace_plugin_list` parameters extended per D-02:**
   ```typescript
   parameters: Type.Object({
     marketplace: Type.Optional(Type.String({ description: "Marketplace name to list plugins for" })),
     scope: Type.Optional(Type.Union(
       [Type.Literal("user"), Type.Literal("project")],
       { description: "Scope to look in" },
     )),
     installed: Type.Optional(Type.Boolean({ description: "Include installed plugins" })),
     available: Type.Optional(Type.Boolean({ description: "Include available plugins" })),
     unavailable: Type.Optional(Type.Boolean({ description: "Include uninstallable plugins" })),
   }),
   ```
   PL-1 union: `(installed ?? false) || (available ?? false) || (unavailable ?? false)` is the filter-set flag; when false, show all three buckets; when true, show union of selected.

**Status semantics:** State schema has no `installed: boolean` field on `PluginInstallRecord` (verified -- `state-io.ts::PLUGIN_INSTALL_RECORD_SCHEMA` lines 38-56 shows: `version`, `resolvedSource`, `compatibility`, `resources`, `installedAt`, `updatedAt`). Per Phase 2 D-09, **presence of the record in `mp.plugins[<name>]` ≡ installed**. The V1 tool's `if (!plugin.installed) continue;` becomes `for each plugin in mp.plugins -> installed`. For `available` / `unavailable`, the tool reads the marketplace manifest (`mp.manifestPath` → `readFile + JSON.parse + MARKETPLACE_VALIDATOR.Check`) and for each manifest entry NOT in `mp.plugins`, runs `resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot })` to bucket. **This is exactly what `orchestrators/plugin/list.ts` already does** (verified at `orchestrators/plugin/list.ts` lines 95-225) -- so the LLM tool can either reuse `listPlugins` semantics or replicate the loop. See Open Questions.

**Tool execute signature (from `types.d.ts` line 353):**
```typescript
execute(
  toolCallId: string,
  params: Static<TParams>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<TDetails>>;
```

Return shape is `AgentToolResult<TDetails> = { content: (TextContent | ImageContent)[], details?: TDetails, isError?: boolean }`. V1 returns `{ content: [{ type: "text", text }], details: {...} }`.

## Pi API Exact Contract (verified)

All signatures verified verbatim from `/Users/acolomba/src/pi-claude-marketplace/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` (cross-referenced in §Architecture Patterns Pattern 3 above):

| API | Signature | Used By |
|-----|-----------|---------|
| `pi.registerCommand` | `(name: string, options: Omit<RegisteredCommand, "name" \| "sourceInfo">) => void` | `edge/register.ts` |
| `RegisteredCommand.handler` | `(args: string, ctx: ExtensionCommandContext) => Promise<void>` | `edge/router.ts::routeClaudePlugin` |
| `RegisteredCommand.getArgumentCompletions` | `(argumentPrefix: string) => AutocompleteItem[] \| null \| Promise<AutocompleteItem[] \| null>` | `edge/completions/provider.ts` |
| `pi.registerTool` | `<TParams extends TSchema, TDetails, TState>(tool: ToolDefinition<TParams, TDetails, TState>) => void` | `edge/register.ts` → `edge/handlers/tools.ts` |
| `pi.on("session_start", handler)` | `(event: "session_start", handler: ExtensionHandler<SessionStartEvent>) => void` where `ExtensionHandler<E> = (event: E, ctx: ExtensionContext) => Promise<void \| undefined> \| void \| undefined` | `edge/register.ts` -- TC-7 autocomplete wrapper installation |
| `pi.getAllTools` | `() => ToolInfo[]` where `ToolInfo = Pick<ToolDefinition, "name" \| "description" \| "parameters"> & { sourceInfo: SourceInfo }` | NOT used by Phase 6 directly -- soft-dep probes call this in `presentation/soft-dep.ts`, which is consumed by orchestrators, not edge |
| `ctx.ui.notify` | `(message: string, type?: "info" \| "warning" \| "error") => void` | Indirect via `shared/notify.ts` |
| `ctx.ui.addAutocompleteProvider` | `(factory: AutocompleteProviderFactory) => void` where `AutocompleteProviderFactory = (current: AutocompleteProvider) => AutocompleteProvider` | `edge/register.ts` -- TC-7 wrapper |
| `ctx.cwd` | `string` (read-only) | Every handler (avoid `process.cwd()` per Pitfall 11) |
| `AutocompleteItem` | `{ value: string; label: string; description?: string }` (verified in `/Users/acolomba/src/pi-claude-marketplace/node_modules/@mariozechner/pi-tui/dist/autocomplete.d.ts`) | Every completion's return shape |
| `AutocompleteProvider` | `{ getSuggestions(...), applyCompletion(...), shouldTriggerFileCompletion?(...) }` | TC-7 wrapper |

**`SessionStartEvent` shape** (from `types.d.ts` line 382):
```typescript
export interface SessionStartEvent {
  type: "session_start";
  reason: "startup" | "reload" | "new" | "resume" | "fork";
  previousSessionFile?: string;
}
```

The TC-7 wrapper is installed inside the `session_start` handler each time -- meaning the wrapper installs once per session start. (V1 has this behavior; if a session restarts mid-process the wrapper is re-installed. Pi-tui's `addAutocompleteProvider` stacks, so a sloppy plan that calls it on every event could leak providers. The handler should be idempotent OR the planner can confirm Pi-tui handles re-installation cleanly. V1 just calls it unconditionally in `session_start` -- it's the pattern of record. SEE Open Questions.)

## Cache-Invalidation Insertion-Point Map

For each of the 5 mutating orchestrators that need a Phase 6 invalidation call, the exact line where the call belongs is **after `withStateGuard(...)` resolves successfully** and **before any user-visible notification fires**. This is the "post-state-commit window" -- same boundary as Phase 5 D-08's per-plugin `pluginDataDir` mkdir.

Failure of the invalidation call must be caught and routed through `notifyWarning` (not re-thrown); state is already committed, the user's operation succeeded, and the cache will rebuild on next read anyway.

**`orchestrators/marketplace/add.ts`:**
- Current state: `withStateGuard` closes at line 108. Line 110 is the defensive check, line 116 is `notifySuccess(...)`. **Insert invalidation between line 113 (after the defensive check) and line 116** (before `notifySuccess`).
- Call: `invalidateMarketplaceNames(locations.scope)` + `invalidateMarketplaceCache(locations.scope, recordedName)`. **NOTE:** Per D-03 corollary "new marketplace; build the cache eagerly" -- the corollary says to invalidate, not eagerly rebuild. The eager build happens lazily on next completion read. Invalidation suffices.

**`orchestrators/marketplace/remove.ts`:**
- Current state: `withStateGuard` closes at line 130 (the matching `});` of `await withStateGuard(locations, async (state) => { … });` that opens at line 96). Post-state cleanup (data-dir rm-rf) starts at line 132 ("POST-STATE cleanup (MR-5/MR-6/MR-7)"). The leak aggregation `notifyWarning` is line 203; the success path's `notifySuccess` is line 248.
- **Insert invalidation between line 130 (after guard closes) and line 132 (before data-dir cleanup begins).** This places invalidation in the same post-state-commit window as the existing data-dir rm-rf and leak aggregation.
- Call: `invalidateMarketplaceNames(opts.scope ?? resolved.scope)` + `dropMarketplaceCache(...)` -- `dropMarketplaceCache` because the marketplace is gone, so its plugin cache file must be deleted (D-03 corollary).

**`orchestrators/marketplace/update.ts`:**
- Function structure: `refreshOneMarketplace(args)` contains `await withStateGuard(locations, async (state) => { … })` opening at line 202 and closing at line 250. The cascade-outside-guard begins around line 256 (per the comment at line 254 "CASCADE OUTSIDE the outer guard").
- **Insert invalidation between line 250 (after `withStateGuard` resolves) and line 256 (before cascade begins).** This places invalidation immediately after state commits.
- Call: `invalidateMarketplaceCache(scope, name)`.

**`orchestrators/plugin/install.ts`:**
- `withStateGuard` opens at line 227, closes at line 555 (`});` of the async closure). Post-state-commit `pluginDataDir` mkdir runs around line 581 (the comment at line 575 reads `// POST-state-commit (AS-6 / D-08): eager per-plugin data dir mkdir.`).
- **Insert invalidation between line 555 (after guard closes) and line 575 (before pluginDataDir mkdir, which is the FIRST post-state-commit step). Alternatively place it AFTER the mkdir at line 587 -- order does not matter; both are post-state-commit.**
- Recommended placement: immediately AFTER the mkdir try/catch (~line 587). Rationale: that placement matches the most-similar precedent (post-state-commit eager-action chain). The planner picks.
- Call: `invalidateMarketplaceCache(scope, marketplace)`.

**`orchestrators/plugin/uninstall.ts`:**
- `withStateGuard` opens at line 100, closes at line 137. Post-state-commit `rm -rf` of `pluginDataDir` begins around line 159 (the comment at line 156 reads `// POST-state-commit per PU-2 / D-08: drop the per-plugin data dir`).
- **Insert invalidation between line 137 (after guard) and line 159 (before pluginDataDir rm).** Or after the rm (~line 165). Both are post-state-commit.
- Call: `invalidateMarketplaceCache(scope, marketplace)`.

**`orchestrators/plugin/update.ts`:**
- **NO invalidation needed** (D-03 corollary explicit). The plugin's status is unchanged by an update (still `installed`). Version is not in the cache name surface. If the cache schema later adds a `version` field, this orchestrator gains a corresponding call.

**General failure handling pattern (planner reference):**
```typescript
// After withStateGuard returns successfully, in the post-state-commit window:
try {
  invalidateMarketplaceCache(scope, marketplace);
} catch (err) {
  notifyWarning(ctx, `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

The `invalidate*` functions are MEMORY-ONLY (no I/O), so they cannot throw under normal operation. But `dropMarketplaceCache` (used by `marketplace remove`) does I/O (unlinks the cache file); that's the failure surface to guard.

## Cache File Path Scheme (compose check)

Decision: cache files live at:
- `<scopeRoot>/pi-claude-marketplace/cache/marketplace-names.json` -- one per scope
- `<scopeRoot>/pi-claude-marketplace/cache/plugins/<marketplace>.json` -- one per (scope, marketplace)

**Containment check:** `<scopeRoot>/pi-claude-marketplace/` is the `extensionRoot` (verified in `persistence/locations.ts` lines 95). The cache directory and all cache files are below `extensionRoot`. Path composition via `path.join` plus `assertPathInside(extensionRoot, candidate, "cacheFile(...)")` is the same pattern used by `pluginDataDir`, `marketplaceDataDir`, `sourceCloneDir` in `locations.ts` lines 110-155.

**Marketplace name validation:** The `<marketplace>` segment of the plugin cache path is potentially attacker-influenced (it comes from manifest `.name` originally; `assertSafeName` already runs at marketplace-add time and at every dataDir/cloneDir call). The planner should mirror the existing `pluginDataDir` pattern:
```typescript
async pluginCacheFile(loc: ScopedLocations, marketplace: string): Promise<string> {
  assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
  const candidate = path.join(cacheDirOf(loc), "plugins", `${marketplace}.json`);
  await assertPathInside(cacheDirOf(loc), candidate, `pluginCacheFile(${marketplace})`);
  return candidate;
}
```

The proposed three new helpers fit `persistence/locations.ts` cleanly. Existing helpers at lines 110-152 establish the pattern. The cacheDir is constructed as `path.join(extensionRoot, "cache")` from hard-coded suffix only -- like `dataRoot`, `sourcesDir`, `agentsStagingDir`. `marketplaceNamesCacheFile` is `path.join(cacheDir, "marketplace-names.json")` -- fully hardcoded, no safeName needed. Only `pluginCacheFile` takes a name input and must validate.

**Phase 6 must add three exported helpers in `persistence/locations.ts`:**
```typescript
// In ScopedLocations interface:
readonly cacheDir: string;                                       // <extensionRoot>/cache/
readonly marketplaceNamesCacheFile: string;                      // <cacheDir>/marketplace-names.json
pluginCacheFile(marketplace: string): Promise<string>;           // <cacheDir>/plugins/<marketplace>.json

// In locationsFor body:
const cacheDir = path.join(extensionRoot, "cache");
const marketplaceNamesCacheFile = path.join(cacheDir, "marketplace-names.json");
// ... and pluginCacheFile method (assertSafeName + path.join + assertPathInside).
```

The choice between (a) "make these methods on `ScopedLocations`" vs. (b) "make them free functions in `persistence/locations.ts`" is Claude's discretion per CONTEXT.md "D-03 cache file naming"; the method pattern matches the existing `pluginDataDir`/`marketplaceDataDir`/`sourceCloneDir` precedent.

## Test Scaffolding Pattern (Phase 5)

The Phase 5 test scaffolding pattern is in `tests/orchestrators/plugin/install.test.ts` and replicated across `uninstall.test.ts`, `update.test.ts`, `list.test.ts`. Phase 6's tests can lift this verbatim.

**Available helpers in `tests/helpers/`:**
- `tests/helpers/git-mock.ts` -- `makeMockGitOps(initial?)` returns `{ gitOps, state }`. `state` records call logs (`cloneCalls`, `fetchCalls`, `forceUpdateRefCalls`, `checkoutCalls`, `resolveRefCalls`, `currentBranchCalls`) and lets tests stub throws (`cloneThrows`, `fetchThrows`, `checkoutThrows`) and copy fixture trees on clone (`fixtureSourceDir`). USED ONLY BY MARKETPLACE TESTS -- Phase 6 handler tests for `marketplace add/update` may want this.
- `tests/helpers/prd-extract.ts` -- `extractEs5MarkerLiterals(prd: string)` parses backticked literals from PRD §6.12 ES-5 row. Useful if planner adds a snapshot test for Usage block stability.

**Per-test-file scaffolding (in install.test.ts; LIFT VERBATIM):**

```typescript
// Hermetic HOME isolation (so tests don't pollute user's real ~/.pi).
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "install-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    await rm(hermeticHome, { recursive: true, force: true });
  }
}

// Mock ctx + pi:
interface NotifyRecord { message: string; severity?: string; }

function makeCtx(piOverrides?: { getAllTools?: () => unknown[] }): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: piOverrides?.getAllTools ?? ((): unknown[] => []),
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}
```

The Phase 5 tests also seed plugin fixtures on disk via `seedPluginOnDisk(pluginRoot, options)` and `seedGithubMarketplace(...)`-style helpers -- but those are inlined per-test, NOT in `tests/helpers/`. The planner may extract any of them as Phase 6 helpers if reuse warrants.

**Clock/time injection for TTL test:** Currently NO helper exists. The 10-min TTL test in `tests/shared/completion-cache.test.ts` needs to inject a clock. Recommended: `node:test`'s `t.mock.timers` (stable since Node 23) -- verify Node floor; if CI is on Node 22.x, use a manual `now()` function parameter on `getPluginIndex` instead. **The planner should add this**: either bump Node CI to ≥23 OR inject `now: () => Date.now()` as an optional cache module parameter for testability.

**Notify capture pattern for "cache invalidation logged, not thrown":**

```typescript
// In orchestrators/<verb>.test.ts, force the cache's drop to throw:
await dropMarketplaceCache(injectedFailingPath, ...);
// Assert: notifications contains exactly one warning that names the cache path.
assert.ok(notifications.some(n => n.severity === "warning" && n.message.includes("cache")));
```

The new completion-cache module should accept a path injection seam so tests can force `unlink` ENOENT (cache file absent) vs. EACCES (failing permission) vs. successful drop. The cleanest seam: cache module's `dropMarketplaceCache` accepts the path; tests pass a path that points at a read-only directory to force EACCES.

## ESLint `import-x` Current Rules (BLOCK C)

Verified in `/Users/acolomba/src/pi-claude-marketplace/eslint.config.js`:

```javascript
// BLOCK C: import-x/no-restricted-paths
{
  target: "./extensions/pi-claude-marketplace/edge",
  from: [
    "./extensions/pi-claude-marketplace/bridges",
    "./extensions/pi-claude-marketplace/domain",
    "./extensions/pi-claude-marketplace/transaction",
    "./extensions/pi-claude-marketplace/persistence",
    "./extensions/pi-claude-marketplace/platform",
  ],
  message: "edge/ may only import from orchestrators/, presentation/, shared/.",
}
```

**Phase 6 requires NO DIFF here.** The rule already forbids `edge/ → bridges/, domain/, transaction/, persistence/, platform/` and allows `edge/ → orchestrators/, presentation/, shared/`. Phase 6's plan files just need to honor this.

Cross-check: `shared/` rule says `shared/ MUST NOT import from any extension folder. Pure leaves only.` This means `shared/completion-cache.ts` CANNOT import from `persistence/locations.ts`, `domain/manifest.ts`, or `persistence/state-io.ts` -- it must accept all paths and read functions as parameters. The architecture honors this: `shared/completion-cache.ts` exposes `getMarketplaceNames(path, scope, rebuild)` where `rebuild` is injected by the caller (edge or orchestrator).

**Output discipline (BLOCK A, also already in place):** Direct `process.stdout.write`, `process.stderr.write`, `console.*` calls and direct `ctx.ui.notify` are blocked across `extensions/pi-claude-marketplace/**/*.ts`. The single per-file override (`shared/notify.ts`) is the sanctioned chokepoint. **Phase 6 plan files MUST route every user-visible message through one of `notifySuccess`/`notifyWarning`/`notifyError`/`notifyUsageError`** -- same as Phases 4 and 5. ROADMAP SC5 explicitly says "ESLint blocks any new `process.stdout`/`stderr` write in `src/edge/`" -- this is already covered by BLOCK A applied to `extensions/pi-claude-marketplace/**`.

## TypeBox Patterns for LLM Tool Parameter Schemas

Pattern verified across Phase 1-5 codebase:

1. **JIT-compile at module load** (Phase 2 D-07): the codebase compiles validators once per module:
   ```typescript
   import Type from "typebox";
   import { Compile } from "typebox/compile";

   export const MARKETPLACE_SCHEMA = Type.Object({ ... });
   export const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);
   ```
   (Verified in `domain/manifest.ts` lines 11-37 and `persistence/state-io.ts` lines 33-79.)

2. **LLM tool parameter schemas do NOT need pre-compilation** -- Pi's `ToolDefinition.parameters: TParams extends TSchema` expects the SCHEMA, not the validator. Pi does its own validation. So the parameters expression can be the raw `Type.Object({...})` -- no `Compile()` call needed for the tool's own parameters block.

   This is shown by V1: V1 inlines the schema directly in the `parameters:` field of `pi.registerTool({...})`. Phase 6 ports verbatim.

3. **Schema for filter parameters of `pi_claude_marketplace_plugin_list`:**
   ```typescript
   parameters: Type.Object({
     marketplace: Type.Optional(Type.String({ description: "Marketplace name to list plugins for" })),
     scope: Type.Optional(Type.Union(
       [Type.Literal("user"), Type.Literal("project")],
       { description: "Scope to look in" },
     )),
     installed: Type.Optional(Type.Boolean({ description: "Include installed plugins" })),
     available: Type.Optional(Type.Boolean({ description: "Include available plugins" })),
     unavailable: Type.Optional(Type.Boolean({ description: "Include uninstallable plugins" })),
   }),
   ```
   The `Type.Static<typeof PARAMS>` (which `execute(params)` receives) infers to:
   `{ marketplace?: string; scope?: "user" | "project"; installed?: boolean; available?: boolean; unavailable?: boolean }`.

4. **Schema for empty parameters of `pi_claude_marketplace_list`:**
   ```typescript
   parameters: Type.Object({}),
   ```
   Identical to V1.

5. **Cache file schemas** (planner choice; planner may keep them as `Type.Object({...})` + `Compile(...)` for the read-path validation, mirroring `STATE_SCHEMA` / `MARKETPLACE_SCHEMA` precedent). Suggested:
   ```typescript
   // shared/completion-cache.ts
   const MARKETPLACE_NAMES_CACHE_SCHEMA = Type.Object({
     schemaVersion: Type.Literal(1),
     names: Type.Array(Type.String()),
   });
   const PLUGIN_INDEX_CACHE_SCHEMA = Type.Object({
     schemaVersion: Type.Literal(1),
     lastRefreshedAt: Type.String(),
     manifestRef: Type.Optional(Type.String()),
     plugins: Type.Array(Type.Object({
       name: Type.String(),
       status: Type.Union([
         Type.Literal("installed"),
         Type.Literal("available"),
         Type.Literal("unavailable"),
       ]),
       version: Type.Optional(Type.String()),
     })),
     _loadError: Type.Optional(Type.String()),  // TC-8 soft-fail marker
   });
   const MARKETPLACE_NAMES_VALIDATOR = Compile(MARKETPLACE_NAMES_CACHE_SCHEMA);
   const PLUGIN_INDEX_VALIDATOR = Compile(PLUGIN_INDEX_CACHE_SCHEMA);
   ```

   On schema mismatch (`.Check === false`): treat as corrupt, drop + rebuild. Same pattern as state.json on schema validation failure.

## Common Pitfalls

### Pitfall 1: Completion staleness (PITFALLS.md Pitfall 13 / Performance Trap "Building completion lists by full-walk on every keystroke")

**What goes wrong:** V1's `getArgumentCompletions` re-reads `state.json` + every marketplace's `marketplace.json` per keystroke. At 5+ marketplaces this introduces noticeable tab-completion lag.

**Why it happens:** No caching layer. Each keystroke fires `getArgumentCompletions(prefix)` independently.

**How to avoid:** D-03's two-tier cache. In-memory hit is `~O(1)`; file hit is one `readFile` per cache file; rebuild is the only slow path and is gated by explicit invalidation + 10-min TTL.

**Warning signs:**
- Tab-completion lag user reports
- Test runs that exercise hundreds of keystrokes in a single session -- sanity-check perf

### Pitfall 2: Notify discipline drift (PITFALLS.md Pitfall 15)

**What goes wrong:** "Just for debugging" `console.log` or `process.stdout.write` calls survive into production code.

**Why it happens:** Single-channel discipline (IL-2) is enforced by ESLint BLOCK A -- already in place. The trap is adding `console.log` for "temporary" instrumentation.

**How to avoid:**
- Phase 6 plan files MUST route every user-visible message through `notify*` wrappers.
- Test infrastructure asserts notify capture, not stdout -- this means `console.log` would NOT be caught by tests (they assert what `ctx.ui.notify` receives). The ESLint rule is the only catcher.
- `npm run check` (which runs ESLint with `--max-warnings 0` semantics under typed-strict) blocks merge of any console call.

**Warning signs:**
- Any PR diff that adds `console.` calls
- Tests that pass but produce mysterious extra output lines

### Pitfall 3: cwd drift in completion paths (PITFALLS.md Pitfall 11 "Cwd-lock at command entry")

**What goes wrong:** V1 reads `process.cwd()` inside `getArgumentCompletions` (verified: V1 `completions.ts` line 99 `const cwd = process.cwd();`). If Pi chdirs mid-session (or different shells share an extension load), project-scope completion targets the wrong directory.

**How to avoid:** Phase 6's `getArgumentCompletions(prefix, ctx)` MUST receive `ctx` (or `ctx.cwd`) explicitly. Pi delivers `ExtensionCommandContext` to the command handler, and that handler closes `getArgumentCompletions` over the same `ctx.cwd`. **NOTE:** Pi's `getArgumentCompletions` callback signature is `(argumentPrefix: string) => ...` -- it does NOT receive `ctx`. The planner must pass `ctx.cwd` via closure (capture at command registration time) OR re-read `process.cwd()` (V1 behavior). Recommended: closure capture, but observe that V1 used `process.cwd()` and shipped that way for years -- this is a successor improvement, not a regression fix.

**Concrete pattern (planner reference):**
```typescript
// edge/register.ts (inside registerClaudePluginCommand):
pi.registerCommand("claude:plugin", {
  description: "...",
  handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
  // NOTE: getArgumentCompletions does NOT receive ctx; we have no
  // session-scoped cwd capture point here. Two choices:
  //   (a) read process.cwd() inside provider.ts (V1 behavior)
  //   (b) install via session_start so we capture ctx.cwd
  // V1 chose (a); D-04 corollary "router and handlers stay pure" is
  // satisfied either way. RECOMMEND (a) for V1 parity.
  getArgumentCompletions: (prefix) => getArgumentCompletions(prefix, { cwd: process.cwd() }),
});
```

This is the one place `process.cwd()` is acceptable in Phase 6 code (registration glue layer; not a handler).

### Pitfall 4: Autocomplete provider lifecycle (NEW for this layer)

**What goes wrong:** `ctx.ui.addAutocompleteProvider(factory)` STACKS providers. If `session_start` fires repeatedly (Pi's `reason: "startup" | "reload" | "new" | "resume" | "fork"`) and the handler is non-idempotent, multiple wrappers stack and `applyCompletion` is normalized 2x, 3x, etc.

**How to avoid:**
- V1 just calls `ctx.ui.addAutocompleteProvider(...)` unconditionally on every `session_start` (verified in V1 `index.ts` lines 169-189). This is the V1 behavior of record.
- If Pi-tui's `addAutocompleteProvider` overwrites instead of stacking, no concern. **The d.ts comment on the factory says "Stack additional autocomplete behavior on top of the built-in provider"** (line 136 of types.d.ts) -- confirming it does STACK.
- The double-normalize behavior on a stacked wrapper is `normalizeCompletionWhitespace(normalizeCompletionWhitespace(x)) === normalizeCompletionWhitespace(x)` -- the function is idempotent (it only collapses if a doubled-space is detected). So stacking is harmless for THIS wrapper. The behavior is V1-equivalent.

**Recommendation:** Port V1 verbatim. Stacking is benign for the normalize wrapper. Test verifies idempotence.

### Pitfall 5: Difference between `getArgumentCompletions` return-style and `addAutocompleteProvider` factory style

**What goes wrong:** Confusion about which surface to use.

**Explanation:**
- `registerCommand.getArgumentCompletions` is invoked PER keystroke (per the d.ts contract -- Pi calls it inside the autocomplete loop) and returns `AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>`. This is the API surface for Phase 6's primary completion logic.
- `ctx.ui.addAutocompleteProvider(factory)` installs a wrapper around Pi-tui's full autocomplete pipeline (including non-slash-command completion like file paths). It exposes `getSuggestions`, `applyCompletion`, `shouldTriggerFileCompletion`. Phase 6 uses it ONLY for the TC-7 whitespace normalization (a post-processing hook on `applyCompletion`).

The two surfaces are layered: Pi-tui first calls `getArgumentCompletions` for slash commands to get items, then `applyCompletion` to insert the chosen item. The TC-7 wrapper interposes on `applyCompletion` to collapse the double-space. No data-flow path from Pi runs the wrapper for `getSuggestions` of `/claude:plugin` (because the slash-command suggestions come from `getArgumentCompletions` directly, NOT from `getSuggestions`).

**Test taxonomy implication:** Tests for TC-1..TC-6 exercise `getArgumentCompletions`. Tests for TC-7 exercise `normalizeCompletionWhitespace` directly and (optionally) the wrapper's installation via `pi.on("session_start", ...)` in `tests/edge/register.test.ts`.

### Pitfall 6: Schema mismatch on cache file (NEW)

**What goes wrong:** A user upgrades from one Phase 6 version to a later schema-bumped version (`schemaVersion: 2`). Old cache files on disk fail validation.

**How to avoid:** D-03 corollary explicit: drop + rebuild on schema mismatch. No migration code. The cache is optimization-only.

**Implementation:**
```typescript
// In shared/completion-cache.ts read path:
try {
  const raw = await readFile(cachePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!CACHE_VALIDATOR.Check(parsed)) {
    // Drop + rebuild (silent -- completion path should not throw on cache corruption).
    return await rebuild();
  }
  return parsed;
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") return await rebuild();
  // Other I/O errors are also recoverable via rebuild. State.json errors propagate via the rebuild() throw.
  return await rebuild();
}
```

## Validation Architecture

> `workflow.nyquist_validation` is enabled (absent key in `.planning/config.json` treats as enabled; verified -- no config.json overrides found).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in to Node ≥22) |
| Config file | None -- `node --test "tests/**/*.test.ts"` |
| Quick run command | `node --test "tests/edge/**/*.test.ts" "tests/shared/completion-cache.test.ts"` |
| Full suite command | `npm test` (== `node --test "tests/**/*.test.ts"`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AP-1 | Tokenizer handles single/double quotes, no escapes | unit | `node --test tests/edge/args.test.ts` | ❌ Wave 0 |
| AP-2 | `--scope` validation: invalid value throws | unit | `node --test tests/edge/args.test.ts` | ❌ Wave 0 |
| AP-3 | Router emits Usage on empty/unknown subcommand | unit | `node --test tests/edge/router.test.ts` | ❌ Wave 0 |
| AP-4 | `--scope` accepted at any position | unit | `node --test tests/edge/args.test.ts` | ❌ Wave 0 |
| TC-1 | First positional → top-level keywords | unit | `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-2 | After `marketplace` → nested keywords (`rm` accepted but not surfaced) | unit | `node --test tests/edge/completions/provider.test.ts` + `node --test tests/edge/router.test.ts` (for `rm` routing) | ❌ Wave 0 |
| TC-3 | `-`/`--` prefix → flags | unit | `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-4 | After `--scope` → `user`/`project` | unit | `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-5 | `list <here>` / `marketplace <verb> <here>` → marketplace names from cache | integration (uses cache + state) | `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-6 | `install/uninstall/update <here>` → status-aware `<plugin>@<marketplace>` | integration | `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-7 | Fish-style whitespace normalization scoped to `/claude:plugin` | unit | `node --test tests/edge/completions/normalize.test.ts` | ❌ Wave 0 |
| TC-8 | Manifest soft-fail per-marketplace → empty list, no throw | integration | `node --test tests/shared/completion-cache.test.ts` + `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| TC-9 | state.json error propagates | integration | `node --test tests/shared/completion-cache.test.ts` + `node --test tests/edge/completions/provider.test.ts` | ❌ Wave 0 |
| D-02 LLM tools | Two tools registered with extended params; PL-1 union semantics | unit | `node --test tests/edge/handlers/tools.test.ts` | ❌ Wave 0 |
| D-03 invalidation | Each mutating orchestrator's existing test gains one "cache invalidated" assertion | integration | `node --test tests/orchestrators/marketplace/{add,remove,update}.test.ts tests/orchestrators/plugin/{install,uninstall}.test.ts` | ✓ files exist; MODIFY |
| D-03 cache TTL | 10-min TTL re-reads file on plugin index | unit | `node --test tests/shared/completion-cache.test.ts` (with clock injection) | ❌ Wave 0 |
| D-04 register | `registerClaudePluginCommand` + `registerClaudeMarketplaceTools` wire up correctly | unit | `node --test tests/edge/register.test.ts` (mock `pi`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/edge/**/*.test.ts tests/shared/completion-cache.test.ts` -- typically <5 seconds.
- **Per wave merge:** `npm test` -- runs the full suite (currently ~592 tests; Phase 6 adds ~80-120 tests).
- **Phase gate:** Full `npm run check` green (typecheck + lint + format:check + test).

### Wave 0 Gaps

All Phase 6 test files are NEW. The planner's Wave 0 (test scaffolding) MUST create:
- [ ] `tests/edge/args.test.ts` -- covers AP-1, AP-2, AP-4
- [ ] `tests/edge/args-schema.test.ts` -- covers schema-driven validation
- [ ] `tests/edge/router.test.ts` -- covers AP-3 + dispatch routing (including `rm` alias)
- [ ] `tests/edge/completions/provider.test.ts` -- covers TC-1..6
- [ ] `tests/edge/completions/normalize.test.ts` -- covers TC-7
- [ ] `tests/shared/completion-cache.test.ts` -- covers cache primitives + TC-8, TC-9
- [ ] `tests/edge/handlers/plugin/{install,uninstall,update,list}.test.ts` -- covers shim parse + delegate
- [ ] `tests/edge/handlers/marketplace/{add,remove,list,update,autoupdate}.test.ts` -- covers shim parse + delegate
- [ ] `tests/edge/handlers/tools.test.ts` -- covers LLM tool execute bodies + filter logic
- [ ] `tests/edge/register.test.ts` -- covers Pi `registerCommand`/`registerTool`/`on(session_start)` integration with a mock `pi`

No new framework install needed -- `node:test` is already used.

**Clock injection seam for TTL test:** Either (a) bump CI Node to ≥23 to use `t.mock.timers` OR (b) inject `now: () => number` as a cache module parameter. **RECOMMEND (b)** -- keeps Node floor at 22 per existing engines pin, and the injection is trivial.

## Environment Availability

No external dependencies beyond what Phase 1-5 already require (Node ≥22, npm, the typebox/write-file-atomic/pi-coding-agent stack from `node_modules/`). Phase 6 is pure code/config -- no new external tools.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | ≥22 (verified in package.json `engines`) | -- |
| `@mariozechner/pi-coding-agent` types | Pi API consumption | ✓ | `^0.73.1` installed | -- |
| `@mariozechner/pi-tui` types | `AutocompleteItem` shape | ✓ | bundled with pi-coding-agent | -- |
| `typebox` | LLM tool param schemas + cache schema | ✓ | `^1.1.38` installed | -- |
| `write-file-atomic` | Cache file writes (via shared/atomic-json) | ✓ | `^8.0.0` installed | -- |

## Open Questions

1. **Should LLM tool execute bodies reuse `listPlugins` orchestrator semantics, or replicate the loop inline in `handlers/tools.ts`?**
   - **What we know:** `orchestrators/plugin/list.ts::listPlugins(opts)` already implements PL-1 union semantics, PL-3 marketplace narrowing, PL-6 manifest soft-fail, eager `resolveStrict` probing for available/unavailable bucketing. It calls `notifySuccess(ctx, renderPluginList(...))` at the end.
   - **What's unclear:** The LLM tool needs a different return shape -- `{ content: [{type: "text", text}], details: { plugins } }` -- and must NOT call `ctx.ui.notify`. So the LLM tool cannot directly delegate to `listPlugins(opts)`.
   - **Two options:**
     - (a) Refactor `listPlugins` to return a payload `{ marketplaces, warnings }` and emit notify only at the edge → LLM tool consumes the payload directly. Requires Phase 5 surface change. Recommend defer until evidence of duplication pain.
     - (b) Replicate the loop in `handlers/tools.ts` -- duplicating ~60 lines of logic. Pragmatic but creates two source-of-truth for filter logic.
   - **Recommendation:** (b) for V1 simplicity. CONTEXT.md "D-02" + "no mutating LLM tools" suggests the tool is the simpler V1 surface. Reuse can be added later.
   - **Why surface to user:** D-02 doesn't specify the implementation strategy. Either option is consistent with the locked decisions. A discrete `[?]` here helps the planner commit before writing 6+ task plans.

2. **Should LLM tool parameter schemas live in a separate `edge/handlers/tools-schemas.ts` for testability, or inline in `handlers/tools.ts`?**
   - **What we know:** V1 inlined them inside `pi.registerTool({ parameters: Type.Object(...) })`. Phase 2-5 codebase keeps TypeBox schemas inline at module load (state-io, manifest, etc.).
   - **What's unclear:** Testability of the schemas themselves. If a test wants to assert "tool X accepts marketplace: string?" without mounting the whole tool registration, a separate schema export helps.
   - **Recommendation:** Inline in `handlers/tools.ts` (V1 pattern). If a test needs the schema, export it as `export const PLUGIN_LIST_PARAMS = Type.Object({...})` at module top and reference in the `parameters:` field. Single-file simplicity preserved.
   - **Why surface to user:** Minor but discrete -- the planner benefits from a one-time yes/no before writing the tools.ts task.

3. **Should the `session_start` autocomplete wrapper installation be idempotent (track installation in a closure flag) or re-install on every event (V1 behavior)?**
   - **What we know:** Pi-tui's `addAutocompleteProvider` stacks (verified in types.d.ts line 136 comment). V1 re-installs unconditionally. The wrapper's `applyCompletion` post-processing is idempotent (normalizing whitespace twice = once).
   - **What's unclear:** Whether long-lived sessions with many `session_start` events would accumulate wrappers to the point of measurable overhead.
   - **Recommendation:** Port V1 verbatim (unconditional). Add a test that asserts `pi.on("session_start", ...)` is called once during `registerClaudePluginCommand` setup -- leaving the per-event behavior to Pi-tui.
   - **Why surface to user:** Discrete behavioral decision; defaulting to V1 parity unless the user prefers a different posture.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi-tui's `addAutocompleteProvider` STACKS wrappers (line 136 d.ts comment confirms) | Pitfall 4 | If it OVERWRITES, then V1's wrapper would be the only one -- even more benign than current analysis. Net: no functional risk. |
| A2 | V1's `getPluginRefCompletions` correctness is preserved by refining `mode: "install"|"uninstall"|"update"` with the D-03 status filter (no other behavioral change) | TC-6 carry-forward | If status semantics change subtly (e.g., `unavailable` and `installed` need separate completion treatment), the planner must add a sub-mode parameter. Low risk -- D-03 corollary is explicit. |
| A3 | The post-state-commit window in each orchestrator is clearly identifiable by the closing of the outer `withStateGuard` followed by data-dir mkdir / rm operations | Cache-Invalidation Insertion-Point Map | If a future orchestrator refactor moves cleanup steps inside the guard, the insertion point must follow. Low risk -- pattern is uniform across Phase 4/5. |
| A4 | `marketplaceCount` for `pi_claude_marketplace_list` is `Object.keys(mp.plugins).length`, not a filtered subset (V1's `filter(p => p.installed)`) -- because the new D-09 state schema has no `installed` field | LLM tool extracts | If a future schema reintroduces `installed: boolean` (unlikely; D-09 explicitly removes it), the count must filter. Low risk -- D-09 is locked. |
| A5 | Reading `process.cwd()` inside `getArgumentCompletions` (V1 parity) is acceptable for Phase 6 | Pitfall 3 | If Pi adds a `ctx`-aware completion API in a future Pi version, the planner can switch. Low risk -- V1 has shipped this pattern for years. |
| A6 | The 10-min TTL constant is locked in `shared/completion-cache.ts` as a module-level const (D-03 escalation note "Both knobs are local to `shared/completion-cache.ts` constants" confirms) | Pattern 2 | If user wants this configurable, surface as Open Question -- not flagged as such because D-03 explicit. |

## Sources

### Primary (HIGH confidence)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md` -- locked decisions (D-01..D-04)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/phases/06-edge-layer-tab-completion/06-DISCUSSION-LOG.md` -- decision audit trail
- `/Users/acolomba/src/pi-claude-marketplace/.planning/REQUIREMENTS.md` lines 200-217 -- AP-1..4, TC-1..9
- `/Users/acolomba/src/pi-claude-marketplace/.planning/ROADMAP.md` lines 143-152 -- Phase 6 entry
- `/Users/acolomba/src/pi-claude-marketplace/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` -- Pi API surface (`ExtensionAPI.registerCommand`, `registerTool`, `on(session_start)`, `ExtensionContext.ui.notify`, `ExtensionContext.ui.addAutocompleteProvider`)
- `/Users/acolomba/src/pi-claude-marketplace/node_modules/@mariozechner/pi-tui/dist/autocomplete.d.ts` -- `AutocompleteItem`, `AutocompleteProvider`
- V1 source at `git show features/initial:extensions/pi-claude-marketplace/{args,index,completions}.ts` + `git show features/initial:extensions/pi-claude-marketplace/commands/{router,_args,list-marketplaces}.ts`
- `/Users/acolomba/src/pi-claude-marketplace/eslint.config.js` -- BLOCK A (output discipline) + BLOCK C (import boundaries) verified in-place
- `/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/{notify,atomic-json,path-safety,fs-utils,types}.ts` -- Phase 1 primitives Phase 6 consumes
- `/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/persistence/{locations,state-io}.ts` -- Phase 2 primitives; cache rebuild consumes
- `/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/{marketplace,plugin}/*.ts` -- Phase 4/5 orchestrators Phase 6 wraps + invalidation insertion sites
- `/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/domain/{manifest,resolver}.ts` -- `MARKETPLACE_VALIDATOR`, `resolveStrict` consumed by cache rebuild

### Secondary (MEDIUM confidence)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/research/PITFALLS.md` -- Pitfall 11 (cwd), 13 (completion staleness), 15 (notify discipline)
- `/Users/acolomba/src/pi-claude-marketplace/.planning/research/ARCHITECTURE.md` -- Pattern 6 (probe at decision time), Anti-Pattern 2 (cache `getAllTools`)
- `/Users/acolomba/src/pi-claude-marketplace/tests/orchestrators/plugin/install.test.ts` -- Phase 5 test scaffolding patterns (`withHermeticHome`, `makeCtx`)
- `/Users/acolomba/src/pi-claude-marketplace/tests/helpers/{git-mock,prd-extract}.ts` -- reusable helpers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every version pinned in package.json, every API verified in installed types.d.ts.
- V1 source extracts: HIGH -- `git show features/initial:` returns deterministic source, ports verbatim.
- Pi API contract: HIGH -- types.d.ts read verbatim.
- Architecture (cache module): MEDIUM-HIGH -- the module's internal data structures are not user-locked; minor shape variations are planner's discretion.
- Cache-invalidation insertion-point map: HIGH -- line numbers verified per file.
- Pitfalls: HIGH -- every named pitfall maps to an existing Phase 1-5 lock or carries forward unchanged.

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (30 days; stable Pi API + locked V1 codebase + locked decisions)
