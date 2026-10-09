import assert from "node:assert/strict";
import test from "node:test";

import { resolveCommandError } from "../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";

for (const needsReload of [false, true]) {
  test(`resolves a command error with reload ${needsReload}`, () => {
    // arrange
    const cause = new Error("Failed at /private/work/config.json", { cause: new Error("nested") });

    // act
    const presentation = resolveCommandError(cause, needsReload);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["Failed at config.json", "nested"], truncated: false },
    });
  });
}

for (const cause of [null, undefined]) {
  test(`resolves thrown ${String(cause)} to a nonempty cause`, () => {
    // arrange
    const needsReload = false;

    // act
    const presentation = resolveCommandError(cause, needsReload);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["Unknown thrown value."], truncated: false },
    });
  });
}

test("contains a throwing cause accessor without serializing the secondary error", () => {
  // arrange
  class HostileError extends Error {
    override get cause(): unknown {
      throw new Error("secret");
    }
  }

  // act
  const presentation = resolveCommandError(new HostileError("failure"), true);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: true,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["Unable to read command failure."], truncated: false },
  });
});
