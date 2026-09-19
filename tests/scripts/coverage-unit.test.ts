import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { tallyFixture } from "./coverage-producer-fixtures.ts";
import { expectedCoverage, projectCoverage } from "./coverage-projection.ts";
import {
  captureCliPath,
  createRoot,
  fixtureFiles,
  readJson,
  refusalRows,
  run,
} from "./coverage-run-support.ts";
import {
  populationFiles,
  populationSources,
  TYPES_PATH,
  UNIMPORTED_PATH,
  unimportedCoverage,
} from "./coverage-unit-fixtures.ts";

import type { ProducerFixture } from "./coverage-producer-fixtures.ts";
import type {
  FailureRow,
  IstanbulCoverageMap,
  IstanbulFileCoverage,
  ProcessRun,
} from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// `coverage:unit:verified` is a `.mjs` command-line tool, so these cases
// drive it the way `npm run coverage:unit:verified` does: as a child process
// against an isolated fixture root laid out like the repository. One native
// unit run must yield the LCOV unchanged, a validated Istanbul map and one
// accepted manifest that binds both; the consumer readback
// (`coverage:validate` with no arguments) must accept exactly that bundle and
// refuse it once any part is missing, changed or replaced (D-01, D-02, D-04,
// D-10). Every expectation is written here from the fixture's source text.

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const unitCliPath = fileURLToPath(new URL("coverage-unit.mjs", scriptsUrl));
const validateCliPath = fileURLToPath(new URL("coverage-validate.mjs", scriptsUrl));

const PUBLIC = {
  lcov: "coverage/unit.lcov",
  istanbul: "coverage/unit.istanbul.json",
  validation: "coverage/unit.validation.json",
  manifest: "coverage/unit.manifest.json",
} as const;

interface Digested {
  readonly path: string;
  readonly digest: string;
}

interface AcceptedManifest {
  readonly runId: string;
  readonly status: string;
  readonly state: string;
  readonly artifacts: { readonly lcov: Digested };
  readonly acceptance: {
    readonly captured: Digested;
    readonly artifacts: { readonly istanbul: Digested };
    readonly validation: Digested;
    readonly producer: Digested;
  };
}

interface RunManifest {
  readonly status: string;
  readonly failures: readonly FailureRow[];
}

