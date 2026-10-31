import { hookDebugLog } from "./debug-log.ts";
import { resolveCommandError } from "./notification-command-error.ts";
import {
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
  renderPruneCommittedWarning,
  renderPruneEmpty,
  renderReconcilePendingEmpty,
} from "./notification-grammar.ts";
import { toWirePayload } from "./notification-json.ts";
import {
  presentCascade,
  presentNotification,
  presentReconcileApplied,
  presentUpdateNoOp,
} from "./notification-present.ts";
import { mcpConfigNoticeSurfaces, resolveRawSurface } from "./notification-resolve.ts";
import { COMMAND_DELIVERY, requireNotificationMode } from "./notification-run.ts";
import { composeRetainedWorkflowsAdvisories } from "./notification-summary.ts";

import type { CommandErrorPresentation } from "./notification-command-error.ts";
import type { NotifyArguments } from "./notification-grammar.ts";
import type { CascadePresentation, NotificationPresentation } from "./notification-present.ts";
import type {
  RowPolicyMap,
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRawSurface,
} from "./notification-resolve.ts";
import type {
  NotificationEntrySink,
  NotificationOrigin,
  NotificationRun,
  CommandRunState,
} from "./notification-run.ts";
import type {
  AutoapplyStatusSurface,
  BackgroundUpdatePlugin,
  CascadeNotificationMessage,
  DeviceFlowPrompt,
  HookSurface,
  LoadSurface,
  McpConfigNotice,
  McpMigrationReport,
  NotificationMessage,
  ReconcileAppliedCascadeMessage,
  RetainedWorkflowStaging,
  UsageErrorMessage,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";
import type { NotificationContext } from "../platform/pi-api.ts";

function isCommandOutcome(
  presentation: NotificationPresentation | ResolvedRawSurface | CommandErrorPresentation,
): boolean {
  return "envelope" in presentation
    ? isStructuredOutcome(presentation)
    : isRawOutcome(presentation);
}

function isStructuredOutcome(presentation: NotificationPresentation): boolean {
  switch (presentation.kind) {
    case "cascade":
    case "marketplace-info":
    case "plugin-info":
    case "marketplace-info-cascade":
    case "plugin-info-cascade":
    case "marketplace-not-added":
    case "reconcile-pending-empty":
    case "prune-empty":
    case "prune-committed-warning":
    case "reconcile-applied-cascade":
      return true;
  }
}

function isRawOutcome(presentation: ResolvedRawSurface | CommandErrorPresentation): boolean {
  switch (presentation.kind) {
    case "usage-error":
    case "usage-info":
    case "autoapply-status":
    case "internal-error":
      return true;
    case "diagnostic":
    case "device-flow-prompt":
    case "reconcile-aborted":
    case "plugin-path-skipped":
    case "async-rewake-summary":
    case "stop-override-cap":
    case "mcp-config-notices":
    case "mcp-migration":
    case "background-update":
      return false;
  }
}

function commandStateFor(run: NotificationRun): CommandRunState | undefined {
  switch (run.origin.kind) {
    case "command":
      return run.commandState;
    case "load":
    case "hook":
      return undefined;
  }
}

/**
 * shared/notification-dispatch.ts -- the sole site that calls the Pi notify
 * API (IL-2) and appendEntry API (JOUT-01). Text reaches `deliver`, which makes
 * exactly one notify call from the argument tuple the text strategy returns
 * (D-02). The text strategy in notification-grammar.ts supplies both the text
 * and the argument count (D-15).
 *
 * Two paths reach the sink:
 *
 *  - The structured path. Every structured emission (`notify` and the context
 *    emitters) is first presented once (notification-present.ts, JOUT-02). The
 *    text strategy composes the body from that presentation and hands it with
 *    the envelope to `formatEnvelopeArguments`; the JSON strategy
 *    (notification-json.ts) reads the same value. Severity is a caller-stamped
 *    per-row field, reduced to the envelope's severity at resolve time
 *    (SEV-02). The command's run supplies the soft-dep snapshot (D-05).
 *  - The raw-surface path. Each helper builds one `RawSurface` kind, which
 *    `resolveRawSurface` serializes before transport selection (D-13). The MCP
 *    config notice helper builds one per non-empty notice section.
 *    Usage helpers receive the command run for the entry sink (D-05-05).
 *
 * The fallow rule `architecture/notify-chokepoint` excludes this file, so it
 * needs no inline suppression.
 *
 * Callers import vocabulary from `notification-types.ts` and rendering or
 * dispatch behavior directly from this file. No barrel re-exports.
 */

/**
 * D-02 / D-15: makes exactly one notify call with the text strategy's arity.
 */
function deliver(ctx: NotificationContext, args: NotifyArguments): void {
  if (args.length === 1) {
    ctx.ui.notify(args[0]);
  } else {
    ctx.ui.notify(args[0], args[1]);
  }
}

/** Delivers a command failure without requiring an inventory snapshot. */
export function notifyCommandError(
  ctx: NotificationContext,
  entrySink: NotificationEntrySink,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
  state: CommandRunState,
  cause: unknown,
): void {
  if (state.settled || state.delivery !== COMMAND_DELIVERY.open) {
    return;
  }

  switch (requireNotificationMode(ctx.mode)) {
    case "tui":
    case "print":
      // Command handlers can throw any value; text preserves its identity.
      throw cause;
    case "json":
    case "rpc": {
      const presentation = resolveCommandError(cause, state.needsReload);
      const isOutcome = isCommandOutcome(presentation);
      appendCommand(entrySink, origin, state, toWirePayload(presentation, origin), isOutcome);
      return;
    }
  }
}

function appendEntry(sink: NotificationEntrySink, payload: ReturnType<typeof toWirePayload>): void {
  sink.appendEntry("claude-plugin", payload);
}

function appendCommand(
  sink: NotificationEntrySink,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
  state: CommandRunState,
  payload: ReturnType<typeof toWirePayload>,
  isOutcome: boolean,
): void {
  try {
    appendEntry(sink, payload);
  } catch (cause: unknown) {
    // D-08: transport failures must not enter business recovery or rollback.
    state.delivery = COMMAND_DELIVERY.recovering;
    const recovery = resolveCommandError(cause, state.needsReload);
    try {
      appendEntry(sink, toWirePayload(recovery, origin));
      state.hasOutcome = true;
      state.delivery = COMMAND_DELIVERY.open;
    } catch {
      state.delivery = COMMAND_DELIVERY.closed;
      try {
        hookDebugLog(recovery.summary);
      } catch {
        // Debug output cannot restart delivery or reject the command.
      }
    }

    return;
  }

  state.hasOutcome ||= isOutcome;
}

function emitWithSummary(ctx: NotificationContext, envelope: ResolvedEnvelope, body: string): void {
  deliver(ctx, formatEnvelopeArguments(envelope, body));
}

/** D-14: the entry point for the hook-origin group of raw surfaces. */
function emitHookSurface(
  ctx: NotificationContext,
  run: NotificationRun,
  surface: HookSurface,
): void {
  emitPresentation(ctx, run, resolveRawSurface(surface));
}

/** D-14: the entry point for the load-origin group of raw surfaces. */
function emitLoadSurface(
  ctx: NotificationContext,
  run: NotificationRun,
  surface: LoadSurface,
): void {
  emitPresentation(ctx, run, resolveRawSurface(surface));
}

/**
 * RAWS-04 / D-13: reports that the load-time reconcile aborted. `cause` is the
 * live thrown value; resolve serializes it.
 */
export function notifyReconcileAborted(
  ctx: NotificationContext,
  run: NotificationRun,
  cause: unknown,
): void {
  emitLoadSurface(ctx, run, { kind: "reconcile-aborted", cause });
}

/**
 * RAWS-04 / D-13: reports that the load pass could not refresh `scope`'s
 * plugin PATH because its install state is unreadable.
 */
export function notifyPluginPathSkipped(
  ctx: NotificationContext,
  run: NotificationRun,
  scope: Scope,
  reason: string,
): void {
  emitLoadSurface(ctx, run, { kind: "plugin-path-skipped", scope, reason });
}

/**
 * AUP-03 / D-PL8-10: reports the plugins a background update moved. An empty
 * list emits nothing, so no payload breaks the schema's one-row minimum.
 */
export function notifyBackgroundUpdate(
  ctx: NotificationContext,
  run: NotificationRun,
  plugins: readonly BackgroundUpdatePlugin[],
): void {
  if (plugins.length === 0) {
    return;
  }

  emitLoadSurface(ctx, run, { kind: "background-update", plugins });
}

/**
 * Usage error notify (ES-3 primitive). Builds the `usage-error` kind from the
 * caller's message and usage block (RAWS-01, D-06). The text strategy joins
 * them with one blank line when usage is nonempty, at `error` severity (SNM-13); that blank
 * line is part of the user contract, and
 * `test/shared/notification-dispatch.test.ts` asserts it byte-for-byte (the
 * SNM-13 case).
 */
export function notifyUsageError(
  ctx: NotificationContext,
  run: NotificationRun,
  message: UsageErrorMessage,
): void {
  emitPresentation(
    ctx,
    run,
    resolveRawSurface({
      kind: "usage-error",
      message: message.message,
      usage: message.usage,
    }),
  );
}

/**
 * Builds the `usage-info` kind for an explicit help request (RAWS-01, D-06).
 * The text strategy renders the usage verbatim at explicit `info` severity.
 */
export function notifyUsageInfo(
  ctx: NotificationContext,
  run: NotificationRun,
  usage: string,
): void {
  emitPresentation(ctx, run, resolveRawSurface({ kind: "usage-info", usage }));
}

/** AAP-04: sends what `/claude:plugin autoapply` shows, or what its set form wrote. */
export function notifyAutoapplyStatus(
  ctx: NotificationContext,
  run: NotificationRun,
  surface: AutoapplyStatusSurface,
): void {
  emitPresentation(ctx, run, resolveRawSurface(surface));
}

/**
 * S2 / PR #51: the out-of-band seam for post-cascade hygiene warnings
 * (RAWS-02).
 *
 * Surfaces post-state-commit warnings (data-dir mkdir deferred,
 * completion-cache refresh deferred, agent foreign-content preserved,
 * bridge-side soft warnings) that have no representation in the
 * `MarketplaceNotificationMessage` cascade body. The reconcile apply pass
 * collects these from `InstallPluginOutcome.postCommitWarnings` across the
 * install bucket and calls this helper once -- a sanctioned exception to the
 * per-cascade single-notify discipline (RECON-04 / IL-2) that mirrors
 * `import/execute.ts`'s `pushDiagnostic` channel.
 *
 * The producers compose the header, which counts the lines, and redact the
 * lines (D-05). This helper builds the `diagnostic` kind, and the text strategy
 * joins the header and the lines at `"warning"` severity. A zero-length line
 * list emits nothing. Standalone-mode commands swallow these per D-19-01;
 * orchestrated-mode (cascade) callers use this seam.
 */
export function notifyDiagnostic(
  ctx: NotificationContext,
  run: NotificationRun,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }

  emitPresentation(ctx, run, resolveRawSurface({ kind: "diagnostic", header, lines }));
}

