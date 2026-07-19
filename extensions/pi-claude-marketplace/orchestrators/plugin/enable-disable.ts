// orchestrators/plugin/enable-disable.ts
//
// D-54-01 / ENBL-01 / ENBL-02 / ENBL-03 / ENBL-04.
//
// Single orchestrator parameterized by `enable: boolean`. Mirrors the
// `setMarketplaceAutoupdate` shape: composes `resolveCrossScopePluginTarget`
// + `withLockedStateTransaction` (CFG-03 abort + cascadeUnstagePlugin OR the
// guard-free install ledger) + `saveConfig` + a single terminal `notify()`
// per IL-2.
//
// CR-01 locking model: exactly ONE per-scope lock owns the
// whole critical section. The enable branch calls `runInstallLedger` (the
// guard-FREE ledger body exported by install.ts) against THIS transaction's
// state snapshot -- calling `installPlugin` here would nest a second
// `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
// (`retries: 0`) is not re-entrant, so every fresh enable would self-deadlock
// (ELOCKED -> StateLockHeldError). The single snapshot also guarantees the
// ledger's state mutation is what gets saved (no outer stale-snapshot
// clobber; ST-7 / D-06 single-writer preserved).
//
// WR-01 save discipline: `tx.save()` fires ONLY on the
// `fresh` arms. The `invalid-config` / `idempotent` / `not-recorded` /
// `*-failed` arms return without saving, so state.json's mtime is UNCHANGED
// on every abort/no-op -- exactly what the catalog's CFG-03 states claim.
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The architecture gate at
// `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS) is
// armed for this file -- adding any forbidden surface fails the gate.
//
// A6: `loadConfig(targetConfigPath)` runs INSIDE the locked transaction so
// a concurrent flip from another process either fails fast at lock
// acquisition or retries against the fresh post-flip state.
//
// ENBL-02 version pin: the enable branch passes
// `pinVersionOverride: installed.version` to `runInstallLedger` so the
// install ledger does NOT call `resolvePluginVersion` (which could bump the
// version if `plugin.json` or the marketplace entry drifted between disable
// and enable). The cached marketplace manifest read happens inside the
// ledger via `loadMarketplaceManifest` -- the cached PI-2 read, never the
// network.
//
// --local file isolation: when `opts.local === true`,
// `targetConfigPath = locations.configLocalJsonPath` UNCONDITIONALLY -- the
// orchestrator NEVER falls back to the base file on ENOENT (`loadConfig`'s
// absent arm yields an empty starting shape that `saveConfig` writes back to
// the local file, creating it fresh).
//
// T-53-02-02 / T-54-02-02 information disclosure mitigation: the CFG-03
// abort row carries `path.basename(targetConfigPath)` -- never the absolute
// path -- reusing the dry-run preview pattern.

import path from "node:path";

import { rebuildRoutingTables, removePluginConfigFromCache } from "../../bridges/hooks/index.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { writeBatchedConfigEntries } from "../../persistence/config-write-back.ts";
import { toDisabledRecord } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, MarketplaceNotFoundError, StateLockHeldError } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { notify, redactAbsolutePaths } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
  type DisableMsg,
  type EnableMsg,
} from "./enable-disable.messaging.ts";
import { runInstallLedger } from "./install.ts";
import {
  applyPartialCascadeFold,
  resolveCrossScopePluginTarget,
  selectConfigWriteTarget,
  synthesizeAdoptedMarketplaceSource,
} from "./shared.ts";

import type { InstallFailureCapture } from "./install.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { DisabledPluginRecord, ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ContentReason, PluginFailedMessage, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";

/**
 * RECON-03: controls how `setPluginEnabled` surfaces
 * notifications. Mirrors `AddMarketplaceNotifications`.
 *
 * - `"standalone"` (default when option is omitted): matches standalone behavior.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `EnableDisablePluginOutcome` for `applyReconcile`.
 */
export type EnableDisablePluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `setPluginEnabled` in
 * orchestrated mode.
 *
 * - `"enabled"` -- the enable branch re-materialized the plugin.
 * - `"disabled"` -- the disable branch cascaded-unstaged the artefacts and
 *   reset `resources.*` while preserving the state record.
 * - `"skipped"` -- the idempotent already-enabled / already-disabled arm.
 *   The `reason` carries the standalone benign Reason for parity with the
 *   standalone rendering token set.
 * - `"failed"` -- enable / disable / not-recorded / invalid-config /
 *   marketplace-not-added paths. `reason` typed `Reason` so the
 *   structural `"not added"` sentinel can flow through the same field.
 */
export type EnableDisablePluginOutcome =
  | { readonly status: "enabled"; readonly name: string; readonly version?: string }
  | { readonly status: "disabled"; readonly name: string; readonly version?: string }
  | {
      readonly status: "skipped";
      readonly name: string;
      readonly reason: "already enabled" | "already disabled" | "not installed";
    }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

