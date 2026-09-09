import assert from "node:assert/strict";
import { test } from "node:test";

test("exports notification summary folding from its named owner", async () => {
  // act & assert
  await assert.doesNotReject(
    import("../../extensions/pi-claude-marketplace/shared/notification-summary.ts"),
    "notification-summary.ts must own summary folding",
  );
});
