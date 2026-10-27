import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { CompanionRequirement, Dependency } from "./concerns/soft-dep.ts";
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
  | "requires pi-mcp-adapter"
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
  // so no token can interpolate an identifier. Its subject is the DEPENDENT
  // the load-time check just disabled, never the dependency an install cascade
  // row is about. `enable` reuses it on the failed row of the plugin it refused
  // to enable because a dependency is not installed, upstream's
  // `dependency_missing`: the subject is again the dependent.
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
  // (which reports a no-op) cannot carry it.
  | "dependency enabled"
  // EDEP-02: disable refuses while an installed and ENABLED plugin in the
  // same scope still declares the target, and the refusal rides a `failed`
  // row. `dependents unsatisfied` cannot carry it: that token's subject is a
  // removal that WENT THROUGH on a SUCCESS row, and this one's subject is an
  // operation that was NOT carried out. The dependent keys ride the row's
  // cause line, on the `dependency cycle` precedent, never the token.
  | "dependents remain"
  // MISS-01 / D-09-09: the reload's dependency-install step materialized a
  // plugin the user never named, to satisfy a declaration. It rides an
  // `installed` row alone, because a bare `(installed)` for an undeclared
  // plugin is the row a user cannot explain, and it is neither idempotent
  // nor a failure.
  | "dependency installed"
  // UPDT-02 / D-10-09 / D-10-10: the update-preflight constraint gate held
  // this plugin to versions its installed dependents jointly admit, and none
  // exists. Three situations fold onto this one token -- disjoint declared
  // ranges, no tag satisfying the intersection, and a fetched version
  // outside it -- and the cause line says which one applies and names the
  // constraining plugins. `version conflict` cannot carry it: nothing here
  // contradicts anything. `no matching version` cannot carry it either: that
  // token claims the source advertised no tag in range, which is false on
  // the arm where a version WAS found and falls outside what the
  // dependents allow.
  | "dependents constrain"
  // D-11-06: the root marketplace disallows a new cross-marketplace edge.
  // The cause names the policy root and both available remedies.
  | "cross-marketplace"
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
  | "components now supported"
  // ANAME-07: a server of the plugin uses a Claude Code MCP feature
  // pi-mcp-adapter cannot honor, so `--partial` leaves that server out whole.
  // A typed kind, not a note, as `unsupported hooks` is: the aggregate token
  // rides the row, and each server with its blocking feature rides the info
  // breakdown.
  | "unsupported mcp"
  // FIX-03 / D-MF-02: the command would write a plugin declaration into the
  // base layer while only the local layer declares the plugin's marketplace,
  // so a teammate who reads the base config could not resolve it. The refusal
  // rides a `failed` row, and the remedy, running the command again with
  // `--local`, rides the cause line. `dangling reference` cannot carry it:
  // there the merged configuration lacks the marketplace, and here it declares
  // it, in the per-machine local layer only.
  | "marketplace in local layer only"
  // LAYER-02 / D-MF-03: a command run with `--local` names a marketplace that
  // only the base layer declares. The refusal rides a `failed` row, and the
  // remedy, running the command again without `--local`, rides the cause line.
  | "marketplace in base layer only"
  // LAYER-04 / D-MF-03: a named plugin command without `--local` targets the
  // base layer, and only the local layer declares the plugin. The refusal
  // rides a `failed` row, and the remedy, running the command again with
  // `--local`, rides the cause line.
  | "plugin in local layer only"
  // LAYER-04 / D-MF-03: the mirror refusal: a named plugin command with
  // `--local` targets the local layer, and only the base layer declares the
  // plugin. The remedy, running the command again without `--local`, rides the
  // cause line.
  | "plugin in base layer only"
  // LAYER-05 / D-MF-03: an install into one layer of a plugin the other layer
  // declares and the scope already installed. The install adds the declaration
  // to the target layer and installs nothing; the token names the other layer.
  | "already installed in base layer"
  | "already installed in local layer"
  // LAYER-05 / D-MF-03: an uninstall from one layer of a plugin the other layer
  // still declares. The uninstall drops the target layer's declaration and
  // uninstalls nothing; the token names the other layer, and the remedy rides
  // the cause line.
  | "still installed in base layer"
  | "still installed in local layer"
  // LAYER-04 / D-MF-03: an enable or disable without `--local` targets the
  // base layer, and the local layer sets `enabled` to the opposite value.
  // The local value wins the field merge, so the write would be undone at the
  // next load. The refusal rides a `failed` row, and the remedy, running the
  // command again with `--local`, rides the cause line.
  | "disabled in local layer"
  | "enabled in local layer"
  // UPD-11 / ADD-10: the git host answered a marketplace refresh or add clone
  // with an HTTP status other than the 401/403 auth challenge (and, for add,
  // the 404/410 `source missing` answers), so the host was reached and it
  // refused. `network unreachable` stays for connection failures. A token
  // cannot interpolate, so the status and the URL ride the row's cause line.
  | "network error"
  // IMP-06: import found a settings marketplace the scope already records
  // with the same source, so nothing changed. Claude Code's own `marketplace
  // add` says "already added; nothing changed" for this case. It rides a
  // `skipped` marketplace header and is idempotent, so the cascade stays info.
  | "already added";

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
  | "will update"
  | "will add"
  | "will remove"
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
  | "will update"
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
  | "skipped"
  | "will add"
  | "will remove";

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

