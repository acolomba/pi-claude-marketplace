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
