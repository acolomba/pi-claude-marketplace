import {
  buildSummaryLine,
  computeSeverity,
  countRowsBySeverity,
  shouldEmitReloadHint,
} from "./notification-summary.ts";

import type {
  CascadeNotificationMessage,
  MarketplaceNotificationMessage,
  NotificationMessage,
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
