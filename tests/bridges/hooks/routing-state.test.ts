// tests/bridges/hooks/routing-state.test.ts
//
// Tests whose SUBJECT is the routing-state module itself, sitting next to the
// module they exercise. Tests that merely USE `currentEpoch` or
// `getRoutingBucket` while asserting event-router behaviour stay in
// event-router.test.ts -- they are testing that module's public interface and
// these are helpers.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appendPendingSessionStartContext,
  bumpEpoch,
  clearPendingSessionStartContext,
  currentEpoch,
  pendingSessionStartContextEntries,
  resetEpoch,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { type PendingSessionStartContext } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

test("reports zero and exact successive epoch values", (t) => {
  // arrange
  resetEpoch();
  t.after(() => {
    resetEpoch();
  });

  // act
  const epochs = [currentEpoch(), bumpEpoch(), currentEpoch(), bumpEpoch(), currentEpoch()];

  // assert
  assert.deepStrictEqual(epochs, [0, 1, 1, 2, 2]);
});

test("resets an advanced epoch to zero", (t) => {
  // arrange
  resetEpoch();
  t.after(() => {
    resetEpoch();
  });
  const firstEpoch = bumpEpoch();
  const secondEpoch = bumpEpoch();

  // act
  resetEpoch();
  const resetValue = currentEpoch();

  // assert
  assert.deepStrictEqual(
    { firstEpoch, secondEpoch, resetValue },
    { firstEpoch: 1, secondEpoch: 2, resetValue: 0 },
  );
});

test("reads an empty pending SessionStart context", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });

  // act
  const entries = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("skips an empty pending SessionStart context", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });
  const emptyEntry = {
    context: "",
    pluginId: "empty-plugin",
    marketplace: "empty-marketplace",
    scope: "project",
  } satisfies PendingSessionStartContext;

  // act
  appendPendingSessionStartContext(emptyEntry);
  const entries = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("preserves pending SessionStart context order across reads", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });
  const firstEntry = {
    context: "first context",
    pluginId: "first-plugin",
    marketplace: "first-marketplace",
    scope: "user",
  } satisfies PendingSessionStartContext;
  const secondEntry = {
    context: "second context",
    pluginId: "second-plugin",
    marketplace: "second-marketplace",
    scope: "project",
  } satisfies PendingSessionStartContext;
  const expectedEntries = [
    {
      context: "first context",
      pluginId: "first-plugin",
      marketplace: "first-marketplace",
      scope: "user",
    },
    {
      context: "second context",
      pluginId: "second-plugin",
      marketplace: "second-marketplace",
      scope: "project",
    },
  ] satisfies ReadonlyArray<PendingSessionStartContext>;

  // act
  appendPendingSessionStartContext(firstEntry);
  appendPendingSessionStartContext(secondEntry);
  const firstRead = pendingSessionStartContextEntries();
  const secondRead = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstRead, expectedEntries);
  assert.deepStrictEqual(secondRead, expectedEntries);
});

test("clears pending SessionStart context for later reads", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });
  appendPendingSessionStartContext({
    context: "context to clear",
    pluginId: "clear-plugin",
    marketplace: "clear-marketplace",
    scope: "project",
  });

  // act
  clearPendingSessionStartContext();
  const firstReadAfterClear = pendingSessionStartContextEntries();
  const secondReadAfterClear = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstReadAfterClear, []);
  assert.deepStrictEqual(secondReadAfterClear, []);
});
