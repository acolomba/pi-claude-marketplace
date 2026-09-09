// orchestrators/plugin/update-flow.ts
//
// Public composition root for direct and marketplace-cascade plugin updates.
// The retained update hub owns target enumeration and failure projection until
// its final retirement; this owner binds it to preflight, swap, and cascade.

import { composeUpdateCascade } from "./update-cascade.ts";
import { preparePluginUpdate } from "./update-preflight.ts";
import { swapPluginUpdate } from "./update-swap.ts";
import { updatePluginsWith, updateSinglePluginWith } from "./update.ts";

import type { UpdateHooksRouting } from "./update-cascade.ts";
import type { UpdatePluginsOptions } from "./update-preflight.ts";
import type { ThreePhaseArgs, UpdateRunOutcome } from "./update-swap.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { PluginUpdateFn } from "../types.ts";

/** Direct/bulk update operation with the complete command option contract. */
export type UpdatePluginsFn = (options: UpdatePluginsOptions) => Promise<void>;

/** The direct and cascade update operations owned by one extension lifecycle. */
export interface PluginUpdateOperations {
  readonly updatePlugins: UpdatePluginsFn;
  readonly pluginUpdate: PluginUpdateFn;
}

async function runPluginUpdate(args: ThreePhaseArgs): Promise<UpdateRunOutcome> {
  const preflight = await preparePluginUpdate(args);
  if ("partition" in preflight) {
    return preflight as UpdateRunOutcome;
  }

  return swapPluginUpdate(args, preflight);
}

/** Binds update preflight, swap, cascade, and lifecycle routing once. */
export function createPluginUpdateOperations(
  hooksRouting: UpdateHooksRouting,
  completionCache: CompletionCache,
): PluginUpdateOperations {
  const updatePlugins: UpdatePluginsFn = (options) =>
    updatePluginsWith(
      options,
      hooksRouting,
      completionCache,
      runPluginUpdate,
      composeUpdateCascade,
    );
  const pluginUpdate: PluginUpdateFn = (plugin, marketplace, scope) =>
    updateSinglePluginWith(
      hooksRouting,
      completionCache,
      runPluginUpdate,
      plugin,
      marketplace,
      scope,
    );
  return { updatePlugins, pluginUpdate };
}
