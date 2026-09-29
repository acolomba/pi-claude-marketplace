import { buildSummaryLine, computeSeverity } from "./notification-summary.ts";

import type { NotificationMessage } from "./notification-types.ts";

/**
 * PMOD-01: the single resolve step upstream of the text strategy. It turns a
 * `NotificationMessage` into the envelope facts every emission needs before any
 * text is composed.
 *
 * D-09: the envelope is a plain readonly model. It is not the wire schema and
 * imports no schema library, so an internal refactor here never changes a wire
 * contract.
 *
 * D-10: severity and the composed summary line are resolved here, once. The
 * text strategy (`formatNotificationText` in notification-grammar.ts) reads the
 * summary line verbatim and never re-derives it.
 */

/** An envelope that emits at info severity and carries no summary line. */
export interface InfoEnvelope {
  readonly severity: "info";
}

/**
 * An envelope that emits at warning or error severity. `summary` is the
 * composed sentence the text strategy prepends as its own block (GRAM-01).
 */
export interface AttentionEnvelope {
  readonly severity: "warning" | "error";
  readonly summary: string;
}

/** The resolved envelope of one notification, discriminated by `severity`. */
export type ResolvedEnvelope = InfoEnvelope | AttentionEnvelope;

/**
 * Resolves the envelope of `message`. SEV-02 severity comes from the stamped
 * rows (or the standalone kind map); an info result carries no summary line,
 * and a warning or error result carries the D-10 summary sentence.
 */
export function resolveEnvelope(message: NotificationMessage): ResolvedEnvelope {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    return { severity: "info" };
  }

  return { severity, summary: buildSummaryLine(message, severity) };
}
