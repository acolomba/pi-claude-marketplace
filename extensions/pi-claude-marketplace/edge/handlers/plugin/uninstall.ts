// edge/handlers/plugin/uninstall.ts
//
// Thin-shim handler factory for
// `/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]`.
// Identical shim shape as install.ts; delegates to `uninstallPlugin`.

import { createUninstallOperation } from "../../../orchestrators/plugin/operations.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { UninstallHooksRouting } from "../../../orchestrators/plugin/uninstall.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--local]";

export function makeUninstallHandler(
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): SubcommandHandler {
  const uninstallPlugin = createUninstallOperation(hooksRouting, completionCache);
  return async (args, ctx, run): Promise<void> => {
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
      run,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      cwd: ctx.cwd,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
      ...(localFlag.local && { local: true }),
    });
  };
}
