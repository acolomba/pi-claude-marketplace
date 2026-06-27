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
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--unsupported] [--scope user|project]";

const BOOLEAN_FLAGS = new Set(["--installed", "--available", "--unavailable", "--unsupported"]);

/**
 * Factory: returns the async handler closed over `pi` (required by
 * `listPlugins` for per-row soft-dep marker probes per CMC-13 / MSG-SD-1..3 --
 * the orchestrator constructs a `SoftDepProbe` via `softDepStatus(pi)` and
 * forwards it to the renderer).
 */
export function makeListHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    // Data-driven scan: a token in BOOLEAN_FLAGS is a recognized filter flag;
    // any other `--` token is an unknown long flag; everything else is a
    // positional. Driving the recognized set from BOOLEAN_FLAGS keeps each new
    // filter (e.g. LIST-01's `--unsupported`) a one-line set + spread change
    // instead of another parse-loop branch.
    const filterFlags = new Set<string>();
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (BOOLEAN_FLAGS.has(token)) {
        filterFlags.add(token);
      } else if (token.startsWith("--")) {
        // Unknown long flag -- surface USAGE.
        notifyUsageError(ctx, { message: `Unknown option: "${token}".`, usage: USAGE });
        return;
      } else {
        nonFlagPositionals.push(token);
      }
    }

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    await listPlugins({
      ctx,
      pi,
      cwd: ctx.cwd,
      ...(nonFlagPositionals[0] !== undefined && { marketplace: nonFlagPositionals[0] }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(filterFlags.has("--installed") && { installed: true }),
      ...(filterFlags.has("--available") && { available: true }),
      ...(filterFlags.has("--unavailable") && { unavailable: true }),
      ...(filterFlags.has("--unsupported") && { unsupported: true }),
    });
  };
}

// Export for potential reuse by completions provider.
export { BOOLEAN_FLAGS };
