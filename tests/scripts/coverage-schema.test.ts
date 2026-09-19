import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { twinsFixture } from "./coverage-correspondence-fixtures.ts";
import { capturedConversion, fallowHealth, writeMap } from "./coverage-run-support.ts";

import type {
  CapturedConversion,
  FailureRow,
  IstanbulBranch,
  IstanbulCoverageMap,
  IstanbulFileCoverage,
  IstanbulLocation,
} from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// The schema under test admits exactly the Istanbul shape the pinned producer
// writes: the seven file keys, matching map and counter key sets, finite
// nonnegative integer hits, one counter per branch location, concrete
// positions inside the source, canonical contained paths, and one absent
// location only where an `if` has no `else`. The installed Fallow consumes
// every malformed variant below without complaint, which is why the schema,
// not the consumer's parser, is the gate (D-03, D-09).

const schemaModuleUrl = new URL("../../scripts/coverage-schema.mjs", import.meta.url).href;

interface SchemaModule {
  readonly COVERAGE_SCHEMA_VERSION: number;
  fileFailures(file: unknown, text: string): readonly FailureRow[];
  mapFiles(
    coverage: unknown,
    root: string,
  ): { readonly files: ReadonlyMap<string, string>; readonly failures: readonly FailureRow[] };
}

async function loadSchema(): Promise<SchemaModule> {
  const loaded: unknown = await import(schemaModuleUrl);
  return loaded as SchemaModule;
}

// The pinned representation of an implicit else once serialized, and the
// producer's in-memory form of the same absent location.
const absent: IstanbulLocation = { start: {}, end: {} };
const absentInMemory: IstanbulLocation = {
  start: { line: undefined, column: undefined },
  end: { line: undefined, column: undefined },
};

function convertedTwins(t: TestContext): Promise<CapturedConversion> {
  return capturedConversion(t, twinsFixture());
}

// The id of the `if` branch inside the first callback: the one whose
// statement starts on line 4.
function firstIfId(file: IstanbulFileCoverage): string {
  const found = Object.entries(file.branchMap).find(
    ([, branch]) => branch.type === "if" && branch.loc.start.line === 4,
  );
  assert.ok(found, "the map lacks the first if branch");
  return found[0];
}

function functionRecord(
  file: IstanbulFileCoverage,
  id: string,
): IstanbulFileCoverage["fnMap"][string] {
  const record = file.fnMap[id];
  assert.ok(record);
  return record;
}

function statementRecord(file: IstanbulFileCoverage, id: string): IstanbulLocation {
  const location = file.statementMap[id];
  assert.ok(location);
  return location;
}

function withBranch(
  file: IstanbulFileCoverage,
  id: string,
  branch: Partial<IstanbulBranch>,
): IstanbulFileCoverage {
  const record = file.branchMap[id];
  assert.ok(record);
  return { ...file, branchMap: { ...file.branchMap, [id]: { ...record, ...branch } } };
}

test("accepts the converted map of a captured module on readback and its in-memory absent form", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { file, original } = await convertedTwins(t);
  const id = firstIfId(file);
  const record = file.branchMap[id];
  assert.ok(record);
  const inMemory = withBranch(file, id, { locations: [record.loc, absentInMemory] });

  // act
  const readback = schema.fileFailures(file, original);
  const producerForm = schema.fileFailures(inMemory, original);

  // assert
  assert.strictEqual(schema.COVERAGE_SCHEMA_VERSION, 1);
  assert.deepStrictEqual({ readback, producerForm }, { readback: [], producerForm: [] });
});

test("keeps the implicit else as a location without coordinates that the installed Fallow consumes", async (t) => {
  // arrange
  const { fixture, root, map, file } = await convertedTwins(t);
  const mapPath = await writeMap(root, map);
  const ifBranches = Object.values(file.branchMap).filter((branch) => branch.type === "if");

  // act
  const health = fallowHealth(root, mapPath);

  // assert
  assert.deepStrictEqual(
    ifBranches.map((branch) => branch.locations[1]),
    [absent, absent],
  );
  assert.deepStrictEqual(health, {
    status: 0,
    matched: 4,
    functions: [
      {
        path: fixture.sourcePath,
        name: "anyLarge",
        line: 1,
        coveragePct: 80,
        coverageSource: "istanbul",
      },
      {
        path: fixture.sourcePath,
        name: "check",
        line: 2,
        coveragePct: 75,
        coverageSource: "istanbul",
      },
      {
        path: fixture.sourcePath,
        name: "allSmall",
        line: 12,
        coveragePct: 80,
        coverageSource: "istanbul",
      },
      {
        path: fixture.sourcePath,
        name: "check",
        line: 13,
        coveragePct: 75,
        coverageSource: "istanbul",
      },
    ],
  });
});

