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

import type { RowPolicy } from "./notification-resolve.ts";
import type { NotificationRun } from "./notification-run.ts";
import type { NotificationContext } from "../platform/pi-api.ts";

/** A command label and a total semantic policy for its own row statuses. */
export interface CommandContext<Status extends string> {
  readonly Messaging: { readonly label: string };
  readonly rowPolicies: Readonly<Record<Status, RowPolicy>>;
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

/** Emits command rows with the selected policy, cardinality, and advisories. */
export function notifyWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  run: NotificationRun,
  context: CommandContext<Status>,
  rows: readonly MarketplaceRows<Msg>[],
  kind: "cascade" | undefined,
  cardinality: "single" | "plural",
  {
    advisories,
    retainedWorkflows,
    needsApply,
  }: Pick<CascadeNotificationMessage, "advisories" | "retainedWorkflows" | "needsApply"> = {},
): void {
  // WR-01 seam: the rows are `Msg`-narrowed at the call site (a status the
  // row-policy map omits is a compile error there); the cascade envelope consumes
  // the broad `MarketplaceNotificationMessage` union, so the narrowed rows widen
  // back to it here at the single emission seam. Because `Msg extends
  // PluginNotificationMessage`, `MarketplaceRows<Msg>` (the distributive
  // narrowing of the real union over the command's `Msg`) is a genuine SUBTYPE
  // of `MarketplaceNotificationMessage[]` -- the widening is a plain assignment
  // with NO cast. A status drift between a producer and the row-policy map is a
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
    ...(retainedWorkflows !== undefined && { retainedWorkflows }),
    ...(needsApply === true && { needsApply: true }),
  };

  emitContextCascade(ctx, run, message, context.rowPolicies);
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
  run: NotificationRun,
  context: CommandContext<Status>,
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

  emitContextCascade(ctx, run, message, context.rowPolicies);
}

/** Emits unchanged update rows with the command policy and no-op headline. */
export function notifyUpdateNoOpWithContext<
  Status extends string,
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  run: NotificationRun,
  context: CommandContext<Status>,
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

  emitUpdateNoOpCascade(ctx, run, message, context.rowPolicies);
}

/** Emits applied reconcile rows with a plural tally and no reload trailer. */
export function notifyReconcileAppliedWithContext<
  Status extends PluginNotificationMessage["status"],
  Msg extends PluginNotificationMessage & { status: Status },
>(
  ctx: NotificationContext,
  run: NotificationRun,
  context: CommandContext<Status>,
  message: Omit<ReconcileAppliedCascadeMessage, "marketplaces"> & {
    readonly marketplaces: readonly MarketplaceRows<Msg>[];
  },
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

  emitReconcileAppliedContextCascade(ctx, run, labeled, context.rowPolicies);
}
