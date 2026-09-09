import assert from "node:assert/strict";
import test from "node:test";

test("owns plugin update flow composition", async () => {
  // arrange
  const modulePath =
    "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";

  // act
  let updateFlow: Record<string, unknown> = {};
  await assert.doesNotReject(async () => {
    updateFlow = await import(modulePath);
  }, "update-flow.ts must own plugin update operation composition");

  // assert
  assert.strictEqual(typeof updateFlow.createPluginUpdateOperations, "function");
});
