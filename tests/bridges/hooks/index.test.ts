import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hydrateProjectScopeForCwd as definingHydrateProjectScopeForCwd,
  readAndCachePluginHooks as definingReadAndCachePluginHooks,
  rebuildRoutingTables as definingRebuildRoutingTables,
  registerHooksBridge as definingRegisterHooksBridge,
  removePluginConfigFromCache as definingRemovePluginConfigFromCache,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import {
  hydrateProjectScopeForCwd,
  readAndCachePluginHooks,
  rebuildRoutingTables,
  registerHooksBridge,
  removeHookConfig,
  removePluginConfigFromCache,
  writeHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  removeHookConfig as definingRemoveHookConfig,
  writeHookConfig as definingWriteHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/stage.ts";

describe("hydrateProjectScopeForCwd", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedHydrateProjectScopeForCwd = definingHydrateProjectScopeForCwd;

    // act
    const hooksHydrateProjectScopeForCwd = hydrateProjectScopeForCwd;

    // assert
    assert.strictEqual(hooksHydrateProjectScopeForCwd, expectedHydrateProjectScopeForCwd);
  });
});

describe("readAndCachePluginHooks", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedReadAndCachePluginHooks = definingReadAndCachePluginHooks;

    // act
    const hooksReadAndCachePluginHooks = readAndCachePluginHooks;

    // assert
    assert.strictEqual(hooksReadAndCachePluginHooks, expectedReadAndCachePluginHooks);
  });
});

describe("rebuildRoutingTables", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRebuildRoutingTables = definingRebuildRoutingTables;

    // act
    const hooksRebuildRoutingTables = rebuildRoutingTables;

    // assert
    assert.strictEqual(hooksRebuildRoutingTables, expectedRebuildRoutingTables);
  });
});

describe("registerHooksBridge", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRegisterHooksBridge = definingRegisterHooksBridge;

    // act
    const hooksRegisterHooksBridge = registerHooksBridge;

    // assert
    assert.strictEqual(hooksRegisterHooksBridge, expectedRegisterHooksBridge);
  });
});

describe("removeHookConfig", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRemoveHookConfig = definingRemoveHookConfig;

    // act
    const hooksRemoveHookConfig = removeHookConfig;

    // assert
    assert.strictEqual(hooksRemoveHookConfig, expectedRemoveHookConfig);
  });
});

describe("removePluginConfigFromCache", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRemovePluginConfigFromCache = definingRemovePluginConfigFromCache;

    // act
    const hooksRemovePluginConfigFromCache = removePluginConfigFromCache;

    // assert
    assert.strictEqual(hooksRemovePluginConfigFromCache, expectedRemovePluginConfigFromCache);
  });
});

describe("writeHookConfig", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedWriteHookConfig = definingWriteHookConfig;

    // act
    const hooksWriteHookConfig = writeHookConfig;

    // assert
    assert.strictEqual(hooksWriteHookConfig, expectedWriteHookConfig);
  });
});
