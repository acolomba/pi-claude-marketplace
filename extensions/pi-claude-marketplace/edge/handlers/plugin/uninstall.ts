// edge/handlers/plugin/uninstall.ts
//
// Thin-shim handler factory for
// `/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]`.
// Identical Pattern 1 shape as install.ts; delegates to `uninstallPlugin`.

import { uninstallPlugin } from "../../../orchestrators/plugin/uninstall.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]";

export function makeUninstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseRequiredPluginMarketplaceRef(args, ctx, USAGE);
    if (parsed === undefined) {
      return;
    }

    await uninstallPlugin({
      ctx,
      pi,
      scope: parsed.scope,
      cwd: ctx.cwd,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
    });
  };
}
