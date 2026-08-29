import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createManifestCache,
  type ManifestLoader,
} from "../../extensions/pi-claude-marketplace/domain/manifest-cache.ts";

void (((manifestPath: string) => Promise.resolve({ manifestPath })) satisfies ManifestLoader);

async function createManifestFile(
  t: TestContext,
  contents = "{}",
): Promise<{ directory: string; manifestPath: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), "manifest-cache-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  const manifestPath = path.join(directory, "marketplace.json");
  await writeFile(manifestPath, contents, "utf8");
  return { directory, manifestPath };
}

test("loads a cold entry without writing a sidecar file", async (t) => {
  // arrange
  const { directory, manifestPath } = await createManifestFile(t);
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const load = t.mock.fn<ManifestLoader>(() => Promise.resolve(marketplaceManifest));
  const cache = createManifestCache(load);

  // act
  const loadedManifest = await cache.load(manifestPath);
  const directoryEntries = await readdir(directory);

  // assert
  assert.deepStrictEqual(loadedManifest, { name: "marketplace", plugins: [] });
  assert.strictEqual(loadedManifest, marketplaceManifest);
  assert.deepStrictEqual(directoryEntries, ["marketplace.json"]);
  assert.strictEqual(load.mock.callCount(), 1);
  assert.deepStrictEqual(load.mock.calls[0]?.arguments, [manifestPath]);
});

test("returns an unchanged entry by reference without reloading", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const load = t.mock.fn<ManifestLoader>(() => Promise.resolve(marketplaceManifest));
  const cache = createManifestCache(load);

  // act
  const firstManifest = await cache.load(manifestPath);
  const secondManifest = await cache.load(manifestPath);
  const thirdManifest = await cache.load(manifestPath);

  // assert
  assert.deepStrictEqual(firstManifest, { name: "marketplace", plugins: [] });
  assert.deepStrictEqual(secondManifest, { name: "marketplace", plugins: [] });
  assert.deepStrictEqual(thirdManifest, { name: "marketplace", plugins: [] });
  assert.strictEqual(firstManifest, marketplaceManifest);
  assert.strictEqual(secondManifest, firstManifest);
  assert.strictEqual(thirdManifest, firstManifest);
  assert.strictEqual(load.mock.callCount(), 1);
  assert.deepStrictEqual(load.mock.calls[0]?.arguments, [manifestPath]);
});

test("keeps entries private to each cache instance", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const firstManifest = { name: "first", plugins: [] };
  const secondManifest = { name: "second", plugins: [] };
  const firstLoad = t.mock.fn<ManifestLoader>(() => Promise.resolve(firstManifest));
  const secondLoad = t.mock.fn<ManifestLoader>(() => Promise.resolve(secondManifest));
  const firstCache = createManifestCache(firstLoad);
  const secondCache = createManifestCache(secondLoad);

  // act
  const firstLoadedManifest = await firstCache.load(manifestPath);
  const secondLoadedManifest = await secondCache.load(manifestPath);

  // assert
  assert.deepStrictEqual(firstLoadedManifest, { name: "first", plugins: [] });
  assert.deepStrictEqual(secondLoadedManifest, { name: "second", plugins: [] });
  assert.strictEqual(firstLoadedManifest, firstManifest);
  assert.strictEqual(secondLoadedManifest, secondManifest);
  assert.strictEqual(firstLoad.mock.callCount(), 1);
  assert.strictEqual(secondLoad.mock.callCount(), 1);
  assert.deepStrictEqual(firstLoad.mock.calls[0]?.arguments, [manifestPath]);
  assert.deepStrictEqual(secondLoad.mock.calls[0]?.arguments, [manifestPath]);
});

