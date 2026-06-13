// edge/handlers/marketplace/add.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace add <source> [--scope user|project]`.
// Delegates to `addMarketplace` orchestrator, threading deps.gitOps through.
//
// Argument-parsing failures route through `notifyUsageError` so the
// rendered surface is `${message}\n\n${USAGE}` (sentence form +
// blank-line + Usage block). Entity-shape errors
// (MarketplaceDuplicateNameError / StaleSourceCloneError / unknown
// source kind) surface from the orchestrator as standard
// `notifyError`-routed messages -- the orchestrator layer keeps that
// emission today; future revisions could promote them to
// `EntityErrorRow` compact lines per CMC-34.

import { addMarketplace } from "../../../orchestrators/marketplace/add.ts";

import { openMarketplaceCommand } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

export function makeAddHandler(
  pi: ExtensionAPI,
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const opened = openMarketplaceCommand(args, ctx, {
      usage: USAGE,
      positionalName: "source",
    });
    if (opened === undefined) {
      return;
    }

    await addMarketplace({
      ctx,
      pi,
      scope: opened.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: opened.source,
      gitOps: deps.gitOps,
      ...(opened.local && { local: true }),
    });
  };
}
