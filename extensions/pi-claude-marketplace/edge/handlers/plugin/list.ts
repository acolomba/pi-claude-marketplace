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
//      whatever non-flag positionals remain (must be 0 or 1, and not empty
//      or blank),
//   3. delegates to `listPlugins` with the parsed bag.

import { listPlugins } from "../../../orchestrators/plugin/list-flow.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { parseFlagNames } from "../../flag-catalog.ts";

import { withParsedArgs } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user|project]";

// The boolean FILTER flags scanned in the positional loop derive from the
// catalog's list parse-set (RSTA-07: `--remote` joins the PL-1 filter family).
// `--scope` is consumed by parseArgs and `--local` is not a list flag, so
// neither appears in the catalog's list entry.
const BOOLEAN_FLAGS = parseFlagNames("list");

/**
 * Factory: returns the async handler, which forwards the router's command run
 * to `listPlugins` (D-05). The run's soft-dependency snapshot feeds the per-row
 * markers of CMC-13 / MSG-SD-1..3.
 */
export function makeListHandler(): SubcommandHandler {
  return withParsedArgs(parseArgs, USAGE, async (parsed, ctx, run): Promise<void> => {
    // Data-driven scan: a token in BOOLEAN_FLAGS is a recognized filter flag;
    // any other `--` token is an unknown long flag; everything else is a
    // positional. Driving the recognized set from BOOLEAN_FLAGS keeps each new
    // filter (e.g. LIST-01's `--partial`) a one-line set + spread change
    // instead of another parse-loop branch.
    const filterFlags = new Set<string>();
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (BOOLEAN_FLAGS.has(token)) {
        filterFlags.add(token);
      } else if (token.startsWith("--")) {
        // Unknown long flag -- surface USAGE.
        notifyUsageError(ctx, run, { message: `Unknown flag: "${token}".`, usage: USAGE });
        return;
      } else {
        nonFlagPositionals.push(token);
      }
    }

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    if (nonFlagPositionals[0]?.trim() === "") {
      notifyUsageError(ctx, run, {
        message: "Marketplace name must not be empty.",
        usage: USAGE,
      });
      return;
    }

    await listPlugins({
      ctx,
      run,
      cwd: ctx.cwd,
      ...(nonFlagPositionals[0] !== undefined && { marketplace: nonFlagPositionals[0] }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(filterFlags.has("--installed") && { installed: true }),
      ...(filterFlags.has("--available") && { available: true }),
      ...(filterFlags.has("--unavailable") && { unavailable: true }),
      ...(filterFlags.has("--partial") && { partial: true }),
      ...(filterFlags.has("--remote") && { remote: true }),
    });
  });
}
