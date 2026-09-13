// edge/handlers/marketplace/update.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace update [<name>] [--scope user|project]`.
//
// Two forms via optional positional:
//   - bare    -> updateAllMarketplaces
//   - <name>  -> updateMarketplace
//
// The lifecycle CompletionCache travels beside the unchanged `pluginUpdate`
// callback. The handler creates neither owner and always supplies both.

import {
  updateAllMarketplaces,
  updateMarketplace,
} from "../../../orchestrators/marketplace/update.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace update [<name>] [--scope user|project]";

export function makeMarketplaceUpdateHandler(
  pi: ExtensionAPI,
  deps: Pick<EdgeDeps, "completionCache" | "gitOps" | "pluginUpdate">,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name", required: false }] as const,
        usage: USAGE,
      },
      (message) => {
        // Argument-parsing failure:
        // -> sentence + Usage block via notifyUsageError.
        notifyUsageError(ctx, {
          message,
          usage: USAGE,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    if (parsed.name === undefined) {
      await updateAllMarketplaces({
        completionCache: deps.completionCache,
        ctx,
        pi,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
        pluginUpdate: deps.pluginUpdate,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
      });
      return;
    }

    await updateMarketplace({
      completionCache: deps.completionCache,
      ctx,
      pi,
      name: parsed.name,
      cwd: ctx.cwd,
      gitOps: deps.gitOps,
      pluginUpdate: deps.pluginUpdate,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
