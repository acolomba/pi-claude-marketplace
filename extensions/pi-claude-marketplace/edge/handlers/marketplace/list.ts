// edge/handlers/marketplace/list.ts
//
// Thin-shim factory for
// `/claude:plugin marketplace <list|ls> [--scope user|project]`.
// Also reached via the `ls` alias through edge/router.ts.
//
// Plan 18-00 (Wave 0, D-18-08 amendment): converted from the previous
// plain `handleMarketplaceList(args, ctx)` function into a
// `makeMarketplaceListHandler(pi)` factory that returns the same
// `(args, ctx) => Promise<void>` shape. The `pi` reference is threaded
// down to `listMarketplaces`'s required `pi` field so subsequent
// Wave 1/2 plans can swap V1 notify-wrappers for V2 `notify(ctx, pi,
// message)` calls without touching this shim again. The factory naming
// follows the sibling `makeAddHandler` / `makeAutoupdateHandler` /
// `makeRemoveHandler` convention.

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
        notifyUsageError(ctx, message, USAGE);
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
