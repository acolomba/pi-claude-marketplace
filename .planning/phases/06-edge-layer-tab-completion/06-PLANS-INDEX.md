# Phase 6: Edge Layer & Tab Completion -- Plans Index

**Phase:** 06-edge-layer-tab-completion
**Plans:** 5
**Waves:** 4 (0 -> 1 -> 2 -> 3)
**Created:** 2026-05-11

## Wave Structure

| Wave | Plans (parallel within wave) | Autonomous | Depends on |
|------|------------------------------|------------|------------|
| 0    | 06-01 (test scaffolding)     | yes        | --         |
| 1    | 06-02 (edge primitives)      | yes        | 06-01      |
| 2    | 06-03 (cache + completions), 06-04 (handlers + LLM tools) | yes, yes | 06-02 (both) |
| 3    | 06-05 (register + invalidation + ESLint rule) | yes | 06-03, 06-04 |

**Parallelism:** Waves 0, 1, 3 each contain a single plan. Wave 2 contains two plans (06-03 and 06-04) that share no `files_modified` overlap -- they can execute in parallel.

**Atomically shippable:** After each plan merges, `npm run check` is green and the codebase is in a coherent state.

## Plans Summary

### 06-01-test-scaffolding-PLAN.md (Wave 0)

**Objective:** Create 18 new test files under `tests/edge/**/*.test.ts` and `tests/shared/completion-cache.test.ts`, each containing skipped stubs (`test.skip(name, () => {})`) for every Phase 6 REQ-ID behavior. Wave 0 gate per `workflow.nyquist_validation`.

**Requirements covered:** AP-1, AP-2, AP-3, AP-4, TC-1..TC-9 (skipped stubs only; behaviors land in Waves 1-3).

**Tasks:** 3 (pure-unit stubs; integration stubs; handler + LLM tool + register stubs).

**Verification:** `node --test tests/edge/**/*.test.ts tests/shared/completion-cache.test.ts` reports >=141 skipped, zero failures.

### 06-02-edge-primitives-PLAN.md (Wave 1)

**Objective:** Port V1's `args.ts`, `commands/_args.ts`, `commands/router.ts` verbatim (modulo import paths + notify routing); add TC-7 helpers in `edge/completions/normalize.ts`; define `EdgeDeps` in `edge/types.ts`; extend `persistence/locations.ts` with three cache path helpers.

**Requirements covered:** AP-1, AP-2, AP-3, AP-4 (parser layer); TC-2 router slice (rm alias); TC-7 (normalize + regex). Locks 36+ stubs as green.

**Tasks:** 3 (parser ports; router + types + normalize; locations.ts cache helpers).

**Files produced:** 5 new + 1 modified.

**Key invariant:** router.ts has zero direct `ctx.ui.notify` calls (notify-discipline grep gate self-invariant; uses `notifyUsageError`).

### 06-03-completion-cache-and-completions-PLAN.md (Wave 2, parallel with 06-04)

**Objective:** Land the two-tier completion cache (`shared/completion-cache.ts`) and the cache-backed dispatcher (`edge/completions/data.ts`, `edge/completions/provider.ts`). Tab completion functionally complete end-to-end.

**Requirements covered:** TC-1, TC-3, TC-4, TC-5, TC-6, TC-8, TC-9. D-03 cache primitives, 10-min TTL with clock injection.

**Tasks:** 3 (cache module with TC-8/TC-9 semantics; data accessor with status-aware filter; provider dispatcher with 5 branches).

**Files produced:** 3 new modules; 3 unskipped + green test files (~52 newly-green tests).

**Key invariants:**
- `shared/completion-cache.ts` is leaf-clean (zero imports from any extension folder).
- `edge/completions/*.ts` honor BLOCK C (no imports from persistence/domain/bridges/transaction/platform).
- `getArgumentCompletions` returns `null` (not `[]`) on no-match (Pi-tui contract).
- `ManifestSoftFailError` discriminates TC-8 (cache & swallow) from TC-9 (propagate).
- TTL test uses injected `now: () => number` seam (Node 22 compatible; no `t.mock.timers`).

### 06-04-handlers-and-llm-tools-PLAN.md (Wave 2, parallel with 06-03)

**Objective:** Land 9 thin-shim subcommand handlers + 2 LLM tools. After this plan, every slash subcommand and LLM tool can be invoked end-to-end (Plan 05 wires `register.ts` into Pi).

**Requirements covered:** D-01 (handler layout), D-02 (two read-only LLM tools with PL-1 union semantics).

