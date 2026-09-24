// `/claude:plugin prune` accepts one scope and no plugin target.

import { createPruneOperation } from "../../../orchestrators/plugin/operations.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { DRY_RUN_FLAG, passThroughFlagNames, SCOPE_TARGET_FLAG } from "../../flag-catalog.ts";
import { extractLocalFlag } from "../shared.ts";

import { withParsedArgs } from "./shared.ts";

import type { UninstallHooksRouting } from "../../../orchestrators/plugin/uninstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";

const USAGE = "Usage: /claude:plugin prune [--scope user|project] [--dry-run]";
const CONSUMED_FLAGS = { consumeLongFlags: passThroughFlagNames("prune") };

/** Registers the no-target command against the standalone prune operation. */
export function makePruneHandler(
  pi: ExtensionAPI,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const prune = createPruneOperation(hooksRouting, completionCache);
  return async (args, ctx): Promise<void> => {
    const scanned = extractLocalFlag(args, ctx, USAGE, CONSUMED_FLAGS);
    if (scanned === undefined) {
      return;
    }

    if (scanned.local) {
      notifyUsageError(ctx, {
        message: `Unknown flag: "${SCOPE_TARGET_FLAG}".`,
        usage: USAGE,
      });
      return;
    }

    await withParsedArgs(parseArgs, USAGE, async (parsed, parsedCtx): Promise<void> => {
      if (parsed.positional.length > 0) {
        notifyUsageError(parsedCtx, { message: "Too many arguments.", usage: USAGE });
        return;
      }

      await prune({
        ctx: parsedCtx,
        pi,
        cwd: parsedCtx.cwd,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
        ...(scanned.consumedFlags.has(DRY_RUN_FLAG) && { dryRun: true }),
      });
    })(scanned.residualArgs, ctx);
  };
}
