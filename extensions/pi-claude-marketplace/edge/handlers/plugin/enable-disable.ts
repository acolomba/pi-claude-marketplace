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
// `enable: boolean` returns the per-subcommand handler. Scans the argv for
// `--local` first, then parses the residue for `<plugin>@<marketplace>` +
// `--scope` via `parseRequiredPluginMarketplaceRef`. Rejects unknown long
// flags via `notifyUsageError`.

import { createEnableOperation } from "../../../orchestrators/plugin/operations.ts";
import { errorMessage, rethrowInvalidGitHubBaseUrl } from "../../../shared/errors.ts";
import { notify } from "../../../shared/notification-dispatch.ts";
// Shared scanner; see edge/handlers/shared.ts.
import { extractLocalFlag } from "../shared.ts";

import { parseRequiredPluginMarketplaceRef } from "./shared.ts";

import type { EnableDisableHooksRouting } from "../../../orchestrators/plugin/enable-disable.ts";
import type { SubcommandHandler } from "../../router.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
}

export function makeEnableDisableHandler(
  enable: boolean,
  hooksRouting: EnableDisableHooksRouting,
): SubcommandHandler {
  const usage = usageFor(enable);
  const setPluginEnabled = createEnableOperation(hooksRouting);
  return async (args, ctx, run): Promise<void> => {
    const localFlag = extractLocalFlag(args, { ctx, run, usage });
    if (localFlag === undefined) {
      return;
    }

    // WR-02: parse the RESIDUE (with `--local` removed) so the flag is
    // position-independent like `--scope`.
    const parsed = parseRequiredPluginMarketplaceRef(localFlag.residualArgs, ctx, run, usage);
    if (parsed === undefined) {
      return;
    }

    try {
      await setPluginEnabled({
        ctx,
        run,
        cwd: ctx.cwd,
        marketplace: parsed.marketplace,
        plugin: parsed.plugin,
        enable,
        ...(parsed.scope !== undefined && { scope: parsed.scope }),
        ...(localFlag.local && { local: true }),
      });
    } catch (err) {
      rethrowInvalidGitHubBaseUrl(err);
      // C1 defense-in-depth: the orchestrator's "never re-throws" contract
      // wraps every loadState + transaction call internally, but a defect or
      // injected throw escaping here must still surface through notify() per
      // IL-2 -- never as a raw process.stderr trace with no user-visible row.
      // GHB-03: an invalid GitHub base override is the one exception. The
      // operation rethrows it, and so does this catch, so it fails the command
      // instead of becoming an `{unreadable}` row.
      const scope = parsed.scope ?? "user";
      const cause = err instanceof Error ? err : new Error(errorMessage(err));
      notify(ctx, run, {
        marketplaces: [
          {
            name: parsed.marketplace,
            scope,
            plugins: [
              {
                status: "failed",
                severity: "error",
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
