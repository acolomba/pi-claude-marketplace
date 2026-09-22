import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { cascadeUnstagePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { probeDependencyTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import { runInstallCascade } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import { runInstallLedger } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import { probeMarketplaceTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { listTags, resolveTagOid } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { retryTree } from "./scope-tree-inventory.ts";

import type { DeclaredDependency } from "../../../extensions/pi-claude-marketplace/domain/dependencies.ts";
import type {
  ClosureLookup,
  ClosureLookupResult,
  ClosureMember,
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
  CascadeMarketplaceTagProbe,
  CascadeMemberOutcome,
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
import type {
  MarketplaceTagListingSeam,
  MarketplaceTagProbeOptions,
  MarketplaceTagProbeResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
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

/** A closure member of the fixture marketplace, as the walk would report it. */
function closureMember(name: string, ranges: readonly string[] = []): ClosureMember {
  return {
    key: `${name}@${MARKETPLACE}`,
    name,
    marketplace: MARKETPLACE,
    requiredBy: undefined,
    ranges,
  };
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

/** What a seeded marketplace records beyond the plugins it declares. */
interface SeedOptions {
  /** Plugins the snapshot already records as installed. */
  readonly preinstalled?: readonly string[];
  /** Plugins whose marketplace entry names the git source rather than a path. */
  readonly gitSourced?: readonly string[];
  /** The version each preinstalled plugin's record carries; `0.0.1` unless named. */
  readonly recordedVersions?: Readonly<Record<string, string>>;
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
  { preinstalled = [], gitSourced = [], recordedVersions = {} }: SeedOptions = {},
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

  // TAGS-01: a path-source member's constraint resolves against its
  // marketplace clone's own local tags, so the fixture marketplace is a real
  // (initially tag-less) git repository, matching what a marketplace root
  // actually is in production.
  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  await git.add({ fs, dir: marketplaceRoot, filepath: ".claude-plugin/marketplace.json" });
  for (const name of pluginNames) {
    await git.add({
      fs,
      dir: marketplaceRoot,
      filepath: `plugins/${name}/.claude-plugin/plugin.json`,
    });
  }

  await git.commit({
    fs,
    dir: marketplaceRoot,
    message: "seed marketplace",
    author: { name: "test", email: "test@example.com" },
  });

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
              // RESV-05's conflict check reads the RECORDED version, so a case
              // about an unsatisfied constraint has to be able to choose it.
              version: recordedVersions[name] ?? "0.0.1",
              resolvedSource: path.join(marketplaceRoot, "plugins", name),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], hooks: [], mcpServers: [] },
              enabled: true,
              provenance: "explicit",
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

/** Overwrites one plugin's `source` field on a `seedMarketplace` fixture's manifest.json. */
async function overwriteManifestPluginSource(
  cwd: string,
  name: string,
  source: unknown,
): Promise<void> {
  const manifestPath = path.join(cwd, MARKETPLACE, ".claude-plugin", "marketplace.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    name: string;
    plugins: { name: string; source: unknown }[];
  };
  manifest.plugins = manifest.plugins.map((entry) =>
    entry.name === name ? { ...entry, source } : entry,
  );
  await writeFile(manifestPath, JSON.stringify(manifest));
}

/**
 * The whole observable footprint of a cascade run: the install records of the
 * snapshot the caller handed in, plus BOTH scope roots' on-disk inventories. A
 * rollback proof compares this one value before and after -- asserting only the
 * returned arm would pass while proving nothing about what stayed on disk.
 */
async function twoScopeFootprint(cwd: string, state: ExtensionState): Promise<unknown> {
  return {
    records: structuredClone(state.marketplaces),
    project: await retryTree(locationsFor("project", cwd).scopeRoot),
    user: await retryTree(locationsFor("user", cwd).scopeRoot),
  };
}

/** A ledger summary for a member no fake seam actually materialized. */
function unmaterializedSummary(
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
    ...(member.pin !== undefined && { sourcePinOverride: member.pin.oid }),
    ...(member.pin !== undefined && { pinVersionOverride: member.pin.version }),
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
        summary: unmaterializedSummary(locations, cwd, {
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

test("a materialized member's outcome carries what its own ledger summary reported", async (t) => {
  // arrange: two summaries that differ on every projected field, so a
  // projection reading the wrong summary, or swapping the two companion flags,
  // fails on both members.
  const environment = await createHermeticEnvironment(t, "install-cascade-outcome-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const locations = locationsFor("project", environment.cwd);
  const barBase = unmaterializedSummary(locations, environment.cwd, closureMember("bar"));
  const barSummary: InstallLedgerSummary = {
    ...barBase,
    version: "1.2.3",
    stagedAgentNames: ["bar-agent"],
    resolved: {
      ...barBase.resolved,
      pluginRoot: path.join(environment.cwd, "bar-root"),
      hooksConfigPath: "hooks/hooks.json",
    },
  };
  const fooSummary: InstallLedgerSummary = {
    ...unmaterializedSummary(locations, environment.cwd, closureMember("foo")),
    version: "4.5.6",
    stagedMcpServerNames: ["foo-mcp"],
  };
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (_state, _locations, options) =>
      Promise.resolve({
        kind: "installed",
        summary: options.plugin === "bar" ? barSummary : fooSummary,
      }),
    cascadeUnstagePlugin,
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
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(cascade.members, [
    {
      key: `bar@${MARKETPLACE}`,
      name: "bar",
      marketplace: MARKETPLACE,
      requiredBy: `foo@${MARKETPLACE}`,
      version: "1.2.3",
      declaresAgents: true,
      declaresMcp: false,
      pluginRoot: path.join(environment.cwd, "bar-root"),
      hooksConfigPath: "hooks/hooks.json",
      fellBackToCurrentCopy: false,
      reEnabledFromRecord: false,
    },
    {
      key: `foo@${MARKETPLACE}`,
      name: "foo",
      marketplace: MARKETPLACE,
      requiredBy: undefined,
      version: "4.5.6",
      declaresAgents: false,
      declaresMcp: true,
      pluginRoot: path.join(environment.cwd, "unmaterialized"),
      hooksConfigPath: undefined,
      fellBackToCurrentCopy: false,
      reEnabledFromRecord: false,
    },
  ]);
  assert.strictEqual(
    cascade.root,
    fooSummary,
    "the root's summary is handed back as the ledger returned it",
  );
});

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
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { preinstalled: ["foo"] });
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
  assert.ok(cascade.error instanceof PluginShapeError);
  assert.deepStrictEqual(cascade.error.shape, {
    kind: "already-installed",
    plugin: "foo",
    marketplace: MARKETPLACE,
  });
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
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["foo"],
  });
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
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { preinstalled: ["bar"] });
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

const UNSTAGE_DENIED = new Error("unstage denied");
const UNSTAGE_INCOMPLETE = `Rollback of "bar@${MARKETPLACE}" did not complete.`;
for (const { label, cause, expected } of [
  {
    label: "carrying its cause",
    cause: UNSTAGE_DENIED,
    expected: { msg: "unstage denied", cause: UNSTAGE_DENIED },
  },
  {
    label: "carrying no cause",
    cause: undefined,
    expected: { msg: UNSTAGE_INCOMPLETE, cause: new Error(UNSTAGE_INCOMPLETE) },
  },
]) {
  test(`RESV-06 an undo that itself fails ${label} surfaces a rollback partial without throwing`, async (t) => {
    // arrange: the double REPORTS the failure the way the production primitive
    // does. `cascadeUnstagePlugin` wraps its whole body in a try/catch and
    // returns `{ok: false, dropped, cause?}`, so a double that rejects would
    // exercise a failure mode the real primitive cannot produce -- it would
    // prove the ledger's plumbing and nothing about the path that ships.
    const environment = await createHermeticEnvironment(t, "install-cascade-undo-fault-");
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { preinstalled: ["foo"] });
    const locations = locationsFor("project", environment.cwd);
    const seam: InstallCascadeLedgerSeam = {
      runInstallLedger,
      cascadeUnstagePlugin: (plugin, marketplace, memberLocations, installed) =>
        plugin === "bar"
          ? Promise.resolve({
              ok: false,
              dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
              ...(cause !== undefined && { cause }),
            })
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
    assert.deepStrictEqual(cascade.rollbackPartials, [
      { phase: `bar@${MARKETPLACE}`, msg: expected.msg, cause: expected.cause },
    ]);
    assert.deepStrictEqual(
      Object.keys(state.marketplaces[MARKETPLACE]?.plugins ?? {}),
      ["foo", "bar"],
      "the record of a member whose unstage did not finish still owns what is on disk",
    );
  });
}

test("RESV-06 an unstage that dropped part of its inventory keeps the record honest", async (t) => {
  // arrange: the primitive reports the two axes it DID clear before it failed.
  // The surviving record must name only what is still on disk, or a later
  // uninstall walks names nothing owns.
  const environment = await createHermeticEnvironment(t, "install-cascade-undo-partial-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { preinstalled: ["foo"] });
  const locations = locationsFor("project", environment.cwd);
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (memberState, memberLocations, options, capture, transaction) =>
      runInstallLedger(memberState, memberLocations, options, capture, transaction).then(
        (ledgerResult) => {
          if (options.plugin === "bar" && ledgerResult.kind === "installed") {
            const record = memberState.marketplaces[MARKETPLACE]?.plugins.bar;
            if (record !== undefined) {
              record.resources.skills = ["bar-kept", "bar-dropped"];
              record.resources.prompts = ["bar-prompt"];
            }
          }

          return ledgerResult;
        },
      ),
    cascadeUnstagePlugin: (plugin, marketplace, memberLocations, installed) =>
      plugin === "bar"
        ? Promise.resolve({
            ok: false,
            dropped: {
              skills: ["bar-dropped"],
              commands: ["bar-prompt"],
              agents: [],
              hooks: [],
              mcpServers: [],
            },
            cause: new Error("unstage denied"),
          })
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
  assert.deepStrictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.resources, {
    skills: ["bar-kept"],
    prompts: [],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
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
    const refusal = new Error("root ledger refused");
    const seam: InstallCascadeLedgerSeam = {
      runInstallLedger: (_state, _locations, options) =>
        options.plugin === "foo"
          ? Promise.reject(refusal)
          : Promise.resolve({
              kind: "installed",
              summary: unmaterializedSummary(locations, environment.cwd, {
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
    assert.strictEqual(cascade.error, refusal);
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

  // act & assert
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
    {
      name: "Error",
      message: "Install cascade reported success without materializing the root plugin.",
    },
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
  assert.deepStrictEqual(cascade, {
    kind: "member-failed",
    key: `foo@${MARKETPLACE}`,
    error: new Error("Install cascade failed."),
    rollbackPartials: [],
  });
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
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
  const state = await seedMarketplace(environment.cwd, ["left", "right", "root", "shared"], {
    gitSourced: ["shared"],
  });
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
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
  assert.deepStrictEqual(
    cascade,
    {
      kind: "constraint-failed",
      failure: {
        kind: "range-too-complex",
        key: `bar@${MARKETPLACE}`,
        range: `${wide.slice(0, 200)}... (+${(wide.length - 200).toString()} chars)`,
        detail: `total input ${wide.length.toString()} characters exceeds the 4096 character cap`,
      },
    },
    "the reported constraint is bounded, so a wide range cannot flood a row",
  );
  assert.deepStrictEqual(seen, []);
});

test("RESV-03 a satisfiable range pins the member and the pin reaches its ledger options", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-pin-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [
      ["bar", PINNED_OID, "1.4.0"],
      ["foo", undefined, undefined],
    ],
    "the constrained member installs the selected commit and records the tag's own version",
  );
});

test("D-09-05: a root range pins the root through the tag probe like a constrained member", async (t) => {
  // arrange: `bar` is the ROOT itself, git-sourced and declaring nothing --
  // the caller's `rootRanges` is the only constraint on it.
  const environment = await createHermeticEnvironment(t, "install-cascade-root-pin-");
  const state = await seedMarketplace(environment.cwd, ["bar"], { gitSourced: ["bar"] });
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `bar@${MARKETPLACE}`,
    rootRanges: ["^1.0.0"],
    lookup: catalog({ [`bar@${MARKETPLACE}`]: [] }),
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
    "the root is queried through the tag probe like a constrained member",
  );
  assert.deepStrictEqual(
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [["bar", PINNED_OID, "1.4.0"]],
    "the root installs the selected commit and records the tag's own version",
  );
});

test("D-09-05: a root range on a path-source root reaches the marketplace tag probe", async (t) => {
  // arrange: `bar` is the ROOT, path-sourced and declaring nothing.
  const environment = await createHermeticEnvironment(t, "install-cascade-root-path-pin-");
  const state = await seedMarketplace(environment.cwd, ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const seen: MarketplaceTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `bar@${MARKETPLACE}`,
    rootRanges: ["^2.0.0"],
    lookup: catalog({ [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    marketplaceTagProbe: marketplaceTagProbeAnswering(
      { kind: "no-matching-tag", range: "unreachable" },
      seen,
    ),
  });

  // assert: TAGS-02 -- no satisfying tag, so the root falls back to the
  // marketplace's current copy rather than failing.
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    seen.map((query) => query.pluginName),
    ["bar"],
    "the marketplace tag probe is queried once for the root",
  );
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`)?.fellBackToCurrentCopy,
    true,
  );
});

test("D-09-05: a wildcard root range makes no query", async (t) => {
  // arrange: `bar` is the ROOT, git-sourced. Both probe kinds are wired so
  // either one firing would fail this case.
  const environment = await createHermeticEnvironment(t, "install-cascade-root-wildcard-");
  const state = await seedMarketplace(environment.cwd, ["bar"], { gitSourced: ["bar"] });
  const locations = locationsFor("project", environment.cwd);
  const seen: DependencyTagProbeOptions[] = [];
  const seenPath: MarketplaceTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `bar@${MARKETPLACE}`,
    rootRanges: ["*"],
    lookup: catalog({ [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    marketplaceTagProbe: marketplaceTagProbeAnswering(
      { kind: "no-matching-tag", range: "unreachable" },
      seenPath,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(seen, [], "no git tag query");
  assert.deepStrictEqual(seenPath, [], "no marketplace tag query");
});

test("D-09-05 / T-06-10: contradictory root ranges fail the cascade as a range conflict before anything materializes", async (t) => {
  // arrange: `bar` is the ROOT; the caller's own accumulated ranges conflict.
  const environment = await createHermeticEnvironment(t, "install-cascade-root-conflict-");
  const state = await seedMarketplace(environment.cwd, ["bar"], { gitSourced: ["bar"] });
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);
  const seen: DependencyTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `bar@${MARKETPLACE}`,
    rootRanges: [">=2.0.0", "<1.0.0"],
    lookup: catalog({ [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: `bar@${MARKETPLACE}`,
      range: ">=2.0.0 <1.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
  });
  assert.deepStrictEqual(seen, [], "the fold fails before any query is made");
  assert.deepStrictEqual(
    await twoScopeFootprint(environment.cwd, state),
    before,
    "the verdict precedes the phase array, so there is nothing to roll back",
  );
});

/** Creates lightweight tags at the fixture marketplace's own current HEAD. */
async function tagMarketplaceRoot(state: ExtensionState, ...tagNames: string[]): Promise<string> {
  const marketplaceRoot = state.marketplaces[MARKETPLACE]?.marketplaceRoot;
  assert.ok(marketplaceRoot !== undefined, "the fixture records the marketplace it seeds");
  const oid = await git.resolveRef({ fs, dir: marketplaceRoot, ref: "HEAD" });
  for (const tagName of tagNames) {
    await git.tag({ fs, dir: marketplaceRoot, ref: tagName, object: oid });
  }

  return oid;
}

/** A local marketplace-tag probe that records every query it was handed and answers the same way. */
function marketplaceTagProbeAnswering(
  answer: MarketplaceTagProbeResult,
  seen: MarketplaceTagProbeOptions[],
): CascadeMarketplaceTagProbe {
  return (options) => {
    seen.push(options);
    return Promise.resolve(answer);
  };
}

test("TAGS-01 a constrained path-source member pins the highest satisfying marketplace tag", async (t) => {
  // arrange: the REAL local probe, wired through the whole cascade with no
  // injected stand-in -- this is the tracer slice end to end.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-pin-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const oid = await tagMarketplaceRoot(state, "bar--v1.0.0", "bar--v2.1.0", "bar--v3.0.0");
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^2.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, materialized),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [
      ["bar", oid, "2.1.0"],
      ["foo", undefined, undefined],
    ],
    "the path-source member installs at the highest satisfying marketplace tag and records its own semver",
  );
});

test("WR-02: two path-source members constrained against the SAME marketplace clone list its tags once", async (t) => {
  // arrange: `bar` and `baz` are both path-source members of the SAME
  // marketplace clone, each satisfied by a tag on the marketplace's one
  // commit -- the shape `CascadeMarketplaceTagMemo` exists to dedupe.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-memo-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"]);
  await tagMarketplaceRoot(state, "bar--v1.0.0", "baz--v1.0.0");
  const locations = locationsFor("project", environment.cwd);

  // A marketplaceTagProbe that delegates to the REAL probe but counts the
  // underlying `listTags` calls -- the only observable proof that the memo
  // `runInstallCascade` allocates (and threads via `options.tagMemo` below)
  // is actually reaching the local probe's own memo parameter.
  const listTagsCalls: { dir: string }[] = [];
  const countingSeam: MarketplaceTagListingSeam = {
    listTags: (opts) => {
      listTagsCalls.push(opts);
      return listTags(opts);
    },
    resolveTagOid,
  };
  const countingMarketplaceTagProbe = (options: MarketplaceTagProbeOptions) =>
    probeMarketplaceTags({ ...options, seam: countingSeam });

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [
        { name: "bar", version: "^1.0.0" },
        { name: "baz", version: "^1.0.0" },
      ],
      [`bar@${MARKETPLACE}`]: [],
      [`baz@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    marketplaceTagProbe: countingMarketplaceTagProbe,
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(
    listTagsCalls.length,
    1,
    "both members share ONE run's marketplaceTagMemo, so the clone's tags are listed once",
  );
});

test("TAGS-02 / D-07-03 a path-source member with no satisfying tag resolves anyway, with no pin", async (t) => {
  // arrange: the marketplace's only tag is `bar--v1.0.0`, which does not
  // satisfy `^9.0.0`.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-fallback-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  await tagMarketplaceRoot(state, "bar--v1.0.0");
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^9.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, materialized),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, []),
  });

  // assert: installed, both members, the fallback member carries no pin.
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.map((member) => [member.key, member.fellBackToCurrentCopy]),
    [
      [`bar@${MARKETPLACE}`, true],
      [`foo@${MARKETPLACE}`, false],
    ],
  );
  assert.deepStrictEqual(
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [
      ["bar", undefined, undefined],
      ["foo", undefined, undefined],
    ],
  );
});

test("TAGS-02 / D-07-07 a path-source member whose local listing THROWS resolves anyway, identically", async (t) => {
  // arrange: the SAME shape as the no-matching-tag case, but the probe's own
  // listing failed rather than coming back empty of a satisfying candidate.
  // D-07-07: one fallback arm covers both -- an unreadable listing and an
  // empty one are the same user-visible fact.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-throw-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];
  const cause = new Error("cannot read refs/tags");

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
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, []),
    marketplaceTagProbe: () => Promise.resolve({ kind: "tag-listing-failed", cause }),
  });

  // assert: identical to the no-matching-tag case -- no pin, no failure, no
  // transport classification riding a success row.
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.map((member) => [member.key, member.fellBackToCurrentCopy]),
    [
      [`bar@${MARKETPLACE}`, true],
      [`foo@${MARKETPLACE}`, false],
    ],
  );
  assert.deepStrictEqual(
    materialized.map((options) => options.sourcePinOverride),
    [undefined, undefined],
  );
});

test("TAGS-02 / D-07-07 a path-source member whose marketplace root is not a git repository resolves anyway", async (t) => {
  // arrange: a real, UNMOCKED probe against a marketplace root with no `.git`
  // at all -- `listTags` throws, `probeMarketplaceTags` catches it into
  // `tag-listing-failed`, and the SAME fallback arm applies with no injected
  // seam of any kind.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-no-repo-");
  const marketplaceRoot = path.join(environment.cwd, "not-a-repo");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  for (const plugin of ["bar", "foo"]) {
    await mkdir(path.join(marketplaceRoot, "plugins", plugin, ".claude-plugin"), {
      recursive: true,
    });
    await writeFile(
      path.join(marketplaceRoot, "plugins", plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "0.0.1" }),
    );
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: MARKETPLACE,
      plugins: [
        { name: "bar", source: "./plugins/bar" },
        { name: "foo", source: "./plugins/foo" },
      ],
    }),
  );
  const locations = locationsFor("project", environment.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      [MARKETPLACE]: {
        name: MARKETPLACE,
        scope: "project",
        source: pathSource(`./${MARKETPLACE}`),
        addedFromCwd: environment.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });
  const state = await loadState(locations.extensionRoot);
  const materialized: InstallLedgerOptions[] = [];

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
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, []),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.map((member) => [member.key, member.fellBackToCurrentCopy]),
    [
      [`bar@${MARKETPLACE}`, true],
      [`foo@${MARKETPLACE}`, false],
    ],
  );
  assert.deepStrictEqual(
    materialized.map((options) => options.sourcePinOverride),
    [undefined, undefined],
  );
});