/**
 * RAWS-03 / D-09: shows the Device Flow prompt as the `device-flow-prompt`
 * kind. `auth-host.ts` binds the domain's device-code callback to this helper.
 * AUTH-09: it copies the two prompt values by name, so no other member of
 * `prompt` reaches the kind. The text strategy composes the sentence at
 * explicit `"info"` severity.
 */
export function notifyDeviceFlowPrompt(
  ctx: NotificationContext,
  run: NotificationRun,
  prompt: DeviceFlowPrompt,
): void {
  emitPresentation(
    ctx,
    run,
    resolveRawSurface({
      kind: "device-flow-prompt",
      verificationUri: prompt.verificationUri,
      userCode: prompt.userCode,
    }),
  );
}

/**
 * AFILE-04 / AFILE-02 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: the one
 * surface for MCP config notices. Bridges report the facts and orchestrators
 * call this after their own row. It emits one `mcp-config-notices` kind per
 * non-empty section, in section order (comments-dropped, left-unchanged,
 * override-kept, variables-missing, credentials-blanked,
 * tool-rules-unenforced, leftover-removed), at `"warning"` severity. An empty
 * list emits nothing. The origin is the caller's run: a command, or the load
 * pass.
 */
export function notifyMcpConfigNotices(
  ctx: NotificationContext,
  run: NotificationRun,
  notices: readonly McpConfigNotice[],
): void {
  for (const surface of mcpConfigNoticeSurfaces(notices)) {
    emitPresentation(ctx, run, resolveRawSurface(surface));
  }
}

