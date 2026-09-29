import { softDepStatus } from "../platform/pi-api.ts";

import {
  composeMarketplaceBlock,
  composePluginLinesWith,
  composeReconcileAppliedBody,
  formatNotificationText,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPluginInfo,
  renderPluginInfoCascade,
} from "./notification-grammar.ts";
import {
  CENTRAL_MARKER_POLICY,
  resolveEnvelope,
  resolveNotAddedReason,
  resolveRows,
  resolveUpdateNoOpEnvelope,
} from "./notification-resolve.ts";
import { isInfoKind } from "./notification-summary.ts";

import type {
  MarkerPolicy,
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRow,
} from "./notification-resolve.ts";
import type { NotificationRun } from "./notification-run.ts";
import type { StandaloneKind } from "./notification-summary.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
  ReconcileAppliedCascadeMessage,
  Severity,
  UsageErrorMessage,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";
import type { NotificationContext, SoftDepStatus, ToolInventory } from "../platform/pi-api.ts";

/**
 * shared/notification-dispatch.ts -- the SOLE sanctioned ctx.ui.notify call
 * site and the
 * single source of truth for the structured-notification surface. Severity is
 * a caller-stamped per-row field (`Severity`): each producer stamps every row's
 * `severity`, and `computeSeverity` takes the numeric MAX over the rows (SEV-02)
 * to derive the magic-string `"info" | "warning" | "error"` second arg the Pi
 * API's `notify(msg, type?)` accepts -- NOT content inference. The standalone
 * info-surface kinds (`marketplace-not-added`, `plugin-info`, and the read-only
 * info/cascade kinds) carry no per-row severity array, so they keep a tiny
 * kind->severity map. The eslint per-file override in eslint.config.js disables
 * `no-restricted-syntax` for this file so inline `eslint-disable-next-line`
 * comments are unnecessary here.
 *
 * Public API:
 *
 *  - notify(ctx, source, NotificationMessage)
 *  Single state-change entry. Renders the marketplace/plugin tree
 *  to a single string and routes through ctx.ui.notify with computed
 *  severity, a computed reload-hint trailer, and one soft-dep snapshot:
 *  the notification run's own, or a single probe of a tool inventory
 *  at entry. `resolveRows` composes the per-row
 *  {requires pi-subagents} / {requires pi-mcp} markers from that probe
 *  under `CENTRAL_MARKER_POLICY` (D-12).
 *  - notifyUsageError(ctx, UsageErrorMessage)
 *  Argv-validation errors. On-the-wire string is
 *  `${message.message}\n\n${message.usage}` at "error" severity
 *  (SNM-13).
 *
 * Closed-set source of truth: the `Reason`, `StatusToken`, `PluginStatus` and
 * `MarketplaceStatus` literal-union vocabularies live in
 * `notification-types.ts`. No `MARKERS` / `PATTERN_CLASSES`
 * vocabularies sit alongside them: the `<autoupdate>` / `<no autoupdate>` chevron
 * tokens are written as literals at their render sites in `renderMpHeader`,
 * and the pattern-class labels only ever named message shapes in prose. The
 * `compare-name-scope.ts` owns the single per-scope row-order policy across
 * every list-rendering surface.
 *
 * Callers import vocabulary from `notification-types.ts` and rendering or
 * dispatch behavior directly from this file. No barrel re-exports.
 */

