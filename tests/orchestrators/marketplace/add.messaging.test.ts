import assert from "node:assert/strict";
import test from "node:test";

import { ADD_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";

import type { AddPrivateReason } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";

const duplicateNameReason = "duplicate name" satisfies AddPrivateReason;
void duplicateNameReason;

const staleCloneReason = "stale clone" satisfies AddPrivateReason;
void staleCloneReason;

// @ts-expect-error marketplace add does not own the marketplace-remove private reason
const foreignReason: AddPrivateReason = "plugins remain";
void foreignReason;

test("exports the complete marketplace-add command context", () => {
  // arrange
  const expected = {
    Messaging: { label: "Marketplace add" },
    render: {},
  } as const;

  // act
  const actual = ADD_CONTEXT;

  // assert
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual), ["Messaging", "render"]);
  assert.deepEqual(Object.keys(actual.Messaging), ["label"]);
  assert.deepEqual(Object.keys(actual.render), []);
});