interface VerifiedRoot {
  readonly root: string;
  readonly runId: string;
  readonly runDirectory: string;
  readonly manifest: AcceptedManifest;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function digestOf(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

function verify(root: string): ProcessRun {
  return run([unitCliPath, "--root", root]);
}

function validate(root: string): ProcessRun {
  return run([validateCliPath, "--root", root]);
}

function verdict(completed: ProcessRun): { status: number; rows: readonly FailureRow[] } {
  return { status: completed.status, rows: refusalRows(completed.stderr) };
}

async function verifiedRoot(t: TestContext, fixture: ProducerFixture): Promise<VerifiedRoot> {
  const root = await createRoot(t, fixtureFiles(fixture));
  const verified = verify(root);
  assert.strictEqual(verified.status, 0, verified.stderr);
  const manifest = await readJson<AcceptedManifest>(path.join(root, PUBLIC.manifest));
  return {
    root,
    runId: manifest.runId,
    runDirectory: path.join(root, "coverage", "runs", manifest.runId),
    manifest,
  };
}

function publicFilesPresent(root: string): Record<string, boolean> {
  const present: Record<string, boolean> = {};

  for (const [name, relativePath] of Object.entries(PUBLIC)) {
    present[name] = existsSync(path.join(root, relativePath));
  }

  return present;
}

// A failing unit test beside the fixture's own, so the native run exits 1.
const failingTest = `import assert from "node:assert/strict";
import test from "node:test";

test("fails on purpose", () => {
  assert.equal(1, 2);
});
`;

// The accepted map republished with `mutate` applied: both copies of the
// map and both copies of the manifest are rewritten so every digest agrees,
// which is the state a consumer that trusted digests alone would accept.
async function republish(
  verified: VerifiedRoot,
  mutate: (map: IstanbulCoverageMap) => IstanbulCoverageMap,
): Promise<void> {
  const runMapPath = path.join(verified.root, verified.manifest.acceptance.artifacts.istanbul.path);
  const map = await readJson<IstanbulCoverageMap>(runMapPath);
  const mutated = `${JSON.stringify(mutate(map), undefined, 2)}\n`;
  await writeFile(runMapPath, mutated);
  await writeFile(path.join(verified.root, PUBLIC.istanbul), mutated);
  const previous = verified.manifest.acceptance.artifacts.istanbul.digest;
  const digest = sha256(Buffer.from(mutated));

  for (const manifestPath of [
    path.join(verified.runDirectory, "accepted.json"),
    path.join(verified.root, PUBLIC.manifest),
  ]) {
    const text = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, text.replace(previous, digest));
  }
}

test("publishes the LCOV unchanged, the validated Istanbul map and an accepted manifest from one native run", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const root = await createRoot(t, fixtureFiles(fixture));

  // act
  const verified = verify(root);

  // assert
  assert.strictEqual(verified.status, 0, verified.stderr);
  const manifest = await readJson<AcceptedManifest>(path.join(root, PUBLIC.manifest));
  assert.strictEqual(
    verified.stdout.split("\n").at(-2),
    `Coverage unit verified: ${manifest.runId}: 1 production file(s), 1 loaded, 0 unloaded (0 type-only, 0 executable); native 3/3 line(s), 1/1 function(s), 2/2 branch(es); syntax 1/1 function(s), 1/1 statement(s), 0/0 branch arm(s) -> ${PUBLIC.manifest}`,
  );
  assert.deepStrictEqual(
    { status: manifest.status, state: manifest.state },
    { status: "captured", state: "accepted" },
  );
  const runDirectory = path.join(root, "coverage", "runs", manifest.runId);
  assert.deepStrictEqual(
    await readFile(path.join(root, PUBLIC.lcov)),
    await readFile(path.join(runDirectory, "unit.lcov")),
  );
  const map = await readJson<IstanbulCoverageMap>(path.join(root, PUBLIC.istanbul));
  const file = map[path.join(root, fixture.sourcePath)];
  assert.ok(file);
  assert.deepStrictEqual(projectCoverage(file), expectedCoverage(fixture));
  assert.deepStrictEqual(
    {
      lcov: manifest.artifacts.lcov.digest,
      istanbul: manifest.acceptance.artifacts.istanbul.digest,
      validation: manifest.acceptance.validation.digest,
      captured: manifest.acceptance.captured.digest,
      producer: manifest.acceptance.producer.digest,
    },
    {
      lcov: await digestOf(path.join(root, PUBLIC.lcov)),
      istanbul: await digestOf(path.join(root, PUBLIC.istanbul)),
      validation: await digestOf(path.join(root, PUBLIC.validation)),
      captured: await digestOf(path.join(runDirectory, "manifest.json")),
      producer: await digestOf(path.join(root, manifest.acceptance.producer.path)),
    },
  );
  assert.deepStrictEqual(
    await readFile(path.join(root, PUBLIC.manifest)),
    await readFile(path.join(runDirectory, "accepted.json")),
  );
});

test("passes the consumer readback of coverage:validate and coverage:capture --verify", async (t) => {
  // arrange
  const { root, runId } = await verifiedRoot(t, tallyFixture());

  // act
  const validation = validate(root);
  const capture = run([captureCliPath, "--verify", "--root", root]);

  // assert
  assert.deepStrictEqual(validation, {
    status: 0,
    stdout: `Coverage bundle verified: ${runId}, 1 file(s), 1 function(s), 1 statement(s), 0 branch(es), schema 1, syntax model 1; manifest ${PUBLIC.manifest}\n`,
    stderr: "",
  });
  assert.deepStrictEqual(capture, {
    status: 0,
    stdout: `Coverage capture verified: ${runId}\n`,
    stderr: "",
  });
});

