// D-PL8-01 / D-PL8-06: one background autoupdate pass. It runs
// `marketplace update <name>` for each user-scope marketplace whose merged
// config turns autoupdate on. It is a separate run, not a load, so a load
// still changes no installation state (APL-D1).
//
// D-CF2-15: the pass never changes the project scope, as a load with
// autoapply on never applies it (D-CF2-14). The project's config and
// `state.json` sit in the repository, so a cloned repository could otherwise
// move its own plugins to a version it chose, and record their skills,
// commands, and hooks as this user's installs (D-CF2-13), with no command
// typed. Claude Code acts on a repository's plugin settings only after its
// trust dialog. `/claude:plugin update` and `marketplace update`, which the
// user types, still update the project scope.
//
// D-PL8-06 / D-PL8-12: the pass reports through a print-mode context whose
// text goes to the debug log, and through a load-origin run whose entry sink
// drops entries. Nothing reaches the session, and a load origin gives git
// access stored credentials only, with no Device Flow.
//
// D-PL8-04: each marketplace refresh, plugin update, and dependency settlement
// is one gate step, so a `/claude:plugin` command waits for at most one of them. A command can
// run between two plugin updates, so each plugin update first reads the merged
// config again and skips the plugin once autoupdate is off (D-PL8-01).
//
// AUP-03 / D-PL8-10 / D-PL8-15: after the last marketplace, a pass that
// updated at least one plugin raises one `background-update` notice through the
// real context and a load-origin run, unless the runtime stopped. Up-to-date,
// skipped, and failed plugins stay in the debug log. A pass that an invalid
// GitHub base override ends early (D-PL8-06) still reports the plugins that
// moved before it; it is silent only when none did.
//
// D-PL8-25: each step runs inside its gate signal's git abort scope. When the
// gate aborts a step at the wait cap (D-PL8-23), the pass runs no further step
// in this runtime: the plugins it has not reached get a skipped outcome, and
// the notice still names the plugins that moved before the abort.
//
// D-PL8-05: a scope lock that another Pi process holds needs no code here.
// `updateMarketplace` turns a refresh lock miss into a failed row, and the
// cascade turns a plugin lock miss into a failed outcome. Both stay silent,
// and this runtime does not retry them.

import { effectiveMarketplaceAutoupdate } from "../../domain/official-marketplaces.ts";
import { hasInvalidConfigLayer, loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { notifyBackgroundUpdate } from "../../shared/notification-dispatch.ts";
import { openNotificationRun, openNotificationSnapshot } from "../../shared/notification-run.ts";
import { ownValue } from "../../shared/own-key.ts";

import type { BackgroundGate } from "./background-gate.ts";
import type { UpdateMarketplaceOptions } from "./update.ts";
import type { ScopeLoadOutcome } from "../../persistence/config-merge.ts";
import type { NotificationContext, PiInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationEntrySink, NotificationRun } from "../../shared/notification-run.ts";
import type { BackgroundUpdatePlugin } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
  ScopeDependencyInstallFn,
} from "../types.ts";

/** The `input` event's context; Pi's extension context satisfies it. */
export interface BackgroundContext extends NotificationContext {
  readonly cwd: string;
}

/** One start of the pass. `isStopped` turns true when the runtime shuts down. */
export interface BackgroundPassRun {
  readonly ctx: BackgroundContext;
  readonly isStopped: () => boolean;
}

export type BackgroundPass = (run: BackgroundPassRun) => Promise<void>;

