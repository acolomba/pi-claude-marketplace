import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadMergedScopeConfig,
  mergeScopeConfigs,
} from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type {
  MergedConfig,
  ScopeLoadOutcome,
} from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

interface MergeCase {
  readonly name: string;
  readonly baseConfig: ScopeConfig;
  readonly localConfig: ScopeConfig;
  readonly expectedConfig: MergedConfig;
}

interface LoadCase {
  readonly name: string;
  readonly prepare: (locations: ScopedLocations) => Promise<void>;
  readonly expectedOutcome: (locations: ScopedLocations) => ScopeLoadOutcome;
}

const invalidJsonError = "JSON parse failed: Unexpected end of JSON input";

const mergeCases = [
  {
    name: "returns empty maps for empty inputs",
    baseConfig: {},
    localConfig: {},
    expectedConfig: { marketplaces: {}, plugins: {} },
  },
  {
    name: "keeps complete base-only entries",
    baseConfig: {
      marketplaces: {
        base: { source: "base/repository", autoupdate: true },
      },
      plugins: {
        "tool@base": { enabled: false },
      },
    },
    localConfig: {},
    expectedConfig: {
      marketplaces: {
        base: {
          entry: { source: "base/repository", autoupdate: true },
          source: "base",
        },
      },
      plugins: {
        "tool@base": {
          entry: { enabled: false },
          source: "base",
        },
      },
    },
  },
  {
    name: "keeps complete local-only entries",
    baseConfig: {},
    localConfig: {
      marketplaces: {
        local: { source: "local/repository", autoupdate: false },
      },
      plugins: {
        "tool@local": { enabled: true },
      },
    },
    expectedConfig: {
      marketplaces: {
        local: {
          entry: { source: "local/repository", autoupdate: false },
          source: "local",
        },
      },
      plugins: {
        "tool@local": {
          entry: { enabled: true },
          source: "local",
        },
      },
    },
  },
  {
    name: "keeps equal keys once in stable base-first order",
    baseConfig: {
      marketplaces: {
        zebra: { source: "base/zebra" },
        shared: { source: "base/shared", autoupdate: true },
        alpha: { source: "base/alpha" },
      },
      plugins: {
        "zebra@zebra": { enabled: true },
        "shared@shared": { enabled: false },
        "alpha@alpha": {},
      },
    },
    localConfig: {
      marketplaces: {
        shared: { source: "local/shared" },
        omega: { source: "local/omega" },
      },
      plugins: {
        "shared@shared": {},
        "omega@omega": { enabled: false },
      },
    },
    expectedConfig: {
      marketplaces: {
        zebra: { entry: { source: "base/zebra" }, source: "base" },
        shared: { entry: { source: "local/shared", autoupdate: true }, source: "local" },
        alpha: { entry: { source: "base/alpha" }, source: "base" },
        omega: { entry: { source: "local/omega" }, source: "local" },
      },
      plugins: {
        "zebra@zebra": { entry: { enabled: true }, source: "base" },
        "shared@shared": { entry: { enabled: false }, source: "local" },
        "alpha@alpha": { entry: {}, source: "base" },
        "omega@omega": { entry: { enabled: false }, source: "local" },
      },
    },
  },
  {
    name: "keeps a plugin without a marketplace entry",
    baseConfig: {
      plugins: {
        "orphan@missing": { enabled: true },
      },
    },
    localConfig: {},
    expectedConfig: {
      marketplaces: {},
      plugins: {
        "orphan@missing": {
          entry: { enabled: true },
          source: "base",
        },
      },
    },
  },
  {
    name: "gives a local marketplace entry without autoupdate the shared autoupdate",
    baseConfig: {
      marketplaces: {
        tools: { source: "./tools", autoupdate: true },
      },
    },
    localConfig: {
      marketplaces: {
        tools: { source: "./tools" },
      },
    },
    expectedConfig: {
      marketplaces: {
        tools: { entry: { source: "./tools", autoupdate: true }, source: "local" },
      },
      plugins: {},
    },
  },
  {
    name: "lets the local autoupdate of a marketplace win over the shared one",
    baseConfig: {
      marketplaces: {
        tools: { source: "./tools", autoupdate: true },
      },
    },
    localConfig: {
      marketplaces: {
        tools: { source: "./tools", autoupdate: false },
      },
    },
    expectedConfig: {
      marketplaces: {
        tools: { entry: { source: "./tools", autoupdate: false }, source: "local" },
      },
      plugins: {},
    },
  },
  {
    name: "lets a local marketplace source spelled another way win over the shared one",
    baseConfig: {
      marketplaces: {
        tools: { source: "~/marketplaces/tools", autoupdate: true },
      },
    },
    localConfig: {
      marketplaces: {
        tools: { source: "/home/user/marketplaces/tools" },
      },
    },
    expectedConfig: {
      marketplaces: {
        tools: {
          entry: { source: "/home/user/marketplaces/tools", autoupdate: true },
          source: "local",
        },
      },
      plugins: {},
    },
  },
  {
    name: "keeps the unknown fields of both marketplace entries with the local value winning",
    baseConfig: JSON.parse(
      '{"marketplaces":{"tools":{"source":"./tools","channel":"stable","mirror":"base"}}}',
    ) as ScopeConfig,
    localConfig: JSON.parse(
      '{"marketplaces":{"tools":{"source":"./tools","mirror":"local","pinned":true}}}',
    ) as ScopeConfig,
    expectedConfig: JSON.parse(
      '{"marketplaces":{"tools":{"entry":{"source":"./tools","channel":"stable","mirror":"local","pinned":true},"source":"local"}},"plugins":{}}',
    ) as MergedConfig,
  },
  {
    name: "gives a local plugin entry without enabled the shared enabled",
    baseConfig: {
      plugins: {
        "formatter@tools": { enabled: false },
      },
    },
    localConfig: {
      plugins: {
        "formatter@tools": {},
      },
    },
    expectedConfig: {
      marketplaces: {},
      plugins: {
        "formatter@tools": { entry: { enabled: false }, source: "local" },
      },
    },
  },
  {
    name: "lets the local enabled of a plugin win over the shared one",
    baseConfig: {
      plugins: {
        "formatter@tools": { enabled: false },
      },
    },
    localConfig: {
      plugins: {
        "formatter@tools": { enabled: true },
      },
    },
    expectedConfig: {
      marketplaces: {},
      plugins: {
        "formatter@tools": { entry: { enabled: true }, source: "local" },
      },
    },
  },
  {
    name: "keeps the unknown fields of both plugin entries with the local value winning",
    baseConfig: JSON.parse(
      '{"plugins":{"formatter@tools":{"enabled":false,"channel":"stable","mirror":"base"}}}',
    ) as ScopeConfig,
    localConfig: JSON.parse(
      '{"plugins":{"formatter@tools":{"mirror":"local","pinned":true}}}',
    ) as ScopeConfig,
    expectedConfig: JSON.parse(
      '{"marketplaces":{},"plugins":{"formatter@tools":{"entry":{"enabled":false,"channel":"stable","mirror":"local","pinned":true},"source":"local"}}}',
    ) as MergedConfig,
  },
  {
    name: "merges a prototype-named plugin both layers declare into an own entry",
    baseConfig: JSON.parse(
      '{"plugins":{"__proto__":{"enabled":false,"channel":"stable"}}}',
    ) as ScopeConfig,
    localConfig: JSON.parse('{"plugins":{"__proto__":{"channel":"beta"}}}') as ScopeConfig,
    expectedConfig: {
      marketplaces: {},
      plugins: Object.fromEntries([
        ["__proto__", { entry: { enabled: false, channel: "beta" }, source: "local" }],
      ]),
    },
  },
  {
    name: "merges prototype-named marketplaces both files declare into own entries",
    baseConfig: JSON.parse(
      '{"marketplaces":{"__proto__":{"source":"base/proto","autoupdate":true},"constructor":{"source":"base/constructor","autoupdate":false}}}',
    ) as ScopeConfig,
    localConfig: JSON.parse(
      '{"marketplaces":{"__proto__":{"source":"local/proto"},"constructor":{"source":"base/constructor","autoupdate":true}}}',
    ) as ScopeConfig,
    expectedConfig: {
      marketplaces: Object.fromEntries([
        ["__proto__", { entry: { source: "local/proto", autoupdate: true }, source: "local" }],
        [
          "constructor",
          { entry: { source: "base/constructor", autoupdate: true }, source: "local" },
        ],
      ]),
      plugins: {},
    },
  },
] satisfies readonly MergeCase[];

