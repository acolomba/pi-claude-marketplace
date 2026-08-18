// tests/bridges/hooks/routing-state.test.ts
//
// Tests whose SUBJECT is the routing-state module itself, sitting next to the
// module they exercise. Tests that merely USE `currentEpoch` or
// `getRoutingBucket` while asserting event-router behaviour stay in
// event-router.test.ts -- they are testing that module's public interface and
// these are helpers.

import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

import {
  bumpEpoch,
  currentEpoch,
  resetEpoch,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

beforeEach(() => {
  resetEpoch();
});

test("currentEpoch: starts at 0 in a fresh module load and exposes a number", () => {
  assert.equal(currentEpoch(), 0);
  assert.equal(typeof currentEpoch(), "number");
});

test("bumpEpoch: advances the cell and returns the new value; resetEpoch restores 0", () => {
  assert.equal(currentEpoch(), 0);
  assert.equal(bumpEpoch(), 1);
  assert.equal(currentEpoch(), 1);
  resetEpoch();
  assert.equal(currentEpoch(), 0);
});
