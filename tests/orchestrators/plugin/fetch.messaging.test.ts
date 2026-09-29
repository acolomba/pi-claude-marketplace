import assert from "node:assert/strict";
import test from "node:test";

import {
  FETCH_CONTEXT,
  type FetchMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete fetch command context", () => {
  // arrange
  const expectedRenderKeys = [
    "available",
    "partially-available",
    "unavailable",
    "remote",
    "skipped",
    "failed",
  ];

  // act
  const contextKeys = Object.keys(FETCH_CONTEXT);
  const renderKeys = Object.keys(FETCH_CONTEXT.render);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "render", "markers"]);
  assert.deepEqual(FETCH_CONTEXT.Messaging, { label: "Plugin fetch" });
  assert.deepEqual(renderKeys, expectedRenderKeys);
});

test("renders an available post-fetch row without candidate reasons or scope", () => {
  // arrange
  const row = {
    status: "available",
    name: "alpha",
    version: "1.2.3",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render.available(row, "project");

  // assert
  assert.equal(actual, "○ alpha v1.2.3 (available)");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a partially-available post-fetch row with complete reasons", () => {
  // arrange
  const row = {
    status: "partially-available",
    name: "beta",
    version: "2.0.0",
    reasons: ["unsupported hooks"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render["partially-available"](row, "user");

  // assert
  assert.equal(actual, "⊖ beta v2.0.0 (partially-available) {unsupported hooks}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders an unavailable post-fetch row without a scope bracket", () => {
  // arrange
  const row = {
    status: "unavailable",
    name: "gamma",
    reasons: ["permission denied"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render.unavailable(row, "project");

  // assert
  assert.equal(actual, "⊘ gamma (unavailable) {permission denied}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a bare remote post-fetch row without candidate reasons", () => {
  // arrange
  const row = {
    status: "remote",
    name: "delta",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render.remote(row, "user");

  // assert
  assert.equal(actual, "◌ delta (remote)");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a skipped no-op row with scope, version, and reason", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "epsilon",
    scope: "project",
    version: "3.1.4",
    reasons: ["up-to-date"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render.skipped(row, "user");

  // assert
  assert.equal(actual, "⊘ epsilon [project] v3.1.4 (skipped) {up-to-date}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a failed fetch row without leaking its failure detail into the row body", () => {
  // arrange
  const row = {
    status: "failed",
    severity: "error",
    name: "zeta",
    version: "4.0.0",
    reasons: ["network unreachable"],
    failure: {
      cause: { causeChain: ["socket closed"], truncated: false },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = FETCH_CONTEXT.render.failed(row, "project");

  // assert
  assert.equal(actual, "⊘ zeta v4.0.0 (failed) {network unreachable}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});
