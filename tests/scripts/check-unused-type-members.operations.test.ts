import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The analyzer is a `.mjs` module, so it is loaded through a runtime specifier
// and read through the explicit interface below. That interface is the
// test-facing contract: the compiler cannot check a `.mjs` import, so the shape
// these cases rely on is written out here instead of being assumed.
//
// These cases drive the composed analysis rather than the operations module
// alone. A whole-object operation that never reaches the report is not an
// observation anyone can use, and the tracer additionally runs the real
// command-line tool so the witness is proven to survive into the shipped
// report.

const analysisModuleUrl = new URL(
  "../../scripts/check-unused-type-members.analysis.mjs",
  import.meta.url,
).href;

const cliPath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.mjs", import.meta.url),
);

interface WitnessSite {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

interface Witness extends WitnessSite {
  readonly kind: string;
  readonly origin: string;
  readonly syntax: string;
  readonly via?: WitnessSite;
}

interface MemberRecord {
  readonly id: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly owner: string;
  readonly key: string;
  readonly optional: boolean;
  readonly category: string;
  readonly status: string;
  readonly witnesses: readonly Witness[];
  readonly reasons: readonly string[];
}

interface GateWork {
  readonly transferSteps: number;
  readonly transferEdges: number;
  readonly transferReads: number;
  readonly operationReads: number;
  readonly transferMs: number;
}

interface GateReport {
  readonly schemaVersion: number;
  readonly status: string;
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
  readonly diagnostics: readonly string[];
  readonly work: GateWork;
}

interface AnalysisModule {
  analyzeProject(options: {
    readonly root: string;
    readonly budget?: number;
    readonly flowBudget?: number;
  }): GateReport;
}

const analysis = (await import(analysisModuleUrl)) as unknown as AnalysisModule;

const fixtureTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      allowImportingTsExtensions: true,
      strict: true,
      target: "ES2022",
      types: [],
    },
    include: ["extensions/**/*.ts", "tests/**/*.ts"],
  },
  undefined,
  2,
)}\n`;

const casesPath = "extensions/pi-claude-marketplace/cases.ts";
const specPath = "tests/cases.test.ts";

/**
 * The fixtures compile with `types: []`, so `node:assert/strict` is declared
 * here rather than resolved from the installed Node types. That keeps the cases
 * hermetic, and it is also the point: a deep comparison is settled through the
 * ambient module its declaration sits in, so a declaration written here is
 * recognised exactly as the installed one is, and a local function carrying the
 * same name is not.
 */
const assertDeclaration = `declare module "node:assert/strict" {
  interface Assert {
    deepStrictEqual(actual: unknown, expected: unknown): void;
    strictEqual(actual: unknown, expected: unknown): void;
  }
  const assert: Assert;
  export default assert;
}
`;
async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-operations-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  for (const [relativePath, text] of Object.entries({
    "tsconfig.json": fixtureTsconfig,
    ...files,
  })) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  return root;
}

/** Analyses one production source file, which is what most of these cases need. */
async function analyze(t: TestContext, production: string): Promise<GateReport> {
  const root = await createRoot(t, { [casesPath]: production });
  return analysis.analyzeProject({ root });
}

/** Analyses one production file alongside one test file that observes it. */
async function analyzeWithSpec(
  t: TestContext,
  production: string,
  spec: string,
): Promise<GateReport> {
  const root = await createRoot(t, {
    [casesPath]: production,
    [specPath]: spec,
    "tests/node-assert.d.ts": assertDeclaration,
  });
  return analysis.analyzeProject({ root });
}

function memberFor(report: GateReport, owner: string, key: string): MemberRecord {
  const member = report.members.find((entry) => entry.owner === owner && entry.key === key);

  if (member === undefined) {
    throw new Error(`No candidate was inventoried for ${owner}.${key}`);
  }

  return member;
}

function statusFor(report: GateReport, owner: string, key: string): string {
  return memberFor(report, owner, key).status;
}

/** The classification of every observation of one member, in the order they were found. */
function shapesFor(report: GateReport, owner: string, key: string): readonly string[] {
  return memberFor(report, owner, key).witnesses.map(
    (witness) => `${witness.kind}/${witness.syntax}/${witness.origin}`,
  );
}

function reasonsFor(report: GateReport, owner: string, key: string): readonly string[] {
  return memberFor(report, owner, key).reasons;
}

function findingNames(report: GateReport): readonly string[] {
  return report.findings.map((finding) => `${finding.owner}.${finding.key}`);
}

// ---------------------------------------------------------------------------
// Serialization: a produced record traced through a wrapper into JSON.stringify.
// ---------------------------------------------------------------------------

/**
 * `serializeWithTruncation` is the summarised wrapper: its declared parameter is
 * `unknown`, so the only way `Produced` survives is for the summary to be
 * applied at the call site against the argument actually written there.
 *
 * The three neighbouring functions are the counterexamples. `stringify` carries
 * the name of the built-in and none of its behaviour, `identity` hands its input
 * straight back without consuming it, and `discard` ignores it entirely.
 */
const serializerCases = `export interface Nested {
  readonly inner: string;
  readonly alsoInner: string;
}

