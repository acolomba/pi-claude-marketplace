import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertCompleteCoverage } from "./test-coverage-direct.mjs";

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

// One LCOV record. The source field is an ABSOLUTE in-repo path on purpose: the assertion resolves
// record paths against the module-level project root and not against its injectable root, so a
// record pointing into a fixture tree is refused as outside the project before any verdict can be
// reached. Concatenating two calls states the same source twice.
function lcovRecord(recordSourcePath, counts) {
  const lines = [
    `SF:${path.join(projectRoot, recordSourcePath)}`,
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
    assertCompleteCoverage(realSourcePath, lcovRecord(realSourcePath, completeCounts)),
    "branches 4/4, functions 3/3, lines 12/12",
  );

  // Shortfall. Pin the verdict's SHAPE -- it names the source and reports the deficient counter as
  // hit over found, and reports only that counter -- without pinning an absolute branch pair.
  assert.throws(
    () => assertCompleteCoverage(realSourcePath, lcovRecord(realSourcePath, shortfallCounts)),
    /Incomplete direct coverage for extensions\/.+atomic-json\.ts: branches \d+\/\d+$/,
  );

  // Ambiguity. Two records claiming one source is a refusal, not a choice between them.
  assert.throws(
    () =>
      assertCompleteCoverage(
        realSourcePath,
        lcovRecord(realSourcePath, completeCounts) + lcovRecord(realSourcePath, completeCounts),
      ),
    /Expected one LCOV record for extensions\/.+atomic-json\.ts, found 2$/,
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

  process.stdout.write("Direct-coverage negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
