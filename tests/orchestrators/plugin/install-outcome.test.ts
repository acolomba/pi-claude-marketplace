import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  installedPluginOutcome,
  runInstallLedger,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { createRemovalOpsFake } from "../../platform/removal-ops-fake.ts";

import type { InstallLedgerSummary } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

function notificationContext(): NotificationContext {
  return { ui: { notify: () => undefined } };
}

/**
 * The plugin component sources a case needs on disk. A bridge whose kind is
 * absent here prepares a `noop`, and a `noop` commit returns before its
 * cleanup runs -- so a case that drives a bridge's commit path at all must
 * seed at least one component of that kind.
 */
interface SeededComponents {
  readonly skills?: readonly string[];
  readonly commands?: readonly string[];
  readonly agents?: readonly string[];
}

async function writeComponents(pluginRoot: string, components: SeededComponents): Promise<void> {
  for (const skill of components.skills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${skill}\n---\n\nBody.\n`);
  }

  for (const command of components.commands ?? []) {
    await mkdir(path.join(pluginRoot, "commands"), { recursive: true });
    await writeFile(path.join(pluginRoot, "commands", `${command}.md`), `# ${command}\nBody.\n`);
  }

  for (const agent of components.agents ?? []) {
    await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, "agents", `${agent}.md`),
      `---\nname: ${agent}\ndescription: ${agent} agent\ntools: Read,Grep\n---\n\nBody.\n`,
    );
  }
}

async function seedPlugin(
  cwd: string,
  options: {
    readonly preinstalled?: boolean;
    readonly components?: SeededComponents;
  } = {},
): Promise<{ readonly pluginRoot: string; readonly state: ExtensionState }> {
  const marketplaceRoot = path.join(cwd, "marketplace");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "empty");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "empty", version: "0.0.1" }),
  );
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "marketplace",
      plugins: [{ name: "empty", source: "./plugins/empty" }],
    }),
  );
  await writeComponents(pluginRoot, options.components ?? {});
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      marketplace: {
        name: "marketplace",
        scope: "project",
        source: pathSource("./marketplace"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins:
          options.preinstalled === true
            ? {
                empty: {
                  version: "recorded",
                  resolvedSource: pluginRoot,
                  compatibility: {
                    installable: true,
                    notes: [],
                    supported: [],
                    unsupported: [],
                  },
                  resources: { skills: [], prompts: [], agents: [], hooks: [], mcpServers: [] },
                  enabled: false,
                  installedAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              }
            : {},
      },
    },
  };
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, state);
  return { pluginRoot, state: await loadState(locations.extensionRoot) };
}

test("returns the marketplace-absent discriminant without mutating state", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-absent-");
  const locations = locationsFor("project", environment.cwd);
  const state: ExtensionState = { marketplaces: {}, schemaVersion: 2 };

  // act
  const ledgerOutcome = await runInstallLedger(state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "missing",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.deepStrictEqual(ledgerOutcome, { kind: "marketplace-absent" });
  assert.deepStrictEqual(state, { marketplaces: {}, schemaVersion: 2 });
});

test("projects the complete empty-plugin summary and preserves a caller pin", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-summary-");
  const seeded = await seedPlugin(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    pinVersionOverride: "pinned-by-caller",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.deepStrictEqual(ledgerOutcome, {
    kind: "installed",
    summary: {
      agentForeignFailures: [],
      bridgeWarnings: [],
      cwd: environment.cwd,
      discoveryWarnings: [],
      frontmatterDegradations: [],
      locations,
      marketplace: "marketplace",
      plugin: "empty",
      pluginDataDir: path.join(locations.dataRoot, "marketplace", "empty"),
      resolved: {
        componentPaths: { agents: [], commands: [], skills: [] },
        defaultEnabled: true,
        installable: true,
        mcpServers: {},
        name: "empty",
        notes: [],
        pluginRoot: seeded.pluginRoot,
        state: "installable",
        supported: [],
        unsupported: [],
      },
      stagedAgentNames: [],
      stagedCommandNames: [],
      stagedMcpServerNames: [],
      stagedSkillNames: [],
      version: "pinned-by-caller",
    },
  });
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty?.version, "pinned-by-caller");

  assert.equal(ledgerOutcome.kind, "installed");
  assert.deepStrictEqual(installedPluginOutcome(ledgerOutcome.summary, [], false), {
    declaresAgents: false,
    declaresMcp: false,
    resourcesChanged: false,
    status: "installed",
    version: "pinned-by-caller",
  });

  const richSummary = {
    ...ledgerOutcome.summary,
    frontmatterDegradations: [
      { generatedName: "broken", kind: "skill" as const, parseError: "bad yaml" },
      { generatedName: "also-broken", kind: "skill" as const, parseError: "bad yaml" },
      { generatedName: "broken-command", kind: "command" as const, parseError: "bad yaml" },
    ],
    resolved: {
      ...ledgerOutcome.summary.resolved,
      orphanRewake: true,
      state: "partially-available" as const,
      unsupported: ["hooks"],
    },
    stagedAgentNames: ["agent"],
    stagedCommandNames: ["command"],
    stagedMcpServerNames: ["server"],
    stagedSkillNames: ["skill"],
  };
  assert.deepStrictEqual(installedPluginOutcome(richSummary, ["warning"], true), {
    declaresAgents: true,
    declaresMcp: true,
    degradedKinds: ["skill", "command"],
    landedDisabled: true,
    orphanRewake: true,
    postCommitWarnings: ["warning"],
    resourcesChanged: false,
    status: "installed",
    unsupported: ["hooks"],
    version: "pinned-by-caller",
  });
});

