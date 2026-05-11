// edge/handlers/plugin/update.ts
//
// Thin-shim handler factory for `/claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]`.
// Three positional forms:
//   - bare (no positional) -> target = { kind: "all" }
//   - `@<marketplace>`     -> target = { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>` -> target = { kind: "plugin", plugin, marketplace }

import { updatePlugins } from "../../../orchestrators/plugin/update.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { UpdatePluginsTarget } from "../../../orchestrators/plugin/update.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]";

export function makeUpdateHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "ref", required: false }] as const,
        usage: USAGE,
      },
      (message) => {
        notifyError(ctx, message);
      },
    );
    if (parsed === undefined) {
      return;
    }

    let target: UpdatePluginsTarget;
    if (parsed.ref === undefined) {
      target = { kind: "all" };
    } else if (parsed.ref.startsWith("@") && parsed.ref.length > 1) {
      target = { kind: "marketplace", marketplace: parsed.ref.slice(1) };
    } else {
      const atIdx = parsed.ref.indexOf("@");
      if (atIdx <= 0 || atIdx === parsed.ref.length - 1) {
        notifyError(ctx, USAGE);
        return;
      }

      target = {
        kind: "plugin",
        plugin: parsed.ref.slice(0, atIdx),
        marketplace: parsed.ref.slice(atIdx + 1),
      };
    }

    await updatePlugins({
      ctx,
      pi,
      cwd: ctx.cwd,
      target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
