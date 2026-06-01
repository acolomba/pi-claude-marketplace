// edge/handlers/plugin/install.ts
//
// Thin-shim handler factory for `/claude:plugin install <plugin>@<marketplace>`.
//
// Plan 260516-08j: the previous `parseRequiredPluginMarketplaceRef` delegation
// only understands `--scope`. With the introduction of the boolean
// `--map-model` opt-in (AG-7), the shim now follows the `list` handler's
// pattern: call `parseArgs` directly, then scan `parsed.positional` for the
// boolean flag(s), then split the remaining single non-flag positional via
// `splitPluginMarketplaceRef`.
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
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { parsePositionalsWithFlags, splitPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model]";

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `installPlugin` for soft-dep probes). Phase 6 Plan 05 wires this factory
 * into `register.ts` via the `SubcommandHandlers` map.
 */
export function makeInstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      // MSG-NC-2: argument-parsing failure (invalid --scope value) -- sentence
      // form with Usage block appended after a blank line.
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    const flagged = parsePositionalsWithFlags(parsed.positional, ctx, USAGE);
    if (flagged === undefined) {
      return;
    }

    const { nonFlagPositionals, mapModel } = flagged;

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
      // trailing `@`) -- per the plan's task 3 note this is a USAGE ERROR,
      // not an entity-shape error: the ref string never anchored to a real
      // plugin/marketplace pair.
      notifyUsageError(ctx, {
        message: `Invalid <plugin>@<marketplace> ref: "${positional}".`,
        usage: USAGE,
      });
      return;
    }

    await installPlugin({
      ctx,
      pi,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      marketplace: ref.marketplace,
      plugin: ref.plugin,
      ...(mapModel && { mapModel: true }),
    });
  };
}
