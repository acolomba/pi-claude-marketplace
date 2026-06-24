import {
  emitContextCascade,
  type CascadeNotificationMessage,
  type MarketplaceNotificationMessage,
  type PluginNotificationMessage,
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
 * D-07: `context.render` and `Messaging.label` are the only members consumed
 * for output this phase; the inert `severity?` / `needsReload?` row fields are
 * NOT read here (reduction lands later). `Messaging.label` is threaded for the
 * migration's sake but the summary surface that renders it lands later, so it
 * does not change any rendered byte yet.
 */
export function notifyWithContext<Status extends string, Msg>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceNotificationMessage[],
): void {
  const message: CascadeNotificationMessage = { marketplaces: rows };

  emitContextCascade(ctx, pi, message, (p, probe, mpScope) =>
    dispatchRow(context, p, probe, mpScope),
  );
}

/**
 * Dispatch a single plugin row through the command's render map. The row's
 * `status` selects the arm; the arm reproduces the verbatim bytes of the
 * central switch arm it lifted, so the output is byte-identical. The casts
 * bridge the broad `PluginNotificationMessage` the cascade seam threads to the
 * command's own narrower `Status` / `Msg`; a command only ever supplies rows
 * whose statuses its render map covers, so the lookup is total at the call
 * site.
 */
function dispatchRow<Status extends string, Msg>(
  context: CommandContext<Status, Msg>,
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  const arm = context.render[p.status as Status] as unknown as RenderFn<PluginNotificationMessage>;
  return arm(p, probe, mpScope);
}
