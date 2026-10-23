// edge/handlers/plugin/info.ts
//
// Thin-shim handler factory for
// `/claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]`.
// Argument-parsing failures route through `notifyUsageError`; the
// orchestrator handles per-scope projection, fan-out, the `{marketplace not added}`
// carve-out, and the `{not in manifest}` carve-out. This shim validates
// the positional/scope shape and delegates.

import { getPluginInfo } from "../../../orchestrators/plugin/operations.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { parseFlagNames } from "../../flag-catalog.ts";

import { parsePluginRef, withParsedArgs } from "./shared.ts";

import type { McpStatusReader } from "../../../platform/mcp-status.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]";

// The accepted long flags derive from the catalog's info parse-set (FTCH-03).
const ACCEPTED_FLAGS = parseFlagNames("info");

/**
 * Factory: returns the async handler, which forwards the router's command run
 * to `getPluginInfo` (D-05) with the extension load's MCP status tracker
 * (ASTAT-01), whose last snapshot info stamps on each written MCP server.
 * `register.ts` wires this into the `SubcommandHandlers` map under the
 * `pluginInfo` key.
 */
export function makePluginInfoHandler(mcpStatus: McpStatusReader): SubcommandHandler {
  return withParsedArgs(parseArgs, USAGE, async (parsed, ctx, run): Promise<void> => {
    // FTCH-03: `info` accepts the single boolean `--fetch` flag (the catalog-owned
    // accepted set); every other long flag is rejected inline.
    let fetch = false;
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (ACCEPTED_FLAGS.has(token)) {
        fetch = true;
        continue;
      }

      if (token.startsWith("--")) {
        notifyUsageError(ctx, run, { message: `Unknown flag: "${token}".`, usage: USAGE });
        return;
      }

      nonFlagPositionals.push(token);
    }

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    const positional = nonFlagPositionals[0];
    if (positional === undefined) {
      notifyUsageError(ctx, run, {
        message: "info requires exactly one <plugin>@<marketplace> argument.",
        usage: USAGE,
      });
      return;
    }

    const ref = parsePluginRef(positional, ctx, run, USAGE);
    if (ref === undefined) {
      return;
    }

    await getPluginInfo({
      ctx,
      run,
      mcpStatus,
      marketplace: ref.marketplace,
      plugin: ref.plugin,
      cwd: ctx.cwd,
      ...(fetch && { fetch: true }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  });
}
