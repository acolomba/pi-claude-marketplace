import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  createCompletionCache,
  ManifestSoftFailError,
  MARKETPLACE_NAMES_CACHE_SCHEMA,
  PLUGIN_INDEX_CACHE_SCHEMA,
} from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type {
  GetPluginIndexOptions,
  PluginIndexRow,
} from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

describe("cache schemas", () => {
  test("publishes marketplace names schema version 2", () => {
    // arrange
    const expectedSchema = {
      type: "object",
      required: ["schemaVersion", "names"],
      properties: {
        schemaVersion: { type: "number", const: 2 },
        names: { type: "array", items: { type: "string" } },
      },
    };

    // act
    const schema = JSON.parse(JSON.stringify(MARKETPLACE_NAMES_CACHE_SCHEMA)) as unknown;

    // assert
    assert.deepStrictEqual(schema, expectedSchema);
  });

  test("publishes plugin index schema version 6 with every status", () => {
    // arrange
    const expectedSchema = {
      type: "object",
      required: ["schemaVersion", "lastRefreshedAt", "plugins"],
      properties: {
        schemaVersion: { type: "number", const: 6 },
        lastRefreshedAt: { type: "string" },
        manifestRef: { type: "string" },
        plugins: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "status"],
            properties: {
              name: { type: "string" },
              status: {
                anyOf: [
                  { type: "string", const: "installed" },
                  { type: "string", const: "upgradable" },
                  { type: "string", const: "partially-installed" },
                  { type: "string", const: "partially-installed-upgradable" },
                  { type: "string", const: "partially-upgradable" },
                  { type: "string", const: "available" },
                  { type: "string", const: "partially-available" },
                  { type: "string", const: "unavailable" },
                  { type: "string", const: "remote" },
                ],
              },
              version: { type: "string" },
            },
          },
        },
        _loadError: { type: "string" },
      },
    };

    // act
    const schema = JSON.parse(JSON.stringify(PLUGIN_INDEX_CACHE_SCHEMA)) as unknown;

    // assert
    assert.deepStrictEqual(schema, expectedSchema);
  });
});

test("omits the unused marketplace-name reader from the public module", async () => {
  // arrange
  const readerExportName = "getMarketplaceNames";

  // act
  const completionCache =
    await import("../../extensions/pi-claude-marketplace/shared/completion-cache.ts");

  // assert
  assert.strictEqual(readerExportName in completionCache, false);
});

describe("ManifestSoftFailError", () => {
  test("retains the manifest failure as a structured cause", () => {
    // arrange
    const cause = new Error("manifest unavailable");

    // act
    const error = new ManifestSoftFailError(cause);

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      {
        name: "ManifestSoftFailError",
        message: "Manifest load failure: manifest unavailable",
        cause,
      },
    );
  });
});

