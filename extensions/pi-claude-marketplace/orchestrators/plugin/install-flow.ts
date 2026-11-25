// orchestrators/plugin/install-flow.ts
//
// Public composition root for install transaction sequencing.

import { createRemovalOps } from "../../shared/fs-utils.ts";
import { defaultPluginTransportContext } from "../marketplace/shared.ts";

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

import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { PluginTransportContext } from "../github-transport.ts";
import type { InstallPluginOutcome } from "../types.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  InstallMissingDependencyOptions,
  InstallMissingDependencyOutcome,
} from "./install-flow-dependency-ledger.ts";
import type {
  InstallFileCapabilities,
  InstallPluginOptions,
  InstallTransaction,
} from "./install-flow-ledger.ts";
import type { UpdateDependencyResolver } from "./update-swap.ts";

export type {
  InstallMissingDependencyOptions,
  InstallMissingDependencyOutcome,
} from "./install-flow-dependency-ledger.ts";
export type { InstallPluginOptions, InstallTransaction } from "./install-flow-ledger.ts";

const INSTALL_FILE_CAPABILITIES: InstallFileCapabilities = {
  removalOps: createRemovalOps(),
};

const INSTALL_PLANNING = createInstallPlanning(
  {
    preparePlan: prepareInstallDependencyPlan,
    previewRoot: previewInstallDependencyPlanRoot,
    runCascade: runInstallDependencyPlanCascade,
    projectCaughtFailure: projectCaughtInstallDependencyPlanFailure,
    projectFailedMoves: projectFailedInstallDependencyPlanMoves,
  },
  INSTALL_FILE_CAPABILITIES,
);

/**
 * D-SG-18: `run` with the caller's transport context, or with a new one from
 * `newTransportContext` when the caller brings none.
 */
function withTransportContext<O extends { readonly transportContext?: PluginTransportContext }, R>(
  run: (opts: O) => Promise<R>,
  newTransportContext: () => PluginTransportContext,
): (opts: O) => Promise<R> {
  return (opts) =>
    run({ ...opts, transportContext: opts.transportContext ?? newTransportContext() });
}

/**
 * Binds install orchestration to one required semantic transaction owner.
 *
 * D-SG-18: each install call that brings no transport context gets a new one
 * from `newTransportContext`, by default bound to the user's real ssh, so one
 * command probes once across its cascade. A caller that runs several installs
 * as one command passes its own.
 */
export function createInstallPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
  newTransportContext: () => PluginTransportContext = defaultPluginTransportContext,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  const install = createInstallLedgerPlugin(
    transaction,
    hooksRouting,
    completionCache,
    INSTALL_PLANNING,
    INSTALL_FILE_CAPABILITIES,
    env,
  );
  return withTransportContext(install, newTransportContext);
}

/**
 * Binds the missing-dependency install to the install transaction owner.
 * D-SG-18: like an install, a call that brings no transport context gets a
 * new one from `newTransportContext`, which its closure shares.
 */
export function createInstallMissingDependency(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
  newTransportContext: () => PluginTransportContext = defaultPluginTransportContext,
): (opts: InstallMissingDependencyOptions) => Promise<InstallMissingDependencyOutcome> {
  const install = createInstallMissingDependencyLedger(
    transaction,
    hooksRouting,
    completionCache,
    INSTALL_FILE_CAPABILITIES,
    env,
  );
  return withTransportContext(install, newTransportContext);
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