export interface Produced {
  readonly carried: string;
  readonly nested: Nested;
}

export interface Shadowed {
  readonly value: string;
}

export interface Forwarded {
  readonly value: string;
}

export interface Dropped {
  readonly value: string;
}

export function serializeWithTruncation(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 80 ? text.slice(0, 80) : text;
}

export function stringify(value: unknown): string {
  void value;
  return "";
}

export function identity(value: unknown): unknown {
  return value;
}

export function discard(value: unknown): string {
  void value;
  return "constant";
}

export function write(produced: Produced): string {
  return serializeWithTruncation(produced);
}

export function callLocalStringify(shadowed: Shadowed): string {
  return stringify(shadowed);
}

export function forward(forwarded: Forwarded): unknown {
  return identity(forwarded);
}

export function drop(dropped: Dropped): string {
  return discard(dropped);
}
`;

test("a record serialized through an unknown-typed wrapper is observed at its own declaration", async (t) => {
  // arrange
  const report = await analyze(t, serializerCases);

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Produced", "carried").witnesses, [
    {
      path: casesPath,
      line: 43,
      column: 34,
      kind: "value-read",
      origin: "production",
      syntax: "json-serialization",
    },
  ]);
  assert.strictEqual(statusFor(report, "Produced", "carried"), "runtime-observed");
});

test("serialization reaches the nested record it carries", async (t) => {
  // arrange
  const report = await analyze(t, serializerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Nested", "inner"), [
    "value-read/json-serialization/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Nested", "alsoInner"), [
    "value-read/json-serialization/production",
  ]);
});

test("a local function carrying the built-in name is not a serializer", async (t) => {
  // arrange
  const report = await analyze(t, serializerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Shadowed", "value"), []);
  assert.strictEqual(statusFor(report, "Shadowed", "value"), "unread");
});

test("a wrapper that returns its input unchanged consumes nothing", async (t) => {
  // arrange
  const report = await analyze(t, serializerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Forwarded", "value"), []);
  assert.strictEqual(statusFor(report, "Forwarded", "value"), "unread");
});

test("a wrapper that ignores its input consumes nothing", async (t) => {
  // arrange
  const report = await analyze(t, serializerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Dropped", "value"), []);
  assert.strictEqual(statusFor(report, "Dropped", "value"), "unread");
});

test("changing the summarised body into a non-reader invalidates the witness", async (t) => {
  // arrange
  const changed = serializerCases.replace(
    `export function serializeWithTruncation(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 80 ? text.slice(0, 80) : text;
}`,
    `export function serializeWithTruncation(value: unknown): string {
  void value;
  return "constant";
}`,
  );

  // act
  const report = await analyze(t, changed);

  // assert
  assert.notStrictEqual(changed, serializerCases);
  assert.deepStrictEqual(shapesFor(report, "Produced", "carried"), []);
  assert.strictEqual(statusFor(report, "Produced", "carried"), "unread");
  assert.strictEqual(statusFor(report, "Nested", "inner"), "unread");
});

test("the command-line report carries the serialization witness and only the real offenders", async (t) => {
  // arrange
  const root = await createRoot(t, { [casesPath]: serializerCases });

  // act
  const run = spawnSync(process.execPath, [cliPath, "--root", root, "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(run.stdout) as GateReport;

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(findingNames(report), [
    "Shadowed.value",
    "Forwarded.value",
    "Dropped.value",
  ]);
  assert.deepStrictEqual(memberFor(report, "Produced", "carried").witnesses, [
    {
      path: casesPath,
      line: 43,
      column: 34,
      kind: "value-read",
      origin: "production",
      syntax: "json-serialization",
    },
  ]);
  assert.ok(report.work.operationReads > 0);
});

test("a serializer wrapper keeps the origin of a record built by its caller", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Origin {
  readonly kept: string;
}

export interface Relayed {
  readonly kept: string;
}

export function serialize(value: unknown): string {
  return JSON.stringify(value);
}

export function relay(relayed: Relayed): string {
  return serialize(relayed);
}

export function start(origin: Origin): string {
  return relay(origin);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Relayed", "kept"), [
    "value-read/json-serialization/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Origin", "kept"), [
    "value-read/json-serialization/production",
    "value-read/value-transfer/production",
  ]);
  assert.strictEqual(statusFor(report, "Origin", "kept"), "runtime-observed");
});

test("a replacer function leaves the serialized keys unresolved rather than credited", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Filtered {
  readonly kept: string;
  readonly hidden: string;
}

export function write(filtered: Filtered): string {
  return JSON.stringify(filtered, (key: string, value: unknown) => (key === "" ? value : value));
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Filtered", "kept"), []);
  assert.deepStrictEqual(reasonsFor(report, "Filtered", "kept"), ["unmodeled-serializer-options"]);
  assert.strictEqual(statusFor(report, "Filtered", "kept"), "unsupported-analysis");
});

test("a literal replacer array serializes exactly the keys it names", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Selected {
  readonly kept: string;
  readonly hidden: string;
}

export function write(selected: Selected): string {
  return JSON.stringify(selected, ["kept"]);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Selected", "kept"), [
    "value-read/json-serialization/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Selected", "hidden"), []);
  assert.strictEqual(statusFor(report, "Selected", "hidden"), "unread");
});

test("a toJSON member means the declared members are not what is serialized", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Custom {
  readonly kept: string;
  toJSON(): string;
}

export function write(custom: Custom): string {
  return JSON.stringify(custom);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Custom", "kept"), []);
  assert.deepStrictEqual(reasonsFor(report, "Custom", "kept"), ["unmodeled-serializer-options"]);
});

test("a method member is not serialized, because a function value is omitted", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface WithMethod {
  readonly kept: string;
  render(): string;
}

export function write(withMethod: WithMethod): string {
  return JSON.stringify(withMethod);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "WithMethod", "kept"), [
    "value-read/json-serialization/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "WithMethod", "render"), []);
  assert.strictEqual(statusFor(report, "WithMethod", "render"), "unread");
});

// ---------------------------------------------------------------------------
// Copies: what a spread, a rest binding and the Object enumerators really read.
// ---------------------------------------------------------------------------

test("a spread reads the source's own values and stops there", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Nested {
  readonly deep: string;
}

export interface Copied {
  readonly shallow: string;
  readonly nested: Nested;
}

export function copy(copied: Copied): Copied {
  return { ...copied };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Copied", "shallow"), [
    "value-read/object-copy/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Copied", "nested"), [
    "value-read/object-copy/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Nested", "deep"), []);
  assert.strictEqual(statusFor(report, "Nested", "deep"), "unread");
});

test("a property written after a spread does not undo the spread's own read", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Overwritten {
  readonly replaced: string;
  readonly kept: string;
}

export function copy(overwritten: Overwritten): Overwritten {
  return { ...overwritten, replaced: "written" };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Overwritten", "replaced"), [
    "value-read/object-copy/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Overwritten", "kept"), [
    "value-read/object-copy/production",
  ]);
});

test("a copy whose result is never used still read its source", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Discarded {
  readonly value: string;
}

export function copyAndDrop(discarded: Discarded): void {
  const copy = { ...discarded };
  void copy;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Discarded", "value"), [
    "value-read/object-copy/production",
  ]);
  assert.strictEqual(statusFor(report, "Discarded", "value"), "runtime-observed");
});

test("a rest binding copies every key the pattern did not name", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Divided {
  readonly picked: string;
  readonly carried: string;
  readonly alsoCarried: string;
}

export function divide(divided: Divided): void {
  const { picked, ...remainder } = divided;
  void picked;
  void remainder;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Divided", "picked"), [
    "value-read/binding-destructuring/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Divided", "carried"), [
    "value-read/object-copy/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Divided", "alsoCarried"), [
    "value-read/object-copy/production",
  ]);
});

test("Object.values and Object.entries read the values they enumerate", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Valued {
  readonly one: string;
  readonly two: string;
}

export interface Paired {
  readonly three: string;
}

export function values(valued: Valued): unknown[] {
  return Object.values(valued);
}

export function pairs(paired: Paired): unknown[] {
  return Object.entries(paired);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Valued", "one"), [
    "value-read/object-enumeration/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Valued", "two"), [
    "value-read/object-enumeration/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Paired", "three"), [
    "value-read/object-enumeration/production",
  ]);
});

test("Object.keys enumerates names and reads no value at all", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Named {
  readonly one: string;
}

export function names(named: Named): string[] {
  return Object.keys(named);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Named", "one"), []);
  assert.strictEqual(statusFor(report, "Named", "one"), "unread");
});

test("Object.assign reads its sources and not the target it writes into", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Written {
  filled: string;
}

export interface Supplied {
  readonly filled: string;
}

export function merge(written: Written, supplied: Supplied): Written {
  return Object.assign(written, supplied);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Supplied", "filled"), [
    "value-read/object-copy/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Written", "filled"), []);
  assert.strictEqual(statusFor(report, "Written", "filled"), "unread");
});

test("an accessor member leaves own-property eligibility unproven", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Computed {
  readonly plain: string;
  get derived(): string;
}

export function copy(computed: Computed): Computed {
  return { ...computed };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Computed", "plain"), []);
  assert.deepStrictEqual(reasonsFor(report, "Computed", "plain"), ["unproven-own-properties"]);
  assert.strictEqual(statusFor(report, "Computed", "plain"), "unsupported-analysis");
});

test("a class instance in the operand leaves own-property eligibility unproven", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Declared {
  readonly value: string;
}

export class Implementation {
  readonly value = "written";
}

export function copy(source: Declared | Implementation): Declared {
  return { ...source };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Declared", "value"), []);
  assert.deepStrictEqual(reasonsFor(report, "Declared", "value"), ["unproven-own-properties"]);
});

// ---------------------------------------------------------------------------
// Containers: the array members whose semantics move member provenance.
// ---------------------------------------------------------------------------

test("a pushed record is credited when the array it landed in is read", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Pushed {
  readonly carried: string;
  readonly spare?: string;
}

export interface Held {
  readonly carried: string;
}

export function show(held: Held): string {
  return held.carried;
}

export function collect(pushed: Pushed): string {
  const rows: Held[] = [];
  rows.push(pushed);
  return show(rows[0]);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Pushed", "carried"), [
    "value-read/value-transfer/production",
  ]);
  assert.deepStrictEqual(reasonsFor(report, "Pushed", "carried"), []);
  assert.deepStrictEqual(shapesFor(report, "Pushed", "spare"), []);
});

test("a comparator receives an element at both of its parameters", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Ordered {
  readonly first: string;
  readonly second: string;
}

export interface Row {
  readonly first: string;
  readonly second: string;
}

export function order(rows: Row[]): Row[] {
  return rows.sort((left, right) => (left.first < right.second ? -1 : 1));
}

export function start(ordered: Ordered[]): Row[] {
  return order(ordered);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Ordered", "first"), [
    "value-read/value-transfer/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Ordered", "second"), [
    "value-read/value-transfer/production",
  ]);
});

test("entries pairs an index with the element, and only the element carries members", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Walked {
  readonly value: string;
}

export interface Shown {
  readonly value: string;
}

export function show(shown: Shown): string {
  return shown.value;
}

export function walk(rows: Walked[]): void {
  for (const pair of rows.entries()) {
    show(pair[1]);
  }
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Walked", "value"), [
    "value-read/value-transfer/production",
  ]);
  assert.deepStrictEqual(reasonsFor(report, "Walked", "value"), []);
});

test("reverse hands back the same elements it was given", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Reversed {
  readonly value: string;
}

export interface Seen {
  readonly value: string;
}

export function show(seen: Seen): string {
  return seen.value;
}

export function lastOf(rows: Reversed[]): string {
  const ordered = rows.reverse();
  return show(ordered[0]);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Reversed", "value"), [
    "value-read/value-transfer/production",
  ]);
  assert.deepStrictEqual(reasonsFor(report, "Reversed", "value"), []);
});

test("an array member with no modeled semantics is still an open question", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Folded {
  readonly value: string;
}

export function fold(rows: Folded[], join: (total: string, row: Folded) => string): string {
  return rows.reduce(join, "");
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Folded", "value"), []);
  assert.deepStrictEqual(reasonsFor(report, "Folded", "value"), ["unmodeled-container-operation"]);
  assert.strictEqual(statusFor(report, "Folded", "value"), "unsupported-analysis");
});

// ---------------------------------------------------------------------------
// Deep comparisons: what a test's assertion proves about production output.
// ---------------------------------------------------------------------------

const comparedCases = `export interface Metadata {
  readonly note: string;
}