/**
 * Emit one summary-composed payload at the sole Pi notification boundary:
 * format the resolved envelope around `body`, then make one `ctx.ui.notify`
 * call. An info envelope passes one argument and a warning or error envelope
 * passes its severity as the second. `body` carries the rendered rows and any
 * advisory lines; the tally, the no-op headline, the reload trailer, and the
 * summary line all come from the envelope.
 *
 * Each cascade caller runs `resolveRows` before it resolves the envelope.
 * `resolveRows` floors a row with no render arm to error, and the envelope
 * must read that floored stamp.
 *
 * Module-private: the state-change dispatch paths -- `notify`,
 * `emitContextCascade`, `emitUpdateNoOpCascade`, and
 * `emitReconcileAppliedContextCascade` (the latter three via the shared
 * `emitCascadeWith` helper) -- route through it, so those paths' emitted
 * bytes and one-call-per-invocation discipline are this seam's contract. The
 * remaining public functions (`notifyUsageError`, `notifyUsageInfo`,
 * `notifyDiagnostic`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`,
 * `makeRawNotifyFn`) carry no summary/tally/reload-hint to compose, so they
 * call `ctx.ui.notify` directly instead.
 */
function emitWithSummary(ctx: NotificationContext, envelope: ResolvedEnvelope, body: string): void {
  const text = formatNotificationText(envelope, body);
  if (envelope.severity === "info") {
    ctx.ui.notify(text);
  } else {
    ctx.ui.notify(text, envelope.severity);
  }
}

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank
 * line. The on-the-wire string is
 * `${message.message}\n\n${message.usage}` (SNM-13). The blank
 * line between message and Usage block is part of the user contract;
 * `tests/shared/notification-dispatch.test.ts` asserts it byte-for-byte
 * (the SNM-13 case).
 */
export function notifyUsageError(ctx: NotificationContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}

/**
 * Surfaces usage documentation at "info" severity (for explicit help requests).
 */
export function notifyUsageInfo(ctx: NotificationContext, usage: string): void {
  ctx.ui.notify(usage, "info");
}

/**
 * S2 / PR #51: post-cascade hygiene warnings out-of-band notification seam.
 *
 * Surfaces post-state-commit warnings (data-dir mkdir deferred,
 * completion-cache refresh deferred, agent foreign-content preserved,
 * bridge-side soft warnings) that have no representation in the
 * `MarketplaceNotificationMessage` cascade body. The reconcile apply
 * pass collects these from `InstallPluginOutcome.postCommitWarnings`
 * across the install bucket and fires this helper exactly once -- a
 * sanctioned exception to the per-cascade single-notify discipline
 * (RECON-04 / IL-2) that mirrors `import/execute.ts`'s `pushDiagnostic`
 * channel.
 *
 * The on-the-wire form is `${header}\n\n${lines.join("\n")}` at
 * `"warning"` severity. The header counts the per-warning lines so the
 * operator sees both the total and the per-warning detail without
 * re-flowing the cascade body. Standalone-mode commands swallow these
 * per D-19-01; orchestrated-mode (cascade) callers use this seam.
 */
export function notifyDiagnostic(
  ctx: NotificationContext,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }

  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}

/**
 * T-62-09 IL-2 EXEMPTION: surfaces the `rewakeSummary` UI message at
 * `"info"` severity from the asyncRewake exit handler. This is the
 * single sanctioned runtime notify call originating from
 * `bridges/hooks/async-rewake/registry.ts`; the exemption exists
 * because `rewakeSummary` is the upstream Claude-Code-mandated UI
 * status surface declared in the plugin author's hook handler -- the
 * hooks bridge does not have a structured `NotificationMessage` arm
 * for it (HOOK-06).
 *
 * Empty strings are silently ignored so the caller can pass an
 * `entry.rewakeSummary` field unconditionally without a guard.
 */
export function notifyAsyncRewakeSummary(ctx: NotificationContext, summary: string): void {
  if (summary.length === 0) {
    return;
  }

  ctx.ui.notify(summary, "info");
}

