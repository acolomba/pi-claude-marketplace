import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  reportDelistedPlugins,
  reportRefusedMarketplaces,
  reportUnreadableDeclarer,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ScopeReadResult } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
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

const LOOKALIKE_REFUSAL =
  'Claude Code refuses the marketplace name "tools": it looks like one of Anthropic\'s own';

function refusedRow(marketplace: string, plugin: string, refusal: string): PerEntryOutcome {
  return {
    kind: "plugin-declarer-unreadable",
    scope: "project",
    marketplace,
    plugin,
    reason: "invalid manifest",
    cause: new Error(refusal),
  };
}

describe("reportRefusedMarketplaces", () => {
  test("D-PL5-28: every enabled plugin of a refused marketplace gets an invalid-manifest warning", async () => {
    // arrange
    const tools = marketplaceRecord("tools", ["app", "lib"]);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await reportRefusedMarketplaces(
      "project",
      stateOf(tools),
      outcomes,
      manifestLoader({
        [tools.manifestPath]: manifestListing("claude-plugins-v2", ["app", "lib"]),
      }),
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      refusedRow("tools", "app", LOOKALIKE_REFUSAL),
      refusedRow("tools", "lib", LOOKALIKE_REFUSAL),
    ]);
  });

  test("D-PL5-28: a disabled plugin of a refused marketplace gets no warning", async () => {
    // arrange
    const tools = marketplaceRecord("tools", ["app", "paused"], ["paused"]);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await reportRefusedMarketplaces(
      "project",
      stateOf(tools),
      outcomes,
      manifestLoader({ [tools.manifestPath]: manifestListing("claude-plugins-v2", ["app"]) }),
    );

    // assert
    assert.deepStrictEqual(outcomes, [refusedRow("tools", "app", LOOKALIKE_REFUSAL)]);
  });

  test("D-PL5-28: a plugin this pass already reported gets no refused-marketplace row", async () => {
    // arrange
    const tools = marketplaceRecord("tools", ["app", "lib"]);
    const failed: PerEntryOutcome = {
      kind: "plugin-declarer-unreadable",
      scope: "project",
      marketplace: "tools",
      plugin: "app",
      reason: "unreadable manifest",
      cause: new Error("cannot read the dependencies of app@tools"),
    };
    const outcomes: PerEntryOutcome[] = [failed];

    // act
    await reportRefusedMarketplaces(
      "project",
      stateOf(tools),
      outcomes,
      manifestLoader({
        [tools.manifestPath]: manifestListing("claude-plugins-v2", ["app", "lib"]),
      }),
    );

    // assert
    assert.deepStrictEqual(outcomes, [failed, refusedRow("tools", "lib", LOOKALIKE_REFUSAL)]);
  });

  test("D-PL5-28: a marketplace Claude Code accepts reports nothing", async () => {
    // arrange
    const tools = marketplaceRecord("tools", ["app"]);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await reportRefusedMarketplaces(
      "project",
      stateOf(tools),
      outcomes,
      manifestLoader({ [tools.manifestPath]: manifestListing("tools", ["app"]) }),
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
  });

  test("D-PL5-28: a record under a reserved name is refused even when its manifest fails to load", async () => {
    // arrange
    const official = marketplaceRecord("claude-plugins-official", ["app"]);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await reportRefusedMarketplaces("project", stateOf(official), outcomes, manifestLoader({}));

    // assert
    assert.deepStrictEqual(outcomes, [
      refusedRow(
        "claude-plugins-official",
        "app",
        "Marketplace \"claude-plugins-official\" is registered from an untrusted source: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. To fix it, remove the marketplace and re-add it from the official source.",
      ),
    ]);
  });
});

