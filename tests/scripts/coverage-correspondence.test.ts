import assert from "node:assert/strict";
import test from "node:test";

import { twinsFixture } from "./coverage-correspondence-fixtures.ts";
import {
  captureFixture,
  capturedConversion,
  createRoot,
  executedText,
  fixtureFiles,
  rawRecords,
} from "./coverage-run-support.ts";

import type { ProducerFixture, SourceSpan } from "./coverage-producer-fixtures.ts";
import type {
  CapturedConversion,
  FailureRow,
  IstanbulBranch,
  IstanbulFileCoverage,
  IstanbulFunction,
  IstanbulLocation,
  V8FunctionCoverage,
} from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// The validator under test inventories every function, statement and branch
// the executed text declares and requires the map to carry exactly those, at
// exactly those spans. The fixture's two callbacks share a name, a hit count
// and a statement ratio, so a map that drops one of them still satisfies
// every count and every name; only exact spans expose the omission (D-03,
// D-04, D-09).

const correspondenceModuleUrl = new URL(
  "../../scripts/coverage-correspondence.mjs",
  import.meta.url,
).href;

interface InventoryFunction {
  readonly decl: IstanbulLocation;
  readonly loc: IstanbulLocation;
  readonly offsets: { readonly start: number; readonly body: number; readonly end: number };
}

interface SyntaxInventory {
  readonly version: number;
  readonly functions: readonly InventoryFunction[];
  readonly statements: ReadonlyArray<{ readonly loc: IstanbulLocation }>;
  readonly branches: ReadonlyArray<{
    readonly type: string;
    readonly loc: IstanbulLocation;
    readonly locations: readonly IstanbulLocation[];
  }>;
}

interface CorrespondenceModule {
  readonly CORRESPONDENCE_SYNTAX_VERSION: number;
  syntaxInventory(executed: string): SyntaxInventory;
  correspondenceFailures(file: IstanbulFileCoverage, executed: string): readonly FailureRow[];
}

async function loadCorrespondence(): Promise<CorrespondenceModule> {
  const loaded: unknown = await import(correspondenceModuleUrl);
  return loaded as CorrespondenceModule;
}

// The pinned representation of an implicit else once serialized: a location
// whose positions carry no coordinates at all.
const absent: IstanbulLocation = { start: {}, end: {} };

function sameSpan(location: IstanbulLocation, span: SourceSpan): boolean {
  return (
    location.start.line === span.start.line &&
    location.start.column === span.start.column &&
    location.end.line === span.end.line &&
    location.end.column === span.end.column
  );
}

// A file record written from the fixture's expectations alone, with the ids
// the producer would assign in source order.
function manualFile(fixture: ProducerFixture, filePath: string): IstanbulFileCoverage {
  const fnMap: Record<string, IstanbulFunction> = {};
  const f: Record<string, number> = {};
  const statementMap: Record<string, IstanbulLocation> = {};
  const s: Record<string, number> = {};
  const branchMap: Record<string, IstanbulBranch> = {};
  const b: Record<string, number[]> = {};

  fixture.functions.forEach((fn, index) => {
    fnMap[index] = { name: fn.name, decl: fn.decl, loc: fn.loc, line: fn.loc.start.line };
    f[index] = fn.hits;
  });
  fixture.statements.forEach((statement, index) => {
    statementMap[index] = statement.loc;
    s[index] = statement.hits;
  });
  fixture.branches.forEach((branch, index) => {
    branchMap[index] = {
      type: branch.type,
      loc: branch.loc,
      locations: [...branch.locations],
      line: branch.loc.start.line,
    };
    b[index] = [...branch.hits];
  });

  return { path: filePath, statementMap, fnMap, branchMap, s, f, b };
}

function idWhere<T>(entries: Readonly<Record<string, T>>, matches: (entry: T) => boolean): string {
  const found = Object.entries(entries).find(([, entry]) => matches(entry));
  assert.ok(found, "the map lacks the record the control removes");
  return found[0];
}

function withoutFunction(file: IstanbulFileCoverage, id: string): IstanbulFileCoverage {
  const { [id]: _fn, ...fnMap } = file.fnMap;
  const { [id]: _hits, ...f } = file.f;
  return { ...file, fnMap, f };
}

function withoutStatement(file: IstanbulFileCoverage, id: string): IstanbulFileCoverage {
  const { [id]: _loc, ...statementMap } = file.statementMap;
  const { [id]: _hits, ...s } = file.s;
  return { ...file, statementMap, s };
}

function withoutBranch(file: IstanbulFileCoverage, id: string): IstanbulFileCoverage {
  const { [id]: _branch, ...branchMap } = file.branchMap;
  const { [id]: _hits, ...b } = file.b;
  return { ...file, branchMap, b };
}

