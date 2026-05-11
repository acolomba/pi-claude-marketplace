// transaction/with-state-guard.ts
//
// Cross-process state lifecycle wrapper (ST-7 + Phase 7 D-06).
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
  await mkdir(locations.extensionRoot, { recursive: true });

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
      stale: 10_000,
      update: 2_000,
    });
  } catch (err) {
    if (isLockHeldError(err)) {
      throw new StateLockHeldError(locations.scope, locations.stateLockFile, { cause: err });
    }

    throw toError(err);
  }

  let result: T | undefined;
  let primaryError: unknown;
  try {
    const fresh = await loadState(locations.extensionRoot);
    result = await mutate(fresh);
    await saveState(locations.extensionRoot, fresh);
  } catch (err) {
    primaryError = err;
  } finally {
    try {
      await release();
    } catch (releaseErr) {
      if (primaryError === undefined) {
        primaryError = releaseErr;
      }
    }
  }

  if (primaryError !== undefined) {
    throw toError(primaryError);
  }

  return result as T;
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
