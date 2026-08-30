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
import { StateLockHeldError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
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

function rejectNonError(reason: unknown): Promise<never> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- these cases prove the public non-Error normalization contract.
  return Promise.reject(reason);
}

interface ControlledPromise {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function createControlledPromise(): ControlledPromise {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (): void => {
      assert.ok(resolvePromise !== undefined);
      resolvePromise();
    },
  };
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
  const retryOutcome = await withLockedStateTransaction(locations, async (transaction) => {
    await transaction.save();
    return structuredClone(transaction.state);
  });
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

test("normalizes a non-Error callback failure without saving and releases for retry", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-callback-token-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const persistenceLog: string[] = [];
  const dependencies = {
    loadState: (extensionRoot: string): Promise<ExtensionState> => {
      persistenceLog.push(`load ${extensionRoot}`);
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
    saveState: (): Promise<void> => {
      persistenceLog.push("save");
      return Promise.resolve();
    },
  } satisfies LockedStateTransactionDeps;

  // act
  const callbackError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      (transaction) => {
        transaction.state.lastReconciledExtensionVersion = "must-not-save";
        return rejectNonError("callback stopped");
      },
      dependencies,
    ),
  );
  const stateBytes = await readOptionalStateBytes(locations.stateJsonPath);
  const retryOutcome = await withLockedStateTransaction(locations, () =>
    Promise.resolve("retry accepted" as const),
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.deepStrictEqual(callbackError, new Error("callback stopped"));
  assert.deepStrictEqual(persistenceLog, [`load ${locations.extensionRoot}`]);
  assert.strictEqual(stateBytes, undefined);
  assert.strictEqual(retryOutcome, "retry accepted");
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("propagates an injected load failure by identity and releases for retry", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-load-failure-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const loadError = new Error("state load failed");
  const persistenceLog: string[] = [];
  let callbackEntries = 0;
  const dependencies = {
    loadState: (extensionRoot: string): Promise<never> => {
      persistenceLog.push(`load ${extensionRoot}`);
      return Promise.reject(loadError);
    },
    saveState: (): Promise<void> => {
      persistenceLog.push("save");
      return Promise.resolve();
    },
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      () => {
        callbackEntries += 1;
      },
      dependencies,
    ),
  );
  const retryOutcome = await withLockedStateTransaction(locations, () =>
    Promise.resolve("retry accepted" as const),
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.strictEqual(thrownError, loadError);
  assert.deepStrictEqual(persistenceLog, [`load ${locations.extensionRoot}`]);
  assert.strictEqual(callbackEntries, 0);
  assert.strictEqual(retryOutcome, "retry accepted");
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("propagates an injected save failure by identity with the complete attempted state", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-save-failure-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const saveError = new Error("state save failed");
  const saveLog: ExtensionState[] = [];
  const dependencies = {
    loadState: (): Promise<ExtensionState> =>
      Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
    saveState: (_extensionRoot: string, state: ExtensionState): Promise<never> => {
      saveLog.push(structuredClone(state));
      return Promise.reject(saveError);
    },
  } satisfies LockedStateTransactionDeps;
  const expectedAttemptedState = {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "failed-save",
  } satisfies ExtensionState;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      async (transaction) => {
        transaction.state.lastReconciledExtensionVersion = "failed-save";
        await transaction.save();
      },
      dependencies,
    ),
  );
  const stateBytes = await readOptionalStateBytes(locations.stateJsonPath);
  const retryOutcome = await withLockedStateTransaction(locations, (transaction) =>
    Promise.resolve(structuredClone(transaction.state)),
  );
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.strictEqual(thrownError, saveError);
  assert.deepStrictEqual(saveLog, [expectedAttemptedState]);
  assert.strictEqual(stateBytes, undefined);
  assert.deepStrictEqual(retryOutcome, { schemaVersion: 2, marketplaces: {} });
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("prevents a real contender from entering and accepts it after controlled release", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-contention-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const entered = createControlledPromise();
  const release = createControlledPromise();
  let holderEntries = 0;
  let contenderEntries = 0;
  let retryEntries = 0;
  const expectedState = {
    schemaVersion: 2,
    marketplaces: {},
    lastReconciledExtensionVersion: "retry-committed",
  } satisfies ExtensionState;
  const expectedStateBytes =
    '{\n  "schemaVersion": 2,\n  "marketplaces": {},\n  "lastReconciledExtensionVersion": "retry-committed"\n}\n';

  // act
  const holderTransaction = withLockedStateTransaction(locations, async () => {
    holderEntries += 1;
    entered.resolve();
    await release.promise;
    return "holder released" as const;
  });
  await entered.promise;
  const contenderError = await captureThrown(() =>
    withStateGuard(locations, () => {
      contenderEntries += 1;
    }),
  );
  release.resolve();
  const holderOutcome = await holderTransaction;
  const retryOutcome = await withStateGuard(locations, (state) => {
    retryEntries += 1;
    state.lastReconciledExtensionVersion = "retry-committed";
    return structuredClone(state);
  });
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  const lockHeldAfterRetry = await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });

