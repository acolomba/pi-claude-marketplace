import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertCompleteCoverage, assertReportComplete } from "./test-coverage-direct.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "direct-coverage-gate-"));
const sourceDirectory = path.join(fixtureRoot, "extensions/pi-claude-marketplace/domain");
const sourcePath = "extensions/pi-claude-marketplace/domain/types.ts";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const gatePath = fileURLToPath(new URL("./test-coverage-direct.mjs", import.meta.url));
// A real production module, and deliberately not a type-only one: a source that could take the
// type-only escape would let a malformed state pass without ever reaching a verdict.
const realSourcePath = "extensions/pi-claude-marketplace/shared/atomic-json.ts";
// A real file under the test root that is not a corresponding test, so the mapping refusal is
// planted against a path that exists and still cannot be mapped.
const unmappablePath = "tests/edge/notification-boundary.ts";

/** The absolute path a real coverage run would write for an in-repo module. */
function inRepo(relativePath) {
  return path.join(projectRoot, relativePath);
}

// One LCOV record. The caller states the source field as an absolute path, because which root a
// record resolves against is one of the things being planted here: a record under the injected root
// has to be selected, and a record outside every root has to be passed over rather than refused.
// Concatenating two calls states the same source twice.
function lcovRecord(recordSourcePath, counts) {
  const lines = [
    `SF:${recordSourcePath}`,
    `BRF:${counts.branches.found}`,
    `BRH:${counts.branches.hit}`,
    `FNF:${counts.functions.found}`,
    `FNH:${counts.functions.hit}`,
    `LF:${counts.lines.found}`,
    `LH:${counts.lines.hit}`,
    "end_of_record",
  ];

  return `${lines.join("\n")}\n`;
}

const completeCounts = {
  branches: { found: 4, hit: 4 },
  functions: { found: 3, hit: 3 },
  lines: { found: 12, hit: 12 },
};
const shortfallCounts = {
  branches: { found: 4, hit: 3 },
  functions: { found: 3, hit: 3 },
  lines: { found: 12, hit: 12 },
};

