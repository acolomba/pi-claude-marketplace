// D-PL8-01 / D-PL8-06: one background autoupdate pass. It runs
// `marketplace update <name>` for each recorded marketplace whose merged config
// turns autoupdate on, project scope first (MSG-GR-3). It is a separate run,
// not a load, so a load still changes no installation state (APL-D1).
//
// D-PL8-06 / D-PL8-12: the pass reports through a print-mode context whose
// text goes to the debug log, and through a load-origin run whose entry sink
// drops entries. Nothing reaches the session, and a load origin gives git
// access stored credentials only, with no Device Flow.
//
// D-PL8-04: each marketplace refresh and each plugin update is one gate step,
// so a `/claude:plugin` command waits for at most one of them.
//
// AUP-03 / D-PL8-10 / D-PL8-15: after the last marketplace, a pass that
// updated at least one plugin raises one `background-update` notice through the
// real context and a load-origin run, unless the runtime stopped. Up-to-date,
// skipped, and failed plugins stay in the debug log.
//
// D-PL8-05: a scope lock that another Pi process holds needs no code here.
// `updateMarketplace` turns a refresh lock miss into a failed row, and the
// cascade turns a plugin lock miss into a failed outcome. Both stay silent,
// and this runtime does not retry them.

import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { notifyBackgroundUpdate } from "../../shared/notification-dispatch.ts";
import { openNotificationRun, openNotificationSnapshot } from "../../shared/notification-run.ts";
import { ownValue } from "../../shared/own-key.ts";

import type { BackgroundGate } from "./background-gate.ts";
import type { UpdateMarketplaceOptions } from "./update.ts";
import type { NotificationContext, PiInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationEntrySink, NotificationRun } from "../../shared/notification-run.ts";
import type { BackgroundUpdatePlugin } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateFailedOutcome, PluginUpdateFn } from "../types.ts";

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
}

const SCOPES: readonly Scope[] = ["project", "user"];

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

const NOT_RUN_NOTE = "the session ended before this update ran";

interface PassStep {
  readonly deps: BackgroundPassDeps;
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly isStopped: () => boolean;
  readonly pluginUpdate: PluginUpdateFn;
}

/** D-PL8-07: a marketplace with no config value stays off. */
async function autoupdateMarketplaces(scope: Scope, cwd: string): Promise<readonly string[]> {
  try {
    const locations = locationsFor(scope, cwd);
    const state = await loadState(locations.extensionRoot, { persistMigration: false });
    const { merged } = await loadMergedScopeConfig(locations);
    return Object.keys(state.marketplaces).filter(
      (name) => ownValue(merged.marketplaces, name)?.entry.autoupdate === true,
    );
  } catch (err: unknown) {
    hookDebugLog(`background update skipped the ${scope} scope: ${errorMessage(err)}`, DEBUG_TAG);
    return [];
  }
}

/** Updates one marketplace; false when the runtime stopped before it began. */
async function updateOneMarketplace(step: PassStep, name: string, scope: Scope): Promise<boolean> {
  const { deps } = step;
  await deps.gate.beginStep();
  try {
    if (step.isStopped()) {
      return false;
    }

    await deps.updateMarketplace({
      completionCache: deps.completionCache,
      ctx: SILENT_CONTEXT,
      run: step.run,
      name,
      scope,
      cwd: step.cwd,
      pluginUpdate: step.pluginUpdate,
    });
  } catch (err: unknown) {
    // D-PL8-06: an invalid GitHub base override ends the pass.
    rethrowInvalidGitHubBaseUrl(err);
    hookDebugLog(`background update of ${name} [${scope}] failed: ${errorMessage(err)}`, DEBUG_TAG);
  } finally {
    deps.gate.endStep();
  }

  return true;
}

/**
 * D-PL8-04 / D-PL8-15: ends the step in flight, waits for the commands that
 * arrived, and runs the plugin update as a new step. After a shutdown it
 * returns a failed outcome with no reason instead, because a throw would get a
 * reason from the cascade's classifier. Each `updated` outcome adds a row to
 * `updated`, in update order (D-PL8-10).
 */
function yieldingPluginUpdate(
  gate: BackgroundGate,
  isStopped: () => boolean,
  updatePlugin: PluginUpdateFn,
  updated: BackgroundUpdatePlugin[],
): PluginUpdateFn {
  return async (plugin, marketplace, scope) => {
    gate.endStep();
    await gate.beginStep();
    if (isStopped()) {
      return {
        partition: "failed",
        name: plugin,
        notes: [NOT_RUN_NOTE],
        reasons: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      } satisfies PluginUpdateFailedOutcome;
    }

    const outcome = await updatePlugin(plugin, marketplace, scope);
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
    const step: PassStep = {
      deps,
      run,
      cwd,
      isStopped,
      pluginUpdate: yieldingPluginUpdate(deps.gate, isStopped, updatePlugin, updated),
    };
    for (const scope of SCOPES) {
      // eslint-disable-next-line no-await-in-loop -- MSG-GR-3: the project scope runs before the user scope.
      const names = await autoupdateMarketplaces(scope, cwd);
      for (const name of names) {
        // eslint-disable-next-line no-await-in-loop -- each update locks its scope and yields to commands one step at a time.
        if (!(await updateOneMarketplace(step, name, scope))) {
          return;
        }
      }
    }

    // D-PL8-15: a stopped runtime's `pi` is stale, so the run opens after the check.
    if (updated.length === 0 || isStopped()) {
      return;
    }

    notifyBackgroundUpdate(ctx, openNotificationRun(deps.pi, { kind: "load" }), updated);
  };
}
