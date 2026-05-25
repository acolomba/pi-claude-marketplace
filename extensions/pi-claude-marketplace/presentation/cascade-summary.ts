// presentation/cascade-summary.ts -- MSG-SR-4..6 cascade-summary composer.
//
// Returns `{message, severity}` so the orchestrator destructures and
// dispatches to the matching severity-named wrapper (notifySuccess /
// notifyWarning). MSG-SR-6 forbids `notifyError` on cascade summaries; the
// `CascadeSeverity` literal union has no "error" arm to enforce that
// structurally.
//
// D-13-08 / D-07: this composer MUST NOT import the notify wrappers.
// Calling `ctx.ui.notify` here would replicate the orphan-emission anti-
// pattern that Phase 12 funnelled into the four sanctioned wrappers. The
// rule is a convention here -- this file owns the composition and returns
// the `{message, severity}` pair so the orchestrator dispatches to the
// matching wrapper.
//
// Sort order: rows are sorted via `compareByNameThenScope` from
// `./sort.ts` (MSG-GR-3: name primary case-insensitive, scope secondary
// project-before-user).
//
// Trivial skip predicate: a `(skipped) {up-to-date}` row counts as a
// success outcome because the plugin remains installed; any other
// `(skipped)` reason (e.g. `{source mismatch}`, `{not in manifest}`) is a
// failure-cascade child and routes to `warning`.

import { renderRow } from "./compact-line.ts";
import { compareByNameThenScope } from "./sort.ts";

import type { MarketplaceRow, PluginCascadeRow, SoftDepProbe } from "./compact-line.ts";

export type CascadeSeverity = "success" | "warning";

export interface CascadeSummaryInput {
  readonly marketplace: MarketplaceRow;
  readonly rows: readonly PluginCascadeRow[];
  readonly probe: SoftDepProbe;
}

export interface CascadeSummaryOutput {
  readonly message: string;
  readonly severity: CascadeSeverity;
}

/**
 * MSG-SR-4..6 severity routing for a cascade row set.
 *
 *   - Vacuously trivial (empty rows) and every row whose status is one of
 *     `installed | updated | reinstalled | uninstalled | available` (with a
 *     trivial `{up-to-date}` skip also folding in here) -> `"success"`.
 *   - Any row with status `failed | rollback failed | unavailable`, or a
 *     non-trivial `(skipped)` row -> `"warning"`.
 *
 * Never returns `"error"`. MSG-SR-6 forbids `notifyError` on cascade
 * summaries; the function signature enforces it structurally.
 */
export function cascadeSeverity(rows: readonly PluginCascadeRow[]): CascadeSeverity {
  for (const r of rows) {
    if (r.status === "failed" || r.status === "rollback failed" || r.status === "unavailable") {
      return "warning";
    }

    if (r.status === "skipped" && !isTrivialUpToDate(r)) {
      return "warning";
    }
  }

  return "success";
}

/**
 * Compose the cascade body: marketplace-header row, then 2-space-indented
 * plugin rows sorted by `compareByNameThenScope`. Severity is computed by
 * `cascadeSeverity(rows)`. The caller destructures and dispatches:
 *
 *   const { message, severity } = cascadeSummary({ marketplace, rows, probe });
 *   (severity === "warning" ? notifyWarning : notifySuccess)(ctx, message);
 */
export function cascadeSummary(input: CascadeSummaryInput): CascadeSummaryOutput {
  const lines: string[] = [renderRow(input.marketplace, input.probe)];
  const sorted = [...input.rows].sort(compareByNameThenScope);
  for (const r of sorted) {
    lines.push(`  ${renderRow(r, input.probe)}`);
  }

  return {
    message: lines.join("\n"),
    severity: cascadeSeverity(input.rows),
  };
}

function isTrivialUpToDate(r: PluginCascadeRow): boolean {
  return r.reasons?.length === 1 && r.reasons[0] === "up-to-date";
}
