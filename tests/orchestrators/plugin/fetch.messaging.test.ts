import assert from "node:assert/strict";
import test from "node:test";

import {
  FETCH_CONTEXT,
  type FetchMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  assert.deepEqual(contextKeys, ["Messaging", "render"]);
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
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const actual = FETCH_CONTEXT.render.available(row, probe, "project");

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
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const actual = FETCH_CONTEXT.render["partially-available"](row, probe, "user");

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
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: true,
  };

  // act
  const actual = FETCH_CONTEXT.render.unavailable(row, probe, "project");

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
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: false,
  };

  // act
  const actual = FETCH_CONTEXT.render.remote(row, probe, "user");

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
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const actual = FETCH_CONTEXT.render.skipped(row, probe, "user");

  // assert
  assert.equal(actual, "⊘ epsilon [project] v3.1.4 (skipped) {up-to-date}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a failed fetch row without leaking its cause into the row body", () => {
  // arrange
  const row = {
    status: "failed",
    severity: "error",
    name: "zeta",
    version: "4.0.0",
    reasons: ["network unreachable"],
    cause: new Error("socket closed"),
  } as const satisfies FetchMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const actual = FETCH_CONTEXT.render.failed(row, probe, "project");

  // assert
  assert.equal(actual, "⊘ zeta v4.0.0 (failed) {network unreachable}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});
