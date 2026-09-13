import { assertNever } from "./errors.ts";

import type {
  CascadeNotificationMessage,
  MarketplaceNotificationMessage,
  NotificationMessage,
  Severity,
} from "./notification-types.ts";

/** Severity, tally, reload, and cascade-summary folding for notifications. */

/**
 * TYPE-03 / D-46-04: the closed set of STANDALONE-DISPATCHED message kinds --
 * the 4 read-only info surfaces (`marketplace-info`, `plugin-info`,
 * `marketplace-info-cascade`, `plugin-info-cascade`) PLUS the
 * `marketplace-not-added` failure variant. Enumerated in EXACTLY ONE place so
 * that adding a future standalone kind is a single-site edit here that
 * surfaces as a compile error in every consumer's `assertNever` tail.
 *
 * The guard name is kept as `isInfoKind` per the TYPE-03 wording even though
 * the set now includes a failure kind; "standalone-dispatched" is the precise
 * meaning -- these kinds are routed through `dispatchInfoMessage` and never
 * carry a cascade summary line or reload-hint trailer.
 */
export type StandaloneKind =
  | "marketplace-info"
  | "plugin-info"
  | "marketplace-info-cascade"
  | "plugin-info-cascade"
  | "marketplace-not-added"
  | "reconcile-pending-empty"
  | "reconcile-applied-cascade";

/**
 * Single-source type-predicate for the standalone-dispatched kinds
 * (TYPE-03 / D-46-04). All four consumers (`computeSeverity`,
 * `buildSummaryLine`, `shouldEmitReloadHint`, the `notify()` early-dispatch)
 * route through this one guard; each then narrows the residual to
 * `CascadeNotificationMessage` and closes with `assertNever`.
 */
export function isInfoKind(
  m: NotificationMessage,
): m is Extract<NotificationMessage, { kind: StandaloneKind }> {
  return (
    m.kind === "marketplace-info" ||
    m.kind === "plugin-info" ||
    m.kind === "marketplace-info-cascade" ||
    m.kind === "plugin-info-cascade" ||
    m.kind === "marketplace-not-added" ||
    m.kind === "reconcile-pending-empty" ||
    m.kind === "reconcile-applied-cascade"
  );
}

// ---------------------------------------------------------------------------
// Public notify() entry point + file-private helpers.
//
// Grammar mini-spec (documented in docs/output-catalog.md per SNM-19 /
// SNM-20). The wire format `notify` emits is:
//
//   <mp-header-1>
//     <plugin-row-1>
//       [cause-chain at 4-space indent if (failed | manual recovery) with cause]
//       [rollback child row at 4-space indent for each rollbackPartial phase]
//       [phase cause-chain at 6-space indent if phase.cause set]
//     <plugin-row-2>
//     ...
//
//   <mp-header-2>
//   ...
//
//   /reload to pick up changes  <-- iff any row stamps needsReload:true
//
// Joins / separators:
//   - Plugin row prefix:                "  " (2 spaces)
//   - Cause-chain trailer prefix:       "    " (4 spaces)
//   - rollbackPartial child row prefix: "    " (4 spaces)
//   - rollbackPartial phase cause:      "      " (6 spaces)
//   - Between marketplace blocks:       "\n\n" (one blank line)
//   - Between body and reload-hint:     "\n\n" (one blank line)
//
// Severity (SEV-02): the numeric MAX over the caller-stamped `row.severity`
// (info=0 < warning=1 < error=2) across the marketplace rows AND their plugin
// rows; rank 0 -> undefined (info, no 2nd arg). No status/reasons inference.
//
// Reload-hint (RLD-02): the OR-reduce of the caller-stamped `row.needsReload`
// over the same flattened rows. Realized transitions (install/update/reinstall/
// uninstall + the fresh-disable) stamp needsReload:true; inventory rows stamp
// false. No marketplace-status / cascade-kind inference: the hint is a per-row
// stamped fact. Info-surface kinds
// short-circuit to no-trailer (including reconcile-applied-cascade, which
// suppresses the trailer at the kind level even though its rows stamp true).
//
// Empty-marketplaces sentinel: "(no marketplaces)".
//
// Soft-dep probe discipline: single softDepStatus(pi) call at notify entry;
// the resulting SoftDepStatus is threaded into every renderPluginRow(p,
// probe) invocation. No per-row re-probing.
//
// D-11 layering: notify lives entirely in `shared/`; the reload-hint trailer
// literal sits alongside the renderMpHeader / renderPluginRow grammar
// literals.
// ---------------------------------------------------------------------------

