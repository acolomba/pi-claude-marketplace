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
  | "workflows"
  // DATA-01 / WR-06: the uninstall row's disposition marker. Uninstall destroys
  // the plugin's data directory by default, and without a marker the two
  // dispositions render the same row: the operator who typed `--keep-data`
  // needs confirmation it took effect, and the one who omitted it needs to know
  // a data tree was destroyed. The token rides the PRESERVING branch, which
  // keeps the default row byte-frozen (D-02-01) while making the two branches
  // distinguishable.
  | "data kept"
  // RESV-03: the dependency's source advertises no release tag inside the
  // effective constraint. The outcome the operator can act on, kept separate
  // from the transport failures (`network unreachable` / `authentication
  // required`), which say the listing could not be READ rather than that it
  // held nothing usable.
  | "no matching version"
  // RESV-03 / RESV-05: the effective constraint cannot be satisfied. One token
  // over two rows -- declarations that contradict each other, and a copy
  // already on disk that falls outside them. The already-installed row joins
  // `already installed` in the same brace and carries its recorded version, so
  // the two subjects stay distinguishable without a second token.
  | "version conflict"
  // RESV-03: the declared constraints pass one of the two combination size
  // caps. The input is well formed and it is the COMBINATION that is refused,
  // so `invalid version constraint` would misattribute it.
  | "constraint too complex"
  // RESV-03: a declared constraint is not a version range the evaluator can
  // read. Distinct from `unparseable`, whose subject is a whole document rather
  // than one field of one declaration.
  | "invalid version constraint"
  // RESV-02 / D-03-08: the dependency names a marketplace the target scope has
  // not added. A CONTENT reason, on the `marketplace in user scope` precedent:
  // its subject is the dependency row it rides, which is why the three
  // structural `marketplace not added*` markers -- whose subject is a
  // standalone marketplace row -- cannot carry it.
  | "dependency marketplace not added"
  // RESV-04: the dependency graph closes on itself. Every inherited token names
  // a property of ONE plugin; a cycle is a property of the path between
  // several, which the row's cause line spells out in walk order.
  | "dependency cycle"
  // RESV-06: stamped on the requesting plugin's own row when what failed was
  // one of its dependencies. Without it that row -- the one the user's command
  // produced -- reads as an unexplained failure beside the dependency row that
  // carries the real cause.
  | "dependency failed"
  // RESV-05: the dependency the cascade left alone is RECORDED but disabled, so
  // it materialized nothing on disk. `already installed` alone is true and
  // misleading together -- it reads as the benign idempotent skip, and the
  // requesting plugin installs against a dependency whose artifacts are not
  // there. This token is what raises that row off info and names the one thing
  // the user can act on. Enablement is never decided on a dependency's behalf
  // (see `docs/plugin-enablement.md`), so reporting it is the whole remedy.
  | "dependency disabled"
  // D-04-07: the plugin the user just named was already recorded, as another
  // plugin's dependency, and this command promoted that record to a direct
  // install. `already installed` alone reports a REFUSAL -- the command did
  // nothing -- and this row reports a state change, so the two cannot share a
  // brace without one of them lying. It rides an `installed` row beside
  // `already installed`: the desired state is reached, nothing was
  // materialized, and the pair says which of those two facts this command
  // is responsible for.
  | "dependency promoted"
  // D-05-11 / PRUNE-04: the plugin was recorded as another plugin's
  // dependency, nothing installed declares it any more, and `uninstall
  // --prune` removed it. It rides an ordinary `uninstalled` row because the
  // operation IS an uninstall; the brace says why this plugin, which the user
  // did not name, went. Under `--keep-data` it precedes `data kept` (D-05-09).
  | "dependency pruned"
  // LOAD-01: the load-time check disabled this recorded plugin, because a
  // dependency it declares is not satisfied in the same scope. It mirrors
  // upstream's `dependency-unsatisfied` error code, so the token names the
  // CONDITION and the remedy naming both parties rides the row's cause line --
  // the same split `dependency cycle` established, and the only one available:
  // a reason is one to three lowercase words and this set is a literal tuple,
  // so no token can interpolate an identifier. `dependency disabled` cannot
  // carry it: that token's subject is the DEPENDENCY row inside an install
  // cascade, reporting a dependency the cascade declined to install, where this
  // token's subject is the DEPENDENT the load-time check just disabled. Same
  // words, different subject, different surface -- one token for both would
  // make a grep for either fact return the other.
  | "dependency unsatisfied"
  // LOAD-01: the same load-time check, on the arm where the dependency IS
  // recorded and enabled but its recorded version falls outside the declared
  // range. It mirrors upstream's second error code,
  // `dependency-version-unsatisfied`, so the pair of tokens tracks the pair of
  // upstream codes. `dependency unsatisfied` cannot carry this case: the two
  // remedies differ in kind -- one says install or enable the missing thing,
  // the other says move an existing thing's version -- and a reader who greps
  // one token must not be shown the other's situation. As with its neighbour
  // the token names the CONDITION and the remedy, which interpolates both the
  // dependency and the range, rides the row's cause line.
  | "dependency version unsatisfied"
  // LOAD-03 / D-06-06: the plugin the command just removed was still declared
  // as a dependency by other installed plugins in the same scope. The removal
  // WENT THROUGH -- that is upstream's behaviour, and it is what breaks the
  // deadlock two plugins declaring each other would otherwise create -- so the
  // token rides the SUCCESS row and states the consequence rather than a
  // refusal: each dependent named beside it becomes unsatisfied at the next
  // load, where the check disables it and names the remedy. `dependency
  // unsatisfied` cannot carry this: that token's subject is the DEPENDENT the
  // check just disabled, and this one's subject is the DEPENDENCY that just
  // left, reported on the row of the command that removed it. The dependent
  // keys ride the row's cause line rather than the token, on the `dependency
  // cycle` precedent -- a token names one fact about one plugin, and the list
  // of who needed it is a fact about several.
  | "dependents unsatisfied"
  // TAGS-02 / D-07-03: no marketplace tag satisfied a path-source dependency's
  // constraint, so the marketplace's CURRENT copy installed instead of
  // failing. It rides an `installed` row -- the install succeeded -- and is
  // neither idempotent (a copy installed) nor a failure reason. The
  // constraint itself is left for the LOAD-01 load-time check to enforce.
  | "dependency current copy"
  // D-08-02: install or enable turned on an already-installed, disabled
  // dependency through its record. It rides an `installed` row beside
  // `already installed` on the install cascade's already-installed arm, and
  // alone on the enable cascade's own re-materialized member row -- the
  // state changed and nothing was refused, so a plain `already installed`
  // (which reports a no-op) cannot carry it. Retires the
  // `{already installed, dependency disabled}` skip this token replaces.
  | "dependency enabled";

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

