import assert from "node:assert/strict";
import test from "node:test";

import { UNINSTALL_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete uninstall command context", () => {
  // arrange
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(UNINSTALL_CONTEXT);
  const renderKeys = Object.keys(UNINSTALL_CONTEXT.rowPolicies);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "rowPolicies"]);
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

  // act
  const actual = composePluginLines(row, "user")[0]!.slice(2);

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

  // act
  const actual = composePluginLines(row, "user")[0]!.slice(2);

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

test("UNINSTALL_CONTEXT declares complete row policies", () => {
  // act
  const policies = UNINSTALL_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    uninstalled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});
