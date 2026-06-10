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
import { loadState } from "../../persistence/state-io.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { errorMessage, MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
  resolveScopeOrNotifyNotAdded,
} from "./shared.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginUninstalledMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-03 (Phase 55 Plan 01): controls how `removeMarketplace` surfaces
 * notifications. Mirrors `AddMarketplaceNotifications`.
 *
 * - `"standalone"` (default when option is omitted): byte-identical to today.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `RemoveMarketplaceOutcome` for `applyReconcile` to aggregate (IL-2).
 */
export type RemoveMarketplaceNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `removeMarketplace` in
 * orchestrated mode. The success arm carries the names of the plugin rows
 * the cascade successfully unstaged so the apply renderer can compose the
 * per-row `(uninstalled)` plugin lines. Cleanup-leak warnings are dropped
 * per D-18-01 -- the orchestrated outcome surface mirrors standalone's
 * silence on post-state cleanup hiccups.
 */
/**
 * `reason` is typed as `Reason` (not `ContentReason`) so the orchestrated
 * `"not added"` arm (missing marketplace, MarketplaceNotFoundError) can
 * surface its structural sentinel through the same field. Mirrors the
 * `AddMarketplaceOutcome` shape note.
 */
export type RemoveMarketplaceOutcome =
  | { readonly status: "removed"; readonly name: string; readonly unstaged: readonly string[] }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

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
  /**
   * RECON-03 (Phase 55 Plan 01): notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- byte-identical to today.
   */
  readonly notifications?: RemoveMarketplaceNotifications;
}

async function removePath(pathPromise: Promise<string>): Promise<void> {
  // D-18-01: the cleanup `rm()` call still runs (correctness preserved);
  // failures are swallowed silently because the
  // `MarketplaceNotificationMessage` type has no field to surface
  // "cleanup leak after successful state mutation".
  // Nothing surfaces these cleanup failures to the user.
  try {
    await rm(await pathPromise, { recursive: true, force: true });
  } catch {
    // Cleanup is a hygienic concern, not part of the state contract.
    // Per D-18-01: never the primary user-facing failure path.
  }
}

/**
 * Narrow a per-plugin cascade Error.cause to a closed-set Reason for the
 * failed-plugin children block by dispatching on the typed cause
 * (`AgentsUnstageFailureError` or `NodeJS.ErrnoException.code`) rather than
 * substring-matching message text. Falls back to `"not in manifest"` as the
 * permissive default when no typed case matches; bare-Error substring branches
 * are a defensive last resort for cases where the error was already serialised
 * into a notes string.
 */
