import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TestContext } from "node:test";

// The capture is a `.mjs` command-line tool, so these cases drive it the way
// `npm run coverage:capture` does: as a child process with an argv array and no
// shell, against an isolated fixture root laid out like the repository. The
// ordinary native runner is the oracle for equivalence (D-01, D-04); the
// fixture's own line/function counts are written here by hand.

const cliPath = fileURLToPath(new URL("../../scripts/coverage-capture.mjs", import.meta.url));
const runtimeUrl = new URL("../../scripts/coverage-capture.runtime.mjs", import.meta.url).href;
const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));

const unitTestPatterns = [
  "tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts",
  "tests/index.test.ts",
];

const indexSourcePath = "extensions/pi-claude-marketplace/index.ts";
const paritySourcePath = "extensions/pi-claude-marketplace/domain/parity.ts";

// Every line of `greet` executes: both branches run.
const indexSource = `export function greet(name: string): string {
  if (name === "") {
    return "hello";
  }

  return \`hello \${name}\`;
}
`;

// Only the even path runs: lines 3-4 (the odd block) and 10-11 (`unused`) stay
// uncovered, so LH is 7 of 11 and FNH is 1 of 2.
const paritySource = `export function parity(n: number): "even" | "odd" {
  if (n % 2 === 1) {
    return "odd";
  }

  return "even";
}

export function unused(): number {
  return 1;
}
`;

const indexTest = `import assert from "node:assert/strict";
import test from "node:test";

import { greet } from "../extensions/pi-claude-marketplace/index.ts";

test("greets the empty name", () => {
  assert.equal(greet(""), "hello");
});

test("greets a name", () => {
  assert.equal(greet("pi"), "hello pi");
});
`;

const parityTest = `import assert from "node:assert/strict";
import test from "node:test";

import { parity } from "../../extensions/pi-claude-marketplace/domain/parity.ts";

test("classifies an even number", () => {
  assert.equal(parity(2), "even");
});
`;

const fixturePackageJson = `${JSON.stringify({ name: "fixture", type: "module" }, undefined, 2)}\n`;

interface LcovCounts {
  readonly branches: { readonly found: number; readonly hit: number };
  readonly functions: { readonly found: number; readonly hit: number };
  readonly lines: { readonly found: number; readonly hit: number };
}

interface SpecSummary {
  readonly pass: number;
  readonly fail: number;
}

interface CaptureFailure {
  readonly kind: string;
  readonly path?: string;
  readonly format?: string;
  readonly test?: string;
  readonly status?: number;
  readonly expected?: string;
  readonly actual?: string;
  readonly stage?: string;
  readonly added?: readonly string[];
  readonly removed?: readonly string[];
  readonly changed?: readonly string[];
}

interface WorkerRecord {
  readonly test: string;
  readonly pid: number;
  readonly exitCode: number | null;
  readonly raw: readonly string[];
}

interface NestedRecord {
  readonly pid: number;
  readonly completed: boolean;
  readonly raw: readonly string[];
}

interface ModuleRecord {
  readonly path: string;
  readonly format: string;
  readonly source: string;
  readonly executed: string;
}

interface RawRecord {
  readonly file: string;
  readonly pid: number;
  readonly digest: string;
}

interface CaptureManifest {
  readonly schemaVersion: number;
  readonly runId: string;
  readonly status: string;
  readonly state: string;
  readonly failures: readonly CaptureFailure[];
  readonly runtime: { readonly node: string };
  readonly selection: { readonly patterns: readonly string[]; readonly tests: readonly string[] };
  readonly invocation: {
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    readonly digest: string;
  };
  readonly workers: readonly WorkerRecord[];
  readonly nested: readonly NestedRecord[];
  readonly modules: readonly ModuleRecord[];
  readonly raw: readonly RawRecord[];
  readonly artifacts: { readonly lcov: { readonly path: string; readonly digest: string } };
  readonly outcome: { readonly status: number | null } | null;
  readonly inventory: {
    readonly path: string;
    readonly digest: string;
    readonly counts: Readonly<Record<string, number>>;
  };
}

interface ProcessRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface V8ScriptCoverage {
  readonly url: string;
}