/**
 * AMIG-01 / AMIG-03 / AMIG-04: the one migration notice per reload, covering
 * both scopes, as the load-origin `mcp-migration` kind (D-14). With no row it
 * emits the notices as `notifyMcpConfigNotices` does, so a written file's
 * facts still reach the user, and with neither it emits nothing.
 */
export function notifyMcpMigration(
  ctx: NotificationContext,
  run: NotificationRun,
  report: McpMigrationReport,
): void {
  if (report.rows.length === 0) {
    notifyMcpConfigNotices(ctx, run, report.notices);
    return;
  }

  emitLoadSurface(ctx, run, { kind: "mcp-migration", rows: report.rows, notices: report.notices });
}

/**
 * T-62-09 IL-2 EXEMPTION: surfaces the `rewakeSummary` UI message from the
 * asyncRewake exit handler as the `async-rewake-summary` hook kind (RAWS-05,
 * D-08). This is the single sanctioned runtime notify originating from
 * `bridges/hooks/async-rewake/registry.ts`. The exemption exists because
 * `rewakeSummary` is the upstream Claude-Code-mandated UI status surface
 * declared in the plugin author's hook handler, and the hooks bridge has no
 * structured `NotificationMessage` arm for it (HOOK-06).
 *
 * The text strategy renders the summary verbatim at `"info"` severity. A
 * zero-length summary emits nothing, so the caller can pass an
 * `entry.rewakeSummary` field without a guard.
 */
