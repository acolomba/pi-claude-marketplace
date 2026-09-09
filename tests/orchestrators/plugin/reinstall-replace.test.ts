import assert from "node:assert/strict";
import test from "node:test";

test("exports the atomic reinstall replacement owner", async () => {
  // act & assert
  await assert.doesNotReject(
    import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts"),
    "reinstall-replace.ts must own atomic reinstall replacement",
  );
});
