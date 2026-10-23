import assert from "node:assert/strict";
import test from "node:test";

import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../extensions/pi-claude-marketplace/shared/markers.ts";

test("exports the complete recovery reinstall prefix", () => {
  // arrange
  const expectedPrefix = "Run /claude:plugin reinstall";

  // act
  const recoveryPrefix = RECOVERY_PLUGIN_REINSTALL_PREFIX;

  // assert
  assert.strictEqual(recoveryPrefix, expectedPrefix);
  assert.notStrictEqual(recoveryPrefix, "Run /claude:plugin reinstal");
  assert.notStrictEqual(recoveryPrefix, "Run /claude:plugin reinstall ");
});
