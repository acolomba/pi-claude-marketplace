import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { garbageCollectPluginClones } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const SHA_ALPHA = "1111111111111111111111111111111111111111";
const SHA_BETA = "2222222222222222222222222222222222222222";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

async function freshLocations(t: TestContext): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-gc-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

function pluginRecord({
  resolvedSource,
  resolvedSha,
}: {
  readonly resolvedSource: string;
  readonly resolvedSha?: string;
}): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource,
    ...(resolvedSha === undefined ? {} : { resolvedSha }),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function marketplace(
  locations: ScopedLocations,
  name: string,
  plugins: Record<string, PluginRecord>,
): MarketplaceRecord {
  return {
    name,
    scope: locations.scope,
    source: { kind: "path", raw: `./${name}` },
    addedFromCwd: path.dirname(locations.scopeRoot),
    manifestPath: path.join(locations.extensionRoot, `${name}.json`),
    marketplaceRoot: path.join(locations.extensionRoot, name),
    plugins,
  };
}

async function seedState(
  locations: ScopedLocations,
  marketplaces: Record<string, MarketplaceRecord>,
): Promise<void> {
  await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces });
}

async function seedCloneDirectories(
  locations: ScopedLocations,
  keys: readonly string[],
): Promise<void> {
  for (const key of keys) {
    await mkdir(path.join(locations.pluginClonesDir, key), { recursive: true });
    await writeFile(path.join(locations.pluginClonesDir, key, "sentinel.txt"), key);
  }
}

async function cloneEntries(locations: ScopedLocations): Promise<string[]> {
  try {
    return (await readdir(locations.pluginClonesDir)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

test("preserves SHA-backed clone roots and removes stale directories", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {
    alpha: marketplace(locations, "alpha", {
      direct: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "alpha-live"),
        resolvedSha: SHA_ALPHA,
      }),
    }),
    beta: marketplace(locations, "beta", {
      nested: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "beta-live", "packages", "nested"),
        resolvedSha: SHA_BETA,
      }),
    }),
  });
  await seedCloneDirectories(locations, ["alpha-live", "beta-live", "gamma-stale"]);

  // act
  const leaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), ["alpha-live", "beta-live"]);
  assert.strictEqual(
    await readFile(path.join(locations.pluginClonesDir, "alpha-live", "sentinel.txt"), "utf8"),
    "alpha-live",
  );
  assert.strictEqual(
    await readFile(path.join(locations.pluginClonesDir, "beta-live", "sentinel.txt"), "utf8"),
    "beta-live",
  );
});

test("keeps a shared clone while any surviving record references it", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {
    alpha: marketplace(locations, "alpha", {
      first: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "shared-live"),
        resolvedSha: SHA_ALPHA,
      }),
      second: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "shared-live", "plugin"),
        resolvedSha: SHA_BETA,
      }),
    }),
  });
  await seedCloneDirectories(locations, ["shared-live"]);

  // act
  const leaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), ["shared-live"]);
});

test("removes an in-cache source when its record has no resolved SHA", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {
    alpha: marketplace(locations, "alpha", {
      local: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "unprotected-clone"),
      }),
    }),
  });
  await seedCloneDirectories(locations, ["unprotected-clone"]);

  // act
  const leaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), []);
});

test("ignores SHA-backed records at and outside the clone root", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {
    alpha: marketplace(locations, "alpha", {
      exactRoot: pluginRecord({
        resolvedSource: locations.pluginClonesDir,
        resolvedSha: SHA_ALPHA,
      }),
      outsideRoot: pluginRecord({
        resolvedSource: path.join(locations.extensionRoot, "outside-clone"),
        resolvedSha: SHA_BETA,
      }),
    }),
  });
  await seedCloneDirectories(locations, ["alpha-stale", "beta-stale"]);

  // act
  const leaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), []);
});

test("returns an empty leak list when the clone cache is absent", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {});

  // act
  const leaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), []);
});

