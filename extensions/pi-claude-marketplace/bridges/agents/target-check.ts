// bridges/agents/target-check.ts
//
// D-PL4-04: the write-free form of the agents commit's refusal of a
// non-previous target. A dependency plan and an update's WR-C check run it, so
// they find an occupied agent target before any move lands, not in a later
// swap. Pi agents share one `<scope>/agents/` directory, while Claude Code
// loads plugin agents from each plugin's own cache directory. So this check
// covers a Pi capability gap; it is not a divergence from upstream.

import path from "node:path";

import { loadAgentsIndex } from "../../persistence/agents-index-io.ts";
import { AgentTargetOccupiedError } from "../../shared/errors-bridges.ts";
import { pathExists } from "../../shared/fs-utils.ts";

import { assertAgentNamesUnclaimed, partitionByOwner } from "./index-mutation.ts";
import { isOwnedAgentFile } from "./marker.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * D-PL4-04: refuses foreign index claims with `AgentOwnershipConflictError`,
 * even when their target files are absent (AG-9). It also refuses a target
 * holding a file that no replaced index row of `owner` names. The agents
 * commit applies this rule without `force`: it replaces a row only while
 * the file still belongs to the plugin (AG-5). An occupied target throws
 * `AgentTargetOccupiedError`, with the file name in place of the full path.
 * The check reads the agents index and disk, and writes nothing.
 */
export async function assertAgentTargetsFree(
  locations: ScopedLocations,
  owner: { readonly marketplace: string; readonly plugin: string },
  generatedNames: readonly string[],
): Promise<void> {
  const loaded = await loadAgentsIndex(locations);
  const { previous, other } = partitionByOwner(loaded.agents, owner.marketplace, owner.plugin);
  assertAgentNamesUnclaimed(owner, other, generatedNames);
  const replacedTargets = new Set<string>();
  for (const entry of previous) {
    // eslint-disable-next-line no-await-in-loop -- bounded by this plugin's prior agents, one ownership read each
    if ((await isOwnedAgentFile(entry.targetPath)).ok) {
      replacedTargets.add(entry.targetPath);
    }
  }

  for (const name of generatedNames) {
    const target = path.join(locations.agentsDir, `${name}.md`);
    // eslint-disable-next-line no-await-in-loop -- the first occupied target throws
    if (!replacedTargets.has(target) && (await pathExists(target))) {
      throw new AgentTargetOccupiedError(target);
    }
  }
}
