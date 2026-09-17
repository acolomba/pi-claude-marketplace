import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { decode } from "@jridgewell/sourcemap-codec";

import { fixturePackageJson } from "./coverage-producer-fixtures.ts";
import { endpointsFixture } from "./coverage-source-map-fixtures.ts";

import type {
  ExpectedBranch,
  ExpectedFunction,
  ExpectedStatement,
  ProducerFixture,
  SourceSpan,
} from "./coverage-producer-fixtures.ts";
import type { TestContext } from "node:test";

// Every conversion here starts from a real capture: the capture CLI runs the
// fixture's unit tests under the native runner and stores the immutable
// source bytes, the executed JavaScript and the raw V8 records under one run.
// The producer CLI then maps the run's own records, so the coordinates it
// reports are proven against the recorded bytes and never against a map the
// test built (D-03, D-04, D-09).

const captureCliPath = fileURLToPath(
  new URL("../../scripts/coverage-capture.mjs", import.meta.url),
);
const producerCliPath = fileURLToPath(
  new URL("../../scripts/coverage-producer.mjs", import.meta.url),
);
const sourceMapModuleUrl = new URL("../../scripts/coverage-source-map.mjs", import.meta.url).href;

interface ProcessRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface CaptureManifest {
  readonly runId: string;
  readonly status: string;
  readonly modules: ReadonlyArray<{
    readonly path: string;
    readonly source: string;
    readonly executed: string;
  }>;
  readonly workers: ReadonlyArray<{ readonly raw: readonly string[] }>;
}

interface V8CoverageFile {
  readonly result: ReadonlyArray<{ readonly url: string }>;
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
      { readonly name: string; readonly decl: IstanbulLocation; readonly loc: IstanbulLocation }
    >
  >;
  readonly branchMap: Readonly<
    Record<
      string,
      {
        readonly type: string;
        readonly loc: IstanbulLocation;
        readonly locations: readonly IstanbulLocation[];
      }
    >
  >;
  readonly s: Readonly<Record<string, number>>;
  readonly f: Readonly<Record<string, number>>;
  readonly b: Readonly<Record<string, readonly number[]>>;
}

type IstanbulCoverageMap = Readonly<Record<string, IstanbulFileCoverage>>;

interface ExecutedModule {
  readonly path: string;
  readonly url: string;
  readonly original: string;
  readonly executed: string;
}

interface IdentitySourceMap {
  readonly version: 3;
  readonly file: string;
  readonly sources: readonly string[];
  readonly sourcesContent: readonly string[];
  readonly names: readonly string[];
  readonly mappings: string;
}

interface SourceMapModule {
  executedSourceMap(module: ExecutedModule): IdentitySourceMap;
}

interface SourceMapFailure {
  readonly kind: string;
  readonly [field: string]: unknown;
}

// The run a fixture capture produced: where its manifest and stores live, the
// module the fixture names, and every raw V8 file holding that module's url.
interface CapturedRun {
  readonly root: string;
  readonly manifestPath: string;
  readonly directory: string;
  readonly modulePath: string;
  readonly url: string;
  readonly record: { readonly path: string; readonly source: string; readonly executed: string };
  readonly rawPaths: readonly string[];
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
  const root = await mkdtemp(path.join(tmpdir(), "coverage-source-map-"));

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

function run(args: readonly string[]): ProcessRun {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...env } = process.env;
  const completed = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: { ...env, NODE_V8_COVERAGE: "" },
  });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function captureFixture(root: string, fixture: ProducerFixture): Promise<CapturedRun> {
  const capture = run([captureCliPath, "--root", root]);
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = await readJson<CaptureManifest>(
    path.join(root, "coverage", "unit.manifest.json"),
  );
  assert.strictEqual(manifest.status, "captured");
  const directory = path.join(root, "coverage", "runs", manifest.runId);
  const record = manifest.modules.find((module) => module.path === fixture.sourcePath);
  assert.ok(record, `capture did not load ${fixture.sourcePath}`);
  const modulePath = path.join(root, fixture.sourcePath);
  const url = pathToFileURL(modulePath).href;
  const rawPaths: string[] = [];

  for (const worker of manifest.workers) {
    for (const rawFile of worker.raw) {
      const rawPath = path.join(directory, "raw", rawFile);
      const raw = await readJson<V8CoverageFile>(rawPath);

      if (raw.result.some((script) => script.url === url)) {
        rawPaths.push(rawPath);
      }
    }
  }

  return {
    root,
    manifestPath: path.join(directory, "manifest.json"),
    directory,
    modulePath,
    url,
    record,
    rawPaths,
  };
}

