import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { twinsFixture } from "./coverage-correspondence-fixtures.ts";
import {
  capturedConversion,
  fallowHealth,
  MAP_PATH,
  readJson,
  refusalRows,
  run,
  writeMap,
} from "./coverage-run-support.ts";

import type {
  CapturedConversion,
  FailureRow,
  IstanbulCoverageMap,
  IstanbulFileCoverage,
  ProcessRun,
} from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// The validator CLI is exercised as a process against a fixture root that
// holds a real capture run and the map the producer CLI converted from it,
// so every verdict below is the shipping operation's exit status and rows,
// never a library call the CLI could bypass. A refusal is exit 1 with one
// `{ kind, ... }` row per finding; a usage or setup failure is exit 2 with no
// row; a launch failure has no row either, so a control that reads rows can
// never take a crash for a detection (D-02, D-03, D-09).

const scriptsUrl = new URL("../../scripts/", import.meta.url);
const validateCliPath = fileURLToPath(new URL("coverage-validate.mjs", scriptsUrl));

// The validator scripts whose bytes an acceptance receipt binds.
const VALIDATOR_TOOLING = [
  "coverage-validate.mjs",
  "coverage-schema.mjs",
  "coverage-correspondence.mjs",
  "coverage-syntax.mjs",
  "coverage-source-map.mjs",
];

const RECEIPT_PATH = "coverage/unit.validation.json";

interface ValidationRoot extends CapturedConversion {
  readonly mapPath: string;
}

type ValidationReceipt = Readonly<Record<string, unknown>>;

// A fixture root captured and converted, with the converted map published
// at the path the validator reads by default.
async function validationRoot(t: TestContext): Promise<ValidationRoot> {
  const conversion = await capturedConversion(t, twinsFixture());
  const mapPath = await writeMap(conversion.root, conversion.map);
  return { ...conversion, mapPath };
}

function validate(root: string, ...args: readonly string[]): ProcessRun {
  return run([validateCliPath, "--root", root, ...args]);
}

