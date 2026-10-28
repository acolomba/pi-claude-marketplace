// orchestrators/plugin/install-flow-planning.ts
//
// Dependency preview, move planning, and update-settlement leaf.

import { locationsFor } from "../../persistence/locations.ts";

import { discardCarriedAdds } from "./carried-marketplace-adds.ts";
import {
  INSTALL_MOVE_MATERIALIZATION,
  RECONCILE_MOVE_MATERIALIZATION,
  dependencyMoveContext,
  dependencyRefusal,
  planCloneSweep,
  tagMemosOf,
  updateCaller,
} from "./dependency-bindings.ts";
import { freshDependencyMoveMemos, runDependencyMove } from "./dependency-move.ts";
import { planDependencyGraph } from "./dependency-plan.ts";
import { runDependencySteps, settleDependencies } from "./dependency-settle.ts";
import { cascadeFailureCause } from "./install-cascade.messaging.ts";
import { UPDATE_MATERIALIZATION } from "./update-preflight.ts";
import { assertUpdateNamesFree } from "./update-swap.ts";

import type { CarriedAdd } from "./carried-marketplace-adds.ts";
import type { DependencyCaller, DependencyTarget } from "./dependency-bindings.ts";
import type { DependencyMoveContext, DependencyMoveMemos } from "./dependency-move.ts";
import type { DependencyPlan, DependencyPlanPorts } from "./dependency-plan.ts";
import type { DependencyStepPorts, SettleCascadeRun } from "./dependency-settle.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type { CascadePlan, PlannedCascadeMember, RootCascadeResult } from "./install-cascade.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  InstallAfterPlan,
  InstallFileCapabilities,
  InstallPlanning,
  InstallPlanningOwners,
  InstallPluginOptions,
  InstallTransaction,
} from "./install-flow-ledger.ts";
import type { InstallFailureCapture } from "./install-outcome.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";
import type {
  ThreePhaseArgs,
  UpdateDependencyResolver,
  UpdateDependencySettlement,
} from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
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

/** The plugin a dependency plan is rooted at, and how its declarations are read. */
interface PlanRoot {
  readonly key: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** An update's candidate, whose tree the root's declarations are read from (CR-04). */
  readonly prepared?: PreparedPluginUpdate;
}

