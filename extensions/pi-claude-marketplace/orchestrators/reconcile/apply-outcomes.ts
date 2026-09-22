// orchestrators/reconcile/apply-outcomes.ts
//
// RECON-04: the per-entry outcome discriminated union
// consumed by `buildReconcileAppliedCascade`. Each variant captures one
// orchestrator call's structured result (success or failure) so the
// projection helper can fold N outcomes into one
// `ReconcileAppliedCascadeMessage` body without touching the orchestrators
// themselves.
//
// The variants split on { entity-kind, success | failed }:
//   - marketplace: add / remove
//   - plugin:      install / uninstall / enable / disable
//   - planner-only:    source-mismatch (report-only)
//   - planner-only:    invalid-block (CFG-03 from the read pass)
//
// Failure variants carry `reason: Reason` (broader than ContentReason so the
// structural `"marketplace not added"` sentinel can flow through; mirrors the orchestrator
// outcome shapes). Success variants carry the minimum fields the projection
// renders.
//
// T-55-02-02 mitigation contract: this file's failure variants carry ONLY
// the closed-set `reason: Reason`. Callers MUST NOT include raw
// `error.message` in the projection input -- `outcome.reason` is the sole
// field the renderer reads.

import path from "node:path";

import { isRenderablePluginKey } from "../../domain/dependencies.ts";
import { renderConstraintRange } from "../../domain/dependency-range.ts";
import {
  DependencyCascadeError,
  PluginShapeError,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type Reason } from "../../shared/notification-types.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";

import {
  DEPENDENCY_UNSATISFIED_ROW_REASONS,
  DEPENDENCY_VERSION_UNSATISFIED_ROW_REASONS,
} from "./reconcile.messaging.ts";

import type { UnsatisfiedKind } from "./dependency-verdict.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { Scope } from "../../shared/types.ts";
import type { EnableDegradationSignals } from "../plugin/enable-disable.ts";
import type { UninstallRefusedError } from "../plugin/uninstall.ts";

export interface OutcomeBase {
  readonly scope: Scope;
  readonly marketplace: string;
}

export interface PluginOutcomeBase extends OutcomeBase {
  readonly plugin: string;
}

/** Marketplace add success outcome. */
export interface MpAddedOutcome extends OutcomeBase {
  readonly kind: "mp-added";
}

/** Marketplace add failure outcome. */
export interface MpAddFailedOutcome extends OutcomeBase {
  readonly kind: "mp-add-failed";
  readonly reason: Reason;
}

/** Marketplace remove success outcome. */
export interface MpRemovedOutcome extends OutcomeBase {
  readonly kind: "mp-removed";
}

/** Marketplace remove failure outcome. */
export interface MpRemoveFailedOutcome extends OutcomeBase {
  readonly kind: "mp-remove-failed";
  readonly reason: Reason;
}

/**
 * I1 / PR #51: orchestrated partial-cascade marketplace-remove outcome. The
 * cascade unstaged some plugins AND failed others; per-plugin children carry
 * the granular reasons (rendered as indented `⊘ <plugin> (failed) {<reason>}`
 * rows), so the marketplace header stays bare `(failed)` (mirrors the
 * standalone CMC-31 PARTIAL byte form). Distinct from `mp-remove-failed`
 * which carries an mp-level reasons brace because no plugin children attach.
 */
export interface MpRemovePartialOutcome extends OutcomeBase {
  readonly kind: "mp-remove-partial";
}

/**
 * Plugin install success outcome. `version` mirrors the resolved install
 * version (when known); `dependencies` is the closed-set
 * `("agents" | "mcp")[]` derived from `InstallPluginOutcome.declaresAgents`
 * / `declaresMcp` so the renderer's `PluginInstalledMessage` arm fires soft-
 * dep markers correctly when companion extensions are unloaded.
 *
 * WR-04: the two ledger-degradation signals are INHERITED from the shared shape
 * rather than re-declared here, so all three ledger-driven arms (install,
 * enable, backfill) read one vocabulary and none can be given a signal the
 * others silently lack. `orphanRewake` pushes one `orphan rewake` token onto the
 * row -- one per plugin regardless of N orphan handlers -- and moves no severity
 * channel; `degradedKinds` pushes one `malformed skill` / `malformed command`
 * token per kind and raises the row from `info` to `warning`. A
 * degraded-but-installed component keeps the `(installed)` row: NOT
 * `(partially-installed)`, which is for DROPPED supported components.
 */