/**
 * UPR-02: the commit on each side of a move whose version did not change. Both
 * are full commit shas; the text form shortens each to 7 hex characters and
 * the wire carries them whole. Both sides travel together or the whole
 * sub-object is absent, so no row can draw a half-annotated arrow.
 */
export interface VersionCommits {
  readonly from: string;
  readonly to: string;
}

/** Updated plugin row. */
export interface PluginUpdatedMessage extends TransitionMessageBase {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  /** UPR-02: present only when the producer decided the arrow names commits. */
  readonly commits?: VersionCommits;
  readonly dependencies: readonly Dependency[];
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  /**
   * D-10-13 / D-10-17a: the constraint gate's disclosure, when a dependent's
   * range chose what landed. It rides the cause chain because the sentence
   * interpolates plugin identifiers, and the cause chain is the only channel
   * in this grammar that legally interpolates one, as on the held `skipped`
   * row. An unconstrained update omits it.
   */
  readonly cause?: Error;
}

/**
 * UPR-03: the move a `reinstalled`, `partially-installed`, or `failed` row
 * can show. `version` keeps its meaning on those rows (the version installed
 * or attempted); `from` is the version the move started at, present only when
 * the producer knows both sides and the revision moved, and `commits` follows
 * the `updated` row's rule (UPR-02).
 */
export interface RevisionMoveFields {
  readonly from?: string;
  readonly commits?: VersionCommits;
}

/** Reinstalled plugin row. */
export interface PluginReinstalledMessage extends TransitionMessageBase, RevisionMoveFields {
  readonly status: "reinstalled";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  /** D-10-13 / D-18-07: the constraint gate's disclosure, as on `PluginUpdatedMessage`. */
  readonly cause?: Error;
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
   * MSG-SD-3: every marker policy maps `uninstalled` to off (D-12), so an
   * `(uninstalled)` row cannot emit `{requires pi-subagents}` /
   * `{requires pi-mcp-adapter}` /
   * `{requires pi-dynamic-workflows}` whatever the removed record declared.
   */
  readonly reasons?: readonly ContentReason[];
  /**
   * LOAD-03: the `name@marketplace` keys of the plugins that still declared
   * the removed plugin, on the `PluginDisabledMessage.cause` precedent.
   * Standalone prune also uses this slot on a committed member when that
   * member's post-commit cleanup fails.
   * Other uninstall rows omit it.
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
export interface PluginPartiallyInstalledMessage extends MessageBase, RevisionMoveFields {
  readonly status: "partially-installed";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly dependencies?: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  /** D-10-13: the constraint gate's disclosure on a partial update, as on `PluginUpdatedMessage`. */
  readonly cause?: Error;
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
  /**
   * D-24: the catalog decline's hint, set only by the convergence planner's
   * row in `pending`, the load and `apply`. It names the per-plugin `update
   * --partial` command, because the command that holds the row takes no
   * `--partial`. A producer never sets both this and `partialHint`.
   */
  readonly catalogHint?: boolean;
}

/** Failed plugin row. */
export interface PluginFailedMessage extends MessageBase, RevisionMoveFields {
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
  /**
   * ADD-10 / D-PL5-12: the row's subject is a marketplace (or the source a
   * failed `marketplace add` was typed with), not a plugin, as in a failed
   * `marketplace add`, `info`, `remove`, `update`, or autoupdate, so its JSON
   * id is its name alone.
   */
  readonly marketplaceSubject?: true;
}

