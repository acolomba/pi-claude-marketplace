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
//   1. resolveScopeOrNotifyNotAdded(opts, userLocs, projectLocs) when --scope
//      omitted (MR-1). The standalone-mode helper resolves project-then-user
//      and emits the `{not added}` notify when the marketplace is in neither
//      scope; orchestrated mode uses `resolveScopeOrFailedOutcome` (defined
//      below) to return a typed `RemoveMarketplaceOutcome` instead.
//   2. withLockedStateTransaction(locations, async (tx) => {
//        CFG-03 abort: `loadConfig(targetConfigPath)` -- if `status ==
//        "invalid"`, surface the basename-only failure WITHOUT touching
//        state or saving. No `tx.save()` on this arm.
//        record = tx.state.marketplaces[name]
//        for each plugin in record.plugins:
//          outcome = cascade(plugin, marketplace, locations, installedPlugin)
//                    // cascade is opts.cascade ?? cascadeUnstagePlugin (DI seam
//                    // for test determinism; zero runtime cost in production).
//          if (outcome.ok): delete record.plugins[plugin]; track successfullyUnstaged
//          else:            failedPlugins.push({name, cause})  // D-02 / D-03 fail-fast per plugin
//        if (failedPlugins.length === 0): delete tx.state.marketplaces[name]
//        WB-01: `deleteMarketplaceConfigEntryWithCascade(...)` mirrors the
//        state-side cascade in the user-authored config (entry-level patch
//        through saveConfig).
//        await tx.save()  // WR-04: explicit save on the mutating arms.
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
import path from "node:path";

import { loadConfig } from "../../persistence/config-io.ts";
import { deleteMarketplaceConfigEntryWithCascade } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import { errorMessage, MarketplaceNotFoundError } from "../../shared/errors.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Single,
} from "../../shared/notify-context.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { garbageCollectPluginClones } from "../plugin/clone-gc.ts";

import { REMOVE_CONTEXT, type RemoveRowMsg } from "./remove.messaging.ts";
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

type RecordedSourceKind = "github" | "url" | "path" | "unknown";

/**
 * RECON-03: controls how `removeMarketplace` surfaces
 * notifications. Mirrors `AddMarketplaceNotifications`.
 *
 * - `"standalone"` (default when option is omitted): matches standalone behavior.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `RemoveMarketplaceOutcome` for `applyReconcile` to aggregate (IL-2).
 */
export type RemoveMarketplaceNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

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
    }
  // I1 / PR #51: orchestrated partial-cascade arm. A subset of the
  // marketplace's plugins successfully unstaged AND a subset failed. Pre-fix
  // the orchestrated path collapsed this to `{ status: "failed", reason }`,
  // dropping both the unstaged plugin rows AND failures 2..N from the
  // reconcile cascade. The reconcile caller now renders one row per
  // `unstaged` plugin (○ uninstalled) AND one row per `failed` plugin (⊘
  // {reason}), plus a `(failed)` mp header (D-22-02 / CMC-31 PARTIAL).
  | {
      readonly status: "partial";
      readonly name: string;
      readonly unstaged: readonly string[];
      readonly failed: readonly { readonly name: string; readonly reason: ContentReason }[];
    };

