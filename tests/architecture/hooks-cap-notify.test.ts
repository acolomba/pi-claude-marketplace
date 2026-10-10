// tests/architecture/hooks-cap-notify.test.ts
//
// Byte-equality pin for the Stop-hook override-cap warning seam
// (STOP-07 / D-88-01). Mirrors the notifyAsyncRewakeSummary byte precedent in
// hooks-async-rewake.test.ts: the seam is a bridge diagnostic emitted directly
// via ctx.ui.notify (NOT a structured NotificationMessage), so the catalog-uat
// forward walk and the notify-grammar invariant -- both of which drive only
// NotificationMessage fixtures through notify() -- never exercise it. This
// dedicated test reads the `stop-override-cap` block from docs/output-catalog.md
// at test time (the same way catalog-uat reads its blocks) and asserts that
// notifyStopHookOverrideCap's ctx.ui.notify output matches it byte-for-byte at
// warning severity with a single call (D-88-01 documentation parity + D-88-07
// honest reconciliation: the seam satisfies the invariant's STRUCTURAL rule --
// non-empty summary first line + `\n\n` block -- without being silently
// exempted from a NotificationMessage-only gate).

import assert from "node:assert/strict";
import test from "node:test";

import { notifyStopHookOverrideCap } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

import { readCatalogBlock } from "./catalog-block.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

// The plugin id baked into the catalog's `stop-override-cap` fenced block. The
// byte-equality assertion drives the seam with this exact id so the emitted
// string matches the documented example verbatim.
const CATALOG_PLUGIN_ID = "ralph-wiggum";

interface Notification {
  readonly message: string;
  readonly severity: string | undefined;
}

interface RecordingCtx {
  readonly ctx: ExtensionContext;
  readonly notifications: Notification[];
}

function makeCtx(t: TestContext): RecordingCtx {
  const notifications: Notification[] = [];
  const notify = t.mock.fn((message: string, severity?: string): void => {
    notifications.push({ message, severity });
  });
  // The seam reads only `ui.notify`; the rest of the host context is irrelevant to it.
  const ctx = { ui: { notify } } as unknown as ExtensionContext;

  return { ctx, notifications };
}

function onlyNotification(notifications: readonly Notification[]): Notification {
  const [first] = notifications;
  assert.ok(first !== undefined, "the cap-trip seam must emit a notification");

  return first;
}

test("STOP-07 / D-88-01: notifyStopHookOverrideCap emits one warning-severity ctx.ui.notify call", (t) => {
  // arrange
  const { ctx, notifications } = makeCtx(t);

  // act
  notifyStopHookOverrideCap(ctx, CATALOG_PLUGIN_ID);

  // assert
  assert.equal(notifications.length, 1, "the cap-trip seam must call ctx.ui.notify exactly once");
  assert.equal(
    onlyNotification(notifications).severity,
    "warning",
    "the cap-trip warning must be warning severity",
  );
});

test("STOP-07 / D-88-01: cap-trip first line is a non-empty summary followed by a `\\n\\n` detail block naming the plugin", (t) => {
  // arrange
  const { ctx, notifications } = makeCtx(t);

  // act
  notifyStopHookOverrideCap(ctx, CATALOG_PLUGIN_ID);

  // assert
  const emitted = onlyNotification(notifications).message;
  const firstNewline = emitted.indexOf("\n");
  const firstLine = firstNewline === -1 ? emitted : emitted.slice(0, firstNewline);
  assert.ok(firstLine.length > 0, "the summary first line must be non-empty");
  assert.ok(
    emitted.includes("\n\n"),
    "the summary must be its own block, separated by a blank line",
  );

  const detail = emitted.slice(emitted.indexOf("\n\n") + 2);
  assert.notEqual(detail, firstLine, "the detail block must be distinct from the summary");
  assert.ok(detail.includes(CATALOG_PLUGIN_ID), "the detail block must name the blocking plugin");
});

test("STOP-07 / D-88-01: cap-trip output is byte-equal to the docs/output-catalog.md `stop-override-cap` block", async (t) => {
  // arrange
  const expected = await readCatalogBlock("stop-override-cap");
  const { ctx, notifications } = makeCtx(t);

  // act
  notifyStopHookOverrideCap(ctx, CATALOG_PLUGIN_ID);

  // assert
  assert.equal(
    onlyNotification(notifications).message,
    expected,
    "notifyStopHookOverrideCap output drifted from the catalog's stop-override-cap block",
  );
});