// Converts the captured module through the producer CLI from the run's own
// records: the request names the run manifest and the module path, and the
// CLI reads the immutable source and executed text from the run's stores.
async function convertFromRun(
  t: TestContext,
  captured: CapturedRun,
): Promise<{ run: ProcessRun; outputPath: string }> {
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-source-map-request-"));

  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });

  const requestPath = path.join(workspace, "request.json");
  await writeFile(
    requestPath,
    JSON.stringify({
      run: captured.manifestPath,
      scripts: captured.rawPaths.map((rawPath) => ({
        path: captured.record.path,
        coverage: rawPath,
      })),
    }),
  );
  const outputPath = path.join(workspace, "out", "istanbul.json");

  return {
    run: run([producerCliPath, "--request", requestPath, "--out", outputPath]),
    outputPath,
  };
}

function compareSpans(a: SourceSpan, b: SourceSpan): number {
  return (
    a.start.line - b.start.line ||
    a.start.column - b.start.column ||
    a.end.line - b.end.line ||
    a.end.column - b.end.column
  );
}

// A concrete location in the fixture vocabulary; a missing coordinate becomes
// -1 so it can never equal an expectation.
function asSpan(location: IstanbulLocation): SourceSpan {
  return {
    start: { line: location.start.line ?? -1, column: location.start.column ?? -1 },
    end: { line: location.end.line ?? -1, column: location.end.column ?? -1 },
  };
}

function projectCoverage(file: IstanbulFileCoverage): ProjectedCoverage {
  return {
    functions: Object.entries(file.fnMap)
      .map(([id, fn]) => ({
        name: fn.name,
        decl: asSpan(fn.decl),
        loc: asSpan(fn.loc),
        hits: file.f[id] ?? -1,
      }))
      .sort((a, b) => compareSpans(a.decl, b.decl)),
    statements: Object.entries(file.statementMap)
      .map(([id, loc]) => ({ loc: asSpan(loc), hits: file.s[id] ?? -1 }))
      .sort((a, b) => compareSpans(a.loc, b.loc)),
    branches: Object.entries(file.branchMap)
      .map(([id, branch]) => ({
        type: branch.type,
        loc: asSpan(branch.loc),
        locations: branch.locations.map(asSpan),
        hits: [...(file.b[id] ?? [])],
      }))
      .sort((a, b) => compareSpans(a.loc, b.loc)),
  };
}

function expectedCoverage(fixture: ProducerFixture): ProjectedCoverage {
  return {
    functions: [...fixture.functions].sort((a, b) => compareSpans(a.decl, b.decl)),
    statements: [...fixture.statements].sort((a, b) => compareSpans(a.loc, b.loc)),
    branches: [...fixture.branches].sort((a, b) => compareSpans(a.loc, b.loc)),
  };
}

async function projectedOutput(
  outputPath: string,
  captured: CapturedRun,
): Promise<ProjectedCoverage> {
  const coverage = await readJson<IstanbulCoverageMap>(outputPath);
  assert.deepStrictEqual(Object.keys(coverage), [captured.modulePath]);
  const file = coverage[captured.modulePath];
  assert.ok(file);
  return projectCoverage(file);
}

