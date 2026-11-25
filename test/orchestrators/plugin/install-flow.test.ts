import assert from "node:assert/strict";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createGitHubCloneNotes } from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import {
  createInstallMissingDependency,
  createInstallPlugin,
  createUpdateDependencyResolver,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";

import {
  createGitOps,
  INSTALL_HOST_HEAD,
  installGitAppAfterDependencyMove,
  makeCtx,
  offerGitPlugin,
  recordedSha,
  seamWith,
  seedCatalogScope,
  withHermeticHome,
} from "./install-flow-fixture.ts";

import type {
  CloneTransport,
  PluginTransportContext,
} from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import type { InstallTransaction } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import type { InstallTestOwner } from "./install-flow-fixture.ts";

const TRANSACTION: InstallTransaction = { runPhases, withLockedStateTransaction };

for (const { name, createOperation } of [
  {
    name: "install",
    createOperation: (env?: NodeJS.ProcessEnv) =>
      createInstallPlugin(
        TRANSACTION,
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        env,
      ),
  },
  {
    name: "missing-dependency install",
    createOperation: (env?: NodeJS.ProcessEnv) =>
      createInstallMissingDependency(
        TRANSACTION,
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        env,
      ),
  },
  {
    name: "update dependency settlement",
    createOperation: (env?: NodeJS.ProcessEnv) =>
      createUpdateDependencyResolver(
        TRANSACTION,
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        env,
      ),
  },
]) {
  test(`creates the ${name} operation with default and explicit environments`, () => {
    // arrange
    const expectedType = "function";

    // act
    const defaultOperation = createOperation();
    const explicitOperation = createOperation({});

    // assert
    assert.strictEqual(typeof defaultOperation, expectedType);
    assert.strictEqual(typeof explicitOperation, expectedType);
  });
}

/** A transport context whose checks fail a case that runs them. */
function inertTransportContext(): PluginTransportContext {
  return {
    force: undefined,
    checks: {
      userOverride: () => Promise.reject(new Error("no check runs for a url source")),
      urlRewritten: () => Promise.reject(new Error("no check runs for a url source")),
      probe: () => Promise.reject(new Error("no check runs for a url source")),
      sshPresent: () => Promise.reject(new Error("no check runs for a url source")),
      showsDirectGitHub: () => Promise.reject(new Error("no check runs for a url source")),
    },
    notes: createGitHubCloneNotes(),
  };
}

/** Installs `app@mp` from a url source and returns the transports its mirror step got. */
async function mirrorTransportsOfInstall(
  owner: InstallTestOwner,
  installPlugin: ReturnType<typeof createInstallPlugin>,
  transportContext?: PluginTransportContext,
): Promise<ReadonlyArray<CloneTransport | undefined>> {
  const { cwd, marketplaceRoot } = await seedCatalogScope(owner.root, {});
  const repository = await offerGitPlugin(marketplaceRoot, "app");
  const inner = seamWith(
    createGitOps({
      fixtureSourceDir: repository,
      head: INSTALL_HOST_HEAD,
      localRefs: { "refs/heads/main": INSTALL_HOST_HEAD },
      remoteRefs: { "refs/remotes/origin/main": INSTALL_HOST_HEAD },
    }).gitOps,
  );
  const transports: Array<CloneTransport | undefined> = [];
  const { ctx, run } = makeCtx();
  const outcome = await installPlugin({
    ctx,
    run,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "app",
    ...(transportContext !== undefined && { transportContext }),
    cloneCacheSeam: {
      ...inner,
      materializeOrRefreshPluginMirror: (args) => {
        transports.push(args.transport);
        return inner.materializeOrRefreshPluginMirror(args);
      },
    },
  });
  assert.strictEqual(outcome.status, "installed");
  return transports;
}

test("D-SG-18: an install with no transport context clones under a new one made for the call", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const made: PluginTransportContext[] = [];
    const installPlugin = createInstallPlugin(
      owner.transaction,
      owner.hooksRouting,
      owner.completionCache,
      {},
      () => {
        const context = inertTransportContext();
        made.push(context);
        return context;
      },
    );

    // act
    const transports = await mirrorTransportsOfInstall(owner, installPlugin);

    // assert
    assert.strictEqual(made.length, 1);
    assert.deepStrictEqual(
      transports.map((transport) => transport?.notes === made[0]?.notes),
      [true],
    );
    assert.deepStrictEqual(
      transports.map((transport) => transport?.subject),
      ["app@mp"],
    );
  });
});

test("D-SG-18: an install given a transport context clones under it and makes none", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const given = inertTransportContext();
    const installPlugin = createInstallPlugin(
      owner.transaction,
      owner.hooksRouting,
      owner.completionCache,
      {},
      () => assert.fail("an install given a context makes none"),
    );

    // act
    const transports = await mirrorTransportsOfInstall(owner, installPlugin, given);

    // assert
    assert.deepStrictEqual(
      transports.map((transport) => transport?.notes === given.notes),
      [true],
    );
  });
});

for (const given of [undefined, inertTransportContext()]) {
  test(`D-SG-18: a missing-dependency install clones under ${given === undefined ? "a new" : "the given"} transport context`, async () => {
    await withHermeticHome(async (owner) => {
      // arrange
      const made: PluginTransportContext[] = [];
      const installMissingDependency = createInstallMissingDependency(
        owner.transaction,
        owner.hooksRouting,
        owner.completionCache,
        {},
        () => {
          const context = inertTransportContext();
          made.push(context);
          return context;
        },
      );
      const { cwd, marketplaceRoot } = await seedCatalogScope(owner.root, {});
      const repository = await offerGitPlugin(marketplaceRoot, "app");
      const inner = seamWith(
        createGitOps({
          fixtureSourceDir: repository,
          head: INSTALL_HOST_HEAD,
          localRefs: { "refs/heads/main": INSTALL_HOST_HEAD },
          remoteRefs: { "refs/remotes/origin/main": INSTALL_HOST_HEAD },
        }).gitOps,
      );
      const transports: Array<CloneTransport | undefined> = [];
      const { ctx, run } = makeCtx();

      // act
      await installMissingDependency({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "app",
        ranges: [],
        requiredBy: "lib@mp",
        ...(given !== undefined && { transportContext: given }),
        cloneCacheSeam: {
          ...inner,
          materializeOrRefreshPluginMirror: (args) => {
            transports.push(args.transport);
            return inner.materializeOrRefreshPluginMirror(args);
          },
        },
      });

      // assert
      const expected = given ?? made[0];
      assert.strictEqual(made.length, given === undefined ? 1 : 0);
      assert.deepStrictEqual(
        transports.map((transport) => transport?.notes === expected?.notes),
        [true],
      );
    });
  });
}

test("composes an explicit environment through dependency planning and ledger persistence", async () => {
  await withHermeticHome(async (owner) => {
    // arrange
    const installPlugin = createInstallPlugin(
      owner.transaction,
      owner.hooksRouting,
      owner.completionCache,
      {},
    );

    // act
    const { cwd, install } = await installGitAppAfterDependencyMove({
      ...owner,
      installPlugin,
    });

    // assert
    assert.deepStrictEqual(install, {
      status: "installed",
      mirrors: 1,
      pins: [INSTALL_HOST_HEAD],
    });
    assert.strictEqual(await recordedSha(cwd, "app"), INSTALL_HOST_HEAD);
  });
});
