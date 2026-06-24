import {
  composeReasons,
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginUninstalledMessage,
  type PluginWillDisableMessage,
  type PluginWillEnableMessage,
  type PluginWillInstallMessage,
  type PluginWillUninstallMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * reconcile/reconcile.messaging.ts -- the command-local notification vocabulary
 * for the load-time reconcile cascade (MOD-01/MOD-03). The reconcile producer is
 * not a slash command but a cascade producer (RECON-04): it reuses the same
 * per-status plugin-row shapes other commands emit. Two distinct surfaces share
 * this module:
 *
 *   - PENDING_CONTEXT renders the read-only `/claude:plugin pending` diff -- the
 *     pending-tense plugin rows (`will install` / `will uninstall` /
 *     `will enable` / `will disable`) plus a per-plugin `failed` row
 *     (source-mismatch dangling reference).
 *   - RECONCILE_APPLIED_CONTEXT renders the load-time
 *     `reconcile-applied-cascade` -- the REALIZED transition rows (`installed` /
 *     `uninstalled` / `disabled`) plus a per-plugin `failed` row.
 *
 * Each render map renders only the per-PLUGIN-ROW body. The marketplace header
 * (`will add` / `will remove` for pending; `added` / `removed` for applied;
 * `failed` for both), the cause-chain / rollback trailers, the
 * `(no marketplaces)` sentinel, and the severity/summary surface all stay
 * central in `notify.ts` and route byte-identically: the pending cascade through
 * `emitContextCascade` (plain `CascadeNotificationMessage`), the applied cascade
 * through `emitReconcileAppliedContextCascade` (the `reconcile-applied-cascade`
 * standalone envelope, whose content-derived severity must be preserved).
 *
 * The standalone `reconcile-pending-empty` advisory (`pending.ts`, the
 * `Pending: next reload will apply 0 actions.` line) is NOT a row surface; it
 * stays on the central standalone dispatch and owns no render map here.
 *
 * D-10: each context is pinned via `as const satisfies CommandContext<...>`, so
 * omitting a render arm for a declared status is a TS2741 compile error.
 */

// ---------------------------------------------------------------------------
// Pending diff: pending-tense rows.
// ---------------------------------------------------------------------------

/**
 * The plugin-row statuses the pending diff emits. The pending-tense rows carry
 * no `version` slot and no `reasons` (they are pre-transition); the `failed`
 * row (source-mismatch dangling reference) carries its `reasons` via the shared
 * `pluginRow` primitive.
 */
export const PENDING_STATUSES = [
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "failed",
] as const;
export type PendingStatus = (typeof PENDING_STATUSES)[number];

export type PendingMsg =
  | PluginWillInstallMessage
  | PluginWillUninstallMessage
  | PluginWillEnableMessage
  | PluginWillDisableMessage
  | PluginFailedMessage;

/** `(will install)` -- lifted verbatim from the central `renderPluginRow` arm. */
const renderWillInstall: RenderFn<PluginWillInstallMessage> = (p, _probe, mpScope) =>
  joinTokens([ICON_INSTALLED, p.name, renderScopeBracket(p.scope, mpScope), "(will install)"]);

/** `(will uninstall)` -- lifted verbatim; reuses ICON_AVAILABLE (`○`). */
const renderWillUninstall: RenderFn<PluginWillUninstallMessage> = (p, _probe, mpScope) =>
  joinTokens([ICON_AVAILABLE, p.name, renderScopeBracket(p.scope, mpScope), "(will uninstall)"]);

/** `(will enable)` -- lifted verbatim; reuses ICON_INSTALLED. */
const renderWillEnable: RenderFn<PluginWillEnableMessage> = (p, _probe, mpScope) =>
  joinTokens([ICON_INSTALLED, p.name, renderScopeBracket(p.scope, mpScope), "(will enable)"]);

/** `(will disable)` -- lifted verbatim; uses ICON_DISABLED (`◌`). */
const renderWillDisable: RenderFn<PluginWillDisableMessage> = (p, _probe, mpScope) =>
  joinTokens([ICON_DISABLED, p.name, renderScopeBracket(p.scope, mpScope), "(will disable)"]);

/**
 * `(failed)` -- per-plugin failure row. Lifted verbatim from the central
 * `renderPluginRow` `failed` arm (shared `pluginRow` primitive, no soft-dep
 * gating). The cause-chain trailer is composed centrally, not here.
 */
const renderFailed: RenderFn<PluginFailedMessage> = (p, probe, mpScope) =>
  pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe);

