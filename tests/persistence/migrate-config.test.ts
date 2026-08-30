import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  buildConfigFromState,
  migrateFirstRunConfig,
  type MigrateFirstRunResult,
} from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";
import { PathContainmentError } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type CompleteProjection = ScopeConfig & {
  readonly schemaVersion: 1;
  readonly marketplaces: NonNullable<ScopeConfig["marketplaces"]>;
  readonly plugins: NonNullable<ScopeConfig["plugins"]>;
};

void (buildConfigFromState satisfies (state: ExtensionState) => CompleteProjection);

const existingValidResult = {
  migrated: false,
  reason: "existing-valid",
  filePath: "/scope/claude-plugins.json",
} satisfies MigrateFirstRunResult;
// @ts-expect-error `error` exists only on the existing-invalid arm.
void existingValidResult.error;

async function createCaseLocations(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), "migrate-config-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  await mkdir(locations.scopeRoot, { recursive: true });
  return { directory, locations };
}

function populatedState(): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      catalog: {
        name: "catalog",
        scope: "project",
        source: { kind: "path", raw: "./catalog", logical: "./catalog" },
        addedFromCwd: "/project",
        manifestPath: "/catalog/marketplace.json",
        marketplaceRoot: "/catalog",
        plugins: {},
      },
    },
  };
}

test("projects an empty state as a complete version-one config", () => {
  // arrange
  const state = { schemaVersion: 2, marketplaces: {} } satisfies ExtensionState;
  const expectedConfig = {
    schemaVersion: 1,
    marketplaces: {},
    plugins: {},
  } satisfies CompleteProjection;

  // act
  const config = buildConfigFromState(state);

  // assert
  assert.deepStrictEqual(config, expectedConfig);
});

test("projects complete marketplaces, plugins, legacy flags, and nullish sources", () => {
  // arrange
  const installedPlugin = {
    version: "1.0.0",
    resolvedSource: "/plugins/installed",
    compatibility: {
      installable: true,
      notes: [],
      supported: ["skills"],
      unsupported: [],
    },
    resources: {
      skills: ["review"],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
    },
    enabled: true,
    installedAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
  } satisfies PluginInstallRecord;
  const degradedPlugin = {
    version: "2.0.0",
    resolvedSource: "/plugins/degraded",
    compatibility: {
      installable: false,
      notes: ["contains unsupported hooks"],
      supported: ["commands"],
      unsupported: ["hooks"],
    },
    resources: {
      skills: [],
      prompts: ["inspect"],
      agents: [],
      mcpServers: [],
      hooks: [],
    },
    enabled: true,
    installedAt: "2026-08-29T11:00:00.000Z",
    updatedAt: "2026-08-29T11:00:00.000Z",
  } satisfies PluginInstallRecord;
  const pathMarketplace = {
    name: "path-catalog",
    scope: "project" as const,
    source: { kind: "path", raw: "./catalog", logical: "./catalog" },
    addedFromCwd: "/project",
    manifestPath: "/catalog/marketplace.json",
    marketplaceRoot: "/catalog",
    plugins: { installed: installedPlugin, degraded: degradedPlugin },
    autoupdate: true,
  };
  const unknownMarketplace = {
    name: "future-catalog",
    scope: "user" as const,
    source: { kind: "unknown", reason: "future source" },
    addedFromCwd: "/project",
    manifestPath: "/future/marketplace.json",
    marketplaceRoot: "/future",
    plugins: {},
    autoupdate: false,
  };
  const nullMarketplace = {
    name: "null-catalog",
    scope: "project" as const,
    source: null,
    addedFromCwd: "/project",
    manifestPath: "/null/marketplace.json",
    marketplaceRoot: "/null",
    plugins: {},
  };
  const undefinedMarketplace = {
    name: "undefined-catalog",
    scope: "project" as const,
    source: undefined,
    addedFromCwd: "/project",
    manifestPath: "/undefined/marketplace.json",
    marketplaceRoot: "/undefined",
    plugins: {},
  };
  const state = {
    schemaVersion: 2,
    marketplaces: {
      "path-catalog": pathMarketplace,
      "future-catalog": unknownMarketplace,
      "null-catalog": nullMarketplace,
      "undefined-catalog": undefinedMarketplace,
    },
  } satisfies ExtensionState;
  const expectedConfig = {
    schemaVersion: 1,
    marketplaces: {
      "path-catalog": { source: "./catalog", autoupdate: true },
      "future-catalog": {
        source: '{"kind":"unknown","reason":"future source"}',
        autoupdate: false,
      },
      "null-catalog": { source: "null" },
      "undefined-catalog": { source: "null" },
    },
    plugins: {
      "installed@path-catalog": {},
      "degraded@path-catalog": {},
    },
  } satisfies CompleteProjection;

  // act
  const config = buildConfigFromState(state);

  // assert
  assert.deepStrictEqual(config, expectedConfig);
});

