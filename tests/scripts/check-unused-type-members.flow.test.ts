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
// These cases drive the composed analysis rather than the flow module alone,
// because a transfer that never reaches the report is not a transfer anyone can
// use. The tracer additionally runs the real command-line tool as a child
// process so the witness is proven to survive into the shipped report.

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

interface GateReport {
  readonly schemaVersion: number;
  readonly status: string;
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
  readonly diagnostics: readonly string[];
}

interface AnalysisModule {
  analyzeProject(options: { readonly root: string; readonly budget?: number }): GateReport;
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
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-flow-"));

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

// Line 15 holds the only property access and line 19 the only call argument.
// The tracer pins both coordinates literally.
const tracerCases = `export interface Produced {
  readonly carried: string;
  readonly leftBehind?: string;
}

export interface Consumed {
  readonly carried: string;
}

export interface Lookalike {
  readonly carried?: string;
}

export function consume(consumed: Consumed): string {
  return consumed.carried;
}

export function produce(produced: Produced): string {
  return consume(produced);
}

export function ignore(lookalike: Lookalike): Lookalike {
  return lookalike;
}
`;

test("an argument credits the source member the resolved parameter actually read", async (t) => {
  // arrange
  const report = await analyze(t, tracerCases);

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Produced", "carried").witnesses, [
    {
      path: casesPath,
      line: 15,
      column: 19,
      kind: "value-read",
      origin: "production",
      syntax: "value-transfer",
      via: { path: casesPath, line: 19, column: 18 },
    },
  ]);
  assert.strictEqual(statusFor(report, "Produced", "carried"), "runtime-observed");
});

test("the read parameter keeps exactly its own direct witness", async (t) => {
  // arrange
  const report = await analyze(t, tracerCases);

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Consumed", "carried").witnesses, [
    {
      path: casesPath,
      line: 15,
      column: 19,
      kind: "value-read",
      origin: "production",
      syntax: "property-access",
    },
  ]);
});

test("a transfer credits no sibling of the member that was read", async (t) => {
  // arrange
  const report = await analyze(t, tracerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Produced", "leftBehind"), []);
  assert.strictEqual(statusFor(report, "Produced", "leftBehind"), "unread");
});

test("a compatible declaration with no call earns nothing", async (t) => {
  // arrange
  const report = await analyze(t, tracerCases);

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Lookalike", "carried"), []);
  assert.strictEqual(statusFor(report, "Lookalike", "carried"), "unread");
});

test("the command-line report carries the transferred witness and only the real offenders", async (t) => {
  // arrange
  const root = await createRoot(t, { [casesPath]: tracerCases });

  // act
  const run = spawnSync(process.execPath, [cliPath, "--root", root, "--json"], {
    encoding: "utf8",
  });
  const report = JSON.parse(run.stdout) as GateReport;

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(
    report.findings.map((finding) => `${finding.owner}.${finding.key}`),
    ["Produced.leftBehind", "Lookalike.carried"],
  );
  assert.deepStrictEqual(memberFor(report, "Produced", "carried").witnesses, [
    {
      path: casesPath,
      line: 15,
      column: 19,
      kind: "value-read",
      origin: "production",
      syntax: "value-transfer",
      via: { path: casesPath, line: 19, column: 18 },
    },
  ]);
});

test("a transfer is directed, so the destination never credits the source side", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Sent {
  readonly token: string;
  readonly spare?: string;
}

export interface Received {
  readonly token: string;
  readonly spare?: string;
}

export function accept(received: Received): void {
  void received;
}

export function send(sent: Sent): void {
  accept(sent);
}

export function readSent(sent: Sent): string {
  return sent.token;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Sent", "token"), [
    "value-read/property-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Received", "token"), []);
  assert.strictEqual(statusFor(report, "Received", "token"), "unread");
  assert.deepStrictEqual(shapesFor(report, "Sent", "spare"), []);
  assert.deepStrictEqual(shapesFor(report, "Received", "spare"), []);
});

test("an intermediate inferred object keeps the origin it was built from", async (t) => {
  // arrange
  const report = await analyze(
    t,
    `export interface Origin {
  readonly kept: string;
  readonly dropped?: string;
}

export interface Reader {
  readonly kept: string;
}

export function read(reader: Reader): string {
  return reader.kept;
}

export function relay(origin: Origin): string {
  const held = { inner: origin };
  return read(held.inner);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(report, "Origin", "kept"), [
    "value-read/value-transfer/production",
  ]);
  assert.deepStrictEqual(shapesFor(report, "Origin", "dropped"), []);
  assert.deepStrictEqual(reasonsFor(report, "Origin", "dropped"), []);
});
