import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { buildScopeDeclarationIndex } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type { ScopeDeclarationIndexResult } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * A scope root that is never created on disk. `assertPathInside` returns
 * without complaint for a path whose components do not exist, so a path-source
 * record still derives a plugin root and every own-manifest answer comes from
 * the injected reader.
 */
const FAKE_ROOT = path.join(tmpdir(), "dependency-index-fake");
const FAKE_LOCATIONS = locationsFor("project", FAKE_ROOT);

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface RecordSeed {
  readonly enabled?: boolean;
  readonly provenance?: PluginRecord["provenance"];
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: path.join(FAKE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: seed.enabled ?? true,
    provenance: seed.provenance ?? "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function marketplaceRecord(
  name: string,
  plugins: Readonly<Record<string, RecordSeed>>,
): MarketplaceRecord {
  const root = path.join(FAKE_ROOT, name);
  return {
    name,
    scope: "project",
    source: pathSource(`./${name}`),
    addedFromCwd: FAKE_ROOT,
    manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: root,
    plugins: Object.fromEntries(
      Object.entries(plugins).map(([plugin, seed]) => [plugin, pluginRecord(seed)]),
    ),
  };
}

function stateOf(...marketplaces: readonly MarketplaceRecord[]): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: Object.fromEntries(marketplaces.map((mp) => [mp.name, mp])),
  };
}

/** A manifest entry: `dependencies` is whatever the case declares, verbatim. */
interface EntrySeed {
  readonly dependencies?: unknown;
}

function manifestOf(
  name: string,
  entries: Readonly<Record<string, EntrySeed>>,
): MarketplaceManifest {
  return {
    name,
    plugins: Object.entries(entries).map(([plugin, seed]) => ({
      name: plugin,
      source: `./plugins/${plugin}`,
      ...(seed.dependencies !== undefined && { dependencies: seed.dependencies }),
    })),
  };
}

/** The manifest seam: one manifest per recorded `manifestPath`, or a throw. */
function manifestLoader(
  answers: Readonly<Record<string, MarketplaceManifest | Error>>,
): (manifestPath: string) => Promise<MarketplaceManifest> {
  return (manifestPath) => {
    const answer = answers[manifestPath];
    if (answer === undefined) {
      return Promise.reject(new Error(`unexpected manifest load of ${manifestPath}`));
    }

    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
}

/**
 * A reader whose own manifests are exactly the named files. Every other
 * candidate is absent, so the marketplace entry answers for that record.
 */
function ownManifests(files: Readonly<Record<string, string>> = {}): DependencyDeclarationReader {
  return {
    isRegularFile: (filePath) => Promise.resolve(Object.hasOwn(files, filePath)),
    readTextFile: (filePath) => Promise.resolve(files[filePath] ?? ""),
    makePresenceProbe: () => () =>
      Promise.reject(new Error("a path-source record never probes a clone")),
  };
}

function errno(code: string): Error {
  const err: NodeJS.ErrnoException = new Error(`${code}: open '${path.join(FAKE_ROOT, "mp")}'`);
  err.code = code;
  return err;
}

const MP = marketplaceRecord("mp", {
  app: {},
  helper: { provenance: "dependency" },
  paused: { enabled: false },
});
const OTHER = marketplaceRecord("other", { kit: {} });

function indexEntries(result: ScopeDeclarationIndexResult): Record<string, string[]> {
  assert.equal(result.ok, true);
  return result.ok
    ? Object.fromEntries([...result.index].map(([holder, declared]) => [holder, [...declared]]))
    : {};
}

test("D-05-06: every record except the excluded one is indexed by the keys it declares", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper", { name: "kit", marketplace: "other" }] },
      helper: {},
      paused: { dependencies: ["helper@mp"] },
    }),
    [OTHER.manifestPath]: manifestOf("other", { kit: { dependencies: ["app@mp"] } }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP, OTHER),
    locations: FAKE_LOCATIONS,
    exclude: "helper@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), {
    "app@mp": ["helper@mp", "kit@other"],
    "paused@mp": ["helper@mp"],
    "kit@other": ["app@mp"],
  });
});

test("D-05-10: every indexed record is a candidate carrying its provenance and the snapshot's own objects, the excluded target omitted", async () => {
  // arrange
  const state = stateOf(MP, OTHER);
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", { app: {}, helper: {}, paused: {} }),
    [OTHER.manifestPath]: manifestOf("other", { kit: {} }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state,
    locations: FAKE_LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(result.ok, true);
  const candidates = result.ok ? result.candidates : [];
  assert.deepStrictEqual(
    candidates.map(({ key, provenance, plugin, marketplace }) => ({
      key,
      provenance,
      plugin,
      marketplace: marketplace.name,
    })),
    [
      { key: "helper@mp", provenance: "dependency", plugin: "helper", marketplace: "mp" },
      { key: "paused@mp", provenance: "explicit", plugin: "paused", marketplace: "mp" },
      { key: "kit@other", provenance: "explicit", plugin: "kit", marketplace: "other" },
    ],
  );
  assert.strictEqual(candidates[0]?.marketplace, state.marketplaces["mp"]);
  assert.strictEqual(candidates[0]?.record, state.marketplaces["mp"]?.plugins["helper"]);
});

test("D-05-04: a disabled record and a dependency-provenance record both hold their declarations", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", {
      app: {},
      helper: { dependencies: ["base"] },
      paused: { dependencies: ["base"] },
    }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), {
    "helper@mp": ["base@mp"],
    "paused@mp": ["base@mp"],
  });
});

