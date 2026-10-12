import assert from "node:assert/strict";
import test from "node:test";

import {
  LIST_CONTEXT,
  type ListMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { resolveRows } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("list preserves partial content while suppressing dependency markers", () => {
  // arrange
  const rows = [
    {
      name: "official",
      scope: "user",
      plugins: [
        {
          status: "partially-installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["lsp"],
          dependencies: ["agents", "mcp", "workflows"],
        },
      ],
    },
  ] as const;

  // act
  const resolved = resolveRows(rows, runWithNothingLoaded().softDeps, LIST_CONTEXT.rowPolicies);
  const lines = composePluginLines(resolved[0]!.plugins[0]!, "user");

  // assert
  assert.deepStrictEqual(resolved[0]!.plugins, [
    {
      status: "partially-installed",
      name: "alpha",
      version: "1.0.0",
      reasons: ["lsp"],
    },
  ]);
  assert.deepStrictEqual(lines, ["  ◉ alpha v1.0.0 (partially-installed) {lsp}"]);
});

void ({
  status: "available",
  name: "alpha",
  // @ts-expect-error available inventory rows structurally exclude scope
  scope: "project",
} satisfies ListMsg);

void ({
  status: "remote",
  name: "alpha",
  // @ts-expect-error remote inventory rows structurally exclude dependencies
  dependencies: ["agents"],
} satisfies ListMsg);

// @ts-expect-error partially-upgradable inventory rows require explicit reasons
void ({ status: "partially-upgradable", name: "alpha" } satisfies ListMsg);

test("exports the complete plugin-list command context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "rowPolicies"];
  const expectedRenderKeys = [
    "installed",
    "available",
    "partially-available",
    "unavailable",
    "upgradable",
    "partially-installed",
    "partially-upgradable",
    "disabled",
    "failed",
    "remote",
  ];

  // act
  const contextKeys = Object.keys(LIST_CONTEXT);
  const renderKeys = Object.keys(LIST_CONTEXT.rowPolicies);

  // assert
  assert.deepStrictEqual(contextKeys, expectedContextKeys);
  assert.deepStrictEqual(LIST_CONTEXT.Messaging, { label: "Plugin list" });
  assert.deepStrictEqual(renderKeys, expectedRenderKeys);
});

test("renders an available row without scope, reload state, or description bytes", () => {
  // arrange
  const row = {
    status: "available",
    name: "alpha",
    version: "1.0.0",
    description: "Available description stays outside the command-owned row.",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "available",
    name: "alpha",
    version: "1.0.0",
    description: "Available description stays outside the command-owned row.",
    reasons: ["installs disabled"],
  });
  assert.strictEqual(renderedRow, "○ alpha v1.0.0 (available) {installs disabled}");
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders a disabled row with its resolved reasons", () => {
  // arrange
  const row = {
    status: "disabled",
    name: "beta",
    version: "2.0.0",
    scope: "project",
    description: "Disabled description stays outside the command-owned row.",
    reasons: ["not in manifest"],
    severity: "info",
    needsReload: false,
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "disabled",
    name: "beta",
    version: "2.0.0",
    scope: "project",
    description: "Disabled description stays outside the command-owned row.",
    reasons: ["not in manifest"],
    severity: "info",
    needsReload: false,
  });
  assert.strictEqual(renderedRow, "◍ beta [project] v2.0.0 (disabled) {not in manifest}");
});

test("renders a failed row without consuming its failure detail or lifecycle fields", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["EACCES: private path"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    name: "delta",
    version: "4.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    failure,
    severity: "error",
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "delta",
    version: "4.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    failure,
    severity: "error",
  });
  assert.strictEqual(
    renderedRow,
    "⊘ delta [project] v4.0.0 (failed) {permission denied, source missing}",
  );
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders an installed row with its durable reasons and resolved markers", () => {
  // arrange
  const row = {
    status: "installed",
    name: "epsilon",
    version: "sha-123456789abc",
    scope: "project",
    reasons: ["not in manifest", "requires pi-subagents", "requires pi-mcp-adapter"],
    description: "Installed description stays outside the command-owned row.",
    severity: "info",
    needsReload: false,
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "epsilon",
    version: "sha-123456789abc",
    scope: "project",
    reasons: ["not in manifest", "requires pi-subagents", "requires pi-mcp-adapter"],
    description: "Installed description stays outside the command-owned row.",
    severity: "info",
    needsReload: false,
  });
  assert.strictEqual(
    renderedRow,
    "● epsilon [project] v#1234567 (installed) {not in manifest, requires pi-subagents, requires pi-mcp-adapter}",
  );
});

