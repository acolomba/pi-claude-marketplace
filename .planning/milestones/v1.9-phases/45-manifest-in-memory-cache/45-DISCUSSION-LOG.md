# Phase 45: Manifest In-Memory Cache - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 45-manifest-in-memory-cache
**Areas discussed:** Cache shape & lifetime, stat-failure / file-deleted edge, Shared reference vs copy, Eviction / bounding

---

## Cache shape & lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| Constructed instance + singleton | `createManifestCache()` factory returning `load(path)`; `domain/manifest.ts` holds one module-level singleton; `loadMarketplaceManifest` delegates. Tests construct a fresh instance for cold-start + isolation. Matches CACHE-03 "freshly constructed" + the CACHE-01 spy. | ✓ |
| Module Map + reset hook | Bare module-level `Map` + plain functions, with an exported `__resetManifestCache()` test-only hook. Simpler but leaks a reset hook into the module surface. | |

**User's choice:** Constructed instance + singleton (Recommended)
**Notes:** CACHE-03's "a freshly constructed cache starts empty" wording and the CACHE-01 single-parse spy test both favor a constructable/resettable cache.

---

## stat-failure / file-deleted edge

| Option | Description | Selected |
|--------|-------------|----------|
| Miss + fall through to real load | Treat any `stat()` failure (ENOENT/EACCES) as a miss and run the real load so the natural error propagates byte-identically. Don't negative-cache stat failures -- no `(mtimeMs,size)` key to invalidate on. | ✓ |
| Negative-cache the stat error too | Memoize stat failures as negative entries. Saves a readFile on repeated missing-file reads, but no discriminator to key/invalidate on → risk of stale error after the file reappears. | |

**User's choice:** Miss + fall through to real load (Recommended)
**Notes:** Preserves CACHE-04 byte-identity on the error path; stat errors have no `(mtimeMs,size)` discriminator.

---

## Shared reference vs copy

| Option | Description | Selected |
|--------|-------------|----------|
| By reference + read-only invariant | Return the cached parsed object by reference; re-throw the cached `Error` instance directly. Cheapest, exactly byte-identical. Add a one-line read-only invariant comment at the seam. | ✓ |
| Defensive copy per hit | `structuredClone` the manifest on each hit; reconstruct a fresh `Error` from the cached message each throw. Safe against future mutation, but re-introduces a per-hit cost. | |

**User's choice:** By reference + read-only invariant (Recommended)
**Notes:** Grep confirmed all 9 current callers consume the result read-only; the seam returns the raw `JSON.parse` value per `update.ts` WR-01. Re-throwing the same `Error` instance keeps CACHE-05 "behaviorally equivalent."

---

## Eviction / bounding

| Option | Description | Selected |
|--------|-------------|----------|
| Unbounded, one entry per path | No eviction -- one tiny entry per `manifestPath`. N marketplaces is a handful; process-scoped lifetime bounds it (cold after `/reload`). Least code. | ✓ |
| Defensive cap (max entries / LRU) | Max-entry cap with drop-oldest/LRU. Guards a pathological many-marketplace case this app doesn't produce, at the cost of eviction logic + a tuning knob. | |

**User's choice:** Unbounded, one entry per path (Recommended)
**Notes:** Process-scoped lifetime is the natural bound; no realistic unbounded-growth path in this app's usage.

---

## Claude's Discretion

- CACHE-01 spy mechanism (how read/parse/validate is made observable for the single-parse assertion) left to research/planning -- e.g. `node:test` mock of `readFile`/`JSON.parse` or a counting wrapper around an injectable loader. The constructed-instance shape keeps this open.
- Internal key representation for `(mtimeMs, size)` (composite string vs nested structure) is an implementation detail.

## Deferred Ideas

None -- discussion stayed within phase scope. Caching `state.json` and a cross-process / shared cache were referenced only as the existing out-of-scope boundaries in `.planning/REQUIREMENTS.md` Non-Goals, not as new ideas.
