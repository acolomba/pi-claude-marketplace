import {
  importClaudeSettings,
  type ClaudeImportExecutionResult,
  type ImportClaudeSettingsOptions,
} from "../../../orchestrators/import/index.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";

import { rejectUnknownFlag } from "./shared.ts";

import type { GitOps } from "../../../orchestrators/marketplace/shared.ts";
import type { InstallHooksRouting } from "../../../orchestrators/plugin/install-disable-cascade.ts";
import type { CompletionCache } from "../../../shared/completion-cache.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin import [--scope user|project]";

export interface ImportHandlerDeps {
  readonly completionCache: CompletionCache;
  readonly gitOps: GitOps;
  readonly importClaudeSettings?: (
    opts: ImportClaudeSettingsOptions,
  ) => Promise<ClaudeImportExecutionResult>;
}

/**
 * Builds the `import` handler. Import's own cascade and its nested
 * marketplace adds and plugin installs render from the router's run (D-07).
 */
export function makeImportHandler(
  deps: ImportHandlerDeps,
  hooksRouting: InstallHooksRouting,
): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, run, {
        message: errorMessage(err),
        usage: USAGE,
      });
      return;
    }

    if (rejectUnknownFlag(parsed.positional, { ctx, run, usage: USAGE })) {
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, run, {
        message: "import does not accept positional arguments.",
        usage: USAGE,
      });
      return;
    }

    const options: ImportClaudeSettingsOptions = {
      ctx,
      run,
      cwd: ctx.cwd,
      selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
      gitOps: deps.gitOps,
      hooksRouting,
      completionCache: deps.completionCache,
    };

    await (deps.importClaudeSettings ?? importClaudeSettings)(options);
    // No try/catch: importClaudeSettings wraps loadState (in executeScopedPlan's
    // state-load try block), addMarketplace (in executeScopedPlan's
    // marketplacesToEnsure loop), and installPlugin (in executeScopedPlan's
    // pluginsToInstall loop, per WR-02) per-scope;
    // expected installPlugin failures already route through the discriminated
    // {status: "failed"} return. With WR-02 in place, unexpected installPlugin
    // throws are ALSO caught and routed to result.unexpectedPluginFailures; the
    // per-scope loop continues and the final notify() at the end of
    // importClaudeSettings still fires. Only uncaught throws from the inline
    // cascade builder (buildImportNotificationMarketplaces) or from code paths
    // NOT covered by these wraps would abort the loop -- per D-20-03 such
    // catastrophic throws bubble to Pi runtime where a stack trace is more
    // useful than a polished message that masks the bug.
  };
}
