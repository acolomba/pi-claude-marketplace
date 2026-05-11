---
phase: 06-edge-layer-tab-completion
plan: 03

subsystem: edge
tags: [edge-layer, completions, completion-cache, dispatcher, wave-2, tc-1, tc-2, tc-3, tc-4, tc-5, tc-6, tc-7, tc-8, tc-9, d-03]

# Dependency graph
requires:
  - phase: 06-edge-layer-tab-completion
    plan: 02
    provides: "ScopedLocations.cacheDir/marketplaceNamesCacheFile/pluginCacheFile (D-03 cache path helpers) and TC-7 normalize.ts. Plan 06-03 consumes the path-helper contract via LocationsResolver and leaves normalize.ts untouched."
provides:
  - "shared/completion-cache.ts: two-tier (memory + file) cache. getMarketplaceNames + getPluginIndex read API; invalidateMarketplaceNames + invalidateMarketplaceCache + dropMarketplaceCache invalidation API; ManifestSoftFailError discriminator; 10-min TTL via injected now() seam; schemaVersion: 1 cache files with drop+rebuild on mismatch."
  - "edge/completions/data.ts: V1 pure helpers (buildItem, splitCompletionInput, extractPositionals, getScopeCompletions, getMarketplaceCompletions) plus cache-backed accessors (getMarketplaceNamesAcrossScopes, getPluginToMarketplacesMap, getPluginRefCompletions). LocationsResolver interface is the edge -> persistence injection seam."
  - "edge/completions/provider.ts: getArgumentCompletions(prefix, resolver) dispatcher with 5 branches (TC-1 keywords, TC-3 flags, TC-4 --scope values, TC-2 marketplace verbs, TC-6 plugin@mp, TC-5 marketplace name). Returns null at no-match positions per Pi-tui contract. Exports TOP_LEVEL_SUBCOMMANDS + MARKETPLACE_SUBCOMMANDS."
