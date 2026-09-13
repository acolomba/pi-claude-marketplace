import { softDepStatus } from "../platform/pi-api.ts";

import { assertNever } from "./errors.ts";
import {
  composeMarketplaceBlock,
  composePluginLinesWith,
  composeReconcileAppliedBody,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPluginInfo,
  renderPluginInfoCascade,
} from "./notification-grammar.ts";
import {
  composeTally,
  composeWithSummary,
  foldTallyAndHint,
  isInfoKind,
  RELOAD_HINT_TRAILER,
  shouldEmitReloadHint,
  UPDATE_NO_OP_HEADLINE,
} from "./notification-summary.ts";

import type { StandaloneKind } from "./notification-summary.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
  PluginNotificationMessage,
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
 *  - notify(ctx, pi, NotificationMessage)
 *  Single state-change entry. Renders the marketplace/plugin tree
 *  to a single string and routes through ctx.ui.notify with computed
 *  severity, a computed reload-hint trailer, and a single
 *  softDepStatus(pi) probe at entry threaded through the renderer so
 *  per-row {requires pi-subagents} / {requires pi-mcp} markers are
 *  injected at render time.
 *  - notifyUsageError(ctx, UsageErrorMessage)
 *  Argv-validation errors. On-the-wire string is
 *  `${message.message}\n\n${message.usage}` at "error" severity
 *  (SNM-13).
 *
 * Closed-set source of truth: the `REASONS`, `STATUS_TOKENS`,
 * `PLUGIN_STATUSES` and `MARKETPLACE_STATUSES` const tuples and their derived
 * literal-union types live in `notification-types.ts`. No `MARKERS` / `PATTERN_CLASSES`
 * tuples sit alongside them: the `<autoupdate>` / `<no autoupdate>` chevron
 * tokens are written as literals at their render sites in `renderMpHeader`,
 * and the pattern-class labels only ever named message shapes in prose. The
 * `compare-name-scope.ts` owns the single per-scope row-order policy across
 * every list-rendering surface.
 *
 * Callers import vocabulary from `notification-types.ts` and rendering or
 * dispatch behavior directly from this file. No barrel re-exports.
 */

/** Emit one summary-composed payload at the sole Pi notification boundary. */
export function emitWithSummary(
  ctx: NotificationContext,
  message: NotificationMessage,
  body: string,
): void {
  const notification = composeWithSummary(message, body);
  if (notification.length === 1) {
    ctx.ui.notify(notification[0]);
  } else {
    ctx.ui.notify(notification[0], notification[1]);
  }
}

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank
 * line. The on-the-wire string is
 * `${message.message}\n\n${message.usage}` (SNM-13). The blank
 * line between message and Usage block is part of the user contract;
 * `tests/shared/notify-v2.test.ts` asserts it byte-for-byte.
 */
export function notifyUsageError(ctx: NotificationContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
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
  // Body composition per variant. The standalone renderers share the
  // same `(message, probe) => string` shape; severity is computed off
  // the discriminator via the shared `computeSeverity` ladder.
  let body: string;
  switch (message.kind) {
    case "marketplace-info":
      body = renderMarketplaceInfo(message, probe);
      break;
    case "plugin-info":
      body = renderPluginInfo(message, probe);
      break;
    case "marketplace-info-cascade":
      body = renderMarketplaceInfoCascade(message, probe);
      break;
    case "plugin-info-cascade":
      body = renderPluginInfoCascade(message, probe);
      break;
    case "marketplace-not-added":
      body = renderMarketplaceNotAdded(message, probe);
      break;
    case "reconcile-pending-empty":
      // DIFF-01 SC #2: catalog-locked free-form advisory body line. Hard-coded
      // here so the byte form cannot drift from `docs/output-catalog.md`'s
      // `empty-steady-state` state.
      body = "Pending: next reload will apply 0 actions.";
      break;
    case "reconcile-applied-cascade":
      // RECON-04: compose the same cascade body the cascade arm renders
      // (per-mp header + per-plugin row via the existing helpers). The
      // reload-hint trailer is structurally suppressed (the reconcile already
      // ran ON /reload); emitWithSummary handles the summary prepend at
      // error/warning severity. OUT-03/OUT-06/D-03/D-04: a reconcile apply is a
      // plural mixed-subject operation, so the trailing tally folds in after the
      // body (no reload-hint segment), mirroring the
      // `emitReconcileAppliedContextCascade` production path so the byte form is
      // identical whichever entry composes it.
      body = foldTallyAndHint(
        composeReconcileAppliedBody(message, probe),
        composeTally(message),
        "",
      );
      break;
    default:
      assertNever(message);
      return;
  }

  emitWithSummary(ctx, message, body);
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). Severity, reload-hint, and soft-dep probe are
 * computed from contents at notify time (SNM-14, SNM-15, SNM-16).
 */