interface V8CoverageFile {
  readonly result: readonly V8ScriptCoverage[];
}

function unitFixture(): Record<string, string> {
  return {
    "package.json": fixturePackageJson,
    [indexSourcePath]: indexSource,
    [paritySourcePath]: paritySource,
    "tests/index.test.ts": indexTest,
    "tests/domain/parity.test.ts": parityTest,
  };
}

async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "coverage-capture-"));

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

// The outer runner marks its workers with NODE_TEST_CONTEXT, and a nested
// `node --test` that inherits the mark skips every file with a warning and exit
// status 0. The native reference must therefore shed it; the capture sheds it
// itself.
function outerEnvironment(): Record<string, string | undefined> {
  const { NODE_TEST_CONTEXT: _context, NODE_TEST_WORKER_ID: _worker, ...rest } = process.env;
  return rest;
}

interface CaptureOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly args?: readonly string[];
  readonly nodeArgs?: readonly string[];
}

function runCapture(root: string, options: CaptureOptions = {}): ProcessRun {
  const completed = spawnSync(
    process.execPath,
    [...(options.nodeArgs ?? []), cliPath, "--root", root, ...(options.args ?? [])],
    { encoding: "utf8", env: { ...process.env, ...options.env } },
  );
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

// The ordinary native runner, written here from the package scripts rather
// than taken from the capture, so the comparison has an independent side.
async function runNative(t: TestContext, root: string): Promise<{ run: ProcessRun; lcov: string }> {
  const scratch = await mkdtemp(path.join(tmpdir(), "coverage-native-"));

  t.after(async () => {
    await rm(scratch, { force: true, recursive: true });
  });

  const lcovPath = path.join(scratch, "unit.lcov");
  const completed = spawnSync(
    process.execPath,
    [
      "--test",
      "--experimental-test-coverage",
      "--test-coverage-include=extensions/**",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      "--test-reporter=lcov",
      `--test-reporter-destination=${lcovPath}`,
      ...unitTestPatterns,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...outerEnvironment(),
        NODE_DISABLE_COMPILE_CACHE: "1",
        NODE_V8_COVERAGE: path.join(scratch, "raw"),
      },
    },
  );

  return {
    run: { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr },
    lcov: await readFile(lcovPath, "utf8"),
  };
}

function lcovCounts(lcovText: string): Map<string, LcovCounts> {
  const counts = new Map<string, LcovCounts>();

  for (const record of lcovText.split("end_of_record")) {
    const fields = new Map<string, number>();
    let sourcePath: string | undefined;

    for (const line of record.split("\n")) {
      const separator = line.indexOf(":");
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);

      if (key === "SF") {
        sourcePath = value;
      } else if (["BRF", "BRH", "FNF", "FNH", "LF", "LH"].includes(key)) {
        fields.set(key, Number(value));
      }
    }

    if (sourcePath !== undefined) {
      counts.set(sourcePath, {
        branches: { found: fields.get("BRF") ?? -1, hit: fields.get("BRH") ?? -1 },
        functions: { found: fields.get("FNF") ?? -1, hit: fields.get("FNH") ?? -1 },
        lines: { found: fields.get("LF") ?? -1, hit: fields.get("LH") ?? -1 },
      });
    }
  }

  return counts;
}

function specSummary(stdout: string): SpecSummary {
  const count = (label: string): number => {
    const match = new RegExp(`^ℹ ${label} (\\d+)$`, "m").exec(stdout);
    return match === null ? -1 : Number(match[1]);
  };

  return { pass: count("pass"), fail: count("fail") };
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readManifest(manifestPath: string): Promise<CaptureManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as CaptureManifest;
}

function failureKinds(manifest: CaptureManifest): string[] {
  return manifest.failures.map((failure) => failure.kind).sort();
}

// A refused run publishes no pointer, so its manifest is read from the one run
// directory the capture created.
async function onlyRunManifest(root: string): Promise<CaptureManifest> {
  const runs = await readdir(path.join(root, "coverage", "runs"));
  assert.strictEqual(runs.length, 1);
  return readManifest(path.join(root, "coverage", "runs", runs[0] ?? "", "manifest.json"));
}