test("TAGS-02 a path-source member WITH a satisfying tag is unaffected: no fallback, pin present", async (t) => {
  // arrange: a path-source member's own constraint resolution, which the
  // git-backed arm below must not be able to change.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-pinned-still-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const oid = await tagMarketplaceRoot(state, "bar--v1.0.0");
  const locations = locationsFor("project", environment.cwd);
  const materialized: InstallLedgerOptions[] = [];

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
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, []),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.map((member) => [member.key, member.fellBackToCurrentCopy]),
    [
      [`bar@${MARKETPLACE}`, false],
      [`foo@${MARKETPLACE}`, false],
    ],
  );
  assert.deepStrictEqual(
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [
      ["bar", oid, "1.0.0"],
      ["foo", undefined, undefined],
    ],
  );
});

test("RESV-03 a path-source dependency declared with no version makes no local tag listing", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-path-wildcard-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  await tagMarketplaceRoot(state, "bar--v1.0.0");
  const locations = locationsFor("project", environment.cwd);
  const seen: MarketplaceTagProbeOptions[] = [];

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    marketplaceTagProbe: marketplaceTagProbeAnswering(
      { kind: "no-matching-tag", range: "unreachable" },
      seen,
    ),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    seen,
    [],
    "an unconstrained path-source member makes no local tag listing",
  );
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`)?.fellBackToCurrentCopy,
    false,
    "an unconstrained member never falls back -- there was no constraint to fail",
  );
});

test("TAGS-02 a cascade run's member outcomes carry fellBackToCurrentCopy per member", async (t) => {
  // arrange: `bar` falls back (no satisfying tag); `foo`, the requesting
  // plugin, does not.
  const environment = await createHermeticEnvironment(t, "install-cascade-outcome-flag-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  await tagMarketplaceRoot(state, "bar--v1.0.0");
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^9.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.map((member) => [member.key, member.fellBackToCurrentCopy]),
    [
      [`bar@${MARKETPLACE}`, true],
      [`foo@${MARKETPLACE}`, false],
    ],
  );
});

test("RESV-03 a constrained dependency whose marketplace entry is npm-sourced reports no matching tag", async (t) => {
  // arrange: neither git-backed nor path -- the fallthrough absent arm of
  // resolveMemberTagSource.
  const environment = await createHermeticEnvironment(t, "install-cascade-npm-source-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  await overwriteManifestPluginSource(environment.cwd, "bar", { source: "npm", package: "bar" });
  const locations = locationsFor("project", environment.cwd);

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
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: { kind: "no-matching-tag", key: `bar@${MARKETPLACE}`, range: ">=1.0.0 <2.0.0-0" },
  });
});

test("TAGS-02 a path-source member's local tag-listing failure resolves anyway, not a cascade failure", async (t) => {
  // arrange: a local tag-listing read failure takes the SAME fallback arm the
  // no-matching-tag case does, and is never a cascade failure (D-07-07).
  const environment = await createHermeticEnvironment(t, "install-cascade-path-listing-failed-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const locations = locationsFor("project", environment.cwd);
  const cause = new Error("cannot read tags");

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
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    marketplaceTagProbe: () => Promise.resolve({ kind: "tag-listing-failed", cause }),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`)?.fellBackToCurrentCopy,
    true,
  );
});

