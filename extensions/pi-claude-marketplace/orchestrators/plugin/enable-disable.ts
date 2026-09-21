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
// guard-FREE ledger body exported by install-outcome.ts) against THIS transaction's
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

import { resolveDependencyClosure } from "../../domain/dependency-closure.ts";
import { findDependents } from "../../domain/dependency-orphans.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { isRecordedButDisabled, toDisabledRecord } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { createRemovalOps } from "../../shared/fs-utils.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage, type Reason } from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity, malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { runPhases } from "../../transaction/phase-ledger.ts";

import { buildScopeDeclarationIndex, readRecordDeclarations } from "./dependency-index.ts";
import {
  composeDisableRefusalCause,
  composeEnableCascadeRows,
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
  narrowDisableFailure,
  narrowEnableFailure,
  staleGateDropped,
  type DisableMsg,
  type EnableCascadeMemberRow,
  type EnableMsg,
} from "./enable-disable.messaging.ts";
import {
  absentTargetReasons,
  applyPartialCascadeFold,
  emitMarketplaceNotAdded,
  missIsNotInstalled,
  enableRowDependencies,
  resolveCrossScopePluginTarget,
  type selectDeclaringConfigWriteTarget,
  type CrossScopePluginResolution,
  type DeclaringConfigWriteTarget,
  type LedgerDegradationSignals,
  type writeAdoptingConfigEntries,
} from "./shared.ts";

