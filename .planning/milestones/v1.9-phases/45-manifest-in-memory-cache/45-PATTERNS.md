# Phase 45: Manifest In-Memory Cache - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 3 (1 new module, 1 modified seam, 1 new test)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/manifest-cache.ts` (NEW) | utility (in-memory memo/cache) | transform (file-I/O `stat` + memoize) | `extensions/pi-claude-marketplace/shared/completion-cache.ts` | role-match (in-repo memoized cache w/ injected rebuild callback) -- see divergence note |
| `extensions/pi-claude-marketplace/domain/manifest.ts` (MODIFIED) | domain seam (read/parse/validate chokepoint) | file-I/O (read + validate) | itself (current `loadMarketplaceManifest` shape) | exact (wrap-in-place; the loader body is unchanged) |
| `tests/domain/manifest-cache.test.ts` (NEW) | test (unit) | request-response (tmpdir harness + injected counting loader) | `tests/domain/manifest.test.ts` | exact (mkdtemp + writeFile + per-test isolation harness) |

**Note -- file placement:** RESEARCH Open Question 1 confirms a `domain/manifest-cache.ts` sibling is the recommended placement (cleanest CACHE-01 test isolation; mirrors `shared/completion-cache.ts`). In-seam (folding the cache into `manifest.ts` with no new file) is an equally gate-safe fallback. Either way, the `readFile(...marketplace.json)` MUST stay in `domain/manifest.ts` (CACHE-06).

## Pattern Assignments

### `domain/manifest-cache.ts` (utility, transform -- NEW)

**Analog:** `extensions/pi-claude-marketplace/shared/completion-cache.ts`

**Why this analog:** It is the only in-repo memoized cache that receives an **injected rebuild callback** (rather than reaching for its dependencies directly) and keys an in-memory `Map`. It is the structural precedent for `createManifestCache(loader)`.

**KEY DIVERGENCE from the analog (must call out in the plan):** `completion-cache.ts` uses **module-global maps** plus an exported **`__resetCacheForTests()`** seam for per-test isolation (lines 106-110, 402-405). CONTEXT.md **D-01 deliberately rejects** that shape for this phase: use a **`createManifestCache()` factory** returning an object that **owns its own `Map`** (constructed instances), so tests get a guaranteed cold start by constructing a fresh instance -- **no reset hook on the module's public surface.** Do NOT copy the `__resetCacheForTests()` pattern here.

**Injected-callback pattern to copy** (`completion-cache.ts` -- the callback is a constructor/parameter arg, not a direct dependency; signature style at lines 218-242):
```typescript
// completion-cache.ts:218-235 -- rebuild is INJECTED; the cache never reaches
// for loadState/loadMarketplaceManifest itself. Mirror this injection shape,
// but as a factory-constructor arg instead of a per-call arg.
export async function getMarketplaceNames(
  marketplaceNamesCachePath: string,
  scope: Scope,
  rebuild: () => Promise<readonly string[]>,   // <-- injected loader precedent
): Promise<readonly string[]> {
  const memHit = memMarketplaceNames.get(scope);
  if (memHit !== undefined) {
    return memHit;                              // <-- memory hit short-circuit
  }
  // ... miss -> rebuild() -> hydrate map -> return
}
```

**Map + string-key + single-threaded-no-locking convention to copy** (`completion-cache.ts:100-110`):
```typescript
// In-memory maps. Single-threaded JS event loop = no locking. Keyed by
// `${scope}` ... (string keys preferred over struct keys for hash simplicity).
const memMarketplaceNames = new Map<string /* scope */, readonly string[]>();
```
Apply the same `Map<string, Entry>` convention, keyed by `manifestPath`, with the entry struct holding `{ mtimeMs, size, ok, value?, error? }` (per-path struct, NOT a composite `${mtimeMs}:${size}` map key -- RESEARCH Standard Stack / Alternatives).

**`node:fs/promises` import convention** (named import -- `completion-cache.ts:51`, `manifest.ts:9`):
```typescript
import { stat } from "node:fs/promises";   // cache adds ONLY stat -- never readFile (CACHE-06)
```

**Target module shape** (verified-by-POC excerpt from RESEARCH Code Examples -- copy directly):
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
 *  (keeps the sole readFile(...marketplace.json) at the seam -> CACHE-06) and is
 *  swappable with a counting wrapper in tests (-> CACHE-01). */
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
        // D-02: stat failure = pure miss -> real load; natural error propagates
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

      // Miss or (mtimeMs|size) change -> reload + refresh (CACHE-02).
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

