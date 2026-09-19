import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { encode } from "@jridgewell/sourcemap-codec";

import {
  conformanceCorpus,
  fixturePackageJson,
  nestedLogicalFixture,
  nestedLogicalOmission,
  tallyFixture,
  tallyWorkerHits,
} from "./coverage-producer-fixtures.ts";
import { expectedCoverage, projectCoverage, spanKey } from "./coverage-projection.ts";
import { refusalRows } from "./coverage-run-support.ts";
import {
  IDLE_PATH,
  PAIR_PATH,
  pairCoverage,
  pairWorkerHits,
  populationFiles,
  TYPES_PATH,
  UNIMPORTED_PATH,
  unimportedCoverage,
} from "./coverage-unit-fixtures.ts";

import type { ExpectedFunction, ProducerFixture } from "./coverage-producer-fixtures.ts";
import type { ProjectedCoverage } from "./coverage-projection.ts";
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
const producerCliUrl = new URL("../../scripts/coverage-producer.mjs", import.meta.url).href;
const adapterModuleUrl = new URL("../../scripts/coverage-producer.convert.mjs", import.meta.url)
  .href;
const buildCliPath = fileURLToPath(
  new URL("../../scripts/build-coverage-producer.mjs", import.meta.url),
);
const vendorDirectory = fileURLToPath(new URL("../../vendor/coverage/", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const adapterPath = fileURLToPath(adapterModuleUrl);

// The researched upstream 1.0.6 producer payload (`dist/index.mjs`) and its
// MIT license, recorded from the registry tarball with integrity
// sha512-fvpl29helSO2w/z7utIbrkNXILdrLwDwAMH2I/zPKlGf5244+gf+B4cyS1sANcrPY2h+hWCGSgC8N61s/+AF9A==.
const upstreamPayloadDigest = "0ce3ec436049c66fff8757450230369156ee2126f52d06b41f99780e497d0a79";
const upstreamLicenseDigest = "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a";

// The delivered 1.0.6-project.1 payload and archive, recorded from the
// vendored tarball when it was built.
const deliveredVersion = "1.0.6-project.1";
const deliveredArchive = "vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz";
const deliveredIntegrity =
  "sha512-6KzTeECN1o+Xo9KtrN78sK5gWF37nL1vZYxrVTj/iBCE2qPGC/si5KnuDfDYV6KihNMwlMdjWciZMnsrI93fEg==";
const deliveredPayloadDigest = "29377dc2bb113e40525edb050434420b0d071122c9aa382174a8d622a35c8874";

// The one walker line the patch changes, so the upstream payload can be
// reconstructed from the installed bytes without any network access.
const patchedWalkerLine =
  '\t\t\t\tswitch (isSkipped(e) && e.type !== "LogicalExpression" && onIgnore(e), e.type) {';
const upstreamWalkerLine = "\t\t\t\tswitch (isSkipped(e) && onIgnore(e), e.type) {";

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
  readonly raw: ReadonlyArray<{ readonly path: string }>;
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
  readonly delivery: {
    readonly version: string;
    readonly archive: string;
    readonly integrity: string;
    readonly qualified: boolean;
    readonly failures: ReadonlyArray<Readonly<Record<string, unknown>>>;
  };
}

interface LoadedProducer {
  readonly identity: ProducerIdentity["producer"];
}

interface ConversionScript {
  readonly code: string;
  readonly coverage: V8ScriptCoverage;
  readonly sourceMap: IdentitySourceMap;
}

interface ProducerModule {
  loadProducer(entry?: string, options?: { readonly root?: string }): Promise<LoadedProducer>;
  producerIdentity(producer: LoadedProducer): ProducerIdentity;
  convertScripts(
    producer: LoadedProducer,
    scripts: readonly ConversionScript[],
  ): Promise<IstanbulCoverageMap>;
}

interface ProducerFailure {
  readonly kind: string;
  readonly entry?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

// One worker's raw V8 record for the captured module and the test that
// worker ran.
interface CapturedRecord {
  readonly test: string;
  readonly rawPath: string;
  readonly coverage: V8ScriptCoverage;
}

// The executed JavaScript of one captured module together with every raw V8
// record the run produced for it, one per worker that loaded it.
interface CapturedScript {
  readonly modulePath: string;
  readonly url: string;
  readonly code: string;
  readonly records: readonly CapturedRecord[];
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
  const records: CapturedRecord[] = [];

  for (const worker of manifest.workers) {
    for (const rawFile of worker.raw) {
      const rawPath = path.join(runDirectory, "raw", rawFile);
      const raw = JSON.parse(await readFile(rawPath, "utf8")) as V8CoverageFile;
      const script = raw.result.find((candidate) => candidate.url === url);

      if (script !== undefined) {
        records.push({ test: worker.test, rawPath, coverage: script });
      }
    }
  }

  return {
    modulePath,
    url,
    code: await readFile(path.join(runDirectory, "executed", record.executed), "utf8"),
    records,
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
        Array.from({ length: line.length + 1 }, (_value, column) => [column, 0, lineIndex, column]),
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
): Promise<{ run: ProcessRun; outputPath: string; receiptPath: string }> {
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
  const scripts: ConversionRequestScript[] = captured.records.map((record) => ({
    url: captured.url,
    code: "executed.js",
    sourceMap: "identity.map.json",
    coverage: record.rawPath,
  }));
  const requestPath = path.join(workspace, "request.json");
  await writeFile(requestPath, JSON.stringify({ scripts }));
  const outputPath = path.join(workspace, "out", "istanbul.json");
  const receiptPath = path.join(workspace, "out", "receipt.json");

  return {
    run: run([
      producerCliPath,
      "--request",
      requestPath,
      "--out",
      outputPath,
      "--receipt",
      receiptPath,
      ...extraArgs,
    ]),
    outputPath,
    receiptPath,
  };
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

// A package directory holding the upstream 1.0.6 payload, reconstructed by
// undoing the one patched line of the installed payload, with the
// repository's node_modules linked in so the producer's own dependencies
// resolve. The reconstruction must hash to the recorded upstream digest.
async function upstreamProducerEntry(t: TestContext): Promise<string> {
  const installedEntry = fileURLToPath(import.meta.resolve("ast-v8-to-istanbul"));
  const reconstructed = (await readFile(installedEntry, "utf8")).replace(
    patchedWalkerLine,
    upstreamWalkerLine,
  );
  assert.strictEqual(sha256(reconstructed), upstreamPayloadDigest);
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-producer-upstream-"));

  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });

  const packageDirectory = path.join(workspace, "ast-v8-to-istanbul");
  await mkdir(path.join(packageDirectory, "dist"), { recursive: true });
  await writeFile(path.join(packageDirectory, "dist", "index.mjs"), reconstructed);
  await writeFile(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({ name: "ast-v8-to-istanbul", version: "1.0.6", type: "module" }),
  );
  await cp(path.join(vendorDirectory, "LICENSE"), path.join(packageDirectory, "LICENSE"));
  await symlink(path.join(repositoryRoot, "node_modules"), path.join(workspace, "node_modules"));
  return path.join(packageDirectory, "dist", "index.mjs");
}

async function readCoverageMap(outputPath: string): Promise<IstanbulCoverageMap> {
  return JSON.parse(await readFile(outputPath, "utf8")) as IstanbulCoverageMap;
}

function omittedFrom(actual: ProjectedCoverage, expected: ProjectedCoverage): ProjectedCoverage {
  const keys = {
    functions: new Set(actual.functions.map((fn) => spanKey(fn.loc))),
    statements: new Set(actual.statements.map((statement) => spanKey(statement.loc))),
    branches: new Set(actual.branches.map((branch) => spanKey(branch.loc))),
  };

  return {
    functions: expected.functions.filter((fn) => !keys.functions.has(spanKey(fn.loc))),
    statements: expected.statements.filter(
      (statement) => !keys.statements.has(spanKey(statement.loc)),
    ),
    branches: expected.branches.filter((branch) => !keys.branches.has(spanKey(branch.loc))),
  };
}

async function projectedOutput(
  outputPath: string,
  captured: CapturedScript,
): Promise<ProjectedCoverage> {
  const coverage = await readCoverageMap(outputPath);
  assert.deepStrictEqual(Object.keys(coverage), [captured.modulePath]);
  const file = coverage[captured.modulePath];
  assert.ok(file);
  return projectCoverage(file);
}

for (const fixture of conformanceCorpus()) {
  test(`reproduces the ${fixture.name} corpus exactly through the installed delivery`, async (t) => {
    // arrange
    const root = await createRoot(t, fixtureFiles(fixture));
    const captured = await captureFixture(root, fixture);
    const expected = expectedCoverage(fixture);

    // act
    const conversion = await convertThroughCli(t, captured);

    // assert
    assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
    assert.deepStrictEqual(await projectedOutput(conversion.outputPath, captured), expected);
    const receipt = await readJson<ProducerIdentity>(conversion.receiptPath);
    assert.deepStrictEqual(
      { version: receipt.producer.version, qualified: receipt.delivery.qualified },
      { version: deliveredVersion, qualified: true },
    );
  });
}

test("sums the two workers' records under one identity, in either order, from a fresh AST each", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const sourceMap = identitySourceMap(captured.modulePath, captured.code);
  const scripts = captured.records.map((record) => ({
    test: record.test,
    script: { code: captured.code, coverage: record.coverage, sourceMap },
  }));
  const adapter = (await import(adapterModuleUrl)) as unknown as ProducerModule;
  const producer = await adapter.loadProducer();
  const expected = expectedCoverage(fixture);
  const project = (coverage: IstanbulCoverageMap): ProjectedCoverage => {
    const file = coverage[captured.modulePath];
    assert.ok(file);
    return projectCoverage(file);
  };

  // act
  const perWorker = new Map<string, ProjectedCoverage>();

  for (const { test: workerTest, script } of scripts) {
    perWorker.set(workerTest, project(await adapter.convertScripts(producer, [script])));
  }

  const forward = project(
    await adapter.convertScripts(
      producer,
      scripts.map((s) => s.script),
    ),
  );
  const reversed = project(
    await adapter.convertScripts(
      producer,
      [...scripts].reverse().map((s) => s.script),
    ),
  );

  // assert
  assert.deepStrictEqual(
    new Map(
      [...perWorker].map(([workerTest, projected]) => [workerTest, projected.functions[0]?.hits]),
    ),
    new Map(Object.entries(tallyWorkerHits)),
  );
  assert.deepStrictEqual(forward, expected);
  assert.deepStrictEqual(reversed, expected);
});

test("rejects the reconstructed upstream 1.0.6 producer: the nested logical callback, its body and its branch are absent", async (t) => {
  // arrange
  const fixture = nestedLogicalFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expected = expectedCoverage(fixture);
  const omission = nestedLogicalOmission();
  const upstreamEntry = await upstreamProducerEntry(t);

  // act
  const conversion = await convertThroughCli(t, captured, ["--producer", upstreamEntry]);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  const receipt = await readJson<ProducerIdentity>(conversion.receiptPath);
  assert.deepStrictEqual(receipt.producer, {
    name: "ast-v8-to-istanbul",
    version: "1.0.6",
    entry: upstreamEntry,
    payloadDigest: upstreamPayloadDigest,
    licenseDigest: upstreamLicenseDigest,
  });
  assert.deepStrictEqual(
    { qualified: receipt.delivery.qualified, failures: receipt.delivery.failures },
    {
      qualified: false,
      failures: [
        { kind: "producer-location", entry: upstreamEntry },
        { kind: "producer-version", expected: deliveredVersion, actual: "1.0.6" },
        {
          kind: "producer-payload",
          expected: deliveredPayloadDigest,
          actual: upstreamPayloadDigest,
        },
      ],
    },
  );
  const projected = await projectedOutput(conversion.outputPath, captured);
  const omitted = omittedFrom(projected, expected);
  assert.deepStrictEqual(
    {
      functions: omitted.functions.map((fn) => fn.loc),
      statements: omitted.statements.map((statement) => statement.loc),
      branches: omitted.branches.map((branch) => branch.loc),
    },
    { functions: omission.functions, statements: omission.statements, branches: omission.branches },
  );
  const omittedKeys = new Set(
    [...omission.functions, ...omission.statements, ...omission.branches].map(spanKey),
  );
  const anonymous = (fn: ExpectedFunction): ExpectedFunction => ({
    ...fn,
    name: fn.name.replace(/^\(anonymous_\d+\)$/u, "(anonymous)"),
  });
  assert.deepStrictEqual(
    { ...projected, functions: projected.functions.map(anonymous) },
    {
      functions: expected.functions
        .filter((fn) => !omittedKeys.has(spanKey(fn.loc)))
        .map(anonymous),
      statements: expected.statements.filter(
        (statement) => !omittedKeys.has(spanKey(statement.loc)),
      ),
      branches: expected.branches.filter((branch) => !omittedKeys.has(spanKey(branch.loc))),
    },
  );
});

test("records a producer identity receipt bound to the delivery, the tool versions and the runtime", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const expectedReceipt: ProducerIdentity = {
    producer: {
      name: "ast-v8-to-istanbul",
      version: deliveredVersion,
      entry: path.join(repositoryRoot, "node_modules", "ast-v8-to-istanbul", "dist", "index.mjs"),
      payloadDigest: deliveredPayloadDigest,
      licenseDigest: upstreamLicenseDigest,
    },
    parser: { name: "acorn", version: "8.18.0" },
    merger: { name: "istanbul-lib-coverage", version: "3.2.2" },
    codec: { name: "@jridgewell/sourcemap-codec", version: "1.6.0" },
    runtime: { node: process.version, v8: process.versions.v8 },
    adapter: { "coverage-producer.convert.mjs": sha256(await readFile(adapterPath)) },
    delivery: {
      version: deliveredVersion,
      archive: deliveredArchive,
      integrity: deliveredIntegrity,
      qualified: true,
      failures: [],
    },
  };

  // act
  const conversion = await convertThroughCli(t, captured);

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(await readJson<ProducerIdentity>(conversion.receiptPath), expectedReceipt);
});

