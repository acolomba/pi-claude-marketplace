# Phase 45: Manifest In-Memory Cache - Research

**Researched:** 2026-06-07
**Domain:** In-process memoization of a single filesystem-read seam (Node ESM, `node:fs/promises`, `node:test`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Cache shape & lifetime):** A `createManifestCache()` factory returns an
  object exposing a `load(path)` method that owns the memoization.
  `domain/manifest.ts` holds **one module-level singleton** of it, and
  `loadMarketplaceManifest` delegates to `singleton.load(manifestPath)`. Tests
  construct a **fresh instance** for a guaranteed cold start / per-test isolation
  (satisfies CACHE-03; keeps the CACHE-01 single-parse spy clean). **Rejected:** a
  bare module-level `Map` + exported `__resetManifestCache()` hook (leaks a reset
  hook into the module surface; reads less like "constructed").

- **D-02 (stat-failure / invalidation):** Every read `stat`s the path and compares
  `(mtimeMs, size)` against the cached entry; any change re-reads + re-parses +
  re-validates and refreshes the entry. A `stat()` **failure** (ENOENT, EACCES,
  …) is treated as a **cache miss** that falls through to the real load so the
  natural error propagates **byte-identically**. Stat failures are **NOT**
  negative-cached (no `(mtimeMs, size)` discriminator to key/invalidate on).

- **D-03 (result sharing):** Cache hits return the parsed manifest **by
  reference**; negative entries **re-throw the cached `Error` instance** directly.
  A one-line read-only invariant comment is added at the seam. Justified by grep:
  all 9 callers consume the result read-only, and the seam already returns the
  **raw** `JSON.parse` value (not `.Parse()`) per `update.ts` WR-01. **Rejected:**
  `structuredClone` per hit + reconstructed `Error` (re-introduces the per-hit
  cost the cache exists to remove).

- **D-04 (eviction / bounding):** **Unbounded** -- one tiny entry per
  `manifestPath`, no eviction / LRU / max-entry cap. Marketplace count is a
  handful; process-scoped lifetime (cold after `/reload`) bounds growth.
  **Rejected:** a defensive cap.

### Claude's Discretion

- The **CACHE-01 spy mechanism** (how the read/parse/validate path is made
  observable to assert a single parse across N reads) -- e.g. a `node:test` mock of
  `readFile` / `JSON.parse`, or a counting wrapper around an injectable loader. The
  constructed-instance shape (D-01) deliberately keeps this open. **This research
  resolves it: use an injectable counting loader (see Pattern 2 / Pitfall 1).**
- The internal **key representation** for `(mtimeMs, size)` (composite string key
  vs nested structure) is an implementation detail. **This research recommends a
  per-path entry struct holding `{ mtimeMs, size, … }` keyed by `path` in a
  `Map<string, Entry>`; see Pattern 3.**
- **Where the cache module physically lives** (in-seam vs a sibling). **This
  research confirms a `domain/manifest-cache.ts` sibling is gate-safe; in-seam is
  equally safe -- see Architecture Patterns / Open Question 1.**

### Deferred Ideas (OUT OF SCOPE)

