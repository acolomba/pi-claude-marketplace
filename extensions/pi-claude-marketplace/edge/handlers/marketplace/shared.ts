// edge/handlers/marketplace/shared.ts
//
// Shared factory for the single-`<name>`-positional marketplace edge handlers
// (`info`). The shim parses one required `name` positional and the
// optional `--scope` flag, routes an argument-parsing failure through
// `notifyUsageError` (MSG-NC-2: the missing-required-positional path collapses
// the duplicated usage block into "Missing required argument."), then delegate
// to their orchestrator with `{ ctx, run, name, cwd, scope? }`.
//
// Argument-parsing failures route through `notifyUsageError`; the orchestrator
// owns per-scope projection / fan-out / the conditional `{marketplace not added}` forms.

import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { extractLocalFlag } from "../shared.ts";

import type { GetMarketplaceInfoOptions } from "../../../orchestrators/marketplace/info.ts";
import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { NotificationRun } from "../../../shared/notification-run.ts";
import type { Scope } from "../../../shared/types.ts";
import type { SubcommandHandler } from "../../router.ts";

/**
 * Delegate shape for a `<name>`-only marketplace subcommand, named as the
 * option bag `getMarketplaceInfo` declares and reads rather than as a mirror
 * the shim keeps in step by hand. A delegate whose own parameter adds an
 * OPTIONAL slot (`removeMarketplace`'s `cascade?`) stays assignable, because
 * parameter contravariance asks only that this shape satisfy the delegate's.
 *
 * RECON-03: orchestrators may return a typed outcome in orchestrated mode.
 * `GetMarketplaceInfoOptions` (today's only instantiation) has no
 * `notifications` field yet, so only the standalone-mode void return is
 * exercised; `Promise<unknown>` keeps the return unconstrained for a future
 * orchestrator added to this shim that does add one.
 */
export type SingleNameMarketplaceOperation = (opts: GetMarketplaceInfoOptions) => Promise<unknown>;

/**
 * Build a thin-shim handler for a `<name>`-only marketplace subcommand. The
 * returned handler performs the single-`name`-positional `parseCommandArgs`
 * parse + the `message === usage ? "Missing required argument." : message`
 * error callback + the `=== undefined` guard, then delegates to `operation`
 * with `{ ctx, run, name, cwd, scope? }`. `run` is the command's notification
 * run, which the handler receives from the router; the orchestrator renders
 * from its soft-dependency snapshot (D-05).
 *
 * `info` is a merged read that never writes configuration, so a write-target
 * flag has no meaning for it and `parseCommandArgs` rejects it as an unknown
 * flag like any other (AP-5).
 */
export function makeSingleNameMarketplaceHandler(
  usage: string,
  operation: SingleNameMarketplaceOperation,
): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      {
        positional: [{ name: "name", label: "Marketplace name" }] as const,
        usage,
      },
      (message) => {
        notifyUsageError(ctx, run, {
          message: message === usage ? "Missing required argument." : message,
          usage,
        });
      },
    );
    if (parsed === undefined) {
      return;
    }

    await operation({
      ctx,
      run,
      name: parsed.name,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}

/**
 * Shared opening parse for the marketplace edge handlers that take exactly
 * ONE positional name (`add <source>`, `remove <name>`) plus the optional
 * `--scope` flag and the optional `--local` flag.
 *
 * Runs the byte-identical prologue of both `makeAddHandler` and
 * `makeRemoveHandler`:
 *
 *   1. WB-01: `extractLocalFlag` BEFORE positional parsing so flag position
 *      cannot change the outcome (matches the enable-disable handler shape).
 *   2. `parseCommandArgs` with the single positional name and label supplied
 *      by the caller; the label names the field when the value is empty
 *      (USE-07).
 *   3. MSG-NC-2: argument-parsing failure -> sentence form + Usage block
 *      (notifyUsageError contract: `${message}\n\n${usageBlock}`). Substitute
 *      `"Missing required argument."` when the parser hands back the usage
 *      string verbatim, which it does for an omitted positional
 *      (notifyUsageError would re-emit the Usage block otherwise).
 *
 * Returns `undefined` when either the local-flag extraction or the
 * positional parse fails (the usage error has already been notified; the
 * caller should early-return). Otherwise returns the merged `parsed` row +
 * the `localFlag` so the call site can read both the positional value (typed
 * under the literal `N` parameter as `result[N]`) and `local` / `scope`.
 */
export function openMarketplaceCommand<N extends string>(
  args: string,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
  opts: { usage: string; positionalName: N; positionalLabel: string },
): (Readonly<Record<N, string>> & { readonly scope?: Scope; readonly local: boolean }) | undefined {
  const localFlag = extractLocalFlag(args, { ctx, run, usage: opts.usage });
  if (localFlag === undefined) {
    return undefined;
  }

  const parsed = parseCommandArgs(
    localFlag.residualArgs,
    {
      positional: [{ name: opts.positionalName, label: opts.positionalLabel }] as const,
      usage: opts.usage,
    },
    (message) => {
      notifyUsageError(ctx, run, {
        message: message === opts.usage ? "Missing required argument." : message,
        usage: opts.usage,
      });
    },
  );
  if (parsed === undefined) {
    return undefined;
  }

  return {
    ...(parsed as Readonly<Record<N, string>> & { readonly scope?: Scope }),
    local: localFlag.local,
  };
}
