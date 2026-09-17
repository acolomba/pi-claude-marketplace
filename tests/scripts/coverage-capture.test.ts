import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
  readonly modules: readonly ModuleRecord[];
  readonly raw: readonly RawRecord[];
  readonly artifacts: { readonly lcov: { readonly path: string; readonly digest: string } };
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
  const runs = await readdir(path.join(root, "coverage", "runs"));
  assert.strictEqual(runs.length, 1);
  const manifest = await readManifest(
    path.join(root, "coverage", "runs", runs[0] ?? "", "manifest.json"),
  );
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
