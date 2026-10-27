import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  buildInstalledScopeDeclarationDetail,
  buildScopeDeclarationDetail,
  buildScopeDeclarationIndex,
  readInstalledRecordDeclarations,
  readRecordDeclarations,
  withoutDisabledHolders,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type {
  AddressedDependency,
  DeclarerReadFailure,
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
  readonly dependencyDisabled?: true;
  readonly resolvedSource?: string;
  readonly resolvedSha?: string;
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: seed.resolvedSource ?? path.join(SCOPE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: seed.enabled ?? true,
    provenance: seed.provenance ?? "explicit",
    ...(seed.dependencyDisabled !== undefined && { dependencyDisabled: seed.dependencyDisabled }),
    ...(seed.resolvedSha !== undefined && { resolvedSha: seed.resolvedSha }),
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
    // A path record runs its marketplace tree's files, so its copy sits there.
    plugins: Object.fromEntries(
      Object.entries(plugins).map(([plugin, seed]) => [
        plugin,
        pluginRecord({ resolvedSource: path.join(root, "plugins", plugin), ...seed }),
      ]),
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

test("UNI-01 / MPR-01: dropping disabled holders keeps enabled and load-time-disabled ones", () => {
  // arrange
  const mp = marketplaceRecord("mp", {
    app: {},
    paused: { enabled: false },
    held: { enabled: false, dependencyDisabled: true },
  });
  const index = new Map([
    ["app@mp", new Set(["base@mp"])],
    ["paused@mp", new Set(["base@mp"])],
    ["held@mp", new Set(["base@mp"])],
  ]);

  // act
  const enabled = withoutDisabledHolders(index, stateOf(mp));

  // assert
  assert.deepStrictEqual([...enabled.keys()], ["app@mp", "held@mp"]);
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
    walk.ok
      ? undefined
      : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
    {
      declarer: "helper@mp",
      reason: "not in manifest",
      message:
        "cannot read the dependencies of helper@mp: not declared by its marketplace, and its installed copy cannot be read",
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
    walk.ok
      ? undefined
      : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
    {
      declarer: "helper@mp",
      reason: "invalid manifest",
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
      : {
          declarer: walk.declarer,
          reason: walk.reason,
          message: walk.cause.message,
          cause: walk.cause.cause,
        },
    {
      declarer: "helper@mp",
      reason: "unreadable manifest",
      message:
        "cannot read the dependencies of helper@mp: its own manifest is present but cannot be read",
      cause: undefined,
    },
  );
});

interface LoadFailureCase {
  readonly title: string;
  readonly thrown: Error;
  readonly reason: DeclarerReadFailure;
  readonly message: string;
}

const LOAD_FAILURES: readonly LoadFailureCase[] = [
  {
    title:
      "D-05-07: a missing marketplace manifest ends the walk naming the record and the missing manifest",
    thrown: errno("ENOENT"),
    reason: "source missing",
    message: "cannot read the dependencies of app@mp: its marketplace manifest is missing",
  },
  {
    title: "D-05-07: a marketplace manifest under a file instead of a directory reads as missing",
    thrown: errno("ENOTDIR"),
    reason: "source missing",
    message: "cannot read the dependencies of app@mp: its marketplace manifest is missing",
  },
  {
    title:
      "D-05-07: a malformed marketplace manifest ends the walk naming the record and the invalid manifest",
    thrown: new InvalidMarketplaceManifestError("bad json", { cause: new SyntaxError("x") }),
    reason: "unparseable",
    message: "cannot read the dependencies of app@mp: its marketplace manifest is invalid",
  },
  {
    title: "REC-05: a schema-invalid marketplace manifest ends the walk as an invalid manifest",
    thrown: new InvalidMarketplaceManifestError("marketplace.json schema invalid"),
    reason: "invalid manifest",
    message: "cannot read the dependencies of app@mp: its marketplace manifest is invalid",
  },
  {
    title:
      "D-05-07: a marketplace manifest the process may not read ends the walk naming the record and the unreadable manifest",
    thrown: errno("EACCES"),
    reason: "permission denied",
    message: "cannot read the dependencies of app@mp: its marketplace manifest cannot be read",
  },
  {
    title: "D-05-07: a manifest load failure with no errno code reads as an unreadable manifest",
    thrown: new Error("lib@mp: marketplace text"),
    reason: "unreadable",
    message: "cannot read the dependencies of app@mp: its marketplace manifest cannot be read",
  },
];

for (const { title, thrown, reason, message } of LOAD_FAILURES) {
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
      walk.ok
        ? undefined
        : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
      { declarer: "app@mp", reason, message },
    );
  });
}

test("T-05-04: the load-failure cause line carries no text of the thrown error and chains no cause", async () => {
  // arrange
  const mp = mpRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: new InvalidMarketplaceManifestError(
      "marketplace.json schema invalid: /plugins/0/name: repository text",
    ),
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
  assert.equal(walk.ok, false);
  assert.deepStrictEqual(
    walk.ok ? undefined : { message: walk.cause.message, cause: walk.cause.cause },
    {
      message: "cannot read the dependencies of app@mp: its marketplace manifest is invalid",
      cause: undefined,
    },
  );
});

test("D-PL2-05 / D-05-07: the index walk ends on the first unreadable record, before a later one", async () => {
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
    walk.ok
      ? undefined
      : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
    {
      declarer: "missing@mp",
      reason: "not in manifest",
      message:
        "cannot read the dependencies of missing@mp: not declared by its marketplace, and its installed copy cannot be read",
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

test("D-PL2-05 / D-05-07: the detail walk ends on the first declarer whose own manifest cannot be read", async () => {
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
      : {
          declarer: walk.declarer,
          reason: walk.reason,
          message: walk.cause.message,
          cause: walk.cause.cause,
        },
    {
      declarer: "app@mp",
      reason: "unreadable manifest",
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

/** The installed copy of `plugin` inside the marketplace `mp`'s clone root. */
function copyRoot(plugin: string): string {
  return path.join(SCOPE_ROOT, "mp", "plugins", plugin);
}

test("DLS-01: a record its marketplace no longer lists keeps the dependencies of its installed copy", async () => {
  // arrange
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: copyRoot("app") },
    lib: {},
  });
  const loadManifest = manifestLoader({ [mp.manifestPath]: manifestOf("mp", { lib: {} }) });
  const reader = ownManifests({
    [path.join(copyRoot("app"), ".claude-plugin", "plugin.json")]: JSON.stringify({
      dependencies: ["lib@^1.0.0"],
    }),
  });

  // act
  const detail = await buildScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });
  const index = await buildScopeDeclarationIndex({
    state: stateOf(mp),
    locations: LOCATIONS,
    exclude: "lib@mp",
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(detailEntries(detail), {
    "app@mp": [{ name: "lib", version: "^1.0.0", marketplace: "mp" }],
    "lib@mp": [],
  });
  assert.deepStrictEqual(indexEntries(index), { "app@mp": ["lib@mp"] });
});

test("D-05-07: a delisted record whose installed copy is unusable ends the walk as unreadable manifest", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: { resolvedSource: copyRoot("app") } });
  const loadManifest = manifestLoader({ [mp.manifestPath]: manifestOf("mp", {}) });
  const reader = ownManifests({
    [path.join(copyRoot("app"), ".claude-plugin", "plugin.json")]: "{ truncated",
  });

  // act
  const walk = await buildScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(
    walk.ok
      ? undefined
      : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
    {
      declarer: "app@mp",
      reason: "unreadable manifest",
      message:
        "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
    },
  );
});

test("D-05-07: a name with neither a record nor a catalog entry fails closed as not in manifest", async () => {
  // arrange
  const mp = marketplaceRecord("mp", {});
  const loadManifest = manifestLoader({ [mp.manifestPath]: manifestOf("mp", {}) });

  // act
  const read = await readRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest },
    mp,
    "ghost",
  );

  // assert
  assert.deepStrictEqual(
    read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    {
      reason: "not in manifest",
      message:
        "cannot read the dependencies of ghost@mp: not declared by its marketplace, and its installed copy cannot be read",
    },
  );
});

