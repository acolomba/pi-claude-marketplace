// edge/handlers/marketplace/update.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace update [<name>] [--scope user|project]`.
//
// Two forms via optional positional:
//   - bare    -> updateAllMarketplaces
//   - <name>  -> updateMarketplace
//
// The lifecycle CompletionCache travels beside the autoupdate-cascade seam.
// The handler creates neither owner and always supplies both.
//
// D-10-18: this handler IS the run boundary for the autoupdate cascade, so
// it allocates the cascade's `PluginUpdateFn` once per invocation through
// `deps.beginPluginUpdateRun()`. Both command forms share that one
// allocation, because a bare `marketplace update` refreshing several
// marketplaces is still one run.
//
// `update` is a merged read that never writes configuration, so a
// write-target flag has no meaning for it and `parseCommandArgs` rejects
// it as an unknown flag like any other (AP-5).

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
  deps: Pick<EdgeDeps, "beginPluginUpdateRun" | "completionCache" | "gitOps">,
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

    const pluginUpdate = deps.beginPluginUpdateRun();
    if (parsed.name === undefined) {
      await updateAllMarketplaces({
        completionCache: deps.completionCache,
        ctx,
        pi,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
        pluginUpdate,
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
      pluginUpdate,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