**`err instanceof Error ? err : new Error(String(err))` coercion idiom** is already the in-repo norm (`shared/errors.ts:114` `appendLeakToError`, `:124` `appendLeaks`) -- copy it for the negative-entry store.

**Module-header comment convention** (`completion-cache.ts:1-49`, `manifest.ts:1-8`): both modules open with a `//`-comment block stating purpose + the decision IDs + invariants. Write an equivalent header documenting D-01..D-04, CACHE-06 (`stat` only, no `readFile`), and the **accepted same-tick / same-size residual risk** (RESEARCH Pitfall 3 -- document it in-module so it is an owned limitation, not a silent bug).

---

### `domain/manifest.ts` (domain seam, file-I/O -- MODIFIED)

**Analog:** itself -- the current `loadMarketplaceManifest` body is preserved verbatim as the **injected loader**; only delegation is added.

**Current seam (lines 39-59) -- the read/parse/validate body to KEEP unchanged** (this stays the ONLY `readFile(...marketplace.json)` in the repo, CACHE-06):
```typescript
export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr
      ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}`
      : "(no detail)";
    throw new Error(`marketplace.json schema invalid: ${detail}`);
  }

  return parsed;   // <-- RAW JSON.parse value (WR-01) -- NOT .Parse(); return by reference
}
```
**Critical invariant (RESEARCH Pitfall 2 / D-03):** the loader MUST keep returning the **raw `JSON.parse` value** (not `MARKETPLACE_VALIDATOR.Parse()` / `.Clean()` / `structuredClone`). `.Parse()` reorders keys and drops extra fields, breaking `update.ts` `manifestContentKey` (`JSON.stringify(parsed)`) and `info.ts`'s `parsed.description` extra-field read.

**Modification pattern** (RESEARCH Code Examples -- "Seam delegation"): rename the existing body to a private loader, construct one module-level singleton, delegate:
```typescript
// domain/manifest.ts
import { readFile } from "node:fs/promises";
import { createManifestCache } from "./manifest-cache.ts";   // intra-domain import -- gate-safe (eslint BLOCK C governs cross-FOLDER edges only)
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

**Update the existing seam comment** (`manifest.ts:39-45`): the current doc says "Future mtime-based caching wraps this function." (future tense). RESEARCH State of the Art flags this -- change it to present/past tense and add the **D-03 read-only invariant** one-liner at the seam.

---

### `tests/domain/manifest-cache.test.ts` (test, unit -- NEW)

**Analog:** `tests/domain/manifest.test.ts`

**Why this analog:** It is the existing seam-test for the same module, and it already uses the exact `mkdtemp` + `writeFile` + `try/finally rm` per-test isolation harness the new cache tests mirror. It is also the file whose two pre-existing seam tests (`tests/domain/manifest.test.ts:74-106`) must **stay green** through the real singleton (each uses a unique tmpdir, so per-path entries never collide -- RESEARCH Pitfall 6).

**Import + harness convention to copy** (`manifest.test.ts:1-15` imports; `:74-91` harness):
```typescript
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
// import createManifestCache directly (NOT the singleton) for cold-start isolation (D-01 / Pitfall 6):
import { createManifestCache } from "../../extensions/pi-claude-marketplace/domain/manifest-cache.ts";
```
```typescript
// per-test tmpdir isolation pattern -- manifest.test.ts:74-91
const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-"));
try {
  const manifestPath = path.join(tmp, "marketplace.json");
  await writeFile(manifestPath, JSON.stringify({ name: "...", plugins: [] }), "utf8");
  // ... exercise + assert ...
} finally {
  await rm(tmp, { recursive: true, force: true });
}
```

**`assert.rejects` negative-path convention to copy** (`manifest.test.ts:99-102`):
```typescript
await assert.rejects(
  () => loadMarketplaceManifest(manifestPath),
  /marketplace\.json schema invalid|schema validation/i,
);
```

**CACHE-01 single-parse test -- injected counting loader** (RESEARCH Code Examples; the discretion-item resolution -- do NOT mock `readFile`, it is unmockable on the ESM namespace, RESEARCH Pitfall 1):
```typescript
test("CACHE-01: N sequential reads of an unchanged manifest -> loader runs once", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-cache-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, JSON.stringify({ name: "a", plugins: [] }), "utf8");

    let calls = 0;
    const value = { name: "a", plugins: [] };
    const cache = createManifestCache(async () => { calls++; return value; });

    const r1 = await cache.load(p);   // sequential await -- NOT Promise.all (Pitfall 5)
    const r2 = await cache.load(p);
    const r3 = await cache.load(p);

    assert.equal(calls, 1, "read/parse/validate path ran exactly once across 3 reads");
    assert.equal(r1, r2);            // D-03 by-reference identity on hit
    assert.equal(r2, r3);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
```