/** The per-commit clone of `app` that a record pinned to a commit installed. */
const APP_CLONE = path.join(LOCATIONS.pluginClonesDir, "acme-app", "0123456");
const APP_SHA = "0123456789abcdef0123456789abcdef01234567";

/** The manifest of `APP_CLONE`. */
const APP_CLONE_MANIFEST = path.join(APP_CLONE, ".claude-plugin", "plugin.json");

test("DLS-01 / NFR-10: a delisted git-source record reads its copy under the scope's plugin clones", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: { resolvedSource: APP_CLONE, resolvedSha: APP_SHA } });
  const loadManifest = manifestLoader({ [mp.manifestPath]: manifestOf("mp", {}) });
  const reader = ownManifests({
    [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib@^2.0.0"] }),
  });

  // act
  const read = await readRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader, loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
    delisted: true,
  });
});

/** The not-in-manifest failure of a delisted `app@mp` whose copy cannot be read. */
/** D-PL2-12 / D-05-07: the failure a refused copy of `app@mp` ends the walk with. */
const APP_UNREADABLE_MANIFEST = {
  reason: "unreadable manifest",
  message: "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
};

/** The delisted `app@mp`'s declarations, its copy at `resolvedSource` declaring `lib@^2.0.0`. */
async function readDelistedApp(
  seed: RecordSeed & { readonly resolvedSource: string },
): Promise<Awaited<ReturnType<typeof readRecordDeclarations>>> {
  const mp = marketplaceRecord("mp", { app: seed });
  return readRecordDeclarations(
    {
      state: stateOf(mp),
      locations: LOCATIONS,
      reader: ownManifests({
        [path.join(seed.resolvedSource, ".claude-plugin", "plugin.json")]: JSON.stringify({
          dependencies: ["lib@^2.0.0"],
        }),
      }),
      loadManifest: manifestLoader({ [mp.manifestPath]: manifestOf("mp", {}) }),
    },
    mp,
    "app",
  );
}

