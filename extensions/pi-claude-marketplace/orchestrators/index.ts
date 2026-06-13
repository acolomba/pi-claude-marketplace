// orchestrators/index.ts
//
// Top-level orchestrators barrel. Forwards the `marketplace` and `plugin`
// per-subcommand barrels and the cross-orchestrator `types.ts` shapes; the
// edge router imports from here.
//
// Each per-subcommand barrel uses prefix-distinct exported names
// (`addMarketplace`, `installPlugin`, etc.) so there are no symbol-name
// collisions at this top-level surface. The barrel forwards EVERY named
// export from the two per-subcommand barrels plus the cross-orchestrator
// type contracts that the autoupdate cascade (and the `updateSinglePlugin`
// impl that satisfies it) depend on.

export {
  addMarketplace,
  classifyAutoupdateFlip,
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
