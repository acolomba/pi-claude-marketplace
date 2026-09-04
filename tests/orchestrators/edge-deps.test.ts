// Owner suite for `orchestrators/edge-deps.ts::makeLocationsResolver`, the D-04
// registration-glue helper that gives `edge/completions/` a scope-aware reader
// without crossing BLOCK C (edge -> persistence / edge -> domain).
//
// The resolver declares no collaborator parameter, so its contract is the value
// it reads back off a real tree. Every case therefore owns one temporary tree,
// restores `HOME` and the agent-directory variable through the test context, and
// installs a fail-fast replacement for the process-wide transport that the
// no-network read surfaces (NFR-5) must never reach.
//
// The status vocabulary this suite pins is owned by
// `tests/orchestrators/plugin/plugin-state-classifier.test.ts`; every expected
// status here is a written-out literal, never a value this suite derives by
// re-running the production classification it is checking.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  makeLocationsResolver,
  type MarketplaceStateRecordLike,
} from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { ManifestSoftFailError } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { PluginIndexRow } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

interface HermeticScope {
  readonly cwd: string;
  readonly home: string;
  /** How many times the case reached the replaced process-wide transport. */
  fetchCallCount(): number;
}

interface InstalledFixture {
  readonly version: string;
  readonly enabled?: boolean;
  readonly unsupported?: readonly string[];
}

interface FixturePlugin {
  readonly name: string;
  /** Manifest `source` string. Defaults to the sibling `./plugins/<name>` tree. */
  readonly source?: string;
  /** Declare the plugin in `marketplace.json` (default true). */
  readonly inManifest?: boolean;
  readonly manifestVersion?: string;
  /** Declare an unsupported component kind on the manifest entry. */
  readonly declaresUnsupported?: boolean;
  /** Create the on-disk plugin tree (default true). */
  readonly pluginTree?: boolean;
  readonly installed?: InstalledFixture;
}

interface BucketizerCase {
  readonly title: string;
  /** Marketplace name; doubles as the temporary-directory label. */
  readonly marketplace: string;
  readonly plugins: () => readonly FixturePlugin[];
  readonly rows: readonly PluginIndexRow[];
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the completion resolver must not reach the network");
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal and both
 * environment restores are registered before the resolver runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `edge-deps-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `edge-deps-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return {
    cwd,
    home,
    fetchCallCount(): number {
      return fetchSpy.mock.callCount();
    },
  };
}

function marketplaceRootIn(cwd: string, marketplaceName: string): string {
  return path.join(cwd, "marketplaces", marketplaceName);
}

function manifestPathIn(cwd: string, marketplaceName: string): string {
  return path.join(marketplaceRootIn(cwd, marketplaceName), ".claude-plugin", "marketplace.json");
}

function pluginRootIn(cwd: string, marketplaceName: string, pluginName: string): string {
  return path.join(marketplaceRootIn(cwd, marketplaceName), "plugins", pluginName);
}

function pluginRecord(resolvedSource: string, installed: InstalledFixture): PluginRecord {
  const unsupported = installed.unsupported ?? [];
  return {
    version: installed.version,
    resolvedSource,
    compatibility: {
      installable: unsupported.length === 0,
      notes: [],
      supported: [],
      unsupported: [...unsupported],
    },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: installed.enabled ?? true,
    installedAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z",
  };
}

function marketplaceRecord(
  cwd: string,
  marketplaceName: string,
  plugins: Record<string, PluginRecord>,
): MarketplaceRecord {
  const marketplaceRoot = marketplaceRootIn(cwd, marketplaceName);
  return {
    name: marketplaceName,
    scope: "project",
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: cwd,
    manifestPath: manifestPathIn(cwd, marketplaceName),
    marketplaceRoot,
    plugins,
  };
}

async function writeStateFile(cwd: string, records: readonly MarketplaceRecord[]): Promise<void> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(records.map((record) => [record.name, record])),
  });
}

/**
 * Lay out a path-source marketplace inside the case's own working directory:
 * `marketplace.json`, the declared plugin trees, and the state record that names
 * them. Everything lives under `cwd`, so the case's removal covers it.
 */
