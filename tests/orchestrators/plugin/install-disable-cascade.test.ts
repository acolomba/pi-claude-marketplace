import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { UnstageOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  InstallDisableCascadeOwner,
  InstallHooksRouting,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type OwnerModule =
  typeof import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts");

const INSTALLED_AT = "2026-01-01T00:00:00.000Z";
const UPDATED_AT = "2026-02-02T00:00:00.000Z";

async function loadOwner(): Promise<OwnerModule> {
  let owner: OwnerModule | undefined;
  await assert.doesNotReject(async () => {
    owner =
      await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts");
  }, "install-disable-cascade.ts must own the disabled-install contract");
  assert.ok(owner !== undefined);
  return owner;
}

function installedState(): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      marketplace: {
        name: "marketplace",
        scope: "project",
        source: pathSource("./marketplace"),
        addedFromCwd: "/workspace",
        manifestPath: "/workspace/marketplace/.claude-plugin/marketplace.json",
        marketplaceRoot: "/workspace/marketplace",
        plugins: {
          plugin: {
            version: "1.2.3",
            resolvedSource: "/workspace/marketplace/plugin",
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "commands", "agents", "hooks", "mcpServers"],
              unsupported: [],
            },
            resources: {
              skills: ["skill-a", "skill-b"],
              prompts: ["command-a", "command-b"],
              agents: ["agent-a", "agent-b"],
              hooks: ["plugin"],
              mcpServers: ["server-a", "server-b"],
            },
            enabled: true,
            installedAt: INSTALLED_AT,
            updatedAt: INSTALLED_AT,
          },
        },
      },
    },
  };
}

function hooksRouting(): InstallHooksRouting {
  return {
    readAndCachePluginHooks: () => Promise.resolve(),
    rebuildRoutingTables: () => undefined,
    removePluginConfigFromCache: () => undefined,
  };
}

function composeOwner(
  owner: OwnerModule,
  unstagePlugin: () => Promise<UnstageOutcome>,
): InstallDisableCascadeOwner {
  return owner.composeInstallDisableCascade({
    hooksRouting: hooksRouting(),
    now: () => UPDATED_AT,
    unstagePlugin,
  });
}

test("disables a freshly installed record after a clean five-kind cascade", async () => {
  // arrange
  const owner = await loadOwner();
  const state = installedState();
  const cascade = composeOwner(owner, () =>
    Promise.resolve({
      ok: true,
      dropped: {
        skills: ["skill-a", "skill-b"],
        commands: ["command-a", "command-b"],
        agents: ["agent-a", "agent-b"],
        hooks: ["plugin"],
        mcpServers: ["server-a", "server-b"],
      },
    }),
  );

  // act
  const disableOutcome = await cascade.disableFreshInstall({
    state,
    scope: "project",
    locations: locationsFor("project", "/workspace"),
    marketplace: "marketplace",
    plugin: "plugin",
  });

  // assert
  assert.deepStrictEqual(disableOutcome, { ok: true, removeRoutes: true });
  assert.deepStrictEqual(state.marketplaces.marketplace?.plugins.plugin, {
    version: "1.2.3",
    resolvedSource: "/workspace/marketplace/plugin",
    compatibility: {
      installable: true,
      notes: [],
      supported: ["skills", "commands", "agents", "hooks", "mcpServers"],
      unsupported: [],
    },
    resources: {
      skills: ["skill-a", "skill-b"],
      prompts: ["command-a", "command-b"],
      agents: ["agent-a", "agent-b"],
      hooks: ["plugin"],
      mcpServers: ["server-a", "server-b"],
    },
    enabled: false,
    installedAt: INSTALLED_AT,
    updatedAt: UPDATED_AT,
  });
});

test("returns the internal failure without running an unstage when the record is missing", async () => {
  // arrange
  const owner = await loadOwner();
  const state = installedState();
  delete state.marketplaces.marketplace?.plugins.plugin;
  const cascade = composeOwner(owner, () => Promise.reject(new Error("unstage must not run")));

  // act
  const disableOutcome = await cascade.disableFreshInstall({
    state,
    scope: "project",
    locations: locationsFor("project", "/workspace"),
    marketplace: "marketplace",
    plugin: "plugin",
  });

  // assert
  assert.equal(disableOutcome.ok, false);
  assert.equal(disableOutcome.removeRoutes, false);
  assert.equal(
    disableOutcome.ok ? undefined : disableOutcome.cause.message,
    'installPlugin: internal error -- the state phase left no record for plugin "plugin" to disable.',
  );
  assert.deepStrictEqual(state.marketplaces.marketplace?.plugins, {});
});