export interface Outcome {
  readonly kind: string;
  readonly metadata: Metadata;
}

export interface Expected {
  readonly kind: string;
}

export interface Compared {
  readonly value: string;
}

export function produce(kind: string): Outcome {
  return { kind, metadata: { note: kind } };
}

export function compared(): Compared {
  return { value: "written" };
}
`;

const comparedSpec = `import assert from "node:assert/strict";

import { compared, produce } from "../extensions/pi-claude-marketplace/cases.ts";

import type { Expected } from "../extensions/pi-claude-marketplace/cases.ts";

const expected: Expected = { kind: "installed" };

assert.deepStrictEqual(produce("installed"), expected);
assert.strictEqual(compared(), compared());
`;

test("a deep comparison of a production result observes it as a test-only read", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, comparedCases, comparedSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "kind"), ["value-read/deep-comparison/test"]);
  assert.deepStrictEqual(shapesFor(report, "Outcome", "metadata"), [
    "value-read/deep-comparison/test",
  ]);
  assert.strictEqual(statusFor(report, "Outcome", "kind"), "test-only-observed");
});

test("a deep comparison descends into the nested record the result carries", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, comparedCases, comparedSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Metadata", "note"), [
    "value-read/deep-comparison/test",
  ]);
  assert.strictEqual(statusFor(report, "Metadata", "note"), "test-only-observed");
});

test("a typed expected literal written in a test proves no production consumption", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, comparedCases, comparedSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Expected", "kind"), []);
  assert.strictEqual(statusFor(report, "Expected", "kind"), "unread");
});

test("an identity comparison reads no member of either side", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, comparedCases, comparedSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Compared", "value"), []);
  assert.strictEqual(statusFor(report, "Compared", "value"), "unread");
});

test("a local function carrying the deep-comparison name is not one", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    `export interface Shadowed {
  readonly value: string;
}

