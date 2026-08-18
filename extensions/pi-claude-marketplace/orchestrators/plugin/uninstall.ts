// orchestrators/plugin/uninstall.ts
//
// PU-1..8 + PU-7 propagation + AS-6 (post-commit cleanup leaks warning-severity).
//
// Composition (D-09):
//   withLockedStateTransaction(locations, async (tx) => {
//     PU-5 silent converge: if record absent, set alreadyGone=true and return (NO save)
//     outcome = await cascadeUnstagePlugin(plugin, marketplace, locations, installed)
//     if (!outcome.ok) throw outcome.cause  // PU-7 propagation; state record retained
//     delete state.marketplaces[mp].plugins[plugin]
//     await tx.save()  // WR-04: explicit save on mutating arms ONLY
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
import path from "node:path";

import { rebuildRoutingTables, removePluginConfigFromCache } from "../../bridges/hooks/index.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { deletePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { AgentsUnstageFailureError, cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import {
  applyPartialCascadeFold,
  emitMarketplaceNotAdded,
  resolveCrossScopePluginTarget,
} from "./shared.ts";
import { UNINSTALL_CONTEXT } from "./uninstall.messaging.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginUninstalledMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";

/** The config-layer paths the cross-layer sweep writes through. */
type UninstallLocations = Pick<
  ScopedLocations,
  "configJsonPath" | "configLocalJsonPath" | "scopeRoot"
>;

/**
 * RECON-03: controls how `uninstallPlugin` surfaces
 * notifications. Mirrors the `AddMarketplaceNotifications` precedent.
 *
 * - `"standalone"` (default when option is omitted): matches standalone behavior.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `UninstallPluginOutcome` for `applyReconcile` to aggregate
 *   (IL-2).
 */
export type UninstallPluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `uninstallPlugin` in
 * orchestrated mode. The success arm carries the optional `version` of the
 * removed record (when available) so apply can compose the per-plugin row.
 *
 * WR-06: the PU-5 silent converge (record already absent
 * -- another process completed first, or there was never an install) is its
 * own `"converged"` arm so orchestrated consumers can DROP it (PU-5 "literal
 * silence", PRD §5.2.2) instead of rendering an `(uninstalled)` row for work
 * this process did not perform. An absent `version` on the `uninstalled` arm
 * is NOT a reliable converge discriminator, hence the explicit variant.
 *
 * `reason` is typed as `Reason` (broader than `ContentReason`) so the
 * structural `"not added"` sentinel returned by the missing-marketplace arm
 * flows through the same field; mirrors `RemoveMarketplaceOutcome`.
 */
export type UninstallPluginOutcome =
  | { readonly status: "uninstalled"; readonly name: string; readonly version?: string }
  | { readonly status: "converged"; readonly name: string }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

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
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- matches standalone behavior.
   */
  readonly notifications?: UninstallPluginNotifications;
  /**
   * WB-01 / WB-02: when true, target `claude-plugins.local.json` instead
   * of `claude-plugins.json`. The base file is NEVER touched on the
   * --local path; loadConfig's `absent` arm yields an empty starting
   * shape that saveConfig writes back to the local path.
   */
  readonly local?: boolean;
}

/**
 * Narrow an Error thrown out of `cascadeUnstagePlugin` (PU-7 propagation
 * path) to a closed-set Reason for `PluginFailedMessage.reasons`. Mirrors
 * the typed-cause dispatch in `orchestrators/marketplace/remove.ts`:
 * instanceof `AgentsUnstageFailureError` first,
 * `NodeJS.ErrnoException.code` second, permissive fallback last. Closed-set
 * Reasons live in `shared/notify.ts::REASONS`.
 */
