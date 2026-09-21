import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { Dependency } from "./concerns/soft-dep.ts";
import type { Scope } from "./types.ts";

/**
 * Closed notification reason vocabulary in canonical render order.
 *
 * Declared as a bare union rather than an `as const` tuple: nothing reads the
 * members at runtime, and a tuple that only ever feeds `(typeof X)[number]` is an
 * unreferenced runtime value. The declaration order is the catalog's order -- a
 * new token appends at the tail -- and `compat-01-no-expansion.test.ts` reads it
 * here, because a union carries membership and not order.
 */
export type Reason =
  | "up-to-date"
  | "not found"
  | "already installed"
  | "not installed"
  | "not in manifest"
  | "invalid manifest"
  | "no longer installable"
  | "unsupported source"
  | "unsupported component"
  | "unsupported hooks"
  | "lsp"
  | "requires pi-subagents"
  | "requires pi-mcp"
  | "rollback partial"
  | "unreadable"
  | "unparseable"
  | "unreadable manifest"
  | "source mismatch"
  | "plugins remain"
  | "concurrently uninstalled"
  | "concurrently updated"
  | "stale clone"
  | "duplicate name"
  | "lock held"
  | "already autoupdate"
  | "already no autoupdate"
  | "already enabled"
  | "already disabled"
  | "permission denied"
  | "source missing"
  | "network unreachable"
  | "marketplace not added"
  | "marketplace not added to user scope"
  | "marketplace not added to project scope"
  | "orphan rewake"
  | "authentication required"
  | "dangling reference"
  | "malformed mcp"
  | "malformed skill"
  | "malformed command"
  | "installs disabled"
  | "marketplace in user scope"
  | "marketplace in project scope"
  // WLIF-06: a workflow command the just-finished verb RETIRED -- its envelope
  // is off disk, but the host exposes no unregister call, so the command that
  // envelope registered stays live and runnable for the rest of the session.
  // Until a reload, the plugin's command surface and its artifacts disagree,
  // and this token is what says so. A CONTENT reason: its subject is the PLUGIN
  // the row is about, so it JOINS that row's other reasons rather than
  // replacing any of them, and stays inside `ContentReason`.
  //
  // It is NOT the `/reload to pick up changes` trailer, and the two deliberately
  // coexist on one row stating different facts. That trailer is about NEW things
  // a reload will pick up; this token is about a REMOVED thing a reload will
  // drop. Reusing the trailer would report the second as if it were the first.
  //
  // It stays OFF the exported enable/disable outcome union, which is what
  // structurally prevents the load-time reconcile projection from stamping it: a
  // reload is what CLEARS this condition, so a row rendered from the reload path
  // claiming the remedy would contradict itself. The four user-typed retiring
  // verbs (uninstall / disable / reinstall / update) own it on their own rows;
  // `enable` reaches it through a module-private outcome sentinel instead.
  | "stale workflow command"
  // WDEP-04: the plugin staged at least one workflow, and the host workflow
  // engine `@quintinshaw/pi-dynamic-workflows` is not loaded in this session.
  // The third soft-dep marker, appended by `softDepMarkers` after the agents
  // and mcp markers; it is never caller-placed into `reasons[]`.
  //
  // The `dynamic` is load-bearing: the unscoped short form is the npm name of
  // `@nicknisi/pi-workflows`, a DIFFERENT engine, so dropping it would name the
  // wrong package to install.
  //
  // WDEP-02 / WDEP-03: the envelopes are written whether or not the engine is
  // loaded, so this token reports that nothing runs them YET -- not that the
  // install fell short. Installing the engine and reloading is enough; no
  // reinstall is needed.
  | "requires pi-dynamic-workflows"
  // WCONV-03: the load-time convergence marker. The extension now supports
  // components this plugin declares, which is why the record was re-materialized
  // on a reload the user did not initiate. Caller-placed by the reconcile
  // backfill projection (`orchestrators/reconcile/notify.ts`), never derived by
  // the renderer.
  //
  // It names no component kind on purpose: the load-time scan promotes ANY
  // record whose supported set strictly grew, so a token reading "workflows
  // arrived" would be a false statement about most of the rows it rides.
  | "components now supported";

/** Reasons that describe a content row rather than marketplace absence. */
export type ContentReason = Exclude<
  Reason,
  | "marketplace not added"
  | "marketplace not added to user scope"
  | "marketplace not added to project scope"
>;

/**
 * Closed notification status vocabulary in canonical render order.
 * A bare union for the reason given on `Reason`.
 */
export type StatusToken =
  | "installed"
  | "updated"
  | "reinstalled"
  | "uninstalled"
  | "added"
  | "removed"
  | "available"
  | "unavailable"
  | "upgradable"
  | "skipped"
  | "failed"
  | "rollback failed"
  | "manual recovery"
  | "no marketplaces"
  | "no plugins"
  | "will install"
  | "will uninstall"
  | "will enable"
  | "will disable"
  | "disabled"
  | "partially-installed"
  | "partially-upgradable"
  | "partially-available"
  | "remote";

/**
 * Closed plugin status vocabulary in canonical render order.
 * A bare union for the reason given on `Reason`.
 */
