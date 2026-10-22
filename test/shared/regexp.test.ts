import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { escapeRegExp } from "../../extensions/pi-claude-marketplace/shared/regexp.ts";

describe("escapeRegExp", () => {
  test("neutralizes every regex metacharacter", () => {
    // arrange
    const value = ".*+?^${}()|[]\\";

    // act
    const escaped = escapeRegExp(value);

    // assert
    assert.strictEqual(new RegExp(`^${escaped}$`).test(value), true);
  });

  test("leaves a name without metacharacters unchanged", () => {
    // arrange
    const value = "acme-foo_123";

    // act
    const escaped = escapeRegExp(value);

    // assert
    assert.strictEqual(escaped, value);
  });
});