/** What one locked run of a cascade rooted at the operation's plugin reads. */
interface RootCascade {
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

/** The failure details that the ledger projects without exposing its helpers. */
interface PlanningFailureSink {
  readonly subject?: CascadeFailureSubject;
  readonly mcpConfigNotices: readonly McpConfigNotice[];
}

/** The five purpose-specific ledger capabilities dependency planning consumes. */
interface InstallPlanningLedgerPort {
  readonly preparePlan: (args: {
    readonly owners: InstallPlanningOwners;
    readonly target: DependencyTarget;
    readonly caller: DependencyCaller;
    readonly context: DependencyMoveContext;
    readonly root: PlanRoot;
  }) => Promise<DependencyPlanPorts>;
  readonly previewRoot: (args: {
    readonly owners: InstallPlanningOwners;
    readonly opts: InstallPluginOptions;
    readonly target: DependencyTarget;
  }) => Promise<string | undefined>;
  readonly runCascade: {
    (args: RootCascade & { readonly kind: "initial" }): Promise<SettleCascadeRun | CascadePlan>;
    (
      args: RootCascade & {
        readonly kind: "materialize";
        readonly members: readonly PlannedCascadeMember[];
      },
    ): Promise<SettleCascadeRun>;
  };
  readonly projectCaughtFailure: (args: {
    readonly err: unknown;
    readonly ctx: InstallPluginOptions["ctx"];
    readonly run: InstallPluginOptions["run"];
    readonly marketplace: string;
    readonly scope: InstallPluginOptions["scope"];
    readonly plugin: string;
    readonly rootKey: string;
    readonly capture: InstallFailureCapture;
    readonly cascadeFailure: PlanningFailureSink;
    readonly orchestrated: boolean;
    readonly moved?: readonly MovedDependency[];
  }) => InstallPluginOutcome;
  readonly projectFailedMoves: (args: {
    readonly opts: InstallPluginOptions;
    readonly mcpConfigNotices: readonly McpConfigNotice[];
    readonly moved: readonly MovedDependency[];
    readonly cause: Error;
    readonly orchestrated: boolean;
    readonly unmaterialized: readonly string[];
  }) => InstallPluginOutcome;
}

/**
 * UPD-DEP-D1: the steps of one operation's plan: a closure slice lands in
 * one locked cascade that walks nothing, and a move is one update at the
 * version the plan chose.
 */
function dependencyStepPorts(
  ledger: InstallPlanningLedgerPort,
  cascade: RootCascade,
  context: DependencyMoveContext,
): DependencyStepPorts {
  return {
    materialize: (members) => ledger.runCascade({ ...cascade, kind: "materialize", members }),
    move: (move) => runDependencyMove(move, context),
    refusal: dependencyRefusal({ rootKey: cascade.root.key, scope: cascade.target.scope }),
  };
}

/** The plan of an install, or the failure its catch site renders. */
type InstallPlanResult =
  | Extract<DependencyPlan, { readonly ok: true }>
  | { readonly err: unknown; readonly cascadeFailure: PlanningFailureSink };

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
  ledger: InstallPlanningLedgerPort,
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
      return ledger.projectCaughtFailure({ ...failure, ...plan });
    }

    const resolvedMembers = resolvedPlanMemberKeys(plan);
    const ran = await runDependencySteps(plan.steps, dependencyStepPorts(ledger, cascade, context));
    if (!ran.ok) {
      const reported = new Set([root.key, ...ran.landed.map((entry) => entry.key)]);
      return ledger.projectFailedMoves({
        opts,
        mcpConfigNotices: ran.mcpConfigNotices ?? [],
        moved: ran.landed,
        cause: ran.cause,
        orchestrated,
        unmaterialized: resolvedMembers.filter((key) => !reported.has(key)),
      });
    }

    return await args.installAgain(opts, {
      moved: ran.landed,
      carried,
      planned: plan.final,
      mcpConfigNotices: ran.mcpConfigNotices ?? [],
    });
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
  readonly ledger: InstallPlanningLedgerPort;
  readonly owners: InstallPlanningOwners;
  readonly opts: InstallPluginOptions;
  readonly target: DependencyTarget;
  readonly root: PlanRoot;
  readonly context: DependencyMoveContext;
  readonly defers: boolean;
}): Promise<InstallPlanResult> {
  const { ledger, owners, opts, target } = args;
  try {
    const rootCommit = await ledger.previewRoot({ owners, opts, target });
    const ports = await ledger.preparePlan({ ...args, caller: opts });
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
 * UPD-DEP-D1: settles the dependency closure of `prepared`, the version an
 * update moves `args.plugin` to, through `dependency-settle.ts`'s order over
 * install's own cascade, plan and steps. WR-C: the swap's PI-6 name check
 * runs first, so a name conflict refuses the update before anything lands.
 */
async function settleUpdateDependencies(
  ledger: InstallPlanningLedgerPort,
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
      firstRun: () => ledger.runCascade({ ...cascade, kind: "initial" }),
      plan: async () =>
        planDependencyGraph(await ledger.preparePlan({ owners, target, caller, context, root }), {
          deferMoveDependencies: false,
        }),
      steps: dependencyStepPorts(ledger, cascade, context),
      planSweep: () => planCloneSweep(target.locations),
    });
  } finally {
    await discardCarriedAdds(carried, target.locations);
  }
}

/** The planning operations the public root binds to transaction owners. */
interface InstallPlanningComposition extends InstallPlanning {
  readonly createUpdateDependencyResolver: (
    transaction: InstallTransaction,
    hooksRouting: InstallHooksRouting,
    completionCache: CompletionCache,
    env: ClaudeEnv,
  ) => UpdateDependencyResolver;
}

/** Binds dependency planning to the ledger port supplied by the root. */
export function createInstallPlanning(
  // fallow-ignore-next-line private-type-leak -- The root supplies this file's consumer-owned structural port.
  ledger: InstallPlanningLedgerPort,
  fileCapabilities: InstallFileCapabilities,
  // fallow-ignore-next-line private-type-leak -- Callers infer this private composition instead of exporting a test-only type.
): InstallPlanningComposition {
  return {
    routeInstallCascade,
    installAfterMoves: (args) => installAfterMoves(ledger, args),
    createUpdateDependencyResolver:
      (
        transaction: InstallTransaction,
        hooksRouting: InstallHooksRouting,
        completionCache: CompletionCache,
        env: ClaudeEnv,
      ): UpdateDependencyResolver =>
      (args, prepared, notification) =>
        settleUpdateDependencies(ledger, {
          owners: { transaction, hooksRouting, completionCache, env, fileCapabilities },
          args,
          prepared,
          notification,
        }),
  };
}
