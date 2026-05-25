// orchestrators/marketplace/remove.ts
//
// MR-1..8 + RH-1/RH-5 composition + NFR-5 (no network).
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01): CMC-31 / CMC-15 /
// CMC-16 / CMC-13 migration. The user-visible surface is now:
//
//   - CLEAN success (no plugin-unstage failures): a single bare
//     `MarketplaceRow{status:"removed"}` row + reload-hint trailer when
//     at least one plugin's resources were actually removed. The
//     legacy `Removed marketplace "X" from <scope> scope.` sentence
//     and the inline `Dropped plugins: ...` enumeration are RETIRED.
//   - PARTIAL failure (CMC-31): header `MarketplaceRow{status:"failed",
//     reasons:["plugins remain"]}` + indented `PluginCascadeRow[]`
//     children for each failed plugin (via `cascadeSummary`). The
//     successful unstages render with `(uninstalled)` status (○ icon
//     -- the plugin no longer is installed); the failed unstages
//     render with `(failed) {<narrowed reason>}` + `⊘` icon.
//   - CMC-15 dual trailer on partial failure: when at least one plugin
//     successfully unstaged, BOTH `/reload to pick up changes` (MSG-RH-1)
//     AND `Fix the underlying issue and retry.` (free-form §18.2 retry
//     anchor) fire, one blank line between each, reload above retry.
//     When every plugin failed, the reload trailer is suppressed and
//     the retry anchor stands alone.
//   - CMC-16: post-state cleanup leaks (MR-6) surface as a separate
//     `notifyWarning` (sentence form; cleanup is an out-of-band hygienic
//     concern, not a cascade outcome). Manual-recovery anchors are not
//     currently emitted by mp remove because no system-level resource
//     (agent index, state.json) participates in this code path. Phase 14
//     D-14-02 centralized the CMC-16 emission in `orchestrators/plugin/
//     reinstall.ts` (the only production surface that catches
//     `ManualRecoveryError`); the historical dead-code import hedge this
//     file carried is gone. If a future deviation surfaces a
//     ManualRecoveryError on the marketplace-remove path, the import +
//     emission can be added at that time.
//
// Severity routing: clean -> notifySuccess; partial -> notifyWarning
// (via the `cascadeSummary` literal-union dispatch; MSG-SR-6 forbids
// notifyError on cascade summaries). Post-state cleanup leak -> dedicated
// notifyWarning. The aggregated soft-dep trailer is GONE; per-row markers
// would attach to the `PluginCascadeRow` children if those rows ever
// carry `declaresAgents/Mcp` predicates. Today the per-plugin cascade
// returns only success/failure flags (no per-plugin manifest replay), so
// CMC-13 markers don't fire on this surface -- the user sees soft-dep
// markers on subsequent install/update flows instead.
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
//        - aggregate leaks into one warning per MR-6 (separate notifyWarning)
//   4. Compose user-visible output via the Wave 1 primitives:
//        - failedPlugins.length > 0 -> CMC-31 partial form + CMC-15 dual trailer
//        - else -> CMC-31 clean bare-row form + MR-8 reload-hint
//
// D-02: hand-rolled try/catch loop (NOT the phase-ledger runner).
// D-03 corollary: per-plugin order mirrors PU-1 (skills → commands → agents → MCP).

import { rm } from "node:fs/promises";

import { locationsFor } from "../../persistence/locations.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { causeChainTrailer } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { MarketplaceNotFoundError, appendLeaks, errorMessage } from "../../shared/errors.ts";
import { notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
  resolveScopeFromState,
} from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  MarketplaceRow,
  PluginCascadeRow,
  SoftDepProbe,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
import type { Scope } from "../../shared/types.ts";

// CMC-15 (free-form §18.2): retry anchor literal. Pinned here because
// it's the single source of the partial-failure retry trailer.
const RETRY_ANCHOR = "Fix the underlying issue and retry.";

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