test("captures LCOV, raw V8 and executed sources from one native unit run that matches ordinary execution", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const native = await runNative(t, root);
  const expectedProductionCounts = new Map<
    string,
    { lines: LcovCounts["lines"]; functions: LcovCounts["functions"] }
  >([
    [indexSourcePath, { lines: { found: 7, hit: 7 }, functions: { found: 1, hit: 1 } }],
    [paritySourcePath, { lines: { found: 11, hit: 7 }, functions: { found: 2, hit: 1 } }],
  ]);
  const parityUrl = pathToFileURL(path.join(root, paritySourcePath)).href;
  const expectedExecuted = stripTypeScriptTypes(paritySource, {
    mode: "strip",
    sourceUrl: parityUrl,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 0, capture.stderr);
  assert.deepStrictEqual(specSummary(capture.stdout), { pass: 3, fail: 0 });
  assert.deepStrictEqual(specSummary(capture.stdout), specSummary(native.run.stdout));
  const manifestPath = path.join(root, "coverage", "unit.manifest.json");
  const manifest = await readManifest(manifestPath);
  const runDirectory = path.join(root, "coverage", "runs", manifest.runId);
  assert.strictEqual(manifest.status, "captured");
  assert.strictEqual(manifest.state, "captured");
  assert.deepStrictEqual(manifest.failures, []);
  assert.strictEqual(manifest.runtime.node, process.version);
  assert.strictEqual(
    await readFile(path.join(runDirectory, "manifest.json"), "utf8"),
    await readFile(manifestPath, "utf8"),
  );
  const publicLcov = await readFile(path.join(root, "coverage", "unit.lcov"), "utf8");
  assert.strictEqual(manifest.artifacts.lcov.path, `coverage/runs/${manifest.runId}/unit.lcov`);
  assert.strictEqual(
    await readFile(path.join(root, manifest.artifacts.lcov.path), "utf8"),
    publicLcov,
  );
  assert.strictEqual(manifest.artifacts.lcov.digest, sha256(publicLcov));
  const capturedCounts = lcovCounts(publicLcov);
  assert.deepStrictEqual(capturedCounts, lcovCounts(native.lcov));
  assert.deepStrictEqual(
    new Map(
      [...capturedCounts].map(([sourcePath, counts]) => [
        sourcePath,
        { lines: counts.lines, functions: counts.functions },
      ]),
    ),
    expectedProductionCounts,
  );
  const parityRecord = manifest.modules.find((record) => record.path === paritySourcePath);
  assert.deepStrictEqual(parityRecord, {
    path: paritySourcePath,
    format: "module-typescript",
    source: sha256(paritySource),
    executed: sha256(expectedExecuted),
  });
  assert.strictEqual(
    await readFile(path.join(runDirectory, "sources", sha256(paritySource)), "utf8"),
    paritySource,
  );
  assert.strictEqual(
    await readFile(path.join(runDirectory, "executed", sha256(expectedExecuted)), "utf8"),
    expectedExecuted,
  );
  const rawFiles = (await readdir(path.join(runDirectory, "raw"))).sort();
  assert.deepStrictEqual(manifest.raw.map((record) => record.file).sort(), rawFiles);
  const rawUrls = new Set<string>();

  for (const rawFile of rawFiles) {
    const rawText = await readFile(path.join(runDirectory, "raw", rawFile), "utf8");
    const rawRecord = manifest.raw.find((record) => record.file === rawFile);
    assert.strictEqual(rawRecord?.digest, sha256(rawText));

    for (const script of (JSON.parse(rawText) as V8CoverageFile).result) {
      rawUrls.add(script.url);
    }
  }

  assert.ok(rawUrls.has(parityUrl), `raw V8 lacks ${parityUrl}`);
});

