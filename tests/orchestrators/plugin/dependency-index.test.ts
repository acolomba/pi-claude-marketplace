import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  buildScopeDeclarationDetail,
  buildScopeDeclarationIndex,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type {
  AddressedDependency,
  ScopeDeclarationDetailResult,
  ScopeDeclarationIndexResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * A scope root that is never created on disk. `assertPathInside` returns
 * without complaint for a path whose components do not exist, so a path-source
 * record still derives a plugin root and every own-manifest answer comes from
 * the injected reader.
 */
const SCOPE_ROOT = path.join(tmpdir(), "dependency-index-scope");
const LOCATIONS = locationsFor("project", SCOPE_ROOT);

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface RecordSeed {
  readonly enabled?: boolean;
  readonly provenance?: PluginRecord["provenance"];
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: path.join(SCOPE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
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
  const root = path.join(SCOPE_ROOT, name);
  return {
    name,
    scope: "project",
    source: pathSource(`./${name}`),
    addedFromCwd: SCOPE_ROOT,
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
  return Object.assign(new Error(`${code}: open '${path.join(SCOPE_ROOT, "mp")}'`), { code });
}

/** The marketplace under test: one explicit, one dependency-provenance, one disabled record. */
function mpRecord(): MarketplaceRecord {
  return marketplaceRecord("mp", {
    app: {},
    helper: { provenance: "dependency" },
    paused: { enabled: false },
  });
}

function otherRecord(): MarketplaceRecord {
  return marketplaceRecord("other", { kit: {} });
}

function indexEntries(walk: ScopeDeclarationIndexResult): Record<string, string[]> {
  assert.equal(walk.ok, true);
  return walk.ok
    ? Object.fromEntries([...walk.index].map(([holder, declared]) => [holder, [...declared]]))
    : {};
}

test("D-05-06: every record except the excluded one is indexed by the keys it declares", async () => {
  // arrange
  const mp = mpRecord();
  const other = otherRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper", { name: "kit", marketplace: "other" }] },
      helper: {},
      paused: { dependencies: ["helper@mp"] },
    }),
    [other.manifestPath]: manifestOf("other", { kit: { dependencies: ["app@mp"] } }),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp, other),
    locations: LOCATIONS,
    exclude: "helper@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), {
    "app@mp": ["helper@mp", "kit@other"],
    "paused@mp": ["helper@mp"],
    "kit@other": ["app@mp"],
  });
});

test("standalone indexing includes every installed declarer without an exclusion", async () => {
  const mp = mpRecord();
  const other = otherRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: { dependencies: ["kit@other"] },
      paused: { dependencies: ["helper"] },
    }),
    [other.manifestPath]: manifestOf("other", { kit: {} }),
  });

  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp, other),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  assert.deepStrictEqual(indexEntries(walk), {
    "app@mp": ["helper@mp"],
    "helper@mp": ["kit@other"],
    "paused@mp": ["helper@mp"],
    "kit@other": [],
  });
  assert.deepStrictEqual(walk.ok ? walk.candidates.map((candidate) => candidate.key) : [], [
    "app@mp",
    "helper@mp",
    "paused@mp",
    "kit@other",
  ]);
});

test("D-05-10: every indexed record is a candidate carrying its provenance and the snapshot's own objects, the excluded target omitted", async () => {
  // arrange
  const mp = mpRecord();
  const other = otherRecord();
  const state = stateOf(mp, other);
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {}, helper: {}, paused: {} }),
    [other.manifestPath]: manifestOf("other", { kit: {} }),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state,
    locations: LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, true);
  const candidates = walk.ok ? walk.candidates : [];
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
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {},
      helper: { dependencies: ["base"] },
      paused: { dependencies: ["base"] },
    }),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), {
    "helper@mp": ["base@mp"],
    "paused@mp": ["base@mp"],
  });
});

test("D-05-06: a record's own manifest outranks its marketplace entry", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["from-entry"] },
      helper: {},
      paused: {},
    }),
  });
  const reader = ownManifests({
    [path.join(mp.marketplaceRoot, "plugins", "app", ".claude-plugin", "plugin.json")]:
      '{"dependencies":["from-manifest@other"]}',
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "paused@mp",
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), {
    "app@mp": ["from-manifest@other"],
    "helper@mp": [],
  });
});

test("PRUNE-05: a sha-pinned or version-ranged declaration still holds its key", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
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
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "paused@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), {
    "app@mp": ["helper@mp", "base@other"],
    "helper@mp": [],
  });
});

test("PRUNE-05: excluding the only record reads no manifest and yields an empty index", async () => {
  // arrange
  const solo = marketplaceRecord("solo", { only: {} });
  const loadManifest = manifestLoader({});

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(solo),
    locations: LOCATIONS,
    exclude: "only@solo",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), {});
});

test("D-05-07: a record its marketplace does not list ends the walk as not in manifest", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {}, paused: {} }),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok ? undefined : { declarer: walk.declarer, message: walk.cause.message },
    {
      declarer: "helper@mp",
      message: "cannot read the dependencies of helper@mp: not declared by its marketplace",
    },
  );
});

