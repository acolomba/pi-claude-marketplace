import assert from "node:assert/strict";
import test from "node:test";

import { UNINSTALL_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  PluginFailedMessage,
  PluginUninstalledMessage,
} from "../../../extensions/pi-claude-marketplace/shared/notify.ts";

test("exports the complete uninstall command context", () => {
  // arrange
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(UNINSTALL_CONTEXT);
  const renderKeys = Object.keys(UNINSTALL_CONTEXT.render);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "render"]);
  assert.deepEqual(UNINSTALL_CONTEXT.Messaging, { label: "Plugin uninstall" });
  assert.deepEqual(renderKeys, expectedRenderKeys);
});

test("renders a complete cross-scope uninstalled transition row", () => {
  // arrange
  const row = {
    status: "uninstalled",
    severity: "info",
    needsReload: true,
    name: "alpha",
    version: "1.2.3",
    scope: "project",
  } as const satisfies PluginUninstalledMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const actual = UNINSTALL_CONTEXT.render.uninstalled(row, probe, "user");

  // assert
  assert.equal(actual, "○ alpha [project] v1.2.3 (uninstalled)");
  assert.deepEqual(row, {
    status: "uninstalled",
    severity: "info",
    needsReload: true,
    name: "alpha",
    version: "1.2.3",
    scope: "project",
  });
  assert.equal(Object.hasOwn(row, "reasons"), false);
  assert.equal(Object.hasOwn(row, "cause"), false);
});

test("renders a failed uninstall row without leaking its cause into the row body", () => {
  // arrange
  const cause = new Error("unstage failed");
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    cause,
  } as const satisfies PluginFailedMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const actual = UNINSTALL_CONTEXT.render.failed(row, probe, "user");

  // assert
  assert.equal(actual, "⊘ beta v2.0.0 (failed) {permission denied, rollback partial}");
  assert.deepEqual(row, {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    cause,
  });
});
