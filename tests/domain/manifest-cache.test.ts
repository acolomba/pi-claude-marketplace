import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Import createManifestCache directly (NOT the module-level cache singleton) so
// every test gets a guaranteed cold start by constructing a fresh instance
// (D-01 -- singleton leakage).
import { createManifestCache } from "../../extensions/pi-claude-marketplace/domain/manifest-cache.ts";
// Cross-check the CACHE-05 message-equivalence against the same accessor the
// soft-load consumer (list.ts) uses.
import {
  errorMessage,
  InvalidMarketplaceManifestError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

// ──────────────────────────────────────────────────────────────────────────
// CACHE-01: a repeated read of an unchanged manifest runs the injected loader
// exactly once across N sequential reads, and hits return by reference.
//
// The observability seam is the INJECTED COUNTING LOADER (it is NOT a readFile /
// JSON.parse / MARKETPLACE_VALIDATOR spy -- readFile cannot be replaced on the
// ESM namespace). All loads are SEQUENTIAL awaits, fired one
// at a time -- there is no concurrent in-flight de-dup by design.
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-01: N sequential reads of an unchanged manifest -> loader runs exactly once", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-cache-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, JSON.stringify({ name: "a", plugins: [] }), "utf8");

    let calls = 0;
    const value = { name: "a", plugins: [] };
    const cache = createManifestCache(() => {
      calls++;
      return Promise.resolve(value);
    });

    // Sequential awaits, one read at a time (deliberately not concurrent).
    await cache.load(p);
    await cache.load(p);
    await cache.load(p);

    assert.equal(calls, 1, "read/parse/validate path ran exactly once across 3 reads");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CACHE-01 / D-03: hits return the loaded value BY REFERENCE -- r1 === r2 === r3
// are the same object instance the loader produced (no structuredClone per hit).
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-01/D-03: hits return the loaded value by reference (r1 === r2 === r3)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-byref-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, JSON.stringify({ name: "a", plugins: [] }), "utf8");

    const value = { name: "a", plugins: [] };
    const cache = createManifestCache(() => Promise.resolve(value));

    const r1 = await cache.load(p);
    const r2 = await cache.load(p);
    const r3 = await cache.load(p);

    assert.equal(r1, value, "the loaded value is returned by reference");
    assert.equal(r1, r2, "D-03 by-reference identity on hit (r1 === r2)");
    assert.equal(r2, r3, "D-03 by-reference identity on hit (r2 === r3)");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CACHE-02 (success -> success): a SIZE change between reads invalidates the
// cached entry, so the loader runs a second time and the new value is served.
//
// Invalidation is driven off a different BYTE LENGTH (an added plugin entry),
// never a same-size rewrite -- a same-size rewrite within the filesystem's
// mtime resolution could collide on (mtimeMs,size) and flake.
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-02 success->success: a size change triggers a reload and returns the new value", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-reload-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    const small = { name: "a", plugins: [] };
    const large = { name: "a", plugins: [{ name: "p", source: "./p" }] };

    // Write the small manifest, mirror its bytes on disk and as the loader value.
    const smallBytes = JSON.stringify(small);
    await writeFile(p, smallBytes, "utf8");

    let calls = 0;
    const cache = createManifestCache(() => {
      calls++;
      // Return whatever the loader would have parsed off disk -- a fresh object
      // per call so the test can prove the SECOND value is served after reload.
      return Promise.resolve(calls === 1 ? small : large);
    });

    const r1 = await cache.load(p);
    assert.equal(calls, 1, "first read is a miss -> loader runs once");
    assert.equal(r1, small, "first read returns the small manifest");

    // Rewrite the SAME path with a DIFFERENT byte length (added plugin entry ->
    // larger size). The size change alone is enough to invalidate.
    const largeBytes = JSON.stringify(large);
    assert.notEqual(largeBytes.length, smallBytes.length, "rewrite must change byte length");
    await writeFile(p, largeBytes, "utf8");

    const r2 = await cache.load(p);
    assert.equal(calls, 2, "size change -> loader runs a second time");
    assert.equal(r2, large, "second read reflects the new (larger) content");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CACHE-02 + CACHE-05 (failure -> success): a prior NEGATIVE (failure) entry is