test("caches equal-metadata entries independently by manifest path", async (t) => {
  // arrange
  const { directory, manifestPath } = await createManifestFile(t);
  const otherManifestPath = path.join(directory, "other.json");
  await writeFile(otherManifestPath, "{}", "utf8");
  const sharedTimestamp = new Date("2026-08-28T10:00:00.000Z");
  await utimes(manifestPath, sharedTimestamp, sharedTimestamp);
  await utimes(otherManifestPath, sharedTimestamp, sharedTimestamp);
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const otherMarketplaceManifest = { name: "other", plugins: [] };
  const load = t.mock.fn<ManifestLoader>((loadedPath) =>
    Promise.resolve(loadedPath === manifestPath ? marketplaceManifest : otherMarketplaceManifest),
  );
  const cache = createManifestCache(load);

  // act
  const firstManifest = await cache.load(manifestPath);
  const otherManifest = await cache.load(otherManifestPath);
  const cachedManifest = await cache.load(manifestPath);
  const cachedOtherManifest = await cache.load(otherManifestPath);

  // assert
  assert.deepStrictEqual(firstManifest, { name: "marketplace", plugins: [] });
  assert.deepStrictEqual(otherManifest, { name: "other", plugins: [] });
  assert.deepStrictEqual(cachedManifest, { name: "marketplace", plugins: [] });
  assert.deepStrictEqual(cachedOtherManifest, { name: "other", plugins: [] });
  assert.strictEqual(firstManifest, marketplaceManifest);
  assert.strictEqual(otherManifest, otherMarketplaceManifest);
  assert.strictEqual(cachedManifest, firstManifest);
  assert.strictEqual(cachedOtherManifest, otherManifest);
  assert.strictEqual(load.mock.callCount(), 2);
  assert.deepStrictEqual(
    load.mock.calls.map((call) => call.arguments),
    [[manifestPath], [otherManifestPath]],
  );
});

test("reloads a successful entry after its size changes", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const firstManifest = { name: "first", plugins: [] };
  const secondManifest = { name: "second", plugins: [{ name: "plugin" }] };
  const load = t.mock.fn<ManifestLoader>(() => Promise.resolve(secondManifest));
  load.mock.mockImplementationOnce(() => Promise.resolve(firstManifest), 0);
  const cache = createManifestCache(load);

  // act
  const loadedFirstManifest = await cache.load(manifestPath);
  await writeFile(manifestPath, '{"larger":true}', "utf8");
  const loadedSecondManifest = await cache.load(manifestPath);

  // assert
  assert.deepStrictEqual(loadedFirstManifest, { name: "first", plugins: [] });
  assert.deepStrictEqual(loadedSecondManifest, {
    name: "second",
    plugins: [{ name: "plugin" }],
  });
  assert.strictEqual(loadedFirstManifest, firstManifest);
  assert.strictEqual(loadedSecondManifest, secondManifest);
  assert.strictEqual(load.mock.callCount(), 2);
  assert.deepStrictEqual(
    load.mock.calls.map((call) => call.arguments),
    [[manifestPath], [manifestPath]],
  );
});

test("reloads a successful entry after only its modification time changes", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const firstManifest = { name: "first", plugins: [] };
  const secondManifest = { name: "second", plugins: [] };
  const load = t.mock.fn<ManifestLoader>(() => Promise.resolve(secondManifest));
  load.mock.mockImplementationOnce(() => Promise.resolve(firstManifest), 0);
  const cache = createManifestCache(load);

  // act
  const loadedFirstManifest = await cache.load(manifestPath);
  const fileStat = await stat(manifestPath);
  await utimes(manifestPath, new Date(fileStat.atimeMs), new Date(fileStat.mtimeMs + 2_000));
  const loadedSecondManifest = await cache.load(manifestPath);

  // assert
  assert.deepStrictEqual(loadedFirstManifest, { name: "first", plugins: [] });
  assert.deepStrictEqual(loadedSecondManifest, { name: "second", plugins: [] });
  assert.strictEqual(loadedFirstManifest, firstManifest);
  assert.strictEqual(loadedSecondManifest, secondManifest);
  assert.strictEqual(load.mock.callCount(), 2);
  assert.deepStrictEqual(
    load.mock.calls.map((call) => call.arguments),
    [[manifestPath], [manifestPath]],
  );
});

