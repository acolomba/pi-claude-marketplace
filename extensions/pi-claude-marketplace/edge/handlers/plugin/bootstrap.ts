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
// notifyError / notifySuccess via shared/notify.ts. The orchestrator
// emits the success path through its own composed orchestrators.

import { bootstrapClaudePlugin } from "../../../orchestrators/plugin/bootstrap.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyError, notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin bootstrap";

export function makeBootstrapHandler(
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, errorMessage(err), USAGE);
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, "bootstrap takes no arguments.", USAGE);
      return;
    }

    // Reject --scope flag explicitly: bootstrap is user-scope only.
    if (parsed.scope !== undefined) {
      notifyUsageError(
        ctx,
        "bootstrap does not accept --scope; it always targets user scope.",
        USAGE,
      );
      return;
    }

    try {
      await bootstrapClaudePlugin({
        ctx,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
      });
    } catch (err) {
      notifyError(ctx, errorMessage(err), err);
    }
  };
}
