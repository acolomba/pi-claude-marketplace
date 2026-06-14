/**
 * bridges/hooks/dispatch-exec.ts -- no-op execution-layer stub for the
 * hooks bridge (D-59-04).
 *
 * The composite handler bodies call `dispatchHookExec` sequentially against
 * each routing-entry that fires for an incoming Pi event. This module
 * exposes the locked `(entry, event, ctx): Promise<void>` signature so the
 * dispatch core can be unit-tested today without growing an execution
 * subsystem; the execution layer fills the body in a later phase without
 * changing the signature.
 *
 * The stub is intentionally permissive on the event shape (`unknown`) so a
 * malformed Pi payload at runtime cannot crash the bridge before the
 * execution layer's defensive narrowing lands.
 */

import type { RoutingEntry } from "./event-router.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";

export function dispatchHookExec(
  _entry: RoutingEntry,
  _event: unknown,
  _ctx: ExtensionContext,
): Promise<void> {
  return Promise.resolve();
}
