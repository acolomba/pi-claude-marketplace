import assert from "node:assert/strict";
import test from "node:test";

import { UNINSTALL_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete uninstall command context", () => {
  // arrange
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(UNINSTALL_CONTEXT);
  const renderKeys = Object.keys(UNINSTALL_CONTEXT.render);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "render", "markers"]);
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
    reasons: [],
  } as const satisfies ResolvedRow<PluginUninstalledMessage>;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: true,
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
    reasons: [],
  });
  assert.equal(Object.hasOwn(row, "failure"), false);
});

test("renders a failed uninstall row without leaking its failure detail into the row body", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["unstage failed"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    failure,
  } as const satisfies ResolvedRow<PluginFailedMessage>;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: true,
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
    failure,
  });
});
