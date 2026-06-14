// bridges/hooks/event-router.ts
//
// Placeholder scaffold for the hooks-bridge dispatch core. Task 2 expands
// this file with module-state declarations, cache mutators, the rebuild
// routine, and the registerHooksBridge factory. For Task 1 the file exists
// only to anchor the RoutingEntry type that dispatch-exec.ts and
// bridges/hooks/index.ts forward-reference.

import type { HookHandlerEntry, ParsedMatcher } from "../../domain/components/hooks.ts";

export interface RoutingEntry {
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
}

export function registerHooksBridge(): never {
  throw new Error("registerHooksBridge: dispatch core not yet wired");
}

export function rebuildRoutingTables(): never {
  throw new Error("rebuildRoutingTables: dispatch core not yet wired");
}

export function addPluginConfigToCache(): never {
  throw new Error("addPluginConfigToCache: dispatch core not yet wired");
}

export function removePluginConfigFromCache(): never {
  throw new Error("removePluginConfigFromCache: dispatch core not yet wired");
}
