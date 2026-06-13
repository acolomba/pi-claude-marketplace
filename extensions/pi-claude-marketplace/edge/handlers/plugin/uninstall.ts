// edge/handlers/plugin/uninstall.ts
//
// Thin-shim handler factory for
// `/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]`.
// Identical Pattern 1 shape as install.ts; delegates to `uninstallPlugin`.

import { uninstallPlugin } from "../../../orchestrators/plugin/uninstall.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]";

export function makeUninstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts.
    const localFlag = extractLocalFlag(args, ctx, USAGE);
    if (localFlag === undefined) {
      return;
    }

    const parsed = parseRequiredPluginMarketplaceRef(localFlag.residualArgs, ctx, USAGE);
    if (parsed === undefined) {
      return;
    }

    await uninstallPlugin({
      ctx,
      pi,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      cwd: ctx.cwd,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
      ...(localFlag.local && { local: true }),
    });
  };
}
