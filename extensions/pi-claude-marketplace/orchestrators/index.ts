// orchestrators/index.ts
//
// Top-level orchestrators barrel. Phase 4 shipped the `marketplace`
// per-subcommand barrel; Phase 5 adds the `plugin` per-subcommand barrel
// and the cross-orchestrator `types.ts` shapes. Phase 6 edge router
// imports from here.
//
// Each per-subcommand barrel uses prefix-distinct exported names
// (`addMarketplace`, `installPlugin`, etc.) so there are no symbol-name
// collisions at this top-level surface. The barrel forwards EVERY named
// export from the two per-subcommand barrels plus the cross-orchestrator
// type contracts that Phase 4's autoupdate cascade (and Phase 5's
// `updateSinglePlugin` impl that satisfies it) depend on.

export {
  addMarketplace,
  applyAutoupdateFlipInPlace,
  cascadeUnstagePlugin,
  DEFAULT_GIT_OPS,
  listMarketplaces,
  removeMarketplace,
  resolveScopeFromState,
  setMarketplaceAutoupdate,
  updateAllMarketplaces,
  updateMarketplace,
} from "./marketplace/index.ts";

export type {
  AddMarketplaceOptions,
  AutoupdateFlipResult,
  AutoupdateOptions,
  GitOps,
  ListMarketplacesOptions,
  RemoveMarketplaceOptions,
  UnstageOutcome,
  UpdateAllMarketplacesOptions,
  UpdateMarketplaceOptions,
} from "./marketplace/index.ts";

export {
  assertNoCrossPluginConflicts,
  installPlugin,
  listPlugins,
  reinstallPlugin,
  reinstallPlugins,
  uninstallPlugin,
  updatePlugins,
  updateSinglePlugin,
} from "./plugin/index.ts";

export type {
  CrossPluginGeneratedNames,
  InstallPluginOptions,
  ListPluginsOptions,
  ReinstallPluginOptions,
  ReinstallPluginsOptions,
  ReinstallPluginsTarget,
  UninstallPluginOptions,
  UpdatePluginsOptions,
  UpdatePluginsTarget,
} from "./plugin/index.ts";

export * from "./import/index.ts";

export type {
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdatePartition,
  ReinstallPluginOutcome,
  ReinstallPluginPartition,
} from "./types.ts";