/**
 * D-54-01 options bundle for `setPluginEnabled`. Mirrors
 * `UninstallPluginOptions` + `enable: boolean` + an opt-in `local?: boolean`
 * for the per-machine override file.
 */
export interface EnableDisablePluginOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- threaded into `notify()` for the single softDepStatus(pi) probe. */
  readonly pi: ExtensionAPI;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** true -> enable; false -> disable. */
  readonly enable: boolean;
  /** When undefined, resolves the scope via project-then-user precedence (CMP-5). */
  readonly scope?: Scope;
  /**
   * When true, target `claude-plugins.local.json` instead of
   * `claude-plugins.json`. The base file is NEVER touched on the --local path.
   */
  readonly local?: boolean;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- matches standalone behavior.
   */
  readonly notifications?: EnableDisablePluginNotifications;
}

/** Outcome sentinel populated by the withStateGuard closure. */
type SetEnabledOutcome =
  | { kind: "idempotent" }
  | { kind: "fresh"; version?: string }
  | { kind: "invalid-config" }
  | { kind: "not-recorded" }
  | {
      kind: "enable-failed";
      cause: Error;
      recordedVersion?: string;
      rollbackPartials?: readonly RollbackPartial[];
    }
  | { kind: "disable-failed"; cause: Error; recordedVersion?: string };

/**
 * ENBL-02: the "currently disabled" marker is an explicit `enabled: false`
 * on the plugin install record. Duplicated locally from
 * `orchestrators/reconcile/plan.ts::isRecordedButDisabled` to avoid pulling
 * the reconcile module into the orchestrator's import graph (the planner is
 * the canonical owner; this predicate is the deliberate same-rule mirror).
 */
function isCurrentlyDisabled(installed: {
  compatibility: { installable: boolean };
  enabled: boolean;
}): boolean {
  return installed.compatibility.installable && !installed.enabled;
}

/**
 * Run the enable branch: invoke the guard-FREE `runInstallLedger` against the
 * OUTER transaction's state snapshot with the pinned version override (so
 * the disabled record's `version` is preserved across the re-materialization)
 * and `allowExistingRecord: true` (the disabled record is deliberately KEPT
 * per ENBL-02, so the PI-15 "already installed" sanity throw must not fire
 * for the re-materialization). Returns the outcome sentinel.
 *
 * CR-01: `installPlugin` MUST NOT be called here -- it opens its own
 * `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
 * (`retries: 0`) is not re-entrant, so the nested acquisition would throw
 * `StateLockHeldError` and every fresh enable would fail.
 */
async function runEnableBranch(
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  recordedVersion: string,
): Promise<SetEnabledOutcome> {
  // I4: thread an InstallFailureCapture so a rollback-partial enable failure
  // surfaces the per-phase rollback children in the (failed) row, matching
  // the install/uninstall cascade rendering. The ledger populates this BEFORE
  // it rethrows (D-02 PI-14 bypass preserves the raw error).
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  try {
    const result = await runInstallLedger(
      state,
      locations,
      {
        ctx: opts.ctx,
        scope,
        cwd: opts.cwd,
        marketplace: opts.marketplace,
        plugin: opts.plugin,
        pinVersionOverride: recordedVersion,
        allowExistingRecord: true,
      },
      capture,
    );
    if (result.kind === "marketplace-absent") {
      // Defensive: the caller already verified the marketplace container is
      // recorded in this scope's state, so the CMP-2..4 source resolution
      // should never miss. Surface a failed row rather than wedging.
      return {
        kind: "enable-failed",
        cause: new Error(`Marketplace "${opts.marketplace}" is not added in the ${scope} scope.`),
        recordedVersion,
      };
    }

    return { kind: "fresh", version: recordedVersion };
  } catch (err) {
    return {
      kind: "enable-failed",
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
      recordedVersion,
      ...(capture.rollbackPartials.length > 0 && { rollbackPartials: capture.rollbackPartials }),
    };
  }
}

/**
 * Run the disable branch: cascade-unstage artefacts via the existing
 * `cascadeUnstagePlugin` primitive, then reset `resources.*` to [] in place
 * (PRESERVING `version` / `resolvedSource` / `compatibility` / `installedAt`
 * per ENBL-02). Returns the outcome sentinel.
 *
 * WR-04: parameters carry the REAL types (`ScopedLocations` and the state
 * record shape) so the `cascadeUnstagePlugin` call type-checks without
 * casts -- an argument-order swap or a schema field rename is a COMPILE
 * error here, not a runtime corruption.
 */
