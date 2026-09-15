import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { cascadeUnstagePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import {
  formatClosureFailure,
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
import type {
  InstallCascadeLedgerSeam,
  InstallCascadeOptions,
  InstallCascadeResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type {
  InstallLedgerOptions,
  InstallLedgerSummary,
  InstallLedgerTransaction,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const MARKETPLACE = "marketplace";

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
      plugins: pluginNames.map((name) => ({ name, source: `./plugins/${name}` })),
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

/** The per-member ledger options a cascade run needs, bound to one scope. */
function ledgerOptionsFor(cwd: string): (member: ClosureMember) => InstallLedgerOptions {
  return (member) => ({
    ctx: notificationContext(),
    scope: "project",
    cwd,
    marketplace: member.marketplace,
    plugin: member.name,
    removalOps: createRemovalOps(),
  });
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