function expectedFunction(
  fixture: ProducerFixture,
  index: number,
): { readonly decl: SourceSpan; readonly loc: SourceSpan } {
  const fn = fixture.functions[index];
  assert.ok(fn);
  return { decl: fn.decl, loc: fn.loc };
}

function convertedTwins(t: TestContext): Promise<CapturedConversion> {
  return capturedConversion(t, twinsFixture());
}

test("accepts the converted map of a captured module whose twin callbacks share a name, a hit count and a statement ratio", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const twins = fixture.functions.filter((fn) => fn.name === "check");
  assert.deepStrictEqual(
    twins.map((fn) => fn.hits),
    [2, 2],
  );

  // act
  const failures = correspondence.correspondenceFailures(file, executed);

  // assert
  assert.deepStrictEqual(failures, []);
});

test("accepts a manually authored exact map", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const manual = manualFile(fixture, file.path);

  // act
  const failures = correspondence.correspondenceFailures(manual, executed);

  // assert
  assert.deepStrictEqual(failures, []);
});

test("inventories every function, statement and branch of the executed text at syntax version 1", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, executed } = await convertedTwins(t);
  const spanKey = (span: SourceSpan): string =>
    `${span.start.line}:${span.start.column}-${span.end.line}:${span.end.column}`;
  const locationKey = (location: IstanbulLocation): string =>
    location.start.line === undefined
      ? "absent"
      : `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
  const expected = {
    version: 1,
    functions: fixture.functions.map((fn) => `${spanKey(fn.decl)}|${spanKey(fn.loc)}`).sort(),
    statements: fixture.statements.map((statement) => spanKey(statement.loc)).sort(),
    branches: fixture.branches
      .map(
        (branch) =>
          `${branch.type}|${spanKey(branch.loc)}|${branch.locations.map(locationKey).join(",")}`,
      )
      .sort(),
  };

  // act
  const inventory = correspondence.syntaxInventory(executed);

  // assert
  assert.strictEqual(correspondence.CORRESPONDENCE_SYNTAX_VERSION, 1);
  assert.deepStrictEqual(
    {
      version: inventory.version,
      functions: inventory.functions
        .map((fn) => `${locationKey(fn.decl)}|${locationKey(fn.loc)}`)
        .sort(),
      statements: inventory.statements.map((statement) => locationKey(statement.loc)).sort(),
      branches: inventory.branches
        .map(
          (branch) =>
            `${branch.type}|${locationKey(branch.loc)}|${branch.locations.map(locationKey).join(",")}`,
        )
        .sort(),
    },
    expected,
  );
});

test("rejects a map missing the first check callback while its twin remains", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const first = expectedFunction(fixture, 1);
  const id = idWhere(file.fnMap, (fn) => sameSpan(fn.decl, first.decl));
  const incomplete = withoutFunction(file, id);
  assert.strictEqual(Object.keys(incomplete.fnMap).length, 3);

  // act
  const failures = correspondence.correspondenceFailures(incomplete, executed);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "function-missing", decl: first.decl, loc: first.loc },
  ]);
});

for (const { name, index } of [
  { name: "the never-taken return of the first callback", index: 3 },
  { name: "the twice-run declarator of the first callback", index: 1 },
]) {
  test(`rejects a map missing ${name}`, async (t) => {
    // arrange
    const correspondence = await loadCorrespondence();
    const { fixture, file, executed } = await convertedTwins(t);
    const statement = fixture.statements[index];
    assert.ok(statement);
    const id = idWhere(file.statementMap, (loc) => sameSpan(loc, statement.loc));
    const incomplete = withoutStatement(file, id);

    // act
    const failures = correspondence.correspondenceFailures(incomplete, executed);

    // assert
    assert.deepStrictEqual(failures, [{ kind: "statement-missing", loc: statement.loc }]);
  });
}

test("rejects a map missing the if branch inside the first callback", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const branch = fixture.branches[1];
  assert.ok(branch);
  const id = idWhere(
    file.branchMap,
    (candidate) => candidate.type === "if" && sameSpan(candidate.loc, branch.loc),
  );
  const incomplete = withoutBranch(file, id);

  // act
  const failures = correspondence.correspondenceFailures(incomplete, executed);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "branch-missing", type: "if", loc: branch.loc, locations: [branch.loc, absent] },
  ]);
});

// The implicit else is admitted only as the absent location of an `if` the
// syntax declares without an alternate. A location the source does not
// declare in that slot is an unproven branch and the declared one is missing,
// however plausible the coordinates look.
for (const { name, alternate } of [
  {
    name: "zero coordinates",
    alternate: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
  },
  {
    name: "the span of the consequent",
    alternate: { start: { line: 4, column: 22 }, end: { line: 6, column: 5 } },
  },
]) {
  test(`rejects an if branch whose absent else is replaced by ${name}`, async (t) => {
    // arrange
    const correspondence = await loadCorrespondence();
    const { fixture, file, executed } = await convertedTwins(t);
    const branch = fixture.branches[1];
    assert.ok(branch);
    const id = idWhere(
      file.branchMap,
      (candidate) => candidate.type === "if" && sameSpan(candidate.loc, branch.loc),
    );
    const record = file.branchMap[id];
    assert.ok(record);
    const filled: IstanbulFileCoverage = {
      ...file,
      branchMap: { ...file.branchMap, [id]: { ...record, locations: [record.loc, alternate] } },
    };

    // act
    const failures = correspondence.correspondenceFailures(filled, executed);

    // assert
    assert.deepStrictEqual(failures, [
      { kind: "branch-missing", type: "if", loc: branch.loc, locations: [branch.loc, absent] },
      {
        kind: "branch-unproven",
        id,
        type: "if",
        loc: branch.loc,
        locations: [branch.loc, alternate],
      },
    ]);
  });
}

const shifted: IstanbulLocation = { start: { line: 2, column: 22 }, end: { line: 2, column: 27 } };

test("rejects records the source does not declare instead of matching a nearby one", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const first = expectedFunction(fixture, 1);
  const extraFunction: IstanbulFunction = {
    name: "check",
    decl: shifted,
    loc: first.loc,
    line: first.loc.start.line,
  };
  const extraBranch: IstanbulBranch = {
    type: "cond-expr",
    loc: shifted,
    locations: [shifted, shifted],
    line: 2,
  };
  const invented: IstanbulFileCoverage = {
    ...file,
    fnMap: { ...file.fnMap, 40: extraFunction },
    f: { ...file.f, 40: 2 },
    statementMap: { ...file.statementMap, 41: shifted },
    s: { ...file.s, 41: 2 },
    branchMap: { ...file.branchMap, 42: extraBranch },
    b: { ...file.b, 42: [1, 1] },
  };

  // act
  const failures = correspondence.correspondenceFailures(invented, executed);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "function-unproven", id: "40", decl: shifted, loc: extraFunction.loc },
    { kind: "statement-unproven", id: "41", loc: shifted },
    {
      kind: "branch-unproven",
      id: "42",
      type: "cond-expr",
      loc: shifted,
      locations: [shifted, shifted],
    },
  ]);
});

test("rejects two records for one declared function", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const { fixture, file, executed } = await convertedTwins(t);
  const first = expectedFunction(fixture, 1);
  const id = idWhere(file.fnMap, (fn) => sameSpan(fn.decl, first.decl));
  const record = file.fnMap[id];
  assert.ok(record);
  const doubled: IstanbulFileCoverage = {
    ...file,
    fnMap: { ...file.fnMap, 40: record },
    f: { ...file.f, 40: 2 },
  };

  // act
  const failures = correspondence.correspondenceFailures(doubled, executed);

  // assert
  assert.deepStrictEqual(failures, [
    { kind: "function-duplicate", ids: [id, "40"], decl: first.decl, loc: first.loc },
  ]);
});

// V8 reports one more function than the source declares: the script itself.
// The inventory names its functions by node offsets so that root can be told
// apart from a declared function without being counted as one.
test("leaves the V8 script root as runtime evidence rather than a declared function", async (t) => {
  // arrange
  const correspondence = await loadCorrespondence();
  const fixture = twinsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const executed = await executedText(captured);
  const records = await rawRecords(captured);
  assert.strictEqual(records.length, 1);
  const declaresFunction = (fn: V8FunctionCoverage, declared: InventoryFunction): boolean => {
    const range = fn.ranges[0];
    return (
      range?.endOffset === declared.offsets.end &&
      range.startOffset >= declared.offsets.start &&
      range.startOffset <= declared.offsets.body
    );
  };

  // act
  const inventory = correspondence.syntaxInventory(executed);
  const roots = records.flatMap((record) =>
    record.functions.filter(
      (fn) => !inventory.functions.some((declared) => declaresFunction(fn, declared)),
    ),
  );

  // assert
  assert.strictEqual(inventory.functions.length, 4);
  assert.deepStrictEqual(roots, [
    {
      functionName: "",
      ranges: [{ startOffset: 0, endOffset: executed.length, count: 1 }],
      isBlockCoverage: true,
    },
  ]);
});