test("D-PL2-12 / NFR-10: a delisted record with no recorded commit whose copy sits under the plugin clones fails as unreadable manifest", async () => {
  // act
  const read = await readDelistedApp({ resolvedSource: APP_CLONE });

  // assert
  assert.deepStrictEqual(
    read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    APP_UNREADABLE_MANIFEST,
  );
});

test("D-PL2-23: a delisted record pinned to a commit whose copy sits under the marketplace clone reads that copy in place", async () => {
  // act
  const read = await readDelistedApp({ resolvedSource: copyRoot("app"), resolvedSha: APP_SHA });

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
    delisted: true,
  });
});

/**
 * The installed detail walk of `mp` recording `lib` and an `app` left pinned
 * to a stale commit with its copy in the marketplace clone, the catalog entry
 * of `app` declaring `entry@mp`, and the copy's manifests exactly `files`.
 */
function walkStalePinnedPathApp(
  files: Readonly<Record<string, string>>,
): Promise<ScopeDeclarationDetailResult> {
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: copyRoot("app"), resolvedSha: APP_SHA },
    lib: {},
  });
  return buildInstalledScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(files),
    loadManifest: manifestLoader({
      [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["entry@mp"] }, lib: {} }),
    }),
  });
}

test("D-PL2-23 / WR-01: the installed detail walk reads a path record left with a stale commit in its marketplace clone", async () => {
  // act
  const walk = await walkStalePinnedPathApp({
    [path.join(copyRoot("app"), ".claude-plugin", "plugin.json")]: JSON.stringify({
      dependencies: ["lib@^2.0.0"],
    }),
  });

  // assert
  assert.deepStrictEqual(detailEntries(walk), {
    "app@mp": [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
    "lib@mp": [],
  });
});

test("D-PL2-22 / D-PL2-23: the installed detail walk answers a stale-commit path record with no manifest from its entry", async () => {
  // act
  const walk = await walkStalePinnedPathApp({});

  // assert
  assert.deepStrictEqual(detailEntries(walk), {
    "app@mp": [{ name: "entry", marketplace: "mp" }],
    "lib@mp": [],
  });
});

test("D-PL2-23 / NFR-10: the installed-first read of a record pinned to a commit whose copy sits under neither clone root fails closed with no catalog read", async () => {
  // arrange
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: path.join(SCOPE_ROOT, "elsewhere", "app"), resolvedSha: APP_SHA },
  });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["entry@mp"] } }),
  });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(
    read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    APP_UNREADABLE_MANIFEST,
  );
});

