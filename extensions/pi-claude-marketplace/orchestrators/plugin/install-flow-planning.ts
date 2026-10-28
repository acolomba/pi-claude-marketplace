// orchestrators/plugin/install-flow-planning.ts
//
// Dependency preview, move planning, and update-settlement leaf.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";

import { carryUnsavedAdds, discardCarriedAdds } from "./carried-marketplace-adds.ts";
import {
  INSTALL_MOVE_MATERIALIZATION,
  RECONCILE_MOVE_MATERIALIZATION,
  dependencyMoveContext,
  dependencyRefusal,
  planCloneSweep,
  tagMemosOf,
  updateCaller,
} from "./dependency-bindings.ts";
import { readCandidateDeclaration } from "./dependency-declaration-read.ts";
import {
  freshDependencyMoveMemos,
  judgeDependencyMove,
  runDependencyMove,
} from "./dependency-move.ts";
import { planDependencyGraph } from "./dependency-plan.ts";
import { runDependencySteps, settleDependencies } from "./dependency-settle.ts";
import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeMemberRow,
  composeUnmaterializedRows,
} from "./install-cascade.messaging.ts";
import {
  runDependencyCascade,
  runDependencyCascadeOrPlanMoves,
  walkDependencyGraph,
} from "./install-cascade.ts";
import { DEFAULT_MARKETPLACE_ADD, previewInstall } from "./install-outcome.ts";
import { formatOrchestratedCause } from "./install.messaging.ts";
import { collectInstallReachableMarketplaces, resolveInstallMarketplaceSource } from "./shared.ts";
import { UPDATE_MATERIALIZATION } from "./update-preflight.ts";
import { assertUpdateNamesFree } from "./update-swap.ts";

import type { CarriedAdd } from "./carried-marketplace-adds.ts";
import type { DependencyCaller, DependencyTarget } from "./dependency-bindings.ts";
import type { DependencyMoveContext, DependencyMoveMemos } from "./dependency-move.ts";
import type { DependencyPlan, DependencyPlanPorts } from "./dependency-plan.ts";
import type { DependencyStepPorts, SettleCascadeRun } from "./dependency-settle.ts";
import type {
  CascadePlan,
  DependencyCascadeResult,
  InstallCascadeOptions,
  InstallCascadeResult,
  RootCascadeResult,
} from "./install-cascade.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  CascadeFailureArm,
  CascadeFailureSink,
  InstallAdds,
  InstallAfterPlan,
  InstallPlanningOwners,
  InstallPlanningLedgerPorts,
  InstallPlanning,
  InstallPluginOptions,
  InstallTransaction,
  TargetRecordFor,
} from "./install-flow-ledger.ts";
import type { InstallFailureCapture } from "./install-outcome.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";
import type {
  ThreePhaseArgs,
  UpdateDependencyResolver,
  UpdateDependencySettlement,
} from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ClosureLookup, ClosureSubject } from "../../domain/dependency-closure.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { LockedStateTransaction } from "../../transaction/with-state-guard.ts";
import type { InstallPluginOutcome, MovedDependency } from "../types.ts";

/**
 * Routes the cascade's non-failure arms for the plain install: a marketplace
 * neither scope records, a dependency plan that must come first, or the
 * installed closure. The plan runs once the lock is released
 * (`installAfterMoves`), and `keepAddsForMoves` keeps what the run added for
 * the run after it.
 */
function routeInstallCascade(
  installed: Extract<RootCascadeResult, { readonly kind: "installed" }> | CascadePlan | undefined,
  keepAddsForMoves: () => void,
):
  | Extract<RootCascadeResult, { readonly kind: "installed" }>
  | { readonly kind: "marketplace-absent" }
  | { readonly kind: "dependency-moves" } {
  if (installed === undefined) {
    return { kind: "marketplace-absent" };
  }

  if (installed.kind === "planned") {
    keepAddsForMoves();
    return { kind: "dependency-moves" };
  }

  return installed;
}

/**
 * The read-only catalog a plan reads: the target scope's record, else the
 * user record the CMP-3 fallback names, never added (D-MF-04), so a plan
 * writes nothing.
 */
