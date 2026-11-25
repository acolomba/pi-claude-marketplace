// Owner for edge/handlers/plugin/reload.ts.
//
// RELOADCMD-D1: `/claude:plugin reload` checks, in order, whether the host
// takes later commands, its arguments, and whether the session is idle; only
// then does it report `reload-started` and ask the registration for the
// reload. Every case uses a strict context that states each read: the host
// field once, `isIdle()` once on the paths that reach it, and the reads of the
// emission. The reload port is a recording function, so a case that must not
// reload proves it by an empty record.
//
// The shared argument prelude is proved in shared.test.ts; the cases here
// prove only that this verb supplies its usage and surplus message.

import assert from "node:assert/strict";
import { test } from "node:test";

import { when } from "strong-mock";

import { makeReloadHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import {
  createMachineNotificationBoundary,
  createNotificationBoundary,
} from "../../notification-boundary.ts";

import type { ExtensionCommandContext } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin reload";

/** A reload port that records each context it receives. */
function recordingPort(): {
  readonly requests: ExtensionCommandContext[];
  readonly requestReload: (ctx: ExtensionCommandContext) => void;
} {
  const requests: ExtensionCommandContext[] = [];
  return {
    requests,
    requestReload: (ctx) => {
      requests.push(ctx);
    },
  };
}

test("refuses in a host without a UI with an empty usage, never reading idleness or reloading (RELOADCMD-D1)", async () => {
  // arrange
  const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary("json");
  when(() => ctx.hasUI)
    .thenReturn(false)
    .times(1);
  const { requests, requestReload } = recordingPort();

  // act
  await makeReloadHandler(requestReload)("", ctx, run);

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
        message:
          "Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes.",
        usage: "",
      },
    },
  ]);
  capture.assertValid();
  assert.deepStrictEqual(requests, []);
  verifyBoundary();
});

for (const { args, message } of [
  { args: "--bogus", message: 'Unknown flag: "--bogus".' },
  { args: "now", message: "reload takes no arguments." },
]) {
  test(`rejects ${args} with the reload usage and never reloads (RELOADCMD-D1)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    when(() => ctx.hasUI)
      .thenReturn(true)
      .times(1);
    const { requests, requestReload } = recordingPort();

    // act
    await makeReloadHandler(requestReload)(args, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${message}\n\n${USAGE}`, severity: "error" },
    ]);
    assert.deepStrictEqual(requests, []);
    verifyBoundary();
  });
}

test("refuses a busy session with Claude Code's busy words and never reloads (RELOADCMD-D1)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  when(() => ctx.hasUI)
    .thenReturn(true)
    .times(1);
  when(() => ctx.isIdle())
    .thenReturn(false)
    .times(1);
  const { requests, requestReload } = recordingPort();

  // act
  await makeReloadHandler(requestReload)("", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: "The session is busy, so plugins were not reloaded. Ask again once it is idle.",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(requests, []);
  verifyBoundary();
});

test("an idle rpc session appends reload-started, then requests one reload of its context (RELOADCMD-D1)", async () => {
  // arrange
  const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary("rpc");
  when(() => ctx.hasUI)
    .thenReturn(true)
    .times(1);
  when(() => ctx.isIdle())
    .thenReturn(true)
    .times(1);
  const order: string[] = [];
  const requests: ExtensionCommandContext[] = [];
  const recorded = {
    ...run,
    entrySink: {
      appendEntry: (customType: string, payload: unknown): void => {
        order.push("append");
        run.entrySink.appendEntry(customType, payload);
      },
    },
  };

  // act
  await makeReloadHandler((requested) => {
    order.push("reload");
    requests.push(requested);
  })("", ctx, recorded);

  // assert
  assert.deepStrictEqual(order, ["append", "reload"]);
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "reload-started",
        severity: "info",
        needsReload: false,
      },
    },
  ]);
  capture.assertValid();
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0], ctx);
  verifyBoundary();
});

test("an idle terminal session emits no notice and requests one reload (RELOADCMD-D1)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, undefined, 1);
  when(() => ctx.hasUI)
    .thenReturn(true)
    .times(1);
  when(() => ctx.isIdle())
    .thenReturn(true)
    .times(1);
  const { requests, requestReload } = recordingPort();

  // act
  await makeReloadHandler(requestReload)("", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0], ctx);
  verifyBoundary();
});
