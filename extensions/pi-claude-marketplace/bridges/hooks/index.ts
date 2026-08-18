// bridges/hooks/index.ts
//
// Public surface barrel for the hooks bridge. The four module-internal
// pieces of state owned by routing-state.ts -- the liveEpoch cell (D-59-03),
// the parsedConfigCache Map (D-59-02), the routingTable Map, and the
// SessionStart additionalContext buffer -- are NOT re-exported from this
// module; callers (the extension factory, install/uninstall, the reconcile
// apply path) interact with the bridge through the named exports below and
// never touch the cells directly (D-01 opaque-handle discipline). The
// dispatch-exec layer is bridge-internal and intentionally absent here -- it
// is reached through the injected `HookExecutor` parameter, not this barrel.

export {
  hydrateProjectScopeForCwd,
  readAndCachePluginHooks,
  registerHooksBridge,
  rebuildRoutingTables,
  removePluginConfigFromCache,
} from "./event-router.ts";

// LIFE-03 / D-63-02: hooks bridge write/remove primitives. Private helpers
// (`assertNoSymlinkEscapeInHooksSubtree`, `hookConfigPathFor`) are NOT
// re-exported -- callers use only the two verbs below.
export { writeHookConfig, removeHookConfig } from "./stage.ts";
