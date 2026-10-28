// orchestrators/plugin/install-flow-dependency-ledger.ts
//
// Missing-dependency transaction and dependency-planning ledger operations.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { hygieneWarning } from "../../shared/staging-warnings.ts";

import { carryUnsavedAdds } from "./carried-marketplace-adds.ts";
import { readCandidateDeclaration } from "./dependency-declaration-read.ts";
import { judgeDependencyMove } from "./dependency-move.ts";
import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeMemberRow,
  composeUnmaterializedRows,
} from "./install-cascade.messaging.ts";
import {
  runDependencyCascade,
  runDependencyCascadeOrPlanMoves,
  runInstallCascade,
  walkDependencyGraph,
} from "./install-cascade.ts";
import {
  authorizeMissingDependency,
  buildInstallLedgerOptions,
  catalogLookup,
  collectInstalledKeys,
  dependencyLedgerOptions,
  installMcpConfigNoticesMember,
  loadInstallRootAllowlist,
  settleAddedMarketplaces,
  sharedCascadeOptions,
  trackInstallAdds,
  unwrapCascade,
} from "./install-flow-cascade-context.ts";
import { hydrateInstalledHooks } from "./install-flow-ledger.ts";
import {
  collectPostCommitWarnings,
  handleCaughtInstallFailure,
  movedMember,
  movedRows,
  writeReEnabledCascadeMemberConfigEntries,
} from "./install-flow-results.ts";
import {
  DEFAULT_MARKETPLACE_ADD,
  ledgerDegradationSignals,
  previewInstall,
} from "./install-outcome.ts";
import { formatOrchestratedCause } from "./install.messaging.ts";
import {
  collectInstallReachableMarketplaces,
  resolveInstallMarketplaceSource,
  type LedgerDegradationSignals,
} from "./shared.ts";

import type { CarriedAdd } from "./carried-marketplace-adds.ts";
import type { DependencyCaller, DependencyTarget } from "./dependency-bindings.ts";
import type { DependencyMoveContext, DependencyMoveMemos } from "./dependency-move.ts";
import type { DependencyPlanPorts } from "./dependency-plan.ts";
import type { SettleCascadeRun } from "./dependency-settle.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadeMemberOutcome,
  CascadePlan,
  CascadeTagProbe,
  DependencyCascadeResult,
  InstallCascadeOptions,
  PlannedClosure,
} from "./install-cascade.ts";
import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type { CascadeFailureSink, TargetRecordFor } from "./install-flow-cascade-context.ts";
import type {
  InstallPlanningOwners,
  InstallPluginOptions,
  InstallTransaction,
} from "./install-flow-ledger.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerSummary,
} from "./install-outcome.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ClosureLookup, ClosureSubject } from "../../domain/dependency-closure.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { StagingWarning } from "../../shared/staging-warnings.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";
import type { LockedStateTransaction } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallPluginOutcome, MovedDependency } from "../types.ts";

/**
 * MISS-01 / D-09-05: what a reload's missing-dependency step needs to install
 * one dependency and its own closure. No `notifications` field -- the entry
 * point never notifies (RECON-04's single `notify()` belongs to
 * `applyReconcile`) -- and no `applyDefaultEnabled`, `local`, `mapModel`,
 * `partial` or `pinVersionOverride`: none of DFEN-04's landed-disabled arm,
 * D-04-02's config write, or a caller-supplied version pin applies on this
 * path.
 */
