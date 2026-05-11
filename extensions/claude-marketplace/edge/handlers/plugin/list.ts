// edge/handlers/plugin/list.ts
//
// Thin-shim handler factory for
// `/claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--scope user|project]`.
//
// Plugin list needs richer flag handling than parseCommandArgs offers: three
// boolean filter flags (--installed / --available / --unavailable) in addition
// to --scope and one optional positional. The shim:
//   1. parses raw args via `parseArgs` to validate --scope and tokenize,
//   2. scans `positional` to extract the three boolean flags, leaving
//      whatever non-flag positionals remain (must be 0 or 1),
//   3. delegates to `listPlugins` with the parsed bag.

import { listPlugins } from "../../../orchestrators/plugin/list.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--scope user|project]";

const BOOLEAN_FLAGS = new Set(["--installed", "--available", "--unavailable"]);

export function makeListHandler(): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyError(ctx, errorMessage(err));
      return;
    }

    let installed = false;
    let available = false;
    let unavailable = false;
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--installed") {
        installed = true;
      } else if (token === "--available") {
        available = true;
      } else if (token === "--unavailable") {
        unavailable = true;
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

    await listPlugins({
      ctx,
      cwd: ctx.cwd,
      ...(nonFlagPositionals[0] !== undefined && { marketplace: nonFlagPositionals[0] }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(installed && { installed: true }),
      ...(available && { available: true }),
      ...(unavailable && { unavailable: true }),
    });
  };
}

// Export for potential reuse by completions provider in Plan 06-03.
export { BOOLEAN_FLAGS };
