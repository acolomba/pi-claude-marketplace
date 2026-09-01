import assert from "node:assert/strict";
import test from "node:test";

import {
  LIST_CONTEXT,
  type ListMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  const expectedContextKeys = ["Messaging", "render"];
  const expectedRenderKeys = [
    "installed",
    "available",
    "unavailable",
    "partially-available",
    "upgradable",
    "partially-installed",
    "partially-upgradable",
    "disabled",
    "failed",
    "remote",
  ];

  // act
  const contextKeys = Object.keys(LIST_CONTEXT);
  const renderKeys = Object.keys(LIST_CONTEXT.render);

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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.available(row, probe, "project");

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

test("renders a disabled row without soft-dependency markers", () => {
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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.disabled(row, probe, "user");

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

test("renders a failed row without consuming its cause or lifecycle fields", () => {
  // arrange
  const cause = new Error("EACCES: private path");
  const row = {
    status: "failed",
    name: "delta",
    version: "4.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    cause,
    severity: "error",
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.failed(row, probe, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "delta",
    version: "4.0.0",
    scope: "project",
    reasons: ["permission denied", "source missing"],
    cause,
    severity: "error",
  });
  assert.strictEqual(
    renderedRow,
    "⊘ delta [project] v4.0.0 (failed) {permission denied, source missing}",
  );
  assert.strictEqual(Object.hasOwn(row, "needsReload"), false);
});

test("renders an installed row with durable and missing-companion reasons", () => {
  // arrange
  const row = {
    status: "installed",
    name: "epsilon",
    dependencies: ["agents", "mcp"],
    version: "sha-123456789abc",
    scope: "project",
    reasons: ["not in manifest"],
    description: "Installed description stays outside the command-owned row.",
    severity: "info",
    needsReload: false,
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.installed(row, probe, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "installed",
    name: "epsilon",
    dependencies: ["agents", "mcp"],
    version: "sha-123456789abc",
    scope: "project",
    reasons: ["not in manifest"],
    description: "Installed description stays outside the command-owned row.",
    severity: "info",
    needsReload: false,
  });
  assert.strictEqual(
    renderedRow,
    "● epsilon [project] v#1234567 (installed) {not in manifest, requires pi-subagents, requires pi-mcp}",
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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = LIST_CONTEXT.render["partially-available"](row, probe, "project");

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

test("renders a partially-installed row without inventory soft-dependency markers", () => {
  // arrange
  const row = {
    status: "partially-installed",
    name: "iota",
    dependencies: ["agents", "mcp"],
    version: "6.0.0",
    scope: "project",
    description: "Partial installation description stays outside the row.",
    reasons: ["unsupported hooks"],
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render["partially-installed"](row, probe, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    name: "iota",
    dependencies: ["agents", "mcp"],
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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = LIST_CONTEXT.render["partially-upgradable"](row, probe, "user");

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

test("renders a remote row without scope, reload state, or probe-derived reasons", () => {
  // arrange
  const row = {
    status: "remote",
    name: "lambda",
    version: "8.0.0",
    description: "Remote description stays outside the command-owned row.",
    reasons: ["installs disabled"],
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.remote(row, probe, "project");

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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.unavailable(row, probe, "user");

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
  } as const satisfies ListMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = LIST_CONTEXT.render.upgradable(row, probe, "user");

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