export type PluginStatus =
  | "installed"
  | "updated"
  | "reinstalled"
  | "uninstalled"
  | "available"
  | "unavailable"
  | "upgradable"
  | "failed"
  | "skipped"
  | "manual recovery"
  | "will install"
  | "will uninstall"
  | "will enable"
  | "will disable"
  | "disabled"
  | "partially-installed"
  | "partially-upgradable"
  | "partially-available"
  | "remote";

/**
 * Closed marketplace status vocabulary in canonical render order.
 * A bare union for the reason given on `Reason`.
 */
export type MarketplaceStatus =
  | "added"
  | "removed"
  | "updated"
  | "failed"
  | "autoupdate enabled"
  | "autoupdate disabled"
  | "skipped";

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
  /**
   * WLIF-06: `reasons` is OPTIONAL here on the same terms it is optional on
   * `PluginInstalledMessage` / `PluginUpdatedMessage` / `PluginReinstalledMessage`
   * / `PluginDisabledMessage`. It admits the `stale workflow command` token --
   * the removal took a workflow envelope off disk, and the command that envelope
   * registered stays live until a reload.
   *
   * That is the only fact a realized removal has left to state. Absent `reasons`
   * renders the legacy brace-less row byte-for-byte: `composeReasons` returns
   * `""` for an undefined list and `joinTokens` collapses the empty slot.
   *
   * MSG-SD-3 is untouched -- the render arm still passes all three
   * soft-dependency arguments hard-coded `false`, so an `(uninstalled)` row
   * cannot emit `{requires pi-subagents}` / `{requires pi-mcp}` /
   * `{requires pi-dynamic-workflows}` whatever the removed record declared.
   */
  readonly reasons?: readonly ContentReason[];
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

/**
 * Read `row.scope` defensively from the PluginNotificationMessage union.
 * The `available` / `unavailable` variants OMIT the `scope` field by
 * construction (SNM-11); the other list-surface variants carry an OPTIONAL
 * `scope` that is present only when the plugin's install scope differs
 * from the marketplace block's scope (orphan-fold rule, D-13-18). When
 * absent, fall back to the marketplace scope so the structured tool
 * surface always carries a stable `scope` field for the agent.
 *
 * For `installed` / `upgradable` the `scope` field exists structurally;
 * for `available` / `unavailable` it does not -- `isScopeBearingListRow`
 * narrows the variants appropriately.
 */
export function pluginScopeOrFallback(
  row: PluginNotificationMessage,
  marketplaceScope: Scope,
): Scope {
  return isScopeBearingListRow(row) ? (row.scope ?? marketplaceScope) : marketplaceScope;
}

/**
 * Read `row.version` off a plugin notification row. D-15-04: every list-surface
 * variant carries the same optional `version?` slot, so every arm returns the
 * same field and the switch computes nothing.
 *
 * D-116-14: the switch stays anyway, and must not be collapsed into a single
 * expression. Its job is the missing-arm gate -- `noImplicitReturns` makes the
 * end of this function reachable the moment a list-surface status goes unnamed,
 * so a status added to the row union is a compile error here rather than a row
 * that silently loses its version.
 */
export function pluginVersion(row: PluginNotificationMessage): string | undefined {
  switch (row.status) {
    case "installed":
    case "reinstalled":
    case "uninstalled":
    case "disabled":
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
    case "failed":
    case "skipped":
      return row.version;
    case "updated":
      return row.to;
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      return undefined;
  }
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
  /**
   * WR-06: free-text advisory body lines, rendered after the cascade body and
   * before the tally. Supplied ALREADY ORDERED by the caller and rendered
   * verbatim -- these are not rows and carry no closed-set token, so nothing
   * here is sorted, severity-mapped or reason-narrowed on the way out. The
   * pending-empty variant declares the same member and the same render site
   * composes both, which is what keeps the two arms of a command that can emit
   * either one byte-identical.
   */
  readonly advisories?: readonly string[];
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
  /**
   * WR-09: free-text advisory lines about individual component FILES, rendered
   * one per entry after the component block.
   *
   * NOT a closed-set reason, and never carries one. A `ContentReason` is a
   * token about the plugin as a whole and rides the row's brace; each of these
   * sentences is about one file inside it and states what WOULD happen to that
   * file. A row carrying them is still an ordinary successful read, so the
   * severity is unchanged.
   *
   * PRECONDITION: the composer supplies these already ordered and already
   * reduced. An absolute path inside one of them would disclose the resolved
   * home directory (NFR-9) AND make the row's bytes vary by machine, so the
   * composition site maps every entry through `redactAbsolutePaths`; the
   * renderer does neither on its behalf.
   */
  readonly notes?: readonly string[];
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
    /**
     * WFLW-04: carries the generated `<plugin>:<name>` of every ADMITTED
     * script -- both the named arm and the stem-fallback arm, because an
     * envelope is written for both and listing only the named arm would make
     * this surface disagree with what install puts on disk.
     */
    readonly workflows?: readonly string[];
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
  // WR-06: the same free-text advisory body lines the cascade arm declares, on
  // the same terms -- caller-ordered, rendered verbatim, no token, no row. The
  // steady-state user is the one most likely to be carrying a retained staging
  // tree, so an advisory the cascade arm alone could carry would miss exactly
  // the reader it exists for.
  readonly advisories?: readonly string[];
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
