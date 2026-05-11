/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../extensions/claude-marketplace/shared/completion-cache.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("schemaVersion snapshot :: MARKETPLACE_NAMES_CACHE_SCHEMA.schemaVersion === 1", () => {});
test.skip("schemaVersion snapshot :: PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion === 1", () => {});
test.skip("getMarketplaceNames :: lazy load on first call; cache hit on second (no rebuild call)", () => {});
test.skip("getMarketplaceNames :: in-memory hit serves without file read", () => {});
test.skip("getMarketplaceNames :: file hit on memory miss; no rebuild", () => {});
test.skip("getMarketplaceNames :: ENOENT triggers rebuild + atomic write", () => {});
test.skip("getMarketplaceNames :: schemaVersion mismatch drops + rebuilds", () => {});
test.skip("getMarketplaceNames :: corrupt JSON drops + rebuilds", () => {});
test.skip("getPluginIndex :: lazy load + cache hit (same as marketplace-names)", () => {});
test.skip("D-03-TTL :: getPluginIndex re-reads file after 10-min TTL via injected clock", () => {});
test.skip("D-03-TTL :: getPluginIndex serves in-memory before TTL expiry", () => {});
test.skip("invalidateMarketplaceNames :: next read rebuilds from authoritative source", () => {});
test.skip("invalidateMarketplaceCache :: next read rebuilds (memory dropped, file kept)", () => {});
test.skip("dropMarketplaceCache :: removes cache file + memory entry", () => {});
test.skip("dropMarketplaceCache :: ENOENT on cache file is silent (file already absent is OK)", () => {});
test.skip("TC-8 :: rebuild that throws manifest error caches { plugins: [], _loadError }", () => {});
test.skip("TC-8 :: subsequent reads of TC-8-poisoned cache return [] (no throw)", () => {});
test.skip("TC-9 :: rebuild that throws state.json error propagates from getMarketplaceNames", () => {});
test.skip("TC-9 :: rebuild that throws state.json error propagates from getPluginIndex", () => {});
