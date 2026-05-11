// orchestrators/marketplace/remove.ts
//
// MR-1..8 + RH-1/RH-5 composition + NFR-5 (no network).
//
// Flow:
//   1. resolveScopeFromState(name, userLocs, projectLocs) when --scope omitted (MR-1).
//   2. withStateGuard(locations, async (state) => {
//        record = state.marketplaces[name]
//        for each plugin in record.plugins:
//          outcome = cascade(plugin, marketplace, locations, installedPlugin)
//                    // cascade is opts.cascade ?? cascadeUnstagePlugin (DI seam
//                    // for test determinism; zero runtime cost in production).
//          if (outcome.ok): delete record.plugins[plugin]; track dropped + removedPlugins
//          else:            failedPlugins.push({name, cause})  // D-02 / D-03 fail-fast per plugin
//        if (failedPlugins.length === 0): delete state.marketplaces[name]
//      })
//   3. POST-STATE cleanup (after guard returns):
//        - per-plugin data dirs (always)
//        - marketplace data dir + GitHub clone dir (ONLY when failedPlugins.length === 0; MR-7)
//        - aggregate leaks into one error per MR-6
//   4. Compose user-visible output:
//        - if failedPlugins: ONE notifyWarning ending with the canonical retry trailer (MR-4)
//        - else: notifySuccess body + soft-dep warnings (RH-5) + trailing reload hint (RH-1, verb 'drop')
//
// D-02: hand-rolled try/catch loop (NOT the phase-ledger runner).
// D-03 corollary: per-plugin order mirrors PU-1 (skills → commands → agents → MCP).
//
// Note (Rule 1 deviation from plan's verbatim snippet): the soft-dep helpers
// `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` accept
// `pi: ExtensionAPI`, NOT `ctx: ExtensionContext` (see soft-dep.ts header
// note -- `getAllTools()` lives on `ExtensionAPI`, not `ExtensionContext`).
// The plan's verbatim snippet passed `opts.ctx`, which fails type-checking.
// We surface this by adding `pi: ExtensionAPI` to RemoveMarketplaceOptions
// and passing `opts.pi` to the helpers.

import { rm } from "node:fs/promises";

