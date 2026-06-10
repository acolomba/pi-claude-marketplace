// edge/handlers/plugin/preview.ts
//
// DIFF-01 SC #2 / D-53-01 thin-shim handler factory for
// `/claude:plugin preview [--scope user|project]`.
//
// Pattern: mirrors `edge/handlers/marketplace/info.ts` (read-only orchestrator
// dispatch with a single optional `--scope` flag, no positionals).
// The shim:
//   1. parses raw args via `parseArgs` (validates --scope shape);
//   2. rejects any positional argument (preview takes none) and any unknown flag;
//   3. delegates to `previewReconcile({ ctx, pi, cwd, scope? })`.
//
// NFR-5: the orchestrator never touches the network or writes any file; this
// shim is the edge entry, structurally narrowed by `parseArgs` + the no-positional
// guard.

import { previewReconcile } from "../../../orchestrators/reconcile/preview.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin preview [--scope user|project]";

/**
 * Factory: returns the async handler closed over `pi`. The orchestrator is
 * read-only -- no `gitOps` / `pluginsToInstall` deps need threading.
 */
export function makePreviewHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    // Preview takes NO positional arguments. Any non-flag token (or an
    // unknown long flag passed through parseArgs as a positional) is a
    // usage error.
    if (parsed.positional.length > 0) {
      const first = parsed.positional[0] ?? "";
      if (first.startsWith("--")) {
        notifyUsageError(ctx, { message: `Unknown option: "${first}".`, usage: USAGE });
      } else {
        notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
      }

      return;
    }

    await previewReconcile({
      ctx,
      pi,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