/**
 * STOP-07 / D-88-01 IL-2 bridge seam: the one-shot Stop-hook override-cap
 * warning. The settle dispatcher (`bridges/hooks/settle.ts`) fires this
 * exactly once when Stop hooks drive 8 consecutive bridge re-entries -- block
 * decisions and additionalContext continuations share one consecutive
 * re-entry counter (D-88-08) -- the loop protection suppresses the 8th
 * re-entry and surfaces this warning so a livelocking hook is visible to the
 * user rather than silently overridden (the transparency prohibition behind
 * D-88-01). Warning severity per the tri-state model: the turn DID end (the
 * protection worked) but the plugin's block desire was deliberately
 * suppressed, so the user should notice.
 *
 * On-the-wire form mirrors `notifyDiagnostic`: a non-empty summary first line
 * ("Stop hook override cap reached.") followed by a `\n\n` separator and a
 * detail block naming the plugin and stating the 8-consecutive-re-entry /
 * turn-ended-despite-active-block fact. The host UI prepends the `Warning:` label
 * to the summary line (the same shape `notifyDiagnostic` /
 * `notifyAsyncRewakeSummary` already ship without tripping the notify-grammar
 * invariant, which only walks structured `NotificationMessage` fixtures). The
 * literal `8` is the fixed override cap (STOP-07); it is duplicated here rather
 * than imported from the bridge layer so `shared/` does not depend on
 * `bridges/`. The byte form is locked by
 * `tests/architecture/hooks-cap-notify.test.ts` against the
 * `stop-override-cap` block in `docs/output-catalog.md`.
 */
export function notifyStopHookOverrideCap(ctx: NotificationContext, pluginId: string): void {
  ctx.ui.notify(
    `Stop hook override cap reached.\n\n\`${pluginId}\`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.`,
    "warning",
  );
}

/**
 * Dispatcher for the standalone-dispatched arms of `notify()`. Centralizes the
 * per-variant body composition, then routes through the shared
 * `emitWithSummary` seam (GRAM-04) so error/warning standalone emissions carry
 * the summary line exactly like the cascade arm does. IL-2: one
 * `ctx.ui.notify` call per invocation (the seam performs it).
 */
function dispatchInfoMessage(
  ctx: NotificationContext,
  message: Extract<NotificationMessage, { kind: StandaloneKind }>,
  probe: SoftDepStatus,
): void {
  // Body composition per variant. The renderers take the message and no probe;
  // `probe` feeds only the reconcile-applied arm's `resolveRows`. Severity is
  // computed off the discriminator via the shared `computeSeverity` ladder.
  let body: string;
  switch (message.kind) {
    case "marketplace-info":
      body = renderMarketplaceInfo(message);
      break;
    case "plugin-info":
      body = renderPluginInfo(message);
      break;
    case "marketplace-info-cascade":
      body = renderMarketplaceInfoCascade(message);
      break;
    case "plugin-info-cascade":
      body = renderPluginInfoCascade(message);
      break;
    case "marketplace-not-added":
      body = renderMarketplaceNotAdded(message, resolveNotAddedReason(message));
      break;
    case "reconcile-pending-empty":
      // DIFF-01 SC #2: catalog-locked free-form advisory body line. Hard-coded
      // here so the byte form cannot drift from `docs/output-catalog.md`'s
      // `empty-steady-state` state.
      body = foldAdvisories("Pending: next reload will apply 0 actions.", message.advisories);
      break;
    case "reconcile-applied-cascade":
      // RECON-04: compose the same cascade body the cascade arm renders
      // (per-mp header + per-plugin row via the existing helpers). The resolved
      // envelope never requests the reload trailer for this kind (the
      // reconcile already ran ON /reload). OUT-03/OUT-06/D-03/D-04: a reconcile
      // apply is a plural mixed-subject operation, so its envelope carries the
      // tally, exactly as on the `emitReconcileAppliedContextCascade` path.
      body = composeReconcileAppliedBody(
        resolveRows(message.marketplaces, probe, CENTRAL_MARKER_POLICY),
      );
      break;
  }

  emitWithSummary(ctx, resolveEnvelope(message), body);
}

/**
 * The soft-dependency snapshot an emission reads. A notification run carries
 * its own snapshot (D-05) and is never probed again; a tool inventory is
 * probed once for this emission.
 */