export function notifyAsyncRewakeSummary(
  ctx: NotificationContext,
  run: NotificationRun,
  summary: string,
): void {
  if (summary.length === 0) {
    return;
  }

  emitHookSurface(ctx, run, { kind: "async-rewake-summary", summary });
}

/**
 * STOP-07 / D-88-01 IL-2 bridge seam: the one-shot Stop-hook override-cap
 * warning, built as the `stop-override-cap` hook kind (RAWS-05). The settle
 * dispatcher (`bridges/hooks/settle.ts`) calls this exactly once when Stop
 * hooks drive `cap` consecutive bridge re-entries -- block decisions and
 * additionalContext continuations share one consecutive re-entry counter
 * (D-88-08). The loop protection suppresses that re-entry, and this warning
 * makes a livelocking hook visible to the user rather than silently overridden
 * (the transparency prohibition behind D-88-01). Warning severity per the
 * tri-state model: the turn DID end (the protection worked) but the plugin's
 * block desire was deliberately suppressed, so the user should notice.
 *
 * `cap` is the settle bridge's own re-entry cap, so the warning states the
 * number that tripped it (D-07). The text strategy composes a non-empty summary
 * first line ("Stop hook override cap reached.") and, after a `\n\n`
 * separator, a detail block naming the plugin and the cap. The host UI prepends
 * the `Warning:` label to the summary line. The byte form is locked by
 * `test/architecture/hooks-cap-notify.test.ts` against the
 * `stop-override-cap` block in `docs/output-catalog.md`.
 */
export function notifyStopHookOverrideCap(
  ctx: NotificationContext,
  run: NotificationRun,
  pluginId: string,
  cap: number,
): void {
  emitHookSurface(ctx, run, { kind: "stop-override-cap", pluginId, cap });
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). The presentation step resolves severity, the summary
 * line, and the reload decision once (SNM-14, SNM-15, GRAM-04); the soft-dep
 * snapshot is the command run's (SNM-16, D-05). The text strategy then formats
 * that presentation.
 */