function narrowCascadeFailure(cause: Error): ContentReason {
  if (cause instanceof AgentsUnstageFailureError) {
    // ATTR-09 / D-47-B: foreign content owned by another process is a
    // content/ownership mismatch, not a manifest absence. The former
    // `"not in manifest"` lied that the plugin was gone from the manifest;
    // `"source mismatch"` is the truthful existing member (no new REASONS
    // member -- the closed set already covers it).
    return "source mismatch";
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

  // ATTR-09 / D-47-B: the unclassified cascade-failure default is genuinely
  // "we could not read/remove on-disk state", not a manifest claim. The
  // former `"not in manifest"` was a false assertion; `"unreadable"` is the
  // truthful existing member.
  return "unreadable";
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
 * RECON-03: route a cascade-failure cause to either the typed orchestrated
 * outcome or the standalone notify() row. Extracted from `uninstallPlugin`
 * to keep cognitive complexity inside the SonarJS lint budget.
 */
function emitCascadeFailure(args: {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  marketplace: string;
  scope: Scope;
  plugin: string;
  cause: Error;
  removedVersion: string | undefined;
  orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, cause, removedVersion, orchestrated } = args;
  if (orchestrated) {
    return {
      status: "failed",
      reason: narrowCascadeFailure(cause),
      error: cause,
      cause: errorMessage(cause),
    };
  }

  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: [narrowCascadeFailure(cause)],
    ...(removedVersion !== undefined && { version: removedVersion }),
    cause,
    // D-03/D-06: a failed uninstall -> error, no reload (nothing changed).
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [
    {
      name: marketplace,
      scope,
      plugins: [failedRow],
    },
  ]);
  return undefined;
}

/**
 * WB-01 / CFG-03 / T-56-03-04: route the invalid-config abort to either the
 * typed orchestrated outcome or the standalone notify() row. The
 * basename-only cause prevents an absolute-path information leak.
 */
function emitConfigInvalid(args: {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  marketplace: string;
  scope: Scope;
  plugin: string;
  configBasename: string;
  orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, configBasename, orchestrated } = args;
  const cause = `Config file "${configBasename}" failed schema validation.`;
  const invalidErr = new Error(cause);
  if (orchestrated) {
    return { status: "failed", reason: "invalid manifest", error: invalidErr, cause };
  }

  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [
    {
      name: marketplace,
      scope,
      plugins: [
        {
          status: "failed",
          name: plugin,
          reasons: ["invalid manifest"] as const,
          cause: invalidErr,
          // D-03/D-06: invalid-config abort -> error, no reload.
          severity: "error" as const,
          needsReload: false,
        },
      ],
    },
  ]);
  return undefined;
}

/**
 * Delete the `plugin@marketplace` key from ONE physical config layer. Loads
 * the file fresh so the sweep sees that layer's on-disk truth.
 *
 * WR-02: proceed only when the layer is `valid` AND actually declares the key.
 * An absent/invalid layer, or a valid layer that does not declare the key, is
 * left untouched (never rewritten) -- writing anyway would rewrite the file, or
 * CREATE it with empty maps when absent, for a semantic no-op (RECON-05
 * byte/mtime stability). The sibling layer being invalid is NOT a CFG-03 abort
 * (that is scoped to the target layer inside the guard closure).
 */
async function deletePluginFromLayer(
  configPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
): Promise<void> {
  const cfg = await loadConfig(configPath);
  if (cfg.status !== "valid" || cfg.config.plugins?.[`${plugin}@${marketplace}`] === undefined) {
    return;
  }

  await deletePluginConfigEntry(cfg.config, configPath, scopeRoot, plugin, marketplace);
}

/**
 * TR-03 failure split for a cascade that did not fully unstage.
 *
 *   - AG-5 (`AgentsUnstageFailureError`): foreign content owned by another
 *     process. RETHROWN so the save aborts and the row stays intact for
 *     manual recovery or retry (preserves PU-3 + PU-7).
 *   - Non-AG-5 partial failure: the cascade dropped some artifacts before
 *     throwing, so `resources.*` is filtered by `dropped.*` IN PLACE and the
 *     shrunken row persists. The caller surfaces the returned cause AFTER the
 *     save commits, so state.json never claims artifacts already gone from
 *     disk (NFR-3 fail-clean).
 */
function foldPartialCascadeFailure(
  plugin: string,
  installed: Parameters<typeof applyPartialCascadeFold>[0],
  localOutcome: UnstageOutcome,
): Error {
  // `localOutcome.cause` is non-undefined when ok=false (D-03 contract); the
  // fallback keeps the type honest rather than asserting.
  const cause = localOutcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
  if (cause instanceof AgentsUnstageFailureError) {
    throw cause;
  }

  applyPartialCascadeFold(installed, localOutcome.dropped);
  return cause;
}