for (const row of [
  { hooks: ["plugin"], expectedRemoveRoutes: true },
  { hooks: [], expectedRemoveRoutes: false },
] as const) {
  test(`folds a partial cascade with removeRoutes ${row.expectedRemoveRoutes.toString()}`, async () => {
    // arrange
    const owner = await loadOwner();
    const state = installedState();
    const cause = new Error("agents could not be removed");
    const cascade = composeOwner(owner, () =>
      Promise.resolve({
        ok: false,
        dropped: {
          skills: ["skill-a"],
          commands: ["command-a"],
          agents: ["agent-a"],
          hooks: row.hooks,
          mcpServers: ["server-a"],
        },
        cause,
      }),
    );

    // act
    const disableOutcome = await cascade.disableFreshInstall({
      state,
      scope: "project",
      locations: locationsFor("project", "/workspace"),
      marketplace: "marketplace",
      plugin: "plugin",
    });

    // assert
    assert.deepStrictEqual(disableOutcome, {
      ok: false,
      cause,
      removeRoutes: row.expectedRemoveRoutes,
    });
    assert.deepStrictEqual(state.marketplaces.marketplace?.plugins.plugin?.resources, {
      skills: ["skill-b"],
      prompts: ["command-b"],
      agents: ["agent-b"],
      hooks: row.expectedRemoveRoutes ? [] : ["plugin"],
      mcpServers: ["server-b"],
    });
    assert.equal(state.marketplaces.marketplace?.plugins.plugin?.updatedAt, UPDATED_AT);
  });
}

test("drops cached hooks before rebuilding routes after the saved disable", async () => {
  // arrange
  const owner = await loadOwner();
  const calls: string[] = [];
  const routing = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  when(() => routing.removePluginConfigFromCache)
    .thenReturn((scope, marketplace, plugin) => {
      calls.push(`${scope}:${marketplace}:${plugin}:remove`);
    })
    .times(1);
  when(() => routing.rebuildRoutingTables)
    .thenReturn(() => {
      calls.push("rebuild");
    })
    .times(1);
  const cascade = owner.composeInstallDisableCascade({
    hooksRouting: routing,
    now: () => UPDATED_AT,
    unstagePlugin: () =>
      Promise.resolve({
        ok: true,
        dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
      }),
  });

  // act
  cascade.dropRoutesAfterSave("project", "marketplace", "plugin");

  // assert
  assert.deepStrictEqual(calls, ["project:marketplace:plugin:remove", "rebuild"]);
  verify(routing);
});

test("keeps a successful install successful when post-save route removal throws", async () => {
  // arrange
  const owner = await loadOwner();
  const routing = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  when(() => routing.removePluginConfigFromCache)
    .thenThrow(new Error("cache denied"))
    .times(1);
  const cascade = owner.composeInstallDisableCascade({
    hooksRouting: routing,
    now: () => UPDATED_AT,
    unstagePlugin: () =>
      Promise.resolve({
        ok: true,
        dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
      }),
  });

  // act & assert
  assert.doesNotThrow(() => {
    cascade.dropRoutesAfterSave("project", "marketplace", "plugin");
  });
  verify(routing);
});

test("composes the fresh disabled row with the author reason first", async () => {
  // arrange
  const owner = await loadOwner();
  const cascade = composeOwner(owner, () =>
    Promise.resolve({
      ok: true,
      dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
    }),
  );

  // act
  const disabledRow = cascade.composeDisabledRow({
    plugin: "plugin",
    version: "1.2.3",
    resolution: { state: "installable", unsupported: [] },
    frontmatterDegradations: [],
  });

  // assert
  assert.deepStrictEqual(disabledRow, {
    status: "disabled",
    name: "plugin",
    version: "1.2.3",
    reasons: ["installs disabled"],
    severity: "info",
    needsReload: false,
    enableHint: true,
  });
});

test("composes the degraded disabled row with exact reason order and warning severity", async () => {
  // arrange
  const owner = await loadOwner();
  const cascade = composeOwner(owner, () =>
    Promise.resolve({
      ok: true,
      dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
    }),
  );

  // act
  const disabledRow = cascade.composeDisabledRow({
    plugin: "plugin",
    version: "1.2.3",
    resolution: { state: "partially-available", unsupported: ["themes", "monitors"] },
    frontmatterDegradations: [{ kind: "skill" }, { kind: "command" }, { kind: "skill" }],
  });

  // assert
  assert.deepStrictEqual(disabledRow, {
    status: "disabled",
    name: "plugin",
    version: "1.2.3",
    reasons: ["installs disabled", "malformed skill", "malformed command", "unsupported component"],
    severity: "warning",
    needsReload: false,
    enableHint: true,
  });
});
