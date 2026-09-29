import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
} from "./notification-dispatch.ts";
import {
  type CascadeNotificationMessage,
  type MarketplaceNotificationMessage,
  type PluginNotificationMessage,
  type ReconcileAppliedCascadeMessage,
  type WithPlugins,
} from "./notification-types.ts";

import type { ResolvedRow } from "./notification-resolve.ts";
import type { Scope } from "./types.ts";
import type { NotificationContext, SoftDepStatus, ToolInventory } from "../platform/pi-api.ts";

/**
 * shared/notify-context.ts -- the horizontal command-context spine every
 * command migration builds against. It declares the shared `CommandContext`
 * shape (carrying `Messaging.label` and a per-status render map), the
 * `RenderFn` row-renderer signature, the tuple-vs-array cardinality aliases,
 * and the `notifyWithContext` entry point that dispatches the per-row body
 * through `context.render[status]` while routing the composed cascade through
 * the shared severity/summary/reload + single `ctx.ui.notify` seam in
 * `notification-dispatch.ts` (`emitContextCascade`).
 *
 * The legacy `notify(ctx, pi, message)` in `notification-dispatch.ts` keeps serving
 * not-yet-migrated call sites (it still drives the central renderPluginRow /
 * renderMpHeader switches) until every command routes through this module;
 * removing those central switches is a later plan. Both paths share the same
 * `emitWithSummary` seam, so output stays byte-identical throughout the
 * migration.
 */

/**
 * The per-row render signature: a resolved row plus the threaded soft-dep
 * probe plus the parent marketplace scope produce the single row line.
 * D-13: the row is resolved, so its `reasons` already carry any soft-dependency
 * markers and the arm composes them as they stand. A command's render map
 * reproduces the EXACT bytes of the central switch arm it lifts, so
 * dispatching through it is byte-identical to the legacy path.
 */
export type RenderFn<M extends PluginNotificationMessage> = (
  row: ResolvedRow<M>,
  probe: SoftDepStatus,
  mpScope: Scope,
) => string;

/**
 * D-04 / D-05: the shared command-context shape. Every command exposes a const
 * pinned to this interface via `as const satisfies CommandContext<...>`. The
 * member names are the fixed shared convention (`Messaging`, `label`,
 * `render`) so every command's context looks identical.
 *
 * D-04: an `interface` + per-command `const ... as const satisfies
 * CommandContext<...>` is chosen over a `class`. Both `label` and the render
 * map are data, so the satisfies-pin is the idiomatic TypeScript that still
 * enforces the contract -- a command cannot be wired without supplying
 * `Messaging.label` AND a total render map.
 *
 * D-10 exhaustiveness anchor: the mapped `render` member requires one arm per
 * declared status. A command whose const omits an arm for one of its own
 * statuses is a TS2741 compile error at the `satisfies` site -- the localized
 * counterpart of the central `renderPluginRow` exhaustive switch. The
 * `Extract<Msg, { status: K }>` narrows each arm to exactly the message shape
 * that carries status `K`.
 *
 * D-12: `markers` is the command's marker policy, total over its own statuses
 * beside `render`. A status mapped to `true` lets `resolveRows` append the
 * `{requires ...}` markers the row's `dependencies` call for.
 */
export interface CommandContext<Status extends string, Msg extends PluginNotificationMessage> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
  readonly markers: Readonly<Record<Status, boolean>>;
}

/**
 * D-12 / OUT-07: structural cardinality vocabulary. A command that always emits
 * exactly one row (single-target ops such as `install` / `marketplace add`)
 * annotates its row slot `Single<Row>` (a readonly 1-tuple); bulk ops (`list`,
 * update cascade, import, reconcile) annotate it `Plural<Row>` (a readonly
 * array). This is additive typing only -- a 1-tuple IS an array at runtime, so
 * the existing `.length` / `.filter().length` counting in the severity and
 * summary ladders keeps working unchanged; rewriting those counts is a later
 * phase, not this one.
 */
export type Single<Row> = readonly [Row];
export type Plural<Row> = readonly Row[];

