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
// D-01-22 / D-01-30: +1 state for plugin info's constraint parenthetical --
// one `dependencies:` block carrying a version range alone, a sha alone, and
// both together (190 -> 191).
// WR-06 / DATA-01: +1 state for uninstall's `success-keep-data` row, the
// preserving disposition's `{data kept}` brace (191 -> 192).
// RESV-01..06: +12 states for the dependency cascade -- its success block, the
// six constraint arms, the four closure arms, and a member whose own ledger
// threw. Every one of them is a row the cascade renders and nothing else does
// (192 -> 204).
// RESV-05: +1 state for the cascade skip whose record is DISABLED -- the
// `{already installed, dependency disabled}` brace and the warning it raises
// (204 -> 205).
// D-04-07: +1 state for the promotion of a recorded dependency the user then
// installed by name -- the `installed` row carrying `{already installed,
// dependency promoted}`, the one install outcome that changes a record
// without materializing anything (205 -> 206).
// D-05-07: +1 state for uninstall's fail-closed refusal -- the row that
// carries a declarer's read-failure token when some other record's
// declarations could not be established (206 -> 207).
// PRUNE-01..04 / D-05-01 / D-05-09 / D-05-13: +3 states for `uninstall
// --prune` -- the two-block sweep report with its `{dependency pruned}` rows,
// the same under `--keep-data` with `{dependency pruned, data kept}`, and the
// partial failure where one pruned member's warning row sits beside the
// removals that stood (207 -> 210).
// D-01-32: +1 state for the cold git-source `(remote)` row that carries the
// entry-declared `dependencies:` line after the unresolved marker (210 -> 211).
// RESV-06: +1 state for the load-time counterpart of the dependency-cascade
// `{dependency failed}` row -- reconcile drives one outcome per declared
// plugin, so the requesting plugin's own row carries both the token and the
// failing dependency's cause line (211 -> 212).
// RESV-06: +1 state for import's own dependency-cascade failure -- a
// `DependencyCascadeError` now collapses onto the requesting plugin's row with
// `{dependency failed}` instead of the unrelated `{not in manifest}` token the
// unexpected-failure fallthrough carried before `dispatchFailedOutcome`
// narrowed on it (212 -> 213).
// LOAD-01: +1 state for the load-time dependency disable -- the `(disabled)`
// row carrying `{dependency unsatisfied}` and the remedy naming both the
// dependency and the dependent on its cause line. It is the only `(disabled)`
// row with a cause trailer, and the only realized transition row that renders
// at warning severity (213 -> 214).
// LOAD-01: +2 states for the check's other two arms -- a dependency recorded
// but disabled (same token, enable remedy) and a dependency recorded at a
// version outside the declared range (the second token, update remedy carrying
// the canonical folded range) (214 -> 216).
// LOAD-03 / D-06-06: +1 state for the uninstall that went through while other
// plugins still declared the target -- an `(uninstalled)` row carrying
// `{dependents unsatisfied}` with the dependents on its cause line, the only
// uninstall row with a cause trailer (216 -> 217).
//
// D-06-07 is the one RETIREMENT this narrative records: the two states that
// documented uninstall's dependents refusal -- the standalone row and its
// load-time counterpart -- are gone, because the refusal they documented no
// longer happens. The load-time surface gains no replacement: the
// reconcile-driven removal renders the ordinary bare `(uninstalled)` row that
// `reconcile-applied-cascade` already documents, and the consequence for the
// dependents is reported by `reconcile-dependency-unsatisfied`. The arithmetic
// above is renumbered rather than annotated with the gap.
// TAGS-02 / D-07-03: +1 state for the path-source dependency-cascade fallback
// -- an `installed` row carrying `{dependency current copy}` when no
// marketplace tag satisfied the constraint (217 -> 218).
// EDEP-01 / EDEP-03: +1 state for the enable cascade's own multi-row block --
// a declared dependency re-enabled through its own record, carrying the new
// `{dependency enabled}` token on an `installed` row (218 -> 219).
// EDEP-02: +1 state for the disable refusal -- an installed and ENABLED
// plugin in the same scope still declares the target, so the disable is
// refused with the new `{dependents remain}` token and a plain-English
// cause line naming the dependents and the order (219 -> 220).
//
// EDEP-03 SWAPS one state for another rather than growing the count:
// `dependency-cascade-disabled-skip` (the RESV-05 skip carrying
// `{already installed, dependency disabled}`) leaves, and
// `install-cascade-dependency-enabled` (an `installed` row carrying
// `{already installed, dependency enabled}`) arrives in its place -- the
// install cascade now turns a disabled already-installed dependency back on
// through its own record instead of leaving it inert. One state out, one
// state in, so the count holds at 220; the byte count moves because the
// replacement state's fenced block differs from the one it replaced.
// MISS-01 / D-09-09: +1 state for the reload dependency-install step --
// `reconcile-dependency-installed`, the two-row `{dependency installed}` /
// bare `(installed)` block a materialized missing dependency and its
// satisfied dependent render together (220 -> 221).
// MISS-02 / D-09-10: +1 state for the reload dependency-install failure --
// `reconcile-dependency-install-failed`, the two-row `{dependency failed}` /
// `{dependency unsatisfied}` block the failing dependency and its held
// dependent render together (221 -> 222).
// UPDT-02 / D-10-09: +1 state for the update-preflight constraint gate's
// held row -- disjoint declared ranges hold the plugin's update, and the
// cause line names both declarers in key order, marking the disabled one
// (222 -> 223).
// UPDT-01 / UPDT-02 / D-10-01: +1 state for stage two's post-fetch guard --
// a no-tag repository's fetched version lands outside the combined range,
// held naming only the rejecting dependent (223 -> 224).
// D-10-14 / D-10-15: +1 state for the path-source current-copy fallback that
// landed in range -- an `(updated)` row carrying `{dependency current copy}`
// alone (224 -> 225).
// D-10-13: +1 state for the ceiling disclosure -- an `{up-to-date}` row
// whose cause line names the effective range and its holders (225 -> 226).
// D-10-12: +1 state for the autoupdate cascade's held row -- the same token,
// cause line and `warning` severity the manual cascade renders (226 -> 227).
// #209 removes empty success tallies without changing the state count; the
// catalog is 127 UTF-8 bytes shorter after the merge.
const EXPECTED_STATE_COUNT = 227;
const EXPECTED_UTF8_BYTES = 31_412;

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

test("catalog contract matches all 20 fixture modules to 227 exact documented states", async () => {
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