export interface PluginInstalledOutcome
  extends PluginOutcomeBase, Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds"> {
  readonly kind: "plugin-installed";
  readonly version?: string;
  readonly dependencies: readonly Dependency[];
  /**
   * MISS-01 / D-09-09: present only when the reload's dependency-install step
   * materialized this row's plugin to satisfy a declaration (`provenance:
   * "dependency"`); omitted otherwise (NREG-01). The reconcile projection
   * reads it to push the `dependency installed` token -- `notify.ts` composes
   * no vocabulary of its own.
   */
  readonly dependencyInstalled?: true;
  /**
   * S2 / PR #51: orchestrated-mode `InstallPluginOutcome.postCommitWarnings`
   * propagated through to the reconcile cascade caller. Mirrors the
   * `import/execute.ts::installOnePlannedPlugin` pattern -- post-commit hygiene warnings
   * (data-dir mkdir deferred, agent-foreign-content preserved,
   * completion-cache refresh deferred, bridge-side soft warnings) are
   * surfaced to the operator instead of silently dropped. Standalone-mode
   * installs swallow these per D-19-01; orchestrated mode is the supported
   * surfacing channel.
   */
  readonly postCommitWarnings?: readonly string[];
}

/**
 * Plugin re-materialized in place by load-time backfill (BFILL-01). A
 * partially-installed plugin is re-resolved offline (NFR-5) and its now-fuller
 * supported set is materialized via the reinstall primitive; this outcome folds
 * the promotion into the single applied cascade (D-68-04 / RECON-04). `version`
 * mirrors the unchanged recorded version (a promotion is NOT an upgrade);
 * `dependencies` drives the soft-dep markers like the install arm. The required
 * `installable` is the RE-RESOLVED installability: `true` selects the
 * `(installed)` row (unsupported set now empty -> fully promoted), `false`
 * selects the `(partially-installed)` row (partial re-materialize, still degraded).
 *
 * WR-04: the backfill runs the same class of ledger the install and enable arms
 * run, so it INHERITS the same two ledger-degradation signals rather than
 * declaring a narrower vocabulary of its own. Without them, a backfill of a
 * plugin whose `hooks.json` declares `rewakeMessage` without `asyncRewake: true`
 * -- or whose skill frontmatter is unparseable -- rendered a clean row naming
 * neither fact, which is the contradiction the shared shape exists to prevent.
 * The dropped-kind list is NOT inherited: this arm carries the re-resolved
 * `unsupported` kind list below, which is that same fact read off the backfill's
 * own offline resolution.
 */
export interface PluginBackfilledOutcome
  extends PluginOutcomeBase, Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds"> {
  readonly kind: "plugin-backfilled";
  readonly version?: string;
  readonly dependencies: readonly Dependency[];
  readonly installable: boolean;
  /**
   * SEV-05 / D-69-04: the re-resolved dropped-component kinds (the
   * `partially-available` arm's component list) so the `(partially-installed)` projection
   * can populate a factual `{reasons}` brace through the shared
   * `narrowUnsupportedKinds` seam -- exactly as the `install` success row does.
   * Empty on a fully-promoted (`installable`) backfill, where the row drops to
   * the brace-less `(installed)` projection.
   */
  readonly unsupported: readonly string[];
}

/** Plugin install failure outcome. */
export interface PluginInstallFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-install-failed";
  readonly reason: Reason;
  /**
   * RESV-06: set ONLY when the failure is attributable to a DEPENDENCY
   * (`reason === "dependency failed"`) -- the projection surfaces it as the
   * row's cause-chain trailer, mirroring `plugin-uninstall-failed.cause`
   * (D-05-16). Every other failed install leaves it unset.
   *
   * Redacted at the apply.ts push site (T-55-02-02 / T-53-02-02): the
   * closure/constraint arms build their message from `name@marketplace` keys
   * and version constraints (never a path), but a dependency's own ledger
   * failure can carry one anywhere in its cause chain. `apply.ts`'s
   * `redactedDependencyCascadeError` rebuilds the value's message AND its
   * full nested cause chain (via `shared/redact-absolute-paths.ts`'s
   * `redactCauseChain`) with every link redacted, since the renderer's
   * depth-5 `causeChainTrailer` walker (`shared/errors.ts`) does not redact
   * on its own.
   */
  readonly cause?: DependencyCascadeError;
}

/** Plugin uninstall success outcome. */
export interface PluginUninstalledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-uninstalled";
  readonly version?: string;
}

