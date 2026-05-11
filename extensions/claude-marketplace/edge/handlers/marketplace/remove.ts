// edge/handlers/marketplace/remove.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace remove <name> [--scope user|project]`.
// (Also reached via the `rm` alias -- routed through this same handler by
// `routeMarketplace` in edge/router.ts.)
//
// `removeMarketplace` orchestrator requires a `pi: ExtensionAPI` reference
// for the RH-5 soft-dep probes; the shim factory takes it as a dependency.

import { removeMarketplace } from "../../../orchestrators/marketplace/remove.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin marketplace remove <name> [--scope user|project]";

export function makeRemoveHandler(
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
        notifyError(ctx, message);
      },
    );
    if (parsed === undefined) {
      return;
    }

    await removeMarketplace({
      ctx,
      pi,
      name: parsed.name,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