async function layoutMarketplace(
  cwd: string,
  marketplaceName: string,
  plugins: readonly FixturePlugin[],
): Promise<void> {
  const manifestPath = manifestPathIn(cwd, marketplaceName);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const manifestEntries = plugins
    .filter((plugin) => plugin.inManifest !== false)
    .map((plugin) => ({
      name: plugin.name,
      source: plugin.source ?? `./plugins/${plugin.name}`,
      ...(plugin.manifestVersion === undefined ? {} : { version: plugin.manifestVersion }),
      ...(plugin.declaresUnsupported === true ? { lspServers: { ls: {} } } : {}),
    }));
  await writeFile(
    manifestPath,
    JSON.stringify({ name: marketplaceName, plugins: manifestEntries }),
    "utf8",
  );

  const records: Record<string, PluginRecord> = {};
  for (const plugin of plugins) {
    const pluginRoot = pluginRootIn(cwd, marketplaceName, plugin.name);
    if (plugin.pluginTree !== false) {
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: plugin.name,
          ...(plugin.manifestVersion === undefined ? {} : { version: plugin.manifestVersion }),
        }),
        "utf8",
      );
    }

    if (plugin.installed !== undefined) {
      records[plugin.name] = pluginRecord(pluginRoot, plugin.installed);
    }
  }

  await writeStateFile(cwd, [marketplaceRecord(cwd, marketplaceName, records)]);
}

describe("marketplaceNamesCachePath", () => {
  test("derives the project-scope names cache file from the working directory", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "names-project");
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedCachePath = path.join(
      scope.cwd,
      ".pi",
      "pi-claude-marketplace",
      "cache",
      "marketplace-names.json",
    );

    // act
    const cachePath = resolver.marketplaceNamesCachePath("project");

    // assert
    assert.strictEqual(cachePath, expectedCachePath);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });

  test("derives the user-scope names cache file from the agent directory", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "names-user");
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedCachePath = path.join(
      scope.home,
      ".pi",
      "agent",
      "pi-claude-marketplace",
      "cache",
      "marketplace-names.json",
    );

    // act
    const cachePath = resolver.marketplaceNamesCachePath("user");

    // assert
    assert.strictEqual(cachePath, expectedCachePath);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });
});

describe("pluginCachePath", () => {
  test("derives the project-scope per-marketplace cache file", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "index-project");
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedCachePath = path.join(
      scope.cwd,
      ".pi",
      "pi-claude-marketplace",
      "cache",
      "plugins",
      "team-mp.json",
    );

    // act
    const cachePath = await resolver.pluginCachePath("project", "team-mp");

    // assert
    assert.strictEqual(cachePath, expectedCachePath);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });

  test("derives the user-scope per-marketplace cache file", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "index-user");
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedCachePath = path.join(
      scope.home,
      ".pi",
      "agent",
      "pi-claude-marketplace",
      "cache",
      "plugins",
      "team-mp.json",
    );

    // act
    const cachePath = await resolver.pluginCachePath("user", "team-mp");

    // assert
    assert.strictEqual(cachePath, expectedCachePath);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });
});

describe("loadStateForScope", () => {
  test("projects every recorded marketplace to its manifest path and plugin records", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "state-projection");
    const pluginRoot = pluginRootIn(scope.cwd, "team-mp", "plug");
    await writeStateFile(scope.cwd, [
      marketplaceRecord(scope.cwd, "team-mp", {
        plug: pluginRecord(pluginRoot, { version: "1.0.0" }),
      }),
      marketplaceRecord(scope.cwd, "empty-mp", {}),
    ]);
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedState = {
      marketplaces: {
        "team-mp": {
          manifestPath: manifestPathIn(scope.cwd, "team-mp"),
          plugins: { plug: pluginRecord(pluginRoot, { version: "1.0.0" }) },
        },
        "empty-mp": {
          manifestPath: manifestPathIn(scope.cwd, "empty-mp"),
          plugins: {},
        },
      },
    } satisfies { readonly marketplaces: Record<string, MarketplaceStateRecordLike> };

    // act
    const scopeState = await resolver.loadStateForScope("project");

    // assert
    assert.deepStrictEqual(scopeState, expectedState);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });

  test("reports no marketplaces when the scope has no state file", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "state-absent");
    const resolver = makeLocationsResolver(scope.cwd);
    const expectedState = { marketplaces: {} };

    // act
    const scopeState = await resolver.loadStateForScope("project");

    // assert
    assert.deepStrictEqual(scopeState, expectedState);
    assert.strictEqual(scope.fetchCallCount(), 0);
  });
});

