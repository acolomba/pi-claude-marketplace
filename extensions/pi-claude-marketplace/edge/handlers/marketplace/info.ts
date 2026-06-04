// edge/handlers/marketplace/info.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace info <name> [--scope user|project]`.
//
// Phase 43 / INFO-01 + INFO-03 + INFO-04 + INFO-06.
//
// `getMarketplaceInfo` orchestrator requires a `pi: ExtensionAPI`
// reference for `notify()` (the info surface does not consume the
// soft-dep probe, but the call shape is shared with the cascade arm);
// the shim factory takes it as a dependency. Argument-parsing failures
// route through `notifyUsageError`. The orchestrator handles the per-
// scope projection, fan-out, and the INFO-04 `{not added}` carve-out.
// This shim only validates the positional/scope shape and delegates.

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
