import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { encode } from "@jridgewell/sourcemap-codec";

import {
  fixturePackageJson,
  nestedLogicalFixture,
  nestedLogicalOmission,
} from "./coverage-producer-fixtures.ts";

import type {
  ExpectedBranch,
  ExpectedFunction,
  ExpectedStatement,
  ProducerFixture,
  SourceSpan,
} from "./coverage-producer-fixtures.ts";
import type { TestContext } from "node:test";

// Every case executes a fixture module for real: the capture CLI runs the
// fixture's unit tests under the native runner and keeps the raw V8 records
// and the executed JavaScript, so the counters the producer must reproduce
// come from V8 and not from a hand-written coverage record. The identity
// source map each case supplies maps every UTF-16 column of the executed text,
// including the end-of-line column, to itself (D-03, D-05, D-09).

const captureCliPath = fileURLToPath(
  new URL("../../scripts/coverage-capture.mjs", import.meta.url),
);
const producerCliPath = fileURLToPath(
  new URL("../../scripts/coverage-producer.mjs", import.meta.url),
);
const producerModuleUrl = new URL("../../scripts/coverage-producer.mjs", import.meta.url).href;

// The researched upstream 1.0.6 producer payload (`dist/index.mjs`) and its
// MIT license, recorded from the registry tarball with integrity
// sha512-fvpl29helSO2w/z7utIbrkNXILdrLwDwAMH2I/zPKlGf5244+gf+B4cyS1sANcrPY2h+hWCGSgC8N61s/+AF9A==.
const upstreamPayloadDigest = "0ce3ec436049c66fff8757450230369156ee2126f52d06b41f99780e497d0a79";
const upstreamLicenseDigest = "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a";

interface ProcessRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface CaptureManifest {
  readonly runId: string;
  readonly status: string;
  readonly modules: ReadonlyArray<{ readonly path: string; readonly executed: string }>;
  readonly workers: ReadonlyArray<{ readonly test: string; readonly raw: readonly string[] }>;
}

interface V8Range {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly count: number;
}

interface V8FunctionCoverage {
  readonly functionName: string;
  readonly ranges: readonly V8Range[];
  readonly isBlockCoverage: boolean;
}

interface V8ScriptCoverage {
  readonly url: string;
  readonly functions: readonly V8FunctionCoverage[];
}

interface V8CoverageFile {
  readonly result: readonly V8ScriptCoverage[];
}

interface IdentitySourceMap {
  readonly version: 3;
  readonly file: string;
  readonly sources: readonly string[];
  readonly sourcesContent: readonly string[];
  readonly names: readonly string[];
  readonly mappings: string;
}

interface IstanbulLocation {
  readonly start: { readonly line?: number; readonly column?: number };
  readonly end: { readonly line?: number; readonly column?: number };
}

interface IstanbulFileCoverage {
  readonly path: string;
  readonly statementMap: Readonly<Record<string, IstanbulLocation>>;
  readonly fnMap: Readonly<
    Record<
      string,
      {
        readonly name: string;
        readonly decl: IstanbulLocation;
        readonly loc: IstanbulLocation;
        readonly line: number;
      }
    >
  >;
  readonly branchMap: Readonly<
    Record<
      string,
      {
        readonly type: string;
        readonly loc: IstanbulLocation;
        readonly locations: readonly IstanbulLocation[];
        readonly line: number;
      }
    >
  >;
  readonly s: Readonly<Record<string, number>>;
  readonly f: Readonly<Record<string, number>>;
  readonly b: Readonly<Record<string, readonly number[]>>;
}

type IstanbulCoverageMap = Readonly<Record<string, IstanbulFileCoverage>>;

interface ProducerIdentity {
  readonly producer: {
    readonly name: string;
    readonly version: string;
    readonly entry: string;
    readonly payloadDigest: string;
    readonly licenseDigest: string | null;
  };
  readonly parser: { readonly name: string; readonly version: string };
  readonly merger: { readonly name: string; readonly version: string };
  readonly codec: { readonly name: string; readonly version: string };
  readonly runtime: { readonly node: string; readonly v8: string };
  readonly adapter: Readonly<Record<string, string>>;
}

interface LoadedProducer {
  readonly identity: ProducerIdentity["producer"];
}

interface ProducerModule {
  loadProducer(entry?: string): Promise<LoadedProducer>;
  producerIdentity(producer: LoadedProducer): ProducerIdentity;
}

// The executed JavaScript of one captured module together with every raw V8
// record the run produced for it, one per worker that loaded it.
interface CapturedScript {
  readonly modulePath: string;
  readonly url: string;
  readonly code: string;
  readonly records: readonly V8ScriptCoverage[];
  readonly rawFiles: readonly string[];
}

interface ProjectedCoverage {
  readonly functions: readonly ExpectedFunction[];
  readonly statements: readonly ExpectedStatement[];
  readonly branches: readonly ExpectedBranch[];
}

async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "coverage-producer-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  for (const [relativePath, text] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  return root;
}