/** Plugin uninstall failure outcome. */
export interface PluginUninstallFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-uninstall-failed";
  readonly reason: Reason;
  /**
   * D-05-16: set ONLY for a REFUSED uninstall, which since D-06-06 means
   * exactly one thing -- some other record's declarations could not be
   * established (D-05-07). The projection surfaces it as the row's cause-chain
   * trailer, so a config-driven uninstall reports the same `cause:` line the
   * typed command does, naming which record could not be read. Every other
   * failed uninstall leaves it unset.
   *
   * The field OUTLIVED the dependents refusal it was introduced beside: a
   * target other plugins still declare is now removed rather than refused, and
   * the fail-closed unreadable refusal it also served still happens, so the
   * carriage is live rather than dead.
   *
   * No `redactAbsolutePaths` pass is applied here, on purpose: the refusal's
   * message is composed from `name@marketplace` keys, field paths and text the
   * declaration-index leaf already redacted, and it chains no `cause` behind
   * it, so there is no path left for the depth-5 cause-chain walker to print.
   */
  readonly cause?: UninstallRefusedError;
}

/**
 * Plugin enable success outcome. The setPluginEnabled enable branch re-
 * materializes the plugin via installPlugin's runInstallLedger; the
 * orchestrated outcome is `{ status: "enabled", name, version? }` plus the
 * ledger's degradation signals. The projection emits an `(installed)` plugin
 * row since `enabled` is NOT a member of `PLUGIN_STATUSES` -- the cascade
 * reuses the existing transition token because an enable IS a re-install.
 *
 * ENBL-07 / SURF-05 / WARN-01: the degradation signals are inherited from
 * `EnableDegradationSignals` rather than re-declared, so the orchestrated
 * projection cannot drift from the standalone verb -- a signal added to that
 * shape cannot be silently dropped here. Each field is omitted when empty, so
 * a clean enable renders byte-identically to before (NREG-01).
 *
 * SEV-01 / D-98-02: the inherited signals include the ledger's staged-agent and
 * staged-MCP verdicts, from which `enabledRowFromOutcome` derives the row's
 * `dependencies` list -- the same derivation the standalone enable row runs. The
 * row carries no `dependencies` field of its own for that reason: the list is
 * derived from the signals, never passed in beside them.
 */
export interface PluginEnabledOutcome extends PluginOutcomeBase, EnableDegradationSignals {
  readonly kind: "plugin-enabled";
  readonly version?: string;
}

/** Plugin enable failure outcome. */
export interface PluginEnableFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-enable-failed";
  readonly reason: Reason;
}

/**
 * Plugin disable success outcome. Two producers share it: the toggle path (a
 * user-declared `enabled: false` over a materialized record) and the
 * install-disabled cascade (DFEN-04 -- the install ran whole and then unstaged
 * because the plugin's own `defaultEnabled` said so). The three optional fields
 * below are what tell the two apart on the rendered row; the toggle path omits
 * all three and stays byte-frozen.
 */
export interface PluginDisabledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-disabled";
  readonly version?: string;
  /**
   * DFEN-04 / OUT-01: the author-declared cause, named exactly as the
   * standalone install-disabled row names it. Without it the unattended row --
   * the COMMON one, since a hand-added bare entry is how most plugins reach
   * this path -- renders identically to a user-requested disable and says
   * nothing about why the plugin arrived inert.
   */
  readonly reasons?: readonly ContentReason[];
  /**
   * OUT-04 / D-102-10: request the frozen trailer naming the `enable` verb. Set
   * by the install-disabled cascade for the same reason the standalone install
   * row sets it -- the user did not ask for a disable, so the row has to name
   * the remedy. The toggle path omits it: a user who declared `enabled: false`
   * does not need to be told how to undo it.
   */
  readonly enableHint?: true;
  /**
   * S2 / PR #51: orchestrated-mode `InstallPluginOutcome.postCommitWarnings`,
   * propagated exactly as the sibling `plugin-installed` arm propagates them.
   * `installPlugin` collects these AFTER the state commit and gates none of
   * them on the disabled verdict, so a permission error on `pluginDataDir` or a
   * preserved foreign agent file is just as real here -- the data dir and the
   * foreign file are both still on disk.
   */
  readonly postCommitWarnings?: readonly string[];
}

