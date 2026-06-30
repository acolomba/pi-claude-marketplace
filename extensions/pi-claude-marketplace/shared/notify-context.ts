import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
  type CascadeNotificationMessage,
  type MarketplaceNotificationMessage,
  type PluginNotificationMessage,
  type ReconcileAppliedCascadeMessage,
} from "./notify.ts";

import type { Scope } from "./types.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notify-context.ts -- the horizontal command-context spine every
 * command migration builds against. It declares the shared `CommandContext`
 * shape (carrying `Messaging.label` and a per-status render map), the
 * `RenderFn` row-renderer signature, the tuple-vs-array cardinality aliases,
 * and the `notifyWithContext` entry point that dispatches the per-row body
 * through `context.render[status]` while routing the composed cascade through
 * the shared severity/summary/reload + single `ctx.ui.notify` seam in
 * `notify.ts` (`emitContextCascade`).
 *
 * The legacy `notify(ctx, pi, message)` in `notify.ts` keeps serving
 * not-yet-migrated call sites (it still drives the central renderPluginRow /
 * renderMpHeader switches) until every command routes through this module;
 * removing those central switches is a later plan. Both paths share the same
 * `emitWithSummary` seam, so output stays byte-identical throughout the
 * migration.
 */

/**
 * The per-row render signature lifted verbatim from the central
 * `renderPluginRow` / `renderMpHeader` switch params: a row plus the threaded
 * soft-dep probe plus the parent marketplace scope produce the single row line.
 * A command's render map reproduces the EXACT bytes of the central switch arm
 * it lifts, so dispatching through it is byte-identical to the legacy path.
 */
export type RenderFn<M> = (row: M, probe: SoftDepStatus, mpScope: Scope) => string;

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
 * replacement for the central `renderPluginRow` `assertNever` default. The
 * `Extract<Msg, { status: K }>` narrows each arm to exactly the message shape
 * that carries status `K`.
 */
export interface CommandContext<Status extends string, Msg> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
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
 * WR-01 / D-10: the marketplace-row shape `notifyWithContext` accepts, with its
 * `plugins` slot narrowed to the command's OWN `Msg`. This DISTRIBUTES over the
 * real `MarketplaceNotificationMessage` union (one mapped member per arm),
 * preserving each arm's per-status constraints (e.g. `MpFailed`'s REQUIRED
 * `severity: "error" | "warning"`, `MpSkipped`'s reachable `reasons?`, `MpList`'s
 * reachable `details?`), and replaces ONLY the `plugins` child slot with the
 * command's `Msg`. Because it is built FROM the union, assigning a value of this
 * type back to `readonly MarketplaceNotificationMessage[]` is a genuine
 * assignability relationship -- the `notifyWithContext` widening seam is a single
 * safe upcast, not an `as unknown as` reinterpretation, so a status-drift between
 * a producer and the render map surfaces as a real compile error rather than a
 * runtime `TypeError` inside `dispatchRow`.
 *
 * Combined with the `Msg extends { status: Status }` bound on
 * `notifyWithContext`, a call site that pushes a plugin row whose `status` the
 * context's render map does not declare is a compile error at the call site --
 * the design's stated exhaustiveness guarantee in BOTH directions (render map
 * total over `Status`, AND rows carry only `Status`).
 */
export type WithPlugins<MP, Msg> = MP extends unknown
  ? Omit<MP, "plugins"> & { readonly plugins: readonly Msg[] }
  : never;

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
 * downstream of this seam: `emitContextCascade` -> `emitWithSummary` ->
 * `computeSeverity` -> `cascadeSeverity` MAX-reduces every row's `severity` to
 * the envelope severity, and the per-row `needsReload` OR-reduce drives the
 * `/reload to pick up changes` trailer. `Messaging.label` feeds the trailing
 * tally on plural cascades.
 *
 * RLD-05 / D-07: `kind` defaults to the plain `"cascade"` arm. The
 * `/claude:plugin disable` command no longer threads a distinguishing kind --
 * its fresh `(disabled)` row stamps `needsReload: true` directly, so the
 * `/reload to pick up changes` trailer fires via the RLD-02 OR-reduce of the
 * per-row stamps, not via a cascade-kind straddle.
 */
