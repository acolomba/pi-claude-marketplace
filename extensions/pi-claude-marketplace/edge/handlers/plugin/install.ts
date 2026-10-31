// edge/handlers/plugin/install.ts
//
// Thin-shim handler factory for `/claude:plugin install <plugin>@<marketplace>`.
//
// To support the boolean `--map-model` opt-in (AG-7), the shim follows the
// `list` handler's pattern: call `parseArgs` directly, then scan
// `parsed.positional` for the boolean flag(s), then split the remaining
// single non-flag positional via `parsePluginRef`.
//
// Argument-parsing failures
// route through `notifyUsageError` per MSG-NC-2 / MSG-SR-7 (sentence form
// preserved; Usage block appended after a blank line). Entity-shape errors
// (PI-3 / PI-4 / PI-5) are emitted by the orchestrator (installPlugin) as
// `EntityErrorRow` compact lines per CMC-34 / MSG-NC-1 -- the split between
// "argument-parsing failure" (edge layer) and "entity-shape failure"
// (orchestrator layer) is part of the user-contract surface.
//
// IL-2: zero direct ctx.ui.notify calls -- all user-visible messages route
// through shared/notification-dispatch.ts wrappers (notifyUsageError).
// BLOCK C: no imports from persistence/, domain/, bridges/, transaction/,
// platform/. Only orchestrators/, shared/, edge/ (sibling) imports.

import { createInstallOperation } from "../../../orchestrators/plugin/operations.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { passThroughFlagNames } from "../../flag-catalog.ts";
import { extractLocalFlag } from "../shared.ts";

import { parseMapModelArgs, parsePluginRef } from "./shared.ts";

import type { InstallHooksRouting } from "../../../orchestrators/plugin/install-disable-cascade.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]";

// The downstream-consumed pass-through flags (`--map-model` / `--partial`,
// D-65-05) derive from the catalog's install parse-set; `--local` is consumed
// by extractLocalFlag itself.
const PASS_THROUGH_FLAGS = passThroughFlagNames("install");

/**
 * Factory: returns the async handler. The install renders from the router's
 * run (D-05). `register.ts` wires this factory into the `SubcommandHandlers`
 * map.
 */
export function makeInstallHandler(
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): SubcommandHandler {
  const installPlugin = createInstallOperation(hooksRouting, completionCache);
  // fallow-ignore-next-line code-duplication -- reviewed: install and update share the same --local and --map-model argument prologue on purpose, so each handler reads top to bottom
  return async (args, ctx, run): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. The catalog-derived
    // pass-through flags are downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, { ctx, run, usage: USAGE }, PASS_THROUGH_FLAGS);
    if (localFlag === undefined) {
      return;
    }

    const flagged = parseMapModelArgs(localFlag.residualArgs, ctx, run, USAGE);
    if (flagged === undefined) {
      return;
    }

    const { nonFlagPositionals, mapModel, partial } = flagged;

    if (nonFlagPositionals.length > 1) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    const positional = nonFlagPositionals[0];
    if (positional === undefined) {
      notifyUsageError(ctx, run, {
        message: "install requires exactly one <plugin>@<marketplace> argument.",
        usage: USAGE,
      });
      return;
    }

    const ref = parsePluginRef(positional, ctx, run, USAGE);
    if (ref === undefined) {
      return;
    }

    await installPlugin({
      ctx,
      run,
      scope: flagged.scope ?? "user",
      cwd: ctx.cwd,
      marketplace: ref.marketplace,
      plugin: ref.plugin,
      // DFEN-04 / D-102-03: the standalone user path honors the plugin's
      // declared `defaultEnabled`. Unconditional -- there is no flag to parse,
      // and `import` reaches `installPlugin` through its own cascade, which
      // leaves this off.
      applyDefaultEnabled: true,
      ...(mapModel && { mapModel: true }),
      ...(partial && { partial: true }),
      ...(localFlag.local && { local: true }),
    });
  };
}
