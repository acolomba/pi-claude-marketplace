import assert from "node:assert/strict";
import test from "node:test";

test("owns plugin update preflight", async () => {
  // act & assert
  await assert.doesNotReject(
    import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"),
    "update-preflight.ts must own plugin update preparation",
  );
});
