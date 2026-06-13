// edge/handlers/plugin/enable-disable.ts
//
// D-54-01 / ENBL-01 / ENBL-02 / ENBL-03 / ENBL-04.
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
import { errorMessage } from "../../../shared/errors.ts";
import { notify } from "../../../shared/notify.ts";
// Shared scanner; see edge/handlers/shared.ts.
import { extractLocalFlag } from "../shared.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
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

    try {
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
    } catch (err) {
      // C1 defense-in-depth: the orchestrator's "never re-throws" contract
      // wraps every loadState + transaction call internally, but a defect or
      // injected throw escaping here must still surface through notify() per
      // IL-2 -- never as a raw process.stderr trace with no user-visible row.
      const scope = parsed.scope ?? "user";
      const cause = err instanceof Error ? err : new Error(errorMessage(err));
      notify(ctx, pi, {
        marketplaces: [
          {
            name: parsed.marketplace,
            scope,
            plugins: [
              {
                status: "failed",
                name: parsed.plugin,
                reasons: ["unreadable"] as const,
                cause,
              },
            ],
          },
        ],
      });
    }
  };
}
