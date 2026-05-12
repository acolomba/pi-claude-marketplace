// bridges/agents/index-mutation.ts
//
// Pure in-memory partition + ownership-conflict detection on the
// agents-index. NO IO. The stage.ts orchestrator wires loadAgentsIndex
// (Plan 03-02) into these helpers and then routes the partitioned slices
// into commit / abort.
//
// Hoisted into a dedicated module so the AG-3 (cross-(mp,plugin)
// preservation) and AG-9/RN-4 (cross-owner conflict) invariants live
// behind a tested seam, separately from the IO-laden 10-step prepare.

import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

/**
 * AG-3 partition result. `previous` are entries owned by the
 * (marketplace, plugin) tuple currently being staged; `other` are the
 * rest. The (mp, plugin) ordering is preserved across the partition --
 * input array order is stable.
 */
export interface PartitionedIndex {
  readonly previous: readonly AgentsIndexEntry[];
  readonly other: readonly AgentsIndexEntry[];
}

/**
 * AG-3: split the agents-index into "owned by (mp, plugin)" vs "owned by
 * anyone else". Re-staging plugin X in marketplace M1 must leave plugin X
 * in marketplace M2's rows untouched -- preserving `other` is the
 * cross-marketplace install invariant.
 *
 * Returned arrays are frozen for defense-in-depth: a downstream mutation
 * via `previous.push(...)` would silently break the AG-3 contract.
 */
export function partitionByOwner(
  entries: readonly AgentsIndexEntry[],
  mp: string,
  plugin: string,
): PartitionedIndex {
  const previous: AgentsIndexEntry[] = [];
  const other: AgentsIndexEntry[] = [];
  for (const e of entries) {
    if (e.marketplace === mp && e.plugin === plugin) {
      previous.push(e);
    } else {
      other.push(e);
    }
  }

  return { previous: Object.freeze(previous), other: Object.freeze(other) };
}

/**
 * AG-9 / RN-4 cross-owner conflict detection. Returns the list of
 * `generatedNames` that exist in `otherEntries` and would be claimed by
 * `nextNames`. Empty output means the next staging may proceed; non-empty
 * means stage.ts should throw `AgentOwnershipConflictError` carrying the
 * full conflict list.
 *
 * Result preserves input order of `nextNames` so the user-visible message
 * lists conflicts in the order the new plugin would have produced them.
 */
export function findOwnershipConflicts(
  otherEntries: readonly AgentsIndexEntry[],
  nextNames: readonly string[],
): { generatedName: string; owner: AgentsIndexEntry }[] {
  const otherByName = new Map(otherEntries.map((e) => [e.generatedName, e]));
  const conflicts: { generatedName: string; owner: AgentsIndexEntry }[] = [];
  for (const name of nextNames) {
    const owner = otherByName.get(name);
    if (owner !== undefined) {
      conflicts.push({ generatedName: name, owner });
    }
  }

  return conflicts;
}
