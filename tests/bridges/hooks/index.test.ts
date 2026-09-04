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

import type * as HooksBarrel from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";

type Public<Name extends keyof typeof HooksBarrel> = Name;

// @ts-expect-error the barrel keeps accumulateStream internal
void ("accumulateStream" satisfies Public<"accumulateStream">);
// @ts-expect-error the barrel keeps assertNoSymlinkEscapeInHooksSubtree internal
void ("assertNoSymlinkEscapeInHooksSubtree" satisfies Public<"assertNoSymlinkEscapeInHooksSubtree">);
// @ts-expect-error the barrel keeps assertSymlinkEntryContained internal
void ("assertSymlinkEntryContained" satisfies Public<"assertSymlinkEntryContained">);
// @ts-expect-error the barrel keeps compileIfPredicate internal
void ("compileIfPredicate" satisfies Public<"compileIfPredicate">);
// @ts-expect-error the barrel keeps currentEpoch internal
void ("currentEpoch" satisfies Public<"currentEpoch">);
// @ts-expect-error the barrel keeps ifFires internal
void ("ifFires" satisfies Public<"ifFires">);
// @ts-expect-error the barrel keeps installTimerLadder internal
void ("installTimerLadder" satisfies Public<"installTimerLadder">);
// @ts-expect-error the barrel keeps liveEpoch internal
void ("liveEpoch" satisfies Public<"liveEpoch">);
// @ts-expect-error the barrel keeps MATCH_ALL_IF internal
void ("MATCH_ALL_IF" satisfies Public<"MATCH_ALL_IF">);
// @ts-expect-error the barrel keeps normalizeSeconds internal
void ("normalizeSeconds" satisfies Public<"normalizeSeconds">);
// @ts-expect-error the barrel keeps parsedConfigCache internal
void ("parsedConfigCache" satisfies Public<"parsedConfigCache">);
// @ts-expect-error the barrel keeps parsedConfigEntries internal
void ("parsedConfigEntries" satisfies Public<"parsedConfigEntries">);
// @ts-expect-error the barrel keeps pendingSessionStartContext internal
void ("pendingSessionStartContext" satisfies Public<"pendingSessionStartContext">);
// @ts-expect-error the barrel keeps pendingSessionStartContextEntries internal
void ("pendingSessionStartContextEntries" satisfies Public<"pendingSessionStartContextEntries">);
// @ts-expect-error the barrel keeps readEntriesOrSkip internal
void ("readEntriesOrSkip" satisfies Public<"readEntriesOrSkip">);
// @ts-expect-error the barrel keeps readSymlinkTargetSafe internal
void ("readSymlinkTargetSafe" satisfies Public<"readSymlinkTargetSafe">);
// @ts-expect-error the barrel keeps REQUIRED_EVENT_FIELDS internal
void ("REQUIRED_EVENT_FIELDS" satisfies Public<"REQUIRED_EVENT_FIELDS">);
// @ts-expect-error the barrel keeps routingTable internal
void ("routingTable" satisfies Public<"routingTable">);
// @ts-expect-error the barrel keeps routingTableEntries internal
void ("routingTableEntries" satisfies Public<"routingTableEntries">);
// @ts-expect-error the barrel keeps STDERR_MAX_BYTES internal
void ("STDERR_MAX_BYTES" satisfies Public<"STDERR_MAX_BYTES">);
// @ts-expect-error the barrel keeps STDOUT_MAX_BYTES internal
void ("STDOUT_MAX_BYTES" satisfies Public<"STDOUT_MAX_BYTES">);
// @ts-expect-error the barrel keeps TRANSLATORS internal
void ("TRANSLATORS" satisfies Public<"TRANSLATORS">);

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
