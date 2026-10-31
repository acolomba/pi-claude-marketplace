import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPORT_CONTEXT,
  type ImportMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

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
  reasons: ["unsupported hooks"],
  severity: "warning",
  needsReload: false,
} satisfies ImportMsg);

test("exports the complete import command context", () => {
  // arrange
  const expectedContext = {
    Messaging: { label: "Import" },
    rowPolicyStatuses: [
      "installed",
      "partially-installed",
      "skipped",
      "failed",
      "unavailable",
      "updated",
    ],
  };

  // act
  const context = {
    Messaging: IMPORT_CONTEXT.Messaging,
    rowPolicyStatuses: Object.keys(IMPORT_CONTEXT.rowPolicies),
  };

  // assert
  assert.deepStrictEqual(context, expectedContext);
});

test("renders an installed row with optional fields omitted", () => {
  // arrange
  const message = {
    status: "installed",
    name: "alpha-plugin",
    reasons: [],
    severity: "info",
    needsReload: true,
  } satisfies ResolvedRow<ImportMsg>;
  const expectedMessage = {
    status: "installed",
    name: "alpha-plugin",
    reasons: [],
    severity: "info",
    needsReload: true,
  };
  const expectedRow = "● alpha-plugin (installed)";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.deepStrictEqual(Object.keys(message), [
    "status",
    "name",
    "reasons",
    "severity",
    "needsReload",
  ]);
  assert.strictEqual(row, expectedRow);
});

test("renders installed content reasons before the resolved markers", () => {
  // arrange
  const message = {
    status: "installed",
    name: "beta-plugin",
    scope: "user",
    version: "1.2.3",
    reasons: [
      "orphan rewake",
      "malformed skill",
      "requires pi-subagents",
      "requires pi-mcp-adapter",
    ],
    severity: "warning",
    needsReload: true,
  } satisfies ResolvedRow<ImportMsg>;
  const expectedMessage = {
    status: "installed",
    name: "beta-plugin",
    scope: "user",
    version: "1.2.3",
    reasons: [
      "orphan rewake",
      "malformed skill",
      "requires pi-subagents",
      "requires pi-mcp-adapter",
    ],
    severity: "warning",
    needsReload: true,
  };
  const expectedRow =
    "● beta-plugin [user] v1.2.3 (installed) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp-adapter}";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(message, expectedMessage);
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
  } satisfies ResolvedRow<ImportMsg>;
  const expectedMessage = {
    status: "skipped",
    name: "delta-plugin",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["already installed"],
    severity: "info",
    needsReload: false,
  };
  const expectedRow = "⊘ delta-plugin v#2ea95f8 (skipped) {already installed}";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(row, expectedRow);
});

test("renders a failed row without composing its failure lines", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["manifest entry disappeared"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const message = {
    status: "failed",
    name: "epsilon-plugin",
    scope: "user",
    version: "3.0.0",
    reasons: ["not in manifest"],
    failure,
    severity: "error",
    needsReload: false,
  } satisfies ResolvedRow<ImportMsg>;
  const expectedMessage = {
    status: "failed",
    name: "epsilon-plugin",
    scope: "user",
    version: "3.0.0",
    reasons: ["not in manifest"],
    failure,
    severity: "error",
    needsReload: false,
  };
  const expectedRow = "⊘ epsilon-plugin [user] v3.0.0 (failed) {not in manifest}";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

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
  } satisfies ResolvedRow<ImportMsg>;
  const expectedRow = "⊘ zeta-plugin (failed) {source mismatch}";

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

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
    reasons: ["unsupported hooks"],
    severity: "warning",
    needsReload: false,
  } satisfies ResolvedRow<ImportMsg>;
  const expectedMessage = {
    status: "unavailable",
    name: "eta-plugin",
    version: "4.0.0",
    reasons: ["unsupported hooks"],
    severity: "warning",
    needsReload: false,
  };
  const expectedRow = "⊘ eta-plugin v4.0.0 (unavailable) {unsupported hooks}";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(message, expectedMessage);
  assert.strictEqual(Object.hasOwn(message, "scope"), false);
  assert.strictEqual(row, expectedRow);
});

test("renders a partially installed row with its dropped kind", () => {
  // arrange
  const message = {
    status: "partially-installed",
    name: "theta-plugin",
    version: "1.0.0",
    reasons: ["unsupported component"],
    severity: "info",
    needsReload: true,
  } satisfies ResolvedRow<ImportMsg>;
  const expectedRow = "◉ theta-plugin v1.0.0 (partially-installed) {unsupported component}";

  // act
  const row = composePluginLines(message, "project")[0]!.slice(2);

  // assert
  assert.strictEqual(row, expectedRow);
});

test("IMPORT_CONTEXT declares complete row policies", () => {
  // act
  const policies = IMPORT_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    updated: { markers: true, contentReasons: true },
  });
});
