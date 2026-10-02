import { causeChainTrailer } from "./errors.ts";
import {
  composeMarketplaceBlock,
  composePluginLines,
  composeReconcileAppliedBody,
  formatEnvelopeArguments,
  formatRawSurface,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPluginInfo,
  renderPluginInfoCascade,
} from "./notification-grammar.ts";
import {
  CENTRAL_ROW_POLICY,
  resolveEnvelope,
  resolveNotAddedReason,
  resolveRawSurface,
  resolveRows,
  resolveUpdateNoOpEnvelope,
} from "./notification-resolve.ts";
import { composeRetainedWorkflowsAdvisories, isInfoKind } from "./notification-summary.ts";
import { redactCauseChain } from "./redact-absolute-paths.ts";

import type { NotifyArguments } from "./notification-grammar.ts";
import type {
  RowPolicyMap,
  ResolvedEnvelope,
  ResolvedMarketplace,
} from "./notification-resolve.ts";
import type { NotificationRun } from "./notification-run.ts";
import type { StandaloneKind } from "./notification-summary.ts";
import type {
  CascadeNotificationMessage,
  LoadSurface,
  NotificationMessage,
  RawSurface,
  ReconcileAppliedCascadeMessage,
  RetainedWorkflowStaging,
  Severity,
  UsageErrorMessage,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";
import type { NotificationContext, SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notification-dispatch.ts -- the sole site that calls the Pi notify
 * API (IL-2). Every emission ends in the private `deliver` sink, which makes
 * exactly one notify call from the argument tuple the text strategy returns
 * (D-02). The text strategy in notification-grammar.ts supplies both the text
 * and the argument count (D-15).
 *
 * Two paths reach the sink:
 *
 *  - The structured path. `notify(ctx, run, NotificationMessage)` and the
 *    cascade emitters resolve the rows and the envelope (notification-resolve.ts),
 *    compose the body, and hand both to `formatEnvelopeArguments`. Severity is a
 *    caller-stamped per-row field, reduced to the envelope's severity at resolve
 *    time (SEV-02). The command's run supplies the soft-dep snapshot (D-05).
 *  - The raw-surface path. Each helper builds one `RawSurface` kind, which
 *    `resolveRawSurface` serializes and `formatRawSurface` turns into text
 *    (D-13). Raw kinds carry no run, so no raw call site needs one (D-01, D-04).
 *
 * The eslint per-file override in eslint.config.js disables
 * `no-restricted-syntax` for this file, so inline `eslint-disable-next-line`
 * comments are unnecessary here.
 *
 * Callers import vocabulary from `notification-types.ts` and rendering or
 * dispatch behavior directly from this file. No barrel re-exports.
 */

/** D-02: the single sink. Makes exactly one notify call from `args`. */
function deliver(ctx: NotificationContext, args: NotifyArguments): void {
  if (args.length === 1) {
    ctx.ui.notify(args[0]);
  } else {
    ctx.ui.notify(args[0], args[1]);
  }
}

function emitWithSummary(ctx: NotificationContext, envelope: ResolvedEnvelope, body: string): void {
  deliver(ctx, formatEnvelopeArguments(envelope, body));
}

/** D-02 / D-13: resolves, formats, and delivers one raw surface. */
function emitRawSurface(ctx: NotificationContext, surface: RawSurface): void {
  deliver(ctx, formatRawSurface(resolveRawSurface(surface)));
}

/** D-14: the entry point for the load-origin group of raw surfaces. */
function emitLoadSurface(ctx: NotificationContext, surface: LoadSurface): void {
  emitRawSurface(ctx, surface);
}

/**
 * RAWS-04 / D-13: reports that the load-time reconcile aborted. `cause` is the
 * live thrown value; resolve serializes it.
 */
export function notifyReconcileAborted(ctx: NotificationContext, cause: unknown): void {
  emitLoadSurface(ctx, { kind: "reconcile-aborted", cause });
}

/**
 * RAWS-04 / D-13: reports that the load pass could not refresh `scope`'s
 * plugin PATH because its install state is unreadable.
 */
export function notifyPluginPathSkipped(
  ctx: NotificationContext,
  scope: Scope,
  reason: string,
): void {
  emitLoadSurface(ctx, { kind: "plugin-path-skipped", scope, reason });
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
  softDeps: SoftDepStatus,
): void {
  // Body composition per variant. The renderers take the message and no
  // snapshot; `softDeps` feeds only the reconcile-applied arm's `resolveRows`.
  // Severity is computed off the discriminator via the shared
  // `computeSeverity` ladder.
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
      body = foldAdvisories(
        "Pending: next reload will apply 0 actions.",
        message.advisories,
        message.retainedWorkflows,
      );
      break;
    case "prune-empty":
      body = `Nothing to prune in ${message.scope} scope: no orphaned dependency installs were found.`;
      break;
    case "prune-committed-warning":
      // The resolved envelope requests the reload trailer for this kind: the
      // prune's state save succeeded, so Pi resources changed.
      body = `Prune committed in ${message.scope} scope.\n  ${causeChainTrailer(redactCauseChain(message.cause))}`;
      break;
    case "reconcile-applied-cascade":
      // RECON-04: compose the same cascade body the cascade arm renders
      // (per-mp header + per-plugin row via the existing helpers). The resolved
      // envelope never requests the reload trailer for this kind (the
      // reconcile already ran ON /reload). OUT-03/OUT-06/D-03/D-04: a reconcile
      // apply is a plural mixed-subject operation, so its envelope carries the
      // tally, exactly as on the `emitReconcileAppliedContextCascade` path.
      body = composeReconcileAppliedBody(
        resolveRows(message.marketplaces, softDeps, CENTRAL_ROW_POLICY),
      );
      break;
  }

  emitWithSummary(ctx, resolveEnvelope(message), body);
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). Severity and the reload hint are computed from
 * contents at notify time (SNM-14, SNM-15); the soft-dep snapshot is the
 * command run's (SNM-16, D-05).
 */
export function notify(
  ctx: NotificationContext,
  run: NotificationRun,
  message: NotificationMessage,
): void {
  // `resolveRows` composes the row markers from the run's snapshot (cascade
  // and reconcile-applied arms); no renderer reads it. Info messages never
  // emit soft-dep markers.
  //
  // Dispatch standalone-dispatched kinds through `dispatchInfoMessage` so the
  // cascade arm below stays under the cognitive-complexity budget. The single
  // `isInfoKind` guard (TYPE-03) is the one place that enumerates the
  // standalone set. The helper performs exactly ONE `ctx.ui.notify` call per
  // invocation (IL-2) and routes through the SAME `emitWithSummary` seam as the
  // cascade arm (GRAM-04): error/warning standalone kinds carry the summary
  // line, info kinds do not. The committed prune warning carries a reload hint.
  // After this branch, TypeScript narrows `message` to `CascadeNotificationMessage` via
  // the exhaustiveness switch below.
  if (isInfoKind(message)) {
    dispatchInfoMessage(ctx, message, run.softDeps);
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
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, CENTRAL_ROW_POLICY);
  const envelope = resolveEnvelope(message);

  // Cascade body. Caller-supplied order honored end-to-end (no internal
  // sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = marketplaces.map((mp) => composeMarketplaceBlock(mp));
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally.
  const body = foldAdvisories(composed, message.advisories, message.retainedWorkflows);

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
 * all other code must use notify(ctx, run, NotificationMessage) directly.
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
function foldAdvisories(
  body: string,
  advisories: readonly string[] | undefined,
  retainedWorkflows: readonly RetainedWorkflowStaging[] | undefined,
): string {
  const lines = [
    ...(advisories ?? []),
    ...composeRetainedWorkflowsAdvisories(retainedWorkflows ?? []),
  ];
  return lines.length === 0 ? body : `${body}\n\n${lines.join("\n")}`;
}

function composeContextBlocks(marketplaces: readonly ResolvedMarketplace[]): string[] {
  return marketplaces.map((mp) => {
    const lines = [renderMpHeader(mp)];
    for (const row of mp.plugins) {
      lines.push(...composePluginLines(row, mp.scope));
    }

    return lines.join("\n");
  });
}

function emitCascadeWith(
  ctx: NotificationContext,
  run: NotificationRun,
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  rowPolicies: RowPolicyMap,
  // WR-06: caller-composed advisory body lines. Only the plain cascade carrier
  // declares them; the reconcile-applied carrier passes `undefined`, so the
  // member stays on the two shapes that can actually produce one.
  advisories: readonly string[] | undefined,
  retainedWorkflows: readonly RetainedWorkflowStaging[] | undefined,
): void {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveEnvelope(message);
  const blocks = composeContextBlocks(marketplaces);
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally, exactly as
  // they do on the central dispatch, so a command that can emit either arm
  // renders the identical trailer from either one.
  const body = foldAdvisories(composed, advisories, retainedWorkflows);

  emitWithSummary(ctx, envelope, body);
}

/** Emits resolved command rows, advisories, and the stamped envelope. */
export function emitContextCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): void {
  emitCascadeWith(ctx, run, message, rowPolicies, message.advisories, message.retainedWorkflows);
}

/** Emits surviving rows followed by the fixed zero-update headline. */
export function emitUpdateNoOpCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): void {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveUpdateNoOpEnvelope(message);
  const blocks = composeContextBlocks(marketplaces);
  // No `(no marketplaces)` sentinel here: an empty no-op renders the headline
  // alone.
  const body = blocks.join("\n\n");

  emitWithSummary(ctx, envelope, body);
}

/** Emits an applied reconcile cascade without a reload trailer. */
export function emitReconcileAppliedContextCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: ReconcileAppliedCascadeMessage,
  rowPolicies: RowPolicyMap,
): void {
  emitCascadeWith(ctx, run, message, rowPolicies, undefined, undefined);
}