describe("getPluginIndex", () => {
  test("reuses fresh plugin-index memory inside one cache instance", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-instance-reuse-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const expectedRows = [{ name: "memory-row", status: "installed" }] satisfies PluginIndexRow[];
    const rebuild = t.mock.fn(() => Promise.resolve(expectedRows));
    const cache = createCompletionCache();
    t.after(() => rm(directory, { recursive: true, force: true }));
    await cache.getPluginIndex(cachePath, "user", "instance-reuse", rebuild);
    await rm(cachePath);

    // act
    const rows = await cache.getPluginIndex(cachePath, "user", "instance-reuse", rebuild);

    // assert
    assert.deepStrictEqual(rows, expectedRows);
    assert.strictEqual(rebuild.mock.callCount(), 1);
  });

  test("keeps plugin-index memory private to each cache instance", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-instance-private-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const firstRows = [{ name: "first-row", status: "installed" }] satisfies PluginIndexRow[];
    const secondRows = [{ name: "second-row", status: "available" }] satisfies PluginIndexRow[];
    const firstCache = createCompletionCache();
    const secondCache = createCompletionCache();
    t.after(() => rm(directory, { recursive: true, force: true }));
    await firstCache.getPluginIndex(cachePath, "project", "instance-private", () =>
      Promise.resolve(firstRows),
    );
    await rm(cachePath);

    // act
    const rows = await secondCache.getPluginIndex(cachePath, "project", "instance-private", () =>
      Promise.resolve(secondRows),
    );

    // assert
    assert.deepStrictEqual(rows, secondRows);
  });

  test("rebuilds a cold plugin index and preserves returned row order", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-cold-"));
    const cachePath = path.join(directory, "nested", "plugin-index.json");
    const scope = "user";
    const marketplace = "cold-index";
    const cache = createCompletionCache();
    const expectedRows = [
      { name: "alpha", status: "installed", version: "1.0.0" },
      { name: "beta", status: "available" },
    ] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act
    const rows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.resolve(expectedRows),
    );
    const persisted = JSON.parse(await readFile(cachePath, "utf8")) as Record<string, unknown>;

    // assert
    assert.deepStrictEqual(rows, expectedRows);
    assert.deepStrictEqual(
      {
        schemaVersion: persisted.schemaVersion,
        plugins: persisted.plugins,
      },
      {
        schemaVersion: 6,
        plugins: [
          { name: "alpha", status: "installed", version: "1.0.0" },
          { name: "beta", status: "available" },
        ],
      },
    );
    assert.match(
      String(persisted.lastRefreshedAt),
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  test("serves a warm plugin index within the injected TTL", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-warm-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "project";
    const marketplace = "warm-index";
    const cache = createCompletionCache();
    let clock = 1_000_000;
    const options = { now: () => clock } satisfies GetPluginIndexOptions;
    const expectedRows = [{ name: "memory-row", status: "remote" }] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await cache.getPluginIndex(
      cachePath,
      scope,
      marketplace,
      () => Promise.resolve(expectedRows),
      options,
    );
    await rm(cachePath);
    clock += 599_999;

    // act
    const rows = await cache.getPluginIndex(
      cachePath,
      scope,
      marketplace,
      () => Promise.reject(new Error("warm plugin cache rebuilt")),
      options,
    );

    // assert
    assert.deepStrictEqual(rows, expectedRows);
  });

  test("hydrates a valid plugin index from disk without rebuilding", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-disk-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "user";
    const marketplace = "disk-index";
    const cache = createCompletionCache();
    const clock = Date.parse("2026-08-29T12:00:00.000Z");
    const expectedRows = [
      { name: "disk-row", status: "upgradable", version: "2.0.0" },
    ] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await writeFile(
      cachePath,
      '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.000Z","manifestRef":"main","plugins":[{"name":"disk-row","status":"upgradable","version":"2.0.0"}]}',
      "utf8",
    );

    // act
    const rows = await cache.getPluginIndex(
      cachePath,
      scope,
      marketplace,
      () => Promise.reject(new Error("valid plugin disk cache rebuilt")),
      { now: () => clock },
    );

    // assert
    assert.deepStrictEqual(rows, expectedRows);
  });

  test("persists a soft manifest failure and rehydrates the poison", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-poison-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "project";
    const marketplace = "poison-index";
    const cache = createCompletionCache();
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act
    const firstRows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.reject(new ManifestSoftFailError(new Error("manifest missing"))),
    );
    const persisted = JSON.parse(await readFile(cachePath, "utf8")) as Record<string, unknown>;
    cache.invalidateMarketplaceCache(scope, marketplace);
    const secondRows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.reject(new Error("persisted poison rebuilt")),
    );

    // assert
    assert.deepStrictEqual(firstRows, []);
    assert.deepStrictEqual(secondRows, []);
    assert.deepStrictEqual(
      {
        schemaVersion: persisted.schemaVersion,
        plugins: persisted.plugins,
        loadError: persisted._loadError,
      },
      {
        schemaVersion: 6,
        plugins: [],
        loadError: "manifest missing",
      },
    );
  });

  test("propagates an unexpected plugin rebuild error by identity", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-error-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "user";
    const marketplace = "unexpected-error-index";
    const cache = createCompletionCache();
    const rebuildError = new Error("state document corrupt");
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act & assert
    await assert.rejects(
      () => cache.getPluginIndex(cachePath, scope, marketplace, () => Promise.reject(rebuildError)),
      (error: unknown) => error === rebuildError,
    );
  });

  for (const { schemaVersion } of [{ schemaVersion: 5 }, { schemaVersion: 7 }]) {
    test(`rejects adjacent plugin schema version ${schemaVersion}`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-schema-"));
      const cachePath = path.join(directory, "plugin-index.json");
      const scope = "project";
      const marketplace = `schema-${schemaVersion}-index`;
      const cache = createCompletionCache();
      const clock = Date.parse("2026-08-29T12:00:00.000Z");
      const expectedRows = [
        { name: "rebuilt-row", status: "partially-installed" },
      ] satisfies PluginIndexRow[];
      t.after(async () => {
        cache.invalidateMarketplaceCache(scope, marketplace);
        await rm(directory, { recursive: true, force: true });
      });
      await writeFile(
        cachePath,
        `{"schemaVersion":${schemaVersion},"lastRefreshedAt":"2026-08-29T12:00:00.000Z","plugins":[{"name":"stale-row","status":"installed"}]}`,
        "utf8",
      );

      // act
      const rows = await cache.getPluginIndex(
        cachePath,
        scope,
        marketplace,
        () => Promise.resolve(expectedRows),
        { now: () => clock },
      );
      const persisted = JSON.parse(await readFile(cachePath, "utf8")) as {
        schemaVersion: number;
        plugins: unknown[];
      };

      // assert
      assert.deepStrictEqual(rows, expectedRows);
      assert.deepStrictEqual(
        { schemaVersion: persisted.schemaVersion, plugins: persisted.plugins },
        {
          schemaVersion: 6,
          plugins: [{ name: "rebuilt-row", status: "partially-installed" }],
        },
      );
    });
  }

  for (const { name, bytes } of [
    { name: "JSON-invalid plugin cache", bytes: "{invalid" },
    {
      name: "malformed plugin cache",
      bytes:
        '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.000Z","plugins":[{"name":"bad-row","status":"unknown"}]}',
    },
  ]) {
    test(`rebuilds a ${name}`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-malformed-"));
      const cachePath = path.join(directory, "plugin-index.json");
      const scope = "user";
      const marketplace = `${name.replaceAll(" ", "-")}-index`;
      const cache = createCompletionCache();
      const clock = Date.parse("2026-08-29T12:00:00.000Z");
      const expectedRows = [{ name: "valid-row", status: "available" }] satisfies PluginIndexRow[];
      t.after(async () => {
        cache.invalidateMarketplaceCache(scope, marketplace);
        await rm(directory, { recursive: true, force: true });
      });
      await writeFile(cachePath, bytes, "utf8");

      // act
      const rows = await cache.getPluginIndex(
        cachePath,
        scope,
        marketplace,
        () => Promise.resolve(expectedRows),
        { now: () => clock },
      );

      // assert
      assert.deepStrictEqual(rows, expectedRows);
      assert.deepStrictEqual(
        (JSON.parse(await readFile(cachePath, "utf8")) as { plugins: unknown[] }).plugins,
        [{ name: "valid-row", status: "available" }],
      );
    });
  }

  for (const { name, bytes, expectedRows } of [
    {
      name: "empty plugin cache",
      bytes: '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.000Z","plugins":[]}',
      expectedRows: [] satisfies PluginIndexRow[],
    },
    {
      name: "single-row plugin cache",
      bytes:
        '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.000Z","plugins":[{"name":"only-row","status":"partially-available"}]}',
      expectedRows: [
        { name: "only-row", status: "partially-available" },
      ] satisfies PluginIndexRow[],
    },
  ]) {
    test(`accepts a ${name}`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-cardinality-"));
      const cachePath = path.join(directory, "plugin-index.json");
      const scope = "project";
      const marketplace = `${name.replaceAll(" ", "-")}-index`;
      const cache = createCompletionCache();
      const clock = Date.parse("2026-08-29T12:00:00.000Z");
      t.after(async () => {
        cache.invalidateMarketplaceCache(scope, marketplace);
        await rm(directory, { recursive: true, force: true });
      });
      await writeFile(cachePath, bytes, "utf8");

      // act
      const rows = await cache.getPluginIndex(
        cachePath,
        scope,
        marketplace,
        () => Promise.reject(new Error("valid cardinality rebuilt")),
        { now: () => clock },
      );

      // assert
      assert.deepStrictEqual(rows, expectedRows);
    });
  }

  for (const { name, elapsed, expectedRows } of [
    {
      name: "one millisecond before the TTL",
      elapsed: 599_999,
      expectedRows: [{ name: "cached-row", status: "installed" }] satisfies PluginIndexRow[],
    },
    {
      name: "exactly at the TTL",
      elapsed: 600_000,
      expectedRows: [{ name: "cached-row", status: "installed" }] satisfies PluginIndexRow[],
    },
    {
      name: "one millisecond beyond the TTL",
      elapsed: 600_001,
      expectedRows: [{ name: "rebuilt-row", status: "available" }] satisfies PluginIndexRow[],
    },
  ]) {
    test(`uses the memory cache ${name}`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-memory-ttl-"));
      const cachePath = path.join(directory, "plugin-index.json");
      const scope = "user";
      const marketplace = `${elapsed}-memory-ttl-index`;
      const cache = createCompletionCache();
      let clock = 10_000_000;
      const options = { now: () => clock } satisfies GetPluginIndexOptions;
      const cachedRows = [{ name: "cached-row", status: "installed" }] satisfies PluginIndexRow[];
      const rebuiltRows = [{ name: "rebuilt-row", status: "available" }] satisfies PluginIndexRow[];
      t.after(async () => {
        cache.invalidateMarketplaceCache(scope, marketplace);
        await rm(directory, { recursive: true, force: true });
      });
      await cache.getPluginIndex(
        cachePath,
        scope,
        marketplace,
        () => Promise.resolve(cachedRows),
        options,
      );
      await rm(cachePath);
      clock += elapsed;

      // act
      const rows = await cache.getPluginIndex(
        cachePath,
        scope,
        marketplace,
        () => Promise.resolve(rebuiltRows),
        options,
      );

      // assert
      assert.deepStrictEqual(rows, expectedRows);
    });
  }

  test("uses integer millisecond precision at the file TTL boundary", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-file-precision-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "project";
    const marketplace = "file-precision-index";
    const cache = createCompletionCache();
    const timestamp = Date.parse("2026-08-29T12:00:00.123Z");
    const clock = timestamp + 600_000;
    const expectedRows = [{ name: "precise-row", status: "remote" }] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await writeFile(
      cachePath,
      '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.123Z","plugins":[{"name":"precise-row","status":"remote"}]}',
      "utf8",
    );

    // act
    const rows = await cache.getPluginIndex(
      cachePath,
      scope,
      marketplace,
      () => Promise.reject(new Error("exact file boundary rebuilt")),
      { now: () => clock },
    );

    // assert
    assert.deepStrictEqual(rows, expectedRows);
  });

  test("rebuilds a file cache one millisecond beyond the TTL", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-file-stale-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "user";
    const marketplace = "file-stale-index";
    const cache = createCompletionCache();
    const timestamp = Date.parse("2026-08-29T12:00:00.123Z");
    const clock = timestamp + 600_001;
    const expectedRows = [{ name: "rebuilt-row", status: "upgradable" }] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await writeFile(
      cachePath,
      '{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.123Z","plugins":[{"name":"stale-row","status":"installed"}]}',
      "utf8",
    );

    // act
    const rows = await cache.getPluginIndex(
      cachePath,
      scope,
      marketplace,
      () => Promise.resolve(expectedRows),
      { now: () => clock },
    );

    // assert
    assert.deepStrictEqual(rows, expectedRows);
  });

  test("preserves input order for rows with equal status", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-plugin-order-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "project";
    const marketplace = "equal-row-order-index";
    const cache = createCompletionCache();
    const expectedRows = [
      { name: "zeta", status: "available" },
      { name: "alpha", status: "available" },
      { name: "middle", status: "available" },
    ] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act
    const rows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.resolve(expectedRows),
    );
    const persistedRows = (JSON.parse(await readFile(cachePath, "utf8")) as { plugins: unknown[] })
      .plugins;

    // assert
    assert.deepStrictEqual(rows, expectedRows);
    assert.deepStrictEqual(persistedRows, [
      { name: "zeta", status: "available" },
      { name: "alpha", status: "available" },
      { name: "middle", status: "available" },
    ]);
  });
});

