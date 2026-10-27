// edge/handlers/marketplace/update.ts
//
// Thin-shim handler factory for `marketplace update`; its usage line comes
// from `marketplaceUsage("update")`.
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
import { marketplaceUsage } from "../../router.ts";

import type { SubcommandHandler } from "../../router.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = marketplaceUsage("update");

export function makeMarketplaceUpdateHandler(
  deps: Pick<
    EdgeDeps,
    "beginPluginUpdateRun" | "completionCache" | "gitOps" | "installMissingDependencies"
  >,
): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name", label: "Marketplace name", required: false }] as const,
        usage: USAGE,
      },
      (message) => {
        // Argument-parsing failure:
        // -> sentence + Usage block via notifyUsageError.
        notifyUsageError(ctx, run, {
          message,
          usage: USAGE,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    const pluginUpdate = deps.beginPluginUpdateRun({ ctx, run });
    if (parsed.name === undefined) {
      await updateAllMarketplaces({
        completionCache: deps.completionCache,
        ctx,
        run,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
        pluginUpdate,
        installMissingDependencies: deps.installMissingDependencies,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
      });
      return;
    }

    await updateMarketplace({
      completionCache: deps.completionCache,
      ctx,
      run,
      name: parsed.name,
      cwd: ctx.cwd,
      gitOps: deps.gitOps,
      pluginUpdate,
      installMissingDependencies: deps.installMissingDependencies,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
