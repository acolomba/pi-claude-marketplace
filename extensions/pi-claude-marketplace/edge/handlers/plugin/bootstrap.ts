// edge/handlers/plugin/bootstrap.ts
//
// Thin-shim handler factory for `/claude:plugin bootstrap`.
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
// IL-2: all user-visible output flows through `shared/notify.ts`. The
// success path is emitted by the composed orchestrators. `addMarketplace`
// signals failures by THROWING (it does not notify), so the handler wraps
// `bootstrapClaudePlugin` in a catch that routes a thrown failure through
// the V2 `notify` path as a failed marketplace row -- a raw stack trace
// must never reach the user channel.

import {
  bootstrapClaudePlugin,
  BOOTSTRAP_MARKETPLACE_NAME,
} from "../../../orchestrators/plugin/bootstrap.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notify, notifyUsageError } from "../../../shared/notify.ts";
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

    try {
      await bootstrapClaudePlugin({
        ctx,
        pi,
        cwd: ctx.cwd,
        gitOps: deps.gitOps,
      });
    } catch {
      // `addMarketplace` throws on failure (e.g. a first-run GitHub clone
      // failure) rather than notifying, so route the thrown error through
      // the V2 notify path as a failed marketplace row (IL-2). notify()
      // computes `error` severity for a failed marketplace status. The
      // marketplace-level row carries no cause chain -- SNM-10 confines
      // `cause` to plugin-level variants.
      notify(ctx, pi, {
        marketplaces: [
          {
            name: BOOTSTRAP_MARKETPLACE_NAME,
            scope: "user",
            status: "failed",
            plugins: [],
          },
        ],
      });
    }
  };
}
