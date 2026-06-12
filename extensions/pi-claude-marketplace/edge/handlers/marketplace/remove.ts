// edge/handlers/marketplace/remove.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace <remove|rm> <name> [--scope user|project]`.
// (Also reached via the `rm` alias -- routed through this same handler by
// `routeMarketplace` in edge/router.ts.)
//
// `removeMarketplace` orchestrator requires a `pi: ExtensionAPI` reference
// for the RH-5 soft-dep probes; the shim factory takes it as a dependency.
//
// Argument-parsing failures route through `notifyUsageError`. The
// CMC-31 / CMC-15 conditional remove form is emitted by the
// orchestrator -- this shim only delegates after validating the
// positional/scope shape.

import { removeMarketplace } from "../../../orchestrators/marketplace/remove.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { extractLocalFlag } from "../shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]";

export function makeRemoveHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // WB-01: extract `--local` BEFORE positional parsing.
    const localFlag = extractLocalFlag(args, ctx, USAGE);
    if (localFlag === undefined) {
      return;
    }

    const parsed = parseCommandArgs(
      localFlag.residualArgs,
      {
        positional: [{ name: "name" }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyUsageError(ctx, {
          message: message === USAGE ? "Missing required argument." : message,
          usage: USAGE,
        });
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
      ...(localFlag.local && { local: true }),
    });
  };
}