export interface RemoveMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly name: string;
  /** When omitted, `resolveScopeOrNotifyNotAdded` (standalone) / `resolveScopeOrFailedOutcome` (orchestrated) picks the scope; project takes precedence if found in both. */
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
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- matches standalone behavior.
   */
  readonly notifications?: RemoveMarketplaceNotifications;
  /**
   * WB-01: when true, target `claude-plugins.local.json` instead of
   * `claude-plugins.json`. The base file is NEVER touched on the
   * --local path.
   */
  readonly local?: boolean;
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
    // ATTR-09 / D-NCF: foreign content owned by another process is a
    // content/ownership mismatch, not a manifest absence. Aligned with
    // uninstall.ts's mapping (`AgentsUnstageFailureError` -> "source mismatch")
    // so the two cascade-failure narrowers do not drift.
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
    // I1 / PR #51: surface BOTH unstaged successes AND per-plugin failures
    // through the typed outcome. The apply cascade caller composes one row
    // per plugin (○ uninstalled for unstaged, ⊘ {reason} for failed) so the
    // reconcile surface honours D-22-02 (no plugin ever disappears
    // silently). Pre-fix this arm returned `{status:"failed",reason}` --
    // collapsing N rows to 1.
    return {
      status: "partial",
      name: opts.name,
      unstaged: successfullyUnstaged,
      failed: failedPlugins.map((f) => ({
        name: f.name,
        reason: narrowCascadeFailure(f.cause),
      })),
    };
  }

  // CMC-31 PARTIAL: mp.status="failed"; plugins[] mixes uninstalled +
  // failed (with per-plugin cause). Caller-order honored end-to-end:
  // successfullyUnstaged first, failed second.
  // OUT-07 / D-12: one marketplace block -> Single 1-tuple. The `(failed)`
  // header renders via the central renderMpHeader seam the spine reuses; the
  // mixed `uninstalled` / `failed` child rows dispatch through REMOVE_CONTEXT.
  const partialRows: Single<MarketplaceRows<RemoveRowMsg>> = [
    {
      name: opts.name,
      scope: resolvedScope,
      status: "failed",
      // D-03: a failed marketplace remove -> error (the per-plugin children
      // carry the granular reasons).
      severity: "error",
      plugins: [
        ...successfullyUnstaged.map((name): PluginUninstalledMessage => ({
          status: "uninstalled",
          name,
          // D-03/D-06: realized uninstall transition -> info, reloads.
          severity: "info",
          needsReload: true,
        })),
        ...failedPlugins.map(({ name, cause }): PluginFailedMessage => ({
          status: "failed",
          name,
          reasons: [narrowCascadeFailure(cause)],
          cause,
          // D-03/D-06: a per-plugin unstage failure -> error, no reload.
          severity: "error",
          needsReload: false,
        })),
      ],
    },
  ];
  notifyWithContext(opts.ctx, opts.pi, REMOVE_CONTEXT, partialRows);
  return undefined;
}

/**
 * D-02: hand-rolled per-plugin cascade loop. Mutates `record.plugins`,
 * `successfullyUnstaged`, and `failedPlugins` in place. Extracted from
 * `removeMarketplace` to keep its cognitive complexity inside the project's
 * lint budget.
 */
async function cascadePluginsInPlace(args: {
  readonly record: { plugins: Record<string, ExtensionPluginRow> };
  readonly marketplace: string;
  readonly locations: ScopedLocations;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly successfullyUnstaged: string[];
  readonly failedPlugins: { name: string; cause: Error }[];
}): Promise<void> {
  const { record, marketplace, locations, cascade, successfullyUnstaged, failedPlugins } = args;
  for (const [pluginName, plugin] of Object.entries(record.plugins)) {
    const outcome = await cascade(pluginName, marketplace, locations, plugin);
    if (outcome.ok) {
      successfullyUnstaged.push(pluginName);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
      delete record.plugins[pluginName];
      continue;
    }

    // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

    // TR-03: non-AG-5 partial-failure filters resources.* by outcome.dropped.*
    // so the persisted row reflects only artefacts still on disk.
    // AG-5 (AgentsUnstageFailureError) preserves the row INTACT.
    if (!(cause instanceof AgentsUnstageFailureError)) {
      const dropped = outcome.dropped;
      plugin.resources.skills = plugin.resources.skills.filter((n) => !dropped.skills.includes(n));
      plugin.resources.prompts = plugin.resources.prompts.filter(
        (n) => !dropped.commands.includes(n),
      );
      plugin.resources.agents = plugin.resources.agents.filter((n) => !dropped.agents.includes(n));
      plugin.resources.mcpServers = plugin.resources.mcpServers.filter(
        (n) => !dropped.mcpServers.includes(n),
      );
    }

    failedPlugins.push({ name: pluginName, cause });
  }
}

