// orchestrators/plugin/install-flow.ts
//
// Public composition root for install transaction sequencing.

import {
  createInstallMissingDependencyLedger,
  prepareInstallDependencyPlan,
  previewInstallDependencyPlanRoot,
  projectCaughtInstallDependencyPlanFailure,
  projectFailedInstallDependencyPlanMoves,
  runInstallDependencyPlanCascade,
} from "./install-flow-dependency-ledger.ts";
import { createInstallLedgerPlugin } from "./install-flow-ledger.ts";
import { createInstallPlanning } from "./install-flow-planning.ts";

import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  InstallMissingDependencyOptions,
  InstallMissingDependencyOutcome,
} from "./install-flow-dependency-ledger.ts";
import type { InstallPluginOptions, InstallTransaction } from "./install-flow-ledger.ts";
import type { UpdateDependencyResolver } from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { InstallPluginOutcome } from "../types.ts";

export type {
  InstallMissingDependencyOptions,
  InstallMissingDependencyOutcome,
} from "./install-flow-dependency-ledger.ts";
export type { InstallPluginOptions, InstallTransaction } from "./install-flow-ledger.ts";

const INSTALL_PLANNING = createInstallPlanning({
  preparePlan: prepareInstallDependencyPlan,
  previewRoot: previewInstallDependencyPlanRoot,
  runCascade: runInstallDependencyPlanCascade,
  projectCaughtFailure: projectCaughtInstallDependencyPlanFailure,
  projectFailedMoves: projectFailedInstallDependencyPlanMoves,
});

/** Binds install orchestration to one required semantic transaction owner. */
export function createInstallPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return createInstallLedgerPlugin(
    transaction,
    hooksRouting,
    completionCache,
    INSTALL_PLANNING,
    env,
  );
}

/** Binds the missing-dependency install to the install transaction owner. */
export function createInstallMissingDependency(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
): (opts: InstallMissingDependencyOptions) => Promise<InstallMissingDependencyOutcome> {
  return createInstallMissingDependencyLedger(transaction, hooksRouting, completionCache, env);
}

/** Binds update dependency settlement to the install transaction owner. */
export function createUpdateDependencyResolver(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
): UpdateDependencyResolver {
  return INSTALL_PLANNING.createUpdateDependencyResolver(
    transaction,
    hooksRouting,
    completionCache,
    env,
  );
}
