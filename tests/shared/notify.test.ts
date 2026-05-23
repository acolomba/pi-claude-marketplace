import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

/**
 * ES-1, ES-2, ES-4, NFR-9, D-07 -- severity-named notify wrappers.
 *
 * Mock ExtensionContext is a small object literal `{ ui: { notify: mock.fn() } }`
 * using node:test's built-in mock surface (no third-party mocking framework).
 */

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

test("notifySuccess calls ctx.ui.notify with no severity arg (ES-1)", () => {
  const ctx = makeCtx();
  notifySuccess(ctx as never, "all good");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["all good"]);
});

test("notifyWarning calls ctx.ui.notify with 'warning' severity (ES-2)", () => {
  const ctx = makeCtx();
  notifyWarning(ctx as never, "soft-dep unloaded");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["soft-dep unloaded", "warning"]);
});

test("notifyError without cause calls ctx.ui.notify with 'error' severity and verbatim message (ES-2)", () => {
  const ctx = makeCtx();
  notifyError(ctx as never, "operation failed");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["operation failed", "error"]);
});

test("notifyError with Error cause appends MSG-CC-1 trailer with blank-line separator (D-CMC-12)", () => {
  const ctx = makeCtx();
  notifyError(ctx as never, "outer fail", new Error("inner fail"));
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Phase 13 / D-CMC-12: trailer is `cause: <msg>` lowercase per MSG-CC-1,
  // joined with `\n\n` per the MSG-RH-1 blank-line discipline shared with
  // the reload-hint composer.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "outer fail\n\ncause: inner fail",
    "error",
  ]);
});

test("notifyError with non-Error string cause renders trailer verbatim (MSG-CC-1)", () => {
  const ctx = makeCtx();
  notifyError(ctx as never, "msg", "string cause");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Non-Error string cause renders verbatim in the MSG-CC-1 trailer.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["msg\n\ncause: string cause", "error"]);
});

test("notifyError NFR-9: stack traces / absolute paths from cause are not surfaced", () => {
  // The wrapper's MSG-CC-1 trailer exposes ONLY cause.message via
  // causeChainTrailer. cause.stack is NOT included.
  const ctx = makeCtx();
  const err = new Error("inner");
  err.stack = "Error: inner\n    at /Users/secret/path/file.ts:1:1";
  notifyError(ctx as never, "outer", err);
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  assert.ok(
    !callArgs[0].includes("/Users/secret/path"),
    "NFR-9: notifyError must not surface absolute paths from cause.stack",
  );
  assert.match(callArgs[0], /^outer\n\ncause: inner$/);
});

test("notifyError walks the depth-5 cause chain (MSG-CC-1)", () => {
  const ctx = makeCtx();
  const inner = new Error("inner", { cause: new Error("root") });
  notifyError(ctx as never, "outer", inner);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "outer\n\ncause: inner -> root",
    "error",
  ]);
});