// Fallow clamps a negative position and scores the map as if it were sound;
// the schema refuses the position before Fallow sees it.
test("refuses a negative column that the installed Fallow consumes as a matched map", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { root, captured, file, original } = await convertedTwins(t);
  const location = statementRecord(file, "1");
  const negative: IstanbulLocation = { ...location, start: { ...location.start, column: -1 } };
  const malformed: IstanbulFileCoverage = {
    ...file,
    statementMap: { ...file.statementMap, 1: negative },
  };
  const mapPath = await writeMap(root, { [captured.modulePath]: malformed });

  // act
  const failures = schema.fileFailures(malformed, original);
  const health = fallowHealth(root, mapPath);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "position", part: "statementMap[1]", location: negative },
  ]);
  assert.strictEqual(health.matched, 4);
});

const zeroed: IstanbulLocation = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };

for (const { name, locations, expected } of [
  {
    name: "zero coordinates in place of the absent else",
    locations: (loc: IstanbulLocation): IstanbulLocation[] => [loc, zeroed],
    expected: (id: string, _loc: IstanbulLocation): FailureRow[] => [
      { kind: "position", part: `branchMap[${id}].locations[1]`, location: zeroed },
    ],
  },
  {
    name: "an absent location where the if statement belongs",
    locations: (loc: IstanbulLocation): IstanbulLocation[] => [absent, loc],
    expected: (id: string, _loc: IstanbulLocation): FailureRow[] => [
      { kind: "absent-location", part: `branchMap[${id}].locations[0]`, type: "if" },
    ],
  },
  {
    name: "a location whose start alone is absent",
    locations: (loc: IstanbulLocation): IstanbulLocation[] => [loc, { start: {}, end: loc.end }],
    expected: (id: string, loc: IstanbulLocation): FailureRow[] => [
      {
        kind: "position",
        part: `branchMap[${id}].locations[1]`,
        location: { start: {}, end: loc.end },
      },
    ],
  },
]) {
  test(`refuses an if branch carrying ${name}`, async (t) => {
    // arrange
    const schema = await loadSchema();
    const { file, original } = await convertedTwins(t);
    const id = firstIfId(file);
    const record = file.branchMap[id];
    assert.ok(record);
    const malformed = withBranch(file, id, { locations: locations(record.loc) });

    // act
    const failures = schema.fileFailures(malformed, original);

    // assert
    assert.deepStrictEqual(failures, expected(id, record.loc));
  });
}

test("refuses an absent location in a branch that is not an if", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { file, original } = await convertedTwins(t);
  const found = Object.entries(file.branchMap).find(([, branch]) => branch.type === "binary-expr");
  assert.ok(found);
  const [id, record] = found;
  const first = record.locations[0];
  assert.ok(first);
  const malformed = withBranch(file, id, { locations: [first, absent] });

  // act
  const failures = schema.fileFailures(malformed, original);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "absent-location", part: `branchMap[${id}].locations[1]`, type: "binary-expr" },
  ]);
});

test("refuses counters whose keys differ from their map", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { file, original } = await convertedTwins(t);
  const { 3: _dropped, ...s } = file.s;
  const malformed: IstanbulFileCoverage = { ...file, s, f: { ...file.f, 9: 0 } };

  // act
  const failures = schema.fileFailures(malformed, original);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "counter-keys", map: "statementMap", counter: "s", missing: ["3"], extra: [] },
    { kind: "counter-keys", map: "fnMap", counter: "f", missing: [], extra: ["9"] },
  ]);
});

interface CounterPatch {
  readonly s?: Readonly<Record<string, unknown>>;
  readonly f?: Readonly<Record<string, unknown>>;
  readonly b?: Readonly<Record<string, unknown>>;
}

