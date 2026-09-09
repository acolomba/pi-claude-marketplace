import assert from "node:assert/strict";
import test from "node:test";

test("owns plugin update cascade composition", async () => {
  // arrange
  const modulePath =
    "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts";

  // act
  let updateCascade: Record<string, unknown> = {};
  await assert.doesNotReject(async () => {
    updateCascade = await import(modulePath);
  }, "update-cascade.ts must own plugin update result composition");

  // assert
  assert.strictEqual(typeof updateCascade.composeUpdateCascade, "function");
});
