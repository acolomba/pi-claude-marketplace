import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { twinsFixture } from "./coverage-correspondence-fixtures.ts";
import {
  captureFixture,
  convertFromRun,
  createRoot,
  fixtureFiles,
  refusalRows,
  run,
  writeMap,
} from "./coverage-run-support.ts";

import type { ProducerFixture } from "./coverage-producer-fixtures.ts";
import type { CapturedRun, IstanbulFileCoverage, ProcessRun } from "./coverage-run-support.ts";
import type { TestContext } from "node:test";

// The validator CLI is exercised as a process against a fixture root that
// holds a real capture run and the map the producer CLI converted from it,
// so every verdict below is the shipping operation's exit status and rows,
// never a library call the CLI could bypass (D-02, D-03, D-09).

const validateCliPath = fileURLToPath(
  new URL("../../scripts/coverage-validate.mjs", import.meta.url),
);

interface ValidationRoot {
  readonly fixture: ProducerFixture;
  readonly root: string;
  readonly captured: CapturedRun;
  readonly file: IstanbulFileCoverage;
}

// A fixture root captured and converted, with the converted map published
// at the path the validator reads by default.
async function validationRoot(t: TestContext): Promise<ValidationRoot> {
  const fixture = twinsFixture();
  const root = await createRoot(t, fixtureFiles(fixture));
  const captured = await captureFixture(root, fixture);
  const map = await convertFromRun(t, captured);
  const file = map[captured.modulePath];
  assert.ok(file);
  await writeMap(root, map);
  return { fixture, root, captured, file };
}

function validate(root: string, ...args: readonly string[]): ProcessRun {
  return run([validateCliPath, "--root", root, ...args]);
}

test("accepts the converted map of a captured fixture root", async (t) => {
  // arrange
  const { root, captured } = await validationRoot(t);

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(validation, {
    status: 0,
    stdout: `Coverage map validated: ${path.basename(captured.directory)}, 1 file(s), 4 function(s), 10 statement(s), 4 branch(es), schema 1, syntax model 1\n`,
    stderr: "",
  });
});

test("refuses a map whose first check callback was dropped, naming its exact spans", async (t) => {
  // arrange
  const { fixture, root, captured, file } = await validationRoot(t);
  const dropped = fixture.functions[1];
  assert.ok(dropped);
  const id = Object.keys(file.fnMap).find((candidate) => {
    const fn = file.fnMap[candidate];
    return (
      fn?.decl.start.line === dropped.decl.start.line &&
      fn.decl.start.column === dropped.decl.start.column
    );
  });
  assert.ok(id);
  const { [id]: _fn, ...fnMap } = file.fnMap;
  const { [id]: _hits, ...f } = file.f;
  await writeMap(root, { [captured.modulePath]: { ...file, fnMap, f } });

  // act
  const validation = validate(root);

  // assert
  assert.deepStrictEqual(
    { status: validation.status, rows: refusalRows(validation.stderr) },
    {
      status: 1,
      rows: [
        {
          kind: "function-missing",
          decl: dropped.decl,
          loc: dropped.loc,
          path: fixture.sourcePath,
        },
      ],
    },
  );
});
