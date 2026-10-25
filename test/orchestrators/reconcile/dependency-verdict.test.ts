import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  buildScopeSatisfactionVerdict,
  planWithSettledVerdict,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type {
  MovedRecord,
  ScopeSatisfactionOptions,
  ScopeSatisfactionVerdict,
  TogglingPlan,
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
  /** LOAD-02: the check's own marker on a record it disabled. */
  readonly dependencyDisabled?: boolean;
  readonly version?: string;
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: seed.version ?? "1.0.0",
    resolvedSource: path.join(SCOPE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: seed.enabled ?? true,
    ...(seed.dependencyDisabled !== undefined && {
      dependencyDisabled: seed.dependencyDisabled,
    }),
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

test("D-09-05: carries the declarer's raw range text on the missing arm", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: [{ name: "vault", version: "^1.0.0" }] },
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
    { dependent: "app@mp", dependency: "vault@mp", kind: "missing", ranges: ["^1.0.0"] },
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

test("reports a declared dependency whose own record is disabled as disabled", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: { enabled: false } });
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
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "app@mp", dependency: "vault@mp", kind: "disabled" },
  ]);
});

test("reports a recorded version outside its declared range as out-of-range", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "1.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: [{ name: "vault", version: "^2.0.0" }] },
      vault: {},
    }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert -- INR-05: the carried range is the declared text, as the user
  // wrote it, while the fold still decides the comparison.
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    {
      dependent: "app@mp",
      dependency: "vault@mp",
      kind: "out-of-range",
      range: "^2.0.0",
    },
  ]);
});

test("reports nothing when the recorded version satisfies the declared range", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "2.3.4" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: [{ name: "vault", version: "^2.0.0" }] },
      vault: {},
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
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("reports nothing for a declaration whose constraints are all unconstrained", async () => {
  // arrange -- two spellings of "any version"; the fold is not the literal
  // wildcard, so only a canonicalizing test reads it as no constraint.
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "1.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: [
          { name: "vault", version: "*" },
          { name: "vault", version: "x" },
        ],
      },
      vault: {},
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
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("INR-05: two declarations of one dependency the recorded version fails report both declared ranges", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "2.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: [
          { name: "vault", version: ">=1.0.0" },
          { name: "vault", version: "<1.5.0" },
        ],
      },
      vault: {},
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
    {
      dependent: "app@mp",
      dependency: "vault@mp",
      kind: "out-of-range",
      range: ">=1.0.0, <1.5.0",
    },
  ]);
});

test("reports out-of-range rather than throwing when the declared ranges intersect to nothing", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "2.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: [
          { name: "vault", version: ">=2.0.0" },
          { name: "vault", version: "<1.0.0" },
        ],
      },
      vault: {},
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
    {
      dependent: "app@mp",
      dependency: "vault@mp",
      kind: "out-of-range",
      range: ">=2.0.0, <1.0.0",
    },
  ]);
});

test("reports out-of-range rather than unconstrained when the fold trips an input cap", async () => {
  // arrange -- 70 declarations of 59 characters pass the 4096-character total
  // input cap, which the fold refuses BEFORE parsing anything.
  const declared = ">=1.0.0 <9.9.9 >=1.0.1 <9.9.8 >=1.0.2 <9.9.7 >=1.0.3 <9.9.6";
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "1.0.5" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: Array.from({ length: 70 }, () => ({ name: "vault", version: declared })),
      },
      vault: {},
    }),
  });

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest,
  });

  // assert -- a cap trip must never read as "no constraint" (T-06-10), and the
  // joined declared ranges are bounded once (T-06-05).
  const joined = Array.from({ length: 70 }, () => declared).join(", ");
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    {
      dependent: "app@mp",
      dependency: "vault@mp",
      kind: "out-of-range",
      range: `${joined.slice(0, 200)}... (+4068 chars)`,
    },
  ]);
});

