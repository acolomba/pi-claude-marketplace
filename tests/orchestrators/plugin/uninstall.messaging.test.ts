import assert from "node:assert/strict";
import test from "node:test";

import {
  composePrunedRow,
  composeRemovalBlocks,
  composeUninstalledRow,
  UNINSTALL_CONTEXT,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  const prunedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "shared-lib",
    version: "2.0.0",
    reasons: ["dependency pruned", "data kept"],
    severity: "info",
    needsReload: true,
  };
  const probe: SoftDepStatus = { piSubagentsLoaded: false, piMcpAdapterLoaded: false };

  // act
  const rendered = UNINSTALL_CONTEXT.render.uninstalled(prunedRow, probe, "user");

  // assert
  assert.equal(rendered, "○ shared-lib v2.0.0 (uninstalled) {dependency pruned, data kept}");
});

test("D-02-01: composeUninstalledRow with no dependents and no kept data is the bare frozen row", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  };

  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: false,
    dependents: [],
  });

  // assert
  assert.deepStrictEqual(row, expectedRow);
  assert.equal(Object.hasOwn(row, "reasons"), false);
  assert.equal(Object.hasOwn(row, "cause"), false);
});

test("WR-06: composeUninstalledRow keeps the data disposition as the only brace when nothing declares the plugin", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    reasons: ["data kept"],
    severity: "info",
    needsReload: true,
  };

  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: true,
    dependents: [],
  });

  // assert
  assert.deepStrictEqual(row, expectedRow);
});

test("LOAD-03: composeUninstalledRow names the dependents on the cause line and stays an info reload row", () => {
  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: false,
    dependents: ["alpha@official", "zeta@official"],
  });

  // assert
  assert.deepStrictEqual(row.reasons, ["dependents unsatisfied"]);
  assert.equal(row.severity, "info");
  assert.equal(row.needsReload, true);
  assert.equal(row.cause?.message, "required by alpha@official, zeta@official");
  assert.equal(row.cause?.cause, undefined);
});

test("T-06-02: composeUninstalledRow counts the dependents when one key could close the cause's quote", () => {
  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: false,
    dependents: ['alpha" and uninstall "victim@official', "zeta@official"],
  });

  // assert
  assert.deepStrictEqual(row.reasons, ["dependents unsatisfied"]);
  assert.equal(row.cause?.message, "required by 2 other plugins");
  assert.equal(row.cause?.cause, undefined);
});

test("T-06-02: composeUninstalledRow counts a single unrenderable dependent in the singular", () => {
  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: false,
    dependents: ["alpha@official@extra"],
  });

  // assert
  assert.equal(row.cause?.message, "required by 1 other plugin");
});

test("LOAD-03 / D-05-09: composeUninstalledRow says what the removal means for others before the data disposition", () => {
  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: true,
    dependents: ["alpha@official"],
  });

  // assert
  assert.deepStrictEqual(row.reasons, ["dependents unsatisfied", "data kept"]);
  assert.equal(row.cause?.message, "required by alpha@official");
});

test("LOAD-03: a dependents row renders its brace and its 4-space cause trailer through the uninstalled arm", () => {
  // arrange
  const row = composeUninstalledRow({
    plugin: "helper",
    version: "1.0.0",
    keepData: true,
    dependents: ["alpha@official"],
  });
  const probe: SoftDepStatus = { piSubagentsLoaded: false, piMcpAdapterLoaded: false };

  // act
  const rendered = UNINSTALL_CONTEXT.render.uninstalled(row, probe, "user");

  // assert
  assert.equal(rendered, "○ helper v1.0.0 (uninstalled) {dependents unsatisfied, data kept}");
});

test("LOAD-03: composeUninstalledRow omits the version slot when the removed record carried none", () => {
  // act
  const row = composeUninstalledRow({
    plugin: "helper",
    keepData: false,
    dependents: ["alpha@official"],
  });

  // assert
  assert.equal(Object.hasOwn(row, "version"), false);
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
  const toolingRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "tooling",
    version: "3.0.0",
    reasons: ["dependency pruned"],
    severity: "info",
    needsReload: true,
  };
  const sharedLibRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "shared-lib",
    version: "2.0.0",
    reasons: ["dependency pruned"],
    severity: "info",
    needsReload: true,
  };
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
