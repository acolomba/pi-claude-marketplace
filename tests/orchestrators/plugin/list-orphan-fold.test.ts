import assert from "node:assert/strict";
import test from "node:test";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { MarketplaceRows } from "../../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import type { ListMsg } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface OrphanFold {
  readonly folded: readonly ListMsg[];
  readonly foldedNames: ReadonlySet<string>;
}

interface OrphanFoldOwner {
  readonly foldOrphanListRows: (rows: readonly ListMsg[]) => OrphanFold;
  readonly isOrphanMarketplaceClone: (
    projectMarketplace: MarketplaceRecord | undefined,
    userMarketplace: MarketplaceRecord | undefined,
  ) => projectMarketplace is MarketplaceRecord;
  readonly orderPluginListBlocks: (
    blocks: readonly MarketplaceRows<ListMsg>[],
  ) => readonly MarketplaceRows<ListMsg>[];
}

async function loadOrphanFoldOwner(): Promise<OrphanFoldOwner> {
  let owner: OrphanFoldOwner | undefined;
  await assert.doesNotReject(async () => {
    owner =
      await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts");
  }, "list-orphan-fold.ts must own deterministic orphan adoption and ordering");
  assert.ok(owner !== undefined);
  return owner;
}

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
    needsReload: false,
  };
}

test("returns an empty fold for no project rows", async () => {
  // arrange
  const { foldOrphanListRows } = await loadOrphanFoldOwner();

  // act
  const fold = foldOrphanListRows([]);

  // assert
  assert.deepStrictEqual(fold, { folded: [], foldedNames: new Set() });
});

test("keeps every installed-inventory variant and rejects candidate rows", async () => {
  // arrange
  const { foldOrphanListRows } = await loadOrphanFoldOwner();
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
    foldedNames: new Set([
      "installed",
      "upgradable",
      "disabled",
      "partial",
      "partial-upgrade",
    ]),
  });
});

test("preserves duplicate folded rows while de-duplicating exclusion names", async () => {
  // arrange
  const { foldOrphanListRows } = await loadOrphanFoldOwner();
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

test("recognizes clones only when both records share one marketplace root", async () => {
  // arrange
  const { isOrphanMarketplaceClone } = await loadOrphanFoldOwner();
  const userMarketplace = marketplaceRecord("/marketplaces/mp1");
  const projectClone = { ...marketplaceRecord("/marketplaces/mp1"), scope: "project" };
  const independentProject = { ...marketplaceRecord("/project/mp1"), scope: "project" };

  // act & assert
  assert.strictEqual(isOrphanMarketplaceClone(projectClone, userMarketplace), true);
  assert.strictEqual(isOrphanMarketplaceClone(independentProject, userMarketplace), false);
  assert.strictEqual(isOrphanMarketplaceClone(undefined, userMarketplace), false);
  assert.strictEqual(isOrphanMarketplaceClone(projectClone, undefined), false);
});

test("orders case-tied blocks by project scope and preserves exact ties", async () => {
  // arrange
  const { orderPluginListBlocks } = await loadOrphanFoldOwner();
  const firstUser: MarketplaceRows<ListMsg> = { name: "Alpha", scope: "user", plugins: [] };
  const project: MarketplaceRows<ListMsg> = { name: "alpha", scope: "project", plugins: [] };
  const secondUser: MarketplaceRows<ListMsg> = { name: "ALPHA", scope: "user", plugins: [] };

  // act
  const blocks = orderPluginListBlocks([firstUser, secondUser, project]);

  // assert
  assert.deepStrictEqual(blocks, [project, firstUser, secondUser]);
});

test("keeps same-name project rows adjacent before user rows", async () => {
  // arrange
  const { orderPluginListBlocks } = await loadOrphanFoldOwner();
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
  assert.deepStrictEqual(blocks, [
    { ...block, plugins: [projectAlpha, userAlpha, beta] },
  ]);
});

test("uses the marketplace scope for rows without an explicit scope", async () => {
  // arrange
  const { orderPluginListBlocks } = await loadOrphanFoldOwner();
  const available: ListMsg = { status: "available", name: "alpha" };
  const projectAlpha = installedRow("ALPHA", "project");
  const block: MarketplaceRows<ListMsg> = {
    name: "mp1",
    scope: "user",
    plugins: [available, projectAlpha],
  };

  // act
  const blocks = orderPluginListBlocks([block]);

  // assert
  assert.deepStrictEqual(blocks, [{ ...block, plugins: [projectAlpha, available] }]);
});

test("repeated and parallel folds remain independent and deterministic", async () => {
  // arrange
  const { foldOrphanListRows, orderPluginListBlocks } = await loadOrphanFoldOwner();
  const rows = [installedRow("beta"), installedRow("alpha")];
  const block: MarketplaceRows<ListMsg> = { name: "mp1", scope: "user", plugins: rows };

  // act
  const folds = await Promise.all(
    Array.from({ length: 4 }, async () => foldOrphanListRows(rows)),
  );
  const ordered = orderPluginListBlocks([block]);
  const orderedAgain = orderPluginListBlocks(ordered);

  // assert
  assert.deepStrictEqual(folds, [folds[0], folds[0], folds[0], folds[0]]);
  assert.notStrictEqual(folds[0], folds[1]);
  assert.notStrictEqual(folds[0]?.foldedNames, folds[1]?.foldedNames);
  assert.deepStrictEqual(orderedAgain, ordered);
  assert.deepStrictEqual(rows.map((row) => row.name), ["beta", "alpha"]);
});