/** Skipped plugin row. */
export interface PluginSkippedMessage extends MessageBase {
  readonly status: "skipped";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * A `skipped` row that carries a cause trailer: update's, and reinstall's,
 * which runs the same constraint gate (D-18-07). Uninstall's
 * `PluginUninstallSkippedMessage` is the other one.
 *
 * UPDT-02 / D-10-11: the held-update remedy names the constraining plugins
 * and marks which of them are currently disabled, and D-10-13's ceiling
 * disclosure names the range and its holders. Both interpolate plugin
 * identifiers, and the cause chain is the only channel in this grammar that
 * legally interpolates one -- every frozen trailer constant interpolates
 * nothing by contract.
 *
 * The slot lives on this variant rather than on `PluginSkippedMessage`, so a
 * row literal typed as the base -- every non-update surface's own `*Msg`
 * union -- is an excess-property error when it sets `cause`. That is the
 * whole of the guard. The dispatcher union `PluginNotificationMessage` names
 * this variant too, so a producer that composes its rows at the dispatcher
 * type sets `cause` on a `skipped` row and compiles; the catalog fixtures
 * compose at that type and do exactly this. No production surface composes
 * rows at the dispatcher type today.
 */
export interface PluginUpdateSkippedMessage extends PluginSkippedMessage {
  readonly cause?: Error;
}

/**
 * LAYER-05: uninstall's `skipped` row, for a plugin the other layer still
 * declares. The cause line carries the remedy: run the command again with or
 * without `--local`. It is a sibling of `PluginUpdateSkippedMessage` for the
 * same reason that variant exists: the base row has no cause slot.
 */
export interface PluginUninstallSkippedMessage extends PluginSkippedMessage {
  readonly cause?: Error;
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
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
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

/**
 * D-14: the pending-tense catalog move -- a recorded plugin whose catalog
 * candidate differs from its record (D-10). It renders with the `updated`
 * row's `v<from> → v<to>` arrow; a growth-only move has equal versions
 * (D-18-11), and `commits` follows the `updated` row's rule (UPR-02).
 */
export interface PluginWillUpdateMessage extends MessageBase {
  readonly status: "will update";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly commits?: VersionCommits;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
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
  | PluginUpdateSkippedMessage
  | PluginUninstallSkippedMessage
  | PluginManualRecoveryMessage
  | PluginWillInstallMessage
  | PluginWillUninstallMessage
  | PluginWillEnableMessage
  | PluginWillDisableMessage
  | PluginWillUpdateMessage
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
  "will update": false,
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
 * D-14: the pending-tense plugin statuses, as a TOTAL map over the status
 * union. A switch that names all twenty statuses exceeds the cyclomatic
 * ceiling, so the exhaustive switches over the union split at this partition:
 * a new status is a compile error here until it is placed, and then a compile
 * error in the half of each split switch it joins.
 */
const PENDING_PLUGIN_STATUS = {
  "will install": true,
  "will uninstall": true,
  "will enable": true,
  "will disable": true,
  "will update": true,
  installed: false,
  updated: false,
  reinstalled: false,
  uninstalled: false,
  available: false,
  unavailable: false,
  upgradable: false,
  failed: false,
  skipped: false,
  "manual recovery": false,
  disabled: false,
  "partially-installed": false,
  "partially-upgradable": false,
  "partially-available": false,
  remote: false,
} as const satisfies Record<PluginNotificationMessage["status"], boolean>;

/** The statuses the map above marks pending, read back off that map. */
export type PendingPluginStatus = {
  [K in PluginNotificationMessage["status"]]: (typeof PENDING_PLUGIN_STATUS)[K] extends true
    ? K
    : never;
}[PluginNotificationMessage["status"]];

/** Narrows a plugin row to the pending-tense variants. */
export function isPendingPluginRow<R extends { readonly status: PluginStatus }>(
  row: R,
): row is Extract<R, { readonly status: PendingPluginStatus }> {
  return PENDING_PLUGIN_STATUS[row.status];
}

/**
 * Read `row.version` off a plugin notification row. D-15-04: every list-surface
 * variant carries the same optional `version?` slot, so most arms return the
 * same field.
 *
 * D-116-14: the switches stay anyway, and must not be collapsed into a single
 * expression. Their job is the missing-arm gate -- `noImplicitReturns` makes the
 * end of a half reachable the moment a status goes unnamed, so a status added
 * to the row union is a compile error here rather than a row that silently
 * loses its version.
 */
export function pluginVersion(row: PluginNotificationMessage): string | undefined {
  return isPendingPluginRow(row) ? pendingRowVersion(row) : settledRowVersion(row);
}

function pendingRowVersion(
  row: Extract<PluginNotificationMessage, { readonly status: PendingPluginStatus }>,
): string | undefined {
  switch (row.status) {
    case "will uninstall":
      return row.version;
    case "will update":
      return row.to;
    case "will install":
    case "will enable":
    case "will disable":
      return undefined;
  }
}

function settledRowVersion(
  row: Exclude<PluginNotificationMessage, { readonly status: PendingPluginStatus }>,
): string | undefined {
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

/**
 * D-20: pending-tense header for a marketplace a config declares and the scope
 * has not added, which `apply` will add.
 */
export interface MpWillAdd extends MpCommon {
  readonly status: "will add";
}

/**
 * D-20: pending-tense header for a recorded marketplace no config declares,
 * which `apply` will remove together with its plugins.
 */
export interface MpWillRemove extends MpCommon {
  readonly status: "will remove";
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
  | MpWillAdd
  | MpWillRemove
  | MpList;

/**
 * WR-01 / D-10: the marketplace-row shape `notifyWithContext` accepts, with its
 * `plugins` slot narrowed to the command's OWN `Msg`. This DISTRIBUTES over the
 * real `MarketplaceNotificationMessage` union (one mapped member per arm),
 * preserving each arm's per-status constraints (e.g. `MpFailed`'s REQUIRED
 * `severity: "error" | "warning"`, `MpSkipped`'s reachable `reasons?`, `MpList`'s
 * reachable `details?`), and replaces ONLY the `plugins` child slot with the
 * command's `Msg`. Because it is built FROM the union, assigning a value of this
 * type back to `readonly MarketplaceNotificationMessage[]` is a genuine
 * assignability relationship -- the `notifyWithContext` widening seam is a single
 * safe upcast, not an `as unknown as` reinterpretation, so a status drift between
 * a producer and the context's row policies surfaces as a compile error at the
 * producer.
 *
 * Combined with the `Msg extends { status: Status }` bound on
 * `notifyWithContext`, a call site that pushes a plugin row whose `status` the
 * context's row policies do not declare is a compile error at the call site --
 * the design's stated exhaustiveness guarantee in BOTH directions (row policies
 * total over `Status`, AND rows carry only `Status`).
 */
export type WithPlugins<MP, Msg> = MP extends unknown
  ? Omit<MP, "plugins"> & { readonly plugins: readonly Msg[] }
  : never;

/** A retained workflow staging basename and its observed envelope count. */
export interface RetainedWorkflowStaging {
  readonly name: string;
  readonly envelopeCount?: number;
}

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
  readonly retainedWorkflows?: readonly RetainedWorkflowStaging[];
  /**
   * APL-04 / D-14: set only by the `pending` composer, when its list holds a
   * change `/claude:plugin apply` would make. It selects the apply trailer.
   */
  readonly needsApply?: true;
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
  readonly allowedMarketplaces?: readonly string[];
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
  /**
   * ADD-10 / D-PL5-12: the row's subject is a marketplace (or the source a
   * failed `marketplace add` was typed with), not a plugin, as in a failed
   * `marketplace add`, `info`, `remove`, `update`, or autoupdate, so its JSON
   * id is its name alone.
   */
  readonly marketplaceSubject?: true;
}

/**
 * ASTAT-01 / ASTAT-02: the states info shows for a plugin MCP server. The
 * first seven are Claude Code's words for pi-mcp-adapter's seven statuses.
 * `failed` stays apart from `not connected` because the adapter separates a
 * failure backoff from a server it never discovered. The cached state uses a
 * comma because it sits inside the server's parentheses. `status unknown`
 * means there is no usable snapshot, or the snapshot holds a status this
 * release does not know. `not loaded` means a usable snapshot does not list
 * the server. `overridden by project scope` covers the same plugin installed
 * in both scopes: both scopes' adapter files hold one key, pi-mcp-adapter
 * loads the project file last and runs the project entry, so the user row's
 * server reads this token. The wording follows Claude Code's "overridden by".
 * A bare literal union like the other closed sets, not a `StatusToken`.
 */
export type McpServerStatus =
  | "connected"
  | "cached, connects on first use"
  | "needs authentication"
  | "pending approval"
  | "disabled"
  | "not connected"
  | "failed"
  | "status unknown"
  | "not loaded"
  | "overridden by project scope";

/**
 * ANAME-01 / ANAME-07: one plugin MCP server on the info surface, stamped by
 * the info command. `name` is the name Claude Code gives the server,
 * `plugin:<plugin>:<server>`. `unsupportedFeature` is present only on a server
 * a partial install leaves out, and names the Claude feature that blocks it.
 *
 * AVAR-04 / AVAR-05: `unsetVariables` and `withheldVariables` are present only
 * on a server the plugin writes, and only when non-empty. The info command
 * computes them from the current environment. They hold variable names, never
 * values.
 *
 * ASTAT-01: `status` is present only on a server an installed or partially
 * installed record lists as written. The info command stamps it from
 * pi-mcp-adapter's last snapshot.
 */
export interface McpServerSummaryEntry {
  readonly name: string;
  readonly unsupportedFeature?: string;
  readonly unsetVariables?: readonly string[];
  readonly withheldVariables?: readonly string[];
  readonly status?: McpServerStatus;
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
    readonly mcp?: readonly McpServerSummaryEntry[];
    readonly skills?: readonly string[];
    /**
     * WFLW-04: carries the generated `<plugin>:<name>` of every ADMITTED
     * script -- the one arm an envelope is written for, so this surface
     * agrees with what install puts on disk.
     */
    readonly workflows?: readonly string[];
  };
  /**
   * ADET-01: the companions the resolved components need, pre-sorted by the
   * composer on the companion name. Each entry is tagged missing per the probe
   * snapshot the orchestrator took. Absent when no companion is needed.
   */
  readonly requires?: readonly CompanionRequirement[];
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
  /**
   * D-08 / D-14: the command that found nothing to change. The text strategy
   * reads it to pick the wording; the JSON payload does not carry it, because
   * `origin.commandId` already names the command.
   */
  readonly command: "pending" | "apply";
  /**
   * WR-06: the same free-text advisory body lines the cascade arm declares, on
   * the same terms -- caller-ordered, rendered verbatim, no token, no row. The
   * steady-state user is the one most likely to be carrying a retained staging
   * tree, so an advisory the cascade arm alone could carry would miss exactly
   * the reader it exists for.
   */
  readonly advisories?: readonly string[];
  readonly retainedWorkflows?: readonly RetainedWorkflowStaging[];
}

/** Scoped informational result for a standalone orphan sweep. */
export interface PruneEmptyMessage {
  readonly kind: "prune-empty";
  readonly scope: Scope;
}

/** Scope-wide warning after a standalone prune state save succeeded. */
export interface PruneCommittedWarningMessage {
  readonly kind: "prune-committed-warning";
  readonly scope: Scope;
  readonly cause: Error;
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
  | PruneEmptyMessage
  | PruneCommittedWarningMessage
  | ReconcileAppliedCascadeMessage;

/**
 * AFILE-04 / AFILE-02: one fact about an MCP config file that a command
 * rewrote or left alone. The MCP bridge reports it and the orchestrator
 * routes it to `notifyMcpConfigNotices` after its own row.
 */
export interface McpConfigFileNotice {
  readonly kind: "comments-dropped" | "left-unchanged";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json" | "mcp.json";
}

/**
 * AFILE-06: a stage replaced a user's marker-less override with the plugin's
 * entry and keeps the override in that entry's marker. `fields` lists the
 * override's fields that stop applying while the plugin provides `server`, in
 * the override's key order. It names fields, never their values.
 */
export interface McpOverrideKeptNotice {
  readonly kind: "override-kept";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly fields: readonly string[];
}

/**
 * AFILE-01 / AFILE-06: an unstage wrote a kept override back as a marker-less
 * entry. It renders nothing. It cancels an earlier override-kept notice for
 * the same scope, file and server, so a command that keeps and then writes
 * back an override shows no warning for it.
 */
export interface McpOverrideRestoredNotice {
  readonly kind: "override-restored";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json" | "mcp.json";
  readonly server: string;
}

/**
 * AVAR-04: a staged plugin server references environment variables that are
 * unset and have no `:-` default. `names` lists them once each, in first-seen
 * order. It names variables, never their values.
 */
export interface McpVariablesMissingNotice {
  readonly kind: "variables-missing";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly names: readonly string[];
}

/**
 * AVAR-04 / AVAR-05: a staged plugin server's `url` or `headers` references
 * deny-listed credential variables that were set at install, and the entry
 * carries empty values in their place. `names` lists them once each, in
 * first-seen order. It names variables, never their values.
 */
export interface McpCredentialsBlankedNotice {
  readonly kind: "credentials-blanked";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly names: readonly string[];
}

/**
 * ANAME-07 / AMIG-01: a staged plugin server declares tool permission rules
 * that pi-mcp-adapter does not enforce. `fields` lists the field names in
 * table order. It names fields, never tool names or policy values.
 */
export interface McpToolRulesUnenforcedNotice {
  readonly kind: "tool-rules-unenforced";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly fields: readonly string[];
}

/**
 * AMIG-01: a stage removed a marker-less entry pi-mcp-adapter had written
 * under `server`, the old name of a plugin server whose `mcp.json` entry the
 * command removed: an override stub or the panel's direct-tools copy.
 */
export interface McpLeftoverRemovedNotice {
  readonly kind: "leftover-removed";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
}

/**
 * AFILE-04 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: one MCP config fact a
 * command routes to `notifyMcpConfigNotices`.
 */
export type McpConfigNotice =
  | McpConfigFileNotice
  | McpOverrideKeptNotice
  | McpOverrideRestoredNotice
  | McpVariablesMissingNotice
  | McpCredentialsBlankedNotice
  | McpToolRulesUnenforcedNotice
  | McpLeftoverRemovedNotice;

/** AMIG-01 / AMIG-03: a server the reload moved from `mcp.json` to `mcp-adapter.json`. */
export interface McpMigrationMovedRow {
  readonly kind: "moved";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  /** The server's key in `mcp.json`, its declared name. */
  readonly from: string;
  /** The server's key in `mcp-adapter.json` (ANAME-01). */
  readonly to: string;
}

/** AMIG-01 / AMIG-03: a scope or plugin whose move stopped, with a path-free detail. */
export interface McpMigrationStoppedRow {
  readonly kind: "stopped";
  readonly scope: Scope;
  readonly detail: string;
}

/**
 * AMIG-04: a plugin's marked `mcp.json` entries that no install record in
 * this scope owns. `servers` holds the old names in file order.
 */
export interface McpMigrationUnownedRow {
  readonly kind: "unowned";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed git-source plugin whose clone is not in the cache, so
 * its entries stay under their old names until a reinstall fetches it.
 */
export interface McpMigrationSourceUnreadableRow {
  readonly kind: "source-unreadable";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin that its marketplace manifest no longer lists,
 * or lists in a form that is not valid. A reinstall reads the same manifest,
 * so the remedy is a marketplace update or an uninstall.
 */
export interface McpMigrationNotListedRow {
  readonly kind: "not-listed";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin whose source the cached marketplace copy
 * cannot give: a missing or unparseable manifest, a source the copy lacks, or
 * a declared git-subdir path that leaves the plugin's repository. A reinstall
 * reads the same copy. An uninstall clears every cause, so it comes first; a
 * marketplace update refreshes an out-of-date copy but cannot restore a
 * missing checkout.
 */
export interface McpMigrationMarketplaceUnreadableRow {
  readonly kind: "marketplace-unreadable";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * D-08-05 / AMIG-01: an installed git-source plugin whose cached source, the
 * warm mirror of an unpinned source or the clone of the recorded commit, has
 * no plugin at the path the marketplace declares. An update installs the
 * source the marketplace now declares, so the remedy is an update.
 */
export interface McpMigrationSourceOutdatedRow {
  readonly kind: "source-outdated";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin whose new key another config source already
 * defines in full, so none of its servers moved. `key` is that source's key
 * and `source` names it as the row reads it: a scope file with its article
 * (`the user-scope mcp-adapter.json`) or a home-relative path
 * (`~/.config/mcp/mcp.json`), never an absolute path.
 */
export interface McpMigrationCollisionRow {
  readonly kind: "collision";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
  readonly key: string;
  readonly source: string;
}

/** AMIG-01: a scope config file that does not parse, so nothing in the scope moved. */
export interface McpMigrationFileUnreadableRow {
  readonly kind: "file-unreadable";
  readonly scope: Scope;
  readonly file: "mcp.json" | "mcp-adapter.json";
}

/**
 * AMIG-01: why the reload removed a server's `mcp.json` entry without moving
 * it: the plugin no longer declares it, the plugin is disabled, the server
 * needs a feature pi-mcp-adapter cannot run, or the plugin's MCP config is
 * not valid.
 */
export type McpMigrationRemovalCause =
  "not-declared" | "disabled" | "unsupported-feature" | "malformed";

/**
 * AMIG-01 / AMIG-03: a server whose `mcp.json` entry the reload removed and
 * did not write to `mcp-adapter.json`. `server` is its old name; `feature`
 * names the blocking feature, set only for an `unsupported-feature` cause.
 */
export interface McpMigrationRemovedRow {
  readonly kind: "removed";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly server: string;
  readonly cause: McpMigrationRemovalCause;
  readonly feature?: string;
}

/**
 * AMIG-02: a plugin whose servers the reload wrote to `mcp-adapter.json` but
 * could not remove from `mcp.json`, so both files hold them until the next
 * reload. `detail` carries no absolute path.
 */
export interface McpMigrationUnfinishedRow {
  readonly kind: "unfinished";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
  /** The file whose write failed after the new entries were written. */
  readonly file: "mcp.json" | "project-scope mcp-adapter.json";
  readonly detail: string;
}

/** AMIG-03: one row of the reload migration notice. */
export type McpMigrationRow =
  | McpMigrationMovedRow
  | McpMigrationRemovedRow
  | McpMigrationStoppedRow
  | McpMigrationUnownedRow
  | McpMigrationNotListedRow
  | McpMigrationSourceUnreadableRow
  | McpMigrationSourceOutdatedRow
  | McpMigrationMarketplaceUnreadableRow
  | McpMigrationCollisionRow
  | McpMigrationFileUnreadableRow
  | McpMigrationUnfinishedRow;

/** AMIG-03: a row whose servers stay in `mcp.json`. */
export type McpMigrationLeftRow = Exclude<
  McpMigrationRow,
  McpMigrationMovedRow | McpMigrationRemovedRow
>;

/** AMIG-03: everything one reload's migration reports, across both scopes. */
export interface McpMigrationReport {
  readonly rows: readonly McpMigrationRow[];
  /** The MCP config facts of the files the migration wrote. */
  readonly notices: readonly McpConfigNotice[];
}

/**
 * AFILE-04: a notice that renders a line. An `override-restored` notice only
 * cancels an earlier `override-kept` notice, so it never reaches a strategy.
 */
export type RenderedMcpConfigNotice = Exclude<McpConfigNotice, McpOverrideRestoredNotice>;

/** AFILE-04: the notice sections; each rendered notice kind is its own section. */
export type McpConfigNoticeSection = RenderedMcpConfigNotice["kind"];

/**
 * AFILE-04 / WIRE-01: one non-empty section of MCP config notices, every one
 * of the kind `section` names. The kind belongs to no fixed-origin group
 * (D-14), because commands and the load pass both write MCP config files.
 */
export interface McpConfigNoticesSurface {
  readonly kind: "mcp-config-notices";
  readonly section: McpConfigNoticeSection;
  readonly notices: readonly RenderedMcpConfigNotice[];
}

/**
 * AMIG-03 / D-14: the reload migration notice, a load-origin surface. `rows`
 * is non-empty: a report without rows goes out as config notice sections.
 */
export interface McpMigrationSurface {
  readonly kind: "mcp-migration";
  readonly rows: readonly McpMigrationRow[];
  readonly notices: readonly McpConfigNotice[];
}

/** RAWS-04 / D-13: the load-time reconcile aborted; `cause` is the live thrown value. */
export interface ReconcileAbortedSurface {
  readonly kind: "reconcile-aborted";
  readonly cause: unknown;
}

/** RAWS-04 / D-13: the load pass could not refresh one scope's plugin PATH. */
export interface PluginPathSkippedSurface {
  readonly kind: "plugin-path-skipped";
  readonly scope: Scope;
  readonly reason: string;
}

/**
 * AUP-03 / D-PL8-10: one install a background update moved. `fromVersion` is
 * optional on the wire (D-PL8-16).
 */
export interface BackgroundUpdatePlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly fromVersion?: string;
  readonly toVersion: string;
}

/**
 * AUP-03 / D-PL8-10: the plugins one background update moved, in update
 * order, one row per updated install. A load-origin surface (D-14).
 */
export interface BackgroundUpdateSurface {
  readonly kind: "background-update";
  readonly plugins: readonly BackgroundUpdatePlugin[];
}

/** D-14: the load-origin group of raw output surfaces. */
export type LoadSurface =
  | ReconcileAbortedSurface
  | PluginPathSkippedSurface
  | McpMigrationSurface
  | BackgroundUpdateSurface;

/** RAWS-01 / D-06: an argv-validation error with the verb's usage block. */
export interface UsageErrorSurface extends UsageErrorMessage {
  readonly kind: "usage-error";
}

/** RAWS-01 / D-06: usage documentation shown on an explicit help request. */
export interface UsageInfoSurface {
  readonly kind: "usage-info";
  readonly usage: string;
}

/** AAP-04: a config file that can set `autoapply`, named by scope and basename. */
export interface AutoapplyConfigFile {
  readonly scope: Scope;
  readonly file: "claude-plugins.json" | "claude-plugins.local.json";
}

/** AAP-04: one config file's own `autoapply` value; no `value` means not set. */
export interface AutoapplyFileValue extends AutoapplyConfigFile {
  readonly value?: boolean;
}

/**
 * AAP-04 / AAP-D2: what `/claude:plugin autoapply` shows. `enabled` and
 * `source` are the effective value and the file that set it (no `source`
 * means the default, off); `files` are the files the command lists; `set` is
 * the write a set form made.
 */
export interface AutoapplyStatusSurface {
  readonly kind: "autoapply-status";
  readonly enabled: boolean;
  readonly source?: AutoapplyConfigFile;
  readonly files: readonly AutoapplyFileValue[];
  readonly set?: AutoapplyConfigFile & { readonly value: boolean };
}

/**
 * RAWS-02 / D-05: an out-of-band warning block. The producer composes the
 * header and redacts the lines; the text strategy joins them. The kind belongs
 * to no fixed-origin group (D-14), because its origin depends on the caller:
 * import is a command, and reconcile post-install is load.
 */
export interface DiagnosticSurface {
  readonly kind: "diagnostic";
  readonly header: string;
  readonly lines: readonly string[];
}

/** RAWS-05 / D-08: a plugin author's async-rewake summary, kept verbatim. */
export interface AsyncRewakeSummarySurface {
  readonly kind: "async-rewake-summary";
  readonly summary: string;
}

/**
 * RAWS-05 / D-07: the one-shot Stop-hook override-cap warning. `cap` is the
 * re-entry cap the settle bridge compares against, so the warning states the
 * number that tripped it.
 */
export interface StopOverrideCapSurface {
  readonly kind: "stop-override-cap";
  readonly pluginId: string;
  readonly cap: number;
}

/**
 * D-14: the hook-origin group of raw output surfaces. Hook callbacks get no run
 * object.
 */
export type HookSurface = AsyncRewakeSummarySurface | StopOverrideCapSurface;

/**
 * D-10 / AUTH-03: the device-flow values a user needs to authorize this
 * machine. AUTH-09: these two values are the only data that cross the
 * device-code callback; no token exists yet when they do.
 */
export interface DeviceFlowPrompt {
  readonly verificationUri: string;
  readonly userCode: string;
}

/**
 * RAWS-03 / D-12: the device-flow prompt. It belongs to no fixed-origin group
 * (D-14), because the prompt fires during commands and during load-pass git
 * installs.
 */
export interface DeviceFlowPromptSurface extends DeviceFlowPrompt {
  readonly kind: "device-flow-prompt";
}

/**
 * D-01 / D-04: every raw output surface. It is deliberately not a
 * `NotificationMessage` member, so `notify()`'s run never reaches a raw call
 * site.
 */
export type RawSurface =
  | UsageErrorSurface
  | UsageInfoSurface
  | AutoapplyStatusSurface
  | DiagnosticSurface
  | DeviceFlowPromptSurface
  | McpConfigNoticesSurface
  | HookSurface
  | LoadSurface;