export function produce(): Shadowed {
  return { value: "written" };
}
`,
    `import { produce } from "../extensions/pi-claude-marketplace/cases.ts";

function deepStrictEqual(actual: unknown, expected: unknown): void {
  void actual;
  void expected;
}

deepStrictEqual(produce(), { value: "written" });
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Shadowed", "value"), []);
  assert.strictEqual(statusFor(report, "Shadowed", "value"), "unread");
});

test("a test helper wrapping the real deep comparison keeps its summary", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    `export interface Wrapped {
  readonly value: string;
}

export function produce(): Wrapped {
  return { value: "written" };
}
`,
    `import assert from "node:assert/strict";

import { produce } from "../extensions/pi-claude-marketplace/cases.ts";

function assertMatches(actual: unknown, expected: unknown): void {
  assert.deepStrictEqual(actual, expected);
}

assertMatches(produce(), { value: "written" });
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Wrapped", "value"), [
    "value-read/deep-comparison/test",
  ]);
  assert.strictEqual(statusFor(report, "Wrapped", "value"), "test-only-observed");
});

test("a symbol-keyed member is not serialized alongside the spelled ones", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export const BRAND: unique symbol = Symbol("brand");

export interface Branded {
  readonly [BRAND]: string;
  readonly plain: string;
}

export function write(branded: Branded): string {
  return JSON.stringify(branded);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Branded", "plain"), [
    "value-read/json-serialization/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Branded", "BRAND"), []);
  assert.strictEqual(statusFor(report, "Branded", "BRAND"), "unread");
});

// ---------------------------------------------------------------------------
// A whole-object comparison over a union, attributed by the discriminant value.
// ---------------------------------------------------------------------------

/**
 * Reduced from `orchestrators/marketplace/remove.ts`, whose outcome union
 * declares `name` on two of its three arms, and from
 * `persistence/migrate-config.ts`, whose three non-migrating arms are told apart
 * by the very key that is ambiguous across them.
 *
 * A key exactly one arm spells resolves there. A key two or more arms spell is
 * left unsettled, which is what keeps a member a finding rather than excusing it
 * by its neighbour -- and it is also why a comparison that names the arm has
 * nothing to say today. `name` and `at` are spelled by the `removed` and
 * `partial` arms, `note` by `failed` and `partial`, and `cascade` carries the
 * same unit value on two arms so it settles nothing on its own.
 */
const unionOutcomeCases = `export type Outcome =
  | {
      readonly status: "removed";
      readonly cascade: "yes";
      readonly name: string;
      readonly at: string;
      readonly unstaged: readonly string[];
    }
  | {
      readonly status: "failed";
      readonly note: string;
      readonly reason: string;
    }
  | {
      readonly status: "partial";
      readonly cascade: "yes";
      readonly name: string;
      readonly at: string;
      readonly note: string;
    };

export function remove(ok: boolean): Outcome {
  return ok
    ? { status: "removed", cascade: "yes", name: "shared", at: "user", unstaged: [] }
    : { status: "failed", note: "absent here", reason: "absent" };
}
`;

function comparisonSpec(expected: string): string {
  return `import assert from "node:assert/strict";

import { remove } from "../extensions/pi-claude-marketplace/cases.ts";

const outcome = remove(true);
assert.deepStrictEqual(outcome, ${expected});
`;
}

test("a discriminant value in the expected literal settles which arm supplied a key", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    unionOutcomeCases,
    comparisonSpec(`{ status: "removed", name: "shared", unstaged: [] }`),
  );

  // act & assert
  // The operand's type is walked once per arm, so a key two arms spell is read
  // twice and settled twice on the same arm -- the same shape `status` already
  // carries three of here.
  assert.deepStrictEqual(shapesFor(report, "Outcome", "name"), [
    "value-read/deep-comparison/test",
    "value-read/deep-comparison/test",
  ]);
  assert.strictEqual(statusFor(report, "Outcome", "name"), "test-only-observed");
  // The arm was settled, not the union: the same key on the arm the value did
  // not come from is still a finding.
  assert.deepStrictEqual(
    findingNames(report).filter((name) => name === "Outcome.name"),
    ["Outcome.name"],
  );
});

test("a sibling of the settled arm the comparison does not spell gains nothing", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    unionOutcomeCases,
    comparisonSpec(`{ status: "removed", name: "shared", unstaged: [] }`),
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "at"), []);
  assert.strictEqual(statusFor(report, "Outcome", "at"), "unread");
});

test("a key the settled arm does not declare gains nothing", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    unionOutcomeCases,
    comparisonSpec(`{ status: "removed", name: "shared", unstaged: [] }`),
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "note"), []);
  assert.strictEqual(statusFor(report, "Outcome", "note"), "unread");
});

test("an expected literal carrying no discriminant settles nothing", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, unionOutcomeCases, comparisonSpec(`{ name: "shared" }`));

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "name"), []);
  assert.strictEqual(statusFor(report, "Outcome", "name"), "unread");
});

test("a discriminant value two arms carry settles nothing", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    unionOutcomeCases,
    comparisonSpec(`{ cascade: "yes", name: "shared" }`),
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "name"), []);
  assert.strictEqual(statusFor(report, "Outcome", "name"), "unread");
});

test("a comparison of two test-built values settles nothing, however it is typed", async (t) => {
  // arrange
  const report = await analyzeWithSpec(
    t,
    unionOutcomeCases,
    `import assert from "node:assert/strict";

import type { Outcome } from "../extensions/pi-claude-marketplace/cases.ts";

const made: Outcome = {
  status: "removed",
  cascade: "yes",
  name: "made",
  at: "user",
  unstaged: [],
};
assert.deepStrictEqual(made, { status: "removed", name: "made", unstaged: [] });
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Outcome", "name"), []);
  assert.strictEqual(statusFor(report, "Outcome", "name"), "unread");
});

