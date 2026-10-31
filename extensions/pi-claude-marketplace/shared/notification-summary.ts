import { redactAbsolutePaths } from "./redact-absolute-paths.ts";

import type {
  CascadeNotificationMessage,
  MarketplaceNotificationMessage,
  NotificationMessage,
  RetainedWorkflowStaging,
  Severity,
} from "./notification-types.ts";

/** Severity, tally, reload, and cascade-summary folding for notifications. */

/**
 * TYPE-03 / D-46-04: the closed set of STANDALONE-DISPATCHED message kinds --
 * the 4 read-only info surfaces (`marketplace-info`, `plugin-info`,
 * `marketplace-info-cascade`, `plugin-info-cascade`) PLUS the
 * `marketplace-not-added` failure variant. Enumerated in EXACTLY ONE place so
 * that adding a future standalone kind is a single-site edit here that
 * surfaces as a type and lint error at every consumer's switch.
 *
 * The guard name is kept as `isInfoKind` per the TYPE-03 wording even though
 * the set now includes a failure kind; "standalone-dispatched" is the precise
 * meaning -- these kinds take their own arm in the presentation step and in its
 * text formatter. The committed prune warning requests reload because its
 * state save succeeded.
 */
type StandaloneKind =
  | "marketplace-info"
  | "plugin-info"
  | "marketplace-info-cascade"
  | "plugin-info-cascade"
  | "marketplace-not-added"
  | "reconcile-pending-empty"
  | "prune-empty"
  | "prune-committed-warning"
  | "reconcile-applied-cascade";

/**
 * Single-source type-predicate for the standalone-dispatched kinds
 * (TYPE-03 / D-46-04). All four consumers (`computeSeverity`,
 * `buildSummaryLine`, `shouldEmitReloadHint`, the `notify()` early-dispatch)
 * route through this one guard; each then narrows the residual to
 * `CascadeNotificationMessage` and switches over every kind with no default.
 */
function isInfoKind(
  m: NotificationMessage,
): m is Extract<NotificationMessage, { kind: StandaloneKind }> {
  return (
    m.kind === "marketplace-info" ||
    m.kind === "plugin-info" ||
    m.kind === "marketplace-info-cascade" ||
    m.kind === "plugin-info-cascade" ||
    m.kind === "marketplace-not-added" ||
    m.kind === "reconcile-pending-empty" ||
    m.kind === "prune-empty" ||
    m.kind === "prune-committed-warning" ||
    m.kind === "reconcile-applied-cascade"
  );
}

// ---------------------------------------------------------------------------
// Envelope facts over the stamped rows. notification-resolve.ts turns these
// into the resolved envelope; notification-grammar.ts owns the wire format.
//
// Severity (SEV-02): the numeric MAX over the caller-stamped `row.severity`
// (info=0 < warning=1 < error=2) across the marketplace rows AND their plugin
// rows; rank 0 -> undefined (info, no 2nd arg). No status/reasons inference.
//
// Reload decision (RLD-02): the OR-reduce of the caller-stamped
// `row.needsReload` over the same flattened rows. Realized transitions
// (install/update/reinstall/uninstall + the fresh-disable) stamp
// needsReload:true; inventory rows stamp false. No marketplace-status /
// cascade-kind inference: the decision is a per-row stamped fact. Info-surface
// kinds short-circuit to false; reconcile-applied-cascade reads its rows like a
// cascade does.
// ---------------------------------------------------------------------------

/**
 * SEV-03: the desired-state tri-state contract every producer stamps on a row:
 *   - `info`    = the resource reached the desired state (success / steady
 *                 inventory / benign idempotent no-op);
 *   - `warning` = the command fell short of the desired state but did not
 *                 crash (an actionable skip, a manual-recovery anchor);
 *   - `error`   = the command could not carry out the desired state (a failure).
 * `notify()` does NOT re-derive these from content -- it reduces the stamped
 * facts (SEV-02).
 */

/** Numeric rank for the SEV-02 max-severity reduce: info < warning < error. */
const SEVERITY_RANK = { info: 0, warning: 1, error: 2 } as const;

type ComputedSeverity = "warning" | "error" | undefined;

