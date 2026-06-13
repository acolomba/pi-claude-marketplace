import { homedir } from "node:os";

import { registerClaudeMarketplaceTools, registerClaudePluginCommand } from "./edge/register.ts";
import { aggregateDiscoveredResources } from "./orchestrators/discover.ts";
import { DEFAULT_GIT_OPS } from "./orchestrators/marketplace/shared.ts";
import { updateSinglePlugin } from "./orchestrators/plugin/update.ts";
import { applyReconcile } from "./orchestrators/reconcile/apply.ts";
import { locationsFor } from "./persistence/locations.ts";
import { errorMessage } from "./shared/errors.ts";
import { makeRawNotifyFn } from "./shared/notify.ts";

import type {
  ExtensionAPI,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
} from "./platform/pi-api.ts";

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  const onResourcesDiscover = pi.on.bind(pi) as unknown as (
    event: "resources_discover",
    handler: (
      event: ResourcesDiscoverEvent,
      ctx: import("./platform/pi-api.ts").ExtensionContext,
    ) => Promise<ResourcesDiscoverResult>,
  ) => void;

  onResourcesDiscover("resources_discover", async (event, ctx) => {
    // RECON-01..05: apply the load-time reconcile BEFORE
    // discovering resources so newly-materialized artefacts are picked up on
    // the SAME load. The outer try/catch enforces NFR-2: a catastrophic
    // throw NEVER blocks Pi load -- it surfaces as a single last-ditch
    // notify (inside its own try/catch so a UI failure can't propagate
    // either) and aggregateDiscoveredResources still runs.
    try {
      await applyReconcile({ ctx, pi, cwd: event.cwd });
    } catch (err) {
      try {
        // AUTH-01 / IL-2 escape: makeRawNotifyFn is the sanctioned raw-text
        // notify wrapper -- the last-ditch error path predates any structured
        // NotificationMessage construction and routes through this seam to
        // surface a single error string. The inner try/catch ensures a notify
        // failure NEVER propagates past resources_discover (NFR-2).
        // Y7 (PR #51): route through shared errorMessage so a non-Error
        // throw (e.g. a literal string) renders its stringified form
        // instead of `reconcile aborted: undefined`.
        makeRawNotifyFn(ctx)(`reconcile aborted: ${errorMessage(err)}`, "error");
      } catch {
        // Last-ditch: never let a notify failure propagate past
        // resources_discover (NFR-2 boundary preservation).
      }
    }

    const discovered = await aggregateDiscoveredResources(
      locationsFor("user", homedir()),
      locationsFor("project", event.cwd),
    );
    return {
      skillPaths: [...discovered.skillPaths],
      promptPaths: [...discovered.promptPaths],
    };
  });

  registerClaudePluginCommand(pi, {
    gitOps: DEFAULT_GIT_OPS,
    pluginUpdate: updateSinglePlugin,
  });
  registerClaudeMarketplaceTools(pi);
}
