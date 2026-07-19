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
import { errorMessage, MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { notify } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { AgentsUnstageFailureError, cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import { applyPartialCascadeFold, resolveCrossScopePluginTarget } from "./shared.ts";
import { UNINSTALL_CONTEXT } from "./uninstall.messaging.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginUninstalledMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

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
 * RECON-03: route the not-added cross-scope resolution path to either the
 * typed orchestrated outcome or the standalone notify() row.
 */
function emitMarketplaceNotAdded(args: {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  marketplace: string;
  requestedScope: Scope | undefined;
  orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, requestedScope, orchestrated } = args;
  if (orchestrated) {
    const scopeList: readonly Scope[] =
      requestedScope === undefined ? ["project", "user"] : [requestedScope];
    const err = new MarketplaceNotFoundError(marketplace, scopeList);
    return { status: "failed", reason: "not added", error: err, cause: errorMessage(err) };
  }

  notify(ctx, pi, {
    kind: "marketplace-not-added",
    name: marketplace,
    ...(requestedScope !== undefined && { scope: requestedScope }),
  });
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
 * RECON-03: returns `UninstallPluginOutcome` in orchestrated mode and
 * `undefined` in standalone mode (after firing the standalone notify()).
 */
// Uninstall sequencing intentionally keeps the cross-scope resolution, the
// guarded cascade + CFG-03 + WB-01 write-back, and the post-guard outcome
// dispatch in one audited flow matching PU-1..8.
// eslint-disable-next-line sonarjs/cognitive-complexity
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
        // localOutcome.cause is non-undefined when ok=false (D-03 contract).
        const cause =
          localOutcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
        if (cause instanceof AgentsUnstageFailureError) {
          // AG-5 carve-out: preserve the row intact (ST-7 abort-save).
          throw cause;
        }

        // Non-AG-5: filter resources.* by dropped.* in place. The shrunken
        // row persists via the explicit tx.save() (WR-04) -- this arm DID
        // mutate state, unlike the abort arms above.
        applyPartialCascadeFold(installed, localOutcome.dropped);
        cascadeFailure = cause;
        await tx.save();
        return;
      }

      // State commit: remove the plugin record. The guard saves atomically
      // on closure return.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
      delete mp.plugins[plugin];

      // D-59-02: hooks-bridge cache lifecycle -- synchronous in-memory
      // remove. Idempotent: removing a missing key is a no-op (so the
      // unconditional call is safe even for plugins that never declared
      // hooks). Bounded leak on a closure throw between this line and
      // `tx.save()`: the routing table still resolves entries on the next
      // dispatch until reconcile rebuilds, but the next `/reload` resets
      // the cache (D-59-03 epoch bump + factory-time hydrate from disk).
      removePluginConfigFromCache(scope, marketplace, plugin);

      // WR-03: keep the routing table in lockstep with the parsed-config
      // cache so subsequent events bypass the now-removed plugin without
      // requiring `/reload` (NFR-2). Otherwise dispatch would still attempt
      // to spawn the uninstalled command (the never-throws contract would
      // convert ENOENT to `{ kind: "noop" }` + hookDebugLog -- correct but
      // wasteful). Synchronous + zero disk I/O per DISP-02.
      rebuildRoutingTables();

      // WB-01 / WR-09: delete the plugin entry from the user-authored config.
      // SKIPPED in orchestrated mode (reconcile derives desired state FROM
      // the merged config; writing back would clobber a per-machine override).
      // The ALREADY-GONE arm above never reaches here -- it returns early
      // (WB-01: uninstall alreadyGone leaves config untouched;
      // planReconcile surfaces the declared-but-missing on next load).
      //
      // Cross-layer sweep: the `plugin@marketplace` key may live in either
      // claude-plugins.json or claude-plugins.local.json (e.g. a prior --local
      // install left it in the sibling layer). Both files are inside the
      // NFR-10 sanctioned write set. Deleting from only the target layer
      // leaves the sibling declaration as a perpetual dangling-reference.
      // Each layer is loaded fresh and swept independently (WR-02 no-op guard
      // per file: an absent/invalid layer or one not declaring the key is
      // skipped, never rewritten -- RECON-05 byte/mtime stability).
      if (opts.notifications?.mode !== "orchestrated") {
        await deletePluginFromLayer(
          locations.configJsonPath,
          locations.scopeRoot,
          plugin,
          marketplace,
        );
        await deletePluginFromLayer(
          locations.configLocalJsonPath,
          locations.scopeRoot,
          plugin,
          marketplace,
        );
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

  // PU-5 already-gone (the recorded plugin row is absent from state.json).
  // WR-06: in ORCHESTRATED mode (reconcile apply) the converge stays SILENT --
  // it surfaces as the explicit `converged` outcome so apply can DROP it, and a
  // reconcile racing another process never reports an uninstall it did not
  // perform.
  //
  // D-01: the STANDALONE user command names an absent target it cannot operate
  // on -> error row (was literal silence). A `failed` row carrying the
  // `not installed` reason (uninstall's render map renders `uninstalled` /
  // `failed` only -- it has no `skipped` arm); no `cause`, so no path-redaction
  // is required.
  //
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `alreadyGone` is mutated inside the withLockedStateTransaction closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (alreadyGone) {
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
      {
        name: marketplace,
        scope,
        plugins: [failedRow],
      },
    ]);
    return undefined;
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

  // PURL-05 / D-78-01: reclaim the git clone cache once no surviving record
  // references it. Runs AFTER the state save committed above, so a
  // still-installed record keeps its clone alive; the GC derives live keys
  // from the just-committed state (a shared clone survives while any other
  // plugin still references it). NFR-3: a crash before this leaves an orphan
  // the next idempotent pass removes.
  //
  // Per D-19-01 this hygienic cleanup never becomes the primary user-facing
  // path. garbageCollectPluginClones already swallows per-dir rm leaks into a
  // returned string[] rather than throwing; the try/catch is belt-and-braces
  // so a GC failure can never fail the user-visible uninstall.
  try {
    await garbageCollectPluginClones(locations);
  } catch {
    // Per D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }

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