test("refuses the installed producer when the lockfile no longer resolves it to the delivery", async (t) => {
  // arrange
  const lockfile = await readJson<{
    packages: Record<string, { version: string; resolved: string; integrity: string }>;
  }>(path.join(repositoryRoot, "package-lock.json"));
  const recorded = lockfile.packages["node_modules/ast-v8-to-istanbul"];
  assert.ok(recorded);
  const drifted = { ...recorded, integrity: "sha512-AAAA" };
  const otherRoot = await mkdtemp(path.join(tmpdir(), "coverage-producer-lock-"));
  t.after(async () => {
    await rm(otherRoot, { force: true, recursive: true });
  });
  await writeFile(
    path.join(otherRoot, "package-lock.json"),
    JSON.stringify({
      ...lockfile,
      packages: { ...lockfile.packages, "node_modules/ast-v8-to-istanbul": drifted },
    }),
  );
  const adapter = (await import(adapterModuleUrl)) as unknown as ProducerModule;
  const installedEntry = fileURLToPath(import.meta.resolve("ast-v8-to-istanbul"));

  // act & assert
  await assert.rejects(
    () => adapter.loadProducer(undefined, { root: otherRoot }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.name, "ProducerError");
      assert.deepStrictEqual((error as Error & { failures: ProducerFailure[] }).failures, [
        { kind: "producer-location", entry: installedEntry },
        {
          kind: "lock-resolution",
          expected: {
            version: deliveredVersion,
            resolved: `file:${deliveredArchive}`,
            integrity: deliveredIntegrity,
          },
          actual: drifted,
        },
      ]);
      return true;
    },
  );
});

