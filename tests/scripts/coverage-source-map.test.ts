import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { decode, encode } from "@jridgewell/sourcemap-codec";

import { fixturePackageJson } from "./coverage-producer-fixtures.ts";
import {
  crlfFixture,
  declarationsFixture,
  endpointsFixture,
} from "./coverage-source-map-fixtures.ts";

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
  restoreSourceNames(file: IstanbulFileCoverage, executed: string): IstanbulFileCoverage;
  positionFailures(file: IstanbulFileCoverage, text: string): readonly SourceMapFailure[];
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
async function convertRequest(
  t: TestContext,
  request: object,
): Promise<{ run: ProcessRun; outputPath: string }> {
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-source-map-request-"));

  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });

  const requestPath = path.join(workspace, "request.json");
  await writeFile(requestPath, JSON.stringify(request));
  const outputPath = path.join(workspace, "out", "istanbul.json");

  return {
    run: run([producerCliPath, "--request", requestPath, "--out", outputPath]),
    outputPath,
  };
}

async function convertFromRun(
  t: TestContext,
  captured: CapturedRun,
  modulePath = captured.record.path,
): Promise<{ run: ProcessRun; outputPath: string }> {
  return convertRequest(t, {
    run: captured.manifestPath,
    scripts: captured.rawPaths.map((rawPath) => ({ path: modulePath, coverage: rawPath })),
  });
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function rewriteManifest(
  captured: CapturedRun,
  edit: (manifest: Record<string, unknown>) => void,
): Promise<void> {
  const manifest = await readJson<Record<string, unknown>>(captured.manifestPath);
  edit(manifest);
  await writeFile(captured.manifestPath, JSON.stringify(manifest));
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
      Array.from({ length: line.length + 1 }, (_char, column) => [column, 0, lineIndex, column]),
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

// Strip mode blanks a removed character with a blank of the same UTF-8
// length, so byte offsets hold as well as UTF-16 columns: one byte becomes a
// space, two bytes U+00A0, three bytes U+2002, and four bytes (a surrogate
// pair) a space followed by U+FEFF. The removed type alias below carries one
// of each.
test("accepts the same-length blanks strip mode writes for removed one-, two-, three- and four-byte characters", async () => {
  // arrange
  const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;
  const modulePath = "/fixture/extensions/pi-claude-marketplace/domain/blanks.ts";
  const url = pathToFileURL(modulePath).href;
  const typeLine = 'export type Note = "a § ∑ 🎉";';
  const original = `${typeLine}\nexport const kept = 1;\n`;
  const executed = executedText(original, url);
  const blankFor = (character: string): string => {
    const bytes = Buffer.byteLength(character, "utf8");
    return bytes === 4 ? " \ufeff" : ([" ", "\u00a0", "\u2002"][bytes - 1] ?? "");
  };

  const expectedTypeLine = Array.from(typeLine, blankFor).join("");

  // act
  const map = sourceMap.executedSourceMap({ path: modulePath, url, original, executed });

  // assert
  assert.strictEqual(executed.split("\n")[0], expectedTypeLine);
  assert.deepStrictEqual(
    {
      sources: map.sources,
      sourcesContent: map.sourcesContent,
      lines: decode(map.mappings).length,
    },
    { sources: [modulePath], sourcesContent: [original], lines: 3 },
  );
});

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
  const rewritten = fixture.source.replace("=> 1", "=> 3");
  await writeFile(path.join(captured.directory, "sources", captured.record.source), rewritten);

  // act
  const conversion = await convertFromRun(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 1);
  assert.deepStrictEqual(refusalRows(conversion.run.stderr), [
    {
      kind: "stale-source",
      path: captured.record.path,
      expected: captured.record.source,
      actual: sha256(rewritten),
    },
  ]);
  await assert.rejects(readFile(conversion.outputPath));
});