const bucketizerCases = [
  {
    title: "keeps an installed record at the manifest version installed",
    marketplace: "installed-mp",
    plugins: () => [{ name: "plug", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
    rows: [{ name: "plug", status: "installed", version: "1.0.0" }],
  },
  {
    title: "marks an installed record with a newer manifest version upgradable",
    marketplace: "upgradable-mp",
    plugins: () => [{ name: "plug", manifestVersion: "2.0.0", installed: { version: "1.0.0" } }],
    rows: [{ name: "plug", status: "upgradable", version: "1.0.0" }],
  },
  {
    title: "marks an installed record whose newer candidate is degraded partially upgradable",
    marketplace: "partial-upgrade-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        declaresUnsupported: true,
        installed: { version: "1.0.0" },
      },
    ],
    rows: [{ name: "plug", status: "partially-upgradable", version: "1.0.0" }],
  },
  {
    title: "marks a degraded record at the manifest version partially installed",
    marketplace: "degraded-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "1.0.0",
        installed: { version: "1.0.0", unsupported: ["lspServers"] },
      },
    ],
    rows: [{ name: "plug", status: "partially-installed", version: "1.0.0" }],
  },
  {
    title:
      "promotes a degraded record with a clean newer candidate to partially installed upgradable",
    marketplace: "degraded-upgrade-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        installed: { version: "1.0.0", unsupported: ["lspServers"] },
      },
    ],
    rows: [{ name: "plug", status: "partially-installed-upgradable", version: "1.0.0" }],
  },
  {
    title: "keeps a degraded record with a degraded newer candidate partially installed upgradable",
    marketplace: "degraded-partial-upgrade-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        declaresUnsupported: true,
        installed: { version: "1.0.0", unsupported: ["lspServers"] },
      },
    ],
    rows: [{ name: "plug", status: "partially-installed-upgradable", version: "1.0.0" }],
  },
  {
    title: "keeps a degraded record whose newer candidate has no plugin tree partially installed",
    marketplace: "degraded-gone-candidate-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        pluginTree: false,
        installed: { version: "1.0.0", unsupported: ["lspServers"] },
      },
    ],
    rows: [{ name: "plug", status: "partially-installed", version: "1.0.0" }],
  },
  {
    title: "freezes a disabled record whose manifest version drifted at installed (ENBL-02)",
    marketplace: "disabled-drift-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        installed: { version: "1.0.0", enabled: false },
      },
    ],
    rows: [{ name: "plug", status: "installed", version: "1.0.0" }],
  },
  {
    title: "freezes a disabled degraded record at installed (ENBL-05)",
    marketplace: "disabled-degraded-mp",
    plugins: () => [
      {
        name: "plug",
        manifestVersion: "2.0.0",
        installed: { version: "1.0.0", enabled: false, unsupported: ["lspServers"] },
      },
    ],
    rows: [{ name: "plug", status: "installed", version: "1.0.0" }],
  },
  {
    title: "keeps an installed record that the manifest no longer declares installed",
    marketplace: "unlisted-install-mp",
    plugins: () => [{ name: "plug", inManifest: false, installed: { version: "1.0.0" } }],
    rows: [{ name: "plug", status: "installed", version: "1.0.0" }],
  },
  {
    title: "offers a not-installed entry with a plugin tree as available",
    marketplace: "available-mp",
    plugins: () => [{ name: "plug", manifestVersion: "3.0.0" }],
    rows: [{ name: "plug", status: "available", version: "3.0.0" }],
  },
  {
    title: "omits the version of a not-installed entry that declares none",
    marketplace: "unversioned-mp",
    plugins: () => [{ name: "plug" }],
    rows: [{ name: "plug", status: "available" }],
  },
  {
    title: "marks a not-installed entry with an unsupported component partially available",
    marketplace: "unsupported-mp",
    plugins: () => [{ name: "plug", manifestVersion: "3.0.0", declaresUnsupported: true }],
    rows: [{ name: "plug", status: "partially-available", version: "3.0.0" }],
  },
  {
    title: "marks a not-installed entry without a plugin tree unavailable",
    marketplace: "missing-tree-mp",
    plugins: () => [{ name: "plug", manifestVersion: "3.0.0", pluginTree: false }],
    rows: [{ name: "plug", status: "unavailable", version: "3.0.0" }],
  },
  {
    title: "marks every not-fetched git-source entry remote (RSTA-01)",
    marketplace: "git-source-mp",
    plugins: () => [
      {
        name: "url-plug",
        source: "https://example.com/plugin.git",
        manifestVersion: "1.0.0",
        pluginTree: false,
      },
      {
        name: "subdir-plug",
        source: "https://example.com/repo.git#main:packages/plug",
        manifestVersion: "1.0.0",
        pluginTree: false,
      },
      {
        name: "github-plug",
        source: "owner/repo",
        manifestVersion: "1.0.0",
        pluginTree: false,
      },
    ],
    rows: [
      { name: "url-plug", status: "remote", version: "1.0.0" },
      { name: "subdir-plug", status: "remote", version: "1.0.0" },
      { name: "github-plug", status: "remote", version: "1.0.0" },
    ],
  },
  {
    title: "lists installed rows before the manifest entries that are not installed",
    marketplace: "ordered-mp",
    plugins: () => [
      { name: "alpha", manifestVersion: "2.0.0" },
      { name: "beta", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
      { name: "gamma", manifestVersion: "3.0.0" },
    ],
    rows: [
      { name: "beta", status: "installed", version: "1.0.0" },
      { name: "alpha", status: "available", version: "2.0.0" },
      { name: "gamma", status: "available", version: "3.0.0" },
    ],
  },
] satisfies readonly BucketizerCase[];

