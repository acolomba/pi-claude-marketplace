import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  __resetCacheForTests,
  dropMarketplaceCache,
  getMarketplaceNames,
  getPluginIndex,
  invalidateMarketplaceCache,
  invalidateMarketplaceNames,
  ManifestSoftFailError,
  MARKETPLACE_NAMES_CACHE_SCHEMA,
  PLUGIN_INDEX_CACHE_SCHEMA,
} from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { PluginIndexRow } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

/**
 * D-03 two-tier completion cache primitives + TC-8 soft-fail + TC-9
 * propagation + 10-min TTL via injected clock. Tests are hermetic per-case:
 * each test() calls __resetCacheForTests() at the top to clear the module-
 * level memory maps and works in its own mkdtemp().
 */

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cc-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Schema version snapshots (D-03 -- bump to 2 should fail these tests loudly).
// ---------------------------------------------------------------------------

test("schemaVersion snapshot :: MARKETPLACE_NAMES_CACHE_SCHEMA.schemaVersion === 2", () => {
  __resetCacheForTests();
  // The schema is a TypeBox Type.Object; the schemaVersion property is a
  // literal `1`. Reach into the JSON-schema representation (TypeBox 1.x
  // exposes the schema's properties through the .properties field).
  const properties = MARKETPLACE_NAMES_CACHE_SCHEMA.properties;
  assert.equal(properties.schemaVersion.const, 2);
});

test("schemaVersion snapshot :: PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion === 3", () => {
  __resetCacheForTests();
  const properties = PLUGIN_INDEX_CACHE_SCHEMA.properties;
  // LIST-02 / D-67-02: bumped 1 -> 2 for the finer-status union. WR-02: bumped
  // 2 -> 3 for the added `force-installed-upgradable` status; stale v2 caches
  // (which flattened that case to plain `force-installed`) drop+rebuild via the
  // existing mismatch path.
  assert.equal(properties.schemaVersion.const, 3);
});

// ---------------------------------------------------------------------------
// getMarketplaceNames -- memory + file + rebuild semantics.
// ---------------------------------------------------------------------------

test("getMarketplaceNames :: lazy load on first call; cache hit on second (no rebuild call)", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    let rebuildCalls = 0;
    const rebuild = (): Promise<readonly string[]> => {
      rebuildCalls++;
      return Promise.resolve(["mp-a", "mp-b"]);
    };

    const first = await getMarketplaceNames(filePath, "user", rebuild);
    assert.deepEqual([...first], ["mp-a", "mp-b"]);
    assert.equal(rebuildCalls, 1);

    const second = await getMarketplaceNames(filePath, "user", rebuild);
    assert.deepEqual([...second], ["mp-a", "mp-b"]);
    assert.equal(rebuildCalls, 1, "second call should be a memory hit -- no rebuild");
  });
});

test("getMarketplaceNames :: in-memory hit serves without file read", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    let rebuildCalls = 0;
    const rebuild = (): Promise<readonly string[]> => {
      rebuildCalls++;
      return Promise.resolve(["only-in-memory"]);
    };

    // Seed memory + file.
    await getMarketplaceNames(filePath, "user", rebuild);
    assert.equal(rebuildCalls, 1);

    // Delete the file -- a memory hit must NOT touch disk.
    await rm(filePath, { force: true });

    const again = await getMarketplaceNames(filePath, "user", rebuild);
    assert.deepEqual([...again], ["only-in-memory"]);
    assert.equal(rebuildCalls, 1, "memory hit must not invoke rebuild even with no file present");
  });
});

test("getMarketplaceNames :: file hit on memory miss; no rebuild", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    // Pre-seed file (simulates a prior session's cache on disk).
    await writeFile(filePath, JSON.stringify({ schemaVersion: 2, names: ["pre-seeded"] }), "utf8");

    let rebuildCalls = 0;
    const names = await getMarketplaceNames(filePath, "user", () => {
      rebuildCalls++;
      return Promise.resolve(["should-not-appear"]);
    });

    assert.deepEqual([...names], ["pre-seeded"]);
    assert.equal(rebuildCalls, 0, "valid file must serve without rebuild");
  });
});

