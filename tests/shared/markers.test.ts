import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOVERY_PLUGIN_REINSTALL_PREFIX,
  STATE_LOCK_HELD_PREFIX,
} from "../../extensions/pi-claude-marketplace/shared/markers.ts";

test("exports the complete recovery reinstall prefix", () => {
  // arrange
  const expectedPrefix = "plugin-uninstall + plugin-install for";

  // act
  const recoveryPrefix = RECOVERY_PLUGIN_REINSTALL_PREFIX;

  // assert
  assert.strictEqual(recoveryPrefix, expectedPrefix);
});

test("exports the complete state-lock contention prefix", () => {
  // arrange
  const expectedPrefix = "Another pi-claude-marketplace operation is in progress for";

  // act
  const stateLockPrefix = STATE_LOCK_HELD_PREFIX;

  // assert
  assert.strictEqual(stateLockPrefix, expectedPrefix);
});
