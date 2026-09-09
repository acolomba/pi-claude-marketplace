import assert from "node:assert/strict";
import test from "node:test";

import * as legacyNotify from "../../extensions/pi-claude-marketplace/shared/notify.ts";

test("legacy notification hub exposes no compatibility facade", () => {
  // act & assert
  assert.deepStrictEqual(Object.keys(legacyNotify), []);
});
