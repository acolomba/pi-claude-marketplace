import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { buildScopeSatisfactionVerdict } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type {
  ScopeSatisfactionVerdict,
  UnsatisfiedDeclaration,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * A scope root that is never created on disk. `assertPathInside` returns
 * without complaint for a path whose components do not exist, so a path-source
 * record still derives a plugin root and every own-manifest answer comes from
 * the injected reader.
 */
const SCOPE_ROOT = path.join(tmpdir(), "dependency-verdict-scope");
const LOCATIONS = locationsFor("project", SCOPE_ROOT);

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface RecordSeed {
  readonly enabled?: boolean;
  readonly version?: string;
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: seed.version ?? "1.0.0",
    resolvedSource: path.join(SCOPE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: seed.enabled ?? true,
    provenance: "explicit",
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

function unsatisfiedOf(verdict: ScopeSatisfactionVerdict): readonly UnsatisfiedDeclaration[] {
  assert.equal(verdict.ok, true);
  return verdict.ok ? verdict.unsatisfied : [];
}

test("reports a declared dependency with no record in the scope as missing", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["vault"] } }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "app@mp", dependency: "vault@mp", kind: "missing" },
  ]);
});

test("reports nothing when every declared dependency is recorded in the same scope", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["vault"] }, vault: {} }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("reports nothing for a scope with no recorded marketplace", async () => {
  // arrange
  const state = stateOf();

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state,
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest: manifestLoader({}),
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("reports nothing for a record whose declaration read yields no dependencies", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {} }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("forwards the declaration walk's failure arm for a declarer that cannot be read", async () => {
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
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader,
    loadManifest,
  });

  // assert
  assert.equal(verdict.ok, false);
  assert.deepStrictEqual(
    verdict.ok
      ? undefined
      : { declarer: verdict.declarer, message: verdict.cause.message, cause: verdict.cause.cause },
    {
      declarer: "app@mp",
      message:
        "cannot read the dependencies of app@mp: its own manifest is present but cannot be read",
      cause: undefined,
    },
  );
});

test("holds down a declarer whose own dependency the same pass holds down", async () => {
  // arrange -- app declares helper, helper declares the absent vault.
  const mp = marketplaceRecord("mp", { app: {}, helper: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: { dependencies: ["vault"] },
    }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "helper@mp", dependency: "vault@mp", kind: "missing" },
    { dependent: "app@mp", dependency: "helper@mp", kind: "disabled" },
  ]);
});

test("orders each pass by localeCompare over the declarer keys", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { zeta: {}, alpha: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      zeta: { dependencies: ["vault"] },
      alpha: { dependencies: ["vault"] },
    }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "alpha@mp", dependency: "vault@mp", kind: "missing" },
    { dependent: "zeta@mp", dependency: "vault@mp", kind: "missing" },
  ]);
});

test("returns rather than looping when two recorded plugins declare each other", async () => {
  // arrange -- app and helper declare each other, and helper also declares the
  // absent vault, so both end the walk held down.
  const mp = marketplaceRecord("mp", { app: {}, helper: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: { dependencies: ["app", "vault"] },
    }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "helper@mp", dependency: "vault@mp", kind: "missing" },
    { dependent: "app@mp", dependency: "helper@mp", kind: "disabled" },
  ]);
});

test("returns identical results for two walks over one snapshot", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, helper: {} });
  const other = marketplaceRecord("other", { kit: {} });
  const state = stateOf(mp, other);
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: { dependencies: ["vault"] },
    }),
    [other.manifestPath]: manifestOf("other", { kit: { dependencies: ["absent@mp"] } }),
  });
  const options = { state, locations: LOCATIONS, reader: ownManifests(), loadManifest };

  // act
  const first = await buildScopeSatisfactionVerdict(options);
  const second = await buildScopeSatisfactionVerdict(options);

  // assert
  assert.deepStrictEqual(unsatisfiedOf(first), [
    { dependent: "helper@mp", dependency: "vault@mp", kind: "missing" },
    { dependent: "kit@other", dependency: "absent@mp", kind: "missing" },
    { dependent: "app@mp", dependency: "helper@mp", kind: "disabled" },
  ]);
  assert.deepStrictEqual(unsatisfiedOf(second), unsatisfiedOf(first));
});
