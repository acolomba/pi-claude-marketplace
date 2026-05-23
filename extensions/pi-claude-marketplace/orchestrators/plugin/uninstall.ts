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
//   POST-state-commit: rm -rf pluginDataDir; leaks -> warning (PU-4)
//   PU-8 reload hint: only when >=1 resource dropped
//
// Cycle break (D-11): orchestrators/plugin/ may import named exports from
// orchestrators/marketplace/shared.ts ONLY (NOT from add.ts/remove.ts/etc).
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The architectural source-grep test (Plan 05-02) gates install.ts + list.ts
// today; uninstall.ts is implicitly clean by construction (no git surface).
//
// PU-6 (legacy state migration): handled by persistence/migrate.ts at load
// time (Phase 2 ST-4/ST-5). No new code needed here -- a legacy state record
// missing `resources.agents` / `resources.mcpServers` is normalized to [] by
// loadState BEFORE the withStateGuard closure observes it.
//
// API parameter shape note: `pi` was historically required because of the
// retired `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` helpers
// (Phase 6 precedent). Phase 13 sub-wave 2b structurally enforces MSG-SD-3
// (no soft-dep markers on uninstalled rows) via the PluginInlineUninstalledRow
// variant: that variant has NO `declaresAgents/Mcp` fields, so the renderer
// cannot probe companion-loaded state for these rows. `pi` is still required
// for `softDepStatus(pi)` (the probe is uniformly threaded through `renderRow`
// for signature uniformity across variants, though it is unused for the
// uninstalled variant).

import { rm } from "node:fs/promises";