const loadCases = [
  {
    name: "preserves two absent file outcomes",
    prepare: () => Promise.resolve(),
    expectedOutcome: () => ({
      merged: { marketplaces: {}, plugins: {} },
      base: { status: "absent" },
      local: { status: "absent" },
    }),
  },
  {
    name: "preserves a valid base outcome beside an absent local outcome",
    prepare: async (locations) => {
      await writeFile(
        locations.configJsonPath,
        '{"schemaVersion":1,"marketplaces":{"base":{"source":"base/repository","autoupdate":true}},"plugins":{"tool@base":{"enabled":true}}}',
        "utf8",
      );
    },
    expectedOutcome: (locations) => ({
      merged: {
        marketplaces: {
          base: {
            entry: { source: "base/repository", autoupdate: true },
            source: "base",
          },
        },
        plugins: {
          "tool@base": { entry: { enabled: true }, source: "base" },
        },
      },
      base: {
        status: "valid",
        filePath: locations.configJsonPath,
        config: {
          schemaVersion: 1,
          marketplaces: {
            base: { source: "base/repository", autoupdate: true },
          },
          plugins: {
            "tool@base": { enabled: true },
          },
        },
      },
      local: { status: "absent" },
    }),
  },
  {
    name: "preserves an absent base outcome beside a valid local outcome",
    prepare: async (locations) => {
      await writeFile(
        locations.configLocalJsonPath,
        '{"schemaVersion":1,"marketplaces":{"local":{"source":"local/repository"}},"plugins":{"tool@local":{"enabled":false}}}',
        "utf8",
      );
    },
    expectedOutcome: (locations) => ({
      merged: {
        marketplaces: {
          local: { entry: { source: "local/repository" }, source: "local" },
        },
        plugins: {
          "tool@local": { entry: { enabled: false }, source: "local" },
        },
      },
      base: { status: "absent" },
      local: {
        status: "valid",
        filePath: locations.configLocalJsonPath,
        config: {
          schemaVersion: 1,
          marketplaces: {
            local: { source: "local/repository" },
          },
          plugins: {
            "tool@local": { enabled: false },
          },
        },
      },
    }),
  },
  {
    name: "preserves an invalid base outcome beside an absent local outcome",
    prepare: async (locations) => {
      await writeFile(locations.configJsonPath, "", "utf8");
    },
    expectedOutcome: (locations) => ({
      merged: { marketplaces: {}, plugins: {} },
      base: {
        status: "invalid",
        filePath: locations.configJsonPath,
        error: invalidJsonError,
      },
      local: { status: "absent" },
    }),
  },
  {
    name: "preserves an absent base outcome beside an invalid local outcome",
    prepare: async (locations) => {
      await writeFile(locations.configLocalJsonPath, "", "utf8");
    },
    expectedOutcome: (locations) => ({
      merged: { marketplaces: {}, plugins: {} },
      base: { status: "absent" },
      local: {
        status: "invalid",
        filePath: locations.configLocalJsonPath,
        error: invalidJsonError,
      },
    }),
  },
  {
    name: "preserves two valid outcomes beside the stable merged view",
    prepare: async (locations) => {
      await writeFile(
        locations.configJsonPath,
        '{"schemaVersion":1,"marketplaces":{"zebra":{"source":"base/zebra"},"shared":{"source":"base/shared","autoupdate":true}},"plugins":{"zebra@zebra":{"enabled":true},"shared@shared":{"enabled":false}}}',
        "utf8",
      );
      await writeFile(
        locations.configLocalJsonPath,
        '{"schemaVersion":1,"marketplaces":{"shared":{"source":"local/shared"},"alpha":{"source":"local/alpha"}},"plugins":{"shared@shared":{},"alpha@alpha":{"enabled":true}}}',
        "utf8",
      );
    },
    expectedOutcome: (locations) => ({
      merged: {
        marketplaces: {
          zebra: { entry: { source: "base/zebra" }, source: "base" },
          shared: { entry: { source: "local/shared", autoupdate: true }, source: "local" },
          alpha: { entry: { source: "local/alpha" }, source: "local" },
        },
        plugins: {
          "zebra@zebra": { entry: { enabled: true }, source: "base" },
          "shared@shared": { entry: { enabled: false }, source: "local" },
          "alpha@alpha": { entry: { enabled: true }, source: "local" },
        },
      },
      base: {
        status: "valid",
        filePath: locations.configJsonPath,
        config: {
          schemaVersion: 1,
          marketplaces: {
            zebra: { source: "base/zebra" },
            shared: { source: "base/shared", autoupdate: true },
          },
          plugins: {
            "zebra@zebra": { enabled: true },
            "shared@shared": { enabled: false },
          },
        },
      },
      local: {
        status: "valid",
        filePath: locations.configLocalJsonPath,
        config: {
          schemaVersion: 1,
          marketplaces: {
            shared: { source: "local/shared" },
            alpha: { source: "local/alpha" },
          },
          plugins: {
            "shared@shared": {},
            "alpha@alpha": { enabled: true },
          },
        },
      },
    }),
  },
  {
    name: "preserves an invalid base outcome beside a valid local fallback",
    prepare: async (locations) => {
      await writeFile(locations.configJsonPath, "", "utf8");
      await writeFile(
        locations.configLocalJsonPath,
        '{"marketplaces":{"local":{"source":"local/fallback"}},"plugins":{"tool@local":{}}}',
        "utf8",
      );
    },
    expectedOutcome: (locations) => ({
      merged: {
        marketplaces: {
          local: { entry: { source: "local/fallback" }, source: "local" },
        },
        plugins: {
          "tool@local": { entry: {}, source: "local" },
        },
      },
      base: {
        status: "invalid",
        filePath: locations.configJsonPath,
        error: invalidJsonError,
      },
      local: {
        status: "valid",
        filePath: locations.configLocalJsonPath,
        config: {
          marketplaces: {
            local: { source: "local/fallback" },
          },
          plugins: {
            "tool@local": {},
          },
        },
      },
    }),
  },
  {
    name: "preserves a valid base fallback beside an invalid local outcome",
    prepare: async (locations) => {
      await writeFile(
        locations.configJsonPath,
        '{"marketplaces":{"base":{"source":"base/fallback"}},"plugins":{"tool@base":{"enabled":false}}}',
        "utf8",
      );
      await writeFile(locations.configLocalJsonPath, "", "utf8");
    },
    expectedOutcome: (locations) => ({
      merged: {
        marketplaces: {
          base: { entry: { source: "base/fallback" }, source: "base" },
        },
        plugins: {
          "tool@base": { entry: { enabled: false }, source: "base" },
        },
      },
      base: {
        status: "valid",
        filePath: locations.configJsonPath,
        config: {
          marketplaces: {
            base: { source: "base/fallback" },
          },
          plugins: {
            "tool@base": { enabled: false },
          },
        },
      },
      local: {
        status: "invalid",
        filePath: locations.configLocalJsonPath,
        error: invalidJsonError,
      },
    }),
  },
  {
    name: "preserves two invalid outcomes beside an empty merged view",
    prepare: async (locations) => {
      await writeFile(locations.configJsonPath, "", "utf8");
      await writeFile(locations.configLocalJsonPath, "", "utf8");
    },
    expectedOutcome: (locations) => ({
      merged: { marketplaces: {}, plugins: {} },
      base: {
        status: "invalid",
        filePath: locations.configJsonPath,
        error: invalidJsonError,
      },
      local: {
        status: "invalid",
        filePath: locations.configLocalJsonPath,
        error: invalidJsonError,
      },
    }),
  },
] satisfies readonly LoadCase[];