/**
 * LOAD-01: the load-time check disabled this plugin, because a dependency it
 * declares is not satisfied in the same scope.
 *
 * It is a separate arm from `plugin-disabled` rather than three more optional
 * fields on it, because the two report different facts. A toggle disable
 * carried out what the user declared and reaches the desired state; this one
 * carried out a consequence the user did not ask for and leaves the desired
 * state unreached, so it renders at warning severity with a remedy the toggle
 * row has nothing to say about.
 *
 * `dependency`, `unsatisfied` and `range` are the remedy's inputs. The
 * discriminant is named `unsatisfied` because `kind` already discriminates the
 * outcome union itself.
 */
export interface PluginDependencyDisabledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-dependency-disabled";
  readonly version?: string;
  /**
   * The row's brace, stamped by the producer rather than named in the renderer
   * (`notify.ts` maps an arm to a row and composes no vocabulary of its own).
   */
  readonly reasons: readonly ContentReason[];
  /**
   * The remedy, naming the dependency and the dependent. It is built here, at
   * production time, for the same reason `plugin-uninstall-failed` carries its
   * refusal: the row renders a sentence the orchestrator composed, and the
   * renderer composes none.
   *
   * T-06-01: every key the message interpolates is cleared by `remedyParty`
   * first, and it chains NO nested cause, so the renderer's chain walk -- which
   * does not redact on its own -- has no raw message behind it to print.
   */
  readonly cause: Error;
}

/**
 * One party of a remedy sentence: the key in quotes when it is renderable, and
 * the caller's key-less noun phrase when it is not.
 *
 * T-06-02: both keys reach the sentence from a STATE record, so neither is
 * token-validated by arrival alone. The dependent is
 * `${plugin}@${marketplace}` of the recorded declarer. The dependency is the
 * declared name -- token-validated -- joined to a marketplace that is the
 * declaration's own only when the declaration named one; a declaration that
 * named none inherits the DECLARING RECORD's marketplace name
 * (`dependency-index.ts::readRecordDeclarations`), which is bounded only by
 * `assertSafeName`. `assertSafeName` admits `"`, `,`, spaces and bidi
 * controls, so an unchecked key could close a quote and forge the rest of the
 * line, which the cause-chain renderer neither redacts nor escapes.
 */
function remedyParty(key: string, keyless: string): string {
  return isRenderablePluginKey(key) ? `"${key}"` : keyless;
}

/**
 * The remedy sentence for one unsatisfied declaration, in the three shapes
 * LOAD-01 pins, transcribed from the upstream wording rather than paraphrased.
 *
 * Each party is quoted only after `remedyParty` clears it. The row's own
 * subject already names the held-down plugin, so the key-less form stays
 * actionable. T-06-05: a declared range is bounded by `renderConstraintRange`,
 * never sliced by hand.
 */
function dependencyRemedy(held: {
  readonly marketplace: string;
  readonly plugin: string;
  readonly dependency: string;
  readonly kind: UnsatisfiedKind;
  readonly range?: string;
}): string {
  const dependency = remedyParty(held.dependency, "the declared dependency");
  const dependent = remedyParty(`${held.plugin}@${held.marketplace}`, "this plugin");
  switch (held.kind) {
    case "missing":
      return `Install ${dependency} or uninstall ${dependent}`;
    case "disabled":
      return `Enable ${dependency} or uninstall ${dependent}`;
    case "out-of-range":
      // The verdict carries a range on this kind. One that arrives without it
      // still names the remedy's two parties, rather than rendering an empty
      // constraint the operator cannot act on.
      return held.range === undefined
        ? `Update ${dependency} or uninstall ${dependent}`
        : `Update ${dependency} to satisfy ${renderConstraintRange(held.range)}, or uninstall ${dependent}`;
  }
}

/**
 * The row's brace for one unsatisfied kind.
 *
 * The version arm carries its own token because its remedy is a different kind
 * of instruction -- move an existing plugin's version, rather than install or
 * enable a missing one -- and the two upstream error codes it mirrors are
 * likewise a pair. The missing and disabled arms share the first token: both
 * name a dependency that is not usable at all.
 */
function dependencyRowReasons(kind: UnsatisfiedKind): readonly ContentReason[] {
  return kind === "out-of-range"
    ? DEPENDENCY_VERSION_UNSATISFIED_ROW_REASONS
    : DEPENDENCY_UNSATISFIED_ROW_REASONS;
}

/**
 * Build the load-time disable outcome for one held-down plugin.
 *
 * It lives beside the shape rather than inside the apply step, on the
 * `dependenciesFromInstall` precedent: which optional fields a given
 * unsatisfied kind carries is the arm's own contract, so the one place that
 * fills them sits next to the interface that declares them.
 *
 * The parameter is the planned entry's shape structurally rather than by name:
 * `types.ts` already imports this module for `PerEntryOutcome`, so naming
 * `PlannedDependencyDisable` here would close an import cycle.
 */
