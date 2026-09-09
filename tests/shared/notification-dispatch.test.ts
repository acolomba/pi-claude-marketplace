import assert from "node:assert/strict";
import test from "node:test";

test("exports the sole notification dispatch owner", async () => {
  // act
  const loadOwner = import(
    "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  );

  // assert
  await assert.doesNotReject(loadOwner, "notification-dispatch.ts must own Pi dispatch");
});