test("rethrows an unchanged negative entry by identity", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const failure = Object.assign(new Error("invalid manifest"), {
    kind: "invalid-manifest",
    path: manifestPath,
  });
  const load = t.mock.fn<ManifestLoader>(() => Promise.reject(failure));
  const cache = createManifestCache(load);

  // act
  const firstThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  const secondThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  // assert
  assert.strictEqual(firstThrown, failure);
  assert.strictEqual(secondThrown, failure);
  assert.strictEqual(load.mock.callCount(), 1);
});

test("reloads a negative entry after the file size changes", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const failure = new Error("invalid manifest");
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const load = t.mock.fn<ManifestLoader>(() => Promise.resolve(marketplaceManifest));
  load.mock.mockImplementationOnce(() => Promise.reject(failure), 0);
  const cache = createManifestCache(load);

  // act
  const thrown = await cache.load(manifestPath).then(
    () => undefined,
    (loadFailure: unknown) => loadFailure,
  );
  await writeFile(manifestPath, '{"larger":true}', "utf8");
  const loadedManifest = await cache.load(manifestPath);

  // assert
  assert.strictEqual(thrown, failure);
  assert.strictEqual(loadedManifest, marketplaceManifest);
  assert.strictEqual(load.mock.callCount(), 2);
});

test("negative-caches a failure that replaces a successful entry", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const failure = new Error("invalid manifest");
  const load = t.mock.fn<ManifestLoader>(() => Promise.reject(failure));
  load.mock.mockImplementationOnce(() => Promise.resolve(marketplaceManifest), 0);
  const cache = createManifestCache(load);

  // act
  const loadedManifest = await cache.load(manifestPath);
  await writeFile(manifestPath, '{"larger":true}', "utf8");
  const firstThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  const secondThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  // assert
  assert.strictEqual(loadedManifest, marketplaceManifest);
  assert.strictEqual(firstThrown, failure);
  assert.strictEqual(secondThrown, failure);
  assert.strictEqual(load.mock.callCount(), 2);
});

test("treats every initial stat failure as a pure miss", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "manifest-cache-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  const manifestPath = path.join(directory, "missing.json");
  const failure = Object.assign(new Error("missing manifest"), {
    code: "ENOENT",
    path: manifestPath,
  });
  const load = t.mock.fn<ManifestLoader>(() => Promise.reject(failure));
  const cache = createManifestCache(load);

  // act
  const firstThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  const secondThrown = await cache.load(manifestPath).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  // assert
  assert.strictEqual(firstThrown, failure);
  assert.strictEqual(secondThrown, failure);
  assert.strictEqual(load.mock.callCount(), 2);
});

test("returns but does not cache a value when the file disappears during loading", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const marketplaceManifest = { name: "marketplace", plugins: [] };
  const load = t.mock.fn<ManifestLoader>(async () => {
    await rm(manifestPath, { force: true });
    return marketplaceManifest;
  });
  const cache = createManifestCache(load);

  // act
  const firstManifest = await cache.load(manifestPath);
  const secondManifest = await cache.load(manifestPath);

  // assert
  assert.strictEqual(firstManifest, marketplaceManifest);
  assert.strictEqual(secondManifest, marketplaceManifest);
  assert.strictEqual(load.mock.callCount(), 2);
});

test("rethrows a failure when the file disappears during loading", async (t) => {
  // arrange
  const { manifestPath } = await createManifestFile(t);
  const failure = new Error("load failed");
  const load = t.mock.fn<ManifestLoader>(async () => {
    await unlink(manifestPath);
    throw failure;
  });
  const cache = createManifestCache(load);

  // act
  const thrown = await cache.load(manifestPath).then(
    () => undefined,
    (loadFailure: unknown) => loadFailure,
  );

  // assert
  assert.strictEqual(thrown, failure);
  assert.strictEqual(load.mock.callCount(), 1);
});
