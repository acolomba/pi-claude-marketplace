import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOUPDATE_CONTEXT,
  NOAUTOUPDATE_CONTEXT,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts";
import { type PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports complete and distinct autoupdate command contexts", () => {
  // arrange
  const expectedAutoupdateKeys = ["Messaging", "render", "markers"];
  const expectedRenderKeys = ["failed"];

  // act
  const autoupdateKeys = Object.keys(AUTOUPDATE_CONTEXT);
  const noautoupdateKeys = Object.keys(NOAUTOUPDATE_CONTEXT);

  // assert
  assert.deepEqual(autoupdateKeys, expectedAutoupdateKeys);
  assert.deepEqual(noautoupdateKeys, expectedAutoupdateKeys);
  assert.deepEqual(AUTOUPDATE_CONTEXT.Messaging, { label: "Marketplace autoupdate" });
  assert.deepEqual(NOAUTOUPDATE_CONTEXT.Messaging, { label: "Marketplace noautoupdate" });
  assert.deepEqual(Object.keys(AUTOUPDATE_CONTEXT.render), expectedRenderKeys);
  assert.deepEqual(Object.keys(NOAUTOUPDATE_CONTEXT.render), expectedRenderKeys);
  assert.notStrictEqual(AUTOUPDATE_CONTEXT, NOAUTOUPDATE_CONTEXT);
});

test("renders an autoupdate failure with cross-scope, version, and ordered reasons", () => {
  // arrange
  const row = {
    status: "failed",
    severity: "error",
    name: "alpha",
    scope: "project",
    version: "1.2.3",
    reasons: ["lock held", "permission denied"],
    failure: {
      cause: { causeChain: ["settings write failed"], truncated: false },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow<PluginFailedMessage>;

  // act
  const actual = AUTOUPDATE_CONTEXT.render.failed(row, "user");

  // assert
  assert.equal(actual, "⊘ alpha [project] v1.2.3 (failed) {lock held, permission denied}");
});

test("renders a noautoupdate failure without an inherited scope or optional version", () => {
  // arrange
  const row = {
    status: "failed",
    severity: "warning",
    name: "beta",
    reasons: ["lock held"],
  } as const satisfies ResolvedRow<PluginFailedMessage>;

  // act
  const actual = NOAUTOUPDATE_CONTEXT.render.failed(row, "project");

  // assert
  assert.equal(actual, "⊘ beta (failed) {lock held}");
});