test("captures the resolved version when a concurrent record aborts state commit", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-plugin-race-");
  const seeded = await seedPlugin(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const marketplace = seeded.state.marketplaces.marketplace;
  assert.ok(marketplace !== undefined);
  const racedRecord: ExtensionState["marketplaces"][string]["plugins"][string] = {
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    resolvedSource: "/raced/plugin",
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [] },
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: "raced",
  };
  let pluginReads = 0;
  marketplace.plugins = new Proxy(marketplace.plugins, {
    get(target, property, receiver): unknown {
      if (property === "empty") {
        pluginReads += 1;
        return pluginReads >= 2 ? racedRecord : undefined;
      }

      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const capture = { rollbackPartials: [], version: undefined };

  // act
  const operation = runInstallLedger(
    seeded.state,
    locations,
    {
      ctx: notificationContext(),
      cwd: environment.cwd,
      marketplace: "marketplace",
      plugin: "empty",
      scope: "project",
      removalOps: createRemovalOps(),
    },
    capture,
  );

  // assert
  await assert.rejects(operation, {
    message: 'Plugin "empty" was installed concurrently in marketplace "marketplace".',
    name: "ConcurrentInstallError",
  });
  assert.equal(pluginReads, 2);
  assert.deepStrictEqual(capture, { rollbackPartials: [], version: "0.0.1" });
});

test("unwinds when the marketplace disappears before state commit", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-marketplace-race-");
  const seeded = await seedPlugin(environment.cwd);
  const locations = locationsFor("project", environment.cwd);
  const marketplace = seeded.state.marketplaces.marketplace;
  assert.ok(marketplace !== undefined);
  let marketplaceReads = 0;
  seeded.state.marketplaces = new Proxy(seeded.state.marketplaces, {
    get(target, property, receiver): unknown {
      if (property === "marketplace") {
        marketplaceReads += 1;
        return marketplaceReads >= 4 ? undefined : marketplace;
      }

      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const capture = { rollbackPartials: [], version: undefined };

  // act
  const operation = runInstallLedger(
    seeded.state,
    locations,
    {
      ctx: notificationContext(),
      cwd: environment.cwd,
      marketplace: "marketplace",
      plugin: "empty",
      scope: "project",
      removalOps: createRemovalOps(),
    },
    capture,
  );

  // assert
  await assert.rejects(operation, {
    message: 'Marketplace "marketplace" disappeared from state during install of "empty".',
    name: "Error",
  });
  assert.equal(marketplaceReads, 4);
  assert.deepStrictEqual(capture, { rollbackPartials: [], version: "0.0.1" });
});

test("preserves installedAt while replacing an existing disabled record", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-existing-");
  const seeded = await seedPlugin(environment.cwd, { preinstalled: true });
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    allowExistingRecord: true,
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.equal(ledgerOutcome.kind, "installed");
  assert.deepStrictEqual(seeded.state.marketplaces.marketplace?.plugins.empty, {
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    resolvedSource: seeded.pluginRoot,
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [] },
    updatedAt: seeded.state.marketplaces.marketplace?.plugins.empty?.updatedAt,
    version: "0.0.1",
  });
  assert.notEqual(
    seeded.state.marketplaces.marketplace?.plugins.empty?.updatedAt,
    "2026-01-01T00:00:00.000Z",
  );
});

/**
 * The three `commitPrepared*` leak arms, one case per bridge.
 *
 * `commitPrepared{Skills,Commands,Agents}` answers a leak string only when its
 * final `cleanupStaging` fails, and the ledger pushes that string onto
 * `bridgeWarnings`. RCOV-02 / D-08-12: `InstallLedgerOptions.removalOps` is
 * required and this module constructs nothing, so the arm is reachable from
 * here by handing the ledger a collaborator that faults ONE bridge's staging
 * cleanup and leaves the other two alone.
 *
 * A cleanup leak is a WARNING, not a failure -- the staged bytes are already
 * renamed into place when it fires -- so each case pins that the install still
 * landed and that the faulted bridge's own staged name survived.
 *
 * The bridge under test must have at least one component source: a bridge with
 * nothing to stage prepares a `noop`, and a `noop` commit returns before its
 * cleanup runs at all.
 */
interface FaultedCleanup {
  readonly summary: InstallLedgerSummary;
  /**
   * The staging root the faulted cleanup was actually given. It is
   * `<stagingDir>/<randomUUID()>`, minted inside the prepare call, so the case
   * reads the target the port received rather than predicting it. Exactly one
   * removal under that directory must have been attempted, or the expected
   * message could be built from some other bridge's call.
   */
  readonly stagingRoot: string;
}

async function installWithFaultedStagingCleanup(
  t: TestContext,
  options: {
    readonly prefix: string;
    readonly components: SeededComponents;
    readonly stagingDir: (locations: ScopedLocations) => string;
  },
): Promise<FaultedCleanup> {
  const environment = await createHermeticEnvironment(t, options.prefix);
  const seeded = await seedPlugin(environment.cwd, { components: options.components });
  const locations = locationsFor("project", environment.cwd);
  const stagingDir = options.stagingDir(locations);
  const removal = createRemovalOpsFake({
    boundary: "memory",
    rmParentErrors: [
      [stagingDir, Object.assign(new Error("staging cleanup denied"), { code: "EACCES" })],
    ],
  });

  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: removal.removalOps,
  });

  assert.ok(ledgerOutcome.kind === "installed");
  const attempted = removal.calls.rm
    .map((call) => call.target)
    .filter((target) => target.startsWith(`${stagingDir}${path.sep}`));
  assert.equal(attempted.length, 1);
  return { summary: ledgerOutcome.summary, stagingRoot: attempted[0] ?? "" };
}