test("restores each repeated method, accessor and constructor name from its declaration and keeps a real _2 suffix", async (t) => {
  // arrange
  const fixture = declarationsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expected = expectedCoverage(fixture);

  // act
  const conversion = await convertFromRun(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(await projectedOutput(conversion.outputPath, captured), expected);
});

test("keeps CRLF and blank-line coordinates exact", async (t) => {
  // arrange
  const fixture = crlfFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expected = expectedCoverage(fixture);

  // act
  const conversion = await convertFromRun(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(await projectedOutput(conversion.outputPath, captured), expected);
});

interface ObsoleteRunRow {
  readonly name: string;
  readonly mutate: (captured: CapturedRun) => Promise<void>;
  readonly rows: (captured: CapturedRun) => readonly SourceMapFailure[];
}

const obsoleteRunRows: readonly ObsoleteRunRow[] = [
  {
    name: "a run whose capture tooling changed",
    mutate: (captured) =>
      rewriteManifest(captured, (manifest) => {
        manifest.tooling = {
          ...(manifest.tooling as object),
          "coverage-capture.mjs": "0".repeat(64),
        };
      }),
    rows: () => [{ kind: "tool-changed" }],
  },
  {
    name: "a run captured under another Node version",
    mutate: (captured) =>
      rewriteManifest(captured, (manifest) => {
        manifest.runtime = { ...(manifest.runtime as object), node: "v0.0.0" };
      }),
    rows: () => [{ kind: "runtime-changed", recorded: "v0.0.0" }],
  },
  {
    name: "a recorded executed text whose bytes no longer hash to the manifest digest",
    mutate: async (captured) => {
      await writeFile(path.join(captured.directory, "executed", captured.record.executed), "x");
    },
    rows: (captured) => [
      {
        kind: "stale-executed",
        path: captured.record.path,
        expected: captured.record.executed,
        actual: sha256("x"),
      },
    ],
  },
  {
    // The executed text is rewritten with one letter changed, stored under
    // its own digest and named by the manifest, so the digests agree and
    // only the transform proof can refuse it.
    name: "a recorded executed text that is not a strip of its source",
    mutate: async (captured) => {
      const executedPath = path.join(captured.directory, "executed", captured.record.executed);
      const rewritten = (await readFile(executedPath, "utf8")).replace(
        "return this.value;",
        "return this.valve;",
      );
      await writeFile(path.join(captured.directory, "executed", sha256(rewritten)), rewritten);
      await rewriteManifest(captured, (manifest) => {
        manifest.modules = (manifest.modules as Array<Record<string, unknown>>).map((record) =>
          record.path === captured.record.path
            ? { ...record, executed: sha256(rewritten) }
            : record,
        );
      });
    },
    rows: () => [{ kind: "transform", line: 9, column: 19, original: "u", executed: "v" }],
  },
];

for (const row of obsoleteRunRows) {
  test(`refuses ${row.name}`, async (t) => {
    // arrange
    const fixture = crlfFixture();
    const root = await createRoot(t, fixtureFiles(fixture));
    const captured = await captureFixture(root, fixture);
    await row.mutate(captured);

    // act
    const conversion = await convertFromRun(t, captured);

    // assert
    assert.deepStrictEqual(
      { status: conversion.run.status, rows: refusalRows(conversion.run.stderr) },
      { status: 1, rows: row.rows(captured) },
    );
    await assert.rejects(readFile(conversion.outputPath));
  });
}

test("refuses a module the run never loaded", async (t) => {
  // arrange
  const fixture = crlfFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const missingPath = "extensions/pi-claude-marketplace/domain/missing.ts";

  // act
  const conversion = await convertFromRun(t, captured, missingPath);

  // assert
  assert.deepStrictEqual(
    { status: conversion.run.status, rows: refusalRows(conversion.run.stderr) },
    { status: 1, rows: [{ kind: "module-not-captured", path: missingPath }] },
  );
  await assert.rejects(readFile(conversion.outputPath));
});

// A map with a segment for every column except the line-length column: a
// node ending at a line end then has no finite endpoint and the producer
// reports Infinity, which JSON would turn into null.
function endpointlessSourceMap(modulePath: string, code: string): IdentitySourceMap {
  const lines = code.split("\n");

  return {
    version: 3,
    file: modulePath,
    sources: [modulePath],
    sourcesContent: [code],
    names: [],
    mappings: encode(
      lines.map((line, lineIndex) =>
        Array.from({ length: line.length }, (_char, column) => [column, 0, lineIndex, column]),
      ),
    ),
  };
}

test("refuses a conversion whose endpoints are not finite instead of writing null", async (t) => {
  // arrange
  const fixture = endpointsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-source-map-explicit-"));
  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });
  const code = await readFile(
    path.join(captured.directory, "executed", captured.record.executed),
    "utf8",
  );
  const codePath = path.join(workspace, "executed.js");
  const sourceMapPath = path.join(workspace, "endpointless.map.json");
  await writeFile(codePath, code);
  await writeFile(sourceMapPath, JSON.stringify(endpointlessSourceMap(captured.modulePath, code)));
  const expected = expectedCoverage(fixture);
  const endOfLine = (span: SourceSpan): SourceMapFailure["location"] => ({
    start: span.start,
    end: { line: span.end.line, column: null },
  });
  const skipInit = expected.statements[3];
  const skipBody = expected.statements[4];
  const skipFunction = expected.functions[1];
  const widthFunction = expected.functions[2];
  assert.ok(skipInit && skipBody && skipFunction && widthFunction);

  // act
  const conversion = await convertRequest(t, {
    scripts: captured.rawPaths.map((rawPath) => ({
      url: captured.url,
      code: codePath,
      sourceMap: sourceMapPath,
      coverage: rawPath,
    })),
  });

  // assert
  assert.deepStrictEqual(
    { status: conversion.run.status, rows: refusalRows(conversion.run.stderr) },
    {
      status: 1,
      rows: [
        {
          kind: "position",
          part: "statementMap[3]",
          location: endOfLine(skipInit.loc),
          path: captured.modulePath,
        },
        {
          kind: "position",
          part: "statementMap[4]",
          location: endOfLine(skipBody.loc),
          path: captured.modulePath,
        },
        {
          kind: "position",
          part: "fnMap[1].loc",
          location: endOfLine(skipFunction.loc),
          path: captured.modulePath,
        },
        {
          kind: "position",
          part: "fnMap[2].loc",
          location: endOfLine(widthFunction.loc),
          path: captured.modulePath,
        },
      ],
    },
  );
  await assert.rejects(readFile(conversion.outputPath));
});

