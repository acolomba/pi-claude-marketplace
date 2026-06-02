// orchestrators/marketplace/remove.ts
//
// MR-1..8 + RH-1/RH-5 composition + NFR-5 (no network).
//
//
// Notification shape per outcome:
//   - Clean success: MarketplaceNotificationMessage{ status:"removed",
//     plugins: [...] } with one PluginUninstalledMessage (○) per unstaged
//     plugin. Reload-hint fires iff >=1 plugin was unstaged (D-22-02).
//     An empty remove (no plugins staged) is header-only with no trailer.
//   - Partial failure: MarketplaceNotificationMessage{ status:"failed" }
//     mixing PluginUninstalledMessage and PluginFailedMessage{ cause? }
//     rows. Per-plugin cause rendered at 4-space indent (D-16-08).
//   - Post-state cleanup and cache-refresh failures are swallowed (MR-6 /
//     D-18-01): the underlying rm() calls still run; only the warning
//     disappears, as there is no clean notification shape for
//     "cleanup leak after a successful state mutation".
//
// Flow:
//   1. resolveScopeFromState(name, userLocs, projectLocs) when --scope omitted (MR-1).
//   2. withStateGuard(locations, async (state) => {
//        record = state.marketplaces[name]
//        for each plugin in record.plugins:
//          outcome = cascade(plugin, marketplace, locations, installedPlugin)
//                    // cascade is opts.cascade ?? cascadeUnstagePlugin (DI seam
//                    // for test determinism; zero runtime cost in production).
//          if (outcome.ok): delete record.plugins[plugin]; track successfullyUnstaged
//          else:            failedPlugins.push({name, cause})  // D-02 / D-03 fail-fast per plugin
//        if (failedPlugins.length === 0): delete state.marketplaces[name]
//      })
//   3. POST-STATE cleanup (after guard returns):
//        - per-plugin data dirs (always)
//        - marketplace data dir + GitHub clone dir (ONLY when failedPlugins.length === 0; MR-7)
//        - cleanup failures are SWALLOWED silently per D-18-01.
//   4. Compose user-visible output via one `notify(opts.ctx, opts.pi, ...)` call.
//
// D-02: hand-rolled try/catch loop (NOT the phase-ledger runner).
// D-03 corollary: per-plugin order mirrors PU-1 (skills → commands → agents → MCP).

import { rm } from "node:fs/promises";

import { locationsFor } from "../../persistence/locations.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
  resolveScopeFromState,
} from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { PluginFailedMessage, PluginUninstalledMessage, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface RemoveMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly name: string;
  /** When omitted, resolveScopeFromState picks the scope; project takes precedence if found in both. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /**
   * D-12-style injection seam for the per-plugin cascade primitive. Defaults
   * to `cascadeUnstagePlugin` from `./shared.ts`. Tests inject a stub that
   * deterministically forces per-plugin outcomes (e.g. forced failure for
   * MR-4 / MR-7 coverage). Zero runtime cost in production: a single `??`
   * fallback.
   */
  readonly cascade?: typeof cascadeUnstagePlugin;
}

async function removePath(pathPromise: Promise<string>): Promise<void> {
  // D-18-01 precedent (Plan 18-04 cleanup-leak DROP): the cleanup `rm()`
  // call still runs (correctness preserved); failures are swallowed
  // silently because the V2 `MarketplaceNotificationMessage` type has no
  // field to surface "cleanup leak after successful state mutation".
  // Nothing surfaces these cleanup failures to the user.
  try {
    await rm(await pathPromise, { recursive: true, force: true });
  } catch {
    // Cleanup is a hygienic concern, not part of the state contract.
    // Per D-18-01: never the primary user-facing failure path.
  }
}

/**
 * Narrow a per-plugin cascade Error.cause to a closed-set Reason for
 * the failed-plugin children block.
 *
 * Narrow a per-plugin cascade Error.cause to a closed-set Reason by
 * dispatching on the typed cause (`AgentsUnstageFailureError` or
 * `NodeJS.ErrnoException.code`) rather than substring-matching message text.
 * Falls back to `"not in manifest"` as the permissive default when no
 * typed case matches; bare-Error substring branches are a defensive last
 * resort for cases where the error was already serialised into a notes string.
 */
