import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { notify } from "../../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

import { loadCatalogExamples, type CatalogExample } from "./catalog-parser.ts";
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
import { makeCtx, verifyPi, type CapturedNotification } from "./mock-pi.ts";

import type { CatalogFixture, FixtureMap } from "./fixture-types.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");
const EXPECTED_MODULE_COUNT = 20;
const EXPECTED_SECTION_COUNT = 20;
const EXPECTED_STATE_COUNT = 190;
const EXPECTED_UTF8_BYTES = 23_732;

const FIXTURE_MAPS: readonly FixtureMap[] = [
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

const FIXTURE_SECTION_ORDER = [
  "/claude:plugin list",
  "/claude:plugin install <plugin>@<marketplace>",
  "/claude:plugin uninstall <plugin>@<marketplace>",
  "/claude:plugin reinstall",
  "/claude:plugin update",
  "/claude:plugin fetch",
  "/claude:plugin import",
  "/claude:plugin bootstrap",
  "/claude:plugin marketplace list",
  "/claude:plugin marketplace add <source>",
  "/claude:plugin marketplace info <name>",
  "/claude:plugin info <plugin>@<marketplace>",
  "/claude:plugin pending",
  "reconcile-applied-cascade",
  "/claude:plugin marketplace remove <name>",
  "/claude:plugin marketplace update [<name>]",
  "/claude:plugin enable <plugin>@<marketplace>",
  "/claude:plugin disable <plugin>@<marketplace>",
  "/claude:plugin marketplace autoupdate|noautoupdate [<name>]",
  "manual-recovery-anchors",
] as const;

const AUTOUPDATE_STATE_ORDER = [
  "enable-fresh",
  "disable-fresh",
  "enable-idempotent",
  "disable-idempotent",
  "all-empty",
  "all-one",
  "all-many",
  "autoupdate-missing-not-added",
  "autoupdate-missing-not-added-bare",
] as const;

interface ContractFailure {
  readonly section: string;
  readonly state: string;
  readonly kind: "missing-fixture" | "extra-fixture" | "byte-mismatch" | "severity-mismatch";
  readonly expected?: string;
  readonly actual?: string;
}

function tupleKey(section: string, state: string): string {
  return `${section}::${state}`;
}

function mergeFixtureMaps(fixtureMaps: readonly FixtureMap[]): FixtureMap {
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

function catalogTupleKeys(examples: readonly CatalogExample[]): string[] {
  return examples.map(({ section, state }) => tupleKey(section, state));
}

function fixtureTupleKeys(fixtures: FixtureMap): string[] {
  const keys: string[] = [];
  for (const section of FIXTURE_SECTION_ORDER) {
    const states = fixtures[section];
    if (states === undefined) {
      continue;
    }

    const stateOrder =
      section === "/claude:plugin marketplace autoupdate|noautoupdate [<name>]"
        ? AUTOUPDATE_STATE_ORDER
        : Object.keys(states);
    for (const state of stateOrder) {
      if (states[state] !== undefined) {
        keys.push(tupleKey(section, state));
      }
    }
  }

  return keys;
}

function completenessFailures(
  examples: readonly CatalogExample[],
  fixtures: FixtureMap,
): ContractFailure[] {
  const failures: ContractFailure[] = [];
  const catalogKeys = new Set(catalogTupleKeys(examples));
  const fixtureKeys = new Set<string>();

  for (const example of examples) {
    if (fixtures[example.section]?.[example.state] === undefined) {
      failures.push({ section: example.section, state: example.state, kind: "missing-fixture" });
    }
  }

  for (const [section, states] of Object.entries(fixtures)) {
    for (const state of Object.keys(states)) {
      const key = tupleKey(section, state);
      fixtureKeys.add(key);
      if (!catalogKeys.has(key)) {
        failures.push({ section, state, kind: "extra-fixture" });
      }
    }
  }

  assert.equal(fixtureKeys.size, countFixtureStates(fixtures));
  return failures;
}

function countFixtureStates(fixtures: FixtureMap): number {
  let count = 0;
  for (const states of Object.values(fixtures)) {
    count += Object.keys(states).length;
  }

  return count;
}

function assertSameTupleOrder(actual: readonly string[], expected: readonly string[]): void {
  assert.deepStrictEqual(actual, expected, "Catalog tuple ordering drifted despite equal keys");
}

function checkSeverity(
  example: CatalogExample,
  fixture: CatalogFixture,
  notification: CapturedNotification,
): ContractFailure | undefined {
  if (fixture.expectedSeverity !== undefined) {
    if (notification.argumentCount === 2 && notification.severity === fixture.expectedSeverity) {
      return undefined;
    }

    return {
      section: example.section,
      state: example.state,
      kind: "severity-mismatch",
      expected: fixture.expectedSeverity,
      actual: notification.severity ?? "(info / no second argument)",
    };
  }

  if (notification.argumentCount === 1) {
    return undefined;
  }

  return {
    section: example.section,
    state: example.state,
    kind: "severity-mismatch",
    expected: "(info / no second argument)",
    actual: notification.severity ?? "explicit undefined",
  };
}

function renderFailure(example: CatalogExample, fixtures: FixtureMap): ContractFailure[] {
  const fixture = fixtures[example.section]?.[example.state];
  if (fixture === undefined) {
    return [{ section: example.section, state: example.state, kind: "missing-fixture" }];
  }

  const boundary = makeCtx();
  if (fixture.emit !== undefined) {
    fixture.emit(boundary.ctx, fixture.pi);
  } else {
    const message =
      example.section === "/claude:plugin list" && "marketplaces" in fixture.message
        ? { ...fixture.message, label: "Plugin list", cardinality: "plural" as const }
        : fixture.message;
    notify(boundary.ctx, fixture.pi, message);
  }

  boundary.verifyContext();
  verifyPi(fixture.pi);
  const notification = boundary.notifications[0];
  assert.ok(notification, "The strict catalog boundary must capture one notification");

  const failures: ContractFailure[] = [];
  if (notification.message !== example.expected) {
    failures.push({
      section: example.section,
      state: example.state,
      kind: "byte-mismatch",
      expected: example.expected,
      actual: notification.message,
    });
  }

  const severityFailure = checkSeverity(example, fixture, notification);
  if (severityFailure !== undefined) {
    failures.push(severityFailure);
  }

  return failures;
}

function formatFailure(failure: ContractFailure): string {
  return [
    `${failure.kind}: ${tupleKey(failure.section, failure.state)}`,
    `expected: ${failure.expected ?? ""}`,
    `actual: ${failure.actual ?? ""}`,
  ].join("\n");
}

function fixtureAt(fixtures: FixtureMap, section: string, state: string): CatalogFixture {
  const fixture = fixtures[section]?.[state];
  if (fixture === undefined) {
    throw new Error(`Test fixture is absent: ${tupleKey(section, state)}`);
  }

  return fixture;
}

test("catalog contract rejects duplicate fixture tuples and empty sections", () => {
  const fixture = fixtureAt(PLUGIN_FETCH_FIXTURES, "/claude:plugin fetch", "single-available");
  const one: FixtureMap = { section: { state: fixture } };

  assert.throws(
    () => mergeFixtureMaps([one, one]),
    /Duplicate catalog fixture tuple: section::state/u,
  );
  assert.throws(
    () => mergeFixtureMaps([{ section: {} }]),
    /Catalog fixture section must not be empty: section/u,
  );
});

test("catalog contract rejects missing and extra fixture tuples", () => {
  const fixture = fixtureAt(PLUGIN_FETCH_FIXTURES, "/claude:plugin fetch", "single-available");
  const fixtures: FixtureMap = { section: { extra: fixture } };
  const examples: readonly CatalogExample[] = [
    { section: "section", state: "missing", expected: "independent bytes" },
  ];

  assert.deepStrictEqual(completenessFailures(examples, fixtures), [
    { section: "section", state: "missing", kind: "missing-fixture" },
    { section: "section", state: "extra", kind: "extra-fixture" },
  ]);
});

test("catalog contract rejects equal-key ordering drift", () => {
  assert.throws(() => {
    assertSameTupleOrder(
      ["section::second", "section::first"],
      ["section::first", "section::second"],
    );
  }, /Catalog tuple ordering drifted despite equal keys/u);
});

test("catalog contract matches all 20 fixture modules to 190 exact documented states", async () => {
  assert.equal(FIXTURE_MAPS.length, EXPECTED_MODULE_COUNT);
  const fixtures = mergeFixtureMaps(FIXTURE_MAPS);
  assert.equal(Object.keys(fixtures).length, EXPECTED_SECTION_COUNT);
  assert.equal(countFixtureStates(fixtures), EXPECTED_STATE_COUNT);

  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);
  assert.equal(examples.length, EXPECTED_STATE_COUNT);
  assert.equal(
    examples.reduce((bytes, example) => bytes + Buffer.byteLength(example.expected, "utf8"), 0),
    EXPECTED_UTF8_BYTES,
  );

  const completeness = completenessFailures(examples, fixtures);
  assert.deepStrictEqual(completeness, []);
  assertSameTupleOrder(fixtureTupleKeys(fixtures).sort(), catalogTupleKeys(examples).sort());

  const renderFailures: ContractFailure[] = [];
  for (const example of examples) {
    renderFailures.push(...renderFailure(example, fixtures));
  }

  assert.equal(renderFailures.length, 0, renderFailures.map(formatFailure).join("\n\n"));
});