test("refuses an in-project module whose format is not natively strippable ESM", async (t) => {
  // arrange
  const legacyPath = "extensions/pi-claude-marketplace/legacy.cjs";
  const root = await createRoot(t, {
    ...unitFixture(),
    [legacyPath]: "module.exports = { legacy: true };\n",
    "tests/shared/legacy.test.ts": `import test from "node:test";

import legacy from "../../extensions/pi-claude-marketplace/legacy.cjs";

test("loads", () => {
  void legacy;
});
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  assert.strictEqual(existsSync(path.join(root, "coverage", "unit.manifest.json")), false);
  const manifest = await onlyRunManifest(root);
  assert.strictEqual(manifest.status, "failed");
  assert.deepStrictEqual(failureKinds(manifest), ["tests-failed", "unsupported-format"]);
  const refusal = manifest.failures.find((failure) => failure.kind === "unsupported-format");
  assert.deepStrictEqual(refusal, {
    kind: "unsupported-format",
    path: legacyPath,
    format: "commonjs",
  });
});

for (const { label, options, flag } of [
  {
    label: "a foreign --import in NODE_OPTIONS",
    options: { env: { NODE_OPTIONS: "--import=data:text/javascript," } },
    flag: "--import=data:text/javascript,",
  },
  {
    label: "a --require preload on the capture process",
    options: { nodeArgs: ["--require", "/dev/null"] },
    flag: "--require",
  },
]) {
  test(`refuses ${label} before running anything`, async (t) => {
    // arrange
    const root = await createRoot(t, unitFixture());

    // act
    const capture = runCapture(root, options);

    // assert
    assert.strictEqual(capture.status, 1);
    assert.ok(capture.stderr.includes(flag), capture.stderr);
    assert.strictEqual(existsSync(path.join(root, "coverage")), false);
  });
}

test("loads the capture runtime through NODE_OPTIONS so every worker inherits it", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = JSON.parse(
    await readFile(path.join(root, "coverage", "unit.manifest.json"), "utf8"),
  ) as { invocation: { env: Readonly<Record<string, string>> } };
  assert.strictEqual(manifest.invocation.env.NODE_OPTIONS, `--import=${runtimeUrl}`);
  assert.strictEqual(manifest.invocation.env.NODE_DISABLE_COMPILE_CACHE, "1");
});

test("registers coverage:capture as a package script", async () => {
  // arrange
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts: Readonly<Record<string, string>>;
  };

  // act
  const script = packageJson.scripts["coverage:capture"];

  // assert
  assert.strictEqual(script, "node scripts/coverage-capture.mjs");
});

test("selects exactly the population npm test names, one worker per file", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts: Readonly<Record<string, string>>;
  };
  const expectedPatterns = [...(packageJson.scripts.test ?? "").matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1],
  );
  const expectedTests = ["tests/domain/parity.test.ts", "tests/index.test.ts"];

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
  assert.deepStrictEqual(manifest.selection, { patterns: expectedPatterns, tests: expectedTests });
  assert.deepStrictEqual(
    manifest.workers.map((worker) => [worker.test, worker.exitCode, worker.raw.length]),
    expectedTests.map((test) => [test, 0, 1]),
  );
  assert.deepStrictEqual(manifest.nested, []);
});

test("inventories every production, test and resource input with its digest before execution", async (t) => {
  // arrange
  const files = unitFixture();
  const root = await createRoot(t, files);
  const entry = (
    filePath: string,
    group: string,
  ): { path: string; group: string; digest: string; size: number } => ({
    path: filePath,
    group,
    digest: sha256(files[filePath] ?? ""),
    size: Buffer.byteLength(files[filePath] ?? ""),
  });
  const expectedInventory = [
    entry(paritySourcePath, "production"),
    entry(indexSourcePath, "production"),
    entry("package.json", "resources"),
    entry("tests/domain/parity.test.ts", "tests"),
    entry("tests/index.test.ts", "tests"),
  ];

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
  const runDirectory = path.join(root, "coverage", "runs", manifest.runId);
  const inventoryText = await readFile(path.join(runDirectory, "inventory.json"), "utf8");
  assert.deepStrictEqual(JSON.parse(inventoryText), expectedInventory);
  assert.deepStrictEqual(manifest.inventory, {
    path: `coverage/runs/${manifest.runId}/inventory.json`,
    digest: sha256(inventoryText),
    counts: { production: 2, resources: 1, tests: 2 },
  });
  assert.strictEqual(
    await readFile(path.join(runDirectory, "inventory", sha256(paritySource)), "utf8"),
    paritySource,
  );
});

for (const { concurrency, flags } of [
  { concurrency: "2", flags: ["--test-concurrency=2"] },
  { concurrency: "", flags: [] },
]) {
  test(`records the native runner invocation with TEST_CONCURRENCY=${JSON.stringify(concurrency)}`, async (t) => {
    // arrange
    const root = await createRoot(t, unitFixture());

    // act
    const capture = runCapture(root, { env: { TEST_CONCURRENCY: concurrency } });

    // assert
    assert.strictEqual(capture.status, 0, capture.stderr);
    const manifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
    assert.deepStrictEqual(manifest.invocation.argv, [
      "--test",
      ...flags,
      "--experimental-test-coverage",
      "--test-coverage-include=extensions/**",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      "--test-reporter=lcov",
      `--test-reporter-destination=coverage/runs/${manifest.runId}/unit.lcov`,
      ...unitTestPatterns,
    ]);
    assert.strictEqual(
      manifest.invocation.env.NODE_V8_COVERAGE,
      `coverage/runs/${manifest.runId}/raw`,
    );
    assert.strictEqual(manifest.invocation.cwd, ".");
    assert.match(manifest.invocation.digest, /^[0-9a-f]{64}$/u);
  });
}

test("rejects a failing test population and removes the previous public success", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const first = runCapture(root);
  assert.strictEqual(first.status, 0, first.stderr);
  await mkdir(path.join(root, "tests/shared"), { recursive: true });
  await writeFile(
    path.join(root, "tests/shared/failing.test.ts"),
    `import assert from "node:assert/strict";
import test from "node:test";

test("fails", () => {
  assert.equal(1, 2);
});
`,
  );

  // act
  const second = runCapture(root);

  // assert
  assert.strictEqual(second.status, 1);
  assert.strictEqual(existsSync(path.join(root, "coverage", "unit.manifest.json")), false);
  assert.strictEqual(existsSync(path.join(root, "coverage", "unit.lcov")), false);
  const runs = (await readdir(path.join(root, "coverage", "runs"))).sort();
  assert.strictEqual(runs.length, 2);
  const failed = await readManifest(
    path.join(root, "coverage", "runs", runs[1] ?? "", "manifest.json"),
  );
  assert.strictEqual(failed.status, "failed");
  assert.deepStrictEqual(failed.failures, [{ kind: "tests-failed", status: 1 }]);
  assert.strictEqual(failed.workers.length, 3);
  assert.strictEqual(
    (await readdir(path.join(root, "coverage", "runs", runs[1] ?? "", "raw"))).length,
    3,
  );
});

// A process that signals itself still flushes its own coverage before dying;
// only an external SIGKILL leaves the worker without an exit record and
// without a raw file, so the fixture has a child kill its parent.
test("rejects a worker that dies by signal as interrupted and uncaptured", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...unitFixture(),
    "tests/shared/killed.test.ts": `import { spawnSync } from "node:child_process";

spawnSync(process.execPath, ["-e", 'process.kill(process.ppid, "SIGKILL");']);
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  const manifest = await onlyRunManifest(root);
  assert.deepStrictEqual(failureKinds(manifest), [
    "interrupted-worker",
    "missing-capture",
    "tests-failed",
  ]);
  assert.deepStrictEqual(
    manifest.failures
      .filter((failure) => failure.kind !== "tests-failed")
      .map((failure) => failure.test),
    ["tests/shared/killed.test.ts", "tests/shared/killed.test.ts"],
  );
});

test("rejects an empty production inventory before running any test", async (t) => {
  // arrange
  const {
    [indexSourcePath]: _index,
    [paritySourcePath]: _parity,
    ...withoutProduction
  } = unitFixture();
  const root = await createRoot(t, withoutProduction);

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  const manifest = await onlyRunManifest(root);
  assert.deepStrictEqual(manifest.failures, [{ kind: "empty-production-inventory" }]);
  assert.deepStrictEqual(manifest.workers, []);
  assert.strictEqual(manifest.outcome, null);
});

test("rejects a loaded module the inventory does not list", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...unitFixture(),
    "outside.ts": "export const outside = 1;\n",
    "tests/shared/outside.test.ts": `import test from "node:test";

import { outside } from "../../outside.ts";

test("loads a module outside the inventory", () => {
  void outside;
});
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  const manifest = await onlyRunManifest(root);
  assert.deepStrictEqual(manifest.failures, [{ kind: "unlisted-module", path: "outside.ts" }]);
});

test("records nested subprocesses under the run and keeps a child's override out of it", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...unitFixture(),
    "tests/shared/nested.test.ts": `import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("spawns an inheriting child and an overriding child", () => {
  const override = path.join(process.cwd(), "override-run");
  mkdirSync(override, { recursive: true });
  const inheriting = spawnSync(process.execPath, ["-e", "process.exitCode = 0;"], { encoding: "utf8" });
  const overriding = spawnSync(process.execPath, ["-e", "process.exitCode = 0;"], {
    encoding: "utf8",
    env: { ...process.env, NODE_V8_COVERAGE: path.join(override, "raw"), PI_CM_COVERAGE_RUN_DIR: override },
  });

  if (inheriting.status !== 0 || overriding.status !== 0) {
    throw new Error(inheriting.stderr + overriding.stderr);
  }
});
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 0, capture.stderr);
  const manifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
  assert.deepStrictEqual(
    manifest.nested.map((nested) => [nested.completed, nested.raw.length]),
    [[true, 1]],
  );
  const overrideWorkers = (await readdir(path.join(root, "override-run", "workers"))).filter(
    (name) => name.endsWith(".start.json"),
  );
  assert.strictEqual(overrideWorkers.length, 1);
  assert.strictEqual((await readdir(path.join(root, "override-run", "raw"))).length, 1);
});

