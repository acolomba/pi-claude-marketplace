import assert from "node:assert/strict";
import test from "node:test";

import {
  REMOVE_CONTEXT,
  type RemovePrivateReason,
  type RemoveRowMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ("plugins remain" satisfies RemovePrivateReason);

// @ts-expect-error marketplace remove owns only the plugins-remain private reason
void ("permission denied" satisfies RemovePrivateReason);

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

test("exports the complete marketplace-remove command context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "render"];
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(REMOVE_CONTEXT);
  const renderKeys = Object.keys(REMOVE_CONTEXT.render);

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
  } as const satisfies RemoveRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = REMOVE_CONTEXT.render.uninstalled(row, probe, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "uninstalled",
    name: "helper",
    severity: "info",
    needsReload: true,
  });
  assert.deepStrictEqual(Object.keys(row), ["status", "name", "severity", "needsReload"]);
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
  } as const satisfies RemoveRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = REMOVE_CONTEXT.render.uninstalled(row, probe, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "uninstalled",
    name: "helper",
    version: "1.2.3",
    scope: "project",
    severity: "info",
    needsReload: true,
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
  } as const satisfies RemoveRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = REMOVE_CONTEXT.render.failed(row, probe, "user");

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

test("renders a cross-scope failed row without consuming its cause or lifecycle stamps", () => {
  // arrange
  const cause = new Error("EACCES: permission denied");
  const row = {
    status: "failed",
    name: "tool",
    version: "2.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    cause,
    severity: "error",
    needsReload: false,
  } as const satisfies RemoveRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = REMOVE_CONTEXT.render.failed(row, probe, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "tool",
    version: "2.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    cause,
    severity: "error",
    needsReload: false,
  });
  assert.strictEqual(
    renderedRow,
    "⊘ tool [project] v2.0.0 (failed) {permission denied, source missing}",
  );
});
