import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
  type ExtensionState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  withLockedStateTransaction,
  withStateGuard,
  type LockedStateTransactionDeps,
} from "../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";

async function readOptionalStateBytes(stateJsonPath: string): Promise<string | undefined> {
  try {
    return await readFile(stateJsonPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function captureThrown(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the action to throw.");
}

test("saves one explicit transaction while the real scope lock is held and permits a retry", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-save-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const persistenceLog: string[] = [];
  const lockObservations: boolean[] = [];
  const dependencies = {
    loadState: async (extensionRoot: string): Promise<ExtensionState> => {
      persistenceLog.push(`load ${extensionRoot}`);
      return loadState(extensionRoot);
    },
    saveState: async (extensionRoot: string, state: ExtensionState): Promise<void> => {
      persistenceLog.push(`save ${extensionRoot}`);
      await saveState(extensionRoot, state);
    },
  } satisfies LockedStateTransactionDeps;
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "saved-by-transaction",
  } satisfies ExtensionState;
  const expectedStateBytes =
    '{\n  "schemaVersion": 2,\n  "marketplaces": {},\n  "lastReconciledExtensionVersion": "saved-by-transaction"\n}\n';

  // act
  const callbackOutcome = await withLockedStateTransaction(
    locations,
    async (transaction) => {
      lockObservations.push(
        await lockfile.check(locations.extensionRoot, {
          lockfilePath: locations.stateLockFile,
          realpath: false,
        }),
      );
      transaction.state.lastReconciledExtensionVersion = "saved-by-transaction";
      await transaction.save();
      return { status: "saved", stamp: transaction.state.lastReconciledExtensionVersion } as const;
    },
    dependencies,
  );
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  const retryOutcome = await withLockedStateTransaction(
    locations,
    async (transaction) => {
      lockObservations.push(
        await lockfile.check(locations.extensionRoot, {
          lockfilePath: locations.stateLockFile,
          realpath: false,
        }),
      );
      return structuredClone(transaction.state);
    },
    dependencies,
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.deepStrictEqual(callbackOutcome, {
    status: "saved",
    stamp: "saved-by-transaction",
  });
  assert.deepStrictEqual(JSON.parse(stateBytes) as unknown, expectedState);
  assert.strictEqual(stateBytes, expectedStateBytes);
  assert.deepStrictEqual(retryOutcome, expectedState);
  assert.deepStrictEqual(persistenceLog, [
    `load ${locations.extensionRoot}`,
    `save ${locations.extensionRoot}`,
    `load ${locations.extensionRoot}`,
  ]);
  assert.deepStrictEqual(lockObservations, [true, true]);
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("returns a no-save transaction without creating durable state", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-no-save-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const persistenceLog: string[] = [];
  const dependencies = {
    loadState: async (extensionRoot: string): Promise<ExtensionState> => {
      persistenceLog.push(`load ${extensionRoot}`);
      return loadState(extensionRoot);
    },
    saveState: async (extensionRoot: string, state: ExtensionState): Promise<void> => {
      persistenceLog.push(`save ${extensionRoot}`);
      await saveState(extensionRoot, state);
    },
  } satisfies LockedStateTransactionDeps;

  // act
  const callbackOutcome = await withLockedStateTransaction(
    locations,
    (transaction) => {
      transaction.state.lastReconciledExtensionVersion = "memory-only";
      return structuredClone(transaction.state);
    },
    dependencies,
  );
  const stateBytes = await readOptionalStateBytes(locations.stateJsonPath);
  const lockHeld = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.deepStrictEqual(callbackOutcome, {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "memory-only",
  });
  assert.deepStrictEqual(persistenceLog, [`load ${locations.extensionRoot}`]);
  assert.strictEqual(stateBytes, undefined);
  assert.strictEqual(lockHeld, false);
});

test("rejects a duplicate explicit save after one complete durable write", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-duplicate-save-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const saveLog: ExtensionState[] = [];
  const dependencies = {
    loadState,
    saveState: async (extensionRoot: string, state: ExtensionState): Promise<void> => {
      saveLog.push(structuredClone(state));
      await saveState(extensionRoot, state);
    },
  } satisfies LockedStateTransactionDeps;
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "saved-once",
  } satisfies ExtensionState;
  const expectedStateBytes =
    '{\n  "schemaVersion": 2,\n  "marketplaces": {},\n  "lastReconciledExtensionVersion": "saved-once"\n}\n';

  // act
  const duplicateSaveError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      async (transaction) => {
        transaction.state.lastReconciledExtensionVersion = "saved-once";
        await transaction.save();
        await transaction.save();
      },
      dependencies,
    ),
  );
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  const retryOutcome = await withLockedStateTransaction(locations, (transaction) =>
    Promise.resolve(structuredClone(transaction.state)),
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.deepStrictEqual(
    duplicateSaveError,
    new Error("LockedStateTransaction.save() called more than once."),
  );
  assert.deepStrictEqual(saveLog, [expectedState]);
  assert.strictEqual(stateBytes, expectedStateBytes);
  assert.deepStrictEqual(retryOutcome, expectedState);
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("automatically saves a successful state guard callback and returns its complete value", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-auto-save-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "automatic-save",
  } satisfies ExtensionState;

  // act
  const callbackOutcome = await withStateGuard(locations, (state) => {
    state.lastReconciledExtensionVersion = "automatic-save";
    return { status: "committed", scope: locations.scope } as const;
  });
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  const lockHeld = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.deepStrictEqual(callbackOutcome, { status: "committed", scope: "project" });
  assert.deepStrictEqual(JSON.parse(stateBytes) as unknown, expectedState);
  assert.strictEqual(lockHeld, false);
});

test("keeps prior bytes after a state guard callback error and releases for retry", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-callback-error-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const callbackError = new Error("mutation rejected");
  await withStateGuard(locations, (state) => {
    state.lastReconciledExtensionVersion = "before-failure";
  });
  const expectedStateBytes = await readFile(locations.stateJsonPath, "utf8");

  // act
  const thrownError = await captureThrown(() =>
    withStateGuard(locations, (state) => {
      state.lastReconciledExtensionVersion = "must-not-persist";
      throw callbackError;
    }),
  );
  const retainedStateBytes = await readFile(locations.stateJsonPath, "utf8");
  const retryOutcome = await withStateGuard(
    locations,
    (state) => state.lastReconciledExtensionVersion,
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.strictEqual(thrownError, callbackError);
  assert.strictEqual(retainedStateBytes, expectedStateBytes);
  assert.strictEqual(retryOutcome, "before-failure");
  assert.strictEqual(lockHeldAfterRetry, false);
});
