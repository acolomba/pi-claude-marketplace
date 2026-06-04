// edge/handlers/plugin/info.ts
//
// Thin-shim handler factory for
// `/claude:plugin info <plugin>@<marketplace> [--scope user|project]`.
//
// Phase 44 / INFO-02 + INFO-03 + INFO-04 + INFO-05 + INFO-06.
//
// `getPluginInfo` orchestrator requires a `pi: ExtensionAPI` reference
// for `notify()` (the info surface does not consume the soft-dep probe,
// but the call shape is shared with the cascade arm); the shim factory
// takes it as a dependency. Argument-parsing failures route through
// `notifyUsageError`. The orchestrator handles the per-scope projection,
// fan-out, and the INFO-04 `{not added}` carve-out (both the bare
// `--scope` mismatch row and the absent-from-both shape) AND the
// `{not in manifest}` carve-out for a missing plugin in a known
// marketplace. This shim only validates the positional/scope shape and
// delegates.

import { getPluginInfo } from "../../../orchestrators/plugin/info.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin info <plugin>@<marketplace> [--scope user|project]";

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `getPluginInfo` for the soft-dep probe at `notify()` time). Phase 44
 * wires this factory into `register.ts` via the `SubcommandHandlers`
 * map under the `pluginInfo` key.
 */
export function makePluginInfoHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      // MSG-NC-2: argument-parsing failure (invalid --scope value,
      // unknown long flag) -- sentence form with Usage block appended
      // after a blank line.
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    // `info` accepts ZERO boolean flags. Reject any unknown long flag
    // inline (no shared `parsePositionalsWithFlags` because no flag is
    // sanctioned for this command surface).
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (token.startsWith("--")) {
        notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage: USAGE });
        return;
      }

      nonFlagPositionals.push(token);
    }

    const positional = nonFlagPositionals[0];
    if (nonFlagPositionals.length !== 1 || positional === undefined) {
      notifyUsageError(ctx, {
        message: "info requires exactly one <plugin>@<marketplace> argument.",
        usage: USAGE,
      });
      return;
    }

    const ref = splitPluginMarketplaceRef(positional);
    if (ref === undefined) {
      notifyUsageError(ctx, {
        message: `Invalid <plugin>@<marketplace> ref: "${positional}".`,
        usage: USAGE,
      });
      return;
    }

    await getPluginInfo({
      ctx,
      pi,
      marketplace: ref.marketplace,
      plugin: ref.plugin,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
