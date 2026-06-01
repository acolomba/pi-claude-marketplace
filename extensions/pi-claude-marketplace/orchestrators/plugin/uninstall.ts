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
//   POST-state-commit: rm -rf pluginDataDir; leaks SWALLOWED in V2 per
//   D-19-01 precedent (D-18-01 lineage) -- the underlying rm() still runs,
//   only the user-visible warning surface is gone.
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
// The architectural source-grep test (Plan 05-02) gates install.ts + list.ts
// today; uninstall.ts is implicitly clean by construction (no git surface).
//
// PU-6 (legacy state migration): handled by persistence/migrate.ts at load
// time (Phase 2 ST-4/ST-5). No new code needed here -- a legacy state record
// missing `resources.agents` / `resources.mcpServers` is normalized to [] by
// loadState BEFORE the withStateGuard closure observes it.
//
// API parameter shape note: `pi` is required because V2 `notify(ctx, pi,
// message)` consumes it for the single softDepStatus(pi) probe per call
// . The uninstalled variant has no `dependencies` field by
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
  /** Factory `pi` reference -- threaded into V2 `notify()` for the single softDepStatus(pi) probe. */
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
 * the typed-cause dispatch in `orchestrators/marketplace/remove.ts`
 * (quick task 260525-aub): instanceof `AgentsUnstageFailureError` first,
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
 * PU-1..8 entrypoint. Reuses Phase 4's `cascadeUnstagePlugin` (Phase 4 D-02
 * corollary -- the helper was reserved for this phase), wraps cascade +
 * state-record-removal in `withStateGuard`, and runs the per-plugin
 * `pluginDataDir` rm-rf OUTSIDE the guard post-state-commit (PU-2 / D-08).
 *
 * Tolerates concurrent uninstall via the silent-converge path (PU-5):
 * whichever process loses the race observes the record absent at re-load
 * and exits silently with no notification (PRD §5.2.2 verbatim).
 *
 * Returns void; the function never re-throws -- failures surface via a
 * single V2 `notify()` call per IL-2 (single ctx.ui.notify chokepoint).
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
  // populate the PluginUninstalledMessage.version slot without re-reading
  // state. Undefined when alreadyGone (no row to render in that case).
  let removedVersion: string | undefined;

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
    // other cascade failure) via a single V2 notify() call constructing a
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
  } catch {
    // D-19-01 precedent (D-18-01 lineage): cache-refresh failures are
    // swallowed silently in V2. The cache-refresh side effect still fires;
    // only the user-visible warning surface is gone (no clean
    // MarketplaceNotificationMessage representation for a post-success
    // "soft warning").
  }

  // POST-state-commit per PU-2 / D-08: drop the per-plugin data dir AFTER the
  // state save so an EACCES on rm cannot strand state in installed=true.
  //
  // D-19-01 precedent (D-18-01 lineage): post-uninstall data-dir cleanup
  // leaks are swallowed silently in V2. The cleanup side effect still fires;
  // only the user-visible warning surface is gone. The V1 PU-4
  // notifyWarning that named the leaked path is dropped because the V2
  // MarketplaceNotificationMessage type has no field to surface "cleanup
  // leak after successful state mutation"; the user-visible primary
  // success is what V2 emits.
  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  try {
    await rm(dataDir, { recursive: true, force: true });
  } catch {
    // Per D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }

  // PU-8 reload hint: computed by notify from the
  // PluginUninstalledMessage status (uninstalled is in the state-changing
  // variant set). The V1 "only when >=1 resource dropped" gate is GONE:
  // V2 reload-hint trigger is per-variant status, not per-cascade-outcome
  // resource count. `outcome` is defined here because alreadyGone is false
  // (early-returned above) AND the catch returned on cascade failure.
  //
  // CMC-24 / D-13-05 / D-13-06 legacy comment: emit via PluginUninstalledMessage.
  // The uninstalled variant has NO per-row soft-dep predicate fields by
  // construction -- MSG-SD-3 is structurally enforced: the renderer CANNOT
  // emit `{requires pi-subagents}` / `{requires pi-mcp}` markers on
  // (uninstalled) rows. The legacy aggregated PI_*_NOT_LOADED trailers on
  // uninstall success are RETIRED per D-13-07 + MSG-SD-3 (the soft-dep state
  // is no-op for the operator after uninstall -- the content is gone, so no
  // marker is useful).
  //
  // The defensive-guard branch (cascadeResult === undefined) shares the same
  // V2 byte shape because both arms route through the same notify() call
  // with the same PluginUninstalledMessage payload. Reference: catalog UAT
  // `success` fixture at docs/output-catalog.md:340-348.
  //
  // IN-02: keep the `removedVersion !== undefined` guard (variable is
  // typed `string | undefined` because it is hoisted from inside the
  // withStateGuard closure; the type system cannot prove the closure
  // ran), but drop the redundant `!== ""` half of the guard. State
  // records persisted by previous install/update paths always carry a
  // non-empty version by construction (see install.ts IN-02 commit).
  // The renderer suppresses the `v<version>` token on undefined / empty
  // anyway, so the empty-version edge case (theoretical legacy state)
  // is handled structurally.
  const uninstalledRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: plugin,
    ...(removedVersion !== undefined && { version: removedVersion }),
  };
  // One MarketplaceNotificationMessage per affected marketplace, emitted
  // via a single notify(opts.ctx, opts.pi, ...) call per orchestration.
  // - plugins: readonly PluginNotificationMessage[] in display order
  //  (orchestrator-controlled iteration; notify does not sort).
  // - Discriminators by status: "uninstalled" here. Plans 19-02..05 mirror
  //   with their own status sets: installed/updated/reinstalled/failed/
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
