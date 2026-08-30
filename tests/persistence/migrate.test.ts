import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  migrateLegacyMarketplaceRecords,
  persistMigratedState,
  type MigrationResult,
} from "../../extensions/pi-claude-marketplace/persistence/migrate.ts";

void ({ marketplaces: { alpha: {} }, mutated: true } satisfies MigrationResult);
// @ts-expect-error MigrationResult contains only object-valued marketplace rows.
void ({ marketplaces: { alpha: null }, mutated: true } satisfies MigrationResult);

test("normalizes a complete legacy marketplace in place", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      alpha: {
        name: "alpha",
        scope: "user",
        source: { kind: "path", raw: "./alpha", logical: "./alpha" },
        addedFromCwd: "/workspace",
        autoupdate: true,
        plugins: {
          "plugin-one": {
            version: "1.2.3",
            resolvedSource: "/extension-root/sources/alpha/plugin-one",
            compatibility: {
              installable: true,
              notes: ["legacy note"],
              supported: ["skills", "commands"],
              unsupported: [],
            },
            resources: {
              skills: ["skills/plugin-one"],
              prompts: ["commands/plugin-one.md"],
            },
            installedAt: "2026-01-02T03:04:05.000Z",
            updatedAt: "2026-02-03T04:05:06.000Z",
            customPluginField: "retained",
          },
        },
        customMarketplaceField: { retained: true },
      },
    },
  };
  const legacyMarketplace = legacyState.marketplaces.alpha;
  const expectedMarketplace = {
    name: "alpha",
    scope: "user",
    source: { kind: "path", raw: "./alpha", logical: "./alpha" },
    addedFromCwd: "/workspace",
    plugins: {
      "plugin-one": {
        version: "1.2.3",
        resolvedSource: "/extension-root/sources/alpha/plugin-one",
        compatibility: {
          installable: true,
          notes: ["legacy note"],
          supported: ["skills", "commands"],
          unsupported: [],
        },
        resources: {
          skills: ["skills/plugin-one"],
          prompts: ["commands/plugin-one.md"],
          agents: [],
          mcpServers: [],
          hooks: [],
        },
        installedAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-02-03T04:05:06.000Z",
        customPluginField: "retained",
        enabled: true,
      },
    },
    customMarketplaceField: { retained: true },
    manifestPath: path.join(
      extensionRoot,
      "sources",
      "alpha",
      ".claude-plugin",
      "marketplace.json",
    ),
    marketplaceRoot: path.join(extensionRoot, "sources", "alpha"),
  };
  const expectedMigration = {
    marketplaces: { alpha: expectedMarketplace },
    mutated: true,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: { alpha: expectedMarketplace },
  });
  assert.strictEqual(migration.marketplaces.alpha, legacyMarketplace);
  assert.strictEqual(migration.marketplaces.alpha?.plugins, legacyMarketplace.plugins);
});

test("preserves optional fields when autoupdate scrubbing is closed", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      beta: {
        name: "beta",
        scope: "project",
        source: { kind: "path", raw: "../beta", logical: "../beta" },
        addedFromCwd: "/project",
        manifestPath: "/custom/beta/marketplace.json",
        marketplaceRoot: "/custom/beta",
        autoupdate: false,
        plugins: {
          "plugin-two": {
            version: "4.5.6",
            resolvedSource: "/custom/beta/plugin-two",
            compatibility: {
              installable: false,
              notes: [],
              supported: ["skills"],
              unsupported: ["hooks"],
            },
            resources: {
              skills: ["skills/plugin-two"],
              prompts: [],
              agents: ["agents/plugin-two.json"],
              mcpServers: ["plugin-two-server"],
              hooks: ["hooks/plugin-two.json"],
            },
            hookEntries: [{ event: "SessionStart", command: "./start.sh" }],
            enabled: false,
            installedAt: "2026-03-04T05:06:07.000Z",
            updatedAt: "2026-04-05T06:07:08.000Z",
          },
        },
      },
    },
  };
  const expectedMigration = {
    marketplaces: {
      beta: {
        name: "beta",
        scope: "project",
        source: { kind: "path", raw: "../beta", logical: "../beta" },
        addedFromCwd: "/project",
        manifestPath: "/custom/beta/marketplace.json",
        marketplaceRoot: "/custom/beta",
        autoupdate: false,
        plugins: {
          "plugin-two": {
            version: "4.5.6",
            resolvedSource: "/custom/beta/plugin-two",
            compatibility: {
              installable: false,
              notes: [],
              supported: ["skills"],
              unsupported: ["hooks"],
            },
            resources: {
              skills: ["skills/plugin-two"],
              prompts: [],
              agents: ["agents/plugin-two.json"],
              mcpServers: ["plugin-two-server"],
              hooks: ["hooks/plugin-two.json"],
            },
            hookEntries: [{ event: "SessionStart", command: "./start.sh" }],
            enabled: false,
            installedAt: "2026-03-04T05:06:07.000Z",
            updatedAt: "2026-04-05T06:07:08.000Z",
          },
        },
      },
    },
    mutated: false,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, false);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: expectedMigration.marketplaces,
  });
});

