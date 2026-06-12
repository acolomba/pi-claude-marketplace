// edge/handlers/marketplace/shared.ts
//
// Shared factory for the single-`<name>`-positional marketplace edge handlers
// (`info` / `remove`). Both shims parse one required `name` positional + the
// optional `--scope` flag, route an argument-parsing failure through
// `notifyUsageError` (MSG-NC-2: the missing-required-positional path collapses
// the duplicated usage block into "Missing required argument."), then delegate
// to their orchestrator with `{ ctx, pi, name, cwd, scope? }`.
//
// Argument-parsing failures route through `notifyUsageError`; the orchestrator
// owns per-scope projection / fan-out / the conditional `{not added}` forms.

import { notifyUsageError } from "../../../shared/notify.ts";
import { parseCommandArgs } from "../../args-schema.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { Scope } from "../../../shared/types.ts";

/**
 * Delegate shape shared by `getMarketplaceInfo` and `removeMarketplace`.
 * `GetMarketplaceInfoOptions` matches this exactly; `RemoveMarketplaceOptions`
 * adds an OPTIONAL `cascade?` field, which a caller omitting `cascade`
 * structurally satisfies.
 */
type SingleNameMarketplaceRun = (opts: {
  ctx: ExtensionCommandContext;
  pi: ExtensionAPI;
  name: string;
  cwd: string;
  scope?: Scope;
  // RECON-03: orchestrators may now return a typed outcome
  // in orchestrated mode. The edge handler omits `notifications`, so the
  // standalone-mode void return is exercised; `void | unknown` keeps the type
  // unconstrained for any future orchestrators added to this shim.
}) => Promise<unknown>;

/**
 * Build a thin-shim handler for a `<name>`-only marketplace subcommand. The
 * returned handler performs the single-`name`-positional `parseCommandArgs`
 * parse + the `message === usage ? "Missing required argument." : message`
 * error callback + the `=== undefined` guard, then delegates to `run` with
 * `{ ctx, pi, name, cwd, scope? }`. `pi` is closed over by the caller (the
 * orchestrators require it for the RH-5 soft-dep probes).
 */
export function makeSingleNameMarketplaceHandler(
  pi: ExtensionAPI,
  usage: string,
  run: SingleNameMarketplaceRun,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name" }] as const,
        usage,
      },
      (message) => {
        notifyUsageError(ctx, {
          message: message === usage ? "Missing required argument." : message,
          usage,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await run({
      ctx,
      pi,
      name: parsed.name,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
