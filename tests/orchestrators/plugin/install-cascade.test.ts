import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { cascadeUnstagePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { probeDependencyTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import {
  formatClosureFailure,
  formatConstraintFailure,
  resolveMemberConstraints,
  runInstallCascade,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import { runInstallLedger } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { retryTree } from "./scope-tree-inventory.ts";

import type { DeclaredDependency } from "../../../extensions/pi-claude-marketplace/domain/dependencies.ts";
import type {
  ClosureLookup,
  ClosureLookupResult,
  ClosureMember,
  DependencyClosureResult,
} from "../../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";
import type { DeviceFlowHttp } from "../../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  DependencyTagListingSeam,
  DependencyTagProbeOptions,
  DependencyTagProbeResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import type {
  CascadeConstraintFailure,
  CascadeTagProbe,
  InstallCascadeLedgerSeam,
  InstallCascadeOptions,
  InstallCascadeResult,
  ResolvedCascadeMember,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type {
  InstallLedgerOptions,
  InstallLedgerSummary,
  InstallLedgerTransaction,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { RemoteTag } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const MARKETPLACE = "marketplace";

/**
 * The repository a git-sourced fixture plugin's release tags live on. One URL
 * for every such plugin, so two constrained members share a listing and the
 * per-URL memo is exercised by the same fixture that exercises the query.
 */
const GIT_SOURCE_URL = "https://example.com/org/repo";

/** The commit a selected release tag resolves to. */
const PINNED_OID = "0123456789abcdef0123456789abcdef01234567";

function notificationContext(): NotificationContext {
  return { ui: { notify: () => undefined } };
}

/** A synthetic dependency graph keyed by `<plugin>@<marketplace>`. */
type Graph = Readonly<Record<string, readonly DeclaredDependency[]>>;

function catalog(graph: Graph): ClosureLookup {
  return (subject) => {
    const dependencies = graph[subject.key];
    return Promise.resolve<ClosureLookupResult>(
      dependencies === undefined ? { kind: "absent" } : { kind: "found", dependencies },
    );
  };
}

/**
 * Seed a path-source marketplace declaring each named plugin, with one empty
 * plugin tree per name, and return the loaded state snapshot. Every plugin is
 * component-free: the cascade's contract is about ORDER and RECORDS, and a
 * component set would only add bridge surface to the same assertion.
 */
async function seedMarketplace(
  cwd: string,
  pluginNames: readonly string[],
  preinstalled: readonly string[] = [],
  gitSourced: readonly string[] = [],
): Promise<ExtensionState> {
  const marketplaceRoot = path.join(cwd, MARKETPLACE);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });

  for (const name of pluginNames) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", name);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name, version: "0.0.1" }),
    );
  }

  await writeFile(
    manifestPath,
    JSON.stringify({
      name: MARKETPLACE,
      plugins: pluginNames.map((name) => ({
        name,
        // The ENTRY decides where a constrained member's tags are read from; a
        // dependency declaration can name a version and never a source.
        source: gitSourced.includes(name) ? GIT_SOURCE_URL : `./plugins/${name}`,
      })),
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      [MARKETPLACE]: {
        name: MARKETPLACE,
        scope: "project",
        source: pathSource(`./${MARKETPLACE}`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: Object.fromEntries(
          preinstalled.map((name) => [
            name,
            {
              version: "0.0.1",
              resolvedSource: path.join(marketplaceRoot, "plugins", name),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], hooks: [], mcpServers: [] },
              enabled: true,
              installedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        ),
      },
    },
  });

  return loadState(locations.extensionRoot);
}

/**
 * The whole observable footprint of a cascade run: the install records of the
 * snapshot the caller handed in, plus BOTH scope roots' on-disk inventories. A
 * rollback proof compares this one value before and after -- asserting only the
 * returned arm would pass while proving nothing about what stayed on disk.
 */
async function twoScopeFootprint(cwd: string, state: ExtensionState): Promise<unknown> {
  return {
    records: Object.fromEntries(
      Object.entries(state.marketplaces).map(([name, record]) => [
        name,
        Object.keys(record.plugins).sort(),
      ]),
    ),
    project: await retryTree(locationsFor("project", cwd).scopeRoot),
    user: await retryTree(locationsFor("user", cwd).scopeRoot),
  };
}

/** A ledger summary for a member no fake seam actually materialized. */
function stubSummary(
  locations: ScopedLocations,
  cwd: string,
  member: ClosureMember,
): InstallLedgerSummary {
  return {
    locations,
    cwd,
    marketplace: member.marketplace,
    plugin: member.name,
    resolved: {
      componentPaths: { agents: [], commands: [], skills: [] },
      defaultEnabled: true,
      installable: true,
      mcpServers: {},
      name: member.name,
      notes: [],
      pluginRoot: path.join(cwd, "unmaterialized"),
      state: "installable",
      supported: [],
      unsupported: [],
    },
    version: "0.0.1",
    pluginDataDir: path.join(cwd, "unmaterialized"),
    frontmatterDegradations: [],
    stagedSkillNames: [],
    stagedCommandNames: [],
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    bridgeWarnings: [],
    discoveryWarnings: [],
    agentForeignFailures: [],
  };
}

/**
 * The per-member ledger options a cascade run needs, bound to one scope.
 *
 * The pin spread mirrors the production builder: the caller's options builder
 * is where a constraint's selected commit enters that member's install, so a
 * case observing `sourcePinOverride` here is observing the real delivery path
 * rather than the cascade's internal bookkeeping.
 */
function ledgerOptionsFor(cwd: string): (member: ResolvedCascadeMember) => InstallLedgerOptions {
  return (member) => ({
    ctx: notificationContext(),
    scope: "project",
    cwd,
    marketplace: member.marketplace,
    plugin: member.name,
    removalOps: createRemovalOps(),
    ...(member.pinnedOid !== undefined && { sourcePinOverride: member.pinnedOid }),
  });
}

/** A tag probe that records every query it was handed and answers the same way. */
function tagProbeAnswering(
  answer: DependencyTagProbeResult,
  seen: DependencyTagProbeOptions[],
): CascadeTagProbe {
  return (options) => {
    seen.push(options);
    return Promise.resolve(answer);
  };
}

/**
 * A ledger seam that REPORTS an install without performing one, recording the
 * options each member was materialized with.
 */
function recordingLedgerSeam(
  cwd: string,
  locations: ScopedLocations,
  seen: InstallLedgerOptions[],
): InstallCascadeLedgerSeam {
  return {
    runInstallLedger: (_state, _locations, options) => {
      seen.push(options);
      return Promise.resolve({
        kind: "installed",
        summary: stubSummary(locations, cwd, {
          key: `${options.plugin}@${options.marketplace}`,
          name: options.plugin,
          marketplace: options.marketplace,
          requiredBy: undefined,
          ranges: [],
        }),
      });
    },
    cascadeUnstagePlugin,
  };
}

/** A listing seam advertising a fixed tag set and recording every query URL. */
function advertising(tags: readonly RemoteTag[], queried: string[]): DependencyTagListingSeam {
  return {
    listRemoteTags(options) {
      queried.push(options.url);
      return Promise.resolve([...tags]);
    },
  };
}

test("RESV-01 a cascade records the dependency and the requesting plugin, dependency first", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-linear-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    Object.keys(state.marketplaces[MARKETPLACE]?.plugins ?? {}),
    ["bar", "foo"],
    "the dependency's record is written before the requesting plugin's",
  );
  assert.deepStrictEqual(
    cascade.members.map((member) => member.key),
    [`bar@${MARKETPLACE}`, `foo@${MARKETPLACE}`],
  );
  assert.strictEqual(cascade.root.plugin, "foo");
});

for (const { label, failure, expected } of [
  {
    label: "a cycle",
    failure: { ok: false, reason: "cycle", chain: ["a@mp", "b@mp", "a@mp"] },
    expected: "Dependency cycle: a@mp -> b@mp -> a@mp.",
  },
  {
    label: "an unadded marketplace",
    failure: {
      ok: false,
      reason: "marketplace-not-added",
      key: "helper@other",
      marketplace: "other",
      requiredBy: "root@mp",
    },
    expected: 'Dependency "helper@other" requires marketplace "other", which is not added.',
  },
  {
    label: "a dependency no marketplace declares",
    failure: { ok: false, reason: "not-found", key: "ghost@mp", requiredBy: "root@mp" },
    expected: 'Dependency "ghost@mp" is not declared by its marketplace.',
  },
  {
    label: "an unusable declaration",
    failure: {
      ok: false,
      reason: "unusable-declaration",
      key: "root@mp",
      detail: "dependencies.0: Invalid input",
    },
    expected: 'Plugin "root@mp" declares an unusable dependency (dependencies.0: Invalid input).',
  },
] satisfies readonly {
  label: string;
  failure: Extract<DependencyClosureResult, { readonly ok: false }>;
  expected: string;
}[]) {
  test(`RESV-06 the cause text for ${label} names only allowlisted tokens`, () => {
    // act
    const cause = formatClosureFailure(failure);

    // assert
    assert.strictEqual(cause, expected);
  });
}

test("RESV-06 a closure failure materializes nothing and returns the failure verbatim", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-closure-");
  const state = await seedMarketplace(environment.cwd, ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "ghost" }] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "closure-failed",
    failure: {
      ok: false,
      reason: "not-found",
      key: `ghost@${MARKETPLACE}`,
      requiredBy: `foo@${MARKETPLACE}`,
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("a member whose marketplace is absent reports the marketplace, not a plugin failure", async (t) => {
  // arrange: an empty snapshot, so the requested plugin's own ledger misses its
  // marketplace. The closure exempts the root from the marketplace guard, which
  // is what routes the miss here rather than into a closure failure.
  const environment = await createHermeticEnvironment(t, "install-cascade-mp-absent-");
  const state: ExtensionState = { schemaVersion: 2, marketplaces: {} };
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({}),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set(),
  });

  // assert
  assert.deepStrictEqual(cascade, { kind: "marketplace-absent" });
  assert.deepStrictEqual(state, { schemaVersion: 2, marketplaces: {} });
});

