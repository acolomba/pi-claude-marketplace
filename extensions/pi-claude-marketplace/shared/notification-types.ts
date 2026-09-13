import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { Dependency } from "./concerns/soft-dep.ts";
import type { Scope } from "./types.ts";

/** Closed notification reason vocabulary in canonical render order. */
export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "unsupported component",
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
  "already autoupdate",
  "already no autoupdate",
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
  "marketplace not added",
  "marketplace not added to user scope",
  "marketplace not added to project scope",
  "orphan rewake",
  "authentication required",
  "dangling reference",
  "malformed mcp",
  "malformed skill",
  "malformed command",
  "installs disabled",
  "marketplace in user scope",
  "marketplace in project scope",
  "workflows",
] as const;

/** Literal union derived from the closed reason vocabulary. */
export type Reason = (typeof REASONS)[number];

/** Reasons that describe a content row rather than marketplace absence. */
export type ContentReason = Exclude<
  Reason,
  | "marketplace not added"
  | "marketplace not added to user scope"
  | "marketplace not added to project scope"
>;

/** Closed notification status vocabulary in canonical render order. */
export const STATUS_TOKENS = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

/** Literal union derived from the closed notification status vocabulary. */
export type StatusToken = (typeof STATUS_TOKENS)[number];

/** Closed plugin status vocabulary in canonical render order. */
export const PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  "partially-installed",
  "partially-upgradable",
  "partially-available",
  "remote",
] as const;

/** Closed marketplace status vocabulary in canonical render order. */
export const MARKETPLACE_STATUSES = [
  "added",
  "removed",
  "updated",
  "failed",
  "autoupdate enabled",
  "autoupdate disabled",
  "skipped",
] as const;

/** Literal union derived from the plugin status vocabulary. */
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];

/** Literal union derived from the marketplace status vocabulary. */
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

/** Marketplace details shown by list and info messages. */
export interface MarketplaceDetails {
  readonly autoupdate: boolean;
  readonly lastUpdatedAt?: string;
}

/** Usage-error input rendered with a message and usage block. */
export interface UsageErrorMessage {
  readonly message: string;
  readonly usage: string;
}

/** Closed Pi notification severity vocabulary. */
export type Severity = "info" | "warning" | "error";

/** Caller-stamped reduction fields shared by notification rows. */
export interface MessageBase {
  readonly severity?: Severity;
  readonly needsReload?: boolean;
}

/** Required reduction fields for realized transition rows. */
export interface TransitionMessageBase extends MessageBase {
  readonly severity: Severity;
  readonly needsReload: boolean;
}

/** Installed plugin row. */
export interface PluginInstalledMessage extends TransitionMessageBase {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  readonly description?: string;
}

/** Updated plugin row. */
export interface PluginUpdatedMessage extends TransitionMessageBase {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly dependencies: readonly Dependency[];
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
}

/** Reinstalled plugin row. */
export interface PluginReinstalledMessage extends TransitionMessageBase {
  readonly status: "reinstalled";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
}

/** Uninstalled plugin row. */
export interface PluginUninstalledMessage extends TransitionMessageBase {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}

/** Disabled plugin row. */
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
  readonly enableHint?: boolean;
}

/** Available plugin row. */
export interface PluginAvailableMessage extends MessageBase {
  readonly status: "available";
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
}

/** Remote plugin row. */
export interface PluginRemoteMessage extends MessageBase {
  readonly status: "remote";
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
}

/** Unavailable plugin row. */
export interface PluginUnavailableMessage extends MessageBase {
  readonly status: "unavailable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly description?: string;
  readonly partialHint?: boolean;
}

/** Partially available plugin row. */
export interface PluginPartiallyAvailableMessage extends MessageBase {
  readonly status: "partially-available";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly description?: string;
  readonly partialHint?: boolean;
}

/** Upgradable plugin row. */
export interface PluginUpgradableMessage extends MessageBase {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}

/** Partially installed plugin row. */
export interface PluginPartiallyInstalledMessage extends MessageBase {
  readonly status: "partially-installed";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly dependencies?: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}