export interface BackgroundPassDeps {
  readonly pi: PiInventory & NotificationEntrySink;
  readonly gate: BackgroundGate;
  readonly completionCache: CompletionCache;
  /** The same shape as the edge's `beginPluginUpdateRun`; `orchestrators/` may not import `edge/`. */
  readonly beginPluginUpdateRun: (notification: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
  }) => PluginUpdateFn;
  readonly updateMarketplace: (opts: UpdateMarketplaceOptions) => Promise<void>;
  /**
   * D-PL2-10: the missing-dependency step each marketplace's autoupdate cascade
   * runs after its plugin updates, as Claude Code settles missing dependencies
   * after a background autoupdate.
   */
  readonly installMissingDependencies: ScopeDependencyInstallFn;
  /**
   * D-PL8-24: the git abort scope. Every git network call that `step` makes
   * fails with the abort reason once `signal` aborts. The pass names no git
   * module itself, so it stays outside the network seams.
   */
  readonly runWithAbortSignal: <T>(signal: AbortSignal, step: () => Promise<T>) => Promise<T>;
}

/** D-CF2-15: the one scope a background pass reads and changes. */
const PASS_SCOPE: Scope = "user";

const DEBUG_TAG = "autoupdate";

const SILENT_CONTEXT: NotificationContext = {
  mode: "print",
  ui: {
    notify: (message) => {
      hookDebugLog(message, DEBUG_TAG);
    },
  },
};

const SILENT_SINK: NotificationEntrySink = {
  appendEntry: () => undefined,
};

const NOT_RUN_NOTE = "the background update stopped before this update ran";

const AUTOUPDATE_OFF_NOTE = "autoupdate was turned off before this update ran";

const ABORTED_NOTE = "the update ran past the background wait cap and was stopped";

/** D-PL8-25: whether the pass may run another step. */
interface PassHalt {
  /** True once the runtime stopped or a step was aborted. */
  readonly isHalted: () => boolean;
  /** True once the runtime stopped. */
  readonly isStopped: () => boolean;
  /** Notes a step that ended; an aborted one halts the pass. Returns whether it was aborted. */
  readonly noteStepEnded: (signal: AbortSignal) => boolean;
}

function createPassHalt(isStopped: () => boolean): PassHalt {
  let aborted = false;
  return {
    isHalted: () => aborted || isStopped(),
    isStopped,
    noteStepEnded: (signal) => {
      if (signal.aborted) {
        aborted = true;
      }

      return signal.aborted;
    },
  };
}

interface PassStep {
  readonly deps: BackgroundPassDeps;
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly halt: PassHalt;
  readonly pluginUpdate: PluginUpdateFn;
}

/**
 * D-PL8-07: a marketplace with no config value gets the default for its name.
 * An invalid config layer turns autoupdate off for the scope (fail closed).
 */
function isAutoupdateOn(outcome: ScopeLoadOutcome, name: string): boolean {
  return (
    !hasInvalidConfigLayer(outcome) &&
    effectiveMarketplaceAutoupdate(
      name,
      ownValue(outcome.merged.marketplaces, name)?.entry.autoupdate,
    )
  );
}

async function autoupdateMarketplaces(scope: Scope, cwd: string): Promise<readonly string[]> {
  try {
    const locations = locationsFor(scope, cwd);
    const state = await loadState(locations.extensionRoot, { persistMigration: false });
    const outcome = await loadMergedScopeConfig(locations);
    return Object.keys(state.marketplaces).filter((name) => isAutoupdateOn(outcome, name));
  } catch (err: unknown) {
    hookDebugLog(`background update skipped the ${scope} scope: ${errorMessage(err)}`, DEBUG_TAG);
    return [];
  }
}

/**
 * Updates one marketplace; false when the pass was halted before it began, or
 * when the gate aborted its refresh (D-PL8-25).
 */
