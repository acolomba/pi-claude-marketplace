// edge/handlers/marketplace/info.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace info <name> [--scope user|project]`.
// Argument-parsing failures route through `notifyUsageError`; the
// orchestrator handles per-scope projection, fan-out, and the
// `{not added}` carve-out. This shim validates the positional/scope
// shape and delegates.

import { getMarketplaceInfo } from "../../../orchestrators/marketplace/info.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin marketplace info <name> [--scope user|project]";

export function makeMarketplaceInfoHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name" }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyUsageError(ctx, {
          message: message === USAGE ? "Missing required argument." : message,
          usage: USAGE,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await getMarketplaceInfo({
      ctx,
      pi,
      name: parsed.name,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
