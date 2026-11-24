// Owner for edge/handlers/plugin/help.ts.
//
// Tests for the /claude:plugin help handler:
//   - empty args or "help" topic emits the top-level usage of the host at info
//     severity: with reload where the host takes later commands, without it
//     where it does not (RELOADCMD-D1); only that arm reads the host
//   - "marketplace" and "market" topics emit MARKETPLACE_USAGE at info severity
//   - unknown topic emits usage error at error severity

import assert from "node:assert/strict";
import { test } from "node:test";

import { when } from "strong-mock";

import { makeHelpHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts";
import {
  MARKETPLACE_USAGE,
  topLevelUsage,
} from "../../../../extensions/pi-claude-marketplace/edge/router.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import {
  createMachineNotificationBoundary,
  createNotificationBoundary,
} from "../../notification-boundary.ts";

for (const { topic, hasUI, host } of [
  { topic: "", hasUI: true, host: "a host that takes later commands" },
  { topic: "help", hasUI: true, host: "a host that takes later commands" },
  { topic: "", hasUI: false, host: "a one-shot host" },
  { topic: "help", hasUI: false, host: "a one-shot host" },
]) {
  test(`help with ${JSON.stringify(topic)} emits the top-level usage of ${host} at info severity (RELOADCMD-D1)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    when(() => ctx.hasUI)
      .thenReturn(hasUI)
      .times(1);
    const helpHandler = makeHelpHandler();

    // act
    await helpHandler(topic, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [
      { message: topLevelUsage({ hasUI }), severity: "info" },
    ]);
    verifyBoundary();
  });
}

for (const topic of ["marketplace", "market"]) {
  test(`help with '${topic}' topic emits marketplace usage at info severity`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const helpHandler = makeHelpHandler();

    // act
    await helpHandler(topic, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [{ message: MARKETPLACE_USAGE, severity: "info" }]);
    verifyBoundary();
  });
}

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
  // RELOADCMD-D1: Pi binds a UI over rpc and none in json mode.
  const hasUI = mode === "rpc";
  for (const { topic, usage, readsHost } of [
    { topic: "", usage: topLevelUsage({ hasUI }), readsHost: true },
    { topic: "help", usage: topLevelUsage({ hasUI }), readsHost: true },
    { topic: "marketplace", usage: MARKETPLACE_USAGE, readsHost: false },
    { topic: "market", usage: MARKETPLACE_USAGE, readsHost: false },
  ]) {
    test(`appends help for ${topic} in ${mode}`, async () => {
      // arrange
      const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
      if (readsHost) {
        when(() => ctx.hasUI)
          .thenReturn(hasUI)
          .times(1);
      }

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
