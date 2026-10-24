import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { resolveListCandidate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { seedWarmMirror } from "./warm-mirror-seed.ts";

import type { ManifestPluginEntry } from "../../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const MARKETPLACE_NAME = "third-party";

async function candidateEnvironment(testContext: TestContext): Promise<{
  readonly marketplaceRoot: string;
  readonly locations: ScopedLocations;
}> {
  const environment = await createHermeticEnvironment(testContext, "list-candidate-version-");
  const marketplaceRoot = path.join(environment.cwd, "marketplace");
  await mkdir(marketplaceRoot, { recursive: true });
  return { marketplaceRoot, locations: locationsFor("project", environment.cwd) };
}

async function writePluginManifest(pluginRoot: string, manifest: object): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), JSON.stringify(manifest));
}

function installableVerdict(name: string, pluginRoot: string): object {
  return {
    state: "installable",
    installable: true,
    name,
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

test("reports a git source with no mirror as cold", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const entry: ManifestPluginEntry = {
    name: "cold-plugin",
    source: "https://example.com/cold-plugin.git",
    version: "1.0.0",
  };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, { kind: "cold" });
});

test("VER-02: a path source takes the version its plugin.json declares over the entry's", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const pluginRoot = path.join(environment.marketplaceRoot, "alpha");
  await writePluginManifest(pluginRoot, { name: "alpha", version: "2.0.0" });
  const entry: ManifestPluginEntry = { name: "alpha", source: "./alpha", version: "1.0.0" };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("alpha", pluginRoot),
    version: "2.0.0",
  });
});

test("VER-02: a path source with no plugin.json takes the entry's version", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const pluginRoot = path.join(environment.marketplaceRoot, "alpha");
  await mkdir(pluginRoot);
  const entry: ManifestPluginEntry = { name: "alpha", source: "./alpha", version: "1.0.0" };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("alpha", pluginRoot),
    version: "1.0.0",
  });
});

test("VER-02: a path source that declares no version anywhere carries none", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const pluginRoot = path.join(environment.marketplaceRoot, "alpha");
  await mkdir(pluginRoot);
  const entry: ManifestPluginEntry = { name: "alpha", source: "./alpha" };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("alpha", pluginRoot),
  });
});

test("an unavailable path source carries its verdict and no version", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const pluginRoot = path.join(environment.marketplaceRoot, "missing");
  const entry: ManifestPluginEntry = { name: "missing", source: "./missing", version: "1.0.0" };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: {
      state: "unavailable",
      installable: false,
      name: "missing",
      notes: [`source dir does not exist: ${pluginRoot}`],
    },
  });
});

test("VER-01: a warm git tree takes the version its plugin.json declares over the entry's", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const canonicalUrl = "https://example.com/warm-plugin";
  const { mirrorDirectory } = await seedWarmMirror(environment.locations, canonicalUrl, {
    name: "warm-plugin",
    version: "2.0.0",
  });
  const entry: ManifestPluginEntry = {
    name: "warm-plugin",
    source: canonicalUrl,
    version: "1.0.0",
  };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("warm-plugin", mirrorDirectory),
    version: "2.0.0",
  });
});

test("VER-01: a warm git tree whose plugin.json declares no version takes the entry's", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const canonicalUrl = "https://example.com/warm-plugin";
  const { mirrorDirectory } = await seedWarmMirror(environment.locations, canonicalUrl, {
    name: "warm-plugin",
  });
  const entry: ManifestPluginEntry = {
    name: "warm-plugin",
    source: canonicalUrl,
    version: "1.0.0",
  };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("warm-plugin", mirrorDirectory),
    version: "1.0.0",
  });
});

test("VER-01: a warm git tree that declares no version anywhere takes its commit's sha version", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const canonicalUrl = "https://example.com/warm-plugin";
  const { mirrorDirectory, head } = await seedWarmMirror(environment.locations, canonicalUrl, {
    name: "warm-plugin",
  });
  const entry: ManifestPluginEntry = { name: "warm-plugin", source: canonicalUrl };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: installableVerdict("warm-plugin", mirrorDirectory),
    version: `sha-${head.slice(0, 12)}`,
  });
});

test("VER-01: a warm git-subdir mirror that lacks the subdirectory carries no version", async (testContext) => {
  // arrange
  const environment = await candidateEnvironment(testContext);
  const canonicalUrl = "https://example.com/mono";
  await seedWarmMirror(environment.locations, canonicalUrl, undefined);
  const entry: ManifestPluginEntry = {
    name: "sub-plugin",
    source: { source: "git-subdir", url: canonicalUrl, path: "plugins/sub" },
    version: "1.0.0",
  };

  // act
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: environment.marketplaceRoot, marketplaceName: MARKETPLACE_NAME },
    environment.locations,
  );

  // assert
  assert.deepStrictEqual(candidate, {
    kind: "resolved",
    resolved: {
      state: "unavailable",
      installable: false,
      name: "sub-plugin",
      notes: ['git-subdir path "plugins/sub" does not exist in the plugin clone'],
    },
  });
});
