import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  dependencyMoveContext,
  INSTALL_MOVE_MATERIALIZATION,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts";
import { freshDependencyMoveMemos } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts";
import {
  createInstallMissingDependencyLedger,
  prepareInstallDependencyPlan,
  previewInstallDependencyPlanRoot,
  projectCaughtInstallDependencyPlanFailure,
  projectFailedInstallDependencyPlanMoves,
  runInstallDependencyPlanCascade,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts";
import {
  isUpdatePreflightOutcome,
  preparePluginUpdate,
  UPDATE_MATERIALIZATION,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import {
  makeCtx,
  publishCatalog,
  seedCatalogScope,
  withHermeticHome,
} from "./install-flow-fixture.ts";

import type { InstallTestOwner } from "./install-flow-fixture.ts";

const FILE_CAPABILITIES = { removalOps: { rm: () => Promise.resolve() } };

async function catalog(
  t: TestContext,
  root: string,
  plugins: Parameters<typeof seedCatalogScope>[1],
): Promise<Awaited<ReturnType<typeof seedCatalogScope>>> {
  const seeded = await seedCatalogScope(root, plugins);
  t.after(() => rm(seeded.cwd, { recursive: true, force: true }));
  return seeded;
}

function missingArgs(cwd: string, requiredBy = "app@mp") {
  const { ctx, run } = makeCtx();
  return {
    ctx,
    run,
    scope: "project" as const,
    cwd,
    marketplace: "mp",
    plugin: "dep",
    ranges: [] as readonly string[],
    requiredBy,
  };
}

function planning(owner: InstallTestOwner, cwd: string) {
  const { ctx, run } = makeCtx();
  const target = {
    scope: "project" as const,
    cwd,
    locations: locationsFor("project", cwd),
  };
  const caller = { ctx, run };
  const owners = {
    transaction: owner.transaction,
    hooksRouting: owner.hooksRouting,
    completionCache: owner.completionCache,
    env: {},
    fileCapabilities: FILE_CAPABILITIES,
  };
  const root = { key: "app@mp", marketplace: "mp", plugin: "app" };
  const memos = freshDependencyMoveMemos();
  const cloneCandidates = new Set<string>();
  return {
    caller,
    cloneCandidates,
    memos,
    owners,
    root,
    target,
    context: dependencyMoveContext({
      owners,
      target,
      caller,
      policy: INSTALL_MOVE_MATERIALIZATION,
      memos,
      cloneCandidates,
    }),
  };
}

describe("missing dependency transaction", () => {
  test("installs a dependency closure, then skips its recorded root", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, {
        dep: { version: "1.0.0", dependencies: ["leaf"] },
        leaf: { version: "1.0.0" },
      });
      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const installed = await install(missingArgs(cwd));
      const skipped = await install(missingArgs(cwd));

      // assert
      assert.strictEqual(installed.status, "installed");
      assert.deepStrictEqual(
        installed.status === "installed" && installed.members.map((member) => member.key),
        ["leaf@mp", "dep@mp"],
      );
      assert.deepStrictEqual(skipped, { status: "skipped" });
    });
  });

  test("projects marketplace and authorization failures", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const cwd = await mkdtemp(path.join(tmpdir(), "dependency-ledger-absent-"));
      t.after(() => rm(cwd, { recursive: true, force: true }));
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await saveState(locations.extensionRoot, { schemaVersion: 3, marketplaces: {} });
      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const absent = await install(missingArgs(cwd));

      // assert
      assert.strictEqual(absent.status, "failed");
      assert.match(absent.status === "failed" ? absent.cause : "", /not added/u);
    });
  });

  test("marks a foreign declarer as a cross-marketplace refusal", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, { dep: { version: "1.0.0" } });
      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const outcome = await install(missingArgs(cwd, "app@other"));

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.strictEqual(
        outcome.status === "failed" ? outcome.reason : undefined,
        "cross-marketplace",
      );
    });
  });

  test("carries root requirers and discovery warnings", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await catalog(t, owner.root, { dep: { version: "1.0.0" } });
      await writeFile(
        path.join(marketplaceRoot, "plugins", "dep", "skills", "tool", "SKILL.md"),
        "---\nname: [unterminated\n---\n",
      );
      const commands = path.join(marketplaceRoot, "plugins", "dep", "commands");
      await mkdir(path.join(commands, "dep-tools"), { recursive: true });
      await mkdir(path.join(commands, "tools"), { recursive: true });
      await writeFile(path.join(commands, "dep-tools", "lint.md"), "first\n");
      await writeFile(path.join(commands, "tools", "lint.md"), "second\n");
      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const outcome = await install({ ...missingArgs(cwd), requirers: ["app@mp"] });

      // assert
      assert.strictEqual(outcome.status, "installed");
      assert.ok(outcome.status === "installed" && outcome.postCommitWarnings !== undefined);
      assert.ok(outcome.status === "installed" && outcome.stagingWarnings !== undefined);
    });
  });

  test("projects a missing member as the failed closure subject", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, {
        dep: { version: "1.0.0", dependencies: ["absent"] },
      });
      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const outcome = await install(missingArgs(cwd));

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.match(outcome.status === "failed" ? outcome.cause : "", /absent@mp/u);
    });
  });

  test("projects a member ledger marketplace absence", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, { dep: { version: "1.0.0" } });
      owner.transactionControl.runPhases = (phases, context) => {
        Object.assign(context as object, { marketplaceAbsent: true });
        return Promise.resolve({ ok: phases.length === 0, rollbackPartials: [], leaks: [] });
      };

      const install = createInstallMissingDependencyLedger(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        FILE_CAPABILITIES,
        {},
      );

      // act
      const outcome = await install(missingArgs(cwd));

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.match(outcome.status === "failed" ? outcome.cause : "", /not added/u);
    });
  });
});

