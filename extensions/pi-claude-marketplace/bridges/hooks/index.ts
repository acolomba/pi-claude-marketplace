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
  hydrateProjectScopeForCwd,
  registerHooksBridge,
  rebuildRoutingTables,
  removePluginConfigFromCache,
} from "./event-router.ts";

export type { RoutingEntry } from "./event-router.ts";