/** Partially upgradable plugin row. */
export interface PluginPartiallyUpgradableMessage extends MessageBase {
  readonly status: "partially-upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly partialHint?: boolean;
}

/** Failed plugin row. */
export interface PluginFailedMessage extends MessageBase {
  readonly status: "failed";
  readonly severity: "error" | "warning";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly partialHint?: boolean;
  readonly cause?: Error;
  readonly rollbackPartial?: readonly {
    readonly phase: string;
    readonly cause?: Error;
  }[];
}

/** Skipped plugin row. */
export interface PluginSkippedMessage extends MessageBase {
  readonly status: "skipped";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/** Manual-recovery plugin row. */
export interface PluginManualRecoveryMessage extends MessageBase {
  readonly status: "manual recovery";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
}

/** Pending plugin-install row. */
export interface PluginWillInstallMessage extends MessageBase {
  readonly status: "will install";
  readonly name: string;
  readonly scope?: Scope;
  readonly partial?: boolean;
}

/** Pending plugin-uninstall row. */
export interface PluginWillUninstallMessage extends MessageBase {
  readonly status: "will uninstall";
  readonly name: string;
  readonly scope?: Scope;
}

/** Pending plugin-enable row. */
export interface PluginWillEnableMessage extends MessageBase {
  readonly status: "will enable";
  readonly name: string;
  readonly scope?: Scope;
}

/** Pending plugin-disable row. */
export interface PluginWillDisableMessage extends MessageBase {
  readonly status: "will disable";
  readonly name: string;
  readonly scope?: Scope;
}

/** Complete discriminated union of plugin notification rows. */
export type PluginNotificationMessage =
  | PluginInstalledMessage
  | PluginUpdatedMessage
  | PluginReinstalledMessage
  | PluginUninstalledMessage
  | PluginAvailableMessage
  | PluginRemoteMessage
  | PluginUnavailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUpgradableMessage
  | PluginFailedMessage
  | PluginSkippedMessage
  | PluginManualRecoveryMessage
  | PluginWillInstallMessage
  | PluginWillUninstallMessage
  | PluginWillEnableMessage
  | PluginWillDisableMessage
  | PluginDisabledMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage;

/** List statuses whose row type permits an explicit scope. */
export type ScopeBearingListStatus =
  "upgradable" | "installed" | "disabled" | "partially-installed" | "partially-upgradable";

const SCOPE_BEARING_LIST_STATUS: Record<PluginNotificationMessage["status"], boolean> = {
  upgradable: true,
  installed: true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  available: false,
  remote: false,
  unavailable: false,
  "partially-available": false,
  updated: false,
  reinstalled: false,
  uninstalled: false,
  failed: false,
  skipped: false,
  "manual recovery": false,
  "will install": false,
  "will uninstall": false,
  "will enable": false,
  "will disable": false,
};

/** Narrows a plugin row to the list variants that permit an explicit scope. */
export function isScopeBearingListRow(
  row: PluginNotificationMessage,
): row is Extract<PluginNotificationMessage, { status: ScopeBearingListStatus }> {
  return SCOPE_BEARING_LIST_STATUS[row.status];
}

/** Fields shared by every marketplace notification row. */
export interface MpCommon extends MessageBase {
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: readonly PluginNotificationMessage[];
}

/** Added marketplace row. */
export interface MpAdded extends MpCommon {
  readonly status: "added";
}

/** Removed marketplace row. */
export interface MpRemoved extends MpCommon {
  readonly status: "removed";
}

/** Updated marketplace row. */
export interface MpUpdated extends MpCommon {
  readonly status: "updated";
}

/** Failed marketplace row. */
export interface MpFailed extends MpCommon {
  readonly status: "failed";
  readonly severity: "error" | "warning";
  readonly reasons?: readonly ContentReason[];
}

/** Marketplace row for a newly enabled autoupdate setting. */
export interface MpAutoupdateEnabled extends MpCommon {
  readonly status: "autoupdate enabled";
}

/** Marketplace row for a newly disabled autoupdate setting. */
export interface MpAutoupdateDisabled extends MpCommon {
  readonly status: "autoupdate disabled";
}

/** Skipped marketplace row. */
export interface MpSkipped extends MpCommon {
  readonly status: "skipped";
  readonly reasons?: readonly ContentReason[];
}

/** Statusless marketplace inventory row. */
export interface MpList extends MpCommon {
  readonly status?: undefined;
  readonly details?: MarketplaceDetails;
}

/** Complete discriminated union of marketplace notification rows. */
export type MarketplaceNotificationMessage =
  | MpAdded
  | MpRemoved
  | MpUpdated
  | MpFailed
  | MpAutoupdateEnabled
  | MpAutoupdateDisabled
  | MpSkipped
  | MpList;

/** Standard marketplace/plugin notification cascade. */
export interface CascadeNotificationMessage {
  readonly kind?: "cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
  readonly tally?: { readonly verb: string; readonly count: number };
}

/** Marketplace information message. */
export interface MarketplaceInfoMessage {
  readonly kind: "marketplace-info";
  readonly name: string;
  readonly scope: Scope;
  readonly details: MarketplaceDetails;
  readonly source:
    | {
        readonly sourceKind: "github";
        readonly owner: string;
        readonly repo: string;
        readonly ref?: string;
      }
    | { readonly sourceKind: "url"; readonly url: string; readonly ref?: string }
    | { readonly sourceKind: "path"; readonly absPath: string };
  readonly description?: string;
}

/** Plugin information message. */
export interface PluginInfoMessage {
  readonly kind: "plugin-info";
  readonly marketplaceName: string;
  readonly marketplaceScope: Scope;
  readonly marketplaceDetails: MarketplaceDetails;
  readonly plugin: PluginInfoRow;
}

/** Resolved or unresolved plugin information row. */
export type PluginInfoRow =
  | (PluginInfoRowBase & PluginInfoComponentsResolved)
  | (PluginInfoRowBase & PluginInfoComponentsUnresolved);

/** Fields shared by both plugin information row arms. */
export interface PluginInfoRowBase {
  readonly status: Extract<
    PluginStatus,
    | "installed"
    | "available"
    | "remote"
    | "unavailable"
    | "partially-available"
    | "failed"
    | "partially-installed"
    | "disabled"
  >;
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
}

/** Component details for a resolved plugin information row. */
export interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly hooks?: readonly HookSummaryEntry[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];
}

