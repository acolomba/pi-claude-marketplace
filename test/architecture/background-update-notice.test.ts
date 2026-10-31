// test/architecture/background-update-notice.test.ts
//
// Byte-equality lock for the background update notice (AUP-03, D-PL8-10).
// `notifyBackgroundUpdate` emits the raw load-origin `background-update` kind
// (WIRE-01, D-14), outside the structured NotificationMessage entrypoint, so
// the catalog-uat walk never drives it. This lock reads the three
// `background-update-*` blocks from docs/output-catalog.md and asserts that the
// tui text strategy emits each one byte for byte, in one info-severity call.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { notifyBackgroundUpdate } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

import { readCatalogBlock } from "./catalog-block.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { BackgroundUpdatePlugin } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

type NotifyArguments = [message: string, severity?: "info" | "warning" | "error"];

function updated(name: string, scope: BackgroundUpdatePlugin["scope"]): BackgroundUpdatePlugin {
  return { name, marketplace: "tools", scope, fromVersion: "1.0.0", toVersion: "1.1.0" };
}

// Each catalog block documents the rows named beside it. The "many" rows name
// three plugins, one of them in both scopes, so that block also proves the
// scope dedupe.
const CATALOG_ROWS: readonly {
  readonly state: string;
  readonly plugins: readonly BackgroundUpdatePlugin[];
}[] = [
  {
    state: "background-update-one",
    plugins: [
      {
        name: "demo",
        marketplace: "tools",
        scope: "user",
        fromVersion: "1.0.0",
        toVersion: "1.10.0",
      },
    ],
  },
  {
    state: "background-update-two",
    plugins: [updated("alpha", "project"), updated("beta", "user")],
  },
  {
    state: "background-update-many",
    plugins: [
      updated("alpha", "project"),
      updated("beta", "project"),
      updated("alpha", "user"),
      updated("gamma", "user"),
    ],
  },
];

function loadRun(): NotificationRun {
  return {
    origin: { kind: "load" },
    softDeps: { piSubagentsLoaded: false, piMcpAdapterLoaded: false, workflowEngineLoaded: false },
    entrySink: {
      appendEntry(): never {
        throw new Error("A text-mode load run cannot append entries");
      },
    },
  };
}

function emit(t: TestContext, plugins: readonly BackgroundUpdatePlugin[]): NotifyArguments[] {
  const notify = t.mock.fn<(...args: NotifyArguments) => void>();
  const ctx: NotificationContext = { mode: "tui", ui: { notify } };
  notifyBackgroundUpdate(ctx, loadRun(), plugins);
  return notify.mock.calls.map((call) => call.arguments);
}

for (const { state, plugins } of CATALOG_ROWS) {
  test(`AUP-03: the ${state} notice matches its catalog block in one info call`, async (t) => {
    // arrange
    const block = await readCatalogBlock(state);

    // act
    const calls = emit(t, plugins);

    // assert
    assert.deepStrictEqual(calls, [[block, "info"]]);
  });
}
