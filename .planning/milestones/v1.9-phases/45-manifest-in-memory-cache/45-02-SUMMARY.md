---
phase: 45-manifest-in-memory-cache
plan: 02
subsystem: domain
tags: [cache, manifest, memoization, stat, tdd-green, typebox]

# Dependency graph
requires:
  - phase: 45-01
    provides: tests/domain/manifest-cache.test.ts (Wave 0 RED behavioral suite for createManifestCache)
  - phase: 07
    provides: domain/manifest.ts read seam + tests/architecture/manifest-read-seam.test.ts single-seam gate
provides:
  - extensions/pi-claude-marketplace/domain/manifest-cache.ts (createManifestCache(loader) factory)
  - delegating loadMarketplaceManifest seam memoized per-path by (mtimeMs,size)
  - NFR-8 per-list/per-info re-read+re-parse+re-validate elimination with byte-identical output
affects: [list, info, marketplace-update, completion-resolver]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createManifestCache(loader) factory owning its own Map (D-01: no module-global map, no reset hook)"
    - "stat-only cache layer in front of the read seam (CACHE-06: never readFile)"
    - "discriminated cache entry on ok so the negative re-throw is a non-null Error and the hit guard is an optional chain"
    - "by-reference success hits + same-instance negative re-throw (D-03 read-only invariant)"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/manifest-cache.ts
  modified:
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - tests/domain/manifest-cache.test.ts

key-decisions:
  - "Modeled ManifestCacheEntry as a discriminated union on `ok` (not an interface with optional value?/error?) so `throw entry.error` is a guaranteed non-null Error and the hit guard collapses to an optional chain -- satisfies @typescript-eslint/only-throw-error + prefer-optional-chain without casts"
  - "Reworded in-module comments (manifest-cache.ts D-01/D-04 header + manifest.ts WR-01 invariant) to drop the literal verifier tokens (readFile / __reset / evict / .Parse( / structuredClone) while preserving the decision-ID rationale -- same comment-token discipline Plan 45-01 established"
  - "Fixed 8 pre-existing eslint errors in the 45-01 test file (require-await + padding-line) by returning Promise.resolve/reject from the injected loaders; behavior identical, required so `eslint .` (and thus `npm run check`) stays green"

patterns-established:
  - "Factory-owned Map cache (D-01 divergence from shared/completion-cache.ts's module-global map + __resetCacheForTests reset hook)"
  - "stat-fail = pure miss fall-through (D-02): never touch the Map, call the loader directly so the natural error propagates byte-identically and is never negative-cached"

requirements-completed: [CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05, CACHE-06]

# Metrics
duration: ~22min
completed: 2026-06-07
---

# Phase 45 Plan 02: Manifest In-Memory Cache Summary