async function createConfigMergeLocations(t: TestContext): Promise<ScopedLocations> {
  const directory = await mkdtemp(path.join(tmpdir(), "config-merge-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
  return locations;
}

describe("mergeScopeConfigs", () => {
  test("keeps JSON-derived prototype-named base entries as own merged values", () => {
    // arrange
    const baseConfig = JSON.parse(
      '{"marketplaces":{"__proto__":{"source":"base/proto"},"constructor":{"source":"base/constructor"},"toString":{"source":"base/to-string"}},"plugins":{"__proto__":{"enabled":true},"constructor":{"enabled":false},"toString":{}}}',
    ) as ScopeConfig;
    const localConfig = JSON.parse('{"marketplaces":{},"plugins":{}}') as ScopeConfig;
    const expectedConfig = {
      marketplaces: Object.fromEntries([
        ["__proto__", { entry: { source: "base/proto" }, source: "base" }],
        ["constructor", { entry: { source: "base/constructor" }, source: "base" }],
        ["toString", { entry: { source: "base/to-string" }, source: "base" }],
      ]),
      plugins: Object.fromEntries([
        ["__proto__", { entry: { enabled: true }, source: "base" }],
        ["constructor", { entry: { enabled: false }, source: "base" }],
        ["toString", { entry: {}, source: "base" }],
      ]),
    } satisfies MergedConfig;

    // act
    const mergedConfig = mergeScopeConfigs(baseConfig, localConfig);

    // assert
    assert.deepStrictEqual(mergedConfig, expectedConfig);
    assert.deepStrictEqual(Object.keys(mergedConfig.marketplaces), [
      "__proto__",
      "constructor",
      "toString",
    ]);
    assert.deepStrictEqual(Object.keys(mergedConfig.plugins), [
      "__proto__",
      "constructor",
      "toString",
    ]);
  });

  for (const { name, baseConfig, localConfig, expectedConfig } of mergeCases) {
    test(name, () => {
      // arrange
      const expectedMarketplaceKeys = Object.keys(expectedConfig.marketplaces);
      const expectedPluginKeys = Object.keys(expectedConfig.plugins);

      // act
      const mergedConfig = mergeScopeConfigs(baseConfig, localConfig);

      // assert
      assert.deepStrictEqual(mergedConfig, expectedConfig);
      assert.deepStrictEqual(Object.keys(mergedConfig.marketplaces), expectedMarketplaceKeys);
      assert.deepStrictEqual(Object.keys(mergedConfig.plugins), expectedPluginKeys);
    });
  }
});

describe("loadMergedScopeConfig", () => {
  for (const { name, prepare, expectedOutcome } of loadCases) {
    test(name, async (t) => {
      // arrange
      const locations = await createConfigMergeLocations(t);
      await prepare(locations);
      const expectedScopeOutcome = expectedOutcome(locations);
      const expectedMarketplaceKeys = Object.keys(expectedScopeOutcome.merged.marketplaces);
      const expectedPluginKeys = Object.keys(expectedScopeOutcome.merged.plugins);

      // act
      const scopeOutcome = await loadMergedScopeConfig(locations);

      // assert
      assert.deepStrictEqual(scopeOutcome, expectedScopeOutcome);
      assert.deepStrictEqual(
        Object.keys(scopeOutcome.merged.marketplaces),
        expectedMarketplaceKeys,
      );
      assert.deepStrictEqual(Object.keys(scopeOutcome.merged.plugins), expectedPluginKeys);
    });
  }
});
