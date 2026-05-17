// transaction/with-state-guard.ts
//
// Cross-process state lifecycle wrapper (ST-7 + Phase 7 D-06). Phase 8 adds
// withLockedStateTransaction for callers that need explicit save control.
//
// Concurrency scope:
//   Phase 7 D-06 adds a per-scope proper-lockfile lock around the full
//   load -> mutate -> save critical section. write-file-atomic remains the
//   byte-safety layer; this guard now prevents cross-process state/disk drift
//   caused by last-writer-wins state.json writes.
//
// ST-8 (concurrent install hard-fail) and ST-9 (update concurrent
// change) are CALLER-supplied invariants checked INSIDE the mutate
// closure -- the guard does not enforce them itself. Pattern:
//
//   await withStateGuard(loc, async (state) => {
//     const mp = state.marketplaces[mpName];
//     if (mp.plugins[pluginName]?.installed === true) {
//       throw new Error(`Plugin "${pluginName}" was installed concurrently in marketplace "${mpName}".`);
//     }
//     // ... mutate ...
//   });
//
// Per CONTEXT.md D-02, withStateGuard wraps runPhases (outer guard,
// inner ledger):
//
//   await withStateGuard(loc, async (state) => {
//     await runPhases(buildPhases(state), { ...ctx, state });
//   });

import { mkdir } from "node:fs/promises";

import lockfile from "proper-lockfile";

import { loadState, saveState, type ExtensionState } from "../persistence/state-io.ts";
import { errorMessage, StateLockHeldError } from "../shared/errors.ts";

import type { ScopedLocations } from "../persistence/locations.ts";

export interface LockedStateTransaction {
  readonly state: ExtensionState;
  save(): Promise<void>;
}

export interface LockedStateTransactionDeps {
  readonly loadState?: typeof loadState;
  readonly saveState?: typeof saveState;
}

/**
 * ST-7: load fresh state, hand to closure, save only on no-throw.
 *
 * Concurrency scope: Phase 7 D-06 acquires a per-scope proper-lockfile
 * lock before loadState and releases it after saveState (or after any
 * mutate/save throw) so two Pi processes cannot last-writer-wins state.json
 * into state/disk drift. write-file-atomic remains the byte-level safety
 * layer for the final write.
 *
 * @param locations  ScopedLocations for the target scope (`locationsFor(scope, cwd)`)
 * @param mutate     async or sync closure that receives the fresh state and may mutate it
 * @returns          the closure's return value (NOT the state)
 *
 * On any throw inside `mutate`, the original error propagates and
 * `saveState` is NOT called -- ST-7 contract: "save only on no-throw."
 */
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
): Promise<T> {
  return withScopeLock(locations, async () => {
    const fresh = await loadState(locations.extensionRoot);
    const result = await mutate(fresh);
    await saveState(locations.extensionRoot, fresh);
    return result;
  });
}

/**
 * Phase 8 / PRL-10: hold the per-scope state lock while callers explicitly
 * choose when to save. Reinstall uses this to rollback already-swapped
 * physical resources if state persistence fails.
 */
export async function withLockedStateTransaction<T>(
  locations: ScopedLocations,
  run: (tx: LockedStateTransaction) => Promise<T> | T,
  deps?: LockedStateTransactionDeps,
): Promise<T> {
  return withScopeLock(locations, async () => {
    const fresh = await (deps?.loadState ?? loadState)(locations.extensionRoot);
    let saved = false;
    const tx: LockedStateTransaction = {
      state: fresh,
      save: async (): Promise<void> => {
        if (saved) {
          throw new Error("LockedStateTransaction.save() called more than once.");
        }

        saved = true;
        await (deps?.saveState ?? saveState)(locations.extensionRoot, fresh);
      },
    };
    return run(tx);
  });
}

/**
 * Per-scope proper-lockfile lifecycle. Acquires the lock (mapping ELOCKED
 * to StateLockHeldError), runs the body, and releases the lock -- chaining
 * release errors into the body error if both fail so neither is dropped.
 */
async function withScopeLock<T>(locations: ScopedLocations, body: () => Promise<T>): Promise<T> {
  await mkdir(locations.extensionRoot, { recursive: true });

  let release: () => Promise<void>;
  try {
    release = await acquireStateLock(locations);
  } catch (err) {
    if (isLockHeldError(err)) {
      throw new StateLockHeldError(locations.scope, locations.stateLockFile, { cause: err });
    }

    throw toError(err);
  }

  let result: T | undefined;
  let primaryError: unknown;
  try {
    result = await body();
  } catch (err) {
    primaryError = err;
  } finally {
    try {
      await release();
    } catch (releaseErr) {
      if (primaryError === undefined) {
        primaryError = releaseErr;
      } else {
        const base =
          primaryError instanceof Error ? primaryError : new Error(errorMessage(primaryError));
        primaryError = new Error(
          `${base.message} (lock release also failed: ${errorMessage(releaseErr)})`,
          { cause: base },
        );
      }
    }
  }

  if (primaryError !== undefined) {
    throw toError(primaryError);
  }

  return result as T;
}

function acquireStateLock(locations: ScopedLocations): Promise<() => Promise<void>> {
  return lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
    retries: 0,
    stale: 10_000,
    update: 2_000,
  });
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(errorMessage(err));
}

function isLockHeldError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ELOCKED"
  );
}
