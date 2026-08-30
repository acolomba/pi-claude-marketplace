import assert from "node:assert/strict";
import test from "node:test";

import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";

import type { MergedConfig } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

test("replaces complete base entries with local entries", () => {
  // arrange
  const baseConfig = {
    marketplaces: {
      tools: { source: "base/tools", autoupdate: true },
    },
    plugins: {
      "formatter@tools": { enabled: true },
    },
  } satisfies ScopeConfig;
  const localConfig = {
    marketplaces: {
      tools: { source: "local/tools" },
    },
    plugins: {
      "formatter@tools": {},
    },
  } satisfies ScopeConfig;
  const expectedConfig = {
    marketplaces: {
      tools: {
        entry: { source: "local/tools" },
        source: "local",
      },
    },
    plugins: {
      "formatter@tools": {
        entry: {},
        source: "local",
      },
    },
  } satisfies MergedConfig;

  // act
  const mergedConfig = mergeScopeConfigs(baseConfig, localConfig);

  // assert
  assert.deepStrictEqual(mergedConfig, expectedConfig);
});
