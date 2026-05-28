// orchestrators/marketplace/remove.ts
//
// MR-1..8 + RH-1/RH-5 composition + NFR-5 (no network).
//
// Phase 18 / Plan 18-04: V1 -> V2 migration. User-visible surface is now
// a single `notify(opts.ctx, opts.pi, ...)` call per outcome:
//
//   - CLEAN success: one `MarketplaceNotificationMessage{ status:"removed",
//     plugins: [] }`. The `/reload to pick up changes` trailer is computed
//     by `notify()` per D-16-12 (mp.status "removed" is state-changing) and
//     fires whether or not plugins were removed. Severity = info (no 2nd
//     arg). The V1 contract distinction "no reload-hint when no plugin
//     resources changed" is deliberately retired in V2 per D-16-12.
//   - PARTIAL failure (D-18-03 cascade restructure): one
//     `MarketplaceNotificationMessage{ status:"failed", plugins: [...] }`
//     whose `plugins[]` mixes `PluginUninstalledMessage` (the successful
//     unstages, ○ icon) and `PluginFailedMessage{ cause?: Error }` (the
//     failed unstages, ⊘ icon). Per-plugin `cause` MOVES from V1's
//     marketplace-level `causeChainTrailer(err)` body to per-row
//     `PluginFailedMessage.cause`, rendered at 4-space indent below each
//     failed plugin row per D-16-08. The V1 free-text retry-anchor
//     trailer ("Fix the underlying issue and retry.") is DROPPED per
//     D-17-09 (already excluded by the Phase 17 catalog rewrite).
//     Severity = error (any plugin/mp failed per D-16-11). Reload-hint
//     fires because at least one plugin status is `"uninstalled"` per
//     D-16-12.
//   - Post-state cleanup leaks (MR-6) and completion-cache cleanup leaks:
//     DROPPED per D-18-01 (parallel to D-17-09 + add.ts pilot). The
//     underlying `rm()` calls inside the try/catch blocks STILL RUN
//     (correctness preserved); only the user-visible `notifyWarning`
//     vanishes because the V2 `MarketplaceNotificationMessage` type has
//     no field representing "cleanup leak after successful state
//     mutation" (folding into `status: "failed"` would misrepresent the
//     operation; a second `notify()` call after the primary would double
//     severity routing without a catalog fixture to gate against).
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
  // The `label` accumulator that V1 fed into a second `notifyWarning`
  // call is gone; nothing surfaces these failures to the user.
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
  // D-18-01 precedent (Plan 18-04 cleanup-leak DROP): cache-refresh
  // failures are swallowed silently in V2. The underlying `dropMarketplaceCache`
  // / `invalidateMarketplaceNames` calls STILL RUN (correctness preserved);
  // only the user-facing V1 `notifyWarning("...cache cleanup deferred...")`
  // disappears because the V2 `MarketplaceNotificationMessage` type has no
  // field to surface "cleanup leak after successful state mutation".
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

  // NotificationMessage construction recipe (Plan 18-04; mirrors the
  // Wave 1 pilot at orchestrators/marketplace/add.ts:160-169).
  // - One MarketplaceNotificationMessage per outcome, emitted via one
  //   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
  // - V2 cascade per D-18-03: per-plugin `PluginFailedMessage.cause`
  //   renders at 4-space indent via renderPluginRow (D-16-08). The V1
  //   marketplace-level `causeChainTrailer(err)` body is GONE.
  // - V1 `RETRY_ANCHOR` ("Fix the underlying issue and retry.") is
  //   DROPPED per D-17-09 (already excluded by the Phase 17 catalog).
  // - Severity (error on partial, info on clean) and `/reload to pick up
  //   changes` are computed by notify() per D-16-11 + D-16-12; callers
  //   MUST NOT compose.
  // - Reference: catalog UAT `clean` + `partial` fixtures at
  //   tests/architecture/catalog-uat.test.ts:1154-1183.
  if (failedPlugins.length > 0) {
    // CMC-31 PARTIAL: mp.status="failed"; plugins[] mixes uninstalled +
    // failed (with per-plugin cause). Caller-order honored end-to-end:
    // successfullyUnstaged first, failed second (D-16-06).
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

  // CMC-31 CLEAN: mp.status="removed"; empty plugins[]. Reload-hint
  // fires from `mp.status === "removed"` per D-16-12, regardless of
  // whether any plugin resources were actually removed (deliberate
  // V2 contract change vs V1 per RESEARCH Risks #7).
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: opts.name,
        scope: resolved.scope,
        status: "removed",
        plugins: [],
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
