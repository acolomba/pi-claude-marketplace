import assert from "node:assert/strict";
import { test } from "node:test";

import { runPiRuntimeSmoke } from "./_helpers.ts";

test("real Pi runtime package bin loads the extension under isolated HOME and cwd", async () => {
  const result = await runPiRuntimeSmoke();
  assert.equal(result.ok, true, result.output);
  assert.match(result.output, /Usage:|pi - AI coding assistant/);
});