describe("cache invalidation", () => {
  test("invalidating marketplace names removes the named cache file", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-invalidate-names-"));
    const cachePath = path.join(directory, "marketplace-names.json");
    const scope = "user";
    const cache = createCompletionCache();
    t.after(async () => {
      await cache.invalidateMarketplaceNames(cachePath, scope);
      await rm(directory, { recursive: true, force: true });
    });
    await writeFile(cachePath, '{"schemaVersion":2,"names":["before"]}', "utf8");

    // act
    await cache.invalidateMarketplaceNames(cachePath, scope);

    // assert
    await assert.rejects(() => readFile(cachePath, "utf8"), { code: "ENOENT" });
  });

  test("invalidating one plugin index keeps its disk cache", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-invalidate-plugin-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "project";
    const marketplace = "invalidate-memory-index";
    const cache = createCompletionCache();
    const expectedRows = [
      { name: "persisted-row", status: "installed" },
    ] satisfies PluginIndexRow[];
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await cache.getPluginIndex(cachePath, scope, marketplace, () => Promise.resolve(expectedRows));

    // act
    cache.invalidateMarketplaceCache(scope, marketplace);
    const rows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.reject(new Error("memory-only invalidation rebuilt")),
    );

    // assert
    assert.deepStrictEqual(rows, expectedRows);
    assert.deepStrictEqual(
      (JSON.parse(await readFile(cachePath, "utf8")) as { plugins: unknown }).plugins,
      [{ name: "persisted-row", status: "installed" }],
    );
  });

  test("dropping one plugin index removes disk and memory state", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-drop-plugin-"));
    const cachePath = path.join(directory, "plugin-index.json");
    const scope = "user";
    const marketplace = "drop-index";
    const cache = createCompletionCache();
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });
    await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.resolve([{ name: "before", status: "installed" }]),
    );

    // act
    await cache.dropMarketplaceCache(cachePath, scope, marketplace);
    const rows = await cache.getPluginIndex(cachePath, scope, marketplace, () =>
      Promise.resolve([{ name: "after", status: "available" }]),
    );

    // assert
    assert.deepStrictEqual(rows, [{ name: "after", status: "available" }]);
  });

  test("ignores a missing marketplace names cache during invalidation", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-invalidate-names-missing-"));
    const cachePath = path.join(directory, "missing.json");
    const scope = "project";
    const cache = createCompletionCache();
    t.after(() => rm(directory, { recursive: true, force: true }));

    // act
    await cache.invalidateMarketplaceNames(cachePath, scope);

    // assert
    await assert.rejects(() => readFile(cachePath, "utf8"), { code: "ENOENT" });
  });

  test("propagates a non-ENOENT marketplace names unlink error", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-invalidate-names-error-"));
    const scope = "user";
    const cache = createCompletionCache();
    t.after(() => rm(directory, { recursive: true, force: true }));

    // act & assert
    await assert.rejects(
      () => cache.invalidateMarketplaceNames(directory, scope),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.notStrictEqual((error as NodeJS.ErrnoException).code, "ENOENT");
        return true;
      },
    );
  });

  test("ignores a missing plugin cache during destructive invalidation", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-drop-plugin-missing-"));
    const cachePath = path.join(directory, "missing.json");
    const scope = "project";
    const marketplace = "missing-drop-index";
    const cache = createCompletionCache();
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act
    await cache.dropMarketplaceCache(cachePath, scope, marketplace);

    // assert
    await assert.rejects(() => readFile(cachePath, "utf8"), { code: "ENOENT" });
  });

  test("propagates a non-ENOENT plugin cache unlink error", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "completion-drop-plugin-error-"));
    const scope = "user";
    const marketplace = "unlink-error-index";
    const cache = createCompletionCache();
    t.after(async () => {
      cache.invalidateMarketplaceCache(scope, marketplace);
      await rm(directory, { recursive: true, force: true });
    });

    // act & assert
    await assert.rejects(
      () => cache.dropMarketplaceCache(directory, scope, marketplace),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.notStrictEqual((error as NodeJS.ErrnoException).code, "ENOENT");
        return true;
      },
    );
  });
});