test("RESV-06 / D-03-07 a failing member restores the whole two-scope footprint", async (t) => {
  // arrange: the requesting plugin is ALREADY recorded, so its own ledger
  // throws after its dependency has materialized.
  const environment = await createHermeticEnvironment(t, "install-cascade-rollback-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  const options: InstallCascadeOptions = {
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
  };

  // act
  const cascade = await runInstallCascade(options);

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.key, `foo@${MARKETPLACE}`);
  assert.strictEqual(
    cascade.error.message,
    `Plugin "foo" is already installed in marketplace "${MARKETPLACE}".`,
  );
  assert.deepStrictEqual(cascade.rollbackPartials, []);
  assert.deepStrictEqual(
    await twoScopeFootprint(environment.cwd, state),
    before,
    "the dependency this run installed is unwound and the pre-existing record is untouched",
  );

  // NFR-3: replaying the same failing command reaches the same arm and the same
  // footprint.
  const replay = await runInstallCascade(options);
  assert.strictEqual(replay.kind, "member-failed");
  assert.strictEqual(replay.key, `foo@${MARKETPLACE}`);
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("RESV-06 / D-03-07 three members whose LAST fails leave no trace of the first two", async (t) => {
  // arrange: the requesting plugin is already recorded, so it throws only
  // after BOTH of its dependencies have materialized.
  const environment = await createHermeticEnvironment(t, "install-cascade-three-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }, { name: "baz" }],
      [`bar@${MARKETPLACE}`]: [],
      [`baz@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.key, `foo@${MARKETPLACE}`);
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("D-03-07 a member installed BEFORE the run survives a later member's failure", async (t) => {
  // arrange: `bar` predates the run and `baz` is declared but absent from the
  // manifest, so its ledger throws while `bar` is only ever skipped.
  const environment = await createHermeticEnvironment(t, "install-cascade-predates-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }, { name: "baz" }],
      [`baz@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.key, `baz@${MARKETPLACE}`);
  assert.deepStrictEqual(
    await twoScopeFootprint(environment.cwd, state),
    before,
    "a skipped member never became a phase, so no undo could reach it",
  );
});

test("RESV-06 an undo that itself fails surfaces a rollback partial without throwing", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-undo-fault-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger,
    cascadeUnstagePlugin: (plugin, marketplace, memberLocations, installed) =>
      plugin === "bar"
        ? Promise.reject(new Error("unstage denied"))
        : cascadeUnstagePlugin(plugin, marketplace, memberLocations, installed),
  };

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam,
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.deepStrictEqual(
    cascade.rollbackPartials.map((partial) => ({ phase: partial.phase, msg: partial.msg })),
    [{ phase: `bar@${MARKETPLACE}`, msg: "unstage denied" }],
  );
});

