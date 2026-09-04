import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPORT_CONTEXT,
  type ImportMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ({
  status: "installed",
  name: "typed-plugin",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies ImportMsg);

// @ts-expect-error installed transitions require explicit severity and reload stamps
void ({ status: "installed", name: "unstamped-plugin", dependencies: [] } satisfies ImportMsg);

void ({
  status: "unavailable",
  name: "scoped-plugin",
  // @ts-expect-error unavailable import rows never carry a plugin scope
  scope: "user",
  reasons: ["no longer installable"],
  severity: "warning",
  needsReload: false,
} satisfies ImportMsg);

test("exports the complete import command context", () => {
  // arrange
  const expectedContext = {
    Messaging: { label: "Import" },
    render: ["installed", "skipped", "failed", "unavailable"],
  };

  // act
  const context = {
    Messaging: IMPORT_CONTEXT.Messaging,
    render: Object.keys(IMPORT_CONTEXT.render),
  };

  // assert
  assert.deepStrictEqual(context, expectedContext);
});

test("renders an installed row with optional fields omitted", () => {
  // arrange
  const message = {
    status: "installed",
    name: "alpha-plugin",
    dependencies: [],
    severity: "info",
    needsReload: true,
  } satisfies ImportMsg;
  const expectedMessage = {
    status: "installed",
    name: "alpha-plugin",
    dependencies: [],
    severity: "info",
    needsReload: true,
  };
  const probe = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  } satisfies SoftDepStatus;
  const expectedRow = "● alpha-plugin (installed)";

  // act
  const row = IMPORT_CONTEXT.render.installed(message, probe, "project");

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.deepStrictEqual(Object.keys(message), [
    "status",
    "name",
    "dependencies",
    "severity",
    "needsReload",
  ]);
  assert.strictEqual(row, expectedRow);
});

test("renders installed reasons before missing dependency markers", () => {
  // arrange
  const message = {
    status: "installed",
    name: "beta-plugin",
    scope: "user",
    version: "1.2.3",
    dependencies: ["agents", "mcp"],
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  } satisfies ImportMsg;
  const expectedMessage = {
    status: "installed",
    name: "beta-plugin",
    scope: "user",
    version: "1.2.3",
    dependencies: ["agents", "mcp"],
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  };
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;
  const expectedRow =
    "● beta-plugin [user] v1.2.3 (installed) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp}";

  // act
  const row = IMPORT_CONTEXT.render.installed(message, probe, "project");

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(row, expectedRow);
});

test("omits loaded dependency markers from an installed row", () => {
  // arrange
  const message = {
    status: "installed",
    name: "gamma-plugin",
    dependencies: ["agents", "mcp"],
    severity: "info",
    needsReload: true,
  } satisfies ImportMsg;
  const probe = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  } satisfies SoftDepStatus;
  const expectedRow = "● gamma-plugin (installed)";

  // act
  const row = IMPORT_CONTEXT.render.installed(message, probe, "user");

  // assert
  assert.strictEqual(row, expectedRow);
});

test("renders a skipped row with a compact hash version", () => {
  // arrange
  const message = {
    status: "skipped",
    name: "delta-plugin",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["already installed"],
    severity: "info",
    needsReload: false,
  } satisfies ImportMsg;
  const expectedMessage = {
    status: "skipped",
    name: "delta-plugin",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["already installed"],
    severity: "info",
    needsReload: false,
  };
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;
  const expectedRow = "⊘ delta-plugin v#2ea95f8 (skipped) {already installed}";

  // act
  const row = IMPORT_CONTEXT.render.skipped(message, probe, "project");

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(row, expectedRow);
});

test("renders a failed row without composing its cause trailer", () => {
  // arrange
  const cause = new Error("manifest entry disappeared");
  const message = {
    status: "failed",
    name: "epsilon-plugin",
    scope: "user",
    version: "3.0.0",
    reasons: ["not in manifest"],
    cause,
    severity: "error",
    needsReload: false,
  } satisfies ImportMsg;
  const expectedMessage = {
    status: "failed",
    name: "epsilon-plugin",
    scope: "user",
    version: "3.0.0",
    reasons: ["not in manifest"],
    cause,
    severity: "error",
    needsReload: false,
  };
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;
  const expectedRow = "⊘ epsilon-plugin [user] v3.0.0 (failed) {not in manifest}";

  // act
  const row = IMPORT_CONTEXT.render.failed(message, probe, "project");

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(row, expectedRow);
});

test("renders a source-mismatch failure with optional fields omitted", () => {
  // arrange
  const message = {
    status: "failed",
    name: "zeta-plugin",
    reasons: ["source mismatch"],
    severity: "error",
    needsReload: false,
  } satisfies ImportMsg;
  const probe = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  } satisfies SoftDepStatus;
  const expectedRow = "⊘ zeta-plugin (failed) {source mismatch}";

  // act
  const row = IMPORT_CONTEXT.render.failed(message, probe, "user");

  // assert
  assert.deepStrictEqual(Object.keys(message), [
    "status",
    "name",
    "reasons",
    "severity",
    "needsReload",
  ]);
  assert.strictEqual(row, expectedRow);
});

test("renders an unavailable row without a scope bracket", () => {
  // arrange
  const message = {
    status: "unavailable",
    name: "eta-plugin",
    version: "4.0.0",
    reasons: ["no longer installable"],
    severity: "warning",
    needsReload: false,
  } satisfies ImportMsg;
  const expectedMessage = {
    status: "unavailable",
    name: "eta-plugin",
    version: "4.0.0",
    reasons: ["no longer installable"],
    severity: "warning",
    needsReload: false,
  };
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;
  const expectedRow = "⊘ eta-plugin v4.0.0 (unavailable) {no longer installable}";

  // act
  const row = IMPORT_CONTEXT.render.unavailable(message, probe, "project");

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(Object.hasOwn(message, "scope"), false);
  assert.strictEqual(row, expectedRow);
});