/**
 * The marketplace-row shape `notifyWithContext` accepts: the broad
 * `MarketplaceNotificationMessage` union with its `plugins` child slot narrowed
 * to the command's OWN `Msg`. See `WithPlugins` for why this distributes over
 * the real union (and thus widens back to it safely).
 */
export type MarketplaceRows<Msg> = WithPlugins<MarketplaceNotificationMessage, Msg>;

/**
 * D-02 entry point. Dispatches each per-plugin row body through
 * `context.render[row.status]` (NOT the central renderPluginRow switch), then
 * routes the composed cascade through the shared severity/summary/reload +
 * single `ctx.ui.notify` seam (`emitContextCascade` -> `emitWithSummary`).
 *
 * `rows` is the cascade's marketplace rows. The marketplace header, the
 * description / cause-chain / rollback-partial trailing lines, the
 * `(no marketplaces)` sentinel, the reload-hint trailer, and the severity /
 * summary computation all stay central and byte-identical to the legacy path;
 * only the single per-plugin row line comes from the command's render map.
 *
 * Typed generically over the command's OWN `CommandContext<Status, Msg>` so
 * each call site is checked against ITS command's shapes -- there is no central
 * row-type registry (D-01 / D-08).
 *
 * D-07: `context.render` and `Messaging.label` are the members consumed for the
 * per-row body rendering. The `severity?` / `needsReload?` row fields ARE read
 * downstream of this seam: `emitContextCascade` -> `resolveEnvelope`
 * (notification-resolve.ts) -> `computeSeverity` -> `cascadeSeverity`
 * MAX-reduces every row's `severity` to the envelope severity, and the per-row
 * `needsReload` OR-reduce resolves the envelope's `needsReload`, which drives
 * the `/reload to pick up changes` trailer. `Messaging.label` labels the
 * resolved tally when plural cardinality makes it eligible. An empty default
 * result suppresses the success line.
 *
 * RLD-05 / D-07: `kind` is `"cascade" | undefined` rather than optional. The
 * `/claude:plugin disable` command does not thread a distinguishing kind --
 * its fresh `(disabled)` row stamps `needsReload: true` directly, so the
 * `/reload to pick up changes` trailer fires via the RLD-02 OR-reduce of the
 * per-row stamps, not via a cascade-kind straddle. Every call site states
 * `kind` and `cardinality` explicitly so a transposed or omitted argument is a
 * compile error at the call site rather than a silently-defaulted cascade.
 *
 * WR-06: `advisories` stays a trailing OPTIONAL parameter rather than joining
 * `kind` / `cardinality` in a bag -- it is the only field a caller may omit
 * entirely, and the two required fields ahead of it are unambiguous by
 * position once neither can default.
 */
export function notifyWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  pi: ToolInventory,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
  kind: "cascade" | undefined,
  cardinality: "single" | "plural",
  advisories?: readonly string[],
): void {
  // WR-01 seam: the rows are `Msg`-narrowed at the call site (a status the
  // render map omits is a compile error there); the cascade envelope consumes
  // the broad `MarketplaceNotificationMessage` union, so the narrowed rows widen
  // back to it here at the single emission seam. Because `Msg extends
  // PluginNotificationMessage`, `MarketplaceRows<Msg>` (the distributive
  // narrowing of the real union over the command's `Msg`) is a genuine SUBTYPE
  // of `MarketplaceNotificationMessage[]` -- the widening is a plain assignment
  // with NO cast. A status drift between a producer and the render map is a
  // compile error at the producer, not an `as unknown as` reinterpretation here.
  const marketplaces: readonly MarketplaceNotificationMessage[] = rows;
  // OUT-04 / D-04: thread the command's operation label + the STRUCTURAL
  // single-vs-bulk cardinality onto the cascade envelope. The trailing tally
  // (OUT-03) is eligible IFF `cardinality === "plural"`; an empty default result
  // suppresses the success line. `label` is its prefix; single callers get no tally.
  // These fields feed only the tally composer and never affect body or severity.
  // WR-06: free-text advisory body lines the command composed itself. The
  // renderer folds them in after the body and before the tally; a command that
  // omits them renders exactly what it rendered without them.
  const message: CascadeNotificationMessage = {
    ...(kind === undefined ? {} : { kind }),
    marketplaces,
    label: context.Messaging.label,
    cardinality,
    ...(advisories !== undefined && { advisories }),
  };

  emitContextCascade(
    ctx,
    pi,
    message,
    (row, probe, mpScope) => dispatchRow(context, row, probe, mpScope),
    context.markers,
    hasRenderArmFor(context),
  );
}

