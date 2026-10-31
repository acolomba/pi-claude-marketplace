// edge/handlers/plugin/pending.ts
//
// DIFF-01 SC #2 / D-53-01 thin-shim handler factory for
// `/claude:plugin pending [--scope user|project]`.
//
// Pattern: mirrors `edge/handlers/marketplace/info.ts` (read-only orchestrator
// dispatch with a single optional `--scope` flag, no positionals).
// The shim, through the shared `withScopeOnlyArgs` prelude:
//   1. parses raw args via `parseArgs` (validates --scope shape);
//   2. rejects any positional argument (pending takes none) and any unknown flag;
//   3. delegates to `pendingReconcile({ ctx, run, cwd, scope? })` with the
//      router's notification run (D-05).
//
// NFR-5: the orchestrator never touches the network or writes any file; this
// shim is the edge entry, structurally narrowed by `parseArgs` + the no-positional
// guard.

import { pendingReconcile } from "../../../orchestrators/reconcile/pending.ts";

import { withScopeOnlyArgs } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin pending [--scope user|project]";

/**
 * Factory: returns the async handler, which renders from the notification run
 * the router hands it. The orchestrator is read-only -- no `gitOps` /
 * `pluginsToInstall` deps need threading.
 */
export function makePendingHandler(): SubcommandHandler {
  return withScopeOnlyArgs(USAGE, async (scope, ctx, run): Promise<void> => {
    await pendingReconcile({
      ctx,
      run,
      cwd: ctx.cwd,
      ...(scope !== undefined && { scope }),
    });
  });
}