test("D-05-06: a record's own manifest outranks its marketplace entry", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["from-entry"] },
      helper: {},
      paused: {},
    }),
  });
  const reader = ownManifests({
    [path.join(MP.marketplaceRoot, "plugins", "app", ".claude-plugin", "plugin.json")]:
      '{"dependencies":["from-manifest@other"]}',
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "paused@mp",
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), {
    "app@mp": ["from-manifest@other"],
    "helper@mp": [],
  });
});

test("PRUNE-05: a sha-pinned or version-ranged declaration still holds its key", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: [
          { name: "helper", sha: "0123456789abcdef0123456789abcdef01234567" },
          "base@other@^1.0.0",
        ],
      },
      helper: {},
      paused: {},
    }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "paused@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), {
    "app@mp": ["helper@mp", "base@other"],
    "helper@mp": [],
  });
});

test("PRUNE-05: excluding the only record reads no manifest and yields an empty index", async () => {
  // arrange
  const solo = marketplaceRecord("solo", { only: {} });
  const loadManifest = manifestLoader({});

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(solo),
    locations: FAKE_LOCATIONS,
    exclude: "only@solo",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), {});
});

test("D-05-07: a record its marketplace does not list ends the walk as not in manifest", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", { app: {}, paused: {} }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(result.ok, false);
  assert.deepStrictEqual(
    result.ok ? undefined : { declarer: result.declarer, message: result.cause.message },
    {
      declarer: "helper@mp",
      message: "cannot read the dependencies of helper@mp: not declared by its marketplace",
    },
  );
});

test("D-05-07: an unusable declaration ends the walk as invalid manifest with the parser's field path", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", {
      app: {},
      helper: { dependencies: [42] },
      paused: {},
    }),
  });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(result.ok, false);
  assert.deepStrictEqual(
    result.ok ? undefined : { declarer: result.declarer, message: result.cause.message },
    {
      declarer: "helper@mp",
      message: "cannot read the dependencies of helper@mp: dependencies.0: Invalid input",
    },
  );
});

interface LoadFailureCase {
  readonly title: string;
  readonly thrown: Error;
  readonly message: string;
}

const LOAD_FAILURES: readonly LoadFailureCase[] = [
  {
    title: "D-05-07: a missing marketplace manifest ends the walk naming the record",
    thrown: errno("ENOENT"),
    message: "cannot read the dependencies of app@mp: ENOENT: open 'mp'",
  },
  {
    title: "D-05-07: a malformed marketplace manifest ends the walk naming the record",
    thrown: new InvalidMarketplaceManifestError("bad json", { cause: new SyntaxError("x") }),
    message: "cannot read the dependencies of app@mp: bad json",
  },
];

for (const { title, thrown, message } of LOAD_FAILURES) {
  test(title, async () => {
    // arrange
    const loadManifest = manifestLoader({ [MP.manifestPath]: thrown });

    // act
    const result = await buildScopeDeclarationIndex({
      state: stateOf(MP),
      locations: FAKE_LOCATIONS,
      exclude: "paused@mp",
      reader: ownManifests(),
      loadManifest,
    });

    // assert
    assert.equal(result.ok, false);
    assert.deepStrictEqual(
      result.ok ? undefined : { declarer: result.declarer, message: result.cause.message },
      { declarer: "app@mp", message },
    );
  });
}

test("T-05-04: the load-failure cause line redacts the absolute path and chains no cause", async () => {
  // arrange
  const loadManifest = manifestLoader({ [MP.manifestPath]: errno("EACCES") });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(MP),
    locations: FAKE_LOCATIONS,
    exclude: "paused@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(result.ok, false);
  assert.deepStrictEqual(
    result.ok ? undefined : { message: result.cause.message, cause: result.cause.cause },
    { message: "cannot read the dependencies of app@mp: EACCES: open 'mp'", cause: undefined },
  );
});

test("D-05-07: the first unreadable record wins over a later one", async () => {
  // arrange
  const loadManifest = manifestLoader({
    [MP.manifestPath]: manifestOf("mp", { app: {}, helper: {}, paused: {} }),
    [OTHER.manifestPath]: errno("ENOENT"),
  });
  const firstUnreadable = marketplaceRecord("mp", { app: {}, missing: {}, paused: {} });

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(firstUnreadable, OTHER),
    locations: FAKE_LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(result.ok, false);
  assert.deepStrictEqual(
    result.ok ? undefined : { declarer: result.declarer, message: result.cause.message },
    {
      declarer: "missing@mp",
      message: "cannot read the dependencies of missing@mp: not declared by its marketplace",
    },
  );
});

test("D-05-06: with no seams injected the index is read from the real manifest cache and disk", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "dependency-index-disk-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marketplaceRoot = path.join(root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "app", source: "./plugins/app", dependencies: ["from-entry"] },
        { name: "helper", source: "./plugins/helper" },
      ],
    }),
  );
  const ownManifest = path.join(marketplaceRoot, "plugins", "app", ".claude-plugin", "plugin.json");
  await mkdir(path.dirname(ownManifest), { recursive: true });
  await writeFile(ownManifest, JSON.stringify({ name: "app", dependencies: ["helper"] }));
  const onDisk: MarketplaceRecord = {
    ...marketplaceRecord("mp", { app: {}, helper: {} }),
    manifestPath,
    marketplaceRoot,
  };

  // act
  const result = await buildScopeDeclarationIndex({
    state: stateOf(onDisk),
    locations: locationsFor("project", root),
    exclude: "helper@mp",
  });

  // assert
  assert.deepStrictEqual(indexEntries(result), { "app@mp": ["helper@mp"] });
});
