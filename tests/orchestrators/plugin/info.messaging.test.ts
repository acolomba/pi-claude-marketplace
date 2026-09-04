import assert from "node:assert/strict";
import test from "node:test";

import {
  PLUGIN_INFO_CONTEXT,
  type PluginInfoCascadeMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts";

import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ({ status: "skipped", name: "alpha", reasons: [] } satisfies PluginInfoCascadeMsg);

// @ts-expect-error plugin-info cascade rows require explicit reasons
void ({ status: "skipped", name: "alpha" } satisfies PluginInfoCascadeMsg);

void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
  // @ts-expect-error skipped rows structurally exclude failure causes
  cause: new Error("must stay outside the command-owned row"),
} satisfies PluginInfoCascadeMsg);

test("exports the complete plugin-info cascade context", () => {
  // arrange
  const expectedContextKeys = ["Messaging", "render"];
  const expectedRenderKeys = ["skipped"];

  // act
  const contextKeys = Object.keys(PLUGIN_INFO_CONTEXT);
  const renderKeys = Object.keys(PLUGIN_INFO_CONTEXT.render);

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
  } as const satisfies PluginInfoCascadeMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = PLUGIN_INFO_CONTEXT.render.skipped(row, probe, "user");

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
  } as const satisfies PluginInfoCascadeMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const renderedRow = PLUGIN_INFO_CONTEXT.render.skipped(row, probe, "project");

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

test("renders a cross-scope skipped row without soft-dependency markers", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "gamma",
    scope: "project",
    version: "hash-2ea95f85703d",
    reasons: ["not in manifest"],
  } as const satisfies PluginInfoCascadeMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const renderedRow = PLUGIN_INFO_CONTEXT.render.skipped(row, probe, "user");

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