for (const { label, materializedMarketplace } of [
  { label: "wrote no record", materializedMarketplace: MARKETPLACE },
  { label: "names a marketplace the snapshot does not record", materializedMarketplace: "ghost" },
]) {
  test(`an undo whose member ${label} removes nothing and does not throw`, async (t) => {
    // arrange: a seam that REPORTS an install without performing one, so the
    // undo runs against a snapshot carrying nothing to remove.
    const environment = await createHermeticEnvironment(t, "install-cascade-no-record-");
    const state = await seedMarketplace(environment.cwd, ["foo"]);
    const locations = locationsFor("project", environment.cwd);
    const unstaged: string[] = [];
    const seam: InstallCascadeLedgerSeam = {
      runInstallLedger: (_state, _locations, options) =>
        options.plugin === "foo"
          ? Promise.reject(new Error("root ledger refused"))
          : Promise.resolve({
              kind: "installed",
              summary: stubSummary(locations, environment.cwd, {
                key: `${options.plugin}@${options.marketplace}`,
                name: options.plugin,
                marketplace: options.marketplace,
                requiredBy: undefined,
                ranges: [],
              }),
            }),
      cascadeUnstagePlugin: (plugin, marketplace, memberLocations, installed) => {
        unstaged.push(`${plugin}@${marketplace}`);
        return cascadeUnstagePlugin(plugin, marketplace, memberLocations, installed);
      },
    };

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({
        [`foo@${MARKETPLACE}`]: [{ name: "bar", marketplace: materializedMarketplace }],
        [`bar@${materializedMarketplace}`]: [],
      }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set(),
      knownMarketplaces: new Set([MARKETPLACE, "ghost"]),
      seam,
    });

    // assert
    assert.strictEqual(cascade.kind, "member-failed");
    assert.strictEqual(cascade.error.message, "root ledger refused");
    assert.deepStrictEqual(unstaged, [], "an unstage is never attempted without a record");
  });
}