// ---------------------------------------------------------------------------
// Production lineage carried through a factory-returned closure.
// ---------------------------------------------------------------------------

/**
 * Reduced from `bridges/hooks/stage.ts`, whose write helper is the closure
 * `createWriteHookConfig` returns and whose removal helper beside it is a
 * directly declared exported function. Both results are deep-compared the same
 * way in the same suite, and only the directly declared one is credited: the
 * backward search that settles production lineage stops at a call whose callee
 * is a const holding what a factory handed back.
 *
 * Each result carries its own type so one comparison cannot answer for another.
 * `Held` is the neighbouring shape -- a production factory whose return is a
 * name rather than a function written there.
 */
const factoryClosureCases = `export interface Written {
  readonly written: true;
  readonly path: string;
}

export interface Removed {
  readonly removed: true;
  readonly path: string;
}

export interface Held {
  readonly held: true;
  readonly path: string;
}

export interface Local {
  readonly local: true;
  readonly path: string;
}

export interface Cycled {
  readonly cycled: true;
  readonly path: string;
}

export interface Inspector {
  readonly probe: (at: string) => string;
}

export function createWrite(inspector: Inspector): (at: string) => Written {
  return function writeAt(at: string): Written {
    return { written: true, path: inspector.probe(at) };
  };
}

export function removeAt(at: string): Removed {
  return { removed: true, path: at };
}

const heldWriter = (at: string): Held => ({ held: true, path: at });

export function createHeld(): (at: string) => Held {
  return heldWriter;
}

export const write = createWrite({ probe: (at) => at });

export const held = createHeld();
`;