test("D-05-07: an unusable declaration ends the walk as invalid manifest with the parser's field path", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {},
      helper: { dependencies: [42] },
      paused: {},
    }),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok ? undefined : { declarer: walk.declarer, message: walk.cause.message },
    {
      declarer: "helper@mp",
      message: "cannot read the dependencies of helper@mp: dependencies.0: Invalid input",
    },
  );
});

test("D-05-07: a corrupt own manifest beside a silent entry ends the walk naming the record", async () => {
  // arrange -- the entry carries no `dependencies`, so a read that let the
  // entry answer for the corrupt file would index helper as declaring nothing.
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {}, helper: {}, paused: {} }),
  });
  const reader = ownManifests({
    [path.join(mp.marketplaceRoot, "plugins", "helper", ".claude-plugin", "plugin.json")]:
      "{ truncated",
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "app@mp",
    reader,
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok
      ? undefined
      : { declarer: walk.declarer, message: walk.cause.message, cause: walk.cause.cause },
    {
      declarer: "helper@mp",
      message:
        "cannot read the dependencies of helper@mp: its own manifest is present but cannot be read",
      cause: undefined,
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
    const mp = mpRecord();
    const loadManifest = manifestLoader({ [mp.manifestPath]: thrown });

    // act
    const walk = await buildScopeDeclarationIndex({
      state: stateOf(mp),
      locations: LOCATIONS,
      exclude: "paused@mp",
      reader: ownManifests(),
      loadManifest,
    });

    // assert
    assert.equal(walk.ok, false);
    assert.deepStrictEqual(
      walk.ok ? undefined : { declarer: walk.declarer, message: walk.cause.message },
      { declarer: "app@mp", message },
    );
  });
}

test("T-05-04: the load-failure cause line redacts the absolute path and chains no cause", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({ [mp.manifestPath]: errno("EACCES") });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "paused@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok ? undefined : { message: walk.cause.message, cause: walk.cause.cause },
    { message: "cannot read the dependencies of app@mp: EACCES: open 'mp'", cause: undefined },
  );
});

test("D-05-07: the first unreadable record wins over a later one", async () => {
  // arrange
  const firstUnreadable = marketplaceRecord("mp", { app: {}, missing: {}, paused: {} });
  const other = otherRecord();
  const loadManifest = manifestLoader({
    [firstUnreadable.manifestPath]: manifestOf("mp", { app: {}, helper: {}, paused: {} }),
    [other.manifestPath]: errno("ENOENT"),
  });

  // act
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(firstUnreadable, other),
    locations: LOCATIONS,
    exclude: "app@mp",
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok ? undefined : { declarer: walk.declarer, message: walk.cause.message },
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
  const walk = await buildScopeDeclarationIndex({
    state: stateOf(onDisk),
    locations: locationsFor("project", root),
    exclude: "helper@mp",
  });

  // assert
  assert.deepStrictEqual(indexEntries(walk), { "app@mp": ["helper@mp"] });
});

/** The detail walk's map as plain data, so a case compares whole values. */
function detailEntries(
  walk: ScopeDeclarationDetailResult,
): Record<string, readonly AddressedDependency[]> {
  assert.equal(walk.ok, true);
  return walk.ok ? Object.fromEntries(walk.declarations) : {};
}

test("keeps every declared constraint and fills each declaration's marketplace", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, helper: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: [
          "helper@^1.2.0",
          { name: "base", marketplace: "other", version: ">=2.0.0 <3.0.0" },
          { name: "pinned", sha: "0123456789abcdef0123456789abcdef01234567" },
        ],
      },
      helper: {},
    }),
  });

  // act
  const walk = await buildScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(detailEntries(walk), {
    "app@mp": [
      { name: "helper", version: "^1.2.0", marketplace: "mp" },
      { name: "base", version: ">=2.0.0 <3.0.0", marketplace: "other" },
      {
        name: "pinned",
        sha: "0123456789abcdef0123456789abcdef01234567",
        marketplace: "mp",
      },
    ],
    "helper@mp": [],
  });
});

test("indexes every record in the scope, with no key under decision to exclude", async () => {
  // arrange
  const mp = mpRecord();
  const other = otherRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: {},
      paused: {},
    }),
    [other.manifestPath]: manifestOf("other", { kit: {} }),
  });

  // act
  const walk = await buildScopeDeclarationDetail({
    state: stateOf(mp, other),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(detailEntries(walk), {
    "app@mp": [{ name: "helper", marketplace: "mp" }],
    "helper@mp": [],
    "paused@mp": [],
    "kit@other": [],
  });
});

test("ends the detail walk on the first declarer whose own manifest cannot be read", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {} }),
  });
  const reader = ownManifests({
    [path.join(mp.marketplaceRoot, "plugins", "app", ".claude-plugin", "plugin.json")]:
      "{ truncated",
  });

  // act
  const walk = await buildScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });

  // assert
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok
      ? undefined
      : { declarer: walk.declarer, message: walk.cause.message, cause: walk.cause.cause },
    {
      declarer: "app@mp",
      message:
        "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
      cause: undefined,
    },
  );
});

test("walks a scope with no recorded marketplace to an empty declaration map", async () => {
  // arrange
  const state = stateOf();

  // act
  const walk = await buildScopeDeclarationDetail({
    state,
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest: manifestLoader({}),
  });

  // assert
  assert.deepStrictEqual(detailEntries(walk), {});
});
