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
// Locking model: exactly ONE per-scope lock owns the
// whole critical section. The enable branch calls `runInstallLedger` (the
// guard-FREE ledger body exported by install.ts) against THIS transaction's
// state snapshot -- calling `installPlugin` here would nest a second
// `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
// (`retries: 0`) is not re-entrant, so every fresh enable would self-deadlock
// (ELOCKED -> StateLockHeldError). The single snapshot also guarantees the
// ledger's state mutation is what gets saved (no outer stale-snapshot
// clobber; ST-7 / D-06 single-writer preserved).
//
// Save discipline: `tx.save()` fires ONLY on the
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
// D-103-13: absent the flag the target follows the DECLARATION -- the local
// file when the plugin key is declared there, the base file otherwise. The flag
// names the file the user wants written; it cannot name the file a declaration
// already lives in. CFG-02 replaces a same-keyed base entry wholesale, so a
// flagless flip written to the base file under a local declaration moves no
// merged value: the verb reports success and the next reconcile pass plans the
// opposite of the command. Selection therefore happens INSIDE the lock (it
// reads a config file) -- see `selectDeclaringConfigWriteTarget`.
//
// T-53-02-02 / T-54-02-02 information disclosure mitigation: the CFG-03
// abort row carries `path.basename(targetConfigPath)` -- never the absolute
// path -- reusing the dry-run preview pattern.

import path from "node:path";

import { rebuildRoutingTables, removePluginConfigFromCache } from "../../bridges/hooks/index.ts";
import { isRecordedButDisabled, toDisabledRecord } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity, malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { redactAbsolutePaths } from "../../shared/notify.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
  narrowDisableFailure,
  narrowEnableFailure,
  staleGateDropped,
  type DisableMsg,
  type EnableMsg,
} from "./enable-disable.messaging.ts";
import { runInstallLedger } from "./install.ts";
import {
  absentTargetReasons,
  applyPartialCascadeFold,
  emitMarketplaceNotAdded,
  missIsNotInstalled,
  enableRowDependencies,
  resolveCrossScopePluginTarget,
  selectDeclaringConfigWriteTarget,
  type CrossScopePluginResolution,
  type DeclaringConfigWriteTarget,
  type LedgerDegradationSignals,
  writeAdoptingConfigEntries,
} from "./shared.ts";

import type { InstallFailureCapture } from "./install.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { DisabledPluginRecord, ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../../platform/pi-api.ts";
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
 * The degradation signals a re-enable's ledger run produces. An alias of the
 * shared `LedgerDegradationSignals` shape, kept under the enable-side name its
 * consumers already import (`reconcile/apply-outcomes.ts`, `reconcile/apply.ts`).
 *
 * The shape itself lives in `./shared.ts` because `install.ts` intersects it
 * too and this module imports `runInstallLedger` from `install.ts` -- declaring
 * it here would close a module cycle (IN-07 / D-98-01).
 */
export type EnableDegradationSignals = LedgerDegradationSignals;

/**
 * RECON-03: discriminated outcome returned by `setPluginEnabled` in
 * orchestrated mode.
 *
 * - `"enabled"` -- the enable branch re-materialized the plugin.
 * - `"disabled"` -- the disable branch cascaded-unstaged the artifacts and
 *   reset `resources.*` while preserving the state record.
 * - `"skipped"` -- the idempotent already-enabled / already-disabled arm.
 *   The `reason` carries the standalone benign Reason for parity with the
 *   standalone rendering token set.
 * - `"failed"` -- enable / disable / not-recorded / invalid-config /
 *   marketplace-not-added paths. `reason` typed `Reason` so the
 *   structural `"marketplace not added"` sentinel can flow through the same field.
 */