function refusalRows(stderr: string): SourceMapFailure[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => JSON.parse(line) as SourceMapFailure);
}

// The executed text Node's loader evaluates for a TypeScript module: the
// strip-mode output with the sourceURL trailer the translator appends.
function executedText(original: string, url: string): string {
  return stripTypeScriptTypes(original, { mode: "strip", sourceUrl: url });
}

const sampleModule: ExecutedModule = (() => {
  const modulePath = "/fixture/extensions/pi-claude-marketplace/domain/sample.ts";
  const url = pathToFileURL(modulePath).href;
  const original =
    'export const tag: string = "π🎉";\r\n\nexport function width(text: string): number { return text.length }\n';
  return { path: modulePath, url, original, executed: executedText(original, url) };
})();

test("converts the run's recorded module through the exact identity mapping", async (t) => {
  // arrange
  const fixture = endpointsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expected = expectedCoverage(fixture);

  // act
  const conversion = await convertFromRun(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(await projectedOutput(conversion.outputPath, captured), expected);
});

test("maps every UTF-16 column of every original line to itself, including the line-length column", async () => {
  // arrange
  const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;
  const expectedSegments = sampleModule.original
    .split("\n")
    .map((line, lineIndex) =>
      Array.from({ length: line.length + 1 }, (_, column) => [column, 0, lineIndex, column]),
    );

  // act
  const map = sourceMap.executedSourceMap(sampleModule);

  // assert
  assert.deepStrictEqual(
    { ...map, mappings: decode(map.mappings) },
    {
      version: 3,
      file: sampleModule.path,
      sources: [sampleModule.path],
      sourcesContent: [sampleModule.original],
      names: [],
      mappings: expectedSegments,
    },
  );
});

interface TransformRow {
  readonly name: string;
  readonly executed: string;
  readonly failure: SourceMapFailure;
}

const otherUrl = pathToFileURL("/fixture/extensions/pi-claude-marketplace/domain/other.ts").href;

const transformRows: readonly TransformRow[] = [
  {
    name: "executed text that dropped a character",
    executed: sampleModule.executed.replace("text.length", "text.lengt"),
    failure: {
      kind: "executed-length",
      expected: sampleModule.original.length,
      actual: sampleModule.original.length - 1,
    },
  },
  {
    name: "executed text that moved a line boundary",
    executed: sampleModule.executed.replace('"π🎉";\r\n\nexport', '"π🎉"; \n\rexport'),
    failure: { kind: "line-boundary", line: 1, column: 33 },
  },
  {
    name: "executed text that changed a character outside a type",
    executed: sampleModule.executed.replace("text.length", "text.lenGth"),
    failure: { kind: "transform", line: 3, column: 61, original: "g", executed: "G" },
  },
  {
    name: "executed text whose trailer names another module",
    executed: executedText(sampleModule.original, otherUrl),
    failure: { kind: "executed-trailer", url: sampleModule.url },
  },
];

for (const row of transformRows) {
  test(`refuses ${row.name}`, async () => {
    // arrange
    const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;

    // act & assert
    assert.throws(
      () => sourceMap.executedSourceMap({ ...sampleModule, executed: row.executed }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, "SourceMapError");
        assert.deepStrictEqual((error as Error & { failures: unknown }).failures, [row.failure]);
        return true;
      },
    );
  });
}

test("refuses a recorded source whose bytes no longer hash to the manifest digest", async (t) => {
  // arrange
  const fixture = endpointsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  await writeFile(
    path.join(captured.directory, "sources", captured.record.source),
    fixture.source.replace("=> 1", "=> 3"),
  );

  // act
  const conversion = await convertFromRun(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 1);
  assert.deepStrictEqual(
    refusalRows(conversion.run.stderr).map((row) => ({ kind: row.kind, path: row.path })),
    [{ kind: "stale-source", path: captured.record.path }],
  );
  await assert.rejects(readFile(conversion.outputPath));
});
