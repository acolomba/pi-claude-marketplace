import { MARKETPLACE_ADD_FIXTURES } from "./fixtures/marketplace-add.ts";
import { MARKETPLACE_AUTOUPDATE_FIXTURES } from "./fixtures/marketplace-autoupdate.ts";
import { MARKETPLACE_INFO_FIXTURES } from "./fixtures/marketplace-info.ts";
import { MARKETPLACE_LIST_FIXTURES } from "./fixtures/marketplace-list.ts";
import { MARKETPLACE_NOAUTOUPDATE_FIXTURES } from "./fixtures/marketplace-noautoupdate.ts";
import { MARKETPLACE_REMOVE_FIXTURES } from "./fixtures/marketplace-remove.ts";
import { MARKETPLACE_UPDATE_FIXTURES } from "./fixtures/marketplace-update.ts";
import { PLUGIN_APPLY_FIXTURES } from "./fixtures/plugin-apply.ts";
import { PLUGIN_BOOTSTRAP_FIXTURES } from "./fixtures/plugin-bootstrap.ts";
import { PLUGIN_DISABLE_FIXTURES } from "./fixtures/plugin-disable.ts";
import { PLUGIN_ENABLE_FIXTURES } from "./fixtures/plugin-enable.ts";
import { PLUGIN_FETCH_FIXTURES } from "./fixtures/plugin-fetch.ts";
import { PLUGIN_IMPORT_FIXTURES } from "./fixtures/plugin-import.ts";
import { PLUGIN_INFO_FIXTURES } from "./fixtures/plugin-info.ts";
import { PLUGIN_INSTALL_FIXTURES } from "./fixtures/plugin-install.ts";
import { PLUGIN_LIST_FIXTURES } from "./fixtures/plugin-list.ts";
import { PLUGIN_PENDING_FIXTURES } from "./fixtures/plugin-pending.ts";
import { PLUGIN_PRUNE_FIXTURES } from "./fixtures/plugin-prune.ts";
import { PLUGIN_REINSTALL_FIXTURES } from "./fixtures/plugin-reinstall.ts";
import { PLUGIN_UNINSTALL_FIXTURES } from "./fixtures/plugin-uninstall.ts";
import { PLUGIN_UPDATE_FIXTURES } from "./fixtures/plugin-update.ts";
import { RECONCILE_APPLIED_FIXTURES } from "./fixtures/reconcile-applied.ts";

import type { CatalogFixture, FixtureMap } from "./fixture-types.ts";

/**
 * The catalog fixture modules, one per command surface. The byte contract and
 * the wire proof both read this list, so the two cannot drift onto different
 * fixture sets.
 */
export const FIXTURE_MAPS: readonly FixtureMap[] = [
  PLUGIN_LIST_FIXTURES,
  PLUGIN_INSTALL_FIXTURES,
  PLUGIN_UNINSTALL_FIXTURES,
  PLUGIN_PRUNE_FIXTURES,
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
  PLUGIN_APPLY_FIXTURES,
  RECONCILE_APPLIED_FIXTURES,
  MARKETPLACE_REMOVE_FIXTURES,
  MARKETPLACE_UPDATE_FIXTURES,
  PLUGIN_ENABLE_FIXTURES,
  PLUGIN_DISABLE_FIXTURES,
  MARKETPLACE_AUTOUPDATE_FIXTURES,
  MARKETPLACE_NOAUTOUPDATE_FIXTURES,
];

/** The `section::state` key one catalog example and its fixture share. */
export function tupleKey(section: string, state: string): string {
  return `${section}::${state}`;
}

/**
 * Merges fixture modules into one map. A duplicate tuple or an empty section
 * throws, so a fixture can neither shadow another nor vanish silently.
 */
export function mergeFixtureMaps(fixtureMaps: readonly FixtureMap[]): FixtureMap {
  const merged: Record<string, Record<string, CatalogFixture>> = {};
  for (const fixtureMap of fixtureMaps) {
    for (const [section, states] of Object.entries(fixtureMap)) {
      if (Object.keys(states).length === 0) {
        throw new Error(`Catalog fixture section must not be empty: ${section}`);
      }

      const mergedStates = merged[section] ?? {};
      for (const [state, fixture] of Object.entries(states)) {
        if (Object.hasOwn(mergedStates, state)) {
          throw new Error(`Duplicate catalog fixture tuple: ${tupleKey(section, state)}`);
        }

        mergedStates[state] = fixture;
      }

      merged[section] = mergedStates;
    }
  }

  return merged;
}