export type EnableDisablePluginOutcome =
  | ({
      readonly status: "enabled";
      readonly name: string;
      readonly version?: string;
    } & EnableDegradationSignals)
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
  | ({
      kind: "fresh";
      version?: string;
    } & EnableDegradationSignals)
  | { kind: "invalid-config" }
  /**
   * SCOPE-01: `notInstalledAt` is set ONLY on the cross-scope arm -- the scope
   * the operator named, whose marketplace container is registered one scope
   * over. The in-scope arm (container here, plugin row absent) omits it, and
   * the two arms then render different braces for their different remedies.
   */
  | { kind: "not-recorded"; notInstalledAt?: Scope }
  | {
      kind: "enable-failed";
      cause: Error;
      recordedVersion?: string;
      rollbackPartials?: readonly RollbackPartial[];
    }
  | { kind: "disable-failed"; cause: Error; recordedVersion?: string };

/**
 * Run the enable branch: invoke the guard-FREE `runInstallLedger` against the
 * OUTER transaction's state snapshot with the pinned version override (so
 * the disabled record's `version` is preserved across the re-materialization)
 * and `allowExistingRecord: true` (the disabled record is deliberately KEPT
 * per ENBL-02, so the PI-15 "already installed" sanity throw must not fire
 * for the re-materialization). Returns the outcome sentinel.
 *
 * `installPlugin` MUST NOT be called here -- it opens its own
 * `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
 * (`retries: 0`) is not re-entrant, so the nested acquisition would throw
 * `StateLockHeldError` and every fresh enable would fail.
 */