test("RESV-03 one listing serves two members whose sources share a repository", async (t) => {
  // arrange: the REAL probe behind a counting listing seam, so the memo the
  // cascade threads is the thing under test rather than a stand-in for it.
  const environment = await createHermeticEnvironment(t, "install-cascade-memo-");
  const state = await seedMarketplace(environment.cwd, ["alpha", "beta", "foo"], {
    gitSourced: ["alpha", "beta"],
  });
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
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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

test("RESV-03 a listing failure surfaces as its own arm carrying the transport classification", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-listing-fail-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
      classification: "network unreachable",
    },
  });
});

// TAGS-02: this loop covers the "absent" tag-source arm only. A path source's
// no-matching-tag arm falls back to the marketplace's current copy and has its
// own case below.
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
]) {
  test(`RESV-03 a constrained dependency resolving to ${label} reports no matching tag`, async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "install-cascade-no-source-");
    const state = await seedMarketplace(environment.cwd, pluginNames, { gitSourced });
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
    assert.deepStrictEqual(
      seen,
      [],
      "the network tag probe is never reached: the source is absent, or (TAGS-01) a path source routes through the local marketplace-clone probe instead",
    );
  });
}

test("TAGS-02 a path source whose marketplace clone carries no matching release tag installs anyway", async (t) => {
  // arrange: TAGS-01's precedent test (this loop's former third case) --
  // `bar` is path-sourced and its own marketplace clone carries no tag at
  // all, so TAGS-02's fallback applies rather than D-03-09's no-fallthrough
  // rule, which stays reserved for the git-backed and absent-source arms.
  const environment = await createHermeticEnvironment(t, "install-cascade-path-own-no-tag-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
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
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" &&
      cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`)?.fellBackToCurrentCopy,
    true,
  );
  assert.deepStrictEqual(
    seen,
    [],
    "the network tag probe is never reached: a path source routes through the local marketplace-clone probe instead",
  );
});

/**
 * Seed `bar` and `baz` as preinstalled, `enabled` records, then disable `bar`
 * and set its provenance to `"dependency"` -- the shape a cascade-installed
 * member actually carries, so a test against this fixture can tell a
 * provenance flip from a provenance that was never touched.
 */
async function seedOneDisabledDependency(
  cwd: string,
): Promise<{ readonly state: ExtensionState; readonly disabledUpdatedAt: string }> {
  const state = await seedMarketplace(cwd, ["bar", "baz", "foo"], { preinstalled: ["bar", "baz"] });
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  assert.ok(bar !== undefined, "the fixture pre-installs the dependency");
  bar.enabled = false;
  bar.provenance = "dependency";
  return { state, disabledUpdatedAt: bar.updatedAt };
}

test("EDEP-03 a disabled already-installed dependency's record ends enabled, materialized under the new marker", async (t) => {
  // arrange: `bar` is disabled and pre-installed; `helper`'s own install
  // (`foo`) declares it. The real ledger runs, so a stub could not fake the
  // re-materialization this test proves happened.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, true);
  const bar =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`);
  assert.ok(bar, "the re-enabled dependency appears in the materialized member list");
  assert.strictEqual(bar.reEnabledFromRecord, true);
  assert.strictEqual(bar.version, "0.0.1");
  assert.strictEqual(bar.declaresAgents, false);
  assert.strictEqual(bar.declaresMcp, false);
  assert.strictEqual(bar.fellBackToCurrentCopy, false);
});

