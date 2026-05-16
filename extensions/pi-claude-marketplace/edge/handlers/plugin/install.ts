// edge/handlers/plugin/install.ts
//
// Thin-shim handler factory for `/claude:plugin install <plugin>@<marketplace>`.
// Pattern 1 from 06-PATTERNS.md: parseCommandArgs -> early return on undefined
// (Usage already emitted via notifyError) -> delegate to installPlugin
// orchestrator.
//
// BLOCK A: zero direct ctx.ui.notify calls -- all user-visible messages route
// through shared/notify.ts wrappers via the closure passed to parseCommandArgs.
// BLOCK C: no imports from persistence/, domain/, bridges/, transaction/,
// platform/. Only orchestrators/, shared/, edge/ (sibling) imports.

import { installPlugin } from "../../../orchestrators/plugin/install.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project]";

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `installPlugin` for soft-dep probes). Phase 6 Plan 05 wires this factory
 * into `register.ts` via the `SubcommandHandlers` map.
 */
export function makeInstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseRequiredPluginMarketplaceRef(args, ctx, USAGE);
    if (parsed === undefined) {
      return;
    }

    await installPlugin({
      ctx,
      pi,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
    });
  };
}