**Tasks:** 2 (9 shim handlers + their tests; tools.ts with both LLM tool registrations + tests).

**Files produced:** 10 new files; 10 unskipped + green test files (~55 newly-green tests).

**Key invariants:**
- Zero direct `ctx.ui.notify` calls in any edge/handlers file (BLOCK A self-invariant grep gate).
- Zero imports from persistence/domain/bridges/transaction/platform in any edge/handlers file (BLOCK C self-invariant grep gate).
- Tool execute bodies stay in `edge/handlers/tools.ts` and import from `orchestrators/`, `presentation/`, `shared/` only (BLOCK C honored; orchestrators may need to expose loadVisibleMarketplaces / loadPluginListPayload helpers -- small additive change).

### 06-05-register-and-invalidation-PLAN.md (Wave 3)

**Objective:** Wire everything together via `edge/register.ts`; insert cache-invalidation calls in 5 mutating orchestrators (post-state-commit window); extend ESLint to block `process.stdout`/`process.stderr` writes in `edge/`.

**Requirements covered:** D-04 (registration helpers), TC-5/TC-6/TC-7 (end-to-end wiring; the unit tests already cover TC-5/TC-6/TC-7 -- register.ts ensures they fire in production).

**Tasks:** 3 (5 orchestrator edits + tests; orchestrators/edge-deps.ts + edge/register.ts + register.test.ts; ESLint rule).

**Files produced:** 2 new (edge/register.ts, orchestrators/edge-deps.ts); 5 modified orchestrators; 5 modified orchestrator tests (additive); 1 unskipped register test file; 1 modified eslint.config.js.

**Key insight:** `orchestrators/edge-deps.ts` resolves the `edge/ -> persistence/` BLOCK C tension. `edge/register.ts` imports `makeLocationsResolver` from `orchestrators/edge-deps.ts` (edge -> orchestrators is legal); the resolver itself imports from `persistence/` and `domain/` (orchestrators -> persistence/domain is legal).

**Cache invalidation insertion points (5):**
- `orchestrators/marketplace/add.ts`: invalidateMarketplaceNames + invalidateMarketplaceCache.
- `orchestrators/marketplace/remove.ts`: invalidateMarketplaceNames + dropMarketplaceCache.
- `orchestrators/marketplace/update.ts`: invalidateMarketplaceCache.
- `orchestrators/plugin/install.ts`: invalidateMarketplaceCache.
- `orchestrators/plugin/uninstall.ts`: invalidateMarketplaceCache.
- `orchestrators/plugin/update.ts`: NO invalidation (D-03 corollary).

**Failure envelope:** every invalidation call wrapped in `try { ... } catch (err) { notifyWarning(ctx, "<op> succeeded; cache refresh deferred: " + errorMessage(err)); }`. Memory-only invalidations cannot throw; `dropMarketplaceCache` has the realistic failure surface (unlink permission).

## Coverage Audit

### GOAL (ROADMAP Phase 6 goal)

Drive `/claude:plugin` end-to-end -- subcommand routing, Usage blocks, tokenization, --scope validation, fish-style normalization, tab completion at every position with soft-fail on per-marketplace manifest errors.

| GOAL Slice | Covered by Plan |
|-----------|------------------|
| Subcommand routing | 06-02 (router) |
| Usage blocks on empty/unknown | 06-02 (notifyUsageError) |
| Quoted-argument tokenization | 06-02 (args.ts) |
| --scope validation at any position | 06-02 (parseArgs) |
| Fish-style space normalization | 06-02 (normalize.ts) + 06-05 (session_start install) |
| Tab completion at every position | 06-03 (provider.ts) |
| Soft-fail on per-marketplace manifest errors | 06-03 (TC-8 ManifestSoftFailError + cache) |

### REQ (REQUIREMENTS.md AP-1..4, TC-1..9)

| REQ | Covered by Plan |
|-----|------------------|
| AP-1 | 06-02 (args.ts) |
| AP-2 | 06-02 (parseArgs --scope validation) |
| AP-3 | 06-02 (router Usage emission) |
| AP-4 | 06-02 (parseArgs while-loop accepts --scope at any position) |
| TC-1 | 06-03 (provider branch 1) |
| TC-2 | 06-02 (router rm alias) + 06-03 (provider branch 3 MARKETPLACE_SUBCOMMANDS) |
| TC-3 | 06-03 (provider branch 2b) |
| TC-4 | 06-03 (provider branch 2a) |
| TC-5 | 06-03 (provider branch 5 + data.ts getMarketplaceNamesAcrossScopes) |
| TC-6 | 06-03 (provider branch 4 + data.ts getPluginRefCompletions, status-aware) |
| TC-7 | 06-02 (normalize.ts) + 06-05 (session_start install) |
| TC-8 | 06-03 (cache ManifestSoftFailError + completion path returns empty list) |
| TC-9 | 06-03 (cache propagates state.json errors) |