// The qualification is what tells the maintained delivery from a tampered
// `node_modules`, so it must decide before the producer's own top-level code
// runs in the loading process. The child records every module its loader
// evaluates and reports whether the producer package was among them.
test("refuses the installed producer before any of its code runs", async (t) => {
  // arrange
  const otherRoot = await mkdtemp(path.join(tmpdir(), "coverage-producer-lock-"));
  t.after(async () => {
    await rm(otherRoot, { force: true, recursive: true });
  });
  const specifier = JSON.stringify(adapterModuleUrl);

  // act
  const loaded = run([
    "--input-type=module",
    "-e",
    `import { registerHooks } from "node:module";
const evaluated = [];
registerHooks({ load(url, context, next) { evaluated.push(url); return next(url, context); } });
const adapter = await import(${specifier});
let refusal;
try {
  await adapter.loadProducer(undefined, { root: ${JSON.stringify(otherRoot)} });
} catch (error) {
  refusal = { name: error.name, kinds: error.failures.map((failure) => failure.kind) };
}
process.stdout.write(JSON.stringify({
  refusal,
  producerEvaluated: evaluated.some((url) => url.includes("/node_modules/ast-v8-to-istanbul/")),
}));`,
  ]);

  // assert
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  assert.deepStrictEqual(JSON.parse(loaded.stdout), {
    refusal: { name: "ProducerError", kinds: ["producer-location", "lock-resolution"] },
    producerEvaluated: false,
  });
});