export function notifyWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
  kind?: "cascade",
  cardinality?: "single" | "plural",
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
  // (OUT-03) renders IFF `cardinality === "plural"`; `label` is its
  // `<Operation>` prefix. A call site that omits `cardinality` (single-target
  // ops) gets no tally. These fields are read only by the tally composer in
  // `emitWithSummary` -- they never affect the per-row body or severity.
  const message: CascadeNotificationMessage = {
    ...(kind === undefined ? {} : { kind }),
    marketplaces,
    label: context.Messaging.label,
    ...(cardinality !== undefined && { cardinality }),
  };

  emitContextCascade(ctx, pi, message, (p, probe, mpScope) =>
    dispatchRow(context, p, probe, mpScope),
  );
}

/**
 * UGRM-02 / WR-02: the bulk-`update` cascade emitter that owns the OPT-IN,
 * update-scoped `tally` success-category override. Mirrors `notifyWithContext`
 * but additionally threads `{ verb: "updated", count: <updatedCount> }` onto the
 * envelope, where `composeTally` reads it in place of the legacy info-row
 * success math.
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
  ctx: ExtensionContext,
  pi: ExtensionAPI,
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

  emitContextCascade(ctx, pi, message, (p, probe, mpScope) =>
    dispatchRow(context, p, probe, mpScope),
  );
}

/**
 * UGRM-01 / UGRM-02: the bulk-`update` never-silent no-op emitter. Used when a
 * bulk update realized ZERO transitions (0 updated, 0 failures, 0 warnings):
 * either an empty post-suppression cascade (all up-to-date) or a non-empty
 * cascade whose only surviving rows are benign info skips (e.g. a
 * `(force-upgradable)` decline). Renders the surviving rows through the command's
 * render map and folds the hard-coded `Plugin update: nothing to update` headline
 * below them, so the summary line can never vanish. NO `cardinality` / `tally` --
 * the headline is a fixed constant owned by `emitUpdateNoOpCascade`, not the
 * `composeTally` success math.
 */
export function notifyUpdateNoOpWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
): void {
  // Same type-safe widening as `notifyWithContext`: `MarketplaceRows<Msg>` is a
  // genuine subtype of `MarketplaceNotificationMessage[]` (no cast).
  const marketplaces: readonly MarketplaceNotificationMessage[] = rows;
  const message: CascadeNotificationMessage = {
    marketplaces,
    label: context.Messaging.label,
  };

  emitUpdateNoOpCascade(ctx, pi, message, (p, probe, mpScope) =>
    dispatchRow(context, p, probe, mpScope),
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
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
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

  emitReconcileAppliedContextCascade(ctx, pi, labeled, (p, probe, mpScope) =>
    dispatchRow(context, p, probe, mpScope),
  );
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
 * user, carrying a self-describing diagnostic instead of vanishing.
 */
function dispatchRow<Status extends string, Msg>(
  context: CommandContext<Status, Msg>,
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  const arm = context.render[p.status as Status] as
    | RenderFn<Extract<Msg, { status: Status }>>
    | undefined;
  if (arm === undefined) {
    // WR-02 / SEV-02: the fallback is an internal-drift error condition, so it
    // must not surface as a quiet `info`. `cascadeSeverity` MAX-reduces the
    // stamped `severity` of every row downstream of this seam (it reads the SAME
    // row objects this dispatch walks), so stamp this row to `error` here to
    // floor the envelope at error. The field is declared `readonly`; this single
    // localized write is the seam that lets the fallback contribute its severity.
    try {
      (p as { severity?: "error" }).severity = "error";
    } catch {
      // A frozen/sealed out-of-band row rejects the write in ESM strict mode. The
      // throw must not escape the single `ctx.ui.notify` seam, so degrade: keep
      // whatever severity was already stamped and still render the diagnostic.
    }

    return `${"name" in p ? p.name : "?"} (failed) {internal: no render arm for "${p.status}"}`;
  }

  return (arm as unknown as RenderFn<PluginNotificationMessage>)(p, probe, mpScope);
}
