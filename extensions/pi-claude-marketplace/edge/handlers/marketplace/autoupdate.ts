// edge/handlers/marketplace/autoupdate.ts
//
// Dual-form thin-shim handler factory for
// `/claude:plugin marketplace autoupdate [<name>] [--scope user|project]`
// and
// `/claude:plugin marketplace noautoupdate [<name>] [--scope user|project]`.
//
// Phase 4 D-01 ships a SINGLE `setMarketplaceAutoupdate` orchestrator
// parameterized by `enable: boolean`. The edge layer maps the two slash
// subcommands onto this single factory via `makeAutoupdateHandler(true)` and
// `makeAutoupdateHandler(false)`.

import { setMarketplaceAutoupdate } from "../../../orchestrators/marketplace/autoupdate.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project]"
    : "Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project]";
}

export function makeAutoupdateHandler(
  pi: ExtensionAPI,
  enable: boolean,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const usage = usageFor(enable);
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name", required: false }] as const,
        usage,
      },
      (message) => {
        notifyUsageError(ctx, { message, usage });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await setMarketplaceAutoupdate({
      ctx,
      pi,
      cwd: ctx.cwd,
      enable,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