async function runDisableBranch(
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  installed: InstalledPluginRecord,
): Promise<{ outcome: SetEnabledOutcome; saveShrunken: boolean; disabled?: DisabledPluginRecord }> {
  const recordedVersion = installed.version;
  const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);
  if (!cascade.ok) {
    // I3: cascade.dropped lists artefacts already unstaged before the throw.
    // Fold them into the record so state.json never claims artefacts gone
    // from disk (NFR-3 fail-clean). Uses the shared applyPartialCascadeFold
    // helper (TR-03 path); the caller saves the shrunken record before
    // surfacing the failure.
    applyPartialCascadeFold(installed, cascade.dropped);
    installed.updatedAt = new Date().toISOString();
    // WR-03: when the partial cascade DID succeed in unstaging the
    // on-disk hooks.json (cascade.dropped.hooks is non-empty), drop the
    // parsed-config cache entry and rebuild the routing table in lockstep
    // so dispatch does not try to spawn a now-deleted handler. Mirrors
    // the uninstall.ts cache-mutation invariant.
    if (cascade.dropped.hooks.length > 0) {
      dropCachedHooks(scope, opts.marketplace, opts.plugin, "partial-cascade ", false);
    }

    return {
      outcome: {
        kind: "disable-failed",
        cause: cascade.cause ?? new Error(`Cascade unstage failed for plugin "${opts.plugin}".`),
        recordedVersion,
      },
      saveShrunken: true,
    };
  }

  // PRESERVE version / resolvedSource / compatibility / installedAt;
  // RESET resources.*; SET enabled: false; BUMP updatedAt.
  // D-63-04 / COMPONENT_KINDS 5-tuple: cascadeUnstagePlugin physically
  // unstages hooks via removeHookConfig, so the disabled record's hooks
  // array must be zeroed alongside the other four axes to stay consistent
  // with what landed on disk.
  // ENBL-02: `toDisabledRecord` is the sole sanctioned producer of the
  // disabled shape -- its empty-tuple return type makes a disabled-but-
  // populated record a compile error. The resources arrays stay zeroed for
  // the convergence proof and any reader not yet migrated to the boolean
  // check. The caller replaces the map slot with the returned record (rather
  // than mutating in place) so the branded type survives to the assignment.
  const disabled = toDisabledRecord(installed, new Date().toISOString());

  // WR-03: the cascade unstaged the on-disk hooks.json via removeHookConfig;
  // drop the parsed-config cache entry and rebuild the routing table in
  // lockstep so subsequent dispatch events bypass the now-disabled plugin
  // without requiring /reload (NFR-2). Mirrors the uninstall.ts invariant.
  dropCachedHooks(scope, opts.marketplace, opts.plugin, "", true);

  return { outcome: { kind: "fresh", version: recordedVersion }, saveShrunken: false, disabled };
}

/**
 * WR-03: drop the parsed-config cache entry for a disabled plugin and
 * rebuild the routing table in lockstep. Wrapped in try/catch so a cache
 * mutation throw cannot escalate a successful disable into a failure --
 * the cache is rebuilt from state.json on the next /reload's factory-time
 * hydrate (D-59-02). The `logPrefix` distinguishes the partial-cascade
 * branch from the clean-disable branch in debug logs.
 *
 * `unexpected` marks the clean-disable path, where the cascade fully
 * succeeded and a routing-rebuild failure is NOT anticipated: the failure
 * message names the consequence (the disabled plugin's hooks stay live in
 * the running process) and the remedy (the disable's own `/reload` trailer
 * already instructs the user, and that reload rebuilds the routing table
 * from state.json). On the partial-cascade path a rebuild failure is an
 * expected secondary symptom of the cascade throw, so it stays terse.
 */
function dropCachedHooks(
  scope: Scope,
  marketplace: string,
  plugin: string,
  logPrefix: string,
  unexpected: boolean,
): void {
  try {
    removePluginConfigFromCache(scope, marketplace, plugin);
    rebuildRoutingTables();
  } catch (cacheErr) {
    const consequence = unexpected
      ? " -- hooks for this plugin remain active in the running process until the disable's /reload rebuilds the routing table from state.json"
      : "";
    hookDebugLog(
      `disable: ${logPrefix}cache/routing mutation failed for ${plugin}@${marketplace}: ${errorMessage(cacheErr)}${consequence}`,
    );
  }
}

/**
 * WR-04: the REAL state-record shape (the exact type
 * `cascadeUnstagePlugin` requires), aliased for readability. No local
 * structural mirror -- a schema field rename surfaces as a compile error in
 * this module instead of being silenced by an `as never` cast.
 */
type InstalledPluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/**
 * D-54-01 entrypoint. Never re-throws -- every failure surfaces through a
 * single `notify()` call per IL-2 (standalone) OR a typed outcome per
 * RECON-03 (orchestrated).
 *
 * Y3 (PR #51): overload pair so the orchestrated-mode return is narrowed to
 * `Promise<EnableDisablePluginOutcome>` (no `| undefined`) at the call site.
 * Mirrors the `AddMarketplaceNotifications` discriminant pattern. The
 * standalone arm keeps `| undefined` because it fires its own `notify()` and
 * the caller has nothing to consume. The reconcile cascade
 * (`applyPluginToggles`) used to carry an `if (result === undefined) continue`
 * guard that silently dropped the row -- the overload makes that branch a
 * compile error so the cascade always materialises a row (closes S6's fourth
 * loop in the same edit).
 */
