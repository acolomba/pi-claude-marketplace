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

import type { ContentReason, Reason } from "../../shared/notify.ts";
import type { Dependency } from "../../shared/notify.ts";
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
 * `enabled` is NOT a member of `PLUGIN_STATUSES` (RESEARCH Pattern 5
 * Option A: reuse existing transition tokens; an enable IS a re-install).
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
 */
export interface SourceMismatchOutcome extends OutcomeBase {
  readonly kind: "source-mismatch";
  /**
   * Present only on plugin-level dangling references; absent on mp-level
   * mismatches. Mirrors `PlannedSourceMismatch.plugin`.
   */
  readonly plugin?: string;
}

/**
 * Invalid-config outcome from the per-scope read pass (CFG-03 / Pitfall
 * 53-1). Carries the file BASENAME in `marketplace` so the projection
 * renders `⊘ <basename> [<scope>] (failed) {invalid manifest}` -- the
 * absolute path is NEVER in the outcome (T-55-02-01 / T-53-02-02).
 */
export interface InvalidBlockOutcome extends OutcomeBase {
  readonly kind: "invalid-block";
  /** Closed-set reason from `narrowProbeError` -- `invalid manifest` for CFG-03, `unparseable` for state-json. */
  readonly reason: ContentReason;
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
