// bridges/hooks/index.ts
//
// Public surface barrel for the hooks bridge. The three module-internal
// pieces of state owned by event-router.ts -- the liveEpoch cell
// (D-59-03), the parsedConfigCache Map (D-59-02), and the routingTable Map
// -- are NOT re-exported from this module; callers (the extension factory,
// install/uninstall, the reconcile apply path) interact with the bridge
// through the five named exports below and never touch the cells directly
// (D-01 opaque-handle discipline). The dispatch-exec stub is bridge-internal
// and intentionally absent here -- the execution layer swaps it without a
// barrel change.

export {
  addPluginConfigToCache,
  getRoutingBucket,
  hydrateProjectScopeForCwd,
  readAndCachePluginHooks,
  registerHooksBridge,
  rebuildRoutingTables,
  removePluginConfigFromCache,
} from "./event-router.ts";

export type { RoutingEntry } from "./event-router.ts";

// LIFE-03 / D-63-02: hooks bridge write/remove primitives. Private helpers
// (`assertNoSymlinkEscapeInHooksSubtree`, `hookConfigPathFor`) are NOT
// re-exported -- callers use only the two verbs below.
export { writeHookConfig, removeHookConfig } from "./stage.ts";
export type {
  WriteHookConfigInput,
  WriteHookConfigResult,
  RemoveHookConfigInput,
  RemoveHookConfigResult,
} from "./stage.ts";