for (const { name, mutate, rows } of [
  {
    name: "the Istanbul map is deleted",
    mutate: (root: string) => rm(path.join(root, PUBLIC.istanbul)),
    rows: [{ kind: "missing-artifact", path: PUBLIC.istanbul }],
  },
  {
    name: "the Istanbul map gains a byte",
    mutate: (root: string) => appendFile(path.join(root, PUBLIC.istanbul), "\n"),
    rows: [{ kind: "artifact-digest", path: PUBLIC.istanbul }],
  },
  {
    name: "the validation receipt is deleted",
    mutate: (root: string) => rm(path.join(root, PUBLIC.validation)),
    rows: [{ kind: "missing-artifact", path: PUBLIC.validation }],
  },
  {
    name: "the LCOV changes",
    mutate: (root: string) => appendFile(path.join(root, PUBLIC.lcov), "TN:\n"),
    rows: [{ kind: "artifact-digest", path: PUBLIC.lcov }],
  },
  {
    name: "the manifest is deleted",
    mutate: (root: string) => rm(path.join(root, PUBLIC.manifest)),
    rows: [{ kind: "missing-manifest", path: PUBLIC.manifest }],
  },
]) {
  test(`refuses the consumer readback once ${name}`, async (t) => {
    // arrange
    const { root } = await verifiedRoot(t, tallyFixture());
    await mutate(root);

    // act
    const validation = validate(root);

    // assert
    assert.deepStrictEqual(verdict(validation), { status: 1, rows });
  });
}

test("refuses the consumer readback once another run's Istanbul map replaces this one", async (t) => {
  // arrange
  const { root } = await verifiedRoot(t, tallyFixture());
  const other = await verifiedRoot(t, tallyFixture());
  await copyFile(path.join(other.root, PUBLIC.istanbul), path.join(root, PUBLIC.istanbul));

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "artifact-digest", path: PUBLIC.istanbul }],
  });
});

// A consumer that trusted digests alone would accept this bundle: every
// digest agrees, and only the re-validation of the map itself can refuse it.
test("revalidates the accepted map on readback instead of trusting its digests", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const verified = await verifiedRoot(t, fixture);
  const [statement] = fixture.statements;
  assert.ok(statement);
  await republishFile(verified, fixture.sourcePath, (file) => ({
    ...file,
    statementMap: {
      ...file.statementMap,
      0: { start: { line: statement.loc.start.line, column: -1 }, end: statement.loc.end },
    },
  }));

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      {
        kind: "position",
        part: "statementMap[0]",
        location: { start: { line: statement.loc.start.line, column: -1 }, end: statement.loc.end },
        path: fixture.sourcePath,
      },
    ],
  });
});

test("publishes nothing and keeps the failed run's evidence when a test fails", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const root = await createRoot(t, {
    ...fixtureFiles(fixture),
    "tests/domain/failing.test.ts": failingTest,
  });

  // act
  const verified = verify(root);

  // assert
  assert.deepStrictEqual(verdict(verified), {
    status: 1,
    rows: [{ kind: "capture", status: 1, failures: [{ kind: "tests-failed", status: 1 }] }],
  });
  assert.deepStrictEqual(publicFilesPresent(root), {
    lcov: false,
    istanbul: false,
    validation: false,
    manifest: false,
  });
  const runs = await readdir(path.join(root, "coverage", "runs"));
  assert.strictEqual(runs.length, 1);
  const manifest = await readJson<RunManifest>(
    path.join(root, "coverage", "runs", runs[0] ?? "", "manifest.json"),
  );
  assert.deepStrictEqual(
    { status: manifest.status, failures: manifest.failures },
    { status: "failed", failures: [{ kind: "tests-failed", status: 1 }] },
  );
});

// A unit test that plants a directory where the conversion writes its
// request file, so the pipeline crashes after the capture published its
// half bundle and before any step has a refusal row.
const plantingTest = `import { mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("plants a directory at the conversion request path", () => {
  mkdirSync(path.join(process.env.PI_CM_COVERAGE_RUN_DIR ?? "", "unit.request.json"));
});
`;

test("removes the captured half bundle when a step crashes without a refusal row", async (t) => {
  // arrange
  const fixture = tallyFixture();
  const root = await createRoot(t, {
    ...fixtureFiles(fixture),
    "tests/domain/planting.test.ts": plantingTest,
  });

  // act
  const crashed = verify(root);

  // assert
  assert.deepStrictEqual(verdict(crashed), { status: 1, rows: [] });
  assert.match(crashed.stderr, /EISDIR/u);
  assert.deepStrictEqual(publicFilesPresent(root), {
    lcov: false,
    istanbul: false,
    validation: false,
    manifest: false,
  });
  assert.strictEqual((await readdir(path.join(root, "coverage", "runs"))).length, 1);
});

