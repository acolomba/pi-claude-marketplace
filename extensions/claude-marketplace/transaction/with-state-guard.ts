// transaction/with-state-guard.ts
//
// Intra-process state lifecycle wrapper (ST-7).
//
// Concurrency scope (RESEARCH.md Pitfall 4, MUST stay in this docstring):
//   This is an INTRA-process preflight guard, NOT a cross-process
//   transaction. Two pi processes targeting the same scope can still
//   last-writer-wins on state.json. Cross-process safety is provided by
//   write-file-atomic's queue (Phase 1 D-03) at the byte level only;
//   the in-memory mutation race window is real but small.
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

import { loadState, saveState, type ExtensionState } from "../persistence/state-io.ts";

import type { ScopedLocations } from "../persistence/locations.ts";

/**
 * ST-7: load fresh state, hand to closure, save only on no-throw.
 *
 * Concurrency scope: this is an INTRA-process preflight guard, not a
 * cross-process transaction. Two pi processes against the same scope
 * can still last-writer-wins on state.json -- cross-process safety
 * lives only at the byte level via write-file-atomic's queue (Phase 1
 * D-03), not at the load-mutate-save granularity. (RESEARCH.md
 * Pitfall 4.)
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
  const fresh = await loadState(locations.extensionRoot);
  const result = await mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
}