/**
 * Narrow a per-plugin cascade Error.cause to a closed-set Reason for
 * the failed-plugin children block.
 *
 * Quick task 260525-aub: dispatch on the typed cause (`AgentsUnstageFailureError`
 * or `NodeJS.ErrnoException.code`) instead of substring-matching the
 * `.message` text. The closed-set `"permission denied"` / `"source missing"`
 * Reasons are members added in Phase 13 Wave 3 plan 13-03-01 per the
 * catalog UAT precedent. The fallback is `"not in manifest"` as the
 * documented permissive default. Bridges that throw bare `Error` with
 * `unreadable`/`unparseable` substrings still surface via the legacy
 * text fallback as a defensive last resort; if a future deviation shows
 * those substring branches are dead code they can be deleted in a
 * follow-up.
 */
function narrowCascadeFailure(cause: Error): Reason {
  if (cause instanceof AgentsUnstageFailureError) {
    // No closed-set Reason captures the per-agent foreign-content
    // failure mode today; map to the documented permissive fallback
    // until the catalog UAT shows a new REASONS member is justified
    // (per Phase 13 D-CMC-11 the addition requires a frontmatter +
    // grammar drift sync).
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
  const cleanedPluginNames: string[] = [];
  const removedPlugins: string[] = []; // plugins whose resources were ACTUALLY removed (MR-8 gate)
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
        successfullyUnstaged.push(pluginName);
        // RH-1: only count plugins whose resources actually changed.
        if (resourcesDropped(outcome.dropped)) {
          removedPlugins.push(pluginName);
        }

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
  if (cleanupLeaks.length > 0) {
    const aggregated = appendLeaks(
      new Error(
        `Marketplace removed but post-state cleanup failed for ${cleanupLeaks.length.toString()} path(s).`,
      ),
      cleanupLeaks,
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

  const probe: SoftDepProbe = softDepStatus(opts.pi);

  // CMC-31 PARTIAL form: at least one plugin failed to unstage.
  // Render the marketplace header `(failed) {plugins remain}` + the
  // children rows via cascadeSummary; layer the CMC-15 dual trailer.
  if (failedPlugins.length > 0) {
    const headerRow: MarketplaceRow = {
      kind: "marketplace",
      name: opts.name,
      scope: resolved.scope,
      outcomeClass: "failure",
      status: "failed",
      reasons: ["plugins remain"],
    };

    const childRows: PluginCascadeRow[] = [
      ...successfullyUnstaged.map<PluginCascadeRow>((pluginName) => ({
        kind: "plugin-cascade",
        name: pluginName,
        scope: resolved.scope,
        status: "uninstalled",
      })),
      ...failedPlugins.map<PluginCascadeRow>((fp) => ({
        kind: "plugin-cascade",
        name: fp.name,
        scope: resolved.scope,
        status: "failed",
        reasons: [narrowCascadeFailure(fp.cause)],
      })),
    ];

    const { message } = cascadeSummary({ marketplace: headerRow, rows: childRows, probe });

    // CMC-15 dual trailer: reload-hint above retry-anchor, blank line
    // between each. Reload-hint fires iff at least one plugin's
    // resources were actually removed; retry-anchor always fires on
    // the partial path.
    const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
    const reloadTrailer = reloadHint(removedSorted);
    let body = appendReloadHint(message, reloadTrailer);
    body = `${body}\n\n${RETRY_ANCHOR}`;
    notifyWarning(opts.ctx, body);
    return;
  }

  // CMC-31 CLEAN form: single bare `MarketplaceRow{status:"removed"}`
  // row + RH-1 reload-hint trailer when any plugin's resources changed.
  const cleanRow: MarketplaceRow = {
    kind: "marketplace",
    name: opts.name,
    scope: resolved.scope,
    outcomeClass: "ok",
    status: "removed",
  };
  const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
  const hint = reloadHint(removedSorted);
  notifySuccess(opts.ctx, appendReloadHint(renderRow(cleanRow, probe), hint));
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