None. (Caching `state.json` and a cross-process / shared cache were raised only as
the explicit out-of-scope boundaries already recorded in REQUIREMENTS.md Non-Goals,
not as new ideas.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACHE-01 | Repeated read of unchanged `marketplace.json` returns cached parsed manifest with only a `stat` -- no content re-read, no `JSON.parse`, no `MARKETPLACE_VALIDATOR` re-run. | Pattern 2 (injectable counting loader) makes the read/parse/validate path observable; POC proves N reads → 1 loader call with by-reference identity. |
| CACHE-02 | Every read stats; a changed `mtimeMs` **or** `size` triggers fresh read+parse+validate and refreshes the entry (covers in-process atomic tmp+rename and external rewrites). | Pattern 3 (per-read `stat` + `(mtimeMs,size)` compare). POC proves size-change invalidation. Pitfall 3 covers the same-tick mtime-resolution landmine. |
| CACHE-03 | Process-scoped, never persisted; fresh process after `/reload` starts cold; no cache file/sidecar written. | D-01 in-memory `Map`; factory `createManifestCache()` constructs empty. Cache adds only a `stat`, zero writes -- Pattern 1. |
| CACHE-04 | Byte-identical user-visible output; `catalog-uat` byte-equality + `npm run check` stay green. | D-03 by-reference returns the same raw value today's path returns; cache is transparent. Validation Architecture §CACHE-04. |
| CACHE-05 | Parse/validate failure cached as negative entry keyed by same `(mtimeMs,size)`; repeated reads re-throw with no re-parse; change discards it; error behaviorally equal to uncached throw (same `.message`). | Pattern 4 (negative caching, re-throw same instance). POC proves it; soft-load consumes only `.message` via `errorMessage()` (Code Examples). |
| CACHE-06 | Cache wraps only `loadMarketplaceManifest`; single-seam architecture gate stays green; NFR-5/NFR-10/NFR-12 unaffected. | Gate scans `extensions/**` for `readFile(...marketplace.json)`; cache adds `stat` not `readFile`, and a sibling/in-seam placement both pass -- verified against the gate regex (Open Question 1). |
</phase_requirements>

## Summary

This phase wraps a single, already-isolated seam (`loadMarketplaceManifest` in
`domain/manifest.ts`) with a process-lifetime memo. The design is fully locked by
D-01..D-04; the only genuinely open question -- how to make the read/parse/validate
path observable for the CACHE-01 single-parse proof -- has a clean, verified answer:
**an injectable counting loader passed into `createManifestCache(loader)`**. I built
a proof-of-concept of the entire design (factory, per-read `stat`-keying,
by-reference hits, negative caching with same-instance re-throw, stat-failure
fall-through) and all four behavioral arms pass.

Two landmines drove most of the investigation. First, **`node:test`'s `t.mock.method`
cannot mock the `readFile` named export of `node:fs/promises`** -- ESM namespace
bindings are non-configurable (verified: `Cannot redefine property: readFile`). So
the CACHE-01 spy must NOT mock `readFile`. (`MARKETPLACE_VALIDATOR.Check` and
`JSON.parse` *are* mockable as configurable object methods, but spying shared module
state or a global is brittle -- the injectable loader is strictly cleaner and is what
D-01's constructed-instance shape was designed to enable.) Second, the
**same-millisecond-rewrite** concern: `(mtimeMs, size)` can theoretically collide if
a file is rewritten within the filesystem's mtime resolution with an identical byte
length. On the dev box (Fedora, sub-ms `mtimeMs` resolution) a same-size rewrite
*did* bump `mtimeMs`, but this is filesystem-dependent and must be treated as a
documented, accepted residual risk (it matches today's uncached behavior only in
that the CLI is human-driven; see Pitfall 3) -- NOT a reason to add content hashing
(explicitly a Non-Goal).

The single-seam gate (`tests/architecture/manifest-read-seam.test.ts`) keys on
`readFile(...marketplace.json)` literals inside `extensions/**` only. The cache adds
a `stat`, never a `readFile`, so both an in-seam implementation and a
`domain/manifest-cache.ts` sibling that delegates to an injected loader are
gate-safe (verified against the gate's regex and folder-scope). There is a strong
in-repo precedent for a sibling cache module: `shared/completion-cache.ts` already
implements a memoized cache receiving an injected rebuild callback and exposing a
`__resetCacheForTests()` seam.

**Primary recommendation:** Implement `createManifestCache(loadOnce)` taking an
injected loader (the real read+parse+validate, kept inside `domain/manifest.ts` so
the only `readFile(...marketplace.json)` stays at the seam). Hold one module-level
singleton; `loadMarketplaceManifest` delegates. Key a `Map<string, Entry>` by path;
each `load` does one `stat`, compares `(mtimeMs, size)`, serves by-reference on hit
or re-throws the cached `Error` on a negative hit, and on miss/change/stat-failure
falls through to the injected loader. Place the cache logic in a
`domain/manifest-cache.ts` sibling (cleanest test isolation per D-01) OR in-seam;
both pass the gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read + parse + validate `marketplace.json` | Domain (`domain/manifest.ts`) | -- | Already the sole manifest-read seam (NFR-8, Phase 7 / Plan 07-02). The `readFile(...marketplace.json)` MUST stay here to keep CACHE-06 green. |
| Memoize the load result `(mtimeMs,size)`-keyed | Domain (`domain/manifest-cache.ts` sibling, or in-seam) | -- | Pure in-process logic; no upward imports; `domain/` may import `node:fs/promises` for `stat` (it already does for `readFile`). |
| Invalidation (passive `stat` per read) | Domain (cache) | -- | Self-contained in the cache; write sites stay cache-unaware (D-02, Non-Goal "no invalidate-on-write coupling"). |
| Consume the manifest (read-only) | Orchestrators / edge (9 call sites) | -- | Unchanged; they read `.name` / `.plugins` / extra raw fields. By-reference is safe (D-03). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` (`stat`) | bundled (Node 22.22.2) | Per-read `stat` for `(mtimeMs, size)` invalidation | Built-in; `domain/manifest.ts` already imports from it. `Stats.mtimeMs` and `Stats.size` are both `number` [VERIFIED: `node -e` probe in this session]. |
| `node:test` (`t.mock.method`, `mock.fn`) | bundled | CACHE-01 spy via injectable counting loader; per-test isolation | Project's chosen runner [CITED: CLAUDE.md]. Note the `readFile` mock limitation (Pitfall 1). |
| `typebox` / `typebox/compile` | `^1.1.38` | `MARKETPLACE_VALIDATOR` runs inside the seam's loader | Unchanged; the cache memoizes the post-validate result so a hit skips `.Check()` [CITED: domain/manifest.ts]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | **No new runtime dependency.** `stat` is built-in. [VERIFIED: REQUIREMENTS.md / CLAUDE.md -- "cache adds no I/O beyond a `stat`"] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Injectable counting loader (CACHE-01 spy) | `t.mock.method(JSON, "parse")` or `t.mock.method(MARKETPLACE_VALIDATOR, "Check")` | Both ARE mockable (verified), but `JSON.parse` is process-global (too broad, leaks across tests) and `MARKETPLACE_VALIDATOR.Check` is shared module state (brittle). The injected loader is isolated, exact, and is what D-01 was designed for. |
| Injectable counting loader | `t.mock.method(fsPromises, "readFile")` | **Not possible** -- ESM namespace binding is non-configurable: `Cannot redefine property: readFile` [VERIFIED: `node --test` probe]. Would also be the wrong observable (we want to prove *parse/validate* skipped, not just read). |
| `Map<string, Entry>` keyed by path | Composite string key `` `${mtimeMs}:${size}` `` as the map key | Composite-as-map-key forces a lookup-then-compare dance and can't represent "same path, changed stat → invalidate"; the per-path entry struct holding `(mtimeMs,size)` is the natural shape. Minor (D-04 / CONTEXT discretion). |

**Installation:** None -- no package changes. `package.json` untouched.

## Package Legitimacy Audit

> Not applicable -- this phase installs **no** external packages. All dependencies
> are Node built-ins (`node:fs/promises`, `node:test`) and an already-present peer
> (`typebox`). slopcheck N/A.

## Architecture Patterns

### System Architecture Diagram

```
 9 callers (orchestrators/, edge/)
   list.ts / info.ts / install.ts / update.ts / reinstall.ts / add.ts / edge-deps.ts ...
        │   await loadMarketplaceManifest(manifestPath)   ← signature UNCHANGED
        ▼
 ┌─────────────────────────── domain/manifest.ts (the seam) ───────────────────────────┐
 │  export async function loadMarketplaceManifest(path):                                │
 │      return manifestCacheSingleton.load(path)        ← delegates (D-01)              │
 │                                                                                      │
 │  const loadOnce = async (path) => {                  ← the INJECTED loader           │
 │      const raw = await readFile(path, "utf8");       ← ONLY readFile(marketplace.json│
 │      const parsed = JSON.parse(raw);                 │   in the whole repo (CACHE-06)│
 │      if (!MARKETPLACE_VALIDATOR.Check(parsed)) throw ...                             │
 │      return parsed;                                  ← RAW JSON.parse value (WR-01)  │
 │  }                                                                                   │
 │  const manifestCacheSingleton = createManifestCache(loadOnce)                        │
 └──────────────────────────────────────┬───────────────────────────────────────────--┘
                                         │
        ┌────────────────────────────────▼─────────────────────────────────┐
        │ domain/manifest-cache.ts (sibling)  -- createManifestCache(loader) │
        │   Map<path, { mtimeMs, size, ok, value?|error? }>                 │
        │                                                                   │
        │   load(path):                                                     │
        │     stat(path) ──fail──► loader(path)  (D-02 fall-through, NOT    │
        │        │ ok                              negative-cached)         │
        │        ▼                                                          │
        │     entry = map.get(path)                                         │
        │     hit && mtimeMs==&& size== ?                                   │
        │        ├─ ok    → return entry.value      (D-03 by-reference)     │
        │        └─ !ok   → throw entry.error       (D-03 same instance)    │
        │     else (miss/changed):                                          │
        │        try   value = await loader(path); store ok-entry; return  │
        │        catch err;  store neg-entry; throw err   (CACHE-05)        │
        └───────────────────────────────────────────────────────────────---┘
```

### Recommended Project Structure
```
extensions/pi-claude-marketplace/domain/
├── manifest.ts          # the seam: holds the loader (readFile+parse+validate),
│                        #   the singleton, and the delegating loadMarketplaceManifest
└── manifest-cache.ts    # NEW (recommended): createManifestCache(loader) factory.
                         #   Pure logic: stat + (mtimeMs,size) compare + Map. No
                         #   readFile(...marketplace.json) → gate-safe.
```
(In-seam -- folding the cache directly into `manifest.ts` with no new file -- is
equally gate-safe; the sibling is recommended only for cleaner test isolation and to
mirror `shared/completion-cache.ts`. See Open Question 1.)

### Pattern 1: Process-lifetime memo, never touches disk (CACHE-03)
**What:** The cache state is a single in-memory `Map`. The only filesystem call it
adds is `stat`. No write, no sidecar, no scope-root file.
**When to use:** Always -- this is the whole phase.
**Example:** see Code Examples / "createManifestCache".

### Pattern 2: Injectable loader as the CACHE-01 observability seam
**What:** `createManifestCache` takes the real loader as a constructor argument.
Production passes `loadOnce` (read+parse+validate). Tests pass a counting wrapper
`(p) => { calls++; return realLoader(p); }` and assert `calls === 1` across N reads.
**When to use:** The CACHE-01 single-parse proof, and any test asserting hit/miss
counts. This is the resolution of the open discretion item.
**Why this over mocking:** `t.mock.method` cannot touch `readFile` (Pitfall 1);
mocking `JSON.parse`/`MARKETPLACE_VALIDATOR.Check` is brittle. The injected loader
is exact and isolated, and the constructed-instance shape (D-01) already affords it.
**Example:** see Code Examples / "CACHE-01 single-parse test".

### Pattern 3: Per-read `stat` + `(mtimeMs, size)` compare (CACHE-02)
**What:** On **every** `load`, `stat` first; compare both `mtimeMs` and `size`
against the stored entry. Equal on both ⇒ serve cached. Differ on either ⇒ reload.
This runs on hits too (not just misses), so in-process atomic tmp+rename and
external rewrites are both caught without any write-site hook.
**When to use:** Always.
**Landmine:** same-tick rewrite with identical size -- see Pitfall 3.

### Pattern 4: Negative caching keyed by the same discriminator (CACHE-05)
**What:** When the loader throws, store a negative entry `{ mtimeMs, size, ok:false,
error }`. On a subsequent read with matching `(mtimeMs, size)`, **re-throw the same
`Error` instance** (no re-parse). A `(mtimeMs, size)` change discards it and
re-attempts. The soft-load consumer reads only `.message`, so same-instance
re-throw is behaviorally identical to the uncached throw.
**When to use:** The parse/validate-failure path.

### Anti-Patterns to Avoid
- **Mocking `readFile` for the CACHE-01 proof:** impossible on the ESM namespace
  (Pitfall 1) and the wrong observable. Use the injected loader.
- **`structuredClone` per hit / reconstructing the `Error`:** re-introduces the
  per-hit cost the cache removes (D-03 explicitly rejects this).
- **Negative-caching `stat` failures:** D-02 forbids it -- a stale error would
  survive after the file reappears. Stat-fail = pure miss, fall through.
- **Switching the seam from raw `JSON.parse` to `.Parse()`/`.Clean()`:** would
  rewrite key order and drop extra fields, breaking `update.ts`'s content-key
  comparison (WR-01) and `info.ts`'s `parsed.description` extra-field read. The
  cache must return the **raw** value by reference.
- **Adding a write-site invalidation hook:** Non-Goal; passive `stat` is the design.
- **Adding content-hash invalidation:** Non-Goal; would re-read file bytes every
  check, defeating the cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cold-start / per-test isolation | An exported `__resetManifestCache()` reset hook on the module surface | A `createManifestCache()` **factory** + fresh instances in tests (D-01) | The factory gives a guaranteed cold instance without leaking a reset hook into the public module surface. `shared/completion-cache.ts` uses the reset-hook style for a process-global map; D-01 deliberately chose the cleaner factory here. |
| Read/parse/validate observability | A `t.mock.method` of `readFile` / `JSON.parse` | An injected counting loader (Pattern 2) | `readFile` is unmockable on the ESM namespace; `JSON.parse` mock is process-global. |
| mtime/size extraction | Manual `fs.statSync` + field plucking, or `mtime` (Date) math | `await stat(path)` → `.mtimeMs` (number) + `.size` (number) | `mtimeMs` is the float-ms field intended for comparison; `mtime` (a `Date`) has coarser equality semantics. |

**Key insight:** Almost nothing here should be "built" -- the phase is a ~40-line
memo around an existing seam. The risk is entirely in *test observability* (solved by
the injected loader) and *invalidation correctness* (solved by per-read `stat` +
documenting the same-tick residual risk).

## Runtime State Inventory

> This is a code-only, additive change (a new in-process cache behind an existing
> seam). It writes **no** persistent state, renames nothing, and migrates nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- the cache is in-memory only (CACHE-03). No datastore key, collection, or record references it. | None -- verified by REQUIREMENTS.md Non-Goals (no on-disk/persisted cache) and the in-memory `Map` design. |
| Live service config | None -- no external service, dashboard, or tunnel involved. | None -- verified: phase touches only `domain/manifest.ts` (+ optional sibling). |
| OS-registered state | None -- no Task Scheduler / pm2 / systemd registration embeds anything here. | None -- verified: pure library code, no process registration. |
| Secrets/env vars | None -- no env var or secret name references the cache. | None -- verified by grep: no env reads added; `stat` needs no config. |
| Build artifacts / installed packages | None -- no `package.json` change, no new dependency, no egg-info/build output. | None -- verified: zero install footprint (built-ins only). |

**Canonical question -- "after every file is updated, what runtime systems still
have old state cached/stored/registered?":** Nothing. The cache exists only for a
process lifetime and is cold after `/reload` by construction (CACHE-03).

## Common Pitfalls

### Pitfall 1: `t.mock.method` cannot mock `readFile` (ESM namespace is non-configurable)
**What goes wrong:** A naive CACHE-01 test does
`t.mock.method(await import("node:fs/promises"), "readFile")` and crashes with
`TypeError: Cannot redefine property: readFile`.
**Why it happens:** ESM namespace object properties are non-writable /
non-configurable; `t.mock.method` requires a configurable property.
**How to avoid:** Use the **injected counting loader** (Pattern 2). Do not mock
`readFile`. (Confirmed in this session: the mock throws.) Note that
`t.mock.method(JSON, "parse")` and `t.mock.method(MARKETPLACE_VALIDATOR, "Check")`
*do* succeed -- but both are rejected as brittle (global / shared module state).
**Warning signs:** Any test plan that says "mock `readFile`" -- redirect to the
injected loader.

### Pitfall 2: Returning `.Parse()`/cloned value instead of the raw `JSON.parse` value
**What goes wrong:** "Optimizing" the seam to return `MARKETPLACE_VALIDATOR.Parse()`
or a `structuredClone` silently reorders keys and strips extra fields. `update.ts`'s
`manifestContentKey` (`JSON.stringify(parsed)`) flips no-op vs changed; `info.ts`
loses `parsed.description` (an extra field not in the schema).
**Why it happens:** The validator's `.Parse()` normalizes; the cache hit must be
byte-and-shape identical to today's path.
**How to avoid:** Loader returns the raw `JSON.parse` value; cache returns it **by
reference** (D-03). Add the read-only invariant comment at the seam.
**Warning signs:** Catalog-UAT byte mismatch, or `update.ts` autoupdate no-op tests
flipping to `(updated)`.

### Pitfall 3: Same-tick rewrite with identical size -- the `(mtimeMs, size)` collision
**What goes wrong:** A file rewritten within the filesystem's mtime resolution, to
an identical byte length, produces an identical `(mtimeMs, size)` ⇒ the cache serves
the stale entry and never re-reads.
**Why it happens:** `mtimeMs` resolution is filesystem-dependent. `size` is the
tiebreaker, but a same-length edit defeats it.
**Reality check (this session):** On Fedora/ext4, two back-to-back `writeFile`s of
identical 25-byte content produced **different** `mtimeMs` (…711 vs …714, ~3 ms
apart; sub-ms fractional resolution). So on the dev box the collision did NOT occur.
But this is **not portable** -- coarse-resolution filesystems (some network/older FS)
could collide.
**How to avoid / accept:** This is an **accepted residual risk**, consistent with
the milestone's deliberate choice of `(mtimeMs, size)` over content hashing
(REQUIREMENTS.md Non-Goals: "`(mtimeMs, size)` is sufficient for a human-driven
CLI"). Do **not** add hashing. In-process rewrites go through atomic tmp+rename which
changes the inode's mtime; the human-driven cadence makes a true sub-resolution
same-size collision practically unreachable. **Document this explicitly** in the
cache module and in VERIFICATION so it's a known, owned limitation rather than a
silent bug. Do not write a test that depends on two same-ms writes producing
different mtimes (it would be flaky -- see Pitfall 4).
**Warning signs:** A flaky CACHE-02 test; a reviewer asking "what if mtime doesn't
change?".

### Pitfall 4: Flaky CACHE-02 tests from racing the clock
**What goes wrong:** A test that writes, reads, immediately rewrites with the *same
content/size*, and asserts a reload -- may pass or fail depending on FS mtime
resolution.
**How to avoid:** Make CACHE-02 tests deterministic by **changing `size`** (write a
manifest with a different byte length: add/remove a plugin entry or pad a field), OR
by asserting against an explicitly-different `mtimeMs` using a controlled write. The
POC's CACHE-02 arm changes size and is deterministic. Test both arms required by
SC#2: success→success invalidation **and** failure→success invalidation.
**Warning signs:** CI flake on the invalidation test.

### Pitfall 5: Concurrent `load(path)` of a cold entry (in-flight de-dup)
**What goes wrong:** Two `await cache.load(p)` calls race before the first
populates the entry; both run the loader (double parse). Strictly this still
produces correct results (last write wins, both return valid manifests) and the
single-threaded event loop means the `stat`/`Map` ops don't interleave mid-statement
-- but two concurrent *first* reads each `await loader` before either stores.
**Why it happens:** `await loader(p)` yields the event loop between the miss check
and the `map.set`.
**How to avoid:** Optional and **out of scope for the locked design** -- D-04 says
unbounded, simple. The 9 call sites are sequential within each command (no parallel
`list` of the same manifest in one tick). If a reviewer raises it, the mitigation is
to memoize the in-flight `Promise` in the entry, but the CONTEXT decisions don't ask
for it and CACHE-01 ("repeated read … returns cached") is about *sequential* repeat
reads. **Recommendation:** note it as a deliberate non-requirement; don't add
promise-dedup unless a call site proves concurrent same-path loads.
**Warning signs:** A CACHE-01 test that fires `Promise.all([load,load,load])` and
asserts 1 parse -- that would (correctly) fail; the spec's "repeated read" is
sequential. Keep the CACHE-01 test sequential (`await` each).

### Pitfall 6: Test isolation against the production singleton
**What goes wrong:** A test that calls the real `loadMarketplaceManifest` (which uses
the module singleton) leaks cache state across tests, making counts non-deterministic.
**How to avoid:** Per D-01, tests construct a **fresh** `createManifestCache(...)`
instance and call `instance.load(...)` directly -- they do NOT go through the
singleton. The existing `tests/domain/manifest.test.ts` already uses per-test
`mkdtemp` + `writeFile` (model this). The two pre-existing seam tests that DO call
`loadMarketplaceManifest` keep working unchanged (each uses a unique tmpdir path, so
the singleton's per-path entry never collides across those two tests).
**Warning signs:** Test order dependence; counts off by the number of prior tests.

## Code Examples

### createManifestCache factory (recommended shape -- verified by POC)
```typescript
// domain/manifest-cache.ts   (sibling; gate-safe -- no readFile(...marketplace.json))
import { stat } from "node:fs/promises";

interface ManifestCacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly ok: boolean;
  readonly value?: unknown;   // raw JSON.parse value on success (D-03 by-reference)
  readonly error?: Error;     // cached Error instance on failure (D-03 re-throw)
}

/** Loader = the real read+parse+validate, injected so it stays in domain/manifest.ts
 *  (keeps the sole readFile(...marketplace.json) at the seam → CACHE-06) and is
 *  swappable with a counting wrapper in tests (→ CACHE-01). */
export type ManifestLoader = (manifestPath: string) => Promise<unknown>;

export function createManifestCache(load: ManifestLoader): {
  load(manifestPath: string): Promise<unknown>;
} {
  const entries = new Map<string, ManifestCacheEntry>();

  return {
    async load(manifestPath: string): Promise<unknown> {
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(manifestPath);
      } catch {
        // D-02: stat failure = pure miss → real load; natural error propagates
        //       byte-identically. NOT negative-cached.
        return load(manifestPath);
      }

      const hit = entries.get(manifestPath);
      if (hit !== undefined && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
        if (hit.ok) {
          return hit.value;          // CACHE-01 hit, D-03 by-reference
        }
        throw hit.error;             // CACHE-05 negative hit, D-03 same instance
      }

      // Miss or (mtimeMs|size) change → reload + refresh (CACHE-02).
      try {
        const value = await load(manifestPath);
        entries.set(manifestPath, { mtimeMs: st.mtimeMs, size: st.size, ok: true, value });
        return value;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        entries.set(manifestPath, { mtimeMs: st.mtimeMs, size: st.size, ok: false, error });
        throw error;                 // CACHE-05 negative entry stored + thrown
      }
    },
  };
}
```

### Seam delegation (domain/manifest.ts) -- loader kept here so the gate stays green
```typescript
// domain/manifest.ts
import { readFile } from "node:fs/promises";
import { createManifestCache } from "./manifest-cache.ts";
// ... MARKETPLACE_SCHEMA / MARKETPLACE_VALIDATOR unchanged ...

// The ONLY readFile(...marketplace.json) in the repo (CACHE-06). Returns the RAW
// JSON.parse value (WR-01) -- callers MUST treat the result as READ-ONLY (D-03).
async function loadMarketplaceManifestUncached(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}` : "(no detail)";
    throw new Error(`marketplace.json schema invalid: ${detail}`);
  }
  return parsed;
}

const manifestCache = createManifestCache(loadMarketplaceManifestUncached);

/** NFR-8 / D-14 single domain seam. Now memoized (process-lifetime, (mtimeMs,size)-
 *  keyed, negative-caching). Result is READ-ONLY (D-03 by-reference). */
export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  return manifestCache.load(manifestPath) as Promise<MarketplaceManifest>;
}
```

### CACHE-01 single-parse test (injected counting loader -- verified)
```typescript
// tests/domain/manifest-cache.test.ts
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createManifestCache } from "../../extensions/pi-claude-marketplace/domain/manifest-cache.ts";

test("CACHE-01: N sequential reads of an unchanged manifest → loader runs once", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-cache-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, JSON.stringify({ name: "a", plugins: [] }), "utf8");

    let calls = 0;
    const value = { name: "a", plugins: [] };
    const cache = createManifestCache(async () => { calls++; return value; });

    const r1 = await cache.load(p);
    const r2 = await cache.load(p);
    const r3 = await cache.load(p);

    assert.equal(calls, 1, "read/parse/validate path ran exactly once across 3 reads");
    assert.equal(r1, r2);            // D-03 by-reference identity on hit
    assert.equal(r2, r3);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
```

### CACHE-05 negative-cache + error-equivalence (verified)
```typescript
test("CACHE-05: bad manifest negative-cached; same Error re-thrown; message stable", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-neg-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, "{ not json", "utf8");           // size won't change between reads
    let calls = 0;
    const cache = createManifestCache(async () => {
      calls++;
      throw new Error("marketplace.json schema invalid: <root>: Unexpected token");
    });
    const e1 = await cache.load(p).then(() => null, (e: unknown) => e);
    const e2 = await cache.load(p).then(() => null, (e: unknown) => e);
    assert.equal(calls, 1, "negative entry serves second read with no re-parse");
    assert.equal(e1, e2, "same Error instance re-thrown");          // D-03
    assert.equal((e1 as Error).message, (e2 as Error).message);     // soft-load reads .message only
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
```
Error-equivalence bar (CACHE-05) is defined against `loadMarketplaceManifestSoftly`
in `list.ts`, which catches and stores `errorMessage(err)` -- i.e. it consumes only
`err.message` [CITED: shared/errors.ts `errorMessage`; orchestrators/plugin/list.ts
:434-442]. Re-throwing the same instance is therefore exactly behaviorally
equivalent.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-`list`/`info` re-read+re-parse+re-validate of `marketplace.json` | Process-lifetime memo behind the existing seam, `(mtimeMs,size)`-keyed | This phase (NFR-8 realization) | Removes redundant parse/validate on hot read paths; byte-identical output. |
| (n/a -- no prior cache at this seam) | `createManifestCache(loader)` factory + module singleton | This phase | Mirrors the in-repo `shared/completion-cache.ts` injected-callback cache pattern. |

**Deprecated/outdated:** None. The seam comment in `domain/manifest.ts` already
anticipates this wrap ("Future mtime-based caching wraps this function") -- that
comment should be updated to past/present tense when the cache lands.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 9 callers consume the manifest strictly read-only (no mutation of the returned object), so by-reference sharing (D-03) is safe. | D-03 / Don't Hand-Roll | If any caller mutated the object, a later hit would serve mutated state. **Mitigation:** verified by grep this session -- no `.name =` / `.plugins =` / index-assignment on any returned manifest found; CONTEXT already asserts this from a prior grep. LOW risk. |
| A2 | Same-tick same-size rewrites are practically unreachable for a human-driven CLI, so `(mtimeMs,size)` is a sufficient discriminator. | Pitfall 3 | A coarse-resolution FS could serve a stale manifest after a same-size rewrite within one mtime tick. **Mitigation:** documented accepted residual risk, matching REQUIREMENTS.md Non-Goal rationale; not a code defect to fix here. MEDIUM risk, ACCEPTED by milestone scope. |

**Note:** A1 and A2 are not new decisions -- they restate the basis of locked
decisions D-03 and the milestone's `(mtimeMs,size)` choice. No user re-confirmation
needed; listed for the planner's awareness.

## Open Questions

1. **Sibling module (`domain/manifest-cache.ts`) vs in-seam implementation?**
   - What we know: The single-seam gate scans **only** `extensions/**` for
     `readFile(...marketplace.json)` within a 400-char window; it does NOT match
     `stat(...)`. A sibling that does `stat` + delegates to an injected loader, OR
     an in-seam implementation, both pass [VERIFIED: ran the gate's regex against
     both shapes this session]. Intra-`domain/` imports are unrestricted by the
     `import-x/no-restricted-paths` rules (they govern cross-folder edges only)
     [CITED: eslint.config.js BLOCK C].
   - What's unclear: Pure style preference.
   - Recommendation: **Sibling `domain/manifest-cache.ts`** -- cleanest CACHE-01 test
     isolation (import `createManifestCache` directly without dragging the whole seam
     module / singleton), and it mirrors `shared/completion-cache.ts`. In-seam is an
     acceptable fallback if the planner prefers zero new files. Either way, the
     `readFile` MUST remain in `domain/manifest.ts`.

2. **In-flight de-dup for concurrent same-path `load` (Pitfall 5)?**
   - What we know: Call sites are sequential per command; CACHE-01's "repeated read"
     is sequential; D-04 favors simplicity.
   - What's unclear: Whether any future parallel path loads the same manifest twice
     in one tick.
   - Recommendation: **Do not add** promise-dedup now; note it as a deliberate
     non-requirement. Keep the CACHE-01 test sequential (await each load).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`node:fs/promises stat`, `node:test`) | the entire phase | ✓ | v22.22.2 | -- |
| `typebox` / `typebox/compile` | `MARKETPLACE_VALIDATOR` (unchanged, inside loader) | ✓ | present (peer) | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node v22.22.2 native TS strip |
| Config file | none -- invoked via the `test` npm script glob |
| Quick run command | `node --test "tests/domain/manifest-cache.test.ts" "tests/domain/manifest.test.ts"` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + `npm test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-01 | N sequential reads of unchanged manifest → loader/parse/validate runs **once**; by-reference identity on hits | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 (new) |
| CACHE-02 (success→success) | change `size` (or mtime) between reads → reload + new value | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 |
| CACHE-02 / CACHE-05 (failure→success) | a prior **negative** entry is discarded on `(mtimeMs,size)` change; next read re-attempts and succeeds | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 |
| CACHE-05 (negative caching) | repeated reads of unchanged bad file → re-throw **same** instance, **no** re-parse; `.message` equal to uncached throw | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 |
| D-02 (stat-fail) | ENOENT/EACCES on `stat` → pure miss → real loader (natural error), **not** negative-cached (loader runs every time) | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 |
| CACHE-03 | freshly constructed cache starts empty (first `load` is a miss / loader runs); no file written | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ Wave 0 |
| CACHE-06 | `loadMarketplaceManifest` remains the sole `readFile(...marketplace.json)`; single-seam gate green | architecture | `node --test tests/architecture/manifest-read-seam.test.ts` | ✅ exists (must stay green) |
| CACHE-04 | byte-identical user-visible output across the catalog | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ exists (must stay green) |
| CACHE-04 (full gate) | typecheck + lint + format + all tests | gate | `npm run check` | ✅ exists |

### Sampling / Observability Seam per requirement
- **CACHE-01:** *Spied:* the **injected loader** (counting wrapper passed to
  `createManifestCache`). *Asserted:* `calls === 1` across N sequential `await`
  reads; `r1 === r2 === r3` (reference identity). This is the only clean way -- see
  Pitfall 1 (cannot spy `readFile`).
- **CACHE-02:** *Spied:* same injected loader. *Asserted:* `calls` increments after a
  `size`-changing rewrite (deterministic; avoid same-size to dodge Pitfall 3/4), and
  the returned value reflects the new content. Cover **both** arms: prior-success→
  reload, and prior-failure(negative)→reload-success.
- **CACHE-05:** *Spied:* injected loader that throws. *Asserted:* loader `calls === 1`
  across two reads of the unchanged bad file; the two caught errors are the **same
  instance** (`assert.equal(e1, e2)`) and have equal `.message`. Optionally cross-
  check that `errorMessage(e1) === errorMessage(e2)` to mirror the soft-load
  consumer.
- **D-02 stat-fail:** *Spied:* injected loader. *Asserted:* with a nonexistent path,
  loader runs on **every** read (`calls === 2` for two reads) -- proving stat-fail is
  a pure miss, not negative-cached -- and the propagated error carries the original
  `code` (e.g. `ENOENT`).
- **CACHE-03/CACHE-06:** *Spied:* the single-seam gate (static scan of `extensions/**`).
  *Asserted:* gate's `offenders` array stays empty (no new `readFile(...marketplace
  .json)`); a freshly constructed cache's first read is a miss.
- **CACHE-04:** *Spied:* `catalog-uat`'s `ctx.ui.notify` mock (byte capture).
  *Asserted:* byte-equality across the full catalog **and** the existing
  `tests/domain/manifest.test.ts` seam tests still pass (they call the real
  singleton-backed `loadMarketplaceManifest` through unique tmpdir paths). Then full
  `npm run check`.

### Test Landmines (call out in VERIFICATION)
- **mtime resolution (Pitfall 3/4):** Do NOT write a test that rewrites the same
  byte length and expects an mtime change -- flaky across filesystems. Drive CACHE-02
  off a **size** change (add/remove a plugin entry or pad a field). Document the
  same-tick same-size collision as an accepted residual risk (Non-Goal: no hashing).
- **`readFile` is unmockable (Pitfall 1):** any plan step that says "mock readFile"
  is wrong -- use the injected loader.
- **Singleton leakage (Pitfall 6):** unit tests must construct a **fresh**
  `createManifestCache(...)` instance, not route through the module singleton.
- **Concurrent same-path load (Pitfall 5):** keep CACHE-01 sequential (`await` each
  read), not `Promise.all`.

### Wave 0 Gaps
- [ ] `tests/domain/manifest-cache.test.ts` -- new file covering CACHE-01, CACHE-02
  (both arms), CACHE-05, CACHE-03, and the D-02 stat-fail path, using the injected
  counting loader + `mkdtemp`/`writeFile` harness mirrored from
  `tests/domain/manifest.test.ts`.
- [ ] (No new conftest/fixtures needed; the tmpdir+writeFile pattern is inline.)
- [ ] No framework install required -- `node:test` is built-in.

*(`tests/architecture/manifest-read-seam.test.ts` and
`tests/architecture/catalog-uat.test.ts` already exist and must stay green -- no new
work beyond keeping them passing.)*

## Security Domain

> `security_enforcement` is not present in `.planning/config.json`. This phase adds
> **no** new external input surface, network call, or data sink -- it adds one `stat`
> on a path the seam already reads. ASVS impact is therefore minimal; the relevant
> guarantees are *preservation* of existing controls, not new ones.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (preserved) | `MARKETPLACE_VALIDATOR` (TypeBox JIT) still runs inside the loader on every cold/changed read; the cache memoizes the **post-validate** result, so a hit never serves unvalidated content. NFR-12 forward-compat parser unaffected. |
| V12 File / Resource | yes (preserved) | Cache adds only a `stat` on the same path the seam reads -- no new file/path surface; containment (NFR-10) and no-network (NFR-5) hold. |
| V2/V3/V4/V6 (auth/session/access/crypto) | no | No auth, session, access-control, or crypto surface in this phase. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale-manifest serving after external edit (same-tick same-size) | Tampering / staleness | `(mtimeMs,size)` per-read `stat`; residual same-tick risk documented + accepted (human-driven CLI; hashing is a Non-Goal). |
| Serving unvalidated content on a hit | Tampering | Memoize only the post-`MARKETPLACE_VALIDATOR.Check` value; negative entries cache the throw, never a partially-validated object. |
| TOCTOU between `stat` and `readFile` | Tampering | Benign here: on a race the worst case is one extra reload (size/mtime mismatch → loader runs); never a containment or validation bypass. |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- the seam, `MARKETPLACE_VALIDATOR`, raw-`JSON.parse` return, the "future caching wraps this" comment.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` -- in-repo precedent: memoized cache with injected rebuild callback + `__resetCacheForTests()` seam + Node-22-floor rationale (avoids `t.mock.timers`).
- `tests/architecture/manifest-read-seam.test.ts` -- the single-seam gate; regex (`readFile|fs.readFile … marketplace.json`), `extensions/**`-only scope, `domain/manifest.ts` allowlist [VERIFIED: ran regex against stat-only + injected-loader shapes -- neither trips].
- `tests/persistence/migrate.test.ts:109` -- in-repo `t.mock.method(console, "warn", …)` precedent.
- `tests/domain/manifest.test.ts` -- existing tmpdir+writeFile seam-test harness to mirror.
- `orchestrators/plugin/list.ts:434-442` (`loadMarketplaceManifestSoftly`) + `shared/errors.ts` (`errorMessage`) -- CACHE-05 error-equivalence consumes only `.message`.
- `orchestrators/marketplace/update.ts:283-329` (WR-01) -- seam returns raw `JSON.parse`; basis for D-03 by-reference.
- `orchestrators/marketplace/info.ts:68` -- reads `parsed.description` (extra field absent from schema) → confirms raw value must be preserved.
- `eslint.config.js` BLOCK C -- `import-x/no-restricted-paths` governs cross-folder edges; intra-`domain/` sibling import is unrestricted; `domain/` may import `node:fs/promises`.
- In-session probes (Node v22.22.2): `t.mock.method` on `node:fs/promises.readFile` throws `Cannot redefine property: readFile`; on `JSON.parse` and `MARKETPLACE_VALIDATOR.Check` succeeds; `Stats.mtimeMs`/`Stats.size` are `number`; same-size back-to-back rewrite changed `mtimeMs` (~3 ms) on ext4; **full POC of createManifestCache passed all 4 behavioral arms**.

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` (CACHE-01..06 + Non-Goals) and `.planning/ROADMAP.md` Phase 45 (goal + 5 SCs) -- authoritative on locked behavior.
- `.planning/phases/45-manifest-in-memory-cache/45-CONTEXT.md` (D-01..D-04) -- locked decisions.

### Tertiary (LOW confidence)
- None -- every load-bearing claim was verified by an in-session probe, the POC, or a direct source read.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- built-ins only, no new deps; versions probed in-session.
- Architecture: HIGH -- design fully locked (D-01..D-04) and proven end-to-end by a passing POC; gate behavior verified against its own regex.
- Pitfalls: HIGH -- the two material landmines (`readFile` unmockable; same-tick mtime) were directly reproduced/measured this session.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable; depends only on Node built-ins + existing in-repo seam, both slow-moving)