  // assert
  assert.ok(contenderError instanceof StateLockHeldError);
  assert.deepStrictEqual(
    {
      name: contenderError.name,
      message: contenderError.message,
      scope: contenderError.scope,
      lockPath: contenderError.lockPath,
    },
    {
      name: "StateLockHeldError",
      message: `Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes.`,
      scope: "project",
      lockPath: locations.stateLockFile,
    },
  );
  assert.ok(contenderError.cause instanceof Error);
  assert.strictEqual((contenderError.cause as NodeJS.ErrnoException).code, "ELOCKED");
  assert.strictEqual(holderOutcome, "holder released");
  assert.deepStrictEqual(retryOutcome, expectedState);
  assert.strictEqual(stateBytes, expectedStateBytes);
  assert.deepStrictEqual(
    { holderEntries, contenderEntries, retryEntries },
    { holderEntries: 1, contenderEntries: 0, retryEntries: 1 },
  );
  assert.strictEqual(lockHeldAfterRetry, false);
});

test("propagates an ordinary acquisition Error without loading state or entering the callback", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-acquire-error-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const acquisitionError = new Error("lock service unavailable");
  let loadAttempts = 0;
  let callbackEntries = 0;
  t.mock.method(lockfile, "lock", (): Promise<never> => Promise.reject(acquisitionError));
  const dependencies = {
    loadState: (): Promise<ExtensionState> => {
      loadAttempts += 1;
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      () => {
        callbackEntries += 1;
      },
      dependencies,
    ),
  );
  const stateBytes = await readOptionalStateBytes(locations.stateJsonPath);

  // assert
  assert.strictEqual(thrownError, acquisitionError);
  assert.deepStrictEqual(
    { loadAttempts, callbackEntries },
    { loadAttempts: 0, callbackEntries: 0 },
  );
  assert.strictEqual(stateBytes, undefined);
});

test("normalizes a non-Error acquisition failure without loading state", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-acquire-token-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  let loadAttempts = 0;
  let callbackEntries = 0;
  t.mock.method(lockfile, "lock", (): Promise<never> => rejectNonError("acquisition stopped"));
  const dependencies = {
    loadState: (): Promise<ExtensionState> => {
      loadAttempts += 1;
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      () => {
        callbackEntries += 1;
      },
      dependencies,
    ),
  );
  const stateBytes = await readOptionalStateBytes(locations.stateJsonPath);

  // assert
  assert.deepStrictEqual(thrownError, new Error("acquisition stopped"));
  assert.deepStrictEqual(
    { loadAttempts, callbackEntries },
    { loadAttempts: 0, callbackEntries: 0 },
  );
  assert.strictEqual(stateBytes, undefined);
});

test("propagates a release Error by identity after a successful callback", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-release-error-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const releaseError = new Error("lock release failed");
  let releaseAttempts = 0;
  let callbackEntries = 0;
  t.mock.method(lockfile, "lock", () =>
    Promise.resolve(() => {
      releaseAttempts += 1;
      return Promise.reject(releaseError);
    }),
  );
  const dependencies = {
    loadState: (): Promise<ExtensionState> =>
      Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      () => {
        callbackEntries += 1;
        return "callback complete" as const;
      },
      dependencies,
    ),
  );

  // assert
  assert.strictEqual(thrownError, releaseError);
  assert.deepStrictEqual(
    { callbackEntries, releaseAttempts },
    { callbackEntries: 1, releaseAttempts: 1 },
  );
});

test("normalizes a non-Error release failure after a successful callback", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-release-token-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  let releaseAttempts = 0;
  let callbackEntries = 0;
  t.mock.method(lockfile, "lock", () =>
    Promise.resolve(() => {
      releaseAttempts += 1;
      return rejectNonError("release stopped");
    }),
  );
  const dependencies = {
    loadState: (): Promise<ExtensionState> =>
      Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(
      locations,
      () => {
        callbackEntries += 1;
        return "callback complete" as const;
      },
      dependencies,
    ),
  );

  // assert
  assert.deepStrictEqual(thrownError, new Error("release stopped"));
  assert.deepStrictEqual(
    { callbackEntries, releaseAttempts },
    { callbackEntries: 1, releaseAttempts: 1 },
  );
});

test("chains a release Error behind the original callback Error", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-dual-error-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  const callbackError = new Error("callback failed");
  const releaseError = new Error("release failed");
  let releaseAttempts = 0;
  t.mock.method(lockfile, "lock", () =>
    Promise.resolve(() => {
      releaseAttempts += 1;
      return Promise.reject(releaseError);
    }),
  );
  const dependencies = {
    loadState: (): Promise<ExtensionState> =>
      Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(locations, () => Promise.reject(callbackError), dependencies),
  );

  // assert
  assert.deepStrictEqual(
    thrownError,
    new Error("callback failed (lock release also failed: release failed)", {
      cause: callbackError,
    }),
  );
  assert.strictEqual(releaseAttempts, 1);
});

test("chains non-Error callback and release failures without losing either message", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "state-guard-dual-token-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const locations = locationsFor("project", directory);
  let releaseAttempts = 0;
  t.mock.method(lockfile, "lock", () =>
    Promise.resolve(() => {
      releaseAttempts += 1;
      return rejectNonError("release stopped");
    }),
  );
  const dependencies = {
    loadState: (): Promise<ExtensionState> =>
      Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
    saveState: (): Promise<void> => Promise.reject(new Error("save must not run")),
  } satisfies LockedStateTransactionDeps;

  // act
  const thrownError = await captureThrown(() =>
    withLockedStateTransaction(locations, () => rejectNonError("callback stopped"), dependencies),
  );

  // assert
  assert.deepStrictEqual(
    thrownError,
    new Error("callback stopped (lock release also failed: release stopped)", {
      cause: new Error("callback stopped"),
    }),
  );
  assert.strictEqual(releaseAttempts, 1);
});
