import assert from "node:assert/strict";
import test from "node:test";

import {
  foldOrphanListRows,
  isOrphanMarketplaceClone,
  orderPluginListBlocks,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts";

import type { ListMsg } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { MarketplaceRows } from "../../../extensions/pi-claude-marketplace/shared/notify-context.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

function marketplaceRecord(marketplaceRoot: string): MarketplaceRecord {
  return {
    name: "mp1",
    scope: "user",
    source: { kind: "path", raw: "./mp1", logical: "./mp1" },
    addedFromCwd: "/workspace",
    manifestPath: `${marketplaceRoot}/marketplace.json`,
    marketplaceRoot,
    plugins: {},
  };
}

function installedRow(name: string, scope: "user" | "project" = "project"): ListMsg {
  return {
    status: "installed",
    name,
    dependencies: [],
    scope,
    severity: "info",
    needsReload: false,
  };
}

test("returns an empty fold for no project rows", () => {
  // arrange
  const rows: readonly ListMsg[] = [];

  // act
  const fold = foldOrphanListRows(rows);

  // assert
  assert.deepStrictEqual(fold, { folded: [], foldedNames: new Set() });
});

test("keeps every installed-inventory variant and rejects candidate rows", () => {
  // arrange
  const rows: readonly ListMsg[] = [
    installedRow("installed"),
    { status: "upgradable", name: "upgradable", reasons: [], scope: "project" },
    {
      status: "disabled",
      name: "disabled",
      scope: "project",
      severity: "info",
      needsReload: false,
    },
    { status: "partially-installed", name: "partial", reasons: ["lsp"], scope: "project" },
    {
      status: "partially-upgradable",
      name: "partial-upgrade",
      reasons: ["lsp"],
      scope: "project",
    },
    { status: "available", name: "available" },
    { status: "remote", name: "remote" },
    { status: "unavailable", name: "unavailable", reasons: ["source missing"] },
  ];

  // act
  const fold = foldOrphanListRows(rows);

  // assert
  assert.deepStrictEqual(fold, {
    folded: rows.slice(0, 5),
    foldedNames: new Set(["installed", "upgradable", "disabled", "partial", "partial-upgrade"]),
  });
});

test("preserves duplicate folded rows while de-duplicating exclusion names", () => {
  // arrange
  const first = installedRow("alpha");
  const second = installedRow("alpha");

  // act
  const fold = foldOrphanListRows([first, second]);

  // assert
  assert.deepStrictEqual(fold, {
    folded: [first, second],
    foldedNames: new Set(["alpha"]),
  });
});

test("recognizes clones only when both records share one marketplace root", () => {
  // arrange
  const userMarketplace = marketplaceRecord("/marketplaces/mp1");
  const projectClone: MarketplaceRecord = {
    ...marketplaceRecord("/marketplaces/mp1"),
    scope: "project",
  };
  const independentProject: MarketplaceRecord = {
    ...marketplaceRecord("/project/mp1"),
    scope: "project",
  };

  // act & assert
  assert.strictEqual(isOrphanMarketplaceClone(projectClone, userMarketplace), true);
  assert.strictEqual(isOrphanMarketplaceClone(independentProject, userMarketplace), false);
  assert.strictEqual(isOrphanMarketplaceClone(undefined, userMarketplace), false);
  assert.strictEqual(isOrphanMarketplaceClone(projectClone, undefined), false);
});

test("orders case-tied blocks by project scope and preserves exact ties", () => {
  // arrange
  const firstUser: MarketplaceRows<ListMsg> = { name: "Alpha", scope: "user", plugins: [] };
  const project: MarketplaceRows<ListMsg> = { name: "alpha", scope: "project", plugins: [] };
  const secondUser: MarketplaceRows<ListMsg> = { name: "ALPHA", scope: "user", plugins: [] };

  // act
  const blocks = orderPluginListBlocks([firstUser, secondUser, project]);

  // assert
  assert.deepStrictEqual(blocks, [project, firstUser, secondUser]);
});

test("keeps same-name project rows adjacent before user rows", () => {
  // arrange
  const userAlpha = installedRow("Alpha", "user");
  const beta = installedRow("beta", "user");
  const projectAlpha = installedRow("alpha", "project");
  const block: MarketplaceRows<ListMsg> = {
    name: "mp1",
    scope: "user",
    plugins: [userAlpha, beta, projectAlpha],
  };

  // act
  const blocks = orderPluginListBlocks([block]);

  // assert
  assert.deepStrictEqual(blocks, [{ ...block, plugins: [projectAlpha, userAlpha, beta] }]);
});

test("uses the marketplace scope for rows without an explicit scope", () => {
  // arrange
  const available: ListMsg = { status: "available", name: "alpha" };
  const sameScopeInstalled: ListMsg = {
    status: "installed",
    name: "Alpha",
    dependencies: [],
    severity: "info",
    needsReload: false,
  };
  const projectAlpha = installedRow("ALPHA", "project");
  const block: MarketplaceRows<ListMsg> = {
    name: "mp1",
    scope: "user",
    plugins: [available, sameScopeInstalled, projectAlpha],
  };

  // act
  const blocks = orderPluginListBlocks([block]);

  // assert
  assert.deepStrictEqual(blocks, [
    { ...block, plugins: [projectAlpha, available, sameScopeInstalled] },
  ]);
});

test("repeated and parallel folds remain independent and deterministic", async () => {
  // arrange
  const rows = [installedRow("beta"), installedRow("alpha")];
  const block: MarketplaceRows<ListMsg> = { name: "mp1", scope: "user", plugins: rows };

  // act
  const folds = await Promise.all(
    Array.from({ length: 4 }, () => Promise.resolve(foldOrphanListRows(rows))),
  );
  const ordered = orderPluginListBlocks([block]);
  const orderedAgain = orderPluginListBlocks(ordered);

  // assert
  assert.deepStrictEqual(folds, [folds[0], folds[0], folds[0], folds[0]]);
  assert.notStrictEqual(folds[0], folds[1]);
  assert.notStrictEqual(folds[0]?.foldedNames, folds[1]?.foldedNames);
  assert.deepStrictEqual(orderedAgain, ordered);
  assert.deepStrictEqual(
    rows.map((row) => row.name),
    ["beta", "alpha"],
  );
});
