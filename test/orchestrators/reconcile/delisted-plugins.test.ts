import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  hasSuppressingRow,
  reportDelistedPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

const ROOT = path.join(tmpdir(), "delisted-plugins-scope");

function pluginRecord(enabled: boolean): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: path.join(ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A marketplace record whose plugins are enabled unless named in `disabled`. */
function marketplaceRecord(
  name: string,
  plugins: readonly string[],
  disabled: readonly string[] = [],
): MarketplaceRecord {
  const root = path.join(ROOT, name);
  return {
    name,
    scope: "project",
    source: pathSource(`./${name}`),
    addedFromCwd: ROOT,
    manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: root,
    plugins: Object.fromEntries(
      plugins.map((plugin) => [plugin, pluginRecord(!disabled.includes(plugin))]),
    ),
  };
}

function stateOf(...marketplaces: readonly MarketplaceRecord[]): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: Object.fromEntries(marketplaces.map((mp) => [mp.name, mp])),
  };
}

function manifestListing(name: string, plugins: readonly string[]): MarketplaceManifest {
  return { name, plugins: plugins.map((plugin) => ({ name: plugin, source: `./${plugin}` })) };
}

/** One manifest per recorded `manifestPath`; an unnamed path fails to load. */
function manifestLoader(
  answers: Readonly<Record<string, MarketplaceManifest>>,
): (manifestPath: string) => Promise<MarketplaceManifest> {
  return (manifestPath) => {
    const answer = answers[manifestPath];
    return answer === undefined
      ? Promise.reject(new Error(`cannot load ${manifestPath}`))
      : Promise.resolve(answer);
  };
}

function delistedRow(marketplace: string, plugin: string): PerEntryOutcome {
  return {
    kind: "plugin-declarer-unreadable",
    scope: "project",
    marketplace,
    plugin,
    reason: "not in manifest",
    cause: new Error(`Plugin "${plugin}" not found in marketplace "${marketplace}"`),
  };
}

test("REC-05 / DLS-01: every enabled record its loaded manifest does not list gets a not-in-manifest warning", async () => {
  // arrange
  const tools = marketplaceRecord("tools", ["app", "lib", "paused"], ["paused"]);
  const kit = marketplaceRecord("kit", ["gone"]);
  const outcomes: PerEntryOutcome[] = [];

  // act
  await reportDelistedPlugins(
    "project",
    stateOf(tools, kit),
    outcomes,
    manifestLoader({
      [tools.manifestPath]: manifestListing("tools", ["lib"]),
      [kit.manifestPath]: manifestListing("kit", []),
    }),
  );

  // assert
  assert.deepStrictEqual(outcomes, [delistedRow("tools", "app"), delistedRow("kit", "gone")]);
});

test("REC-05: a marketplace whose manifest fails to load reports nothing", async () => {
  // arrange
  const tools = marketplaceRecord("tools", ["app"]);
  const outcomes: PerEntryOutcome[] = [];

  // act
  await reportDelistedPlugins("project", stateOf(tools), outcomes, manifestLoader({}));

  // assert
  assert.deepStrictEqual(outcomes, []);
});

test("RECON-04: a plugin this pass already reported gets no delisted row", async () => {
  // arrange
  const tools = marketplaceRecord("tools", ["app", "lib"]);
  const unreadable: PerEntryOutcome = {
    kind: "plugin-declarer-unreadable",
    scope: "project",
    marketplace: "tools",
    plugin: "app",
    reason: "not in manifest",
    cause: new Error("cannot read the dependencies of app@tools"),
  };
  const outcomes: PerEntryOutcome[] = [unreadable];

  // act
  await reportDelistedPlugins(
    "project",
    stateOf(tools),
    outcomes,
    manifestLoader({ [tools.manifestPath]: manifestListing("tools", []) }),
  );

  // assert
  assert.deepStrictEqual(outcomes, [unreadable, delistedRow("tools", "lib")]);
});

test("REC-05: a pristine scope with no state reports nothing", async () => {
  // arrange
  const outcomes: PerEntryOutcome[] = [];

  // act
  await reportDelistedPlugins("project", undefined, outcomes, manifestLoader({}));

  // assert
  assert.deepStrictEqual(outcomes, []);
});

test("RECON-04: only a suppressing row for the same scope, marketplace, and plugin counts", () => {
  // arrange
  const outcomes: PerEntryOutcome[] = [
    { kind: "plugin-enabled", scope: "project", marketplace: "tools", plugin: "app" },
    { kind: "plugin-uninstalled", scope: "user", marketplace: "tools", plugin: "app" },
    { kind: "plugin-uninstalled", scope: "project", marketplace: "kit", plugin: "app" },
    { kind: "plugin-uninstalled", scope: "project", marketplace: "tools", plugin: "lib" },
    { kind: "mp-added", scope: "project", marketplace: "tools" },
  ];

  // act
  const suppressed = hasSuppressingRow(outcomes, "project", "tools", "app");

  // assert
  assert.equal(suppressed, false);
  assert.equal(hasSuppressingRow(outcomes, "project", "tools", "lib"), true);
});

test("REC-05: the production manifest load reads the marketplace manifest off disk", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "delisted-plugins-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tools: MarketplaceRecord = {
    ...marketplaceRecord("tools", ["app"]),
    manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: root,
  };
  await mkdir(path.dirname(tools.manifestPath), { recursive: true });
  await writeFile(
    tools.manifestPath,
    JSON.stringify({ name: "tools", owner: { name: "t" }, plugins: [] }),
  );
  const outcomes: PerEntryOutcome[] = [];

  // act
  await reportDelistedPlugins("project", stateOf(tools), outcomes);

  // assert
  assert.deepStrictEqual(outcomes, [delistedRow("tools", "app")]);
});