/**
 * UGRM-02 / WR-02: the bulk-`update` cascade emitter that owns the OPT-IN,
 * update-scoped `tally` success-category override. Mirrors `notifyWithContext`
 * but additionally threads `{ verb: "updated", count: <updatedCount> }` onto the
 * envelope. The tally is resolved in notification-resolve.ts, which reads the
 * override in place of the info-row success math.
 *
 * The override lives on a dedicated wrapper -- NOT a trailing positional param
 * on `notifyWithContext` -- so it is structurally unreachable from every other
 * op (install / reinstall / marketplace / import). A non-update caller cannot
 * mis-position an argument into the `tally` slot, because the slot does not
 * exist on the seam those callers use. This keeps their byte-frozen summaries
 * safe by construction rather than by convention.
 */
export function notifyUpdateWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  pi: ToolInventory,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
  cardinality: "single" | "plural",
  tally: { readonly verb: string; readonly count: number },
): void {
  // Same type-safe widening as `notifyWithContext`: `MarketplaceRows<Msg>` is a
  // genuine subtype of `MarketplaceNotificationMessage[]` (no cast).
  const marketplaces: readonly MarketplaceNotificationMessage[] = rows;
  const message: CascadeNotificationMessage = {
    marketplaces,
    label: context.Messaging.label,
    cardinality,
    tally,
  };

  emitContextCascade(
    ctx,
    pi,
    message,
    (row, probe, mpScope) => dispatchRow(context, row, probe, mpScope),
    context.markers,
    hasRenderArmFor(context),
  );
}

/**
 * UGRM-01 / UGRM-02: the bulk-`update` never-silent no-op emitter. Used when a
 * bulk update realized ZERO transitions (0 updated, 0 failures, 0 warnings):
 * either an empty post-suppression cascade (all up-to-date) or a non-empty
 * cascade whose only surviving rows are benign info skips (e.g. a
 * `(partially-upgradable)` decline). Renders the surviving rows through the command's
 * render map and folds the hard-coded `Plugin update: nothing to update` headline
 * below them, so the summary line can never vanish. NO `cardinality` / `tally` --
 * the headline is a fixed constant the text strategy renders for the no-op
 * envelope `emitUpdateNoOpCascade` resolves, not a resolved tally. Cardinality
 * remains structural metadata on the envelope so every update notification
 * retains the invocation form.
 */
export function notifyUpdateNoOpWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  pi: ToolInventory,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
  cardinality: "single" | "plural",
): void {
  // Same type-safe widening as `notifyWithContext`: `MarketplaceRows<Msg>` is a
  // genuine subtype of `MarketplaceNotificationMessage[]` (no cast).
  const marketplaces: readonly MarketplaceNotificationMessage[] = rows;
  const message: CascadeNotificationMessage = {
    marketplaces,
    label: context.Messaging.label,
    cardinality,
  };

  emitUpdateNoOpCascade(
    ctx,
    pi,
    message,
    (row, probe, mpScope) => dispatchRow(context, row, probe, mpScope),
    context.markers,
    hasRenderArmFor(context),
  );
}

/**
 * RECON-04 / D-02 entry point for the load-time `reconcile-applied-cascade`
 * standalone envelope. Mirrors `notifyWithContext` but preserves the
 * `kind: "reconcile-applied-cascade"` discriminator (its severity is
 * content-derived through a distinct standalone arm, so it must NOT be flattened
 * to a plain `CascadeNotificationMessage`). Dispatches each per-plugin row body
 * through `context.render[row.status]` while the standalone envelope's header /
 * cause-chain / severity / summary stay central and byte-identical
 * (`emitReconcileAppliedContextCascade` -> `emitWithSummary`).
 */