import { locationsFor } from "../../persistence/locations.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { MarketplaceNotFoundError, appendLeaks, errorMessage } from "../../shared/errors.ts";
import { notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { cascadeUnstagePlugin, formatErrorWithCauses, resolveScopeFromState } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

export interface RemoveMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly name: string;
  /** When omitted, resolveScopeFromState picks the scope; ambiguity throws. */
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

export async function removeMarketplace(opts: RemoveMarketplaceOptions): Promise<void> {
  const cascade = opts.cascade ?? cascadeUnstagePlugin;

  // MR-1: resolve scope when --scope omitted; throws on ambiguity / not-found.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const resolved =
    opts.scope !== undefined
      ? {
          scope: opts.scope,
          locations: opts.scope === "user" ? userLocations : projectLocations,
        }
      : await resolveScopeFromState(opts.name, userLocations, projectLocations);
  const { locations } = resolved;

  // Per-plugin tracking accumulators captured by the guard closure.
  const failedPlugins: { name: string; cause: Error }[] = [];
  const cleanedPluginNames: string[] = [];
  const removedPlugins: string[] = []; // plugins whose resources were ACTUALLY removed (MR-8 gate)
  const dropped = {
    skills: [] as string[],
    commands: [] as string[],
    agents: [] as string[],
    mcpServers: [] as string[],
  };
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
        cleanedPluginNames.push(pluginName);
        // RH-1: only count plugins whose resources actually changed.
        if (
          outcome.dropped.skills.length > 0 ||
          outcome.dropped.commands.length > 0 ||
          outcome.dropped.agents.length > 0 ||
          outcome.dropped.mcpServers.length > 0
        ) {
          removedPlugins.push(pluginName);
        }

        dropped.skills.push(...outcome.dropped.skills);
        dropped.commands.push(...outcome.dropped.commands);
        dropped.agents.push(...outcome.dropped.agents);
        dropped.mcpServers.push(...outcome.dropped.mcpServers);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
        delete record.plugins[pluginName];
      } else {
        // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
        const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);
        failedPlugins.push({ name: pluginName, cause });
      }
    }

    if (failedPlugins.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
      delete state.marketplaces[opts.name];
    }
  });

  // D-03-INV (Plan 06-05): post-state-commit completion-cache cleanup.
  // The marketplace-names cache is memory-only; the per-marketplace plugin
  // cache file must be unlinked because the marketplace itself is gone
  // (no rebuild path can recover it). Failure routes through notifyWarning
  // so the primary remove success surface stays intact -- cache cleanup is
  // a hygienic concern, not a contract.
  try {
    invalidateMarketplaceNames(resolved.scope);
    const cachePath = await locations.pluginCacheFile(opts.name);
    await dropMarketplaceCache(cachePath, resolved.scope, opts.name);
  } catch (err) {
    notifyWarning(
      opts.ctx,
      `Marketplace "${opts.name}" removed; completion cache cleanup deferred: ${errorMessage(err)}`,
    );
  }

  // POST-STATE cleanup (MR-5/MR-6/MR-7). Runs OUTSIDE the guard;
  // state.json already saved.
  const cleanupLeaks: (string | undefined)[] = [];
  for (const cleaned of cleanedPluginNames) {
    try {
      await rm(await locations.pluginDataDir(opts.name, cleaned), {
        recursive: true,
        force: true,
      });
    } catch (err) {
      cleanupLeaks.push(`plugin data ${opts.name}/${cleaned}: ${errorMessage(err)}`);
    }
  }

  if (failedPlugins.length === 0) {
    try {
      await rm(await locations.marketplaceDataDir(opts.name), {
        recursive: true,
        force: true,
      });
    } catch (err) {
      cleanupLeaks.push(`marketplace data ${opts.name}: ${errorMessage(err)}`);
    }

    // MR-7: GitHub clone dirs retained when any plugin failed; here failedPlugins.length === 0.
    if (sourceKindAtRecord === "github") {
      try {
        await rm(await locations.sourceCloneDir(opts.name), {
          recursive: true,
          force: true,
        });
      } catch (err) {
        cleanupLeaks.push(`source clone ${opts.name}: ${errorMessage(err)}`);
      }
    }
  }

  // MR-6: aggregate leaks into one user-visible warning.
  //
  // WR-02: state.json has already been saved by withStateGuard --
  // throwing here would propagate to the edge layer and get translated
  // into a user-visible error, despite state being committed. The MR-6
  // contract is "marketplace removed BUT cleanup failed", which is a
  // warning, not an error. Use ctx.ui.notify with severity 'warning'
  // (IL-2) and return cleanly so callers can chain.
  const realLeaks = cleanupLeaks.filter((l): l is string => l !== undefined);
  if (realLeaks.length > 0) {
    const aggregated = appendLeaks(
      new Error(
        `Marketplace removed but post-state cleanup failed for ${realLeaks.length} path(s).`,
      ),
      realLeaks,
    );
    notifyWarning(opts.ctx, formatErrorWithCauses(aggregated));
    return;
  }

  // MR-4 / MR-3: ONE aggregated warning notification when ANY plugin failed.
  if (failedPlugins.length > 0) {
    const lines: string[] = [
      `Marketplace "${opts.name}" not fully removed.`,
      "",
      "Failed plugins:",
    ];
    for (const f of failedPlugins) {
      lines.push(`  - ${f.name}: ${formatErrorWithCauses(f.cause)}`);
    }

    lines.push("");
    lines.push("Fix the underlying issue and retry.");
    notifyWarning(opts.ctx, lines.join("\n"));
    return;
  }

  // SUCCESS path: compose body + soft-dep warnings (RH-5) + trailing
  // reload hint (RH-1, RH-2 verb 'drop' with alphabetically-sorted names).
  const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
  const baseBody =
    removedSorted.length > 0
      ? `Removed marketplace "${opts.name}" from ${resolved.scope} scope. Dropped plugins: ${removedSorted.join(", ")}.`
      : `Removed marketplace "${opts.name}" from ${resolved.scope} scope.`;

  // RH-5 soft-dep warnings (BEFORE the reload hint). Helpers take ExtensionAPI
  // (not ExtensionContext) -- see header note.
  const subagentWarn = subagentWarningIfNeeded(opts.pi, dropped.agents);
  const mcpWarn = mcpAdapterWarningIfNeeded(opts.pi, dropped.mcpServers);
  let body = baseBody;
  if (subagentWarn !== "") {
    body = `${body}\n${subagentWarn}`;
  }

  if (mcpWarn !== "") {
    body = `${body}\n${mcpWarn}`;
  }

  // RH-1 / MR-8: reload hint with verb 'drop' iff at least one plugin's
  // resources were actually removed.
  const hint = reloadHint("drop", removedSorted);
  notifySuccess(opts.ctx, appendReloadHint(body, hint));
}
