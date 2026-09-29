/**
 * tests/architecture/soft-dep-marker-policy.test.ts -- SC-5 statement of the
 * per-verb soft-dependency marker table.
 *
 * D-12: each command's marker policy is data on its `CommandContext`, in a
 * `markers` map total over the command's own statuses. The legacy central
 * `notify()` path reads `CENTRAL_MARKER_POLICY`. `resolveRows` appends a
 * `{requires ...}` marker only for a status its policy maps to `true`.
 *
 * Soft-dependency markers are possible only on the four statuses whose row can
 * declare `dependencies`: `installed`, `updated`, `reinstalled`, and
 * `partially-installed`. Every other status is off in every policy.
 *
 * `plugin list`'s `partially-installed` is the one deliberate off among those
 * four. Its arm composes the row through `pluginRow`, and its producer never
 * sets `dependencies` on that row, so the value has no byte effect today; it
 * is recorded as data all the same.
 *
 * MSG-SD-3 keeps removal rows (`uninstalled`) marker-free, and ENBL-15 /
 * ENBL-18 keep `disabled` rows marker-free.
 *
 * The table below is written out as an independent literal, one row per
 * context plus `CENTRAL_MARKER_POLICY`, so a changed policy value turns exactly
 * that row red. This suite only restates data. The derivation (policy x
 * dependencies x snapshot -> markers) is owned by
 * tests/shared/notification-resolve.test.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { IMPORT_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts";
import { ADD_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";
import {
  AUTOUPDATE_CONTEXT,
  NOAUTOUPDATE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts";
import { LIST_CONTEXT as MARKETPLACE_LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts";
import { REMOVE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts";
import { UPDATE_CONTEXT as MARKETPLACE_UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts";
import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { FETCH_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts";
import { PLUGIN_INFO_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts";
import { INSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { LIST_CONTEXT as PLUGIN_LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { REINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { UNINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { UPDATE_CONTEXT as PLUGIN_UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import {
  PENDING_CONTEXT,
  RECONCILE_APPLIED_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import { CENTRAL_MARKER_POLICY } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

/** The marker policy each named table row states, read from its module. */
const DECLARED_MARKERS = {
  "INSTALL_CONTEXT (plugin/install.messaging.ts)": INSTALL_CONTEXT.markers,
  "LIST_CONTEXT (plugin/list.messaging.ts)": PLUGIN_LIST_CONTEXT.markers,
  "FETCH_CONTEXT (plugin/fetch.messaging.ts)": FETCH_CONTEXT.markers,
  "UPDATE_CONTEXT (plugin/update.messaging.ts)": PLUGIN_UPDATE_CONTEXT.markers,
  "ENABLE_CONTEXT (plugin/enable-disable.messaging.ts)": ENABLE_CONTEXT.markers,
  "DISABLE_CONTEXT (plugin/enable-disable.messaging.ts)": DISABLE_CONTEXT.markers,
  "REINSTALL_CONTEXT (plugin/reinstall.messaging.ts)": REINSTALL_CONTEXT.markers,
  "UNINSTALL_CONTEXT (plugin/uninstall.messaging.ts)": UNINSTALL_CONTEXT.markers,
  "PLUGIN_INFO_CONTEXT (plugin/info.messaging.ts)": PLUGIN_INFO_CONTEXT.markers,
  "IMPORT_CONTEXT (import/execute.messaging.ts)": IMPORT_CONTEXT.markers,
  "UPDATE_CONTEXT (marketplace/update.messaging.ts)": MARKETPLACE_UPDATE_CONTEXT.markers,
  "REMOVE_CONTEXT (marketplace/remove.messaging.ts)": REMOVE_CONTEXT.markers,
  "AUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)": AUTOUPDATE_CONTEXT.markers,
  "NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)": NOAUTOUPDATE_CONTEXT.markers,
  "ADD_CONTEXT (marketplace/add.messaging.ts)": ADD_CONTEXT.markers,
  "LIST_CONTEXT (marketplace/list.messaging.ts)": MARKETPLACE_LIST_CONTEXT.markers,
  "PENDING_CONTEXT (reconcile/reconcile.messaging.ts)": PENDING_CONTEXT.markers,
  "RECONCILE_APPLIED_CONTEXT (reconcile/reconcile.messaging.ts)": RECONCILE_APPLIED_CONTEXT.markers,
  "CENTRAL_MARKER_POLICY (legacy notify)": CENTRAL_MARKER_POLICY,
};

