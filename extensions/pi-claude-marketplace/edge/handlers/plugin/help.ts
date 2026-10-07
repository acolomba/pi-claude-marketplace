// edge/handlers/plugin/help.ts
//
// Thin-shim handler factory for `/claude:plugin help [marketplace]`.
// Displays the canonical usage block at info severity without requiring
// an invalid subcommand to read the documentation.

import { notifyUsageError, notifyUsageInfo } from "../../../shared/notification-dispatch.ts";
import { MARKETPLACE_USAGE, TOP_LEVEL_USAGE } from "../../router.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin help [marketplace]";

export function makeHelpHandler(): SubcommandHandler {
  return (args, ctx, run): Promise<void> => {
    const topic = args.trim();
    if (topic === "" || topic === "help") {
      notifyUsageInfo(ctx, run, TOP_LEVEL_USAGE);
      return Promise.resolve();
    }

    if (topic === "marketplace") {
      notifyUsageInfo(ctx, run, MARKETPLACE_USAGE);
      return Promise.resolve();
    }

    notifyUsageError(ctx, run, {
      message: `Unknown help topic: "${topic}".`,
      usage: USAGE,
    });
    return Promise.resolve();
  };
}
