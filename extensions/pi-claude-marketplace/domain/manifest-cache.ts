// domain/manifest-cache.ts
//
// NFR-8: in-memory memoization for the marketplace-manifest read seam. The real
// readFile + JSON.parse + MARKETPLACE_VALIDATOR.Check stays in domain/manifest.ts
// (CACHE-06); this module adds ONLY `stat` calls per read and NEVER a `readFile`.
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
//         negative entries re-throw the EXACT value the loader threw -- stored
//         and re-thrown unchanged (Error or otherwise) so no structured field
//         (e.g. `.code`) is dropped, consistent with the stat-fail miss path.
//         The seam preserves the raw JSON.parse value, so callers MUST treat the
//         result as READ-ONLY.
//   D-04: unbounded -- no entry-count cap, no entry expiry/removal policy, and
//         no in-flight promise de-dup (sequential awaits only; concurrency
//         de-dup is out of scope).
//
// Invalidation is per-read (mtimeMs, size) compared against the stored entry
// (CACHE-02): any change to either field reloads and refreshes the entry,
// discarding a prior success OR a prior failure (CACHE-05 invalidation arm). The
// loader reads the file independently of this module's stat, so a fresh entry is
// keyed on a stat taken AFTER the loader returns -- the stored key reflects the
// bytes the loader actually observed rather than the pre-load stat, tightening
// the stat/read TOCTOU window (WR-01).
//
// Residual risk (accepted): a same-size rewrite within the
// filesystem's mtime resolution can collide on (mtimeMs, size) and serve a stale
// entry. This is an OWNED limitation, not a silent bug -- content hashing is a
// deliberate non-goal.

import { stat } from "node:fs/promises";

interface ManifestCacheStat {
  readonly mtimeMs: number;
  readonly size: number;
}

/**
 * Discriminated on `ok`: a positive outcome guarantees `value` (D-03
 * by-reference), a negative outcome carries the exact `thrown` value (D-03
 * re-throw) -- held as `unknown` and re-thrown unchanged so no structured field
 * is dropped.
 */
type ManifestLoadOutcome =
  | { readonly ok: true; readonly value: unknown } // raw JSON.parse value on success
  | { readonly ok: false; readonly thrown: unknown }; // exact thrown value on failure

/** A cached load outcome tagged with the (mtimeMs, size) it was keyed under. */
type ManifestCacheEntry = ManifestCacheStat & ManifestLoadOutcome;

/**
 * The real read+parse+validate, injected so it stays in domain/manifest.ts
 * (keeping the sole marketplace.json file read at the seam -> CACHE-06) and is
 * swappable with a counting wrapper in tests (-> CACHE-01).
 */
export type ManifestLoader = (manifestPath: string) => Promise<unknown>;

/**
 * Build a per-path memoizing cache around `load`. A repeated read of an
 * unchanged file serves an `(mtimeMs, size)` entry from memory (CACHE-01/
 * CACHE-05) by reference (D-03) after a single `stat` -- never a file-content
 * read (CACHE-06). A miss or a changed file reloads, then re-stats and stores
 * the entry under the post-load stat (WR-01).
 *
 * The Map is keyed by `manifestPath` (a per-path entry struct, NOT a composite
 * `${mtimeMs}:${size}` key); the last write per path wins.
 */
export function createManifestCache(load: ManifestLoader): {
  load(manifestPath: string): Promise<unknown>;
} {
  const entries = new Map<string, ManifestCacheEntry>();

  return {
    async load(manifestPath: string): Promise<unknown> {
      let st: ManifestCacheStat;
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

        throw hit.thrown; // CACHE-05 negative hit, D-03 same value re-thrown
      }

      // Miss or (mtimeMs|size) change -> reload (CACHE-02), discarding a prior
      // success OR failure (CACHE-05 invalidation arm).
      let outcome: ManifestLoadOutcome;
      try {
        outcome = { ok: true, value: await load(manifestPath) };
      } catch (err) {
        outcome = { ok: false, thrown: err };
      }

      // WR-01: re-stat AFTER the load so the entry is keyed on the file state the
      // loader actually observed, not the pre-load stat. If this stat fails (the
      // file vanished mid-load), treat it as a pure miss -- surface the load
      // result but do NOT cache under a key that no longer describes the file.
      let keyStat: ManifestCacheStat;
      try {
        keyStat = await stat(manifestPath);
      } catch {
        if (!outcome.ok) {
          throw outcome.thrown;
        }

        return outcome.value;
      }

      const key: ManifestCacheStat = { mtimeMs: keyStat.mtimeMs, size: keyStat.size };
      if (outcome.ok) {
        entries.set(manifestPath, { ...key, ok: true, value: outcome.value });
        return outcome.value;
      }

      entries.set(manifestPath, { ...key, ok: false, thrown: outcome.thrown });
      throw outcome.thrown; // CACHE-05 negative entry stored + thrown
    },
  };
}
