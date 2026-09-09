import assert from "node:assert/strict";
import { test } from "node:test";

test("exports the name-first scope comparator from its named owner", async () => {
  // arrange
  const owner = [
    "..",
    "..",
    "extensions",
    "pi-claude-marketplace",
    "shared",
    "compare-name-scope.ts",
  ].join("/");

  // act / assert
  await assert.doesNotReject(import(owner), "compare-name-scope.ts must own ordering");
});