describe("dependency planning operations", () => {
  test("prepares graph ports and previews the root without writing", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, {
        app: { version: "1.0.0", dependencies: ["dep"] },
        dep: { version: "1.0.0" },
      });
      const args = planning(owner, cwd);

      // act
      const ports = await prepareInstallDependencyPlan(args);
      const graph = await ports.walk(new Map());
      assert.strictEqual(graph.kind, "graph");
      if (graph.kind !== "graph" || graph.root === undefined) {
        assert.fail("expected a resolved root");
      }

      const judged = await ports.judge({
        key: "missing@mp",
        name: "missing",
        marketplace: "mp",
        recordedVersion: "1.0.0",
        requesters: [],
      });
      const memberPreview = await ports.preview(graph.root);
      const preview = await previewInstallDependencyPlanRoot({
        owners: args.owners,
        opts: {
          ...args.caller,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "app",
          pinVersionOverride: "1.0.0",
        },
        target: args.target,
        cloneCandidates: args.cloneCandidates,
      });

      // assert
      assert.strictEqual(judged.ok, false);
      assert.strictEqual(memberPreview, undefined);
      assert.strictEqual(preview, undefined);
    });
  });

  test("runs initial and materialized closure slices", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await catalog(t, owner.root, {
        app: { version: "1.0.0", dependencies: ["dep"] },
        dep: { version: "1.0.0" },
      });
      await writeFile(
        path.join(marketplaceRoot, "plugins", "dep", "package.json"),
        '{"dependencies":{"pkd-dep":"1.0.0"}}',
      );
      await writeFile(path.join(marketplaceRoot, "plugins", "dep", "yarn.lock"), "lockfile");
      const args = planning(owner, cwd);

      // act
      const initial = await runInstallDependencyPlanCascade({
        ...args,
        kind: "initial",
        carried: [],
        writesConfig: false,
      });
      const materialized = await runInstallDependencyPlanCascade({
        ...args,
        kind: "materialize",
        carried: [],
        writesConfig: true,
        members: [],
      });

      // assert
      assert.strictEqual(initial.kind, "installed");
      assert.deepStrictEqual(
        initial.kind === "installed"
          ? "stagingDiagnostics" in initial
            ? initial.stagingDiagnostics
            : undefined
          : undefined,
        [
          {
            plugin: "dep",
            scope: "project",
            verb: "installed",
            warnings: [
              {
                kind: "discovery",
                message:
                  "The packages it lists were not installed, because it uses a yarn or pnpm lockfile, which plugin installs do not support.",
              },
            ],
          },
        ],
      );
      assert.strictEqual(materialized.kind, "installed");
    });
  });

  test("reads a prepared root candidate in planning and cascade lookup", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await catalog(t, owner.root, { app: { version: "1.0.0" } });
      const installed = makeCtx();
      assert.strictEqual(
        (
          await owner.installPlugin({
            ctx: installed.ctx,
            run: installed.run,
            scope: "project",
            cwd,
            marketplace: "mp",
            plugin: "app",
          })
        ).status,
        "installed",
      );
      await publishCatalog(marketplaceRoot, {
        app: { version: "2.0.0", dependencies: ["dep"] },
        dep: { version: "1.0.0" },
      });
      const args = planning(owner, cwd);
      const prepared = await preparePluginUpdate({
        plugin: "app",
        marketplace: "mp",
        scope: "project",
        locations: args.target.locations,
        policy: UPDATE_MATERIALIZATION,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!isUpdatePreflightOutcome(prepared));
      if (isUpdatePreflightOutcome(prepared)) {
        assert.fail("expected a prepared update");
      }

      const preparedArgs = { ...args, root: { ...args.root, prepared } };

      // act
      const ports = await prepareInstallDependencyPlan(preparedArgs);
      const graph = await ports.walk(new Map());
      const cascade = await runInstallDependencyPlanCascade({
        ...preparedArgs,
        kind: "initial",
        carried: [],
        writesConfig: false,
      });

      // assert
      assert.strictEqual(graph.kind, "graph");
      assert.strictEqual(cascade.kind, "installed");
    });
  });

  test("surfaces an undefined settlement as marketplace absence", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, {
        app: { version: "1.0.0", dependencies: ["dep"] },
        dep: { version: "1.0.0" },
      });
      owner.transactionControl.runPhases = (phases, context) => {
        Object.assign(context as object, { marketplaceAbsent: true });
        return Promise.resolve({ ok: phases.length === 0, rollbackPartials: [], leaks: [] });
      };

      const args = planning(owner, cwd);

      // act & assert
      await assert.rejects(
        runInstallDependencyPlanCascade({
          ...args,
          kind: "initial",
          carried: [],
          writesConfig: false,
        }),
        /marketplace that is not added/u,
      );
    });
  });

  test("returns a refusal when cascade resolution names its subject", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, {
        app: { version: "1.0.0", dependencies: ["absent"] },
      });
      const args = planning(owner, cwd);

      // act
      const result = await runInstallDependencyPlanCascade({
        ...args,
        kind: "initial",
        carried: [],
        writesConfig: false,
      });

      // assert
      assert.strictEqual(result.kind, "refused");
    });
  });

  test("returns a plan when a recorded dependency must move", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd, marketplaceRoot } = await catalog(t, owner.root, { dep: { version: "1.0.0" } });
      const seeded = makeCtx();
      const installed = await owner.installPlugin({
        ctx: seeded.ctx,
        run: seeded.run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "dep",
      });
      assert.strictEqual(installed.status, "installed");
      await publishCatalog(marketplaceRoot, {
        app: { version: "1.0.0", dependencies: ["dep@^2.0.0"] },
        dep: { version: "2.0.0" },
      });
      const args = planning(owner, cwd);

      // act
      const result = await runInstallDependencyPlanCascade({
        ...args,
        kind: "initial",
        carried: [],
        writesConfig: false,
      });

      // assert
      assert.strictEqual(result.kind, "planned");
    });
  });

  test("rethrows a lock failure before a cascade subject exists", async (t) => {
    await withHermeticHome(async (owner) => {
      // arrange
      const { cwd } = await catalog(t, owner.root, { app: { version: "1.0.0" } });
      const args = planning(owner, cwd);
      const lockError = new Error("lock stopped");

      // act & assert
      await assert.rejects(
        runInstallDependencyPlanCascade({
          ...args,
          owners: {
            ...args.owners,
            transaction: {
              ...args.owners.transaction,
              withLockedStateTransaction: () => Promise.reject(lockError),
            },
          },
          kind: "initial",
          carried: [],
          writesConfig: false,
        }),
        lockError,
      );
    });
  });

  test("projects caught and landed-move failures in both output modes", () => {
    // arrange
    const caught = makeCtx();
    const moved = [
      {
        key: "dep@mp",
        name: "dep",
        marketplace: "mp",
        row: {
          status: "updated" as const,
          name: "dep@mp",
          dependencies: [],
          from: "1.0.0",
          to: "2.0.0",
          severity: "info" as const,
          needsReload: true,
        },
      },
    ];

    // act
    const caughtOutcome = projectCaughtInstallDependencyPlanFailure({
      err: new Error("planning stopped"),
      ctx: caught.ctx,
      run: caught.run,
      marketplace: "mp",
      scope: "project",
      plugin: "app",
      rootKey: "app@mp",
      capture: { rollbackPartials: [], version: undefined },
      cascadeFailure: { mcpConfigNotices: [] },
      orchestrated: true,
    });
    const notificationCounts = [false, true].map((orchestrated) => {
      const projected = makeCtx();
      const outcome = projectFailedInstallDependencyPlanMoves({
        opts: {
          ctx: projected.ctx,
          run: projected.run,
          scope: "project",
          cwd: "/project",
          marketplace: "mp",
          plugin: "app",
        },
        moved,
        mcpConfigNotices: [],
        cause: new Error("move stopped"),
        orchestrated,
        unmaterialized: ["fresh@mp"],
      });
      assert.strictEqual(outcome.status, "failed");
      return projected.notifications.length;
    });

    // assert
    assert.strictEqual(caughtOutcome.status, "failed");
    assert.deepStrictEqual(notificationCounts, [1, 0]);
  });
});
