// orchestrators/plugin/uninstall.ts
//
// PU-1..8 + PU-7 propagation + AS-6 (post-commit cleanup leaks warning-severity).
//
// Composition (D-09):
//   withStateGuard(locations, async (state) => {
//     PU-5 silent converge: if record absent, set alreadyGone=true and return
//     outcome = await cascadeUnstagePlugin(plugin, marketplace, locations, installed)
//     if (!outcome.ok) throw outcome.cause  // PU-7 propagation; state record retained
//     delete state.marketplaces[mp].plugins[plugin]
//     // guard saves on closure return
//   })
//   if (alreadyGone) return  -- PU-5 silent success
//   POST-state-commit: rm -rf pluginDataDir; leaks SWALLOWED per
//   D-19-01 -- the underlying rm() still runs, only the user-visible
//   warning surface is gone.
//   PU-8 reload hint: computed by notify() from PluginUninstalledMessage
//  (uninstalled is in the state-changing variant set).
//
// Each outcome arm emits one notify() call with a single
// MarketplaceNotificationMessage. Post-state cleanup failures (cache-refresh,
// data-dir rm) are swallowed: the underlying calls still run; there is no
// notification shape for "cleanup leak after a successful state mutation".
//
// Cycle break (D-11): orchestrators/plugin/ may import named exports from
// orchestrators/marketplace/shared.ts ONLY (NOT from add.ts/remove.ts/etc).
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The architectural source-grep test gates install.ts + list.ts;
// uninstall.ts is implicitly clean by construction (no git surface).
//
// PU-6 (legacy state migration): handled by persistence/migrate.ts at load
// time (ST-4/ST-5). No new code needed here -- a state record missing
// `resources.agents` / `resources.mcpServers` is normalized to [] by
// loadState BEFORE the withStateGuard closure observes it.
//
// API parameter shape note: `pi` is required because `notify(ctx, pi,
// message)` consumes it for the single softDepStatus(pi) probe per call.
// The uninstalled variant has no `dependencies` field by
// construction (D-15-02 / MSG-SD-3) so the renderer cannot emit
// `{requires pi-subagents}` / `{requires pi-mcp}` markers on (uninstalled)
// rows even though the probe is uniformly threaded.

import { rm } from "node:fs/promises";

import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { AgentsUnstageFailureError, cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { resolveInstalledPluginTarget } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { PluginFailedMessage, PluginUninstalledMessage, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * PU-1..8 options bundle. `scope` + `cwd` together resolve a `ScopedLocations`
 * via `locationsFor`. `marketplace` + `plugin` identify the (mp, plugin) tuple
 * to remove.
 *
 * D-09 injection seam: `cascade` defaults to `cascadeUnstagePlugin`. Tests
 * inject a stub to force per-cascade outcomes (e.g., forced AgentsUnstageFailureError
 * for PU-7 coverage; forced all-empty dropped for PU-8 zero-dropped coverage).
 */
export interface UninstallPluginOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- threaded into `notify()` for the single softDepStatus(pi) probe. */
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /**
   * D-12-style injection seam for the per-plugin cascade primitive. Defaults
   * to `cascadeUnstagePlugin` from `../marketplace/shared.ts`. Tests inject a
   * stub for deterministic outcome control. Zero runtime cost in production:
   * a single `??` fallback.
   */
  readonly cascade?: typeof cascadeUnstagePlugin;
}

/**
 * Narrow an Error thrown out of `cascadeUnstagePlugin` (PU-7 propagation
 * path) to a closed-set Reason for `PluginFailedMessage.reasons`. Mirrors
 * the typed-cause dispatch in `orchestrators/marketplace/remove.ts`:
 * instanceof `AgentsUnstageFailureError` first,
 * `NodeJS.ErrnoException.code` second, permissive fallback last. Closed-set
 * Reasons live in `shared/notify.ts::REASONS`.
 */
function narrowCascadeFailure(cause: Error): Reason {
  if (cause instanceof AgentsUnstageFailureError) {
    // No closed-set Reason captures the per-agent foreign-content failure
    // mode today; map to the documented permissive fallback (same precedent
    // as orchestrators/marketplace/remove.ts narrowCascadeFailure).
    return "not in manifest";
  }

  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return "permission denied";
      case "ENOENT":
        return "source missing";
      default:
        break;
    }
  }

  return "not in manifest";
}

/**
 * Structural predicate for `NodeJS.ErrnoException`. The `.code` property
 * is the locale-independent discriminator (NFR-4 floor `>= 22`). Avoids
 * matching English-language error text that varies across Node versions.
 */
function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error && "code" in err && typeof (err as { code?: unknown }).code === "string"
  );
}

/**
 * PU-1..8 entrypoint. Reuses `cascadeUnstagePlugin` (D-02), wraps cascade +
 * state-record-removal in `withStateGuard`, and runs the per-plugin
 * `pluginDataDir` rm-rf OUTSIDE the guard post-state-commit (PU-2 / D-08).
 *
 * Tolerates concurrent uninstall via the silent-converge path (PU-5):
 * whichever process loses the race observes the record absent at re-load
 * and exits silently with no notification (PRD §5.2.2 verbatim).
 *
 * Returns void; the function never re-throws -- failures surface via a
 * single `notify()` call per IL-2 (single ctx.ui.notify chokepoint).
 */