/**
 * D-04 / D-05: the pending diff's `CommandContext`. `Messaging.label` is the
 * human operation name `"Reconcile pending"`. The `render` map is total over
 * `PendingStatus` (D-10).
 */
export const PENDING_CONTEXT = {
  Messaging: { label: "Reconcile pending" },
  render: {
    "will install": renderWillInstall,
    "will uninstall": renderWillUninstall,
    "will enable": renderWillEnable,
    "will disable": renderWillDisable,
    failed: renderFailed,
  },
} as const satisfies CommandContext<PendingStatus, PendingMsg>;

// ---------------------------------------------------------------------------
// Applied cascade: realized transition rows.
// ---------------------------------------------------------------------------

/**
 * The plugin-row statuses the load-time applied cascade emits. A successful
 * enable re-materializes via install, so it surfaces as `installed`
 * (RECON-04); there is no separate `enabled` row status.
 */
export const RECONCILE_APPLIED_STATUSES = [
  "installed",
  "uninstalled",
  "disabled",
  "failed",
] as const;
export type ReconcileAppliedStatus = (typeof RECONCILE_APPLIED_STATUSES)[number];

export type ReconcileAppliedMsg =
  | PluginInstalledMessage
  | PluginUninstalledMessage
  | PluginDisabledMessage
  | PluginFailedMessage;

/**
 * `(installed)` -- realized install row. Only this arm reads `dependencies` for
 * the soft-dep marker brace; it also folds in any `reasons`. Lifted verbatim
 * from the central `renderPluginRow` `installed` arm.
 */
const renderInstalled: RenderFn<PluginInstalledMessage> = (p, probe, mpScope) =>
  joinTokens([
    ICON_INSTALLED,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(installed)",
    composeReasons(
      p.reasons,
      p.dependencies.includes("agents"),
      p.dependencies.includes("mcp"),
      probe,
    ),
  ]);

/**
 * `(uninstalled)` -- realized uninstall row. NO soft-dep marker (uninstalled
 * rows forbid it -- the arm passes `false`/`false`). Lifted verbatim from the
 * central `renderPluginRow` `uninstalled` arm.
 */
const renderUninstalled: RenderFn<PluginUninstalledMessage> = (p, probe, mpScope) =>
  joinTokens([
    ICON_AVAILABLE,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(uninstalled)",
    composeReasons(undefined, false, false, probe),
  ]);

/**
 * `(disabled)` -- realized disable inventory row. NO reasons / dependencies.
 * Lifted verbatim from the central `renderPluginRow` `disabled` arm.
 */
const renderDisabled: RenderFn<PluginDisabledMessage> = (p, probe, mpScope) =>
  joinTokens([
    ICON_DISABLED,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(disabled)",
    composeReasons(undefined, false, false, probe),
  ]);

/**
 * D-04 / D-05: the applied cascade's `CommandContext`. `Messaging.label` is the
 * human operation name `"Reconcile"`. The `render` map is total over
 * `ReconcileAppliedStatus` (D-10). Both reconcile contexts reuse the shared
 * closed reason set (`notify-reasons.ts`); reconcile declares no command-private
 * reasons.
 */
export const RECONCILE_APPLIED_CONTEXT = {
  Messaging: { label: "Reconcile" },
  render: {
    installed: renderInstalled,
    uninstalled: renderUninstalled,
    disabled: renderDisabled,
    failed: renderFailed,
  },
} as const satisfies CommandContext<ReconcileAppliedStatus, ReconcileAppliedMsg>;