interface DeliveryMutant {
  readonly name: string;
  readonly mutate: (vendor: string) => Promise<void>;
  readonly kinds: readonly string[];
}

const deliveryMutants: readonly DeliveryMutant[] = [
  {
    name: "a patch whose context no longer matches the delivered bytes",
    mutate: async (vendor) => {
      const patchPath = path.join(vendor, "ast-v8-to-istanbul-1.0.6.patch");
      const patch = await readFile(patchPath, "utf8");
      await writeFile(
        patchPath,
        patch.replace(" \t\t\t\tlet n = getIgnoreHint(e);", " \t\t\t\tlet n = getIgnoreHint(x);"),
      );
    },
    kinds: ["patch-digest", "patch-context"],
  },
  {
    name: "an archive with one extra byte",
    mutate: async (vendor) => {
      await appendFile(path.join(vendor, "ast-v8-to-istanbul-1.0.6-project.1.tgz"), "x");
    },
    kinds: ["archive-integrity", "archive-digest", "archive-unreadable"],
  },
  {
    name: "a missing license",
    mutate: async (vendor) => {
      await rm(path.join(vendor, "LICENSE"));
    },
    kinds: ["missing-license"],
  },
  {
    name: "a provenance record that no longer names the delivered payload digest",
    mutate: async (vendor) => {
      const provenancePath = path.join(vendor, "PROVENANCE.md");
      const provenance = await readFile(provenancePath, "utf8");
      await writeFile(
        provenancePath,
        provenance.replaceAll(deliveredPayloadDigest, "0".repeat(64)),
      );
    },
    kinds: ["provenance-missing-value"],
  },
];