test("removes the previous acceptance before a replacement run publishes anything", async (t) => {
  // arrange
  const { root } = await verifiedRoot(t, tallyFixture());
  await writeFile(path.join(root, "tests/domain/failing.test.ts"), failingTest);

  // act
  const replacement = verify(root);

  // assert
  assert.strictEqual(replacement.status, 1);
  assert.deepStrictEqual(publicFilesPresent(root), {
    lcov: false,
    istanbul: false,
    validation: false,
    manifest: false,
  });
  assert.strictEqual((await readdir(path.join(root, "coverage", "runs"))).length, 2);
});

test("prunes every superseded run directory once a replacement run is accepted", async (t) => {
  // arrange
  const { root, runId: superseded } = await verifiedRoot(t, tallyFixture());
  const failingPath = path.join(root, "tests/domain/failing.test.ts");
  await writeFile(failingPath, failingTest);
  assert.strictEqual(verify(root).status, 1);
  await rm(failingPath);
  await mkdir(path.join(root, "coverage", "runs", "not-a-run"));

  // act
  const replacement = verify(root);

  // assert
  assert.strictEqual(replacement.status, 0, replacement.stderr);
  const accepted = await readJson<AcceptedManifest>(path.join(root, PUBLIC.manifest));
  assert.notStrictEqual(accepted.runId, superseded);
  assert.deepStrictEqual((await readdir(path.join(root, "coverage", "runs"))).sort(), [
    accepted.runId,
    "not-a-run",
  ]);
});

test("exits 2 without a refusal row on an unknown option", () => {
  // act
  const verified = run([unitCliPath, "--verbose"]);

  // assert
  assert.deepStrictEqual(verdict(verified), { status: 2, rows: [] });
});

// The production population (D-04, D-07): every production source of the
// fixture root is in the accepted map, with the loaded modules merged across
// workers, the never-loaded executable module at zero execution and the
// type-only module as an empty record; the native LCOV totals (which count
// only the two loaded files) and the syntax totals (which count all four) are
// recorded apart and never equated.

interface UnloadedRecord {
  readonly path: string;
  readonly source: string;
  readonly executed: string;
  readonly syntax: string;
  readonly functions: number;
  readonly statements: number;
  readonly branches: number;
}

interface PopulationManifest extends AcceptedManifest {
  readonly acceptance: AcceptedManifest["acceptance"] & {
    readonly population: {
      readonly production: number;
      readonly loaded: number;
      readonly unloaded: readonly UnloadedRecord[];
      readonly typeOnly: number;
      readonly executable: number;
    };
    readonly denominators: Record<string, unknown>;
  };
}

// The executed text of an unloaded `.ts` source: Node's own strip mode with
// the module URL as the sourceURL trailer, exactly what the loader would have
// evaluated.
function executedDigest(root: string, modulePath: string, source: string): string {
  const url = pathToFileURL(path.join(root, modulePath)).href;
  return sha256(Buffer.from(stripTypeScriptTypes(source, { mode: "strip", sourceUrl: url })));
}

async function populationRoot(t: TestContext): Promise<VerifiedRoot> {
  const root = await createRoot(t, populationFiles());
  const verified = verify(root);
  assert.strictEqual(verified.status, 0, verified.stderr);
  const manifest = await readJson<AcceptedManifest>(path.join(root, PUBLIC.manifest));
  return {
    root,
    runId: manifest.runId,
    runDirectory: path.join(root, "coverage", "runs", manifest.runId),
    manifest,
  };
}

// Republishes the accepted population map with one file's record replaced.
async function republishFile(
  verified: VerifiedRoot,
  modulePath: string,
  mutate: (file: IstanbulFileCoverage) => IstanbulFileCoverage,
): Promise<void> {
  const key = path.join(verified.root, modulePath);
  await republish(verified, (map) => {
    const file = map[key];
    assert.ok(file);
    return { ...map, [key]: mutate(file) };
  });
}

