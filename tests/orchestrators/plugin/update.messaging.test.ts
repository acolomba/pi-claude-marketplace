import assert from "node:assert/strict";
import test from "node:test";

import {
  UPDATE_CONTEXT,
  type UpdateMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies UpdateMsg);
void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  severity: "info",
  needsReload: true,
  // @ts-expect-error updated messages require a dependency inventory
} satisfies UpdateMsg);
void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
  // @ts-expect-error skipped messages cannot carry a failure cause
  cause: new Error("not permitted"),
} satisfies UpdateMsg);
void ({
  status: "partially-upgradable",
  name: "alpha",
  reasons: ["lsp"],
  // @ts-expect-error partially-upgradable messages cannot declare soft dependencies
  dependencies: ["mcp"],
} satisfies UpdateMsg);

test("exports the complete update command context in declared order", () => {
  // arrange
  const expectedContext = {
    keys: ["Messaging", "render"],
    label: "Plugin update",
    renderKeys: ["updated", "partially-installed", "skipped", "partially-upgradable", "failed"],
  };

  // act
  const context = {
    keys: Object.keys(UPDATE_CONTEXT),
    label: UPDATE_CONTEXT.Messaging.label,
    renderKeys: Object.keys(UPDATE_CONTEXT.render),
  };

  // assert
  assert.deepStrictEqual(context, expectedContext);
});

test("renders a bare updated transition with true optional omission", () => {
  // arrange
  const message = {
    status: "updated",
    name: "alpha",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render.updated(message, probe, "user");

  // assert
  assert.equal(row, "● alpha v1.0.0 → v1.1.0 (updated)");
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "alpha",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(message, "reasons"), false);
  assert.equal(Object.hasOwn(message, "scope"), false);
});

test("renders updated reasons before both missing companion markers", () => {
  // arrange
  const message = {
    status: "updated",
    name: "beta",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    dependencies: ["agents", "mcp"],
    scope: "project",
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render.updated(message, probe, "user");

  // assert
  assert.equal(
    row,
    "● beta [project] v#2ea95f8 → v#1c3d9a0 (updated) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp}",
  );
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "beta",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    dependencies: ["agents", "mcp"],
    scope: "project",
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  });
});

test("renders a partially-installed transition with ordered reasons and an MCP marker", () => {
  // arrange
  const message = {
    status: "partially-installed",
    name: "gamma",
    reasons: ["malformed command", "unsupported component"],
    dependencies: ["mcp"],
    version: "2.0.0",
    scope: "project",
    severity: "warning",
    needsReload: true,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render["partially-installed"](message, probe, "user");

  // assert
  assert.equal(
    row,
    "◉ gamma [project] v2.0.0 (partially-installed) {malformed command, unsupported component, requires pi-mcp}",
  );
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "gamma",
    reasons: ["malformed command", "unsupported component"],
    dependencies: ["mcp"],
    version: "2.0.0",
    scope: "project",
    severity: "warning",
    needsReload: true,
  });
});

test("renders an actionable skipped row with a folded marketplace scope", () => {
  // arrange
  const message = {
    status: "skipped",
    name: "delta",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "user",
    severity: "error",
    needsReload: false,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render.skipped(message, probe, "user");

  // assert
  assert.equal(row, "⊘ delta v3.0.0 (skipped) {not installed, concurrently uninstalled}");
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "delta",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "user",
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "cause"), false);
});

test("preserves partial-update hint metadata while rendering its row body", () => {
  // arrange
  const message = {
    status: "partially-upgradable",
    name: "epsilon",
    reasons: ["unsupported hooks", "lsp"],
    version: "4.0.0",
    scope: "project",
    partialHint: true,
    severity: "info",
    needsReload: false,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render["partially-upgradable"](message, probe, "user");

  // assert
  assert.equal(row, "● epsilon [project] v4.0.0 (partially-upgradable) {unsupported hooks, lsp}");
  assert.deepStrictEqual(message, {
    status: "partially-upgradable",
    name: "epsilon",
    reasons: ["unsupported hooks", "lsp"],
    version: "4.0.0",
    scope: "project",
    partialHint: true,
    severity: "info",
    needsReload: false,
  });
});

test("preserves failed causes and rollback partials while rendering the owned row body", () => {
  // arrange
  const cause = new Error("update failed");
  const rollbackCause = new Error("remove staged agent failed");
  const message = {
    status: "failed",
    name: "zeta",
    reasons: ["rollback partial"],
    version: "5.0.0",
    scope: "project",
    cause,
    rollbackPartial: [{ phase: "phase3a", cause: rollbackCause }, { phase: "phase3b" }],
    severity: "error",
    needsReload: false,
  } as const satisfies UpdateMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const row = UPDATE_CONTEXT.render.failed(message, probe, "user");

  // assert
  assert.equal(row, "⊘ zeta [project] v5.0.0 (failed) {rollback partial}");
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "zeta",
    reasons: ["rollback partial"],
    version: "5.0.0",
    scope: "project",
    cause,
    rollbackPartial: [{ phase: "phase3a", cause: rollbackCause }, { phase: "phase3b" }],
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message.rollbackPartial[1], "cause"), false);
});
