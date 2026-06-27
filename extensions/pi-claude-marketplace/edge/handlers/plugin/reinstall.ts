// edge/handlers/plugin/reinstall.ts
//
// Thin-shim handler factory for `/claude:plugin reinstall`.
// Target forms mirror update:
//   - bare (no positional)       -> target = { kind: "all" }
//   - `@<marketplace>`           -> target = { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>`   -> target = { kind: "plugin", plugin, marketplace }
//
// RINST-01 / D-67-03: reinstall is a pure repair primitive whose overwrite of
// collisions and foreign content is unconditional. There is no command-local
// `--force` flag; passing `--force` errors as an UNKNOWN flag.

import { reinstallPlugins } from "../../../orchestrators/plugin/reinstall.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";
import { extractLocalFlag } from "../shared.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { ReinstallPluginsTarget } from "../../../orchestrators/plugin/reinstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--local]";

export function makeReinstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. No command-local long flags
    // are passed through (RINST-01 / D-67-03: `--force` is retired), so any
    // unrecognized `--` token is rejected here as an UNKNOWN flag.
    const localFlag = extractLocalFlag(args, ctx, USAGE, []);
    if (localFlag === undefined) {
      return;
    }

    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs(localFlag.residualArgs);
    } catch (err) {
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    const refs: string[] = [];
    for (const token of parsed.positional) {
      if (token.startsWith("--")) {
        notifyUsageError(ctx, { message: `Unknown option: "${token}".`, usage: USAGE });
        return;
      } else {
        refs.push(token);
      }
    }

    if (refs.length > 1) {
      notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    const target = parseTarget(refs[0], ctx);
    if (target === undefined) {
      return;
    }

    await reinstallPlugins({
      ctx,
      pi,
      cwd: ctx.cwd,
      target,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(localFlag.local && { local: true }),
    });
  };
}

function parseTarget(
  ref: string | undefined,
  ctx: ExtensionCommandContext,
): ReinstallPluginsTarget | undefined {
  if (ref === undefined) {
    return { kind: "all" };
  }

  if (ref.startsWith("@") && ref.length > 1) {
    return { kind: "marketplace", marketplace: ref.slice(1) };
  }

  const pluginRef = splitPluginMarketplaceRef(ref);
  if (pluginRef === undefined) {
    notifyUsageError(ctx, {
      message: `Invalid <plugin>@<marketplace> ref: "${ref}".`,
      usage: USAGE,
    });
    return undefined;
  }

  return { kind: "plugin", plugin: pluginRef.plugin, marketplace: pluginRef.marketplace };
}