test("accounts for every production source: merged workers, an uncalled import, an unloaded module and a type-only module", async (t) => {
  // arrange
  const root = await createRoot(t, populationFiles());
  const sources = populationSources();
  const unloadedSource = (modulePath: string): string =>
    sources.find((source) => source.path === modulePath)?.source ?? "";

  // act
  const verified = verify(root);

  // assert
  assert.strictEqual(verified.status, 0, verified.stderr);
  const manifest = await readJson<PopulationManifest>(path.join(root, PUBLIC.manifest));
  assert.strictEqual(
    verified.stdout.split("\n").at(-2),
    `Coverage unit verified: ${manifest.runId}: 4 production file(s), 2 loaded, 2 unloaded (1 type-only, 1 executable); native 8/10 line(s), 2/3 function(s), 4/4 branch(es); syntax 2/4 function(s), 2/6 statement(s), 0/2 branch arm(s) -> ${PUBLIC.manifest}`,
  );
  const map = await readJson<IstanbulCoverageMap>(path.join(root, PUBLIC.istanbul));
  const projected = new Map(
    sources.map(({ path: modulePath }) => {
      const file = map[path.join(root, modulePath)];
      assert.ok(file, `the map lacks ${modulePath}`);
      return [modulePath, projectCoverage(file)];
    }),
  );
  assert.deepStrictEqual(
    projected,
    new Map(sources.map(({ path: modulePath, expected }) => [modulePath, expected])),
  );
  assert.strictEqual(Object.keys(map).length, 4);
  assert.deepStrictEqual(manifest.acceptance.population, {
    production: 4,
    loaded: 2,
    unloaded: [
      {
        path: TYPES_PATH,
        source: sha256(Buffer.from(unloadedSource(TYPES_PATH))),
        executed: executedDigest(root, TYPES_PATH, unloadedSource(TYPES_PATH)),
        syntax: "type-only",
        functions: 0,
        statements: 0,
        branches: 0,
      },
      {
        path: UNIMPORTED_PATH,
        source: sha256(Buffer.from(unloadedSource(UNIMPORTED_PATH))),
        executed: executedDigest(root, UNIMPORTED_PATH, unloadedSource(UNIMPORTED_PATH)),
        syntax: "executable",
        functions: 1,
        statements: 3,
        branches: 1,
      },
    ],
    typeOnly: 1,
    executable: 1,
  });
  // Node's LCOV covers the two loaded files: pair.ts (7 lines, 2 functions,
  // and a branch for each block V8 entered: the module root and both function
  // bodies) and idle.ts (3 lines with the body and closing brace unexecuted,
  // 1 function, and only the module root as a branch, since V8 reports no
  // block for a function it never entered). The syntax model covers all four
  // files, so the two denominators differ in kind and in population.
  assert.deepStrictEqual(manifest.acceptance.denominators, {
    native: {
      records: 2,
      lines: { found: 10, hit: 8 },
      functions: { found: 3, hit: 2 },
      branches: { found: 4, hit: 4 },
    },
    syntax: {
      files: 4,
      functions: { total: 4, covered: 2 },
      statements: { total: 6, covered: 2 },
      branchArms: { total: 2, covered: 0 },
    },
  });
});

test("passes the consumer readback with every production source counted", async (t) => {
  // arrange
  const { root, runId } = await populationRoot(t);

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(validation, {
    status: 0,
    stdout: `Coverage bundle verified: ${runId}, 4 file(s), 4 function(s), 6 statement(s), 1 branch(es), schema 1, syntax model 1; manifest ${PUBLIC.manifest}\n`,
    stderr: "",
  });
});

test("refuses an unloaded source whose record shows execution", async (t) => {
  // arrange
  const verified = await populationRoot(t);
  await republishFile(verified, UNIMPORTED_PATH, (file) => ({ ...file, f: { ...file.f, 0: 1 } }));

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "unloaded-hits", part: "f[0]", hits: 1, path: UNIMPORTED_PATH }],
  });
});