function narrowCascadeFailure(cause: Error): Reason {
  if (cause instanceof AgentsUnstageFailureError) {
    // No closed-set Reason captures the per-agent foreign-content
    // failure mode today; map to the documented permissive fallback
    // until the catalog UAT shows a new REASONS member is justified
    // No closed-set Reason maps to this failure mode yet; the fallback
    // requires a catalog UAT precedent + grammar sync before a new member is added.
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
        // Other errno codes fall through to the textual fallback so
        // any future-classified error surface can still be picked up
        // by the substring branches below before landing on the
        // permissive default.
        break;
    }
  }

  // Defensive textual fallback: bridges may still throw bare `Error`
  // with diagnostic messages for `unreadable` / `unparseable` /
  // `not in manifest` conditions. These branches are retained as a
  // defense-in-depth last resort -- never as the primary
  // classification path. A future audit may show them dead and they
  // can be deleted.
  const text = `${cause.name} ${cause.message}`.toLowerCase();
  if (text.includes("unreadable")) {
    return "unreadable";
  }

  if (text.includes("unparseable")) {
    return "unparseable";
  }

  if (text.includes("not in manifest")) {
    return "not in manifest";
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

export async function removeMarketplace(opts: RemoveMarketplaceOptions): Promise<void> {
  const cascade = opts.cascade ?? cascadeUnstagePlugin;

  // MR-1: resolve scope when --scope omitted; throws on ambiguity / not-found.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const resolved =
    opts.scope === undefined
      ? await resolveScopeFromState(opts.name, userLocations, projectLocations)
      : {
          scope: opts.scope,
          locations: opts.scope === "user" ? userLocations : projectLocations,
        };
  const { locations } = resolved;

  // Per-plugin tracking accumulators captured by the guard closure.
  const failedPlugins: { name: string; cause: Error }[] = [];
  const successfullyUnstaged: string[] = []; // plugins whose cascade returned ok:true
  let sourceKindAtRecord: "github" | "path" | "unknown" | undefined;

  await withStateGuard(locations, async (state) => {
    const record = state.marketplaces[opts.name];
    if (record === undefined) {
      throw new MarketplaceNotFoundError(opts.name, [resolved.scope]);
    }

    const src = record.source as { kind?: unknown };
    if (src.kind === "github" || src.kind === "path" || src.kind === "unknown") {
      sourceKindAtRecord = src.kind;
    }

    // D-02: hand-rolled try/catch per plugin. NOT the phase-ledger runner --
    // MR-3 requires continuation across plugin failures.
    //
    // WR-01: state mutation (delete record.plugins[pluginName]) is folded
    // into THIS loop. Previously a second loop ran the deletes after
    // cascade aggregation -- correct only because cascade is fail-soft
    // (always returns ok:false rather than throwing). Inlining removes
    // that dependency: if cascade ever changes to throw, only the
    // already-cleaned entries are persisted because withStateGuard saves
    // on no-throw.
    for (const [pluginName, plugin] of Object.entries(record.plugins)) {
      const outcome = await cascade(pluginName, opts.name, locations, plugin);
      if (outcome.ok) {
        successfullyUnstaged.push(pluginName);

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
        delete record.plugins[pluginName];
      } else {
        // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
        const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

        // Phase 39 TR-03: non-AG-5 partial-failure path filters
        // plugin.resources.* by outcome.dropped.* so the persisted row
        // reflects only artifacts still on disk (no ghost record).
        // AG-5 (AgentsUnstageFailureError) preserves the row INTACT --
        // foreign content owned by another process must not cause data
        // loss. The loop never throws; the guard's trailing saveState
        // commits the shrunken record alongside successfully-removed
        // plugin deletes.
        //
        // CRITICAL field-name mapping: dropped.commands populates from
        // resources.prompts (cascade primitive shared.ts:339), so the
        // filter MUST wire dropped.commands -> resources.prompts.
        if (!(cause instanceof AgentsUnstageFailureError)) {
          const dropped = outcome.dropped;
          plugin.resources.skills = plugin.resources.skills.filter(
            (n) => !dropped.skills.includes(n),
          );
          plugin.resources.prompts = plugin.resources.prompts.filter(
            (n) => !dropped.commands.includes(n),
          );
          plugin.resources.agents = plugin.resources.agents.filter(
            (n) => !dropped.agents.includes(n),
          );
          plugin.resources.mcpServers = plugin.resources.mcpServers.filter(
            (n) => !dropped.mcpServers.includes(n),
          );
        }

        failedPlugins.push({ name: pluginName, cause });
      }
    }

    if (failedPlugins.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
      delete state.marketplaces[opts.name];
    }
  });

  // D-03-INV (Plan 06-05): post-state-commit completion-cache cleanup.
  // The marketplace-names cache and per-marketplace plugin cache file must be
  // unlinked because the marketplace set changed and this marketplace is gone.
  // Cache cleanup is a hygienic concern, not a contract.
  //
  // Cache-refresh failures are swallowed. The underlying calls still run;
  // there is no notification shape for "cache failure after a successful
  // state mutation".
  try {
    await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, resolved.scope);
    const cachePath = await locations.pluginCacheFile(opts.name);
    await dropMarketplaceCache(cachePath, resolved.scope, opts.name);
  } catch {
    // Per D-18-01: cache cleanup hygiene never the primary user-facing path.
  }

  // POST-STATE cleanup (MR-5/MR-6/MR-7). Runs OUTSIDE the guard;
  // state.json already saved. Per D-18-01, individual cleanup failures
  // are swallowed by `removePath` (correctness of the `rm()` calls is
  // preserved; aggregation into a second `notifyWarning` is dropped).
  for (const cleaned of successfullyUnstaged) {
    await removePath(locations.pluginDataDir(opts.name, cleaned));
  }

  if (failedPlugins.length === 0) {
    await removePath(locations.marketplaceDataDir(opts.name));

    // MR-7: GitHub clone dirs retained when any plugin failed; here failedPlugins.length === 0.
    if (sourceKindAtRecord === "github") {
      await removePath(locations.sourceCloneDir(opts.name));
    }
  }

  // One MarketplaceNotificationMessage per outcome, emitted via one
  // notify(opts.ctx, opts.pi, ...) call; `plugins[]` carries one
  // PluginUninstalledMessage per successfully unstaged plugin (D-22-02).
  // Per-plugin `PluginFailedMessage.cause` renders at 4-space indent via
  // renderPluginRow. The
  //   marketplace-level `causeChainTrailer(err)` body is GONE.
  // - V1 `RETRY_ANCHOR` ("Fix the underlying issue and retry.") is
  //   DROPPED per D-17-09 (already excluded by the Phase 17 catalog).
  // - Severity (error on partial, info on clean) is computed by notify()
  // ; the `/reload to pick up changes` trailer is computed per
  //   D-22-01 (fires iff >=1 plugin row carries a state-change token);
  //   callers MUST NOT compose.
  // - Reference: catalog UAT `clean` + `partial` fixtures at
  //   tests/architecture/catalog-uat.test.ts:1154-1183.
  if (failedPlugins.length > 0) {
    // CMC-31 PARTIAL: mp.status="failed"; plugins[] mixes uninstalled +
    // failed (with per-plugin cause). Caller-order honored end-to-end:
    // successfullyUnstaged first, failed second.
    notify(opts.ctx, opts.pi, {
      marketplaces: [
        {
          name: opts.name,
          scope: resolved.scope,
          status: "failed",
          plugins: [
            ...successfullyUnstaged.map(
              (name): PluginUninstalledMessage => ({
                status: "uninstalled",
                name,
              }),
            ),
            ...failedPlugins.map(
              ({ name, cause }): PluginFailedMessage => ({
                status: "failed",
                name,
                reasons: [narrowCascadeFailure(cause)],
                cause,
              }),
            ),
          ],
        },
      ],
    });
    return;
  }

  // CMC-31 CLEAN (D-22-02): mp.status="removed"; plugins[] carries one
  // PluginUninstalledMessage per successfullyUnstaged plugin (○ icon). The
  // `/reload to pick up changes` trailer is computed by notify() per
  // D-22-01 and fires iff >=1 plugin was unstaged (an `uninstalled` row is
  // a Pi-visible state change). An empty remove leaves successfullyUnstaged
  // == [] -> plugins: [] -> header-only with no trailer (G-MIL-02).
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: opts.name,
        scope: resolved.scope,
        status: "removed",
        plugins: successfullyUnstaged.map(
          (name): PluginUninstalledMessage => ({
            status: "uninstalled",
            name,
          }),
        ),
      },
    ],
  });
}

/**
 * Quick task 260525-aub: test seam for the typed-cause cascade-failure
 * narrowing. Mirrors the `__test_outcomeToCascadeRow` re-export precedent
 * in `orchestrators/plugin/reinstall.ts`: the helper stays private to the
 * orchestrator while tests can exercise the `instanceof
 * AgentsUnstageFailureError` / `NodeJS.ErrnoException.code` dispatch
 * branches directly.
 */
export { narrowCascadeFailure as __test_narrowCascadeFailure };
