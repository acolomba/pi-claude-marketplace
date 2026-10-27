import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  buildScopeSatisfactionVerdict,
  judgeFinalScope,
  releasableDependents,
  stillHeld,
  verdictAfterMoves,
  verdictAfterToggles,
  verdictWithout,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
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
  /** LOAD-02: the check's own marker on a record it disabled. */
  readonly dependencyDisabled?: boolean;
  readonly version?: string;
  /** GV-01: the release tag version a record at a tag holds. */
  readonly resolvedVersion?: string;
}

function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: seed.version ?? "1.0.0",
    ...(seed.resolvedVersion !== undefined && { resolvedVersion: seed.resolvedVersion }),
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

test("GV-01: a record at a release tag is measured by the tag's version, not its commit form", async () => {
  // arrange -- `2.3.4-0123456789ab` is a semver prerelease `^2.0.0` rejects.
  const mp = marketplaceRecord("mp", {
    app: {},
    vault: { version: "2.3.4-0123456789ab", resolvedVersion: "2.3.4" },
  });
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
      range: `${joined.slice(0, 200)}… (+4068 chars)`,
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
      range: `${joined.slice(0, 200)}… (+42 chars)`,
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

/** `app` declares `vault`; `vault` is recorded with `seed`, and `kit` declares nothing. */
function toggledScope(vault: RecordSeed): {
  readonly options: Parameters<typeof verdictAfterToggles>[0];
} {
  const mp = marketplaceRecord("mp", { app: {}, kit: {}, vault });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["vault"] }, kit: {}, vault: {} }),
  });
  return {
    options: { state: stateOf(mp), locations: LOCATIONS, reader: ownManifests(), loadManifest },
  };
}

const VAULT = { marketplace: "mp", plugin: "vault" } as const;
const KIT = { marketplace: "mp", plugin: "kit" } as const;

test("D-08 / D-21: a record the plan disables is a disabled dependency of its dependents", async () => {
  // arrange -- the check's marker on a record the config now disables reads as the user's choice
  const { options } = toggledScope({ dependencyDisabled: true });
  const verdict = await buildScopeSatisfactionVerdict(options);

  // act
  const toggled = await verdictAfterToggles(options, verdict, { enable: [KIT], disable: [VAULT] });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), []);
  assert.deepStrictEqual(unsatisfiedOf(toggled), [
    { dependent: "app@mp", dependency: "vault@mp", kind: "disabled" },
  ]);
});

test("D-08 / D-21: a record the plan enables satisfies its dependents again", async () => {
  // arrange
  const { options } = toggledScope({ enabled: false });
  const verdict = await buildScopeSatisfactionVerdict(options);

  // act
  const toggled = await verdictAfterToggles(options, verdict, { enable: [VAULT], disable: [] });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    { dependent: "app@mp", dependency: "vault@mp", kind: "disabled" },
  ]);
  assert.deepStrictEqual(unsatisfiedOf(toggled), []);
});

test("D-08: a plan that toggles nothing keeps the verdict it was planned with", async () => {
  // arrange
  const { options } = toggledScope({ enabled: false });
  const verdict = await buildScopeSatisfactionVerdict(options);

  // act
  const toggled = await verdictAfterToggles(options, verdict, { enable: [], disable: [] });

  // assert
  assert.equal(toggled, verdict);
});

test("D-05-07: a verdict whose walk failed is kept, whatever the plan toggles", async () => {
  // arrange
  const { options } = toggledScope({});
  const failed: ScopeSatisfactionVerdict = {
    ok: false,
    declarer: "app@mp",
    reason: "invalid manifest",
    cause: new Error("cannot read the dependencies of app@mp"),
  };

  // act
  const toggled = await verdictAfterToggles(options, failed, { enable: [], disable: [VAULT] });

  // assert
  assert.equal(toggled, failed);
});

const FAILED_WALK: ScopeSatisfactionVerdict = {
  ok: false,
  declarer: "app@mp",
  reason: "invalid manifest",
  cause: new Error("cannot read the dependencies of app@mp"),
};