test("replays a normalized marketplace as an exact fixed point", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const normalizedMarketplace = {
    name: "gamma",
    scope: "user",
    source: { kind: "path", raw: "./gamma", logical: "./gamma" },
    addedFromCwd: "/workspace",
    manifestPath: "/custom/gamma/marketplace.json",
    marketplaceRoot: "/custom/gamma",
    plugins: {
      "plugin-three": {
        version: "7.8.9",
        resolvedSource: "/custom/gamma/plugin-three",
        compatibility: {
          installable: true,
          notes: [],
          supported: ["agents"],
          unsupported: [],
        },
        resources: {
          skills: [],
          prompts: [],
          agents: ["agents/plugin-three.json"],
          mcpServers: [],
          hooks: [],
        },
        enabled: true,
        installedAt: "2026-05-06T07:08:09.000Z",
        updatedAt: "2026-06-07T08:09:10.000Z",
      },
    },
  };
  const normalizedState = {
    schemaVersion: 2,
    marketplaces: { gamma: normalizedMarketplace },
  };
  const expectedMigration = {
    marketplaces: {
      gamma: {
        name: "gamma",
        scope: "user",
        source: { kind: "path", raw: "./gamma", logical: "./gamma" },
        addedFromCwd: "/workspace",
        manifestPath: "/custom/gamma/marketplace.json",
        marketplaceRoot: "/custom/gamma",
        plugins: {
          "plugin-three": {
            version: "7.8.9",
            resolvedSource: "/custom/gamma/plugin-three",
            compatibility: {
              installable: true,
              notes: [],
              supported: ["agents"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: [],
              agents: ["agents/plugin-three.json"],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: "2026-05-06T07:08:09.000Z",
            updatedAt: "2026-06-07T08:09:10.000Z",
          },
        },
      },
    },
    mutated: false,
  } satisfies MigrationResult;

  // act
  const replay = migrateLegacyMarketplaceRecords(normalizedState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(replay, expectedMigration);
  assert.deepStrictEqual(normalizedState, {
    schemaVersion: 2,
    marketplaces: expectedMigration.marketplaces,
  });
  assert.strictEqual(replay.marketplaces.gamma, normalizedMarketplace);
});

for (const { name, parsedState, expectedMigration } of [
  {
    name: "returns an empty result for a null legacy root",
    parsedState: null,
    expectedMigration: { marketplaces: {}, mutated: false } satisfies MigrationResult,
  },
  {
    name: "returns an empty result for a primitive legacy root",
    parsedState: "legacy-state",
    expectedMigration: { marketplaces: {}, mutated: false } satisfies MigrationResult,
  },
  {
    name: "returns an empty result for an array legacy root",
    parsedState: ["legacy-state"],
    expectedMigration: { marketplaces: {}, mutated: false } satisfies MigrationResult,
  },
] as const) {
  test(name, () => {
    // arrange
    const extensionRoot = path.join(path.sep, "extension-root");

    // act
    const migration = migrateLegacyMarketplaceRecords(parsedState, extensionRoot, true);

    // assert
    assert.deepStrictEqual(migration, expectedMigration);
  });
}

for (const { name, parsedState, expectedMigration } of [
  {
    name: "returns an unchanged empty result when the marketplace map is absent",
    parsedState: { schemaVersion: 1 },
    expectedMigration: { marketplaces: {}, mutated: false } satisfies MigrationResult,
  },
  {
    name: "resets a null marketplace map",
    parsedState: { schemaVersion: 1, marketplaces: null },
    expectedMigration: { marketplaces: {}, mutated: true } satisfies MigrationResult,
  },
  {
    name: "resets a primitive marketplace map",
    parsedState: { schemaVersion: 1, marketplaces: "legacy-marketplaces" },
    expectedMigration: { marketplaces: {}, mutated: true } satisfies MigrationResult,
  },
  {
    name: "resets an array marketplace map",
    parsedState: { schemaVersion: 1, marketplaces: ["legacy-marketplace"] },
    expectedMigration: { marketplaces: {}, mutated: true } satisfies MigrationResult,
  },
] as const) {
  test(name, () => {
    // arrange
    const extensionRoot = path.join(path.sep, "extension-root");

    // act
    const migration = migrateLegacyMarketplaceRecords(parsedState, extensionRoot, true);

    // assert
    assert.deepStrictEqual(migration, expectedMigration);
  });
}

test("filters a primitive marketplace row from the normalized result", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: { broken: "not-a-marketplace" },
  };
  const expectedMigration = {
    marketplaces: {},
    mutated: true,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: { broken: "not-a-marketplace" },
  });
});