const declarationsText =
  "export const a = { pick() { return 1; } };\nexport const b = { pick() { return 2; } };\n";

function declarationsFile(fnMap: IstanbulFileCoverage["fnMap"]): IstanbulFileCoverage {
  return {
    path: "/fixture/declarations.js",
    statementMap: {},
    fnMap,
    branchMap: {},
    s: {},
    f: Object.fromEntries(Object.keys(fnMap).map((id) => [id, 1])),
    b: {},
  };
}

const firstPick = { decl: at(1, 19, 1, 23), loc: at(1, 26, 1, 39) };
const secondPick = { decl: at(2, 19, 2, 23), loc: at(2, 26, 2, 39) };

function at(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): IstanbulLocation {
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

test("restores a repeated spelling only through the declaration at its exact spans", async () => {
  // arrange
  const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;
  const file = declarationsFile({
    0: { name: "pick", ...firstPick, line: 1 },
    1: { name: "pick_2", ...secondPick, line: 2 },
  });

  // act
  const restored = sourceMap.restoreSourceNames(file, declarationsText);

  // assert
  assert.deepStrictEqual(
    restored,
    declarationsFile({
      0: { name: "pick", ...firstPick, line: 1 },
      1: { name: "pick", ...secondPick, line: 2 },
    }),
  );
});

test("refuses a function whose spans match no declaration instead of taking the nearest name", async () => {
  // arrange
  const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;
  const shifted = { decl: at(2, 20, 2, 24), loc: secondPick.loc };
  const file = declarationsFile({
    0: { name: "pick", ...firstPick, line: 1 },
    1: { name: "pick_2", ...shifted, line: 2 },
  });

  // act & assert
  assert.throws(
    () => sourceMap.restoreSourceNames(file, declarationsText),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.name, "SourceMapError");
      assert.deepStrictEqual((error as Error & { failures: unknown }).failures, [
        { kind: "function-unproven", id: "1", name: "pick_2", ...shifted },
      ]);
      return true;
    },
  );
});

