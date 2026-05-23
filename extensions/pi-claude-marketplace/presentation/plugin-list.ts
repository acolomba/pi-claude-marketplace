// presentation/plugin-list.ts
//
// Phase 13 Wave 2 sub-wave 2d (Plan 13-02d-01) -- rewritten renderer.
//
// Per CMC-22 / CMC-06 / CMC-09 / CMC-13 the renderer is now a pure formatter
// over the Wave 1 keystone `MarketplaceRow` + `PluginListRow` + `EmptyToken`
// primitives. The orphan-fold computation lives in
// `orchestrators/plugin/list.ts` (D-13-19); this file simply walks the
// `PluginListPayload` blocks the orchestrator constructs and emits via
// `renderRow` from `compact-line.ts`.
//
// Layout per docs/output-catalog.md §"/claude:plugin list" (lines 162-263):
//
//   <warning marketplace row(s)>          <- (failed) {unparseable} cases first
//   ● <mp> [<scope>] [<marker>]            <- per-marketplace header (column 0)
//     <icon> <plugin> [scope] vX.Y (status) [{reasons}]
//       <description truncated to col 66 with U+2026 suffix>
//     ...
//   ● <next mp> ...
//
// MSG-PL-1 column-66 truncation is list-only -- the helper stays in this
// file (the only consumer; comment 27-29 of the V1 file documented this).
// MSG-PL-4 / CMC-09 `(upgradable)` list-only constraint is enforced
// STRUCTURALLY by `PluginListRow.status` narrowing (Plan 13-01-01).
// MSG-PL-6 scope-bracket carve-out for `(available)` / `(unavailable)`
// rows is enforced inside `renderRow`'s `PluginListRow` variant.
// MSG-SD-1..3 per-row soft-dep markers are emitted by `renderRow` via the
// injected `SoftDepProbe`.
//
// D-11 layering: this file imports only from `./compact-line.ts` and
// `./sort.ts`. It does NOT import from persistence/ -- the orchestrator
// owns state reads and constructs the payload.

import { renderRow } from "./compact-line.ts";
import { compareByNameThenScope } from "./sort.ts";

import type { EmptyToken, MarketplaceRow, PluginListRow, SoftDepProbe } from "./compact-line.ts";

// ---------------------------------------------------------------------------
// MSG-PL-1 column-66 description truncation (list-only).
// ---------------------------------------------------------------------------

/**
 * MSG-PL-1 / PL-4 maximum column width for plugin-row descriptions on the
 * list surface. Descriptions longer than the budget are sliced to budget-1
 * and suffixed with the single-character horizontal-ellipsis `…` (U+2026),
 * landing exactly at column 66. The catalog at lines 178-179 binds this
 * exact form (NOT `...`).
 *
 * Kept file-private per the V1 comment (PR-IL-1 / MSG-PL-1 is list-only);
 * the column-66 budget never escapes this file.
 */
const MAX_LINE_COLUMN = 66;

export function truncateColumn66(s: string): string {
  if (s.length <= MAX_LINE_COLUMN) {
    return s;
  }

  return s.slice(0, MAX_LINE_COLUMN - 1) + "…";
}

// ---------------------------------------------------------------------------
// Public payload contract consumed by `orchestrators/plugin/list.ts`.
// ---------------------------------------------------------------------------

/**
 * One marketplace block on the list surface. The `header` carries
 * `outcomeClass: "ok"` (label row) for normal marketplaces and
 * `outcomeClass: "failure"` for unparseable/load-failure marketplaces
 * (catalog lines 228-230: `⊘ unparseable-mp [user] (failed) {unparseable}`).
 *
 * `plugins` is the sorted-or-soon-to-be-sorted list of plugin rows
 * folded under this header. The single `EmptyToken` variant signals the
 * catalog "marketplace with zero plugins" form (lines 238-243). The
 * orchestrator's orphan-fold logic (D-13-17..D-13-19) decides which
 * project-scope plugins fold under a user-scope header when no
 * project-scope marketplace record exists.
 *
 * `causeTrailer` is the optional indented `cause: <message>` line that
 * sits under the header when the marketplace's manifest could not be
 * loaded (catalog line 230). The renderer indents it 2 spaces under the
 * header row and emits it verbatim (no per-line wrapping).
 */
export interface PluginListMarketplaceBlock {
  readonly header: MarketplaceRow;
  readonly plugins: readonly (PluginListRow | EmptyToken)[];
  readonly causeTrailer?: string;
}

/**
 * Top-level payload the orchestrator passes to {@link renderPluginList}.
 *
 * Empty case (no marketplaces configured in either scope, no soft-fail
 * marketplace blocks): the renderer emits the bare `(no plugins)`
 * `EmptyToken` per MSG-ER-1 / CMC-10.
 */
