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
import { notifyError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import { splitPluginMarketplaceRef } from "./shared.ts";

import type { ReinstallPluginsTarget } from "../../../orchestrators/plugin/reinstall.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force]";

export function makeReinstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyError(ctx, `${errorMessage(err)}\n${USAGE}`);
      return;
    }

    let force = false;
    const refs: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--force") {
        force = true;
      } else if (token.startsWith("--")) {
        notifyError(ctx, `Unknown option: "${token}".\n${USAGE}`);
        return;
      } else {
        refs.push(token);
      }
    }

    if (refs.length > 1) {
      notifyError(ctx, `Too many arguments.\n${USAGE}`);
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
    notifyError(ctx, USAGE);
    return undefined;
  }

  return { kind: "plugin", plugin: pluginRef.plugin, marketplace: pluginRef.marketplace };
}
