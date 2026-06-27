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
// The boolean `--map-model` opt-in (AG-7) requires the raw `parseArgs` +
// manual positional scan pattern from `list.ts`.

import { updatePlugins } from "../../../orchestrators/plugin/update.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseMapModelArgs, splitPluginMarketplaceRef } from "./shared.ts";

import type { UpdatePluginsTarget } from "../../../orchestrators/plugin/update.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model] [--force] [--local]";

export function makeUpdateHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. `--map-model` and
    // `--force` are downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, ctx, USAGE, ["--map-model", "--force"]);
    if (localFlag === undefined) {
      return;
    }

    const flagged = parseMapModelArgs(localFlag.residualArgs, ctx, USAGE);
    if (flagged === undefined) {
      return;
    }

    const { nonFlagPositionals, mapModel, force } = flagged;

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
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
        notifyUsageError(ctx, {
          message: `Invalid <plugin>@<marketplace> ref: "${ref}".`,
          usage: USAGE,
        });
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
      ...(flagged.scope !== undefined && { scope: flagged.scope }),
      ...(mapModel && { mapModel: true }),
      // FORCE-02 (D-65-05): thread `--force` so an unsupported candidate
      // degrades instead of blocking.
      ...(force && { force: true }),
      ...(localFlag.local && { local: true }),
    });
  };
}
