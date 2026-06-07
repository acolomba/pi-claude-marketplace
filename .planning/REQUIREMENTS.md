# Requirements: pi-claude-marketplace v1.9 Manifest In-Memory Cache

**Defined:** 2026-06-06
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Milestone v1.9 Requirements

Realize PRD **NFR-8** (a successor `SHOULD`): remove the per-`list` / per-`info` re-read + re-parse + re-validate cost for marketplace manifests with a process-lifetime in-memory cache wrapping the single `loadMarketplaceManifest` seam (`domain/manifest.ts`, the chokepoint Phase 7 / Plan 07-02 deliberately landed for exactly this). Scope is `marketplace.json` only; `state.json` and all other reads stay uncached. Invalidation is passive `(mtimeMs, size)` `stat` comparison; write sites stay cache-unaware. The cache memoizes the load _result_ -- the parsed manifest on success, the thrown error on failure. Observable output is byte-identical and the architecture single-seam gate stays green.

### Cache Behavior

- [x] **CACHE-01**: A repeated read of an unchanged `marketplace.json` within the process returns the cached parsed manifest with only a `stat` -- no content re-read, no `JSON.parse`, no `MARKETPLACE_VALIDATOR` re-run.

- [x] **CACHE-02**: Every read stats the path; a changed `mtimeMs` **or** `size` triggers a fresh read + parse + validate and refreshes the entry. Because the comparison runs on every read (not just on miss), this covers both in-process mutation (`update` / `marketplace add` / `install` rewriting a manifest via the atomic tmp+rename path) and another process rewriting the file -- no stale manifest is ever served.

- [x] **CACHE-05**: A read whose parse or schema validation fails is cached as a negative entry keyed by the same `(mtimeMs, size)` discriminator; subsequent reads of the unchanged invalid file re-throw the cached error with no re-read or re-parse. A change in `mtimeMs` or `size` discards the negative entry and re-attempts the load. The re-thrown error is behaviorally equivalent to the uncached throw (same message consumed by the soft-load path).

### Lifetime & Seam

- [x] **CACHE-03**: The cache is process-scoped (in-memory only) and never persisted to disk. A fresh process after `/reload` starts cold -- the first read of any manifest is a miss. No cache file or sidecar is written under any scope root.

- [x] **CACHE-06**: The cache wraps only the `loadMarketplaceManifest` seam; all manifest reads continue to flow through that single chokepoint, so the architecture single-seam gate stays green. Containment (NFR-10), the no-network policy (NFR-5 -- the cache adds no I/O beyond a `stat`), and forward-compatible parser behavior (NFR-12) are unaffected.

### Non-Regression

- [x] **CACHE-04**: Cached reads produce byte-identical user-visible output to uncached reads across the entire output catalog. The existing `catalog-uat` byte-equality runner passes unchanged, and `npm run check` stays green (NFR-6).

## Out of Scope

Explicitly excluded from v1.9. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Caching `state.json` reads | NFR-8 targets marketplace manifests only. `state.json` mutates on nearly every write op through `withStateGuard` -- a different, riskier invalidation problem outside this milestone's intent. |
| On-disk / persisted cache | In-memory only. A disk cache reintroduces atomic-write and staleness concerns that NFR-3 guards against, for no benefit over a per-process working set. |
| Explicit invalidate-on-write coupling | Passive `(mtimeMs, size)` `stat` invalidation was chosen so write sites stay cache-unaware (keeps the seam clean). Atomic tmp+rename bumps `mtime`; `size` is the same-tick tiebreaker. |
| Content-hash invalidation | Hashing would re-read the file contents on every check, defeating the purpose. `(mtimeMs, size)` is sufficient for a human-driven CLI. |
| Cross-process shared cache | Per-process only. Cross-process staleness is handled by the fresh `stat` on every read (CACHE-02), not by a shared store. |
| LRU / size-bounded eviction | The marketplace working set per process is small; an unbounded path-keyed map is adequate. Revisit only if profiling shows unbounded growth. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NFR-8 (PRD parent) | Phase 45 | Complete |
| CACHE-01 | Phase 45 | Complete |
| CACHE-02 | Phase 45 | Complete |
| CACHE-03 | Phase 45 | Complete |
| CACHE-04 | Phase 45 | Complete |
| CACHE-05 | Phase 45 | Complete |
| CACHE-06 | Phase 45 | Complete |

**Coverage:**

- v1.9 requirements: 6 total
- Mapped to phases: 6 (100%)
- Unmapped: 0

**Phase mapping rationale:**

- **Phase 45 (Manifest In-Memory Cache):** CACHE-01..06. All six requirements are facets of one cache wrapper at one seam (`loadMarketplaceManifest`) -- hit path, `(mtimeMs, size)` invalidation, negative caching, process-scoped lifetime, single-seam containment, and byte-identical non-regression are not independently shippable, so they land as one phase (implementation + verification plans).

---
*Requirements defined: 2026-06-06*
*Last updated: 2026-06-06 -- traceability filled by roadmap; 6/6 requirements mapped to Phase 45*