test("rejects a raw capture from a process the run never registered", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...unitFixture(),
    "tests/shared/unregistered.test.ts": `import { spawnSync } from "node:child_process";
import test from "node:test";

test("spawns a child without the capture runtime", () => {
  const child = spawnSync(process.execPath, ["-e", "process.exitCode = 0;"], {
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
  });

  if (child.status !== 0) {
    throw new Error(child.stderr);
  }
});
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  const manifest = await onlyRunManifest(root);
  assert.deepStrictEqual(failureKinds(manifest), ["unregistered-capture"]);
});

const mutableSourcePath = "extensions/pi-claude-marketplace/shared/mutable.ts";
const mutableSource = "export const mutable = 1;\n";

test("rejects a module whose loaded bytes differ from the pre-run inventory even after it is restored", async (t) => {
  // arrange
  const root = await createRoot(t, {
    ...unitFixture(),
    [mutableSourcePath]: mutableSource,
    "tests/shared/mutable.test.ts": `import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

const target = new URL("../../extensions/pi-claude-marketplace/shared/mutable.ts", import.meta.url);
const original = readFileSync(target, "utf8");
writeFileSync(target, \`\${original}// edited while loading\\n\`);
const loaded = await import("../../extensions/pi-claude-marketplace/shared/mutable.ts");
writeFileSync(target, original);

test("restores the module after loading it", () => {
  if (loaded.mutable !== 1) {
    throw new Error("mutable changed");
  }
});
`,
  });

  // act
  const capture = runCapture(root);

  // assert
  assert.strictEqual(capture.status, 1);
  const manifest = await onlyRunManifest(root);
  assert.deepStrictEqual(manifest.failures, [
    {
      kind: "loaded-bytes-differ",
      path: mutableSourcePath,
      expected: sha256(mutableSource),
      actual: sha256(`${mutableSource}// edited while loading\n`),
    },
  ]);
});

