import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  migrateLegacyMarketplaceRecords,
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
  const legacyPlugin = legacyMarketplace.plugins["plugin-one"];
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
  assert.strictEqual(
    (migration.marketplaces.alpha?.plugins as Record<string, unknown>)["plugin-one"],
    legacyPlugin,
  );
});
