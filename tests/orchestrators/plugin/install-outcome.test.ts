import assert from "node:assert/strict";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { canonicalCloneUrl } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
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
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { createRemovalOpsFake } from "../../platform/removal-ops-fake.ts";

import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
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
  /**
   * Sources whose frontmatter block closes but whose inner YAML does not
   * parse. The bridge synthesizes a degraded artifact and records the parse
   * error rather than failing the install.
   */
  readonly malformedSkills?: readonly string[];
  readonly malformedCommands?: readonly string[];
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

  // `name: [unterminated` closes its `---` block but is not parseable YAML.
  for (const skill of components.malformedSkills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: [unterminated\n---\n\nBody.\n`);
  }

  for (const command of components.malformedCommands ?? []) {
    await mkdir(path.join(pluginRoot, "commands"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, "commands", `${command}.md`),
      `---\nname: [unterminated\n---\n\nBody.\n`,
    );
  }
}

interface SeedOptions {
  readonly preinstalled?: boolean;
  readonly components?: SeededComponents;
  /** Extra members merged into the plugin's own `.claude-plugin/plugin.json`. */
  readonly pluginJson?: Record<string, unknown>;
  /** Written to `<pluginRoot>/hooks/hooks.json`, which is what populates `hooksConfigPath`. */
  readonly hooksJson?: object;
  /** Written to `<pluginRoot>/.mcp.json`, which is what gives the mcp phase work to do. */
  readonly mcpServers?: Record<string, unknown>;
  /**
   * CMP-3: park the marketplace record in USER-scope state on disk and hand the
   * caller an EMPTY project state, so the project-target install has to fall
   * back to the user-scope source and adopt a clone of it.
   */
  readonly marketplaceScope?: "user" | "project";
  /**
   * A git-backed `source` for the manifest entry. The plugin tree then lives at
   * `<cwd>/repo-fixture` -- where a clone would put it -- rather than under the
   * marketplace root, so the only way to reach it is the resolver's
   * `resolveGitPluginRoot` callback.
   */
  readonly gitSource?: unknown;
}

async function seedPlugin(
  cwd: string,
  options: SeedOptions = {},
): Promise<{ readonly pluginRoot: string; readonly state: ExtensionState }> {
  const marketplaceRoot = path.join(cwd, "marketplace");
  const pluginRoot =
    options.gitSource === undefined
      ? path.join(marketplaceRoot, "plugins", "empty")
      : path.join(cwd, "repo-fixture");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "empty", version: "0.0.1", ...options.pluginJson }),
  );
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "marketplace",
      plugins: [{ name: "empty", source: options.gitSource ?? "./plugins/empty" }],
    }),
  );
  await writeComponents(pluginRoot, options.components ?? {});
  if (options.hooksJson !== undefined) {
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, "hooks", "hooks.json"),
      JSON.stringify(options.hooksJson),
    );
  }

  if (options.mcpServers !== undefined) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: options.mcpServers }),
    );
  }

  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      marketplace: {
        name: "marketplace",
        scope: options.marketplaceScope ?? "project",
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
  const scope = options.marketplaceScope ?? "project";
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, { ...state, marketplaces: { ...state.marketplaces } });
  if (scope === "user") {
    return { pluginRoot, state: { marketplaces: {}, schemaVersion: 2 } };
  }

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
   *
   * This is a stated trade against
   * `.claude/rules/typescript-unit-testing.md`'s "build expected values
   * independently": the cases interpolate this value into their expected
   * message, so the assertion cannot fail on a wrong path WITHIN the right
   * staging parent. The parent is the part the case can pin and does -- the
   * filter below accepts only a target under the bridge's own staging dir, and
   * only one such target -- while the UUID segment is minted by production and
   * is not predictable from outside it.
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

/**
 * The preflight's three refusals and its two adoption arms. All five run
 * BEFORE the ledger, so each is observed as the ledger's own throw or as the
 * state mutation it made on the way through, not as a notification row --
 * `install-flow.ts` owns the rendering and keeps its own cases for it.
 */
test("throws already-installed when a target-scope record exists and the caller did not opt in", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-already-");
  const seeded = await seedPlugin(environment.cwd, { preinstalled: true });
  const locations = locationsFor("project", environment.cwd);

  // act
  const operation = runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PluginShapeError);
    assert.deepStrictEqual(error.shape, {
      kind: "already-installed",
      marketplace: "marketplace",
      plugin: "empty",
    });
    assert.equal(
      error.message,
      'Plugin "empty" is already installed in marketplace "marketplace".',
    );
    return true;
  });
  // The refusal is a precondition, not a rollback: the recorded row is the one
  // the fixture seeded, untouched.
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty?.version, "recorded");
});

test("throws not-in-manifest for a plugin the cached manifest does not carry", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-not-in-manifest-");
  const seeded = await seedPlugin(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  const operation = runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "ghost",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PluginShapeError);
    assert.deepStrictEqual(error.shape, {
      kind: "not-in-manifest",
      marketplace: "marketplace",
      plugin: "ghost",
    });
    assert.equal(error.message, 'Plugin "ghost" not found in marketplace "marketplace".');
    return true;
  });
  assert.deepStrictEqual(seeded.state.marketplaces.marketplace?.plugins, {});
});

test("CMP-3: a project-target install adopts a clone of the user-scope marketplace record", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-cmp3-");
  const seeded = await seedPlugin(environment.cwd, { marketplaceScope: "user" });
  const locations = locationsFor("project", environment.cwd);
  assert.deepStrictEqual(seeded.state.marketplaces, {});

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.equal(ledgerOutcome.kind, "installed");
  const adopted = seeded.state.marketplaces.marketplace;
  assert.ok(adopted !== undefined);
  // The adopted container keeps the source record's paths and takes the TARGET
  // scope, and the install it carries is the first one in it.
  assert.equal(adopted.scope, "project");
  assert.equal(adopted.marketplaceRoot, path.join(environment.cwd, "marketplace"));
  assert.deepStrictEqual(Object.keys(adopted.plugins), ["empty"]);
});

test("--partial admits the partially-available arm the default gate refuses", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-partial-");
  const seeded = await seedPlugin(environment.cwd, {
    // D-64-06: declaring experimental kinds drives `resolveStrict` to the
    // `partially-available` arm without any structural defect.
    pluginJson: { experimental: { themes: "./themes", monitors: "./monitors.json" } },
  });
  const locations = locationsFor("project", environment.cwd);
  const options = {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project" as const,
    removalOps: createRemovalOps(),
  };

  // act
  const blocked = runInstallLedger(seeded.state, locations, options);

  // assert
  await assert.rejects(blocked, (error: unknown) => {
    assert.ok(error instanceof PluginShapeError);
    assert.equal(error.shape.kind, "not-installable");
    return true;
  });

  // act: the same fixture with the widened gate
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ...options,
    partial: true,
  });

  // assert
  assert.ok(ledgerOutcome.kind === "installed");
  assert.equal(ledgerOutcome.summary.resolved.state, "partially-available");
  // INV-1 / D-66-01: a partial install persists the REAL compatibility, so a
  // later backfill can promote the record when the supported set grows.
  assert.equal(
    seeded.state.marketplaces.marketplace?.plugins.empty?.compatibility.installable,
    false,
  );
});

test("collects the per-source frontmatter degrade records from the skills and commands bridges", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-degraded-");
  const seeded = await seedPlugin(environment.cwd, {
    components: { malformedSkills: ["bad-skill"], malformedCommands: ["bad-command"] },
  });
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.ok(ledgerOutcome.kind === "installed");
  // SKILL-01 / CMD-01 / WARN-01: a malformed source is a DEGRADE, not a
  // failure, and the ledger tags each record with the bridge that produced it
  // so the row can name the kinds it degraded.
  assert.deepStrictEqual(
    ledgerOutcome.summary.frontmatterDegradations.map((record) => record.kind),
    ["skill", "command"],
  );
  assert.deepStrictEqual(ledgerOutcome.summary.stagedSkillNames, ["empty-bad-skill"]);
  assert.deepStrictEqual(ledgerOutcome.summary.stagedCommandNames, ["empty:bad-command"]);
});

test("AS-7: a foreign file under a generated agent name lands on agentForeignFailures, not the rollback path", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-agent-foreign-");
  const seeded = await seedPlugin(environment.cwd, { components: { agents: ["gamma"] } });
  const locations = locationsFor("project", environment.cwd);
  const generatedName = "pi-claude-marketplace-empty-gamma";
  await mkdir(locations.agentsDir, { recursive: true });
  // No ownership marker in the body, so the bridge refuses to overwrite it.
  await writeFile(
    path.join(locations.agentsDir, `${generatedName}.md`),
    "---\nname: foreign\n---\n\nNo marker.\n",
  );
  await writeFile(
    locations.agentsIndexPath,
    JSON.stringify({
      schemaVersion: 1,
      agents: [
        {
          plugin: "empty",
          marketplace: "marketplace",
          sourceAgent: "gamma",
          generatedName,
          sourcePath: path.join(seeded.pluginRoot, "agents", "gamma.md"),
          targetPath: path.join(locations.agentsDir, `${generatedName}.md`),
          sourceHash: "seeded",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    }),
  );

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.ok(ledgerOutcome.kind === "installed");
  assert.deepStrictEqual(
    ledgerOutcome.summary.agentForeignFailures.map((failure) => failure.generatedName),
    [generatedName],
  );
  // AS-7: the install SUCCEEDED. A preserved foreign row is the user's problem
  // to resolve by hand, not a reason to unwind the plugin around it.
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty?.enabled, true);
});

const SESSION_START_HOOKS = {
  hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }] },
};

test("writes the hooks config and records the plugin's hooks slug on the state row", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-hooks-");
  const seeded = await seedPlugin(environment.cwd, { hooksJson: SESSION_START_HOOKS });
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.ok(ledgerOutcome.kind === "installed");
  // LIFE-01: the phase re-reads and re-parses the plugin's own hooks.json and
  // writes the supported subset through the bridge's per-plugin slot.
  const written: unknown = JSON.parse(
    await readFile(path.join(locations.hooksDir, "empty", "hooks.json"), "utf8"),
  );
  assert.deepStrictEqual(written, SESSION_START_HOOKS.hooks);
  // D-100-01 / HOOK-02 / D-57-01: the record describes the hooks the install
  // materialized and carries the plugin id as its hooks-container slug, so a
  // later `info` need not read the config back off disk.
  const record = seeded.state.marketplaces.marketplace?.plugins.empty;
  assert.deepStrictEqual(record?.resources.hooks, ["empty"]);
  assert.deepStrictEqual(
    record?.hookEntries?.map((entry) => entry.event),
    ["SessionStart"],
  );
});

test("an mcp phase that cannot even prepare unwinds the hooks config the phase before it wrote", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-mcp-unwind-");
  const seeded = await seedPlugin(environment.cwd, {
    components: { skills: ["alpha"] },
    hooksJson: SESSION_START_HOOKS,
    mcpServers: { server1: { command: "node", args: ["s.js"] } },
  });
  const locations = locationsFor("project", environment.cwd);
  // Occupying `<scopeRoot>/mcp.json` with a DIRECTORY fails the mcp phase
  // before it prepares anything, which is what makes the hooks phase's undo --
  // a real removal, not a staging discard -- run.
  await mkdir(locations.mcpJsonPath, { recursive: true });
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
  await assert.rejects(operation);
  const survives = async (candidate: string): Promise<boolean> =>
    stat(candidate).then(
      () => true,
      () => false,
    );
  assert.equal(await survives(path.join(locations.hooksDir, "empty", "hooks.json")), false);
  assert.equal(await survives(path.join(locations.skillsTargetDir, "empty-alpha")), false);
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty, undefined);
  // Every undo ran to completion; nothing was left half-unwound.
  assert.deepStrictEqual(capture.rollbackPartials, []);
});

/**
 * A bridge whose prepare throws never reaches its `c.<kind>Prep` assignment,
 * so the undo the ledger still invokes for the FAILING phase has nothing to
 * discard and returns immediately. A symlink occupying the generated target
 * name is what makes prepare refuse: `assertPathInside` walks the segment
 * below the target root and rejects it (PS-1), which is the same refusal a
 * hostile tree would produce.
 */
async function assertFailingPhaseUndoIsInert(
  t: TestContext,
  options: {
    readonly prefix: string;
    readonly components: SeededComponents;
    readonly targetDir: (locations: ScopedLocations) => string;
    readonly generatedName: string;
  },
): Promise<void> {
  // arrange
  const environment = await createHermeticEnvironment(t, options.prefix);
  const seeded = await seedPlugin(environment.cwd, { components: options.components });
  const locations = locationsFor("project", environment.cwd);
  const targetDir = options.targetDir(locations);
  await mkdir(targetDir, { recursive: true });
  await symlink("/nonexistent-decoy", path.join(targetDir, options.generatedName));
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
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PathContainmentError);
    return true;
  });
  // PI-14: the failing phase's own undo found nothing staged, so it added no
  // rollback partial -- and the containment refusal reaches the caller
  // verbatim rather than wrapped in one.
  assert.deepStrictEqual(capture.rollbackPartials, []);
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty, undefined);
}

test("a skills prepare that refuses leaves the skills phase with nothing to undo", async (t) => {
  await assertFailingPhaseUndoIsInert(t, {
    prefix: "install-outcome-skills-refuse-",
    components: { skills: ["alpha"] },
    targetDir: (locations) => locations.skillsTargetDir,
    generatedName: "empty-alpha",
  });
});

test("a commands prepare that refuses leaves the commands phase with nothing to undo", async (t) => {
  await assertFailingPhaseUndoIsInert(t, {
    prefix: "install-outcome-commands-refuse-",
    components: { skills: ["alpha"], commands: ["beta"] },
    targetDir: (locations) => locations.promptsTargetDir,
    generatedName: "empty:beta.md",
  });
});

test("an agents prepare that refuses leaves the agents phase with nothing to undo", async (t) => {
  await assertFailingPhaseUndoIsInert(t, {
    prefix: "install-outcome-agents-refuse-",
    components: { skills: ["alpha"], agents: ["gamma"] },
    targetDir: (locations) => locations.agentsDir,
    generatedName: "pi-claude-marketplace-empty-gamma.md",
  });
});

test("stages the declared mcp servers and records their generated names", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-mcp-");
  const seeded = await seedPlugin(environment.cwd, {
    mcpServers: { server1: { command: "node", args: ["s.js"] } },
  });
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
  });

  // assert
  assert.ok(ledgerOutcome.kind === "installed");
  assert.deepStrictEqual(ledgerOutcome.summary.stagedMcpServerNames, ["server1"]);
  assert.deepStrictEqual(
    seeded.state.marketplaces.marketplace?.plugins.empty?.resources.mcpServers,
    ["server1"],
  );
});

/** A full 40-hex commit id, so the `sha-<12hex>` derivation has real bytes to cut. */
const RESOLVED_SHA = "0123456789abcdef0123456789abcdef01234567";

test("PURL-09 / D-77-01 / D-77-02: a git-source install takes its root and its version from the clone probe", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-git-");
  const seeded = await seedPlugin(environment.cwd, {
    gitSource: { source: "url", url: "https://example.com/org/repo", sha: RESOLVED_SHA },
    components: { skills: ["alpha"] },
  });
  const locations = locationsFor("project", environment.cwd);
  const probed: unknown[] = [];

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
    // The ledger injects THIS policy into the resolver, which stays
    // network-free: the resolver hands the parsed git source back and the
    // callback answers with the clone-anchored plugin root plus the sha it
    // captured on the way past.
    cloneProbe: async (options) => {
      probed.push(options.source);
      return Promise.resolve({
        result: { kind: "materialized", pluginRoot: seeded.pluginRoot, resolvedSha: RESOLVED_SHA },
        resolvedSha: RESOLVED_SHA,
      });
    },
  });

  // assert
  assert.deepStrictEqual(probed, [
    {
      kind: "url",
      raw: "https://example.com/org/repo",
      sha: RESOLVED_SHA,
      url: "https://example.com/org/repo",
    },
  ]);
  assert.ok(ledgerOutcome.kind === "installed");
  assert.equal(ledgerOutcome.summary.resolved.pluginRoot, seeded.pluginRoot);
  // D-77-01: a git source takes the `sha-<12hex>` version over the 3-tier
  // ladder, and D-77-02 persists the full 40-hex sha beside it.
  assert.equal(ledgerOutcome.summary.version, "sha-0123456789ab");
  const record = seeded.state.marketplaces.marketplace?.plugins.empty;
  assert.equal(record?.version, "sha-0123456789ab");
  assert.equal(record?.resolvedSha, RESOLVED_SHA);
});

test("the callback reaches the real clone probe through the ledger's own cache, credential, and memo seams", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-git-seam-");
  const seeded = await seedPlugin(environment.cwd, {
    gitSource: { source: "url", url: "https://example.com/org/repo", sha: RESOLVED_SHA },
    components: { skills: ["alpha"] },
  });
  const locations = locationsFor("project", environment.cwd);
  const cloned: Array<{ readonly cloneUrl: string; readonly pin: string }> = [];
  // No `cloneProbe` override here: the callback falls through to the REAL
  // probe, which is kept network-free by the cache seam below. That seam, the
  // credential collaborator, and the per-host memo are the three optional
  // members the callback forwards only when the caller supplied them.
  const authMemo = new Map<string, AuthAttemptResult>();
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      expires_in: 900,
      interval: 0,
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
    },
  });

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
    removalOps: createRemovalOps(),
    authMemo,
    deviceFlowHttp: deviceFlow.http,
    cloneCacheSeam: {
      resolvePluginPin: (args) =>
        Promise.resolve({ cloneUrl: canonicalCloneUrl(args.source), pin: RESOLVED_SHA }),
      materializePluginClone: (args) => {
        cloned.push({ cloneUrl: args.cloneUrl, pin: args.pin });
        return Promise.resolve(seeded.pluginRoot);
      },
      materializeOrRefreshPluginMirror: () =>
        Promise.reject(new Error("a sha-pinned source must not reach the mirror path")),
    },
  });

  // assert
  // PURL-04: a sha-pinned source resolves its pin and clones it once; the
  // unpinned mirror path is never taken.
  assert.deepStrictEqual(cloned, [{ cloneUrl: "https://example.com/org/repo", pin: RESOLVED_SHA }]);
  assert.ok(ledgerOutcome.kind === "installed");
  assert.equal(ledgerOutcome.summary.resolved.pluginRoot, seeded.pluginRoot);
  assert.equal(ledgerOutcome.summary.version, "sha-0123456789ab");
  // A path source needs no credential, so the device flow is threaded but
  // never consulted.
  assert.deepStrictEqual(deviceFlow.calls.requestCode, []);
});
