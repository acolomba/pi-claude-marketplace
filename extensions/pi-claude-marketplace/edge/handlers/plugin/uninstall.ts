// edge/handlers/plugin/uninstall.ts
//
// Thin-shim handler factory for
// `/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]
// [--keep-data] [--local]`.
// Same thin-shim shape as install.ts -- parse, then one orchestrator call --
// but a different scanner mode: install passes its pass-through flags as the
// array form and re-scans them downstream, while uninstall uses the CONSUMING
// form and reads the extra flags off `consumedFlags`. Delegates to
// `uninstallPlugin`.

import { createNodeUninstallPlugin } from "../../../orchestrators/plugin/uninstall.ts";
import { KEEP_DATA_FLAG, passThroughFlagNames } from "../../flag-catalog.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { UninstallHooksRouting } from "../../../orchestrators/plugin/uninstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";

const USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local]";

// D-02-02 / D-02-05: the catalog owns which extra flags this verb accepts, and
// WR-01 makes it own the `--keep-data` NAME too (imported above), so the
// accepted set and the option mapping below cannot drift apart. The scanner
// CONSUMES the accepted flags, so the residual reaching the reference parser
// holds positionals and the `--scope` pair alone, and every other option --
// long or short -- is rejected before any state-changing work runs.
const CONSUMED_FLAGS = { consumeLongFlags: passThroughFlagNames("uninstall") };

export function makeUninstallHandler(
  pi: ExtensionAPI,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const uninstallPlugin = createNodeUninstallPlugin(hooksRouting, completionCache);
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts.
    const localFlag = extractLocalFlag(args, ctx, USAGE, CONSUMED_FLAGS);
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
      // DATA-01 / D-02-04: omission is the deletion default, so the property is
      // omitted rather than forwarded as false.
      ...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true }),
      ...(localFlag.local && { local: true }),
    });
  };
}
