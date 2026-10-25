/**
 * test/architecture/soft-dep-marker-policy.test.ts -- SC-5 statement of the
 * per-verb soft-dependency marker table.
 *
 * D-12: each command's reason policy is data on its `CommandContext`, in a
 * `rowPolicies` map total over the command's own statuses. The central
 * `notify()` path reads `CENTRAL_ROW_POLICY`. `resolveRows` appends a
 * `{requires ...}` marker only when the status policy enables `markers`.
 *
 * Soft-dependency markers are possible only on the four statuses whose row can
 * declare `dependencies`: `installed`, `updated`, `reinstalled`, and
 * `partially-installed`. Every other status is off in every policy.
 *
 * `plugin list`'s `partially-installed` is the one deliberate off among those
 * four. Its producer never sets `dependencies` on that row. The explicit
 * policy also suppresses markers if a future producer supplies dependencies.
 *
 * MSG-SD-3 keeps removal rows (`uninstalled`) marker-free, and ENBL-15 /
 * ENBL-18 keep `disabled` rows marker-free.
 *
 * The table below is written out as an independent literal, one row per
 * context plus `CENTRAL_ROW_POLICY`, so a changed policy value turns exactly
 * that row red. This suite only restates data. The derivation (policy x
 * dependencies x snapshot -> markers) is owned by
 * test/shared/notification-resolve.test.ts.
 *
 * Two totality cases keep the rows from going missing. The first compares the
 * table's names with `DECLARED_MARKERS`, so a deleted or doubled row is red.
 * The second scans the extension for `satisfies CommandContext<` and compares
 * the contexts it finds with `DECLARED_MARKERS`, so a new context that nobody
 * registers here is red.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { IMPORT_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts";
import { ADD_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";
import {
  AUTOUPDATE_CONTEXT,
  NOAUTOUPDATE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts";
import { MARKETPLACE_LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts";
import { REMOVE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts";
import { UPDATE_CONTEXT as MARKETPLACE_UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts";
import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { FETCH_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts";
import { PLUGIN_INFO_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts";
import { CASCADE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import { INSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { LIST_CONTEXT as PLUGIN_LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { REINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { UNINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { UPDATE_CONTEXT as PLUGIN_UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import {
  PENDING_CONTEXT,
  RECONCILE_APPLIED_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import { CENTRAL_ROW_POLICY } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

import { EXTENSION_ROOT_REL, ORCHESTRATORS_REL } from "./gate-targets.ts";
import { REPO_ROOT, filesMatching, stripComments } from "./source-scan.ts";

/** The one `DECLARED_MARKERS` entry that is not a `CommandContext`. */
const CENTRAL_POLICY_NAME = "CENTRAL_ROW_POLICY (legacy notify)";

/** The marker policy each named table row states, read from its module. */
const DECLARED_MARKERS = {
  "INSTALL_CONTEXT (plugin/install.messaging.ts)": INSTALL_CONTEXT.rowPolicies,
  "CASCADE_CONTEXT (plugin/install-cascade.messaging.ts)": CASCADE_CONTEXT.rowPolicies,
  "LIST_CONTEXT (plugin/list.messaging.ts)": PLUGIN_LIST_CONTEXT.rowPolicies,
  "FETCH_CONTEXT (plugin/fetch.messaging.ts)": FETCH_CONTEXT.rowPolicies,
  "UPDATE_CONTEXT (plugin/update.messaging.ts)": PLUGIN_UPDATE_CONTEXT.rowPolicies,
  "ENABLE_CONTEXT (plugin/enable-disable.messaging.ts)": ENABLE_CONTEXT.rowPolicies,
  "DISABLE_CONTEXT (plugin/enable-disable.messaging.ts)": DISABLE_CONTEXT.rowPolicies,
  "REINSTALL_CONTEXT (plugin/reinstall.messaging.ts)": REINSTALL_CONTEXT.rowPolicies,
  "UNINSTALL_CONTEXT (plugin/uninstall.messaging.ts)": UNINSTALL_CONTEXT.rowPolicies,
  "PLUGIN_INFO_CONTEXT (plugin/info.messaging.ts)": PLUGIN_INFO_CONTEXT.rowPolicies,
  "IMPORT_CONTEXT (import/execute.messaging.ts)": IMPORT_CONTEXT.rowPolicies,
  "UPDATE_CONTEXT (marketplace/update.messaging.ts)": MARKETPLACE_UPDATE_CONTEXT.rowPolicies,
  "REMOVE_CONTEXT (marketplace/remove.messaging.ts)": REMOVE_CONTEXT.rowPolicies,
  "AUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)": AUTOUPDATE_CONTEXT.rowPolicies,
  "NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)": NOAUTOUPDATE_CONTEXT.rowPolicies,
  "ADD_CONTEXT (marketplace/add.messaging.ts)": ADD_CONTEXT.rowPolicies,
  "MARKETPLACE_LIST_CONTEXT (marketplace/list.messaging.ts)": MARKETPLACE_LIST_CONTEXT.rowPolicies,
  "PENDING_CONTEXT (reconcile/reconcile.messaging.ts)": PENDING_CONTEXT.rowPolicies,
  "RECONCILE_APPLIED_CONTEXT (reconcile/reconcile.messaging.ts)":
    RECONCILE_APPLIED_CONTEXT.rowPolicies,
  "CENTRAL_ROW_POLICY (legacy notify)": CENTRAL_ROW_POLICY,
};

