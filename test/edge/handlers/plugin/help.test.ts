// Owner for edge/handlers/plugin/help.ts.
//
// Tests for the /claude:plugin help handler:
//   - empty args or "help" topic emits TOP_LEVEL_USAGE at info severity
//   - "marketplace" topic emits MARKETPLACE_USAGE at info severity
//   - unknown topic emits usage error at error severity

import assert from "node:assert/strict";
import { test } from "node:test";

import { makeHelpHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts";
import {
  MARKETPLACE_USAGE,
  TOP_LEVEL_USAGE,
} from "../../../../extensions/pi-claude-marketplace/edge/router.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import {
  createMachineNotificationBoundary,
  createNotificationBoundary,
} from "../../notification-boundary.ts";

test("help with empty args emits top-level usage at info severity", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const helpHandler = makeHelpHandler();

  // act
  await helpHandler("", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [{ message: TOP_LEVEL_USAGE, severity: "info" }]);
  verifyBoundary();
});

test("help with 'help' topic emits top-level usage at info severity", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const helpHandler = makeHelpHandler();

  // act
  await helpHandler("help", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [{ message: TOP_LEVEL_USAGE, severity: "info" }]);
  verifyBoundary();
});

test("help with 'marketplace' topic emits marketplace usage at info severity", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const helpHandler = makeHelpHandler();

  // act
  await helpHandler("marketplace", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [{ message: MARKETPLACE_USAGE, severity: "info" }]);
  verifyBoundary();
});

test("help with unknown topic emits usage error at error severity", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const helpHandler = makeHelpHandler();

  // act
  await helpHandler("unknown", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: 'Unknown help topic: "unknown".\n\nUsage: /claude:plugin help [marketplace]',
      severity: "error",
    },
  ]);
  verifyBoundary();
});

for (const { args, message } of [
  { args: "--bogus", message: 'Unknown flag: "--bogus".' },
  { args: "marketplace --bogus", message: 'Unknown flag: "--bogus".' },
  { args: "marketplace extra", message: "Too many arguments." },
]) {
  test(`help rejects ${args} with the shared argument sentence`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const helpHandler = makeHelpHandler();

    // act
    await helpHandler(args, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${message}\n\nUsage: /claude:plugin help [marketplace]`, severity: "error" },
    ]);
    verifyBoundary();
  });
}

for (const mode of ["json", "rpc"] as const) {
  for (const { topic, usage } of [
    { topic: "", usage: TOP_LEVEL_USAGE },
    { topic: "help", usage: TOP_LEVEL_USAGE },
    { topic: "marketplace", usage: MARKETPLACE_USAGE },
  ]) {
    test(`appends help for ${topic} in ${mode}`, async () => {
      // arrange
      const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
      const help = makeHelpHandler();

      // act
      await help(topic, ctx, run);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "usage-info",
            severity: "info",
            needsReload: false,
            usage,
          },
        },
      ]);
      capture.assertValid();
      verifyBoundary();
    });
  }

  test(`appends an unknown help topic in ${mode}`, async () => {
    // arrange
    const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
    const help = makeHelpHandler();

    // act
    await help("unknown", ctx, run);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "usage-error",
          severity: "error",
          needsReload: false,
          message: 'Unknown help topic: "unknown".',
          usage: "Usage: /claude:plugin help [marketplace]",
        },
      },
    ]);
    capture.assertValid();
    verifyBoundary();
  });
}