function planningCatalog(
  ledger: InstallPlanningLedgerPorts,
  state: ExtensionState,
  target: DependencyTarget,
): { readonly recordFor: TargetRecordFor; readonly lookup: ClosureLookup } {
  const recordFor: TargetRecordFor = async (marketplace) =>
    (
      await resolveInstallMarketplaceSource({
        targetScope: target.scope,
        cwd: target.cwd,
        marketplace,
        targetState: state,
      })
    )?.sourceRecord;
  return {
    recordFor,
    lookup: ledger.catalogLookup(recordFor, target.locations, { mcpConfigNotices: [] }),
  };
}

/** The plugin a dependency plan is rooted at, and how its declarations are read. */
interface PlanRoot {
  readonly key: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** An update's candidate, whose tree the root's declarations are read from (CR-04). */
  readonly prepared?: PreparedPluginUpdate;
}

/**
 * A candidate's declarations, read from the tree its update lands (CR-04),
 * inside the boundary that tree was resolved with (D-PL2-17): its
 * marketplace's record bounds a `path` tree read in place.
 */
function candidateLookup(
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

/**
 * UPD-DEP-D1: the plan's ports over one lock-free snapshot of the scope: the
 * move verdict, the write-free walk of the whole graph rooted at `root`,
 * reading each moved plugin from the tree its move lands (CR-04), and the
 * install preview.
 */
async function planningPorts(args: {
  readonly ledger: InstallPlanningLedgerPorts;
  readonly owners: InstallPlanningOwners;
  readonly target: DependencyTarget;
  readonly caller: DependencyCaller;
  readonly context: DependencyMoveContext;
  readonly root: PlanRoot;
}): Promise<DependencyPlanPorts> {
  const { ledger, owners, target, caller, context, root } = args;
  const state = await loadState(target.locations.extensionRoot);
  const catalog = planningCatalog(ledger, state, target);
  const ledgerOptionsFor = ledger.dependencyLedgerOptions(caller, owners.env, {
    scope: target.scope,
    cwd: target.cwd,
    adds: ledger.trackInstallAdds(owners.transaction, undefined),
  });
  const rootAllowedMarketplaces = await ledger.loadInstallRootAllowlist(
    catalog.recordFor,
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
            ? catalog.lookup(subject)
            : candidateLookup(prepared, subject);
        },
        marketplaceRecordFor: catalog.recordFor,
        installedKeys: ledger.collectInstalledKeys(state),
        readThrough: new Set(moving.keys()),
        knownMarketplaces,
        ledgerOptionsFor,
        tagMemo: context.constraintTagMemo,
        marketplaceTagMemo: context.constraintMarketplaceTagMemo,
      }),
    preview: (member) => previewInstall(state, target.locations, ledgerOptionsFor(member)),
  };
}

/** What one locked run of a cascade rooted at the operation's plugin reads. */
interface RootCascade {
  readonly ledger: InstallPlanningLedgerPorts;
  readonly owners: InstallPlanningOwners;
  readonly target: DependencyTarget;
  readonly caller: DependencyCaller;
  readonly root: PlanRoot;
  readonly memos: DependencyMoveMemos;
  /** WR-E: the marketplaces a planning run added, kept for the run after the plan. */
  readonly carried: CarriedAdd[];
  /**
   * WR-N2: whether a re-enabled member's `enabled: false` config entry is
   * patched, as the operation's own cascade patches it. An install that
   * `import` or `apply` runs patches none.
   */
  readonly writesConfig: boolean;
}

/** What a locked run of a root cascade hands the step that finishes it. */
interface LockedRootRun {
  readonly tx: LockedStateTransaction;
  readonly adds: InstallAdds;
}

/**
 * UPD-DEP-D1: one locked run of a cascade rooted at the operation's plugin.
 * An update's root reads its declarations from its candidate. `cascade`
 * decides what the run materializes, and `finish` what happens to its result
 * under the same lock. A failure no dependency caused -- a held lock, an
 * unreadable state -- throws, and its caller reports it as its own.
 */
