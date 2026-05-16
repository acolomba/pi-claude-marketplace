// edge/handlers/plugin/update.ts
//
// Thin-shim handler factory for
// `/claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model]`.
//
// Three positional forms:
//   - bare (no positional) -> target = { kind: "all" }
//   - `@<marketplace>`     -> target = { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>` -> target = { kind: "plugin", plugin, marketplace }
//
// Plan 260516-08j: the boolean `--map-model` opt-in (AG-7) requires the
// raw `parseArgs` + manual positional scan pattern from `list.ts`. The
// previous `parseCommandArgs` wrapper only understood `--scope`.

import { updatePlugins } from "../../../orchestrators/plugin/update.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { UpdatePluginsTarget } from "../../../orchestrators/plugin/update.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model]";

export function makeUpdateHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyError(ctx, errorMessage(err));
      return;
    }

    let mapModel = false;
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--map-model") {
        mapModel = true;
      } else if (token.startsWith("--")) {
        // Unknown long flag -- surface USAGE.
        notifyError(ctx, USAGE);
        return;
      } else {
        nonFlagPositionals.push(token);
      }
    }

    if (nonFlagPositionals.length > 1) {
      notifyError(ctx, USAGE);
      return;
    }

    let target: UpdatePluginsTarget;
    const ref = nonFlagPositionals[0];
    if (ref === undefined) {
      target = { kind: "all" };
    } else if (ref.startsWith("@") && ref.length > 1) {
      target = { kind: "marketplace", marketplace: ref.slice(1) };
    } else {
      const split = splitPluginMarketplaceRef(ref);
      if (split === undefined) {
        notifyError(ctx, USAGE);
        return;
      }

      target = {
        kind: "plugin",
        ...split,
      };
    }

    await updatePlugins({
      ctx,
      pi,
      cwd: ctx.cwd,
      target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(mapModel && { mapModel: true }),
    });
  };
}