export function notify(
  ctx: NotificationContext,
  run: NotificationRun,
  message: NotificationMessage,
): void {
  emitPresentation(ctx, run, presentNotification(run, message));
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

/**
 * One text block per marketplace: its header, then its plugin lines. It writes
 * the same lines as grammar's `composeMarketplaceBlock`; the dispatch and
 * notify-context owner suites pin the bytes.
 */
function composeContextBlocks(marketplaces: readonly ResolvedMarketplace[]): string[] {
  return marketplaces.map((mp) => {
    const lines = [renderMpHeader(mp)];
    for (const row of mp.plugins) {
      lines.push(...composePluginLines(row, mp.scope));
    }

    return lines.join("\n");
  });
}

/**
 * JOUT-02: the text strategy's format of a cascade presentation. Caller-supplied
 * order is honored end-to-end (no internal sort), with one blank line between
 * marketplace blocks. An empty cascade renders the `(no marketplaces)`
 * sentinel; an empty no-op body is the empty string, so the no-op headline
 * prints alone (UGRM-01). WR-06: advisory body lines sit between the body and
 * the tally, so a command that can emit either cascade arm renders the
 * identical trailer from either one.
 */
function formatCascadePresentation(presentation: CascadePresentation): string {
  const blocks = composeContextBlocks(presentation.marketplaces);
  const composed =
    blocks.length === 0 && !presentation.envelope.noOp ? "(no marketplaces)" : blocks.join("\n\n");
  return foldAdvisories(composed, presentation.advisories, presentation.retainedWorkflows);
}

/**
 * JOUT-02: the text strategy's body of one presentation. Each body is composed
 * by the grammar renderers; the committed prune warning's renderer formats its
 * serialized cause.
 */
function formatPresentationBody(presentation: NotificationPresentation): string {
  switch (presentation.kind) {
    case "cascade":
      return formatCascadePresentation(presentation);
    case "reconcile-applied-cascade":
      return composeReconcileAppliedBody(presentation.marketplaces);
    case "marketplace-info":
      return renderMarketplaceInfo(presentation.message);
    case "plugin-info":
      return renderPluginInfo(presentation.message);
    case "marketplace-info-cascade":
      return renderMarketplaceInfoCascade(presentation.message);
    case "plugin-info-cascade":
      return renderPluginInfoCascade(presentation.message);
    case "marketplace-not-added":
      return renderMarketplaceNotAdded(presentation.message, presentation.reason);
    case "reconcile-pending-empty":
      return foldAdvisories(
        renderReconcilePendingEmpty(presentation.message.command),
        presentation.message.advisories,
        presentation.message.retainedWorkflows,
      );
    case "prune-empty":
      return renderPruneEmpty(presentation.message);
    case "prune-committed-warning":
      return renderPruneCommittedWarning(presentation.scope, presentation.cause);
  }
}

/**
 * MODE-01: selects transport from the live context for each presentation.
 */
function emitPresentation(
  ctx: NotificationContext,
  run: NotificationRun,
  presentation: NotificationPresentation | ResolvedRawSurface,
): void {
  const state = commandStateFor(run);
  if (state?.settled || (state !== undefined && state.delivery !== COMMAND_DELIVERY.open)) {
    return;
  }

  if (state !== undefined && "envelope" in presentation) {
    state.needsReload ||= presentation.envelope.needsReload;
  }

  switch (requireNotificationMode(ctx.mode)) {
    case "tui":
    case "print":
      if ("envelope" in presentation) {
        emitWithSummary(ctx, presentation.envelope, formatPresentationBody(presentation));
      } else {
        // Usage, load warnings, device prompts, and nonempty diagnostics produce a tuple.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- empty diagnostics return before transport selection
        const args = formatRawSurface(presentation)!;
        deliver(ctx, args);
      }

      return;
    case "json":
    case "rpc": {
      const isOutcome = isCommandOutcome(presentation);
      const payload = toWirePayload(presentation, run.origin);
      switch (run.origin.kind) {
        case "command":
          if (state !== undefined) {
            appendCommand(run.entrySink, run.origin, state, payload, isOutcome);
            return;
          }

          break;
        case "load":
        case "hook":
          break;
      }

      appendEntry(run.entrySink, payload);
      return;
    }
  }
}

/** Emits resolved command rows, advisories, and the stamped envelope. */
export function emitContextCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): void {
  emitPresentation(ctx, run, presentCascade(run, message, rowPolicies));
}

/** Emits surviving rows followed by the fixed zero-update headline. */
export function emitUpdateNoOpCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): void {
  emitPresentation(ctx, run, presentUpdateNoOp(run, message, rowPolicies));
}

/** Emits an applied reconcile cascade without a reload trailer. */
export function emitReconcileAppliedContextCascade(
  ctx: NotificationContext,
  run: NotificationRun,
  message: ReconcileAppliedCascadeMessage,
  rowPolicies: RowPolicyMap,
): void {
  emitPresentation(ctx, run, presentReconcileApplied(run, message, rowPolicies));
}
