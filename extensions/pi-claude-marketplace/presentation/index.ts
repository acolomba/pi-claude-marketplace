// presentation/index.ts
//
// Barrel re-export for the presentation layer (Phase 4 first
// populates this directory beyond the placeholder).
//
// Plan 13-01-01 adds the Wave 1 keystone surfaces:
//   - compact-line.ts: the typed RowSpec union + renderRow grammar composer
//     (D-13-05). Every Wave 2 sub-wave consumes this barrel.
//   - sort.ts: compareByNameThenScope, the single per-scope sort comparator
//     (MSG-GR-3; D-13-15).
//
// Plan 13-01-02 will add cause-chain, cascade-summary, manual-recovery,
// and rollback-partial composers; their barrel entries land with those
// files. Plan 13-01-03 evaluates whether to delete or thin the
// subagentWarningIfNeeded / mcpAdapterWarningIfNeeded re-exports below
// (per-row markers in renderRow replace the aggregated trailer per
// CMC-12 / CMC-13 / D-13-07).

export { appendReloadHint, reloadHint } from "./reload-hint.ts";

export {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "./soft-dep.ts";

export { renderMarketplaceList } from "./marketplace-list.ts";

export { renderRow } from "./compact-line.ts";

export type {
  EmptyToken,
  EntityErrorRow,
  ManualRecoveryLine,
  MarketplaceRow,
  PluginCascadeRow,
  PluginInlineRow,
  PluginInlineUninstalledRow,
  PluginListRow,
  RollbackChild,
  RowSpec,
  Scope,
  SoftDepProbe,
} from "./compact-line.ts";

export { compareByNameThenScope } from "./sort.ts";

// Plan 13-01-02 Wave 1 composers.
export { cascadeSeverity, cascadeSummary } from "./cascade-summary.ts";

export type {
  CascadeSeverity,
  CascadeSummaryInput,
  CascadeSummaryOutput,
} from "./cascade-summary.ts";

export { renderManualRecovery } from "./manual-recovery.ts";

export { renderRollbackPartial } from "./rollback-partial.ts";

export { causeChainTrailer } from "./cause-chain.ts";
