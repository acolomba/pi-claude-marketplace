// Owner for shared/session-host.ts.
//
// RELOADCMD-D1: the one predicate that decides whether this Pi process takes
// later commands. Each host below is a literal of Pi's one field, so a case
// states the whole input the predicate reads.

import assert from "node:assert/strict";
import { test } from "node:test";

import { acceptsLaterCommands } from "../../extensions/pi-claude-marketplace/shared/session-host.ts";

test("a host with a UI accepts later commands (RELOADCMD-D1)", () => {
  // act
  const accepts = acceptsLaterCommands({ hasUI: true });

  // assert
  assert.strictEqual(accepts, true);
});

test("a host without a UI accepts no later commands (RELOADCMD-D1)", () => {
  // act
  const accepts = acceptsLaterCommands({ hasUI: false });

  // assert
  assert.strictEqual(accepts, false);
});