export interface InstallMissingDependencyOptions {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly scope: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /**
   * D-09-05: the raw range texts every eligible declarer accumulated for this
   * key, folded once at the cascade's own fold site (`effectiveRanges`).
   */
  readonly ranges: readonly string[];
  /**
   * The dependent whose declaration first named this key (`plan.ts`'s
   * `requiredBy`), carried onto a marketplace-absent failure's subject.
   */
  readonly requiredBy: string;
  /** Every eligible original declarer; absent for singular direct callers. */
  readonly declarers?: readonly string[];
  /**
   * GV-01: the declarers whose declaration carries one of `ranges`, which a
   * plugin directory copy outside them names as Claude Code does.
   */
  readonly requirers?: readonly string[];
  readonly tagProbe?: CascadeTagProbe;
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /** LAYER-07: the `marketplace add` seam, as on `InstallPluginOptions`. */
  readonly marketplaceAdd?: InstallLedgerOptions["marketplaceAdd"];
}

/**
 * MISS-01 / MISS-02: the outcome of installing one missing dependency and its
 * closure.
 *
 * SURF-05 / WARN-01: the `installed` arm inherits the root ledger run's
 * degradation signals from `LedgerDegradationSignals` rather than declaring
 * them, the same picked pair `PluginInstalledOutcome` carries, so `apply.ts`
 * stamps the root member's row exactly as `applyPluginInstalls`'s success arm
 * does. Both are omitted when the run raised neither (NREG-01).
 */