export function setPluginEnabled(
  opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
): Promise<EnableDisablePluginOutcome>;
export function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined>;
// Sequencing the cross-scope resolve, the locked transaction body, the
// post-guard branch dispatch, and the C1 / I3 / I4 failure routings in one
// audited flow exceeds the default cognitive-complexity budget; splitting it
// would obscure the per-arm save-vs-throw discipline.
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined> {
  const { ctx, pi, cwd, marketplace, plugin, enable } = opts;
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // C1: `resolveCrossScopePluginTarget` calls `loadState`, which throws on a
  // corrupt/unparseable state.json in either scope. The throw must NOT escape
  // setPluginEnabled (the doc above promises "never re-throws") -- route it
  // through the same classifyTransactionThrow taxonomy the lower try/catch
  // uses. Mirrors the read-only `listPlugins` containment in pending.ts.
  let resolution;
  try {
    // SCOPE-01 / ATTR-04: resolve the cross-scope target.
    resolution = await resolveCrossScopePluginTarget({
      cwd,
      marketplace,
      plugin,
      ...(opts.scope !== undefined && { explicitScope: opts.scope }),
    });
  } catch (err) {
    return emitResolutionFailure({
      ctx,
      pi,
      marketplace,
      plugin,
      requestedScope: opts.scope,
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
      enable,
      orchestrated,
    });
  }

  if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
    const requestedScope: Scope | undefined = resolution.requestedScope;
    if (orchestrated) {
      const scopeList: readonly Scope[] =
        requestedScope === undefined ? ["project", "user"] : [requestedScope];
      const err = new MarketplaceNotFoundError(marketplace, scopeList);
      return {
        status: "failed",
        reason: "not added",
        error: err,
        cause: errorMessage(err),
      };
    }

    // M3 / M4: standalone `MarketplaceNotAddedMessage` per D-47-A.
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      ...(requestedScope !== undefined && { scope: requestedScope }),
    });
    return undefined;
  }

  const { scope, locations } = resolution;
  // WB-01 / UAT-05: target selected ONCE; the sibling path exists only for
  // the merged-view membership test (read fresh inside the lock, never
  // written).
  const { targetConfigPath, siblingConfigPath } = selectConfigWriteTarget(locations, opts.local);
  const configBasename = path.basename(targetConfigPath);

  let outcome: SetEnabledOutcome | undefined;

  try {
    // CR-01 / WR-01: a single per-scope lock owns the whole critical section.
    // The closure sequences CFG-03 load, ENBL-02 idempotency, the
    // enable/disable branch dispatch, the I3 shrunken-record save, and the
    // WR-09 / UAT-05 config write-back -- splitting it would require
    // additional state-snapshot threading and obscure the save-vs-throw
    // discipline.
    // eslint-disable-next-line sonarjs/cognitive-complexity
    await withLockedStateTransaction(locations, async (tx) => {
      const state = tx.state;
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        outcome = { kind: "invalid-config" };
        return;
      }

      const mp = state.marketplaces[marketplace];
      const installed = mp?.plugins[plugin];
      if (mp === undefined || installed === undefined) {
        outcome = { kind: "not-recorded" };
        return;
      }

      // ENBL-02 idempotency: empty-resources + installable:true marker.
      if (isCurrentlyDisabled(installed) === !enable) {
        // WR-03: state-side truth alone is not enough.
        // When the targeted config carries the OPPOSITE EXPLICIT `enabled`
        // value (hand-edited config, or base/local divergence pending
        // reconcile), skipping here would leave the config diverged -- and
        // the next reconcile would apply the config side and INVERT the
        // user's explicit command. Mirror autoupdate's
        // `reclassifyByConfigTruth` promotion: the flip is fresh for the
        // CONFIG write even though the state side already matches (state
        // untouched -- no tx.save(), mtime stable). A MISSING entry /
        // missing `enabled` field keeps the state-side classification
        // as-is, exactly like the autoupdate analog.
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        const configEnabled = current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
        if (!orchestrated && configEnabled !== undefined && configEnabled !== enable) {
          // UAT-05: membership gate against BOTH physical files (base ∪
          // local) so a --local flip never re-declares a base-declared
          // marketplace (CFG-02 wholesale shadowing). Sibling read is fresh
          // inside the lock; membership test only.
          //
          // S4 (PR #51, CONTEXT.md S4): `adoptedSource === undefined`
          // collapses the benign (already-declared) and dangerous
          // (no string `source.raw`) arms. The dangerous arm writes a
          // dangling plugin declaration -- acknowledged trade-off pending
          // a return-type widen in a follow-up PR.
          const adoptedSource = await synthesizeAdoptedMarketplaceSource({
            current,
            siblingConfigPath,
            state,
            marketplace,
          });
          await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
            ...(adoptedSource !== undefined && {
              marketplaces: { [marketplace]: { source: adoptedSource } },
            }),
            plugins: { [`${plugin}@${marketplace}`]: { enabled: enable } },
          });
          outcome = { kind: "fresh", version: installed.version };
          return;
        }

        outcome = { kind: "idempotent" };
        return;
      }

      if (enable) {
        outcome = await runEnableBranch(opts, scope, locations, state, installed.version);
      } else {
        const disableResult = await runDisableBranch(opts, scope, locations, installed);
        outcome = disableResult.outcome;
        // ENBL-02: on a clean disable, replace the map slot with the branded
        // `DisabledPluginRecord` the branch built via `toDisabledRecord`
        // (rather than mutating `installed` in place). The terminal
        // `tx.save()` below persists tx.state with the replaced slot.
        if (disableResult.disabled !== undefined) {
          mp.plugins[plugin] = disableResult.disabled;
        }

        // I3: a partial disable cascade mutated `installed.resources.*` in
        // place to drop the artefacts already removed before the throw.
        // Persist the shrunken record so state.json never claims artefacts
        // gone from disk (NFR-3 fail-clean), THEN fall through to the
        // post-guard branch that surfaces the failed row.
        if (disableResult.saveShrunken) {
          await tx.save();
          return;
        }
      }

      if (outcome.kind !== "fresh") {
        return;
      }

      // Config write-back via the SOLE sanctioned saveConfig seam (SPLIT-02).
      //
      // WR-09: SKIPPED in orchestrated mode. A
      // reconcile-driven call derives the desired state FROM the merged
      // config (base + local), so the declaration already exists by
      // construction -- possibly ONLY in `claude-plugins.local.json` (the
      // per-machine override). Writing it back here would
      // copy the local override's `enabled` flag into the shared BASE file
      // and clobber a user-authored base declaration. The config is the
      // reconcile's INPUT; only standalone commands author declarations.
      // CR-02: when the scope's MERGED config view does
      // not declare the marketplace (CMP-3 clone-adoption legacy, or a
      // hand-pruned config), declare it in the SAME batched patch -- a bare
      // plugin key would otherwise be a dangling declaration the planner
      // converts into a marketplace removal + perpetual failed row.
      // UAT-05: the gate considers BOTH physical files (base ∪ local) so a
      // --local flip never re-declares a base-declared marketplace (CFG-02
      // wholesale shadowing). Sibling read is fresh inside the lock;
      // membership test only.
      if (!orchestrated) {
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        const adoptedSource = await synthesizeAdoptedMarketplaceSource({
          current,
          siblingConfigPath,
          state,
          marketplace,
        });
        // S4 (PR #51, CONTEXT.md S4): see the synthesizeAdoptedMarketplaceSource
        // call above -- the `adoptedSource === undefined` benign /
        // dangerous arms collapse, and the dangerous arm sealing the
        // dangling declaration is an acknowledged trade-off pending a
        // helper-return widen.
        await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
          ...(adoptedSource !== undefined && {
            marketplaces: { [marketplace]: { source: adoptedSource } },
          }),
          plugins: { [`${plugin}@${marketplace}`]: { enabled: enable } },
        });
      }

      await tx.save();
    });
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(errorMessage(err));
    if (orchestrated) {
      return {
        status: "failed",
        reason: classifyTransactionThrow(cause),
        error: cause,
        cause: errorMessage(cause),
      };
    }

    // D-04: the `failed` row's bytes are identical across both verbs; emit it
    // through the active verb's CommandContext for naming consistency.
    emitEnableDisableFailedRow({
      ctx,
      pi,
      enable,
      marketplace,
      scope,
      row: {
        status: "failed",
        name: plugin,
        reasons: [] as const,
        cause,
        // D-03/D-06: a transaction-throw enable/disable failure -> error, no
        // reload.
        severity: "error",
        needsReload: false,
      },
    });
    return undefined;
  }

  if (orchestrated) {
    return outcomeToTypedResult({ plugin, enable, outcome, configBasename });
  }

  dispatchOutcome({ ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome });
  return undefined;
}

