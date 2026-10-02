import {
  type ContentReason,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginUninstalledMessage,
  type PluginWillDisableMessage,
  type PluginWillEnableMessage,
  type PluginWillInstallMessage,
  type PluginWillUninstallMessage,
} from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

// ---------------------------------------------------------------------------
// Pending diff: pending-tense rows.
// ---------------------------------------------------------------------------

/**
 * The plugin-row statuses the pending diff emits. The pending-tense rows carry
 * no `version` slot and no `reasons` (they are pre-transition); the `failed`
 * row (source-mismatch dangling reference) carries its `reasons` via the shared
 * row grammar.
 */
type PendingStatus = "will install" | "will uninstall" | "will enable" | "will disable" | "failed";

export type PendingMsg =
  | PluginWillInstallMessage
  | PluginWillUninstallMessage
  | PluginWillEnableMessage
  | PluginWillDisableMessage
  | PluginFailedMessage;

/**
 * D-04 / D-05: the pending diff's `CommandContext`. `Messaging.label` is the
 * human operation name `"Reconcile pending"`. The `rowPolicies` map is total over
 * `PendingStatus` (D-10).
 */
export const PENDING_CONTEXT = {
  Messaging: { label: "Reconcile pending" },
  rowPolicies: {
    "will install": { markers: false, contentReasons: false },
    "will uninstall": { markers: false, contentReasons: false },
    "will enable": { markers: false, contentReasons: false },
    "will disable": { markers: false, contentReasons: false },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<PendingStatus>;

// ---------------------------------------------------------------------------
// Applied cascade: realized transition rows.
// ---------------------------------------------------------------------------

/**
 * The plugin-row statuses the load-time applied cascade emits. A successful
 * enable re-materializes via install, so it surfaces as `installed`
 * (RECON-04); there is no separate `enabled` row status.
 *
 * BFILL-01 / D-68-04: `partially-installed` widens this reconcile-local closed set
 * so a load-time backfill that only PARTIALLY re-materializes a plugin (its
 * re-resolved unsupported set is still non-empty) surfaces as a
 * `(partially-installed)` row. A FULLY promoted backfill reuses the `installed`
 * row. The `partially-installed` literal already exists in the global
 * `PLUGIN_STATUSES` set; only this narrow applied set widens here.
 */
type ReconcileAppliedStatus =
  "installed" | "uninstalled" | "disabled" | "failed" | "partially-installed";

export type ReconcileAppliedMsg =
  | PluginInstalledMessage
  | PluginUninstalledMessage
  | PluginDisabledMessage
  | PluginFailedMessage
  | PluginPartiallyInstalledMessage;

/**
 * LOAD-01: the brace of the load-time dependency-disable row, owned here beside
 * the row it rides. The token names the condition; the remedy naming the
 * dependency and the dependent rides the row's cause line, which is the only
 * channel in this grammar that interpolates an identifier.
 */
export const DEPENDENCY_UNSATISFIED_ROW_REASONS = [
  "dependency unsatisfied",
] as const satisfies readonly ContentReason[];

/**
 * LOAD-01: the brace of the same row on its version arm. A separate constant
 * rather than a second member of the brace above: exactly one of the two tokens
 * rides any given row, and which one is decided by the unsatisfied kind.
 */
export const DEPENDENCY_VERSION_UNSATISFIED_ROW_REASONS = [
  "dependency version unsatisfied",
] as const satisfies readonly ContentReason[];

/**
 * D-04 / D-05: the applied cascade's `CommandContext`. `Messaging.label` is the
 * human operation name `"Reconcile"`. The `rowPolicies` map is total over
 * `ReconcileAppliedStatus` (D-10). Both reconcile contexts reuse the shared
 * closed reason set (`notify-reasons.ts`); the one reason reconcile owns is the
 * load-time `dependency unsatisfied` brace declared above.
 */
export const RECONCILE_APPLIED_CONTEXT = {
  Messaging: { label: "Reconcile" },
  rowPolicies: {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    uninstalled: { markers: false, contentReasons: false },
    disabled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<ReconcileAppliedStatus>;
