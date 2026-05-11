# Phase 6: Edge Layer & Tab Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 6-edge-layer-tab-completion
**Areas discussed:** Handler granularity, LLM tool surface, Completion data strategy, Phase 6 / Phase 7 boundary

---

## Pre-Selected Areas (multiselect)

| Option | Description | Selected |
|--------|-------------|----------|
| Handler granularity | Per-subcommand vs router-inline vs domain-grouped | ✓ |
| LLM tool surface | Which read-only tools to register | ✓ |
| Completion data strategy | No-cache (V1) vs per-call vs TTL vs mtime | ✓ |
| Phase 6 / Phase 7 boundary | Pure exports vs register helpers vs both | ✓ |

---

## Handler granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror orchestrators (Recommended) | `edge/handlers/plugin/{install,uninstall,update,list}.ts` + `edge/handlers/marketplace/{add,remove,list,update,autoupdate}.ts` + `handlers/tools.ts`. 1:1 with orchestrators/. ~9 thin files. | ✓ |
| Two domain files | `edge/handlers/plugin.ts` + `edge/handlers/marketplace.ts` + `handlers/tools.ts`. Each ~150 LOC. | |
| All in router.ts | Inline handlers in `edge/router.ts` (~300 LOC). | |

**User's choice:** Mirror orchestrators (Recommended)
**Notes:** Locked as D-01. Test files at `tests/edge/handlers/<domain>/<verb>.test.ts`. `autoupdate` and `noautoupdate` route through one file with a boolean parameter, matching Phase 4 D-01 precedent.

---

## LLM tool surface

| Option | Description | Selected |
|--------|-------------|----------|
| Ship V1's two verbatim (Recommended) | `claude_marketplace_list` + `claude_marketplace_plugin_list` as-is. | |
| V1's two + top-level `claude_plugin_list` | Adds a third tool mirroring `/claude:plugin list` with filters. | |
| Just `claude_marketplace_list` | Smallest surface; drops V1's plugin list tool. | |
| Drop LLM tools from Phase 6 | Defer all tool registration to Phase 7. | |
| **Other (selected)** | Ship V1's two BUT extend `claude_marketplace_plugin_list`: when marketplace name is omitted, list plugins in all marketplaces, filtered by `available/unavailable/installed` and `scope`. Unavailable plugins remain listable for install because a future `--force` flag will install their available components. | ✓ |

**User's choice:** Free-text -- V1's two tools, but `claude_marketplace_plugin_list` becomes a hybrid: optional marketplace + filter booleans (installed/available/unavailable). PL-1 union semantics.
**Notes:** Locked as D-02. The extended tool subsumes the third option's use case (top-level cross-marketplace listing) without adding a new tool. The "keep unavailable visible because of future `--force`" rationale also drives D-03 corollary (install completion includes unavailable plugins).

---

## Completion data strategy

| Option | Description | Selected |
|--------|-------------|----------|
| No cache, V1 verbatim (Recommended) | Re-read state.json + manifest.json on every keystroke. | |
| Per-call dedupe only | Memoize repeated reads within one getArgumentCompletions invocation. | |
| Short-TTL cache (e.g., 200ms) | Module-level Map with TTL. | |
| mtime-based cache | stat() before read; cached value reused if mtime unchanged. | |
| **Other (selected)** | Two-tier file-backed cache: (1) marketplace-name cache (one file, lazy load, no TTL, invalidated on marketplace add/remove); (2) per-marketplace plugin cache (one file per marketplace, lazy load, 10-min TTL, invalidated on marketplace add/remove/update + plugin install/uninstall, dropped on marketplace remove). Plugin cache knows each plugin's status so completion filters are status-aware (install hides installed, uninstall/update show only installed). Unavailable plugins remain in install completions for future `--force`. | ✓ |

