import assert from "node:assert/strict";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createInstallMissingDependency,
  createInstallPlugin,
  createUpdateDependencyResolver,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";

import {
  INSTALL_HOST_HEAD,
  installGitAppAfterDependencyMove,
  recordedSha,
  withHermeticHome,
} from "./install-flow-fixture.ts";

import type { InstallTransaction } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";

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