test("APPLY1-01: releases a dependent held for an out-of-range dependency or one this verdict holds", () => {
  // arrange: `app` waits on `lib`'s range, `top` waits on the held `app`.
  const state = stateOf(marketplaceRecord("mp", { app: {}, lib: {}, top: {} }));
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [
      { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
      { dependent: "top@mp", dependency: "app@mp", kind: "disabled" },
    ],
  };

  // act
  const released = releasableDependents(verdict, state);

  // assert
  assert.deepEqual([...released], ["app@mp", "top@mp"]);
});

test("APPLY1-01: keeps a dependent held for a missing dependency or one the user disabled", () => {
  // arrange: `off` is disabled by the user, so no move brings it back.
  const state = stateOf(marketplaceRecord("mp", { app: {}, off: { enabled: false }, top: {} }));
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [
      { dependent: "app@mp", dependency: "vault@mp", kind: "missing" },
      { dependent: "top@mp", dependency: "off@mp", kind: "disabled" },
    ],
  };

  // act
  const released = releasableDependents(verdict, state);

  // assert
  assert.deepEqual([...released], []);
});

test("APPLY1-01: keeps a dependent held when the dependency it names as held is disabled by the user too", () => {
  // arrange: `off` is held by this verdict AND disabled by the user.
  const state = stateOf(marketplaceRecord("mp", { off: { enabled: false }, top: {} }));
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [
      { dependent: "off@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
      { dependent: "top@mp", dependency: "off@mp", kind: "disabled" },
    ],
  };

  // act
  const released = releasableDependents(verdict, state);

  // assert
  assert.deepEqual([...released], ["off@mp"]);
});

test("APPLY1-01: a failed walk releases nothing and keeps every released dependent held", () => {
  // arrange
  const state = stateOf(marketplaceRecord("mp", { app: {} }));
  const released = new Set(["app@mp"]);

  // act
  const releasable = releasableDependents(FAILED_WALK, state);
  const held = stillHeld(FAILED_WALK, released);
  const without = verdictWithout(FAILED_WALK, released);

  // assert
  assert.deepEqual([...releasable], []);
  assert.deepEqual([...held], ["app@mp"]);
  assert.equal(without, FAILED_WALK);
});

test("APPLY1-01: a verdict without the released dependents drops their entries and the holds they caused", () => {
  // arrange
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [
      { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
      { dependent: "top@mp", dependency: "app@mp", kind: "disabled" },
      { dependent: "solo@mp", dependency: "vault@mp", kind: "missing" },
    ],
  };

  // act
  const without = verdictWithout(verdict, new Set(["app@mp"]));
  const held = stillHeld(verdict, new Set(["app@mp", "free@mp"]));

  // assert
  assert.deepEqual(unsatisfiedOf(without), [
    { dependent: "solo@mp", dependency: "vault@mp", kind: "missing" },
  ]);
  assert.deepEqual([...held], ["app@mp"]);
});

test("APPLY1-01: the verdict after moves measures each moved record at the version it lands on", async () => {
  // arrange: `app` needs lib ^2.0.0; the move takes `lib` to 2.0.0, and a
  // move for a record the scope does not hold changes nothing.
  const mp = marketplaceRecord("mp", { app: {}, lib: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: [{ name: "lib", version: "^2.0.0" }] },
      lib: {},
    }),
  });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
  };

  // act
  const before = await verdictAfterMoves(options, { enable: [], disable: [] }, []);
  const after = await verdictAfterMoves(options, { enable: [], disable: [] }, [
    { marketplace: "mp", plugin: "lib", toVersion: "2.0.0" },
    { marketplace: "mp", plugin: "ghost", toVersion: "9.0.0" },
    { marketplace: "elsewhere", plugin: "lib", toVersion: "9.0.0" },
  ]);

  // assert
  assert.deepEqual(unsatisfiedOf(before), [
    { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
  ]);
  assert.deepEqual(unsatisfiedOf(after), []);
});

