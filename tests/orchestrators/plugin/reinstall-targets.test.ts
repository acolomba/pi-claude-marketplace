import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test, { type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { selectReinstallTargets } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts";
import { MarketplaceNotAddedSignal } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

function pluginRecord(): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugin",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [], workflows: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function seedScope(
  cwd: string,
  scope: Scope,
  marketplaces: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([marketplace, plugins]) => [
        marketplace,
        {
          name: marketplace,
          scope,
          source: pathSource(`./${marketplace}`),
          addedFromCwd: cwd,
          manifestPath: `${cwd}/${scope}-${marketplace}.json`,
          marketplaceRoot: `${cwd}/${scope}-${marketplace}`,
          plugins: Object.fromEntries(plugins.map((plugin) => [plugin, pluginRecord()])),
        },
      ]),
    ),
  });
}

async function targetEnvironment(testContext: TestContext): Promise<string> {
  const environment = await createHermeticEnvironment(testContext, "reinstall-targets-");
  return environment.cwd;
}

test("returns a frozen plural selection for an empty bare request", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);

  // act
  const selection = await selectReinstallTargets({ cwd, target: { kind: "all" } });

  // assert
  assert.deepStrictEqual(selection, { cardinality: "plural", targets: [] });
  assert.strictEqual(Object.isFrozen(selection.targets), true);
});

test("sorts bare targets by marketplace, plugin, and project-first scope", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { beta: ["zulu"], same: ["alpha"] });
  await seedScope(cwd, "user", { alpha: ["zulu"], same: ["alpha", "beta"] });

  // act
  const selection = await selectReinstallTargets({ cwd, target: { kind: "all" } });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "plural",
    targets: [
      { marketplace: "alpha", plugin: "zulu", scope: "user" },
      { marketplace: "beta", plugin: "zulu", scope: "project" },
      { marketplace: "same", plugin: "alpha", scope: "project" },
      { marketplace: "same", plugin: "alpha", scope: "user" },
      { marketplace: "same", plugin: "beta", scope: "user" },
    ],
  });
});

test("filters an all request to its explicit scope", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { project: ["one"] });
  await seedScope(cwd, "user", { user: ["two"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    scope: "user",
    target: { kind: "all" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "plural",
    targets: [{ marketplace: "user", plugin: "two", scope: "user" }],
  });
});

test("prefers the project container for a bare marketplace request", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { shared: ["project-plugin"] });
  await seedScope(cwd, "user", { shared: ["user-plugin"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "marketplace", marketplace: "shared" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "plural",
    targets: [{ marketplace: "shared", plugin: "project-plugin", scope: "project" }],
  });
});

test("keeps marketplace cardinality plural for one explicit target", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "user", { selected: ["only"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    scope: "user",
    target: { kind: "marketplace", marketplace: "selected" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "plural",
    targets: [{ marketplace: "selected", plugin: "only", scope: "user" }],
  });
});

test("prefers the project record for a bare plugin request", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { shared: ["same"] });
  await seedScope(cwd, "user", { shared: ["same"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "plugin", marketplace: "shared", plugin: "same" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "single",
    targets: [{ marketplace: "shared", plugin: "same", scope: "project" }],
  });
});

test("selects a bare plugin from the user record when project lacks it", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { shared: [] });
  await seedScope(cwd, "user", { shared: ["only-user"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "plugin", marketplace: "shared", plugin: "only-user" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "single",
    targets: [{ marketplace: "shared", plugin: "only-user", scope: "user" }],
  });
});

test("keeps a bare missing plugin in the project marketplace container", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { shared: [] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "plugin", marketplace: "shared", plugin: "missing" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "single",
    targets: [{ marketplace: "shared", plugin: "missing", scope: "project" }],
  });
});

test("keeps a bare missing plugin in a user-only marketplace container", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "user", { shared: [] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "plugin", marketplace: "shared", plugin: "missing" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "single",
    targets: [{ marketplace: "shared", plugin: "missing", scope: "user" }],
  });
});

test("attributes a bare plugin miss without a scope", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      target: { kind: "plugin", marketplace: "missing", plugin: "one" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          requestedScope: error.requestedScope,
        },
        { marketplace: "missing", requestedScope: undefined },
      );
      return true;
    },
  );
});

