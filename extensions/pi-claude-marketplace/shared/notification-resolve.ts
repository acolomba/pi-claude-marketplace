import { hookDebugLog } from "./debug-log.ts";
import { errorMessage, manualRecoveryLeaks, serializeCauseChain } from "./errors.ts";
import {
  buildSummaryLine,
  computeSeverity,
  countRowsBySeverity,
  shouldEmitReloadHint,
} from "./notification-summary.ts";

import type { SerializedCauseChain } from "./errors.ts";
import type {
  CascadeNotificationMessage,
  MarketplaceNotificationMessage,
  NotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
  WithPlugins,
} from "./notification-types.ts";

/**
 * PMOD-01: the single resolve step upstream of the text strategy. It turns a
 * `NotificationMessage` into the envelope facts every emission needs before any
 * text is composed.
 *
 * D-09: the envelope is a plain readonly model. It is not the wire schema and
 * imports no schema library, so an internal refactor here never changes a wire
 * contract.
 *
 * D-10: severity, the composed summary line, `needsReload`, the numeric tally,
 * and the update no-op flag are resolved here, once. The text strategy
 * (`formatNotificationText` in notification-grammar.ts) reads the summary line
 * verbatim and composes the tally sentence, the no-op headline, and the reload
 * trailer from these facts.
 *
 * D-11: `resolveRows` serializes each failed row's cause chain, manual-recovery
 * leaks, and rollback phases here, once. No resolved row carries a live
 * `Error`, so the text strategy formats failure detail without walking one.
 */

/**
 * OUT-03 / UGRM-02: the success category of a tally. Without `verb` it renders
 * as `success` / `successes`; with one (the update override) it renders the
 * verb for every count.
 */
export interface ResolvedTallySuccess {
  readonly count: number;
  readonly verb?: string;
}

/**
 * OUT-03 / OUT-04: the trailing per-operation tally of a plural cascade.
 * `label` is the operation name. A zero `failures` or `warnings` count and an
 * absent `success` each omit their category.
 */
export interface ResolvedTally {
  readonly label: string;
  readonly failures: number;
  readonly warnings: number;
  readonly success?: ResolvedTallySuccess;
}

/** An envelope that emits at info severity and carries no summary line. */
export interface InfoEnvelope {
  readonly severity: "info";
  readonly needsReload: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/**
 * An envelope that emits at warning or error severity. `summary` is the
 * composed sentence the text strategy prepends as its own block (GRAM-01).
 */
export interface AttentionEnvelope {
  readonly severity: "warning" | "error";
  readonly summary: string;
  readonly needsReload: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/** The resolved envelope of one notification, discriminated by `severity`. */
export type ResolvedEnvelope = InfoEnvelope | AttentionEnvelope;

/** The severity-independent envelope facts. */
interface EnvelopeFacts {
  readonly needsReload: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/** The severity and summary line of a warning or error envelope. */
interface Attention {
  readonly severity: "warning" | "error";
  readonly summary: string;
}

/** The message fields the tally reads. */
interface TallySource {
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly tally?: { readonly verb: string; readonly count: number };
}

/**
 * Resolves the envelope of `message`. SEV-02 severity comes from the stamped
 * rows (or the standalone kind map); an info result carries no summary line,
 * and a warning or error result carries the D-10 summary sentence.
 * `needsReload` is the RLD-02 OR-reduce of the row stamps, which is false for
 * every standalone kind. Only a cascade and a `reconcile-applied-cascade` carry
 * a tally.
 */
export function resolveEnvelope(message: NotificationMessage): ResolvedEnvelope {
  // Severity and the summary line resolve before the reload and tally facts.
  // Every step reads `message.kind`, and the dispatch tests pin the bytes a
  // getter-backed `kind` yields under this read order.
  const attention = resolveAttention(message);
  const needsReload = shouldEmitReloadHint(message);
  const tally =
    message.kind === undefined ||
    message.kind === "cascade" ||
    message.kind === "reconcile-applied-cascade"
      ? resolveTally(message)
      : undefined;

  return assembleEnvelope(
    attention,
    tally === undefined ? { needsReload, noOp: false } : { needsReload, noOp: false, tally },
  );
}

/**
 * UGRM-01: resolves the envelope of a bulk update that realized no transition.
 * Severity and the summary line resolve as for any cascade. The no-op headline
 * takes the tally's place, so there is no tally and no reload trailer.
 */
export function resolveUpdateNoOpEnvelope(message: CascadeNotificationMessage): ResolvedEnvelope {
  return assembleEnvelope(resolveAttention(message), { needsReload: false, noOp: true });
}

/** The severity and summary line of `message`, or `undefined` at info. */
function resolveAttention(message: NotificationMessage): Attention | undefined {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    return undefined;
  }

