import assert from "node:assert/strict";
import test from "node:test";

import { EXTENSION_VERSION } from "../../extensions/pi-claude-marketplace/shared/extension-version.ts";

test("exports the checked-in extension version", () => {
  // arrange
  const expectedVersion = "0.18.1";

  // act
  const extensionVersion = EXTENSION_VERSION;

  // assert
  assert.strictEqual(extensionVersion, expectedVersion);
});