export function notifyReconcileAppliedWithContext<
  Status extends PluginNotificationMessage["status"],
  Msg extends Extract<PluginNotificationMessage, { status: Status }>,
>(
  ctx: NotificationContext,
  pi: ToolInventory,
  context: CommandContext<Status, Msg>,
  message: ReconcileAppliedCascadeMessage,
): void {
  // OUT-04 / OUT-06 / D-03 / D-04: stamp the operation label + plural
  // cardinality onto the reconcile-applied envelope. A load-time apply is a bulk
  // (plural) operation spanning mixed plugin + marketplace subjects, so the
  // trailing tally renders under the operation `label`, counting all rows
  // uniformly. These fields are consumed only by the tally composer in
  // `emitWithSummary`.
  const labeled: ReconcileAppliedCascadeMessage = {
    ...message,
    label: context.Messaging.label,
    cardinality: "plural",
  };

  emitReconcileAppliedContextCascade(
    ctx,
    pi,
    labeled,
    (row, probe, mpScope) => dispatchRow(context, row, probe, mpScope),
    context.markers,
    hasRenderArmFor(context),
  );
}

/**
 * WR-02: whether `context` declares a render arm for a row status. The
 * emitters hand this to `resolveRows`, which floors a row with no arm to error
 * before the envelope resolves.
 */
function hasRenderArmFor<Status extends string, Msg extends PluginNotificationMessage>(
  context: CommandContext<Status, Msg>,
): (status: string) => boolean {
  // The lookup is read as possibly-`undefined`, exactly as `dispatchRow` reads
  // it, because an out-of-band row can carry a status the map omits.
  return (status) => {
    const arm: unknown = context.render[status as Status];
    return arm !== undefined;
  };
}

/**
 * Dispatch a single plugin row through the command's render map. The row's
 * `status` selects the arm; the arm reproduces the verbatim bytes of the
 * central switch arm it lifted, so the output is byte-identical. The cast
 * bridges the broad `PluginNotificationMessage` the cascade seam threads to the
 * command's own narrower `Status` / `Msg`; `notifyWithContext` constrains its
 * rows to `Msg` (WR-01), so a command only ever supplies rows whose statuses
 * its render map covers and the lookup is total at the call site.
 *
 * WR-02: the lookup is read as possibly-`undefined`. Because the producers are
 * now typed to their command's `Msg` (the `MarketplaceRows<Msg>` distributive
 * type pins each producer's plugin rows to the render map's status set), this
 * branch is unreachable for type-checked call sites -- a status drift between a
 * producer and the render map is a compile error at the producer, not here.
 *
 * Defense-in-depth (IN-03 / IN-05): should an out-of-band caller still reach
 * this seam with a status the render map omits, render a conspicuous fallback
 * row rather than throwing. A bare throw would BOTH drop the user's notification
 * AND escape before the single `ctx.ui.notify` seam, so a future projection
 * drift would surface as an uncaught exception with no output. The fallback
 * degrades gracefully -- the row still flows through the cascade and reaches the
 * user, carrying a self-describing diagnostic instead of vanishing. The row's
 * error severity is decided earlier, in `resolveRows`, through the
 * `hasRenderArmFor` the emitters receive.
 */
function dispatchRow<Status extends string, Msg extends PluginNotificationMessage>(
  context: CommandContext<Status, Msg>,
  row: ResolvedRow,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  const arm = context.render[row.status as Status] as
    RenderFn<Extract<Msg, { status: Status }>> | undefined;
  if (arm === undefined) {
    return `${"name" in row ? row.name : "?"} (failed) {internal: no render arm for "${row.status}"}`;
  }

  return (arm as unknown as RenderFn<PluginNotificationMessage>)(row, probe, mpScope);
}
