import assert from "node:assert/strict";
import test from "node:test";

import {
  composePrunedRow,
  composeRemovalBlocks,
  UNINSTALL_CONTEXT,
  type UninstallPrivateReason,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ("dependents remain" satisfies UninstallPrivateReason);
void ("dependency pruned" satisfies UninstallPrivateReason);

// @ts-expect-error plugin uninstall owns only the dependents-remain and dependency-pruned private reasons
void ("plugins remain" satisfies UninstallPrivateReason);

test("exports the complete uninstall command context", () => {
  // arrange
  const expectedRenderKeys = ["uninstalled", "failed"];

  // act
  const contextKeys = Object.keys(UNINSTALL_CONTEXT);
  const renderKeys = Object.keys(UNINSTALL_CONTEXT.render);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "render"]);
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
  } as const satisfies PluginUninstalledMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
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
  });
  assert.equal(Object.hasOwn(row, "reasons"), false);
  assert.equal(Object.hasOwn(row, "cause"), false);
});

test("renders a failed uninstall row without leaking its cause into the row body", () => {
  // arrange
  const cause = new Error("unstage failed");
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    cause,
  } as const satisfies PluginFailedMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
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
    cause,
  });
});

test("D-05-11: composePrunedRow is an info uninstalled row carrying the prune reason and the reload hint", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "shared-lib",
    version: "2.0.0",
    reasons: ["dependency pruned"],
    severity: "info",
    needsReload: true,
  };

  // act
  const prunedRow = composePrunedRow({ plugin: "shared-lib", version: "2.0.0", keepData: false });

  // assert
  assert.deepStrictEqual(prunedRow, expectedRow);
});

test("D-05-09: composePrunedRow under keepData says why the plugin went before what was kept", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "shared-lib",
    version: "2.0.0",
    reasons: ["dependency pruned", "data kept"],
    severity: "info",
    needsReload: true,
  };

  // act
  const prunedRow = composePrunedRow({ plugin: "shared-lib", version: "2.0.0", keepData: true });

  // assert
  assert.deepStrictEqual(prunedRow, expectedRow);
});

test("D-05-11: a pruned row renders through the uninstalled arm with its brace and no soft-dep marker", () => {
  // arrange
  const prunedRow = composePrunedRow({ plugin: "shared-lib", version: "2.0.0", keepData: true });
  const probe: SoftDepStatus = { piSubagentsLoaded: false, piMcpAdapterLoaded: false };

  // act
  const rendered = UNINSTALL_CONTEXT.render.uninstalled(prunedRow, probe, "user");

  // assert
  assert.equal(rendered, "○ shared-lib v2.0.0 (uninstalled) {dependency pruned, data kept}");
});

test("D-05-12: composeRemovalBlocks with no members is the primary's single block", () => {
  // arrange
  const primaryRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  };

  // act
  const blocks = composeRemovalBlocks({
    primary: { marketplace: "official", row: primaryRow },
    members: [],
    scope: "user",
  });

  // assert
  assert.deepStrictEqual(blocks, [{ name: "official", scope: "user", plugins: [primaryRow] }]);
});

test("PRUNE-04: composeRemovalBlocks groups members under their marketplaces in first-appearance order, rows in removal order", () => {
  // arrange
  const primaryRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  };
  const toolingRow = composePrunedRow({ plugin: "tooling", version: "3.0.0", keepData: false });
  const sharedLibRow = composePrunedRow({
    plugin: "shared-lib",
    version: "2.0.0",
    keepData: false,
  });
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: "base",
    version: "0.1.0",
    reasons: ["source mismatch"],
    cause: new Error("Agents unstage refused: foreign content"),
    severity: "warning",
    needsReload: false,
  };

  // act
  const blocks = composeRemovalBlocks({
    primary: { marketplace: "official", row: primaryRow },
    members: [
      { marketplace: "community", row: toolingRow },
      { marketplace: "official", row: sharedLibRow },
      { marketplace: "community", row: failedRow },
    ],
    scope: "project",
  });

  // assert
  assert.deepStrictEqual(blocks, [
    { name: "official", scope: "project", plugins: [primaryRow, sharedLibRow] },
    { name: "community", scope: "project", plugins: [toolingRow, failedRow] },
  ]);
});
