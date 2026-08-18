// bridges/hooks/routing-state.ts
//
// SPIKE 018 PROBE -- not production code. Reverted after measurement.
//
// Leaf-ward home for the hooks bridge's module-state cells (D-59-02 /
// D-59-03) and the two record shapes they are keyed on. Extracted from
// event-router.ts to test whether the state can move at all: ESM imported
// bindings are read-only, so a `let` cell can only relocate if every
// reassignment site relocates with it as a mutator call.
//
// This module imports nothing from the hooks cycle knot. It depends only
// on domain/, shared/, and if-field/ (itself a leaf relative to the knot).

import { type BucketAEvent } from "../../domain/components/hook-events.ts";
import {
  type HookHandlerEntry,
  type HooksConfig,
  type ParsedMatcher,
} from "../../domain/components/hooks.ts";
import { type AbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { type Scope } from "../../shared/types.ts";

import { type IfPredicate } from "./if-field/index.ts";

export interface RoutingEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly resolvedSource: AbsolutePluginRoot;
  readonly claudeEvent: BucketAEvent;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
  readonly ifPredicate: IfPredicate;
}

export interface CacheEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly resolvedSource: AbsolutePluginRoot;
  readonly config: HooksConfig;
  readonly ifPredicates: ReadonlyMap<string, IfPredicate>;
}

export interface PendingSessionStartContext {
  readonly context: string;
  readonly pluginId: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

// ──────────────────────────────────────────────────────────────────────────
// Module-state cells
//
// The two Maps are `const` and mutated in place, so they cross a module
// boundary unchanged. `liveEpoch` and `pendingSessionStartContext` are
// reassigned, which an importing module cannot do, so each reassignment
// is exposed here as a named mutator instead.
// ──────────────────────────────────────────────────────────────────────────

export const parsedConfigCache = new Map<string, CacheEntry>();

export const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();

let liveEpoch = 0;

let pendingSessionStartContext: PendingSessionStartContext[] = [];

export function currentEpoch(): number {
  return liveEpoch;
}

export function bumpEpoch(): number {
  liveEpoch += 1;
  return liveEpoch;
}

export function resetEpoch(): void {
  liveEpoch = 0;
}

export function appendPendingSessionStartContext(entry: PendingSessionStartContext): void {
  if (entry.context.length === 0) {
    return;
  }

  pendingSessionStartContext.push(entry);
}

export function pendingSessionStartContextEntries(): ReadonlyArray<PendingSessionStartContext> {
  return pendingSessionStartContext;
}

export function clearPendingSessionStartContext(): void {
  pendingSessionStartContext = [];
}