test("D-PL2-12: a delisted tag-pinned path-source dependency reads its copy under the plugin clones", async () => {
  // act
  const read = await readDelistedApp({
    resolvedSource: path.join(LOCATIONS.pluginClonesDir, "mp-tag", "plugins", "app"),
    resolvedSha: APP_SHA,
    provenance: "dependency",
  });

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
    delisted: true,
  });
});

/** `mp` recording `app` at `APP_CLONE` and `lib`, the catalog listing `app` as `entries` says. */
function pinnedAppScope(entries: Readonly<Record<string, EntrySeed>>): {
  readonly mp: MarketplaceRecord;
  readonly loadManifest: (manifestPath: string) => Promise<MarketplaceManifest>;
} {
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: APP_CLONE, resolvedSha: APP_SHA },
    lib: {},
  });
  return { mp, loadManifest: manifestLoader({ [mp.manifestPath]: manifestOf("mp", entries) }) };
}

test("D-PL2-06: a record pinned to a commit answers what its installed copy declares, not its catalog entry", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ app: {}, lib: {} });
  const reader = ownManifests({
    [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib@^2.0.0"] }),
  });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader, loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
  });
});

test("D-PL2-06 / D-05-07: an installed copy whose manifest is present but unusable fails closed", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ app: { dependencies: ["lib"] }, lib: {} });
  const reader = ownManifests({ [APP_CLONE_MANIFEST]: "{ truncated" });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader, loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(
    read.ok
      ? undefined
      : { declarer: read.declarer, reason: read.reason, message: read.cause.message },
    {
      declarer: "app@mp",
      reason: "unreadable manifest",
      message:
        "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
    },
  );
});

test("D-PL2-22: an installed copy that holds no manifest answers its marketplace entry alone, not the catalog copy's manifest", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ app: { dependencies: ["lib"] }, lib: {} });
  const reader = ownManifests({
    [path.join(copyRoot("app"), ".claude-plugin", "plugin.json")]: JSON.stringify({
      dependencies: ["kit"],
    }),
  });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader, loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(read, { ok: true, declared: [{ name: "lib", marketplace: "mp" }] });
});

test("D-PL2-22 / D-05-07: an installed copy that holds no manifest beside an unusable entry declaration fails as invalid manifest", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ app: { dependencies: [42] }, lib: {} });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(
    read.ok
      ? undefined
      : { declarer: read.declarer, reason: read.reason, message: read.cause.message },
    {
      declarer: "app@mp",
      reason: "invalid manifest",
      message: "cannot read the dependencies of app@mp: dependencies.0: Invalid input",
    },
  );
});

test("D-PL2-22 / D-05-07: a delisted record pinned to a commit whose copy holds no manifest fails as not in manifest", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ lib: {} });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(
    read.ok
      ? undefined
      : { declarer: read.declarer, reason: read.reason, message: read.cause.message },
    {
      declarer: "app@mp",
      reason: "not in manifest",
      message:
        "cannot read the dependencies of app@mp: not declared by its marketplace, and its installed copy cannot be read",
    },
  );
});

test("D-PL2-22: an installed copy that is gone answers its marketplace entry alone on real disk", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "dependency-index-gone-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const locations = locationsFor("project", root);
  const marketplaceRoot = path.join(root, "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "app", source: "./plugins/app", dependencies: ["lib"] }],
    }),
  );
  const catalogManifest = path.join(
    marketplaceRoot,
    "plugins",
    "app",
    ".claude-plugin",
    "plugin.json",
  );
  await mkdir(path.dirname(catalogManifest), { recursive: true });
  await writeFile(catalogManifest, JSON.stringify({ dependencies: ["kit"] }));
  const mp: MarketplaceRecord = {
    ...marketplaceRecord("mp", {}),
    manifestPath,
    marketplaceRoot,
    plugins: {
      app: {
        ...pluginRecord({ resolvedSource: path.join(locations.pluginClonesDir, "acme-app", "0") }),
        resolvedSha: APP_SHA,
      },
    },
  };

  // act
  const read = await readInstalledRecordDeclarations({ state: stateOf(mp), locations }, mp, "app");

  // assert
  assert.deepStrictEqual(read, { ok: true, declared: [{ name: "lib", marketplace: "mp" }] });
});