**`createManifestCache(loader)` stat-keyed memoization wired behind the `loadMarketplaceManifest` seam -- by-reference success hits, same-instance negative re-throw, stat-fail fall-through -- turning Plan 45-01's Wave 0 suite GREEN with byte-identical output and zero call-site churn.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-07
- **Completed:** 2026-06-07
- **Tasks:** 3 (2 TDD-GREEN code tasks + 1 closure gate)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- New `domain/manifest-cache.ts`: a `createManifestCache(loader)` factory owning a per-path `Map<string, Entry>` keyed by `(mtimeMs, size)`. One `stat` per read, never a `readFile` (CACHE-06). Success hits serve `entry.value` by reference (D-03); negative entries re-throw the same `Error` instance; a `(mtimeMs|size)` change reloads and refreshes either arm (CACHE-02 / CACHE-05); a `stat` failure is a pure miss that falls through to the loader on every read and is never negative-cached (D-02). Unbounded, no reset hook, no in-flight de-dup (D-04).
- `domain/manifest.ts` seam delegation: the original loader body is preserved verbatim as the private `loadMarketplaceManifestUncached` (the sole `marketplace.json` read, returning the raw `JSON.parse` value -- WR-01), one module-level `manifestCache` singleton is constructed (D-01), and the exported `loadMarketplaceManifest` delegates to `manifestCache.load(...)` with its signature unchanged. All 9 call sites untouched.
- Plan 45-01's 7-test Wave 0 suite is GREEN; the CACHE-06 single-seam gate and CACHE-04 catalog-uat byte-equality runner stay GREEN; `npm run check` exits 0 (1473/1473). Zero new dependency, zero `package.json`/lockfile churn.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create `domain/manifest-cache.ts` (createManifestCache factory)** - `090a943` (feat) -- TDD GREEN gate; the RED suite (`test(45-01)`) was Plan 45-01's commit `42ae8c3`.
2. **Task 2: Wire the cache behind the seam in `domain/manifest.ts`** - `f9014dd` (feat)
3. **Task 3: Prove byte-equality + full green gate (CACHE-04)** - no production code change (closure gate); verified `node --test tests/architecture/catalog-uat.test.ts` (3/3) and `npm run check` (exit 0).

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/manifest-cache.ts` (107 lines, new) - The locked cache factory. Imports only `stat` from `node:fs/promises`. Discriminated `ManifestCacheEntry` on `ok`. Module header documents D-01..D-04, CACHE-06 (stat-only), the D-03 read-only invariant, and the accepted same-tick/same-size residual risk (RESEARCH Pitfall 3).
- `extensions/pi-claude-marketplace/domain/manifest.ts` (modified) - Imports `createManifestCache`; renames the loader body to private `loadMarketplaceManifestUncached`; constructs the singleton; delegates the exported seam; updates the seam doc to present-tense memoization + the D-03 read-only invariant.
- `tests/domain/manifest-cache.test.ts` (modified) - Eslint-compliance fix to the 45-01 file (injected loaders return `Promise.resolve/reject` instead of `async`-no-await); the 7-test contract is unchanged and GREEN.

## Decisions Made

- **Discriminated cache entry on `ok`** instead of an interface with optional `value?`/`error?`: gives TypeScript the guarantee that a negative entry's `error` is a non-null `Error`, eliminating both the `@typescript-eslint/only-throw-error` and `prefer-optional-chain` warnings without a cast or non-null assertion. Behaviorally identical to the POC shape in 45-RESEARCH / 45-PATTERNS.
- **Raw `JSON.parse` value preserved** (no `.Parse()` / `.Clean()` / `structuredClone`): WR-01 / Pitfall 2 -- `update.ts` JSON.stringifys the parse for its content key and `info.ts` reads the schema-absent `parsed.description`, so reordering keys or dropping extra fields would break user-visible output. The CACHE-04 byte-equality runner confirms this.
- **Comment-token discipline** (same as Plan 45-01): in-module comments avoid the literal verifier tokens while keeping the decision-ID rationale, so the acceptance-criteria greps return 0 on real code occurrences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 8 pre-existing eslint errors in the Wave 0 test file**
- **Found during:** Task 1 (pre-commit `npm lint` hook, which runs `eslint .` across the whole repo).
- **Issue:** `tests/domain/manifest-cache.test.ts` (committed by Plan 45-01, `42ae8c3`) had 7 `@typescript-eslint/require-await` errors (injected counting loaders declared `async` with no `await`) and 1 `@stylistic/padding-line-between-statements` error. `eslint .` failed on them, which blocks the Task 2 verify and the Task 3 `npm run check` GREEN gate -- both hard success criteria for this plan. (The 45-01 pre-commit run only checked the changed file with `--files`, but the hook's `eslint .` lints the entire repo.)
- **Fix:** Converted each injected loader from `async () => {...}` to a plain arrow returning `Promise.resolve(value)` / `Promise.reject(new Error(...))`; the loader contract (`(p) => Promise<unknown>`) and every assertion are unchanged. A synchronous-throw-vs-rejected-promise distinction does not matter because the cache always invokes the loader under `await`.
- **Files modified:** tests/domain/manifest-cache.test.ts
- **Verification:** `node --test tests/domain/manifest-cache.test.ts` 7/7 GREEN; `eslint .` exit 0; `npm run check` exit 0.
- **Committed in:** `090a943` (Task 1 commit)

**2. [Rule 3 - Blocking] Reworded in-module comments to drop literal verifier tokens**
- **Found during:** Task 1 + Task 2 verification (acceptance-criteria greps for `readFile`, `__reset`, `evict|LRU|maxEntries`, `.Parse(`, `structuredClone` matched comment prose, not code).
- **Issue:** The module-header comments documenting the D-01/D-04 decisions (`manifest-cache.ts`) and the WR-01 raw-parse invariant (`manifest.ts`) referenced `__resetCacheForTests`, "eviction", `readFile`, `.Parse()`, and `structuredClone` to explain what the code deliberately does NOT do. A literal verifier grep flags those as false positives.
- **Fix:** Reworded the comments (e.g. "no test-only clear/reset hook", "no entry-count cap, no entry expiry/removal policy", "the sole marketplace.json file read", "does NOT route the result back through the validator's coercing parse, a schema clean, or a deep clone") so the files contain zero literal forbidden tokens while preserving the decision-ID rationale. No behavioral change.
- **Files modified:** extensions/pi-claude-marketplace/domain/manifest-cache.ts, extensions/pi-claude-marketplace/domain/manifest.ts
- **Verification:** All acceptance greps return 0; tests unaffected.
- **Committed in:** `090a943` (Task 1) + `f9014dd` (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking).
**Impact on plan:** Both were required to satisfy the plan's own GREEN-gate success criteria (`npm run check` exit 0 + clean acceptance greps). No behavioral change to the cache contract, the seam, or any user-visible output. No scope creep.

## Issues Encountered

None beyond the two Rule 3 fixes above. The cache implementation matched the verified-by-POC shape from 45-RESEARCH / 45-PATTERNS on the first pass; all 7 Wave 0 tests passed immediately, and only eslint-strictness (require-await, only-throw-error, prefer-optional-chain) required follow-up edits.

## Known Stubs

None. Both production files are fully wired: the seam delegates to a live singleton over the real injected loader; no placeholder/empty-data paths.

## Threat Flags

None. The cache introduces no new security-relevant surface: it adds only a `stat` on the same path the seam already reads (no new endpoint, no new file/network access, no schema change at a trust boundary). `MARKETPLACE_VALIDATOR` still runs inside the loader on every cold/changed read (NFR-12 preserved); the cache is in-memory only and writes nothing (NFR-10 containment unaffected); no network (NFR-5). All threat-register dispositions (T-45-04..08, T-45-SC) are realized as designed.

## Next Phase Readiness

- NFR-8 manifest memoization is landed and proven byte-identical -- the v1.9 milestone's single phase is complete.
- The cache is process-lifetime and cold after `/reload` (NFR-2 recovery model intact). No follow-up required.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/manifest-cache.ts
- FOUND: extensions/pi-claude-marketplace/domain/manifest.ts
- FOUND: .planning/phases/45-manifest-in-memory-cache/45-02-SUMMARY.md
- FOUND commit: 090a943 (feat(45-02): add createManifestCache factory)
- FOUND commit: f9014dd (feat(45-02): wire manifest cache behind the read seam)
- VERIFIED: tests/domain/manifest-cache.test.ts 7/7 GREEN; manifest-read-seam + catalog-uat GREEN; npm run check exit 0 (1473/1473); no package.json/lockfile churn
