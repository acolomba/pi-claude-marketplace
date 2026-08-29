import assert from "node:assert/strict";
import { test } from "node:test";

import { hookDebugLog } from "../../extensions/pi-claude-marketplace/shared/debug-log.ts";

test("emits the exact default-tag message under the exact debug gate", (t) => {
  // arrange
  const previousDebugGate = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebugGate === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebugGate;
    }
  });
  const consoleError = t.mock.method(console, "error", () => undefined);
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";

  // act
  hookDebugLog("sample detail");

  // assert
  assert.deepStrictEqual(
    consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
    [["[hooks] sample detail"]],
  );
});

test("emits the exact custom-tag message under the exact debug gate", (t) => {
  // arrange
  const previousDebugGate = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebugGate === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebugGate;
    }
  });
  const consoleError = t.mock.method(console, "error", () => undefined);
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";

  // act
  hookDebugLog("cache miss", "env");

  // assert
  assert.deepStrictEqual(
    consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
    [["[env] cache miss"]],
  );
});

test("stays silent when the debug gate is undefined", (t) => {
  // arrange
  const previousDebugGate = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebugGate === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebugGate;
    }
  });
  const consoleError = t.mock.method(console, "error", () => undefined);
  delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;

  // act
  hookDebugLog("suppressed detail");

  // assert
  assert.deepStrictEqual(consoleError.mock.calls, []);
});
