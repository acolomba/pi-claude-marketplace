import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assertCompleteCoverage } from "./test-coverage-direct.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "direct-coverage-gate-"));
const sourceDirectory = path.join(fixtureRoot, "extensions/pi-claude-marketplace/domain");
const sourcePath = "extensions/pi-claude-marketplace/domain/types.ts";

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

  process.stdout.write("Direct-coverage negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
