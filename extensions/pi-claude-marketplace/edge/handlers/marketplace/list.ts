// edge/handlers/marketplace/list.ts
//
// Thin-shim factory for `marketplace list`; its usage line comes from
// `marketplaceUsage("list")`.
// Also reached via the `ls` alias through edge/router.ts.
//
// `makeMarketplaceListHandler()` returns a handler that passes the command's
// notification run down to `listMarketplaces`, which renders from the run's
// soft-dependency snapshot (D-05).
//
// `list` is a merged read that never writes configuration, so a
// write-target flag has no meaning for it and `parseCommandArgs` rejects
// it as an unknown flag like any other (AP-5).

import { listMarketplaces } from "../../../orchestrators/marketplace/list.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { marketplaceUsage } from "../../router.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = marketplaceUsage("list");

export function makeMarketplaceListHandler(): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [] as const,
        usage: USAGE,
      },
      (message) => {
        notifyUsageError(ctx, run, { message, usage: USAGE });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await listMarketplaces({
      ctx,
      run,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