function snapshotOf(source: NotificationRun | ToolInventory): SoftDepStatus {
  return "softDeps" in source ? source.softDeps : softDepStatus(source);
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). Severity, reload-hint, and soft-dep probe are
 * computed from contents at notify time (SNM-14, SNM-15, SNM-16).
 */
export function notify(
  ctx: NotificationContext,
  source: NotificationRun | ToolInventory,
  message: NotificationMessage,
): void {
  // One soft-dep snapshot per emission: a run's own snapshot, or a probe of a
  // tool inventory. `resolveRows` composes the row markers from it (cascade
  // and reconcile-applied arms); no renderer reads it. Info messages never
  // emit soft-dep markers.
  const probe = snapshotOf(source);

  // Dispatch standalone-dispatched kinds through `dispatchInfoMessage` so the
  // cascade arm below stays under the cognitive-complexity budget. The single
  // `isInfoKind` guard (TYPE-03) is the one place that enumerates the
  // standalone set. The helper performs exactly ONE `ctx.ui.notify` call per
  // invocation (IL-2) and routes through the SAME `emitWithSummary` seam as the
  // cascade arm (GRAM-04): error/warning standalone kinds carry the summary
  // line, info kinds do not. No reload-hint for any standalone kind. After this
  // branch, TypeScript narrows `message` to `CascadeNotificationMessage` via
  // the exhaustiveness switch below.
  if (isInfoKind(message)) {
    dispatchInfoMessage(ctx, message, probe);
    return;
  }

  // Exhaustiveness gate. After the standalone-arm return above, the only
  // legal residual `message.kind` values are `undefined` (back-compat)
  // or the explicit `"cascade"`. The switch has no default arm, so a
  // future standalone `kind` literal added without extending `isInfoKind`
  // becomes a type and lint error here.
  switch (message.kind) {
    case undefined:
    case "cascade":
      // Cascade body falls through below. RLD-05 / D-07: the disable
      // command's realized (disabled) rows stamp `needsReload: true`, so the
      // reload-hint is driven by the per-row stamp, not by a distinguishing
      // kind.
      break;
  }

  // D-11: the rows resolve first, then the envelope, then the body text.
  const marketplaces = resolveRows(message.marketplaces, probe, CENTRAL_MARKER_POLICY);
  const envelope = resolveEnvelope(message);

  // Cascade body. Caller-supplied order honored end-to-end (no internal
  // sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = marketplaces.map((mp) => composeMarketplaceBlock(mp));
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally.
  const body = foldAdvisories(composed, message.advisories);

  // Emit through the shared summary seam (GRAM-04). The resolved envelope
  // carries the summary line (error/warning only), the OUT-03 tally, and the
  // reload decision, and the text strategy folds them as
  // `{summary}\n\n{cascade body}\n\n{tally}\n\n{reload-hint}` (UXG-07 / GRAM-01 /
  // OUT-03).
  emitWithSummary(ctx, envelope, body);
}

/**
 * AUTH-01 seam: create a raw notify callback bound to ctx.ui.notify for
 * use with domain-tier functions (e.g. initiateDeviceFlow) that require a
 * simple `(message, severity?) => void` callback rather than the structured
 * NotificationMessage surface. This is the ONLY sanctioned way to derive
 * a raw callback from ctx.ui.notify outside of notification-dispatch.ts itself --
 * all other code must use notify(ctx, source, NotificationMessage) directly.
 */
export function makeRawNotifyFn(
  ctx: NotificationContext,
): (message: string, severity?: Severity) => void {
  return (message: string, severity?: Severity): void => {
    if (severity === undefined) {
      ctx.ui.notify(message);
    } else {
      ctx.ui.notify(message, severity);
    }
  };
}

/**
 * WR-06: append the message's advisory body lines as their own block, after the
 * composed body and BEFORE the tally and the reload-hint fold.
 *
 * The single render site for both carriers. A message shape that declares the
 * member gets the identical byte form whichever arm of a command produced it,
 * because the arms differ only in what they hand this function as `body`.
 */