for (const { name, counters, part, value } of [
  { name: "a negative statement hit", counters: { s: { 1: -1 } }, part: "s[1]", value: -1 },
  { name: "a fractional statement hit", counters: { s: { 2: 1.5 } }, part: "s[2]", value: 1.5 },
  { name: "a null function hit", counters: { f: { 0: null } }, part: "f[0]", value: null },
  { name: "a string branch hit", counters: { b: { 0: [1, "0"] } }, part: "b[0][1]", value: "0" },
] satisfies ReadonlyArray<{
  readonly name: string;
  readonly counters: CounterPatch;
  readonly part: string;
  readonly value: unknown;
}>) {
  test(`refuses ${name}`, async (t) => {
    // arrange
    const schema = await loadSchema();
    const { file, original } = await convertedTwins(t);
    const malformed: unknown = {
      ...file,
      s: { ...file.s, ...(counters.s ?? {}) },
      f: { ...file.f, ...(counters.f ?? {}) },
      b: { ...file.b, ...(counters.b ?? {}) },
    };

    // act
    const failures = schema.fileFailures(malformed, original);

    // assert
    assert.deepStrictEqual(failures, [{ kind: "hit", part, value }]);
  });
}

for (const { name, b, locations, expected } of [
  {
    name: "one counter for the two locations of an if",
    b: [0],
    locations: (loc: IstanbulLocation): IstanbulLocation[] => [loc, absent],
    expected: { locations: 2, counters: 1 },
  },
  {
    name: "three locations on an if",
    b: [0, 2, 0],
    locations: (loc: IstanbulLocation): IstanbulLocation[] => [loc, absent, loc],
    expected: { locations: 3, counters: 3 },
  },
]) {
  test(`refuses ${name}`, async (t) => {
    // arrange
    const schema = await loadSchema();
    const { file, original } = await convertedTwins(t);
    const id = firstIfId(file);
    const record = file.branchMap[id];
    assert.ok(record);
    const shaped = withBranch(file, id, { locations: locations(record.loc) });
    const malformed: IstanbulFileCoverage = { ...shaped, b: { ...shaped.b, [id]: b } };

    // act
    const failures = schema.fileFailures(malformed, original);

    // assert
    assert.deepStrictEqual(failures, [{ kind: "branch-cardinality", id, type: "if", ...expected }]);
  });
}

test("refuses a branch type the pinned producer does not emit", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { file, original } = await convertedTwins(t);
  const id = firstIfId(file);
  const malformed = withBranch(file, id, { type: "ternary" });

  // act
  const failures = schema.fileFailures(malformed, original);

  // assert
  assert.deepStrictEqual(failures, [{ kind: "branch-type", id, type: "ternary" }]);
});

for (const { name, reshape, expected } of [
  {
    name: "a file record with an unknown key",
    reshape: (file: IstanbulFileCoverage): unknown => ({ ...file, all: true }),
    expected: { kind: "schema-key", part: "file", missing: [], unknown: ["all"] },
  },
  {
    name: "a file record without branch counters",
    reshape: (file: IstanbulFileCoverage): unknown => {
      const { b: _b, ...rest } = file;
      return rest;
    },
    expected: { kind: "schema-key", part: "file", missing: ["b"], unknown: [] },
  },
  {
    name: "a function record with an unknown key",
    reshape: (file: IstanbulFileCoverage): unknown => ({
      ...file,
      fnMap: { ...file.fnMap, 0: { ...functionRecord(file, "0"), skip: true } },
    }),
    expected: { kind: "schema-key", part: "fnMap[0]", missing: [], unknown: ["skip"] },
  },
  {
    name: "a statement location with a line field",
    reshape: (file: IstanbulFileCoverage): unknown => ({
      ...file,
      statementMap: { ...file.statementMap, 0: { ...statementRecord(file, "0"), line: 2 } },
    }),
    expected: { kind: "schema-key", part: "statementMap[0]", missing: [], unknown: ["line"] },
  },
  {
    name: "a position with a key that is not line or column",
    reshape: (file: IstanbulFileCoverage): unknown => {
      const location = statementRecord(file, "0");
      return {
        ...file,
        statementMap: {
          ...file.statementMap,
          0: { ...location, end: { ...location.end, offset: 40 } },
        },
      };
    },
    expected: { kind: "schema-key", part: "statementMap[0].end", missing: [], unknown: ["offset"] },
  },
  {
    name: "a function record whose line is not an integer",
    reshape: (file: IstanbulFileCoverage): unknown => ({
      ...file,
      fnMap: { ...file.fnMap, 0: { ...functionRecord(file, "0"), line: "1" } },
    }),
    expected: { kind: "schema-type", part: "fnMap[0].line", expected: "integer" },
  },
  {
    name: "a statement map that is an array",
    reshape: (file: IstanbulFileCoverage): unknown => ({ ...file, statementMap: [] }),
    expected: { kind: "schema-type", part: "statementMap", expected: "object" },
  },
]) {
  test(`refuses ${name}`, async (t) => {
    // arrange
    const schema = await loadSchema();
    const { file, original } = await convertedTwins(t);

    // act
    const failures = schema.fileFailures(reshape(file), original);

    // assert
    assert.deepStrictEqual(failures, [expected]);
  });
}

