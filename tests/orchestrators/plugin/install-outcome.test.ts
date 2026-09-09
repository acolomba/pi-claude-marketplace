import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { runInstallLedger } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function notificationContext(): NotificationContext {
  return { ui: { notify: () => undefined } };
}

async function seedEmptyPlugin(
  cwd: string,
  options: { readonly preinstalled?: boolean } = {},
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
  });

  // assert
  assert.deepStrictEqual(ledgerOutcome, { kind: "marketplace-absent" });
  assert.deepStrictEqual(state, { marketplaces: {}, schemaVersion: 2 });
});

test("projects the complete empty-plugin summary and preserves a caller pin", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-summary-");
  const seeded = await seedEmptyPlugin(environment.cwd);
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    pinVersionOverride: "pinned-by-caller",
    plugin: "empty",
    scope: "project",
  });

  // assert
  assert.deepStrictEqual(ledgerOutcome, {
    kind: "installed",
    summary: {
      frontmatterDegradations: [],
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
      stagedMcpServerNames: [],
    },
  });
  assert.equal(seeded.state.marketplaces.marketplace?.plugins.empty?.version, "pinned-by-caller");
});

test("captures the resolved version when a concurrent record aborts state commit", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-outcome-plugin-race-");
  const seeded = await seedEmptyPlugin(environment.cwd);
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
  const seeded = await seedEmptyPlugin(environment.cwd);
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
  const seeded = await seedEmptyPlugin(environment.cwd, { preinstalled: true });
  const locations = locationsFor("project", environment.cwd);

  // act
  const ledgerOutcome = await runInstallLedger(seeded.state, locations, {
    allowExistingRecord: true,
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "marketplace",
    plugin: "empty",
    scope: "project",
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
