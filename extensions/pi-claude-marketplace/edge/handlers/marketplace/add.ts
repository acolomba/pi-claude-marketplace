// edge/handlers/marketplace/add.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace add <source> [--scope user|project]`.
// Delegates to `addMarketplace` orchestrator, threading deps.gitOps through.
//
// D-05: the orchestrator renders from the router's notification run, which
// the handler forwards.
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

import type { SubcommandHandler } from "../../router.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

export function makeAddHandler(
  deps: Pick<EdgeDeps, "completionCache" | "gitOps">,
): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const opened = openMarketplaceCommand(args, ctx, {
      usage: USAGE,
      positionalName: "source",
    });
    if (opened === undefined) {
      return;
    }

    await addMarketplace({
      ctx,
      run,
      scope: opened.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: opened.source,
      completionCache: deps.completionCache,
      gitOps: deps.gitOps,
      ...(opened.local && { local: true }),
    });
  };
}
