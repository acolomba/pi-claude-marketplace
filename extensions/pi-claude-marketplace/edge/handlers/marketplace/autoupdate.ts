// edge/handlers/marketplace/autoupdate.ts
//
// Dual-form thin-shim handler factory for
// `/claude:plugin marketplace autoupdate [<name>] [--scope user|project]`
// and
// `/claude:plugin marketplace noautoupdate [<name>] [--scope user|project]`.
//
// D-01 ships a SINGLE `setMarketplaceAutoupdate` orchestrator
// parameterized by `enable: boolean`. The edge layer maps the two slash
// subcommands onto this single factory via `makeAutoupdateHandler(true)` and
// `makeAutoupdateHandler(false)`.
//
// D-05: the orchestrator renders from the router's notification run, which
// the handler forwards.

import { setMarketplaceAutoupdate } from "../../../orchestrators/marketplace/autoupdate.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { extractLocalFlag } from "../shared.ts";

import type { SubcommandHandler } from "../../router.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]"
    : "Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]";
}

export function makeAutoupdateHandler(enable: boolean): SubcommandHandler {
  const usage = usageFor(enable);
  // fallow-ignore-next-line code-duplication -- reviewed: autoupdate and enable/disable share the same --local argument prologue on purpose, so each handler reads top to bottom
  return async (args, ctx, run): Promise<void> => {
    const localFlag = extractLocalFlag(args, { ctx, run, usage });
    if (localFlag === undefined) {
      return;
    }

    const parsed = parseCommandArgs(
      localFlag.residualArgs,
      {
        positional: [{ name: "name", required: false }] as const,
        usage,
      },
      (message) => {
        notifyUsageError(ctx, run, { message, usage });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await setMarketplaceAutoupdate({
      ctx,
      run,
      cwd: ctx.cwd,
      enable,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(localFlag.local && { local: true }),
    });
  };
}