test("INR-05 / T-06-05: declared ranges too long to render are bounded once", async () => {
  // arrange -- four 59-character declarations join to 242 characters and fold
  // to a range the recorded version fails.
  const declared = ">=1.0.0 <9.9.9 >=1.0.1 <9.9.8 >=1.0.2 <9.9.7 >=1.0.3 <9.9.6";
  const mp = marketplaceRecord("mp", { app: {}, vault: { version: "1.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: {
        dependencies: Array.from({ length: 4 }, () => ({ name: "vault", version: declared })),
      },
      vault: {},
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
  const joined = Array.from({ length: 4 }, () => declared).join(", ");
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    {
      dependent: "app@mp",
      dependency: "vault@mp",
      kind: "out-of-range",
      range: `${joined.slice(0, 200)}... (+42 chars)`,
    },
  ]);
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

test("reads a record this check itself disabled as available to its dependents", async () => {
  // arrange -- a previous pass held helper down; vault is back, so this pass
  // lifts helper. app must not be held by the hold that is being lifted, or a
  // chain would come back one level per reload while it went down in one.
  const mp = marketplaceRecord("mp", {
    app: {},
    helper: { enabled: false, dependencyDisabled: true },
    vault: {},
  });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: ["helper"] },
      helper: { dependencies: ["vault"] },
      vault: {},
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
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
});

test("still holds a dependent whose marked dependency is itself still unsatisfied", async () => {
  // arrange -- the same shape with vault removed. The optimism above must not
  // survive the walk: helper is re-held on this pass, and app with it.
  const mp = marketplaceRecord("mp", {
    app: {},
    helper: { enabled: false, dependencyDisabled: true },
  });
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

// The cycle case fails by HANGING rather than by asserting false, so it states
// its own bound: a regression in the fixpoint's exit must fail the run in
// bounded time instead of stalling it until the runner's global timeout.
test(
  "returns rather than looping when two recorded plugins declare each other",
  { timeout: 5_000 },
  async () => {
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
  },
);

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

/** A plan that remembers the verdict it was planned with. */
interface FakePlan extends TogglingPlan {
  readonly verdict: ScopeSatisfactionVerdict;
}

/**
 * Plans the given toggles from every verdict, and moves what `rounds` names
 * for each successive round. `replanned` and `planned` record the calls.
 */
function fakePlanning(
  seed: {
    readonly enable?: TogglingPlan["pluginsToEnable"];
    readonly disable?: TogglingPlan["pluginsToDisable"];
    readonly rounds?: readonly (readonly MovedRecord[])[];
  } = {},
): {
  readonly planning: Parameters<typeof planWithSettledVerdict<FakePlan>>[1];
  readonly replanned: ScopeSatisfactionVerdict[];
  readonly planned: FakePlan[];
} {
  const replanned: ScopeSatisfactionVerdict[] = [];
  const planned: FakePlan[] = [];
  return {
    replanned,
    planned,
    planning: {
      replan: (verdict) => {
        replanned.push(verdict);
        return {
          pluginsToEnable: seed.enable ?? [],
          pluginsToDisable: seed.disable ?? [],
          verdict,
        };
      },
      planMoves: (plan) => {
        const moves = seed.rounds?.[planned.length] ?? [];
        planned.push(plan);
        return Promise.resolve(moves);
      },
    },
  };
}

/** `app` declares `vault`; `vault` is recorded with `seed`, and `kit` declares nothing. */
function toggledScope(vault: RecordSeed): ScopeSatisfactionOptions {
  const mp = marketplaceRecord("mp", { app: {}, kit: {}, vault });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["vault"] }, kit: {}, vault: {} }),
  });
  return { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest };
}

const VAULT = { marketplace: "mp", plugin: "vault" } as const;
const KIT = { marketplace: "mp", plugin: "kit" } as const;

test("D-08 / D-21: a record the plan disables is a disabled dependency of its dependents", async () => {
  // arrange -- the check's marker on a record the config now disables reads as the user's choice
  const options = toggledScope({ dependencyDisabled: true });
  const { planning, replanned, planned } = fakePlanning({ enable: [KIT], disable: [VAULT] });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.deepStrictEqual(replanned.map(unsatisfiedOf), [
    [],
    [{ dependent: "app@mp", dependency: "vault@mp", kind: "disabled" }],
  ]);
  assert.equal(settled.verdict, replanned[1]);
  assert.equal(settled.plan.verdict, settled.verdict);
  assert.deepStrictEqual(planned, []);
});

test("D-08 / D-21: a record the plan enables satisfies its dependents again", async () => {
  // arrange
  const options = toggledScope({ enabled: false });
  const { planning, replanned } = fakePlanning({ enable: [VAULT] });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.deepStrictEqual(replanned.map(unsatisfiedOf), [
    [{ dependent: "app@mp", dependency: "vault@mp", kind: "disabled" }],
    [],
  ]);
  assert.equal(settled.verdict, replanned[1]);
});

test("D-08: a plan that toggles nothing keeps the verdict and plan it was planned with", async () => {
  // arrange
  const options = toggledScope({ enabled: false });
  const { planning, replanned } = fakePlanning();

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.equal(replanned.length, 1);
  assert.equal(settled.verdict, replanned[0]);
  assert.equal(settled.plan.verdict, settled.verdict);
});