/**
 * The state-side removal commit: drop the record, then keep the hooks bridge
 * in lockstep.
 *
 * D-59-02: the parsed-config cache removal is a synchronous in-memory delete
 * and is idempotent, so the unconditional call is safe even for a plugin that
 * never declared hooks. A closure throw between here and `tx.save()` leaves a
 * bounded leak -- the routing table still resolves entries on the next
 * dispatch until reconcile rebuilds -- and the next `/reload` resets it
 * (D-59-03 epoch bump plus factory-time hydrate from disk).
 *
 * WR-03: the routing-table rebuild lets subsequent events bypass the removed
 * plugin without requiring `/reload` (NFR-2). Without it dispatch would still
 * try to spawn the uninstalled command; the never-throws contract would turn
 * that into `{ kind: "noop" }` plus a debug log, which is correct but
 * wasteful. Synchronous and zero disk I/O per DISP-02.
 */
function commitPluginRemoval(
  mp: { plugins: Record<string, unknown> },
  ids: { readonly scope: Scope; readonly marketplace: string; readonly plugin: string },
): void {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
  delete mp.plugins[ids.plugin];
  removePluginConfigFromCache(ids.scope, ids.marketplace, ids.plugin);
  rebuildRoutingTables();
}

/**
 * WB-01 / WR-09: delete the plugin entry from the user-authored config.
 *
 * Cross-layer sweep: the `plugin@marketplace` key may live in either
 * `claude-plugins.json` or `claude-plugins.local.json` -- a prior `--local`
 * install can have left it in the sibling layer. Both files are inside the
 * NFR-10 sanctioned write set, and deleting from only the target layer would
 * leave the sibling declaration as a perpetual dangling reference. Each layer
 * loads fresh and is swept independently (WR-02 no-op guard per file: an
 * absent or invalid layer, or one not declaring the key, is skipped and never
 * rewritten, preserving RECON-05 byte and mtime stability).
 */
async function sweepPluginFromConfigLayers(
  locations: UninstallLocations,
  plugin: string,
  marketplace: string,
): Promise<void> {
  await deletePluginFromLayer(locations.configJsonPath, locations.scopeRoot, plugin, marketplace);
  await deletePluginFromLayer(
    locations.configLocalJsonPath,
    locations.scopeRoot,
    plugin,
    marketplace,
  );
}

/**
 * The three POST-state-commit cleanups, all of them hygienic and all of them
 * swallowed per D-19-01: the underlying side effect still fires, only the
 * user-visible warning surface is gone, because
 * `MarketplaceNotificationMessage` has no field for a soft warning after a
 * successful state mutation.
 *
 * D-03-INV: the plugin moved from "installed" to "available", so the cached
 * plugin index for this marketplace is dropped and the next completion read
 * rebuilds it with the new status.
 *
 * PU-2 / D-08: the per-plugin data dir is removed AFTER the state save, so an
 * EACCES on `rm` cannot strand state in installed=true. This is where the
 * PU-4 leaked-path warning used to surface.
 *
 * PURL-05 / D-78-01: the git clone cache is reclaimed once no surviving
 * record references it. The GC derives live keys from the just-committed
 * state, so a shared clone survives while any other plugin still references
 * it. NFR-3: a crash before this leaves an orphan the next idempotent pass
 * removes. `garbageCollectPluginClones` already folds per-dir rm leaks into a
 * returned string[] rather than throwing; the try/catch is belt and braces.
 */
async function runPostUninstallCleanup(
  locations: ScopedLocations,
  scope: Scope,
  marketplace: string,
  plugin: string,
): Promise<void> {
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }

  // NFR-10: resolve OUTSIDE the try. `pluginDataDir` is not a path join -- it
  // runs assertSafeName on both segments and assertPathInside on the result,
  // and a containment failure must propagate rather than be mistaken for an
  // rm leak. D-19-01 sanctions swallowing the cleanup, not the assertion
  // guarding it.
  const dataDir = await locations.pluginDataDir(marketplace, plugin);

  try {
    await rm(dataDir, { recursive: true, force: true });
  } catch {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }

  try {
    await garbageCollectPluginClones(locations);
  } catch {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }
}