/**
 * Uninstalled plugin row.
 *
 * WR-06: `reasons` carries the data disposition (`data kept`) and nothing else
 * today. The field is optional, so every producer that has nothing to report --
 * `marketplace remove`'s per-plugin rows, the default uninstall -- composes the
 * brace-less row.
 */
export interface PluginUninstalledMessage extends TransitionMessageBase {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  /**
   * LOAD-03: the `name@marketplace` keys of the plugins that still declared
   * the removed plugin, on the `PluginDisabledMessage.cause` precedent. It is
   * the ONE thing this field carries: the plain uninstall, the `--prune`
   * member rows and the reconcile-driven removal all omit it and keep their
   * byte-frozen rows.
   *
   * It rides the cause chain because the sentence interpolates plugin
   * identifiers, and the cause chain is the only channel in this grammar that
   * legally interpolates one.
   */
  readonly cause?: Error;
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
  /**
   * LOAD-01: the load-time dependency disable's remedy, naming the dependency
   * and the dependent. It is the ONE thing this field carries: the ordinary
   * toggle disable and the install-disabled cascade both omit it, and their
   * rows stay byte-frozen.
   *
   * It rides the cause chain because the sentence interpolates two plugin
   * identifiers, and the cause chain is the only channel in this grammar that
   * legally interpolates one -- every frozen trailer constant interpolates
   * nothing by contract.
   */
  readonly cause?: Error;
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

/**
 * Component details sorted alphabetically, with dependencies pre-rendered as
 * plugin addresses and optional version/SHA constraints, sorted by dependency name.
 */
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

/**
 * Marker arm for plugin information whose components are not resolved.
 *
 * `dependencies` is the pre-rendered, name-sorted list the cold git-source
 * `(remote)` row carries from its marketplace entry (D-01-32): the plugin's
 * own `plugin.json` is not readable without a fetch and NFR-5 forbids one.
 * The renderer emits it after the `components: not resolved` marker.
 */
export interface PluginInfoComponentsUnresolved {
  readonly componentsResolved: false;
  readonly dependencies?: readonly string[];
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