/**
 * WR-04: closed-set reason for an orchestrated transaction
 * throw. The transaction body also runs loadConfig, writeConfigEntry /
 * saveConfig, and tx.save() -- an EACCES on the config write or a disk-full
 * on state save is NOT a lock conflict. Only a genuine StateLockHeldError
 * may render `{lock held}`; other throws narrow through the same errno
 * ladder the standalone disable arm uses (permission denied / source
 * missing / unreadable).
 */
function classifyTransactionThrow(cause: Error): Reason {
  return cause instanceof StateLockHeldError
    ? "lock held"
    : (narrowDisableFailure(cause)[0] ?? "unreadable");
}

/**
 * C1: route a pre-lock `resolveCrossScopePluginTarget` throw (corrupt
 * state.json -> `loadState` throw) through the same closed-set Reason
 * taxonomy the transaction catch uses. Renders a `(failed)` plugin row.
 *
 * T-53-02-02 information-disclosure mitigation: `loadState`'s error message
 * embeds the absolute state.json path. We compose a basename-only Error so
 * the rendered cause-chain trailer leaks only `state.json`, not the absolute
 * scopeRoot path. The `requestedScope` (when known) chooses the mp-row scope
 * bracket; the bare form picks the requested scope or "user" so the failed
 * row always carries a scope token (no ambiguous bareheader).
 */
