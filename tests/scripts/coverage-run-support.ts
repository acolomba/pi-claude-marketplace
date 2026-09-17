// Support for controls that start from a real capture run (D-02, D-03, D-09):
// a fixture root laid out like the repository, the capture CLI run against
// it under the native runner, and the producer CLI converting the run's own
// records into an Istanbul map. Every control that validates a map starts
// from bytes a run recorded, never from a map the test invented, so the
// coordinates under test are the ones the real pipeline reports.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { fixturePackageJson } from "./coverage-producer-fixtures.ts";

import type { ProducerFixture } from "./coverage-producer-fixtures.ts";
import type { TestContext } from "node:test";

export const captureCliPath = fileURLToPath(
  new URL("../../scripts/coverage-capture.mjs", import.meta.url),
);
export const producerCliPath = fileURLToPath(
  new URL("../../scripts/coverage-producer.mjs", import.meta.url),
);

export interface ProcessRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CaptureManifest {
  readonly runId: string;
  readonly status: string;
  readonly modules: ReadonlyArray<{
    readonly path: string;
    readonly source: string;
    readonly executed: string;
  }>;
  readonly workers: ReadonlyArray<{ readonly raw: readonly string[] }>;
}

export interface V8FunctionCoverage {
  readonly functionName: string;
  readonly isBlockCoverage: boolean;
  readonly ranges: ReadonlyArray<{
    readonly startOffset: number;
    readonly endOffset: number;
    readonly count: number;
  }>;
}

export interface V8ScriptCoverage {
  readonly url: string;
  readonly functions: readonly V8FunctionCoverage[];
}

export interface V8CoverageFile {
  readonly result: readonly V8ScriptCoverage[];
}

// A position read back from JSON lacks the coordinates of an implicit else,
// while the producer's in-memory form carries them as `undefined`; both are
// the same absent position.
export interface IstanbulPosition {
  readonly line?: number | undefined;
  readonly column?: number | undefined;
}

export interface IstanbulLocation {
  readonly start: IstanbulPosition;
  readonly end: IstanbulPosition;
}

export interface IstanbulFunction {
  readonly name: string;
  readonly decl: IstanbulLocation;
  readonly loc: IstanbulLocation;
  readonly line: number;
}

export interface IstanbulBranch {
  readonly type: string;
  readonly loc: IstanbulLocation;
  readonly locations: readonly IstanbulLocation[];
  readonly line: number;
}

export interface IstanbulFileCoverage {
  readonly path: string;
  readonly statementMap: Readonly<Record<string, IstanbulLocation>>;
  readonly fnMap: Readonly<Record<string, IstanbulFunction>>;
  readonly branchMap: Readonly<Record<string, IstanbulBranch>>;
  readonly s: Readonly<Record<string, number>>;
  readonly f: Readonly<Record<string, number>>;
  readonly b: Readonly<Record<string, readonly number[]>>;
}

export type IstanbulCoverageMap = Readonly<Record<string, IstanbulFileCoverage>>;

export interface FailureRow {
  readonly kind: string;
  readonly [field: string]: unknown;
}

// The run a fixture capture produced: where its manifest and stores live, the
// module the fixture names, and every raw V8 file holding that module's url.
export interface CapturedRun {
  readonly root: string;
  readonly manifestPath: string;
  readonly directory: string;
  readonly modulePath: string;
  readonly url: string;
  readonly record: { readonly path: string; readonly source: string; readonly executed: string };
  readonly rawPaths: readonly string[];
}

export async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "coverage-run-"));

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

export function fixtureFiles(fixture: ProducerFixture): Record<string, string> {
  return {
    "package.json": fixturePackageJson,
    [fixture.sourcePath]: fixture.source,
    ...fixture.tests,
  };
}

// Runs a script under this Node with the outer runner's worker markers shed
// and no inherited coverage destination, so a nested run never reports into
// the run that hosts this test.
export function run(args: readonly string[], cwd?: string): ProcessRun {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...env } = process.env;
  const completed = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...env, NODE_V8_COVERAGE: "" },
  });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function captureFixture(root: string, fixture: ProducerFixture): Promise<CapturedRun> {
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
// records and returns the map it wrote.
export async function convertFromRun(
  t: TestContext,
  captured: CapturedRun,
): Promise<IstanbulCoverageMap> {
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-run-request-"));

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
  const outputPath = path.join(workspace, "istanbul.json");
  const conversion = run([producerCliPath, "--request", requestPath, "--out", outputPath]);
  assert.strictEqual(conversion.status, 0, conversion.stderr);
  return readJson<IstanbulCoverageMap>(outputPath);
}

/** The executed text the run recorded for the captured module. */
export async function executedText(captured: CapturedRun): Promise<string> {
  return readFile(path.join(captured.directory, "executed", captured.record.executed), "utf8");
}

/** The V8 record for the captured module in each raw file that holds one. */
export async function rawRecords(captured: CapturedRun): Promise<V8ScriptCoverage[]> {
  const records: V8ScriptCoverage[] = [];

  for (const rawPath of captured.rawPaths) {
    const raw = await readJson<V8CoverageFile>(rawPath);
    records.push(...raw.result.filter((script) => script.url === captured.url));
  }

  return records;
}

/** The `{ kind, ... }` rows a CLI prints after its refusal message. */
export function refusalRows(stderr: string): FailureRow[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => JSON.parse(line) as FailureRow);
}
