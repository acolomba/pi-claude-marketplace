// edge/handlers/plugin/help.ts
//
// Thin-shim handler factory for `/claude:plugin help [marketplace]`.
// Displays the canonical usage block at info severity without requiring
// an invalid subcommand to read the documentation.

import { notifyUsageError, notifyUsageInfo } from "../../../shared/notification-dispatch.ts";
import { MARKETPLACE_USAGE, TOP_LEVEL_USAGE } from "../../router.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin help [marketplace]";

export function makeHelpHandler(): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return (args, ctx): Promise<void> => {
    const topic = args.trim();
    if (topic === "" || topic === "help") {
      notifyUsageInfo(ctx, TOP_LEVEL_USAGE);
      return Promise.resolve();
    }

    if (topic === "marketplace") {
      notifyUsageInfo(ctx, MARKETPLACE_USAGE);
      return Promise.resolve();
    }

    notifyUsageError(ctx, {
      message: `Unknown help topic: "${topic}".`,
      usage: USAGE,
    });
    return Promise.resolve();
  };
}