/** SC-5: the independent literal each declared policy is compared with. */
const MARKER_POLICY_TABLE = [
  {
    name: "INSTALL_CONTEXT (plugin/install.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      unavailable: { markers: false, contentReasons: true },
      "partially-available": { markers: false, contentReasons: true },
      disabled: { markers: false, contentReasons: true },
    },
  },
  {
    name: "CASCADE_CONTEXT (plugin/install-cascade.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      unavailable: { markers: false, contentReasons: true },
      "partially-available": { markers: false, contentReasons: true },
      disabled: { markers: false, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
    },
  },
  {
    name: "LIST_CONTEXT (plugin/list.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      available: { markers: false, contentReasons: true },
      "partially-available": { markers: false, contentReasons: true },
      unavailable: { markers: false, contentReasons: true },
      upgradable: { markers: false, contentReasons: true },
      "partially-installed": { markers: false, contentReasons: true },
      "partially-upgradable": { markers: false, contentReasons: true },
      disabled: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      remote: { markers: false, contentReasons: true },
    },
  },
  {
    name: "FETCH_CONTEXT (plugin/fetch.messaging.ts)",
    markers: {
      available: { markers: false, contentReasons: false },
      "partially-available": { markers: false, contentReasons: true },
      unavailable: { markers: false, contentReasons: true },
      remote: { markers: false, contentReasons: false },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "UPDATE_CONTEXT (plugin/update.messaging.ts)",
    markers: {
      updated: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      "partially-upgradable": { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "ENABLE_CONTEXT (plugin/enable-disable.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "DISABLE_CONTEXT (plugin/enable-disable.messaging.ts)",
    markers: {
      disabled: { markers: false, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "REINSTALL_CONTEXT (plugin/reinstall.messaging.ts)",
    markers: {
      reinstalled: { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      "manual recovery": { markers: false, contentReasons: true },
    },
  },
  {
    name: "UNINSTALL_CONTEXT (plugin/uninstall.messaging.ts)",
    markers: {
      uninstalled: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
    },
  },
  {
    name: "PLUGIN_INFO_CONTEXT (plugin/info.messaging.ts)",
    markers: { skipped: { markers: false, contentReasons: true } },
  },
  {
    name: "IMPORT_CONTEXT (import/execute.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      unavailable: { markers: false, contentReasons: true },
    },
  },
  {
    name: "UPDATE_CONTEXT (marketplace/update.messaging.ts)",
    markers: {
      updated: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "REMOVE_CONTEXT (marketplace/remove.messaging.ts)",
    markers: {
      uninstalled: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "AUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)",
    markers: { failed: { markers: false, contentReasons: true } },
  },
  {
    name: "NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)",
    markers: { failed: { markers: false, contentReasons: true } },
  },
  {
    name: "ADD_CONTEXT (marketplace/add.messaging.ts)",
    markers: { failed: { markers: false, contentReasons: true } },
  },
  {
    name: "MARKETPLACE_LIST_CONTEXT (marketplace/list.messaging.ts)",
    markers: {},
  },
  {
    name: "PENDING_CONTEXT (reconcile/reconcile.messaging.ts)",
    markers: {
      "will install": { markers: false, contentReasons: false },
      "will uninstall": { markers: false, contentReasons: false },
      "will enable": { markers: false, contentReasons: false },
      "will disable": { markers: false, contentReasons: false },
      "will update": { markers: false, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      "partially-upgradable": { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
    },
  },
  {
    name: "RECONCILE_APPLIED_CONTEXT (reconcile/reconcile.messaging.ts)",
    markers: {
      installed: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      uninstalled: { markers: false, contentReasons: false },
      disabled: { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      updated: { markers: true, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      "partially-upgradable": { markers: false, contentReasons: true },
    },
  },
  {
    name: "CENTRAL_ROW_POLICY (legacy notify)",
    markers: {
      installed: { markers: true, contentReasons: true },
      updated: { markers: true, contentReasons: true },
      reinstalled: { markers: true, contentReasons: true },
      "partially-installed": { markers: true, contentReasons: true },
      uninstalled: { markers: false, contentReasons: true },
      disabled: { markers: false, contentReasons: true },
      available: { markers: false, contentReasons: false },
      remote: { markers: false, contentReasons: false },
      unavailable: { markers: false, contentReasons: true },
      "partially-available": { markers: false, contentReasons: true },
      upgradable: { markers: false, contentReasons: true },
      "partially-upgradable": { markers: false, contentReasons: true },
      failed: { markers: false, contentReasons: true },
      skipped: { markers: false, contentReasons: true },
      "manual recovery": { markers: false, contentReasons: true },
      "will install": { markers: false, contentReasons: false },
      "will uninstall": { markers: false, contentReasons: true },
      "will enable": { markers: false, contentReasons: false },
      "will disable": { markers: false, contentReasons: false },
      "will update": { markers: false, contentReasons: true },
    },
  },
] satisfies readonly {
  name: keyof typeof DECLARED_MARKERS;
  markers: Readonly<
    Record<string, { readonly markers: boolean; readonly contentReasons: boolean }>
  >;
}[];

for (const { name, markers } of MARKER_POLICY_TABLE) {
  test(`SC-5 / D-12: ${name} declares the per-verb marker policy`, () => {
    // act
    const declared = DECLARED_MARKERS[name];

    // assert
    assert.deepStrictEqual(declared, markers);
  });
}

test("SC-5: the table states every declared marker policy exactly once", () => {
  // act
  const stated = MARKER_POLICY_TABLE.map((row) => row.name).sort();

  // assert
  assert.deepStrictEqual(stated, Object.keys(DECLARED_MARKERS).sort());
});

/** The pin every command context carries (D-04). */
const CONTEXT_PIN = /\bsatisfies\s+CommandContext</;

/** A top-level const, whose name and export status label the context pin after it. */
const CONTEXT_CONST = /^(export )?const (\w+)/gm;

/**
 * The name of each context pinned in `stripped`, in source order.
 *
 * Each pin takes the last const between it and the previous pin. Unexported
 * declarations carry an `(unexported)` prefix and cannot match a table name.
 * The scan strips block and whole-line comments; trailing line comments must
 * not contain a context pin, because this text scan would count it as code.
 */
function contextNamesIn(stripped: string): string[] {
  return stripped
    .split(CONTEXT_PIN)
    .slice(0, -1)
    .map((before) => {
      const declaration = [...before.matchAll(CONTEXT_CONST)].at(-1);
      const name = declaration?.[2] ?? "";
      return declaration?.[1] === undefined ? `(unexported) ${name}`.trimEnd() : name;
    });
}

/**
 * Every command context declared in the extension tree, labelled as
 * `DECLARED_MARKERS` labels it: the name, then the path below the orchestrators.
 */
async function declaredContexts(): Promise<string[]> {
  const labels: string[] = [];
  for (const rel of await filesMatching(EXTENSION_ROOT_REL, CONTEXT_PIN)) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    const where = path.posix.relative(ORCHESTRATORS_REL, rel);
    labels.push(...contextNamesIn(stripped).map((name) => `${name} (${where})`));
  }

  return labels.sort();
}

test("SC-5: DECLARED_MARKERS names every command context the extension declares", async () => {
  // act
  const discovered = await declaredContexts();

  // assert -- set equality in both directions. A context present on disk and
  // absent here has a marker policy that SC-5 never states; one absent on
  // disk and present here names a context that no longer exists.
  assert.deepStrictEqual(
    discovered,
    Object.keys(DECLARED_MARKERS)
      .filter((name) => name !== CENTRAL_POLICY_NAME)
      .sort(),
  );
});
