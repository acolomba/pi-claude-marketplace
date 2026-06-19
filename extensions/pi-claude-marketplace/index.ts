import { homedir } from "node:os";

import { hydrateProjectScopeForCwd, registerHooksBridge } from "./bridges/hooks/index.ts";
import { registerClaudeMarketplaceTools, registerClaudePluginCommand } from "./edge/register.ts";
import { aggregateDiscoveredResources } from "./orchestrators/discover.ts";
import { DEFAULT_GIT_OPS } from "./orchestrators/marketplace/shared.ts";
import { updateSinglePlugin } from "./orchestrators/plugin/update.ts";
import { applyReconcile } from "./orchestrators/reconcile/apply.ts";
import { locationsFor } from "./persistence/locations.ts";
import { errorMessage } from "./shared/errors.ts";
import { makeRawNotifyFn } from "./shared/notify.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
} from "./platform/pi-api.ts";

// DISP-01: async factory; Pi's loader awaits this Promise (loader.d.ts
// `loadExtensionFromFactory(...): Promise<Extension>`), so the 7 pi.on
// registrations inside `registerHooksBridge` complete BEFORE the loader
// proceeds to emit any session-lifecycle event. The `void` fire-and-forget
// alternative would race against the first session_start because the loader
// does not see the un-awaited inner Promise.
export default async function claudeMarketplaceExtension(pi: ExtensionAPI): Promise<void> {
  const onResourcesDiscover = pi.on.bind(pi) as unknown as (
    event: "resources_discover",
    handler: (
      event: ResourcesDiscoverEvent,
      ctx: ExtensionContext,
    ) => Promise<ResourcesDiscoverResult>,
  ) => void;

  // DISP-01 / DISP-02 / D-59-02 / D-59-03: register the hooks bridge at
  // factory time. The bridge's signature requires `{ ctx; cwd }`, but neither
  // exists at extension-load time -- Pi's `resources_discover` event is the
  // first signal that delivers an `ExtensionContext` + project `cwd`. So:
  //
  //   1. Pass `homedir()` as cwd: this hydrates the USER scope correctly (the
  //      bridge derefs project cwd via `locationsFor("project", cwd)` and
  //      ignores it for user scope, which uses `getAgentDir()`).
  //   2. Pass a placeholder `ctx`: the bridge's hydrate path does not consume
  //      `opts.ctx` (only `opts.cwd`); the field is structurally required by
  //      the signature but functionally unused at factory time.
  //   3. Defer project-scope hydrate to the first `resources_discover` via
  //      `hydrateProjectScopeForCwd(event.cwd)` BELOW -- the routing-table
  //      rebuild inside `applyReconcile` then sees the correct project cache.
  //
  // The `await` is LOAD-BEARING: Pi's loader awaits the factory Promise, so
  // the 7 pi.on calls + user-scope cache hydrate inside `registerHooksBridge`
  // are guaranteed to complete BEFORE the first Pi event fires.
  const placeholderCtx = {} as unknown as ExtensionContext;
  await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: homedir() });

  onResourcesDiscover("resources_discover", async (event, ctx) => {
    // D-59-02 deferred project-scope hydrate: the factory-time bridge
    // registration could not know the project cwd, so re-run project hydrate
    // here BEFORE applyReconcile rebuilds the per-scope routing tables.
    // Failures are swallowed by the helper itself via the OBS-01 seam.
    try {
      await hydrateProjectScopeForCwd(event.cwd);
    } catch {
      // Defensive: hydrateProjectScopeForCwd already swallows loadState
      // failures internally via hookDebugLog. A bubbled throw here would
      // be a programmer error in the bridge; we still must not let it
      // propagate past resources_discover (NFR-2).
    }

    // RECON-01..05: apply the load-time reconcile BEFORE
    // discovering resources so newly-materialized artefacts are picked up on
    // the SAME load. The outer try/catch enforces NFR-2: a catastrophic
    // throw NEVER blocks Pi load -- it surfaces as a single last-ditch
    // notify (inside its own try/catch so a UI failure can't propagate
    // either) and aggregateDiscoveredResources still runs.
    try {
      await applyReconcile({ ctx, pi, cwd: event.cwd });
    } catch (err) {
      try {
        // AUTH-01 / IL-2 escape: makeRawNotifyFn is the sanctioned raw-text
        // notify wrapper -- the last-ditch error path predates any structured
        // NotificationMessage construction and routes through this seam to
        // surface a single error string. The inner try/catch ensures a notify
        // failure NEVER propagates past resources_discover (NFR-2).
        // Y7 (PR #51): route through shared errorMessage so a non-Error
        // throw (e.g. a literal string) renders its stringified form
        // instead of `reconcile aborted: undefined`.
        makeRawNotifyFn(ctx)(`reconcile aborted: ${errorMessage(err)}`, "error");
      } catch {
        // Last-ditch: never let a notify failure propagate past
        // resources_discover (NFR-2 boundary preservation).
      }
    }

    const discovered = await aggregateDiscoveredResources(
      locationsFor("user", homedir()),
      locationsFor("project", event.cwd),
    );
    return {
      skillPaths: [...discovered.skillPaths],
      promptPaths: [...discovered.promptPaths],
    };
  });

  registerClaudePluginCommand(pi, {
    gitOps: DEFAULT_GIT_OPS,
    pluginUpdate: updateSinglePlugin,
  });
  registerClaudeMarketplaceTools(pi);
}
