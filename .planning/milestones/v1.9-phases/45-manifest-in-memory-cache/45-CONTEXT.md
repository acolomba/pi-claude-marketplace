# Phase 45: Manifest In-Memory Cache - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A process-lifetime in-memory cache wrapping the single `loadMarketplaceManifest`
seam (`extensions/pi-claude-marketplace/domain/manifest.ts`). It memoizes the
load _result_ -- the parsed manifest on success and the thrown error on failure
(negative caching) -- keyed by `(mtimeMs, size)`, with a passive `stat` on
**every** read driving invalidation. Realizes PRD NFR-8: removes the per-`list`
/ per-`info` re-read + re-parse + re-validate cost with byte-identical output.

**In scope:** `marketplace.json` reads only, through the existing seam.
**Out of scope (locked by REQUIREMENTS.md Non-Goals):** caching `state.json` or
any other read; a cross-process / shared cache; changing the seam signature or
any of the 9 call sites; touching write sites (they stay cache-unaware).

</domain>

<decisions>
## Implementation Decisions

### Cache Shape & Lifetime
- **D-01:** A `createManifestCache()` factory returns an object exposing a
  `load(path)` method that owns the memoization. `domain/manifest.ts` holds
  **one module-level singleton** of it, and `loadMarketplaceManifest` delegates
  to `singleton.load(manifestPath)`. Tests construct a **fresh instance** to get
  a guaranteed cold start and per-test isolation -- directly satisfying CACHE-03
  ("a freshly constructed cache starts empty") and making the CACHE-01
  single-parse spy clean. Rejected: a bare module-level `Map` + exported
  `__resetManifestCache()` hook (leaks a reset hook into the module's public
  surface, reads less like "constructed").

### stat-Failure / Invalidation
- **D-02:** Every read `stat`s the path and compares `(mtimeMs, size)` against
  the cached entry; any change re-reads + re-parses + re-validates and refreshes
  the entry (covers in-process atomic tmp+rename rewrites and external rewrites
  alike -- CACHE-02). If the `stat()` itself **fails** (ENOENT after delete,
  EACCES, etc.), it is treated as a **cache miss** that falls through to the real
  load, so the natural error propagates **byte-identically** to today's uncached
  path (CACHE-04). Stat failures are **not** negative-cached -- there is no
  `(mtimeMs, size)` discriminator to key or invalidate them on, so caching them
  would risk a stale error after the file reappears.

### Result Sharing
- **D-03:** Cache hits return the parsed manifest **by reference**; negative
  entries **re-throw the cached `Error` instance** directly. This is the
  cheapest path and is exactly byte-identical, and re-throwing the same instance
  keeps the error "behaviorally equivalent (same message consumed by the
  soft-load path)" per CACHE-05. A one-line invariant comment is added at the
  seam: callers must treat the result as **read-only**. Justified by grep -- all
  9 current callers consume the result read-only (`JSON.stringify(parsed)`,
  reading `.name` / `.plugins`); and the seam already returns the **raw**
  `JSON.parse` value (not `.Parse()`) per `update.ts` WR-01. Rejected:
  `structuredClone` per hit + reconstructed `Error` (re-introduces a per-hit
  cost the cache exists to remove).

### Eviction / Bounding
- **D-04:** **Unbounded** -- one tiny entry per `manifestPath`, no eviction / LRU
  / max-entry cap. The number of marketplaces is a handful and the
  process-scoped lifetime (cold after `/reload`, CACHE-03) bounds growth
  naturally. Rejected: a defensive cap (guards a pathological many-marketplace
  case this app's usage does not produce, at the cost of eviction logic and a
  tuning knob).

### Claude's Discretion
- The CACHE-01 spy mechanism (how the read/parse/validate path is made
  observable to assert a single parse across N reads) is left to
  research/planning -- e.g. a `node:test` mock of `readFile` / `JSON.parse`, or a
  counting wrapper around an injectable loader. The constructed-instance shape
  (D-01) deliberately keeps this open.
- The internal key representation for `(mtimeMs, size)` (composite string key vs
  nested structure) is an implementation detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & goal (authoritative on locked behavior)