function foldAdvisories(body: string, advisories: readonly string[] | undefined): string {
  const lines = advisories ?? [];
  return lines.length === 0 ? body : `${body}\n\n${lines.join("\n")}`;
}

/**
 * Render one block per resolved marketplace: the header, then each plugin's
 * lines with the row body from the caller's render map.
 */
function composeContextBlocks(
  marketplaces: readonly ResolvedMarketplace[],
  renderPluginRowBody: (p: ResolvedRow, mpScope: Scope) => string,
): string[] {
  return marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
}

function emitCascadeWith(
  ctx: NotificationContext,
  source: NotificationRun | ToolInventory,
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (p: ResolvedRow, mpScope: Scope) => string,
  markers: MarkerPolicy,
  hasRenderArm: (status: string) => boolean,
  // WR-06: caller-composed advisory body lines. Only the plain cascade carrier
  // declares them; the reconcile-applied carrier passes `undefined`, so the
  // member stays on the two shapes that can actually produce one.
  advisories: readonly string[] | undefined,
): void {
  const probe = snapshotOf(source);
  const marketplaces = resolveRows(message.marketplaces, probe, markers, hasRenderArm);
  const envelope = resolveEnvelope(message);
  const blocks = composeContextBlocks(marketplaces, renderPluginRowBody);
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally, exactly as
  // they do on the central dispatch, so a command that can emit either arm
  // renders the identical trailer from either one.
  const body = foldAdvisories(composed, advisories);

  emitWithSummary(ctx, envelope, body);
}

/**
 * Dispatch a state-change cascade with its stamped reload decision.
 * `markers` is the caller's D-12 marker policy. `hasRenderArm` reports whether
 * the caller's render map covers a row status; `resolveRows` floors an
 * uncovered row to error.
 */
export function emitContextCascade(
  ctx: NotificationContext,
  source: NotificationRun | ToolInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (p: ResolvedRow, mpScope: Scope) => string,
  markers: MarkerPolicy,
  hasRenderArm: (status: string) => boolean,
): void {
  emitCascadeWith(
    ctx,
    source,
    message,
    renderPluginRowBody,
    markers,
    hasRenderArm,
    message.advisories,
  );
}

/**
 * Dispatch the never-silent zero-transition update result. `markers` and
 * `hasRenderArm` are the marker policy and the render-map coverage predicate
 * `emitContextCascade` takes.
 */
export function emitUpdateNoOpCascade(
  ctx: NotificationContext,
  source: NotificationRun | ToolInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (p: ResolvedRow, mpScope: Scope) => string,
  markers: MarkerPolicy,
  hasRenderArm: (status: string) => boolean,
): void {
  const probe = snapshotOf(source);
  const marketplaces = resolveRows(message.marketplaces, probe, markers, hasRenderArm);
  const envelope = resolveUpdateNoOpEnvelope(message);
  const blocks = composeContextBlocks(marketplaces, renderPluginRowBody);
  // No `(no marketplaces)` sentinel here: an empty no-op renders the headline
  // alone.
  const body = blocks.join("\n\n");

  emitWithSummary(ctx, envelope, body);
}

/**
 * Dispatch an applied reconcile cascade without a redundant reload hint.
 * `markers` and `hasRenderArm` are the marker policy and the render-map
 * coverage predicate `emitContextCascade` takes.
 */
export function emitReconcileAppliedContextCascade(
  ctx: NotificationContext,
  source: NotificationRun | ToolInventory,
  message: ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (p: ResolvedRow, mpScope: Scope) => string,
  markers: MarkerPolicy,
  hasRenderArm: (status: string) => boolean,
): void {
  emitCascadeWith(ctx, source, message, renderPluginRowBody, markers, hasRenderArm, undefined);
}
