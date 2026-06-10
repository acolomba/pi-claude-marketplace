// edge/handlers/plugin/enable-disable.ts
//
// D-54-01 / ENBL-01 / ENBL-02 / ENBL-03 / ENBL-04 (Phase 54 Plan 02).
//
// Dual-form thin-shim handler factory for
// `/claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]`
// and
// `/claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]`.
//
// Mirrors the `makeAutoupdateHandler` shape: a single factory parameterized by
// `enable: boolean` returns the per-subcommand handler. Parses
// `<plugin>@<marketplace>` + `--scope` via `parseRequiredPluginMarketplaceRef`,
// then scans the residual argv for `--local`. Rejects unknown long flags via
// `notifyUsageError`.

import { setPluginEnabled } from "../../../orchestrators/plugin/enable-disable.ts";
import { notifyUsageError } from "../../../shared/notify.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
}

/**
 * Scan the raw args string for a bare `--local` flag and reject any unknown
 * long flag (anything matching `/^--[a-z]/` that is not `--scope` or
 * `--local`). `--scope` is consumed downstream by
 * `parseRequiredPluginMarketplaceRef`; we walk the same token list here to
 * surface `--local` without re-implementing the full args parser.
 *
 * WR-02 (Phase 54 review): the `--local` token is REMOVED from the returned
 * `residualArgs` so flag position cannot change the outcome --
 * `parseRequiredPluginMarketplaceRef`'s tokenizer treats every non-`--scope`
 * token as a positional, so leaving `--local` in place made
 * `enable --local foo@mp` fail with a misleading
 * `Invalid <plugin>@<marketplace> ref: "--local".` while
 * `enable foo@mp --local` worked (the trailing extra positional was
 * silently dropped). This mirrors how `--scope` is consumed by the parser
 * itself.
 *
 * Returns `undefined` when an unknown flag was found (the caller-supplied
 * `notifyUsage` has already fired and the handler should early-return).
 */
function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
): { local: boolean; residualArgs: string } | undefined {
  let local = false;
  const tokens = args.split(/\s+/).filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === undefined) {
      break;
    }

    if (tok === "--scope") {
      // Consume the value (handled by parseRequiredPluginMarketplaceRef).
      i += 2;
      continue;
    }

    if (tok === "--local") {
      local = true;
      i += 1;
      continue;
    }

    if (tok.startsWith("--")) {
      notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
      return undefined;
    }

    i += 1;
  }

  return { local, residualArgs: tokens.filter((t) => t !== "--local").join(" ") };
}

export function makeEnableDisableHandler(
  pi: ExtensionAPI,
  enable: boolean,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const usage = usageFor(enable);
  return async (args, ctx): Promise<void> => {
    const localFlag = extractLocalFlag(args, ctx, usage);
    if (localFlag === undefined) {
      return;
    }

    // WR-02: parse the RESIDUE (with `--local` removed) so the flag is
    // position-independent like `--scope`.
    const parsed = parseRequiredPluginMarketplaceRef(localFlag.residualArgs, ctx, usage);
    if (parsed === undefined) {
      return;
    }

    await setPluginEnabled({
      ctx,
      pi,
      cwd: ctx.cwd,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
      enable,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(localFlag.local && { local: true }),
    });
  };
}