function emitResolutionFailure(args: {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  marketplace: string;
  plugin: string;
  requestedScope: Scope | undefined;
  cause: Error;
  enable: boolean;
  orchestrated: boolean;
}): EnableDisablePluginOutcome | undefined {
  const { ctx, pi, marketplace, plugin, requestedScope, cause, enable, orchestrated } = args;
  const sanitized = sanitizeStateLoadError(cause);
  // classifyTransactionThrow returns a `Reason` (closed set including
  // "lock held"); none of the narrower outputs are the structural
  // "not added" sentinel, so a ContentReason cast is sound here.
  const reason: ContentReason = classifyTransactionThrow(sanitized) as ContentReason;
  if (orchestrated) {
    return {
      status: "failed",
      reason,
      error: sanitized,
      cause: errorMessage(sanitized),
    };
  }

  const scope: Scope = requestedScope ?? "user";
  // D-04: the `failed` row's bytes are identical across both verbs; emit it
  // through the active verb's CommandContext for naming consistency.
  emitEnableDisableFailedRow({
    ctx,
    pi,
    enable,
    marketplace,
    scope,
    row: {
      status: "failed",
      name: plugin,
      reasons: [reason],
      cause: sanitized,
      // D-03/D-06: a pre-lock resolution failure -> error, no reload.
      severity: "error",
      needsReload: false,
    },
  });
  return undefined;
}

/**
 * D-04: emit a single `(failed)` cascade row through the active verb's
 * CommandContext. The `failed` arm is byte-identical in `ENABLE_CONTEXT` and
 * `DISABLE_CONTEXT`, so this helper only selects which context's
 * `Messaging.label` owns the row; it exists to keep the verb-branch confined to
 * a single concrete (non-union) `notifyWithContext` call per arm so each context
 * keeps its own `Status` / `Msg` instantiation.
 */
function emitEnableDisableFailedRow(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly enable: boolean;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly row: PluginFailedMessage;
}): void {
  const { ctx, pi, enable, marketplace, scope, row } = args;
  if (enable) {
    notifyWithContext(ctx, pi, ENABLE_CONTEXT, [{ name: marketplace, scope, plugins: [row] }]);
  } else {
    notifyWithContext(ctx, pi, DISABLE_CONTEXT, [{ name: marketplace, scope, plugins: [row] }]);
  }
}

/**
 * T-53-02-02: rewrite a `loadState` Error so its message carries the basename
 * of the failing path instead of the absolute path. The chained `cause` is
 * preserved unchanged (the renderer's 4-space-indent trailer surfaces the
 * top-level message only).
 */
function sanitizeStateLoadError(err: Error): Error {
  const original = errorMessage(err);
  // loadState formats messages as "Failed to read <abs>:" / "state.json at
  // <abs> is not valid JSON:" / "state.json at <abs> failed schema validation:"
  // The absolute path is the only PII; collapse it to the basename through
  // the shared redactAbsolutePaths seam (T-55-02-02), so paths under
  // <scopeRoot>/pi-claude-marketplace/state.json collapse to "state.json".
  const sanitized = redactAbsolutePaths(original);
  if (sanitized === original) {
    return err;
  }

  const wrapped = new Error(sanitized);
  wrapped.name = err.name;
  return wrapped;
}

/**
 * RECON-03: map the internal `SetEnabledOutcome` sentinel to the typed
 * `EnableDisablePluginOutcome` for orchestrated callers. Mirrors the
 * standalone `composeOutcomeRow` taxonomy.
 */