function verdict(validation: ProcessRun): { status: number; rows: readonly FailureRow[] } {
  return { status: validation.status, rows: refusalRows(validation.stderr) };
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fileDigest(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

async function receiptAt(root: string): Promise<ValidationReceipt | undefined> {
  const receiptPath = path.join(root, RECEIPT_PATH);
  return existsSync(receiptPath) ? readJson<ValidationReceipt>(receiptPath) : undefined;
}

function idWhere<T>(entries: Readonly<Record<string, T>>, matches: (entry: T) => boolean): string {
  const found = Object.entries(entries).find(([, entry]) => matches(entry));
  assert.ok(found, "the map lacks the record the control removes");
  return found[0];
}

function withoutFunction(file: IstanbulFileCoverage, id: string): IstanbulFileCoverage {
  const { [id]: _fn, ...fnMap } = file.fnMap;
  const { [id]: _hits, ...f } = file.f;
  return { ...file, fnMap, f };
}

// The map with the first `check` callback dropped, and that callback's spans.
function droppedFirstCheck(published: ValidationRoot): {
  readonly map: IstanbulCoverageMap;
  readonly dropped: { readonly decl: unknown; readonly loc: unknown };
} {
  const dropped = published.fixture.functions[1];
  assert.ok(dropped);
  const id = idWhere(
    published.file.fnMap,
    (fn) =>
      fn.decl.start.line === dropped.decl.start.line &&
      fn.decl.start.column === dropped.decl.start.column,
  );
  return {
    map: { [published.captured.modulePath]: withoutFunction(published.file, id) },
    dropped: { decl: dropped.decl, loc: dropped.loc },
  };
}

test("accepts the converted map of a captured fixture root", async (t) => {
  // arrange
  const { root, captured } = await validationRoot(t);

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(validation, {
    status: 0,
    stdout: `Coverage map validated: ${path.basename(captured.directory)}, 1 file(s), 4 function(s), 10 statement(s), 4 branch(es), schema 1, syntax model 1; receipt ${RECEIPT_PATH}\n`,
    stderr: "",
  });
});

test("writes an acceptance receipt bound to the run, the map bytes and the validator bytes", async (t) => {
  // arrange
  const { fixture, root, captured, mapPath } = await validationRoot(t);
  const tooling: Record<string, string> = {};

  for (const fileName of VALIDATOR_TOOLING) {
    tooling[fileName] = await fileDigest(fileURLToPath(new URL(fileName, scriptsUrl)));
  }

  // act
  validate(root);

  // assert
  assert.deepStrictEqual(await receiptAt(root), {
    kind: "pi-claude-marketplace-unit-coverage-validation",
    schemaVersion: 1,
    status: "accepted",
    runId: path.basename(captured.directory),
    manifest: {
      path: "coverage/unit.manifest.json",
      digest: await fileDigest(path.join(root, "coverage/unit.manifest.json")),
    },
    map: { path: MAP_PATH, digest: await fileDigest(mapPath) },
    modules: [
      {
        path: fixture.sourcePath,
        source: captured.record.source,
        executed: captured.record.executed,
      },
    ],
    model: { coverageSchema: 1, syntax: 1 },
    tooling,
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    totals: { files: 1, functions: 4, statements: 10, branches: 4 },
  });
});

// Fallow scores the incomplete map without complaint, estimating the
// dropped callback from its complexity; the validator names the exact spans
// that are missing.
test("refuses a map whose first check callback was dropped, which the installed Fallow scores from an estimate", async (t) => {
  // arrange
  const published = await validationRoot(t);
  const { fixture, root, mapPath } = published;
  const { map, dropped } = droppedFirstCheck(published);
  await writeMap(root, map);

  // act
  const validation = validate(root);
  const health = fallowHealth(root, mapPath);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "function-missing", ...dropped, path: fixture.sourcePath }],
  });
  assert.deepStrictEqual(health, {
    status: 0,
    matched: 3,
    functions: [
      {
        path: fixture.sourcePath,
        name: "anyLarge",
        line: 1,
        coveragePct: 80,
        coverageSource: "istanbul",
      },
      {
        path: fixture.sourcePath,
        name: "check",
        line: 2,
        coveragePct: null,
        coverageSource: "estimated",
      },
      {
        path: fixture.sourcePath,
        name: "allSmall",
        line: 12,
        coveragePct: 80,
        coverageSource: "istanbul",
      },
      {
        path: fixture.sourcePath,
        name: "check",
        line: 13,
        coveragePct: 75,
        coverageSource: "istanbul",
      },
    ],
  });
});

test("refuses a map whose never-taken return statement was dropped, naming its exact span", async (t) => {
  // arrange
  const { fixture, root, captured, file } = await validationRoot(t);
  const statement = fixture.statements[3];
  assert.ok(statement);
  const id = idWhere(
    file.statementMap,
    (loc) =>
      loc.start.line === statement.loc.start.line &&
      loc.start.column === statement.loc.start.column,
  );
  const { [id]: _loc, ...statementMap } = file.statementMap;
  const { [id]: _hits, ...s } = file.s;
  await writeMap(root, { [captured.modulePath]: { ...file, statementMap, s } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "statement-missing", loc: statement.loc, path: fixture.sourcePath }],
  });
});

test("refuses a map whose statement counters do not name every statement", async (t) => {
  // arrange
  const { fixture, root, captured, file } = await validationRoot(t);
  const { 3: _dropped, ...s } = file.s;
  await writeMap(root, { [captured.modulePath]: { ...file, s } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      {
        kind: "counter-keys",
        map: "statementMap",
        counter: "s",
        missing: ["3"],
        extra: [],
        path: fixture.sourcePath,
      },
    ],
  });
});

test("refuses a map that files the production module outside the root", async (t) => {
  // arrange
  const { fixture, root, file } = await validationRoot(t);
  const outside = path.join(path.dirname(root), "elsewhere", fixture.sourcePath);
  await writeMap(root, { [outside]: { ...file, path: outside } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      { kind: "foreign-path", path: outside },
      { kind: "production-missing", path: fixture.sourcePath },
    ],
  });
});