/**
 * SEV-02: the cascade severity is the numeric MAX over the caller-stamped
 * `severity` of every row -- both the marketplace-level rows AND their nested
 * plugin rows. An absent `severity` defaults to `info` (rank 0) per SEV-01. The reducer reads
 * ONLY the stamped field -- no `status`/`reasons` content inference. Rank 0
 * returns `undefined` (info -> no 2nd `ctx.ui.notify` arg); rank 1 -> "warning";
 * rank 2 -> "error", preserving the `ComputedSeverity` host-arg contract. The
 * D-03 producer stamps are gated by catalog-uat.
 *
 * Structural-subset typed so any message whose `marketplaces[]` carries the
 * `(severity?, plugins[].severity?)` shape can be evaluated (the cascade arm and
 * the RECON-04 `reconcile-applied-cascade` standalone arm share it).
 */
function cascadeSeverity(message: {
  readonly marketplaces: readonly {
    readonly severity?: Severity;
    readonly plugins: readonly {
      readonly severity?: Severity;
    }[];
  }[];
}): ComputedSeverity {
  let rank = 0; // info
  for (const mp of message.marketplaces) {
    rank = Math.max(rank, SEVERITY_RANK[mp.severity ?? "info"]);
    for (const p of mp.plugins) {
      rank = Math.max(rank, SEVERITY_RANK[p.severity ?? "info"]);
    }
  }

  if (rank === 0) {
    return undefined;
  }

  return rank === 1 ? "warning" : "error";
}

/**
 * SEV-02: the severity of `message`, as the second `ctx.ui.notify` argument
 * wants it. `undefined` means info.
 */
export function computeSeverity(message: NotificationMessage): "warning" | "error" | undefined {
  // SEV-02: the cascade severity is the MAX over the rows' caller-stamped
  // `severity` (see `cascadeSeverity`), NOT content inference.
  //
  // The standalone info-kind switch below STAYS (Q1 LOCKED): these kinds carry
  // no per-row `severity` array to reduce, so they keep a tiny kind->severity
  // map (a kind lookup, NOT reason inference, so SEV-02 holds).
  // INFO-04 / SC#2 / INFO-03 / INFO-02: info-surface kinds take precedence
  // over the cascade reduce.
  // `marketplace-info` payloads carry no failure state and route to info
  // (undefined 2nd arg); `plugin-info` payloads route to `"error"` ONLY when
  // the embedded plugin row is `(failed)` (e.g. an unreadable manifest), else
  // info; `marketplace-info-cascade` AND `plugin-info-cascade` payloads route
  // to info unconditionally -- no failure can be expressed on a fan-out
  // wrapper. The `{marketplace not added}` --scope mismatch condition is carried by the
  // dedicated `marketplace-not-added` arm, which always routes to `"error"`.
  if (isInfoKind(message)) {
    // The `marketplace-not-added` variant routes to "error" (the marketplace
    // is absent -- a failure surface); `plugin-info` routes to "error" only
    // when its embedded row is `(failed)`; the read-only info/cascade kinds
    // carry no failure state and route to info (undefined).
    // `reconcile-applied-cascade` (RECON-04) carries the same stamped
    // `MarketplaceNotificationMessage[]` rows as the plain cascade, so it
    // reduces through the SEV-02 max-severity reducer too.
    switch (message.kind) {
      case "marketplace-not-added":
        return "error";
      case "plugin-info":
        return message.plugin.status === "failed" ? "error" : undefined;
      case "reconcile-applied-cascade":
        return cascadeSeverity(message);
      case "prune-committed-warning":
        return "warning";
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
      case "prune-empty":
        // DIFF-01 SC #2: the empty-steady-state advisory is read-only / info.
        return undefined;
    }
  }

  // Cascade arm: reduce the stamped row severities (SEV-02).
  return cascadeSeverity(message);
}

/**
 * The plugin/marketplace operation counts that drive the summary line and the
 * resolved tally.
 */
export interface SummaryCounts {
  readonly plugins: number;
  readonly marketplaces: number;
}

/**
 * `error`-severity counting (D-29-04): failed plugin rows (summed across all
 * marketplaces) and failed marketplace rows. Mirrors `computeSeverity` arm 1.
 * Cascade-only (SC#1): the parameter is narrowed to
 * `CascadeNotificationMessage` -- info-surface kinds do not invoke
 * `buildSummaryLine` (see `notify()` dispatcher and `buildSummaryLine`'s
 * defensive short-circuit).
 */
function countFailedOperations(message: CascadeNotificationMessage): SummaryCounts {
  return countFailedRows(message.marketplaces);
}