test("getMarketplaceNames :: ENOENT triggers rebuild + atomic write", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "subdir", "marketplace-names.json");
    let rebuildCalls = 0;
    const rebuild = (): Promise<readonly string[]> => {
      rebuildCalls++;
      return Promise.resolve(["mp-x"]);
    };

    const result = await getMarketplaceNames(filePath, "project", rebuild);
    assert.deepEqual([...result], ["mp-x"]);
    assert.equal(rebuildCalls, 1);

    // File was written -- next session (memory cleared) hits the file.
    __resetCacheForTests();
    let rebuild2Calls = 0;
    const after = await getMarketplaceNames(filePath, "project", () => {
      rebuild2Calls++;
      return Promise.resolve([]);
    });
    assert.deepEqual([...after], ["mp-x"]);
    assert.equal(rebuild2Calls, 0, "file write must be readable on next memory-clean call");
  });
});

test("getMarketplaceNames :: stale schemaVersion 1 drops + rebuilds", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    await writeFile(filePath, JSON.stringify({ schemaVersion: 1, names: ["stale"] }), "utf8");

    let rebuildCalls = 0;
    const result = await getMarketplaceNames(filePath, "user", () => {
      rebuildCalls++;
      return Promise.resolve(["fresh"]);
    });

    assert.deepEqual([...result], ["fresh"]);
    assert.equal(rebuildCalls, 1, "schema mismatch must trigger rebuild");
  });
});

test("getMarketplaceNames :: corrupt JSON drops + rebuilds", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    await writeFile(filePath, "{ not valid json", "utf8");

    let rebuildCalls = 0;
    const result = await getMarketplaceNames(filePath, "user", () => {
      rebuildCalls++;
      return Promise.resolve(["healed"]);
    });

    assert.deepEqual([...result], ["healed"]);
    assert.equal(rebuildCalls, 1);
  });
});

// ---------------------------------------------------------------------------
// getPluginIndex -- memory + file + rebuild + 10-minute TTL.
// ---------------------------------------------------------------------------

test("getPluginIndex :: lazy load + cache hit (same as marketplace-names)", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    const rows: PluginIndexRow[] = [
      { name: "p1", status: "installed", version: "1.0.0" },
      { name: "p2", status: "available" },
    ];

    let rebuildCalls = 0;
    const rebuild = (): Promise<readonly PluginIndexRow[]> => {
      rebuildCalls++;
      return Promise.resolve(rows);
    };

    const first = await getPluginIndex(filePath, "user", "mp-a", rebuild);
    assert.equal(first.length, 2);
    assert.equal(rebuildCalls, 1);

    const second = await getPluginIndex(filePath, "user", "mp-a", rebuild);
    assert.equal(second.length, 2);
    assert.equal(rebuildCalls, 1, "memory hit must not rebuild");
  });
});

test("D-03-TTL :: getPluginIndex re-reads file after 10-min TTL via injected clock", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    let clock = 1_000_000;
    let rebuildCalls = 0;

    // First call: clock=1M, populates memory + file with one row.
    await getPluginIndex(
      filePath,
      "user",
      "mp-a",
      () => {
        rebuildCalls++;
        return Promise.resolve([{ name: "before", status: "installed" }]);
      },
      { now: () => clock },
    );
    assert.equal(rebuildCalls, 1);

    // Mutate the file directly (simulates an external process refresh) and
    // advance the clock past 10 minutes. The TTL drop should re-read the
    // file content (NOT invoke rebuild -- the file is fresh).
    await writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 3,
        lastRefreshedAt: new Date().toISOString(),
        plugins: [{ name: "after", status: "installed" }],
      }),
      "utf8",
    );
    clock += 10 * 60 * 1000 + 1; // just past 10 minutes

    const afterTtl = await getPluginIndex(
      filePath,
      "user",
      "mp-a",
      () => {
        rebuildCalls++;
        return Promise.resolve([{ name: "should-not-rebuild", status: "installed" }]);
      },
      { now: () => clock },
    );
    assert.deepEqual(
      afterTtl.map((r) => r.name),
      ["after"],
      "post-TTL must re-read the file content",
    );
    assert.equal(rebuildCalls, 1, "post-TTL file re-read must NOT trigger rebuild");
  });
});