async function updateOneMarketplace(step: PassStep, name: string, scope: Scope): Promise<boolean> {
  const { deps } = step;
  const signal = await deps.gate.beginStep();
  try {
    if (step.halt.isHalted()) {
      return false;
    }

    await deps.runWithAbortSignal(signal, () =>
      deps.updateMarketplace({
        completionCache: deps.completionCache,
        ctx: SILENT_CONTEXT,
        run: step.run,
        name,
        scope,
        cwd: step.cwd,
        pluginUpdate: step.pluginUpdate,
        installMissingDependencies: yieldingDependencyInstall(step, name),
      }),
    );
  } catch (err: unknown) {
    // D-PL8-06: an invalid GitHub base override ends the pass.
    rethrowInvalidGitHubBaseUrl(err);
    hookDebugLog(`background update of ${name} [${scope}] failed: ${errorMessage(err)}`, DEBUG_TAG);
  } finally {
    deps.gate.endStep();
  }

  if (step.halt.noteStepEnded(signal)) {
    hookDebugLog(`background update of ${name} [${scope}] was stopped at the wait cap`, DEBUG_TAG);
    return false;
  }

  return true;
}

/** Keeps dependency settlement inside the current pass's gate and abort scope. */
function yieldingDependencyInstall(step: PassStep, marketplace: string): ScopeDependencyInstallFn {
  return async (request) => {
    const { deps, halt } = step;
    if (halt.isHalted()) {
      return { rows: [], mcpConfigNotices: [] };
    }

    deps.gate.endStep();
    const signal = await deps.gate.beginStep();
    try {
      const config = await loadMergedScopeConfig(locationsFor(request.scope, step.cwd));
      if (halt.isHalted() || signal.aborted || !isAutoupdateOn(config, marketplace)) {
        return { rows: [], mcpConfigNotices: [] };
      }

      return await deps.runWithAbortSignal(signal, () => deps.installMissingDependencies(request));
    } finally {
      halt.noteStepEnded(signal);
      // The marketplace still owns the step until its cascade and reporting settle.
    }
  };
}

interface YieldingPluginUpdateArgs {
  readonly gate: BackgroundGate;
  readonly cwd: string;
  readonly halt: PassHalt;
  readonly updatePlugin: PluginUpdateFn;
  readonly runWithAbortSignal: BackgroundPassDeps["runWithAbortSignal"];
  readonly updated: BackgroundUpdatePlugin[];
}

/**
 * D-PL8-22: a skipped outcome with no reason, for a plugin update the pass did
 * not run because the runtime stopped or a step was aborted, or did not finish
 * because the gate aborted it (D-PL8-25). It is returned, not thrown, because a
 * throw would get a reason from the cascade's classifier.
 */