try {
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    path.join(fixtureRoot, sourcePath),
    "export interface Answer { value: number; }\n",
  );

  assert.equal(assertCompleteCoverage(sourcePath, "", fixtureRoot), "type-only");

  await writeFile(path.join(fixtureRoot, sourcePath), "export const answer = 42;\n");
  assert.throws(
    () => assertCompleteCoverage(sourcePath, "", fixtureRoot),
    /Expected one LCOV record.*found 0/,
  );

  // The complete state comes first and is not decoration: a malformed synthetic text parses to zero
  // records, which would make both throwing states below fire on the zero-record arm and measure
  // nothing.
  assert.equal(
    assertCompleteCoverage(realSourcePath, lcovRecord(inRepo(realSourcePath), completeCounts)),
    "branches 4/4, functions 3/3, lines 12/12",
  );

  // Shortfall. Pin the verdict's SHAPE -- it names the source and reports the deficient counter as
  // hit over found, and reports only that counter -- without pinning an absolute branch pair.
  assert.throws(
    () =>
      assertCompleteCoverage(realSourcePath, lcovRecord(inRepo(realSourcePath), shortfallCounts)),
    /Incomplete direct coverage for extensions\/.+atomic-json\.ts: branches \d+\/\d+$/,
  );

  // Ambiguity. Two records claiming one source is a refusal, not a choice between them.
  assert.throws(
    () =>
      assertCompleteCoverage(
        realSourcePath,
        lcovRecord(inRepo(realSourcePath), completeCounts) +
          lcovRecord(inRepo(realSourcePath), completeCounts),
      ),
    /Expected one LCOV record for extensions\/.+atomic-json\.ts, found 2$/,
  );

  // The injected root governs record selection, not just the type-only probe. A fixture LCOV naming
  // a fixture path reaches a verdict; a root threaded only halfway would select nothing here and
  // answer through the type-only escape instead, which is a wrong answer shaped like a pass.
  assert.equal(
    assertCompleteCoverage(
      sourcePath,
      lcovRecord(path.join(fixtureRoot, sourcePath), completeCounts),
      fixtureRoot,
    ),
    "branches 4/4, functions 3/3, lines 12/12",
  );

  // A record from outside every root is a non-match, not an abort. An LCOV carrying an out-of-tree
  // peer dependency or a symlinked node_modules must leave the gate able to answer. The fixture
  // source is not type-only at this point, so the answer is the zero-record refusal rather than a
  // pass -- which is what distinguishes "passed over" from "silently accepted".
  assert.throws(
    () =>
      assertCompleteCoverage(
        sourcePath,
        lcovRecord(path.resolve(fixtureRoot, "..", "outside-every-root/peer.ts"), completeCounts),
        fixtureRoot,
      ),
    /Expected one LCOV record.*found 0/,
  );

  // The two mapping refusals no exported assertion can reach, driven through the command instead.
  const outsideProject = spawnSync(process.execPath, [gatePath, "../outside-the-project.ts"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(outsideProject.status, 0);
  assert.match(outsideProject.stderr, /Path is outside the project: \.\.\/outside-the-project\.ts/);

  const unmappableInTree = spawnSync(process.execPath, [gatePath, unmappablePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(unmappableInTree.status, 0);
  assert.match(
    unmappableInTree.stderr,
    /Not a corresponding test path: tests\/edge\/notification-boundary\.ts/,
  );

  // The all-pair completeness assertion. These records are string pairs only -- the assertion never
  // reads the disk -- so the fixture names deliberately do not exist in the tree.
  const enumeratedModules = [
    "extensions/pi-claude-marketplace/domain/alpha.ts",
    "extensions/pi-claude-marketplace/domain/beta.ts",
    "extensions/pi-claude-marketplace/shared/gamma.ts",
  ];
  const completeRecords = [
    { sourcePath: enumeratedModules[0], testPath: "tests/domain/alpha.test.ts" },
    { sourcePath: enumeratedModules[1], testPath: "tests/domain/beta.test.ts" },
    { sourcePath: enumeratedModules[2], testPath: "tests/shared/gamma.test.ts" },
  ];

  // The passing state comes first and is not decoration: without it the three refusals below could
  // all be firing on a malformed record list rather than on the property each one claims.
  assert.doesNotThrow(() => assertReportComplete(completeRecords, enumeratedModules));

  // A run that quietly visited one row fewer. Whole-value comparison: the verdict names the module.
  assert.throws(
    () => assertReportComplete([completeRecords[0], completeRecords[2]], enumeratedModules),
    {
      message: "Missing from the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts",
    },
  );

  // A row counted twice. The repeat is reported ahead of the row it displaced, because the repeat is
  // the cause and the absence is the symptom.
  assert.throws(
    () =>
      assertReportComplete(
        [completeRecords[0], completeRecords[1], completeRecords[1]],
        enumeratedModules,
      ),
    {
      message:
        "Repeated sourcePath in the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts",
    },
  );

  // Two rows claiming one test. The source paths are distinct, so only the test-path half of the
  // repeat check can refuse this -- without this state that half is never exercised.
  assert.throws(
    () =>
      assertReportComplete(
        [
          completeRecords[0],
          { sourcePath: enumeratedModules[1], testPath: completeRecords[0].testPath },
          completeRecords[2],
        ],
        enumeratedModules,
      ),
    {
      message: "Repeated testPath in the all-pair result: tests/domain/alpha.test.ts",
    },
  );

  // A row whose test path is well-formed and unique but does not map back to its own source.
  assert.throws(
    () =>
      assertReportComplete(
        [
          completeRecords[0],
          completeRecords[1],
          { sourcePath: enumeratedModules[2], testPath: "tests/shared/delta.test.ts" },
        ],
        enumeratedModules,
      ),
    {
      message:
        "Mapping does not round-trip in the all-pair result: extensions/pi-claude-marketplace/shared/gamma.ts <-> tests/shared/delta.test.ts",
    },
  );

  // A row for a module the run never enumerated. Nothing repeats, everything round-trips and no
  // enumerated module is absent, so only the count check can refuse it. Without this state the count
  // check would ship unplanted.
  assert.throws(
    () =>
      assertReportComplete(
        [
          ...completeRecords,
          {
            sourcePath: "extensions/pi-claude-marketplace/shared/delta.ts",
            testPath: "tests/shared/delta.test.ts",
          },
        ],
        enumeratedModules,
      ),
    {
      message: "Expected 3 all-pair records, found 4",
    },
  );

  process.stdout.write("Direct-coverage negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
