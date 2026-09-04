import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOUPDATE_CONTEXT,
  NOAUTOUPDATE_CONTEXT,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { PluginFailedMessage } from "../../../extensions/pi-claude-marketplace/shared/notify.ts";

test("exports complete and distinct autoupdate command contexts", () => {
  // arrange
  const expectedAutoupdateKeys = ["Messaging", "render"];
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
    cause: new Error("settings write failed"),
  } as const satisfies PluginFailedMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const actual = AUTOUPDATE_CONTEXT.render.failed(row, probe, "user");

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
  } as const satisfies PluginFailedMessage;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const actual = NOAUTOUPDATE_CONTEXT.render.failed(row, probe, "project");

  // assert
  assert.equal(actual, "⊘ beta (failed) {lock held}");
});