test("selects an absent plugin from its existing explicit marketplace", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { selected: [] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    scope: "project",
    target: { kind: "plugin", marketplace: "selected", plugin: "missing" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "single",
    targets: [{ marketplace: "selected", plugin: "missing", scope: "project" }],
  });
});

test("attributes an explicit plugin miss to the requested scope", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "user", { selected: ["one"] });

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      scope: "project",
      target: { kind: "plugin", marketplace: "selected", plugin: "one" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          notInstalledAt: error.notInstalledAt,
          plugin: error.plugin,
          requestedScope: error.requestedScope,
        },
        {
          marketplace: "selected",
          notInstalledAt: "project",
          plugin: "one",
          requestedScope: "project",
        },
      );
      return true;
    },
  );
});

test("attributes an explicit marketplace miss without a plugin subject", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "user", { selected: ["one"] });

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      scope: "project",
      target: { kind: "marketplace", marketplace: "selected" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          notInstalledAt: error.notInstalledAt,
          plugin: error.plugin,
          requestedScope: error.requestedScope,
        },
        {
          marketplace: "selected",
          notInstalledAt: undefined,
          plugin: undefined,
          requestedScope: "project",
        },
      );
      return true;
    },
  );
});

test("checks the project scope for an explicit user marketplace miss", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { selected: ["one"] });

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      scope: "user",
      target: { kind: "marketplace", marketplace: "selected" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          requestedScope: error.requestedScope,
        },
        { marketplace: "selected", requestedScope: "user" },
      );
      return true;
    },
  );
});

test("selects a bare marketplace from its user-only container", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "user", { selected: ["only"] });

  // act
  const selection = await selectReinstallTargets({
    cwd,
    target: { kind: "marketplace", marketplace: "selected" },
  });

  // assert
  assert.deepStrictEqual(selection, {
    cardinality: "plural",
    targets: [{ marketplace: "selected", plugin: "only", scope: "user" }],
  });
});

test("attributes an explicit plugin absent from both scopes without a plugin hint", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      scope: "user",
      target: { kind: "plugin", marketplace: "missing", plugin: "one" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          notInstalledAt: error.notInstalledAt,
          plugin: error.plugin,
          requestedScope: error.requestedScope,
        },
        {
          marketplace: "missing",
          notInstalledAt: undefined,
          plugin: undefined,
          requestedScope: "user",
        },
      );
      return true;
    },
  );
});

test("attributes a bare marketplace miss without a scope", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      target: { kind: "marketplace", marketplace: "missing" },
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        {
          marketplace: error.marketplace,
          requestedScope: error.requestedScope,
        },
        { marketplace: "missing", requestedScope: undefined },
      );
      return true;
    },
  );
});

test("reports a marketplace removed after scope resolution", async (testContext) => {
  // arrange
  const cwd = await targetEnvironment(testContext);
  await seedScope(cwd, "project", { selected: ["alpha"] });
  const projectRoot = locationsFor("project", cwd).extensionRoot;
  // The scope resolution reads the project state and finds the marketplace;
  // the next project read, the target expansion, does not. That asymmetry IS
  // the concurrent removal, expressed without racing a real writer.
  const projectLoads: string[] = [];
  const stateReader = async (extensionRoot: string): Promise<ExtensionState> => {
    if (extensionRoot === projectRoot) {
      projectLoads.push(extensionRoot);
      if (projectLoads.length > 1) {
        return { schemaVersion: 2, marketplaces: {} };
      }
    }

    return loadState(extensionRoot);
  };

  // act & assert
  await assert.rejects(
    selectReinstallTargets({
      cwd,
      target: { kind: "marketplace", marketplace: "selected" },
      loadState: stateReader,
    }),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotAddedSignal);
      assert.deepStrictEqual(
        { marketplace: error.marketplace, requestedScope: error.requestedScope },
        { marketplace: "selected", requestedScope: undefined },
      );
      return true;
    },
  );
  assert.deepStrictEqual(projectLoads, [projectRoot, projectRoot]);
});
