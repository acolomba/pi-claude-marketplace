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

import { fetchPlugins } from "../../../orchestrators/plugin/fetch.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { FetchTarget } from "../../../orchestrators/plugin/fetch.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { Scope } from "../../../shared/types.ts";

const USAGE =
  "Usage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]";

export interface ParsedFetchTarget {
  readonly target: FetchTarget;
  readonly scope?: Scope;
}

/**
 * Parse the fetch positional shapes into a `FetchTarget` (D-81-01). Returns the
 * target + optional scope on success, or `undefined` after emitting a USAGE
 * error (MSG-NC-2: sentence form with the Usage block appended). Only `--scope`
 * is accepted; any other `--flag` is rejected inline.
 */
export function parseFetchTarget(
  args: string,
  ctx: ExtensionCommandContext,
): ParsedFetchTarget | undefined {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (err) {
    // MSG-NC-2: argument-parsing failure (invalid --scope value) -- sentence
    // form with Usage block appended after a blank line.
    notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
    return undefined;
  }

  const nonFlagPositionals: string[] = [];
  for (const token of parsed.positional) {
    if (token.startsWith("--")) {
      notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage: USAGE });
      return undefined;
    }

    nonFlagPositionals.push(token);
  }

  if (nonFlagPositionals.length > 1) {
    notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
    return undefined;
  }

  const target = toFetchTarget(nonFlagPositionals[0], ctx);
  if (target === undefined) {
    return undefined;
  }

  return parsed.scope === undefined ? { target } : { target, scope: parsed.scope };
}

/**
 * Map a single positional token (or its absence) to a `FetchTarget`. A bare
 * `@<marketplace>` yields the marketplace form; a `<plugin>@<marketplace>` ref
 * yields the plugin form; no positional yields the all form. A malformed ref
 * emits a USAGE error and returns `undefined`.
 */
function toFetchTarget(
  ref: string | undefined,
  ctx: ExtensionCommandContext,
): FetchTarget | undefined {
  if (ref === undefined) {
    return { kind: "all" };
  }

  if (ref.startsWith("@") && ref.length > 1) {
    return { kind: "marketplace", marketplace: ref.slice(1) };
  }

  const split = splitPluginMarketplaceRef(ref);
  if (split === undefined) {
    notifyUsageError(ctx, {
      message: `Invalid <plugin>@<marketplace> ref: "${ref}".`,
      usage: USAGE,
    });
    return undefined;
  }

  return { kind: "plugin", ...split };
}

/**
 * Factory: returns the async handler closed over `pi` (required by `notify()`
 * for the soft-dep probe). `register.ts` wires this into `SubcommandHandlers`
 * under the `fetch` key.
 */
export function makeFetchHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseFetchTarget(args, ctx);
    if (parsed === undefined) {
      return;
    }

    await fetchPlugins({
      ctx,
      pi,
      cwd: ctx.cwd,
      target: parsed.target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