async function runEnableBranch(
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  installed: InstalledPluginRecord,
): Promise<SetEnabledOutcome> {
  const recordedVersion = installed.version;
  // ENBL-07 / NFR-7: derive the ledger's gate from the record's OWN
  // availability discriminant. A record disabled while soft-degraded
  // (`installable: false`) must re-materialize in place, so it resolves
  // through `requirePartialInstallable` -- the same partial-capable stance
  // reinstall takes for backfill (D-68-02). The structurally `unavailable`
  // arm is still rejected by that gate, and a record that was fully
  // installable keeps the strict gate.
  //
  // FORCE-05 / D-69-01: this is a DELIBERATE departure from the "--partial is an
  // explicit opt-in" rule, and it applies to the load-time reconcile enable
  // too (no command typed). The precedent is the autoupdate cascade
  // (`update.ts` -> `updateSinglePlugin`, SEV-03 / D-69-01), which likewise
  // takes the partial path automatically: re-materializing the record's own
  // already-degraded shape is a repair, not a new degradation the user must
  // consent to, and `requirePartialInstallable` still blocks a structurally
  // `unavailable` candidate either way. What the precedent also requires is
  // that the degrade be SIGNALLED -- hence the `(partially-installed)` row
  // with the dropped kinds on both the standalone and the orchestrated arm.
  //
  // WR-02 / D-98-03: reading the PERSISTED record makes this gate stale
  // whenever the manifest entry gained an unsupported kind after the disable,
  // so the strict arm rejects a plugin `update --partial` could still re-pin --
  // `staleGateDropped` recognises that rejection and the row names the remedy.
  const partial = !installed.compatibility.installable;
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
        partial,
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

    // ENBL-07 / FSTAT-07 / D-66-04 / SURF-05 / WARN-01: thread the LIVE
    // degradation signals out of the ledger. The enable branch runs the SAME
    // `runInstallLedger` over the SAME bridges as `install`, so all three
    // signals `install.ts` composes off its own ledger context are carried on
    // the returned summary and all three are read here -- a row that named only
    // one of them would contradict the ledger that produced it just as surely
    // as an `(installed)` row over a `partially-available` resolution does.
    //
    // The `unsupported` kind list reads the ledger's OWN resolution, never the persisted
    // `compatibility` block the enable gate was derived from: the record the
    // state phase just wrote carries `installable: false` plus that same
    // non-empty kind list, so a bare `(installed)` row here would contradict
    // the `(partially-installed)` row `list` renders one command later.
    const summary = result.summary;
    const resolved = summary.resolved;
    const degradedKinds = Array.from(new Set(summary.frontmatterDegradations.map((d) => d.kind)));
    return {
      kind: "fresh",
      version: recordedVersion,
      ...(resolved.state === "partially-available" && {
        unsupported: [...resolved.unsupported],
      }),
      ...(resolved.orphanRewake === true && { orphanRewake: true }),
      ...(degradedKinds.length > 0 && { degradedKinds }),
      // SEV-01 / D-98-02: the LENGTH of the staged-name arrays only. The names
      // themselves must never reach a rendered row -- the row needs the
      // declaration verdict, nothing more.
      ...(summary.stagedAgentNames.length > 0 && { stagedAgents: true }),
      ...(summary.stagedMcpServerNames.length > 0 && { stagedMcpServers: true }),
    };
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
 * Run the disable branch: cascade-unstage every artifact via the existing
 * `cascadeUnstagePlugin` primitive, then flip the record to its disabled form
 * (ENBL-02 / ENBL-18: `enabled: false` plus a fresh `updatedAt`, everything
 * else -- `version` / `resolvedSource` / `compatibility` / `installedAt` /
 * `resources` -- preserved). Returns the outcome sentinel.
 *
 * Parameters carry the REAL types (`ScopedLocations` and the state
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
    // I3: cascade.dropped lists artifacts already unstaged before the throw.
    // Fold them into the record so state.json never claims artifacts gone
    // from disk (NFR-3 fail-clean). Uses the shared applyPartialCascadeFold
    // helper (TR-03 path); the caller saves the shrunken record before
    // surfacing the failure.
    applyPartialCascadeFold(installed, cascade.dropped);
    installed.updatedAt = new Date().toISOString();
    // When the partial cascade DID succeed in unstaging the
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

  // SET enabled: false; BUMP updatedAt; PRESERVE everything else.
  // ENBL-13 / D-100-04 / COMPONENT_KINDS 5-tuple: artifact removal stays
  // symmetric across all five kinds -- the cascade above physically unstages
  // hooks via removeHookConfig alongside skills, commands, agents and mcp.
  // ENBL-18 / D-100-10: what the record retains is its DESCRIPTION of the
  // installation, not the artifacts. The record answers "what does this plugin
  // contain", which stays true while the plugin is disabled and stays
  // answerable after the marketplace manifest drops the entry; it was never a
  // mirror of the current disk contents. Nothing reads emptiness as the
  // disabled marker -- `isRecordedButDisabled` reads the boolean alone.
  // ENBL-02: `toDisabledRecord` is the sole sanctioned producer of the disabled
  // shape -- its `resources: R` passthrough makes changing the inventory a
  // compile error there. The caller replaces the map slot with the returned
  // record (rather than mutating in place) so the type survives to the
  // assignment.
  const disabled = toDisabledRecord(installed, new Date().toISOString());

  // The cascade unstaged the on-disk hooks.json via removeHookConfig;
  // drop the parsed-config cache entry and rebuild the routing table in
  // lockstep so subsequent dispatch events bypass the now-disabled plugin
  // without requiring /reload (NFR-2). Mirrors the uninstall.ts invariant.
  dropCachedHooks(scope, opts.marketplace, opts.plugin, "", true);

  return { outcome: { kind: "fresh", version: recordedVersion }, saveShrunken: false, disabled };
}

/**
 * Drop the parsed-config cache entry for a disabled plugin and
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
 * The REAL state-record shape (the exact type
 * `cascadeUnstagePlugin` requires), aliased for readability. No local
 * structural mirror -- a schema field rename surfaces as a compile error in
 * this module instead of being silenced by an `as never` cast.
 */
type InstalledPluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
/**
 * The plugin identity a config write-back needs, resolved once before the lock
 * so the write helpers stay pure module functions rather than closures over the
 * orchestrator body. The FILES are not part of it: D-103-13 chooses those
 * inside the lock, and both parses travel together in the selection.
 */
interface EnabledFlagWriteTarget {
  readonly marketplace: string;
  readonly plugin: string;
  readonly enable: boolean;
  readonly orchestrated: boolean;
  readonly scopeRoot: string;
}

/** D-103-13: the selection arm that actually names a write target. */
type SelectedConfigWriteTarget = Extract<DeclaringConfigWriteTarget, { kind: "selected" }>;

/**
 * Write the plugin's `enabled` flag back through the SOLE sanctioned
 * saveConfig seam (SPLIT-02).
 *
 * CMP-3: when the scope's MERGED config view does not declare the
 * marketplace (clone-adoption legacy, or a hand-pruned config), declare it in
 * the SAME batched patch -- a bare plugin key would otherwise be a dangling
 * declaration the planner converts into a marketplace removal plus a
 * perpetual failed row.
 *
 * UAT-05: the membership gate considers BOTH physical files (base union
 * local) so a `--local` flip never re-declares a base-declared marketplace
 * (CFG-02 wholesale shadowing). Both parses arrive from the caller's
 * in-lock selection, so no arm here re-reads a file another arm already read.
 * An UNREADABLE sibling skips the adoption write instead of counting as a file
 * that declares nothing.
 *
 * S4 (PR #51, CONTEXT.md S4): the shared helper's `adoptedSource === undefined`
 * arms collapse -- benign (already declared) and dangerous (no string
 * `source.raw`). The dangerous arm seals a dangling plugin declaration; an
 * acknowledged trade-off pending a return-type widen.
 */
async function writeEnabledFlagBack(
  write: EnabledFlagWriteTarget,
  selection: SelectedConfigWriteTarget,
  state: ExtensionState,
): Promise<void> {
  await writeAdoptingConfigEntries({
    current: selection.current,
    sibling: selection.sibling,
    state,
    marketplace: write.marketplace,
    plugin: write.plugin,
    targetConfigPath: selection.targetConfigPath,
    scopeRoot: write.scopeRoot,
    pluginPatch: { enabled: write.enable },
  });
}

/**
 * ENBL-05 idempotency resolution, reached once the state side already matches
 * the requested value.
 *
 * State-side truth alone is not enough. When the targeted config carries the
 * OPPOSITE EXPLICIT `enabled` value (hand-edited config, or base/local
 * divergence pending reconcile), skipping here would leave the config
 * diverged, and the next reconcile would apply the config side and INVERT the
 * user's explicit command. This mirrors autoupdate's `reclassifyByConfigTruth`
 * promotion: the flip is fresh for the CONFIG write even though the state
 * side already matches, so state stays untouched (no tx.save(), mtime
 * stable). A MISSING entry or a missing `enabled` field keeps the state-side
 * classification as-is, exactly like the autoupdate analog.
 */
async function resolveIdempotentOutcome(
  write: EnabledFlagWriteTarget,
  selection: SelectedConfigWriteTarget,
  state: ExtensionState,
  installed: { readonly version: string },
): Promise<SetEnabledOutcome> {
  const { marketplace, plugin, enable, orchestrated } = write;
  const configEnabled = selection.current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
  if (orchestrated || configEnabled === undefined || configEnabled === enable) {
    return { kind: "idempotent" };
  }

  await writeEnabledFlagBack(write, selection, state);
  return { kind: "fresh", version: installed.version };
}

/**
 * SCOPE-01: render the miss for a target that did not resolve. Extracted from
 * `setPluginEnabled` so its cognitive complexity stays under the ceiling.
 *
 * Two claims, two rows. When the container sits one scope over, nothing is
 * installed at the scope the operator named, so the PLUGIN is the subject and
 * the row is the same `(skipped) {not installed}` an in-scope marketplace with
 * no record yields. When the container is absent from BOTH scopes the
 * marketplace row stands, so a typo'd marketplace name is not disguised as a
 * plugin that merely is not installed.
 */
async function emitUnresolvedTarget(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly enable: boolean;
  readonly orchestrated: boolean;
  readonly resolution: Exclude<CrossScopePluginResolution, { kind: "resolved" }>;
}): Promise<EnableDisablePluginOutcome | undefined> {
  const { ctx, pi, cwd, marketplace, plugin, enable, orchestrated, resolution } = args;

  const notInstalledAt = await missIsNotInstalled({ cwd, marketplace, resolution });
  if (notInstalledAt === undefined) {
    return emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace,
      requestedScope: resolution.requestedScope,
      orchestrated,
    });
  }

  if (orchestrated) {
    return { status: "skipped", name: plugin, reason: "not installed" };
  }

  dispatchOutcome({
    ctx,
    pi,
    marketplace,
    scope: notInstalledAt,
    plugin,
    enable,
    // Only the `invalid-config` arm reads this, and `not-recorded` is not it.
    configBasename: "",
    outcome: { kind: "not-recorded", notInstalledAt },
  });
  return undefined;
}

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

  // SCOPE-01: the two misses make DIFFERENT claims and must not share a row.
  // `other-scope` means the marketplace exists, just not at the requested
  // scope -- so no install record can exist there either, and the truthful
  // complaint is about the PLUGIN. It renders the SAME `(skipped)
  // {not installed}` row an in-scope marketplace with no plugin record yields
  // (`not-recorded`), because that is the identical underlying fact: nothing
  // is installed at the scope the operator named.
  if (resolution.kind !== "resolved") {
    return await emitUnresolvedTarget({
      ctx,
      pi,
      cwd,
      marketplace,
      plugin,
      enable,
      orchestrated,
      resolution,
    });
  }

  const { scope, locations } = resolution;
  // T-53-02-02: the CFG-03 abort row carries the TARGETED file's basename, and
  // the row is rendered after the lock closes. The target is now chosen inside
  // the lock, so the basename escapes the closure through this `let`. It starts
  // at the base file -- the value the no-flag, no-declaration arm yields -- so
  // the pre-assignment value is never wrong and the type stays definite.
  let configBasename = path.basename(locations.configJsonPath);

  let outcome: SetEnabledOutcome | undefined;
  const write: EnabledFlagWriteTarget = {
    marketplace,
    plugin,
    enable,
    orchestrated,
    scopeRoot: locations.scopeRoot,
  };

  try {
    // A single per-scope lock owns the whole critical section. The closure
    // sequences the D-103-13 write-target selection, ENBL-02 idempotency, the
    // enable/disable branch dispatch, the I3 shrunken-record save, and the
    // UAT-05 config write-back; keeping that order visible here is what makes
    // the save-vs-throw discipline auditable.
    await withLockedStateTransaction(locations, async (tx) => {
      // D-103-13: ONE selection, made before anything reads a config path, so
      // the ordinary write-back and the config-truth promotion below cannot
      // drift onto different files. It runs inside the lock because it READS
      // the local config -- the WB-01 discipline that sibling reads happen
      // fresh under the lock the write also holds. UAT-05: the sibling path is
      // the scope's OTHER file, for the merged-view membership test only.
      const selection = await selectDeclaringConfigWriteTarget({
        locations,
        local: opts.local,
        key: `${plugin}@${marketplace}`,
      });

      const state = tx.state;
      // CFG-03: the arm covers the TARGETED file being unreadable and, on the
      // flagless path, the local file being unreadable while the base file is
      // fine -- the local file is what DECIDES the destination there, so an
      // unreadable one leaves the destination unknown. The row names the file
      // that could not be read; writing to the file CFG-02 would then shadow
      // would report a flip that moves no merged value.
      if (selection.kind === "unreadable") {
        configBasename = path.basename(selection.filePath);
        outcome = { kind: "invalid-config" };
        return;
      }

      // Both physical files were parsed ONCE by the selector, and the whole
      // selection travels to the write arms below: the target config steers
      // every one of them, the sibling serves the UAT-05 membership gate, and
      // no two decisions in this closure rest on different bytes of the same
      // file.
      configBasename = path.basename(selection.targetConfigPath);

      const mp = state.marketplaces[marketplace];
      const installed = mp?.plugins[plugin];
      if (mp === undefined || installed === undefined) {
        outcome = { kind: "not-recorded" };
        return;
      }

      // ENBL-05 idempotency: the explicit `enabled: false` marker, read
      // through the single predicate. Availability is not consulted, so a
      // disabled PARTIAL record is idempotent on `disable` and re-materializes
      // on `enable`, at parity with the canonical disabled record.
      if (isRecordedButDisabled(installed) === !enable) {
        outcome = await resolveIdempotentOutcome(write, selection, state, installed);
        return;
      }

      if (enable) {
        outcome = await runEnableBranch(opts, scope, locations, state, installed);
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
        // place to drop the artifacts already removed before the throw.
        // Persist the shrunken record so state.json never claims artifacts
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

      // RECON-03: the write-back is SKIPPED in orchestrated mode. A
      // reconcile-driven call derives the desired state FROM the merged
      // config (base + local), so the declaration already exists by
      // construction -- possibly ONLY in `claude-plugins.local.json`, the
      // per-machine override. Writing it back here would copy the local
      // override's `enabled` flag into the shared BASE file and clobber a
      // user-authored base declaration. The config is the reconcile's INPUT;
      // only standalone commands author declarations.
      if (!orchestrated) {
        await writeEnabledFlagBack(write, selection, state);
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
 * Closed-set reason for an orchestrated transaction
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
  // "marketplace not added" sentinel, so a ContentReason cast is sound here.
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
 * The `fresh` arm of the typed-outcome mapping -- the realized enable or
 * disable transition.
 *
 * ENBL-07 / SURF-05 / WARN-01: the LIVE degradation signals propagate so the
 * orchestrated (reconcile) caller renders the same row the standalone verb
 * renders. SEV-01 / D-98-02: the staged-count verdicts cross the boundary too,
 * so the reconcile projection derives the SAME dependency list. Every field is
 * omitted when empty, which keeps a clean re-enable byte-identical in the
 * cascade (NREG-01).
 */
function freshOutcomeToTypedResult(
  plugin: string,
  enable: boolean,
  outcome: Extract<SetEnabledOutcome, { kind: "fresh" }>,
): EnableDisablePluginOutcome {
  const version = outcome.version !== undefined && { version: outcome.version };
  if (!enable) {
    return { status: "disabled", name: plugin, ...version };
  }

  return {
    status: "enabled",
    name: plugin,
    ...version,
    ...(outcome.unsupported !== undefined &&
      outcome.unsupported.length > 0 && { unsupported: outcome.unsupported }),
    ...(outcome.orphanRewake === true && { orphanRewake: true }),
    ...(outcome.degradedKinds !== undefined &&
      outcome.degradedKinds.length > 0 && { degradedKinds: outcome.degradedKinds }),
    ...(outcome.stagedAgents === true && { stagedAgents: true }),
    ...(outcome.stagedMcpServers === true && { stagedMcpServers: true }),
  };
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
      return freshOutcomeToTypedResult(plugin, enable, outcome);
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
  // SEV-01: the single sanctioned companion probe, taken once here -- the same
  // one `notify()` uses to render the `{requires pi-...}` markers -- and passed
  // down to the pure row composer, which holds no Pi reference of its own.
  const row = composeOutcomeRow({
    plugin,
    enable,
    configBasename,
    outcome,
    probe: softDepStatus(pi),
  });
  // RLD-05 / D-07: the disable verb no longer threads a distinguishing cascade
  // kind. The fresh `(disabled)` row stamps `needsReload: true` directly (its
  // artifacts were unstaged -- SNM-33), so the `/reload to pick up changes`
  // trailer fires via the RLD-02 OR-reduce of the per-row stamps. The disable
  // verb's non-fresh arms (idempotent / failed / not-recorded) stamp
  // `needsReload: false`; the enable verb's `(installed)` /
  // `(partially-installed)` fresh rows stamp `true`.
  //
  // D-04 / D-10: the verb selects its OWN CommandContext -- ENABLE_CONTEXT
  // renders the fresh `(installed)` / `(partially-installed)` row,
  // DISABLE_CONTEXT the fresh `(disabled)` row; both share byte-identical
  // `skipped` / `failed` arms.
  if (enable) {
    // D-10: `composeOutcomeRow` returns `EnableMsg | DisableMsg`; the `enable`
    // branch only ever yields an `EnableMsg` (its `fresh` arm emits `installed`
    // or `partially-installed`, never `disabled`), so narrowing to the
    // ENABLE_CONTEXT row type is sound.
    const enableRow = row as EnableMsg;
    notifyWithContext(ctx, pi, ENABLE_CONTEXT, [
      { name: marketplace, scope, plugins: [enableRow] },
    ]);
  } else {
    // D-10: the `!enable` branch only ever yields a `DisableMsg` (its `fresh`
    // arm emits `disabled`, never `installed`), so narrowing to the
    // DISABLE_CONTEXT row type is sound.
    const disableRow = row as DisableMsg;
    notifyWithContext(ctx, pi, DISABLE_CONTEXT, [
      { name: marketplace, scope, plugins: [disableRow] },
    ]);
  }
}

/**
 * ENBL-07 / FSTAT-07 / D-66-04: build the fresh-ENABLE row. A re-enable that
 * re-materialized through the partial gate dropped one or more component kinds,
 * so it renders `(partially-installed)` with the dropped kinds through the
 * shared `narrowUnsupportedKinds` seam -- the SAME token, glyph and brace the
 * `install` success cascade and the `list` inventory row use for the record the
 * ledger just wrote. A clean re-enable keeps the `(installed)` row byte-for-byte
 * (NREG-01).
 *
 * SURF-05 / WARN-01: the row also carries the ledger's other two degradation
 * signals in `install.ts`'s emit order -- `{orphan rewake}` first, then the
 * per-kind `{malformed skill}` / `{malformed command}` tokens, then the dropped
 * kinds -- so the brace stays byte-comparable across the two verbs that share
 * the ledger.
 *
 * Severity: `info` for a dropped-kind-only re-enable per SEV-03 -- the partial
 * shortfall predates the enable (the record was already degraded when it was
 * disabled), so the requested enable was fully carried out and the desired
 * state was reached, the same stance the `install --partial` success row and
 * the still-degraded `plugin-backfilled` arm take. A MALFORMED component is a
 * different fact: it is a degrade the ledger just produced, not a pre-existing
 * shortfall, so it takes the same `warning` raise `install.ts::composeInstalledRow`
 * applies (WARN-01 / D-86-03) on whichever verb materialized it.
 *
 * SEV-01 / D-98-02: a MISSING companion is the second, independent raise. The
 * two compose -- the stronger wins -- so neither rule can silently replace the
 * other: a malformed degrade is `warning` whatever the probe reports, and an
 * unloaded declared companion is `warning` whatever degraded.
 */
function freshEnableRow(
  plugin: string,
  outcome: EnableDegradationSignals & { version?: string },
  probe: SoftDepStatus,
): EnableMsg {
  const unsupported = outcome.unsupported ?? [];
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  const reasons: ContentReason[] = [
    ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
    ...malformed,
  ];
  // SEV-01: the enable row derives the SAME dependency list `install.ts` derives
  // for the same ledger run, so the `{requires pi-...}` markers fire on a
  // re-enable exactly as on an install.
  const dependencies = enableRowDependencies(outcome);
  const severity =
    malformed.length > 0
      ? "warning"
      : companionSeverity(
          {
            declaresAgents: outcome.stagedAgents === true,
            declaresMcp: outcome.stagedMcpServers === true,
          },
          probe,
        );
  if (unsupported.length > 0) {
    return {
      status: "partially-installed",
      name: plugin,
      dependencies,
      ...(outcome.version !== undefined && { version: outcome.version }),
      reasons: [...reasons, ...narrowUnsupportedKinds(unsupported)],
      severity,
      needsReload: true,
    };
  }

  return {
    status: "installed",
    name: plugin,
    dependencies,
    ...(outcome.version !== undefined && { version: outcome.version }),
    ...(reasons.length > 0 && { reasons }),
    // D-03/D-06: a realized re-enable re-materializes artifacts -> reloads Pi
    // resources.
    severity,
    needsReload: true,
  };
}

/** Internal: build the plugin row for the outcome (bare mp header -- UAT-04). */
/**
 * The `(failed)` row for an enable that threw.
 *
 * I4: a non-empty `rollbackPartials` capture means the install ledger unwound
 * a partial commit before rethrowing, so the row renders the catalog
 * `rollback partial` reason plus per-phase child rows (MSG-RP-1) and the
 * operator sees which phases needed recovery -- matching the standalone
 * install/uninstall path (`composeInstallFailureMessage`).
 *
 * WR-02 / D-98-03: a rollback-partial failure KEEPS the `rollback partial`
 * reason. The ledger got far enough to commit and unwind, which is a
 * different fact than the pre-ledger stale-gate rejection, so the stale-gate
 * narrowing is consulted only when no partial was captured.
 */
function enableFailedRow(
  plugin: string,
  outcome: Extract<SetEnabledOutcome, { kind: "enable-failed" }>,
): PluginFailedMessage {
  const partials = outcome.rollbackPartials ?? [];
  const staleGate = partials.length > 0 ? undefined : staleGateDropped(outcome.cause);
  const baseReasons =
    partials.length > 0 ? (["rollback partial"] as const) : narrowEnableFailure(outcome.cause);
  return {
    status: "failed",
    name: plugin,
    reasons: staleGate ?? baseReasons,
    ...(outcome.recordedVersion !== undefined && { version: outcome.recordedVersion }),
    ...(staleGate !== undefined && { partialHint: true }),
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
}

function composeOutcomeRow(args: {
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome | undefined;
  /** SEV-01: the caller's `softDepStatus(pi)` snapshot -- this composer is pure. */
  readonly probe: SoftDepStatus;
}): EnableMsg | DisableMsg {
  const { plugin, enable, configBasename, outcome, probe } = args;
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
      // ATTR-08: the plugin row is absent from state.json (never installed, or
      // concurrently uninstalled). The established taxonomy (ATTR-08,
      // reinstall/update precedent) reserves `{not in manifest}` for "plugin
      // absent from a PRESENT manifest" and uses `(skipped) {not installed}`
      // for "plugin not installed". SCOPE-01: when the container sits one scope
      // over, the brace additionally names where it is.
      return {
        status: "skipped",
        name: plugin,
        reasons: absentTargetReasons(outcome.notInstalledAt),
        // D-01: an absent target means nothing was enabled or disabled, so the
        // operation was NOT carried out -> error. Severity is the tri-state
        // axis (info = desired state reached, warning = carried out but short,
        // error = not carried out), and `(skipped)` is the status token, not a
        // severity: the same `["not installed"]` set is stamped `error` by
        // `uninstall`'s `emitAlreadyGone`, `update`'s `cascadeSkipSeverity`,
        // and `reinstall`'s in-scope skipped arm. No reload.
        severity: "error",
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

    case "enable-failed":
      return enableFailedRow(plugin, outcome);

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
        ? freshEnableRow(plugin, outcome, probe)
        : {
            // D-06/RLD-02: a realized fresh disable unstages Pi-visible
            // artifacts, so it stamps needsReload directly -- this is what lets
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
