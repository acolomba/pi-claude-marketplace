import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";

import { createUpdateDependencyResolver as createPublicUpdateDependencyResolver } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import {
  isUpdatePreflightOutcome,
  preparePluginUpdate,
  UPDATE_MATERIALIZATION,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
  toDisabledRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { AgentTargetOccupiedError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import {
  CrossPluginConflictError,
  DependencyCascadeError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";

import {
  INSTALL_DEVICE_CODE,
  INSTALL_HOST_HEAD,
  installAppCountingResolves,
  installGitAppAfterDependencyMove,
  makeCtx,
  offerGitPlugin,
  publishCatalog,
  recordedSha,
  seedCatalogScope,
  withHermeticHome,
} from "./install-flow-fixture.ts";

import type { CatalogPlugin, InstallTestOwner } from "./install-flow-fixture.ts";
import type { InstallPlanningComposition } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts";
import type { PreparedPluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { CascadeThreePhaseArgs } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";

const createUpdateDependencyResolver: InstallPlanningComposition["createUpdateDependencyResolver"] =
  createPublicUpdateDependencyResolver;

test("returns a failure without retaining an absent marketplace", async () => {
  await withHermeticHome(async ({ installPlugin }) => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "install-plan-absent-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await installPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "missing",
        plugin: "app",
      });

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.strictEqual(
        (await loadState(locations.extensionRoot)).marketplaces.missing,
        undefined,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

async function installed(owner: InstallTestOwner, cwd: string, plugin: string): Promise<void> {
  const { ctx, run } = makeCtx();
  const outcome = await owner.installPlugin({
    ctx,
    run,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin,
  });
  assert.strictEqual(outcome.status, "installed");
}

/** Each record's version and enabled bit, by name. */
async function recordedVersions(cwd: string): Promise<Record<string, [string, boolean]>> {
  const state = await loadState(locationsFor("project", cwd).extensionRoot);
  return Object.fromEntries(
    Object.entries(state.marketplaces.mp?.plugins ?? {}).map(([name, record]) => [
      name,
      [record.version, record.enabled],
    ]),
  );
}

/** The candidate `update` would land for `plugin@mp`, as the update runner hands it to the settle. */
async function preparedUpdate(cwd: string, plugin: string): Promise<PreparedPluginUpdate> {
  const prepared = await preparePluginUpdate({
    plugin,
    marketplace: "mp",
    scope: "project",
    locations: locationsFor("project", cwd),
    policy: UPDATE_MATERIALIZATION,
    cleanupClones: () => Promise.resolve(),
  });
  assert.ok(!isUpdatePreflightOutcome(prepared), "the update has a candidate");
  return prepared;
}

/** Holds the project scope's state lock until the returned release runs. */
async function lockScope(cwd: string): Promise<() => Promise<void>> {
  const locations = locationsFor("project", cwd);
  return lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });
}

/** The cascade-mode update arguments that settle `plugin@mp`'s closure. */
function updateArgs(owner: InstallTestOwner, cwd: string, plugin: string): CascadeThreePhaseArgs {
  return {
    plugin,
    marketplace: "mp",
    scope: "project",
    cwd,
    locations: locationsFor("project", cwd),
    hooksRouting: owner.hooksRouting,
    completionCache: owner.completionCache,
    env: {},
    cascade: true,
    cleanupClones: () => Promise.resolve(),
  };
}

const FRESH_GIT_DEPENDENCY_CASES: readonly {
  readonly title: string;
  readonly catalog: Readonly<Record<string, CatalogPlugin>>;
}[] = [
  {
    title:
      "an install that moves a dependency installs a fresh git dependency at the commit its preview resolved, resolving it once",
    catalog: {
      app: { version: "1.0.0", dependencies: ["lib@^2.0.0", "util"] },
      lib: { version: "2.0.0" },
    },
  },
  {
    title:
      "a fresh git dependency a moved dependency's new version needs installs at its previewed commit before the move",
    catalog: {
      app: { version: "1.0.0", dependencies: ["lib@^2.0.0"] },
      lib: { version: "2.0.0", dependencies: ["util"] },
    },
  },
];

for (const { title, catalog } of FRESH_GIT_DEPENDENCY_CASES) {
  test(`D-PL4-01: ${title}`, async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({ lib: { version: "1.2.0" } });
      await installed(owner, cwd, "lib");
      await publishCatalog(marketplaceRoot, catalog);
      const repository = await offerGitPlugin(marketplaceRoot, "util");

      // act
      const install = await installAppCountingResolves(owner, cwd, repository);

      // assert
      assert.deepStrictEqual(install, {
        status: "installed",
        mirrors: 1,
        pins: [INSTALL_HOST_HEAD],
      });
      assert.deepStrictEqual(await recordedVersions(cwd), {
        app: ["1.0.0", true],
        lib: ["2.0.0", true],
        util: ["1.0.0", true],
      });
      assert.strictEqual(await recordedSha(cwd, "util"), INSTALL_HOST_HEAD);
    });
  });
}

test("D-PL4-01: a moved git root keeps the commit selected by its preview", async () => {
  await withHermeticHome(async (owner) => {
    // act
    const { cwd, install } = await installGitAppAfterDependencyMove(owner);

    // assert
    assert.deepStrictEqual(install, {
      status: "installed",
      mirrors: 1,
      pins: [INSTALL_HOST_HEAD],
    });
    assert.deepStrictEqual(await recordedVersions(cwd), {
      app: ["1.0.0", true],
      lib: ["2.0.0", true],
    });
  });
});

test("UPD-DEP-D1: installing refuses a plugin whose installed dependency no release moves inside its range", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const { cwd } = await seedCatalogScope({
      app: { version: "1.0.0", dependencies: ["lib@^2.0.0"] },
      lib: { version: "1.2.0" },
    });
    await installed(owner, cwd, "lib");
    const { ctx, run, notifications } = makeCtx();

    // act
    const outcome = await owner.installPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "app",
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Some plugin operations have failed.",
          "",
          "● mp [project]",
          "  ⊘ app (failed) {dependency failed}",
          "  ⊘ lib@mp v1.2.0 (failed) {already installed, version conflict}",
          '    cause: Dependency "lib@mp" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: version 1.2.0 falls outside what the combined range admits (^2.0.0) -- required by "app@mp". To look for a version in range, run /claude:plugin update lib@mp.',
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await recordedVersions(cwd), { lib: ["1.2.0", true] });
  });
});

