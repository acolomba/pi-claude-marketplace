// edge/handlers/marketplace/update.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace update [<name>] [--scope user|project]`.
//
// Two forms via optional positional:
//   - bare    -> updateAllMarketplaces
//   - <name>  -> updateMarketplace
//
// `deps.gitOps` and `deps.pluginUpdate` are injected per D-04 EdgeDeps
// pattern; the orchestrator side accepts them as optional, but Phase 7's
// wiring always supplies both.

import {
  updateAllMarketplaces,
  updateMarketplace,
} from "../../../orchestrators/marketplace/update.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace update [<name>] [--scope user|project]";

export function makeMarketplaceUpdateHandler(
  pi: ExtensionAPI,
  deps: EdgeDeps,
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
          message: message === USAGE ? "Missing required argument." : message,
          usage: USAGE,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    if (parsed.name === undefined) {
      await updateAllMarketplaces({
        ctx,
        pi,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
        pluginUpdate: deps.pluginUpdate,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
      });
      return;
    }

    await updateMarketplace({
      ctx,
      pi,
      name: parsed.name,
      cwd: ctx.cwd,
      gitOps: deps.gitOps,
      pluginUpdate: deps.pluginUpdate,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