test("leaves a primitive plugin row for schema rejection without default filling", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      delta: {
        name: "delta",
        manifestPath: "/custom/delta/marketplace.json",
        marketplaceRoot: "/custom/delta",
        plugins: { broken: "not-a-plugin" },
      },
    },
  };
  const expectedMigration = {
    marketplaces: {
      delta: {
        name: "delta",
        manifestPath: "/custom/delta/marketplace.json",
        marketplaceRoot: "/custom/delta",
        plugins: { broken: "not-a-plugin" },
      },
    },
    mutated: false,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: expectedMigration.marketplaces,
  });
});

test("leaves a primitive plugin collection for schema rejection", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      epsilon: {
        name: "epsilon",
        manifestPath: "/custom/epsilon/marketplace.json",
        marketplaceRoot: "/custom/epsilon",
        plugins: "not-a-plugin-map",
      },
    },
  };
  const expectedMigration = {
    marketplaces: {
      epsilon: {
        name: "epsilon",
        manifestPath: "/custom/epsilon/marketplace.json",
        marketplaceRoot: "/custom/epsilon",
        plugins: "not-a-plugin-map",
      },
    },
    mutated: false,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: expectedMigration.marketplaces,
  });
});

test("creates required resources when a legacy plugin omits the collection", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      zeta: {
        name: "zeta",
        manifestPath: "/custom/zeta/marketplace.json",
        marketplaceRoot: "/custom/zeta",
        plugins: {
          "plugin-four": {
            version: "1.0.0",
            enabled: true,
          },
        },
      },
    },
  };
  const expectedMigration = {
    marketplaces: {
      zeta: {
        name: "zeta",
        manifestPath: "/custom/zeta/marketplace.json",
        marketplaceRoot: "/custom/zeta",
        plugins: {
          "plugin-four": {
            version: "1.0.0",
            enabled: true,
            resources: { agents: [], mcpServers: [], hooks: [] },
          },
        },
      },
    },
    mutated: true,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: expectedMigration.marketplaces,
  });
});