function refusalKinds(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("  {"))
    .map((line) => (JSON.parse(line) as { kind: string }).kind);
}

for (const mutant of deliveryMutants) {
  test(`refuses ${mutant.name}`, async (t) => {
    // arrange
    const vendor = await mkdtemp(path.join(tmpdir(), "coverage-producer-vendor-"));
    t.after(async () => {
      await rm(vendor, { force: true, recursive: true });
    });
    await cp(vendorDirectory, vendor, { recursive: true });
    await mutant.mutate(vendor);

    // act
    const verification = run([buildCliPath, "--verify", "--vendor", vendor]);

    // assert
    assert.deepStrictEqual(
      { status: verification.status, kinds: refusalKinds(verification.stderr) },
      { status: 1, kinds: [...mutant.kinds] },
    );
  });
}

test("refuses to build from an upstream tarball whose integrity is not the pinned one", async (t) => {
  // arrange
  const vendor = await mkdtemp(path.join(tmpdir(), "coverage-producer-vendor-"));
  t.after(async () => {
    await rm(vendor, { force: true, recursive: true });
  });
  await cp(vendorDirectory, vendor, { recursive: true });
  const bogusUpstream = path.join(vendor, "bogus.tgz");
  await writeFile(bogusUpstream, "not the upstream tarball");
  const archiveBefore = await readFile(path.join(vendor, "ast-v8-to-istanbul-1.0.6-project.1.tgz"));

  // act
  const build = run([buildCliPath, "--build", "--upstream", bogusUpstream, "--vendor", vendor]);

  // assert
  assert.deepStrictEqual(
    { status: build.status, stderr: build.stderr.split("\n")[0] },
    {
      status: 1,
      stderr: `{"kind":"upstream-integrity","actual":"sha512-${createHash("sha512").update("not the upstream tarball").digest("base64")}"}`,
    },
  );
  assert.deepStrictEqual(
    await readFile(path.join(vendor, "ast-v8-to-istanbul-1.0.6-project.1.tgz")),
    archiveBefore,
  );
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
  const specifier = JSON.stringify(producerCliUrl);

  // act
  const imported = run([
    "--input-type=module",
    "-e",
    `const loaded = await import(${specifier}); process.stdout.write(JSON.stringify(Object.keys(loaded)));`,
  ]);

  // assert
  assert.deepStrictEqual(
    { status: imported.status, stdout: imported.stdout, stderr: imported.stderr },
    { status: 0, stdout: "[]", stderr: "" },
  );
});