for (const { name, markers } of [
  {
    name: "INSTALL_CONTEXT (plugin/install.messaging.ts)",
    markers: {
      installed: true,
      "partially-installed": true,
      failed: false,
      unavailable: false,
      "partially-available": false,
      disabled: false,
    },
  },
  {
    name: "LIST_CONTEXT (plugin/list.messaging.ts)",
    markers: {
      installed: true,
      available: false,
      "partially-available": false,
      unavailable: false,
      upgradable: false,
      "partially-installed": false,
      "partially-upgradable": false,
      disabled: false,
      failed: false,
      remote: false,
    },
  },
  {
    name: "FETCH_CONTEXT (plugin/fetch.messaging.ts)",
    markers: {
      available: false,
      "partially-available": false,
      unavailable: false,
      remote: false,
      skipped: false,
      failed: false,
    },
  },
  {
    name: "UPDATE_CONTEXT (plugin/update.messaging.ts)",
    markers: {
      updated: true,
      "partially-installed": true,
      skipped: false,
      "partially-upgradable": false,
      failed: false,
    },
  },
  {
    name: "ENABLE_CONTEXT (plugin/enable-disable.messaging.ts)",
    markers: { installed: true, "partially-installed": true, skipped: false, failed: false },
  },
  {
    name: "DISABLE_CONTEXT (plugin/enable-disable.messaging.ts)",
    markers: { disabled: false, skipped: false, failed: false },
  },
  {
    name: "REINSTALL_CONTEXT (plugin/reinstall.messaging.ts)",
    markers: { reinstalled: true, skipped: false, failed: false, "manual recovery": false },
  },
  {
    name: "UNINSTALL_CONTEXT (plugin/uninstall.messaging.ts)",
    markers: { uninstalled: false, failed: false },
  },
  {
    name: "PLUGIN_INFO_CONTEXT (plugin/info.messaging.ts)",
    markers: { skipped: false },
  },
  {
    name: "IMPORT_CONTEXT (import/execute.messaging.ts)",
    markers: { installed: true, skipped: false, failed: false, unavailable: false },
  },
  {
    name: "UPDATE_CONTEXT (marketplace/update.messaging.ts)",
    markers: { updated: true, "partially-installed": true, skipped: false, failed: false },
  },
  {
    name: "REMOVE_CONTEXT (marketplace/remove.messaging.ts)",
    markers: { uninstalled: false, failed: false },
  },
  {
    name: "AUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)",
    markers: { failed: false },
  },
  {
    name: "NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)",
    markers: { failed: false },
  },
  {
    name: "ADD_CONTEXT (marketplace/add.messaging.ts)",
    markers: {},
  },
  {
    name: "LIST_CONTEXT (marketplace/list.messaging.ts)",
    markers: {},
  },
  {
    name: "PENDING_CONTEXT (reconcile/reconcile.messaging.ts)",
    markers: {
      "will install": false,
      "will uninstall": false,
      "will enable": false,
      "will disable": false,
      failed: false,
    },
  },
  {
    name: "RECONCILE_APPLIED_CONTEXT (reconcile/reconcile.messaging.ts)",
    markers: {
      installed: true,
      "partially-installed": true,
      uninstalled: false,
      disabled: false,
      failed: false,
    },
  },
  {
    name: "CENTRAL_MARKER_POLICY (legacy notify)",
    markers: {
      installed: true,
      updated: true,
      reinstalled: true,
      "partially-installed": true,
      uninstalled: false,
      disabled: false,
      available: false,
      remote: false,
      unavailable: false,
      "partially-available": false,
      upgradable: false,
      "partially-upgradable": false,
      failed: false,
      skipped: false,
      "manual recovery": false,
      "will install": false,
      "will uninstall": false,
      "will enable": false,
      "will disable": false,
    },
  },
] satisfies readonly {
  name: keyof typeof DECLARED_MARKERS;
  markers: Readonly<Record<string, boolean>>;
}[]) {
  test(`SC-5 / D-12: ${name} declares the per-verb marker policy`, () => {
    // act
    const declared = DECLARED_MARKERS[name];

    // assert
    assert.deepStrictEqual(declared, markers);
  });
}