import type {
  InstallFailureCapture,
  InstallLedgerResult,
  runInstallLedger,
} from "./install-outcome.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type {
  ClosureLookup,
  ClosureMember,
  DependencyClosureResult,
} from "../../domain/dependency-closure.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { DisabledPluginRecord, ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext, SoftDepStatus, ToolInventory } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";
import type { Phase, RollbackPartial, RunPhasesResult } from "../../transaction/phase-ledger.ts";
import type { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import type { cascadeUnstagePlugin } from "../marketplace/shared.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";

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

type InstalledEnableLedgerResult = Extract<InstallLedgerResult, { readonly kind: "installed" }>;

/**
 * The surrounding transaction already found the marketplace and plugin in
 * `state`, then passes that same state object synchronously to the ledger.
 * Its sole marketplace-absent producer rereads that identical marketplace
 * slot, so this enable-only call path cannot produce the absent arm.
 */
function assertRecordedStateLedgerInstalled(
  _result: InstallLedgerResult,
): asserts _result is InstalledEnableLedgerResult {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * The degradation signals a re-enable's ledger run produces. An alias of the
 * shared `LedgerDegradationSignals` shape, kept under the enable-side name its
 * consumers already import (`reconcile/apply-outcomes.ts`, `reconcile/apply.ts`).
 *
 * The shape itself lives in `./shared.ts` because the install outcome owner
 * intersects it too. Keeping the shared shape below both consumers preserves
 * the one-way module graph (IN-07 / D-98-01).
 */
export type EnableDegradationSignals = LedgerDegradationSignals;

/**
 * RECON-03: discriminated outcome returned by `setPluginEnabled` in
 * orchestrated mode.
 *
 * - `"enabled"` -- the enable branch re-materialized the plugin.
 * - `"disabled"` -- the disable branch cascaded-unstaged the artifacts and
 *   reset `resources.*` while preserving the state record.
 * - `"skipped"` -- the idempotent already-enabled / already-disabled arm, or
 *   the `not-recorded` arm reported as `reason: "not installed"`. The
 *   `reason` carries the standalone benign Reason for parity with the
 *   standalone rendering token set.
 * - `"failed"` -- enable / disable / invalid-config / marketplace-not-added
 *   paths. `reason` typed `Reason` so the structural `"marketplace not
 *   added"` sentinel can flow through the same field.
 */
export type EnableDisablePluginOutcome =
  | ({ readonly status: "enabled"; readonly version?: string } & EnableDisableSubject &
      EnableDegradationSignals)
  | ({ readonly status: "disabled"; readonly version?: string } & EnableDisableSubject)
  | ({
      readonly status: "skipped";
      readonly reason: "already enabled" | "already disabled" | "not installed";
    } & EnableDisableSubject)
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

/**
 * The plugin every non-failed arm names. Declared once so a reader of any arm
 * credits the same slot -- the failed arm carries no subject, which is why the
 * base is intersected rather than hoisted over the whole union.
 */
export interface EnableDisableSubject {
  readonly name: string;
}

/**
 * D-54-01 options bundle for `setPluginEnabled`. Mirrors
 * `UninstallPluginOptions` + `enable: boolean` + an opt-in `local?: boolean`
 * for the per-machine override file.
 */
export interface EnableDisablePluginOptions {
  readonly ctx: NotificationContext;
  /** Factory `pi` reference -- threaded into `notify()` for the single softDepStatus(pi) probe. */
  readonly pi: ToolInventory;
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

/** Owns only the semantic transaction steps composed by enable and disable. */
export interface EnableDisableTransaction {
  readonly cascadeUnstagePlugin: typeof cascadeUnstagePlugin;
  readonly runInstallLedger: typeof runInstallLedger;
  readonly selectConfigWriteTarget: typeof selectDeclaringConfigWriteTarget;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
  readonly writeConfigEntries: typeof writeAdoptingConfigEntries;
}

/** Hook route effects required by enable and disable after durable state changes. */
export type EnableDisableHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

interface EnableRouteEffect {
  readonly hooksJsonPath: string;
  readonly resolvedSource: ReturnType<typeof asAbsolutePluginRoot>;
}

/** Outcome sentinel populated by the withStateGuard closure. */
type SetEnabledOutcome =
  | { kind: "idempotent" }
  | ({
      kind: "fresh";
      addRoutesAfterSave?: EnableRouteEffect;
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
 * CR-03: the ledger call + `SetEnabledOutcome` "fresh" arm construction
 * shared by the ordinary enable branch (`runEnableBranch`, used for
 * `disable` and for an orchestrated enable, neither of which runs a
 * cascade) and the cascade's own merged root phase
 * (`buildEnableRootPhase`). THROWS on ledger failure; callers decide
 * whether to catch it (`runEnableBranch`, which reports `enable-failed` as
 * a value) or let it propagate (`buildEnableRootPhase`, whose `do` must
 * throw so `runPhases` unwinds the cascade's members too).
 *
 * Invokes the guard-FREE `runInstallLedger` against the OUTER transaction's
 * state snapshot with the pinned version override (so the disabled record's
 * `version` is preserved across the re-materialization) and
 * `allowExistingRecord: true` (the disabled record is deliberately KEPT per
 * ENBL-02, so the PI-15 "already installed" sanity throw must not fire for
 * the re-materialization).
 *
 * `installPlugin` MUST NOT be called here -- it opens its own
 * `withStateGuard` on the same `stateLockFile`, and `proper-lockfile`
 * (`retries: 0`) is not re-entrant, so the nested acquisition would throw
 * `StateLockHeldError` and every fresh enable would fail.
 */
async function materializeEnableRoot(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  installed: InstalledPluginRecord,
  capture: InstallFailureCapture,
): Promise<Extract<SetEnabledOutcome, { kind: "fresh" }>> {
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
  const result = await transaction.runInstallLedger(
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
      // D-08-12: the enable branch reaches the ledger without going through
      // `install-flow.ts`, so it is the second composition root that supplies
      // the required removal port.
      removalOps: createRemovalOps(),
    },
    capture,
  );
  assertRecordedStateLedgerInstalled(result);

  // ENBL-07 / FSTAT-07 / D-66-04 / SURF-05 / WARN-01: thread the LIVE
  // degradation signals out of the ledger. The enable branch runs the SAME
  // `runInstallLedger` over the SAME bridges as `install`, so all three
  // signals `install-flow.ts` composes off the ledger summary are carried on
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
    ...(resolved.hooksConfigPath !== undefined && {
      addRoutesAfterSave: {
        hooksJsonPath: path.join(resolved.pluginRoot, resolved.hooksConfigPath),
        resolvedSource: asAbsolutePluginRoot(resolved.pluginRoot),
      },
    }),
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
}

/**
 * Run the enable branch for `disable` and for an orchestrated enable --
 * neither runs a cascade, so the root materializes alone in its own
 * try/catch. `enable`'s standalone, non-orchestrated path runs
 * `buildEnableRootPhase` instead, as the LAST phase of the cascade's own
 * ledger (CR-03).
 */
async function runEnableBranch(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  installed: InstalledPluginRecord,
): Promise<SetEnabledOutcome> {
  const recordedVersion = installed.version;
  // I4: thread an InstallFailureCapture so a rollback-partial enable failure
  // surfaces the per-phase rollback children in the (failed) row, matching
  // the install/uninstall cascade rendering. The ledger populates this BEFORE
  // it rethrows (D-02 PI-14 bypass preserves the raw error).
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  try {
    return await materializeEnableRoot(
      transaction,
      opts,
      scope,
      locations,
      state,
      installed,
      capture,
    );
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
 * EDEP-01 / EDEP-02 / D-05-07 precedent: an enable or a disable was REFUSED
 * inside the locked transaction before anything left disk. On the enable
 * cascade (EDEP-01), the closure could not be resolved -- either some other
 * record's declarations could not be established, or the declared graph
 * closes on itself. On the disable branch (EDEP-02, `readEnabledDependents`),
 * an installed and ENABLED plugin in the same scope still declares the
 * target. Mirrors `uninstall.ts::UninstallRefusedError` exactly: the reason
 * is a closed-set token and `message` IS the rendered cause line, so it
 * carries only `name@marketplace` keys, field paths or already-redacted
 * text -- never an absolute path -- with no `{ cause }` chained behind it.
 * Widened for the disable guard rather than paired with a second class,
 * since both refusals share the same carrier shape and the same catch site.
 *
 * Thrown from inside the locked transaction closure and left to propagate to
 * `setPluginEnabledWithTransaction`'s own outer catch -- the same catch that
 * already classifies a `StateLockHeldError` or any other transaction throw --
 * so no dedicated catch site is needed for it.
 */
class EnableRefusedError extends Error {
  readonly reason: ContentReason;
  constructor(reason: ContentReason, message: string) {
    super(message);
    this.name = "EnableRefusedError";
    this.reason = reason;
  }
}

/**
 * EDEP-01: the classification of one non-root closure member against the
 * LIVE locked snapshot.
 *
 * - `"re-enabled"`: the member's record is present and disabled
 *   (`isRecordedButDisabled`); it is re-materialized through its own record.
 * - `"already-enabled"`: the member's record is present and already enabled;
 *   D-08-03's full-closure report still gives it a row.
 * - `"not-installed"`: the scope records nothing under the member's exact
 *   key. LOAD-01's load-time check owns reporting a missing declared
 *   dependency, so this disposition never refuses the root's own enable.
 */
type EnableCascadeDisposition = "re-enabled" | "already-enabled" | "not-installed";

/**
 * One non-root member of the enable cascade's transitive closure, classified
 * against the live locked snapshot. `record` is present for `"re-enabled"`
 * and `"already-enabled"` (a record was found) and absent for
 * `"not-installed"`.
 */
interface EnableCascadeMember {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly disposition: EnableCascadeDisposition;
  readonly record?: InstalledPluginRecord;
}

/** The enable cascade's closure resolution: every non-root member, classified. */
interface EnableCascadeResolution {
  readonly members: readonly EnableCascadeMember[];
}

/**
 * WR-03 / ATTR-08: `readRecordDeclarations`'s only distinguishable-by-text
 * failure this cascade treats specially -- the record's OWN manifest entry
 * is absent from an otherwise-readable manifest. `dependency-index.ts`'s
 * `unreadableDeclarer` builds this exact, internally-owned literal (never
 * untrusted manifest text), so matching it is stable. Every OTHER
 * unreadable-declarer cause (the manifest itself failed to load, or its
 * `dependencies` field parses as unusable) is NOT this case and stays
 * fail-closed.
 */
function isDeclarerAbsentFromManifest(cause: Error): boolean {
  return cause.message.endsWith(": not declared by its marketplace");
}

/**
 * WR-03: reads ONE record's declarations, lazily, as the walk visits it --
 * replacing the former whole-scope eager read `buildScopeDeclarationDetail`
 * did. D-05-07 fail-closed still applies, but now scoped to records the walk
 * actually reaches: an unreadable record OUTSIDE the closure never blocks an
 * unrelated enable. A record the scope never installed (or whose
 * marketplace the scope never added) answers "found, declares nothing" --
 * NOT `{ kind: "absent" }` -- for the same reason the former eager lookup
 * did: the question is "is there a record here to turn on", and "absent"
 * would reach the walk's `not-found` arm and refuse an enable over a MISSING
 * dependency that LOAD-01's load-time check already owns reporting.
 *
 * `knownMarketplaces` is a MUTABLE set this function GROWS as each record's
 * declarations are read -- see `resolveEnableCascade`'s own seed comment.
 *
 * Throws `EnableRefusedError("unreadable", ...)` on a genuinely unreadable
 * declarer, fail-closed (D-05-07) -- EXCEPT for the root itself when its
 * manifest is readable and its own entry is simply absent (ATTR-08 "not in
 * manifest"): the root's own enable is going to refuse through the ledger's
 * ordinary PI-3 lookup regardless, restoring the pre-EDEP-01 ENBL-07 bytes
 * rather than misreporting `{unreadable}` over a fact this cascade cannot
 * itself act on either way.
 */
function enableCascadeLookup(
  state: ExtensionState,
  locations: ScopedLocations,
  knownMarketplaces: Set<string>,
  rootKey: string,
): ClosureLookup {
  return async (subject) => {
    const marketplace = state.marketplaces[subject.marketplace];
    const record = marketplace?.plugins[subject.name];
    if (marketplace === undefined || record === undefined) {
      return { kind: "found", dependencies: [] };
    }

    const read = await readRecordDeclarations({ state, locations }, marketplace, subject.name);
    if (!read.ok) {
      if (subject.key === rootKey && isDeclarerAbsentFromManifest(read.cause)) {
        return { kind: "found", dependencies: [] };
      }

      throw new EnableRefusedError("unreadable", read.cause.message);
    }

    for (const dependency of read.declared) {
      knownMarketplaces.add(dependency.marketplace);
    }

    return { kind: "found", dependencies: read.declared };
  };
}

/**
 * Seeded with every marketplace already added to the scope;
 * `enableCascadeLookup` GROWS it as each record's own declarations are read
 * -- WR-03's lazy per-key reads mean the full set can only be known as reads
 * happen, not upfront. D-03-08's guard must never refuse for this cascade --
 * it installs nothing, so membership in the enabled closure is decided by
 * the record classification instead.
 */
function enableCascadeKnownMarketplaces(state: ExtensionState): Set<string> {
  return new Set(Object.keys(state.marketplaces));
}

type ClosureFailure = Extract<DependencyClosureResult, { readonly ok: false }>;
type ClosureUnusableDeclarationFailure = Extract<
  ClosureFailure,
  { readonly reason: "unusable-declaration" }
>;

/**
 * Once `failure.reason !== "cycle"` is known, `unusable-declaration` is the
 * ONLY remaining reachable arm for this walk's lookup and known-marketplaces
 * pairing: `not-found` needs an `"absent"` lookup result and
 * `enableCascadeLookup` always answers `"found"` (`walkEdge`'s
 * `looked.kind === "absent"` branch); `marketplace-not-added` needs a child
 * edge's marketplace that `knownMarketplaces` does not already hold at check
 * time, and `enableCascadeLookup` GROWS that same mutable set with every
 * marketplace a declaring record's own read names, BEFORE the walk ever
 * checks one of that record's own children (`walkEdge` calls `lookup`
 * before `walkChildren` builds and checks each child edge) -- the same
 * value `buildChildEdge` computes for the edge (`AddressedDependency.marketplace`
 * is never `undefined`, so `buildChildEdge`'s `??` fallback never applies).
 *
 * An unconditional assertion, not a branch inside a switch: `not-found` and
 * `marketplace-not-added` need no runtime representation of their own here,
 * because nothing this walk's construction produces can EVER hold either
 * reason once `cycle` is excluded -- a dead switch arm for either would be
 * code no test could reach without violating an invariant the walk itself
 * establishes. Evidence-backed type narrowing only, mirroring
 * `assertRecordedStateLedgerInstalled` above; the invariant is established
 * by `resolveEnableCascade`'s lookup and `knownMarketplaces` construction,
 * not by a runtime check here.
 */
function assertUnusableDeclarationIsOnlyRemainingArm(
  _failure: Exclude<ClosureFailure, { readonly reason: "cycle" }>,
): asserts _failure is ClosureUnusableDeclarationFailure {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * The `EnableRefusedError` a closure failure resolves to. `cycle` mirrors
 * `install-cascade.messaging.ts::closureFailureFacts`'s cycle arm.
 * `unusable-declaration` is reachable here even though `enableCascadeLookup`
 * never reports `"unusable"`: `buildChildEdge` returns it directly for a
 * declared `sha` (D-03-36) or an unrenderable marketplace, before any lookup
 * runs. It carries `closureFailureFacts`'s own token and cause shape for that
 * arm.
 */
function enableCascadeClosureFailure(failure: ClosureFailure): EnableRefusedError {
  if (failure.reason === "cycle") {
    return new EnableRefusedError(
      "dependency cycle",
      `Dependency cycle: ${failure.chain.join(" -> ")}.`,
    );
  }

  assertUnusableDeclarationIsOnlyRemainingArm(failure);
  return new EnableRefusedError(
    "invalid manifest",
    `Plugin "${failure.key}" declares an unusable dependency (${failure.detail}).`,
  );
}

/** Classify one non-root closure member against the live locked snapshot. */
function classifyEnableCascadeMember(
  state: ExtensionState,
  member: ClosureMember,
): EnableCascadeMember {
  const record = state.marketplaces[member.marketplace]?.plugins[member.name];
  if (record === undefined) {
    return {
      key: member.key,
      name: member.name,
      marketplace: member.marketplace,
      disposition: "not-installed",
    };
  }

  return {
    key: member.key,
    name: member.name,
    marketplace: member.marketplace,
    disposition: isRecordedButDisabled(record) ? "re-enabled" : "already-enabled",
    record,
  };
}

/**
 * EDEP-01: resolve `plugin`'s declared dependency closure transitively in the
 * same scope, and classify every non-root member against the live locked
 * snapshot. Called INSIDE the locked transaction, before the root's own
 * idempotency is decided (D-08-03), so a dependency that is disabled still
 * turns on even when the root itself is already enabled.
 *
 * WR-03: reads lazily, one record at a time, as the walk visits it
 * (`enableCascadeLookup`) -- rather than the whole scope upfront -- so an
 * unreadable record OUTSIDE the closure never blocks an unrelated enable.
 * `readRecordDeclarations` is the same offline, fail-closed (D-05-07) read
 * `buildScopeDeclarationDetail` composed from, and is already covered by the
 * network-free gate.
 *
 * Throws `EnableRefusedError` when the closure cannot be resolved -- an
 * unreadable declarer reached by the walk, or a cycle.
 */
async function resolveEnableCascade(
  state: ExtensionState,
  locations: ScopedLocations,
  rootKey: string,
): Promise<EnableCascadeResolution> {
  const knownMarketplaces = enableCascadeKnownMarketplaces(state);
  const closure = await resolveDependencyClosure({
    rootKey,
    lookup: enableCascadeLookup(state, locations, knownMarketplaces, rootKey),
    // EDEP-01: EMPTY on purpose. `walkDependencyEdge` returns WITHOUT
    // recursing on an `installedKeys` hit, so any non-empty set would
    // truncate the walk at the first installed dependency and make EDEP-01's
    // word "transitively" false. Being already installed is the
    // PRECONDITION for being enabled here, not a reason to stop walking.
    installedKeys: new Set<string>(),
    knownMarketplaces,
  });
  if (!closure.ok) {
    throw enableCascadeClosureFailure(closure);
  }

  const members = closure.closure
    .filter((member) => member.key !== rootKey)
    .map((member) => classifyEnableCascadeMember(state, member));
  return { members };
}

/** Mutable accumulator threaded through the cascade members' `runPhases` run. */
interface EnableCascadeRun {
  readonly rows: EnableCascadeMemberRow[];
  readonly materialized: Set<string>;
  readonly hydratable: EnableCascadeHydratableMember[];
  /**
   * WR-01: rollback partials from a member's OWN ledger `InstallFailureCapture`
   * (populated by `runInstallLedger` before it rethrows), which `runPhases`'s
   * own aggregated `RunPhasesResult.rollbackPartials` does not carry -- that
   * one covers only OTHER members' `undo` calls the failure unwound.
   */
  readonly rollbackPartials: RollbackPartial[];
  /**
   * CR-03: the root's own materialized outcome, set by `buildEnableRootPhase`
   * when it is the ledger's last phase. `undefined` until that phase's `do`
   * completes -- the sentinel its `undo` gates on (a `Phase.undo` cannot
   * assume its `do` ran to completion).
   */
  root: Extract<SetEnabledOutcome, { kind: "fresh" }> | undefined;
}

/**
 * WR-02: what hydrating a re-enabled member's hooks into the routing cache
 * needs to know about it, mirroring `install-flow.ts::HydratableMember`.
 */
interface EnableCascadeHydratableMember {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly pluginRoot: string;
  readonly hooksConfigPath: string | undefined;
}

/**
 * CR-03 / WR-01: unstage a record back to disabled, folding what DID drop
 * (NFR-3 -- state must never claim artifacts still on disk) and RETHROWING
 * an unfinished unstage, mirroring
 * `install-cascade.ts::buildReEnableMemberPhase`'s own undo (D-03-07). A
 * swallowed failure here would report a clean unwind while artifacts
 * survived on disk. Shared by the cascade's own member undo
 * (`buildEnableCascadeMemberPhase`) and the merged root phase's undo
 * (`buildEnableRootPhase`) -- both put a re-materialized record back to
 * disabled the identical way.
 */
async function unstageBackToDisabled(
  transaction: EnableDisableTransaction,
  locations: ScopedLocations,
  state: ExtensionState,
  marketplace: string,
  plugin: string,
  key: string,
): Promise<void> {
  const marketplaceRecord = state.marketplaces[marketplace];
  const installedNow = marketplaceRecord?.plugins[plugin];
  if (marketplaceRecord === undefined || installedNow === undefined) {
    return;
  }

  const outcome = await transaction.cascadeUnstagePlugin(
    plugin,
    marketplace,
    locations,
    installedNow,
  );
  if (!outcome.ok) {
    applyPartialCascadeFold(installedNow, outcome.dropped);
    throw outcome.cause ?? new Error(`Rollback of "${key}" did not complete.`);
  }

  marketplaceRecord.plugins[plugin] = toDisabledRecord(installedNow, new Date().toISOString());
}

/**
 * One `"re-enabled"` member's phase. `do` calls `runInstallLedger` on the
 * OUTER transaction's state snapshot with the exact argument set
 * `runEnableBranch` already passes, now per member: `pinVersionOverride` set
 * to the member's own recorded version, `allowExistingRecord: true`, and
 * `partial` derived from the member record's own `compatibility.installable`.
 * `undo` puts the member BACK to disabled via `cascadeUnstagePlugin` +
 * `toDisabledRecord`, the pair `runDisableBranch` already composes; it must
 * NOT delete the record, because the record is what owns those artifacts.
 *
 * The state phase inside `runInstallLedger` rebuilds the record from a fresh
 * object literal that never names `dependencyDisabled` (LOAD-02 / D-06-02),
 * so a member re-enabled through this phase has the LOAD-02 consequence
 * marker (`dependencyDisabled`) cleared in the same write with no code of its
 * own needed here.
 */
function buildEnableCascadeMemberPhase(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  member: EnableCascadeMember,
  record: InstalledPluginRecord,
): Phase<EnableCascadeRun> {
  const partial = !record.compatibility.installable;
  return {
    name: member.key,
    do: async (run) => {
      const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
      let result: InstallLedgerResult;
      try {
        result = await transaction.runInstallLedger(
          state,
          locations,
          {
            ctx: opts.ctx,
            scope,
            cwd: opts.cwd,
            marketplace: member.marketplace,
            plugin: member.name,
            pinVersionOverride: record.version,
            allowExistingRecord: true,
            partial,
            removalOps: createRemovalOps(),
          },
          capture,
        );
      } catch (err) {
        // WR-01: the ledger populates `capture.rollbackPartials` BEFORE it
        // rethrows (mirrors `runEnableBranch`'s own I4 comment) -- carry it
        // into the run so the caller can thread it into the failed outcome.
        run.rollbackPartials.push(...capture.rollbackPartials);
        throw err;
      }

      assertRecordedStateLedgerInstalled(result);
      run.materialized.add(member.key);
      const summary = result.summary;
      run.hydratable.push({
        key: member.key,
        name: member.name,
        marketplace: member.marketplace,
        pluginRoot: summary.resolved.pluginRoot,
        hooksConfigPath: summary.resolved.hooksConfigPath,
      });
      run.rows.push({
        status: "installed",
        name: member.key,
        version: summary.version,
        dependencies: enableRowDependencies({
          stagedAgents: summary.stagedAgentNames.length > 0,
          stagedMcpServers: summary.stagedMcpServerNames.length > 0,
        }),
        reasons: ["dependency enabled"],
        severity: "info",
        needsReload: true,
      });
    },
    undo: async (run) => {
      if (!run.materialized.has(member.key)) {
        return;
      }

      await unstageBackToDisabled(
        transaction,
        locations,
        state,
        member.marketplace,
        member.name,
        member.key,
      );
    },
  };
}

/**
 * CR-03: the root's OWN fresh enable, as the LAST phase of the SAME
 * `runPhases` ledger the cascade's members run in. Before this, the members
 * materialized in their own separate ledger and the root ran afterward
 * through `runEnableBranch`; a root failure after the members committed
 * left their artifacts on disk with no state save (NFR-3 violation, the
 * file's own former "Known gap" comment). Sharing one ledger means a root
 * failure unwinds the members too, and a member failure unwinds a root that
 * already committed -- `runPhases`'s reverse-order undo covers both
 * directions because both are phases of the same array.
 *
 * `do` calls `materializeEnableRoot` -- the same call `runEnableBranch`
 * makes for `disable` and for an orchestrated enable -- but does NOT catch
 * its throw: the throw IS this phase's failure signal, and `runPhases`
 * reads it to unwind every phase before this one.
 *
 * NO `undo`. This phase is unconditionally the LAST in the array
 * (`runEnableCascadeWithRoot` pushes it after every member phase), and
 * `runPhases` calls `undo` only from its own `catch` -- reached exclusively
 * when a `do` THROWS. If this phase's `do` throws, `run.root` was never
 * assigned, so there is nothing to unstage. If it succeeds, `runPhases`
 * returns success directly with no phase after this one left to fail, so
 * `undo` is never invoked on a root that DID materialize. A real unstage
 * body here could never execute either branch.
 */
function buildEnableRootPhase(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  installed: InstalledPluginRecord,
  rootKey: string,
): Phase<EnableCascadeRun> {
  return {
    name: rootKey,
    do: async (run) => {
      const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
      try {
        run.root = await materializeEnableRoot(
          transaction,
          opts,
          scope,
          locations,
          state,
          installed,
          capture,
        );
      } catch (err) {
        run.rollbackPartials.push(...capture.rollbackPartials);
        throw err;
      }
    },
  };
}

/** A classified member's row when nothing is materialized for it. */
function enableCascadeSkipRow(member: EnableCascadeMember): EnableCascadeMemberRow {
  if (member.disposition === "already-enabled") {
    return {
      status: "skipped",
      name: member.key,
      ...(member.record !== undefined && { version: member.record.version }),
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    };
  }

  // WR-04: "not-installed". LOAD-01's load-time check owns reporting a
  // missing declared dependency, so this disposition never refuses the
  // root's own enable -- it only reports. The enable WAS carried out, so
  // `warning` ("carried out but short"), never `error` ("not carried out"):
  // the next reload holds the root down as `dependencyDisabled` until the
  // missing dependency is installed.
  return {
    status: "skipped",
    name: member.key,
    reasons: absentTargetReasons(),
    severity: "warning",
    needsReload: false,
  };
}

/**
 * Build every `"re-enabled"` member's phase and the skip rows for every
 * other disposition, WITHOUT running them -- shared by
 * `runEnableCascadeMembers` (the root-idempotent path, members alone) and
 * `runEnableCascadeWithRoot` (CR-03's merged path, members plus the root in
 * one ledger).
 */
function buildEnableCascadeMemberPhases(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  members: readonly EnableCascadeMember[],
): { readonly run: EnableCascadeRun; readonly phases: Phase<EnableCascadeRun>[] } {
  const run: EnableCascadeRun = {
    rows: [],
    materialized: new Set(),
    hydratable: [],
    rollbackPartials: [],
    root: undefined,
  };
  const phases: Phase<EnableCascadeRun>[] = [];
  for (const member of members) {
    if (member.disposition !== "re-enabled") {
      run.rows.push(enableCascadeSkipRow(member));
      continue;
    }

    if (member.record !== undefined) {
      phases.push(
        buildEnableCascadeMemberPhase(
          transaction,
          opts,
          scope,
          locations,
          state,
          member,
          member.record,
        ),
      );
    }
  }

  return { run, phases };
}

/**
 * `runPhases`'s failure translation shared by `runEnableCascadeMembers` and
 * `runEnableCascadeWithRoot`: the failing phase's OWN ledger capture
 * (`run.rollbackPartials`) and `runPhases`'s own aggregate over every OTHER
 * phase's `undo` (`result.rollbackPartials`) are two different sources --
 * neither subsumes the other (WR-01).
 */
function enableCascadeRollbackPartials(
  run: EnableCascadeRun,
  result: RunPhasesResult,
): readonly RollbackPartial[] {
  return [...run.rollbackPartials, ...result.rollbackPartials];
}

/**
 * Materialize every `"re-enabled"` member through its own record, all or
 * nothing: driven through `runPhases` so a member failure unwinds every
 * member this command already turned on -- the same all-or-nothing stance
 * D-03-07 gives the install cascade, and the reason a half-enabled graph
 * never reaches disk (NFR-3). Used ONLY for the root-idempotent path, where
 * the root has no materialization of its own to merge in
 * (`runEnableCascadeWithRoot` handles the root-fresh path, CR-03).
 */
async function runEnableCascadeMembers(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  locations: ScopedLocations,
  state: ExtensionState,
  members: readonly EnableCascadeMember[],
): Promise<
  | {
      readonly ok: true;
      readonly rows: readonly EnableCascadeMemberRow[];
      readonly wrote: boolean;
      readonly hydratable: readonly EnableCascadeHydratableMember[];
    }
  | {
      readonly ok: false;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
    }
> {
  const { run, phases } = buildEnableCascadeMemberPhases(
    transaction,
    opts,
    scope,
    locations,
    state,
    members,
  );
  const result = await runPhases(phases, run);
  if (!result.ok) {
    assertFailedPhasesHasError(result);
    return {
      ok: false,
      error: result.error,
      rollbackPartials: enableCascadeRollbackPartials(run, result),
    };
  }

  return { ok: true, rows: run.rows, wrote: phases.length > 0, hydratable: run.hydratable };
}

/**
 * CR-03: materialize the cascade's re-enable members AND the root's own
 * fresh enable in ONE `runPhases` ledger -- the root's phase runs LAST, so
 * the members are live before the plugin that needs them, and a failure
 * anywhere unwinds every phase, members and root alike.
 */
async function runEnableCascadeWithRoot(args: {
  readonly transaction: EnableDisableTransaction;
  readonly opts: EnableDisablePluginOptions;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly state: ExtensionState;
  readonly installed: InstalledPluginRecord;
  readonly members: readonly EnableCascadeMember[];
  readonly rootKey: string;
}): Promise<
  | {
      readonly ok: true;
      readonly rows: readonly EnableCascadeMemberRow[];
      readonly hydratable: readonly EnableCascadeHydratableMember[];
      readonly root: Extract<SetEnabledOutcome, { kind: "fresh" }>;
    }
  | {
      readonly ok: false;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
    }
> {
  const { transaction, opts, scope, locations, state, installed, members, rootKey } = args;
  const { run, phases } = buildEnableCascadeMemberPhases(
    transaction,
    opts,
    scope,
    locations,
    state,
    members,
  );
  phases.push(buildEnableRootPhase(transaction, opts, scope, locations, state, installed, rootKey));
  const result = await runPhases(phases, run);
  if (!result.ok) {
    assertFailedPhasesHasError(result);
    return {
      ok: false,
      error: result.error,
      rollbackPartials: enableCascadeRollbackPartials(run, result),
    };
  }

  assertRootMaterialized(run);
  return { ok: true, rows: run.rows, hydratable: run.hydratable, root: run.root };
}

/**
 * `buildEnableRootPhase` is always the LAST phase in
 * `runEnableCascadeWithRoot`'s array, and a clean `runPhases` result means
 * every phase's `do` completed -- so `run.root` is always set on the `ok`
 * arm. Evidence-backed type narrowing only; the invariant is established by
 * the caller.
 */
function assertRootMaterialized(
  _run: EnableCascadeRun,
): asserts _run is EnableCascadeRun & { root: Extract<SetEnabledOutcome, { kind: "fresh" }> } {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * `runPhases`'s sole `ok: false` producer always sets `error`
 * (`transaction/phase-ledger.ts`'s catch normalizes any throw to an `Error`
 * before returning it). Evidence-backed type narrowing only, mirroring
 * `assertRecordedStateLedgerInstalled` above; the invariant is established
 * by that producer, not by a runtime check here.
 */
function assertFailedPhasesHasError(
  _result: RunPhasesResult,
): asserts _result is RunPhasesResult & { readonly error: Error } {
  // Evidence-backed type narrowing only; the invariant is established by the callee.
}

/**
 * CR-01: a re-enabled member whose key the target-scope config ALREADY
 * declares with `enabled: false` is the same divergence D-04-07 corrects for
 * the root. The disable verb writes exactly that entry, and EDEP-02 mandates
 * `disable A` (the dependent) then `disable B` (the dependency), so both
 * writes land; leaving `B`'s entry at `enabled: false` after `enable A`
 * re-enables `B` through its record hands the reload the row asks for a
 * `disable B` to plan (`plan.ts::classifyDeclaredPlugin` reads the config
 * truth). Only an EXISTING `enabled: false` entry is patched to `true`,
 * through the same declaring-file selection the root uses
 * (`selectConfigWriteTarget`) -- a member the config does not mention at all
 * is left untouched (D-04-02: the config names only what the user asked for
 * by name). Called only once BOTH the members' ledger AND the root's own
 * branch have succeeded, alongside the root's own `writeEnabledFlagBack` --
 * a config write is not undone by `runPhases`, so patching it any earlier
 * would leave the file changed under a state.json the root's own failure
 * then leaves unsaved.
 */
async function writeReEnabledMemberConfigEntries(
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  locations: ScopedLocations,
  state: ExtensionState,
  reEnabledKeys: readonly string[],
): Promise<void> {
  for (const key of reEnabledKeys) {
    const at = key.indexOf("@");
    const plugin = key.slice(0, at);
    const marketplace = key.slice(at + 1);
    const selection = await transaction.selectConfigWriteTarget({
      locations,
      local: opts.local,
      key,
    });
    if (selection.kind !== "selected" || selection.current.plugins?.[key]?.enabled !== false) {
      continue;
    }

    await transaction.writeConfigEntries({
      current: selection.current,
      sibling: selection.sibling,
      state,
      marketplace,
      plugin,
      targetConfigPath: selection.targetConfigPath,
      scopeRoot: locations.scopeRoot,
      pluginPatch: { enabled: true },
    });
  }
}

/** The EDEP-01 cascade step's outcome, for the transaction closure to act on. */
type EnableCascadeResolutionStep =
  | { readonly kind: "skipped" }
  | { readonly kind: "resolved"; readonly members: readonly EnableCascadeMember[] };

/**
 * EDEP-01: resolve (never materialize) the enable cascade, extracted from
 * the transaction closure to keep its cognitive complexity within the
 * project's lint budget. Scoped to standalone `enable` calls only -- a
 * reconcile-driven (orchestrated) call is a different call site with its own
 * dependency handling in `orchestrators/reconcile/dependency-verdict.ts`, and
 * `disable` keeps its own short-circuit exactly where it was.
 *
 * CR-03: materialization is decided by the CALLER, once it knows whether the
 * root itself is idempotent (`runEnableCascadeMembers`, members alone) or
 * fresh (`runEnableCascadeWithRoot`, members and the root in one ledger) --
 * that decision was not available yet at THIS point when materialization
 * used to happen here, before the idempotency check ran.
 */
async function resolveEnableCascadeStep(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly opts: EnableDisablePluginOptions;
  readonly enable: boolean;
  readonly orchestrated: boolean;
}): Promise<EnableCascadeResolutionStep> {
  const { state, locations, opts, enable, orchestrated } = args;
  if (!enable || orchestrated) {
    return { kind: "skipped" };
  }

  const cascade = await resolveEnableCascade(
    state,
    locations,
    `${opts.plugin}@${opts.marketplace}`,
  );
  return { kind: "resolved", members: cascade.members };
}

/** Either a terminal outcome to return immediately, or the branch's own outcome to continue post-processing. */
type BranchDispatchResult =
  | { readonly kind: "terminal"; readonly outcome: SetEnabledOutcome }
  | {
      readonly kind: "continue";
      readonly branchOutcome: SetEnabledOutcome;
      readonly removeRoutesAfterSave: boolean;
    };

/**
 * Dispatch to the enable or disable branch and fold the disable branch's
 * partial-cascade save-and-return arm, extracted from the transaction
 * closure to keep its cognitive complexity within the project's lint budget.
 */
async function dispatchBranch(args: {
  readonly transaction: EnableDisableTransaction;
  readonly hooksRouting: EnableDisableHooksRouting;
  readonly opts: EnableDisablePluginOptions;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly state: ExtensionState;
  readonly mp: ExtensionState["marketplaces"][string];
  readonly plugin: string;
  readonly installed: InstalledPluginRecord;
  readonly enable: boolean;
  readonly tx: { readonly save: () => Promise<void> };
}): Promise<BranchDispatchResult> {
  const {
    transaction,
    hooksRouting,
    opts,
    scope,
    locations,
    state,
    mp,
    plugin,
    installed,
    enable,
    tx,
  } = args;
  if (enable) {
    const branchOutcome = await runEnableBranch(
      transaction,
      opts,
      scope,
      locations,
      state,
      installed,
    );
    return { kind: "continue", branchOutcome, removeRoutesAfterSave: false };
  }

  const disableResult = await runDisableBranch(transaction, opts, locations, installed);
  // ENBL-02: on a clean disable, replace the map slot with the branded
  // `DisabledPluginRecord` the branch built via `toDisabledRecord` (rather
  // than mutating `installed` in place). The terminal `tx.save()` -- here on
  // the partial-cascade arm, or the caller's own on the clean arm --
  // persists `tx.state` with the replaced slot.
  if (disableResult.disabled !== undefined) {
    mp.plugins[plugin] = disableResult.disabled;
  }

  // I3: a partial disable cascade mutated `installed.resources.*` in place to
  // drop the artifacts already removed before the throw. Persist the
  // shrunken record so state.json never claims artifacts gone from disk
  // (NFR-3 fail-clean), THEN surface the failed row as a terminal outcome.
  if (disableResult.saveShrunken) {
    await tx.save();
    dropCachedHooksAfterSave(
      hooksRouting,
      opts,
      scope,
      disableResult.removeRoutesAfterSave,
      "partial-cascade ",
      false,
    );
    return { kind: "terminal", outcome: disableResult.outcome };
  }

  return {
    kind: "continue",
    branchOutcome: disableResult.outcome,
    removeRoutesAfterSave: disableResult.removeRoutesAfterSave,
  };
}

/**
 * EDEP-02: the disable branch's dependents guard, extracted so
 * `setPluginEnabledWithTransaction` gains one statement rather than an
 * inline branch. Called unconditionally from the closure; it is a no-op for
 * `enable`, for a target that is already disabled -- that arm has nothing to
 * refuse, so the idempotent short-circuit below keeps winning there -- and
 * for an orchestrated (reconcile-driven) call, which is a different call
 * site with its own dependency handling in
 * `orchestrators/reconcile/dependency-verdict.ts` (the EDEP-01 enable
 * cascade's own precedent: `runEnableCascadeStep` skips identically). A
 * reconcile pass disables a dependency chain in dependents-before-
 * dependencies order precisely BECAUSE the dependents still declare what it
 * is unwinding; refusing that here would deadlock the propagation this
 * guard must not interfere with. It only reads and refuses a STANDALONE
 * call that is about to actually move the target from enabled to disabled,
 * before `dispatchBranch`/`runDisableBranch` is reached.
 *
 * Mirrors `uninstall.ts::readDeclarers`'s composition:
 * `buildScopeDeclarationIndex({ state, locations, exclude: key })` then
 * `findDependents(key, result.index)`. Fail-closed (D-05-07): the `ok: false`
 * arm throws the refusal carrier with `"unreadable"` and `result.cause.message`
 * before the disable can proceed, so a record with no usable answer is never
 * read as "declares nothing".
 *
 * D-05-04: `buildScopeDeclarationIndex` indexes DISABLED declarers too,
 * because holding a declaration does not depend on being active. EDEP-02
 * asks about an ENABLED installed plugin, so this narrows the index's own
 * `candidates` to the keys whose record is not `isRecordedButDisabled`
 * before calling `findDependents` -- reusing the `record` handle each
 * candidate already carries, no second walk and no key re-lookup.
 */
async function readEnabledDependents(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly enable: boolean;
  readonly orchestrated: boolean;
  readonly installed: InstalledPluginRecord;
  readonly key: string;
}): Promise<void> {
  const { state, locations, enable, orchestrated, installed, key } = args;
  if (enable || orchestrated || isRecordedButDisabled(installed)) {
    return;
  }

  const result = await buildScopeDeclarationIndex({ state, locations, exclude: key });
  if (!result.ok) {
    throw new EnableRefusedError("unreadable", result.cause.message);
  }

  const enabledDeclarers = new Set(
    result.candidates
      .filter((candidate) => !isRecordedButDisabled(candidate.record))
      .map((candidate) => candidate.key),
  );
  const dependents = findDependents(key, result.index).filter((dependent) =>
    enabledDeclarers.has(dependent),
  );
  if (dependents.length > 0) {
    throw new EnableRefusedError("dependents remain", composeDisableRefusalCause(key, dependents));
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
  transaction: EnableDisableTransaction,
  opts: EnableDisablePluginOptions,
  locations: ScopedLocations,
  installed: InstalledPluginRecord,
): Promise<{
  outcome: SetEnabledOutcome;
  saveShrunken: boolean;
  removeRoutesAfterSave: boolean;
  disabled?: DisabledPluginRecord;
}> {
  const recordedVersion = installed.version;
  const cascade = await transaction.cascadeUnstagePlugin(
    opts.plugin,
    opts.marketplace,
    locations,
    installed,
  );
  if (isFailedUnstageOutcome(cascade)) {
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
    return {
      outcome: {
        kind: "disable-failed",
        cause: cascade.cause,
        recordedVersion,
      },
      saveShrunken: true,
      removeRoutesAfterSave: cascade.dropped.hooks.length > 0,
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
  return {
    outcome: { kind: "fresh", version: recordedVersion },
    saveShrunken: false,
    removeRoutesAfterSave: true,
    disabled,
  };
}

type FailedUnstageOutcome = UnstageOutcome & {
  readonly ok: false;
  readonly cause: Error;
};

/** `cascadeUnstagePlugin` normalizes every `ok: false` result to an Error cause. */
function isFailedUnstageOutcome(outcome: UnstageOutcome): outcome is FailedUnstageOutcome {
  return !outcome.ok;
}

type NonEmptyContentReasons = readonly [ContentReason, ...ContentReason[]];

/** `narrowDisableFailure` returns one singleton reason from every control-flow arm. */
function assertDisableFailureReasonsNonEmpty(
  _reasons: readonly ContentReason[],
): asserts _reasons is NonEmptyContentReasons {
  // Evidence-backed type narrowing only; the producer is total and nonempty.
}

function primaryDisableFailureReason(cause: Error): ContentReason {
  const reasons = narrowDisableFailure(cause);
  assertDisableFailureReasonsNonEmpty(reasons);
  return reasons[0];
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
  hooksRouting: EnableDisableHooksRouting,
  scope: Scope,
  marketplace: string,
  plugin: string,
  logPrefix: string,
  unexpected: boolean,
): void {
  try {
    hooksRouting.removePluginConfigFromCache(scope, marketplace, plugin);
    hooksRouting.rebuildRoutingTables();
  } catch (cacheErr) {
    const consequence = unexpected
      ? " -- hooks for this plugin remain active in the running process until the disable's /reload rebuilds the routing table from state.json"
      : "";
    hookDebugLog(
      `disable: ${logPrefix}cache/routing mutation failed for ${plugin}@${marketplace}: ${errorMessage(cacheErr)}${consequence}`,
    );
  }
}

function dropCachedHooksAfterSave(
  hooksRouting: EnableDisableHooksRouting,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  shouldRemove: boolean,
  logPrefix: string,
  unexpected: boolean,
): void {
  if (!shouldRemove) {
    return;
  }

  dropCachedHooks(hooksRouting, scope, opts.marketplace, opts.plugin, logPrefix, unexpected);
}

/** Publish one freshly enabled hooks config after state and config are durable. */
async function addCachedHooks(
  hooksRouting: EnableDisableHooksRouting,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  effect: EnableRouteEffect,
): Promise<void> {
  try {
    await hooksRouting.readAndCachePluginHooks({
      cwd: opts.cwd,
      hooksJsonPath: effect.hooksJsonPath,
      logPrefix: "enable",
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      resolvedSource: effect.resolvedSource,
      scope,
    });
    hooksRouting.rebuildRoutingTables();
  } catch (cacheErr) {
    hookDebugLog(
      `enable: post-save cache/routing mutation failed for ${opts.plugin}@${opts.marketplace}: ${errorMessage(cacheErr)}`,
    );
  }
}

async function addCachedHooksAfterSave(
  hooksRouting: EnableDisableHooksRouting,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  outcome: Extract<SetEnabledOutcome, { kind: "fresh" }>,
): Promise<void> {
  if (outcome.addRoutesAfterSave === undefined) {
    return;
  }

  await addCachedHooks(hooksRouting, opts, scope, outcome.addRoutesAfterSave);
}

/**
 * WR-02: publish every re-enabled cascade member's hooks config into the
 * routing cache after state and config are durable, mirroring
 * `install-flow.ts::hydrateInstalledHooks` for every install cascade member.
 * A member re-enabled through `buildEnableCascadeMemberPhase` has its
 * `hooks.json` on disk and no routing entry until the next `/reload`
 * otherwise -- the enable cascade is the one cascade whose re-enabled
 * members did not already reach this. Every mutation is non-fatal
 * (state.json already records the enable as successful), so a throw routes
 * through `hookDebugLog` rather than surfacing as `(failed)`.
 */
async function hydrateReEnabledMemberHooks(
  hooksRouting: EnableDisableHooksRouting,
  opts: EnableDisablePluginOptions,
  scope: Scope,
  members: readonly EnableCascadeHydratableMember[],
): Promise<void> {
  const withHooks = members.flatMap((member) =>
    member.hooksConfigPath === undefined
      ? []
      : [{ member, hooksJsonPath: path.join(member.pluginRoot, member.hooksConfigPath) }],
  );
  if (withHooks.length === 0) {
    return;
  }

  for (const { member, hooksJsonPath } of withHooks) {
    try {
      await hooksRouting.readAndCachePluginHooks({
        cwd: opts.cwd,
        hooksJsonPath,
        logPrefix: "enable",
        marketplace: member.marketplace,
        plugin: member.name,
        resolvedSource: asAbsolutePluginRoot(member.pluginRoot),
        scope,
      });
    } catch (cacheErr) {
      hookDebugLog(
        `enable: post-save cache/routing mutation failed for ${member.key}: ${errorMessage(cacheErr)}`,
      );
    }
  }

  try {
    hooksRouting.rebuildRoutingTables();
  } catch (cacheErr) {
    hookDebugLog(`enable: post-save routing rebuild failed: ${errorMessage(cacheErr)}`);
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
  transaction: EnableDisableTransaction,
  write: EnabledFlagWriteTarget,
  selection: SelectedConfigWriteTarget,
  state: ExtensionState,
): Promise<void> {
  await transaction.writeConfigEntries({
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
  transaction: EnableDisableTransaction,
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

  await writeEnabledFlagBack(transaction, write, selection, state);
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
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
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
    cascadeRows: [],
  });
  return undefined;
}

/** The idempotent-root branch's result: the outcome to return, plus the cascade rows for the standalone renderer. */
interface IdempotentEnableCascadeResult {
  readonly outcome: SetEnabledOutcome;
  readonly rows: readonly EnableCascadeMemberRow[];
}

/**
 * EDEP-01: the root is a no-op (idempotent), but its cascade may still have
 * members to materialize -- through their OWN ledger, since the root has
 * nothing for CR-03's merged ledger to add here. Extracted to keep
 * `setPluginEnabledWithTransaction`'s closure within the project's
 * cognitive-complexity ceiling.
 */
async function settleIdempotentEnableCascade(args: {
  readonly transaction: EnableDisableTransaction;
  readonly hooksRouting: EnableDisableHooksRouting;
  readonly opts: EnableDisablePluginOptions;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly state: ExtensionState;
  readonly installed: InstalledPluginRecord;
  readonly write: EnabledFlagWriteTarget;
  readonly selection: SelectedConfigWriteTarget;
  readonly cascadeMembers: readonly EnableCascadeMember[];
  readonly tx: { readonly save: () => Promise<void> };
}): Promise<IdempotentEnableCascadeResult> {
  const {
    transaction,
    hooksRouting,
    opts,
    scope,
    locations,
    state,
    installed,
    write,
    selection,
    cascadeMembers,
    tx,
  } = args;
  const idempotentOutcome = await resolveIdempotentOutcome(
    transaction,
    write,
    selection,
    state,
    installed,
  );
  const materialized = await runEnableCascadeMembers(
    transaction,
    opts,
    scope,
    locations,
    state,
    cascadeMembers,
  );
  if (!materialized.ok) {
    return {
      rows: [],
      outcome: {
        kind: "enable-failed",
        cause: materialized.error,
        recordedVersion: installed.version,
        ...(materialized.rollbackPartials.length > 0 && {
          rollbackPartials: materialized.rollbackPartials,
        }),
      },
    };
  }

  if (materialized.wrote) {
    // EDEP-01: the root is a no-op, but the cascade materialized real state
    // for at least one dependency -- persist it (NFR-3): a materialized
    // member's artifacts must not survive on disk with no matching
    // state.json entry. Only ever non-empty here for a standalone call:
    // `resolveEnableCascadeStep` skips the cascade entirely for
    // `orchestrated`.
    const reEnabledMemberKeys = materialized.rows
      .filter((row) => row.status === "installed")
      .map((row) => row.name);
    await writeReEnabledMemberConfigEntries(
      transaction,
      opts,
      locations,
      state,
      reEnabledMemberKeys,
    );
    await tx.save();
    await hydrateReEnabledMemberHooks(hooksRouting, opts, scope, materialized.hydratable);
  }

  return { rows: materialized.rows, outcome: idempotentOutcome };
}

/**
 * CR-03: the root is NOT idempotent, so a standalone (never orchestrated --
 * that path has no cascade members and keeps going through
 * `dispatchBranch`/`runEnableBranch`) enable materializes its cascade
 * members AND its own fresh enable in ONE `runPhases` ledger. A root
 * failure now unwinds the members too, and a member failure unwinds a root
 * that already committed -- both are phases of the same array. Extracted to
 * keep `setPluginEnabledWithTransaction`'s closure within the project's
 * cognitive-complexity ceiling.
 */
async function runFreshEnableCascadeWithRoot(args: {
  readonly transaction: EnableDisableTransaction;
  readonly hooksRouting: EnableDisableHooksRouting;
  readonly opts: EnableDisablePluginOptions;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly state: ExtensionState;
  readonly installed: InstalledPluginRecord;
  readonly write: EnabledFlagWriteTarget;
  readonly selection: SelectedConfigWriteTarget;
  readonly cascadeMembers: readonly EnableCascadeMember[];
  readonly rootKey: string;
  readonly tx: { readonly save: () => Promise<void> };
}): Promise<IdempotentEnableCascadeResult> {
  const {
    transaction,
    hooksRouting,
    opts,
    scope,
    locations,
    state,
    installed,
    write,
    selection,
    cascadeMembers,
    rootKey,
    tx,
  } = args;
  const merged = await runEnableCascadeWithRoot({
    transaction,
    opts,
    scope,
    locations,
    state,
    installed,
    members: cascadeMembers,
    rootKey,
  });
  if (!merged.ok) {
    return {
      rows: [],
      outcome: {
        kind: "enable-failed",
        cause: merged.error,
        recordedVersion: installed.version,
        ...(merged.rollbackPartials.length > 0 && { rollbackPartials: merged.rollbackPartials }),
      },
    };
  }

  const reEnabledMemberKeys = merged.rows
    .filter((row) => row.status === "installed")
    .map((row) => row.name);
  await writeEnabledFlagBack(transaction, write, selection, state);
  await writeReEnabledMemberConfigEntries(transaction, opts, locations, state, reEnabledMemberKeys);
  await tx.save();
  await addCachedHooksAfterSave(hooksRouting, opts, scope, merged.root);
  await hydrateReEnabledMemberHooks(hooksRouting, opts, scope, merged.hydratable);

  return { rows: merged.rows, outcome: merged.root };
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
 * the caller has nothing to consume. In the reconcile cascade
 * (`applyPluginToggles`), an absent-outcome guard (`if (result === undefined)
 * continue`) would silently drop the row -- the overload makes that branch a
 * compile error so the cascade always materialises a row (closes S6's fourth
 * loop).
 *
 * WR-01: what the overload proves and what it does not. It removes the
 * `undefined` arm AT THE CALL SITE, which is what makes a consumer's
 * absent-outcome guard a compile error. It does NOT prove the body honours it:
 * TypeScript checks an overload signature against the implementation only
 * loosely, and a narrower overload return is accepted with no diagnostic even
 * when the implementation demonstrably returns the excluded value on that path.
 * The narrowing is therefore an ASSERTION about this module, relocated from the
 * consumer to the producer's signature -- not a proof. Every orchestrated arm
 * below does return a defined outcome today, and the reconcile owner suite
 * drives this entrypoint in orchestrated mode across its whole outcome matrix
 * and asserts the complete cascade, so a regression on an exercised path fails
 * there. An arm the matrix does not reach is not covered by either.
 */
async function setPluginEnabledWithTransaction(
  transaction: EnableDisableTransaction,
  hooksRouting: EnableDisableHooksRouting,
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
  // EDEP-01: the enable cascade's classified member rows, threaded out of the
  // locked closure below for the standalone renderer. Stays empty for
  // `disable`, for orchestrated mode (a reconcile-driven enable is a
  // different call site with its own dependency handling in
  // `orchestrators/reconcile/dependency-verdict.ts`), and for a root that
  // declares no dependencies -- so `dispatchOutcome`'s row array is exactly
  // the single root row (EDEP-01 empty edge).
  let enableCascadeRows: readonly EnableCascadeMemberRow[] = [];

  let outcome: SetEnabledOutcome;
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
    outcome = await transaction.withLockedStateTransaction(
      locations,
      async (tx): Promise<SetEnabledOutcome> => {
        // D-103-13: ONE selection, made before anything reads a config path, so
        // the ordinary write-back and the config-truth promotion below cannot
        // drift onto different files. It runs inside the lock because it READS
        // the local config -- the WB-01 discipline that sibling reads happen
        // fresh under the lock the write also holds. UAT-05: the sibling path is
        // the scope's OTHER file, for the merged-view membership test only.
        const selection = await transaction.selectConfigWriteTarget({
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
          return { kind: "invalid-config" };
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
          return { kind: "not-recorded" };
        }

        // EDEP-01 / EDEP-03: resolve (never materialize yet) the enable
        // cascade BEFORE the root's own idempotency is decided (D-08-03), so
        // a dependency that is disabled still turns on even when the root
        // itself is already enabled. CR-03: materialization is decided
        // below, once idempotency is known.
        const cascadeResolution = await resolveEnableCascadeStep({
          state,
          locations,
          opts,
          enable,
          orchestrated,
        });
        const cascadeMembers =
          cascadeResolution.kind === "resolved" ? cascadeResolution.members : [];

        // EDEP-02: refuse a disable while an installed and ENABLED plugin in
        // the same scope still declares the target, before the idempotency
        // short-circuit below is allowed to return and before
        // `dispatchBranch`/`runDisableBranch` is reached.
        await readEnabledDependents({
          state,
          locations,
          enable,
          orchestrated,
          installed,
          key: `${plugin}@${marketplace}`,
        });

        // ENBL-05 idempotency: the explicit `enabled: false` marker, read
        // through the single predicate. Availability is not consulted, so a
        // disabled PARTIAL record is idempotent on `disable` and re-materializes
        // on `enable`, at parity with the canonical disabled record.
        if (isRecordedButDisabled(installed) === !enable) {
          const idempotent = await settleIdempotentEnableCascade({
            transaction,
            hooksRouting,
            opts,
            scope,
            locations,
            state,
            installed,
            write,
            selection,
            cascadeMembers,
            tx,
          });
          enableCascadeRows = idempotent.rows;
          return idempotent.outcome;
        }

        // CR-03: the root is NOT idempotent, so a standalone (never
        // orchestrated -- that path has no cascade members and keeps going
        // through `dispatchBranch`/`runEnableBranch` below) enable
        // materializes its cascade members AND its own fresh enable in ONE
        // `runPhases` ledger. A root failure now unwinds the members too,
        // and a member failure unwinds a root that already committed --
        // both are phases of the same array.
        if (enable && !orchestrated) {
          const fresh = await runFreshEnableCascadeWithRoot({
            transaction,
            hooksRouting,
            opts,
            scope,
            locations,
            state,
            installed,
            write,
            selection,
            cascadeMembers,
            rootKey: `${plugin}@${marketplace}`,
            tx,
          });
          enableCascadeRows = fresh.rows;
          return fresh.outcome;
        }

        const dispatch = await dispatchBranch({
          transaction,
          hooksRouting,
          opts,
          scope,
          locations,
          state,
          mp,
          plugin,
          installed,
          enable,
          tx,
        });
        if (dispatch.kind === "terminal") {
          return dispatch.outcome;
        }

        const { branchOutcome, removeRoutesAfterSave } = dispatch;
        if (branchOutcome.kind !== "fresh") {
          return branchOutcome;
        }

        // RECON-03: the write-back is SKIPPED in orchestrated mode. A
        // reconcile-driven call derives the desired state FROM the merged
        // config (base + local), so the declaration already exists by
        // construction -- possibly ONLY in `claude-plugins.local.json`, the
        // per-machine override. Writing it back here would copy the local
        // override's `enabled` flag into the shared BASE file and clobber a
        // user-authored base declaration. The config is the reconcile's INPUT;
        // only standalone commands author declarations. This arm is reached
        // only by `disable` or an orchestrated enable -- the standalone,
        // non-orchestrated enable returns above through CR-03's merged path.
        if (!orchestrated) {
          await writeEnabledFlagBack(transaction, write, selection, state);
        }

        await tx.save();
        await addCachedHooksAfterSave(hooksRouting, opts, scope, branchOutcome);
        dropCachedHooksAfterSave(hooksRouting, opts, scope, removeRoutesAfterSave, "", true);

        return branchOutcome;
      },
    );
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
    // EDEP-01: an `EnableRefusedError` (cycle / unreadable declarer) is the
    // one transaction throw this catch classifies for standalone mode -- its
    // reason names the fact the cause line states. Every other transaction
    // throw keeps the pre-existing brace-less `(failed)` row.
    emitEnableDisableFailedRow({
      ctx,
      pi,
      enable,
      marketplace,
      scope,
      row: {
        status: "failed",
        name: plugin,
        reasons: cause instanceof EnableRefusedError ? [cause.reason] : ([] as const),
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

  dispatchOutcome({
    ctx,
    pi,
    marketplace,
    scope,
    plugin,
    enable,
    configBasename,
    outcome,
    cascadeRows: enableCascadeRows,
  });
  return undefined;
}

/** Bind enable/disable orchestration to one required semantic transaction owner. */
export interface SetPluginEnabledOperation {
  (
    opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
  ): Promise<EnableDisablePluginOutcome>;
  (opts: EnableDisablePluginOptions): Promise<EnableDisablePluginOutcome | undefined>;
}

export function createSetPluginEnabled(
  transaction: EnableDisableTransaction,
  hooksRouting: EnableDisableHooksRouting,
): SetPluginEnabledOperation {
  function configuredSetPluginEnabled(
    opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
  ): Promise<EnableDisablePluginOutcome>;
  function configuredSetPluginEnabled(
    opts: EnableDisablePluginOptions,
  ): Promise<EnableDisablePluginOutcome | undefined>;
  function configuredSetPluginEnabled(
    opts: EnableDisablePluginOptions,
  ): Promise<EnableDisablePluginOutcome | undefined> {
    return setPluginEnabledWithTransaction(transaction, hooksRouting, opts);
  }

  return configuredSetPluginEnabled;
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
function classifyTransactionThrow(cause: Error): ContentReason {
  return cause instanceof StateLockHeldError ? "lock held" : primaryDisableFailureReason(cause);
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
  ctx: NotificationContext;
  pi: ToolInventory;
  marketplace: string;
  plugin: string;
  requestedScope: Scope | undefined;
  cause: Error;
  enable: boolean;
  orchestrated: boolean;
}): EnableDisablePluginOutcome | undefined {
  const { ctx, pi, marketplace, plugin, requestedScope, cause, enable, orchestrated } = args;
  const sanitized = sanitizeStateLoadError(cause);
  const reason = classifyTransactionThrow(sanitized);
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
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly enable: boolean;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly row: PluginFailedMessage;
}): void {
  const { ctx, pi, enable, marketplace, scope, row } = args;
  if (enable) {
    notifyWithContext(
      ctx,
      pi,
      ENABLE_CONTEXT,
      [{ name: marketplace, scope, plugins: [row] }],
      undefined,
      "single",
    );
  } else {
    notifyWithContext(
      ctx,
      pi,
      DISABLE_CONTEXT,
      [{ name: marketplace, scope, plugins: [row] }],
      undefined,
      "single",
    );
  }
}

/**
 * T-53-02-02: rewrite a `loadState` Error so its message carries the basename
 * of the failing path instead of the absolute path. The chained `cause` is
 * intentionally dropped -- the renderer's 4-space-indent trailer surfaces the
 * top-level message only, so there is nothing downstream that would read it.
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
  outcome: SetEnabledOutcome;
}): EnableDisablePluginOutcome {
  const { plugin, enable, configBasename, outcome } = args;
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
        reason: primaryDisableFailureReason(outcome.cause),
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
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly enable: boolean;
  readonly configBasename: string;
  readonly outcome: SetEnabledOutcome;
  /** EDEP-01: the enable cascade's classified member rows; empty for `disable`. */
  readonly cascadeRows: readonly EnableCascadeMemberRow[];
}): void {
  const { ctx, pi, marketplace, scope, plugin, enable, configBasename, outcome, cascadeRows } =
    args;
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
  // RLD-05 / D-07: the disable verb does not thread a distinguishing cascade
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
    // EDEP-01 / D-08-03: the full closure's rows ride the SAME single
    // notification -- root plus every classified member, sorted. A
    // one-element sort is a no-op, so a root with no members composes to
    // `[enableRow]` alone (pinned by the `enable-fresh` catalog state).
    const rows = composeEnableCascadeRows({ scope, rootRow: enableRow, members: cascadeRows });
    notifyWithContext(
      ctx,
      pi,
      ENABLE_CONTEXT,
      [{ name: marketplace, scope, plugins: rows }],
      undefined,
      "single",
    );
  } else {
    // D-10: the `!enable` branch only ever yields a `DisableMsg` (its `fresh`
    // arm emits `disabled`, never `installed`), so narrowing to the
    // DISABLE_CONTEXT row type is sound.
    const disableRow = row as DisableMsg;
    notifyWithContext(
      ctx,
      pi,
      DISABLE_CONTEXT,
      [{ name: marketplace, scope, plugins: [disableRow] }],
      undefined,
      "single",
    );
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
 * signals in `install-flow.ts`'s emit order -- `{orphan rewake}` first, then the
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
 * shortfall, so it takes the same `warning` raise `install-flow.ts::composeInstalledRow`
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
  // SEV-01: the enable row derives the SAME dependency list `install-flow.ts` derives
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
  readonly outcome: SetEnabledOutcome;
  /** SEV-01: the caller's `softDepStatus(pi)` snapshot -- this composer is pure. */
  readonly probe: SoftDepStatus;
}): EnableMsg | DisableMsg {
  const { plugin, enable, configBasename, outcome, probe } = args;
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
      // form. It carries no `(added)` token -- that header belongs to
      // `marketplace add`. UAT-03: the fresh-disable row carries
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
