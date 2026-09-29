import assert from "node:assert/strict";
import test from "node:test";

import {
  REMOVE_CONTEXT,
  type RemoveRowMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
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

test("exports the complete marketplace-remove command context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "render", "markers"];
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
    reasons: [],
  } as const satisfies ResolvedRow<RemoveRowMsg>;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: true,
  };

  // act
  const renderedRow = REMOVE_CONTEXT.render.uninstalled(row, probe, "user");

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
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: true,
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
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: true,
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
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: true,
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
    failure,
    severity: "error",
    needsReload: false,
  });
  assert.strictEqual(
    renderedRow,
    "⊘ tool [project] v2.0.0 (failed) {permission denied, source missing}",
  );
});