/**
 * SEV-02: error-severity tally by stamped fact -- the marketplace rows AND
 * plugin rows whose caller-stamped `severity === "error"`. The D-03 stamps map
 * `failed` rows to `error`. Consumed by both the cascade arm and the RECON-04
 * `reconcile-applied-cascade` standalone arm.
 */
function countFailedRows(marketplaces: readonly MarketplaceNotificationMessage[]): SummaryCounts {
  return countRowsBySeverity(marketplaces, "error");
}

/**
 * `warning`-severity counting consumed by the summary line. Cascade-only (SC#1;
 * see `countFailedOperations`).
 */
function countSkippedOperations(message: CascadeNotificationMessage): SummaryCounts {
  return countSkippedRows(message.marketplaces);
}

/**
 * SEV-02: warning-severity tally by stamped fact -- the rows whose caller-
 * stamped `severity === "warning"`. The D-03 stamps map actionable skips and
 * manual-recovery anchors to `warning`; benign idempotent skips stamp `info`.
 */
function countSkippedRows(marketplaces: readonly MarketplaceNotificationMessage[]): SummaryCounts {
  return countRowsBySeverity(marketplaces, "warning");
}

/**
 * Shared tally of marketplace rows AND their nested plugin rows whose stamped
 * `severity` equals `target`. An absent `severity` defaults to `info` (SEV-01),
 * so an absent-severity row is counted under the `"info"` target.
 *
 * OUT-03: the `target` union includes `"info"` so the trailing tally can count
 * `<n> success(es)` (the desired-state-reached rows) alongside the existing
 * error/warning counts -- the `(x.severity ?? "info") === target` predicate
 * already classifies an absent or explicit `info` severity, so widening the
 * union needs no further change.
 */
export function countRowsBySeverity(
  marketplaces: readonly MarketplaceNotificationMessage[],
  target: Severity,
): SummaryCounts {
  let plugins = 0;
  let mpCount = 0;

  for (const mp of marketplaces) {
    if ((mp.severity ?? "info") === target) {
      mpCount++;
    }

    plugins += mp.plugins.filter((p) => (p.severity ?? "info") === target).length;
  }

  return { plugins, marketplaces: mpCount };
}

/**
 * OUT-02 / D-02: build the leading severity sentence from a row count, the max
 * severity, and the row subject. `subject` is `"plugin"` / `"marketplace"` for a
 * homogeneous cascade, or `null` for a mixed-subject cascade (D-03) where the
 * subject noun is dropped.
 *
 * Form: `[A|An|Some] <subject> operation[s] has/have failed | needs/need attention.`
 * -- `A` / `An` (vowel-aware off the leading noun) for a single row, `Some` for
 * more than one; `operation` / `operations`
 * pluralized by count; `has failed` / `have failed` for error and
 * `needs attention` / `need attention` for warning; terminal period kept. The
 * verb-number agrees with the count (singular for 1, plural otherwise).
 */
function summaryPhrase(
  count: number,
  severity: "error" | "warning",
  subject: "plugin" | "marketplace" | null,
): string {
  const singular = count === 1;
  const operationWord = singular ? "operation" : "operations";
  const errorVerb = singular ? "has failed" : "have failed";
  const warningVerb = singular ? "needs attention" : "need attention";
  const verbPhrase = severity === "error" ? errorVerb : warningVerb;
  const subjectWord = subject === null ? "" : `${subject} `;
  const noun = `${subjectWord}${operationWord}`;
  // CR-01: mixed-subject (subject === null) drops the noun, so the count-1 form
  // would read "A operation" -- vowel-initial, grammatically "An". Choose the
  // singular article off the resolved noun's leading letter; "Some" for plural.
  const singularArticle = /^[aeiou]/i.test(noun) ? "An" : "A";
  const article = singular ? singularArticle : "Some";
  return `${article} ${noun} ${verbPhrase}.`;
}

/**
 * RECON-04: shared summary-line wording over a marketplaces array. Mirrors
 * the cascade-arm tail of `buildSummaryLine` so the reconcile-applied
 * variant emits identical phrasing.
 *
 * D-03: mixed-subject detection is render-time -- a cascade whose rows span
 * BOTH plugin and marketplace subjects (`counts.plugins > 0 &&
 * counts.marketplaces > 0`) drops the subject noun and counts all rows
 * uniformly off the combined total.
 */