/** Reload-hint trailer literal. */
export const RELOAD_HINT_TRAILER = "/reload to pick up changes";

/**
 * UGRM-01 / UGRM-02 never-silent no-op headline for a bulk `update` that
 * realized ZERO transitions (all targets up-to-date, OR the only surviving rows
 * are benign info skips such as a `(partially-upgradable)` decline). Hard-coded so
 * the byte form cannot drift from `docs/output-catalog.md`'s `all-up-to-date-noop`
 * / `skip-partially-upgradable-bulk` states -- mirrors the `reconcile-pending-empty`
 * byte-lock precedent. Emitted in PLACE of the `composeTally` success line
 * (which collapses a `tally {count: 0}` override to `""`), so the summary line
 * never vanishes.
 */
export const UPDATE_NO_OP_HEADLINE = "Plugin update: nothing to update";

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

function computeSeverity(message: NotificationMessage): ComputedSeverity {
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
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: the empty-steady-state advisory is read-only / info.
        return undefined;
      default:
        assertNever(message);
        return undefined;
    }
  }

  // Cascade arm: reduce the stamped row severities (SEV-02).
  return cascadeSeverity(message);
}

/**
 * The plugin/marketplace operation counts that drive the summary line.
 */
interface SummaryCounts {
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
function countRowsBySeverity(
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
 * line that `emitWithSummary` prepends before the body for `error` and
 * `warning` severity. It gives the host `Error:` / `Warning:` prefix a
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
function buildSummaryLine(message: NotificationMessage, severity: "error" | "warning"): string {
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
        // severity buildSummaryLine isn't called (emitWithSummary short-
        // circuits) so the empty arm below is unreachable in practice.
        return buildSummaryLineForCascade(message.marketplaces, severity);
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: info-severity / read-only -- no summary semantics.
        return "";
      default:
        assertNever(message);
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
function tallyCategory(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * OUT-03 / OUT-04 / D-04: build the trailing per-operation tally for a PLURAL
 * (bulk) cascade. Returns `<Operation>: <n> failure(s), <n> warning(s), <n>
 * success(es)` where `<Operation>` is the threaded `Messaging.label`, the counts
 * come from `countRowsBySeverity` over the marketplace + nested plugin rows
 * (D-03 mixed-subject: all rows counted uniformly under the operation name),
 * zero-count categories are OMITTED, and there is NO terminal period.
 *
 * Returns `""` when the tally must not render: the operation is single-target
 * (cardinality !== "plural" -- D-04, never a row-count heuristic),
 * the label is absent (legacy `notify()` emissions), or every category is zero.
 * Per OUT-03 the tally renders on plural ops regardless of severity, so a
 * successful bulk import shows `Plugin import: 3 success(es)`.
 */
export function composeTally(message: {
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly tally?: { readonly verb: string; readonly count: number };
}): string {
  if (message.cardinality !== "plural" || message.label === undefined) {
    return "";
  }

  const errorCount = countRowsBySeverity(message.marketplaces, "error");
  const warningCount = countRowsBySeverity(message.marketplaces, "warning");

  const failures = errorCount.plugins + errorCount.marketplaces;
  const warnings = warningCount.plugins + warningCount.marketplaces;

  const parts: string[] = [];

  if (failures > 0) {
    parts.push(tallyCategory(failures, "failure", "failures"));
  }

  if (warnings > 0) {
    parts.push(tallyCategory(warnings, "warning", "warnings"));
  }

  if (message.tally === undefined) {
    // OUT-03 / OUT-06 / D-03: the default tally counts OPERATION rows uniformly
    // across the plugin and marketplace subjects. A BARE marketplace header --
    // one carrying neither a `status` (a realized mp outcome: `added` /
    // `updated` / `removed` / `failed` / `skipped`) NOR a stamped `severity` --
    // is a pure grouping label (bookkeeping, not an operation), so it must not
    // inflate the success count. A marketplace row WITH a `status` IS a real
    // mp-level operation and counts (an import `added` block, a `marketplace
    // remove` `removed` block). The `info` count from `countRowsBySeverity`
    // includes bare headers via its `?? "info"` default, so subtract them;
    // plugin rows always represent an operation and always count.
    const successCount = countRowsBySeverity(message.marketplaces, "info");
    const bareHeaders = message.marketplaces.filter(
      (mp) => mp.severity === undefined && mp.status === undefined,
    ).length;
    const successes = successCount.plugins + successCount.marketplaces - bareHeaders;

    // A structurally plural operation reports its zero outcome too. This branch
    // is restricted to the default tally: an explicit owner tally with count 0
    // retains its existing omission semantics.
    if (successes > 0 || parts.length === 0) {
      parts.push(tallyCategory(successes, "success", "successes"));
    }
  } else if (message.tally.count > 0) {
    // UGRM-02: the update-scoped override OWNS the success category -- the count
    // is realized transitions only (the orchestrator's `updated`-partition
    // tally), rendered with a verb that has no plural-s (`1 updated`, `2
    // updated`). The info-row `successes` math above is SKIPPED entirely so an
    // at-desired-state `(skipped) {up-to-date}` row never inflates the headline.
    // A `count` of 0 contributes nothing (the never-silent no-op headline is the
    // orchestrator's job), so a failure-only cascade stays e.g. `1 failure`.
    parts.push(tallyCategory(message.tally.count, message.tally.verb, message.tally.verb));
  }

  if (parts.length === 0) {
    return "";
  }

  return `${message.label}: ${parts.join(", ")}`;
}

/**
 * OUT-03: fold the optional trailing tally into the body BETWEEN the cascade
 * body and the reload-hint trailer, yielding `{body}\n\n{tally}\n\n{hint}` when
 * both are present (each segment omitted when empty). The tally placement is the
 * binding catalog byte contract.
 */
export function foldTallyAndHint(body: string, tally: string, hint: string): string {
  return [body, tally, hint].filter((segment) => segment !== "").join("\n\n");
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
  // INFO-03 / INFO-02: info-surface kinds NEVER trigger the reload-hint
  // trailer. The info commands (`marketplace info`,
  // `plugin info`) are read-only surfaces that do not change a Pi-visible
  // resource; the trailer would mislead the user into running `/reload`
  // for no reason. Each fan-out wrapper inherits this short-circuit -- a
  // fan-out of N info blocks is N read-only queries composed; it remains
  // structurally read-only.
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-info":
      case "plugin-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "marketplace-not-added":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: pending-list rows are pre-transition; the trailer would
        // be grammatically false (`/reload` cannot pick up zero changes).
        return false;
      case "reconcile-applied-cascade":
        // RECON-04: the reconcile already ran ON /reload (the
        // resources_discover handler IS the trailer's nominal trigger), so
        // emitting `Run /reload to pick up changes` after applying changes
        // would be a lie. Structurally false closes the trailer-leak gap --
        // this kind-level exclusion stands EVEN THOUGH its rows stamp
        // needsReload:true (they are realized transitions).
        return false;
      default:
        assertNever(message);
        return false;
    }
  }

  // RLD-02: the trailer fires iff the OR-reduce of the stamped `needsReload`
  // over the flattened marketplace + plugin rows is true. Realized install/
  // update/reinstall/uninstall and the realized fresh-disable transition stamp
  // needsReload:true, while list/info inventory `disabled`/`installed` rows
  // stamp needsReload:false.
  for (const mp of message.marketplaces) {
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

/**
 * GRAM-04: the single summary-composition seam shared by the standalone arm
 * and the cascade arm of the dispatcher. Computing the
 * severity and prepending the summary in ONE place is the structural
 * anti-divergence guarantee -- no caller can re-introduce a summary-less
 * error/warning emission like the v1.10 standalone-arm defect.
 *
 * GRAM-01: at error/warning severity the summary is prepended as its own
 * block, separated from the body by `\n\n` (never a single `\n`, which would
 * re-glue the host `Error:` / `Warning:` label onto the detail row). At info
 * severity the body is returned unchanged (no summary -- the operation-count
 * semantics do not apply to read-only results). The dispatch owner consumes
 * this exact tuple and performs the single Pi notification call.
 */
export function composeWithSummary(
  message: NotificationMessage,
  body: string,
): readonly [message: string] | readonly [message: string, severity: "warning" | "error"] {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    return [body];
  }

  return [`${buildSummaryLine(message, severity)}\n\n${body}`, severity];
}