/**
 * `app` declares `vault@^2.0.0` and `lib@^2.0.0`, `kit` declares `app` with no
 * range, `tool` declares `lib@^1.0.0`, and every record is at 1.0.0. The
 * manifest seam answers `failAfter` walks and then throws.
 */
function rangedScope(failAfter = Number.POSITIVE_INFINITY): ScopeSatisfactionOptions {
  const mp = marketplaceRecord("mp", { app: {}, kit: {}, lib: {}, tool: {}, vault: {} });
  const manifest = manifestOf("mp", {
    app: {
      dependencies: [
        { name: "vault", version: "^2.0.0" },
        { name: "lib", version: "^2.0.0" },
      ],
    },
    kit: { dependencies: ["app"] },
    lib: {},
    tool: { dependencies: [{ name: "lib", version: "^1.0.0" }] },
    vault: {},
  });
  const records = Object.keys(mp.plugins).length;
  let loads = 0;
  return {
    state: stateOf(mp),
    locations: LOCATIONS,
    reader: ownManifests(),
    loadManifest: (manifestPath) => {
      assert.equal(manifestPath, mp.manifestPath);
      const failed = Math.floor(loads / records) >= failAfter;
      loads += 1;
      return failed
        ? Promise.reject(new Error("EACCES: permission denied"))
        : Promise.resolve(manifest);
    },
  };
}

const APP_OUT_OF_RANGE: readonly UnsatisfiedDeclaration[] = [
  { dependent: "app@mp", dependency: "vault@mp", kind: "out-of-range", range: "^2.0.0" },
  { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
  { dependent: "kit@mp", dependency: "app@mp", kind: "disabled" },
];

function moved(plugin: string, toVersion: string): MovedRecord {
  return { marketplace: "mp", plugin, toVersion };
}

test("D-05-07: a walk that fails is kept, whatever the plan toggles, and plans no move", async () => {
  // arrange
  const options = rangedScope(0);
  const { planning, replanned, planned } = fakePlanning({ disable: [VAULT] });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.equal(settled.verdict.ok, false);
  assert.equal(replanned.length, 1);
  assert.deepStrictEqual(planned, []);
});

test("D-12 / D-19: a planned move of each dependency into its range releases the dependent and its own dependents", async () => {
  // arrange
  const options = rangedScope();
  const { planning, replanned, planned } = fakePlanning({
    rounds: [[moved("vault", "2.0.0"), moved("lib", "2.0.0")]],
  });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.deepStrictEqual(
    planned.map((plan) => unsatisfiedOf(plan.verdict)),
    [APP_OUT_OF_RANGE],
  );
  assert.deepStrictEqual(unsatisfiedOf(settled.verdict), []);
  assert.equal(settled.plan.verdict, settled.verdict);
  assert.equal(replanned.length, 2);
});

test("D-12: a move only releases, so a plugin it takes out of range is not held down", async () => {
  // arrange -- the move of `lib` to 2.0.0 leaves `tool`'s `^1.0.0` unmet
  const options = rangedScope();
  const { planning } = fakePlanning({
    rounds: [[moved("vault", "2.0.0"), moved("lib", "2.0.0")]],
  });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.equal(
    unsatisfiedOf(settled.verdict).some((entry) => entry.dependent === "tool@mp"),
    false,
  );
});

test("D-12: the plan settles when a round releases nothing, with only the ranges still unmet", async () => {
  // arrange
  const options = rangedScope();
  const { planning, planned } = fakePlanning({ rounds: [[moved("vault", "2.0.0")]] });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.deepStrictEqual(unsatisfiedOf(settled.verdict), [
    { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
    { dependent: "kit@mp", dependency: "app@mp", kind: "disabled" },
  ]);
  assert.equal(settled.plan.verdict, settled.verdict);
  assert.equal(planned.length, 1);
});

test("D-12: the plan settles on the first verdict when no move is planned", async () => {
  // arrange
  const options = rangedScope();
  const { planning, replanned, planned } = fakePlanning();

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.deepStrictEqual(unsatisfiedOf(settled.verdict), APP_OUT_OF_RANGE);
  assert.equal(settled.verdict, replanned[0]);
  assert.equal(planned.length, 1);
});

test("D-05-07: a walk that fails once the moves land settles the plan on the failure", async () => {
  // arrange
  const options = rangedScope(1);
  const { planning, planned } = fakePlanning({ rounds: [[moved("vault", "2.0.0")]] });

  // act
  const settled = await planWithSettledVerdict(options, planning);

  // assert
  assert.equal(settled.verdict.ok, false);
  assert.equal(settled.plan.verdict, settled.verdict);
  assert.equal(planned.length, 1);
});