for (const orchestrated of [false, true]) {
  test(`UPD-DEP-D1: a dependency move that fails fails the ${orchestrated ? "orchestrated" : "standalone"} install`, async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        lib: { version: "1.2.0", mcp: true },
      });
      await installed(owner, cwd, "lib");
      await publishCatalog(marketplaceRoot, {
        app: { version: "1.0.0", dependencies: ["lib@^2.0.0", "zzz"] },
        lib: { version: "2.0.0", mcp: true },
        zzz: { version: "1.0.0" },
      });
      const adapterPath = locationsFor("project", cwd).mcpAdapterJsonPath;
      await rm(adapterPath, { force: true });
      await mkdir(adapterPath, { recursive: true });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await owner.installPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "app",
        ...(orchestrated && { notifications: { mode: "orchestrated" } }),
      });

      // assert
      assert.ok(outcome.status === "failed");
      assert.ok(outcome.error instanceof DependencyCascadeError);
      assert.deepStrictEqual(
        [outcome.error.message, outcome.error.key],
        ['Dependency "lib@mp" did not move into ^2.0.0.', "lib@mp"],
      );
      // The cause line is the runner's EISDIR, whose text varies across Node releases.
      assert.deepStrictEqual(
        notifications.map((notification) => ({
          head: notification.message.split("\n").slice(0, 5),
          listsUnmaterialized: notification.message.includes("zzz@mp (failed) {dependency failed}"),
        })),
        orchestrated
          ? []
          : [
              {
                head: [
                  "Some plugin operations have failed.",
                  "",
                  "● mp [project]",
                  "  ⊘ app (failed) {dependency failed}",
                  "  ⊘ lib@mp v1.2.0 (failed)",
                ],
                listsUnmaterialized: true,
              },
            ],
      );
      assert.deepStrictEqual(await recordedVersions(cwd), { lib: ["1.2.0", true] });
    });
  });
}