function fixtureFiles(fixture: ProducerFixture): Record<string, string> {
  return {
    "package.json": fixturePackageJson,
    [fixture.sourcePath]: fixture.source,
    ...fixture.tests,
  };
}

function run(args: readonly string[], cwd?: string): ProcessRun {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...env } = process.env;
  const completed = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...env, NODE_V8_COVERAGE: "" },
  });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

// Runs the capture CLI against the fixture root and returns the one module's
// executed text and raw records, read from the run the manifest names.
async function captureFixture(root: string, fixture: ProducerFixture): Promise<CapturedScript> {
  const capture = run([captureCliPath, "--root", root]);
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = JSON.parse(
    await readFile(path.join(root, "coverage", "unit.manifest.json"), "utf8"),
  ) as CaptureManifest;
  assert.strictEqual(manifest.status, "captured");
  const runDirectory = path.join(root, "coverage", "runs", manifest.runId);
  const record = manifest.modules.find((module) => module.path === fixture.sourcePath);
  assert.ok(record, `capture did not load ${fixture.sourcePath}`);
  const modulePath = path.join(root, fixture.sourcePath);
  const url = pathToFileURL(modulePath).href;
  const records: V8ScriptCoverage[] = [];
  const rawFiles: string[] = [];

  for (const worker of manifest.workers) {
    for (const rawFile of worker.raw) {
      const rawPath = path.join(runDirectory, "raw", rawFile);
      const raw = JSON.parse(await readFile(rawPath, "utf8")) as V8CoverageFile;
      const script = raw.result.find((candidate) => candidate.url === url);

      if (script !== undefined) {
        records.push(script);
        rawFiles.push(rawPath);
      }
    }
  }

  return {
    modulePath,
    url,
    code: await readFile(path.join(runDirectory, "executed", record.executed), "utf8"),
    records,
    rawFiles,
  };
}

// An identity map over the executed text: one segment per UTF-16 column of
// every line, plus the column equal to the line length, so every endpoint
// resolves to a finite original position.
function identitySourceMap(modulePath: string, code: string): IdentitySourceMap {
  const lines = code.split("\n");

  return {
    version: 3,
    file: modulePath,
    sources: [modulePath],
    sourcesContent: [code],
    names: [],
    mappings: encode(
      lines.map((line, lineIndex) =>
        Array.from({ length: line.length + 1 }, (_, column) => [column, 0, lineIndex, column]),
      ),
    ),
  };
}

interface ConversionRequestScript {
  readonly url: string;
  readonly code: string;
  readonly sourceMap: string;
  readonly coverage: string;
}

// Writes a CLI request that converts every raw record of the captured module
// and runs the producer CLI on it.
async function convertThroughCli(
  t: TestContext,
  captured: CapturedScript,
  extraArgs: readonly string[] = [],
): Promise<{ run: ProcessRun; outputPath: string }> {
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-producer-request-"));

  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });

  const codePath = path.join(workspace, "executed.js");
  const sourceMapPath = path.join(workspace, "identity.map.json");
  await writeFile(codePath, captured.code);
  await writeFile(
    sourceMapPath,
    JSON.stringify(identitySourceMap(captured.modulePath, captured.code)),
  );
  const scripts: ConversionRequestScript[] = captured.rawFiles.map((rawPath) => ({
    url: captured.url,
    code: "executed.js",
    sourceMap: "identity.map.json",
    coverage: rawPath,
  }));
  const requestPath = path.join(workspace, "request.json");
  await writeFile(requestPath, JSON.stringify({ scripts }));
  const outputPath = path.join(workspace, "out", "istanbul.json");

  return {
    run: run([producerCliPath, "--request", requestPath, "--out", outputPath, ...extraArgs]),
    outputPath,
  };
}

function spanKey(span: SourceSpan): string {
  return `${span.start.line}:${span.start.column}-${span.end.line}:${span.end.column}`;
}

function compareSpans(a: SourceSpan, b: SourceSpan): number {
  return (
    a.start.line - b.start.line ||
    a.start.column - b.start.column ||
    a.end.line - b.end.line ||
    a.end.column - b.end.column
  );
}

function asSpan(location: IstanbulLocation): SourceSpan {
  return {
    start: { line: location.start.line ?? -1, column: location.start.column ?? -1 },
    end: { line: location.end.line ?? -1, column: location.end.column ?? -1 },
  };
}

// The converter output for one file in the corpus's own vocabulary, sorted by
// position so it can be compared whole against a fixture's expectations.
function projectCoverage(file: IstanbulFileCoverage): ProjectedCoverage {
  const functions = Object.entries(file.fnMap)
    .map(([id, fn]) => ({
      name: fn.name,
      decl: asSpan(fn.decl),
      loc: asSpan(fn.loc),
      hits: file.f[id] ?? -1,
    }))
    .sort((a, b) => compareSpans(a.decl, b.decl));
  const statements = Object.entries(file.statementMap)
    .map(([id, loc]) => ({ loc: asSpan(loc), hits: file.s[id] ?? -1 }))
    .sort((a, b) => compareSpans(a.loc, b.loc));
  const branches = Object.entries(file.branchMap)
    .map(([id, branch]) => ({
      type: branch.type,
      loc: asSpan(branch.loc),
      locations: branch.locations.map((location) =>
        location.start.line === undefined
          ? {
              start: { line: undefined, column: undefined },
              end: { line: undefined, column: undefined },
            }
          : asSpan(location),
      ),
      hits: [...(file.b[id] ?? [])],
    }))
    .sort((a, b) => compareSpans(a.loc, b.loc));

  return { functions, statements, branches };
}