import { softDepStatus } from "../../platform/pi-api.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { appendLeaks, errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { resolveInstalledPluginTarget } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { PluginInlineUninstalledRow } from "../../presentation/compact-line.ts";
import type { Scope } from "../../shared/types.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";

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
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
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
 * PU-1..8 entrypoint. Reuses Phase 4's `cascadeUnstagePlugin` (Phase 4 D-02
 * corollary -- the helper was reserved for this phase), wraps cascade +
 * state-record-removal in `withStateGuard`, and runs the per-plugin
 * `pluginDataDir` rm-rf OUTSIDE the guard post-state-commit (PU-2 / D-08).
 *
 * Tolerates concurrent uninstall via the silent-converge path (PU-5):
 * whichever process loses the race observes the record absent at re-load
 * and exits silently with no notification (PRD §5.2.2 verbatim).
 *
 * Returns void; the function never re-throws -- failures surface via
 * `notifyError` / `notifyWarning` per IL-2 (single ctx.ui.notify chokepoint).
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
  let outcome: UnstageOutcome | undefined;
  // Lifted from inside the guard closure so the post-guard success path can
  // populate the PluginInlineUninstalledRow.version slot without re-reading
  // state. Undefined when alreadyGone (no row to render in that case).
  let removedVersion: string | undefined;

  try {
    await withStateGuard(locations, async (state) => {
      const mp = state.marketplaces[marketplace];
      if (mp === undefined) {
        // Marketplace itself absent -- nothing to uninstall; treat as silent converge.
        alreadyGone = true;
        return;
      }

      const installed = mp.plugins[plugin];
      if (installed === undefined) {
        // PU-5 silent converge: record already gone (another process completed
        // first or there was never an install). PRD §5.2.2 specifies literal
        // silence here -- no notification. (CONTEXT.md Open Questions
        // researcher recommendation: "literal silence, no notify.")
        alreadyGone = true;
        return;
      }

      removedVersion = installed.version;

      // PU-1 ordering enforced INSIDE cascadeUnstagePlugin (Phase 4 D-03
      // corollary: skills -> commands -> agents -> mcp).
      outcome = await cascade(plugin, marketplace, locations, installed);

      // PU-7: cascade returns ok=false with chained AgentsUnstageFailureError
      // when foreign content detected at an agent target file. Re-throw to
      // abort the state commit (the marketplace record + plugin record stay
      // intact for retry).
      if (!outcome.ok) {
        // outcome.cause is non-undefined when ok=false (Phase 4 D-03 contract).
        throw outcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
      }

      // State commit: remove the plugin record. The guard saves atomically
      // on closure return.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
      delete mp.plugins[plugin];
    });
  } catch (err) {
    // PU-7 propagation: surface chained AgentsUnstageFailureError (or any
    // other cascade failure) via notifyError. notifyError now auto-appends
    // the MSG-CC-1 depth-5 cause-chain trailer (D-CMC-12). State was NOT
    // saved (guard contract); the plugin record stays intact for retry.
    notifyError(ctx, errorMessage(err), err);
    return;
  }

  // PU-5 silent converge: literal silence, no notification (CONTEXT.md Open
  // Questions researcher recommendation -- PRD §5.2.2 verbatim).
  //
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `alreadyGone` is mutated inside the withStateGuard closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (alreadyGone) {
    return;
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // Plugin moved from "installed" -> "available"; drop the cached plugin
  // index for this marketplace so the next completion read rebuilds with
  // the new status. Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    notifyWarning(
      ctx,
      `Plugin "${plugin}" uninstalled; completion cache refresh deferred: ${errorMessage(err)}`,
    );
  }

  // POST-state-commit per PU-2 / D-08: drop the per-plugin data dir AFTER the
  // state save so an EACCES on rm cannot strand state in installed=true.
  // PU-4: cleanup leaks surface as warning-severity with the leaked path named.
  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  const cleanupLeaks: string[] = [];
  try {
    await rm(dataDir, { recursive: true, force: true });
  } catch (err) {
    cleanupLeaks.push(`plugin data ${dataDir}: ${errorMessage(err)}`);
  }

  // PU-4 warning: state was committed; only the data-dir cleanup partially
  // failed. Surface as warning (NOT error) so the user knows the uninstall
  // succeeded but a path needs manual cleanup.
  if (cleanupLeaks.length > 0) {
    notifyWarning(
      ctx,
      appendLeaks(new Error(`Plugin "${plugin}" removed; cleanup partial.`), cleanupLeaks).message,
    );
    return;
  }

  // PU-8 reload hint: only when >=1 resource was actually dropped. `outcome`
  // is defined here because alreadyGone is false (early-returned above) AND
  // the catch returned on cascade failure.
  //
  // CMC-24 / D-13-05 / D-13-06: emit via PluginInlineUninstalledRow + renderRow.
  // The PluginInlineUninstalledRow variant has NO declaresAgents/declaresMcp
  // fields by construction -- MSG-SD-3 is structurally enforced: the renderer
  // CANNOT emit `{requires pi-subagents}` / `{requires pi-mcp}` markers on
  // (uninstalled) rows. The legacy aggregated PI_*_NOT_LOADED trailers on
  // uninstall success are RETIRED per D-13-07 + MSG-SD-3 (the soft-dep state
  // is no-op for the operator after uninstall -- the content is gone, so no
  // marker is useful).
  const cascadeResult = outcome;
  const probe = softDepStatus(pi);
  const uninstalledRow: PluginInlineUninstalledRow = {
    kind: "plugin-inline-uninstalled",
    name: plugin,
    marketplace,
    scope,
    ...(removedVersion !== undefined && removedVersion !== "" && { version: removedVersion }),
  };
  const body = renderRow(uninstalledRow, probe);

  if (cascadeResult === undefined) {
    // Defensive guard -- should be unreachable per the contract above.
    notifySuccess(ctx, body);
    return;
  }

  const droppedAny =
    cascadeResult.dropped.skills.length > 0 ||
    cascadeResult.dropped.commands.length > 0 ||
    cascadeResult.dropped.agents.length > 0 ||
    cascadeResult.dropped.mcpServers.length > 0;

  // PU-8 / MSG-RH-1: reload hint emitted iff anything was actually dropped.
  // reloadHint() returns "" for empty names array; appendReloadHint
  // suppresses the trailing line in that case.
  const hint = reloadHint(droppedAny ? [plugin] : []);
  notifySuccess(ctx, appendReloadHint(body, hint));
}
