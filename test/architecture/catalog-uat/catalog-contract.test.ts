import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { notify } from "../../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import { loadCatalogExamples, type CatalogExample } from "./catalog-parser.ts";
import { FIXTURE_MAPS, mergeFixtureMaps, tupleKey } from "./fixture-maps.ts";
import { PLUGIN_FETCH_FIXTURES } from "./fixtures/plugin-fetch.ts";
import { makeCtx, verifyPi, type CapturedNotification } from "./mock-pi.ts";

import type { CatalogFixture, FixtureMap } from "./fixture-types.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");
const EXPECTED_MODULE_COUNT = 21;
const EXPECTED_SECTION_COUNT = 21;
const EXPECTED_STATE_COUNT = 308;
const EXPECTED_UTF8_BYTES = 50_296;

const FIXTURE_SECTION_ORDER = [
  "/claude:plugin list",
  "/claude:plugin install <plugin>@<marketplace>",
  "/claude:plugin uninstall <plugin>@<marketplace>",
  "/claude:plugin prune",
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
  const run = openNotificationRun(fixture.pi, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  if (fixture.emit !== undefined) {
    fixture.emit(boundary.ctx, run);
  } else {
    const message =
      example.section === "/claude:plugin list" && "marketplaces" in fixture.message
        ? { ...fixture.message, label: "Plugin list", cardinality: "plural" as const }
        : fixture.message;
    notify(boundary.ctx, run, message);
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
  // arrange
  const fixture = fixtureAt(PLUGIN_FETCH_FIXTURES, "/claude:plugin fetch", "single-available");
  const one: FixtureMap = { section: { state: fixture } };

  // act & assert
  assert.throws(
    () => mergeFixtureMaps([one, one]),
    new Error("Duplicate catalog fixture tuple: section::state"),
  );
  assert.throws(
    () => mergeFixtureMaps([{ section: {} }]),
    new Error("Catalog fixture section must not be empty: section"),
  );
});

test("catalog contract rejects missing and extra fixture tuples", () => {
  // arrange
  const fixture = fixtureAt(PLUGIN_FETCH_FIXTURES, "/claude:plugin fetch", "single-available");
  const fixtures: FixtureMap = { section: { extra: fixture } };
  const examples: readonly CatalogExample[] = [
    { section: "section", state: "missing", expected: "independent bytes" },
  ];

  // act & assert
  assert.deepStrictEqual(completenessFailures(examples, fixtures), [
    { section: "section", state: "missing", kind: "missing-fixture" },
    { section: "section", state: "extra", kind: "extra-fixture" },
  ]);
});

test("catalog contract rejects equal-key ordering drift", () => {
  // act & assert
  assert.throws(() => {
    assertSameTupleOrder(
      ["section::second", "section::first"],
      ["section::first", "section::second"],
    );
  }, /Catalog tuple ordering drifted despite equal keys/u);
});

test("catalog contract matches all 21 fixture modules to 308 exact documented states", async () => {
  // arrange
  const fixtures = mergeFixtureMaps(FIXTURE_MAPS);
  const examples = loadCatalogExamples(await readFile(CATALOG_PATH, "utf8"));
  const exampleBytes = examples.reduce(
    (bytes, example) => bytes + Buffer.byteLength(example.expected, "utf8"),
    0,
  );

  // act
  const completeness = completenessFailures(examples, fixtures);
  const renderFailures: ContractFailure[] = [];
  for (const example of examples) {
    renderFailures.push(...renderFailure(example, fixtures));
  }

  // assert
  assert.equal(FIXTURE_MAPS.length, EXPECTED_MODULE_COUNT);
  assert.equal(Object.keys(fixtures).length, EXPECTED_SECTION_COUNT);
  assert.equal(countFixtureStates(fixtures), EXPECTED_STATE_COUNT);
  assert.equal(examples.length, EXPECTED_STATE_COUNT);
  assert.equal(exampleBytes, EXPECTED_UTF8_BYTES);
  assert.deepStrictEqual(completeness, []);
  assertSameTupleOrder(fixtureTupleKeys(fixtures).sort(), catalogTupleKeys(examples).sort());
  assert.equal(renderFailures.length, 0, renderFailures.map(formatFailure).join("\n\n"));
});