test("keys every canonical contained file of a map by its repository path", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { fixture, root, captured, map } = await convertedTwins(t);

  // act
  const keyed = schema.mapFiles(map, root);

  // assert
  assert.deepStrictEqual(
    { files: [...keyed.files], failures: keyed.failures },
    { files: [[fixture.sourcePath, captured.modulePath]], failures: [] },
  );
});

test("refuses a map whose key names another file than its record", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { root, captured, file } = await convertedTwins(t);
  const other = path.join(root, "extensions/pi-claude-marketplace/domain/other.ts");
  const mismatched: IstanbulCoverageMap = { [other]: file };

  // act
  const keyed = schema.mapFiles(mismatched, root);

  // assert
  assert.deepStrictEqual(keyed.failures, [
    { kind: "path-mismatch", key: other, path: captured.modulePath },
  ]);
});

test("refuses a file outside the root and a relative key", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { root, file } = await convertedTwins(t);
  const outside = path.join(path.dirname(root), "elsewhere", "twins.ts");
  const relative = "extensions/pi-claude-marketplace/domain/twins.ts";
  const foreign: IstanbulCoverageMap = {
    [outside]: { ...file, path: outside },
    [relative]: { ...file, path: relative },
  };

  // act
  const keyed = schema.mapFiles(foreign, root);

  // assert
  assert.deepStrictEqual(
    { files: [...keyed.files], failures: keyed.failures },
    {
      files: [],
      failures: [
        { kind: "foreign-path", path: outside },
        { kind: "path-not-canonical", path: relative },
      ],
    },
  );
});

test("refuses two keys that resolve to one file", async (t) => {
  // arrange
  const schema = await loadSchema();
  const { fixture, root, captured, file, map } = await convertedTwins(t);
  const detour = `${root}/extensions/../${fixture.sourcePath}`;
  const doubled: IstanbulCoverageMap = { ...map, [detour]: { ...file, path: detour } };

  // act
  const keyed = schema.mapFiles(doubled, root);

  // assert
  assert.deepStrictEqual(
    { files: [...keyed.files], failures: keyed.failures },
    {
      files: [[fixture.sourcePath, captured.modulePath]],
      failures: [
        { kind: "path-not-canonical", path: detour },
        { kind: "duplicate-file", path: fixture.sourcePath, keys: [captured.modulePath, detour] },
      ],
    },
  );
});

for (const { name, coverage, expected } of [
  { name: "a map that is an array", coverage: [], expected: [{ kind: "malformed-map" }] },
  { name: "a map that is null", coverage: null, expected: [{ kind: "malformed-map" }] },
  {
    name: "a file record that is a string",
    coverage: { "/root/a.ts": "coverage" },
    expected: [{ kind: "malformed-file", path: "/root/a.ts" }],
  },
  {
    name: "a file record without a path",
    coverage: { "/root/a.ts": { statementMap: {} } },
    expected: [{ kind: "malformed-file", path: "/root/a.ts" }],
  },
]) {
  test(`refuses ${name}`, async () => {
    // arrange
    const schema = await loadSchema();

    // act
    const keyed = schema.mapFiles(coverage, "/root");

    // assert
    assert.deepStrictEqual(
      { files: [...keyed.files], failures: keyed.failures },
      {
        files: [],
        failures: expected,
      },
    );
  });
}