export function notify(
  ctx: NotificationContext,
  pi: ToolInventory,
  message: NotificationMessage,
): void {
  // Single soft-dep probe per invocation; threaded into every renderPluginRow
  // call inside composePluginLines below (cascade arm) and into the info-
  // surface renderers (which accept it for signature parity but do not use it
  // -- info messages never emit soft-dep markers).
  const probe = softDepStatus(pi);

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
  // or the explicit `"cascade"`. The switch + `assertNever` ensures a
  // future standalone `kind` literal added without extending `isInfoKind`
  // becomes a compile error here.
  switch (message.kind) {
    case undefined:
    case "cascade":
      // Cascade body falls through below. RLD-05 / D-07: the disable
      // command's realized (disabled) rows stamp `needsReload: true`, so the
      // reload-hint is driven by the per-row stamp, not by a distinguishing
      // kind.
      break;
    default:
      assertNever(message);
      return;
  }

  // Cascade body. Caller-supplied order honored end-to-end (no internal
  // sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  // OUT-03 / OUT-04 / D-04: the per-operation tally renders on PLURAL ops
  // (cardinality === "plural"), sits AFTER the body and BEFORE the reload-hint
  // trailer, and is empty for single-target / legacy emissions.
  const tally = composeTally(message);

  // Compute reload-hint per the state-change trigger ladder and append it
  // with one blank line.
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withTally = foldTallyAndHint(body, tally, hint);

  // Emit through the shared summary seam (GRAM-04). At info severity the body
  // emits unchanged; at error/warning severity the summary is prepended as its
  // own block, with the tally + reload-hint already folded last:
  // `{summary}\n\n{cascade body}\n\n{tally}\n\n{reload-hint}` (UXG-07 / GRAM-01 /
  // OUT-03).
  emitWithSummary(ctx, message, withTally);
}

/**
 * AUTH-01 seam: create a raw notify callback bound to ctx.ui.notify for
 * use with domain-tier functions (e.g. initiateDeviceFlow) that require a
 * simple `(message, severity?) => void` callback rather than the structured
 * NotificationMessage surface. This is the ONLY sanctioned way to derive
 * a raw callback from ctx.ui.notify outside of notification-dispatch.ts itself --
 * all other code must use notify(ctx, pi, NotificationMessage) directly.
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

function emitCascadeWith(
  ctx: NotificationContext,
  pi: ToolInventory,
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
  hint: string,
): void {
  const probe = softDepStatus(pi);
  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  const withTally = foldTallyAndHint(body, composeTally(message), hint);

  emitWithSummary(ctx, message, withTally);
}

/** Dispatch a state-change cascade with its stamped reload decision. */
export function emitContextCascade(
  ctx: NotificationContext,
  pi: ToolInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";

  emitCascadeWith(ctx, pi, message, renderPluginRowBody, hint);
}

/** Dispatch the never-silent zero-transition update result. */
export function emitUpdateNoOpCascade(
  ctx: NotificationContext,
  pi: ToolInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const probe = softDepStatus(pi);
  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  const body = blocks.join("\n\n");
  const withHeadline = foldTallyAndHint(body, UPDATE_NO_OP_HEADLINE, "");

  emitWithSummary(ctx, message, withHeadline);
}

/** Dispatch an applied reconcile cascade without a redundant reload hint. */
export function emitReconcileAppliedContextCascade(
  ctx: NotificationContext,
  pi: ToolInventory,
  message: ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  emitCascadeWith(ctx, pi, message, renderPluginRowBody, "");
}