const removableSourcePath = "extensions/pi-claude-marketplace/shared/removable.ts";
const addedSourcePath = "extensions/pi-claude-marketplace/shared/added.ts";

for (const { kind, mutation, difference } of [
  {
    kind: "added",
    mutation: `writeFileSync(new URL("../../${addedSourcePath}", import.meta.url), "export const added = 1;\\n");`,
    difference: { added: [addedSourcePath], removed: [], changed: [] },
  },
  {
    kind: "removed",
    mutation: `unlinkSync(new URL("../../${removableSourcePath}", import.meta.url));`,
    difference: { added: [], removed: [removableSourcePath], changed: [] },
  },
  {
    kind: "changed",
    mutation: `appendFileSync(new URL("../../${removableSourcePath}", import.meta.url), "// changed\\n");`,
    difference: { added: [], removed: [], changed: [removableSourcePath] },
  },
]) {
  test(`rejects a production source ${kind} during execution as drift`, async (t) => {
    // arrange
    const root = await createRoot(t, {
      ...unitFixture(),
      [removableSourcePath]: "export const removable = 1;\n",
      "tests/shared/drift.test.ts": `import { appendFileSync, unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";

${mutation}

test("mutated the tree", () => {
  void [appendFileSync, unlinkSync, writeFileSync];
});
`,
    });

    // act
    const capture = runCapture(root);

    // assert
    assert.strictEqual(capture.status, 1);
    const manifest = await onlyRunManifest(root);
    assert.deepStrictEqual(manifest.failures, [
      { kind: "drift", stage: "after-execution", ...difference },
    ]);
  });
}

