import { homedir } from "node:os";

import {
  createHooksHydration,
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "./bridges/hooks/index.ts";
import { registerClaudeMarketplaceTools, registerClaudePluginCommand } from "./edge/register.ts";
import { registerSkillAliases } from "./edge/skill-aliases.ts";
import { aggregateDiscoveredResources } from "./orchestrators/discover.ts";
import { createBackgroundGate } from "./orchestrators/marketplace/background-gate.ts";
import { createBackgroundPass } from "./orchestrators/marketplace/background-pass.ts";
import { createBackgroundUpdate } from "./orchestrators/marketplace/background-update.ts";
import { DEFAULT_GIT_OPS } from "./orchestrators/marketplace/shared.ts";
import { updateMarketplace } from "./orchestrators/marketplace/update.ts";
import { createUpdateOperations } from "./orchestrators/plugin/operations.ts";
import { recomputePluginPath } from "./orchestrators/plugin-path.ts";
import { createApplyReconcile } from "./orchestrators/reconcile/apply.ts";
import { createLoadReconcile } from "./orchestrators/reconcile/load.ts";
import { locationsFor } from "./persistence/locations.ts";
import { loadState } from "./persistence/state-io.ts";
import { createMcpStatusTracker } from "./platform/mcp-status.ts";
import { createCompletionCache } from "./shared/completion-cache.ts";
import { hookDebugLog } from "./shared/debug-log.ts";
import { errorMessage } from "./shared/errors.ts";
import { notifyPluginPathSkipped, notifyReconcileAborted } from "./shared/notification-dispatch.ts";
import { openNotificationRun, requireNotificationMode } from "./shared/notification-run.ts";
import { applyMcpAdapterEnv, applySessionEnv } from "./shared/session-env.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
} from "./platform/pi-api.ts";

/**
 * AVAR-01 / AVAR-03: sets pi-mcp-adapter's variables from the given working
 * directory. A throw from `readCwd` is debug-logged and never escapes (NFR-2).
 */
function applyMcpAdapterEnvFrom(readCwd: () => string): void {
  try {
    if (!applyMcpAdapterEnv(readCwd)) {
      hookDebugLog(
        "CLAUDE_PROJECT_DIR removed: the working directory holds a pi-mcp-adapter variable marker or ends in the start of one",
        "env",
      );
    }
  } catch (err) {
    hookDebugLog(`MCP adapter env apply skipped: ${errorMessage(err)}`, "env");
  }
}

/**
 * Registers the extension's Pi hooks, tools, and slash command surface.
 */