function narrowCascadeFailure(cause: Error): ContentReason {
  if (cause instanceof AgentsUnstageFailureError) {
    // No closed-set Reason captures the per-agent foreign-content failure
    // mode today; map to the documented permissive fallback. Adding a new
    // REASONS member requires a catalog UAT precedent + grammar sync.
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

/**
 * RECON-03: orchestrated-mode mirror of `resolveScopeOrNotifyNotAdded` that
 * returns a typed `RemoveMarketplaceOutcome` for the not-added case instead
 * of firing the standalone notify() side effect. Same project-then-user
 * precedence as the helper (CMP-5).
 */
async function resolveScopeOrFailedOutcome(
  opts: RemoveMarketplaceOptions,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations } | RemoveMarketplaceOutcome> {
  if (opts.scope === undefined) {
    const [userState, projectState] = await Promise.all([
      loadState(userLocations.extensionRoot),
      loadState(projectLocations.extensionRoot),
    ]);
    if (opts.name in projectState.marketplaces) {
      return { scope: "project", locations: projectLocations };
    }

    if (opts.name in userState.marketplaces) {
      return { scope: "user", locations: userLocations };
    }

    const err = new MarketplaceNotFoundError(opts.name, ["project", "user"]);
    return { status: "failed", reason: "not added", error: err, cause: errorMessage(err) };
  }

  const candLocations = opts.scope === "user" ? userLocations : projectLocations;
  const preState = await loadState(candLocations.extensionRoot);
  if (preState.marketplaces[opts.name] === undefined) {
    const err = new MarketplaceNotFoundError(opts.name, [opts.scope]);
    return { status: "failed", reason: "not added", error: err, cause: errorMessage(err) };
  }

  return { scope: opts.scope, locations: candLocations };
}

/**
 * RECON-03: route the partial-failure (≥1 plugin cascade failure) arm to
 * either a typed orchestrated outcome OR the standalone notify() row.
 * Extracted from `removeMarketplace` to keep its cognitive complexity
 * inside the project's lint budget.
 */
function emitPartialFailure(args: {
  opts: RemoveMarketplaceOptions;
  orchestrated: boolean;
  resolvedScope: Scope;
  successfullyUnstaged: readonly string[];
  failedPlugins: readonly { name: string; cause: Error }[];
}): RemoveMarketplaceOutcome | undefined {
  const { opts, orchestrated, resolvedScope, successfullyUnstaged, failedPlugins } = args;
  if (orchestrated) {
    // Collapse the per-plugin partial-failure surface to ONE typed outcome.
    // The apply cascade caller (Plan 02) composes per-plugin rows from its
    // own bucket walk; here we surface the first failed plugin's classified
    // reason as the marketplace-level failure reason.
    const first = failedPlugins[0];
    const err = first?.cause ?? new Error(`removeMarketplace: partial failure for "${opts.name}"`);
    const firstReason: Reason =
      first === undefined ? "unreadable" : narrowCascadeFailure(first.cause);
    return { status: "failed", reason: firstReason, error: err, cause: errorMessage(err) };
  }

  // CMC-31 PARTIAL: mp.status="failed"; plugins[] mixes uninstalled +
  // failed (with per-plugin cause). Caller-order honored end-to-end:
  // successfullyUnstaged first, failed second.
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: opts.name,
        scope: resolvedScope,
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
  return undefined;
}

/**
 * RECON-03: returns `RemoveMarketplaceOutcome` in orchestrated mode and
 * `undefined` in standalone mode.
 */
export async function removeMarketplace(
  opts: RemoveMarketplaceOptions,
): Promise<RemoveMarketplaceOutcome | undefined> {
  const cascade = opts.cascade ?? cascadeUnstagePlugin;
  // RECON-03: orchestrated mode suppresses every notify() call and returns the
  // typed outcome instead. Standalone (default/omitted) preserves byte-identity.
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // MR-1 + ATTR-06: resolve scope and enforce the missing-marketplace
  // precondition. On a miss the helper has already emitted the standalone
  // `(failed) {not added}` variant, so return without entering the guard.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);

  let resolved: { scope: Scope; locations: ScopedLocations };
  if (orchestrated) {
    const r = await resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);
    if ("status" in r) {
      return r;
    }

    resolved = r;
  } else {
    const r = await resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);
    if (r === undefined) {
      return undefined;
    }

    resolved = r;
  }

  const { locations } = resolved;

  // Per-plugin tracking accumulators captured by the guard closure.
  const failedPlugins: { name: string; cause: Error }[] = [];
  const successfullyUnstaged: string[] = []; // plugins whose cascade returned ok:true
  let sourceKindAtRecord: "github" | "path" | "unknown" | undefined;

  await withStateGuard(locations, async (state) => {
    const record = state.marketplaces[opts.name];
    if (record === undefined) {
      // ATTR-06: the missing-marketplace precondition is handled by the
      // pre-guard existence check above (routed to the standalone `{not added}`
      // variant). Reaching here means the record was deleted between the
      // pre-guard read and this guard's fresh load (a concurrent removal) --
      // treat it as a no-op: return without mutating. withStateGuard still
      // calls saveState with the unmodified state (a harmless re-write of the
      // same content), and no raw MarketplaceNotFoundError escapes.
      return;
    }

    const src = record.source as { kind?: unknown };
    if (src.kind === "github" || src.kind === "path" || src.kind === "unknown") {
      sourceKindAtRecord = src.kind;
    }

    // D-02: hand-rolled try/catch per plugin. NOT the phase-ledger runner --
    // MR-3 requires continuation across plugin failures.
    //
    // WR-01: state mutation (delete record.plugins[pluginName]) is folded
    // into THIS loop. This removes any dependency on cascade being fail-soft:
    // if cascade ever changes to throw, only the already-cleaned entries are
    // persisted because withStateGuard saves on no-throw.
    for (const [pluginName, plugin] of Object.entries(record.plugins)) {
      const outcome = await cascade(pluginName, opts.name, locations, plugin);
      if (outcome.ok) {
        successfullyUnstaged.push(pluginName);

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
        delete record.plugins[pluginName];
      } else {
        // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
        const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

        // TR-03: non-AG-5 partial-failure path filters
        // plugin.resources.* by outcome.dropped.* so the persisted row
        // reflects only artifacts still on disk (no ghost record).
        // AG-5 (AgentsUnstageFailureError) preserves the row INTACT --
        // foreign content owned by another process must not cause data
        // loss. The loop never throws; the guard's trailing saveState
        // commits the shrunken record alongside successfully-removed
        // plugin deletes.
        //
        // CRITICAL field-name mapping: dropped.commands populates from
        // resources.prompts (in the cascade primitive in shared.ts), so the
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

  // D-03-INV: post-state-commit completion-cache cleanup.
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
  // renderPluginRow. There is no marketplace-level cause-chain trailer.
  // - No retry anchor is emitted per D-17-09.
  // - Severity (error on partial, info on clean) is computed by notify()
  // ; the `/reload to pick up changes` trailer is computed per
  //   D-22-01 (fires iff >=1 plugin row carries a state-change token);
  //   callers MUST NOT compose.
  // - Reference: catalog UAT `clean` + `partial` fixtures.
  if (failedPlugins.length > 0) {
    return emitPartialFailure({
      opts,
      orchestrated,
      resolvedScope: resolved.scope,
      successfullyUnstaged,
      failedPlugins,
    });
  }

  if (orchestrated) {
    return { status: "removed", name: opts.name, unstaged: successfullyUnstaged };
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
  return undefined;
}

/**
 * Test seam for the typed-cause cascade-failure narrowing. Mirrors the
 * `__test_outcomeToCascadeRow` re-export precedent in
 * `orchestrators/plugin/reinstall.ts`: the helper stays private to the
 * orchestrator while tests can exercise the `instanceof
 * AgentsUnstageFailureError` / `NodeJS.ErrnoException.code` dispatch
 * branches directly.
 */
export { narrowCascadeFailure as __test_narrowCascadeFailure };