function outcomeToTypedResult(args: {
  plugin: string;
  enable: boolean;
  configBasename: string;
  outcome: SetEnabledOutcome | undefined;
}): EnableDisablePluginOutcome {
  const { plugin, enable, configBasename, outcome } = args;
  if (outcome === undefined) {
    const err = new Error(
      `setPluginEnabled: internal error -- guard returned cleanly without populating outcome for plugin "${plugin}".`,
    );
    return { status: "failed", reason: "unreadable", error: err, cause: errorMessage(err) };
  }

  switch (outcome.kind) {
    case "invalid-config": {
      const err = new Error(`Config file "${configBasename}" failed schema validation.`);
      return { status: "failed", reason: "invalid manifest", error: err, cause: errorMessage(err) };
    }

    case "not-recorded": {
      return { status: "skipped", name: plugin, reason: "not installed" };
    }

    case "idempotent": {
      return {
        status: "skipped",
        name: plugin,
        reason: enable ? "already enabled" : "already disabled",
      };
    }

    case "enable-failed": {
      // I4: orchestrated callers cannot consume the structured
      // `rollbackPartial[]` rows (they aggregate into the reconcile cascade
      // which already composes its own per-plugin rows), but the
      // `rollback partial` reason on the typed outcome lets the caller pick
      // the catalog `(failed) {rollback partial}` byte form when rendering.
      const partials = outcome.rollbackPartials ?? [];
      const reason: ContentReason =
        partials.length > 0
          ? "rollback partial"
          : (narrowEnableFailure(outcome.cause)[0] ?? "unreadable");
      return {
        status: "failed",
        reason,
        error: outcome.cause,
        cause: errorMessage(outcome.cause),
      };
    }

    case "disable-failed": {
      return {
        status: "failed",
        reason: narrowDisableFailure(outcome.cause)[0] ?? "unreadable",
        error: outcome.cause,
        cause: errorMessage(outcome.cause),
      };
    }

    case "fresh": {
      return enable
        ? {
            status: "enabled",
            name: plugin,
            ...(outcome.version !== undefined && { version: outcome.version }),
          }
        : {
            status: "disabled",
            name: plugin,
            ...(outcome.version !== undefined && { version: outcome.version }),
          };
    }
  }
}

/**
 * Compose the per-outcome `PluginNotificationMessage` and emit a single
 * `notify()` per IL-2. Extracted from `setPluginEnabled` to keep the main
 * orchestrator's cognitive complexity within the project's lint budget.
 */
function dispatchOutcome(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome | undefined;
}): void {
  const { ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome } = args;
  const row = composeOutcomeRow({ plugin, enable, configBasename, outcome });
  // RLD-05 / D-07: the disable verb no longer threads a distinguishing cascade
  // kind. The fresh `(disabled)` row stamps `needsReload: true` directly (its
  // artefacts were unstaged -- SNM-33), so the `/reload to pick up changes`
  // trailer fires via the RLD-02 OR-reduce of the per-row stamps. The disable
  // verb's non-fresh arms (idempotent / failed / not-recorded) stamp
  // `needsReload: false`; the enable verb's `(installed)` fresh row stamps
  // `true`.
  //
  // D-04 / D-10: the verb selects its OWN CommandContext -- ENABLE_CONTEXT
  // renders the fresh `(installed)` row, DISABLE_CONTEXT the fresh
  // `(disabled)` row; both share byte-identical `skipped` / `failed` arms.
  if (enable) {
    // WR-01: `composeOutcomeRow` returns `EnableMsg | DisableMsg`; the `enable`
    // branch only ever yields an `EnableMsg` (its `fresh` arm emits `installed`,
    // never `disabled`), so narrowing to the ENABLE_CONTEXT row type is sound.
    const enableRow = row as EnableMsg;
    notifyWithContext(ctx, pi, ENABLE_CONTEXT, [
      { name: marketplace, scope, plugins: [enableRow] },
    ]);
  } else {
    // WR-01: the `!enable` branch only ever yields a `DisableMsg` (its `fresh`
    // arm emits `disabled`, never `installed`), so narrowing to the
    // DISABLE_CONTEXT row type is sound.
    const disableRow = row as DisableMsg;
    notifyWithContext(ctx, pi, DISABLE_CONTEXT, [
      { name: marketplace, scope, plugins: [disableRow] },
    ]);
  }
}