function skippedOutcome(plugin: string, note: string): PluginUpdateSkippedOutcome {
  return {
    partition: "skipped",
    name: plugin,
    notes: [note],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/**
 * D-PL8-18: a failed outcome with no reason, for a plugin update the pass did
 * not run because a command turned the marketplace's autoupdate off.
 */
function autoupdateOffOutcome(plugin: string): PluginUpdateFailedOutcome {
  return {
    partition: "failed",
    name: plugin,
    notes: [AUTOUPDATE_OFF_NOTE],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
}

/**
 * D-PL8-25: runs one plugin update in its step's abort scope. An update the
 * gate aborted that threw or failed did not finish, so it is skipped; one that
 * finished keeps its outcome. A throw outside an abort passes through.
 */
async function runPluginStep(
  args: YieldingPluginUpdateArgs,
  signal: AbortSignal,
  target: readonly [plugin: string, marketplace: string, scope: Scope],
): Promise<PluginUpdateOutcome> {
  const [plugin, marketplace, scope] = target;
  try {
    const outcome = await args.runWithAbortSignal(signal, () =>
      args.updatePlugin(plugin, marketplace, scope),
    );
    return signal.aborted && outcome.partition === "failed"
      ? skippedOutcome(plugin, ABORTED_NOTE)
      : outcome;
  } catch (err: unknown) {
    if (!signal.aborted) {
      throw err;
    }

    return skippedOutcome(plugin, ABORTED_NOTE);
  }
}

/**
 * D-PL8-04 / D-PL8-15: ends the step in flight, waits for the commands that
 * arrived, and runs the plugin update as a new step. It does not run the
 * update once the pass is halted, or when a command that ran meanwhile turned
 * the marketplace's autoupdate off (D-PL8-01). Each `updated` outcome adds a
 * row to `updated`, in update order (D-PL8-10).
 */
function yieldingPluginUpdate(args: YieldingPluginUpdateArgs): PluginUpdateFn {
  const { gate, cwd, halt, updated } = args;
  return async (plugin, marketplace, scope) => {
    // A stopped runtime keeps its step, so a shutdown waiter wakes only after
    // the marketplace step ends.
    if (halt.isStopped()) {
      return skippedOutcome(plugin, NOT_RUN_NOTE);
    }

    gate.endStep();
    const signal = await gate.beginStep();
    if (halt.isHalted()) {
      return skippedOutcome(plugin, NOT_RUN_NOTE);
    }

    const config = await loadMergedScopeConfig(locationsFor(scope, cwd));
    if (halt.isStopped()) {
      return skippedOutcome(plugin, NOT_RUN_NOTE);
    }

    if (signal.aborted) {
      halt.noteStepEnded(signal);
      return skippedOutcome(plugin, ABORTED_NOTE);
    }

    if (!isAutoupdateOn(config, marketplace)) {
      return autoupdateOffOutcome(plugin);
    }

    const outcome = await runPluginStep(args, signal, [plugin, marketplace, scope]);
    halt.noteStepEnded(signal);
    if (outcome.partition === "updated") {
      updated.push({
        name: outcome.name,
        marketplace,
        scope,
        fromVersion: outcome.fromVersion,
        toVersion: outcome.toVersion,
      });
    }

    return outcome;
  };
}

/** Updates the user scope's autoupdate marketplaces; returns early once the pass is halted. */
async function updateUserScope(step: PassStep): Promise<void> {
  // D-PL8-15 / D-PL8-25: a halted pass reads nothing.
  if (step.halt.isHalted()) {
    return;
  }

  const names = await autoupdateMarketplaces(PASS_SCOPE, step.cwd);
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop -- each update locks its scope and yields to commands one step at a time.
    if (!(await updateOneMarketplace(step, name, PASS_SCOPE))) {
      return;
    }
  }
}

/** Creates the pass; constructing it reads nothing. */
export function createBackgroundPass(deps: BackgroundPassDeps): BackgroundPass {
  return async ({ ctx, isStopped }) => {
    const cwd = ctx.cwd;
    const run: NotificationRun = {
      ...openNotificationSnapshot(deps.pi),
      origin: { kind: "load" },
      entrySink: SILENT_SINK,
    };
    // D-10-18: one plugin update run, so one tag memo pair, per pass.
    const updatePlugin = deps.beginPluginUpdateRun({ ctx: SILENT_CONTEXT, run });
    const updated: BackgroundUpdatePlugin[] = [];
    const halt = createPassHalt(isStopped);
    const step: PassStep = {
      deps,
      run,
      cwd,
      halt,
      pluginUpdate: yieldingPluginUpdate({
        gate: deps.gate,
        cwd,
        halt,
        updatePlugin,
        runWithAbortSignal: deps.runWithAbortSignal,
        updated,
      }),
    };
    // D-PL8-15: a stopped runtime's `pi` is stale, so the run opens after the check.
    const notifyUpdated = (): void => {
      if (updated.length > 0 && !isStopped()) {
        notifyBackgroundUpdate(ctx, openNotificationRun(deps.pi, { kind: "load" }), updated);
      }
    };

    try {
      await updateUserScope(step);
    } catch (err: unknown) {
      // The pass's own error stays the one that propagates.
      try {
        notifyUpdated();
      } catch (notifyErr: unknown) {
        hookDebugLog(`background update notice failed: ${errorMessage(notifyErr)}`, DEBUG_TAG);
      }

      throw err;
    }

    notifyUpdated();
  };
}
