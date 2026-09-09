import assert from "node:assert/strict";
import test from "node:test";

test("exports the reinstall record and outcome owner", async () => {
  // act & assert
  await assert.doesNotReject(
    import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts"),
    "reinstall-record.ts must own record mutation and outcome composition",
  );
});