export function dependencyDisabledOutcome(
  held: {
    readonly scope: Scope;
    readonly marketplace: string;
    readonly plugin: string;
    readonly dependency: string;
    readonly kind: UnsatisfiedKind;
    readonly range?: string;
  },
  version: string | undefined,
): PluginDependencyDisabledOutcome {
  return {
    kind: "plugin-dependency-disabled",
    scope: held.scope,
    marketplace: held.marketplace,
    plugin: held.plugin,
    ...(version !== undefined && { version }),
    reasons: dependencyRowReasons(held.kind),
    cause: new Error(dependencyRemedy(held)),
  };
}

/** Plugin disable failure outcome. */
export interface PluginDisableFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-disable-failed";
  readonly reason: Reason;
}

/**
 * Source-mismatch outcome from `planReconcile`. Report-only: apply.ts does
 * NOT drive an orchestrator for these; the planner surfaces them on the
 * cascade as a `(failed) {source mismatch}` mp row with an optional plugin
 * child carrying the offending plugin name (mirrors the pending projection).
 *
 * The four per-cause variants mirror `PlannedSourceMismatch`: each carries
 * only the fields its diagnostic renders. The `marketplace` field on the
 * first three variants is the renderable mp-name subject; on
 * `malformed-plugin-key` the subject is `rawKey` instead, NOT a punned
 * `marketplace` (preserves the type-level "this is the user's typo, not a
 * real marketplace name" contract).
 */
export type SourceMismatchOutcome =
  | {
      readonly kind: "source-mismatch";
      readonly cause: "source-mismatch";
      readonly scope: Scope;
      readonly marketplace: string;
    }
  | {
      readonly kind: "source-mismatch";
      readonly cause: "unknown-stored";
      readonly scope: Scope;
      readonly marketplace: string;
    }
  | {
      readonly kind: "source-mismatch";
      readonly cause: "dangling-reference";
      readonly scope: Scope;
      readonly marketplace: string;
      readonly plugin: string;
    }
  | {
      readonly kind: "source-mismatch";
      readonly cause: "malformed-plugin-key";
      readonly scope: Scope;
      readonly rawKey: string;
    };

/**
 * Derive the renderable subject (the marketplace-block key name) from a
 * `SourceMismatchOutcome`. For source-mismatch / unknown-stored /
 * dangling-reference the subject is `marketplace`; for malformed-plugin-key
 * the subject is `rawKey`. Centralising the derivation here keeps the
 * renderers byte-identical across the four causes.
 */
export function sourceMismatchOutcomeSubject(outcome: SourceMismatchOutcome): string {
  return outcome.cause === "malformed-plugin-key" ? outcome.rawKey : outcome.marketplace;
}

/**
 * Invalid-config outcome from the per-scope read pass (CFG-03). Carries
 * the file BASENAME in `basename` so the projection renders
 * `⊘ <basename> [<scope>] (failed) {invalid manifest}` -- the absolute
 * path is NEVER in the outcome (T-55-02-01 / T-53-02-02). The field is
 * `basename`, not the punned `marketplace` used by mp-level outcomes, so
 * the type system makes the "this is a file name, not a marketplace name"
 * contract explicit.
 */
export interface InvalidBlockOutcome {
  readonly kind: "invalid-block";
  readonly scope: Scope;
  readonly basename: string;
  /**
   * Closed-set reason. The CFG-03 read-pass arm hard-codes the literal
   * `"invalid manifest"`; the state-load throw arm passes the value through
   * `classifyReadPassThrow` (apply.ts) which yields `"lock held"`,
   * `"unparseable"`, or another `narrowProbeError` token.
   */
  readonly reason: ContentReason;
  /**
   * I5 / PR #51: optional path-redacted diagnostic. When set, the projection
   * surfaces it as a synthetic plugin-row cause-chain trailer (depth-5 walker)
   * so the operator sees WHY the file is invalid (EACCES vs JSON-parse vs
   * specific schema key) instead of bare `{invalid manifest}`. Absolute
   * paths MUST already be stripped via `redactAbsolutePaths` BEFORE wrapping
   * into this Error -- T-53-02-02 / T-55-02-01 information-disclosure
   * mitigation.
   */
  readonly cause?: Error;
}

