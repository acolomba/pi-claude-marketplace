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
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { extractLocalFlag } from "../shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]";

export function makeAddHandler(
  pi: ExtensionAPI,
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // WB-01 / Phase 56 Plan 02: extract `--local` BEFORE positional parsing
    // so flag position cannot change the outcome (matches the Phase 54
    // enable-disable handler shape).
    const localFlag = extractLocalFlag(args, ctx, USAGE);
    if (localFlag === undefined) {
      return;
    }

    const parsed = parseCommandArgs(
      localFlag.residualArgs,
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
      ...(localFlag.local && { local: true }),
    });
  };
}