test("a scheduler that reports success without running the phases is refused", async (t) => {
  // arrange: the closure always ends at the root, so a clean run always records
  // it. This proves the owner does not hand back a half-built installed arm.
  const environment = await createHermeticEnvironment(t, "install-cascade-no-root-");
  const state = await seedMarketplace(environment.cwd, ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const transaction: InstallLedgerTransaction = {
    runPhases: () => Promise.resolve({ ok: true, rollbackPartials: [], leaks: [] }),
  };

  // act, assert
  await assert.rejects(
    runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({ [`foo@${MARKETPLACE}`]: [] }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set(),
      knownMarketplaces: new Set([MARKETPLACE]),
      transaction,
    }),
    /reported success without materializing the root plugin/,
  );
});

test("a scheduler reporting failure with no error names the root and a generic cause", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-bare-failure-");
  const state = await seedMarketplace(environment.cwd, ["foo"]);
  const locations = locationsFor("project", environment.cwd);
  const transaction: InstallLedgerTransaction = {
    runPhases: () => Promise.resolve({ ok: false, rollbackPartials: [], leaks: [] }),
  };

  // act
  const cascade: InstallCascadeResult = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    transaction,
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.key, `foo@${MARKETPLACE}`);
  assert.strictEqual(cascade.error.message, "Install cascade failed.");
});

