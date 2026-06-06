// bridges/agents/unstage.ts
//
// Plugin-scoped removal. Foreign-content / read / delete failures are NOT
// treated as removed: their index rows are preserved (NOT dropped) and
// failed[] surfaces the reason. The per-entry Outcome union pattern lets
// commit batch all rms in parallel and then partition outcomes into
// removed[] vs preserved[].
//
// AG-5 contract (T-03-32): on a foreign-content target, unstage SOFT-FAILS
// rather than rm-ing -- the index row is kept so a future retry surfaces
// the same warning, and the orchestrator routes failed[] entries to
// notifyError. We never silently drop a row whose on-disk file was not
// successfully removed; if we did, an unrelated foreign file would be
// orphaned in <scopeRoot>/agents/ with no index trace.

import { rm } from "node:fs/promises";

import { loadAgentsIndex, saveAgentsIndex } from "../../persistence/agents-index-io.ts";
import { errorMessage } from "../../shared/errors.ts";

import { partitionByOwner } from "./index-mutation.ts";
import { isOwnedAgentFile, type SafetyResult } from "./marker.ts";

import type { UnstageAgentFailure, UnstageAgentsInput, UnstageAgentsResult } from "./types.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

type Outcome =
  | { kind: "removed"; name: string }
  | { kind: "preserved"; entry: AgentsIndexEntry; failure: UnstageAgentFailure };

/**
 * Plugin-scoped removal. Loads agents-index, partitions by (mp, plugin),
 * runs per-entry rm-with-marker-check, and rewrites the index with
 * `nonMatching ∪ preservedMatching`.
 *
 * The returned UnstageAgentsResult is shaped for the orchestrator:
 *   - removedNames: index rows that were successfully rm'd from disk +
 *     dropped from the index.
 *   - failed: per-entry failure descriptors. Index rows for these entries
 *     are PRESERVED in agents-index.json so the user can retry after
 *     fixing the underlying foreign content.
 *   - warnings: load-time per-row corruption messages from
 *     loadAgentsIndex (AG-4 soft-fail discipline).
 *
 * Idempotency: ENOENT on the targetPath is treated as "removed". After this
 * returns, calling it again with the same input is a no-op modulo the index
 * state.
 */
export async function unstagePluginAgents(input: UnstageAgentsInput): Promise<UnstageAgentsResult> {
  const { locations, marketplaceName, pluginName } = input;
  const loaded = await loadAgentsIndex(locations);
  const { previous: matching, other: nonMatching } = partitionByOwner(
    loaded.agents,
    marketplaceName,
    pluginName,
  );

  if (matching.length === 0) {
    return {
      removedNames: Object.freeze([]),
      failed: Object.freeze([]),
      warnings: Object.freeze([...loaded.corruptions]),
    };
  }

  const outcomes = await Promise.all(
    matching.map(async (entry): Promise<Outcome> => {
      const fail = (reason: string): Outcome => ({
        kind: "preserved",
        entry,
        failure: { generatedName: entry.generatedName, targetPath: entry.targetPath, reason },
      });

      let safety: SafetyResult;
      try {
        safety = await isOwnedAgentFile(entry.targetPath);
      } catch (err) {
        return fail(errorMessage(err));
      }

      if (!safety.ok) {
        return fail(safety.reason);
      }

      try {
        await rm(entry.targetPath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          return fail(errorMessage(err));
        }
      }

      return { kind: "removed", name: entry.generatedName };
    }),
  );

  const removedNames: string[] = [];
  const failed: UnstageAgentFailure[] = [];
  const preservedEntries: AgentsIndexEntry[] = [];
  for (const o of outcomes) {
    if (o.kind === "removed") {
      removedNames.push(o.name);
    } else {
      failed.push(o.failure);
      preservedEntries.push(o.entry);
    }
  }

  // Persist the reduced index: nonMatching (AG-3) ∪ preservedMatching
  // (AG-5 / T-03-32).
  await saveAgentsIndex(locations, {
    schemaVersion: 1,
    agents: [...nonMatching, ...preservedEntries],
  });

  return {
    removedNames: Object.freeze(removedNames),
    failed: Object.freeze(failed),
    warnings: Object.freeze([...loaded.corruptions]),
  };
}