**User's choice:** Free-text -- full two-tier (file + in-memory) cache with status awareness.
**Notes:** Locked as D-03. Cache module lives in `shared/completion-cache.ts` because `edge/` cannot import `persistence/` and `orchestrators/` cannot import `edge/` -- `shared/` is the only architecturally legal placement reachable from both. Cache files live at `<scopeRoot>/claude-marketplace/cache/{marketplace-names.json, plugins/<marketplace>.json}`. The cache is optimization-only -- state.json and marketplace.json remain authoritative; corrupted cache rebuilds lazily.

### Follow-up: cache home / invalidation mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| mtime-self-invalidating in edge/ | stat()-based; no orchestrator coupling. | |
| Cache in shared/, orchestrators invalidate explicitly (Recommended path implied) | shared/completion-cache.ts with get + invalidate API. | ✓ (implied) |
| Event-bus pattern | EventEmitter; most decoupled but heavier than warranted. | |
| No cache; V1 verbatim | Walk back. | |

**User's choice:** Implied by the free-text answer above -- explicit invalidation from orchestrators, with 10-min TTL safety net on the plugin cache for concurrent-process changes.
**Notes:** Phase 6 EXTENDS the post-state-commit window of every mutating orchestrator with one cache-invalidation call. Invalidation failures are logged via `notify.warning` only -- they do not roll back the operation.

---

## Phase 6 / Phase 7 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 ships `registerClaudePluginCommand(pi, deps)` (Recommended) | `edge/register.ts` exports the helpers; Phase 7's index.ts is mostly wiring. | ✓ |
| Phase 6 ships pure routeClaudePlugin + completion provider only | Phase 7 calls pi.registerCommand itself. | |
| Both -- register helper AND pure exports | Two surfaces. | |

**User's choice:** Phase 6 ships `registerClaudePluginCommand(pi, deps)` (Recommended)
**Notes:** Locked as D-04. `EdgeDeps` interface lives in `edge/types.ts`; imports `GitOps` from Phase 4 and `PluginUpdateFn` from Phase 4's `orchestrators/types.ts`. Router and handlers stay pure -- only `register.ts` knows about `pi.*`.

---

## Claude's Discretion

User said "you decide" or did not specify:
- Cache schema versioning (Claude chose: single `schemaVersion: 1` field; drop+rebuild on mismatch since cache is optimization-only)
- Cache file naming and directory layout (Claude chose: `<scopeRoot>/claude-marketplace/cache/marketplace-names.json` and `<scopeRoot>/claude-marketplace/cache/plugins/<marketplace>.json`)
- In-memory map keys (Claude chose: string keys `${scope}::${marketplace}`)
- Atomic-JSON contract for cache writes (Claude chose: `shared/atomic-json.atomicWriteJson`, same primitive Phase 1 D-03 adopted)
- Cross-marketplace plugin disambiguation (Claude chose: per-(marketplace, plugin) row in cache; consumer dedupes for `<plugin>@<marketplace>` completion as in V1)
- Single `edge/register.ts` vs two files (Claude chose: single file with both helpers; split later if a third helper emerges)

## Deferred Ideas

- `--force` install flag (PRD §11 deferral; informs keep-unavailable-in-install-completions decision)
- Tokenizer escape support (`\"`, `\\`, `\n`)
- Top-level `claude_plugin_list` LLM tool (subsumed by extended `claude_marketplace_plugin_list`)
- `claude_marketplace_info`, `claude_plugin_info` tools (PRD §11 info-subcommand deferral)
- mtime-based cache invalidation safety net
- NFR-8 manifest-mtime caching layer (separate concern from D-03 completion cache)
- i18n / locale negotiation for Usage strings + tool descriptions
- Rich interactive selectors in completions
- Cache inspection / invalidation slash command
- JSON output / dry-run modes
- `claude_marketplace_plugin_list` returning version for available plugins
- Telemetry on completion latency (IL-4 forbids V1 telemetry)
- `marketplace info <name>`
- `--scope=user` (equals-separator) form support