test("surfaces the skills staging cleanup leak and still lands the install", async (t) => {
  // arrange + act
  const installed = await installWithFaultedStagingCleanup(t, {
    prefix: "install-outcome-skills-leak-",
    components: { skills: ["alpha"] },
    stagingDir: (locations) => locations.skillsStagingDir,
  });

  // assert
  assert.deepStrictEqual(installed.summary.bridgeWarnings, [
    `failed to clean up skills staging directory at ${installed.stagingRoot}: staging cleanup denied`,
  ]);
  assert.deepStrictEqual(installed.summary.stagedSkillNames, ["empty-alpha"]);
});

test("surfaces the commands staging cleanup leak and still lands the install", async (t) => {
  // arrange + act
  const installed = await installWithFaultedStagingCleanup(t, {
    prefix: "install-outcome-commands-leak-",
    components: { commands: ["beta"] },
    stagingDir: (locations) => locations.commandsStagingDir,
  });

  // assert
  assert.deepStrictEqual(installed.summary.bridgeWarnings, [
    `failed to clean up commands staging directory at ${installed.stagingRoot}: staging cleanup denied`,
  ]);
  assert.deepStrictEqual(installed.summary.stagedCommandNames, ["empty:beta"]);
});

test("surfaces the agents staging cleanup leak and still lands the install", async (t) => {
  // arrange + act
  const installed = await installWithFaultedStagingCleanup(t, {
    prefix: "install-outcome-agents-leak-",
    components: { agents: ["gamma"] },
    stagingDir: (locations) => locations.agentsStagingDir,
  });

  // assert
  assert.deepStrictEqual(installed.summary.bridgeWarnings, [
    `failed to clean up agents staging directory at ${installed.stagingRoot}: staging cleanup denied`,
  ]);
  assert.deepStrictEqual(installed.summary.stagedAgentNames, ["pi-claude-marketplace-empty-gamma"]);
});