for (const { label, declared } of [
  { label: "no version at all", declared: undefined },
  { label: "the bare wildcard", declared: "*" },
  { label: "an x-range", declared: "x" },
  { label: "a floor every version clears", declared: ">=0.0.0" },
]) {
  test(`RESV-03 a dependency declared with ${label} makes no tag query`, async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "install-cascade-wildcard-");
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
    const locations = locationsFor("project", environment.cwd);
    const seen: DependencyTagProbeOptions[] = [];

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({
        [`foo@${MARKETPLACE}`]: [
          { name: "bar", ...(declared !== undefined && { version: declared }) },
        ],
        [`bar@${MARKETPLACE}`]: [],
      }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set(),
      knownMarketplaces: new Set([MARKETPLACE]),
      seam: recordingLedgerSeam(environment.cwd, locations, []),
      tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    });

    // assert
    assert.strictEqual(cascade.kind, "installed");
    assert.deepStrictEqual(seen, [], "an unconstrained dependency must stay offline");
  });
}

test("RESV-03 two declarations of one dependency intersect before anything is queried", async (t) => {
  // arrange: a diamond, so `shared` carries one range per declaring branch.
  const environment = await createHermeticEnvironment(t, "install-cascade-intersect-");
  const state = await seedMarketplace(
    environment.cwd,
    ["left", "right", "root", "shared"],
    [],
    ["shared"],
  );
  const locations = locationsFor("project", environment.cwd);
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `root@${MARKETPLACE}`,
    lookup: catalog({
      [`root@${MARKETPLACE}`]: [{ name: "left" }, { name: "right" }],
      [`left@${MARKETPLACE}`]: [{ name: "shared", version: "^1.0.0" }],
      [`right@${MARKETPLACE}`]: [{ name: "shared", version: ">=1.2.0" }],
      [`shared@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: tagProbeAnswering(
      { kind: "pinned", tag: "shared--v1.3.0", oid: PINNED_OID, version: "1.3.0" },
      seen,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    seen.map((query) => ({ pluginName: query.pluginName, range: query.range })),
    [{ pluginName: "shared", range: ">=1.0.0 <2.0.0-0 >=1.2.0" }],
    "one query, carrying the intersection rather than either declaration",
  );
});

for (const { label, declared, expected } of [
  {
    label: "a contradictory pair fails as a conflict",
    declared: [
      { name: "bar", version: "^1.0.0" },
      { name: "bar", version: "^2.0.0" },
    ],
    expected: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: `bar@${MARKETPLACE}`,
      range: "^1.0.0 ^2.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
  },
  {
    label: "an unparseable declaration fails as invalid",
    declared: [{ name: "bar", version: "not-a-range" }],
    expected: {
      kind: "range-invalid",
      key: `bar@${MARKETPLACE}`,
      range: "not-a-range",
      detail: "input 1 of 1 is not a valid version range",
    },
  },
] satisfies readonly {
  label: string;
  declared: readonly DeclaredDependency[];
  expected: CascadeConstraintFailure;
}[]) {
  test(`RESV-03 ${label}, and no tag query is made`, async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "install-cascade-bad-range-");
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
    const locations = locationsFor("project", environment.cwd);
    const before = await twoScopeFootprint(environment.cwd, state);
    const seen: DependencyTagProbeOptions[] = [];

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({ [`foo@${MARKETPLACE}`]: declared, [`bar@${MARKETPLACE}`]: [] }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set(),
      knownMarketplaces: new Set([MARKETPLACE]),
      tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    });

    // assert
    assert.deepStrictEqual(cascade, { kind: "constraint-failed", failure: expected });
    assert.deepStrictEqual(seen, []);
    assert.deepStrictEqual(
      await twoScopeFootprint(environment.cwd, state),
      before,
      "the verdict precedes the phase array, so there is nothing to roll back",
    );
  });
}

test("T-03-19 a declaration past the input-size cap fails as too complex with no query", async (t) => {
  // arrange: a union wide enough to exceed the 4096-character input cap, which
  // the algebra measures before it parses anything.
  const environment = await createHermeticEnvironment(t, "install-cascade-too-complex-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const wide = Array.from({ length: 600 }, (_, index) => `1.0.${index}`).join("||");
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: wide }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
  });

  // assert
  assert.strictEqual(cascade.kind, "constraint-failed");
  assert.strictEqual(cascade.failure.kind, "range-too-complex");
  assert.strictEqual(
    cascade.failure.detail,
    `total input ${wide.length.toString()} characters exceeds the 4096 character cap`,
  );
  assert.strictEqual(
    cascade.failure.range,
    `${wide.slice(0, 200)}... (+${(wide.length - 200).toString()} chars)`,
    "the reported constraint is bounded, so a wide range cannot flood a row",
  );
  assert.deepStrictEqual(seen, []);
});

test("RESV-03 a satisfiable range pins the member and the pin reaches its ledger options", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-pin-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^1.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, materialized),
    tagProbe: tagProbeAnswering(
      { kind: "pinned", tag: "bar--v1.4.0", oid: PINNED_OID, version: "1.4.0" },
      seen,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    seen.map((query) => ({ pluginName: query.pluginName, source: query.source.kind })),
    [{ pluginName: "bar", source: "url" }],
    "the query addresses the source the marketplace entry names",
  );
  assert.deepStrictEqual(
    materialized.map((options) => [options.plugin, options.sourcePinOverride]),
    [
      ["bar", PINNED_OID],
      ["foo", undefined],
    ],
    "the constrained member installs the selected commit; the unconstrained root does not",
  );
});

test("RESV-03 one listing serves two members whose sources share a repository", async (t) => {
  // arrange: the REAL probe behind a counting listing seam, so the memo the
  // cascade threads is the thing under test rather than a stand-in for it.
  const environment = await createHermeticEnvironment(t, "install-cascade-memo-");
  const state = await seedMarketplace(
    environment.cwd,
    ["alpha", "beta", "foo"],
    [],
    ["alpha", "beta"],
  );
  const locations = locationsFor("project", environment.cwd);
  const queried: string[] = [];
  const seam = advertising(
    [
      { name: "alpha--v1.1.0", oid: `${PINNED_OID.slice(0, 39)}a` },
      { name: "beta--v1.2.0", oid: `${PINNED_OID.slice(0, 39)}b` },
    ],
    queried,
  );

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [
        { name: "alpha", version: "^1.0.0" },
        { name: "beta", version: "^1.0.0" },
      ],
      [`alpha@${MARKETPLACE}`]: [],
      [`beta@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: (options) => probeDependencyTags({ ...options, seam }),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    queried,
    [`${GIT_SOURCE_URL}.git`],
    "the second member is served from the run's own memo, not from a second listing",
  );
});

test("RESV-03 a no-matching-tag answer fails the cascade with the constraint named", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-no-tag-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^3.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: ">=3.0.0 <4.0.0-0" }, []),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "no-matching-tag",
      key: `bar@${MARKETPLACE}`,
      range: ">=3.0.0 <4.0.0-0",
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("RESV-03 a listing failure surfaces as its own arm carrying the classified cause", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-listing-fail-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const cause = new Error("getaddrinfo ENOTFOUND example.com");

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^1.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    tagProbe: tagProbeAnswering(
      { kind: "tag-listing-failed", cause, classification: "network unreachable" },
      [],
    ),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "tag-listing-failed",
      key: `bar@${MARKETPLACE}`,
      range: ">=1.0.0 <2.0.0-0",
      cause,
      classification: "network unreachable",
    },
  });
});