test("D-PL2-07: a record with no recorded commit answers exactly what the catalog read answers", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: { resolvedSource: APP_CLONE }, lib: {} });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests({
      [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib@^2.0.0"] }),
    }),
    loadManifest: manifestLoader({
      [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["lib"] }, lib: {} }),
    }),
  };

  // act
  const installed = await readInstalledRecordDeclarations(options, mp, "app");
  const catalog = await readRecordDeclarations(options, mp, "app");

  // assert
  assert.deepStrictEqual(installed, catalog);
  assert.deepStrictEqual(installed, { ok: true, declared: [{ name: "lib", marketplace: "mp" }] });
});

test("D-PL2-06 / DLS-01: a delisted record pinned to a commit answers its readable copy as delisted", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ lib: {} });
  const reader = ownManifests({
    [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib"] }),
  });

  // act
  const read = await readInstalledRecordDeclarations(
    { state: stateOf(mp), locations: LOCATIONS, reader, loadManifest },
    mp,
    "app",
  );

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", marketplace: "mp" }],
    delisted: true,
  });
});

/**
 * A fresh scope on real disk whose `app` copy at `copyDir` (relative to the
 * scope root) holds a `.claude-plugin/plugin.json` linked to a file declaring
 * `lib@^2.0.0`. That file is the copy's `real.json`, or, with `outside`, a
 * file under the scope root that neither owning root contains.
 */
async function linkedManifestScope(
  t: TestContext,
  copyDir: (locations: ReturnType<typeof locationsFor>, marketplaceRoot: string) => string,
  target: "inside" | "outside" = "inside",
): Promise<{
  readonly locations: ReturnType<typeof locationsFor>;
  readonly marketplaceRoot: string;
  readonly copy: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "dependency-index-link-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const locations = locationsFor("project", root);
  const marketplaceRoot = path.join(root, "mp");
  const copy = copyDir(locations, marketplaceRoot);
  const linked =
    target === "inside" ? path.join(copy, "real.json") : path.join(root, "outside", "plugin.json");
  await mkdir(path.join(copy, ".claude-plugin"), { recursive: true });
  await mkdir(path.dirname(linked), { recursive: true });
  await writeFile(linked, JSON.stringify({ dependencies: ["lib@^2.0.0"] }));
  await symlink(linked, path.join(copy, ".claude-plugin", "plugin.json"));
  return { locations, marketplaceRoot, copy };
}

/** The delisted `app@mp`, its copy in the marketplace clone linking its manifest to `target`. */
async function readDelistedLinkedApp(
  t: TestContext,
  target: "inside" | "outside",
): Promise<Awaited<ReturnType<typeof readRecordDeclarations>>> {
  const { locations, marketplaceRoot, copy } = await linkedManifestScope(
    t,
    (_, mpRoot) => path.join(mpRoot, "plugins", "app"),
    target,
  );
  const mp: MarketplaceRecord = {
    ...marketplaceRecord("mp", { app: { resolvedSource: copy } }),
    marketplaceRoot,
  };
  const loadManifest = manifestLoader({ [mp.manifestPath]: manifestOf("mp", {}) });
  return readRecordDeclarations({ state: stateOf(mp), locations, loadManifest }, mp, "app");
}

/** The listed `app@mp` pinned to a commit, its clone linking its manifest to `target`. */
async function readPinnedLinkedApp(
  t: TestContext,
  target: "inside" | "outside",
): Promise<Awaited<ReturnType<typeof readInstalledRecordDeclarations>>> {
  const { locations, marketplaceRoot, copy } = await linkedManifestScope(
    t,
    (scoped) => path.join(scoped.pluginClonesDir, "acme-app", "0123456"),
    target,
  );
  const mp: MarketplaceRecord = {
    ...marketplaceRecord("mp", { app: { resolvedSource: copy, resolvedSha: APP_SHA } }),
    marketplaceRoot,
  };
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["lib"] } }),
  });
  return readInstalledRecordDeclarations(
    { state: stateOf(mp), locations, loadManifest },
    mp,
    "app",
  );
}