affects: [06-04-handlers-and-llm-tools, 06-05-register-and-invalidation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ManifestSoftFailError discriminator: cache layer cannot inspect arbitrary thrown errors to decide TC-8 swallow vs. TC-9 propagation. The named exception is the contract: callers wrap manifest-load failures in `new ManifestSoftFailError(cause)`; everything else propagates verbatim. data.ts's rebuildPluginIndex closure performs the wrap; rebuildNamesForScope does NOT (state.json failures propagate as bare Errors per TC-9)."
    - "LocationsResolver seam: shared/ MUST NOT import persistence/ (eslint BLOCK C); edge/ MUST NOT import persistence/ either. The cache module accepts string paths + a rebuild() callback; data.ts accepts a LocationsResolver interface. register.ts (Plan 06-05) will construct the resolver from persistence/locations.ts + persistence/state-io.ts + domain/manifest.ts and thread it through getArgumentCompletions. Tests inject hermetic mock resolvers."
    - "Clock injection seam: GetPluginIndexOptions.now = () => Date.now (default). Tests pass `{ now: () => clock }` and advance `clock` past 10 min between reads to exercise the TTL re-read branch without t.mock.timers (Node 23+). Keeps the project Node floor at 22."
    - "D-03 schema versioning: schemaVersion is a Type.Literal(1) in both cache schemas; on validator Check() failure the cache module drops + rebuilds rather than migrating. Two snapshot tests (one per schema) compile-time guard against accidental schemaVersion bumps."

key-files:
  created:
    - "extensions/claude-marketplace/shared/completion-cache.ts"
    - "extensions/claude-marketplace/edge/completions/data.ts"
    - "extensions/claude-marketplace/edge/completions/provider.ts"
  modified:
    - "tests/shared/completion-cache.test.ts"
    - "tests/edge/completions/data.test.ts"
    - "tests/edge/completions/provider.test.ts"

key-decisions:
  - "ManifestSoftFailError lives in shared/completion-cache.ts (cache module exposes the discriminator) -- not in data.ts -- because the cache's catch-block is the structural point where the soft-fail vs. propagation branch is made; defining the discriminator next to its consumer makes the contract self-evident."
  - "data.ts MUST NOT import from persistence/ (BLOCK C). LocationsResolver is a structural interface; the resolver methods (loadStateForScope, loadManifestForMarketplace) include the rebuild logic the cache needs but the actual loadState / loadMarketplaceManifest calls happen in register.ts (Plan 06-05). Tests build inline mocks."
  - "Plugin-index cache file representation strips undefined `version` fields before atomic write (Type.Optional convention -- omit rather than null) to keep the on-disk shape minimal and schema-faithful."
  - "TC-8 poisoning persists in-file: once a manifest soft-fail caches `_loadError`, subsequent reads (within the same process and across process restarts) return [] without re-invoking rebuild. The poison is cleared only via explicit invalidateMarketplaceCache / dropMarketplaceCache. Rationale: the soft-fail signal in the cache file IS the cached result -- re-running rebuild on every read would defeat the cache's purpose. Plan 06-05's orchestrator-side invalidation call-sites are what clear the poison after the user fixes the underlying marketplace."
  - "provider.ts re-exports buildItem from data.ts so dispatcher tests can compose expected AutocompleteItem shapes without two imports."

patterns-established:
  - "edge/ -> persistence/ injection via LocationsResolver interface. Constructed in register.ts (Plan 06-05) from persistence/locations.ts; threaded through getArgumentCompletions verbatim. The interface decouples the cache rebuild contract from the persistence import boundary."
  - "Cache module accepts the rebuild callback as a parameter -- shared/ stays leaf-clean (no extension-folder imports) while still hosting derived-state logic that BOTH edge/ and orchestrators/ consume."
  - "AutocompleteItem imported from @mariozechner/pi-tui (V1 parity). pi-coding-agent transitively pulls pi-tui at peer-dep level; the type import is fully erased at runtime so no direct dependency declaration is required."

requirements-completed: [TC-1, TC-3, TC-4, TC-5, TC-6, TC-8, TC-9]

# Metrics
duration: ~35min
completed: 2026-05-11
---

# Phase 6 Plan 03: Completion Cache and Completions Summary

**Three new edge/shared modules (`shared/completion-cache.ts`, `edge/completions/data.ts`, `edge/completions/provider.ts`) plus 52 unskipped tests across cache + data + provider files. The D-03 two-tier cache, ManifestSoftFailError discriminator (TC-8 swallow vs. TC-9 propagate), 10-min TTL via injected clock, and the five-branch dispatcher with `null` no-match sentinel all land in one wave. `npm run check` exits 0 with 728 pass + 66 skip + 0 fail.**

## Performance

- **Started:** 2026-05-11T14:50:00Z (approx)
- **Completed:** 2026-05-11T15:25:00Z (approx)
- **Duration:** ~35 minutes
- **Tasks:** 3 / 3
- **Files created:** 3
- **Files modified:** 3

## Task Commits

Each task committed atomically:

1. **Task 1: completion-cache (D-03 + TC-8/TC-9 + TTL)** -- `8ed3f27` (feat)
2. **Task 2: completions/data with cache-backed accessors** -- `f9cd5c8` (feat)
3. **Task 3: completions/provider dispatcher (TC-1..TC-9)** -- `b68bb1b` (feat)

## Accomplishments

### Three Modules Landed

| File | Role | Notable exports |
|------|------|-----------------|
| `shared/completion-cache.ts` | Two-tier cache (memory + atomic-JSON file) with TC-8 soft-fail and TC-9 propagation | `getMarketplaceNames`, `getPluginIndex`, `invalidateMarketplaceNames`, `invalidateMarketplaceCache`, `dropMarketplaceCache`, `ManifestSoftFailError`, `PluginIndexRow`, `MARKETPLACE_NAMES_CACHE_SCHEMA`, `PLUGIN_INDEX_CACHE_SCHEMA`, `__resetCacheForTests` |
| `edge/completions/data.ts` | V1 pure helpers + cache-backed accessors; `LocationsResolver` injection seam | `buildItem`, `splitCompletionInput`, `extractPositionals`, `getScopeCompletions`, `getMarketplaceCompletions`, `getMarketplaceNamesAcrossScopes`, `getPluginToMarketplacesMap`, `getPluginRefCompletions`, `LocationsResolver` |
| `edge/completions/provider.ts` | `getArgumentCompletions` dispatcher | `getArgumentCompletions`, `TOP_LEVEL_SUBCOMMANDS`, `MARKETPLACE_SUBCOMMANDS` |

### Decision-ID Traceability

| Decision / REQ-ID | Surface | Where it lands |
|-------------------|---------|-----------------|
| D-03 (two-tier cache) | `shared/completion-cache.ts` | Memory `Map` keyed on `${scope}` / `${scope}::${marketplace}`; file layer via `atomicWriteJson` + `node:fs/promises.readFile`. TypeBox JIT validators (`Compile(MARKETPLACE_NAMES_CACHE_SCHEMA)`, `Compile(PLUGIN_INDEX_CACHE_SCHEMA)`) gate file reads -- mismatch drops + rebuilds. |
| D-03 TTL | `getPluginIndex` + `GetPluginIndexOptions.now` | 10-minute constant (`PLUGIN_INDEX_TTL_MS`); injected clock seam keeps Node floor at 22. |
| D-03 corollary (status filter) | `getPluginToMarketplacesMap` in `data.ts` | install mode keeps `status !== "installed"` (INCLUDES `unavailable`); uninstall/update modes keep `status === "installed"` only. |
| TC-1 (top-level keywords) | `provider.ts` branch 1 | `TOP_LEVEL_SUBCOMMANDS.filter(s => s.startsWith(current))` with trailing space. |
| TC-2 (nested marketplace keywords; rm excluded) | `provider.ts` branch 3 + `MARKETPLACE_SUBCOMMANDS` | `["add","remove","list","update","autoupdate","noautoupdate"]` -- `rm` is router-only alias (Plan 06-02). |
| TC-3 (flag completion; -/-- parity) | `provider.ts` branch 2b | `current.startsWith("-")` -> `--scope` always; `head === "list"` adds `--installed/--available/--unavailable`. |
| TC-4 (--scope values) | `provider.ts` branch 2a | `prevToken === "--scope"` -> `user`/`project`. |
| TC-5 (marketplace name positional) | `provider.ts` branch 5 + `getMarketplaceCompletions` | `list <here>` and `marketplace <verb> <here>` (verb in {remove, rm, update, autoupdate, noautoupdate}). |
| TC-6 (plugin@mp; status filter) | `provider.ts` branch 4 + `getPluginRefCompletions` | install/uninstall/update with `allowMarketplaceOnly: true` only for update; D-03 status filter from `getPluginToMarketplacesMap`. |
| TC-7 (trailing space sample) | `provider.ts` branch 1 + `buildItem` | Every terminal completion's `value` ends in " "; multi-mp plugin (`name@`) does NOT (V1 parity). |
| TC-8 (manifest soft-fail) | `getPluginIndex` catch + `ManifestSoftFailError` | Cache writes `{ _loadError, plugins: [] }` poison; returns []. Subsequent reads (memory or file hit) return [] without re-invoking rebuild. |
| TC-9 (state.json propagation) | `getMarketplaceNames` + `rebuildNamesForScope` | State.json throws are bare Errors; cache layer does NOT catch them. Test confirms propagation through both `getArgumentCompletions` and `getMarketplaceNames` directly. |
| `null` no-match sentinel (Pi-tui contract) | `provider.ts` terminal `return null` | Verified by `grep -n 'return null'` -- single occurrence at end of dispatcher. |

### Test Counts

Baseline before this plan (Wave 1 / Plan 06-02 output):

```text
ℹ tests 794
ℹ pass 676
ℹ fail 0
ℹ skipped 118
```

After this plan:

```text
ℹ tests 794
ℹ pass 728      (+52 transitioned from skipped to passing)
ℹ fail 0
ℹ skipped 66    (-52 unskipped)
```

Breakdown of the +52 passing delta:

| File | New / Unskipped | Count |
|------|-----------------|-------|
| `tests/shared/completion-cache.test.ts` | 19 unskipped | 19 |
| `tests/edge/completions/data.test.ts` | 9 unskipped | 9 |
| `tests/edge/completions/provider.test.ts` | 24 unskipped | 24 |
| **Total** | | **52** |

Plan's `<verification>` claimed ">= 52 newly-green tests" -- met exactly.

### Import-Boundary Self-Invariants

Each of the three new modules passes its grep-based import-boundary gate:

| Module | Forbidden imports | Result |
|--------|-------------------|--------|
| `shared/completion-cache.ts` | persistence/, domain/, orchestrators/, edge/, bridges/, presentation/, transaction/, platform/ | `grep -cE 'from ".*(persistence\|domain\|orchestrators\|edge\|bridges\|presentation\|transaction\|platform)/'` -> 0 |
| `edge/completions/data.ts` | persistence/, domain/, bridges/, transaction/, platform/ | `grep -cE 'from ".*(persistence\|domain\|bridges\|transaction\|platform)/'` -> 0 |
| `edge/completions/provider.ts` | persistence/, domain/, bridges/, transaction/, platform/ | `grep -cE 'from ".*(persistence\|domain\|bridges\|transaction\|platform)/'` -> 0 |

Cross-checked by `npx eslint` running `import-x/no-restricted-paths` (BLOCK C) -- 0 errors on all three files.

### Output Discipline (BLOCK A)

None of the three new modules emit user-visible messages. They are pure data-access / dispatcher modules; `notify*` chokepoint is irrelevant. No direct `console.*` or `process.stdout/stderr` calls. ESLint clean on all three.

## REQ-ID Coverage Matrix

| REQ-ID | Asserted by | Count |
|--------|-------------|-------|
| TC-1 | `tests/edge/completions/provider.test.ts` (2) | 2 |
| TC-2 | `tests/edge/completions/provider.test.ts` (2; rm-exclusion explicit) | 2 |
| TC-3 | `tests/edge/completions/provider.test.ts` (3) | 3 |
| TC-4 | `tests/edge/completions/provider.test.ts` (1) | 1 |
| TC-5 | `tests/edge/completions/provider.test.ts` (5; list + 4 marketplace verbs) | 5 |
| TC-6 | `tests/edge/completions/provider.test.ts` (7; install/uninstall/update + unavailable-include + bare @mp + unique vs multi-mp trailing-space) + `tests/edge/completions/data.test.ts` (4 status-filter modes) | 11 |
| TC-7 | `tests/edge/completions/provider.test.ts` (1 sample + invariants embedded in 24 cases) | 1 sample |
| TC-8 | `tests/shared/completion-cache.test.ts` (2 cache-level) + `tests/edge/completions/provider.test.ts` (1 dispatcher-level) | 3 |
| TC-9 | `tests/shared/completion-cache.test.ts` (2 from each read API) + `tests/edge/completions/provider.test.ts` (1 dispatcher-level) | 3 |
| D-03 schemaVersion | `tests/shared/completion-cache.test.ts` (2 snapshot tests) | 2 |
| D-03 TTL | `tests/shared/completion-cache.test.ts` (2 -- post-expiry + pre-expiry) | 2 |
| D-03 invalidation API | `tests/shared/completion-cache.test.ts` (3 -- invalidate names + cache + drop) | 3 |
| `null` sentinel | `tests/edge/completions/provider.test.ts` (1) | 1 |

## Files Created/Modified

**Created (3):**

- `extensions/claude-marketplace/shared/completion-cache.ts`
- `extensions/claude-marketplace/edge/completions/data.ts`
- `extensions/claude-marketplace/edge/completions/provider.ts`

**Modified (3):**

- `tests/shared/completion-cache.test.ts` (19 Wave-0 stubs -> Wave-2 implementations)
- `tests/edge/completions/data.test.ts` (9 Wave-0 stubs -> Wave-2 implementations)
- `tests/edge/completions/provider.test.ts` (24 Wave-0 stubs -> Wave-2 implementations)

## Decisions Made

1. **AutocompleteItem from `@mariozechner/pi-tui`** (V1 parity). The plan's `<interfaces>` block sketched `import type { AutocompleteItem } from "@mariozechner/pi-coding-agent"`, but `pi-coding-agent` does not re-export this type -- it is a structural type from `pi-tui` that pi-coding-agent imports internally. V1's `completions.ts` imports it from `pi-tui` directly; this plan preserves that import path. The type is fully erased at runtime, so the transitive presence of pi-tui via the pi-coding-agent peer dep is sufficient; no direct package.json change required.

2. **Plugin-index file representation: strip `undefined` version**. TypeBox `Type.Optional` convention is to omit absent fields rather than store `null` / `undefined`. Before each `atomicWriteJson`, the plugin-index serialization branches: rows with `version` write `{ name, status, version }`; rows without write `{ name, status }`. This keeps the on-disk shape minimal and validator-faithful, and ensures `JSON.parse` -> `Check` round-trips reliably regardless of how the rebuild closure constructed the input row.

3. **TC-8 poison persists across reads -- in-file AND in-memory**. Once `getPluginIndex` writes the `_loadError` poison row, subsequent reads (memory or file) return `[]` without invoking rebuild. Rationale (added to the file's docstring): the soft-fail signal IS the cached result; re-running rebuild on every read would defeat the cache. The poison is cleared only by explicit `invalidateMarketplaceCache` / `dropMarketplaceCache`, which Plan 06-05 wires into the post-state-commit window of every mutating orchestrator. This is consistent with D-03's "cache is optimization, not authoritative" corollary -- the user can also delete the cache file manually to force a re-rebuild.

4. **Pure helper export discipline**. V1's `getScopeCompletions` is exported from `data.ts` but currently used only by tests / future register.ts code (the dispatcher's TC-3 branch builds flags inline with descriptions). Exporting it keeps the V1 parity surface complete without forcing the dispatcher to consume it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AutocompleteItem` not exported from `@mariozechner/pi-coding-agent`**

- **Found during:** Task 2 typecheck after writing `data.ts`.
- **Issue:** Plan's `<interfaces>` block specified `import type { AutocompleteItem } from "@mariozechner/pi-coding-agent"`. The pi-coding-agent type surface internally uses `AutocompleteItem` from `@mariozechner/pi-tui` but does NOT re-export it (`grep -E "^export.*AutocompleteItem" node_modules/@mariozechner/pi-coding-agent/dist/index.d.ts` -> no match). The TypeScript error was `TS2305: Module '"@mariozechner/pi-coding-agent"' has no exported member 'AutocompleteItem'`.
- **Fix:** Switched to `import type { AutocompleteItem } from "@mariozechner/pi-tui"` (V1's actual import path; confirmed by `git show features/initial:.../completions.ts`). Type-only import is fully erased at runtime; no package.json change is necessary because pi-tui is a transitive dep of pi-coding-agent (the peer dep declares the latter). The 06-RESEARCH document at line 475 also correctly states "AutocompleteItem (re-exported from @mariozechner/pi-tui, verified in node_modules/@mariozechner/pi-tui/dist/autocomplete.d.ts)". The plan's `<interfaces>` block was slightly inaccurate; the research was right.
- **Files affected:** `extensions/claude-marketplace/edge/completions/data.ts`, `extensions/claude-marketplace/edge/completions/provider.ts`.
- **Verification:** `npx tsc --noEmit` -> 0 errors.
- **Committed in:** `f9cd5c8` (Task 2 commit, same patch as the rest of `data.ts`).

**2. [Rule 1 - Bug] `override` modifier required on `ManifestSoftFailError.cause`**

- **Found during:** Task 1 typecheck.
- **Issue:** `class ManifestSoftFailError extends Error { readonly cause: unknown }` -- TypeScript's strict mode (`@typescript-eslint/strictTypeChecked` extends this) requires `override` on members that exist on the base class. Node's `Error.cause` (since ES2022) is defined as `unknown`. Without `override`, `tsc` emits `TS4114: This member must have an 'override' modifier...`.
- **Fix:** Changed declaration to `override readonly cause: unknown`. No behavior change.
- **Files affected:** `extensions/claude-marketplace/shared/completion-cache.ts`.
- **Verification:** `npx tsc --noEmit` -> 0 errors.
- **Committed in:** `8ed3f27` (Task 1 commit).

**3. [Rule 3 - Blocking] Unnecessary `as PluginIndexRow` casts in tests**

- **Found during:** Task 1 ESLint after writing `tests/shared/completion-cache.test.ts`.
- **Issue:** Several object literals were cast as `[{ name: "x", status: "installed" } as PluginIndexRow]`. `@typescript-eslint/no-unnecessary-type-assertion` flags these because the receiver's structural type already constrains the literal. The cast was a defensive copy-from-spec that ESLint correctly identifies as redundant.
- **Fix:** Removed the casts; the literals still satisfy the resolver's `Promise<readonly PluginIndexRow[]>` return type via structural inference.
- **Files affected:** `tests/shared/completion-cache.test.ts`.
- **Verification:** `npx eslint tests/shared/completion-cache.test.ts` -> 0 errors.
- **Committed in:** `8ed3f27` (Task 1 commit).

**4. [Rule 3 - Blocking] `@typescript-eslint/prefer-string-starts-ends-with` flagged regex on `endsWith` semantics**

- **Found during:** Task 3 ESLint after writing the multi-mp trailing-space test.
- **Issue:** `assert.equal(/ $/.test(shared.value), false, ...)` -- equivalent to `!shared.value.endsWith(" ")`. ESLint prefers the explicit `endsWith` form.
- **Fix:** Replaced with `assert.equal(shared.value.endsWith(" "), false, ...)`.
- **Files affected:** `tests/edge/completions/provider.test.ts`.
- **Verification:** `npx eslint tests/edge/completions/provider.test.ts` -> 0 errors.
- **Committed in:** `b68bb1b` (Task 3 commit).

**5. [Rule 3 - Blocking] Prettier auto-reformatted multiple files**

- **Found during:** Each task's verification run.
- **Issue:** Initial drafts had line breaks / argument folds that prettier prefers to compact. Common pattern: multi-line object literal arguments to `JSON.stringify`, and short array literals wrapped across lines.
- **Fix:** Ran `npx prettier --write` after each task on the new + modified files; prettier's output is the canonical format. No semantic change.
- **Files affected:** All three created files + all three modified test files.
- **Verification:** `npx prettier --check ...` -> clean across all six files.

---

**Total deviations:** 5 (all mechanical / tooling-compliance; none change plan invariants or user contract).
**Impact on plan:** All five deviations are scoped to single-token-or-line fixes; none change the cache module's public API, the dispatcher's branch logic, or the test taxonomy. The TC-8/TC-9 contract, the D-03 status-filter semantics, and the `null` no-match sentinel are all preserved verbatim.

## Issues Encountered

- **Plan's `<interfaces>` import line for `AutocompleteItem` was wrong** (`from "@mariozechner/pi-coding-agent"` vs. the correct `from "@mariozechner/pi-tui"`). The research document at line 475 had it right; the plan's interfaces block paraphrased it inaccurately. Recommend a planner-side cross-check that interface imports match what `git show features/initial:.../completions.ts` actually uses.
- **TypeScript 5.9 strict mode requires `override` on `Error.cause`** -- documented now for future executors writing custom Error subclasses with a `cause` field.

## User Setup Required

None - no external service configuration required.

## Next Phase / Plan Readiness

- **Plan 06-04 (handlers + LLM tools):** Will consume `parseCommandArgs` (Plan 06-02 `args-schema.ts`) and orchestrator surfaces; does NOT directly consume Plan 06-03's three modules.
- **Plan 06-05 (register wiring + invalidation):** Will construct a `LocationsResolver` from `persistence/locations.ts` + `persistence/state-io.ts` + `domain/manifest.ts` and pass it through `getArgumentCompletions`. Will also wire `invalidateMarketplaceNames` / `invalidateMarketplaceCache` / `dropMarketplaceCache` into the post-state-commit window of the 5 mutating orchestrators per D-03 corollary (`marketplace add/remove/update`, `plugin install/uninstall`; `plugin update` is intentionally a no-op per D-03 corollary).
- **Cache-invalidation failure semantics:** Plan 06-05 must wrap the invalidation call in `try { ... } catch (err) { notifyWarning(ctx, ...) }` so a failed cache drop never rolls back the orchestrator's primary state commit.

## Threat Flags

None - no new threat surface introduced beyond the plan's `<threat_model>`.

T-EDGE-1 / T-EDGE-3 mitigations (TypeBox JIT-compiled validators on cache file reads with drop+rebuild on mismatch) are implemented inline in `shared/completion-cache.ts`. The validator gate runs on every memory miss; tampered cache content is dropped and rebuilt from authoritative sources transparently.

T-EDGE-4 (giant marketplace.json) remains `accept` per the plan's `<threat_model>` -- deferred to NFR-8.

## Self-Check: PASSED

All 3 created files verified present:

- extensions/claude-marketplace/shared/completion-cache.ts -- FOUND
- extensions/claude-marketplace/edge/completions/data.ts -- FOUND
- extensions/claude-marketplace/edge/completions/provider.ts -- FOUND

All 3 modified test files verified unskipped + green:

- tests/shared/completion-cache.test.ts -- 19 pass, 0 skip
- tests/edge/completions/data.test.ts -- 9 pass, 0 skip
- tests/edge/completions/provider.test.ts -- 24 pass, 0 skip

Import-boundary self-invariant grep gates:

- shared/completion-cache.ts: 0 forbidden imports (persistence/domain/orchestrators/edge/bridges/presentation/transaction/platform) -- PASS
- edge/completions/data.ts: 0 forbidden imports (persistence/domain/bridges/transaction/platform) -- PASS
- edge/completions/provider.ts: 0 forbidden imports (persistence/domain/bridges/transaction/platform) -- PASS

`return null` sentinel verified in provider.ts: `grep -n 'return null'` -> single match at line 178 -- PASS.

All three task commits verified in git log:

- 8ed3f27 (Task 1: completion-cache (D-03 + TC-8/TC-9 + TTL)) -- FOUND
- f9cd5c8 (Task 2: completions/data with cache-backed accessors) -- FOUND
- b68bb1b (Task 3: completions/provider dispatcher (TC-1..TC-9)) -- FOUND

`npm run check` exit code: 0 (typecheck + ESLint + Prettier + `node --test` all green; 728 pass + 66 skip + 0 fail).

---

*Phase: 06-edge-layer-tab-completion*
*Plan: 03-completion-cache-and-completions*
*Completed: 2026-05-11*
