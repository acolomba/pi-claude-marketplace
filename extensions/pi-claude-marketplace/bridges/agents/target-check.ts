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
import { pathExists } from "../../shared/fs-utils.ts";

import { partitionByOwner } from "./index-mutation.ts";
import { isOwnedAgentFile } from "./marker.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * D-PL4-04: refuses when a generated agent name's target holds a file that no
 * replaced index row of `owner` names. The rule is the one the agents commit
 * applies without `force`: a row of the plugin is replaced only while its file
 * is still the plugin's own (AG-5). The check reads the agents index and the
 * disk, and writes nothing. It throws the commit's own message.
 */
export async function assertAgentTargetsFree(
  locations: ScopedLocations,
  owner: { readonly marketplace: string; readonly plugin: string },
  generatedNames: readonly string[],
): Promise<void> {
  const loaded = await loadAgentsIndex(locations);
  const { previous } = partitionByOwner(loaded.agents, owner.marketplace, owner.plugin);
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
      throw new Error(`Cannot replace agent target with non-previous content at ${target}`);
    }
  }
}