/** Local alias for the per-plugin record shape mutated by the cascade loop. */
type ExtensionPluginRow =
  NonNullable<Parameters<typeof cascadeUnstagePlugin>[3]> extends infer T ? T : never;

/**
 * Cascade-delete the marketplace entry + its `@<marketplace>` plugin keys from
 * ONE physical config layer. Loads the file fresh so the sweep sees the
 * on-disk truth of that layer (the target-layer load threaded for CFG-03 is a
 * different concern).
 *
 * WR-02: short-circuit when the layer declares neither the marketplace nor any
 * plugin key under it. Writing anyway would rewrite the file (mtime bump) for a
 * semantic no-op -- or CREATE the file containing only empty maps when it is
 * absent. Both contradict the RECON-05 byte/mtime-stability discipline.
 *
 * An `absent` or `invalid` layer is left untouched (never rewritten): the
 * sibling layer being invalid is NOT a CFG-03 abort (that is scoped to the
 * target layer in `runRemoveLockBody`).
 */
async function cascadeRemoveFromLayer(
  configPath: string,
  scopeRoot: string,
  marketplace: string,
): Promise<void> {
  const cfg = await loadConfig(configPath);
  if (cfg.status !== "valid") {
    return;
  }

  const suffix = `@${marketplace}`;
  const declaresMarketplace = cfg.config.marketplaces?.[marketplace] !== undefined;
  const declaresPluginUnderIt = Object.keys(cfg.config.plugins ?? {}).some((key) =>
    key.endsWith(suffix),
  );
  if (!declaresMarketplace && !declaresPluginUnderIt) {
    return;
  }

  await deleteMarketplaceConfigEntryWithCascade(cfg.config, configPath, scopeRoot, marketplace);
}

/**
 * Commit the full-remove success branch: delete the marketplace from state and
 * fire the cascade config write-back (skipped in orchestrated mode).
 */
async function commitFullRemove(args: {
  readonly tx: { readonly state: { marketplaces: Record<string, unknown> } };
  readonly marketplace: string;
  readonly locations: ScopedLocations;
  readonly orchestrated: boolean;
}): Promise<void> {
  const { tx, marketplace, locations, orchestrated } = args;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
  delete tx.state.marketplaces[marketplace];

  // WB-01: cascade write-back lives in ONE place. `cascadeRemoveFromLayer`
  // removes the marketplace entry AND every plugin entry whose key ends in
  // `@<marketplace>` so the next reconcile is a no-op.
  //
  // WR-09 / T-56-02-01: SKIPPED in orchestrated mode. A reconcile-driven
  // call derives the desired state FROM the merged config; the declaration
  // may live only in claude-plugins.local.json, and a write-back would
  // clobber a per-machine override.
  if (orchestrated) {
    return;
  }

  // Cross-layer sweep: both `claude-plugins.json` and
  // `claude-plugins.local.json` are inside the NFR-10 sanctioned write set.
  // A `--local` install by a prior version may have left the plugin key in
  // the sibling layer; cleaning only the target layer leaves it as a
  // perpetual dangling-reference. Each layer is loaded fresh and swept
  // independently (WR-02 no-op guard per file, NFR-1 atomic save per file).
  await cascadeRemoveFromLayer(locations.configJsonPath, locations.scopeRoot, marketplace);
  await cascadeRemoveFromLayer(locations.configLocalJsonPath, locations.scopeRoot, marketplace);
}

/**
 * Body of the per-scope state lock. Returns the detected `source.kind` for
 * the post-guard cleanup branching (github clone retention). A CFG-03 throw
 * propagates to the caller's catch arm; a missing record is a no-op (saves
 * state as-is). Extracted to keep `removeMarketplace`'s cognitive complexity
 * within the project's lint budget.
 */
