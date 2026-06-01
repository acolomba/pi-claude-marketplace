// edge/handlers/marketplace/list.ts
//
// Thin-shim factory for
// `/claude:plugin marketplace <list|ls> [--scope user|project]`.
// Also reached via the `ls` alias through edge/router.ts.
//
// `makeMarketplaceListHandler(pi)` factory threads `pi` down to
// `listMarketplaces`, following the `makeAddHandler` /
// `makeAutoupdateHandler` / `makeRemoveHandler` convention.

import { listMarketplaces } from "../../../orchestrators/marketplace/list.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin marketplace <list|ls> [--scope user|project]";

export function makeMarketplaceListHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [] as const,
        usage: USAGE,
      },
      (message) => {
        notifyUsageError(ctx, { message, usage: USAGE });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await listMarketplaces({
      ctx,
      pi,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
