import assert from "node:assert/strict";
import test from "node:test";

import {
  composeDependencyRefusalCause,
  composeKeptInstalledRow,
  composeNeededElsewhereRow,
  composePrunedRow,
  composeRemovalBlocks,
  composeUninstalledRow,
  UNINSTALL_CONTEXT,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { resolveRows } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstalledMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { type PluginUninstallSkippedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete uninstall command context", () => {
  // arrange
  const expectedRenderKeys = ["uninstalled", "failed", "skipped"];

  // act
  const contextKeys = Object.keys(UNINSTALL_CONTEXT);
  const renderKeys = Object.keys(UNINSTALL_CONTEXT.rowPolicies);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "rowPolicies"]);
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
    reasons: [],
  } as const satisfies ResolvedRow<PluginUninstalledMessage>;

  // act
  const renderedLine = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedLine, "○ alpha [project] v1.2.3 (uninstalled)");
  assert.deepEqual(row, {
    status: "uninstalled",
    severity: "info",
    needsReload: true,
    name: "alpha",
    version: "1.2.3",
    scope: "project",
    reasons: [],
  });
  assert.equal(Object.hasOwn(row, "failure"), false);
});

test("renders a failed uninstall row without leaking its failure detail into the row body", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["unstage failed"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    failure,
  } as const satisfies ResolvedRow<PluginFailedMessage>;

  // act
  const renderedLine = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedLine, "⊘ beta v2.0.0 (failed) {permission denied, rollback partial}");
  assert.deepEqual(row, {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    failure,
  });
});

test("UNINSTALL_CONTEXT declares complete row policies", () => {
  // act
  const policies = UNINSTALL_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    uninstalled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
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

  // act
  const [resolved] = resolveRows(
    [{ name: "official", scope: "user", plugins: [prunedRow] }],
    runWithNothingLoaded().softDeps,
    UNINSTALL_CONTEXT.rowPolicies,
  );
  const rendered = composePluginLines(resolved!.plugins[0]!, "user")[0]!.slice(2);

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
    staleWorkflowCommand: false,
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
    staleWorkflowCommand: false,
    plugin: "helper",
    version: "1.0.0",
    keepData: true,
    dependents: [],
  });

  // assert
  assert.deepStrictEqual(row, expectedRow);
});

test("WLIF-06: composeUninstalledRow names a retired command as the only brace and drops the row to warning", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    reasons: ["stale workflow command"],
    severity: "warning",
    needsReload: true,
  };

  // act
  const row = composeUninstalledRow({
    staleWorkflowCommand: true,
    plugin: "helper",
    version: "1.0.0",
    keepData: false,
    dependents: [],
  });

  // assert
  assert.deepStrictEqual(row, expectedRow);
  assert.equal(Object.hasOwn(row, "cause"), false);
});

test("WLIF-06: the stale-command token sits last when the data disposition already holds the brace", () => {
  // arrange
  const expectedRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: "helper",
    version: "1.0.0",
    reasons: ["data kept", "stale workflow command"],
    severity: "warning",
    needsReload: true,
  };

  // act
  const row = composeUninstalledRow({
    staleWorkflowCommand: true,
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
    staleWorkflowCommand: false,
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
    staleWorkflowCommand: false,
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
    staleWorkflowCommand: false,
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
    staleWorkflowCommand: false,
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
    staleWorkflowCommand: false,
    plugin: "helper",
    version: "1.0.0",
    keepData: true,
    dependents: ["alpha@official"],
  });

  // act
  const [resolved] = resolveRows(
    [{ name: "official", scope: "user", plugins: [row] }],
    runWithNothingLoaded().softDeps,
    UNINSTALL_CONTEXT.rowPolicies,
  );
  const rendered = composePluginLines(resolved!.plugins[0]!, "user")[0]!.slice(2);

  // assert
  assert.equal(rendered, "○ helper v1.0.0 (uninstalled) {dependents unsatisfied, data kept}");
});

test("LOAD-03: composeUninstalledRow omits the version slot when the removed record carried none", () => {
  // act
  const row = composeUninstalledRow({
    staleWorkflowCommand: false,
    plugin: "helper",
    keepData: false,
    dependents: ["alpha@official"],
  });

  // assert
  assert.equal(Object.hasOwn(row, "version"), false);
});