### RESEARCH (06-RESEARCH.md features/constraints)

| Feature | Covered by Plan |
|---------|------------------|
| Two-tier completion cache | 06-03 |
| Status-aware completion filtering (D-03) | 06-03 (install includes unavailable per PRD §11 future --force) |
| Cache invalidation in 5 orchestrators | 06-05 |
| LocationsResolver indirection (BLOCK C) | 06-03 (interface) + 06-05 (concrete in orchestrators/edge-deps.ts) |
| LLM tool param schemas inline (V1 parity) | 06-04 |
| LLM tool execute bodies replicate V1 | 06-04 |
| session_start wrapper unconditional install (V1 parity) | 06-05 |
| ESLint blocks process.stdout/stderr in edge/ | 06-05 |

### CONTEXT (06-CONTEXT.md decisions D-01..D-04)

| Decision | Covered by Plan |
|----------|------------------|
| D-01 (handler layout 1:1; router in router.ts) | 06-02 (router) + 06-04 (handlers) |
| D-02 (two read-only LLM tools, extended params) | 06-04 (tools.ts) |
| D-03 (two-tier cache; status-aware filtering; cache-as-optimization; invalidation in orchestrators) | 06-03 (cache + filtering) + 06-05 (invalidation) |
| D-04 (Phase 6 ships register + tools helpers; Phase 7 calls them) | 06-05 (register.ts) |

**All four locked decisions implemented across the plan set. No deferred ideas appear in any plan. Claude's discretion items (cache schema versioning, file naming, in-memory map keys, single register file) all implemented per their CONTEXT.md guidance.**

## Out-of-Scope (Phase 7 / Deferred)

- Phase 7's `index.ts` (the trivial 3-line file that calls registerClaudePluginCommand + registerClaudeMarketplaceTools + the resources_discover wiring).
- Real isomorphic-git GitOps implementation.
- `pi.on("resources_discover", ...)` wiring.
- All CONTEXT.md `<deferred>` items: --force install, tokenizer escapes, info commands, mtime cache safety net, NFR-8 manifest-mtime layer, i18n, JSON output, telemetry, cache UI, `--scope=user` equals-form.
- NEW orchestrator BEHAVIOR (Phase 6 only adds the 5 cache-invalidation call-sites).

## Execution Order

```
Wave 0: 06-01
   └-> Wave 1: 06-02
          └-> Wave 2: 06-03  ┐
              Wave 2: 06-04  ├-> Wave 3: 06-05
```

Recommended execution:
1. `/gsd-execute-plan 06-01` (Wave 0).
2. `/gsd-execute-plan 06-02` (Wave 1).
3. `/gsd-execute-plan 06-03` and `/gsd-execute-plan 06-04` (Wave 2 -- in parallel worktrees if available, otherwise sequentially).
4. `/gsd-execute-plan 06-05` (Wave 3).

After each plan: `npm run check` green, ROADMAP.md checkbox updated.

## Notes for Implementers

- **Pitfall 3 cwd:** `process.cwd()` is acceptable EXACTLY ONCE -- inside `edge/register.ts::registerClaudePluginCommand`, when constructing the LocationsResolver passed to getArgumentCompletions. Every other site must use `ctx.cwd`.
- **Pi `getArgumentCompletions` signature:** `(argumentPrefix: string) => AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>`. Pi does NOT pass `ctx` to this callback; the registration glue layer closes over the resolver.
- **`null` vs `[]` for no-match:** return `null` (Pi-tui contract for "no suggestions at this position"); `[]` means "I have suggestions but none match the current prefix" (different semantics).
- **D-03 install-mode includes `unavailable`:** future --force will install the available components of an unavailable plugin; keeping `unavailable` rows in install completion is intentional and locked.
- **TC-8 vs TC-9 discrimination:** the cache layer uses `ManifestSoftFailError` (named error class exported from `shared/completion-cache.ts`) to differentiate. The rebuild closure for plugin-index wraps manifest failures in this class; state-load failures rethrow bare.
- **Cache as optimization:** users can `rm -rf <scopeRoot>/pi-claude-marketplace/cache/` safely at any time; the cache rebuilds lazily.
