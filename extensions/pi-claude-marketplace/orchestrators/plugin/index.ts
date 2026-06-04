// orchestrators/plugin/index.ts
//
// Barrel re-export for the plugin orchestrators layer (Phase 5). Mirrors
// orchestrators/marketplace/index.ts: cross-subcommand helpers from
// shared.ts (PI-6 guard + the CrossPluginGeneratedNames shape) plus the
// four per-subcommand entrypoints (install / uninstall / update / list)
// that Phase 6's edge layer wires into /claude:plugin <subcommand>.

// Cross-subcommand helpers (from shared.ts).
export { assertNoCrossPluginConflicts } from "./shared.ts";

export type { CrossPluginGeneratedNames } from "./shared.ts";

// Per-subcommand entry points.
export { getPluginInfo } from "./info.ts";
export { installPlugin } from "./install.ts";
export { listPlugins } from "./list.ts";
export { reinstallPlugin, reinstallPlugins } from "./reinstall.ts";
export { uninstallPlugin } from "./uninstall.ts";
export { updatePlugins, updateSinglePlugin } from "./update.ts";

export type { GetPluginInfoOptions } from "./info.ts";
export type { InstallPluginOptions } from "./install.ts";
export type { ListPluginsOptions } from "./list.ts";
export type {
  ReinstallPluginOptions,
  ReinstallPluginsOptions,
  ReinstallPluginsTarget,
  ReinstallPluginOutcome,
  ReinstallPluginPartition,
} from "./reinstall.ts";
export type { UninstallPluginOptions } from "./uninstall.ts";
export type { UpdatePluginsOptions, UpdatePluginsTarget } from "./update.ts";
