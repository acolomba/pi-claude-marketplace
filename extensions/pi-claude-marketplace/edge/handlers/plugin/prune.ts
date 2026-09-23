// `/claude:plugin prune` accepts one scope and no plugin target.

import { createPruneOperation } from "../../../orchestrators/plugin/operations.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";

import { withParsedArgs } from "./shared.ts";

import type { UninstallHooksRouting } from "../../../orchestrators/plugin/uninstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";

const USAGE = "Usage: /claude:plugin prune [--scope user|project]";

/** Registers the no-target command against the standalone prune operation. */
export function makePruneHandler(
  pi: ExtensionAPI,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const prune = createPruneOperation(hooksRouting, completionCache);
  return withParsedArgs(parseArgs, USAGE, async (parsed, ctx): Promise<void> => {
    const [first] = parsed.positional;
    if (first !== undefined) {
      notifyUsageError(ctx, {
        message: first.startsWith("-") ? `Unknown option: "${first}".` : "Too many arguments.",
        usage: USAGE,
      });
      return;
    }

    await prune({
      ctx,
      pi,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  });
}
