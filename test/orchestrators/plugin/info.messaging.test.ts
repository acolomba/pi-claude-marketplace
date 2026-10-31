import assert from "node:assert/strict";
import test from "node:test";

import {
  PLUGIN_INFO_CONTEXT,
  type PluginInfoCascadeMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

void ({ status: "skipped", name: "alpha", reasons: [] } satisfies PluginInfoCascadeMsg);

// @ts-expect-error plugin-info cascade rows require explicit reasons
void ({ status: "skipped", name: "alpha" } satisfies PluginInfoCascadeMsg);

void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
} satisfies PluginInfoCascadeMsg);

// UPDT-02: the held-update cause trailer lives on
// `PluginUpdateSkippedMessage`, not on the shared `PluginSkippedMessage`
// this command's cascade message reuses, so `info`'s rows cannot grow one
// and stay byte-frozen.
void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
  // @ts-expect-error a plugin-info cascade row structurally excludes a failure cause
  cause: new Error("boom"),
} satisfies PluginInfoCascadeMsg);

test("exports the complete plugin-info cascade context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "rowPolicies"];
  const expectedRenderKeys = ["skipped"];

  // act
  const contextKeys = Object.keys(PLUGIN_INFO_CONTEXT);
  const renderKeys = Object.keys(PLUGIN_INFO_CONTEXT.rowPolicies);

  // assert
  assert.deepStrictEqual(contextKeys, expectedContextKeys);
  assert.deepStrictEqual(PLUGIN_INFO_CONTEXT.Messaging, { label: "Plugin info" });
  assert.deepStrictEqual(renderKeys, expectedRenderKeys);
});

test("renders a bare skipped row with truly omitted optional fields", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "alpha",
    reasons: [],
  } as const satisfies ResolvedRow<PluginInfoCascadeMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "alpha",
    reasons: [],
  });
  assert.deepStrictEqual(Object.keys(row), ["status", "name", "reasons"]);
  assert.strictEqual(renderedRow, "⊘ alpha (skipped)");
});

test("folds a same-scope skipped row and preserves version and ordered reasons", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "beta",
    scope: "project",
    version: "1.2.3",
    reasons: ["already disabled", "up-to-date"],
  } as const satisfies ResolvedRow<PluginInfoCascadeMsg>;

  // act
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "beta",
    scope: "project",
    version: "1.2.3",
    reasons: ["already disabled", "up-to-date"],
  });
  assert.strictEqual(renderedRow, "⊘ beta v1.2.3 (skipped) {already disabled, up-to-date}");
});

test("renders a cross-scope skipped row with its resolved reasons", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "gamma",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["not in manifest"],
  } as const satisfies ResolvedRow<PluginInfoCascadeMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "gamma",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["not in manifest"],
  });
  assert.strictEqual(renderedRow, "⊘ gamma [project] v#2ea95f8 (skipped) {not in manifest}");
});

test("PLUGIN_INFO_CONTEXT declares complete row policies", () => {
  // act
  const policies = PLUGIN_INFO_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, { skipped: { markers: false, contentReasons: true } });
});
