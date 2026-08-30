import assert from "node:assert/strict";
import { test } from "node:test";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { buildConfigFromState } from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";
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