function buildSummaryLineForCascade(
  marketplaces: readonly MarketplaceNotificationMessage[],
  severity: "error" | "warning",
): string {
  const counts =
    severity === "error" ? countFailedRows(marketplaces) : countSkippedRows(marketplaces);

  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return summaryPhrase(counts.plugins + counts.marketplaces, severity, null);
  }

  if (counts.marketplaces > 0) {
    return summaryPhrase(counts.marketplaces, severity, "marketplace");
  }

  return summaryPhrase(counts.plugins, severity, "plugin");
}

/**
 * UXG-07 / GRAM-01 / GRAM-02 (D-29-02/03/04): build the human-readable summary
 * line for `error` and `warning` severity. `resolveEnvelope`
 * (notification-resolve.ts) carries it, and the text strategy prepends it
 * before the body. It gives the host `Error:` / `Warning:` prefix a
 * meaningful, contextual sentence to introduce ("focus on the operation, not
 * what happened to each plugin -- the body already shows that").
 *
 * Invoked for BOTH the cascade arm and the standalone arm (GRAM-04): the two
 * error-severity standalone kinds (`marketplace-not-added`, failed
 * `plugin-info`) take a hard-count-1 summary on the FAILED ROW's subject
 * (GRAM-02); the cascade arm counts the failed/skipped rows.
 *
 * Wording (OUT-02 / D-02): `[A|Some] <subject> operation[s] has/have failed |
 * needs/need attention.` -- `A` for a single row, `Some` otherwise; `has failed`
 * / `have failed` for error and `needs attention` / `need attention` for
 * warning. D-03: a mixed-subject cascade (plugin AND marketplace rows present)
 * drops the subject noun and counts all rows uniformly. When BOTH counts are
 * zero (an unreachable shape -- `computeSeverity` only returns error/warning
 * when a matching row exists) the function degrades gracefully to the
 * plugin-only plural form rather than crashing.
 */
export function buildSummaryLine(
  message: NotificationMessage,
  severity: "error" | "warning",
): string {
  // GRAM-02: the standalone-dispatched kinds derive their summary from the
  // FAILED ROW's subject, not the invoking command. The two error-severity
  // standalone kinds carry a hard-count-1 summary (one absent marketplace /
  // one failed plugin row); the read-only info/cascade kinds and a non-failed
  // `plugin-info` carry NO summary (they route through the info arm of the
  // emission helper and never reach the summary path). Narrowed through the
  // single `isInfoKind` guard so a future StandaloneKind without a summary arm
  // is a compile error.
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-not-added":
        return summaryPhrase(1, "error", "marketplace");
      case "plugin-info":
        return message.plugin.status === "failed" ? summaryPhrase(1, "error", "plugin") : "";
      case "reconcile-applied-cascade":
        // RECON-04: at error/warning severity reuse the cascade-arm counting
        // helpers over the same per-status `marketplaces` shape; at info
        // severity `resolveEnvelope` does not call buildSummaryLine, so the
        // empty arm below is unreachable in practice.
        return buildSummaryLineForCascade(message.marketplaces, severity);
      case "prune-committed-warning":
        return "Prune committed; finalization needs attention.";
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
      case "prune-empty":
        // DIFF-01 SC #2: info-severity / read-only -- no summary semantics.
        return "";
    }
  }

  const counts =
    severity === "error" ? countFailedOperations(message) : countSkippedOperations(message);

  // D-03: mixed-subject cascade drops the noun and counts all rows uniformly.
  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return summaryPhrase(counts.plugins + counts.marketplaces, severity, null);
  }

  if (counts.marketplaces > 0) {
    return summaryPhrase(counts.marketplaces, severity, "marketplace");
  }

  // counts.plugins > 0, or the unreachable 0/0 degrade-to-plugin-plural case.
  return summaryPhrase(counts.plugins, severity, "plugin");
}

/**
 * OUT-03: pluralize one tally category by count. Mirrors the `summaryPhrase`
 * `count === 1 ? singular : plural` idiom: `failure`/`failures`,
 * `warning`/`warnings`, `success`/`successes`.
 */
