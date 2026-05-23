// orchestrators/marketplace/index.ts
//
// Barrel re-export for the marketplace orchestrators layer (Phase 4).
// Exposes the cross-subcommand helpers from `shared.ts` plus the five
// per-subcommand entry points that Phase 6's edge layer wires into
// /claude:plugin marketplace <subcommand>.

// Cross-subcommand helpers (from shared.ts).
export {
  DEFAULT_GIT_OPS,
  applyAutoupdateFlipInPlace,
  cascadeUnstagePlugin,
  resolveScopeFromState,
} from "./shared.ts";

export type { AutoupdateFlipResult, GitOps, UnstageOutcome } from "./shared.ts";

// Per-subcommand entry points.
export { addMarketplace } from "./add.ts";
export { removeMarketplace } from "./remove.ts";
export { listMarketplaces } from "./list.ts";
export { updateAllMarketplaces, updateMarketplace } from "./update.ts";
export { setMarketplaceAutoupdate } from "./autoupdate.ts";

export type { AddMarketplaceOptions } from "./add.ts";
export type { RemoveMarketplaceOptions } from "./remove.ts";
export type { ListMarketplacesOptions } from "./list.ts";
export type { UpdateAllMarketplacesOptions, UpdateMarketplaceOptions } from "./update.ts";
export type { AutoupdateOptions } from "./autoupdate.ts";
