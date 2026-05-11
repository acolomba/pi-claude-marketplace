import { homedir } from "node:os";

import { registerClaudeMarketplaceTools, registerClaudePluginCommand } from "./edge/register.ts";
import { aggregateDiscoveredResources } from "./orchestrators/discover.ts";
import { DEFAULT_GIT_OPS } from "./orchestrators/marketplace/shared.ts";
import { updateSinglePlugin } from "./orchestrators/plugin/update.ts";
import { locationsFor } from "./persistence/locations.ts";

import type {
  ExtensionAPI,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
} from "./platform/pi-api.ts";

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  const onResourcesDiscover = pi.on.bind(pi) as unknown as (
    event: "resources_discover",
    handler: (event: ResourcesDiscoverEvent) => Promise<ResourcesDiscoverResult>,
  ) => void;

  onResourcesDiscover("resources_discover", async (event) => {
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