for (const { otherLayer, reason, hint } of [
  {
    otherLayer: "base",
    reason: "still installed in base layer",
    hint: "Run the command again without --local to uninstall it.",
  },
  {
    otherLayer: "local",
    reason: "still installed in local layer",
    hint: "Run the command again with --local to uninstall it.",
  },
] as const) {
  test(`LAYER-05: composeKeptInstalledRow for a plugin the ${otherLayer} layer still declares is a warning skipped row with the hint`, () => {
    // arrange
    const expectedRow: PluginUninstallSkippedMessage = {
      status: "skipped",
      name: "demo",
      version: "1.0.0",
      reasons: [reason],
      cause: new Error(hint),
      severity: "warning",
      needsReload: false,
    };

    // act
    const row = composeKeptInstalledRow({ plugin: "demo", version: "1.0.0", otherLayer });

    // assert
    assert.deepStrictEqual(row, expectedRow);
  });
}

test("LAYER-05: composeKeptInstalledRow omits the version slot when the record carried none", () => {
  // act
  const row = composeKeptInstalledRow({ plugin: "demo", otherLayer: "base" });

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "demo",
    reasons: ["still installed in base layer"],
    cause: new Error("Run the command again without --local to uninstall it."),
    severity: "warning",
    needsReload: false,
  });
});

for (const { title, needers, expected } of [
  {
    title: "names the one plugin the target layer declares that needs it",
    needers: ["app@tools"],
    expected: "Uninstall app@tools first, then lib@tools.",
  },
  {
    title: "names every needer in the order given",
    needers: ["alpha@tools", "zeta@up"],
    expected: "Uninstall alpha@tools, zeta@up first, then lib@tools.",
  },
  {
    title: "counts the needers when one key could forge the sentence",
    needers: ['app@tools", then x@y', "zeta@up"],
    expected: "Uninstall 2 other plugins first, then lib@tools.",
  },
]) {
  test(`LAYER-08: composeDependencyRefusalCause ${title}`, () => {
    // act
    const cause = composeDependencyRefusalCause({
      plugin: "lib",
      marketplace: "tools",
      needers,
    });

    // assert
    assert.equal(cause, expected);
  });
}

for (const { title, otherLayer, needers, version, expected } of [
  {
    title: "names the one needer the base layer declares",
    otherLayer: "base",
    needers: ["app@tools"],
    version: "1.0.0",
    expected: {
      status: "skipped",
      name: "lib",
      version: "1.0.0",
      reasons: ["dependents remain"],
      cause: new Error(
        "The base config (claude-plugins.json) declares app@tools, which needs lib@tools.",
      ),
      severity: "warning",
      needsReload: false,
    },
  },
  {
    title: "names the needers the local layer declares and omits a missing version",
    otherLayer: "local",
    needers: ["alpha@tools", "zeta@up"],
    version: undefined,
    expected: {
      status: "skipped",
      name: "lib",
      reasons: ["dependents remain"],
      cause: new Error(
        "The local config (claude-plugins.local.json) declares alpha@tools, zeta@up, which need lib@tools.",
      ),
      severity: "warning",
      needsReload: false,
    },
  },
  {
    title: "counts the one needer whose key could forge the sentence",
    otherLayer: "base",
    needers: ['app@tools", which x@y'],
    version: "1.0.0",
    expected: {
      status: "skipped",
      name: "lib",
      version: "1.0.0",
      reasons: ["dependents remain"],
      cause: new Error(
        "The base config (claude-plugins.json) declares 1 other plugin, which needs lib@tools.",
      ),
      severity: "warning",
      needsReload: false,
    },
  },
] as const) {
  test(`LAYER-08: composeNeededElsewhereRow ${title}`, () => {
    // act
    const row = composeNeededElsewhereRow({
      plugin: "lib",
      marketplace: "tools",
      version,
      needers,
      otherLayer,
    });

    // assert
    assert.deepStrictEqual(row, expected satisfies PluginUninstallSkippedMessage);
  });
}

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
