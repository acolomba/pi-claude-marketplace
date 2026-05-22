// presentation/index.ts
//
// Barrel re-export for the presentation layer (Phase 4 first
// populates this directory beyond the placeholder).

export { appendReloadHint, reloadHint } from "./reload-hint.ts";

export {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "./soft-dep.ts";

export { renderMarketplaceList } from "./marketplace-list.ts";
