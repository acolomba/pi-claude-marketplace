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
// BLOCK A: zero direct ctx.ui.notify calls -- all user-visible messages route
// through shared/notify.ts wrappers (notifyError).
// BLOCK C: no imports from persistence/, domain/, bridges/, transaction/,
// platform/. Only orchestrators/, shared/, edge/ (sibling) imports.

import { installPlugin } from "../../../orchestrators/plugin/install.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

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

    const positional = nonFlagPositionals[0];
    if (nonFlagPositionals.length !== 1 || positional === undefined) {
      notifyError(ctx, USAGE);
      return;
    }

    const ref = splitPluginMarketplaceRef(positional);
    if (ref === undefined) {
      notifyError(ctx, USAGE);
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
