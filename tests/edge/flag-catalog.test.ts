// Owner for edge/flag-catalog.ts (MOD-09).
//
// The catalog's per-verb flag DATA is already pinned exactly by
// tests/architecture/flag-catalog-drift.test.ts, which reconciles every verb's
// parse-set and completion labels against the handlers and the completion
// provider. This owner therefore proves the module's DERIVATIONS -- the
// complete-bit filter, the description key carried through, catalog declaration
// order, the fresh parse-set, the scope-target exclusion, and the exported verb
// key list -- and states no claim about which flags a verb carries.
//
// Two cases name SCOPE_TARGET_FLAG in their expectation on purpose: the promise
// there is the identity relation between two exports (the name
// passThroughFlagNames drops is the one SCOPE_TARGET_FLAG holds). Writing the
// literal instead would restate the drift guard's exact per-verb pin.
// parseFlagNames never reads SCOPE_TARGET_FLAG, so the relation is not circular.
//
// No exhaustiveness claim: the module holds no switch and no closed-union
// dispatch, so a missing-arm plant has no target here.

import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_VERBS,
  completionFlagEntries,
  isCatalogVerb,
  parseFlagNames,
  passThroughFlagNames,
  SCOPE_TARGET_FLAG,
} from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";

/**
 * The verbs the catalog indexes, hand-authored so this owner never reads the
 * key set out of the object it is checking. `CATALOG_VERBS` is
 * `Object.keys(CATALOG)` and `isCatalogVerb` is `Object.hasOwn(CATALOG, ...)`,
 * so driving either from the other proves nothing.
 *
 * `tests/architecture/flag-catalog-drift.test.ts` reconciles the same set
 * against its own `Record<CatalogVerb, ...>` pin, but the compiler forces that
 * Record total over the union, so a verb dropped from the catalog AND the union
 * in one change leaves it green. This list is what stays behind to catch that,
 * and it carries the declaration order the Record's sorted comparison does not.
 */
const EXPECTED_CATALOG_VERBS: readonly string[] = [
  "install",
  "update",
  "list",
  "info",
  "uninstall",
  "reinstall",
  "fetch",
  "enable",
  "disable",
  "pending",
  "import",
  "bootstrap",
];

test("completionFlagEntries returns the completable entries in catalog declaration order", () => {
  // arrange
  const expectedEntries = [
    { name: "--installed", description: "Show installed plugins" },
    { name: "--available", description: "Show available plugins" },
    { name: "--unavailable", description: "Show unavailable plugins" },
    { name: "--partial", description: "Show partially available plugins" },
    { name: "--remote", description: "Show remote plugins" },
  ];

  // act
  const completionEntries = completionFlagEntries("list");

  // assert
  assert.deepStrictEqual(completionEntries, expectedEntries);
});

test("completionFlagEntries carries the description of a single-entry verb through to the candidate", () => {
  // arrange
  const expectedEntries = [
    { name: "--fetch", description: "Warm the plugin cache before showing info" },
  ];

  // act
  const completionEntries = completionFlagEntries("info");

  // assert
  assert.deepStrictEqual(completionEntries, expectedEntries);
});

test("completionFlagEntries drops a parse-accepted entry the catalog does not mark completable", () => {
  // arrange
  const expectedEntries: { name: string; description?: string }[] = [];

  // act
  const completionEntries = completionFlagEntries("uninstall");
  const parseNames = parseFlagNames("uninstall");

  // assert
  assert.deepStrictEqual(completionEntries, expectedEntries);
  assert.deepStrictEqual(parseNames, new Set([SCOPE_TARGET_FLAG]));
});

test("a verb that declares no flags yields an empty result from every derivation", () => {
  // arrange
  const verb = "fetch";

  // act
  const completionEntries = completionFlagEntries(verb);
  const parseNames = parseFlagNames(verb);
  const passThroughNames = passThroughFlagNames(verb);

  // assert
  assert.deepStrictEqual(completionEntries, []);
  assert.deepStrictEqual(parseNames, new Set<string>());
  assert.deepStrictEqual(passThroughNames, []);
});

test("parseFlagNames returns a fresh set, so a caller's deletion does not reach a later call", () => {
  // arrange
  const parseNames = parseFlagNames("info");

  // act
  parseNames.delete("--fetch");
  const laterParseNames = parseFlagNames("info");

  // assert
  assert.deepStrictEqual(parseNames, new Set<string>());
  assert.deepStrictEqual(laterParseNames, new Set(["--fetch"]));
});

test("passThroughFlagNames leaves nothing for a verb whose only parse-accepted flag is the scope target", () => {
  // arrange
  const expectedPassThroughNames: string[] = [];

  // act
  const passThroughNames = passThroughFlagNames("uninstall");
  const parseNames = parseFlagNames("uninstall");

  // assert
  assert.deepStrictEqual(passThroughNames, expectedPassThroughNames);
  assert.deepStrictEqual(parseNames, new Set([SCOPE_TARGET_FLAG]));
});

test("passThroughFlagNames keeps the remaining parse-accepted flags in catalog declaration order", () => {
  // arrange
  const expectedPassThroughNames = ["--map-model", "--partial"];

  // act
  const passThroughNames = passThroughFlagNames("install");

  // assert
  assert.deepStrictEqual(passThroughNames, expectedPassThroughNames);
});

for (const verb of EXPECTED_CATALOG_VERBS) {
  test(`isCatalogVerb accepts the catalog key "${verb}"`, () => {
    // arrange
    const expectedRecognition = true;

    // act
    const recognized = isCatalogVerb(verb);

    // assert
    assert.strictEqual(recognized, expectedRecognition);
  });
}

for (const { candidate, situation } of [
  { candidate: "marketplace", situation: "a command word the catalog does not index" },
  { candidate: "toString", situation: "an inherited prototype method name" },
  { candidate: "constructor", situation: "an inherited prototype property name" },
]) {
  test(`isCatalogVerb rejects "${candidate}", ${situation}`, () => {
    // arrange
    const expectedRecognition = false;

    // act
    const recognized = isCatalogVerb(candidate);

    // assert
    assert.strictEqual(recognized, expectedRecognition);
  });
}

test("CATALOG_VERBS lists exactly the catalog's verbs, in declaration order", () => {
  // arrange
  const expectedVerbs = [...EXPECTED_CATALOG_VERBS];

  // act
  const catalogVerbs = [...CATALOG_VERBS];

  // assert
  assert.deepStrictEqual(catalogVerbs, expectedVerbs);
});
