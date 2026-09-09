import assert from "node:assert/strict";
import test from "node:test";

test("exposes the atomic plugin update swap owner", async () => {
  // arrange
  const modulePath =
    "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";

  // act
  let updateSwap: Record<string, unknown> = {};
  await assert.doesNotReject(async () => {
    updateSwap = await import(modulePath);
  }, "update-swap.ts must own atomic plugin replacement");

  // assert
  assert.strictEqual(typeof updateSwap.swapPluginUpdate, "function");
});