test("replaces a null resource collection with required empty arrays", () => {
  // arrange
  const extensionRoot = path.join(path.sep, "extension-root");
  const legacyState = {
    schemaVersion: 1,
    marketplaces: {
      eta: {
        name: "eta",
        manifestPath: "/custom/eta/marketplace.json",
        marketplaceRoot: "/custom/eta",
        plugins: {
          "plugin-five": {
            version: "2.0.0",
            enabled: null,
            resources: null,
          },
        },
      },
    },
  };
  const expectedMigration = {
    marketplaces: {
      eta: {
        name: "eta",
        manifestPath: "/custom/eta/marketplace.json",
        marketplaceRoot: "/custom/eta",
        plugins: {
          "plugin-five": {
            version: "2.0.0",
            enabled: null,
            resources: { agents: [], mcpServers: [], hooks: [] },
          },
        },
      },
    },
    mutated: true,
  } satisfies MigrationResult;

  // act
  const migration = migrateLegacyMarketplaceRecords(legacyState, extensionRoot, true);

  // assert
  assert.deepStrictEqual(migration, expectedMigration);
  assert.deepStrictEqual(legacyState, {
    schemaVersion: 1,
    marketplaces: expectedMigration.marketplaces,
  });
});

test("persists the complete normalized state as exact JSON bytes", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "migrate-success-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stateJsonPath = path.join(directory, "state.json");
  const normalizedState = {
    schemaVersion: 2,
    marketplaces: {
      alpha: {
        name: "alpha",
        manifestPath: "/custom/alpha/marketplace.json",
        marketplaceRoot: "/custom/alpha",
        plugins: {},
      },
    },
  };
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {
      alpha: {
        name: "alpha",
        manifestPath: "/custom/alpha/marketplace.json",
        marketplaceRoot: "/custom/alpha",
        plugins: {},
      },
    },
  };
  const expectedJsonBytes =
    '{\n  "schemaVersion": 2,\n  "marketplaces": {\n    "alpha": {\n      "name": "alpha",\n      "manifestPath": "/custom/alpha/marketplace.json",\n      "marketplaceRoot": "/custom/alpha",\n      "plugins": {}\n    }\n  }\n}\n';
  const warnSpy = t.mock.method(console, "warn", () => undefined);

  // act
  await persistMigratedState(stateJsonPath, normalizedState);
  const jsonBytes = await readFile(stateJsonPath, "utf8");
  const directoryEntries = await readdir(directory);

  // assert
  assert.deepStrictEqual(normalizedState, expectedState);
  assert.strictEqual(jsonBytes, expectedJsonBytes);
  assert.deepStrictEqual(directoryEntries, ["state.json"]);
  assert.strictEqual(warnSpy.mock.callCount(), 0);
});

test("retains in-memory and disk state while warning on persistence failure", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "migrate-failure-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const blockerPath = path.join(directory, "blocker");
  await writeFile(blockerPath, "occupied", "utf8");
  const stateJsonPath = path.join(blockerPath, "state.json");
  const normalizedState = {
    schemaVersion: 2,
    marketplaces: {
      beta: {
        name: "beta",
        manifestPath: "/custom/beta/marketplace.json",
        marketplaceRoot: "/custom/beta",
        plugins: {},
      },
    },
  };
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {
      beta: {
        name: "beta",
        manifestPath: "/custom/beta/marketplace.json",
        marketplaceRoot: "/custom/beta",
        plugins: {},
      },
    },
  };
  const expectedWarning =
    `Legacy marketplace migration could not be persisted to ${stateJsonPath}; ` +
    "the in-memory normalized state is being used and the on-disk state.json is unchanged. " +
    `Cause: EEXIST: file already exists, mkdir '${blockerPath}'.`;
  const warnSpy = t.mock.method(console, "warn", () => undefined);

  // act
  await persistMigratedState(stateJsonPath, normalizedState);
  const blockerBytes = await readFile(blockerPath, "utf8");
  const directoryEntries = await readdir(directory);

  // assert
  assert.deepStrictEqual(normalizedState, expectedState);
  assert.deepStrictEqual(warnSpy.mock.calls[0]?.arguments, [expectedWarning]);
  assert.strictEqual(warnSpy.mock.callCount(), 1);
  assert.strictEqual(blockerBytes, "occupied");
  assert.deepStrictEqual(directoryEntries, ["blocker"]);
});