test("D-09-04: a disabled record is a wall when the caller says so", async (t) => {
  // arrange: `bar` is disabled and pre-installed; `foo` declares it. `bar`
  // itself declares `baz`, which the catalog would answer if the walk ever
  // reached it.
  const environment = await createHermeticEnvironment(t, "install-cascade-wall-");
  const { state, disabledUpdatedAt } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const queried: string[] = [];
  const baseLookup = catalog({
    [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
    [`bar@${MARKETPLACE}`]: [{ name: "baz" }],
  });

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: (subject) => {
      queried.push(subject.key);
      return baseLookup(subject);
    },
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    treatDisabledAsWall: true,
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, false);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.updatedAt, disabledUpdatedAt);
  assert.deepStrictEqual(
    cascade.kind === "installed" && cascade.members.map((member) => member.key),
    [`foo@${MARKETPLACE}`],
  );
  assert.deepStrictEqual(cascade.kind === "installed" && cascade.alreadyInstalled, [
    { key: `bar@${MARKETPLACE}`, version: "0.0.1" },
  ]);
  assert.ok(
    !queried.includes(`bar@${MARKETPLACE}`),
    "bar's own declarations are never read -- the wall stops the walk at its key",
  );
});

test("D-09-04 / RESV-05: a walled disabled record still answers to the root's constraint", async (t) => {
  // arrange: `foo` declares `bar` at `^2.0.0`; `bar` is disabled and recorded
  // at `0.0.1`.
  const environment = await createHermeticEnvironment(t, "install-cascade-wall-constraint-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^2.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    treatDisabledAsWall: true,
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "installed-unsatisfied",
      key: `bar@${MARKETPLACE}`,
      range: ">=2.0.0 <3.0.0-0",
      recordedVersion: "0.0.1",
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("CR-04: a depth-2 disabled dependency chain re-enables transitively", async (t) => {
  // arrange: `foo` declares `bar`; `bar` declares `baz`. Both `bar` and
  // `baz` are recorded and disabled.
  const environment = await createHermeticEnvironment(t, "install-cascade-cr04-transitive-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["bar", "baz"],
  });
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  const baz = state.marketplaces[MARKETPLACE]?.plugins.baz;
  assert.ok(bar !== undefined && baz !== undefined, "the fixture pre-installs both dependencies");
  bar.enabled = false;
  bar.provenance = "dependency";
  baz.enabled = false;
  baz.provenance = "dependency";
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz" }],
      [`baz@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: both records end enabled, and both appear in the materialized
  // member list re-enabled through their own record.
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, true);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.enabled, true);
  const barMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`);
  const bazMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `baz@${MARKETPLACE}`);
  assert.ok(barMember, "bar appears in the materialized member list");
  assert.ok(bazMember, "baz appears in the materialized member list");
  assert.strictEqual(barMember.reEnabledFromRecord, true);
  assert.strictEqual(bazMember.reEnabledFromRecord, true);
});

test("CR-04: a cycle among disabled dependencies fails the cascade closed", async (t) => {
  // arrange: `foo` declares `bar`; `bar` declares `baz`; `baz` declares
  // `bar` back -- a cycle entirely among recorded, disabled members.
  const environment = await createHermeticEnvironment(t, "install-cascade-cr04-cycle-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["bar", "baz"],
  });
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  const baz = state.marketplaces[MARKETPLACE]?.plugins.baz;
  assert.ok(bar !== undefined && baz !== undefined, "the fixture pre-installs both dependencies");
  bar.enabled = false;
  bar.provenance = "dependency";
  baz.enabled = false;
  baz.provenance = "dependency";
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz" }],
      [`baz@${MARKETPLACE}`]: [{ name: "bar" }],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: the cascade fails closed, naming the cycle; neither record is
  // re-enabled.
  assert.strictEqual(cascade.kind, "closure-failed");
  assert.ok(cascade.kind === "closure-failed" && cascade.failure.reason === "cycle");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, false);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.enabled, false);
});

