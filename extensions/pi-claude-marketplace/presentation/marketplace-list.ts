// presentation/marketplace-list.ts
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01) -- rewritten renderer.
//
// Replaces V1's grouped-by-scope output with the flat CMC-29 / MSG-GR-3
// form: rows sorted by `compareByNameThenScope` (name primary
// case-insensitive, scope secondary project-before-user) with no per-scope
// group headers. Each row is rendered via the Wave 1 keystone
// `renderRow` composer on a `MarketplaceRow` payload; the empty case
// goes through the `EmptyToken` variant (CMC-10 / MSG-ER-1).
//
// Per CMC-05 / MSG-GR-5 the `<autoupdate>` marker is emitted iff the
// record's `autoupdate === true`; absence of the marker conveys
// autoupdate-off in every surface except the `marketplace autoupdate
// disable` result row (which is owned by autoupdate.ts, not this file).
//
// List rows are PURE LABEL rows: `outcomeClass: "ok"` (CMC-07 dispatches
// to `●`); `status` is undefined (the list does not announce an outcome);
// `reasons` is undefined. The renderer wires these constraints
// structurally so a caller cannot accidentally promote a list row to a
// status-bearing row.
//
// D-11 layering: this file does NOT import from `persistence/` -- it
// defines a minimal structural shape (`MarketplaceListEntry`) that
// `MarketplaceRecord` is a superset of, so the orchestrator passes
// `MarketplaceRecord[]` without casts.
//
// MSG-MR-1 / D-13-15 / Plan 13-01-01 contract: `renderRow` requires a
// `SoftDepProbe`, but marketplace label rows do not exercise per-row
// soft-dep markers (those are plugin-row predicates per MSG-SD-1..3).
// We pass a fixed `MARKETPLACE_LABEL_PROBE` that disables the marker
// injection branch -- the composer reads the probe only when a row's
// `declaresAgents` / `declaresMcp` field is true, which is never the
// case on `MarketplaceRow`.

import { sourceLogical } from "../domain/source.ts";

import { renderRow } from "./compact-line.ts";
import { compareByNameThenScope } from "./sort.ts";

import type { MarketplaceRow, SoftDepProbe } from "./compact-line.ts";
import type { ParsedSource } from "../domain/source.ts";

// Plan 06-04 D-02 re-exports: edge/ cannot import from domain/ (D-11
// BLOCK C). To let `edge/handlers/tools.ts` format the LLM-tool surface
// using the SAME `sourceLogical` projection used by the slash-command
// renderer, re-surface them through presentation/ -- a folder edge/ may
// import from.
export { sourceLogical };
export type { ParsedSource };

/**
 * D-11 boundary: `presentation/` cannot import from `persistence/`. Define the
 * minimal structural shape this renderer consumes from `MarketplaceRecord`
 * (declared in `persistence/state-io.ts`) here. The persistence-layer type is
 * a structural superset, so callers pass `MarketplaceRecord[]` without casts.
 */
export interface MarketplaceListEntry {
  readonly name: string;
  readonly scope: "user" | "project";
  readonly source: ParsedSource;
  readonly autoupdate?: boolean;
}

/**
 * Marketplace label rows never carry per-row soft-dep markers (those are
 * plugin-row predicates per MSG-SD-1..3). `composeReasons` inside
 * `renderRow` reads the probe ONLY when `declaresAgents` / `declaresMcp`
 * is true on the row, which is never the case for `MarketplaceRow` (the
 * variant has no such fields). The "true/true" sentinel below is the
 * intentional no-op shape -- if a caller were to mis-route a row with
 * those predicate fields through here, the markers would be suppressed.
 */
const MARKETPLACE_LABEL_PROBE: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

/**
 * CMC-03 / CMC-07 / CMC-10 / CMC-29 / MSG-GR-3 -- flat list rendering.
 *
 * Empty case (CMC-10): bare `(no marketplaces)` token via the
 * `EmptyToken` variant of RowSpec.
 *
 * Non-empty case (CMC-29): every record becomes a `MarketplaceRow`
 * (`outcomeClass: "ok"`, no `status`, optional `<autoupdate>` marker)
 * and the array is sorted via `compareByNameThenScope` BEFORE rendering.
 * Lines are joined with a single `\n`.
 */
export function renderMarketplaceList(records: readonly MarketplaceListEntry[]): string {
  if (records.length === 0) {
    return renderRow({ kind: "empty", token: "no marketplaces" }, MARKETPLACE_LABEL_PROBE);
  }

  const rows: MarketplaceRow[] = records.map((record) => ({
    kind: "marketplace",
    name: record.name,
    scope: record.scope,
    outcomeClass: "ok",
    ...(record.autoupdate === true && { marker: "autoupdate" as const }),
    // status and reasons intentionally omitted -- list rows are pure
    // label rows (CMC-29). The MarketplaceRow type makes both optional.
  }));

  const sorted = [...rows].sort(compareByNameThenScope);
  return sorted.map((row) => renderRow(row, MARKETPLACE_LABEL_PROBE)).join("\n");
}