/**
 * PU-5 already-gone: the recorded plugin row is absent from state.json.
 *
 * WR-06: in ORCHESTRATED mode (reconcile apply) the converge stays SILENT --
 * it surfaces as the explicit `converged` outcome so apply can DROP it, and a
 * reconcile racing another process never reports an uninstall it did not
 * perform.
 *
 * D-01: the STANDALONE user command names an absent target it cannot operate
 * on, so it emits an error row (it was literal silence before). The row is
 * `failed` carrying the `not installed` reason -- uninstall's render map has
 * no `skipped` arm -- and carries no `cause`, so no path redaction applies.
 */
function emitAlreadyGone(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, orchestrated } = args;
  if (orchestrated) {
    return { status: "converged", name: plugin };
  }

  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: ["not installed"],
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [
    { name: marketplace, scope, plugins: [failedRow] },
  ]);
  return undefined;
}

/**
 * RECON-03: returns `UninstallPluginOutcome` in orchestrated mode and
 * `undefined` in standalone mode (after firing the standalone notify()).
 */
export async function uninstallPlugin(
  opts: UninstallPluginOptions,
): Promise<UninstallPluginOutcome | undefined> {
  const { ctx, pi, cwd, marketplace, plugin } = opts;
  const cascade = opts.cascade ?? cascadeUnstagePlugin;
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // ATTR-04 / SCOPE-01 / M3 / M4: the discriminated cross-scope resolver
  // distinguishes "marketplace container absent" (loud `{not added}`) from
  // "container present, plugin row absent" (silent PU-5 converge, reached via
  // the `resolved` arm's downstream `installed === undefined` branch).
  const resolution = await resolveCrossScopePluginTarget({
    cwd,
    marketplace,
    plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });

  if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
    return emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace,
      requestedScope: resolution.requestedScope,
      orchestrated,
    });
  }

  const { scope, locations } = resolution;

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base file on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  let alreadyGone = false;
  // WB-01 / CFG-03: invalid-config sentinel; surfaced post-guard with a
  // basename-only cause (T-56-03-04 information-disclosure mitigation).
  let configInvalid = false;
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
    // WR-04: explicit-save transaction so the abort arms
    // (CFG-03 invalid config, PU-5 already-gone) return WITHOUT rewriting
    // state.json -- `withStateGuard` saved unconditionally on closure
    // return, bumping state.json's mtime on every abort, diverging from the
    // documented no-save abort discipline the sibling commands follow.
    await withLockedStateTransaction(locations, async (tx) => {
      const state = tx.state;
      // CFG-03 / T-56-03-04: abort BEFORE any state mutation. The
      // basename-only message prevents an absolute-path information leak.
      // NO tx.save() -- state.json bytes and mtime are untouched.
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        configInvalid = true;
        return;
      }

      const mp = state.marketplaces[marketplace];
      if (mp === undefined) {
        // ATTR-04 reachability note. The "marketplace never added" case is
        // now caught BEFORE the guard by `resolveCrossScopePluginTarget`
        // (the `marketplace-absent` / `other-scope` arms emit `{not added}`
        // and return). So a `mp === undefined` HERE is exclusively a
        // CONCURRENT-REMOVAL race: the container existed at the resolver's
        // unlocked read but was removed by another process before this
        // locked re-load. That is the legitimate PU-5 idempotent converge
        // (PRD §5.2.2) -- silence, same as the `installed === undefined`
        // branch below.
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
      //     before throwing. Filter installed.resources.* by
      //     localOutcome.dropped.* so the persisted row reflects only
      //     artifacts still on disk (no ghost record). Surface the failure
      //     via the cascadeFailure sentinel so the post-guard branch can
      //     fire the PluginFailedMessage AFTER the shrunken-row save
      //     commits.
      //
      // CRITICAL field-name mapping: `dropped.commands` populates from
      // `installed.resources.prompts` (the cascade primitive at
      // `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin`), so
      // the filter MUST wire dropped.commands -> resources.prompts. The
      // other three axes are name-identical (skills, agents, mcpServers).
      if (!localOutcome.ok) {
        // Rethrows on the AG-5 carve-out; otherwise folds the partial drop
        // into the record in place and returns the cause for the sentinel.
        cascadeFailure = foldPartialCascadeFailure(plugin, installed, localOutcome);
        await tx.save();
        return;
      }

      commitPluginRemoval(mp, { scope, marketplace, plugin });

      if (!orchestrated) {
        await sweepPluginFromConfigLayers(locations, plugin, marketplace);
      }

      // WR-04: explicit save on the mutating success arm. Ordering
      // preserved from the previous withStateGuard shape: state persists
      // AFTER the config write-back (a write-back throw aborts the save,
      // keeping the record intact for retry exactly as before).
      await tx.save();
    });
  } catch (err) {
    // PU-7 propagation: AG-5 (or any other cascade failure). State was NOT
    // saved (guard contract); the plugin record stays intact for retry.
    const cause = err instanceof Error ? err : new Error(String(err));
    return emitCascadeFailure({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      cause,
      removedVersion,
      orchestrated,
    });
  }

  // WB-01 / CFG-03 / T-56-03-04: invalid-config abort. No state mutation
  // (the closure returned before reading state); no write-back.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated inside the withLockedStateTransaction closure above.
  if (configInvalid) {
    return emitConfigInvalid({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      configBasename,
      orchestrated,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `alreadyGone` is mutated inside the withLockedStateTransaction closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (alreadyGone) {
    return emitAlreadyGone({ ctx, pi, marketplace, scope, plugin, orchestrated });
  }

  // TR-03: non-AG-5 cascade partial-failure surface.
  if (cascadeFailure !== undefined) {
    return emitCascadeFailure({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      cause: cascadeFailure,
      removedVersion,
      orchestrated,
    });
  }

  await runPostUninstallCleanup(locations, scope, marketplace, plugin);

  // PU-8 reload hint: computed by notify from the
  // PluginUninstalledMessage status (uninstalled is in the state-changing
  // variant set). The reload-hint trigger is per-variant status, not
  // per-cascade resource count. Control reaches this point only when
  // alreadyGone is false (early-returned above) AND the catch did not
  // intercept a cascade failure (early-returned via `emitCascadeFailure`),
  // so `removedVersion` was assigned by the closure.
  //
  // CMC-24 / D-13-05 / D-13-06: emit via PluginUninstalledMessage.
  // The uninstalled variant has NO per-row soft-dep predicate fields by
  // construction -- MSG-SD-3 is structurally enforced: the renderer CANNOT
  // emit `{requires pi-subagents}` / `{requires pi-mcp}` markers on
  // (uninstalled) rows. There are no aggregated PI_*_NOT_LOADED trailers on
  // uninstall success per D-13-07 + MSG-SD-3 (the soft-dep state
  // is no-op for the operator after uninstall -- the content is gone, so no
  // marker is useful). Catalog reference: the `/claude:plugin uninstall
  // <plugin>@<marketplace>` "Success" arm in `docs/output-catalog.md`.
  //
  // IN-02: the `removedVersion !== undefined` guard is kept because the
  // variable is typed `string | undefined` (hoisted from inside the
  // withLockedStateTransaction closure; the type system cannot prove the
  // closure ran). The renderer suppresses the `v<version>` token on
  // undefined or empty anyway, so the empty-version edge case is handled
  // structurally.
  if (orchestrated) {
    return {
      status: "uninstalled",
      name: plugin,
      ...(removedVersion !== undefined && { version: removedVersion }),
    };
  }

  const uninstalledRow: PluginUninstalledMessage = {
    status: "uninstalled",
    name: plugin,
    ...(removedVersion !== undefined && { version: removedVersion }),
    // D-03/D-06: realized uninstall transition -> info, reloads Pi resources.
    severity: "info",
    needsReload: true,
  };
  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [
    {
      name: marketplace,
      scope,
      plugins: [uninstalledRow],
    },
  ]);
  return undefined;
}