test("verifies the vendored delivery: archive, entries, license, patch context and provenance agree", () => {
  // arrange
  const expectedVerdict = {
    status: 0,
    stdout: `Producer delivery verified: ast-v8-to-istanbul@1.0.6-project.1 in ${vendorDirectory.replace(/\/$/u, "")}\n`,
    stderr: "",
  };

  // act
  const verification = run([buildCliPath, "--verify"]);

  // assert
  assert.deepStrictEqual(verification, expectedVerdict);
});

// A snapshot request converts every requested module of a run from the run's
// own raw files, one file per worker isolate, and merges the workers through
// Istanbul's merger (D-04, D-07).

interface PopulationRun {
  readonly root: string;
  readonly manifestPath: string;
  readonly runDirectory: string;
  readonly raw: readonly string[];
  readonly rawByTest: Readonly<Record<string, string>>;
}

async function capturePopulation(t: TestContext): Promise<PopulationRun> {
  const root = await createRoot(t, populationFiles());
  const capture = run([captureCliPath, "--root", root]);
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = JSON.parse(
    await readFile(path.join(root, "coverage", "unit.manifest.json"), "utf8"),
  ) as CaptureManifest;
  const runDirectory = path.join(root, "coverage", "runs", manifest.runId);
  const rawByTest: Record<string, string> = {};

  for (const worker of manifest.workers) {
    const [rawFile] = worker.raw;
    assert.ok(rawFile);
    rawByTest[worker.test] = path.join(runDirectory, "raw", rawFile);
  }

  return {
    root,
    manifestPath: path.join(runDirectory, "manifest.json"),
    runDirectory,
    raw: manifest.raw.map((record) => path.join(root, record.path)),
    rawByTest,
  };
}

interface SnapshotRequest {
  readonly modules: readonly string[];
  readonly raw: readonly string[];
}

async function convertSnapshots(
  t: TestContext,
  captured: PopulationRun,
  request: SnapshotRequest,
): Promise<{ run: ProcessRun; outputPath: string }> {
  const workspace = await mkdtemp(path.join(tmpdir(), "coverage-producer-snapshots-"));

  t.after(async () => {
    await rm(workspace, { force: true, recursive: true });
  });

  const requestPath = path.join(workspace, "request.json");
  await writeFile(requestPath, JSON.stringify({ run: captured.manifestPath, ...request }));
  const outputPath = path.join(workspace, "istanbul.json");

  return {
    run: run([producerCliPath, "--request", requestPath, "--out", outputPath]),
    outputPath,
  };
}

async function projectedFile(
  outputPath: string,
  root: string,
  modulePath: string,
): Promise<ProjectedCoverage> {
  const coverage = await readCoverageMap(outputPath);
  const file = coverage[path.join(root, modulePath)];
  assert.ok(file, `the producer wrote no record for ${modulePath}`);
  return projectCoverage(file);
}

test("converts a run's snapshots into one merged map whose bytes do not depend on their order", async (t) => {
  // arrange
  const captured = await capturePopulation(t);
  const modules = [PAIR_PATH, IDLE_PATH];

  // act
  const forward = await convertSnapshots(t, captured, { modules, raw: captured.raw });
  const reversed = await convertSnapshots(t, captured, {
    modules,
    raw: [...captured.raw].reverse(),
  });

  // assert
  assert.strictEqual(forward.run.status, 0, forward.run.stderr);
  assert.strictEqual(reversed.run.status, 0, reversed.run.stderr);
  assert.deepStrictEqual(await readFile(reversed.outputPath), await readFile(forward.outputPath));
  assert.deepStrictEqual(
    await projectedFile(forward.outputPath, captured.root, PAIR_PATH),
    pairCoverage(),
  );
  assert.deepStrictEqual(Object.keys(await readCoverageMap(forward.outputPath)).sort(), [
    path.join(captured.root, IDLE_PATH),
    path.join(captured.root, PAIR_PATH),
  ]);
});

