// edge/handlers/plugin/reinstall.ts
//
// Thin-shim handler factory for `/claude:plugin reinstall`.
// Target forms mirror update:
//   - bare (no positional)       -> target = { kind: "all" }
//   - `@<marketplace>`           -> target = { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>`   -> target = { kind: "plugin", plugin, marketplace }
//
// Reinstall additionally accepts a command-specific `--force` flag. It is
// parsed here, not in the shared args schema, so install/update/uninstall
// semantics remain unchanged.

import { reinstallPlugins } from "../../../orchestrators/plugin/reinstall.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";
import { extractLocalFlag } from "../shared.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { ReinstallPluginsTarget } from "../../../orchestrators/plugin/reinstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force] [--local]";

export function makeReinstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // Shared scanner; see edge/handlers/shared.ts. `--force` is
    // downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, ctx, USAGE, ["--force"]);
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

    let force = false;
    const refs: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--force") {
        force = true;
      } else if (token.startsWith("--")) {
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
      ...(force && { force: true }),
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