export interface PluginListPayload {
  readonly marketplaceBlocks: readonly PluginListMarketplaceBlock[];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * CMC-22 / D-13-19 pure formatter for `/claude:plugin list`.
 *
 * Walks the orchestrator-constructed `payload.marketplaceBlocks`, sorting
 * each block via `compareByNameThenScope` (name primary case-insensitive,
 * scope secondary project-before-user per MSG-GR-3 / CMC-03). Inside each
 * block plugin rows are sorted by the same comparator and emitted at
 * 2-space indent; descriptions, when present, sit at 4-space indent on
 * a second line truncated at column 66.
 *
 * Bookkeeping notes:
 * - `(no plugins)` empty case is rendered via the `EmptyToken` variant
 *   so the bare-token shape passes through `renderRow` unchanged. Both
 *   the top-level empty (no marketplaces at all) and the per-marketplace
 *   empty (manifest with zero plugins) flow through the same primitive.
 * - The unparseable-manifest header carries `causeTrailer` so the
 *   `cause: <text>` line sits 2 spaces under the failed marketplace
 *   header (catalog lines 228-230).
 * - Blocks separated by blank lines? The catalog at lines 250-258 shows
 *   marketplace headers stacked WITHOUT blank line separation; we
 *   reproduce that form (single `\n` join across the rendered lines).
 *
 * @param payload  Orchestrator-constructed payload (marketplace blocks with
 *                 sorted-or-unsorted plugin children).
 * @param probe    SoftDepProbe constructed by the orchestrator from
 *                 `softDepStatus(opts.pi)`. Forwarded to `renderRow` for
 *                 per-row `{requires pi-subagents}` / `{requires pi-mcp}`
 *                 marker emission (MSG-SD-1..3 / CMC-13). For
 *                 marketplace-header rows the probe is consulted only when
 *                 the variant's `declares*` fields are true, which is never
 *                 the case for `MarketplaceRow` -- so the probe value is
 *                 effectively a no-op on header rows.
 */
export function renderPluginList(payload: PluginListPayload, probe: SoftDepProbe): string {
  // Top-level empty case (CMC-10 / MSG-ER-1): no marketplaces configured
  // in either scope. Bare `(no plugins)` token, no icon, no header.
  if (payload.marketplaceBlocks.length === 0) {
    return renderRow({ kind: "empty", token: "no plugins" }, probe);
  }

  // Sort marketplace blocks by compareByNameThenScope (MSG-GR-3 / CMC-03).
  // Each header carries `name` + `scope`, which is exactly the comparator's
  // structural minimum.
  const sortedBlocks = [...payload.marketplaceBlocks].sort((a, b) =>
    compareByNameThenScope(a.header, b.header),
  );

  const lines: string[] = [];
  for (const block of sortedBlocks) {
    // Marketplace header at column 0.
    lines.push(renderRow(block.header, probe));

    // Optional cause-trailer for unparseable manifests (catalog line 230).
    // Indented 2 spaces under the header.
    if (block.causeTrailer !== undefined && block.causeTrailer !== "") {
      lines.push(`  cause: ${block.causeTrailer}`);
    }

    // Plugin rows OR the per-marketplace empty token (catalog lines 238-243).
    const sortedPlugins = sortPlugins(block.plugins);
    for (const plugin of sortedPlugins) {
      if (plugin.kind === "empty") {
        // Per-marketplace empty: indented `(no plugins)` under the header.
        lines.push(`  ${renderRow(plugin, probe)}`);
        continue;
      }

      // PluginListRow: 2-space indent for the head line.
      lines.push(`  ${renderRow(plugin, probe)}`);

      // PL-4 description on a second indented line, truncated at column 66.
      if (plugin.description !== undefined && plugin.description.length > 0) {
        lines.push(`    ${truncateColumn66(plugin.description)}`);
      }
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sort helper (file-private)
// ---------------------------------------------------------------------------

/**
 * Sort plugin rows within a marketplace block by `compareByNameThenScope`.
 * `EmptyToken` carries no name/scope; it falls through unchanged (only
 * appears as the SOLE element in a per-marketplace empty block per the
 * orchestrator contract -- there is no mixed empty + populated block).
 */
function sortPlugins(
  plugins: readonly (PluginListRow | EmptyToken)[],
): readonly (PluginListRow | EmptyToken)[] {
  // Empty-only block: pass through.
  if (plugins.length === 0) {
    return plugins;
  }

  // If the block carries an `EmptyToken`, the orchestrator guarantees it is
  // the sole element (per-marketplace empty form). No sort needed.
  if (plugins.some((p) => p.kind === "empty")) {
    return plugins;
  }

  // All `PluginListRow` -- safe to sort via the name+scope comparator.
  const rows = plugins as readonly PluginListRow[];
  return [...rows].sort((a, b) => compareByNameThenScope(a, b));
}