test("D-03-TTL :: stale plugin-index file rebuilds instead of serving old statuses", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    const clock = 1_000_000;
    let rebuildCalls = 0;
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 3,
        lastRefreshedAt: new Date(clock - 10 * 60 * 1000 - 1).toISOString(),
        plugins: [{ name: "before", status: "available" }],
      }),
      "utf8",
    );

    const rows = await getPluginIndex(
      filePath,
      "user",
      "mp-a",
      () => {
        rebuildCalls++;
        return Promise.resolve([{ name: "before", status: "installed" }]);
      },
      { now: () => clock },
    );

    assert.deepEqual(rows, [{ name: "before", status: "installed" }]);
    assert.equal(rebuildCalls, 1, "stale file cache must rebuild from state/manifest");
  });
});

test("D-03-TTL :: getPluginIndex serves in-memory before TTL expiry", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    let clock = 1_000_000;
    let rebuildCalls = 0;

    await getPluginIndex(
      filePath,
      "user",
      "mp-a",
      () => {
        rebuildCalls++;
        return Promise.resolve([{ name: "x", status: "installed" }]);
      },
      { now: () => clock },
    );
    assert.equal(rebuildCalls, 1);

    // Mutate file -- a memory hit must NOT see it.
    await writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 3,
        lastRefreshedAt: new Date().toISOString(),
        plugins: [{ name: "external-change", status: "installed" }],
      }),
      "utf8",
    );
    clock += 60_000; // 1 minute, well within TTL

    const result = await getPluginIndex(
      filePath,
      "user",
      "mp-a",
      () => {
        rebuildCalls++;
        return Promise.resolve([]);
      },
      { now: () => clock },
    );
    assert.deepEqual(
      result.map((r) => r.name),
      ["x"],
      "pre-TTL memory hit must ignore external file change",
    );
    assert.equal(rebuildCalls, 1, "no rebuild expected within TTL window");
  });
});

// ---------------------------------------------------------------------------
// Invalidation API.
// ---------------------------------------------------------------------------

test("invalidateMarketplaceNames :: removes cache file + memory entry", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    let names = ["initial"];
    let rebuildCalls = 0;
    const rebuild = (): Promise<readonly string[]> => {
      rebuildCalls++;
      return Promise.resolve([...names]);
    };

    await getMarketplaceNames(filePath, "user", rebuild);
    assert.equal(rebuildCalls, 1);

    // Mutate authoritative source.
    names = ["fresh"];
    await invalidateMarketplaceNames(filePath, "user");

    // File gone AND memory dropped -- next read rebuilds.
    await assert.rejects(() => readFile(filePath, "utf8"), { code: "ENOENT" });
    const afterInvalidate = await getMarketplaceNames(filePath, "user", rebuild);
    assert.deepEqual([...afterInvalidate], ["fresh"]);
    assert.equal(rebuildCalls, 2);
  });
});

test("invalidateMarketplaceNames :: ENOENT on cache file is silent", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    await invalidateMarketplaceNames(filePath, "user");
  });
});

test("invalidateMarketplaceCache :: next read rebuilds (memory dropped, file kept)", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    let rebuildCalls = 0;

    await getPluginIndex(filePath, "user", "mp-a", () => {
      rebuildCalls++;
      return Promise.resolve([{ name: "p1", status: "installed" }]);
    });
    assert.equal(rebuildCalls, 1);

    invalidateMarketplaceCache("user", "mp-a");

    // Memory dropped; file remains. Next read serves from file (no rebuild).
    const result = await getPluginIndex(filePath, "user", "mp-a", () => {
      rebuildCalls++;
      return Promise.resolve([]);
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.name, "p1");
    assert.equal(rebuildCalls, 1, "invalidate drops memory but file still serves");
  });
});

