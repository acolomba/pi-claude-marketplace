import assert from "node:assert/strict";
import test from "node:test";

import {
  composeHeldRemovalCause,
  REMOVE_CONTEXT,
  type RemoveRowMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

void ({
  status: "uninstalled",
  name: "helper",
  severity: "info",
  needsReload: true,
} satisfies RemoveRowMsg);

// @ts-expect-error uninstalled transition rows require severity and reload stamps
void ({ status: "uninstalled", name: "helper" } satisfies RemoveRowMsg);

void ({
  status: "uninstalled",
  name: "helper",
  severity: "info",
  needsReload: true,
  // @ts-expect-error uninstalled rows structurally exclude soft dependencies
  dependencies: ["agents"],
} satisfies RemoveRowMsg);

void ({
  status: "failed",
  name: "tool",
  reasons: ["permission denied"],
  severity: "error",
  needsReload: false,
} satisfies RemoveRowMsg);

// @ts-expect-error failed rows cannot carry informational severity
const failedWithInfoSeverity: RemoveRowMsg = {
  status: "failed",
  name: "tool",
  reasons: ["permission denied"],
  severity: "info",
  needsReload: false,
};
void failedWithInfoSeverity;

test("names the plugins that still need a plugin and the order that unblocks the remove", () => {
  // act
  const cause = composeHeldRemovalCause("tools", ["beta@tools", "gamma@extras"]);

  // assert
  assert.strictEqual(
    cause,
    "Uninstall beta@tools, gamma@extras first, then remove the marketplace tools again.",
  );
});

test("exports the complete marketplace-remove command context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "rowPolicies"];
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(REMOVE_CONTEXT);
  const renderKeys = Object.keys(REMOVE_CONTEXT.rowPolicies);

  // assert
  assert.deepStrictEqual(contextKeys, expectedContextKeys);
  assert.deepStrictEqual(REMOVE_CONTEXT.Messaging, { label: "Marketplace remove" });
  assert.deepStrictEqual(renderKeys, expectedRenderKeys);
});

test("renders an uninstalled row with truly omitted optional fields", () => {
  // arrange
  const row = {
    status: "uninstalled",
    name: "helper",
    severity: "info",
    needsReload: true,
    reasons: [],
  } as const satisfies ResolvedRow<RemoveRowMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "uninstalled",
    name: "helper",
    severity: "info",
    needsReload: true,
    reasons: [],
  });
  assert.deepStrictEqual(Object.keys(row), [
    "status",
    "name",
    "severity",
    "needsReload",
    "reasons",
  ]);
  assert.strictEqual(renderedRow, "○ helper (uninstalled)");
});

test("folds an uninstalled row scope into its marketplace and preserves its version", () => {
  // arrange
  const row = {
    status: "uninstalled",
    name: "helper",
    version: "1.2.3",
    scope: "project",
    severity: "info",
    needsReload: true,
    reasons: [],
  } as const satisfies ResolvedRow<RemoveRowMsg>;

  // act
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "uninstalled",
    name: "helper",
    version: "1.2.3",
    scope: "project",
    severity: "info",
    needsReload: true,
    reasons: [],
  });
  assert.strictEqual(renderedRow, "○ helper v1.2.3 (uninstalled)");
});

test("renders a failed row with truly omitted optional fields", () => {
  // arrange
  const row = {
    status: "failed",
    name: "tool",
    reasons: ["plugins remain"],
    severity: "error",
    needsReload: false,
  } as const satisfies ResolvedRow<RemoveRowMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "tool",
    reasons: ["plugins remain"],
    severity: "error",
    needsReload: false,
  });
  assert.deepStrictEqual(Object.keys(row), [
    "status",
    "name",
    "reasons",
    "severity",
    "needsReload",
  ]);
  assert.strictEqual(renderedRow, "⊘ tool (failed) {plugins remain}");
});

test("renders a cross-scope failed row without consuming its failure detail or lifecycle stamps", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["EACCES: permission denied"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    name: "tool",
    version: "2.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    failure,
    severity: "error",
    needsReload: false,
  } as const satisfies ResolvedRow<RemoveRowMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "tool",
    version: "2.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    failure,
    severity: "error",
    needsReload: false,
  });
  assert.strictEqual(
    renderedRow,
    "⊘ tool [project] v2.0.0 (failed) {permission denied, source missing}",
  );
});

test("REMOVE_CONTEXT declares complete row policies", () => {
  // act
  const policies = REMOVE_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    uninstalled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});
