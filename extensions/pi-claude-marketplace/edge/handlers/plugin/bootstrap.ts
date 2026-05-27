// edge/handlers/plugin/bootstrap.ts
//
// Quick 260516-02r: thin-shim handler factory for `/claude:plugin bootstrap`.
//
// Delegates to `bootstrapClaudePlugin`, threading `deps.gitOps` through.
// Idempotent end-to-end -- both composed orchestrators are idempotent.
//
// The bootstrap subcommand takes NO positional arguments and rejects
// `--scope` explicitly: bootstrap always targets user scope. The token
// schema in `args-schema.ts` validates positionals against a declared
// list but does not currently reject extra positionals when the schema
// is empty, so we parse `args` directly with `parseArgs` and assert
// `positional.length === 0` ourselves.
//
// BLOCK A: zero direct ctx.ui.notify calls -- routes through
// notifyUsageError via shared/notify.ts. The orchestrator emits the
// success path through its own composed orchestrators. Per Plan 20-03
// (D-20-03) the outer try/catch catch-all wrapper was DROPPED -- the
// inner orchestrators `addMarketplace` + `setMarketplaceAutoupdate`
// own their own V2 failed-marketplace emission per D-18-02; truly
// catastrophic uncaught throws bubble to Pi runtime (a stack trace is
// better for debugging than a polished error message that masks the
// bug).

import { bootstrapClaudePlugin } from "../../../orchestrators/plugin/bootstrap.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin bootstrap";

export function makeBootstrapHandler(
  pi: ExtensionAPI,
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, { message: "bootstrap takes no arguments.", usage: USAGE });
      return;
    }

    // Reject --scope flag explicitly: bootstrap is user-scope only.
    if (parsed.scope !== undefined) {
      notifyUsageError(ctx, {
        message: "bootstrap does not accept --scope; it always targets user scope.",
        usage: USAGE,
      });
      return;
    }

    await bootstrapClaudePlugin({
      ctx,
      pi,
      cwd: ctx.cwd,
      gitOps: deps.gitOps,
    });
    // No try/catch: inner orchestrators (`addMarketplace` +
    // `setMarketplaceAutoupdate`) emit V2 failed notifications for
    // expected failures per D-18-02; catastrophic uncaught throws
    // bubble to Pi runtime per D-20-03.
  };
}