async function runRemoveLockBody(args: {
  readonly tx: {
    readonly state: { marketplaces: Record<string, unknown> };
    save(): Promise<void>;
  };
  readonly opts: RemoveMarketplaceOptions;
  readonly locations: ScopedLocations;
  readonly targetConfigPath: string;
  readonly orchestrated: boolean;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly successfullyUnstaged: string[];
  readonly failedPlugins: { name: string; cause: Error }[];
  readonly cfgInvalidSentinel: Error;
}): Promise<RecordedSourceKind | undefined> {
  const {
    tx,
    opts,
    locations,
    targetConfigPath,
    orchestrated,
    cascade,
    successfullyUnstaged,
    failedPlugins,
    cfgInvalidSentinel,
  } = args;

  // CFG-03 (T-56-02-05): abort BEFORE any state mutation; basename-only.
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") {
    throw cfgInvalidSentinel;
  }

  const state = tx.state as { marketplaces: Record<string, ExtensionMarketplaceRow> };
  const record = state.marketplaces[opts.name];
  if (record === undefined) {
    // Concurrent removal between pre-guard probe and the lock body:
    // save the (unchanged) state and let the post-guard arm emit the
    // header-only `(removed)` row.
    await tx.save();
    return undefined;
  }

  const src = record.source as { kind?: unknown };
  const sourceKind: RecordedSourceKind | undefined =
    src.kind === "github" || src.kind === "url" || src.kind === "path" || src.kind === "unknown"
      ? src.kind
      : undefined;

  // D-02: per-plugin cascade loop (MR-3 continuation across failures).
  await cascadePluginsInPlace({
    record,
    marketplace: opts.name,
    locations,
    cascade,
    successfullyUnstaged,
    failedPlugins,
  });

  if (failedPlugins.length === 0) {
    await commitFullRemove({
      tx,
      marketplace: opts.name,
      locations,
      orchestrated,
    });
  }

  await tx.save();
  return sourceKind;
}

/**
 * Local alias for the in-state marketplace row -- the `record` shape passed
 * through the cascade and write-back helpers.
 */
interface ExtensionMarketplaceRow {
  source: unknown;
  plugins: Record<string, ExtensionPluginRow>;
}

/**
 * Resolve the target scope/locations or surface the missing-marketplace
 * precondition through the correct standalone/orchestrated arm. Returns:
 *   - `{ scope, locations }` on success
 *   - `RemoveMarketplaceOutcome` (status: "failed", reason: "not added") in
 *     orchestrated mode when the marketplace is missing
 *   - `undefined` in standalone mode when the helper already emitted the
 *     standalone `(failed) {not added}` variant
 */
async function resolveRemoveTargetOrSurface(
  opts: RemoveMarketplaceOptions,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
  orchestrated: boolean,
): Promise<{ scope: Scope; locations: ScopedLocations } | RemoveMarketplaceOutcome | undefined> {
  if (orchestrated) {
    const r = await resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);
    if ("status" in r) {
      return r;
    }

    return r;
  }

  const r = await resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);
  return r;
}

/**
 * CFG-03 (T-56-02-05) terminal arm: surface a structured `(failed) {invalid
 * manifest}` row through the correct standalone/orchestrated channel. The
 * error message carries the basename only -- never the absolute config path.
 */
