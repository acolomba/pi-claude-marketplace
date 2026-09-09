import assert from "node:assert/strict";
import { test } from "node:test";

test("exports notification grammar from its named owner", async () => {
  // arrange
  const owner = [
    "..",
    "..",
    "extensions",
    "pi-claude-marketplace",
    "shared",
    "notification-grammar.ts",
  ].join("/");

  // act / assert
  await assert.doesNotReject(import(owner), "notification-grammar.ts must own rendering");
});
