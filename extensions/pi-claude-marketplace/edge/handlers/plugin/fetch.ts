// edge/handlers/plugin/fetch.ts
//
// Thin-shim handler factory for
// `/claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]`.
//
// FTCH-01: `fetch` warms a git-source plugin's clone/mirror cache WITHOUT
// installing. D-81-01 -- three positional forms map to the `FetchTarget` union:
//   - bare (no positional)     -> { kind: "all" }
//   - `@<marketplace>`         -> { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>` -> { kind: "plugin", plugin, marketplace }
//
// Only `--scope` is sanctioned; every other long flag routes to the USAGE
// error path (T-81-10: the closed shape set is the injection surface guard).
// The orchestrator (`fetchPlugins`) owns enumeration, the no-op gate, auth,
// and the failure-tolerant sweep -- this shim validates argv shape and
// delegates.

import { fetchPlugins } from "../../../orchestrators/plugin/operations.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";

import { parsePluginTarget } from "./shared.ts";

import type { FetchTarget } from "../../../orchestrators/plugin/fetch.ts";
import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { NotificationRun } from "../../../shared/notification-run.ts";
import type { Scope } from "../../../shared/types.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]";

interface ParsedFetchTarget {
  readonly target: FetchTarget;
  readonly scope?: Scope;
}

/**
 * Parse the fetch positional shapes into a `FetchTarget` (D-81-01). Returns the
 * target + optional scope on success, or `undefined` after emitting a USAGE
 * error (MSG-NC-2: sentence form with the Usage block appended). Only `--scope`
 * is accepted; any other `--flag` is rejected inline.
 */
function parseFetchTarget(
  args: string,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
): ParsedFetchTarget | undefined {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (err) {
    // MSG-NC-2: argument-parsing failure (invalid --scope value) -- sentence
    // form with Usage block appended after a blank line.
    notifyUsageError(ctx, run, { message: errorMessage(err), usage: USAGE });
    return undefined;
  }

  const nonFlagPositionals: string[] = [];
  for (const token of parsed.positional) {
    if (token.startsWith("--")) {
      notifyUsageError(ctx, run, { message: `Unknown flag: "${token}".`, usage: USAGE });
      return undefined;
    }

    nonFlagPositionals.push(token);
  }

  if (nonFlagPositionals.length > 1) {
    notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
    return undefined;
  }

  const target = parsePluginTarget(nonFlagPositionals[0], ctx, run, USAGE);
  if (target === undefined) {
    return undefined;
  }

  return parsed.scope === undefined ? { target } : { target, scope: parsed.scope };
}

/**
 * Factory: returns the async handler, which forwards the router's command run
 * to `fetchPlugins` (D-05). `register.ts` wires this into `SubcommandHandlers`
 * under the `fetch` key.
 */
export function makeFetchHandler(): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const parsed = parseFetchTarget(args, ctx, run);
    if (parsed === undefined) {
      return;
    }

    await fetchPlugins({
      ctx,
      run,
      cwd: ctx.cwd,
      target: parsed.target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