const positionText = "export const a = 1;\nexport function f() {\n  return a;\n}\n";

const absent: IstanbulLocation = { start: {}, end: {} };

function positionSeed(): IstanbulFileCoverage {
  return {
    path: "/fixture/positions.js",
    statementMap: { 0: at(1, 17, 1, 18), 1: at(3, 2, 3, 11) },
    fnMap: { 0: { name: "f", decl: at(2, 16, 2, 17), loc: at(2, 20, 4, 1), line: 2 } },
    branchMap: {
      0: { type: "if", loc: at(3, 2, 3, 11), locations: [at(3, 2, 3, 11), absent], line: 3 },
    },
    s: { 0: 1, 1: 1 },
    f: { 0: 1 },
    b: { 0: [1, 0] },
  };
}

function withStatement(location: IstanbulLocation): IstanbulFileCoverage {
  const seed = positionSeed();
  return { ...seed, statementMap: { ...seed.statementMap, 0: location } };
}

function withFunction(fn: Partial<IstanbulFileCoverage["fnMap"][string]>): IstanbulFileCoverage {
  const seed = positionSeed();
  const first = seed.fnMap[0];
  assert.ok(first);
  return { ...seed, fnMap: { 0: { ...first, ...fn } } };
}

interface PositionRow {
  readonly name: string;
  readonly file: IstanbulFileCoverage;
  readonly failures: readonly SourceMapFailure[];
}

const infinityStatement = { start: { line: 1, column: 17 }, end: { line: 1, column: Infinity } };

const positionRows: readonly PositionRow[] = [
  {
    name: "finite coordinates with an implicit-else branch location",
    file: positionSeed(),
    failures: [],
  },
  {
    name: "an Infinity end column",
    file: withStatement(infinityStatement),
    failures: [{ kind: "position", part: "statementMap[0]", location: infinityStatement }],
  },
  {
    name: "a null end column read back from JSON",
    file: JSON.parse(JSON.stringify(withStatement(infinityStatement))) as IstanbulFileCoverage,
    failures: [
      {
        kind: "position",
        part: "statementMap[0]",
        location: { start: { line: 1, column: 17 }, end: { line: 1, column: null } },
      },
    ],
  },
  {
    name: "a negative column",
    file: withFunction({ decl: at(2, -1, 2, 17) }),
    failures: [{ kind: "position", part: "fnMap[0].decl", location: at(2, -1, 2, 17) }],
  },
  {
    name: "a fractional line",
    file: withStatement(at(1.5, 17, 1, 18)),
    failures: [{ kind: "position", part: "statementMap[0]", location: at(1.5, 17, 1, 18) }],
  },
  {
    name: "a reversed span",
    file: withStatement(at(1, 18, 1, 17)),
    failures: [{ kind: "position", part: "statementMap[0]", location: at(1, 18, 1, 17) }],
  },
  {
    name: "a column past the line length",
    file: withStatement(at(1, 17, 1, 20)),
    failures: [{ kind: "position", part: "statementMap[0]", location: at(1, 17, 1, 20) }],
  },
  {
    name: "a line past the text",
    file: withFunction({ loc: at(2, 20, 6, 1) }),
    failures: [{ kind: "position", part: "fnMap[0].loc", location: at(2, 20, 6, 1) }],
  },
  {
    name: "a statement without coordinates",
    file: withStatement(absent),
    failures: [{ kind: "position", part: "statementMap[0]", location: absent }],
  },
  {
    name: "a function line field that is not its start line",
    file: withFunction({ line: 3 }),
    failures: [{ kind: "position", part: "fnMap[0].line", line: 3, location: at(2, 20, 4, 1) }],
  },
];

for (const row of positionRows) {
  test(`reports ${row.name} as ${row.failures.length} position failure(s)`, async () => {
    // arrange
    const sourceMap = (await import(sourceMapModuleUrl)) as unknown as SourceMapModule;

    // act
    const failures = sourceMap.positionFailures(row.file, positionText);

    // assert
    assert.deepStrictEqual(failures, row.failures);
  });
}
