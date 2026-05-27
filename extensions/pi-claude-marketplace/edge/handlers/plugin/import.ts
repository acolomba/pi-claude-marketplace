import {
  importClaudeSettings,
  type ClaudeImportExecutionResult,
  type ImportClaudeSettingsOptions,
} from "../../../orchestrators/import/execute.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { GitOps } from "../../../orchestrators/marketplace/shared.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin import [--scope user|project]";

export interface ImportHandlerDeps {
  readonly gitOps: GitOps;
  readonly importClaudeSettings?: (
    opts: ImportClaudeSettingsOptions,
  ) => Promise<ClaudeImportExecutionResult>;
}

export function makeImportHandler(
  pi: ExtensionAPI,
  deps: ImportHandlerDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, {
        message: err instanceof Error ? err.message : String(err),
        usage: USAGE,
      });
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, {
        message: "import does not accept positional arguments.",
        usage: USAGE,
      });
      return;
    }

    await (deps.importClaudeSettings ?? importClaudeSettings)({
      ctx,
      pi,
      cwd: ctx.cwd,
      selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
      gitOps: deps.gitOps,
    });
    // No try/catch: importClaudeSettings wraps loadState (in executeScopedPlan's
    // state-load try block), addMarketplace (in executeScopedPlan's
    // marketplacesToEnsure loop), and installPlugin (in executeScopedPlan's
    // pluginsToInstall loop, per Plan 20-05 WR-02 gap closure) per-scope;
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