const factoryClosureSpec = `import assert from "node:assert/strict";

import { held, removeAt, write } from "../extensions/pi-claude-marketplace/cases.ts";

import type { Cycled, Local } from "../extensions/pi-claude-marketplace/cases.ts";

assert.deepStrictEqual(write("p"), { written: true, path: "p" });
assert.deepStrictEqual(removeAt("p"), { removed: true, path: "p" });
assert.deepStrictEqual(held("p"), { held: true, path: "p" });

function createLocalWriter(): (at: string) => Local {
  return function localWriter(at: string): Local {
    return { local: true, path: at };
  };
}

const local = createLocalWriter();
assert.deepStrictEqual(local("p"), { local: true, path: "p" });

function loopA(at: string): Cycled {
  return loopB(at);
}

function loopB(at: string): Cycled {
  return loopA(at);
}

assert.deepStrictEqual(loopA("p"), { cycled: true, path: "p" });
`;

test("a result a factory-returned closure produced carries production lineage", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, factoryClosureCases, factoryClosureSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Written", "written"), [
    "value-read/deep-comparison/test",
  ]);
  assert.strictEqual(statusFor(report, "Written", "written"), "test-only-observed");
});

test("the directly declared sibling keeps exactly the observation it had", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, factoryClosureCases, factoryClosureSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Removed", "removed"), [
    "value-read/deep-comparison/test",
  ]);
});

test("a factory whose return is a name rather than a body adds no lineage", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, factoryClosureCases, factoryClosureSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Held", "held"), []);
  assert.strictEqual(statusFor(report, "Held", "held"), "unread");
});

test("a closure a test's own factory returned reaches no production body", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, factoryClosureCases, factoryClosureSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Local", "local"), []);
  assert.strictEqual(statusFor(report, "Local", "local"), "unread");
});

test("a cycle in the backward search terminates and credits nothing", async (t) => {
  // arrange
  const report = await analyzeWithSpec(t, factoryClosureCases, factoryClosureSpec);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Cycled", "cycled"), []);
  assert.strictEqual(statusFor(report, "Cycled", "cycled"), "unread");
});
