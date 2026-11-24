import assert from "node:assert/strict";
import test from "node:test";

import { gitTimeoutMs } from "../../extensions/pi-claude-marketplace/platform/git-timeout.ts";

for (const { value, limit } of [
  { value: "1000", limit: 1000 },
  { value: " 1000 ", limit: 1000 },
  { value: "1", limit: 1 },
  { value: "2147483647", limit: 2147483647 },
  { value: "2147483648", limit: 2147483647 },
  { value: "99999999999999999999999", limit: 2147483647 },
  { value: "", limit: 120000 },
  { value: "0", limit: 120000 },
  { value: "-1", limit: 120000 },
  { value: "1.5", limit: 120000 },
  { value: "1e3", limit: 120000 },
  { value: "1000ms", limit: 120000 },
  { value: "abc", limit: 120000 },
]) {
  test(`D-SG-13: CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS ${JSON.stringify(value)} gives ${limit} ms`, () => {
    // arrange
    const env = { CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS: value };

    // act
    const timeoutMs = gitTimeoutMs(env);

    // assert
    assert.strictEqual(timeoutMs, limit);
  });
}

test("D-SG-13: an unset CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS gives 120000 ms", () => {
  // arrange
  const env = {};

  // act
  const timeoutMs = gitTimeoutMs(env);

  // assert
  assert.strictEqual(timeoutMs, 120000);
});

test("D-SG-13: the process environment is read again on every call", (t) => {
  // arrange
  const previous = process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
    } else {
      process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = previous;
    }
  });
  process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = "5000";
  const first = gitTimeoutMs();
  process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = "7000";

  // act
  const second = gitTimeoutMs();

  // assert
  assert.deepStrictEqual([first, second], [5000, 7000]);
});