test("verifies a published bundle on readback and refuses it once a source changes", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const capture = runCapture(root);
  assert.strictEqual(capture.status, 0, capture.stderr);

  // act
  const verified = runCapture(root, { args: ["--verify"] });
  await appendFile(path.join(root, paritySourcePath), "// edited after capture\n");
  const stale = runCapture(root, { args: ["--verify"] });

  // assert
  assert.strictEqual(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /^Coverage capture verified: /u);
  assert.strictEqual(stale.status, 1);
  assert.match(stale.stderr, /"kind": "stale-input"/u);
  assert.match(stale.stderr, new RegExp(paritySourcePath, "u"));
});

// The tooling identity is read next to the scripts, so a copied tool set
// describes itself; changing one copied file after the capture is a tool
// change the readback must refuse.
test("refuses a bundle on readback when the capture tooling changed", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const tools = await mkdtemp(path.join(tmpdir(), "coverage-tools-"));

  t.after(async () => {
    await rm(tools, { force: true, recursive: true });
  });

  for (const name of [
    "coverage-capture.mjs",
    "coverage-capture.manifest.mjs",
    "coverage-capture.runtime.mjs",
  ]) {
    await copyFile(
      fileURLToPath(new URL(`../../scripts/${name}`, import.meta.url)),
      path.join(tools, name),
    );
  }

  const env = {
    ...outerEnvironment(),
    NODE_OPTIONS: "",
    NODE_V8_COVERAGE: path.join(tools, "raw"),
  };
  const runTools = (args: readonly string[]): ProcessRun => {
    const completed = spawnSync(
      process.execPath,
      [path.join(tools, "coverage-capture.mjs"), "--root", root, ...args],
      { encoding: "utf8", env },
    );
    return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
  };

  const capture = runTools([]);
  assert.strictEqual(capture.status, 0, capture.stderr);

  // act
  const verified = runTools(["--verify"]);
  await appendFile(path.join(tools, "coverage-capture.runtime.mjs"), "// changed\n");
  const changed = runTools(["--verify"]);

  // assert
  assert.strictEqual(verified.status, 0, verified.stderr);
  assert.strictEqual(changed.status, 1);
  assert.match(changed.stderr, /"kind": "tool-changed"/u);
});

async function writeBothManifests(root: string, manifest: CaptureManifest): Promise<void> {
  const text = `${JSON.stringify(manifest, undefined, 2)}\n`;
  await writeFile(path.join(root, "coverage", "unit.manifest.json"), text);
  await writeFile(path.join(root, "coverage", "runs", manifest.runId, "manifest.json"), text);
}

