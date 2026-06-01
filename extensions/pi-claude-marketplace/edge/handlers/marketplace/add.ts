// edge/handlers/marketplace/add.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace add <source> [--scope user|project]`.
// Delegates to `addMarketplace` orchestrator, threading deps.gitOps through.
//
// Argument-parsing failures route through `notifyUsageError` (sentence + Usage block).
// argument-parsing failures route through `notifyUsageError` so the
// rendered surface is `${message}\n\n${USAGE}` (sentence form +
// blank-line + Usage block). Entity-shape errors
// (MarketplaceDuplicateNameError / StaleSourceCloneError / unknown
// source kind) surface from the orchestrator as standard
// `notifyError`-routed messages -- the orchestrator layer keeps that
// emission today; future revisions could promote them to
// `EntityErrorRow` compact lines per CMC-34.

import { addMarketplace } from "../../../orchestrators/marketplace/add.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project]";

export function makeAddHandler(
  pi: ExtensionAPI,
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
        // MSG-NC-2: argument-parsing failure -> sentence form + Usage
        // block (notifyUsageError contract: ${message}\n\n${usageBlock}).
        // Substitute "Missing required argument." when the parser hands
        // back the usage string verbatim (the duplicate-usage case --
        // notifyUsageError would re-emit the Usage block otherwise).
        notifyUsageError(ctx, {
          message: message === USAGE ? "Missing required argument." : message,
          usage: USAGE,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await addMarketplace({
      ctx,
      pi,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: parsed.source,
      gitOps: deps.gitOps,
    });
  };
}
