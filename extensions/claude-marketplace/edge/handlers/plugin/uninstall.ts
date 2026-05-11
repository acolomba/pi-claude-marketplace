// edge/handlers/plugin/uninstall.ts
//
// Thin-shim handler factory for
// `/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]`.
// Identical Pattern 1 shape as install.ts; delegates to `uninstallPlugin`.

import { uninstallPlugin } from "../../../orchestrators/plugin/uninstall.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

const USAGE = "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]";

export function makeUninstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "ref" }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyError(ctx, message);
      },
    );
    if (parsed === undefined) {
      return;
    }

    const atIdx = parsed.ref.indexOf("@");
    if (atIdx <= 0 || atIdx === parsed.ref.length - 1) {
      notifyError(ctx, USAGE);
      return;
    }

    const plugin = parsed.ref.slice(0, atIdx);
    const marketplace = parsed.ref.slice(atIdx + 1);

    await uninstallPlugin({
      ctx,
      pi,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      marketplace,
      plugin,
    });
  };
}
