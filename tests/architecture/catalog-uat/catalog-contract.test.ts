import assert from "node:assert/strict";
import test from "node:test";

import { MARKETPLACE_ADD_FIXTURES } from "./fixtures/marketplace-add.ts";
import { MARKETPLACE_AUTOUPDATE_FIXTURES } from "./fixtures/marketplace-autoupdate.ts";
import { MARKETPLACE_INFO_FIXTURES } from "./fixtures/marketplace-info.ts";
import { MARKETPLACE_LIST_FIXTURES } from "./fixtures/marketplace-list.ts";
import { MARKETPLACE_NOAUTOUPDATE_FIXTURES } from "./fixtures/marketplace-noautoupdate.ts";
import { MARKETPLACE_REMOVE_FIXTURES } from "./fixtures/marketplace-remove.ts";
import { MARKETPLACE_UPDATE_FIXTURES } from "./fixtures/marketplace-update.ts";
import { PLUGIN_BOOTSTRAP_FIXTURES } from "./fixtures/plugin-bootstrap.ts";
import { PLUGIN_DISABLE_FIXTURES } from "./fixtures/plugin-disable.ts";
import { PLUGIN_ENABLE_FIXTURES } from "./fixtures/plugin-enable.ts";
import { PLUGIN_FETCH_FIXTURES } from "./fixtures/plugin-fetch.ts";
import { PLUGIN_IMPORT_FIXTURES } from "./fixtures/plugin-import.ts";
import { PLUGIN_INFO_FIXTURES } from "./fixtures/plugin-info.ts";
import { PLUGIN_INSTALL_FIXTURES } from "./fixtures/plugin-install.ts";
import { PLUGIN_LIST_FIXTURES } from "./fixtures/plugin-list.ts";
import { PLUGIN_PENDING_FIXTURES } from "./fixtures/plugin-pending.ts";
import { PLUGIN_REINSTALL_FIXTURES } from "./fixtures/plugin-reinstall.ts";
import { PLUGIN_UNINSTALL_FIXTURES } from "./fixtures/plugin-uninstall.ts";
import { PLUGIN_UPDATE_FIXTURES } from "./fixtures/plugin-update.ts";
import { RECONCILE_APPLIED_FIXTURES } from "./fixtures/reconcile-applied.ts";

import type { FixtureMap } from "./fixture-types.ts";

const ALL_IMPORTED_FIXTURE_MAPS: readonly FixtureMap[] = [
  PLUGIN_LIST_FIXTURES,
  PLUGIN_INSTALL_FIXTURES,
  PLUGIN_UNINSTALL_FIXTURES,
  PLUGIN_REINSTALL_FIXTURES,
  PLUGIN_UPDATE_FIXTURES,
  PLUGIN_FETCH_FIXTURES,
  PLUGIN_IMPORT_FIXTURES,
  PLUGIN_BOOTSTRAP_FIXTURES,
  MARKETPLACE_LIST_FIXTURES,
  MARKETPLACE_ADD_FIXTURES,
  MARKETPLACE_INFO_FIXTURES,
  PLUGIN_INFO_FIXTURES,
  PLUGIN_PENDING_FIXTURES,
  RECONCILE_APPLIED_FIXTURES,
  MARKETPLACE_REMOVE_FIXTURES,
  MARKETPLACE_UPDATE_FIXTURES,
  PLUGIN_ENABLE_FIXTURES,
  PLUGIN_DISABLE_FIXTURES,
  MARKETPLACE_AUTOUPDATE_FIXTURES,
  MARKETPLACE_NOAUTOUPDATE_FIXTURES,
];

function countFixtureStates(fixtureMaps: readonly FixtureMap[]): number {
  let count = 0;
  for (const fixtureMap of fixtureMaps) {
    for (const states of Object.values(fixtureMap)) {
      count += Object.keys(states).length;
    }
  }
  return count;
}

test("catalog contract assembles all 20 fixture modules and 190 states", () => {
  assert.equal(ALL_IMPORTED_FIXTURE_MAPS.length, 20);

  const assembledFixtureMaps = ALL_IMPORTED_FIXTURE_MAPS.slice(0, -1);
  assert.equal(countFixtureStates(assembledFixtureMaps), 190);
});