/** Internal: build the plugin row for the outcome (bare mp header -- UAT-04). */
function composeOutcomeRow(args: {
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome | undefined;
}): EnableMsg | DisableMsg {
  const { plugin, enable, configBasename, outcome } = args;
  if (outcome === undefined) {
    return {
      status: "failed",
      name: plugin,
      reasons: [] as const,
      cause: new Error(
        `setPluginEnabled: internal error -- guard returned cleanly without populating outcome for plugin "${plugin}".`,
      ),
      // D-03/D-06: enable/disable failure -> error, no reload.
      severity: "error",
      needsReload: false,
    };
  }

  switch (outcome.kind) {
    case "invalid-config":
      return {
        status: "failed",
        name: plugin,
        reasons: ["invalid manifest"] as const,
        cause: new Error(`Config file "${configBasename}" failed schema validation.`),
        // D-03/D-06: invalid-config abort -> error, no reload.
        severity: "error",
        needsReload: false,
      };
    case "not-recorded":
      // WR-03: the marketplace container is PRESENT but the plugin row is
      // absent from state.json (never installed, or concurrently
      // uninstalled). The established taxonomy (ATTR-08, reinstall/update
      // precedent) reserves `{not in manifest}` for "plugin absent from a
      // PRESENT manifest" and uses `(skipped) {not installed}` for
      // "marketplace present, plugin not installed". Non-benign reason ->
      // warning severity (catalog `enable-not-installed` state).
      return {
        status: "skipped",
        name: plugin,
        reasons: ["not installed"] as const,
        // D-03/D-06: `not installed` is actionable -> warning, no reload.
        severity: "warning",
        needsReload: false,
      };
    case "idempotent": {
      const reason: ContentReason = enable ? "already enabled" : "already disabled";
      return {
        status: "skipped",
        name: plugin,
        reasons: [reason],
        // D-03/D-06: `already enabled`/`already disabled` is benign -> info,
        // no reload.
        severity: "info",
        needsReload: false,
      };
    }

    case "enable-failed": {
      // I4: a non-empty `rollbackPartials` capture means the install ledger
      // unwound a partial commit before rethrowing; render the catalog
      // `rollback partial` reason + per-phase child rows (MSG-RP-1) so the
      // operator sees which phases needed recovery, matching the standalone
      // install/uninstall path (`composeInstallFailureMessage`).
      const partials = outcome.rollbackPartials ?? [];
      const baseReasons =
        partials.length > 0 ? (["rollback partial"] as const) : narrowEnableFailure(outcome.cause);
      const row: PluginFailedMessage = {
        status: "failed",
        name: plugin,
        reasons: baseReasons,
        ...(outcome.recordedVersion !== undefined && { version: outcome.recordedVersion }),
        cause: outcome.cause,
        // D-03/D-06: a failed enable -> error, no reload.
        severity: "error",
        needsReload: false,
        ...(partials.length > 0 && {
          rollbackPartial: partials.map((p) => ({
            phase: p.phase,
            ...(p.cause !== undefined && { cause: p.cause }),
          })),
        }),
      };
      return row;
    }

    case "disable-failed":
      return {
        status: "failed",
        name: plugin,
        reasons: narrowDisableFailure(outcome.cause),
        ...(outcome.recordedVersion !== undefined && { version: outcome.recordedVersion }),
        cause: outcome.cause,
        // D-03/D-06: a failed disable -> error, no reload.
        severity: "error",
        needsReload: false,
      };
    case "fresh":
      // UAT-04: the fresh-enable header is the BARE always-marketplace-header
      // form (no `(added)` token -- that header belongs to `marketplace add`;
      // the former `(added)` leaked from reusing the install-cascade header
      // shape with mp.status "added"). UAT-03: the fresh-disable row carries
      // the closed-set `(disabled)` token -- same glyph + token as the
      // disabled-inventory row, version slot kept -- instead of
      // `(uninstalled)`. RLD-05 / D-07: the reload-hint fires via the
      // per-row `needsReload: true` stamp (RLD-02 OR-reduce), not a cascade
      // kind.
      return enable
        ? {
            status: "installed",
            name: plugin,
            dependencies: [],
            ...(outcome.version !== undefined && { version: outcome.version }),
            // D-03/D-06: a realized re-enable re-materializes artefacts -> info,
            // reloads Pi resources.
            severity: "info",
            needsReload: true,
          }
        : {
            // D-06/RLD-02: a realized fresh disable unstages Pi-visible
            // artefacts, so it stamps needsReload directly -- this is what lets
            // the reload trailer fire via the OR-reduce instead of the
            // kind-based `disable-cascade` straddle. List/info `disabled`
            // inventory rows stamp needsReload:false, so the trailer stays
            // scoped to the realized transition.
            status: "disabled",
            name: plugin,
            ...(outcome.version !== undefined && { version: outcome.version }),
            severity: "info",
            needsReload: true,
          };
  }
}

/**
 * Narrow an enable-branch failure cause to a closed Reason. ENOENT-class
 * failures surface as `source missing` (ENBL-03 missing-clone path);
 * everything else falls back to an empty array so the renderer suppresses
 * the brace and surfaces the cause-chain trailer.
 */
function narrowEnableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause) && cause.code === "ENOENT") {
    return ["source missing"];
  }

  const chained = cause.cause;
  if (chained !== undefined && isErrnoException(chained) && chained.code === "ENOENT") {
    return ["source missing"];
  }

  // Defensive: an empty reasons array lets the renderer suppress the brace
  // while still surfacing the cause via the 4-space-indent trailer.
  return [];
}

/**
 * Narrow a disable-branch cascade failure to a closed Reason. Mirrors the
 * uninstall.ts `narrowCascadeFailure` taxonomy (permission denied / source
 * missing / unreadable). The full taxonomy is duplicated locally rather than
 * exported from uninstall.ts because the disable branch is structurally a
 * cascade re-use of uninstall's primitives -- the two should drift together.
 */
function narrowDisableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return ["permission denied"];
      case "ENOENT":
        return ["source missing"];
      default:
        break;
    }
  }

  return ["unreadable"];
}

/** Structural predicate for `NodeJS.ErrnoException`. */
function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error && "code" in err && typeof (err as { code?: unknown }).code === "string"
  );
}
