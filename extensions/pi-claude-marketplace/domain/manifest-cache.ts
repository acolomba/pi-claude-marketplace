// domain/manifest-cache.ts
//
// NFR-8: in-memory memoization for the marketplace-manifest read seam. The real
// readFile + JSON.parse + MARKETPLACE_VALIDATOR.Check stays in domain/manifest.ts
// (CACHE-06); this module adds ONLY a `stat` per read and NEVER a `readFile`.
//
// Decisions:
//   D-01: a `createManifestCache(loader)` factory that OWNS its own Map (no
//         module-global map, and no test-only clear/reset hook on the public
//         surface). Tests get a guaranteed cold start by constructing a fresh
//         instance.
//   D-02: a `stat()` failure (ENOENT/EACCES) is a PURE MISS -- the Map is not
//         touched and the loader is invoked directly so the natural error
//         propagates byte-identically. stat failures are NOT negative-cached.
//   D-03: hits return the loaded value BY REFERENCE (no structuredClone per hit);
//         negative entries re-throw the SAME Error instance. The seam preserves
//         the raw JSON.parse value, so callers MUST treat the result as READ-ONLY.
//   D-04: unbounded -- no entry-count cap, no entry expiry/removal policy, and
//         no in-flight promise de-dup (sequential awaits only; concurrency
//         de-dup is out of scope).
//
// Invalidation is per-read (mtimeMs, size) compared against the stored entry
// (CACHE-02): any change to either field reloads and refreshes the entry,
// discarding a prior success OR a prior failure (CACHE-05 invalidation arm).
//
// Residual risk (accepted, RESEARCH Pitfall 3): a same-size rewrite within the
// filesystem's mtime resolution can collide on (mtimeMs, size) and serve a stale
// entry. This is an OWNED limitation, not a silent bug -- content hashing is a
// Non-Goal for this phase.

import { stat } from "node:fs/promises";

interface ManifestCacheStat {
  readonly mtimeMs: number;
  readonly size: number;
}

/**
 * Discriminated on `ok` so a positive entry guarantees `value` (D-03
 * by-reference) and a negative entry guarantees a non-null `error` instance
 * (D-03 re-throw) -- the re-throw never narrows to `Error | undefined`.
 */
type ManifestCacheEntry =
  | (ManifestCacheStat & {
      readonly ok: true;
      readonly value: unknown; // raw JSON.parse value on success
    })
  | (ManifestCacheStat & {
      readonly ok: false;
      readonly error: Error; // cached Error instance on failure
    });

/**
 * The real read+parse+validate, injected so it stays in domain/manifest.ts
 * (keeping the sole marketplace.json file read at the seam -> CACHE-06) and is
 * swappable with a counting wrapper in tests (-> CACHE-01).
 */
export type ManifestLoader = (manifestPath: string) => Promise<unknown>;

/**
 * Build a per-path memoizing cache around `load`. The returned `load` performs
 * one `stat` per call (never a file-content read, CACHE-06) and serves an
 * unchanged `(mtimeMs, size)` entry from memory (CACHE-01/CACHE-05) by reference
 * (D-03).
 *
 * Single-threaded JS event loop = no locking. The Map is keyed by `manifestPath`
 * (per-path entry struct, NOT a composite `${mtimeMs}:${size}` key).
 */
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
      if (hit?.mtimeMs === st.mtimeMs && hit.size === st.size) {
        if (hit.ok) {
          return hit.value; // CACHE-01 hit, D-03 by-reference
        }

        throw hit.error; // CACHE-05 negative hit, D-03 same instance
      }

      // Miss or (mtimeMs|size) change -> reload + refresh (CACHE-02), discarding
      // a prior success OR failure (CACHE-05 invalidation arm).
      try {
        const value = await load(manifestPath);
        entries.set(manifestPath, { mtimeMs: st.mtimeMs, size: st.size, ok: true, value });
        return value;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        entries.set(manifestPath, { mtimeMs: st.mtimeMs, size: st.size, ok: false, error });
        throw error; // CACHE-05 negative entry stored + thrown
      }
    },
  };
}
