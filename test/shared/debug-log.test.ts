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
  hookDebugLog("x", "env");

  // assert
  assert.deepStrictEqual(
    consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
    [["[env] x"]],
  );
});

test("emits the default tag and separator for an empty detail", (t) => {
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
  hookDebugLog("");

  // assert
  assert.deepStrictEqual(
    consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
    [["[hooks] "]],
  );
});

for (const { label, detail, line } of [
  {
    label: "the credential of a URL",
    detail: "clone of https://alice:pw-word@example.test/acme/tools.git failed",
    line: "[git] clone of https://***@example.test/acme/tools.git failed",
  },
  {
    label: "the value of a query token",
    detail: "fetch https://example.test/acme/tools.git?private_token=token-word failed",
    line: "[git] fetch https://example.test/acme/tools.git?private_token=*** failed",
  },
  {
    label: "an absolute path",
    detail: "cannot read /home/alice/.pi/agent/pi-claude-marketplace/state.json: EACCES",
    line: "[git] cannot read state.json: EACCES",
  },
  {
    label: "each line of a multi-line detail and keeps every line",
    detail: "first https://alice:pw-word@example.test/a.git\nsecond /home/alice/x/y.json",
    line: "[git] first https://***@example.test/a.git\nsecond y.json",
  },
  {
    label: "nothing of a detail with no credential or path",
    detail: "plugin tools@acme enabled (user scope)",
    line: "[git] plugin tools@acme enabled (user scope)",
  },
]) {
  test(`D-SG-35: redacts ${label} in the logged line`, (t) => {
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
    hookDebugLog(detail, "git");

    // assert
    assert.deepStrictEqual(
      consoleError.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
      [[line]],
    );
  });
}

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

for (const debugGate of ["", "0", "true", " 1 "] as const) {
  test(`stays silent when the debug gate is ${JSON.stringify(debugGate)}`, (t) => {
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
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = debugGate;

    // act
    hookDebugLog("suppressed detail");

    // assert
    assert.deepStrictEqual(consoleError.mock.calls, []);
  });
}