test("CR-07: a disabled dependency absent from its own manifest fails closed naming its real dependent", async (t) => {
  // arrange: "foo" declares "bar" and "qux"; "bar" declares "baz". All three
  // are recorded and disabled, and "qux" has no catalog entry at all -- the
  // marketplace-update state ATTR-08 names.
  const environment = await createHermeticEnvironment(t, "install-cascade-cr07-not-found-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["bar", "baz", "qux"],
  });
  const marketplace = state.marketplaces[MARKETPLACE];
  assert.ok(marketplace !== undefined, "the fixture pre-installs the marketplace record");
  for (const name of ["bar", "baz", "qux"]) {
    const record = marketplace.plugins[name];
    assert.ok(record !== undefined, `the fixture pre-installs ${name}`);
    record.enabled = false;
    record.provenance = "dependency";
  }

  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }, { name: "qux" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz" }],
      [`baz@${MARKETPLACE}`]: [],
      // "qux@marketplace" carries no entry at all: the catalog answers
      // "absent" for it.
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`, `qux@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: the cascade fails closed against "foo", the dependent that
  // declared "qux", and nothing is re-enabled.
  assert.strictEqual(cascade.kind, "closure-failed");
  assert.ok(cascade.kind === "closure-failed");
  assert.deepStrictEqual(cascade.failure, {
    ok: false,
    reason: "not-found",
    key: `qux@${MARKETPLACE}`,
    requiredBy: `foo@${MARKETPLACE}`,
  });
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, false);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.enabled, false);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.qux?.enabled, false);
});

test("WR-11(a): the walk stops at a live (enabled, installed) dependency below a disabled one", async (t) => {
  // arrange: "foo" declares "bar" (disabled); "bar" declares "baz", which is
  // recorded and ENABLED; "baz" declares "qux", which has no catalog entry
  // at all. RESV-05 precedes D-03-08: the walk stops at the live "baz" and
  // never reads what it declares.
  const environment = await createHermeticEnvironment(t, "install-cascade-wr11a-stop-at-live-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["bar", "baz"],
  });
  const marketplace = state.marketplaces[MARKETPLACE];
  assert.ok(marketplace !== undefined, "the fixture pre-installs the marketplace record");
  const bar = marketplace.plugins.bar;
  assert.ok(bar !== undefined, "the fixture pre-installs bar");
  bar.enabled = false;
  bar.provenance = "dependency";
  // "baz" stays enabled -- the live dependency the walk must stop at.
  const locations = locationsFor("project", environment.cwd);
  const queried: string[] = [];
  const baseLookup = catalog({
    [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
    [`bar@${MARKETPLACE}`]: [{ name: "baz" }],
    [`baz@${MARKETPLACE}`]: [{ name: "qux" }],
    // "qux@marketplace" carries no entry at all.
  });

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: (subject) => {
      queried.push(subject.key);
      return baseLookup(subject);
    },
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: the install succeeds; "bar" re-enables and "baz" is left
  // exactly as it was -- neither materialized nor reported as re-enabled --
  // and "qux" is never even queried.
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, true);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.enabled, true);
  const barMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`);
  assert.ok(barMember, "bar appears in the materialized member list");
  assert.strictEqual(barMember.reEnabledFromRecord, true);
  const bazMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `baz@${MARKETPLACE}`);
  assert.strictEqual(bazMember, undefined, "baz is left alone, never re-enabled");
  assert.ok(!queried.includes(`qux@${MARKETPLACE}`), "qux is never reached past the live baz");
});

test("WR-11(b): a never-installed dependency reached through a re-enabled member installs like any other cascade member", async (t) => {
  // arrange: "foo" declares "bar" (recorded, disabled); "bar" declares
  // "qux", which the snapshot has never installed.
  const environment = await createHermeticEnvironment(t, "install-cascade-wr11b-never-installed-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo", "qux"], {
    preinstalled: ["bar"],
  });
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  assert.ok(bar !== undefined, "the fixture pre-installs bar");
  bar.enabled = false;
  bar.provenance = "dependency";
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "qux" }],
      [`qux@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: both "bar" (re-enabled through its record) and "qux" (a fresh
  // install) appear in the materialized member list with their normal rows,
  // and "qux" installs BEFORE "bar" -- it must be live before the
  // dependency that needs it re-enables.
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, true);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.qux?.enabled, true);
  const keys = cascade.kind === "installed" ? cascade.members.map((member) => member.key) : [];
  assert.deepStrictEqual(keys, [`qux@${MARKETPLACE}`, `bar@${MARKETPLACE}`, `foo@${MARKETPLACE}`]);
  const quxMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `qux@${MARKETPLACE}`);
  assert.ok(quxMember, "qux appears in the materialized member list");
  assert.strictEqual(quxMember.reEnabledFromRecord, false);
  assert.strictEqual(quxMember.requiredBy, `bar@${MARKETPLACE}`);
  const barMember =
    cascade.kind === "installed" &&
    cascade.members.find((member) => member.key === `bar@${MARKETPLACE}`);
  assert.ok(barMember, "bar appears in the materialized member list");
  assert.strictEqual(barMember.reEnabledFromRecord, true);
});

/**
 * Disable each named record in place, with the `"dependency"` provenance a
 * cascade-installed member carries.
 */
function disableRecordedDependencies(state: ExtensionState, names: readonly string[]): void {
  const marketplace = state.marketplaces[MARKETPLACE];
  assert.ok(marketplace !== undefined, "the fixture records the marketplace");
  for (const name of names) {
    const record = marketplace.plugins[name];
    assert.ok(record !== undefined, `the fixture pre-installs ${name}`);
    record.enabled = false;
    record.provenance = "dependency";
  }
}

/** Each member outcome's key, how it materialized, and the dependent that reached it. */
function memberOrigins(
  members: readonly CascadeMemberOutcome[],
): readonly Pick<CascadeMemberOutcome, "key" | "reEnabledFromRecord" | "requiredBy">[] {
  return members.map(({ key, reEnabledFromRecord, requiredBy }) => ({
    key,
    reEnabledFromRecord,
    requiredBy,
  }));
}

test("CR-08: a never-installed dependency below a disabled one installs exactly once, before the member that needs it", async (t) => {
  // arrange: "foo" declares "bar"; "bar" declares "baz" and "qux". "bar" and
  // "baz" are recorded and disabled; "qux" is never installed.
  const environment = await createHermeticEnvironment(t, "install-cascade-cr08-once-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo", "qux"], {
    preinstalled: ["bar", "baz"],
  });
  disableRecordedDependencies(state, ["bar", "baz"]);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz" }, { name: "qux" }],
      [`baz@${MARKETPLACE}`]: [],
      [`qux@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: one outcome per member, in post order, each naming the dependent
  // that reached it.
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(cascade.kind === "installed" && memberOrigins(cascade.members), [
    { key: `baz@${MARKETPLACE}`, reEnabledFromRecord: true, requiredBy: `bar@${MARKETPLACE}` },
    { key: `qux@${MARKETPLACE}`, reEnabledFromRecord: false, requiredBy: `bar@${MARKETPLACE}` },
    { key: `bar@${MARKETPLACE}`, reEnabledFromRecord: true, requiredBy: `foo@${MARKETPLACE}` },
    { key: `foo@${MARKETPLACE}`, reEnabledFromRecord: false, requiredBy: undefined },
  ]);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.qux?.enabled, true);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.enabled, true);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.enabled, true);
});

test("CR-08: a never-installed dependency reached from the root and from a disabled dependency installs once", async (t) => {
  // arrange: "foo" declares "bar" and "qux"; "bar" declares "baz" and "qux".
  // "bar" and "baz" are recorded and disabled; "qux" is never installed.
  const environment = await createHermeticEnvironment(t, "install-cascade-cr08-diamond-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo", "qux"], {
    preinstalled: ["bar", "baz"],
  });
  disableRecordedDependencies(state, ["bar", "baz"]);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }, { name: "qux" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz" }, { name: "qux" }],
      [`baz@${MARKETPLACE}`]: [],
      [`qux@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(cascade.kind === "installed" && memberOrigins(cascade.members), [
    { key: `baz@${MARKETPLACE}`, reEnabledFromRecord: true, requiredBy: `bar@${MARKETPLACE}` },
    { key: `qux@${MARKETPLACE}`, reEnabledFromRecord: false, requiredBy: `bar@${MARKETPLACE}` },
    { key: `bar@${MARKETPLACE}`, reEnabledFromRecord: true, requiredBy: `foo@${MARKETPLACE}` },
    { key: `foo@${MARKETPLACE}`, reEnabledFromRecord: false, requiredBy: undefined },
  ]);
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.qux?.enabled, true);
});