test("dropMarketplaceCache :: removes cache file + memory entry", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-a.json");
    let rebuildCalls = 0;

    await getPluginIndex(filePath, "user", "mp-a", () => {
      rebuildCalls++;
      return Promise.resolve([{ name: "p1", status: "installed" }]);
    });
    assert.equal(rebuildCalls, 1);

    await dropMarketplaceCache(filePath, "user", "mp-a");

    // File gone AND memory dropped -- next read rebuilds.
    await assert.rejects(() => readFile(filePath, "utf8"), { code: "ENOENT" });
    const result = await getPluginIndex(filePath, "user", "mp-a", () => {
      rebuildCalls++;
      return Promise.resolve([{ name: "rebuilt", status: "available" }]);
    });
    assert.equal(rebuildCalls, 2);
    assert.equal(result[0]?.name, "rebuilt");
  });
});

test("dropMarketplaceCache :: ENOENT on cache file is silent (file already absent is OK)", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "never-existed.json");
    // Must not throw even when there's nothing on disk and no memory entry.
    await dropMarketplaceCache(filePath, "user", "never-existed");
  });
});

// ---------------------------------------------------------------------------
// TC-8 -- ManifestSoftFailError swallow + poison + subsequent reads return [].
// ---------------------------------------------------------------------------

test("TC-8 :: rebuild that throws manifest error caches { plugins: [], _loadError }", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-broken.json");

    const result = await getPluginIndex(filePath, "user", "mp-broken", () => {
      return Promise.reject(new ManifestSoftFailError(new Error("missing manifest")));
    });

    assert.deepEqual(result, [], "soft-fail must return empty list");

    // File now contains the poison.
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      schemaVersion: number;
      plugins: unknown[];
      _loadError?: string;
    };
    assert.equal(parsed.schemaVersion, 3);
    assert.deepEqual(parsed.plugins, []);
    assert.match(parsed._loadError ?? "", /missing manifest/);
  });
});

test("TC-8 :: subsequent reads of TC-8-poisoned cache return [] (no throw)", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp-broken.json");
    // Pre-seed the poison file (simulates a prior session's TC-8 result).
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: 3,
        lastRefreshedAt: new Date().toISOString(),
        plugins: [],
        _loadError: "stale failure",
      }),
      "utf8",
    );

    let rebuildCalls = 0;
    const result = await getPluginIndex(filePath, "user", "mp-broken", () => {
      rebuildCalls++;
      return Promise.reject(new Error("should not be called"));
    });
    assert.deepEqual(result, []);
    assert.equal(rebuildCalls, 0, "poison file must serve without re-invoking rebuild");

    // And a second call also returns [] via memory.
    const second = await getPluginIndex(filePath, "user", "mp-broken", () => {
      rebuildCalls++;
      return Promise.reject(new Error("still should not be called"));
    });
    assert.deepEqual(second, []);
    assert.equal(rebuildCalls, 0);
  });
});

// ---------------------------------------------------------------------------
// TC-9 -- non-ManifestSoftFailError throws propagate.
// ---------------------------------------------------------------------------

test("TC-9 :: rebuild that throws state.json error propagates from getMarketplaceNames", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "marketplace-names.json");
    await assert.rejects(
      () =>
        getMarketplaceNames(filePath, "user", () =>
          Promise.reject(new Error("ENOENT: state.json broken")),
        ),
      /ENOENT: state\.json broken/,
    );
  });
});

test("TC-9 :: rebuild that throws state.json error propagates from getPluginIndex", async () => {
  __resetCacheForTests();
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "plugins", "mp.json");
    await assert.rejects(
      () =>
        getPluginIndex(filePath, "user", "mp", () =>
          Promise.reject(new Error("state.json corrupt")),
        ),
      /state\.json corrupt/,
    );
  });
});
