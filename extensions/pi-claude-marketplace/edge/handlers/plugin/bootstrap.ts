// edge/handlers/plugin/bootstrap.ts
//
// Thin-shim handler factory for `/claude:plugin bootstrap`.
//
// Delegates to `bootstrapClaudePlugin`, threading `deps.gitOps` through.
// Idempotent end-to-end -- both composed orchestrators are idempotent.
//
// The bootstrap subcommand takes NO positional arguments and rejects
// `--scope` explicitly: bootstrap always targets user scope. Its direct
// parser retains the command-specific diagnostics for forbidden arguments.
//
// IL-2: all user-visible output flows through `shared/notification-dispatch.ts`. The
// composed orchestrators emit the success rows and a failed add's row (with
// its reason and cause, as `marketplace add` renders it). An error that is not
// an add precondition still THROWS, so the handler wraps
// `bootstrapClaudePlugin` in a catch that routes it through the `notify` path
// as a failed marketplace row -- a raw stack trace must never reach the user
// channel.
//
// D-05: the router's run renders the add, the autoupdate flip, and the
// handler's own failed row from one soft-dependency snapshot.

import {
  bootstrapClaudePlugin,
  BOOTSTRAP_MARKETPLACE_NAME,
} from "../../../orchestrators/plugin/bootstrap.ts";
import { errorMessage, rethrowInvalidGitHubBaseUrl } from "../../../shared/errors.ts";
import { notify, notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { rejectUnknownFlag } from "../shared.ts";

import type { SubcommandHandler } from "../../router.ts";
import type { EdgeDeps } from "../../types.ts";

const USAGE = "Usage: /claude:plugin bootstrap";

export function makeBootstrapHandler(
  deps: Pick<EdgeDeps, "completionCache" | "gitOps">,
): SubcommandHandler {
  // fallow-ignore-next-line code-duplication -- reviewed: bootstrap and import share the same parse-then-reject-positionals prologue on purpose, so each handler reads top to bottom
  return async (args, ctx, run): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, run, { message: errorMessage(err), usage: USAGE });
      return;
    }

    if (rejectUnknownFlag(parsed.positional, { ctx, run, usage: USAGE })) {
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, run, { message: "bootstrap takes no arguments.", usage: USAGE });
      return;
    }

    // Reject --scope flag explicitly: bootstrap is user-scope only.
    if (parsed.scope !== undefined) {
      notifyUsageError(ctx, run, {
        message: "bootstrap does not accept --scope; it always targets user scope.",
        usage: USAGE,
      });
      return;
    }

    try {
      await bootstrapClaudePlugin({
        ctx,
        run,
        cwd: ctx.cwd,
        completionCache: deps.completionCache,
        gitOps: deps.gitOps,
      });
    } catch (err) {
      // GHB-03: an invalid GitHub base override fails the command instead of
      // becoming the causeless failed row below, so the user sees the variable.
      rethrowInvalidGitHubBaseUrl(err);
      // `bootstrapClaudePlugin` renders every add precondition failure itself
      // (ATTR-07), so only an error outside that closed set, or a failure of
      // the autoupdate step after a successful add, reaches here, and it still
      // needs routing through the notify path as a failed
      // marketplace row (IL-2). The row stamps caller `severity: "error"`
      // (SEV-02). The marketplace-level row carries no cause chain -- SNM-10
      // confines `cause` to plugin-level variants.
      notify(ctx, run, {
        marketplaces: [
          {
            name: BOOTSTRAP_MARKETPLACE_NAME,
            scope: "user",
            status: "failed",
            severity: "error",
            plugins: [],
          },
        ],
      });
    }
  };
}