test("RESV-05 / EDEP-03 a disabled dependency's recorded version answers to a constraint another disabled dependency declares", async (t) => {
  // arrange: "foo" declares "bar"; "bar" declares "baz" at `^1.0.0`. Both
  // are recorded and disabled, and "baz" is recorded at `0.0.1`.
  const environment = await createHermeticEnvironment(t, "install-cascade-transitive-conflict-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo"], {
    preinstalled: ["bar", "baz"],
  });
  disableRecordedDependencies(state, ["bar", "baz"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "baz", version: "^1.0.0" }],
      [`baz@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "installed-unsatisfied",
      key: `baz@${MARKETPLACE}`,
      range: ">=1.0.0 <2.0.0-0",
      recordedVersion: "0.0.1",
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("RESV-03 / EDEP-03 contradictory ranges two disabled dependencies declare on one never-installed member fail as a conflict", async (t) => {
  // arrange: "foo" declares "bar" and "baz", both recorded and disabled;
  // "bar" declares "qux" at `^1.0.0` and "baz" declares it at `^2.0.0`.
  // "qux" is never installed.
  const environment = await createHermeticEnvironment(t, "install-cascade-disabled-diamond-");
  const state = await seedMarketplace(environment.cwd, ["bar", "baz", "foo", "qux"], {
    preinstalled: ["bar", "baz"],
  });
  disableRecordedDependencies(state, ["bar", "baz"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }, { name: "baz" }],
      [`bar@${MARKETPLACE}`]: [{ name: "qux", version: "^1.0.0" }],
      [`baz@${MARKETPLACE}`]: [{ name: "qux", version: "^2.0.0" }],
      [`qux@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`, `baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: `qux@${MARKETPLACE}`,
      range: "^1.0.0 ^2.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("EDEP-03 a disabled dependency declaring a plugin its marketplace does not declare fails the install naming that dependency", async (t) => {
  // arrange: "foo" declares "bar" (recorded, disabled); "bar" declares
  // "qux", which has no catalog entry at all.
  const environment = await createHermeticEnvironment(t, "install-cascade-disabled-not-found-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], {
    preinstalled: ["bar"],
  });
  disableRecordedDependencies(state, ["bar"]);
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar" }],
      [`bar@${MARKETPLACE}`]: [{ name: "qux" }],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "closure-failed",
    failure: {
      ok: false,
      reason: "not-found",
      key: `qux@${MARKETPLACE}`,
      requiredBy: `bar@${MARKETPLACE}`,
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("a requested plugin that is recorded and disabled is refused by its own ledger, not re-enabled as a member", async (t) => {
  // arrange: "foo", the requested plugin, is recorded and disabled; it
  // declares "bar", which is never installed.
  const environment = await createHermeticEnvironment(t, "install-cascade-disabled-root-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { preinstalled: ["foo"] });
  const foo = state.marketplaces[MARKETPLACE]?.plugins.foo;
  assert.ok(foo !== undefined, "the fixture pre-installs the requested plugin");
  foo.enabled = false;
  const locations = locationsFor("project", environment.cwd);
  const before = await twoScopeFootprint(environment.cwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`foo@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: the dependency this run installed is unwound and the root's
  // record stays disabled.
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.key, `foo@${MARKETPLACE}`);
  assert.ok(cascade.error instanceof PluginShapeError);
  assert.deepStrictEqual(cascade.error.shape, {
    kind: "already-installed",
    plugin: "foo",
    marketplace: MARKETPLACE,
  });
  assert.deepStrictEqual(await twoScopeFootprint(environment.cwd, state), before);
});

test("EDEP-03 a re-enabled dependency keeps its provenance at dependency", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-provenance-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert: D-04-02 / A2 -- only a by-name install promotes; this is not one.
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar?.provenance, "dependency");
});

test("EDEP-03 re-enabling a dependency writes no entry into either config file", async (t) => {
  // arrange: `install-cascade.ts` and `install-outcome.ts` expose no config-write
  // seam at all, so this proves the guarantee the way it can be observed here --
  // neither config file exists after the run.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-no-config-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.strictEqual(fs.existsSync(locations.configJsonPath), false);
  assert.strictEqual(fs.existsSync(locations.configLocalJsonPath), false);
});

test("EDEP-03 an already-enabled already-installed dependency is left untouched", async (t) => {
  // arrange: `baz` is the control -- an ENABLED record on the same
  // already-installed path, so a partition that re-enabled every already-installed
  // member regardless of state would fail here.
  const environment = await createHermeticEnvironment(t, "install-cascade-enabled-untouched-");
  const state = await seedMarketplace(environment.cwd, ["baz", "foo"], { preinstalled: ["baz"] });
  const bazBefore = state.marketplaces[MARKETPLACE]?.plugins.baz;
  assert.ok(bazBefore !== undefined, "the fixture pre-installs the dependency");
  const bazUpdatedAt = bazBefore.updatedAt;
  const locations = locationsFor("project", environment.cwd);
  const calledFor: string[] = [];
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (memberState, memberLocations, options, capture, transaction) => {
      calledFor.push(options.plugin);
      return runInstallLedger(memberState, memberLocations, options, capture, transaction);
    },
    cascadeUnstagePlugin,
  };

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "baz" }] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`baz@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam,
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(cascade.kind === "installed" && cascade.alreadyInstalled, [
    { key: `baz@${MARKETPLACE}`, version: "0.0.1" },
  ]);
  assert.deepStrictEqual(calledFor, ["foo"], "no ledger call was made for the enabled dependency");
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.baz?.updatedAt, bazUpdatedAt);
});

test("EDEP-03 a re-materialization fault unwinds the whole cascade and leaves the record disabled", async (t) => {
  // arrange: `bar`'s own re-enable ledger call throws, so `run.materialized`
  // never records it and the phase's own `undo` gate is a no-op -- the record
  // must be exactly what it was before this run.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-fault-");
  const { state, disabledUpdatedAt } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const refusal = new Error("re-enable ledger refused");
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (memberState, memberLocations, options, capture, transaction) =>
      options.plugin === "bar"
        ? Promise.reject(refusal)
        : runInstallLedger(memberState, memberLocations, options, capture, transaction),
    cascadeUnstagePlugin,
  };

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam,
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.strictEqual(cascade.kind === "member-failed" && cascade.key, `bar@${MARKETPLACE}`);
  assert.strictEqual(
    state.marketplaces[MARKETPLACE]?.plugins.foo,
    undefined,
    "the root plugin never installed",
  );
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  assert.ok(bar !== undefined, "the dependency's own record still exists");
  assert.strictEqual(bar.enabled, false);
  assert.strictEqual(
    bar.updatedAt,
    disabledUpdatedAt,
    "the record was never touched, not re-disabled",
  );
});

test("EDEP-03 the root's own ledger fault AFTER a successful re-enable puts the dependency back to disabled", async (t) => {
  // arrange: `bar` re-enables for real, then `foo`'s (the root's) own ledger
  // throws -- the reverse walk must reach `bar`'s phase and re-disable it.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-root-fault-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const refusal = new Error("root ledger refused");
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (memberState, memberLocations, options, capture, transaction) =>
      options.plugin === "foo"
        ? Promise.reject(refusal)
        : runInstallLedger(memberState, memberLocations, options, capture, transaction),
    cascadeUnstagePlugin,
  };

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam,
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  assert.ok(bar !== undefined, "the dependency's own record still exists");
  assert.strictEqual(
    bar.enabled,
    false,
    "the reverse walk put the re-enabled member back to disabled",
  );
  assert.strictEqual(bar.provenance, "dependency");
});

test("EDEP-03 an undo whose re-enabled member's record is gone by rollback time removes nothing and does not throw", async (t) => {
  // arrange: the fake ledger reports `bar` re-enabled and then removes its own
  // record as a side effect -- mirroring `buildMemberPhase`'s own "wrote no
  // record" undo case -- so the undo's early-return guard runs against a
  // snapshot carrying nothing to remove.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-undo-gone-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const refusal = new Error("root ledger refused");
  const unstaged: string[] = [];
  const seam: InstallCascadeLedgerSeam = {
    runInstallLedger: (memberState, _memberLocations, options) => {
      if (options.plugin !== "bar") {
        return Promise.reject(refusal);
      }

      const marketplaceRecord = memberState.marketplaces[MARKETPLACE];
      delete marketplaceRecord?.plugins.bar;
      return Promise.resolve({
        kind: "installed",
        summary: unmaterializedSummary(locations, environment.cwd, closureMember("bar")),
      });
    },
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
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam,
  });

  // assert
  assert.strictEqual(cascade.kind, "member-failed");
  assert.deepStrictEqual(
    unstaged,
    [],
    "nothing was unstaged for a member with no record to remove",
  );
  assert.strictEqual(state.marketplaces[MARKETPLACE]?.plugins.bar, undefined);
});