const readbackTampers: ReadonlyArray<{
  readonly label: string;
  readonly kind: string;
  readonly tamper: (root: string, manifest: CaptureManifest) => Promise<void>;
}> = [
  {
    label: "the public pointer is missing",
    kind: "missing-manifest",
    tamper: (root) => rm(path.join(root, "coverage", "unit.manifest.json")),
  },
  {
    label: "the public LCOV is missing",
    kind: "missing-artifact",
    tamper: (root) => rm(path.join(root, "coverage", "unit.lcov")),
  },
  {
    label: "a raw record is missing",
    kind: "missing-artifact",
    tamper: (root, manifest) =>
      rm(path.join(root, "coverage", "runs", manifest.runId, "raw", manifest.raw[0]?.file ?? "")),
  },
  {
    label: "a recorded executed-source capture is missing",
    kind: "missing-artifact",
    tamper: (root, manifest) =>
      rm(
        path.join(
          root,
          "coverage",
          "runs",
          manifest.runId,
          "executed",
          manifest.modules[0]?.executed ?? "",
        ),
      ),
  },
  {
    label: "the public LCOV is swapped for another report",
    kind: "artifact-digest",
    tamper: (root) =>
      writeFile(
        path.join(root, "coverage", "unit.lcov"),
        "TN:\nSF:tests/integration/end-to-end.test.ts\nend_of_record\n",
      ),
  },
  {
    label: "the manifest schema version is unknown",
    kind: "unsupported-version",
    tamper: (root, manifest) => writeBothManifests(root, { ...manifest, schemaVersion: 0 }),
  },
  {
    label: "the manifest names a path outside the run",
    kind: "foreign-path",
    tamper: (root, manifest) =>
      writeBothManifests(root, {
        ...manifest,
        artifacts: { lcov: { ...manifest.artifacts.lcov, path: "../escape/unit.lcov" } },
      }),
  },
  {
    label: "the pointer and the run manifest disagree",
    kind: "manifest-mismatch",
    tamper: (root, manifest) =>
      writeFile(
        path.join(root, "coverage", "unit.manifest.json"),
        JSON.stringify({ ...manifest, completedAt: "1970-01-01T00:00:00.000Z" }),
      ),
  },
  {
    label: "the recorded runtime differs",
    kind: "runtime-changed",
    tamper: (root, manifest) =>
      writeBothManifests(root, { ...manifest, runtime: { ...manifest.runtime, node: "v0.0.0" } }),
  },
  {
    label: "a module is recorded twice",
    kind: "duplicate-record",
    tamper: (root, manifest) =>
      writeBothManifests(root, {
        ...manifest,
        modules: [...manifest.modules, ...manifest.modules.slice(0, 1)],
      }),
  },
  {
    label: "the run was not captured",
    kind: "not-captured",
    tamper: (root, manifest) => writeBothManifests(root, { ...manifest, status: "failed" }),
  },
];

for (const { label, kind, tamper } of readbackTampers) {
  test(`refuses a bundle on readback when ${label}`, async (t) => {
    // arrange
    const root = await createRoot(t, unitFixture());
    const capture = runCapture(root);
    assert.strictEqual(capture.status, 0, capture.stderr);
    await tamper(root, await readManifest(path.join(root, "coverage", "unit.manifest.json")));

    // act
    const verify = runCapture(root, { args: ["--verify"] });

    // assert
    assert.strictEqual(verify.status, 1);
    assert.match(verify.stderr, new RegExp(`"kind": "${kind}"`, "u"));
  });
}

test("starting a replacement run removes only the previous public pointer and report", async (t) => {
  // arrange
  const root = await createRoot(t, unitFixture());
  const first = runCapture(root);
  assert.strictEqual(first.status, 0, first.stderr);
  const firstManifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
  await writeFile(path.join(root, "coverage", "integration.lcov"), "TN:\nend_of_record\n");
  await writeFile(path.join(root, "coverage", "notes.txt"), "keep\n");

  // act
  const second = runCapture(root);

  // assert
  assert.strictEqual(second.status, 0, second.stderr);
  const secondManifest = await readManifest(path.join(root, "coverage", "unit.manifest.json"));
  assert.deepStrictEqual(
    (await readdir(path.join(root, "coverage", "runs"))).sort(),
    [firstManifest.runId, secondManifest.runId].sort(),
  );
  assert.strictEqual(
    (await readManifest(path.join(root, "coverage", "runs", firstManifest.runId, "manifest.json")))
      .status,
    "captured",
  );
  assert.strictEqual(
    await readFile(path.join(root, "coverage", "integration.lcov"), "utf8"),
    "TN:\nend_of_record\n",
  );
  assert.strictEqual(await readFile(path.join(root, "coverage", "notes.txt"), "utf8"), "keep\n");
});
