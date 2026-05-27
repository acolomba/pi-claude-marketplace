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
    // No try/catch: the inner `importClaudeSettings` after Plan 20-02
    // owns its own per-scope try/catch via `executeScopedPlan`
    // (execute.ts:745-755); catastrophic uncaught throws bubble to Pi
    // runtime per D-20-03.
  };
}
