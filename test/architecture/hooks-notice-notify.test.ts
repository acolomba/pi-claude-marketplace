// test/architecture/hooks-notice-notify.test.ts
//
// Byte-equality pin for the hook notice seam (HOOK-05 / D-CF5-14 / D-CF5-24).
// Mirrors the override-cap lock in hooks-cap-notify.test.ts: the seam emits a
// raw hook surface, not a structured NotificationMessage, so the catalog-uat
// walk never drives it. This test reads the `hook-notice` block from
// docs/output-catalog.md at test time and asserts that notifyHookNotice's tui
// output matches it byte for byte, with one call at info severity.

import assert from "node:assert/strict";
import test from "node:test";

import { hookSaysText } from "../../extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts";
import { notifyHookNotice } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import { readCatalogBlock } from "./catalog-block.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

interface Notification {
  readonly message: string;
  readonly severity: string | undefined;
}

function makeCtx(t: TestContext): {
  readonly ctx: ExtensionContext;
  readonly notifications: Notification[];
} {
  const notifications: Notification[] = [];
  const notify = t.mock.fn((message: string, severity?: string): void => {
    notifications.push({ message, severity });
  });
  // The seam reads only `mode` and `ui.notify`; the rest of the host context is irrelevant to it.
  const ctx = { mode: "tui", ui: { notify } } as unknown as ExtensionContext;

  return { ctx, notifications };
}

test("HOOK-05 / D-CF5-14: a hook's system message notice is byte-equal to the docs/output-catalog.md `hook-notice` block", async (t) => {
  // arrange
  const expected = await readCatalogBlock("hook-notice");
  const { ctx, notifications } = makeCtx(t);

  // act
  notifyHookNotice(
    ctx,
    runWithNothingLoaded(),
    hookSaysText("UserPromptSubmit", "remember the tests"),
  );

  // assert
  assert.deepStrictEqual(notifications, [{ message: expected, severity: "info" }]);
});