test("refuses a map that names the production module twice", async (t) => {
  // arrange
  const { fixture, root, captured, file, map } = await validationRoot(t);
  const detour = `${root}/extensions/../${fixture.sourcePath}`;
  await writeMap(root, { ...map, [detour]: { ...file, path: detour } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [
      { kind: "path-not-canonical", path: detour },
      { kind: "duplicate-file", path: fixture.sourcePath, keys: [captured.modulePath, detour] },
    ],
  });
});

test("refuses a map that names a file the run did not inventory as production", async (t) => {
  // arrange
  const { root, map, file } = await validationRoot(t);
  const testPath = path.join(root, "tests/domain/twins.test.ts");
  await writeMap(root, { ...map, [testPath]: { ...file, path: testPath } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "unlisted-file", path: testPath }],
  });
});

test("refuses an empty map as missing every production source", async (t) => {
  // arrange
  const { fixture, root } = await validationRoot(t);
  await writeMap(root, {});

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "production-missing", path: fixture.sourcePath }],
  });
});

test("refuses a source that changed after the capture instead of relocating its records", async (t) => {
  // arrange
  const { fixture, root } = await validationRoot(t);
  await appendFile(path.join(root, fixture.sourcePath), "// a comment after the capture\n");

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "stale-input", added: [], removed: [], changed: [fixture.sourcePath] }],
  });
});

test("refuses a run whose capture tooling digests changed", async (t) => {
  // arrange
  const { root, captured } = await validationRoot(t);
  const publicManifestPath = path.join(root, "coverage/unit.manifest.json");
  const manifestText = await readFile(publicManifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as { tooling: Record<string, string> };
  const captureDigest = manifest.tooling["coverage-capture.mjs"];
  assert.ok(captureDigest);
  const changedText = manifestText.replace(captureDigest, "0".repeat(64));
  await writeFile(publicManifestPath, changedText);
  await writeFile(captured.manifestPath, changedText);

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "tool-changed" }],
  });
});

test("refuses a map that is not JSON", async (t) => {
  // arrange
  const { root, mapPath } = await validationRoot(t);
  await writeFile(mapPath, "{ not json");

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "malformed-json", path: MAP_PATH }],
  });
});

test("refuses a missing map", async (t) => {
  // arrange
  const { root } = await validationRoot(t);

  // act
  const validation = validate(root, "--map", "coverage/other.istanbul.json");

  // assert
  assert.deepStrictEqual(verdict(validation), {
    status: 1,
    rows: [{ kind: "missing-artifact", path: "coverage/other.istanbul.json" }],
  });
});

test("removes the acceptance receipt of an earlier run when the map is refused", async (t) => {
  // arrange
  const published = await validationRoot(t);
  const { root } = published;
  const accepted = validate(root);
  assert.strictEqual(accepted.status, 0, accepted.stderr);
  assert.ok(await receiptAt(root));
  await writeMap(root, droppedFirstCheck(published).map);

  // act
  const validation = validate(root);

  // assert
  assert.strictEqual(validation.status, 1);
  assert.strictEqual(await receiptAt(root), undefined);
});

for (const { name, args } of [
  { name: "an unknown option", args: ["--verbose"] },
  { name: "a root that is not a directory", args: ["--root", "/nonexistent/root"] },
]) {
  test(`exits 2 without a refusal row on ${name}`, () => {
    // arrange
    const expected = { status: 2, rows: [] };

    // act
    const validation = run([validateCliPath, ...args]);

    // assert
    assert.deepStrictEqual(verdict(validation), expected);
  });
}

// A process that never reaches the validator has no refusal row, so a
// control that requires the row cannot mistake the crash for a detection.
test("distinguishes a launch failure from a refusal by the absence of rows", () => {
  // arrange
  const missingScript = `${validateCliPath}.missing`;

  // act
  const launch = run([missingScript, "--root", "/nonexistent/root"]);

  // assert
  assert.deepStrictEqual(verdict(launch), { status: 1, rows: [] });
});
