import assert from "node:assert/strict";
import test from "node:test";

test("owns plugin reinstall flow composition", async () => {
  // act & assert
  await assert.doesNotReject(
    () => import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts"),
    "reinstall-flow.ts must own the public reinstall factories",
  );
});
