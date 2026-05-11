// edge/handlers/marketplace/add.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace add <source> [--scope user|project]`.
// Delegates to `addMarketplace` orchestrator, threading deps.gitOps through.

import { addMarketplace } from "../../../orchestrators/marketplace/add.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project]";

export function makeAddHandler(
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "source" }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyError(ctx, message);
      },
    );
    if (parsed === undefined) {
      return;
    }

    await addMarketplace({
      ctx,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: parsed.source,
      gitOps: deps.gitOps,
    });
  };
}