function expectedCoverage(fixture: ProducerFixture): ProjectedCoverage {
  return {
    functions: [...fixture.functions].sort((a, b) => compareSpans(a.decl, b.decl)),
    statements: [...fixture.statements].sort((a, b) => compareSpans(a.loc, b.loc)),
    branches: [...fixture.branches].sort((a, b) => compareSpans(a.loc, b.loc)),
  };
}

async function readCoverageMap(outputPath: string): Promise<IstanbulCoverageMap> {
  return JSON.parse(await readFile(outputPath, "utf8")) as IstanbulCoverageMap;
}

test("rejects the unmodified upstream producer: the nested logical callback and its body statements are absent", async (t) => {
  // arrange
  const fixture = nestedLogicalFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expected = expectedCoverage(fixture);
  const omission = nestedLogicalOmission();

  // act
  const conversion = await convertThroughCli(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  const producerModule = (await import(producerModuleUrl)) as unknown as ProducerModule;
  const identity = producerModule.producerIdentity(await producerModule.loadProducer());
  assert.strictEqual(identity.producer.version, "1.0.6");
  assert.strictEqual(identity.producer.payloadDigest, upstreamPayloadDigest);
  assert.strictEqual(identity.producer.licenseDigest, upstreamLicenseDigest);
  const coverage = await readCoverageMap(conversion.outputPath);
  assert.deepStrictEqual(Object.keys(coverage), [captured.modulePath]);
  const file = coverage[captured.modulePath];
  assert.ok(file);
  const actual = projectCoverage(file);
  const actualFunctionKeys = new Set(actual.functions.map((fn) => spanKey(fn.loc)));
  const actualStatementKeys = new Set(actual.statements.map((statement) => spanKey(statement.loc)));
  const missingFunctions = expected.functions
    .filter((fn) => !actualFunctionKeys.has(spanKey(fn.loc)))
    .map((fn) => fn.loc);
  const missingStatements = expected.statements
    .filter((statement) => !actualStatementKeys.has(spanKey(statement.loc)))
    .map((statement) => statement.loc);
  assert.deepStrictEqual(missingFunctions, [...omission.functions]);
  assert.deepStrictEqual(missingStatements, [...omission.statements]);
  const omittedFunctionKeys = new Set(omission.functions.map(spanKey));
  const omittedStatementKeys = new Set(omission.statements.map(spanKey));
  assert.deepStrictEqual(
    actual.functions.map((fn) => ({
      ...fn,
      name: fn.name.replace(/^\(anonymous_\d+\)$/u, "(anonymous)"),
    })),
    expected.functions
      .filter((fn) => !omittedFunctionKeys.has(spanKey(fn.loc)))
      .map((fn) => ({ ...fn, name: fn.name.replace(/^\(anonymous_\d+\)$/u, "(anonymous)") })),
  );
  assert.deepStrictEqual(
    actual.statements,
    expected.statements.filter((statement) => !omittedStatementKeys.has(spanKey(statement.loc))),
  );
  assert.deepStrictEqual(actual.branches, expected.branches);
});

test("fails explicitly when the raw file holds no record for the requested url", async (t) => {
  // arrange
  const fixture = nestedLogicalFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const foreign: CapturedScript = { ...captured, url: `${captured.url}.missing` };

  // act
  const conversion = await convertThroughCli(t, foreign);

  // assert
  assert.strictEqual(conversion.run.status, 1);
  assert.match(conversion.run.stderr, /Expected exactly one record for .*\.missing/u);
  await assert.rejects(readFile(conversion.outputPath));
});

test("refuses a request without --out and writes nothing", async (t) => {
  // arrange
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-producer-usage-"));
  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });
  const requestPath = path.join(workspace, "request.json");
  await writeFile(requestPath, JSON.stringify({ scripts: [] }));

  // act
  const usage = run([producerCliPath, "--request", requestPath]);

  // assert
  assert.strictEqual(usage.status, 2);
  assert.match(usage.stderr, /--out <json>/u);
});

test("is inert on import", () => {
  // arrange
  const specifier = JSON.stringify(producerModuleUrl);

  // act
  const imported = run([
    "--input-type=module",
    "-e",
    `const loaded = await import(${specifier}); process.stdout.write(typeof loaded.convertScripts);`,
  ]);

  // assert
  assert.deepStrictEqual(
    { status: imported.status, stdout: imported.stdout },
    { status: 0, stdout: "function" },
  );
});