export async function uninstallPlugin(opts: UninstallPluginOptions): Promise<void> {
  const { ctx, pi, cwd, marketplace, plugin } = opts;
  const cascade = opts.cascade ?? cascadeUnstagePlugin;
  const resolved = await resolveInstalledPluginTarget({
    cwd,
    marketplace,
    plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });
  if (resolved === undefined) {
    return;
  }

  const { scope, locations } = resolved;

  let alreadyGone = false;
  // Lifted from inside the guard closure so the post-guard success path can
  // populate the PluginUninstalledMessage.version slot without re-reading
  // state. Undefined when alreadyGone (no row to render in that case).
  let removedVersion: string | undefined;
  // TR-03: captured outside the guard so the post-guard branch can
  // emit the PluginFailedMessage for non-AG-5 cascade failures AFTER the
  // shrunken-row save has committed. AG-5 still throws (preserves row);
  // non-AG-5 mutates resources.* in place and surfaces via this sentinel.
  let cascadeFailure: Error | undefined;

  try {
    await withStateGuard(locations, async (state) => {
      const mp = state.marketplaces[marketplace];
      if (mp === undefined) {
        // IN-05: reachability note. The prior `resolveInstalledPluginTarget`
        // call at line 152-160 already verified the marketplace's existence
        // when no `explicitScope` was supplied (it returns `undefined` on
        // missing record); when `explicitScope` IS set,
        // `resolveInstalledPluginTarget` short-circuits to
        // `{ scope: opts.scope, locations: ... }` WITHOUT reading state. So
        // this branch is reached only via the explicit-scope path, where
        // the closure's `loadState` may find an empty state.json. Exercised
        // by the PU-5 marketplace-absent test at uninstall.test.ts:489.
        //
        // Marketplace itself absent -- nothing to uninstall; treat as
        // silent converge.
        alreadyGone = true;
        return;
      }

      const installed = mp.plugins[plugin];
      if (installed === undefined) {
        // PU-5 silent converge: record already gone (another process completed
        // first or there was never an install). PRD §5.2.2 specifies literal
        // silence here -- no notification.
        alreadyGone = true;
        return;
      }

      removedVersion = installed.version;

      // PU-1 ordering enforced INSIDE cascadeUnstagePlugin (D-03:
      // skills -> commands -> agents -> mcp).
      const localOutcome = await cascade(plugin, marketplace, locations, installed);

      // TR-03: split the failure handling by cause type.
      //   - AG-5 (AgentsUnstageFailureError): foreign content owned by
      //     another process. Re-throw to abort the save -- the row stays
      //     intact for manual recovery / retry (preserves PU-3+PU-7).
      //   - Non-AG-5 partial failure: the cascade dropped some artifacts
      //     before throwing. Filter sRecord.resources.* by outcome.dropped.*
      //     so the persisted row reflects only artifacts still on disk
      //     (no ghost record). Surface the failure via the cascadeFailure
      //     sentinel so the post-guard branch can fire the
      //     PluginFailedMessage AFTER the shrunken-row save commits.
      //
      // CRITICAL field-name mapping: dropped.commands populates from
      // resources.prompts (cascade primitive at shared.ts:339), so the
      // filter MUST wire dropped.commands -> resources.prompts. The other
      // three axes are name-identical (skills, agents, mcpServers).
      if (!localOutcome.ok) {
        // outcome.cause is non-undefined when ok=false (D-03 contract).
        const cause =
          localOutcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
        if (cause instanceof AgentsUnstageFailureError) {
          // AG-5 carve-out: preserve the row intact (ST-7 abort-save).
          throw cause;
        }

        // Non-AG-5: filter resources.* by dropped.* in place. The mutation
        // persists via the guard's trailing saveState because we return
        // normally (no throw) from the closure.
        const sRecord = installed; // alias for clarity; same object as mp.plugins[plugin]
        const dropped = localOutcome.dropped;
        sRecord.resources.skills = sRecord.resources.skills.filter(
          (n) => !dropped.skills.includes(n),
        );
        sRecord.resources.prompts = sRecord.resources.prompts.filter(
          (n) => !dropped.commands.includes(n),
        );
        sRecord.resources.agents = sRecord.resources.agents.filter(
          (n) => !dropped.agents.includes(n),
        );
        sRecord.resources.mcpServers = sRecord.resources.mcpServers.filter(
          (n) => !dropped.mcpServers.includes(n),
        );
        cascadeFailure = cause;
        return;
      }

      // State commit: remove the plugin record. The guard saves atomically
      // on closure return.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
      delete mp.plugins[plugin];
    });
  } catch (err) {
    // PU-7 propagation: surface chained AgentsUnstageFailureError (or any
    // other cascade failure) via a single notify() call constructing a
    // `PluginFailedMessage` with the typed cause threaded through. State was
    // NOT saved (guard contract); the plugin record stays intact for retry.
    // Severity (`error`) and reload-hint suppression are computed by notify()
    //  (any failed -> error) and (no state-changing
    // variant -> no reload-hint).
    const cause = err instanceof Error ? err : new Error(String(err));
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: [narrowCascadeFailure(cause)],
      // IN-02: see the success-path commit message; the `!== ""` half of
      // the guard is dead by construction.
      ...(removedVersion !== undefined && { version: removedVersion }),
      cause,
    };
    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [failedRow],
        },
      ],
    });
    return;
  }

  // PU-5 silent converge: literal silence, no notification (PRD §5.2.2
  // verbatim).
  //
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `alreadyGone` is mutated inside the withStateGuard closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (alreadyGone) {
    return;
  }

  // TR-03: non-AG-5 cascade partial-failure surface. The guard
  // already saved the SHRUNKEN sRecord.resources.* (filtered by
  // outcome.dropped.* in place). Now emit the PluginFailedMessage so the
  // user sees the failure. Pitfall 4: this branch MUST return BEFORE the
  // post-state cleanup (cache-drop, data-dir rm, PluginUninstalledMessage)
  // -- those run only on full success.
  if (cascadeFailure !== undefined) {
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: [narrowCascadeFailure(cascadeFailure)],
      ...(removedVersion !== undefined && { version: removedVersion }),
      cause: cascadeFailure,
    };
    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [failedRow],
        },
      ],
    });
    return;
  }

  // D-03-INV: post-state-commit completion-cache invalidation.
  // Plugin moved from "installed" -> "available"; drop the cached plugin
  // index for this marketplace so the next completion read rebuilds with
  // the new status. Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch {
    // Per D-19-01 cache-refresh failures are swallowed silently. The
    // cache-refresh side effect still fires; only the user-visible
    // warning surface is gone (no clean MarketplaceNotificationMessage
    // representation for a post-success "soft warning").
  }

  // POST-state-commit per PU-2 / D-08: drop the per-plugin data dir AFTER the
  // state save so an EACCES on rm cannot strand state in installed=true.
  //
  // Per D-19-01 post-uninstall data-dir cleanup leaks are swallowed
  // silently. The cleanup side effect still fires; only the user-visible
  // warning surface is gone. The PU-4 notifyWarning that names the leaked
  // path is dropped because the MarketplaceNotificationMessage type has no
  // field to surface "cleanup leak after successful state mutation"; the
  // user-visible primary success is what notify emits.
  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  try {
    await rm(dataDir, { recursive: true, force: true });
  } catch {
    // Per D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }

  // PU-8 reload hint: computed by notify from the
  // PluginUninstalledMessage status (uninstalled is in the state-changing
  // variant set). The reload-hint trigger is per-variant status, not
  // per-cascade-outcome resource count. `outcome` is defined here because
  // alreadyGone is false (early-returned above) AND the catch returned on
  // cascade failure.
  //
  // CMC-24 / D-13-05 / D-13-06: emit via PluginUninstalledMessage.
  // The uninstalled variant has NO per-row soft-dep predicate fields by
  // construction -- MSG-SD-3 is structurally enforced: the renderer CANNOT
  // emit `{requires pi-subagents}` / `{requires pi-mcp}` markers on
  // (uninstalled) rows. There are no aggregated PI_*_NOT_LOADED trailers on
  // uninstall success per D-13-07 + MSG-SD-3 (the soft-dep state
  // is no-op for the operator after uninstall -- the content is gone, so no
  // marker is useful).
  //
  // The defensive-guard branch (cascadeResult === undefined) shares the same
  // byte shape because both arms route through the same notify() call
  // with the same PluginUninstalledMessage payload. Reference: catalog UAT
  // `success` fixture at docs/output-catalog.md:340-348.
  //
  // IN-02: keep the `removedVersion !== undefined` guard (variable is
  // typed `string | undefined` because it is hoisted from inside the
  // withStateGuard closure; the type system cannot prove the closure
  // ran), but drop the redundant `!== ""` half of the guard. State
  // records persisted by install/update paths always carry a
  // non-empty version by construction (see install.ts IN-02).
  // The renderer suppresses the `v<version>` token on undefined / empty
  // anyway, so the empty-version edge case is handled structurally.
  const uninstalledRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: plugin,
    ...(removedVersion !== undefined && { version: removedVersion }),
  };
  // One MarketplaceNotificationMessage per affected marketplace, emitted
  // via a single notify(opts.ctx, opts.pi, ...) call per orchestration.
  // - plugins: readonly PluginNotificationMessage[] in display order
  //  (orchestrator-controlled iteration; notify does not sort).
  // - Discriminators by status: "uninstalled" here. Sibling orchestrators
  //   use their own status sets: installed/updated/reinstalled/failed/
  //   skipped/manual recovery/available/unavailable/upgradable.
  // - Severity + "/reload to pick up changes" trailer are computed by notify()
  // ; callers MUST NOT compose them.
  // - Reference: catalog UAT plugin-uninstall fixtures at docs/output-catalog.md:340-378.
  notify(ctx, pi, {
    marketplaces: [
      {
        name: marketplace,
        scope,
        plugins: [uninstalledRow],
      },
    ],
  });
}
