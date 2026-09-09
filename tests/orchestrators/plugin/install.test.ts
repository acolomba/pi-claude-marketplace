import assert from "node:assert/strict";
import test from "node:test";

import { executeInstallLedger } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function notificationContext(): NotificationContext {
  return { ui: { notify: () => undefined } };
}

test("returns the marketplace-absent ledger result without mutating state", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "install-ledger-absent-");
  const locations = locationsFor("project", environment.cwd);
  const state: ExtensionState = { marketplaces: {}, schemaVersion: 2 };

  // act
  const result = await executeInstallLedger(state, locations, {
    ctx: notificationContext(),
    cwd: environment.cwd,
    marketplace: "missing",
    plugin: "empty",
    scope: "project",
  });

  // assert
  assert.deepStrictEqual(result, { kind: "marketplace-absent" });
  assert.deepStrictEqual(state, { marketplaces: {}, schemaVersion: 2 });
});