const REENABLE_UNSTAGE_DENIED = new Error("unstage denied");
const REENABLE_UNSTAGE_INCOMPLETE = `Rollback of "bar@${MARKETPLACE}" did not complete.`;
for (const { label, cause, expected } of [
  {
    label: "carrying its cause",
    cause: REENABLE_UNSTAGE_DENIED,
    expected: { msg: "unstage denied", cause: REENABLE_UNSTAGE_DENIED },
  },
  {
    label: "carrying no cause",
    cause: undefined,
    expected: {
      msg: REENABLE_UNSTAGE_INCOMPLETE,
      cause: new Error(REENABLE_UNSTAGE_INCOMPLETE),
    },
  },
]) {
  test(`EDEP-03 an undo whose re-enabled member's own unstage does not finish, ${label}, surfaces a rollback partial without throwing`, async (t) => {
    // arrange: `bar` re-enables for real, `foo`'s ledger then throws, and
    // `bar`'s own unstage reports failure -- the undo must RETHROW after
    // folding what did drop (D-03-07 / T-08-10), not swallow the failure.
    const environment = await createHermeticEnvironment(t, "install-cascade-reenable-undo-fault-");
    const { state } = await seedOneDisabledDependency(environment.cwd);
    const locations = locationsFor("project", environment.cwd);
    const refusal = new Error("root ledger refused");
    const seam: InstallCascadeLedgerSeam = {
      runInstallLedger: (memberState, memberLocations, options, capture, transaction) =>
        options.plugin === "foo"
          ? Promise.reject(refusal)
          : runInstallLedger(memberState, memberLocations, options, capture, transaction),
      cascadeUnstagePlugin: (plugin, marketplace, memberLocations, installed) =>
        plugin === "bar"
          ? Promise.resolve({
              ok: false,
              dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
              ...(cause !== undefined && { cause }),
            })
          : cascadeUnstagePlugin(plugin, marketplace, memberLocations, installed),
    };

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set([`bar@${MARKETPLACE}`]),
      knownMarketplaces: new Set([MARKETPLACE]),
      seam,
    });

    // assert
    assert.strictEqual(cascade.kind, "member-failed");
    assert.deepStrictEqual(cascade.kind === "member-failed" && cascade.rollbackPartials, [
      { phase: `bar@${MARKETPLACE}`, msg: expected.msg, cause: expected.cause },
    ]);
    const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
    assert.ok(bar !== undefined, "the record survives an unstage that did not finish");
    assert.strictEqual(
      bar.enabled,
      true,
      "still claims enabled -- the rethrow means it was never reset",
    );
  });
}

test("EDEP-03 a constraint conflict on a disabled already-installed member fails before anything materializes", async (t) => {
  // arrange: `bar`'s recorded version falls outside the constraint AND it is
  // disabled -- the constraint check still runs first and still fails the
  // whole cascade before any phase exists, exactly as the enabled case does.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-conflict-");
  const environmentCwd = environment.cwd;
  const state = await seedMarketplace(environmentCwd, ["bar", "foo"], {
    preinstalled: ["bar"],
    gitSourced: ["bar"],
    recordedVersions: { bar: "1.0.0" },
  });
  const bar = state.marketplaces[MARKETPLACE]?.plugins.bar;
  assert.ok(bar !== undefined, "the fixture pre-installs the dependency");
  bar.enabled = false;
  const locations = locationsFor("project", environmentCwd);
  const before = await twoScopeFootprint(environmentCwd, state);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^2.0.0" }],
      [`bar@${MARKETPLACE}`]: [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environmentCwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "installed-unsatisfied",
      key: `bar@${MARKETPLACE}`,
      range: ">=2.0.0 <3.0.0-0",
      recordedVersion: "1.0.0",
    },
  });
  assert.deepStrictEqual(await twoScopeFootprint(environmentCwd, state), before);
});

test("EDEP-03 the re-enable phase runs before the root's own phase", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-order-");
  const { state } = await seedOneDisabledDependency(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const scheduled: string[] = [];
  const transaction: InstallLedgerTransaction = {
    runPhases: (phases, context) => {
      scheduled.push(...phases.map((phase) => phase.name));
      return runPhases(phases, context);
    },
  };

  // act: `recordingLedgerSeam` reports success without performing a real
  // install, so the inner six-phase ledger never runs its OWN `runPhases`
  // call through this same wrapper -- what this test observes is only the
  // cascade's own outer phase array.
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar" }], [`bar@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    transaction,
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(scheduled, [`bar@${MARKETPLACE}`, `foo@${MARKETPLACE}`]);
});

test("EDEP-03 a plugin that declares nothing is byte-identical to today", async (t) => {
  // arrange: no already-installed member at all, so the new partition never
  // fires.
  const environment = await createHermeticEnvironment(t, "install-cascade-reenable-no-deps-");
  const state = await seedMarketplace(environment.cwd, ["foo"]);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(
    cascade.kind === "installed" && cascade.members.map((member) => member.key),
    [`foo@${MARKETPLACE}`],
  );
  assert.deepStrictEqual(cascade.kind === "installed" && cascade.alreadyInstalled, []);
});