test("UPD-DEP-D1: installing refuses a plugin pi supports only in part before its dependency moves", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const { cwd, marketplaceRoot } = await seedCatalogScope({ lib: { version: "1.2.0" } });
    await installed(owner, cwd, "lib");
    await publishCatalog(marketplaceRoot, {
      app: { version: "1.0.0", dependencies: ["lib@^2.0.0"], experimental: { themes: "./t" } },
      lib: { version: "2.0.0" },
    });
    const { ctx, run, notifications } = makeCtx();

    // act
    const outcome = await owner.installPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "app",
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.deepStrictEqual(
      notifications.map((notification) => notification.message.split("\n").slice(0, 4)),
      [
        [
          "A plugin operation has failed.",
          "",
          "● mp [project]",
          "  ⊖ app (partially-available) {unsupported component}",
        ],
      ],
    );
    assert.deepStrictEqual(await recordedVersions(cwd), { lib: ["1.2.0", true] });
  });
});

test("UPD-DEP-D1: installing moves a dependency whose new version installs a dependency of its own", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const { cwd, marketplaceRoot } = await seedCatalogScope({ aaa: { version: "1.0.0" } });
    await installed(owner, cwd, "aaa");
    await publishCatalog(marketplaceRoot, {
      app: { version: "1.0.0", dependencies: ["aaa@^2.0.0"] },
      aaa: { version: "2.0.0", dependencies: ["zzz"] },
      zzz: { version: "1.0.0" },
    });
    const { ctx, run, notifications } = makeCtx();

    // act
    const outcome = await owner.installPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "app",
      pinVersionOverride: "1.0.0",
    });

    // assert
    assert.strictEqual(outcome.status, "installed");
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "● mp [project]",
          "  ● aaa@mp v1.0.0 → v2.0.0 (updated) {dependency current copy}",
          '    cause: constrained to the combined range (^2.0.0) -- required by "app@mp"',
          "  ● app v1.0.0 (installed)",
          "  ● zzz@mp v1.0.0 (installed)",
          "",
          "/reload to pick up changes",
        ].join("\n"),
      },
    ]);
    assert.deepStrictEqual(await recordedVersions(cwd), {
      aaa: ["2.0.0", true],
      app: ["1.0.0", true],
      zzz: ["1.0.0", true],
    });
  });
});

test("UPD-DEP-D1 / MISS-01: an install whose later step installs missing dependencies moves a dependency without installing what its new version needs", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const { cwd, marketplaceRoot } = await seedCatalogScope({ aaa: { version: "1.0.0" } });
    await installed(owner, cwd, "aaa");
    await publishCatalog(marketplaceRoot, {
      app: { version: "1.0.0", dependencies: ["aaa@^2.0.0"] },
      aaa: { version: "2.0.0", dependencies: ["zzz"] },
      zzz: { version: "1.0.0" },
    });
    const { ctx, run, notifications } = makeCtx();

    // act
    const outcome = await owner.installPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "app",
      notifications: { mode: "orchestrated" },
      dependencyInstallsFollow: true,
    });

    // assert
    assert.deepStrictEqual(
      outcome.status === "installed" &&
        outcome.movedDependencies?.map((entry) => [entry.key, entry.row.status]),
      [["aaa@mp", "updated"]],
    );
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await recordedVersions(cwd), {
      aaa: ["2.0.0", true],
      app: ["1.0.0", true],
    });
  });
});