/**
 * RECON-04: the per-entry outcome union consumed by
 * `buildReconcileAppliedCascade`. Single source of truth for the apply-time
 * outcomes the projection knows how to fold.
 */
export type PerEntryOutcome =
  | MpAddedOutcome
  | MpAddFailedOutcome
  | MpRemovedOutcome
  | MpRemoveFailedOutcome
  | MpRemovePartialOutcome
  | PluginInstalledOutcome
  | PluginBackfilledOutcome
  | PluginInstallFailedOutcome
  | PluginUninstalledOutcome
  | PluginUninstallFailedOutcome
  | PluginEnabledOutcome
  | PluginEnableFailedOutcome
  | PluginDisabledOutcome
  | PluginDependencyDisabledOutcome
  | PluginDisableFailedOutcome
  | SourceMismatchOutcome
  | InvalidBlockOutcome;

// ───────────────────────────────────────────────────────────────────────────
// Throw classification and the install-outcome dependency derivation, moved
// from apply.ts. Both the apply pass and the backfill pass narrow the same
// throws into the same closed set, so the classifiers sit beside the outcome
// shapes they feed rather than inside one of their two callers (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * I6 / PR #51: closed-set reason for an unexpected orchestrator throw.
 *
 * Narrows on the typed marketplace/plugin errors BEFORE falling through to
 * the generic FS/JSON probe classifier so a `StateLockHeldError` surfaces as
 * `{lock held}` and a `PluginShapeError` surfaces as its kind-mapped catalog
 * token (`not in manifest` / `already installed` / `no longer installable`)
 * instead of flattening to the misleading `{unreadable}` fallback. Mirrors
 * the instanceof ladder in `import/execute.ts::dispatchFailedOutcome`; the
 * `not-installable` and `no-longer-installable` shape kinds collapse to the
 * single `no longer installable` token used by import's
 * `importWarningReason("uninstallable")` so the cross-surface reason stays
 * identical for the same underlying failure.
 *
 * RESV-06: a `DependencyCascadeError` is checked FIRST -- an install failure
 * attributable to one of the plugin's dependencies otherwise falls through to
 * `{unreadable}`, losing the closure/constraint arms' `name@marketplace`
 * cause entirely.
 *
 * Exported for direct unit-test exercise of the closed-set mapping
 * (the function is otherwise module-private).
 */
export function classifyOrchestratorThrow(err: unknown): ContentReason {
  if (err instanceof DependencyCascadeError) {
    return "dependency failed";
  }

  if (err instanceof StateLockHeldError) {
    return "lock held";
  }

  if (err instanceof PluginShapeError) {
    switch (err.shape.kind) {
      case "not-in-manifest":
        return "not in manifest";
      case "already-installed":
        return "already installed";
      case "not-installable":
      case "no-longer-installable":
        return "no longer installable";
    }
  }

  return narrowProbeError(err);
}

/**
 * S3 / PR #51: sentinel wrapping a throw originating in
 * `migrateFirstRunConfig`'s inner `saveConfig` call. The per-scope read-pass
 * catch unwraps `.configFilePath` to attribute the failure row to
 * `claude-plugins.json` (the actual failing file) rather than `state.json`.
 */
export class MigrateConfigSaveError extends Error {
  readonly configFilePath: string;
  override readonly cause: unknown;
  constructor(configFilePath: string, cause: unknown) {
    super(`migrateFirstRunConfig saveConfig failed for "${path.basename(configFilePath)}"`);
    this.name = "MigrateConfigSaveError";
    this.configFilePath = configFilePath;
    this.cause = cause;
  }
}

/**
 * WR-01: closed-set reason for a per-scope read-pass throw. A concurrent
 * process holding the scope lock surfaces as `lock held`; a corrupt
 * state.json surfaces as `unparseable` (loadState wraps the JSON.parse
 * SyntaxError one level deep in `Error.cause`, so unwrap before falling back
 * to the generic probe classifier).
 */
export function classifyReadPassThrow(err: unknown): ContentReason {
  if (err instanceof StateLockHeldError) {
    return "lock held";
  }

  if (err instanceof Error && err.cause instanceof SyntaxError) {
    return "unparseable";
  }

  return narrowProbeError(err);
}

/** Derive the closed-set Dependency[] from InstallPluginOutcome flags. */
export function dependenciesFromInstall(outcome: {
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (outcome.declaresAgents) {
    deps.push("agents");
  }

  if (outcome.declaresMcp) {
    deps.push("mcp");
  }

  return deps;
}