/** Marker arm for plugin information whose components are not resolved. */
export interface PluginInfoComponentsUnresolved {
  readonly componentsResolved: false;
}

/** Non-empty marketplace information fan-out. */
export interface MarketplaceInfoCascadeMessage {
  readonly kind: "marketplace-info-cascade";
  readonly blocks: readonly [MarketplaceInfoMessage, ...MarketplaceInfoMessage[]];
}

/** Non-empty plugin information fan-out. */
export interface PluginInfoCascadeMessage {
  readonly kind: "plugin-info-cascade";
  readonly blocks: readonly [PluginInfoMessage, ...PluginInfoMessage[]];
}

/** Empty reconcile-pending advisory. */
export interface ReconcilePendingEmptyMessage {
  readonly kind: "reconcile-pending-empty";
}

/** Marketplace-absence failure message. */
export interface MarketplaceNotAddedMessage {
  readonly kind: "marketplace-not-added";
  readonly name: string;
  readonly scope?: Scope;
  readonly presentInOtherScope?: boolean;
}

/** Applied-reconcile notification cascade. */
export interface ReconcileAppliedCascadeMessage {
  readonly kind: "reconcile-applied-cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
}

/** Complete discriminated union accepted by the notification dispatcher. */
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage
  | MarketplaceInfoCascadeMessage
  | PluginInfoCascadeMessage
  | MarketplaceNotAddedMessage
  | ReconcilePendingEmptyMessage
  | ReconcileAppliedCascadeMessage;