// discarded on a (mtimeMs,size) change; the next read re-attempts the loader and
// succeeds. The change is again driven off a SIZE change.
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-02/CACHE-05 failure->success: a negative entry is discarded on a size change; next read succeeds", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-neg-discard-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    const badBytes = "{ not json";
    await writeFile(p, badBytes, "utf8");

    const good = { name: "a", plugins: [{ name: "p", source: "./p" }] };
    let calls = 0;
    const cache = createManifestCache(() => {
      calls++;
      if (calls === 1) {
        return Promise.reject(
          new Error("marketplace.json schema invalid: <root>: Unexpected token"),
        );
      }

      return Promise.resolve(good);
    });

    // First read stores a negative entry and re-throws.
    await assert.rejects(
      () => cache.load(p),
      /marketplace\.json schema invalid/i,
      "first read throws and negative-caches",
    );
    assert.equal(calls, 1, "loader ran once for the failing read");

    // Rewrite with a DIFFERENT byte length so (mtimeMs,size) changes and the
    // negative entry is discarded.
    const goodBytes = JSON.stringify(good);
    assert.notEqual(goodBytes.length, badBytes.length, "rewrite must change byte length");
    await writeFile(p, goodBytes, "utf8");

    const r = await cache.load(p);
    assert.equal(calls, 2, "size change discarded the negative entry -> loader re-attempted");
    assert.equal(r, good, "the re-attempt returns the valid value");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CACHE-05 (negative caching): repeated reads of an UNCHANGED bad manifest
// re-throw the SAME Error instance with NO second loader call; .message is
// stable. The bad file's byte length does not change between reads.
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-05: bad manifest negative-cached; same Error re-thrown; no re-parse; message stable", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-neg-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, "{ not json", "utf8"); // size won't change between reads

    let calls = 0;
    const cache = createManifestCache(() => {
      calls++;
      return Promise.reject(new Error("marketplace.json schema invalid: <root>: Unexpected token"));
    });

    const e1 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );
    const e2 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );

    assert.equal(calls, 1, "negative entry serves the second read with no re-parse");
    assert.equal(e1, e2, "D-03 same Error instance re-thrown");
    assert.equal((e1 as Error).message, (e2 as Error).message, ".message stable across reads");
    // Mirror the soft-load consumer (list.ts), which reads only err.message.
    assert.equal(errorMessage(e1), errorMessage(e2), "errorMessage() equivalent across reads");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-48-B A1: the typed InvalidMarketplaceManifestError survives the negative
// cache -- the SAME typed instance is re-thrown (with its `name` and `cause`
// intact) on a repeated read of an unchanged bad manifest, with no second
// loader call. This is the structural-classification guarantee ATTR-07/ATTR-10
// rely on (classifyAddError / reasonsFromCascadeError narrow on instanceof, so
// the re-thrown value MUST still be an InvalidMarketplaceManifestError).
// ──────────────────────────────────────────────────────────────────────────

test("D-48-B A1: negative-cache re-throws the SAME InvalidMarketplaceManifestError instance (typed survival)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-neg-typed-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, "{ not json", "utf8"); // size won't change between reads

    let calls = 0;
    const cache = createManifestCache(() => {
      calls++;
      return Promise.reject(
        new InvalidMarketplaceManifestError("marketplace.json is not valid JSON: SyntaxError", {
          cause: new SyntaxError("Unexpected token"),
        }),
      );
    });

    const e1 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );
    const e2 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );

    assert.equal(calls, 1, "negative entry serves the second read with no re-parse");
    assert.ok(
      e1 instanceof InvalidMarketplaceManifestError,
      "first read re-throws the typed instance",
    );
    assert.ok(
      e2 instanceof InvalidMarketplaceManifestError,
      "negative-cached re-throw is STILL the typed instance (instanceof holds)",
    );
    assert.equal(e1, e2, "D-03 / D-48-B A1: the SAME typed instance is re-thrown");
    assert.ok(
      e2.cause instanceof SyntaxError,
      "the SyntaxError cause survives the negative-cache re-throw",
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-02 (stat-fail): a stat() failure on a NONEXISTENT path is a PURE MISS --
// the loader runs on EVERY read (not negative-cached) and the original error
// code (ENOENT) propagates byte-identically. A reappearing file is never
// masked by a cached error.
// ──────────────────────────────────────────────────────────────────────────

test("D-02 stat-fail: a nonexistent path is a pure miss -> loader runs every read; ENOENT propagates", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-statfail-"));
  try {
    // Never write this path -- stat(p) will fail with ENOENT on every read.
    const p = path.join(tmp, "does-not-exist", "marketplace.json");

    let calls = 0;
    const cache = createManifestCache((manifestPath: string) => {
      calls++;
      // Mirror the natural error the real loader's readFile would throw: an
      // ENOENT-coded error that must propagate unchanged (D-02).
      const err = new Error(
        `ENOENT: no such file or directory, open '${manifestPath}'`,
      ) as Error & {
        code?: string;
      };
      err.code = "ENOENT";

      return Promise.reject(err);
    });

    const e1 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );
    const e2 = await cache.load(p).then(
      () => null,
      (e: unknown) => e,
    );

    assert.equal(
      calls,
      2,
      "stat-fail is a pure miss: the loader runs on every read (not negative-cached)",
    );
    assert.equal(
      (e1 as { code?: string }).code,
      "ENOENT",
      "first read propagates the original ENOENT code",
    );
    assert.equal(
      (e2 as { code?: string }).code,
      "ENOENT",
      "second read propagates the original ENOENT code",
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CACHE-03 (cold start): a freshly constructed createManifestCache() starts
// empty: the first load is a miss that runs the loader. No cache file or
// sidecar is written under the tmpdir (the cache is in-memory only).
// ──────────────────────────────────────────────────────────────────────────

test("CACHE-03: a freshly constructed cache starts empty -> first load is a miss; no file written", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-cold-"));
  try {
    const p = path.join(tmp, "marketplace.json");
    await writeFile(p, JSON.stringify({ name: "a", plugins: [] }), "utf8");

    let calls = 0;
    const value = { name: "a", plugins: [] };
    const cache = createManifestCache(() => {
      calls++;
      return Promise.resolve(value);
    });

    const r = await cache.load(p);
    assert.equal(calls, 1, "the very first load on a fresh cache is a miss -> loader runs once");
    assert.equal(r, value, "the cold read returns the loaded value");

    // No sidecar / cache file is written -- the only file in tmp is the manifest
    // we wrote ourselves.
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(tmp);
    assert.deepEqual(entries, ["marketplace.json"], "no cache file or sidecar written to disk");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