test("D-PL2-13: a delisted record whose copy links its manifest inside the copy reads it", async (t) => {
  // act
  const read = await readDelistedLinkedApp(t, "inside");

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
    delisted: true,
  });
});

test("D-PL2-17: a delisted record whose copy links its manifest outside its owning root fails closed as an unreadable manifest", async (t) => {
  // act
  const read = await readDelistedLinkedApp(t, "outside");

  // assert
  assert.deepStrictEqual(
    read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    APP_UNREADABLE_MANIFEST,
  );
});

test("D-PL2-13: a listed record pinned to a commit reads a manifest its copy links inside the copy, not the catalog", async (t) => {
  // act
  const read = await readPinnedLinkedApp(t, "inside");

  // assert
  assert.deepStrictEqual(read, {
    ok: true,
    declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }],
  });
});

test("D-PL2-17: a listed record pinned to a commit whose copy links its manifest outside its owning root fails closed instead of reading the catalog", async (t) => {
  // act
  const read = await readPinnedLinkedApp(t, "outside");

  // assert
  assert.deepStrictEqual(
    read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    APP_UNREADABLE_MANIFEST,
  );
});

test("D-PL2-06 / D-05-07: a marketplace manifest that fails to load fails closed as the catalog read does", async () => {
  // arrange
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: APP_CLONE, resolvedSha: APP_SHA },
  });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests({
      [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib"] }),
    }),
    loadManifest: manifestLoader({ [mp.manifestPath]: errno("EACCES") }),
  };

  // act
  const installed = await readInstalledRecordDeclarations(options, mp, "app");
  const catalog = await readRecordDeclarations(options, mp, "app");

  // assert
  assert.deepStrictEqual(
    [installed, catalog].map((read) =>
      read.ok ? undefined : { reason: read.reason, message: read.cause.message },
    ),
    [
      {
        reason: "permission denied",
        message: "cannot read the dependencies of app@mp: its marketplace manifest cannot be read",
      },
      {
        reason: "permission denied",
        message: "cannot read the dependencies of app@mp: its marketplace manifest cannot be read",
      },
    ],
  );
});

test("RCN-05: reading one record's installed declarations twice gives the same answer", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({ app: {}, lib: {} });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests({
      [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib@^2.0.0"] }),
    }),
    loadManifest,
  };

  // act
  const first = await readInstalledRecordDeclarations(options, mp, "app");
  const second = await readInstalledRecordDeclarations(options, mp, "app");

  // assert
  assert.deepStrictEqual(second, first);
});

test("D-PL2-06 / D-PL2-07: the installed detail walk reads a pinned record's copy and a path record's catalog entry", async () => {
  // arrange
  const { mp, loadManifest } = pinnedAppScope({
    app: { dependencies: ["kit"] },
    lib: { dependencies: ["kit"] },
  });
  const reader = ownManifests({
    [APP_CLONE_MANIFEST]: JSON.stringify({ dependencies: ["lib@^1.0.0"] }),
  });

  // act
  const walk = await buildInstalledScopeDeclarationDetail({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(detailEntries(walk), {
    "app@mp": [{ name: "lib", version: "^1.0.0", marketplace: "mp" }],
    "lib@mp": [{ name: "kit", marketplace: "mp" }],
  });
});

test("D-PL2-05 / D-05-07: the installed detail walk ends on the first unreadable record, before a later one", async () => {
  // arrange
  const mp = marketplaceRecord("mp", {
    app: { resolvedSource: APP_CLONE, resolvedSha: APP_SHA },
    lib: {},
  });
  const other = otherRecord();
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {}, lib: {} }),
    [other.manifestPath]: errno("ENOENT"),
  });
  const reader = ownManifests({ [APP_CLONE_MANIFEST]: "{ truncated" });

  // act
  const walk = await buildInstalledScopeDeclarationDetail({
    state: stateOf(mp, other),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(
    walk.ok
      ? undefined
      : { declarer: walk.declarer, reason: walk.reason, message: walk.cause.message },
    {
      declarer: "app@mp",
      reason: "unreadable manifest",
      message:
        "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
    },
  );
});
