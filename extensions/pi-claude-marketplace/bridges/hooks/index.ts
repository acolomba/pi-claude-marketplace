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

import { lstat, readdir, readlink, realpath } from "node:fs/promises";

import { createWriteHookConfig } from "./stage.ts";

import type { HooksTreeInspector } from "./stage.ts";
import type { Dirent, Stats } from "node:fs";

export { createHooksHydration, createHooksRouting } from "./event-router.ts";

export type { HooksRouting } from "./event-router.ts";
export { createHooksRuntime } from "./runtime.ts";

// LIFE-03 / D-63-02: hooks bridge read/write/remove primitives. Private
// helpers (`assertNoSymlinkEscapeInHooksSubtree`, `hookConfigPathFor`) are NOT
// re-exported -- callers use only the three verbs below. D-09-05:
// `readHooksJson` is the real `HooksFileReader`, reached by the composition
// root through this barrel.
export { readHooksJson, removeHookConfig } from "./stage.ts";

const NODE_HOOKS_TREE_INSPECTOR: HooksTreeInspector = {
  lstat: async (target: string): Promise<Stats> => lstat(target),
  readdir: async (directory: string): Promise<Dirent[]> =>
    readdir(directory, { withFileTypes: true }),
  readlink: async (target: string): Promise<string> => readlink(target),
  realpath: async (target: string): Promise<string> => realpath(target),
};

/** Writes a hooks config through the Node-backed tree inspector. */
export const writeHookConfig = createWriteHookConfig(NODE_HOOKS_TREE_INSPECTOR);