test("CMP-3 a constrained member whose marketplace the snapshot does not record resolves through the caller's lookup", async (t) => {
  // arrange: the snapshot carries the marketplace under its own name, and the
  // member names a SECOND name the snapshot does not record -- the shape a
  // project-scope install off a user-scope marketplace produces. The caller's
  // lookup is the CMP-3-aware resolution, so the pin probe must reach the
  // record through it rather than through the snapshot map.
  const environment = await createHermeticEnvironment(t, "install-cascade-cmp3-source-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
  const locations = locationsFor("project", environment.cwd);
  const seen: DependencyTagProbeOptions[] = [];
  const record = state.marketplaces[MARKETPLACE];
  assert.ok(record !== undefined, "the fixture records the marketplace it seeds");

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({
      [`foo@${MARKETPLACE}`]: [{ name: "bar", marketplace: "elsewhere", version: "^1.0.0" }],
      "bar@elsewhere": [],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set(),
    knownMarketplaces: new Set([MARKETPLACE, "elsewhere"]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
    marketplaceRecordFor: (marketplace) =>
      Promise.resolve(marketplace === "elsewhere" ? record : state.marketplaces[marketplace]),
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
    "the query addresses the source the resolved record's manifest names",
  );
});

test("AUTH-09 the tag query rides the credential collaborators the member's install uses", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-cascade-auth-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
  const ctx = notificationContext();
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
      ctx,
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
  assert.deepStrictEqual(
    seen.map((query) => query.auth),
    [{ ctx, credentialOps, deviceFlowHttp, authMemo }],
  );
});

test("D-03-10 a constraint declared outside this install's graph never reaches a member", async (t) => {
  // arrange: an installed plugin declares a conflicting constraint on the SAME
  // dependency name. It is not in the requested plugin's graph, so the walk
  // never reads its declaration and the accumulator never sees its range.
  const environment = await createHermeticEnvironment(t, "install-cascade-graph-scope-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo", "unrelated"], {
    preinstalled: ["unrelated"],
    gitSourced: ["bar"],
  });
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

test("RESV-03 the constraint step answers every member, pinning only the constrained one", async (t) => {
  // arrange: one answer per member, in closure order, observed through the
  // ledger options each member's phase receives.
  const environment = await createHermeticEnvironment(t, "resolve-constraints-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"], { gitSourced: ["bar"] });
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
    materialized.map((options) => [
      options.plugin,
      options.sourcePinOverride,
      options.pinVersionOverride,
    ]),
    [
      ["bar", PINNED_OID, "1.4.0"],
      ["foo", undefined, undefined],
    ],
  );
  assert.deepStrictEqual(
    seen.map((query) => query.pluginName),
    ["bar"],
    "only the constrained member reaches a repository",
  );
});

for (const { label, declared, recorded } of [
  { label: "carries no constraint at all", declared: undefined, recorded: "0.0.1" },
  {
    label: "carries a constraint its recorded version satisfies",
    declared: "^1.0.0",
    recorded: "1.4.0",
  },
  {
    label:
      "carries a constraint a content-hash recorded version satisfies through the unguarded ladder",
    declared: "^123456789.0.0",
    recorded: "hash-123456789abc",
  },
]) {
  test(`RESV-05 an already-installed dependency that ${label} is left exactly as it was`, async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "install-cascade-installed-ok-");
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], {
      preinstalled: ["bar"],
      gitSourced: ["bar"],
      recordedVersions: { bar: recorded },
    });
    const locations = locationsFor("project", environment.cwd);
    const before = await twoScopeFootprint(environment.cwd, state);
    const seen: DependencyTagProbeOptions[] = [];
    const scheduled: string[] = [];
    const transaction: InstallLedgerTransaction = {
      runPhases: (phases, context) => {
        scheduled.push(...phases.map((phase) => phase.name));
        return runPhases(phases, context);
      },
    };

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({
        [`foo@${MARKETPLACE}`]: [
          { name: "bar", ...(declared !== undefined && { version: declared }) },
        ],
      }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set([`bar@${MARKETPLACE}`]),
      knownMarketplaces: new Set([MARKETPLACE]),
      seam: recordingLedgerSeam(environment.cwd, locations, []),
      transaction,
      tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    });

    // assert
    assert.strictEqual(cascade.kind, "installed");
    assert.deepStrictEqual(
      scheduled,
      [`foo@${MARKETPLACE}`],
      "the already-installed dependency never became a ledger phase",
    );
    assert.deepStrictEqual(seen, [], "what could be fetched is not the question being asked");
    assert.deepStrictEqual(
      cascade.alreadyInstalled,
      [{ key: `bar@${MARKETPLACE}`, version: recorded }],
      "RESV-06: a member that was left alone is reported, not omitted",
    );
    assert.deepStrictEqual(
      await twoScopeFootprint(environment.cwd, state),
      before,
      "it is not reinstalled, not re-pinned and not re-declared",
    );
  });
}

for (const { label, declared, recorded, expectedRange } of [
  {
    label: "a plain recorded version below the constraint",
    declared: "^2.0.0",
    recorded: "1.4.0",
    expectedRange: ">=2.0.0 <3.0.0-0",
  },
  {
    label: "a content-hash recorded version whose coerced digits miss the constraint",
    declared: "^1.0.0",
    recorded: "hash-123456789abc",
    expectedRange: ">=1.0.0 <2.0.0-0",
  },
  {
    label: "a git-sha recorded version that normalizes to nothing",
    declared: "^1.0.0",
    recorded: "sha-0123456789ab",
    expectedRange: ">=1.0.0 <2.0.0-0",
  },
]) {
  test(`RESV-05 ${label} fails the cascade naming both the version and the constraint`, async (t) => {
    // arrange: the expected outcomes are DERIVED from the unguarded
    // valid-then-coerce ladder (D-03-04), not from a rejection of this
    // project's own fallback version forms -- there is no such rejection.
    const environment = await createHermeticEnvironment(t, "install-cascade-installed-bad-");
    const state = await seedMarketplace(environment.cwd, ["bar", "foo"], {
      preinstalled: ["bar"],
      gitSourced: ["bar"],
      recordedVersions: { bar: recorded },
    });
    const locations = locationsFor("project", environment.cwd);
    const before = await twoScopeFootprint(environment.cwd, state);
    const seen: DependencyTagProbeOptions[] = [];

    // act
    const cascade = await runInstallCascade({
      state,
      locations,
      rootKey: `foo@${MARKETPLACE}`,
      lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar", version: declared }] }),
      ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
      installedKeys: new Set([`bar@${MARKETPLACE}`]),
      knownMarketplaces: new Set([MARKETPLACE]),
      tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
    });

    // assert
    assert.deepStrictEqual(cascade, {
      kind: "constraint-failed",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: `bar@${MARKETPLACE}`,
        range: expectedRange,
        recordedVersion: recorded,
      },
    });
    assert.deepStrictEqual(seen, [], "an already-installed member is never queried for tags");
    assert.deepStrictEqual(
      await twoScopeFootprint(environment.cwd, state),
      before,
      "the verdict precedes the phase array, so the whole footprint is unchanged",
    );
  });
}

test("RESV-05 an already-installed dependency the snapshot records no version for is left alone", async (t) => {
  // arrange: the caller names a key as installed that its own snapshot does not
  // record, so there is nothing on disk for a constraint to conflict with.
  const environment = await createHermeticEnvironment(t, "install-cascade-installed-none-");
  const state = await seedMarketplace(environment.cwd, ["bar", "foo"]);
  const locations = locationsFor("project", environment.cwd);

  // act
  const cascade = await runInstallCascade({
    state,
    locations,
    rootKey: `foo@${MARKETPLACE}`,
    lookup: catalog({ [`foo@${MARKETPLACE}`]: [{ name: "bar", version: "^2.0.0" }] }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`bar@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    seam: recordingLedgerSeam(environment.cwd, locations, []),
  });

  // assert
  assert.strictEqual(cascade.kind, "installed");
  assert.deepStrictEqual(cascade.alreadyInstalled, [
    { key: `bar@${MARKETPLACE}`, version: undefined },
  ]);
});

test("RESV-05 an already-installed dependency's contradictory declarations fail before any query", async (t) => {
  // arrange: a diamond onto an already-installed member, so its accumulator
  // carries two ranges that cannot both hold.
  const environment = await createHermeticEnvironment(t, "install-cascade-installed-conflict-");
  const state = await seedMarketplace(environment.cwd, ["left", "right", "root", "shared"], {
    preinstalled: ["shared"],
  });
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
      [`right@${MARKETPLACE}`]: [{ name: "shared", version: "^2.0.0" }],
    }),
    ledgerOptionsFor: ledgerOptionsFor(environment.cwd),
    installedKeys: new Set([`shared@${MARKETPLACE}`]),
    knownMarketplaces: new Set([MARKETPLACE]),
    tagProbe: tagProbeAnswering({ kind: "no-matching-tag", range: "unreachable" }, seen),
  });

  // assert
  assert.deepStrictEqual(cascade, {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: `shared@${MARKETPLACE}`,
      range: "^1.0.0 ^2.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
  });
  assert.deepStrictEqual(seen, []);
});