**CACHE-05 negative-cache + error-equivalence** (RESEARCH Code Examples; soft-load consumes only `.message` -- see Shared Patterns / Error-equivalence):
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

**Additional tests to author (same harness, per RESEARCH Test Map):**
- CACHE-02 success->success: drive invalidation off a **`size` change** (add/remove a plugin entry or pad a field) -- NOT a same-size rewrite (RESEARCH Pitfall 3/4 flakiness). Assert `calls` increments and the new value is returned.
- CACHE-02 / CACHE-05 failure->success: prior negative entry discarded on `(mtimeMs,size)` change; next read re-attempts and succeeds.
- D-02 stat-fail: nonexistent path -> loader runs on **every** read (`calls === 2` for two reads, proving stat-fail is a pure miss, NOT negative-cached); propagated error carries the original `code` (e.g. `ENOENT`).
- CACHE-03: freshly constructed cache's first `load` is a miss (loader runs); no file written.

---

## Shared Patterns

### Error-equivalence (negative-cache contract, CACHE-05)
**Source:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:434-442` (`loadMarketplaceManifestSoftly`) + `extensions/pi-claude-marketplace/shared/errors.ts:1-5` (`errorMessage`)
**Apply to:** the cache's negative-entry re-throw (D-03) and the CACHE-05 test assertion.
```typescript
// list.ts:434-442 -- the soft-load consumer reads ONLY err.message via errorMessage(err).
async function loadMarketplaceManifestSoftly(mpRecord): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    return { manifest, loadError: undefined };
  } catch (err) {
    return { manifest: undefined, loadError: errorMessage(err) };   // <-- consumes .message only
  }
}
// errors.ts:1-5
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```
**Implication:** re-throwing the **same `Error` instance** (D-03) is exactly behaviorally equivalent to the uncached throw, because the only observable the consumer touches is `.message`. The CACHE-05 test may optionally cross-check `errorMessage(e1) === errorMessage(e2)` to mirror this consumer.

### Single-seam architecture gate (CACHE-06) -- MUST STAY GREEN
**Source:** `tests/architecture/manifest-read-seam.test.ts:31-57`
**Apply to:** confirms the cache module placement is safe; no new work, just must not regress.
```typescript
// :31-34 -- the gate regex keys on readFile|fs.readFile within 400 chars of "marketplace.json".
function hasMarketplaceManifestRead(src: string): boolean {
  const readCallContext = /(?:\breadFile\b|\bfs\.readFile\b)\s*\([\s\S]{0,400}?marketplace\.json/g;
  return readCallContext.test(src);
}
// :9 -- only domain/manifest.ts is allowlisted.
const ALLOWED_RELATIVE_PATH = "domain/manifest.ts";
```
**Implication:** the gate matches `readFile(...marketplace.json)` only, scoped to `extensions/**`. The cache adds a `stat`, never a `readFile`, so `domain/manifest-cache.ts` (or in-seam) both pass. The `readFile` MUST remain in `domain/manifest.ts`.

### Import-boundary safety (intra-domain sibling import)
**Source:** `eslint.config.js:199-209` (BLOCK C `import-x/no-restricted-paths`)
**Apply to:** the `domain/manifest.ts` -> `domain/manifest-cache.ts` import.
```javascript
// :199-208 -- the rule's `from` list targets OTHER folders importing INTO domain/.
// An intra-domain/ sibling import (manifest.ts -> manifest-cache.ts) is not in any
// `from` list, so it is unrestricted. domain/ may import node:fs/promises (it
// already does for readFile; the cache adds stat).
{ target: "./extensions/pi-claude-marketplace/domain",
  from: ["./extensions/.../edge", ".../orchestrators", ".../bridges", ".../transaction", ".../persistence"],
  message: "domain/ MUST NOT import upward -- pure logic only. ..." }
```

## No Analog Found

None. Every new/modified file maps to a concrete in-repo analog:
- The cache module mirrors `shared/completion-cache.ts` (with the D-01 factory divergence noted).
- The seam modification preserves its own current loader body verbatim.
- The test mirrors `tests/domain/manifest.test.ts`.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,shared,orchestrators}/`, `tests/{domain,architecture}/`, `eslint.config.js`
**Files scanned (read in full or targeted):** `shared/completion-cache.ts`, `domain/manifest.ts`, `tests/domain/manifest.test.ts`, `tests/architecture/manifest-read-seam.test.ts`, `orchestrators/plugin/list.ts` (soft-load region), `shared/errors.ts`, `eslint.config.js` (BLOCK C)
**Pattern extraction date:** 2026-06-07
