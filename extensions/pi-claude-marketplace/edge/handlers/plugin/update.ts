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

import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { passThroughFlagNames } from "../../flag-catalog.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseMapModelArgs, parsePluginTarget } from "./shared.ts";

import type { UpdatePluginsFn } from "../../../orchestrators/plugin/update-flow.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model] [--partial] [--local]";

// The downstream-consumed pass-through flags (`--map-model` / `--partial`)
// derive from the catalog's update parse-set; `--local` is consumed by
// extractLocalFlag itself.
const PASS_THROUGH_FLAGS = passThroughFlagNames("update");

export function makeUpdateHandler(updatePlugins: UpdatePluginsFn): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. The catalog-derived
    // pass-through flags are downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, { ctx, run, usage: USAGE }, PASS_THROUGH_FLAGS);
    if (localFlag === undefined) {
      return;
    }

    const flagged = parseMapModelArgs(localFlag.residualArgs, ctx, run, USAGE);
    if (flagged === undefined) {
      return;
    }

    const { nonFlagPositionals, mapModel, partial } = flagged;

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    const target = parsePluginTarget(nonFlagPositionals[0], ctx, run, USAGE);
    if (target === undefined) {
      return;
    }

    await updatePlugins({
      ctx,
      run,
      cwd: ctx.cwd,
      target,
      ...(flagged.scope !== undefined && { scope: flagged.scope }),
      ...(mapModel && { mapModel: true }),
      // FORCE-02 (D-65-05): thread `--partial` so a partially-available candidate
      // degrades instead of blocking.
      ...(partial && { partial: true }),
      ...(localFlag.local && { local: true }),
    });
  };
}
