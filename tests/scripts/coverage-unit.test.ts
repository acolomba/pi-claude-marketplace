import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, copyFile, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

function verdict(completed: ProcessRun): { status: number; rows: FailureRow[] } {
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

// The accepted map republished with `mutate` applied to the fixture's file
// record: both copies of the map and both copies of the manifest are
// rewritten so every digest agrees, which is the state a consumer that
// trusted digests alone would accept.
async function republish(
  verified: VerifiedRoot,
  mutate: (file: IstanbulFileCoverage) => IstanbulFileCoverage,
): Promise<void> {
  const runMapPath = path.join(verified.root, verified.manifest.acceptance.artifacts.istanbul.path);
  const map = await readJson<IstanbulCoverageMap>(runMapPath);
  const [key] = Object.keys(map);
  assert.ok(key);
  const file = map[key];
  assert.ok(file);
  const mutated = `${JSON.stringify({ [key]: mutate(file) }, undefined, 2)}\n`;
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
    verified.stdout,
    `Coverage unit verified: ${manifest.runId}: 1 production file(s), 1 loaded, 0 unloaded (0 type-only, 0 executable); native 3/3 line(s), 1/1 function(s), 2/2 branch(es); syntax 1/1 function(s), 1/1 statement(s), 0/0 branch arm(s) -> ${PUBLIC.manifest}\n`,
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
  await republish(verified, (file) => ({
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
  assert.deepStrictEqual(verdict(verified), { status: 1, rows: [{ kind: "capture", status: 1 }] });
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

test("exits 2 without a refusal row on an unknown option", () => {
  // act
  const verified = run([unitCliPath, "--verbose"]);

  // assert
  assert.deepStrictEqual(verdict(verified), { status: 2, rows: [] });
});
