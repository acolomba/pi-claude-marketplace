// edge/handlers/plugin/install.ts
//
// Thin-shim handler factory for `/claude:plugin install <plugin>@<marketplace>`.
//
// To support the boolean `--map-model` opt-in (AG-7), the shim follows the
// `list` handler's pattern: call `parseArgs` directly, then scan
// `parsed.positional` for the boolean flag(s), then split the remaining
// single non-flag positional via `splitPluginMarketplaceRef`.
//
// Argument-parsing failures
// route through `notifyUsageError` per MSG-NC-2 / MSG-SR-7 (sentence form
// preserved; Usage block appended after a blank line). Entity-shape errors
// (PI-3 / PI-4 / PI-5) are emitted by the orchestrator (installPlugin) as
// `EntityErrorRow` compact lines per CMC-34 / MSG-NC-1 -- the split between
// "argument-parsing failure" (edge layer) and "entity-shape failure"
// (orchestrator layer) is part of the user-contract surface.
//
// BLOCK A: zero direct ctx.ui.notify calls -- all user-visible messages route
// through shared/notify.ts wrappers (notifyUsageError).
// BLOCK C: no imports from persistence/, domain/, bridges/, transaction/,
// platform/. Only orchestrators/, shared/, edge/ (sibling) imports.

import { installPlugin } from "../../../orchestrators/plugin/install.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseMapModelArgs, splitPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--force] [--local]";

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `installPlugin` for soft-dep probes). `register.ts` wires this factory
 * into the `SubcommandHandlers` map.
 */
export function makeInstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. `--map-model` and `--force`
    // (D-65-05) are downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, ctx, USAGE, ["--map-model", "--force"]);
    if (localFlag === undefined) {
      return;
    }

    const flagged = parseMapModelArgs(localFlag.residualArgs, ctx, USAGE);
    if (flagged === undefined) {
      return;
    }

    const { nonFlagPositionals, mapModel, force } = flagged;

    const positional = nonFlagPositionals[0];
    if (nonFlagPositionals.length !== 1 || positional === undefined) {
      notifyUsageError(ctx, {
        message: "install requires exactly one <plugin>@<marketplace> argument.",
        usage: USAGE,
      });
      return;
    }

    const ref = splitPluginMarketplaceRef(positional);
    if (ref === undefined) {
      // PI-1 invalid `<plugin>@<marketplace>` token (no `@`, leading `@`,
      // trailing `@`) -- this is a USAGE ERROR, not an entity-shape error:
      // the ref string never anchored to a real plugin/marketplace pair.
      notifyUsageError(ctx, {
        message: `Invalid <plugin>@<marketplace> ref: "${positional}".`,
        usage: USAGE,
      });
      return;
    }

    await installPlugin({
      ctx,
      pi,
      scope: flagged.scope ?? "user",
      cwd: ctx.cwd,
      marketplace: ref.marketplace,
      plugin: ref.plugin,
      ...(mapModel && { mapModel: true }),
      ...(force && { force: true }),
      ...(localFlag.local && { local: true }),
    });
  };
}
