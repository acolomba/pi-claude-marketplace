import {
  importClaudeSettings,
  type ClaudeImportExecutionResult,
  type ImportClaudeSettingsOptions,
} from "../../../orchestrators/import/execute.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyError, notifyUsageError } from "../../../shared/notify.ts";
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
      notifyUsageError(ctx, err instanceof Error ? err.message : String(err), USAGE);
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, "import does not accept positional arguments.", USAGE);
      return;
    }

    try {
      await (deps.importClaudeSettings ?? importClaudeSettings)({
        ctx,
        pi,
        cwd: ctx.cwd,
        selectedScopes: parsed.scope === undefined ? ["user", "project"] : [parsed.scope],
        gitOps: deps.gitOps,
      });
    } catch (err) {
      notifyError(ctx, `Import encountered an unexpected error: ${errorMessage(err)}`, err);
    }
  };
}