test("renders a partially-available row without a scope or reload stamp", () => {
  // arrange
  const row = {
    status: "partially-available",
    name: "eta",
    version: "5.0.0",
    description: "Partial candidate description stays outside the row.",
    reasons: ["unsupported hooks", "lsp"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-available",
    name: "eta",
    version: "5.0.0",
    description: "Partial candidate description stays outside the row.",
    reasons: ["unsupported hooks", "lsp"],
  });
  assert.strictEqual(renderedRow, "⊖ eta v5.0.0 (partially-available) {unsupported hooks, lsp}");
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders a partially-installed row with its resolved reasons", () => {
  // arrange
  const row = {
    status: "partially-installed",
    name: "iota",
    version: "6.0.0",
    scope: "project",
    description: "Partial installation description stays outside the row.",
    reasons: ["unsupported hooks"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "iota",
    version: "6.0.0",
    scope: "project",
    description: "Partial installation description stays outside the row.",
    reasons: ["unsupported hooks"],
  });
  assert.strictEqual(
    renderedRow,
    "◉ iota [project] v6.0.0 (partially-installed) {unsupported hooks}",
  );
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders a partially-upgradable row in its marketplace scope", () => {
  // arrange
  const row = {
    status: "partially-upgradable",
    name: "kappa",
    version: "7.0.0",
    scope: "user",
    description: "Partial upgrade description stays outside the row.",
    reasons: ["unsupported component"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-upgradable",
    name: "kappa",
    version: "7.0.0",
    scope: "user",
    description: "Partial upgrade description stays outside the row.",
    reasons: ["unsupported component"],
  });
  assert.strictEqual(renderedRow, "● kappa v7.0.0 (partially-upgradable) {unsupported component}");
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders a remote row without scope or reload state", () => {
  // arrange
  const row = {
    status: "remote",
    name: "lambda",
    version: "8.0.0",
    description: "Remote description stays outside the command-owned row.",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "remote",
    name: "lambda",
    version: "8.0.0",
    description: "Remote description stays outside the command-owned row.",
    reasons: ["installs disabled"],
  });
  assert.strictEqual(renderedRow, "◌ lambda v8.0.0 (remote) {installs disabled}");
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders an unavailable row without a scope or reload stamp", () => {
  // arrange
  const row = {
    status: "unavailable",
    name: "mu",
    version: "9.0.0",
    description: "Unavailable description stays outside the row.",
    reasons: ["unsupported source", "permission denied"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "unavailable",
    name: "mu",
    version: "9.0.0",
    description: "Unavailable description stays outside the row.",
    reasons: ["unsupported source", "permission denied"],
  });
  assert.strictEqual(
    renderedRow,
    "⊘ mu v9.0.0 (unavailable) {unsupported source, permission denied}",
  );
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders an upgradable row with cross-scope attribution", () => {
  // arrange
  const row = {
    status: "upgradable",
    name: "nu",
    version: "10.0.0",
    scope: "project",
    description: "Upgrade description stays outside the row.",
    reasons: ["source mismatch"],
  } as const satisfies ResolvedRow<ListMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "upgradable",
    name: "nu",
    version: "10.0.0",
    scope: "project",
    description: "Upgrade description stays outside the row.",
    reasons: ["source mismatch"],
  });
  assert.strictEqual(renderedRow, "● nu [project] v10.0.0 (upgradable) {source mismatch}");
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("LIST_CONTEXT declares complete row policies", () => {
  // act
  const policies = LIST_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    installed: { markers: true, contentReasons: true },
    available: { markers: false, contentReasons: true },
    "partially-available": { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    upgradable: { markers: false, contentReasons: true },
    "partially-installed": { markers: false, contentReasons: true },
    "partially-upgradable": { markers: false, contentReasons: true },
    disabled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    remote: { markers: false, contentReasons: true },
  });
});