function surfaceCfgInvalid(args: {
  readonly opts: RemoveMarketplaceOptions;
  readonly orchestrated: boolean;
  readonly configBasename: string;
  readonly scope: Scope;
}): RemoveMarketplaceOutcome | undefined {
  const { opts, orchestrated, configBasename, scope } = args;
  if (orchestrated) {
    const synthetic = new Error(`Config file "${configBasename}" failed schema validation.`);
    return {
      status: "failed",
      reason: "invalid manifest",
      error: synthetic,
      cause: errorMessage(synthetic),
    };
  }

  // OUT-07 / D-12: one marketplace block -> Single 1-tuple. No child rows; the
  // `(failed) {invalid manifest}` header renders via the central renderMpHeader
  // seam the spine reuses.
  const invalidManifestRows: Single<MarketplaceRows<RemoveRowMsg>> = [
    {
      name: opts.name,
      scope,
      status: "failed",
      reasons: ["invalid manifest"],
      // D-03: a failed marketplace remove -> error.
      severity: "error",
      plugins: [],
    },
  ];
  notifyWithContext(opts.ctx, opts.pi, REMOVE_CONTEXT, invalidManifestRows);
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

  const resolved = await resolveRemoveTargetOrSurface(
    opts,
    userLocations,
    projectLocations,
    orchestrated,
  );
  if (resolved === undefined || "status" in resolved) {
    return resolved;
  }

  const { locations } = resolved;

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base file on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  // Per-plugin tracking accumulators captured by the guard closure.
  const failedPlugins: { name: string; cause: Error }[] = [];
  const successfullyUnstaged: string[] = []; // plugins whose cascade returned ok:true
  let sourceKindAtRecord: RecordedSourceKind | undefined;

  // CFG-03 sentinel: a synthetic throw signaling the lock body aborted on an
  // invalid config. The catch arm BELOW maps it to the structured failed row.
  // Using a throw (rather than a captured boolean) keeps no-unnecessary-
  // condition lint clean and structurally guarantees tx.save() is NOT called.
  const CFG_INVALID = new Error("cfg-invalid-sentinel");

  try {
    await withLockedStateTransaction(locations, async (tx) => {
      const sk = await runRemoveLockBody({
        tx,
        opts,
        locations,
        targetConfigPath,
        orchestrated,
        cascade,
        successfullyUnstaged,
        failedPlugins,
        cfgInvalidSentinel: CFG_INVALID,
      });
      if (sk !== undefined) {
        sourceKindAtRecord = sk;
      }
    });
  } catch (err) {
    if (err !== CFG_INVALID) {
      throw err;
    }

    return surfaceCfgInvalid({
      opts,
      orchestrated,
      configBasename,
      scope: resolved.scope,
    });
  }

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

    // MR-7: clone dirs retained when any plugin failed; here failedPlugins.length === 0.
    // MURL-04 / NFR-3: both github and url sources have a sources/<name>/ clone;
    // a url clone left behind would permanently trip MA-6 {stale clone} on re-add.
    // path sources never have a clone dir.
    if (sourceKindAtRecord === "github" || sourceKindAtRecord === "url") {
      await removePath(locations.sourceCloneDir(opts.name));
    }

    // PURL-05 / PURL-06 / D-78-01: reclaim any git-source plugin-clones/<key>/
    // dir the cascade-uninstalled plugins no longer reference. Runs post-commit
    // (after withLockedStateTransaction saved), so the GC derives live clone
    // keys from the just-committed state where the removed plugins' records are
    // gone -> their clones are unreferenced -> swept; a clone still referenced
    // by a surviving marketplace's plugin survives. fs-only helper: no git
    // surface (NFR-5). NFR-3: a crash before this leaves an orphan the next
    // idempotent pass removes.
    //
    // Per D-19-01 this hygienic cleanup never becomes the primary user-facing
    // path. The GC helper already swallows per-dir rm leaks into a returned
    // string[] rather than throwing; the try/catch is belt-and-braces so a
    // GC-internal throw can never fail the user-visible remove.
    try {
      await garbageCollectPluginClones(locations);
    } catch {
      // Per D-19-01: hygienic cleanup never becomes the primary user-facing path.
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
  // OUT-07 / D-12: one marketplace block -> Single 1-tuple. The `(removed)`
  // header renders via the central renderMpHeader seam the spine reuses; the
  // `uninstalled` child rows dispatch through REMOVE_CONTEXT.
  const removedRows: Single<MarketplaceRows<RemoveRowMsg>> = [
    {
      name: opts.name,
      scope: resolved.scope,
      status: "removed",
      plugins: successfullyUnstaged.map((name): PluginUninstalledMessage => ({
        status: "uninstalled",
        name,
        // D-03/D-06: realized uninstall transition -> info, reloads.
        severity: "info",
        needsReload: true,
      })),
    },
  ];
  notifyWithContext(opts.ctx, opts.pi, REMOVE_CONTEXT, removedRows);
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