test("APPLY1-01 / GV-01: a record at a release tag is measured at the version a move lands on", async () => {
  // arrange: `lib` sits at the tag 2.0.0, which `app`'s ^2.0.0 admits; the
  // move lands it at the catalog's 3.0.0, which it does not.
  const mp = marketplaceRecord("mp", {
    app: {},
    lib: { version: "2.0.0-0123456789ab", resolvedVersion: "2.0.0" },
  });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", {
      app: { dependencies: [{ name: "lib", version: "^2.0.0" }] },
      lib: {},
    }),
  });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
  };

  // act
  const after = await verdictAfterMoves(options, { enable: [], disable: [] }, [
    { marketplace: "mp", plugin: "lib", toVersion: "3.0.0" },
  ]);

  // assert
  assert.deepEqual(unsatisfiedOf(after), [
    { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^2.0.0" },
  ]);
});

test("APPLY1-01: the final judgement reads a held-down record as disabled and holds what declares it", async () => {
  // arrange: `lib` is disabled with the marker; the load-time verdict would
  // read it as enabled (LOAD-02), the final judgement does not.
  const mp = marketplaceRecord("mp", {
    app: {},
    lib: { enabled: false, dependencyDisabled: true },
  });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["lib"] }, lib: {} }),
  });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
  };

  // act
  const load = await buildScopeSatisfactionVerdict(options);
  const final = await judgeFinalScope({
    ...options,
    installedDeclarations: () => Promise.resolve(undefined),
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(load), []);
  assert.deepStrictEqual(unsatisfiedOf(final), [
    { dependent: "app@mp", dependency: "lib@mp", kind: "disabled" },
  ]);
});

test("APPLY1-01 / D-12a: the final judgement adds what an installed copy declares to the catalog's", async () => {
  // arrange: the catalog declares `lib` with no range; the installed copy of
  // `app` declares lib ^1.0.0, which lib 2.0.0 does not meet.
  const mp = marketplaceRecord("mp", { app: {}, lib: { version: "2.0.0" } });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["lib"] }, lib: {} }),
  });

  // act
  const final = await judgeFinalScope({
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
    installedDeclarations: (_marketplace, record) =>
      Promise.resolve(
        record.version === "1.0.0"
          ? [{ name: "lib", marketplace: "mp", version: "^1.0.0" }]
          : undefined,
      ),
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(final), [
    { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range", range: "^1.0.0" },
  ]);
});

test("APPLY1-01 / D-05-07: a final judgement whose walk fails answers the walk's failure", async () => {
  // arrange
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({ [mp.manifestPath]: new Error("EACCES") });

  // act
  const final = await judgeFinalScope({
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
    installedDeclarations: () => Promise.resolve(undefined),
  });

  // assert
  assert.equal(final.ok, false);
});

test("APPLY1-01: a seeded declaration holds its dependent from the start, and the walk holds what declares it", async () => {
  // arrange: `host` declares `app`; the seed holds `app`.
  const mp = marketplaceRecord("mp", { app: {}, host: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: {}, host: { dependencies: ["app"] } }),
  });
  const seed = { dependent: "app@mp", dependency: "lib@mp", kind: "out-of-range" } as const;

  // act
  const verdict = await buildScopeSatisfactionVerdict({
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
    seeded: [seed],
  });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(verdict), [
    seed,
    { dependent: "host@mp", dependency: "app@mp", kind: "disabled" },
  ]);
});

test("APPLY1-01 / D-21: the final judgement counts a dependency the same apply installs as met", async () => {
  // arrange: `app` declares `vault`, which the scope does not record.
  const mp = marketplaceRecord("mp", { app: {} });
  const loadManifest = manifestLoader({
    [mp.manifestPath]: manifestOf("mp", { app: { dependencies: ["vault"] } }),
  });
  const options = {
    state: stateOf(mp),
    locations: LOCATIONS,
    loadManifest,
    reader: ownManifests(),
    installedDeclarations: () => Promise.resolve(undefined),
  };

  // act
  const unscheduled = await judgeFinalScope(options);
  const scheduled = await judgeFinalScope({ ...options, scheduled: new Set(["vault@mp"]) });

  // assert
  assert.deepStrictEqual(unsatisfiedOf(unscheduled), [
    { dependent: "app@mp", dependency: "vault@mp", kind: "missing" },
  ]);
  assert.deepStrictEqual(unsatisfiedOf(scheduled), []);
});