test("rethrows a non-ENOENT clone-cache read failure without changing the file", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {});
  await writeFile(locations.pluginClonesDir, "not a directory");
  let caught: unknown;

  // act
  try {
    await garbageCollectPluginClones(locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.name, "Error");
  assert.strictEqual((caught as NodeJS.ErrnoException).code, "ENOTDIR");
  assert.strictEqual(await readFile(locations.pluginClonesDir, "utf8"), "not a directory");
});

test("deletes every stale clone again after a completed sweep", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {});
  await seedCloneDirectories(locations, ["alpha-stale", "beta-stale"]);

  // act
  const firstLeaks = await garbageCollectPluginClones(locations);
  const secondLeaks = await garbageCollectPluginClones(locations);

  // assert
  assert.deepStrictEqual(firstLeaks, []);
  assert.deepStrictEqual(secondLeaks, []);
  assert.deepStrictEqual(await cloneEntries(locations), []);
});

test("rejects an unsafe clone key before deleting its directory", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const unsafeKey = "unsafe\nkey";
  await seedState(locations, {});
  await seedCloneDirectories(locations, [unsafeKey]);
  let caught: unknown;

  // act
  try {
    await garbageCollectPluginClones(locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.name, "Error");
  assert.strictEqual(
    caught.message,
    `pluginCloneDir clone key "${unsafeKey}" "${unsafeKey}" must not contain ASCII control characters.`,
  );
  assert.deepStrictEqual(await cloneEntries(locations), [unsafeKey]);
  assert.strictEqual(
    await readFile(path.join(locations.pluginClonesDir, unsafeKey, "sentinel.txt"), "utf8"),
    unsafeKey,
  );
});

test("rejects a symlinked clone entry before touching its external target", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const externalDirectory = path.join(path.dirname(locations.scopeRoot), "external-clone");
  const externalSentinel = path.join(externalDirectory, "sentinel.txt");
  const linkPath = path.join(locations.pluginClonesDir, "linked-clone");
  await seedState(locations, {});
  await mkdir(locations.pluginClonesDir, { recursive: true });
  await mkdir(externalDirectory, { recursive: true });
  await writeFile(externalSentinel, "external");
  await symlink(externalDirectory, linkPath, "dir");
  let caught: unknown;

  // act
  try {
    await garbageCollectPluginClones(locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.name, "SymlinkRefusedError");
  assert.strictEqual(
    caught.message,
    `pluginCloneDir(linked-clone) contains symlink ${linkPath} -> ${externalDirectory} (parent: ${locations.pluginClonesDir}, target: ${linkPath}).`,
  );
  assert.deepStrictEqual(await cloneEntries(locations), ["linked-clone"]);
  assert.strictEqual(await readFile(externalSentinel, "utf8"), "external");
});

test("records removal leaks in cache order and continues deleting later clones", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  await seedState(locations, {
    alpha: marketplace(locations, "alpha", {
      live: pluginRecord({
        resolvedSource: path.join(locations.pluginClonesDir, "omega-live"),
        resolvedSha: SHA_ALPHA,
      }),
    }),
  });
  await seedCloneDirectories(locations, ["alpha-stale", "beta-stale", "gamma-stale", "omega-live"]);
  const cloneKeys: string[] = [];
  const failureLocations = Object.freeze({
    ...locations,
    async pluginCloneDir(key: string): Promise<string> {
      cloneKeys.push(key);
      if (key === "alpha-stale" || key === "gamma-stale") {
        return `blocked-${key}\0path`;
      }

      return locations.pluginCloneDir(key);
    },
  }) satisfies ScopedLocations;
  const invalidPathMessage = (key: string) =>
    `The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received 'blocked-${key}\\x00path'`;

  // act
  const leaks = await garbageCollectPluginClones(failureLocations);

  // assert
  assert.deepStrictEqual(leaks, [
    `alpha-stale: ${invalidPathMessage("alpha-stale")}`,
    `gamma-stale: ${invalidPathMessage("gamma-stale")}`,
  ]);
  assert.deepStrictEqual(await cloneEntries(locations), [
    "alpha-stale",
    "gamma-stale",
    "omega-live",
  ]);
  assert.deepStrictEqual(cloneKeys, ["alpha-stale", "beta-stale", "gamma-stale"]);
});