describe("reportDelistedPlugins", () => {
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

  test("D-08: a delisted plugin this pass disabled gets no delisted row", async () => {
    // arrange
    const tools = marketplaceRecord("tools", ["app", "lib", "kit"]);
    const disabled: PerEntryOutcome = {
      kind: "plugin-disabled",
      scope: "project",
      marketplace: "tools",
      plugin: "app",
    };
    const held: PerEntryOutcome = {
      kind: "plugin-dependency-disabled",
      scope: "project",
      marketplace: "tools",
      plugin: "lib",
      reasons: ["dependency unsatisfied"],
      cause: new Error('Install "base@tools" first, or uninstall "lib@tools"'),
    };
    const outcomes: PerEntryOutcome[] = [disabled, held];

    // act
    await reportDelistedPlugins(
      "project",
      stateOf(tools),
      outcomes,
      manifestLoader({ [tools.manifestPath]: manifestListing("tools", []) }),
    );

    // assert
    assert.deepStrictEqual(outcomes, [disabled, held, delistedRow("tools", "kit")]);
  });

  test("REC-05: a pristine scope with no state reports nothing", async () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [];

    // act
    await reportDelistedPlugins("project", undefined, outcomes, manifestLoader({}));

    // assert
    assert.deepStrictEqual(outcomes, []);
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
});

/** A read pass whose LOAD-01 walk could not read `declarer`'s declarations. */
function unreadableDeclarerRead(declarer: string): ScopeReadResult {
  return {
    plan: undefined,
    invalidOutcomes: [],
    verdict: {
      ok: false,
      declarer,
      reason: "unreadable manifest",
      cause: new Error(`cannot read the dependencies of ${declarer}`),
    },
  };
}

describe("reportUnreadableDeclarer", () => {
  test("REC-05: a satisfied verdict reports nothing", () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [];

    // act
    reportUnreadableDeclarer(
      "project",
      {
        plan: undefined,
        invalidOutcomes: [],
        verdict: { ok: true, unsatisfied: [] },
      },
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
  });

  test("REC-05: a read pass that walked no record reports nothing", () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [];

    // act
    reportUnreadableDeclarer("project", { plan: undefined, invalidOutcomes: [] }, outcomes);

    // assert
    assert.deepStrictEqual(outcomes, []);
  });

  test("D-05-07: names the declarer split on its last @ with the walk's reason and cause", () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [
      { kind: "plugin-enabled", scope: "project", marketplace: "tools", plugin: "app@v2" },
    ];

    // act
    reportUnreadableDeclarer("project", unreadableDeclarerRead("app@v2@tools"), outcomes);

    // assert
    assert.deepStrictEqual(outcomes, [
      { kind: "plugin-enabled", scope: "project", marketplace: "tools", plugin: "app@v2" },
      {
        kind: "plugin-declarer-unreadable",
        scope: "project",
        marketplace: "tools",
        plugin: "app@v2",
        reason: "unreadable manifest",
        cause: new Error("cannot read the dependencies of app@v2@tools"),
      },
    ]);
  });

  test("RECON-04: a declarer this pass already reported as failed gets no second row", () => {
    // arrange
    const failed: PerEntryOutcome = {
      kind: "plugin-install-failed",
      scope: "project",
      marketplace: "tools",
      plugin: "app",
      reason: "source missing",
    };
    const outcomes: PerEntryOutcome[] = [failed];

    // act
    reportUnreadableDeclarer("project", unreadableDeclarerRead("app@tools"), outcomes);

    // assert
    assert.deepStrictEqual(outcomes, [failed]);
  });

  for (const { name, other } of [
    {
      name: "another scope",
      other: { kind: "plugin-uninstalled", scope: "user", marketplace: "tools", plugin: "app" },
    },
    {
      name: "another marketplace",
      other: { kind: "plugin-uninstalled", scope: "project", marketplace: "kit", plugin: "app" },
    },
    {
      name: "another plugin",
      other: { kind: "plugin-uninstalled", scope: "project", marketplace: "tools", plugin: "lib" },
    },
    {
      name: "a marketplace row",
      other: { kind: "mp-added", scope: "project", marketplace: "tools" },
    },
  ] as const satisfies readonly { readonly name: string; readonly other: PerEntryOutcome }[]) {
    test(`RECON-04: a suppressing row for ${name} leaves the warning in place`, () => {
      // arrange
      const outcomes: PerEntryOutcome[] = [other];

      // act
      reportUnreadableDeclarer("project", unreadableDeclarerRead("app@tools"), outcomes);

      // assert
      assert.deepStrictEqual(outcomes, [
        other,
        {
          kind: "plugin-declarer-unreadable",
          scope: "project",
          marketplace: "tools",
          plugin: "app",
          reason: "unreadable manifest",
          cause: new Error("cannot read the dependencies of app@tools"),
        },
      ]);
    });
  }
});
