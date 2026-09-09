// orchestrators/plugin/reinstall-flow.ts
//
// Public composition root for direct and bulk plugin reinstalls. The retained
// reinstall hub owns transaction sequencing and notification projection until
// its final retirement; this owner binds it to the four named reinstall leaves.

import { probeReinstallClone } from "./reinstall-clone-probe.ts";
import { recordReinstallOutcome, reinstallReasonsFromError } from "./reinstall-record.ts";
import { REAL_REINSTALL_TRANSACTION } from "./reinstall-replace.ts";
import { selectReinstallTargets } from "./reinstall-targets.ts";
import {
  type ReinstallFlowOwners,
  type ReinstallHooksRouting,
  reinstallPluginsWith,
  reinstallPluginWithTransaction,
} from "./reinstall.ts";

import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { LockedStateTransactionDeps } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { ReinstallPluginOutcome } from "../types.ts";
import type { ReinstallCloneCacheSeam } from "./reinstall-clone-probe.ts";
import type { ReinstallTransaction, RemoveDataDirFn } from "./reinstall-replace.ts";
import type { ReinstallPluginsTarget } from "./reinstall-targets.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

/** Test seams threaded through the public reinstall flow. */
export interface ReinstallPluginDeps {
  readonly stateTransaction?: LockedStateTransactionDeps;
  readonly removeDataDir?: RemoveDataDirFn;
  readonly cloneCacheSeam?: ReinstallCloneCacheSeam;
}

/** Complete inputs for one installed plugin reinstall. */
export interface ReinstallPluginOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly render?: "default" | "none";
  readonly local?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly __deps?: ReinstallPluginDeps;
}

/** Complete inputs for targeted or bulk plugin reinstall. */
export interface ReinstallPluginsOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: ReinstallPluginsTarget;
  readonly local?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly __deps?: ReinstallPluginDeps;
}

/** One plugin reinstall bound to a transaction and lifecycle routing owner. */
export type ReinstallPluginFn = (
  options: ReinstallPluginOptions,
) => Promise<ReinstallPluginOutcome>;

/** Direct/bulk reinstall operation bound to one lifecycle routing owner. */
export type ReinstallPluginsFn = (
  options: ReinstallPluginsOptions,
) => Promise<readonly ReinstallPluginOutcome[]>;

const REINSTALL_FLOW_OWNERS: ReinstallFlowOwners = {
  probeReinstallClone,
  recordReinstallOutcome,
  reinstallReasonsFromError,
  selectReinstallTargets,
};

/** Binds one reinstall operation to a required semantic transaction owner. */
export function createReinstallPlugin(
  transaction: ReinstallTransaction,
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return (options) =>
    reinstallPluginWithTransaction(
      REINSTALL_FLOW_OWNERS,
      transaction,
      hooksRouting,
      completionCache,
      options,
    );
}

/** Binds one production reinstall to the real transaction and supplied routing owner. */
export function createNodeReinstallPlugin(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
}

/** Binds direct and bulk production reinstall to one lifecycle routing owner. */
export function createNodeReinstallPlugins(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginsFn {
  const reinstallPlugin = createNodeReinstallPlugin(hooksRouting, completionCache);
  return (options) => reinstallPluginsWith(REINSTALL_FLOW_OWNERS, options, reinstallPlugin);
}