async function lockedRootCascade<S extends Exclude<InstallCascadeResult, CascadeFailureArm>, T>(
  args: RootCascade,
  cascade: (options: InstallCascadeOptions) => Promise<S | CascadeFailureArm>,
  finish: (settled: S, run: LockedRootRun) => Promise<T>,
): Promise<T | Extract<SettleCascadeRun, { readonly kind: "refused" }>> {
  const { owners, target, caller, root } = args;
  const { ledger } = args;
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };
  const adds = ledger.trackInstallAdds(owners.transaction, undefined, args.carried);
  try {
    const run = await adds.lockOwner.withLockedStateTransaction(target.locations, async (tx) => {
      const shared = await ledger.sharedCascadeOptions({
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
      const prepared = root.prepared;
      const settled = ledger.unwrapCascade(
        await cascade({
          ...shared,
          lookup: (subject) =>
            subject.key === root.key && prepared !== undefined
              ? candidateLookup(prepared, subject)
              : shared.lookup(subject),
          tagMemo: args.memos.constraintTagMemo,
          marketplaceTagMemo: args.memos.constraintMarketplaceTagMemo,
          ledgerOptionsFor: ledger.dependencyLedgerOptions(caller, owners.env, {
            ...target,
            adds,
          }),
        }),
        capture,
        root.key,
        sink,
      );
      if (settled === undefined) {
        throw new Error(`A dependency of "${root.key}" names a marketplace that is not added.`);
      }

      return finish(settled, { tx, adds });
    });
    await ledger.settleAddedMarketplaces(
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

/**
 * Saves what a root cascade materialized and reports one row per member,
 * still under its lock. D-PL1-16: the members' MCP config notices ride the
 * `installed` arm, so an update can show them ahead of its own.
 */
async function saveRootClosure(
  args: RootCascade,
  settled: Extract<DependencyCascadeResult, { readonly kind: "dependencies-installed" }>,
  run: LockedRootRun,
): Promise<SettleCascadeRun> {
  if (args.writesConfig) {
    await args.ledger.writeReEnabledCascadeMemberConfigEntries(
      args.target.locations,
      settled.members,
    );
  }

  await run.tx.save();
  await args.ledger.hydrateInstalledHooks({
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
    ...args.ledger.installMcpConfigNoticesMember(settled.mcpConfigNotices),
  };
}

/**
 * The first run's finish: a plan saves nothing and keeps what the run added
 * for the runs after it (WR-E); an installed closure saves.
 */
async function saveRootClosureOrKeepPlan(
  args: RootCascade,
  settled: Exclude<DependencyCascadeResult | CascadePlan, CascadeFailureArm>,
  run: LockedRootRun,
): Promise<SettleCascadeRun | CascadePlan> {
  if (settled.kind === "planned") {
    carryUnsavedAdds(run.adds.addedMarketplaces, run.tx.state, args.carried);
    return settled;
  }

  return saveRootClosure(args, settled, run);
}

/**
 * UPD-DEP-D1: the steps of one operation's plan: a closure slice lands in
 * one locked cascade that walks nothing, and a move is one update at the
 * version the plan chose.
 */
function dependencyStepPorts(
  cascade: RootCascade,
  context: DependencyMoveContext,
): DependencyStepPorts {
  return {
    materialize: (members) =>
      lockedRootCascade(
        cascade,
        (options) =>
          runDependencyCascade({ ...options, planned: { members, alreadyInstalled: [] } }),
        (settled, run) => saveRootClosure(cascade, settled, run),
      ),
    move: (move) => runDependencyMove(move, context),
    refusal: dependencyRefusal({ rootKey: cascade.root.key, scope: cascade.target.scope }),
  };
}

/** The plan of an install, or the failure its catch site renders. */
type InstallPlanResult =
  | Extract<DependencyPlan, { readonly ok: true }>
  | { readonly err: unknown; readonly cascadeFailure: CascadeFailureSink };

/**
 * UPD-DEP-D1: an install whose dependency graph moves recorded dependencies.
 * With the lock released, the plan previews the plugin the user named, then
 * settles the version of every plugin of the graph (`dependency-plan.ts`); a
 * refusal changes nothing. The plan's steps then run, and the install runs
 * again over exactly the closure the plan left for it. Whatever happens, the
 * clones the operation left unreferenced are removed, and clones that were
 * there before stay.
 */
async function installAfterMoves(
  ledger: InstallPlanningLedgerPorts,
  args: {
    readonly owners: InstallPlanningOwners;
    readonly opts: InstallPluginOptions;
    readonly carried: CarriedAdd[];
    readonly installAgain: (
      opts: InstallPluginOptions,
      afterPlan: InstallAfterPlan,
    ) => Promise<InstallPluginOutcome>;
  },
): Promise<InstallPluginOutcome> {
  const { owners, opts, carried } = args;
  const orchestrated = opts.notifications?.mode === "orchestrated";
  const target = {
    scope: opts.scope,
    cwd: opts.cwd,
    locations: locationsFor(opts.scope, opts.cwd),
  };
  const root: PlanRoot = {
    key: `${opts.plugin}@${opts.marketplace}`,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
  };
  // CR-A / MISS-01: only `apply` installs a moved dependency's new
  // dependencies through a later step of its own.
  const defers = opts.dependencyInstallsFollow === true;
  const memos = freshDependencyMoveMemos();
  const context = dependencyMoveContext({
    owners,
    target,
    caller: opts,
    policy: defers ? RECONCILE_MOVE_MATERIALIZATION : INSTALL_MOVE_MATERIALIZATION,
    memos,
  });
  const cascade: RootCascade = {
    ledger,
    owners,
    target,
    caller: opts,
    root,
    memos,
    carried,
    writesConfig: !orchestrated,
  };
  const failure = {
    ctx: opts.ctx,
    run: opts.run,
    marketplace: opts.marketplace,
    scope: opts.scope,
    plugin: opts.plugin,
    rootKey: root.key,
    capture: { rollbackPartials: [], version: undefined },
    orchestrated,
  };
  const sweep = await planCloneSweep(target.locations);
  try {
    const plan = await planInstallMoves({ ledger, owners, opts, target, root, context, defers });
    if ("err" in plan) {
      return ledger.handleCaughtInstallFailure({ ...failure, ...plan });
    }

    const resolvedMembers = resolvedPlanMemberKeys(plan);
    const ran = await runDependencySteps(plan.steps, dependencyStepPorts(cascade, context));
    if (!ran.ok) {
      const reported = new Set([root.key, ...ran.landed.map((entry) => entry.key)]);
      return failedMoveOutcome(ledger, {
        opts,
        moved: ran.landed,
        cause: ran.cause,
        orchestrated,
        unmaterialized: resolvedMembers.filter((key) => !reported.has(key)),
      });
    }

    return await args.installAgain(opts, { moved: ran.landed, carried, planned: plan.final });
  } finally {
    await sweep();
    await discardCarriedAdds(carried, target.locations);
  }
}

/** Member keys a dependency plan resolved, in its execution order. */
function resolvedPlanMemberKeys(
  plan: Extract<DependencyPlan, { readonly ok: true }>,
): readonly string[] {
  return [
    ...plan.steps.flatMap((step) =>
      step.kind === "move"
        ? [step.move.request.key]
        : step.members.map((entry) => entry.member.key),
    ),
    ...plan.final.members.map((entry) => entry.member.key),
  ];
}

/**
 * The plan of an install: the plugin the user named first, then the whole
 * graph. D-PL4-01: the plugin the user named installs the commit its preview
 * resolved. CR-N2: anything the plan throws -- an unreadable catalog only a
 * moved dependency's new version reaches, say -- is the install's failure,
 * rendered at the catch site like the first run's.
 */
async function planInstallMoves(args: {
  readonly ledger: InstallPlanningLedgerPorts;
  readonly owners: InstallPlanningOwners;
  readonly opts: InstallPluginOptions;
  readonly target: DependencyTarget;
  readonly root: PlanRoot;
  readonly context: DependencyMoveContext;
  readonly defers: boolean;
}): Promise<InstallPlanResult> {
  const { ledger, owners, opts, target } = args;
  try {
    const rootCommit = await previewInstall(
      await loadState(target.locations.extensionRoot),
      target.locations,
      ledger.buildInstallLedgerOptions(opts, owners.env, {
        scope: target.scope,
        cwd: target.cwd,
        marketplace: opts.marketplace,
        plugin: opts.plugin,
        ...(opts.pinVersionOverride !== undefined && { pinVersion: opts.pinVersionOverride }),
        marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
        addedMarketplaces: [],
      }),
    );
    const ports = await planningPorts({ ...args, caller: opts });
    const plan = await planDependencyGraph(ports, {
      deferMoveDependencies: args.defers,
      ...(rootCommit !== undefined && { rootCommit }),
    });
    return plan.ok
      ? plan
      : {
          err: cascadeFailureCause(plan.subject, args.root.key),
          cascadeFailure: { subject: plan.subject, mcpConfigNotices: [] },
        };
  } catch (err) {
    return { err, cascadeFailure: { mcpConfigNotices: [] } };
  }
}

/**
 * UPD-DEP-D1: an install whose plan failed while it ran fails: its row reads
 * `{dependency failed}` beside the rows of every change that landed and the
 * one that failed. The changes made before it stay, each complete.
 */
function failedMoveOutcome(
  ledger: InstallPlanningLedgerPorts,
  args: {
    readonly opts: InstallPluginOptions;
    readonly moved: readonly MovedDependency[];
    readonly cause: Error;
    readonly orchestrated: boolean;
    readonly unmaterialized: readonly string[];
  },
): InstallPluginOutcome {
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
            ...ledger.movedRows(args.moved),
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
    ...ledger.movedMember(args.moved),
  };
}

/**
 * UPD-DEP-D1: settles the dependency closure of `prepared`, the version an
 * update moves `args.plugin` to, through `dependency-settle.ts`'s order over
 * install's own cascade, plan and steps. WR-C: the swap's PI-6 name check
 * runs first, so a name conflict refuses the update before anything lands.
 */
async function settleUpdateDependencies(
  ledger: InstallPlanningLedgerPorts,
  input: {
    readonly owners: InstallPlanningOwners;
    readonly args: ThreePhaseArgs;
    readonly prepared: PreparedPluginUpdate;
    readonly notification: { readonly ctx: NotificationContext; readonly run: NotificationRun };
  },
): Promise<UpdateDependencySettlement> {
  const { owners, args, prepared } = input;
  await assertUpdateNamesFree(args, prepared);
  const target = { scope: args.scope, cwd: args.cwd, locations: args.locations };
  const root: PlanRoot = {
    key: `${args.plugin}@${args.marketplace}`,
    marketplace: args.marketplace,
    plugin: args.plugin,
    prepared,
  };
  const caller = updateCaller(args, input.notification);
  const memos = tagMemosOf(args, freshDependencyMoveMemos());
  const carried: CarriedAdd[] = [];
  const context = dependencyMoveContext({
    owners,
    target,
    caller,
    policy: UPDATE_MATERIALIZATION,
    memos,
  });
  const cascade: RootCascade = {
    ledger,
    owners,
    target,
    caller,
    root,
    memos,
    carried,
    writesConfig: true,
  };
  try {
    return await settleDependencies({
      firstRun: () =>
        lockedRootCascade(cascade, runDependencyCascadeOrPlanMoves, (settled, run) =>
          saveRootClosureOrKeepPlan(cascade, settled, run),
        ),
      plan: async () =>
        planDependencyGraph(
          await planningPorts({ ledger, owners, target, caller, context, root }),
          {
            deferMoveDependencies: false,
          },
        ),
      steps: dependencyStepPorts(cascade, context),
      planSweep: () => planCloneSweep(target.locations),
    });
  } finally {
    await discardCarriedAdds(carried, target.locations);
  }
}

/**
 * Binds the update dependency cascade to one install transaction owner, as
 * `createInstallMissingDependency` binds its own.
 */
export interface InstallPlanningComposition extends InstallPlanning {
  readonly createUpdateDependencyResolver: (
    transaction: InstallTransaction,
    hooksRouting: InstallHooksRouting,
    completionCache: CompletionCache,
    env?: ClaudeEnv,
  ) => UpdateDependencyResolver;
}

/** Binds dependency planning to the ledger port supplied by the root. */
export function createInstallPlanning(
  ledger: InstallPlanningLedgerPorts,
): InstallPlanningComposition {
  return {
    routeInstallCascade,
    installAfterMoves: (args) => installAfterMoves(ledger, args),
    createUpdateDependencyResolver:
      (transaction, hooksRouting, completionCache, env = process.env) =>
      (args, prepared, notification) =>
        settleUpdateDependencies(ledger, {
          owners: { transaction, hooksRouting, completionCache, env },
          args,
          prepared,
          notification,
        }),
  };
}