  return { severity, summary: buildSummaryLine(message, severity) };
}

function assembleEnvelope(
  attention: Attention | undefined,
  facts: EnvelopeFacts,
): ResolvedEnvelope {
  return attention === undefined ? { ...facts, severity: "info" } : { ...facts, ...attention };
}

/**
 * OUT-03 / OUT-04 / D-04: the tally of a structurally PLURAL cascade. It is
 * absent for a single-target operation (never a row-count heuristic), for a
 * message with no operation label, and when no category is present. Per OUT-03
 * the tally resolves at every severity, so a successful bulk import still
 * reports `Plugin import: 3 successes`.
 *
 * D-03: failures and warnings count the marketplace rows AND the plugin rows
 * whose stamped severity is error or warning, uniformly across both subjects.
 */
function resolveTally(message: TallySource): ResolvedTally | undefined {
  if (message.cardinality !== "plural" || message.label === undefined) {
    return undefined;
  }

  const errorCount = countRowsBySeverity(message.marketplaces, "error");
  const warningCount = countRowsBySeverity(message.marketplaces, "warning");
  const failures = errorCount.plugins + errorCount.marketplaces;
  const warnings = warningCount.plugins + warningCount.marketplaces;
  const success = resolveTallySuccess(message, failures + warnings);

  if (success !== undefined) {
    return { label: message.label, failures, warnings, success };
  }

  if (failures === 0 && warnings === 0) {
    return undefined;
  }

  return { label: message.label, failures, warnings };
}

/**
 * The success category of the tally, or `undefined` when it is omitted.
 * `otherCount` is the number of failure and warning rows.
 */
function resolveTallySuccess(
  message: TallySource,
  otherCount: number,
): ResolvedTallySuccess | undefined {
  if (message.tally !== undefined) {
    // UGRM-02: the update override owns the success category. Its count is
    // realized transitions only, and a count of 0 contributes nothing: the
    // never-silent no-op headline is the orchestrator's job, so a failure-only
    // cascade stays e.g. `1 failure`.
    return message.tally.count > 0
      ? { count: message.tally.count, verb: message.tally.verb }
      : undefined;
  }

  // OUT-03 / OUT-06 / D-03: the default success count covers OPERATION rows.
  // A BARE marketplace header -- one with neither a `status` (a realized
  // marketplace outcome) nor a stamped `severity` -- is a grouping label, not an
  // operation, so it does not count. The `info` row count includes bare headers
  // through its `?? "info"` default, so subtract them. A marketplace row WITH a
  // `status` is a real marketplace operation and counts.
  const successRows = countRowsBySeverity(message.marketplaces, "info");
  const bareHeaders = message.marketplaces.filter(
    (mp) => mp.severity === undefined && mp.status === undefined,
  ).length;
  const count = successRows.plugins + successRows.marketplaces - bareHeaders;

  // An empty result omits the success category. A populated result with no
  // other category reports zero successes.
  if (count > 0 || (message.marketplaces.length > 0 && otherCount === 0)) {
    return { count };
  }

  return undefined;
}

/** D-11: one rollback phase that failed to undo, with its serialized cause. */
export interface ResolvedRollbackPhase {
  readonly phase: string;
  readonly cause?: SerializedCauseChain;
}

/**
 * D-11 / PMOD-03: the failure detail of a failed or manual-recovery row.
 * `cause` is absent when the row carries no cause. `leaks` names the paths the
 * user must clean up by hand. `rollbackPartial` lists the phases whose undo
 * failed; it is empty on a manual-recovery row.
 */
export interface ResolvedFailure {
  readonly cause?: SerializedCauseChain;
  readonly leaks: readonly string[];
  readonly rollbackPartial: readonly ResolvedRollbackPhase[];
}

/** The per-row facts `resolveRows` adds to a producer row. */
export interface ResolvedRowFacts {
  readonly failure?: ResolvedFailure;
}

/**
 * A producer row with its live failure detail replaced by resolved facts. The
 * conditional distributes over the row union, so each member keeps its own
 * `status` discriminant.
 */
export type ResolvedRow<M extends PluginNotificationMessage = PluginNotificationMessage> =
  M extends unknown ? Omit<M, "cause" | "rollbackPartial"> & ResolvedRowFacts : never;

/** A marketplace row whose plugin rows are resolved. */
export type ResolvedMarketplace = WithPlugins<MarketplaceNotificationMessage, ResolvedRow>;

/**
 * A writable view of a row's own `severity` slot. The slot's type is read off
 * the declared field rather than spelled again here, so a change to the
 * severity vocabulary reaches the one localized write in `resolveRows` instead
 * of being asserted past by a hand-written literal. A mapped type declares no
 * members of its own.
 */
type WritableRowSeverity = { -readonly [K in "severity"]?: PluginNotificationMessage[K] };

/**
 * Resolves the plugin rows of `marketplaces` before any text is composed.
 *
 * WR-02 / SEV-02: when `hasRenderArm` reports that a row's status has no
 * render arm, the row is an internal-drift error. `resolveRows` stamps
 * `severity: "error"` on the INPUT row, so the envelope, which MAX-reduces the
 * same row objects, floors at error. A frozen out-of-band row rejects the
 * write; it keeps its stamped severity, and the rejection goes to the debug
 * log so the throw cannot escape the single `ctx.ui.notify` seam.
 *
 * D-11: each resolved row is a new object without `cause` and
 * `rollbackPartial`. A failed or manual-recovery row gains a `failure` member
 * that holds the serialized cause chain, the manual-recovery leaks, and the
 * rollback phases. No other key is added, so a row the producer left without a
 * `name` stays without one.
 */
export function resolveRows(
  marketplaces: readonly MarketplaceNotificationMessage[],
  hasRenderArm?: (status: string) => boolean,
): readonly ResolvedMarketplace[] {
  return marketplaces.map((mp) => ({
    ...mp,
    plugins: mp.plugins.map((row) => {
      if (hasRenderArm !== undefined && !hasRenderArm(row.status)) {
        floorMissingArmSeverity(row);
      }

      return resolveRow(row);
    }),
  }));
}

function floorMissingArmSeverity(row: PluginNotificationMessage): void {
  // The field is declared `readonly`; this single localized write is the seam
  // that lets a row with no render arm contribute its severity.
  try {
    (row as WritableRowSeverity).severity = "error";
  } catch (err) {
    // A frozen/sealed out-of-band row rejects the write in ESM strict mode.
    // Keep whatever severity was already stamped.
    hookDebugLog(`resolveRows: severity write rejected for frozen row: ${errorMessage(err)}`);
  }
}

function resolveRow(row: PluginNotificationMessage): ResolvedRow {
  if (row.status === "failed") {
    const { cause, rollbackPartial, ...rest } = row;
    return { ...rest, failure: resolveFailure(cause, rollbackPartial ?? []) };
  }

  if (row.status === "manual recovery") {
    const { cause, ...rest } = row;
    return { ...rest, failure: resolveFailure(cause, []) };
  }

  return { ...row };
}

function resolveFailure(
  cause: Error | undefined,
  rollbackPartial: NonNullable<PluginFailedMessage["rollbackPartial"]>,
): ResolvedFailure {
  const chain = serializeCauseChain(cause);
  return {
    ...(chain === undefined ? {} : { cause: chain }),
    leaks: manualRecoveryLeaks(cause),
    rollbackPartial: rollbackPartial.map((entry) => {
      const phaseChain = serializeCauseChain(entry.cause);
      return phaseChain === undefined
        ? { phase: entry.phase }
        : { phase: entry.phase, cause: phaseChain };
    }),
  };
}