describe("loadManifestForMarketplace", () => {
  for (const { title, marketplace, plugins, rows } of bucketizerCases) {
    test(title, async (t) => {
      // arrange
      const scope = await createHermeticScope(t, marketplace);
      await layoutMarketplace(scope.cwd, marketplace, plugins());
      const resolver = makeLocationsResolver(scope.cwd);
      const expectedRows = rows;

      // act
      const indexRows = await resolver.loadManifestForMarketplace("project", marketplace);

      // assert
      assert.deepStrictEqual(indexRows, expectedRows);
      assert.strictEqual(scope.fetchCallCount(), 0);
    });
  }

  test("reports a soft failure when the scope has no record for the marketplace", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "absent-record");
    const resolver = makeLocationsResolver(scope.cwd);

    // act
    const rejection = resolver.loadManifestForMarketplace("project", "absent-mp");

    // assert
    await assert.rejects(rejection, (error: unknown) => {
      assert.ok(error instanceof ManifestSoftFailError);
      assert.ok(error.cause instanceof Error);
      assert.strictEqual(
        error.cause.message,
        'Marketplace "absent-mp" has no state record in scope "project".',
      );
      return true;
    });
    assert.strictEqual(scope.fetchCallCount(), 0);
  });

  test("reports a soft failure when the marketplace manifest is not valid JSON", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "broken-manifest");
    const manifestPath = manifestPathIn(scope.cwd, "broken-mp");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, "{", "utf8");
    await writeStateFile(scope.cwd, [marketplaceRecord(scope.cwd, "broken-mp", {})]);
    const resolver = makeLocationsResolver(scope.cwd);

    // act
    const rejection = resolver.loadManifestForMarketplace("project", "broken-mp");

    // assert
    await assert.rejects(rejection, (error: unknown) => {
      assert.ok(error instanceof ManifestSoftFailError);
      assert.ok(error.cause instanceof InvalidMarketplaceManifestError);
      assert.ok(error.cause.cause instanceof SyntaxError);
      return true;
    });
    assert.strictEqual(scope.fetchCallCount(), 0);
  });
});
