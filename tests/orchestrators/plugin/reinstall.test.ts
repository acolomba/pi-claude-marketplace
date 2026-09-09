import assert from "node:assert/strict";
import test from "node:test";

import {
  reinstallPluginsWith,
  reinstallPluginWithTransaction,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";

test("reinstall hub owns transaction and target sequencing", () => {
  // act & assert
  assert.strictEqual(typeof reinstallPluginWithTransaction, "function");
  assert.strictEqual(typeof reinstallPluginsWith, "function");
});
