// orchestrators/plugin/dependency-bindings.ts
//
// UPD-DEP-D1: what install's flow binds the dependency plan and its moves to:
// the materialization policy of each operation, the context every move of one
// operation shares, the refusal rows of an update's settle, and the cleanup of
// the clones a plan created. The cascade runs and the plan ports stay in
// `install-flow.ts`, which owns the cascade's lock body; this leaf holds the
// bindings that need none of it.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import { collectPluginCloneCandidatesLocked } from "./clone-gc.ts";
import { cascadeFailureCause, composeCascadeFailureMessage } from "./install-cascade.messaging.ts";

import type { DependencyMoveContext, DependencyMoveMemos } from "./dependency-move.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type { UpdateHooksRouting } from "./update-cascade.ts";
import type { MaterializationPolicy } from "./update-preflight.ts";
import type { ThreePhaseArgs } from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ProjectLedgerAdmission } from "../../persistence/project-installs.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { UpdateDependencyRow } from "../types.ts";

/**
 * UPD-DEP-D1 / NFR-5: `install` moves a dependency the way it reads every
 * source, a present mirror offline, a cache miss cloned; a constrained
 * dependency's tags are read (D-03-03).
 */
export const INSTALL_MOVE_MATERIALIZATION: MaterializationPolicy = {
  refreshSource: false,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: true,
};

/**
 * D-23: `apply` takes the catalog version with no tag listing, as its plan and
 * `pending` do.
 */
export const RECONCILE_MOVE_MATERIALIZATION: MaterializationPolicy = {
  ...INSTALL_MOVE_MATERIALIZATION,
  searchReleaseTags: false,
};

/** The command's fields a dependency move and an update's dependency cascade read. */
export interface DependencyCaller {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly mapModel?: boolean;
  readonly partial?: boolean;
  /**
   * D-CF2-16: the admission of the plugin the command acts on, which its
   * dependencies share. Absent, the command named that plugin.
   */
  readonly ledgerAdmission?: ProjectLedgerAdmission;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/** Where an operation's dependencies land: one scope (D-03-05). */
export interface DependencyTarget {
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
}

/** The operation-wide collaborators every move of one operation runs with. */
export interface DependencyMoveOwners {
  readonly hooksRouting: UpdateHooksRouting;
  readonly completionCache: CompletionCache;
  readonly env: ClaudeEnv;
}

/** The caller fields a dependency move reads, spread only when set. */
function callerFields(
  caller: DependencyCaller,
): Pick<
  DependencyMoveContext,
  | "authMemo"
  | "credentialOps"
  | "deviceFlowHttp"
  | "ledgerAdmission"
  | "mapModel"
  | "notification"
  | "partial"
> {
  return {
    notification: { ctx: caller.ctx, run: caller.run },
    ...(caller.partial !== undefined && { partial: caller.partial }),
    ...(caller.ledgerAdmission !== undefined && { ledgerAdmission: caller.ledgerAdmission }),
    ...(caller.mapModel !== undefined && { mapModel: caller.mapModel }),
    ...(caller.credentialOps !== undefined && { credentialOps: caller.credentialOps }),
    ...(caller.deviceFlowHttp !== undefined && { deviceFlowHttp: caller.deviceFlowHttp }),
    ...(caller.authMemo !== undefined && { authMemo: caller.authMemo }),
  };
}

/**
 * IN-N4: a move collects no clone. The operation's sweep after its last step
 * collects the revisions its moves replaced.
 */
function leaveClonesToTheSweep(): Promise<void> {
  return Promise.resolve();
}

/** UPD-DEP-D1: what every dependency move of one operation runs with. */
export function dependencyMoveContext(args: {
  readonly owners: DependencyMoveOwners;
  readonly target: DependencyTarget;
  readonly caller: DependencyCaller;
  readonly policy: MaterializationPolicy;
  readonly memos: DependencyMoveMemos;
  readonly cloneCandidates: Set<string>;
}): DependencyMoveContext {
  const { owners, caller } = args;
  return {
    ...args.target,
    hooksRouting: owners.hooksRouting,
    completionCache: owners.completionCache,
    env: owners.env,
    policy: args.policy,
    softDeps: caller.run.softDeps,
    cleanupClones: leaveClonesToTheSweep,
    cloneCandidates: args.cloneCandidates,
    ...callerFields(caller),
    ...args.memos,
  };
}

/** The update's own memo pair when it has one, else `fresh`, so its moves list a source once. */
export function tagMemosOf(args: ThreePhaseArgs, fresh: DependencyMoveMemos): DependencyMoveMemos {
  return {
    constraintTagMemo: args.constraintTagMemo ?? fresh.constraintTagMemo,
    constraintMarketplaceTagMemo:
      args.constraintMarketplaceTagMemo ?? fresh.constraintMarketplaceTagMemo,
  };
}

/**
 * The update arguments' caller fields, spread only when set. WR-N3: a
 * cascade-mode update's `partial` is SEV-03's in-place degrade of the plugin
 * it updates, not the user's `--partial`, so its dependencies get none and
 * need their own consent, as on an install.
 */
export function updateCaller(
  args: ThreePhaseArgs,
  notification: { readonly ctx: NotificationContext; readonly run: NotificationRun },
): DependencyCaller {
  return {
    ...notification,
    ...(args.mapModel !== undefined && { mapModel: args.mapModel }),
    ...(!args.cascade && args.partial !== undefined && { partial: args.partial }),
    ...(args.ledgerAdmission !== undefined && { ledgerAdmission: args.ledgerAdmission }),
    ...(args.credentialOps !== undefined && { credentialOps: args.credentialOps }),
    ...(args.deviceFlowHttp !== undefined && { deviceFlowHttp: args.deviceFlowHttp }),
    ...(args.authMemo !== undefined && { authMemo: args.authMemo }),
  };
}

/**
 * Returns a sweep over the exact cache entries one planning attempt created or
 * can leave unreferenced. The caller adds candidates while it plans and runs
 * the sweep after it releases every scope lock. The sweep takes a fresh lock,
 * rechecks current references, and never throws. An unrelated cache entry is
 * not a candidate and stays.
 */
export function planCloneSweep(
  locations: ScopedLocations,
  candidates: ReadonlySet<string>,
): Promise<() => Promise<void>> {
  return Promise.resolve(async () => {
    try {
      await collectPluginCloneCandidatesLocked(locations, candidates);
    } catch (err) {
      hookDebugLog(`dependency plan: clone cleanup failed: ${errorMessage(err)}`, "install");
    }
  });
}

/**
 * The refusal of a settle rooted at `root`: the failing row, named by its
 * full key, without the updated plugin's `{dependency failed}` row, which the
 * update reports itself. A refusal whose subject is the updated plugin -- a
 * move that would need it moved again -- keeps its own row under its key.
 */
export function dependencyRefusal(root: { readonly rootKey: string; readonly scope: Scope }): (
  subject: CascadeFailureSubject,
) => {
  readonly rows: readonly UpdateDependencyRow[];
  readonly cause: Error;
} {
  return (subject) => ({
    rows: composeCascadeFailureMessage({
      scope: root.scope,
      rootKey: root.rootKey,
      rootName: root.rootKey,
      subject,
    }).flatMap((row) => (row.status === "failed" && row.cause !== undefined ? [row] : [])),
    cause: cascadeFailureCause(subject, root.rootKey),
  });
}