for (const [workerTest, hits] of Object.entries(pairWorkerHits)) {
  test(`converts the snapshot of ${workerTest} alone to that worker's counters`, async (t) => {
    // arrange
    const captured = await capturePopulation(t);
    const rawPath = captured.rawByTest[workerTest];
    assert.ok(rawPath);

    // act
    const conversion = await convertSnapshots(t, captured, {
      modules: [PAIR_PATH],
      raw: [rawPath],
    });

    // assert
    assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
    assert.deepStrictEqual(
      await projectedFile(conversion.outputPath, captured.root, PAIR_PATH),
      pairCoverage(hits),
    );
  });
}

test("gives a module the run never loaded the producer's complete zero-execution model", async (t) => {
  // arrange
  const captured = await capturePopulation(t);

  // act
  const conversion = await convertSnapshots(t, captured, { modules: [UNIMPORTED_PATH], raw: [] });

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(
    await projectedFile(conversion.outputPath, captured.root, UNIMPORTED_PATH),
    unimportedCoverage(),
  );
});

test("gives a type-only module an empty record and nothing else", async (t) => {
  // arrange
  const captured = await capturePopulation(t);
  const typesPath = path.join(captured.root, TYPES_PATH);

  // act
  const conversion = await convertSnapshots(t, captured, { modules: [TYPES_PATH], raw: [] });

  // assert
  assert.strictEqual(conversion.run.status, 0, conversion.run.stderr);
  assert.deepStrictEqual(await readCoverageMap(conversion.outputPath), {
    [typesPath]: {
      path: typesPath,
      statementMap: {},
      fnMap: {},
      branchMap: {},
      s: {},
      f: {},
      b: {},
    },
  });
});

for (const { name, request, row } of [
  {
    name: "a snapshot listed twice",
    request: (captured: PopulationRun) => ({
      modules: [PAIR_PATH],
      raw: [captured.raw[0] ?? "", captured.raw[0] ?? ""],
    }),
    row: (captured: PopulationRun) => ({
      kind: "duplicate-snapshot",
      path: path.relative(captured.root, captured.raw[0] ?? ""),
    }),
  },
  {
    name: "a snapshot the run did not record",
    request: (captured: PopulationRun) => ({
      modules: [PAIR_PATH],
      raw: [path.join(captured.runDirectory, "raw", "coverage-1-1700000000000-0.json")],
    }),
    row: (captured: PopulationRun) => ({
      kind: "unknown-snapshot",
      path: path.join(captured.runDirectory, "raw", "coverage-1-1700000000000-0.json"),
    }),
  },
  {
    name: "a loaded module no snapshot carries",
    request: (captured: PopulationRun) => ({
      modules: [IDLE_PATH],
      raw: [captured.rawByTest["tests/domain/pair-first.test.ts"] ?? ""],
    }),
    row: () => ({ kind: "unobserved-module", path: IDLE_PATH }),
  },
  {
    name: "a module the run did not record",
    request: () => ({
      modules: ["extensions/pi-claude-marketplace/domain/absent.ts"],
      raw: [],
    }),
    row: () => ({
      kind: "module-not-captured",
      path: "extensions/pi-claude-marketplace/domain/absent.ts",
    }),
  },
]) {
  test(`refuses ${name} and writes nothing`, async (t) => {
    // arrange
    const captured = await capturePopulation(t);

    // act
    const conversion = await convertSnapshots(t, captured, request(captured));

    // assert
    assert.deepStrictEqual(
      { status: conversion.run.status, rows: refusalRows(conversion.run.stderr) },
      { status: 1, rows: [row(captured)] },
    );
    await assert.rejects(readFile(conversion.outputPath));
  });
}

test("refuses a snapshot whose bytes changed after the capture", async (t) => {
  // arrange
  const captured = await capturePopulation(t);
  const [rawPath] = captured.raw;
  assert.ok(rawPath);
  await appendFile(rawPath, "\n");

  // act
  const conversion = await convertSnapshots(t, captured, {
    modules: [PAIR_PATH],
    raw: [rawPath],
  });

  // assert
  assert.deepStrictEqual(
    { status: conversion.run.status, rows: refusalRows(conversion.run.stderr) },
    { status: 1, rows: [{ kind: "stale-snapshot", path: path.relative(captured.root, rawPath) }] },
  );
});
