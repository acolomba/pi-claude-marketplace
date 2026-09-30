// edge/handlers/marketplace/remove.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace <remove|rm> <name> [--scope user|project]`.
// (Also reached via the `rm` alias -- routed through this same handler by
// `routeMarketplace` in edge/router.ts.)
//
// D-05: the orchestrator renders from the router's notification run, which
// the handler forwards.
//
// Argument-parsing failures route through `notifyUsageError`. The
// CMC-31 / CMC-15 conditional remove form is emitted by the
// orchestrator -- this shim only delegates after validating the
// positional/scope shape.

import { removeMarketplace } from "../../../orchestrators/marketplace/remove.ts";

import { openMarketplaceCommand } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE =
  "Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]";

export function makeRemoveHandler(deps: Pick<EdgeDeps, "completionCache">): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const opened = openMarketplaceCommand(args, ctx, {
      usage: USAGE,
      positionalName: "name",
    });
    if (opened === undefined) {
      return;
    }

    await removeMarketplace({
      ctx,
      run,
      name: opened.name,
      completionCache: deps.completionCache,
      cwd: ctx.cwd,
      ...(opened.scope !== undefined && { scope: opened.scope }),
      ...(opened.local && { local: true }),
    });
  };
}