- `.planning/REQUIREMENTS.md` -- v1.9 CACHE-01..06, the Non-Goals table (no
  `state.json` caching, no cross-process cache), and the NFR-8 framing.
- `.planning/ROADMAP.md` (Phase 45 section) -- goal + the 5 success criteria the
  phase is verified against.
- `docs/prd/pi-claude-marketplace-prd.md` -- NFR-8 (the successor `SHOULD` this
  phase realizes); NFR-5 (no network), NFR-10 (containment), NFR-12
  (forward-compatible parser) -- all must stay unaffected.

### The seam to wrap
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- `loadMarketplaceManifest`
  (the chokepoint to wrap), `MARKETPLACE_VALIDATOR` (JIT-compiled, runs inside
  the seam), and the existing comment stating caching "wraps this function."

### Gates that must stay green
- `tests/architecture/manifest-read-seam.test.ts` -- single-seam gate (CACHE-06).
  Keys on `readFile(...marketplace.json)` outside the seam; the cache uses
  `stat`, so it must not introduce any new `marketplace.json` `readFile`.
- `tests/architecture/catalog-uat.test.ts` -- byte-equality runner (CACHE-04);
  output must be byte-identical with the cache in place.
- `tests/domain/manifest.test.ts` -- existing seam tests + the tmpdir + `writeFile`
  pattern the new cache tests can mirror.

### Negative-cache consumer (error-equivalence contract)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (`loadMarketplaceManifestSoftly`,
  ~lines 434-491) -- the soft-load path that consumes the thrown error's message;
  CACHE-05's "behaviorally equivalent" bar is defined against this consumer.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` (WR-01,
  ~lines 291-317) -- documents that `loadMarketplaceManifest` returns the RAW
  `JSON.parse` value; the by-reference decision (D-03) rests on this.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The seam itself** (`domain/manifest.ts::loadMarketplaceManifest`): already
  the sole manifest-read chokepoint, pre-landed in Phase 7 / Plan 07-02 "for
  exactly this wrap point." The cache slots in behind it with no call-site churn.
- **`MARKETPLACE_VALIDATOR`** (JIT-compiled TypeBox validator) stays inside the
  seam; the cache memoizes the post-validate result so a hit skips it.
- **`tests/domain/manifest.test.ts`** tmpdir + `writeFile` harness is the model
  for the new cache tests (cold miss, hit, `(mtimeMs,size)` invalidation,
  negative-entry re-throw, no second parse).

### Established Patterns
- **Single-seam gate** keys on `readFile(...marketplace.json)` literals outside
  `domain/manifest.ts`; the cache adds a `stat`, not a `readFile`, so placement
  (in-seam or a sibling helper that calls the seam) is unconstrained by the gate.
- **Read-only consumption** of the loaded manifest across all 9 call sites
  (verified by grep) -- the invariant that makes by-reference returns (D-03) safe.
- **Atomic tmp+rename writes** at write sites change `mtimeMs`/`size`, which is
  exactly what the per-read `stat` comparison (D-02) keys on -- no write-site
  cache-busting hook is needed.

### Integration Points
- Nine call sites funnel through `loadMarketplaceManifest`
  (`edge-deps.ts`, `marketplace/{info,add,update}.ts`, `plugin/{list,info,install,update,reinstall}.ts`).
  None change -- the cache is internal to the seam delegate.
- The cache adds at most one `stat` per read and **no** other I/O, preserving
  NFR-5 (no network) and NFR-10 (containment).

</code_context>

<specifics>
## Specific Ideas

- Negative-cache contract (CACHE-05): the re-thrown error must stay
  "behaviorally equivalent -- same message consumed by the soft-load path."
  Re-throwing the cached `Error` instance (D-03) satisfies this exactly.
- The cache adds only a `stat` per read; this is the explicit NFR-5 / NFR-10
  safety argument that must hold in the implementation.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. (Caching `state.json` and a
cross-process / shared cache were raised only as the explicit out-of-scope
boundaries already recorded in `.planning/REQUIREMENTS.md` Non-Goals, not as new
ideas to revisit.)

</deferred>

---

*Phase: 45-manifest-in-memory-cache*
*Context gathered: 2026-06-07*