export function tallyCategory(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * WR-06: one advisory body line per workflow staging tree the sweeper keeps
 * forever, in the caller's order.
 *
 * The tree holds displaced envelopes: the only surviving copy of the user's
 * previous workflow scripts. It sits outside every scope root, so uninstall and
 * a reload cannot reach it, and no other surface names it.
 *
 * T-53-02-02: the line carries the directory NAME and states the containing
 * location as fixed text. It interpolates no absolute path -- the surface that
 * renders this already carries basenames rather than paths for the same
 * information-disclosure reason, and a machine-specific absolute path could not
 * be pinned by a byte-equality fixture at all.
 *
 * WR-05: the count is omitted, never rendered as zero, when the reader could not
 * establish it. A tree is reported on the same open question that keeps it, and
 * a count nobody read is not a fact the line may state.
 */
export function composeRetainedWorkflowsAdvisories(
  retained: readonly RetainedWorkflowStaging[],
): readonly string[] {
  return retained.map((tree) => {
    const count = tree.envelopeCount;
    const envelopes =
      count === undefined ? "" : ` (${tallyCategory(count, "envelope", "envelopes")})`;
    return `    retained workflow staging: ${tree.name}${envelopes} under the workflows staging directory`;
  });
}

/** Formats a leftover-clone cleanup leak with redacted paths and advisory indentation. */
export function composeLeftoverRemovalAdvisories(leak: string): readonly string[] {
  return [`    ${redactAbsolutePaths(leak)}`];
}

/**
 * Reload-hint trigger per SNM-33. The trailer is reserved for
 * operations that actually change a Pi-visible resource. The ONLY Pi-visible
 * resources are plugin rows (skill / agent / command / MCP entry); marketplace
 * records are bookkeeping, not resources, so they never warrant a `/reload`.
 *
 * RLD-02 / RLD-05 / D-07: the rule is the OR-reduce of the caller-stamped
 * `needsReload` over the cascade rows -- no status-token or cascade-kind
 * inference. Under the D-06 stamps the realized install / update / reinstall /
 * uninstall transitions AND the realized fresh-disable transition stamp
 * `needsReload: true`, while list / info inventory `disabled` / `installed` rows
 * and every marketplace status (added / removed / updated / autoupdate enabled /
 * autoupdate disabled / skipped / failed) stamp `needsReload: false`. A
 * `disabled` row's hint is a per-row stamped fact, never a function of the
 * cascade kind.
 *
 * A fresh autoupdate enabled/disabled flip does NOT emit the trailer (the
 * flip changes a marketplace record, not a Pi-visible resource). The
 * `skipped -> warning` severity route (computeSeverity) is unaffected:
 * severity and reload-hint are independent ladders.
 *
 * Clean `marketplace remove` carries one `PluginUninstalledMessage` row per
 * unstaged plugin, so a non-empty remove still emits the trailer via
 * the `uninstalled` token while an empty remove (header-only) does not.
 */
export function shouldEmitReloadHint(message: NotificationMessage): boolean {
  // RLD-02: the reload hint is the OR-reduce of the caller-stamped
  // `needsReload` over the cascade rows (see the flattened loop below) -- NOT
  // status-token / cascade-kind inference.
  // INFO-03 / INFO-02: read-only info-surface kinds never trigger the reload-hint
  // trailer. The info commands (`marketplace info`,
  // `plugin info`) are read-only surfaces that do not change a Pi-visible
  // resource; the trailer would mislead the user into running `/reload`
  // for no reason. Each fan-out wrapper inherits this short-circuit -- a
  // fan-out of N info blocks is N read-only queries composed; it remains
  // structurally read-only.
  if (isInfoKind(message)) {
    // DIFF-01 SC #2: `reconcile-pending-empty` rows are pre-transition; the
    // trailer would be grammatically false (`/reload` cannot pick up zero
    // changes).
    switch (message.kind) {
      case "marketplace-info":
      case "plugin-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "marketplace-not-added":
      case "reconcile-pending-empty":
      case "prune-empty":
        return false;
      case "prune-committed-warning":
        return true;
      case "reconcile-applied-cascade":
        // D-08: this report comes from `/claude:plugin apply`, which changed
        // state the running session has not loaded, so its rows decide. A
        // load's per-session warning rows stamp needsReload:false, so those
        // warnings never carry the trailer.
        return rowsNeedReload(message.marketplaces);
    }
  }

  return rowsNeedReload(message.marketplaces);
}

/**
 * RLD-02: the OR-reduce of the stamped `needsReload` over the flattened
 * marketplace + plugin rows. Realized install/update/reinstall/uninstall and
 * the realized fresh-disable transition stamp needsReload:true, while
 * list/info inventory `disabled`/`installed` rows stamp needsReload:false.
 */
function rowsNeedReload(marketplaces: readonly MarketplaceNotificationMessage[]): boolean {
  for (const mp of marketplaces) {
    if (mp.needsReload === true) {
      return true;
    }

    for (const p of mp.plugins) {
      if (p.needsReload === true) {
        return true;
      }
    }
  }

  return false;
}
