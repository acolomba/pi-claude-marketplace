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
// structural `"not added"` sentinel can flow through; mirrors the orchestrator
// outcome shapes). Success variants carry the minimum fields the projection
// renders.
//
// T-55-02-02 mitigation contract: this file's failure variants carry ONLY
// the closed-set `reason: Reason`. Callers MUST NOT include raw
// `error.message` in the projection input -- `outcome.reason` is the sole
// field the renderer reads.

import type { ContentReason, Dependency, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

interface OutcomeBase {
  readonly scope: Scope;
  readonly marketplace: string;
}

interface PluginOutcomeBase extends OutcomeBase {
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
 */
export interface PluginInstalledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-installed";
  readonly version?: string;
  readonly dependencies: readonly Dependency[];
  /**
   * S2 / PR #51: orchestrated-mode `InstallPluginOutcome.postCommitWarnings`
   * propagated through to the reconcile cascade caller. Mirrors the
   * `import/execute.ts:699-703` pattern -- post-commit hygiene warnings
   * (data-dir mkdir deferred, agent-foreign-content preserved,
   * completion-cache refresh deferred, bridge-side soft warnings) are
   * surfaced to the operator instead of silently dropped. Standalone-mode
   * installs swallow these per D-19-01; orchestrated mode is the supported
   * surfacing channel.
   */
  readonly postCommitWarnings?: readonly string[];
}

/** Plugin install failure outcome. */
export interface PluginInstallFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-install-failed";
  readonly reason: Reason;
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
}

/**
 * Plugin enable success outcome. The setPluginEnabled enable branch re-
 * materializes the plugin via installPlugin's runInstallLedger; the
 * orchestrated outcome is `{ status: "enabled", name, version? }` (no
 * dependencies). The projection emits an `(installed)` plugin row since
 * `enabled` is NOT a member of `PLUGIN_STATUSES` -- the cascade reuses the
 * existing transition token because an enable IS a re-install.
 */
export interface PluginEnabledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-enabled";
  readonly version?: string;
}

/** Plugin enable failure outcome. */
export interface PluginEnableFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-enable-failed";
  readonly reason: Reason;
}

/** Plugin disable success outcome. */
export interface PluginDisabledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-disabled";
  readonly version?: string;
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
 * child carrying the offending plugin name (mirrors the preview projection).
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
   * mitigation. Pre-fix this detail was dropped at every consumer surface.
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
  | PluginInstallFailedOutcome
  | PluginUninstalledOutcome
  | PluginUninstallFailedOutcome
  | PluginEnabledOutcome
  | PluginEnableFailedOutcome
  | PluginDisabledOutcome
  | PluginDisableFailedOutcome
  | SourceMismatchOutcome
  | InvalidBlockOutcome;