test("preserves an existing valid config without rewriting its bytes", async (t) => {
  // arrange
  const { locations } = await createCaseLocations(t);
  const configBytes = '{"schemaVersion":1,"marketplaces":{"kept":{"source":"manual"}}}\n';
  await writeFile(locations.configJsonPath, configBytes);
  const state = populatedState();

  // act
  const migration = await migrateFirstRunConfig(locations, state);
  const storedBytes = await readFile(locations.configJsonPath, "utf8");

  // assert
  assert.deepStrictEqual(migration, {
    migrated: false,
    reason: "existing-valid",
    filePath: locations.configJsonPath,
  });
  assert.strictEqual(storedBytes, configBytes);
});

test("preserves an existing invalid config and returns its complete validation failure", async (t) => {
  // arrange
  const { locations } = await createCaseLocations(t);
  const configBytes = "null\n";
  await writeFile(locations.configJsonPath, configBytes);
  const state = populatedState();

  // act
  const migration = await migrateFirstRunConfig(locations, state);
  const storedBytes = await readFile(locations.configJsonPath, "utf8");

  // assert
  assert.deepStrictEqual(migration, {
    migrated: false,
    reason: "existing-invalid",
    error: "schema validation failed: <root>: must be object",
    filePath: locations.configJsonPath,
  });
  assert.strictEqual(storedBytes, configBytes);
});

test("leaves an absent config absent when state has no entries", async (t) => {
  // arrange
  const { locations } = await createCaseLocations(t);
  const state = { schemaVersion: 2, marketplaces: {} } satisfies ExtensionState;

  // act
  const migration = await migrateFirstRunConfig(locations, state);
  const scopeEntries = await readdir(locations.scopeRoot);

  // assert
  assert.deepStrictEqual(migration, {
    migrated: false,
    reason: "empty-state",
    filePath: locations.configJsonPath,
  });
  assert.deepStrictEqual(scopeEntries, []);
});

test("writes exact first-run bytes and replays as a byte-identical no-op", async (t) => {
  // arrange
  const { locations } = await createCaseLocations(t);
  const state = populatedState();
  const expectedBytes =
    '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "catalog": {\n      "source": "./catalog"\n    }\n  },\n  "plugins": {}\n}\n';

  // act
  const migration = await migrateFirstRunConfig(locations, state);
  const firstBytes = await readFile(locations.configJsonPath, "utf8");
  const firstStat = await stat(locations.configJsonPath, { bigint: true });
  const replay = await migrateFirstRunConfig(locations, state);
  const replayBytes = await readFile(locations.configJsonPath, "utf8");
  const replayStat = await stat(locations.configJsonPath, { bigint: true });

  // assert
  assert.deepStrictEqual(migration, {
    migrated: true,
    entryCount: 1,
    filePath: locations.configJsonPath,
  });
  assert.strictEqual(firstBytes, expectedBytes);
  assert.deepStrictEqual(replay, {
    migrated: false,
    reason: "existing-valid",
    filePath: locations.configJsonPath,
  });
  assert.strictEqual(replayBytes, expectedBytes);
  assert.deepStrictEqual(
    {
      ino: replayStat.ino,
      size: replayStat.size,
      mtimeNs: replayStat.mtimeNs,
      ctimeNs: replayStat.ctimeNs,
    },
    {
      ino: firstStat.ino,
      size: firstStat.size,
      mtimeNs: firstStat.mtimeNs,
      ctimeNs: firstStat.ctimeNs,
    },
  );
});

test("propagates containment failure without creating config bytes", async (t) => {
  // arrange
  const { directory, locations } = await createCaseLocations(t);
  const escapedConfigPath = path.join(directory, "escaped.json");
  const escapedLocations = { ...locations, configJsonPath: escapedConfigPath };
  const state = populatedState();

  // act
  let migrationError: unknown;
  try {
    await migrateFirstRunConfig(escapedLocations, state);
  } catch (error) {
    migrationError = error;
  }

  const scopeEntries = await readdir(locations.scopeRoot);
  const directoryEntries = await readdir(directory);

  // assert
  assert.ok(migrationError instanceof PathContainmentError);
  assert.deepStrictEqual(
    {
      name: migrationError.name,
      message: migrationError.message,
      parent: migrationError.parent,
      child: migrationError.child,
    },
    {
      name: "PathContainmentError",
      message: `saveConfig escapes ${locations.scopeRoot} (resolved: ${escapedConfigPath}).`,
      parent: locations.scopeRoot,
      child: escapedConfigPath,
    },
  );
  assert.deepStrictEqual(scopeEntries, []);
  assert.deepStrictEqual(directoryEntries, [".pi"]);
});