// DISP-01: async factory; Pi's loader awaits this Promise (loader.d.ts
// `loadExtensionFromFactory(...): Promise<Extension>`), so the 11 pi.on
// registrations inside `registerHooksBridge` complete BEFORE the loader
// proceeds to emit any session-lifecycle event. The `void` fire-and-forget
// alternative would race against the first session_start because the loader
// does not see the un-awaited inner Promise.
//
// EXPORT-02: the only consumer of this default is the `pi.extensions` entry in
// package.json, which Pi's loader reads at runtime. That edge lives in a
// manifest, not in any import statement, so no static reachability analysis can
// follow it -- the export is genuinely unreferenced in the source graph and
// genuinely load-bearing. The one-line annotation below records exactly that,
// for exactly this declaration: a sibling named export added to this file is
// still reported, and an unrelated default elsewhere is still reported.
// fallow-ignore-next-line unused-export -- package.json `pi.extensions` loads this default.
export default async function claudeMarketplaceExtension(pi: ExtensionAPI): Promise<void> {
  // AVAR-03 / NFR-2: pi-mcp-adapter may load first and connect servers from its
  // own `session_start`, so the values must exist before this extension's
  // handlers run.
  applyMcpAdapterEnvFrom(() => process.cwd());
  const hooksRuntime = createHooksRuntime();
  const hooksRouting = createHooksRouting(hooksRuntime, { readHooksJson });
  const completionCache = createCompletionCache();
  // D-PL8-04: one gate per extension runtime. Every `/claude:plugin` command
  // runs through it, so it waits for the background autoupdate step in flight.
  const backgroundGate = createBackgroundGate();
  // ASTAT-01: one status tracker per extension load. Pi drops its subscription
  // when it invalidates this runtime, and the next load starts empty.
  const mcpStatus = createMcpStatusTracker(pi.events);
  const pluginUpdateOperations = createUpdateOperations(hooksRouting, completionCache);
  const hooksHydration = createHooksHydration(hooksRuntime, { loadState, readHooksJson });
  // RECON-01..05: one reconcile apply operation and one load reconcile step
  // per extension load, both bound to the production state reader.
  // `/claude:plugin apply` (APL-01) drives the apply operation; the
  // `resources_discover` handler below drives the load step, which changes no
  // installation state (APL-03 / D-02) unless the configs turn `autoapply` on,
  // when it runs the same apply operation before resource discovery (AAP-02).
  // Constructing them here keeps each binding at extension lifetime rather
  // than rebuilding it on every event.
  const applyReconcile = createApplyReconcile({ loadState });
  const loadReconcile = createLoadReconcile({ loadState }, applyReconcile);

  // DISP-01 / DISP-02 / D-59-02 / D-59-03: register the hooks bridge at
  // factory time. The bridge's signature requires a `cwd`, which does not
  // exist at extension-load time -- Pi's `resources_discover` event is the
  // first signal that delivers a project `cwd`. So:
  //
  //   1. Pass `homedir()` as cwd: this hydrates the USER scope correctly (the
  //      bridge derefs project cwd via `locationsFor("project", cwd)` and
  //      ignores it for user scope, which uses `getAgentDir()`).
  //   2. Defer project-scope hydrate to event time, where a real `cwd` exists.
  //      There are TWO deferral points, and the ORDER matters: the bridge's own
  //      `session_start` wrapper hydrates against `ctx.cwd` first (Pi emits
  //      `session_start` BEFORE `resources_discover`, so a project-scope
  //      SessionStart hook would otherwise dispatch against an empty bucket),
  //      then `hydrateProjectScopeForCwd(event.cwd)` BELOW re-runs it so the
  //      routing-table rebuild inside `loadReconcile` sees the correct
  //      project cache. Both are idempotent against the same cwd.
  //
  // The `await` is LOAD-BEARING: Pi's loader awaits the factory Promise, so
  // the 11 pi.on calls + user-scope cache hydrate inside `registerHooksBridge`
  // are guaranteed to complete BEFORE the first Pi event fires.
  await hooksHydration.registerHooksBridge(pi, { cwd: homedir() });

  async function prepareResources(
    event: ResourcesDiscoverEvent,
    ctx: ExtensionContext,
  ): Promise<void> {
    requireNotificationMode(ctx.mode);
    const run = openNotificationRun(pi, { kind: "load" });
    try {
      await hooksHydration.hydrateProjectScopeForCwd(event.cwd);
    } catch (err) {
      hookDebugLog(`project-scope hydrate threw unexpectedly: ${errorMessage(err)}`, "hydrate");
    }

    requireNotificationMode(ctx.mode);
    try {
      await loadReconcile({ ctx, run, cwd: event.cwd, hooksRouting, completionCache });
    } catch (err) {
      try {
        notifyReconcileAborted(ctx, run, err);
      } catch (notifyErr) {
        hookDebugLog(`reconcile-abort notify failed: ${errorMessage(notifyErr)}`, "env");
      }
    }

    requireNotificationMode(ctx.mode);
    try {
      const pathResult = await recomputePluginPath(event.cwd);
      for (const skip of pathResult.skipped) {
        try {
          notifyPluginPathSkipped(ctx, run, skip.scope, skip.reason);
        } catch (notifyErr) {
          hookDebugLog(`plugin PATH warning notify failed: ${errorMessage(notifyErr)}`, "env");
        }
      }
    } catch (err) {
      hookDebugLog(`plugin PATH recompute skipped: ${errorMessage(err)}`, "env");
    }
  }

  // The peer's own `ExtensionAPI.on("resources_discover", ...)` overload checks
  // this callback: its parameter and its return are compared against the
  // installed `ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>`
  // declaration. The two annotations name the local `platform/pi-api.ts` mirrors
  // of those upstream shapes, so the compiler -- not a hand-written assertion --
  // is what holds the mirrors to the installed declaration.
  pi.on(
    "resources_discover",
    async (
      event: ResourcesDiscoverEvent,
      ctx: ExtensionContext,
    ): Promise<ResourcesDiscoverResult> => {
      // D-05-01/02: initialization and live mode guards cannot block read-only discovery.
      try {
        await prepareResources(event, ctx);
      } catch (err) {
        hookDebugLog(`load preparation skipped: ${errorMessage(err)}`, "resources");
      }

      try {
        const discovered = await aggregateDiscoveredResources(
          locationsFor("user", homedir()),
          locationsFor("project", event.cwd),
        );
        return {
          skillPaths: [...discovered.skillPaths],
          promptPaths: [...discovered.promptPaths],
        };
      } catch (err) {
        hookDebugLog(`resource discovery skipped: ${errorMessage(err)}`, "resources");
        return { skillPaths: [], promptPaths: [] };
      }
    },
  );

  // AVAR-01: refresh pi-mcp-adapter's variables from the session's cwd first,
  // outside the session id's try, so a session id failure cannot skip them.
  //
  // SENV-01/02/03: reset the Claude-Code session env on every session_start
  // (startup/reload/new/resume/fork). Overwrite is unconditional -- that IS the
  // SENV-02 freshness contract -- so re-registration is harmless (idempotent).
  // The session id lives on `ctx.sessionManager` (D-90-03 keeps this concern
  // separate from the resources_discover PATH recompute). WR-02: `applySessionEnv`'s
  // three string assignments cannot throw, but the argument expression
  // `ctx.sessionManager.getSessionId()` is evaluated first and could throw (or
  // `ctx.sessionManager` be undefined); wrap so a throw never propagates past
  // session_start, matching the NFR-2 boundary discipline of the handlers above.
  pi.on("session_start", (_event, ctx) => {
    applyMcpAdapterEnvFrom(() => ctx.cwd);
    try {
      requireNotificationMode(ctx.mode);
      applySessionEnv(ctx.sessionManager.getSessionId());
    } catch (err) {
      hookDebugLog(`session env apply skipped: ${errorMessage(err)}`, "env");
    }
  });

  // AUP-01 / D-PL8-01 / D-PL8-13: the first message arms one background
  // autoupdate pass. It is a separate run, not a load, so `resources_discover`
  // still changes no installation state (APL-D1). The listeners come after
  // `registerHooksBridge`, so a prompt that a UserPromptSubmit hook blocks arms
  // nothing. `Math.random` is passed by reference, not called.
  const backgroundUpdate = createBackgroundUpdate({
    gate: backgroundGate,
    pass: createBackgroundPass({
      pi,
      gate: backgroundGate,
      completionCache,
      beginPluginUpdateRun: pluginUpdateOperations.beginPluginUpdateRun,
      updateMarketplace,
    }),
    env: process.env,
    random: Math.random,
  });
  pi.on("input", backgroundUpdate.onInput);
  pi.on("session_shutdown", backgroundUpdate.onShutdown);

  registerClaudePluginCommand(
    pi,
    {
      completionCache,
      mcpStatus,
      gitOps: DEFAULT_GIT_OPS,
      beginPluginUpdateRun: pluginUpdateOperations.beginPluginUpdateRun,
      applyReconcile,
    },
    hooksRouting,
    pluginUpdateOperations.updatePlugins,
    { runForeground: backgroundGate.runForeground },
  );
  registerClaudeMarketplaceTools(pi);
  registerSkillAliases(pi);
}
