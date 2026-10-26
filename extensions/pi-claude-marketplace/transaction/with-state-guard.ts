// transaction/with-state-guard.ts
//
// Cross-process state lifecycle wrapper (ST-7 + D-06). withLockedStateTransaction
// serves callers that need explicit save control.
//
// Concurrency scope:
//   D-06 provides a per-scope proper-lockfile lock around the full
//   load -> mutate -> save critical section. write-file-atomic is the
//   byte-safety layer; this guard prevents cross-process state/disk drift
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
// Per D-02, withStateGuard wraps runPhases (outer guard,
// inner ledger):
//
//   await withStateGuard(loc, async (state) => {
//     await runPhases(buildPhases(state), { ...ctx, state });
//   });

import { mkdir } from "node:fs/promises";

import lockfile from "proper-lockfile";

import { loadState, saveState, type ExtensionState } from "../persistence/state-io.ts";
import { errorMessage, StateLockCompromisedError, StateLockHeldError } from "../shared/errors.ts";

import type { ScopedLocations } from "../persistence/locations.ts";

/** A locked load of the scope's state, saved at most once through `save()`. */
export interface LockedStateTransaction {
  readonly state: ExtensionState;
  save(): Promise<void>;
}

/** Replacement state I/O for `withStateGuard` and `withLockedStateTransaction`. */
export interface LockedStateTransactionDeps {
  readonly loadState?: typeof loadState;
  readonly saveState?: typeof saveState;
  /** Defers legacy migration persistence to the caller's explicit save. */
  readonly persistMigration?: boolean;
}

/**
 * ST-7: load fresh state, hand to closure, save only on no-throw.
 *
 * Concurrency scope: D-06 acquires a per-scope proper-lockfile
 * lock before loadState and releases it after saveState (or after any
 * mutate/save throw) so two Pi processes cannot last-writer-wins state.json
 * into state/disk drift. write-file-atomic is the byte-level safety
 * layer for the final write.
 *
 * @param locations  ScopedLocations for the target scope (`locationsFor(scope, cwd)`)
 * @param mutate     async or sync closure that receives the fresh state and may mutate it
 * @param deps       optional state I/O replacements; production callers omit them
 * @returns          the closure's return value (NOT the state)
 *
 * On any throw inside `mutate`, the original error propagates and
 * `saveState` is NOT called -- ST-7 contract: "save only on no-throw."
 */
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
  deps?: LockedStateTransactionDeps,
): Promise<T> {
  return withScopeLock(locations, async (assertLockHeld) => {
    const fresh = await (deps?.loadState ?? loadState)(locations.extensionRoot);
    const result = await mutate(fresh);
    assertLockHeld();
    await (deps?.saveState ?? saveState)(locations.extensionRoot, fresh);
    return result;
  });
}

/**
 * PRL-10: hold the per-scope state lock while callers explicitly
 * choose when to save. Reinstall uses this to rollback already-swapped
 * physical resources if state persistence fails.
 */
export async function withLockedStateTransaction<T>(
  locations: ScopedLocations,
  run: (tx: LockedStateTransaction) => Promise<T> | T,
  deps?: LockedStateTransactionDeps,
): Promise<T> {
  return withScopeLock(locations, async (assertLockHeld) => {
    const fresh = await (deps?.loadState ?? loadState)(locations.extensionRoot, {
      persistMigration: deps?.persistMigration ?? true,
    });
    let saved = false;
    const tx: LockedStateTransaction = {
      state: fresh,
      save: async (): Promise<void> => {
        if (saved) {
          throw new Error("LockedStateTransaction.save() called more than once.");
        }

        assertLockHeld();
        saved = true;
        await (deps?.saveState ?? saveState)(locations.extensionRoot, fresh);
      },
    };
    return run(tx);
  });
}

async function withScopeLock<T>(
  locations: ScopedLocations,
  body: (assertLockHeld: () => void) => Promise<T>,
): Promise<T> {
  await mkdir(locations.extensionRoot, { recursive: true });
  return withExistingScopeLock(locations, body);
}

/** What `body` gave back: its value, or what it threw. */
type BodyOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

/** The held scope lock, and the compromise proper-lockfile reported for it, if any. */
interface HeldScopeLock {
  readonly release: () => Promise<void>;
  readonly compromise: () => StateLockCompromisedError | undefined;
}

/**
 * Per-scope proper-lockfile lifecycle around `body`, with no state read or
 * write. Acquires the lock (mapping ELOCKED to StateLockHeldError), runs the
 * body, and releases the lock -- chaining release errors into the body error
 * if both fail so neither is dropped. It creates no directory, so acquisition
 * rejects when the scope's extension root does not exist.
 *
 * D-06 / NFR-2: a lock proper-lockfile reports compromised while `body` runs
 * never crashes the process. `body` gets `assertLockHeld`, which throws
 * StateLockCompromisedError once the lock is lost; the state guards call it
 * before they save. A body that finishes on a lost lock fails with that error
 * at release.
 */
export async function withExistingScopeLock<T>(
  locations: ScopedLocations,
  body: (assertLockHeld: () => void) => Promise<T>,
): Promise<T> {
  const lock = await acquireStateLock(locations);
  let outcome: BodyOutcome<T>;
  try {
    outcome = {
      ok: true,
      value: await body(() => {
        const compromise = lock.compromise();
        if (compromise !== undefined) {
          throw compromise;
        }
      }),
    };
  } catch (err) {
    outcome = { ok: false, error: err };
  }

  const settled = await releaseStateLock(lock, outcome);
  if (!settled.ok) {
    throw toError(settled.error);
  }

  return settled.value;
}

/**
 * Releases the lock and folds a release failure into `outcome`. A compromised
 * lock is already released by proper-lockfile, whose release then rejects, so
 * it is not released again: the compromise fails a body that succeeded, and a
 * body error stays the error.
 */
async function releaseStateLock<T>(
  lock: HeldScopeLock,
  outcome: BodyOutcome<T>,
): Promise<BodyOutcome<T>> {
  const compromise = lock.compromise();
  if (compromise !== undefined) {
    return outcome.ok ? { ok: false, error: compromise } : outcome;
  }

  try {
    await lock.release();
    return outcome;
  } catch (releaseErr) {
    if (outcome.ok) {
      return { ok: false, error: releaseErr };
    }

    const base = toError(outcome.error);
    return {
      ok: false,
      error: new Error(`${base.message} (lock release also failed: ${errorMessage(releaseErr)})`, {
        cause: base,
      }),
    };
  }
}

async function acquireStateLock(locations: ScopedLocations): Promise<HeldScopeLock> {
  const compromised: { cause?: Error } = {};
  let release: () => Promise<void>;
  try {
    release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
      stale: 10_000,
      update: 2_000,
      // proper-lockfile's default rethrows from its refresh timer, which
      // would crash Pi; the compromise is recorded and surfaced instead.
      onCompromised: (error: Error) => {
        compromised.cause ??= error;
      },
    });
  } catch (err) {
    if (isLockHeldError(err)) {
      throw new StateLockHeldError(locations.scope, locations.stateLockFile, { cause: err });
    }

    throw toError(err);
  }

  return {
    release,
    compromise: () =>
      compromised.cause === undefined
        ? undefined
        : new StateLockCompromisedError(locations.scope, locations.stateLockFile, {
            cause: compromised.cause,
          }),
  };
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