for (const { label, pluginNames, gitSourced, knownMarketplaces, dependencyMarketplace } of [
  {
    label: "a source the snapshot records no marketplace for",
    pluginNames: ["foo"],
    gitSourced: [],
    knownMarketplaces: [MARKETPLACE, "ghost"],
    dependencyMarketplace: "ghost",
  },
  {
    label: "a plugin its own marketplace manifest does not declare",
    pluginNames: ["foo"],
    gitSourced: [],
    knownMarketplaces: [MARKETPLACE],
    dependencyMarketplace: MARKETPLACE,
  },
  {
    label: "a source that is not git-backed and so carries no release tags",
    pluginNames: ["bar", "foo"],
    gitSourced: [],
    knownMarketplaces: [MARKETPLACE],
    dependencyMarketplace: MARKETPLACE,
  },
]) {
  test(`RESV-03 a constrained dependency resolving to ${label} reports no matching tag`, async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "install-cascade-no-source-");
    const state = await seedMarketplace(environment.cwd, pluginNames, [], gitSourced);
    const locations = locationsFor("project", environment.cwd);
    const seen: DependencyTagProbeOptions[] = [];
    const dependencyKey = `bar@${dependencyMarketplace}`;

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({
        [`foo@${MARKETPLACE}`]: [
          { name: "bar", marketplace: dependencyMarketplace, version: "^1.0.0" },
        ],
        [dependencyKey]: [],
      }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set(),
      knownMarketplaces: new Set(knownMarketplaces),
      tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    });

    // assert: D-03-09 -- one no-match answer, with no branch on how the source
    // parsed and no fallthrough to a repository head.
    assert.deepStrictEqual(cascade, {
      kind: "constraint-failed",
      failure: { kind: "no-matching-tag", key: dependencyKey, range: ">=1.0.0 <2.0.0-0" },
    });
    assert.deepStrictEqual(seen, [], "there is no repository to query");
  });
}

