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
import { causeChainTrailer } from "../../presentation/cause-chain.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { MarketplaceNotFoundError, appendLeaks, errorMessage } from "../../shared/errors.ts";
import { notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { cascadeUnstagePlugin, resolveScopeFromState } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
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

function resourcesDropped(dropped: {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
  readonly mcpServers: readonly string[];
}): boolean {
  return (
    dropped.skills.length > 0 ||
    dropped.commands.length > 0 ||
    dropped.agents.length > 0 ||
    dropped.mcpServers.length > 0
  );
}

async function removePath(
  cleanupLeaks: string[],
  label: string,
  pathPromise: Promise<string>,
): Promise<void> {
  try {
    await rm(await pathPromise, { recursive: true, force: true });
  } catch (err) {
    cleanupLeaks.push(`${label}: ${errorMessage(err)}`);
  }
}

function failureWarning(
  name: string,
  failedPlugins: readonly { name: string; cause: Error }[],
): string {
  const lines: string[] = [`Marketplace "${name}" not fully removed.`, "", "Failed plugins:"];
  for (const f of failedPlugins) {
    // Compose the cause-chain trailer inline because this string is embedded
    // in a larger body (not passed through notifyError). The trailer prefix is
    // `cause: ` per MSG-CC-1; we render the plugin failure as
    // `  - <plugin>: <msg> (cause: <l1> -> <l2> ...)` so the existing
    // "Failed plugins:" block stays human-scannable.
    const trailer = causeChainTrailer(f.cause);
    const causeSuffix = trailer === "" ? "" : ` (${trailer})`;
    lines.push(`  - ${f.name}: ${errorMessage(f.cause)}${causeSuffix}`);
  }

  lines.push("", "Fix the underlying issue and retry.");
  return lines.join("\n");
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
        if (resourcesDropped(outcome.dropped)) {
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
  // The marketplace-names cache and per-marketplace plugin cache file must be
  // unlinked because the marketplace set changed and this marketplace is gone.
  // Failure routes through notifyWarning so the primary remove success surface
  // stays intact -- cache cleanup is a hygienic concern, not a contract.
  try {
    await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, resolved.scope);
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
  const cleanupLeaks: string[] = [];
  for (const cleaned of cleanedPluginNames) {
    await removePath(
      cleanupLeaks,
      `plugin data ${opts.name}/${cleaned}`,
      locations.pluginDataDir(opts.name, cleaned),
    );
  }

  if (failedPlugins.length === 0) {
    await removePath(
      cleanupLeaks,
      `marketplace data ${opts.name}`,
      locations.marketplaceDataDir(opts.name),
    );

    // MR-7: GitHub clone dirs retained when any plugin failed; here failedPlugins.length === 0.
    if (sourceKindAtRecord === "github") {
      await removePath(
        cleanupLeaks,
        `source clone ${opts.name}`,
        locations.sourceCloneDir(opts.name),
      );
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
  const realLeaks = cleanupLeaks;
  if (realLeaks.length > 0) {
    const aggregated = appendLeaks(
      new Error(
        `Marketplace removed but post-state cleanup failed for ${realLeaks.length} path(s).`,
      ),
      realLeaks,
    );
    // notifyWarning does NOT auto-append the cause-chain trailer (only
    // notifyError does -- D-CMC-12). Compose inline so the user still sees
    // the chained leaks per MR-6.
    const trailer = causeChainTrailer(aggregated);
    const body =
      trailer === "" ? errorMessage(aggregated) : `${errorMessage(aggregated)}\n\n${trailer}`;
    notifyWarning(opts.ctx, body);
    return;
  }

  // MR-4 / MR-3: ONE aggregated warning notification when ANY plugin failed.
  if (failedPlugins.length > 0) {
    notifyWarning(opts.ctx, failureWarning(opts.name, failedPlugins));
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

  // MSG-RH-1 / MR-8: reload hint emitted iff at least one plugin's
  // resources were actually removed.
  const hint = reloadHint(removedSorted);
  notifySuccess(opts.ctx, appendReloadHint(body, hint));
}
