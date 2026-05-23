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

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace update [<name>] [--scope user|project]";

export function makeMarketplaceUpdateHandler(
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
        // Phase 13 Plan 13-02c-01 / MSG-NC-2: argument-parsing failure
        // -> sentence + Usage block via notifyUsageError.
        notifyUsageError(ctx, message === USAGE ? "Missing required argument." : message, USAGE);
      },
    );
    if (parsed === undefined) {
      return;
    }

    if (parsed.name === undefined) {
      await updateAllMarketplaces({
        ctx,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
        pluginUpdate: deps.pluginUpdate,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
      });
      return;
    }

    await updateMarketplace({
      ctx,
      name: parsed.name,
      cwd: ctx.cwd,
      gitOps: deps.gitOps,
      pluginUpdate: deps.pluginUpdate,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