test("AUTH-09 the tag query rides the credential collaborators the member's install uses", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-auth-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const credentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  // Never reached: the probe threads the seam through and this case faults the
  // probe itself, so a device flow can neither start nor poll.
  const deviceFlowHttp: DeviceFlowHttp = {
    requestCode: () => Promise.reject(new Error("no device flow in this case")),
    pollToken: () => Promise.reject(new Error("no device flow in this case")),
  };
  const authMemo = new Map<string, AuthAttemptResult>();
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^1.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: (member) => ({
      ...ledgerOptionsFor(environment.cwd)(member),
      credentialOps,
      deviceFlowHttp,
      authMemo,
    }),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: tagProbeAnswering(
      { kind: "pinned", tag: "bar--v1.4.0", oid: PINNED_OID, version: "1.4.0" },
      seen,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(seen[0]?.auth.credentialOps, credentialOps);
  assert.strictEqual(seen[0].auth.deviceFlowHttp, deviceFlowHttp);
  assert.strictEqual(seen[0].auth.authMemo, authMemo);
});

test("D-03-10 a constraint declared outside this install's graph never reaches a member", async (t) => {
  // arrange: an installed plugin declares a conflicting constraint on the SAME
  // dependency name. It is not in the requested plugin's graph, so the walk
  // never reads its declaration and the accumulator never sees its range.
  const environment = await createHermeticEnvironment(t, "install-cascade-graph-scope-");
  const state = await seedMarketplace(
    environment.cwd,
    ["bar", "foo", "unrelated"],
    ["unrelated"],
    ["bar"],
  );
  const locations = locationsFor("project", environment.cwd);
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^1.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
      [`unrelated@${MARKETPLACE}`]: [{ name: "bar", version: "^9.0.0" }],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`unrelated@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: tagProbeAnswering(
      { kind: "pinned", tag: "bar--v1.4.0", oid: PINNED_OID, version: "1.4.0" },
      seen,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    seen.map((query) => query.range),
    [">=1.0.0 <2.0.0-0"],
    "the unrelated plugin's ^9.0.0 never joined the intersection",
  );
});

for (const { label, failure, expected } of [
  {
    label: "contradictory declarations",
    failure: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: "bar@mp",
      range: "^1.0.0 ^2.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
    expected:
      'Dependency "bar@mp" has contradictory version constraints "^1.0.0 ^2.0.0" (no version satisfies all 2 declared ranges).',
  },
  {
    label: "an already-installed copy the constraint rejects",
    failure: {
      kind: "range-conflict",
      why: "installed-unsatisfied",
      key: "bar@mp",
      range: "^2.0.0",
      recordedVersion: "1.4.0",
    },
    expected: 'Dependency "bar@mp" is installed at version 1.4.0, which does not satisfy "^2.0.0".',
  },
  {
    label: "no satisfying release tag",
    failure: { kind: "no-matching-tag", key: "bar@mp", range: "^3.0.0" },
    expected: 'Dependency "bar@mp" has no release tag satisfying "^3.0.0".',
  },
  {
    label: "a classified listing failure",
    failure: {
      kind: "tag-listing-failed",
      key: "bar@mp",
      range: "^1.0.0",
      cause: new Error("boom"),
      classification: "authentication required",
    },
    expected:
      'Dependency "bar@mp" could not be checked against "^1.0.0" (authentication required).',
  },
  {
    label: "an unclassifiable listing failure",
    failure: {
      kind: "tag-listing-failed",
      key: "bar@mp",
      range: "^1.0.0",
      cause: new Error("boom"),
      classification: undefined,
    },
    expected: 'Dependency "bar@mp" could not be checked against "^1.0.0" (tag listing failed).',
  },
  {
    label: "an unparseable range",
    failure: {
      kind: "range-invalid",
      key: "bar@mp",
      range: "nope",
      detail: "input 1 of 1 is not a valid version range",
    },
    expected:
      'Dependency "bar@mp" declares an unparseable version constraint "nope" (input 1 of 1 is not a valid version range).',
  },
  {
    label: "a combination past the caps",
    failure: {
      kind: "range-too-complex",
      key: "bar@mp",
      range: "1.0.0||1.0.1",
      detail: "total input 5400 characters exceeds the 4096 character cap",
    },
    expected:
      'Dependency "bar@mp" declares version constraints too complex to combine (total input 5400 characters exceeds the 4096 character cap).',
  },
] satisfies readonly {
  label: string;
  failure: CascadeConstraintFailure;
  expected: string;
}[]) {
  test(`T-03-22 the cause text for ${label} names only allowlisted tokens`, () => {
    // act
    const cause = formatConstraintFailure(failure);

    // assert
    assert.strictEqual(cause, expected);
  });
}

test("RESV-03 the constraint step answers every member, pinning only the constrained one", async (t) => {
  // arrange: the step driven directly, so its own contract -- one answer per
  // member, in closure order -- is observed without the ledger in the way.
  const environment = await createHermeticEnvironment(t, "resolve-constraints-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], [], ["bar"]);
  const seen: DependencyTagProbeOptions[] = [];
  const member = (name: string, ranges: readonly string[]): ClosureMember => ({
    key: `${name}@${MARKETPLACE}`,
    name,
    marketplace: MARKETPLACE,
    requiredBy: undefined,
    ranges,
  });

  // act
  const resolution = await resolveMemberConstraints({
    state,
    closure: [member("bar", ["^1.0.0"]), member("foo", [])],
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    tagProbe: tagProbeAnswering(
      { kind: "pinned", tag: "bar--v1.4.0", oid: PINNED_OID, version: "1.4.0" },
      seen,
    ),
    tagMemo: new Map(),
  });

  // assert
  assert.ok(resolution.ok);
  assert.deepStrictEqual(
    resolution.members.map((resolved) => ({
      key: resolved.key,
      pinnedRef: resolved.pinnedRef,
      pinnedOid: resolved.pinnedOid,
    })),
    [
      { key: `bar@${MARKETPLACE}`, pinnedRef: "bar--v1.4.0", pinnedOid: PINNED_OID },
      { key: `foo@${MARKETPLACE}`, pinnedRef: undefined, pinnedOid: undefined },
    ],
  );
  assert.strictEqual(seen.length, 1, "only the constrained member reaches a repository");
});