export type InstallMissingDependencyOutcome =
  | ({
      readonly status: "installed";
      readonly members: readonly CascadeMemberOutcome[];
      readonly postCommitWarnings?: readonly string[];
      readonly stagingWarnings?: readonly StagingWarning[];
      /** AFILE-04: the cascade's MCP config notices; omitted when none (NREG-01). */
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
    } & Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">)
  | { readonly status: "skipped" }
  | {
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
      readonly reason?: "cross-marketplace";
      /**
       * REC-06: the undo steps the failed install's own ledger could not
       * finish. `apply` does not render them yet (LCORCH-01). Omitted when
       * every undo finished (NREG-01).
       */
      readonly rollbackPartials?: readonly RollbackPartial[];
      /**
       * AFILE-04: the notices of the members that committed before a later
       * member failed; omitted when none (NREG-01).
       */
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
    };

/** Outcome of the locked closure inside `installMissingDependencyWithTransaction`. */
type InstallMissingDependencyTransactionOutcome =
  | { readonly kind: "already-recorded" }
  | {
      readonly kind: "installed";
      readonly root: InstallLedgerSummary;
      readonly members: readonly CascadeMemberOutcome[];
      readonly mcpConfigNotices: readonly McpConfigNotice[];
    };

/**
 * Evidence-backed type narrowing only, on the file's own
 * `assertPromotedLedgerInstalled` precedent: `handleCascadeThrow` and
 * `handleInstallThrow` both answer the failed arm when called with
 * `orchestrated: true`, so the "installed" arm of `InstallPluginOutcome` is
 * unreachable at this call site.
 */
function assertOrchestratedFailedOutcome(
  _outcome: InstallPluginOutcome,
): asserts _outcome is Extract<InstallPluginOutcome, { readonly status: "failed" }> {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * MISS-01 / D-09-05: the orchestrated-only entry point beside `installPlugin`
 * for a reload's missing-dependency step. It runs the SAME locked transaction,
 * catalog lookup, marketplace resolution and hooks hydration `installPlugin`
 * runs for a plugin's own cascade, minus every arm that names a config file or
 * a disabled landing: there is no `loadTargetLayers`, no
 * `promoteDependencyRecord`, no `resolveInstallDeclaredEnabled`, no disable
 * cascade, no `writeAdoptingConfigEntries` and no
 * `writeOrchestratedDeclarations` (D-04-02, D-04-07, DFEN-04). A
 * dependency-provenance record is declared in neither config file and lands
 * enabled whatever its own `defaultEnabled` says, because it exists to
 * satisfy a declaration (ENBL-DEP-01). It never notifies and never re-throws,
 * the same contract `installPlugin` documents, so `apply.ts` reads its
 * outcome without a guard. GHB-03: the one exception is an
 * `InvalidGitHubBaseUrlError`, which it rethrows so the whole reconcile pass
 * fails, unless the failure left a rollback partial or an MCP config rewrite
 * (AFILE-04). Then it is this dependency's failed outcome, whose cause names
 * the variable.
 */
async function installMissingDependencyWithTransaction(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv,
  opts: InstallMissingDependencyOptions,
): Promise<InstallMissingDependencyOutcome> {
  const { ctx, run, scope, cwd, marketplace, plugin } = opts;
  const locations = locationsFor(scope, cwd);
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  // RESV-06 precedent: where the cascade leaves a failing dependency for the
  // catch block, so a nested closure/constraint failure names it rather than
  // the root this entry point was asked to install.
  const cascadeFailure: CascadeFailureSink = { mcpConfigNotices: [] };
  const rootKey = `${plugin}@${marketplace}`;
  const adds = trackInstallAdds(transaction, opts.marketplaceAdd);

  let outcome: InstallMissingDependencyTransactionOutcome;
  try {
    outcome = await adds.lockOwner.withLockedStateTransaction(
      locations,
      async (tx): Promise<InstallMissingDependencyTransactionOutcome> => {
        const state = tx.state;
        // D-09-06 / D-09-04: a config install's cascade earlier in the same
        // pass may already have materialized this key, or it is a disabled
        // record this path leaves alone. Either way the key is already
        // recorded, so this arm saves nothing and installs nothing.
        if (ownValue(ownValue(state.marketplaces, marketplace)?.plugins, plugin) !== undefined) {
          return { kind: "already-recorded" };
        }

        const targetSource = await resolveInstallMarketplaceSource({
          targetScope: scope,
          cwd,
          marketplace,
          targetState: state,
        });
        if (targetSource === undefined) {
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "marketplace-not-added",
              key: rootKey,
              marketplace,
              requiredBy: opts.requiredBy,
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        const authorized = await authorizeMissingDependency({
          scope,
          cwd,
          marketplace,
          state,
          declarers: opts.declarers ?? [opts.requiredBy],
        });
        if (!authorized) {
          const at = opts.requiredBy.lastIndexOf("@");
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "cross-marketplace",
              key: rootKey,
              requiredBy: opts.requiredBy,
              marketplace,
              rootMarketplace: opts.requiredBy.slice(at + 1),
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        const cascade = await runInstallCascade({
          ...(await sharedCascadeOptions({
            opts,
            env,
            state,
            locations,
            root: { scope, cwd, marketplace, plugin, rootKey },
            adds,
            sink: cascadeFailure,
            capture,
            transaction,
          })),
          // D-09-05: the declarers' folded ranges pin the root exactly as a
          // constrained member is pinned.
          rootRanges: opts.ranges,
          ...(opts.requirers !== undefined && { rootRequiredBy: opts.requirers }),
          // D-09-04: a disabled recorded dependency is a wall on this path,
          // never a read-through member.
          treatDisabledAsWall: true,
          // D-04-01: every member of this cascade, root included, exists to
          // satisfy a declaration.
          ledgerOptionsFor: dependencyLedgerOptions(opts, env, { scope, cwd, adds }),
        });
        const installed = unwrapCascade(cascade, capture, rootKey, cascadeFailure);
        if (installed === undefined) {
          // D-03-08: on this path the root IS a dependency, so a marketplace
          // absent in both scopes is the walk's own not-added failure. Only a
          // marketplace one of the two scopes records is ever added to the
          // target scope to satisfy a declaration (LAYER-07 / D-MF-04).
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "marketplace-not-added",
              key: rootKey,
              marketplace,
              requiredBy: opts.requiredBy,
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        // AFILE-04: the cascade has rewritten the MCP config files.
        cascadeFailure.mcpConfigNotices = installed.mcpConfigNotices;
        await tx.save();
        // No `landedDisabled` filter -- nothing lands disabled here.
        await hydrateInstalledHooks({ hooksRouting, scope, cwd, members: installed.members });
        return {
          kind: "installed",
          root: installed.root,
          members: installed.members,
          mcpConfigNotices: installed.mcpConfigNotices,
        };
      },
    );
  } catch (err) {
    const failed = handleCaughtInstallFailure({
      err,
      ctx,
      run,
      marketplace,
      scope,
      plugin,
      rootKey,
      capture,
      cascadeFailure,
      orchestrated: true,
    });
    const subject = cascadeFailure.subject;
    assertOrchestratedFailedOutcome(failed);
    const failedWithNotices = {
      ...failed,
      ...installMcpConfigNoticesMember(cascadeFailure.mcpConfigNotices),
    };
    return subject?.kind === "closure" && subject.failure.reason === "cross-marketplace"
      ? { ...failedWithNotices, reason: "cross-marketplace" }
      : failedWithNotices;
  }

  await settleAddedMarketplaces(
    adds.committedAdds,
    adds.marketplaceAdd,
    locations,
    completionCache,
  );
  if (outcome.kind === "already-recorded") {
    return { status: "skipped" };
  }

  // D-03-INV: drops the root marketplace's completion cache, same as install.
  const warnings = await collectPostCommitWarnings(outcome.root, completionCache, scope, true);
  const discoveryMessages = new Map(
    outcome.root.discoveryWarnings.map((warning) => [warning.message, warning]),
  );
  const stagingWarnings = warnings.map(
    (warning): StagingWarning => discoveryMessages.get(warning) ?? hygieneWarning(warning),
  );
  return {
    status: "installed",
    members: outcome.members,
    ...(warnings.length > 0 && { postCommitWarnings: warnings }),
    ...(stagingWarnings.length > 0 && { stagingWarnings }),
    ...installMcpConfigNoticesMember(outcome.mcpConfigNotices),
    ...ledgerDegradationSignals(outcome.root),
  };
}

/**
 * Bind the missing-dependency install to one required semantic transaction
 * owner. D-08-06: `env` defaults to Pi's process environment, as it does for
 * `createInstallPlugin`.
 */
export function createInstallMissingDependencyLedger(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
): (opts: InstallMissingDependencyOptions) => Promise<InstallMissingDependencyOutcome> {
  return (opts) =>
    installMissingDependencyWithTransaction(transaction, hooksRouting, completionCache, env, opts);
}

/** The plugin at the root of dependency planning. */
interface InstallDependencyPlanRoot {
  readonly key: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly prepared?: PreparedPluginUpdate;
}

/** Reads a prepared update's declarations from the tree the update lands. */
function dependencyPlanCandidate(
  prepared: PreparedPluginUpdate,
  subject: ClosureSubject,
): ReturnType<ClosureLookup> {
  return readCandidateDeclaration({
    pluginRoot: prepared.installable.pluginRoot,
    entry: prepared.entry,
    marketplace: ownValue(prepared.state.marketplaces, subject.marketplace),
    pin: prepared.resolvedVersion,
  });
}

/** Builds the write-free graph-planning operations from one state snapshot. */
export async function prepareInstallDependencyPlan(args: {
  readonly owners: InstallPlanningOwners;
  readonly target: DependencyTarget;
  readonly caller: DependencyCaller;
  readonly context: DependencyMoveContext;
  // fallow-ignore-next-line private-type-leak -- The root adapts this operation structurally; its root stays private.
  readonly root: InstallDependencyPlanRoot;
}): Promise<DependencyPlanPorts> {
  const { owners, target, caller, context, root } = args;
  const state = await loadState(target.locations.extensionRoot);
  const recordFor: TargetRecordFor = async (marketplace) =>
    (
      await resolveInstallMarketplaceSource({
        targetScope: target.scope,
        cwd: target.cwd,
        marketplace,
        targetState: state,
      })
    )?.sourceRecord;
  const lookup = catalogLookup(recordFor, target.locations, { mcpConfigNotices: [] });
  const ledgerOptionsFor = dependencyLedgerOptions(caller, owners.env, {
    scope: target.scope,
    cwd: target.cwd,
    adds: trackInstallAdds(owners.transaction, undefined),
  });
  const rootAllowedMarketplaces = await loadInstallRootAllowlist(
    recordFor,
    root.marketplace,
    root.plugin,
  );
  const knownMarketplaces = await collectInstallReachableMarketplaces({
    targetScope: target.scope,
    cwd: target.cwd,
    targetState: state,
  });
  return {
    judge: (request) => judgeDependencyMove(request, context),
    walk: (moving) =>
      walkDependencyGraph({
        state,
        locations: target.locations,
        rootKey: root.key,
        rootAllowedMarketplaces,
        lookup: (subject) => {
          const prepared = subject.key === root.key ? root.prepared : moving.get(subject.key);
          return prepared === undefined
            ? lookup(subject)
            : dependencyPlanCandidate(prepared, subject);
        },
        marketplaceRecordFor: recordFor,
        installedKeys: collectInstalledKeys(state),
        readThrough: new Set(moving.keys()),
        knownMarketplaces,
        ledgerOptionsFor,
        tagMemo: context.constraintTagMemo,
        marketplaceTagMemo: context.constraintMarketplaceTagMemo,
      }),
    preview: (member) => previewInstall(state, target.locations, ledgerOptionsFor(member)),
  };
}

/** Previews the requested plugin before a dependency plan moves anything. */
export async function previewInstallDependencyPlanRoot(args: {
  readonly owners: InstallPlanningOwners;
  readonly opts: InstallPluginOptions;
  readonly target: DependencyTarget;
}): Promise<Awaited<ReturnType<typeof previewInstall>>> {
  const { owners, opts, target } = args;
  return previewInstall(
    await loadState(target.locations.extensionRoot),
    target.locations,
    buildInstallLedgerOptions(opts, owners.env, {
      scope: target.scope,
      cwd: target.cwd,
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      ...(opts.pinVersionOverride !== undefined && { pinVersion: opts.pinVersionOverride }),
      marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
      addedMarketplaces: [],
    }),
  );
}

/** The stable inputs shared by the first cascade and each planned closure slice. */
interface InstallDependencyPlanCascade {
  readonly owners: InstallPlanningOwners;
  readonly target: DependencyTarget;
  readonly caller: DependencyCaller;
  readonly root: InstallDependencyPlanRoot;
  readonly memos: DependencyMoveMemos;
  readonly carried: CarriedAdd[];
  readonly writesConfig: boolean;
}

/** Saves and projects one closure slice while its state lock is still held. */
async function saveInstallDependencyPlanClosure(
  args: InstallDependencyPlanCascade,
  settled: Extract<DependencyCascadeResult, { readonly kind: "dependencies-installed" }>,
  tx: LockedStateTransaction,
): Promise<SettleCascadeRun> {
  if (args.writesConfig) {
    await writeReEnabledCascadeMemberConfigEntries(args.target.locations, settled.members);
  }

  await tx.save();
  await hydrateInstalledHooks({
    hooksRouting: args.owners.hooksRouting,
    scope: args.target.scope,
    cwd: args.target.cwd,
    members: settled.members,
  });
  return {
    kind: "installed",
    rows: settled.members.map((member) =>
      composeCascadeMemberRow(member, args.caller.run.softDeps),
    ),
    ...installMcpConfigNoticesMember(settled.mcpConfigNotices),
  };
}

/**
 * Runs one complete dependency-planning cascade under the ledger's lock.
 * The initial run may return a plan; later runs materialize one planned slice.
 */
export function runInstallDependencyPlanCascade(
  // fallow-ignore-next-line private-type-leak -- The root adapts this operation structurally; its context stays private.
  args: InstallDependencyPlanCascade & { readonly kind: "initial" },
): Promise<SettleCascadeRun | CascadePlan>;
export function runInstallDependencyPlanCascade(
  args: InstallDependencyPlanCascade & {
    readonly kind: "materialize";
    readonly members: PlannedClosure["members"];
  },
): Promise<SettleCascadeRun>;
export async function runInstallDependencyPlanCascade(
  args: InstallDependencyPlanCascade &
    (
      | { readonly kind: "initial" }
      | { readonly kind: "materialize"; readonly members: PlannedClosure["members"] }
    ),
): Promise<SettleCascadeRun | CascadePlan> {
  const { owners, target, caller, root } = args;
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };
  const adds = trackInstallAdds(owners.transaction, undefined, args.carried);
  try {
    const run = await adds.lockOwner.withLockedStateTransaction(target.locations, async (tx) => {
      const shared = await sharedCascadeOptions({
        opts: caller,
        env: owners.env,
        state: tx.state,
        locations: target.locations,
        root: { ...target, marketplace: root.marketplace, plugin: root.plugin, rootKey: root.key },
        adds,
        sink,
        capture,
        transaction: owners.transaction,
      });
      const options: InstallCascadeOptions = {
        ...shared,
        lookup: (subject) =>
          subject.key === root.key && root.prepared !== undefined
            ? dependencyPlanCandidate(root.prepared, subject)
            : shared.lookup(subject),
        tagMemo: args.memos.constraintTagMemo,
        marketplaceTagMemo: args.memos.constraintMarketplaceTagMemo,
        ledgerOptionsFor: dependencyLedgerOptions(caller, owners.env, { ...target, adds }),
      };
      const cascade =
        args.kind === "initial"
          ? await runDependencyCascadeOrPlanMoves(options)
          : await runDependencyCascade({
              ...options,
              planned: { members: args.members, alreadyInstalled: [] },
            });
      const settled = unwrapCascade(cascade, capture, root.key, sink);
      if (settled === undefined) {
        throw new Error(`A dependency of "${root.key}" names a marketplace that is not added.`);
      }

      if (settled.kind === "planned") {
        carryUnsavedAdds(adds.addedMarketplaces, tx.state, args.carried);
        return settled;
      }

      return saveInstallDependencyPlanClosure(args, settled, tx);
    });
    await settleAddedMarketplaces(
      adds.committedAdds,
      adds.marketplaceAdd,
      target.locations,
      owners.completionCache,
    );
    return run;
  } catch (err) {
    const subject = sink.subject;
    if (subject === undefined) {
      throw err;
    }

    return { kind: "refused", subject };
  }
}

/** Projects a caught planning failure through install's normal failure contract. */
export function projectCaughtInstallDependencyPlanFailure(
  args: Parameters<typeof handleCaughtInstallFailure>[0],
): InstallPluginOutcome {
  return handleCaughtInstallFailure(args);
}

/** Reports the plan steps that landed before one dependency move failed. */
export function projectFailedInstallDependencyPlanMoves(args: {
  readonly opts: InstallPluginOptions;
  readonly moved: readonly MovedDependency[];
  readonly cause: Error;
  readonly orchestrated: boolean;
  readonly unmaterialized: readonly string[];
}): InstallPluginOutcome {
  const { opts } = args;
  if (!args.orchestrated) {
    notifyWithContext(
      opts.ctx,
      opts.run,
      CASCADE_CONTEXT,
      [
        {
          name: opts.marketplace,
          scope: opts.scope,
          plugins: [
            {
              status: "failed",
              name: opts.plugin,
              reasons: ["dependency failed"],
              severity: "error",
            },
            ...movedRows(args.moved),
            ...composeUnmaterializedRows(args.unmaterialized, [
              `${opts.plugin}@${opts.marketplace}`,
              ...args.moved.map((entry) => entry.key),
            ]),
          ],
        },
      ],
      undefined,
      "single",
    );
  }

  return {
    status: "failed",
    error: args.cause,
    cause: formatOrchestratedCause(args.cause),
    ...movedMember(args.moved),
  };
}