test("refuses an unloaded executable source recorded as an empty map", async (t) => {
  // arrange
  const verified = await populationRoot(t);
  const expected = unimportedCoverage();
  await republishFile(verified, UNIMPORTED_PATH, (file) => ({
    path: file.path,
    statementMap: {},
    fnMap: {},
    branchMap: {},
    s: {},
    f: {},
    b: {},
  }));

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      ...expected.functions.map((fn) => ({
        kind: "function-missing",
        decl: fn.decl,
        loc: fn.loc,
        path: UNIMPORTED_PATH,
      })),
      ...expected.statements.map((statement) => ({
        kind: "statement-missing",
        loc: statement.loc,
        path: UNIMPORTED_PATH,
      })),
      ...expected.branches.map((branch) => ({
        kind: "branch-missing",
        type: branch.type,
        loc: branch.loc,
        locations: [branch.locations[0], { start: {}, end: {} }],
        path: UNIMPORTED_PATH,
      })),
    ],
  });
});

test("refuses a type-only source that carries a record", async (t) => {
  // arrange
  const verified = await populationRoot(t);
  const invented = { start: { line: 1, column: 0 }, end: { line: 1, column: 6 } };
  await republishFile(verified, TYPES_PATH, (file) => ({
    ...file,
    statementMap: { 0: invented },
    s: { 0: 1 },
  }));

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      { kind: "statement-unproven", id: "0", loc: invented, path: TYPES_PATH },
      { kind: "unloaded-hits", part: "s[0]", hits: 1, path: TYPES_PATH },
    ],
  });
});

// The bytes of the map and the counts of the summary are a function of the
// tree and the tests alone, so a second run of an unchanged tree publishes
// the same measurement under a new run identity, and the first run's
// directory is gone once the second is accepted.
test("publishes the same map and summary for a second run of an unchanged tree", async (t) => {
  // arrange
  const first = await populationRoot(t);
  const firstMap = await readFile(path.join(first.runDirectory, "unit.istanbul.json"));
  const firstAccepted = await readJson<PopulationManifest>(
    path.join(first.runDirectory, "accepted.json"),
  );

  // act
  const replacement = verify(first.root);

  // assert
  assert.strictEqual(replacement.status, 0, replacement.stderr);
  const second = await readJson<PopulationManifest>(path.join(first.root, PUBLIC.manifest));
  assert.notStrictEqual(second.runId, first.runId);
  assert.deepStrictEqual(await readdir(path.join(first.root, "coverage", "runs")), [second.runId]);
  assert.deepStrictEqual(await readFile(path.join(first.root, PUBLIC.istanbul)), firstMap);
  assert.deepStrictEqual(
    { population: second.acceptance.population, denominators: second.acceptance.denominators },
    {
      population: firstAccepted.acceptance.population,
      denominators: firstAccepted.acceptance.denominators,
    },
  );
});

// Every digest of this bundle agrees and only its summary is another run's:
// the counts a reader takes from the manifest must be the ones this run
// yields, never a historical record.
test("refuses the consumer readback once the recorded summary is another run's", async (t) => {
  // arrange
  const verified = await verifiedRoot(t, tallyFixture());
  const other = await populationRoot(t);
  const historical = await readJson<PopulationManifest>(path.join(other.root, PUBLIC.manifest));

  for (const manifestPath of [
    path.join(verified.runDirectory, "accepted.json"),
    path.join(verified.root, PUBLIC.manifest),
  ]) {
    const manifest = await readJson<PopulationManifest>(manifestPath);
    const acceptance = {
      ...manifest.acceptance,
      population: historical.acceptance.population,
      denominators: historical.acceptance.denominators,
    };
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, acceptance }, undefined, 2)}\n`);
  }

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      { kind: "summary-mismatch", field: "population" },
      { kind: "summary-mismatch", field: "denominators" },
    ],
  });
});

test("refuses a bundle whose manifest no longer represents an unloaded source", async (t) => {
  // arrange
  const verified = await populationRoot(t);

  for (const manifestPath of [
    path.join(verified.runDirectory, "accepted.json"),
    path.join(verified.root, PUBLIC.manifest),
  ]) {
    const manifest = await readJson<{ unloaded: UnloadedRecord[] }>(manifestPath);
    manifest.unloaded = manifest.unloaded.filter((record) => record.path !== UNIMPORTED_PATH);
    await writeFile(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`);
  }

  // act
  const validation = validate(verified.root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "unrepresented-source", path: UNIMPORTED_PATH }],
  });
});
