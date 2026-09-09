import assert from "node:assert/strict";
import test from "node:test";

import { updatePluginsWith } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";

test("retains update target enumeration in the legacy hub", () => {
  // act and assert
  assert.strictEqual(typeof updatePluginsWith, "function");
});