describe("createUpdateDependencyResolver", () => {
  test("installs a dependency the new version needs and reports its row", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        {},
      );

      // act
      const settlement = await settle(
        updateArgs(owner, cwd, "widget"),
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.deepStrictEqual(settlement, {
        kind: "settled",
        rows: [
          {
            status: "installed",
            name: "zcore@mp",
            dependencies: [],
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      });
      assert.deepStrictEqual(await recordedVersions(cwd), {
        widget: ["1.0.0", true],
        zcore: ["1.0.0", true],
      });
    });
  });

  test("D-PL1-16: reports the MCP config notices of the dependency it installs", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      await writeFile(
        path.join(marketplaceRoot, "plugins", "zcore", ".mcp.json"),
        JSON.stringify({ mcpServers: { "zcore-server": { command: "node" } } }),
      );
      const locations = locationsFor("project", cwd);
      await writeFile(locations.mcpAdapterJsonPath, '// mine\n{"mcpServers":{}}\n');
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        {},
      );

      // act
      const settlement = await settle(
        updateArgs(owner, cwd, "widget"),
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.deepStrictEqual(settlement, {
        kind: "settled",
        rows: [
          {
            status: "installed",
            name: "zcore@mp",
            dependencies: ["mcp"],
            version: "1.0.0",
            severity: "warning",
            needsReload: true,
          },
        ],
        mcpConfigNotices: [
          { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
        ],
      });
    });
  });

  test("WR-C: refuses a version whose names another plugin owns before it installs any dependency", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        other: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await installed(owner, cwd, "other");
      const locations = locationsFor("project", cwd);
      const state = await loadState(locations.extensionRoot);
      const other = state.marketplaces.mp?.plugins.other;
      assert.ok(other !== undefined);
      other.resources = {
        ...other.resources,
        skills: [...other.resources.skills, "widget-helper"],
      };
      await saveState(locations.extensionRoot, state);
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      await mkdir(path.join(marketplaceRoot, "plugins", "widget", "skills", "helper"), {
        recursive: true,
      });
      await writeFile(
        path.join(marketplaceRoot, "plugins", "widget", "skills", "helper", "SKILL.md"),
        "---\nname: helper\n---\n",
      );
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act & assert
      await assert.rejects(
        settle(updateArgs(owner, cwd, "widget"), await preparedUpdate(cwd, "widget"), {
          ctx,
          run,
        }),
        (error: unknown) => {
          assert.ok(error instanceof CrossPluginConflictError);
          return true;
        },
      );
      assert.deepStrictEqual(await recordedVersions(cwd), {
        other: ["1.0.0", true],
        widget: ["1.0.0", true],
      });
    });
  });

  test("D-PL4-04: refuses a version whose agent target a user's file holds before it installs any dependency", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({ widget: { version: "1.0.0" } });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      await mkdir(path.join(marketplaceRoot, "plugins", "widget", "agents"));
      await writeFile(
        path.join(marketplaceRoot, "plugins", "widget", "agents", "helper.md"),
        "---\nname: helper\ndescription: Helper\ntools: Read, Grep\n---\n\nBody.\n",
      );
      const agentsDir = locationsFor("project", cwd).agentsDir;
      const userFile = path.join(agentsDir, "pi-claude-marketplace-widget-helper.md");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(userFile, "The user's own agent.\n");
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act & assert
      await assert.rejects(
        settle(updateArgs(owner, cwd, "widget"), await preparedUpdate(cwd, "widget"), {
          ctx,
          run,
        }),
        new AgentTargetOccupiedError(userFile),
      );
      assert.deepStrictEqual(await recordedVersions(cwd), { widget: ["1.0.0", true] });
      assert.strictEqual(await readFile(userFile, "utf8"), "The user's own agent.\n");
    });
  });

  test("enables a disabled dependency the new version needs and declares it enabled", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await installed(owner, cwd, "zcore");
      const state = await loadState(locationsFor("project", cwd).extensionRoot);
      const marketplace = state.marketplaces.mp;
      const zcore = marketplace?.plugins.zcore;
      assert.ok(marketplace !== undefined && zcore !== undefined);
      marketplace.plugins.zcore = toDisabledRecord(zcore, "2026-01-01T00:00:00.000Z");
      await saveState(locationsFor("project", cwd).extensionRoot, state);
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act
      const settlement = await settle(
        { ...updateArgs(owner, cwd, "widget"), constraintTagMemo: new Map() },
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.deepStrictEqual(
        settlement.rows.map((row) => [row.name, row.reasons]),
        [["zcore@mp", ["already installed", "dependency enabled"]]],
      );
      assert.deepStrictEqual(await recordedVersions(cwd), {
        widget: ["1.0.0", true],
        zcore: ["1.0.0", true],
      });
    });
  });

  test("moves an out-of-range dependency first, then settles the closure again", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore@^2.0.0"] },
        zcore: { version: "2.0.0" },
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act
      const settlement = await settle(
        updateArgs(owner, cwd, "widget"),
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.deepStrictEqual(
        settlement.rows.map((row) => [row.status, row.name]),
        [["updated", "zcore@mp"]],
      );
      assert.strictEqual(settlement.kind, "settled");
      assert.deepStrictEqual(await recordedVersions(cwd), {
        widget: ["1.0.0", true],
        zcore: ["2.0.0", true],
      });
    });
  });

  test("refuses a closure whose dependency no marketplace offers and changes nothing", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({ widget: { version: "1.0.0" } });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["absent"] },
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act
      const settlement = await settle(
        updateArgs(owner, cwd, "widget"),
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.strictEqual(settlement.kind, "refused");
      assert.deepStrictEqual(
        settlement.rows.map((row) => [row.status, row.name, row.reasons]),
        [["failed", "absent@mp", ["not in manifest"]]],
      );
      assert.deepStrictEqual(await recordedVersions(cwd), { widget: ["1.0.0", true] });
    });
  });

  test("refuses a move that would need the plugin being updated moved again", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "2.0.0", dependencies: ["zcore@^2.0.0"] },
        zcore: { version: "2.0.0", dependencies: ["widget@^2.0.0"] },
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act
      const settlement = await settle(
        updateArgs(owner, cwd, "widget"),
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.strictEqual(settlement.kind, "refused");
      assert.deepStrictEqual(
        settlement.rows.map((row) => [row.status, row.name]),
        [["failed", "widget@mp"]],
      );
      assert.deepStrictEqual(await recordedVersions(cwd), {
        widget: ["1.0.0", true],
        zcore: ["1.0.0", true],
      });
    });
  });

  test("rethrows a failure no dependency caused", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({ widget: { version: "1.0.0" } });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, { widget: { version: "1.1.0" } });
      const held = await lockScope(cwd);
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      const prepared = await preparedUpdate(cwd, "widget");

      // act & assert
      await assert.rejects(
        () => settle(updateArgs(owner, cwd, "widget"), prepared, { ctx, run }),
        StateLockHeldError,
      );
      await held();
    });
  });

  test("reports a dependency whose marketplace a member's ledger finds missing as the update's own failure", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      owner.transactionControl.runPhases = (phases, context) => {
        Object.assign(context as object, { marketplaceAbsent: true });
        return Promise.resolve({ ok: phases.length === 0, rollbackPartials: [], leaks: [] });
      };

      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      const prepared = await preparedUpdate(cwd, "widget");

      // act & assert
      await assert.rejects(
        () => settle(updateArgs(owner, cwd, "widget"), prepared, { ctx, run }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(
            error.message,
            'A dependency of "widget@mp" names a marketplace that is not added.',
          );
          return true;
        },
      );
    });
  });

  test("threads the update's collaborators into the dependency installs", async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedCatalogScope({
        widget: { version: "1.0.0" },
        zcore: { version: "1.0.0" },
      });
      await installed(owner, cwd, "widget");
      await publishCatalog(marketplaceRoot, {
        widget: { version: "1.1.0", dependencies: ["zcore"] },
        zcore: { version: "1.0.0" },
      });
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: INSTALL_DEVICE_CODE,
      });
      const { ctx, run } = makeCtx();
      const settle = createUpdateDependencyResolver(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
      );

      // act
      const settlement = await settle(
        {
          ...updateArgs(owner, cwd, "widget"),
          mapModel: true,
          partial: true,
          credentialOps: credentials.credentialOps,
          deviceFlowHttp: deviceFlow.http,
          authMemo: new Map(),
        },
        await preparedUpdate(cwd, "widget"),
        { ctx, run },
      );

      // assert
      assert.deepStrictEqual(
        settlement.rows.map((row) => [row.status, row.name]),
        [["installed", "zcore@mp"]],
      );
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
    });
  });
});
