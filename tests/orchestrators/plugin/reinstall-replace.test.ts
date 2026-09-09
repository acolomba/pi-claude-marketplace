import assert from "node:assert/strict";
import test from "node:test";

import {
  REAL_REINSTALL_TRANSACTION,
  replaceReinstalledPlugin,
  runPostSuccessMaintenance,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

test("exports the atomic reinstall replacement owner", () => {
  // act & assert
  assert.strictEqual(REAL_REINSTALL_TRANSACTION.replaceReinstalledPlugin, replaceReinstalledPlugin);
});

test("runs committed reinstall maintenance with the exact removal contract", async () => {
  // arrange
  const locations = locationsFor("project", "/workspace");
  const calls: unknown[] = [];
  const completionCache = {
    dropMarketplaceCache: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve();
    },
  } as unknown as CompletionCache;

  // act
  const warnings = await runPostSuccessMaintenance(
    {
      scope: "project",
      marketplace: "market",
      plugin: "plugin",
      removeDataDir: (dataDir, options) => {
        calls.push([dataDir, options]);
        return Promise.resolve();
      },
    },
    locations,
    completionCache,
  );

  // assert
  assert.deepStrictEqual(calls, [
    [await locations.pluginCacheFile("market"), "project", "market"],
    [await locations.pluginDataDir("market", "plugin"), { recursive: true, force: true }],
  ]);
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(Object.isFrozen(warnings), true);
});

test("reports both non-fatal committed maintenance failures", async () => {
  // arrange
  const locations = locationsFor("user", "/workspace");
  const completionCache = {
    dropMarketplaceCache: () => Promise.reject(new Error("cache denied")),
  } as unknown as CompletionCache;
  const dataDir = await locations.pluginDataDir("market", "plugin");

  // act
  const warnings = await runPostSuccessMaintenance(
    {
      scope: "user",
      marketplace: "market",
      plugin: "plugin",
      removeDataDir: () => Promise.reject(new Error("data denied")),
    },
    locations,
    completionCache,
  );

  // assert
  assert.deepStrictEqual(warnings, [
    'Plugin "plugin" reinstalled; completion cache refresh deferred: cache denied',
    `Plugin "plugin" reinstalled; data cleanup deferred at ${dataDir}: data denied`,
  ]);
});
