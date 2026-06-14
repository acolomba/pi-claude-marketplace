import assert from "node:assert/strict";
import { test } from "node:test";

import { dispatchHookExec } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";

import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * Shape pin for the execution-layer stub (D-59-04).
 *
 * `dispatchHookExec` is the seam the composite handler bodies call once per
 * routing entry that fires for an incoming Pi event. For Plan 02 the body is
 * intentionally a no-op so the dispatch core can be unit-tested without an
 * execution subsystem; the execution layer fills the body in a later phase
 * without changing the locked signature.
 *
 * These tests lock the contract the composite handlers will rely on:
 *   1. The function returns a resolved `Promise<void>`.
 *   2. The function never throws regardless of event shape.
 *   3. The function tolerates arbitrary event payloads (parametric on `unknown`).
 */

const stubEntry = {} as unknown as RoutingEntry;
const stubCtx = {} as unknown as ExtensionContext;

test("dispatchHookExec: returns a resolved Promise<void>", async () => {
  await dispatchHookExec(stubEntry, {}, stubCtx);
  // No assertion beyond "did not throw"; the locked return type is
  // `Promise<void>` so resolving with no value is the contract.
  assert.ok(true);
});

test("dispatchHookExec: invoking with arbitrary event shapes does not throw", async () => {
  const fixtures: unknown[] = [{}, { isError: true }, { toolName: "bash" }, null];

  for (const event of fixtures) {
    await assert.doesNotReject(() => dispatchHookExec(stubEntry, event, stubCtx));
  }
});

test("dispatchHookExec: signature accepts unknown event type", async () => {
  // Behavioral check only -- the stub is intentionally permissive on event
  // shape, so this exercises the call path with an `unknown`-typed value.
  const opaque: unknown = { surprise: true };
  await assert.doesNotReject(() => dispatchHookExec(stubEntry, opaque, stubCtx));
});
